'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, X, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { useBreadcrumbs } from '@/lib/breadcrumbs'
import { frappeClient } from '@/lib/api-client'

/**
 * Apex «تعديل الصلاحيات»: one row per HR sidebar section, two toggles each
 * (عرض / اضافة). Every checkbox here is a real read/create DocPerm on the
 * underlying doctypes, not a cosmetic flag — but it goes through
 * base_meena.api.hr_permissions (not Frappe's own permission_manager, which
 * is System-Manager-only) because the HR walkthrough account is HR Manager
 * without System Manager. A page's checkbox reflects/controls ALL of that
 * page's doctypes at once, mirroring how Apex shows one row per page rather
 * than per table.
 */

const GET_PERMS = 'base_meena.api.hr_permissions.get_permissions'
const SET_PERM = 'base_meena.api.hr_permissions.set_permission'

interface PermRow { permlevel: number; read?: number; create?: number }

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

type GroupState = { view: boolean; add: boolean; loading: boolean }

export function RolePermissionsPage({ role }: { role: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const crumbs = useBreadcrumbs()
  const [loading, setLoading] = useState(true)
  const [state, setState] = useState<Record<string, GroupState>>({})

  const loadGroup = useCallback(async (group: PageGroup): Promise<GroupState> => {
    const results = await Promise.all(
      group.doctypes.map(async (dt) => {
        const res = await frappeClient.call<PermRow[]>(GET_PERMS, { doctype: dt, role }).catch(() => null)
        return res?.message || []
      }),
    )
    // A page only counts as "granted" once every one of its doctypes is —
    // toggling it back on re-applies to all of them, so this never drifts.
    const view = results.every((rows) => rows.some((r) => r.permlevel === 0 && r.read))
    const add = results.every((rows) => rows.some((r) => r.permlevel === 0 && r.create))
    return { view, add, loading: false }
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

  const toggle = async (group: PageGroup, kind: 'view' | 'add', value: boolean) => {
    setState((prev) => ({ ...prev, [group.key]: { ...prev[group.key], loading: true } }))
    const ptype = kind === 'view' ? 'read' : 'create'
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
          <h3 className="text-[16px] font-bold text-slate-800">صلاحية: {role}</h3>
        </div>

        {loading ? (
          <div className="py-16 text-center"><Loader2 className="h-8 w-8 animate-spin text-[#2e71c8] mx-auto" /></div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="text-start py-2.5 px-3 font-medium">اسم الصفحة</th>
                <th className="text-center py-2.5 px-3 font-medium w-28">عرض</th>
                <th className="text-center py-2.5 px-3 font-medium w-28">اضافة</th>
              </tr>
            </thead>
            <tbody>
              {PAGE_GROUPS.map((g) => {
                const s = state[g.key] || { view: false, add: false, loading: false }
                return (
                  <tr key={g.key} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 px-3 text-slate-700">{g.label}</td>
                    <td className="py-3 px-3 text-center">
                      <input type="checkbox" checked={s.view} disabled={s.loading}
                        onChange={(e) => toggle(g, 'view', e.target.checked)}
                        className="h-4 w-4 accent-[#2e71c8] cursor-pointer disabled:opacity-50" />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <input type="checkbox" checked={s.add} disabled={s.loading}
                        onChange={(e) => toggle(g, 'add', e.target.checked)}
                        className="h-4 w-4 accent-[#2e71c8] cursor-pointer disabled:opacity-50" />
                    </td>
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
