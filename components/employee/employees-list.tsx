/**
 * Employees List — Jisr F13 enhancements.
 * Lifecycle segments + shared DataTable (search/sort/pagination/bulk/export/persist)
 * + column show/hide + saved views + bulk update. All existing behavior preserved
 * (row → profile, add, delete, GOSI/ID badges, rich server search, CSV export).
 */

'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
    UserPlus, Download, RefreshCw, Eye, Edit, Trash2, Columns3, Bookmark, Save,
    PencilLine, Trash, Hash,
} from 'lucide-react'
import { frappeClient, isAuthError, type Employee } from '@/lib/api-client'
import { SessionRenew } from '@/components/login-page'
import { IdExpiryBadge } from '@/components/employee/id-expiry-badge'
import { GosiStatusBadge } from '@/components/employee/gosi-status-badge'
import { useI18n } from '@/lib/i18n'
import { translateDepartment, translateEnum } from '@/lib/enums'
import { formatDateShort, formatSAR } from '@/lib/format'
import { useAuth } from '@/lib/auth-context'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { EmployeeAvatar } from '@/components/employee/employee-avatar'
import { frappeImageUrl } from '@/lib/utils'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator,
    DropdownMenuTrigger, DropdownMenuCheckboxItem, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { SegmentedControl } from '@/components/shared'
import { DataTable, ALL_ROWS, type DataTableColumn } from '@/components/shared/data-table'
import { usePersistedState } from '@/lib/freelancer/use-table-prefs'

// ==================== Types ====================

interface EmployeesListProps {
    onEmployeeSelect?: (employee: Employee) => void
    onAddEmployee?: () => void
    branch?: string | null
}

type Segment = 'active' | 'new_hires' | 'on_probation' | 'terminated' | 'all'
type SegCounts = { active: number; new_hires: number; on_probation: number; terminated: number; all: number }

// Bulk-editable fields — MUST mirror the backend SAFE_BULK_FIELDS allow-list.
const BULK_FIELDS = ['branch', 'department', 'designation', 'default_shift', 'holiday_list'] as const
type BulkField = typeof BULK_FIELDS[number]

const NEW_HIRE_DAYS = 90
const ALL_COL_IDS = ['employee', 'department', 'designation', 'contact', 'joined', 'salary', 'status'] as const
const DEFAULT_HIDDEN = ['contact'] // branch is folded into other cols; hide contact by default per spec intent

interface SavedView { name: string; segment: Segment; status: string; company: string; department: string; hidden: string[] }

// ==================== Main Component ====================

export function EmployeesList({ onEmployeeSelect, onAddEmployee, branch }: EmployeesListProps) {
    const { isHRManager, isHRUser, isAuthenticated, isLoading: authLoading } = useAuth()
    const { company: activeCompany } = useCompany()
    const { t, isRTL } = useI18n()
    const { toast } = useToast()
    const tx = (en: string, ar: string) => (isRTL ? ar : en)

    const [employees, setEmployees] = useState<Employee[]>([])
    const [salaryMap, setSalaryMap] = useState<Record<string, number>>({})
    const [loading, setLoading] = useState(true)
    const [authRequired, setAuthRequired] = useState(false)
    const [refreshing, setRefreshing] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [serverResults, setServerResults] = useState<Employee[] | null>(null)
    const [segment, setSegment] = useState<Segment>('active')
    const [segCounts, setSegCounts] = useState<SegCounts>({ active: 0, new_hires: 0, on_probation: 0, terminated: 0, all: 0 })
    const [statusFilter, setStatusFilter] = useState('all')
    const [companyFilter, setCompanyFilter] = useState(activeCompany || 'all')
    const [departmentFilter, setDepartmentFilter] = useState('all')
    const [companies, setCompanies] = useState<string[]>([])
    const [allDepartments, setAllDepartments] = useState<{ name: string; company: string }[]>([])
    const [pendingDelete, setPendingDelete] = useState<Employee | null>(null)

    // Persisted UI prefs (F13): hidden columns + saved views.
    const [hiddenCols, setHiddenCols] = usePersistedState<string[]>('emp-list:cols', DEFAULT_HIDDEN)
    const [views, setViews] = usePersistedState<SavedView[]>('emp-list:views', [])
    const [saveViewName, setSaveViewName] = useState('')
    const [showSaveView, setShowSaveView] = useState(false)

    // Bulk edit state
    const [bulkRows, setBulkRows] = useState<Employee[] | null>(null)
    const [bulkField, setBulkField] = useState<BulkField>('branch')
    const [bulkValue, setBulkValue] = useState('')
    const [bulkBusy, setBulkBusy] = useState(false)
    const [bulkErrors, setBulkErrors] = useState<{ name: string; error: string }[] | null>(null)
    // Employee ID editing — the ID is the document name, so changing it is a
    // rename the server performs across every record that refers to her.
    const [renameRow, setRenameRow] = useState<Employee | null>(null)
    const [renameValue, setRenameValue] = useState('')
    const [renameBusy, setRenameBusy] = useState(false)

    // ==================== Data ====================

    const loadCompaniesAndDepartments = useCallback(async () => {
        if (!authLoading && !isAuthenticated) return
        try {
            const [companiesRes, departmentsRes] = await Promise.all([
                frappeClient.get<{ name: string }[]>('Company', undefined, { fields: ['name'], order_by: 'name asc', limit_page_length: 100 }),
                frappeClient.get<{ name: string; company: string }[]>('Department', undefined, { fields: ['name', 'company'], order_by: 'name asc', limit_page_length: 200 }),
            ])
            setCompanies((companiesRes.data || []).map(c => c.name))
            setAllDepartments(departmentsRes.data || [])
        } catch (error) { if (!isAuthError(error)) console.error('Failed to load companies/departments:', error) }
    }, [authLoading, isAuthenticated])

    const loadSegmentCounts = useCallback(async () => {
        try {
            const resp = await frappeClient.call<SegCounts>('base_meena.api.employee_directory.get_employee_segments',
                { company: companyFilter !== 'all' ? companyFilter : undefined, branch: branch || undefined })
            const d = ((resp as any).message ?? (resp as any).data ?? {}) as SegCounts
            setSegCounts({ active: d.active || 0, new_hires: d.new_hires || 0, on_probation: d.on_probation || 0, terminated: d.terminated || 0, all: d.all || 0 })
        } catch (e) { /* counts are best-effort */ }
    }, [companyFilter, branch])

    const loadEmployees = useCallback(async (showRefresh = false) => {
        if (!authLoading && !isAuthenticated) {
            setEmployees([])
            setAuthRequired(true)
            setLoading(false)
            setRefreshing(false)
            return
        }
        try {
            showRefresh ? setRefreshing(true) : setLoading(true)
            setAuthRequired(false)
            const data = await frappeClient.getEmployees({
                limit_page_length: 0,
                fields: ['name', 'employee_name', 'employee_number', 'department', 'designation', 'company', 'branch', 'status', 'date_of_joining', 'company_email', 'cell_number', 'image', 'gender', 'reports_to', 'custom_id_expiry_date', 'custom_gosi_registration_status'],
                order_by: 'employee_name asc',
            })
            setEmployees(data)
        } catch (error) {
            if (isAuthError(error)) {
                setEmployees([])
                setAuthRequired(true)
            } else {
                console.error('Failed to load employees:', error)
                toast({ title: t('error'), description: t('emp.load_fail'), variant: 'destructive' })
            }
        } finally { setLoading(false); setRefreshing(false) }
    }, [toast, t, authLoading, isAuthenticated])

    // Current base salary per employee. Salary lives on Salary Structure Assignment
    // (Employee has no salary field), so it needs its own fetch. Best-effort by design:
    // a user without payroll permission gets a 403, we swallow it and the column renders
    // "—" rather than failing the whole employees page.
    const loadSalaries = useCallback(async () => {
        if (!authLoading && !isAuthenticated) { setSalaryMap({}); return }
        try {
            const rows = await frappeClient.getList<{ employee: string; base: number; from_date: string }>(
                'Salary Structure Assignment',
                {
                    filters: [['Salary Structure Assignment', 'docstatus', '=', 1]],
                    fields: ['employee', 'base', 'from_date'],
                    order_by: 'from_date desc',
                    limit_page_length: 0,
                },
            )
            // rows are newest-first, so the first hit per employee is the current one
            const map: Record<string, number> = {}
            for (const r of rows || []) if (!(r.employee in map)) map[r.employee] = r.base
            setSalaryMap(map)
        } catch { setSalaryMap({}) }
    }, [authLoading, isAuthenticated])

    useEffect(() => { if (authLoading) return; loadCompaniesAndDepartments(); loadEmployees(); loadSalaries() }, [authLoading, loadCompaniesAndDepartments, loadEmployees, loadSalaries])
    useEffect(() => { if (authLoading || (!isAuthenticated)) return; loadSegmentCounts() }, [authLoading, isAuthenticated, loadSegmentCounts])
    useEffect(() => { setCompanyFilter(activeCompany || 'all') }, [activeCompany])
    useEffect(() => { setDepartmentFilter('all') }, [companyFilter])

    // Rich server-side search (debounced) — preserved (matches ID/phone/national-ID/plate…).
    useEffect(() => {
        if (!searchQuery.trim()) { setServerResults(null); return }
        let cancelled = false
        const timer = setTimeout(async () => {
            try {
                const results = await frappeClient.searchEmployees(searchQuery)
                if (!cancelled) setServerResults(results)
            } catch { if (!cancelled) setServerResults(null) }
        }, 300)
        return () => { cancelled = true; clearTimeout(timer) }
    }, [searchQuery])

    // ==================== Derived ====================

    const departments = useMemo(() => {
        if (companyFilter === 'all') return allDepartments.map(d => d.name).sort()
        return allDepartments.filter(d => d.company === companyFilter).map(d => d.name).sort()
    }, [allDepartments, companyFilter])

    const inSegment = useCallback((e: Employee): boolean => {
        if (segment === 'all') return true
        if (segment === 'terminated') return e.status === 'Left'
        if (e.status !== 'Active') return false
        if (segment === 'active') return true
        // new_hires + on_probation → joined within the window
        if (!e.date_of_joining) return false
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - NEW_HIRE_DAYS)
        return new Date(e.date_of_joining) >= cutoff
    }, [segment])

    // Rows feeding the DataTable: server-search result (when searching) or the full
    // set, narrowed by segment + branch. DataTable applies status/company/dept + sort/page.
    const rows = useMemo(() => {
        const base = (searchQuery && serverResults) ? serverResults : employees
        return base.filter(inSegment).filter(e => !branch || e.branch === branch)
    }, [employees, serverResults, searchQuery, inSegment, branch])

    const getInitials = (name: string) => {
        const p = (name || '').split(' ')
        return (p.length >= 2 ? `${p[0][0]}${p[1][0]}` : (name || '').substring(0, 2)).toUpperCase()
    }
    const statusVariant = (s: string): 'default' | 'secondary' | 'destructive' | 'outline' =>
        s === 'Active' ? 'default' : s === 'Suspended' ? 'destructive' : s === 'Left' ? 'outline' : 'secondary'

    // ==================== Columns (toggleable) ====================
    const ALL_COLUMNS: DataTableColumn<Employee>[] = useMemo(() => [
        {
            id: 'employee', header: t('employee'), sortable: true, sortAccessor: r => r.employee_name || '',
            exportAccessor: r => `${r.employee_name} (${r.name})`,
            cell: (r) => (
                <div className="flex items-center gap-3">
                    <EmployeeAvatar image={r.image} gender={r.gender} name={r.employee_name} />
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{r.employee_name}</span>
                            <IdExpiryBadge date={r.custom_id_expiry_date} />
                            <GosiStatusBadge status={r.custom_gosi_registration_status} />
                        </div>
                        <div className="text-sm text-muted-foreground">{r.name}</div>
                    </div>
                </div>
            ),
        },
        { id: 'department', header: t('department'), sortable: true, sortAccessor: r => translateDepartment(r.department, isRTL ? 'ar' : 'en'), exportAccessor: r => translateDepartment(r.department, isRTL ? 'ar' : 'en'), cell: r => translateDepartment(r.department, isRTL ? 'ar' : 'en') || '—' },
        { id: 'designation', header: t('emp.designation'), sortable: true, sortAccessor: r => translateEnum('designation', r.designation, isRTL ? 'ar' : 'en'), exportAccessor: r => translateEnum('designation', r.designation, isRTL ? 'ar' : 'en'), cell: r => translateEnum('designation', r.designation, isRTL ? 'ar' : 'en') || '—' },
        {
            id: 'contact', header: t('emp.contact'), exportAccessor: r => r.company_email || r.cell_number || '',
            cell: r => (<div className="text-sm"><div>{r.company_email || '—'}</div><div className="text-muted-foreground">{r.cell_number || '—'}</div></div>),
        },
        { id: 'joined', header: t('emp.joined'), sortable: true, sortAccessor: r => r.date_of_joining || '', exportAccessor: r => formatDateShort(r.date_of_joining) || '', cell: r => <span className="tabular-nums">{formatDateShort(r.date_of_joining) || '—'}</span> },
        {
            id: 'salary', header: isRTL ? 'الراتب' : 'Salary', sortable: true,
            sortAccessor: r => salaryMap[r.name] ?? -1,
            exportAccessor: r => (salaryMap[r.name] != null ? String(salaryMap[r.name]) : ''),
            cell: r => <span className="tabular-nums">{salaryMap[r.name] != null ? formatSAR(salaryMap[r.name]) : '—'}</span>,
        },
        { id: 'status', header: t('status'), sortable: true, sortAccessor: r => r.status || '', exportAccessor: r => translateEnum('employeeStatus', r.status, isRTL ? 'ar' : 'en'), cell: r => <Badge variant={statusVariant(r.status)}>{translateEnum('employeeStatus', r.status, isRTL ? 'ar' : 'en')}</Badge> },
    ], [t, isRTL, salaryMap])

    const visibleColumns = useMemo(() => ALL_COLUMNS.filter(c => !hiddenCols.includes(c.id)), [ALL_COLUMNS, hiddenCols])

    // ==================== Actions ====================

    const confirmDelete = async () => {
        const employee = pendingDelete
        if (!employee) return
        setPendingDelete(null)
        try {
            const userEmail = employee.user_id
            await frappeClient.deleteEmployee(employee.name)
            if (userEmail) {
                try {
                    const linked = await frappeClient.getList<{ name: string }>('Employee', { filters: [['Employee', 'user_id', '=', userEmail]], fields: ['name'], limit_page_length: 1 })
                    if (linked.length === 0) await frappeClient.delete('User', userEmail)
                } catch (e) { console.error('Employee deleted but user removal failed:', e) }
            }
            toast({ title: t('success'), description: t('emp.deleted') })
            loadEmployees(); loadSegmentCounts()
        } catch { toast({ title: t('error'), description: t('emp.delete_fail'), variant: 'destructive' }) }
    }

    // Change an employee's ID. Manager-only; the server enforces that
    // independently, so the hidden menu item is convenience, not the control.
    const submitRename = async () => {
        const next = renameValue.trim()
        if (!renameRow || !next || next === renameRow.name) return
        setRenameBusy(true)
        try {
            const resp = await frappeClient.call<{ employee: string; previous_id: string; message: string }>(
                'base_meena.api.employee_identity.rename_employee_id',
                { employee: renameRow.name, new_id: next })
            const d = ((resp as any).message ?? (resp as any).data ?? {}) as any
            toast({
                title: t('success'),
                description: tx(`Employee ID changed to ${d.employee}`, `تم تغيير رقم الموظف إلى ${d.employee}`),
            })
            setRenameRow(null); setRenameValue('')
            loadEmployees(); loadSegmentCounts()
        } catch (e: any) {
            toast({ title: t('error'), description: e?.message || tx('Could not change the ID', 'تعذّر تغيير الرقم'), variant: 'destructive' })
        } finally {
            setRenameBusy(false)
        }
    }


    const runBulkUpdate = async () => {
        if (!bulkRows || !bulkValue.trim()) return
        setBulkBusy(true)
        try {
            const resp = await frappeClient.call<{ updated: string[]; errors: { name: string; error: string }[]; updated_count: number; error_count: number }>(
                'base_meena.api.employee_directory.bulk_update_employees',
                { names: bulkRows.map(r => r.name), field: bulkField, value: bulkValue })
            const d = ((resp as any).message ?? (resp as any).data ?? {}) as any
            toast({ title: t('success'), description: tx(`${d.updated_count} updated`, `تم تحديث ${d.updated_count}`) + (d.error_count ? tx(`, ${d.error_count} failed`, `، فشل ${d.error_count}`) : '') })
            setBulkRows(null); setBulkValue('')
            if (d.errors?.length) setBulkErrors(d.errors)
            loadEmployees(); loadSegmentCounts()
        } catch (e: any) {
            toast({ title: t('error'), description: e?.message || tx('Bulk update failed', 'فشل التحديث الجماعي'), variant: 'destructive' })
        } finally { setBulkBusy(false) }
    }

    const applyView = (v: SavedView) => {
        setSegment(v.segment); setStatusFilter(v.status); setCompanyFilter(v.company); setDepartmentFilter(v.department); setHiddenCols(v.hidden)
    }
    const saveView = () => {
        if (!saveViewName.trim()) return
        setViews([...views.filter(v => v.name !== saveViewName), { name: saveViewName.trim(), segment, status: statusFilter, company: companyFilter, department: departmentFilter, hidden: hiddenCols }])
        setSaveViewName(''); setShowSaveView(false)
        toast({ title: t('success'), description: tx('View saved', 'تم حفظ العرض') })
    }

    const exportCSVFallback = () => { /* DataTable provides Excel/Print; kept for the header button */ }

    if (loading) {
        return (<div className="space-y-6"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>)
    }

    if (authRequired) return <SessionRenew />

    const segOptions = [
        { id: 'active', label: t('status.active'), count: segCounts.active },
        { id: 'new_hires', label: tx('New Hires', 'موظفون جدد'), count: segCounts.new_hires },
        { id: 'on_probation', label: tx('On Probation', 'تحت التجربة'), count: segCounts.on_probation },
        { id: 'terminated', label: tx('Terminated', 'منتهية خدمتهم'), count: segCounts.terminated },
        { id: 'all', label: tx('All', 'الكل'), count: segCounts.all },
    ]

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight">{t('emp.title')}</h1>
                    <p className="text-sm text-muted-foreground mt-1">{t('emp.subtitle')}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button aria-label="تحديث" title="تحديث" variant="outline" size="sm" onClick={() => { loadEmployees(true); loadSegmentCounts() }} disabled={refreshing}>
                        <RefreshCw className={`w-4 h-4 me-2 ${refreshing ? 'animate-spin' : ''}`} />{t('refresh')}
                    </Button>
                    {isHRManager && (<Button aria-label="إضافة مستخدم" title="إضافة مستخدم" size="sm" onClick={onAddEmployee}><UserPlus className="w-4 h-4 me-2" />{t('emp.add')}</Button>)}
                </div>
            </div>

            {/* Lifecycle segments */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <SegmentedControl options={segOptions} value={segment} onChange={(id) => setSegment(id as Segment)} />
                <div className="flex items-center gap-2">
                    {/* Rich server search (preserved) */}
                    <Input
                        placeholder={t('emp.search')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full sm:w-72"
                    />
                    {/* Columns show/hide */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm"><Columns3 className="w-4 h-4 me-1.5" />{tx('Columns', 'الأعمدة')}</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>{tx('Show columns', 'إظهار الأعمدة')}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {ALL_COLUMNS.map(c => (
                                <DropdownMenuCheckboxItem
                                    key={c.id}
                                    checked={!hiddenCols.includes(c.id)}
                                    onCheckedChange={(v) => setHiddenCols(v ? hiddenCols.filter(x => x !== c.id) : [...hiddenCols, c.id])}
                                    // keep at least the employee column
                                    disabled={c.id === 'employee'}
                                >{c.header}</DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    {/* Saved views */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm"><Bookmark className="w-4 h-4 me-1.5" />{tx('Views', 'العروض')}</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>{tx('Saved views', 'العروض المحفوظة')}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {views.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">{tx('No saved views', 'لا توجد عروض محفوظة')}</div>}
                            {views.map(v => (
                                <div key={v.name} className="flex items-center justify-between px-2 py-1">
                                    <button className="text-sm hover:text-primary text-start flex-1 truncate" onClick={() => applyView(v)}>{v.name}</button>
                                    <button className="text-muted-foreground hover:text-destructive" onClick={() => setViews(views.filter(x => x.name !== v.name))} aria-label={tx('Delete view', 'حذف العرض')} title={tx('Delete view', 'حذف العرض')}><Trash className="w-3.5 h-3.5" /></button>
                                </div>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setShowSaveView(true) }}>
                                <Save className="w-4 h-4 me-2" />{tx('Save current view', 'حفظ العرض الحالي')}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* DataTable — filters (status/company/dept) + sort + pagination + bulk + export */}
            <DataTable<Employee>
                rows={rows}
                columns={visibleColumns}
                getRowId={r => r.name}
                isRTL={isRTL}
                onRowClick={r => onEmployeeSelect?.(r)}
                filters={[
                    { id: 'status', label: t('emp.all_statuses'), value: statusFilter, onChange: setStatusFilter, predicate: (r, v) => (r as Employee).status === v, options: [
                        { value: 'all', label: t('emp.all_statuses') }, { value: 'Active', label: t('status.active') }, { value: 'Inactive', label: t('status.inactive') }, { value: 'Suspended', label: t('status.suspended') }, { value: 'Left', label: t('status.left') },
                    ] },
                    { id: 'company', label: tx('All Companies', 'كل الشركات'), value: companyFilter, onChange: setCompanyFilter, predicate: (r, v) => (r as Employee).company === v, options: [{ value: 'all', label: tx('All Companies', 'كل الشركات') }, ...companies.map(c => ({ value: c, label: c }))] },
                    { id: 'department', label: t('emp.all_departments'), value: departmentFilter, onChange: setDepartmentFilter, predicate: (r, v) => (r as Employee).department === v, options: [{ value: 'all', label: t('emp.all_departments') }, ...departments.map(d => ({ value: d, label: translateDepartment(d, isRTL ? 'ar' : 'en') }))] },
                ]}
                rowActions={[
                    { id: 'view', label: t('view_details'), icon: Eye, onSelect: r => onEmployeeSelect?.(r) },
                    { id: 'edit', label: t('edit'), icon: Edit, onSelect: r => onEmployeeSelect?.(r) },
                    ...(isHRManager ? [{ id: 'rename-id', label: tx('Change employee ID', 'تغيير رقم الموظف'), icon: Hash, onSelect: (r: Employee) => { setRenameRow(r); setRenameValue(r.name) } }] : []),
                    ...(isHRManager ? [{ id: 'delete', label: t('delete'), icon: Trash2, destructive: true, separatorBefore: true, onSelect: (r: Employee) => setPendingDelete(r) }] : []),
                ]}
                bulkActions={isHRUser ? [{ id: 'bulk-edit', label: tx('Bulk edit', 'تعديل جماعي'), icon: PencilLine, onSelect: (rows) => { setBulkRows(rows); setBulkValue('') } }] : []}
                exportFilename="employees"
                exportTitle={t('emp.title')}
                // Everyone on one page. A directory is scanned and searched,
                // not read page by page, and paging it hid most of the staff
                // behind arrows for no gain — the rows are already all fetched.
                pageSize={ALL_ROWS}
                // Key bumped from "emp-list": the old one has a stored
                // rows-per-page that would override the default above.
                persistKey="emp-list-v2"
                searchPlaceholder={t('emp.search')}
                emptyMessage={isRTL ? 'لا يوجد موظفون بعد' : 'No employees yet'}
                emptyDescription={isRTL ? 'ابدأ ببناء دليل موظفيك بإضافة أول موظف.' : 'Start building your directory by adding your first employee.'}
                emptyActionLabel={isHRManager ? (isRTL ? 'إضافة أول موظف' : 'Add your first employee') : undefined}
                emptyAction={isHRManager ? onAddEmployee : undefined}
            />

            {/* Delete confirm */}
            <ConfirmDialog
                open={!!pendingDelete}
                onOpenChange={(open) => !open && setPendingDelete(null)}
                title={tx(`Delete ${pendingDelete?.employee_name}?`, `حذف ${pendingDelete?.employee_name}؟`)}
                description={tx('This action cannot be undone.', 'لا يمكن التراجع عن هذا الإجراء.')}
                confirmLabel={t('delete')} cancelLabel={t('cancel')} onConfirm={confirmDelete}
            />

            {/* Bulk edit dialog */}
            <Dialog open={!!bulkRows} onOpenChange={(o) => !o && setBulkRows(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{tx('Bulk edit', 'تعديل جماعي')}</DialogTitle>
                        <DialogDescription>{tx(`Update ${bulkRows?.length || 0} employees.`, `تحديث ${bulkRows?.length || 0} موظف.`)}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>{tx('Field', 'الحقل')}</Label>
                            <Select value={bulkField} onValueChange={(v) => setBulkField(v as BulkField)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {BULK_FIELDS.map(f => (<SelectItem key={f} value={f}>{f === 'branch' ? t('emp.branch') || 'Branch' : f === 'department' ? t('department') : f === 'designation' ? t('emp.designation') : f === 'default_shift' ? tx('Default Shift', 'المناوبة الافتراضية') : tx('Holiday List', 'قائمة العطلات')}</SelectItem>))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>{tx('New value', 'القيمة الجديدة')}</Label>
                            <Input value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} placeholder={tx('Enter value…', 'أدخل القيمة…')} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBulkRows(null)}>{t('cancel')}</Button>
                        <Button onClick={runBulkUpdate} disabled={bulkBusy || !bulkValue.trim()}>{bulkBusy ? tx('Applying…', 'جارٍ التطبيق…') : tx('Apply', 'تطبيق')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Bulk errors */}
            <Dialog open={!!renameRow} onOpenChange={(o) => !o && setRenameRow(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{tx('Change employee ID', 'تغيير رقم الموظف')}</DialogTitle>
                        <DialogDescription>
                            {tx(
                                `This is the ID every record uses to refer to ${renameRow?.employee_name || ''}. Changing it moves her attendance, payroll and documents to the new ID.`,
                                `هذا هو الرقم الذي تشير به كل السجلات إلى ${renameRow?.employee_name || ''}. تغييره ينقل حضورها ورواتبها ومستنداتها إلى الرقم الجديد.`,
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label>{tx('New employee ID', 'رقم الموظف الجديد')}</Label>
                        <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') submitRename() }}
                            placeholder={renameRow?.name}
                            autoFocus
                        />
                        <p className="text-xs text-muted-foreground">
                            {tx(`Currently ${renameRow?.name || ''}`, `الرقم الحالي ${renameRow?.name || ''}`)}
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRenameRow(null)} disabled={renameBusy}>
                            {tx('Cancel', 'إلغاء')}
                        </Button>
                        <Button
                            onClick={submitRename}
                            disabled={renameBusy || !renameValue.trim() || renameValue.trim() === renameRow?.name}
                        >
                            {renameBusy ? tx('Changing…', 'جارٍ التغيير…') : tx('Change ID', 'تغيير الرقم')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!bulkErrors} onOpenChange={(o) => !o && setBulkErrors(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{tx('Some rows failed', 'فشلت بعض الصفوف')}</DialogTitle></DialogHeader>
                    <div className="max-h-72 overflow-y-auto space-y-1 text-sm">
                        {bulkErrors?.map(e => (<div key={e.name} className="flex justify-between gap-2 border-b py-1"><span className="font-medium">{e.name}</span><span className="text-destructive text-xs">{e.error}</span></div>))}
                    </div>
                    <DialogFooter><Button onClick={() => setBulkErrors(null)}>{tx('Close', 'إغلاق')}</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Save view dialog */}
            <Dialog open={showSaveView} onOpenChange={setShowSaveView}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{tx('Save current view', 'حفظ العرض الحالي')}</DialogTitle></DialogHeader>
                    <div className="space-y-2">
                        <Label>{tx('View name', 'اسم العرض')}</Label>
                        <Input value={saveViewName} onChange={(e) => setSaveViewName(e.target.value)} placeholder={tx('e.g. Active Sales', 'مثال: مبيعات نشطة')} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowSaveView(false)}>{t('cancel')}</Button>
                        <Button onClick={saveView} disabled={!saveViewName.trim()}>{tx('Save', 'حفظ')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
