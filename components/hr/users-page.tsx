'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Pencil, Trash2 } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ApexToolbar } from '@/components/hr/apex/toolbar'
import { ApexTableCard } from '@/components/hr/apex/table-card'
import { ApexPagination } from '@/components/hr/apex/pagination'
import { ApexDialog } from '@/components/hr/apex/dialog'
import { AdvancedSearchDrawer, applyDrawer, type DrawerValues } from '@/components/hr/advanced-search-drawer'

interface UserRow {
  name: string
  employee_name: string
  username: string
  roles: string
  enabled: 0 | 1
  email: string
  first_name: string
  full_name: string
}
interface EmployeeOpt { name: string; employee_name: string; employee_number?: string }

const PAGE_SIZES = [5, 10, 20, 50]
const TH = { padding: '12px 12px 12px 60px' } as const
const FIELD = 'h-[40px] w-full rounded border border-[var(--apex-border)] bg-white px-2.5 text-[13px] text-slate-800 outline-none focus:border-[var(--apex-blue)]'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ADD_FIELD_LABELS: Record<'username' | 'password' | 'email' | 'full_name', string> = {
  username: 'اسم المستخدم', password: 'كلمة المرور', email: 'البريد الالكتروني', full_name: 'اسم الموظف',
}

/** Apex-style «الموظف» autocomplete showing «name - code» (5.14 G4 / 5.16 G6). */
function EmployeeAutocomplete({ options, query, onQuery, onSelect }: {
  options: EmployeeOpt[]
  query: string
  onQuery: (v: string) => void
  onSelect: (emp: EmployeeOpt) => void
}) {
  const [open, setOpen] = useState(false)
  const q = query.trim().toLowerCase()
  const filtered = q
    ? options.filter((o) => o.employee_name?.toLowerCase().includes(q) || String(o.employee_number ?? '').toLowerCase().includes(q))
    : options
  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => { onQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="اسم أو كود الموظف"
        className={FIELD}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded border border-slate-200 bg-white shadow-lg text-[13px]">
          {filtered.slice(0, 50).map((o) => (
            <li key={o.name}>
              <button
                type="button"
                onMouseDown={() => { onSelect(o); setOpen(false) }}
                className="block w-full text-right px-3 py-2 hover:bg-slate-50"
              >
                {o.employee_name}{o.employee_number ? ` - ${o.employee_number}` : ''}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * «المستخدمين» (5.16) — Apex: no checkbox column, no ⋮. Columns: اسم الموظف
 * (status dot first) · اسم المستخدم · اخري (link → role/permissions page) ·
 * الحالة · اجراءات (✎ 🗑). Toolbar: اضافة مستخدم · filter · search (no حذف).
 * Rows from base_meena.api.hr_lists.users (unchanged); create still goes
 * through base_meena.base_meena.api.company_create_user like the old
 * config-driven module (lib/hr-modules.ts `users` entry) did.
 */
export function UsersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [rows, setRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  // «المستخدمين (N)» on the الصلاحيات page (permissions-list-page.tsx) links
  // here as /team?role=<name> — preset the search box with the role so the
  // list opens pre-filtered to it (see the `roles` match below).
  const [search, setSearch] = useState(() => searchParams.get('role') || '')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])
  const [showFilter, setShowFilter] = useState(false)
  const [drawer, setDrawer] = useState<DrawerValues>({})

  const [employees, setEmployees] = useState<EmployeeOpt[]>([])

  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [empQuery, setEmpQuery] = useState('')
  const [addForm, setAddForm] = useState({ username: '', password: '', email: '', full_name: '', enabled: true })
  const [addErrors, setAddErrors] = useState<Record<string, string>>({})

  const [editing, setEditing] = useState<UserRow | null>(null)
  const [editForm, setEditForm] = useState({ username: '', enabled: true })
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r: any = await frappeClient.call('base_meena.api.hr_lists.users')
      const list = (r?.message ?? []) as UserRow[]
      setRows(Array.isArray(list) ? list : [])
    } catch (e: any) {
      toast({ title: 'تعذّر تحميل المستخدمين', description: e?.message, variant: 'destructive' })
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [toast])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    frappeClient.getList<EmployeeOpt>('Employee', {
      fields: ['name', 'employee_name', 'employee_number'], filters: [['status', '=', 'Active']],
      order_by: 'employee_name asc', limit_page_length: 0,
    }).then(setEmployees).catch(() => setEmployees([]))
  }, [])

  const derived = useMemo(() => rows.map((r) => ({ ...r, _status_label: r.enabled ? 'نشط' : 'غير نشط' })), [rows])
  const drawerFilters = [{ field: '_status_label', label: 'الحالة', options: ['نشط', 'غير نشط'] }]
  const filtered = useMemo(() => {
    const base = applyDrawer(derived, drawerFilters, drawer)
    const q = search.trim().toLowerCase()
    if (!q) return base
    return base.filter((r) => r.employee_name?.toLowerCase().includes(q) || r.username?.toLowerCase().includes(q) || r.name?.toLowerCase().includes(q) || r.roles?.toLowerCase().includes(q))
  }, [derived, search, drawer]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const resetAdd = () => {
    setAddForm({ username: '', password: '', email: '', full_name: '', enabled: true })
    setEmpQuery('')
    setAddErrors({})
  }

  const submitAdd = async () => {
    const errors: Record<string, string> = {}
    if (!addForm.username.trim()) errors.username = 'هذا الحقل مطلوب'
    if (!addForm.password.trim()) errors.password = 'هذا الحقل مطلوب'
    if (!addForm.email.trim()) errors.email = 'هذا الحقل مطلوب'
    else if (!EMAIL_RE.test(addForm.email.trim())) errors.email = 'بريد إلكتروني غير صالح'
    if (!addForm.full_name.trim()) errors.full_name = 'هذا الحقل مطلوب'
    if (Object.keys(errors).length) {
      setAddErrors(errors)
      const firstField = (['username', 'password', 'email', 'full_name'] as const).find((k) => errors[k])
      toast({ title: 'أكمل الحقول المطلوبة', description: firstField ? ADD_FIELD_LABELS[firstField] : undefined, variant: 'destructive' })
      return
    }
    setAddErrors({})
    setSaving(true)
    try {
      await frappeClient.call('base_meena.base_meena.api.company_create_user', {
        email: addForm.email, full_name: addForm.full_name, username: addForm.username,
        password: addForm.password, modules: ['hr'],
      })
      if (!addForm.enabled) {
        await frappeClient.put('User', addForm.email, { enabled: 0 }).catch(() => {})
      }
      toast({ title: 'تم إضافة المستخدم' })
      setAddOpen(false)
      resetAdd()
      load()
    } catch (e: any) {
      toast({ title: 'فشل إضافة المستخدم', description: e?.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (row: UserRow) => { setEditing(row); setEditForm({ username: row.username || '', enabled: !!row.enabled }) }
  const submitEdit = async () => {
    if (!editing) return
    setSaving(true)
    try {
      await frappeClient.put('User', editing.name, { username: editForm.username, enabled: editForm.enabled ? 1 : 0 })
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
      await frappeClient.delete('User', deleteTarget.name)
      toast({ title: 'تم الحذف' })
      setDeleteTarget(null)
      load()
    } catch (e: any) {
      toast({ title: 'فشل الحذف', description: e?.message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  /** «اخري» — a link to the user's primary HR role's permission matrix (the
   *  shared role-permissions-page.tsx). `roles` is the pre-joined Arabic
   *  string hr_lists.users() already returns; "اخري" itself means no HR role
   *  matched, so there's nothing to open. */
  const primaryRole = (roles: string) => (roles && roles !== 'اخري' ? roles.split('، ')[0] : null)

  return (
    <div dir="rtl" className="p-4 font-[family-name:var(--font-arabic)]">
      <ApexToolbar
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(1) }, placeholder: 'ابحث باسم الموظف او اسم المستخدم' }}
        onFilter={() => setShowFilter(true)}
        add={{ label: 'اضافة مستخدم', onClick: () => { resetAdd(); setAddOpen(true) } }}
      />

      <ApexTableCard>
        <table className="apex-table w-full">
          <thead>
            <tr>
              <th style={TH}>اسم الموظف</th>
              <th style={TH}>اسم المستخدم</th>
              <th style={TH}>اخري</th>
              <th style={TH}>الحالة</th>
              <th style={TH} className="text-center">اجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[var(--apex-blue)]" /></td></tr>
            ) : pageRows.length === 0 ? (
              <tr><td colSpan={5} className="py-10 text-center text-slate-500">لا يوجد نتائج للبحث ابحث مرة اخري</td></tr>
            ) : pageRows.map((row) => {
              const role = primaryRole(row.roles)
              return (
                <tr key={row.name}>
                  <td>
                    <span className="inline-flex items-center gap-2">
                      <span className={cn('h-2 w-2 rounded-full', row.enabled ? 'bg-[var(--apex-green)]' : 'bg-slate-400')} />
                      {row.employee_name || row.full_name || row.name}
                    </span>
                  </td>
                  <td>{row.username || row.name}</td>
                  <td>
                    {role ? (
                      <button type="button" onClick={() => router.push(`/hr/role-permissions/${encodeURIComponent(role)}`)} className="text-[var(--apex-link)] hover:underline">اخري</button>
                    ) : <span className="text-slate-400">اخري</span>}
                  </td>
                  <td>{row.enabled ? 'نشط' : 'غير نشط'}</td>
                  <td>
                    <div className="flex items-center justify-center gap-2">
                      <button type="button" onClick={() => openEdit(row)} title="تعديل" className="text-[var(--apex-link)] hover:opacity-80 px-1"><Pencil className="h-[17px] w-[17px]" /></button>
                      <button type="button" onClick={() => setDeleteTarget(row)} title="حذف" className="text-[var(--apex-red)] hover:opacity-80 px-1"><Trash2 className="h-[17px] w-[17px]" /></button>
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

      <AdvancedSearchDrawer
        open={showFilter} onClose={() => setShowFilter(false)}
        filters={drawerFilters} values={drawer} onApply={(v) => { setDrawer(v); setShowFilter(false); setPage(1) }}
      />

      {/* G6 — add-user */}
      <ApexDialog
        open={addOpen}
        onOpenChange={(o) => { setAddOpen(o); if (!o) resetAdd() }}
        title="اضافة مستخدم"
        size="lg"
        primary={{ label: 'اضافة', onClick: submitAdd, loading: saving }}
      >
        <div>
          <label className="block text-[13px] text-slate-700 mb-1">اسم المستخدم <span className="text-red-500">*</span></label>
          <input
            value={addForm.username}
            onChange={(e) => { setAddForm((f) => ({ ...f, username: e.target.value })); setAddErrors((er) => ({ ...er, username: '' })) }}
            aria-invalid={!!addErrors.username || undefined}
            className={FIELD}
          />
          {addErrors.username && <p className="text-[12px] text-red-500 mt-1 leading-[18px]">{addErrors.username}</p>}
        </div>
        <div>
          <label className="block text-[13px] text-slate-700 mb-1">كلمة المرور <span className="text-red-500">*</span></label>
          <input
            type="password"
            value={addForm.password}
            onChange={(e) => { setAddForm((f) => ({ ...f, password: e.target.value })); setAddErrors((er) => ({ ...er, password: '' })) }}
            aria-invalid={!!addErrors.password || undefined}
            className={FIELD}
          />
          {addErrors.password && <p className="text-[12px] text-red-500 mt-1 leading-[18px]">{addErrors.password}</p>}
        </div>
        <div>
          <label className="block text-[13px] text-slate-700 mb-1">البريد الالكتروني <span className="text-red-500">*</span></label>
          <input
            type="email"
            value={addForm.email}
            onChange={(e) => { setAddForm((f) => ({ ...f, email: e.target.value })); setAddErrors((er) => ({ ...er, email: '' })) }}
            aria-invalid={!!addErrors.email || undefined}
            className={FIELD}
          />
          {addErrors.email && <p className="text-[12px] text-red-500 mt-1 leading-[18px]">{addErrors.email}</p>}
        </div>
        <div>
          <label className="block text-[13px] text-slate-700 mb-1">اسم الموظف <span className="text-red-500">*</span></label>
          <EmployeeAutocomplete
            options={employees}
            query={empQuery}
            onQuery={(v) => { setEmpQuery(v); setAddForm((f) => ({ ...f, full_name: v })); setAddErrors((er) => ({ ...er, full_name: '' })) }}
            onSelect={(emp) => { setEmpQuery(`${emp.employee_name}${emp.employee_number ? ` - ${emp.employee_number}` : ''}`); setAddForm((f) => ({ ...f, full_name: emp.employee_name })); setAddErrors((er) => ({ ...er, full_name: '' })) }}
          />
          {addErrors.full_name && <p className="text-[12px] text-red-500 mt-1 leading-[18px]">{addErrors.full_name}</p>}
        </div>
        <div className="col-span-2">
          <span className="block text-[13px] text-slate-700 mb-1">الحالة</span>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-1.5 text-[13px] text-slate-800 cursor-pointer">
              <input type="radio" name="add-user-status" checked={addForm.enabled} onChange={() => setAddForm((f) => ({ ...f, enabled: true }))} className="accent-[var(--apex-green)]" />
              نشط
            </label>
            <label className="flex items-center gap-1.5 text-[13px] text-slate-800 cursor-pointer">
              <input type="radio" name="add-user-status" checked={!addForm.enabled} onChange={() => setAddForm((f) => ({ ...f, enabled: false }))} className="accent-[var(--apex-slate)]" />
              غير نشط
            </label>
          </div>
        </div>
      </ApexDialog>

      {/* ✎ — edit user */}
      <ApexDialog
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null) }}
        title="تعديل مستخدم"
        size="sm"
        primary={{ label: 'حفظ', onClick: submitEdit, loading: saving }}
      >
        <div className="col-span-2">
          <label className="block text-[13px] text-slate-700 mb-1">اسم المستخدم</label>
          <input value={editForm.username} onChange={(e) => setEditForm((f) => ({ ...f, username: e.target.value }))} className={FIELD} />
        </div>
        <div className="col-span-2">
          <span className="block text-[13px] text-slate-700 mb-1">الحالة</span>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-1.5 text-[13px] text-slate-800 cursor-pointer">
              <input type="radio" name="edit-user-status" checked={editForm.enabled} onChange={() => setEditForm((f) => ({ ...f, enabled: true }))} className="accent-[var(--apex-green)]" />
              نشط
            </label>
            <label className="flex items-center gap-1.5 text-[13px] text-slate-800 cursor-pointer">
              <input type="radio" name="edit-user-status" checked={!editForm.enabled} onChange={() => setEditForm((f) => ({ ...f, enabled: false }))} className="accent-[var(--apex-slate)]" />
              غير نشط
            </label>
          </div>
        </div>
      </ApexDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
        title="حذف المستخدم؟"
        description={deleteTarget ? `سيتم حذف ${deleteTarget.employee_name || deleteTarget.name} نهائيًا.` : undefined}
        confirmLabel="حذف"
        cancelLabel="إلغاء"
        onConfirm={confirmDelete}
        loading={deleting}
      />
    </div>
  )
}
