'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, X, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { useBreadcrumbs } from '@/lib/breadcrumbs'
import { frappeClient } from '@/lib/api-client'

/**
 * Apex «تعديل الصلاحيات»: one row per HR sidebar section, five toggles each
 * (عرض / اضافة / تعديل / حذف / طباعة). Every checkbox here is a real
 * read/create/write/delete/print DocPerm on the underlying doctypes, not a
 * cosmetic flag — enforced by Frappe's own ORM and REST layer the moment
 * it's set, not just gating this UI — but it goes through
 * base_meena.api.hr_permissions (not Frappe's own permission_manager, which
 * is System-Manager-only) because the HR walkthrough account is HR Manager
 * without System Manager. A page's checkbox reflects/controls ALL of that
 * page's doctypes at once, mirroring how Apex shows one row per page rather
 * than per table.
 */

const GET_PERMS = 'base_meena.api.hr_permissions.get_permissions'
const SET_PERM = 'base_meena.api.hr_permissions.set_permission'
const ROLE_LABELS = 'base_meena.api.hr_lists.role_labels'

// Module-scope cache: role_labels() returns the same dict for every role, so
// fetch it once per page load instead of once per RolePermissionsPage mount.
// The label is DISPLAY ONLY — get_permissions/set_permission always keep
// using the raw `role` prop, never this map.
let roleLabelsCache: Record<string, string> | null = null
let roleLabelsPromise: Promise<Record<string, string>> | null = null
function fetchRoleLabels(): Promise<Record<string, string>> {
  if (roleLabelsCache) return Promise.resolve(roleLabelsCache)
  if (!roleLabelsPromise) {
    roleLabelsPromise = frappeClient.call<Record<string, string>>(ROLE_LABELS)
      .then((r: any) => { roleLabelsCache = (r?.message ?? {}) as Record<string, string>; return roleLabelsCache })
      .catch(() => ({}) as Record<string, string>)
  }
  return roleLabelsPromise
}

interface PermRow { permlevel: number; read?: number; create?: number; write?: number; delete?: number; print?: number }

interface PageGroup {
  key: string
  label: string
  doctypes: string[]
}

// Doctype sets are the primary, permission-bearing doctypes for each Apex
// sidebar section (see components/hr-shell/routes.ts for the full item list
// per section) — not exhaustive, but each one is a real gate a role needs to
// pass to use that section at all.
const PAGE_GROUPS: PageGroup[] = [
  { key: 'basic-data', label: 'البيانات الاساسية', doctypes: ['Employee', 'Branch', 'Designation', 'Department'] },
  { key: 'attendance', label: 'الحضور و الانصراف', doctypes: ['Employee Checkin', 'Leave Application', 'Attendance Request', 'Biometric Device'] },
  { key: 'users', label: 'المستخدمين', doctypes: ['User', 'Role'] },
  { key: 'settings', label: 'الاعدادات', doctypes: ['Company'] },
]

type PermKind = 'view' | 'add' | 'edit' | 'del' | 'print'
const PTYPE_OF: Record<PermKind, keyof PermRow> = { view: 'read', add: 'create', edit: 'write', del: 'delete', print: 'print' }
type GroupState = { view: boolean; add: boolean; edit: boolean; del: boolean; print: boolean; loading: boolean }
const EMPTY_GROUP_STATE: GroupState = { view: false, add: false, edit: false, del: false, print: false, loading: false }

export function RolePermissionsPage({ role }: { role: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const crumbs = useBreadcrumbs()
  const [loading, setLoading] = useState(true)
  const [state, setState] = useState<Record<string, GroupState>>({})
  const [roleLabel, setRoleLabel] = useState(role)

  useEffect(() => {
    let alive = true
    setRoleLabel(role) // raw name until the Arabic label resolves (or there isn't one)
    fetchRoleLabels().then((labels) => { if (alive) setRoleLabel(labels[role] || role) })
    return () => { alive = false }
  }, [role])

  const loadGroup = useCallback(async (group: PageGroup): Promise<GroupState> => {
    const results = await Promise.all(
      group.doctypes.map(async (dt) => {
        const res = await frappeClient.call<PermRow[]>(GET_PERMS, { doctype: dt, role }).catch(() => null)
        return res?.message || []
      }),
    )
    // A page only counts as "granted" once every one of its doctypes is —
    // toggling it back on re-applies to all of them, so this never drifts.
    const granted = (field: keyof PermRow) => results.every((rows) => rows.some((r) => r.permlevel === 0 && r[field]))
    return {
      view: granted('read'), add: granted('create'), edit: granted('write'),
      del: granted('delete'), print: granted('print'), loading: false,
    }
  }, [role])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const entries = await Promise.all(
        PAGE_GROUPS.map(async (g) => [g.key, await loadGroup(g)] as const),
      )
      setState(Object.fromEntries(entries))
    } catch (e) {
      toast({ title: 'تعذّر تحميل الصلاحيات', description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [loadGroup, toast])

  useEffect(() => { load() }, [load])

  const toggle = async (group: PageGroup, kind: PermKind, value: boolean) => {
    setState((prev) => ({ ...prev, [group.key]: { ...prev[group.key], loading: true } }))
    const ptype = PTYPE_OF[kind]
    try {
      for (const dt of group.doctypes) {
        await frappeClient.call(SET_PERM, { doctype: dt, role, ptype, value: value ? 1 : 0 })
      }
      const next = await loadGroup(group)
      setState((prev) => ({ ...prev, [group.key]: next }))
      toast({ title: 'تم تحديث الصلاحية' })
    } catch (e) {
      toast({ title: 'فشل تحديث الصلاحية', description: e instanceof Error ? e.message : 'تعذّر الاتصال بالخادم', variant: 'destructive' })
      const reverted = await loadGroup(group)
      setState((prev) => ({ ...prev, [group.key]: reverted }))
    }
  }

  return (
    <div dir="rtl" className="p-4 space-y-3 font-[family-name:var(--font-arabic)]">
      <div className="flex items-center justify-between gap-4 bg-white rounded shadow-sm border border-slate-200/60 px-4 py-2.5">
        <nav className="flex items-center gap-1.5 text-[13px] text-slate-600 min-w-0">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && <span className="text-slate-400">/</span>}
              <span className={i === crumbs.length - 1 ? 'font-bold text-slate-800 truncate' : 'truncate'}>{c.label}</span>
            </span>
          ))}
        </nav>
        <Button onClick={() => router.push('/hr-managers')}
          className="bg-[#f95f5f] hover:bg-[#e54a4a] text-white rounded px-5 h-9 font-bold text-[13px] shrink-0">
          <X className="h-4 w-4 ml-1.5" strokeWidth={3} />
          اغلاق
        </Button>
      </div>

      <div className="bg-white rounded shadow-sm border border-slate-200/60 p-6">
        <div className="flex items-center gap-2 mb-5">
          <ShieldCheck className="h-5 w-5 text-[#2960b6]" />
          <h3 className="text-[16px] font-bold text-slate-800">صلاحية: {roleLabel}</h3>
        </div>

        {loading ? (
          <div className="py-16 text-center"><Loader2 className="h-8 w-8 animate-spin text-[#2e71c8] mx-auto" /></div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="text-start py-2.5 px-3 font-medium">اسم الصفحة</th>
                <th className="text-center py-2.5 px-3 font-medium w-20">عرض</th>
                <th className="text-center py-2.5 px-3 font-medium w-20">اضافة</th>
                <th className="text-center py-2.5 px-3 font-medium w-20">تعديل</th>
                <th className="text-center py-2.5 px-3 font-medium w-20">حذف</th>
                <th className="text-center py-2.5 px-3 font-medium w-20">طباعة</th>
              </tr>
            </thead>
            <tbody>
              {PAGE_GROUPS.map((g) => {
                const s = state[g.key] || EMPTY_GROUP_STATE
                return (
                  <tr key={g.key} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 px-3 text-slate-700">{g.label}</td>
                    {(['view', 'add', 'edit', 'del', 'print'] as const).map((kind) => (
                      <td key={kind} className="py-3 px-3 text-center">
                        <input type="checkbox" checked={s[kind]} disabled={s.loading}
                          onChange={(e) => toggle(g, kind, e.target.checked)}
                          className="h-4 w-4 accent-[#2e71c8] cursor-pointer disabled:opacity-50" />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
