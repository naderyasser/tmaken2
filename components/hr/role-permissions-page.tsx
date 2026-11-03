'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, Loader2, Plus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { frappeClient } from '@/lib/api-client'
import { cn } from '@/lib/utils'

/**
 * Apex «تعديل الصلاحيات» (app-update-permissions): one row per sidebar section
 * that expands to its pages; columns عرض · اضافة · تعديل · حذف · طباعة, each
 * with a select-all box in the header, plus a per-row select-all. Changes are
 * staged and written together by «تعديل الصلاحيات» (disabled until something
 * changed). Every box is a real read/create/write/delete/print DocPerm on the
 * page's doctypes (base_meena.api.hr_permissions — HR Manager can use it, the
 * Frappe permission manager is System-Manager-only).
 */

const SET_PERMS = 'base_meena.api.hr_permissions.set_permissions'
const GET_GROUPS = 'base_meena.api.hr_permissions.get_group_permissions'

type Kind = 'read' | 'create' | 'write' | 'delete' | 'print'
const KINDS: { kind: Kind; label: string }[] = [
  { kind: 'read', label: 'عرض' }, { kind: 'create', label: 'اضافة' }, { kind: 'write', label: 'تعديل' },
  { kind: 'delete', label: 'حذف' }, { kind: 'print', label: 'طباعة' },
]
type Perms = Record<Kind, boolean>
const NONE: Perms = { read: false, create: false, write: false, delete: false, print: false }

interface PageDef { key: string; label: string; doctypes: string[] }
interface GroupDef { key: string; label: string; pages: PageDef[] }

// Pages per sidebar section (components/hr-shell/routes.ts) → the doctypes
// each one reads/writes.
const GROUPS: GroupDef[] = [
  { key: 'basic', label: 'البيانات الاساسية', pages: [
    { key: 'employees', label: 'الموظفين', doctypes: ['Employee'] },
    { key: 'jobs', label: 'الوظائف', doctypes: ['Designation'] },
    { key: 'branches', label: 'الفروع', doctypes: ['Branch'] },
    { key: 'shifts', label: 'أوقات العمل', doctypes: ['Shift Type'] },
    { key: 'projects', label: 'المشاريع', doctypes: ['Project'] },
    { key: 'tasks', label: 'المهام', doctypes: ['Task'] },
    { key: 'location-groups', label: 'مجموعات المواقع', doctypes: ['Location'] },
    { key: 'employee-groups', label: 'مجموعات الموظفين', doctypes: ['Employee Group'] },
    { key: 'nationality', label: 'الجنسية', doctypes: ['Country'] },
    { key: 'holidays', label: 'العطلات الرسمية', doctypes: ['Holiday List'] },
    { key: 'leave-types', label: 'انواع الاجازات', doctypes: ['Leave Type'] },
  ] },
  { key: 'attendance', label: 'الحضور و الانصراف', pages: [
    { key: 'add-leave', label: 'اضافة اجازة', doctypes: ['Leave Application'] },
    { key: 'add-permission', label: 'اضافة اذن', doctypes: ['Permission Request'] },
    { key: 'movements', label: 'اضافة و تعديل حركات', doctypes: ['Employee Checkin'] },
    { key: 'cancel-posting', label: 'إلغاء ترحيل الحركات', doctypes: ['Attendance'] },
    { key: 'requests', label: 'الطلبات', doctypes: ['Attendance Request'] },
  ] },
  { key: 'users', label: 'المستخدمين', pages: [
    { key: 'users', label: 'المستخدمين', doctypes: ['User'] },
    { key: 'roles', label: 'الصلاحيات', doctypes: ['Role'] },
  ] },
  { key: 'settings', label: 'الاعدادات', pages: [
    { key: 'ramadan', label: 'تفعيل دوام رمضان', doctypes: ['Ramadan Settings'] },
    { key: 'devices', label: 'الاجهزة', doctypes: ['Biometric Device'] },
    { key: 'company', label: 'بيانات الشركة', doctypes: ['Company'] },
  ] },
]
const ALL_PAGES = GROUPS.flatMap((g) => g.pages)

function Box({ checked, indeterminate, onChange, label }: { checked: boolean; indeterminate?: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      ref={(el) => { if (el) el.indeterminate = !!indeterminate && !checked }}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 cursor-pointer accent-[var(--apex-pink,#e91e63)]"
    />
  )
}

export function RolePermissionsPage({ role }: { role: string }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<Record<string, Perms>>({})
  const [draft, setDraft] = useState<Record<string, Perms>>({})
  const [open, setOpen] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await frappeClient.call(GET_GROUPS, { role, groups: Object.fromEntries(ALL_PAGES.map((p) => [p.key, p.doctypes])) })
      const all = (res?.message || {}) as Record<string, Partial<Perms>>
      const state = Object.fromEntries(ALL_PAGES.map((p) => [p.key, { ...NONE, ...Object.fromEntries(KINDS.map(({ kind }) => [kind, !!all[p.key]?.[kind]])) } as Perms]))
      setSaved(state); setDraft(state)
    } catch (e: any) {
      toast({ title: 'تعذّر تحميل الصلاحيات', description: e?.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [role, toast])
  useEffect(() => { load() }, [load])

  const set = (pages: PageDef[], kinds: Kind[], value: boolean) =>
    setDraft((d) => {
      const n = { ...d }
      for (const p of pages) n[p.key] = { ...(n[p.key] || NONE), ...Object.fromEntries(kinds.map((k) => [k, value])) }
      return n
    })
  const every = (pages: PageDef[], kinds: Kind[]) => pages.every((p) => kinds.every((k) => draft[p.key]?.[k]))
  const some = (pages: PageDef[], kinds: Kind[]) => pages.some((p) => kinds.some((k) => draft[p.key]?.[k]))
  const allKinds = KINDS.map((k) => k.kind)

  const changes = useMemo(() => {
    const out: { doctypes: string[]; ptype: Kind; value: boolean }[] = []
    for (const { kind } of KINDS) for (const value of [true, false]) {
      const doctypes = ALL_PAGES.filter((p) => !!draft[p.key]?.[kind] === value && !!saved[p.key]?.[kind] !== value).flatMap((p) => p.doctypes)
      if (doctypes.length) out.push({ doctypes: [...new Set(doctypes)], ptype: kind, value })
    }
    return out
  }, [draft, saved])

  const save = async () => {
    setSaving(true)
    try {
      for (const c of changes) await frappeClient.call(SET_PERMS, { doctypes: c.doctypes, role, ptype: c.ptype, value: c.value ? 1 : 0 })
      toast({ title: 'تم تعديل الصلاحيات' })
      await load()
    } catch (e: any) {
      toast({ title: 'فشل تعديل الصلاحيات', description: e?.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const toggleOpen = (k: string) => setOpen((o) => { const n = new Set(o); n.has(k) ? n.delete(k) : n.add(k); return n })

  return (
    <div dir="rtl" className="p-4 pt-6 font-[family-name:var(--font-arabic)]">
      <div className="flex flex-wrap items-center justify-between gap-2 mx-2 mb-4">
        <div className="text-[14px] text-slate-700">
          <Link href="/hr-managers" className="text-[var(--apex-link)] hover:underline mx-1">الصلاحيات</Link>
          <span>/</span>
          <span className="mx-1">تعديل الصلاحيات</span>
        </div>
        <button type="button" onClick={save} disabled={!changes.length || saving}
          className="h-[38px] px-4 rounded bg-[var(--apex-green)] text-white text-[14px] flex items-center gap-1.5 hover:bg-[var(--apex-green-dark)] disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          تعديل الصلاحيات <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="bg-white rounded shadow-sm overflow-x-auto">
        {loading ? (
          <div className="py-16 text-center"><Loader2 className="h-8 w-8 animate-spin text-[var(--apex-blue)] mx-auto" /></div>
        ) : (
          <table className="apex-table w-full text-[14px]">
            <thead>
              <tr>
                <th className="w-12 text-center"><Box label="تحديد الكل" checked={every(ALL_PAGES, allKinds)} indeterminate={some(ALL_PAGES, allKinds)} onChange={(v) => set(ALL_PAGES, allKinds, v)} /></th>
                <th className="w-12" />
                <th className="text-right">اسم الصفحة</th>
                {KINDS.map(({ kind, label }) => (
                  <th key={kind} className="text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
                      <Box label={`${label} للكل`} checked={every(ALL_PAGES, [kind])} indeterminate={some(ALL_PAGES, [kind])} onChange={(v) => set(ALL_PAGES, [kind], v)} />
                      {label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            {GROUPS.map((g) => {
              const expanded = open.has(g.key)
              return (
                <tbody key={g.key}>
                  <tr className="bg-white">
                    <td className="text-center"><Box label={`${g.label} كامل`} checked={every(g.pages, allKinds)} indeterminate={some(g.pages, allKinds)} onChange={(v) => set(g.pages, allKinds, v)} /></td>
                    <td className="text-center">
                      <button type="button" onClick={() => toggleOpen(g.key)} aria-expanded={expanded} aria-label={expanded ? 'طي' : 'توسيع'}
                        className="h-7 w-7 rounded bg-[var(--apex-blue)] text-white inline-flex items-center justify-center hover:opacity-90">
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="font-bold">{g.label}</td>
                    {KINDS.map(({ kind, label }) => (
                      <td key={kind}><Box label={`${g.label} ${label}`} checked={every(g.pages, [kind])} indeterminate={some(g.pages, [kind])} onChange={(v) => set(g.pages, [kind], v)} /></td>
                    ))}
                  </tr>
                  {expanded && g.pages.map((p) => (
                    <Fragment key={p.key}>
                      <tr className={cn('bg-slate-50/60')}>
                        <td className="text-center"><Box label={`${p.label} كامل`} checked={every([p], allKinds)} indeterminate={some([p], allKinds)} onChange={(v) => set([p], allKinds, v)} /></td>
                        <td />
                        <td className="ps-6 text-slate-700">{p.label}</td>
                        {KINDS.map(({ kind, label }) => (
                          <td key={kind}><Box label={`${p.label} ${label}`} checked={!!draft[p.key]?.[kind]} onChange={(v) => set([p], [kind], v)} /></td>
                        ))}
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              )
            })}
          </table>
        )}
      </div>
    </div>
  )
}
