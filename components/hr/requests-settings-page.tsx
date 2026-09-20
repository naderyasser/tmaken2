'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Trash2, Pencil } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { ApexToolbar } from '@/components/hr/apex/toolbar'
import { ApexTableCard } from '@/components/hr/apex/table-card'
import { ApexPagination } from '@/components/hr/apex/pagination'
import { ApexDialog } from '@/components/hr/apex/dialog'

/** base_meena.api.hr_requests.get_order_types() (B3) returns a fixed 3-entry
 *  catalogue keyed by doctype (id/arabicName/latinName/doctype/…), not by the
 *  `HR Approval Rule.request_type` slug — so map doctype → slug using the same
 *  slugs `seed_approval_rules.py` / `approval_engine.REQUEST_TYPES` already use. */
const DOCTYPE_TO_SLUG: Record<string, string> = {
  'Leave Application': 'leave',
  'Permission Request': 'permission',
  'Attendance Request': 'attendance',
}

/** Fallback if get_order_types() isn't reachable yet — exact 3 entries B3 confirmed. */
const FALLBACK_ORDER_TYPES = [
  { key: 'leave', label: 'طلب اجازة' },
  { key: 'permission', label: 'طلب اذن' },
  { key: 'attendance', label: 'طلب أضافة بصمة' },
]

const APPROVER_TYPES = ['Direct Manager', 'Manager of Manager', 'Named User', 'Role']
const APPROVER_TYPE_AR: Record<string, string> = {
  'Direct Manager': 'المدير المباشر',
  'Manager of Manager': 'مدير المدير',
  'Named User': 'مستخدم محدد',
  Role: 'دور',
}
const PAGE_SIZES = [5, 10, 20, 50]

interface OrderType { key: string; label: string }
interface Step { name?: string; step_order: number; approver_type: string; approver_user?: string; approver_role?: string }
interface Rule { name?: string; request_type: string; enabled: boolean; requires_attachment: boolean; steps: Step[] }

const FIELD = 'h-[40px] w-full rounded border border-[var(--apex-border)] bg-white px-2.5 text-[13px] text-slate-800 outline-none focus:border-[var(--apex-blue)]'

function emptyRule(request_type: string): Rule {
  return { request_type, enabled: false, requires_attachment: false, steps: [] }
}

/**
 * «اعدادات الطلبات» (5.24) — Apex is a TABLE: انواع الطلبات · صلاحيات الاعتماد
 * (link «الصلاحيات» opening the steps editor) · اجراءات (✎ rename/enable, 🗑
 * always disabled — the 3 request types are a fixed backend catalogue,
 * base_meena.api.hr_requests.ORDER_TYPES, not a doctype a caller can add to
 * or delete from). Backed unchanged by
 * base_meena.api.hr_settings.get_approval_rules / save_approval_rule.
 */
export function RequestsSettingsPage() {
  const { toast } = useToast()
  const [types, setTypes] = useState<OrderType[]>(FALLBACK_ORDER_TYPES)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])

  const [activeType, setActiveType] = useState<OrderType | null>(null)
  const [rule, setRule] = useState<Rule | null>(null)
  const [users, setUsers] = useState<{ name: string; full_name?: string }[]>([])
  const [roles, setRoles] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [stepsOpen, setStepsOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)

  useEffect(() => {
    frappeClient.call<any>('base_meena.api.hr_requests.get_order_types')
      .then((r: any) => {
        const list = (r?.message ?? []) as any[]
        if (Array.isArray(list) && list.length) {
          const mapped = list.map((o) => ({
            key: DOCTYPE_TO_SLUG[o.doctype] ?? o.key ?? o.request_type ?? o.doctype,
            label: o.arabicName ?? o.label_ar ?? o.label ?? o.doctype,
          }))
          setTypes(mapped)
        }
      })
      .catch(() => {}) // keep the fallback list

    frappeClient.getList<{ name: string; full_name?: string }>('User', {
      fields: ['name', 'full_name'], filters: [['enabled', '=', 1]], order_by: 'full_name asc', limit_page_length: 0,
    }).then(setUsers).catch(() => setUsers([]))

    frappeClient.getList<{ name: string }>('Role', {
      fields: ['name'], filters: [['disabled', '=', 0]], order_by: 'name asc', limit_page_length: 0,
    }).then((r) => setRoles(r.map((x) => x.name))).catch(() => setRoles([]))
  }, [])

  const load = useCallback(async (type: OrderType) => {
    setLoading(true)
    try {
      const r: any = await frappeClient.call('base_meena.api.hr_settings.get_approval_rules', { request_type: type.key })
      const rules = (r?.message ?? []) as Rule[]
      setRule(rules[0] ?? emptyRule(type.key))
    } catch (e: any) {
      toast({ title: 'فشل تحميل قواعد الاعتماد', description: e?.message, variant: 'destructive' })
      setRule(emptyRule(type.key))
    } finally {
      setLoading(false)
    }
  }, [toast])

  const openSteps = async (type: OrderType) => {
    setActiveType(type)
    setStepsOpen(true)
    await load(type)
  }
  const openRename = async (type: OrderType) => {
    setActiveType(type)
    setRenameOpen(true)
    await load(type)
  }

  const addStep = () => setRule((r) => r && ({
    ...r,
    steps: [...r.steps, { step_order: r.steps.length + 1, approver_type: 'Direct Manager' }],
  }))
  const removeStep = (idx: number) => setRule((r) => r && ({
    ...r,
    steps: r.steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step_order: i + 1 })),
  }))
  const updateStep = (idx: number, patch: Partial<Step>) => setRule((r) => r && ({
    ...r,
    steps: r.steps.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
  }))

  const save = async (close: () => void) => {
    if (!rule) return
    setSaving(true)
    try {
      await frappeClient.call('base_meena.api.hr_settings.save_approval_rule', { payload: rule })
      toast({ title: 'تم الحفظ' })
      close()
    } catch (e: any) {
      toast({ title: 'فشل الحفظ', description: e?.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const filteredTypes = useMemo(
    () => types.filter((t) => t.label.toLowerCase().includes(search.trim().toLowerCase())),
    [types, search],
  )
  const totalPages = Math.max(1, Math.ceil(filteredTypes.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageRows = filteredTypes.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div dir="rtl" className="p-4 font-[family-name:var(--font-arabic)]">
      <ApexToolbar
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(1) }, placeholder: 'ابحث باسم نوع الطلب' }}
      />

      <ApexTableCard>
        <table className="apex-table w-full">
          <thead>
            <tr>
              <th>انواع الطلبات</th>
              <th>صلاحيات الاعتماد</th>
              <th className="text-center">اجراءات</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan={3} className="py-10 text-center text-slate-500">لا يوجد نتائج للبحث ابحث مرة اخري</td></tr>
            ) : pageRows.map((t) => (
              <tr key={t.key}>
                <td>{t.label}</td>
                <td>
                  <button type="button" onClick={() => openSteps(t)} className="text-[var(--apex-link)] hover:underline">الصلاحيات</button>
                </td>
                <td>
                  <div className="flex items-center justify-center gap-2">
                    <button type="button" onClick={() => openRename(t)} title="تعديل" className="text-[var(--apex-link)] hover:opacity-80 px-1">
                      <Pencil className="h-[17px] w-[17px]" />
                    </button>
                    <button type="button" disabled title="حذف" className="text-[var(--apex-disabled)] cursor-not-allowed px-1">
                      <Trash2 className="h-[17px] w-[17px]" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ApexTableCard>

      <ApexPagination
        page={currentPage}
        pageCount={totalPages}
        pageSize={pageSize}
        total={filteredTypes.length}
        onPageChange={setPage}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1) }}
      />

      {/* صلاحيات الاعتماد — steps editor */}
      <ApexDialog
        open={stepsOpen}
        onOpenChange={setStepsOpen}
        title={`صلاحيات الاعتماد — ${activeType?.label ?? ''}`}
        size="lg"
        primary={{ label: 'تعديل', onClick: () => save(() => setStepsOpen(false)), loading: saving, disabled: loading || !rule }}
      >
        {loading || !rule ? (
          <div className="py-10 text-center col-span-2"><Loader2 className="h-7 w-7 animate-spin mx-auto text-[var(--apex-blue)]" /></div>
        ) : (
          <div className="col-span-2 space-y-5">
            <label className="flex items-center gap-2 text-[14px] text-slate-800 cursor-pointer">
              <input type="checkbox" checked={rule.requires_attachment}
                onChange={(e) => setRule((r) => r && ({ ...r, requires_attachment: e.target.checked }))}
                className="h-[18px] w-[18px] accent-[var(--apex-blue)]" />
              مرفقات إلزامية
            </label>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[14px] text-slate-700">خطوات الاعتماد</span>
                <button type="button" onClick={addStep} className="h-[32px] px-3 rounded border border-[var(--apex-blue)] text-[var(--apex-blue)] text-[13px] flex items-center gap-1 hover:bg-[var(--apex-blue)]/5">
                  <Plus className="h-3.5 w-3.5" />إضافة خطوة
                </button>
              </div>
              {rule.steps.length === 0 ? (
                <p className="text-[13px] text-slate-500 py-4 text-center border border-dashed border-slate-200 rounded">لا توجد خطوات اعتماد بعد</p>
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-200">
                      <th className="text-center py-2 w-10">#</th>
                      <th className="text-start py-2">نوع المعتمد</th>
                      <th className="text-start py-2">المعتمد</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {rule.steps.map((s, idx) => (
                      <tr key={s.name ?? idx} className="border-b border-slate-100 last:border-0">
                        <td className="text-center py-2 text-slate-500">{s.step_order}</td>
                        <td className="py-2">
                          <select value={s.approver_type} onChange={(e) => updateStep(idx, { approver_type: e.target.value, approver_user: undefined, approver_role: undefined })} className={FIELD}>
                            {APPROVER_TYPES.map((t) => <option key={t} value={t}>{APPROVER_TYPE_AR[t]}</option>)}
                          </select>
                        </td>
                        <td className="py-2">
                          {s.approver_type === 'Named User' ? (
                            <select value={s.approver_user || ''} onChange={(e) => updateStep(idx, { approver_user: e.target.value })} className={FIELD}>
                              <option value="">اختر مستخدم</option>
                              {users.map((u) => <option key={u.name} value={u.name}>{u.full_name || u.name}</option>)}
                            </select>
                          ) : s.approver_type === 'Role' ? (
                            <select value={s.approver_role || ''} onChange={(e) => updateStep(idx, { approver_role: e.target.value })} className={FIELD}>
                              <option value="">اختر دور</option>
                              {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                          ) : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="py-2 text-center">
                          <button type="button" onClick={() => removeStep(idx)} className="h-[32px] w-[32px] inline-flex items-center justify-center text-red-600 hover:bg-red-50 rounded" aria-label="حذف الخطوة">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </ApexDialog>

      {/* ✎ — rename/enable (rename is display-only: the 3 request types are a
          fixed backend catalogue with no per-tenant name field to persist a
          rename into; only «مفعّل» is real, backed by HR Approval Rule.enabled). */}
      <ApexDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="تعديل نوع الطلب"
        size="sm"
        primary={{ label: 'حفظ', onClick: () => save(() => setRenameOpen(false)), loading: saving, disabled: loading || !rule }}
      >
        <div className="col-span-2 space-y-4">
          <div>
            <label className="block text-[13px] text-slate-700 mb-1">اسم النوع</label>
            <input value={activeType?.label ?? ''} disabled className={cn(FIELD, 'bg-slate-50 text-slate-500')} />
          </div>
          {loading || !rule ? (
            <div className="py-4 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[var(--apex-blue)]" /></div>
          ) : (
            <label className="flex items-center gap-2 text-[14px] text-slate-800 cursor-pointer">
              <input type="checkbox" checked={rule.enabled}
                onChange={(e) => setRule((r) => r && ({ ...r, enabled: e.target.checked }))}
                className="h-[18px] w-[18px] accent-[var(--apex-blue)]" />
              مفعّل
            </label>
          )}
        </div>
      </ApexDialog>
    </div>
  )
}
