'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { arabizeError } from '@/lib/frappe-error'
import { ApexDialog } from '@/components/hr/apex/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

const APPROVER_TYPES = ['Direct Manager', 'Manager of Manager', 'Named User', 'Role'] as const
const APPROVER_TYPE_AR: Record<string, string> = {
  'Direct Manager': 'المدير المباشر', 'Manager of Manager': 'مدير المدير', 'Named User': 'مستخدمين محددين', Role: 'صلاحية',
}
const FIELD = 'h-[42px] w-full rounded border border-[var(--apex-border)] bg-white px-3 text-[14px] text-slate-800 outline-none focus:border-[var(--apex-blue)]'

export interface ApprovalStep {
  name?: string; step_order: number; approver_type: string; approver_user?: string | null; approver_role?: string | null
  name_ar?: string; name_en?: string; approver_users?: string[]
}
export interface ApprovalRule {
  name?: string; request_type: string; enabled: boolean; requires_attachment: boolean; sequential?: boolean; steps: ApprovalStep[]
}
type Draft = { name_ar: string; name_en: string; approver_type: string; users: string[]; role: string }
const EMPTY_DRAFT: Draft = { name_ar: '', name_en: '', approver_type: '', users: [], role: '' }

/**
 * Apex «اعدادات الطلبات» → «الصلاحيات» (app-orders-setting-details): card
 * «معلومات نوع الطلب» (اسم نوع الطلب · الحالة), then «صلاحيات الاعتماد والمرفقات»
 * with «توالي الاعتمادات …» and «اضافة صلاحية» over the table of approval steps.
 * Each change is saved straight away (hr_settings.save_approval_rule).
 */
export function RequestTypeApprovals({ type, onBack }: { type: { key: string; label: string }; onBack: () => void }) {
  const { toast } = useToast()
  const [rule, setRule] = useState<ApprovalRule | null>(null)
  const [users, setUsers] = useState<{ name: string; full_name?: string }[]>([])
  const [roles, setRoles] = useState<string[]>([])
  const [dialog, setDialog] = useState<{ index: number | null } | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [userQuery, setUserQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      const r: any = await frappeClient.call('base_meena.api.hr_settings.get_approval_rules', { request_type: type.key })
      const rules = (r?.message ?? []) as ApprovalRule[]
      setRule(rules[0] ?? { request_type: type.key, enabled: true, requires_attachment: false, sequential: true, steps: [] })
    } catch (e: any) {
      toast({ title: 'فشل تحميل صلاحيات الاعتماد', description: arabizeError(e?.message), variant: 'destructive' })
    }
  }, [type.key, toast])

  useEffect(() => {
    load()
    frappeClient.getList<{ name: string; full_name?: string }>('User', {
      fields: ['name', 'full_name'], filters: [['enabled', '=', 1], ['user_type', '=', 'System User'], ['name', 'not in', ['Administrator', 'Guest']]],
      order_by: 'full_name asc', limit_page_length: 0,
    }).then(setUsers).catch(() => setUsers([]))
    frappeClient.call<any>('base_meena.api.hr_lists.roles').then((r: any) => setRoles((r?.message ?? []).map((x: any) => x.name))).catch(() => setRoles([]))
  }, [load])

  const persist = async (next: ApprovalRule, done?: string) => {
    setSaving(true)
    try {
      const steps = next.steps.map((s, i) => ({ ...s, step_order: i + 1 }))
      await frappeClient.call('base_meena.api.hr_settings.save_approval_rule', { payload: { ...next, steps } })
      if (done) toast({ title: done })
      await load()
      return true
    } catch (e: any) {
      toast({ title: 'فشل الحفظ', description: arabizeError(e?.message), variant: 'destructive' })
      return false
    } finally {
      setSaving(false)
    }
  }

  const openAdd = () => { setDraft(EMPTY_DRAFT); setUserQuery(''); setDialog({ index: null }) }
  const openEdit = (i: number) => {
    const s = rule!.steps[i]
    setDraft({
      name_ar: s.name_ar || '', name_en: s.name_en || '', approver_type: s.approver_type,
      users: s.approver_users?.length ? s.approver_users : s.approver_user ? [s.approver_user] : [], role: s.approver_role || '',
    })
    setUserQuery(''); setDialog({ index: i })
  }

  const saveStep = async () => {
    if (!rule || !dialog) return
    if (!draft.name_ar.trim()) { toast({ title: 'الاسم باللغة العربية مطلوب', variant: 'destructive' }); return }
    if (!draft.approver_type) { toast({ title: 'اختر نوع المكلف بالاعتماد', variant: 'destructive' }); return }
    if (draft.approver_type === 'Named User' && !draft.users.length) { toast({ title: 'اختر المكلفين بالاعتماد', variant: 'destructive' }); return }
    if (draft.approver_type === 'Role' && !draft.role) { toast({ title: 'اختر الصلاحية', variant: 'destructive' }); return }
    const step: ApprovalStep = {
      step_order: 0, approver_type: draft.approver_type, name_ar: draft.name_ar.trim(), name_en: draft.name_en.trim(),
      approver_user: draft.approver_type === 'Named User' ? draft.users[0] : null,
      approver_users: draft.approver_type === 'Named User' ? draft.users : [],
      approver_role: draft.approver_type === 'Role' ? draft.role : null,
    }
    const steps = [...rule.steps]
    if (dialog.index === null) steps.push(step)
    else steps[dialog.index] = { ...steps[dialog.index], ...step }
    if (await persist({ ...rule, steps }, dialog.index === null ? 'تمت الإضافة' : 'تم التعديل')) setDialog(null)
  }

  const userName = useMemo(() => Object.fromEntries(users.map((u) => [u.name, u.full_name || u.name])), [users])
  const shownUsers = users.filter((u) => !userQuery.trim() || `${u.full_name} ${u.name}`.toLowerCase().includes(userQuery.trim().toLowerCase()))
  const approvers = (s: ApprovalStep) => s.approver_type === 'Role' ? (s.approver_role || '—')
    : s.approver_type === 'Named User' ? (s.approver_users?.length ? s.approver_users : [s.approver_user].filter(Boolean) as string[]).map((u) => userName[u] || u).join('، ') || '—'
    : APPROVER_TYPE_AR[s.approver_type]

  return (
    <div dir="rtl" className="p-4 pt-6 font-[family-name:var(--font-arabic)] space-y-6">
      <button type="button" onClick={onBack} className="text-[13px] text-[var(--apex-link)] hover:underline">اعدادات الطلبات /</button>

      <div className="bg-white rounded shadow-sm p-5">
        <h3 className="text-center font-bold text-[20px] text-slate-800">معلومات نوع الطلب</h3>
        <div className="flex flex-wrap items-center justify-between gap-4 mt-5 text-[15px]">
          <p>اسم نوع الطلب : <strong>{type.label}</strong></p>
          <p>الحالة: <strong>{rule?.enabled === false ? 'غير نشط' : 'نشط'}</strong></p>
          <span />
        </div>
      </div>

      <div className="bg-white rounded shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <h4 className="font-bold text-[17px] text-slate-800">صلاحيات الاعتماد والمرفقات</h4>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={rule?.sequential !== false} disabled={!rule || saving}
              onChange={(e) => {
                if (!rule) return
                // no rule saved yet → keep it local; saving an empty rule would replace
                // the default chain (direct manager → HR manager) with HR-only
                if (!rule.name && !rule.steps.length) setRule({ ...rule, sequential: e.target.checked })
                else persist({ ...rule, sequential: e.target.checked }, 'تم الحفظ')
              }}
              className="h-[18px] w-[18px] accent-[var(--apex-pink,#e91e63)]" />
            <span className="text-red-600 font-bold text-[14px]">توالي الاعتمادات وفقا لترتيب الصلاحيات في جدول الاعتمادات</span>
          </label>
          <button type="button" onClick={openAdd} disabled={!rule}
            className="h-[38px] px-4 rounded bg-[var(--apex-green)] text-white text-[14px] flex items-center gap-1.5 hover:bg-[var(--apex-green-dark)] disabled:opacity-50">
            اضافة صلاحية <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 pb-5">
          {!rule ? (
            <div className="py-12 text-center"><Loader2 className="h-7 w-7 animate-spin mx-auto text-[var(--apex-blue)]" /></div>
          ) : rule.steps.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-[18px]">لا يوجد نتائج للبحث ابحث مرة اخري</div>
          ) : (
            <table className="apex-table w-full text-[14px]">
              <thead>
                <tr><th className="w-12 text-center">#</th><th>الاسم</th><th>نوع المكلف بالاعتماد</th><th>المكلفين بالاعتماد</th><th className="text-center">اجراءات</th></tr>
              </thead>
              <tbody>
                {rule.steps.map((s, i) => (
                  <tr key={s.name ?? i}>
                    <td className="text-center">{i + 1}</td>
                    <td>{s.name_ar || APPROVER_TYPE_AR[s.approver_type]}</td>
                    <td>{APPROVER_TYPE_AR[s.approver_type] || s.approver_type}</td>
                    <td>{approvers(s)}</td>
                    <td>
                      <div className="flex items-center justify-center gap-1">
                        <button type="button" title="تعديل" onClick={() => openEdit(i)} className="apex-icon-edit px-1 hover:opacity-75"><Pencil className="h-[17px] w-[17px]" /></button>
                        <button type="button" title="حذف" onClick={() => setDeleteIndex(i)} className="apex-icon-delete px-1 hover:opacity-75"><Trash2 className="h-[17px] w-[17px]" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ApexDialog open={!!dialog} onOpenChange={(o) => { if (!o) setDialog(null) }}
        title={`${dialog?.index === null ? 'اضافة' : 'تعديل'} صلاحية اعتماد`} size="lg"
        primary={{ label: dialog?.index === null ? 'اضافة' : 'تعديل', onClick: saveStep, loading: saving }}>
        <div>
          <label className="block text-[13px] text-slate-700 mb-1">الاسم باللغة العربية <span className="text-red-500">*</span></label>
          <input value={draft.name_ar} onChange={(e) => setDraft((d) => ({ ...d, name_ar: e.target.value }))} className={FIELD} />
        </div>
        <div>
          <label className="block text-[13px] text-slate-700 mb-1">الاسم باللغة الانجليزية</label>
          <input value={draft.name_en} onChange={(e) => setDraft((d) => ({ ...d, name_en: e.target.value }))} dir="ltr" className={`${FIELD} text-right`} />
        </div>
        <div className="col-span-2">
          <label className="block text-[13px] text-slate-700 mb-1">نوع المكلف بالاعتماد</label>
          <select value={draft.approver_type} onChange={(e) => setDraft((d) => ({ ...d, approver_type: e.target.value, users: [], role: '' }))} className={FIELD}>
            <option value="">اختر…</option>
            {APPROVER_TYPES.map((t) => <option key={t} value={t}>{APPROVER_TYPE_AR[t]}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-[13px] text-slate-700 mb-1">المكلفين بالاعتماد</label>
          {draft.approver_type === 'Role' ? (
            <select value={draft.role} onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))} className={FIELD}>
              <option value="">اختر الصلاحية…</option>
              {roles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          ) : draft.approver_type === 'Named User' ? (
            <div className="rounded border border-[var(--apex-border)]">
              <input value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="ابحث باسم المستخدم" className="h-[38px] w-full border-b border-slate-200 px-3 text-[14px] outline-none" />
              <div className="max-h-[180px] overflow-y-auto py-1">
                {shownUsers.map((u) => (
                  <label key={u.name} className="flex items-center gap-2 px-3 py-1.5 text-[14px] hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" checked={draft.users.includes(u.name)} className="h-4 w-4 accent-[var(--apex-blue)]"
                      onChange={(e) => setDraft((d) => ({ ...d, users: e.target.checked ? [...d.users, u.name] : d.users.filter((x) => x !== u.name) }))} />
                    {u.full_name || u.name}
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <input disabled value={draft.approver_type ? 'يُحدَّد تلقائياً من بيانات الموظف' : ''} className={`${FIELD} bg-slate-50 text-slate-500`} />
          )}
        </div>
      </ApexDialog>

      <ConfirmDialog open={deleteIndex !== null} onOpenChange={(o) => { if (!o) setDeleteIndex(null) }}
        title="حذف صلاحية الاعتماد؟" confirmLabel="حذف" cancelLabel="إلغاء" loading={saving}
        onConfirm={async () => {
          if (!rule || deleteIndex === null) return
          if (await persist({ ...rule, steps: rule.steps.filter((_, i) => i !== deleteIndex) }, 'تم الحذف')) setDeleteIndex(null)
        }} />
    </div>
  )
}
