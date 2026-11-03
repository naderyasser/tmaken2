'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ApexTableCard } from '@/components/hr/apex/table-card'
import { ApexPagination } from '@/components/hr/apex/pagination'
import { ApexDialog } from '@/components/hr/apex/dialog'
import { FieldInput } from '@/components/hr/field-input'
import { arabizeError } from '@/lib/frappe-error'

type Row = { name: string; code: string; employee_name: string; username: string }

const TH = { padding: '12px 32px' } as const
const M = 'base_meena.api.hr_permissions'

/**
 * Apex «الصلاحيات / المستخدمين» (app-users-permission): the users holding one
 * role — رقم · اسم الموظف · اسم المستخدم · 🗑 (removes the role from that user),
 * plus «اضافة مستخدم» to grant it to another account.
 */
export function RoleUsersPage({ role }: { role: string }) {
  const { toast } = useToast()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [addOpen, setAddOpen] = useState(false)
  const [user, setUser] = useState('')
  const [saving, setSaving] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<Row | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r: any = await frappeClient.call<Row[]>(`${M}.role_users`, { role })
      setRows(r?.message ?? [])
    } catch (e: any) {
      toast({ title: 'تعذّر التحميل', description: arabizeError(e?.message), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [role, toast])
  useEffect(() => { load() }, [load])

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageRows = useMemo(() => rows.slice((currentPage - 1) * pageSize, currentPage * pageSize), [rows, currentPage, pageSize])

  const add = async () => {
    if (!user) { toast({ title: 'اختر المستخدم', variant: 'destructive' }); return }
    setSaving(true)
    try {
      await frappeClient.call(`${M}.add_role_user`, { role, user })
      toast({ title: 'تمت الإضافة' })
      setAddOpen(false); setUser(''); load()
    } catch (e: any) {
      toast({ title: 'فشلت الإضافة', description: arabizeError(e?.message), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!removeTarget) return
    setSaving(true)
    try {
      await frappeClient.call(`${M}.remove_role_user`, { role, user: removeTarget.name })
      toast({ title: 'تم الحذف' })
      setRemoveTarget(null); load()
    } catch (e: any) {
      toast({ title: 'فشل الحذف', description: arabizeError(e?.message), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div dir="rtl" className="p-4 font-[family-name:var(--font-arabic)]">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="text-[14px] text-slate-700">
          <Link href="/hr-managers" className="text-[var(--apex-link)] hover:underline">الصلاحيات</Link>
          <span className="mx-1">/</span>
          <span>المستخدمين</span>
        </div>
        <button type="button" onClick={() => setAddOpen(true)} className="apex-btn-add inline-flex items-center gap-1.5 rounded bg-[var(--apex-green)] px-4 h-[38px] text-[14px] text-white hover:opacity-90">
          اضافة مستخدم <Plus className="h-4 w-4" />
        </button>
      </div>

      <ApexTableCard>
        <table className="apex-table w-full">
          <thead>
            <tr>
              <th style={TH}>رقم</th>
              <th style={TH}>اسم الموظف</th>
              <th style={TH}>اسم المستخدم</th>
              <th style={TH} className="text-center">اجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[var(--apex-blue)]" /></td></tr>
            ) : pageRows.length === 0 ? (
              <tr><td colSpan={4} className="py-10 text-center text-slate-500">لا يوجد مستخدمين لهذه الصلاحية</td></tr>
            ) : pageRows.map((r) => (
              <tr key={r.name}>
                <td>{r.code || '—'}</td>
                <td>{r.employee_name}</td>
                <td dir="ltr" className="text-right">{r.username}</td>
                <td>
                  <div className="flex items-center justify-center">
                    <button type="button" title="حذف" onClick={() => setRemoveTarget(r)} className="px-1 text-[var(--apex-red)] hover:opacity-80">
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
        page={currentPage} pageCount={totalPages} pageSize={pageSize} total={rows.length}
        onPageChange={setPage} onPageSizeChange={(n) => { setPageSize(n); setPage(1) }}
      />

      <ApexDialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setUser('') }} title="اضافة مستخدم" size="sm"
        primary={{ label: 'اضافة', onClick: add, loading: saving }}>
        <div className="col-span-2">
          <label className="block text-[13px] text-slate-700 mb-1">المستخدم <span className="text-red-500">*</span></label>
          <FieldInput
            field={{ field: 'user', label: 'المستخدم', type: 'link', link: { doctype: 'User', titleField: 'full_name', filters: [['user_type', '=', 'System User'], ['name', 'not in', ['Administrator', 'Guest']], ['enabled', '=', 1]] } }}
            value={user}
            onChange={setUser}
          />
        </div>
      </ApexDialog>

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(o) => { if (!o) setRemoveTarget(null) }}
        title="إزالة المستخدم من الصلاحية؟"
        description={removeTarget ? `سيتم سحب الصلاحية من ${removeTarget.employee_name}.` : undefined}
        confirmLabel="حذف"
        cancelLabel="إلغاء"
        onConfirm={remove}
        loading={saving}
      />
    </div>
  )
}
