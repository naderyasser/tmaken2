'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil, Trash2 } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ApexToolbar } from '@/components/hr/apex/toolbar'
import { ApexTableCard } from '@/components/hr/apex/table-card'
import { ApexPagination } from '@/components/hr/apex/pagination'
import { ApexDialog } from '@/components/hr/apex/dialog'

interface RoleRow { name: string; role_name: string; perms: string; users: number }

const PAGE_SIZES = [5, 10, 20, 50]
const TH = { padding: '12px 32px' } as const
const FIELD = 'h-[40px] w-full rounded border border-[var(--apex-border)] bg-white px-2.5 text-[13px] text-slate-800 outline-none focus:border-[var(--apex-blue)]'

/** The 4 platform HR roles hr_lists.roles() always includes alongside any
 *  custom ones — never deletable, matching Apex's own built-in-role guard. */
const CORE_ROLES = new Set(['HR Manager', 'HR User', 'System Manager', 'Employee'])

/**
 * «الصلاحيات» (5.17) — Apex: no checkbox column. Columns: اسم الصلاحية ·
 * الصلاحيات (link → role-permissions matrix) · المستخدمين (N) (link → users
 * filtered by role) · اجراءات (✎, 🗑 disabled when in use). Toolbar: only
 * «اضافة صلاحية» + search (no حذف, no filter, no print). Rows from
 * base_meena.api.hr_lists.roles (unchanged).
 */
export function PermissionsListPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [rows, setRows] = useState<RoleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])

  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [saving, setSaving] = useState(false)

  const [editing, setEditing] = useState<RoleRow | null>(null)
  const [editName, setEditName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<RoleRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r: any = await frappeClient.call('base_meena.api.hr_lists.roles')
      const list = (r?.message ?? []) as RoleRow[]
      setRows(Array.isArray(list) ? list : [])
    } catch (e: any) {
      toast({ title: 'تعذّر تحميل الصلاحيات', description: e?.message, variant: 'destructive' })
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [toast])
  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.role_name?.toLowerCase().includes(q) || r.name?.toLowerCase().includes(q))
  }, [rows, search])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const submitAdd = async () => {
    const name = addName.trim()
    if (!name) { toast({ title: 'اسم الصلاحية مطلوب', variant: 'destructive' }); return }
    setSaving(true)
    try {
      await frappeClient.post('Role', { role_name: name })
      toast({ title: 'تم إضافة الصلاحية' })
      setAddOpen(false); setAddName('')
      load()
    } catch (e: any) {
      toast({ title: 'فشل إضافة الصلاحية', description: e?.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const submitRename = async () => {
    if (!editing) return
    const name = editName.trim()
    if (!name || name === editing.name) { setEditing(null); return }
    setSaving(true)
    try {
      await frappeClient.call('frappe.client.rename_doc', { doctype: 'Role', old_name: editing.name, new_name: name })
      toast({ title: 'تم الحفظ' })
      setEditing(null)
      load()
    } catch (e: any) {
      toast({ title: 'فشل الحفظ', description: e?.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await frappeClient.delete('Role', deleteTarget.name)
      toast({ title: 'تم الحذف' })
      setDeleteTarget(null)
      load()
    } catch (e: any) {
      toast({ title: 'فشل الحذف', description: e?.message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div dir="rtl" className="p-4 font-[family-name:var(--font-arabic)]">
      <ApexToolbar
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(1) }, placeholder: 'ابحث باسم الصلاحية' }}
        add={{ label: 'اضافة صلاحية', onClick: () => setAddOpen(true) }}
      />

      <ApexTableCard>
        <table className="apex-table w-full">
          <thead>
            <tr>
              <th style={TH}>اسم الصلاحية</th>
              <th style={TH}>الصلاحيات</th>
              <th style={TH}>المستخدمين</th>
              <th style={TH} className="text-center">اجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[var(--apex-blue)]" /></td></tr>
            ) : pageRows.length === 0 ? (
              <tr><td colSpan={4} className="py-10 text-center text-slate-500">لا يوجد نتائج للبحث ابحث مرة اخري</td></tr>
            ) : pageRows.map((row) => {
              const disableDelete = row.users > 0 || CORE_ROLES.has(row.name)
              return (
                <tr key={row.name}>
                  <td>{row.role_name}</td>
                  <td>
                    <button type="button" onClick={() => router.push(`/hr/role-permissions/${encodeURIComponent(row.name)}`)} className="text-[var(--apex-link)] hover:underline">{row.perms}</button>
                  </td>
                  <td>
                    <button type="button" onClick={() => router.push(`/team?role=${encodeURIComponent(row.name)}`)} className="text-[var(--apex-link)] hover:underline">المستخدمين ({row.users})</button>
                  </td>
                  <td>
                    <div className="flex items-center justify-center gap-2">
                      <button type="button" onClick={() => { setEditing(row); setEditName(row.role_name) }} title="تعديل" className="text-[var(--apex-link)] hover:opacity-80 px-1"><Pencil className="h-[17px] w-[17px]" /></button>
                      <button
                        type="button"
                        disabled={disableDelete}
                        onClick={() => !disableDelete && setDeleteTarget(row)}
                        title={disableDelete ? 'لا يمكن حذف صلاحية قيد الاستخدام' : 'حذف'}
                        className={cn('px-1', disableDelete ? 'text-[var(--apex-disabled)] cursor-not-allowed' : 'text-[var(--apex-red)] hover:opacity-80')}
                      >
                        <Trash2 className="h-[17px] w-[17px]" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </ApexTableCard>

      <ApexPagination
        page={currentPage} pageCount={totalPages} pageSize={pageSize} total={filtered.length}
        onPageChange={setPage} onPageSizeChange={(n) => { setPageSize(n); setPage(1) }}
      />

      <ApexDialog
        open={addOpen}
        onOpenChange={(o) => { setAddOpen(o); if (!o) setAddName('') }}
        title="اضافة صلاحية"
        size="sm"
        primary={{ label: 'اضافة', onClick: submitAdd, loading: saving }}
      >
        <div className="col-span-2">
          <label className="block text-[13px] text-slate-700 mb-1">اسم الصلاحية <span className="text-red-500">*</span></label>
          <input value={addName} onChange={(e) => setAddName(e.target.value)} className={FIELD} />
        </div>
      </ApexDialog>

      <ApexDialog
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null) }}
        title="تعديل صلاحية"
        size="sm"
        primary={{ label: 'حفظ', onClick: submitRename, loading: saving, disabled: editing ? CORE_ROLES.has(editing.name) : false }}
      >
        <div className="col-span-2">
          <label className="block text-[13px] text-slate-700 mb-1">اسم الصلاحية</label>
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            disabled={editing ? CORE_ROLES.has(editing.name) : false}
            className={cn(FIELD, editing && CORE_ROLES.has(editing.name) && 'bg-slate-50 text-slate-500')}
          />
        </div>
      </ApexDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
        title="حذف الصلاحية؟"
        description={deleteTarget ? `سيتم حذف ${deleteTarget.role_name} نهائيًا.` : undefined}
        confirmLabel="حذف"
        onConfirm={confirmDelete}
        loading={deleting}
      />
    </div>
  )
}
