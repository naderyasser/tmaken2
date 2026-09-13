'use client'
import { csrfFetch } from '@/lib/csrf'
import { printRows, exportRowsToCsv, type ExportColumn } from '@/lib/export-utils'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
    Search, RefreshCw, Plus, Loader2, Eye, FileSignature,
    Pencil, Upload, X, FileText, Printer, Download } from 'lucide-react'
import { frappeClient, frappeApiUrl } from '@/lib/api-client'
import { frappeImageUrl } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Table, TableBody, TableCell, TableHead,
    TableHeader, TableRow,
} from '@/components/ui/table'
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { useI18n } from '@/lib/i18n'
import { translateEnum } from '@/lib/enums'
import { formatDateShort } from '@/lib/format'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContractRecord {
    name: string
    employee: string
    employee_name: string
    company: string
    designation: string
    contract_type: string
    contract_start_date: string
    contract_end_date: string
    basic_salary: number
    housing_allowance: number
    transport_allowance: number
    other_allowance: number
    probation_period_months: number
    notice_period_days: number
    annual_leave_days: number
    working_hours_per_day: number
    contract_terms: string
    contract_document: string
    status: string
    signed_on: string
    clause_non_compete: number | boolean
    non_compete_duration: number | null
    non_compete_scope: string
}

interface EmployeeOption {
    name: string
    employee_name: string
    designation: string
    company: string
}

interface ContractForm {
    employee: string
    company: string
    designation: string
    contract_type: string
    contract_start_date: string
    contract_end_date: string
    basic_salary: string
    housing_allowance: string
    transport_allowance: string
    other_allowance: string
    probation_period_months: string
    notice_period_days: string
    annual_leave_days: string
    working_hours_per_day: string
    contract_terms: string
    contract_document: string
    status: string
    signed_on: string
    // Non-compete clause (doctype: clause_non_compete / non_compete_duration / non_compete_scope)
    clause_non_compete: boolean
    non_compete_duration: string
    non_compete_scope: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONTRACT_TYPES = ['Permanent', 'Fixed Term', 'Probation', 'Part-time']
const STATUSES = ['Draft', 'Active', 'Expired', 'Terminated']

// Display-only Arabic labels. Backend values stay the English keys above.
const CONTRACT_TYPE_AR: Record<string, string> = {
    'Permanent': 'دائم',
    'Fixed Term': 'محدد المدة',
    'Probation': 'تحت التجربة',
    'Part-time': 'دوام جزئي',
}
const STATUS_AR: Record<string, string> = {
    'Draft': 'مسودة',
    'Active': 'فعّال',
    'Expired': 'منتهي',
    'Terminated': 'مُنهى',
}

const STATUS_STYLES: Record<string, string> = {
    'Draft': 'bg-slate-100 text-slate-600',
    'Active': 'bg-green-100 text-green-800',
    'Expired': 'bg-amber-100 text-amber-800',
    'Terminated': 'bg-red-100 text-red-800',
}

const emptyForm = (): ContractForm => ({
    employee: '',
    company: '',
    designation: '',
    contract_type: '',
    contract_start_date: '',
    contract_end_date: '',
    basic_salary: '',
    housing_allowance: '',
    transport_allowance: '',
    other_allowance: '',
    probation_period_months: '',
    notice_period_days: '',
    annual_leave_days: '',
    working_hours_per_day: '',
    contract_terms: '',
    contract_document: '',
    status: 'Draft',
    signed_on: '',
    clause_non_compete: false,
    non_compete_duration: '',
    non_compete_scope: '',
})

// ---------------------------------------------------------------------------
// Upload helper
// ---------------------------------------------------------------------------

async function uploadFileToFrappe(file: File): Promise<string> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('is_private', '0')
    formData.append('folder', 'Home/Attachments')

    const res = await csrfFetch(
        frappeApiUrl('/api/method/upload_file'),
        { method: 'POST', credentials: 'include', body: formData }
    )

    if (!res.ok) {
        // Throw stable codes (not user strings) — mapped to a bilingual message at the call site.
        if (res.status === 413) throw new Error('upload_too_large')
        if (res.status === 403) throw new Error('upload_auth')
        throw new Error(`upload_failed:${res.status}`)
    }

    const data = await res.json()
    const url = data.message?.file_url || data.file_url
    if (!url) throw new Error('upload_no_url')
    return url as string
}

function getFileViewUrl(fileUrl: string): string {
    if (!fileUrl) return ''
    if (fileUrl.startsWith('http')) return fileUrl
    return frappeImageUrl(fileUrl) || fileUrl
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ContractList() {
    const [records, setRecords] = useState<ContractRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [typeFilter, setTypeFilter] = useState('all')

    // Create / edit dialog
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingName, setEditingName] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [employees, setEmployees] = useState<EmployeeOption[]>([])
    const [employeeSearch, setEmployeeSearch] = useState('')
    const [form, setForm] = useState<ContractForm>(emptyForm())
    const [uploadingDoc, setUploadingDoc] = useState(false)
    const docInputRef = useRef<HTMLInputElement>(null)

    // Details dialog
    const [detailsDialog, setDetailsDialog] = useState<{
        open: boolean; record: ContractRecord | null
    }>({ open: false, record: null })

    const { toast } = useToast()
    const { isRTL } = useI18n()

    const msg = (en: string, ar: string) => isRTL ? ar : en

    // ---------------------------------------------------------------------------
    // Data loading
    // ---------------------------------------------------------------------------

    const loadRecords = useCallback(async (showRefresh = false) => {
        try {
            if (showRefresh) setRefreshing(true)
            else setLoading(true)
            setError(null)

            const res = await frappeClient.call<ContractRecord[]>(
                'base_meena.employment_contract_api.get_contracts',
                {}
            )
            setRecords(res?.message || [])
        } catch (err: any) {
            console.error('Failed to load contracts:', err)
            setError(err?.message || msg('Failed to load employment contracts.', 'فشل تحميل عقود العمل.'))
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [])

    const loadEmployees = useCallback(async () => {
        try {
            const data = await frappeClient.getList<EmployeeOption>('Employee', {
                fields: ['name', 'employee_name', 'designation', 'company'],
                filters: [['status', '=', 'Active'] as any],
                order_by: 'employee_name asc',
                limit_page_length: 500,
            })
            setEmployees(data)
        } catch (err) {
            console.error('Failed to load employees:', err)
        }
    }, [])

    useEffect(() => { loadRecords() }, [loadRecords])

    // ---------------------------------------------------------------------------
    // Filtering
    // ---------------------------------------------------------------------------

    const filteredRecords = useMemo(() => {
        let filtered = records
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            filtered = filtered.filter(r =>
                r.employee_name?.toLowerCase().includes(q) ||
                r.employee?.toLowerCase().includes(q) ||
                r.designation?.toLowerCase().includes(q) ||
                r.name?.toLowerCase().includes(q)
            )
        }
        if (statusFilter !== 'all') filtered = filtered.filter(r => r.status === statusFilter)
        if (typeFilter !== 'all') filtered = filtered.filter(r => r.contract_type === typeFilter)
        return filtered
    }, [records, searchQuery, statusFilter, typeFilter])

    const stats = useMemo(() => ({
        total: records.length,
        active: records.filter(r => r.status === 'Active').length,
        draft: records.filter(r => r.status === 'Draft').length,
        expired: records.filter(r => r.status === 'Expired').length,
    }), [records])

    const filteredEmployees = useMemo(() => {
        if (!employeeSearch) return employees.slice(0, 50)
        const q = employeeSearch.toLowerCase()
        return employees.filter(e =>
            e.employee_name?.toLowerCase().includes(q) ||
            e.name?.toLowerCase().includes(q)
        ).slice(0, 50)
    }, [employees, employeeSearch])

    // Print/export the filtered set, matching what the table shows.
    const contractColumns: ExportColumn<typeof records[number]>[] = [
        { header: isRTL ? 'الموظف' : 'Employee', value: (r) => `${r.employee_name || r.employee} (${r.employee})` },
        { header: isRTL ? 'المسمى الوظيفي' : 'Designation', value: (r) => translateEnum('designation', r.designation, isRTL ? 'ar' : 'en') || '—' },
        { header: isRTL ? 'نوع العقد' : 'Type', value: (r) => r.contract_type ? (isRTL ? (CONTRACT_TYPE_AR[r.contract_type] || r.contract_type) : r.contract_type) : '—' },
        { header: isRTL ? 'البداية' : 'Start', value: (r) => formatDateShort(r.contract_start_date) || '—' },
        { header: isRTL ? 'النهاية' : 'End', value: (r) => formatDateShort(r.contract_end_date) || '—' },
        { header: isRTL ? 'الحالة' : 'Status', value: (r) => isRTL ? (STATUS_AR[r.status] || r.status) : r.status },
    ]

    const handlePrintContracts = () => {
        if (!filteredRecords.length) return
        printRows(
            {
                title: isRTL ? 'عقود العمل' : 'Employment Contracts',
                subtitle: `${filteredRecords.length} ${isRTL ? 'عقد' : 'contracts'}`,
                isRTL,
            },
            contractColumns,
            filteredRecords,
        )
    }

    const handleExportContracts = () => {
        if (!filteredRecords.length) return
        exportRowsToCsv(`contracts_${new Date().toISOString().slice(0, 10)}`, contractColumns, filteredRecords)
    }

    // ---------------------------------------------------------------------------
    // Document upload
    // ---------------------------------------------------------------------------

    const handleDocSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (docInputRef.current) docInputRef.current.value = ''

        if (file.size > 10 * 1024 * 1024) {
            toast({ title: msg('File too large', 'الملف كبير جداً'), description: msg('Document must be under 10 MB.', 'يجب أن تكون الوثيقة أقل من 10 ميغابايت.'), variant: 'destructive' })
            return
        }

        setUploadingDoc(true)
        try {
            const url = await uploadFileToFrappe(file)
            setForm(f => ({ ...f, contract_document: url }))
        } catch (err: any) {
            const code = String(err?.message || '')
            let desc: string
            if (code === 'upload_too_large') desc = msg('File is too large.', 'الملف كبير جداً.')
            else if (code === 'upload_auth') desc = msg('Authentication error — please re-login.', 'خطأ في المصادقة — يرجى إعادة تسجيل الدخول.')
            else if (code === 'upload_no_url') desc = msg('Upload succeeded but no file URL returned.', 'تم الرفع لكن لم يُرجَع رابط الملف.')
            else if (code.startsWith('upload_failed')) { const st = code.split(':')[1] || ''; desc = msg(`Upload failed (${st})`, `فشل الرفع (${st})`) }
            else desc = msg('Failed to upload the document.', 'تعذّر رفع الوثيقة.')
            toast({ title: msg('Upload failed', 'فشل الرفع'), description: desc, variant: 'destructive' })
        } finally {
            setUploadingDoc(false)
        }
    }

    // ---------------------------------------------------------------------------
    // Create / edit
    // ---------------------------------------------------------------------------

    const openCreate = async () => {
        setEditingName(null)
        setForm(emptyForm())
        setEmployeeSearch('')
        setDialogOpen(true)
        if (employees.length === 0) await loadEmployees()
    }

    const openEdit = async (record: ContractRecord) => {
        setEditingName(record.name)
        setForm({
            employee: record.employee || '',
            company: record.company || '',
            designation: record.designation || '',
            contract_type: record.contract_type || '',
            contract_start_date: record.contract_start_date || '',
            contract_end_date: record.contract_end_date || '',
            basic_salary: record.basic_salary != null ? String(record.basic_salary) : '',
            housing_allowance: record.housing_allowance != null ? String(record.housing_allowance) : '',
            transport_allowance: record.transport_allowance != null ? String(record.transport_allowance) : '',
            other_allowance: record.other_allowance != null ? String(record.other_allowance) : '',
            probation_period_months: record.probation_period_months != null ? String(record.probation_period_months) : '',
            notice_period_days: record.notice_period_days != null ? String(record.notice_period_days) : '',
            annual_leave_days: record.annual_leave_days != null ? String(record.annual_leave_days) : '',
            working_hours_per_day: record.working_hours_per_day != null ? String(record.working_hours_per_day) : '',
            contract_terms: record.contract_terms || '',
            contract_document: record.contract_document || '',
            status: record.status || 'Draft',
            signed_on: record.signed_on || '',
            clause_non_compete: !!record.clause_non_compete,
            non_compete_duration: record.non_compete_duration != null ? String(record.non_compete_duration) : '',
            non_compete_scope: record.non_compete_scope || '',
        })
        setEmployeeSearch(record.employee_name || record.employee || '')
        setDialogOpen(true)
        if (employees.length === 0) await loadEmployees()
    }

    const handleSave = async () => {
        if (!form.employee) {
            toast({ title: msg('Validation', 'تحقق'), description: msg('Employee is required.', 'الموظف مطلوب.'), variant: 'destructive' })
            return
        }
        // Non-compete: when enabled, duration (1–24 months) + scope are required (mirrors the new-employee form).
        if (form.clause_non_compete) {
            const ncDur = Number(form.non_compete_duration)
            if (form.non_compete_duration === '' || !(ncDur >= 1 && ncDur <= 24)) {
                toast({ title: msg('Validation', 'تحقق'), description: msg('Non-compete duration must be between 1 and 24 months.', 'مدة عدم المنافسة يجب أن تكون بين 1 و24 شهراً.'), variant: 'destructive' })
                return
            }
            if (!form.non_compete_scope.trim()) {
                toast({ title: msg('Validation', 'تحقق'), description: msg('Non-compete scope (place & type of work) is required.', 'نطاق عدم المنافسة (المكان ونوع العمل) مطلوب.'), variant: 'destructive' })
                return
            }
        }
        setSaving(true)
        try {
            // Build payload — convert numeric strings to numbers, drop empties
            const numericFields = [
                'basic_salary', 'housing_allowance', 'transport_allowance', 'other_allowance',
                'probation_period_months', 'notice_period_days', 'annual_leave_days', 'working_hours_per_day',
            ]
            const payload: Record<string, any> = {}
            for (const [key, value] of Object.entries(form)) {
                if (value === '' || value == null) continue
                payload[key] = numericFields.includes(key) ? Number(value) : value
            }

            // Non-compete: always send the flag; carry sub-fields only when enabled (clear them when off).
            payload.clause_non_compete = form.clause_non_compete ? 1 : 0
            payload.non_compete_duration = form.clause_non_compete ? Number(form.non_compete_duration) : 0
            payload.non_compete_scope = form.clause_non_compete ? form.non_compete_scope.trim() : ''

            if (editingName) {
                await frappeClient.call(
                    'base_meena.employment_contract_api.update_contract',
                    { name: editingName, ...payload }
                )
            } else {
                await frappeClient.call(
                    'base_meena.employment_contract_api.create_contract',
                    payload
                )
            }
            toast({
                title: msg('Success', 'تم'),
                description: editingName
                    ? msg('Contract updated.', 'تم تحديث العقد.')
                    : msg('Contract created.', 'تم إنشاء العقد.'),
            })
            setDialogOpen(false)
            await loadRecords(true)
        } catch (err: any) {
            console.error('Failed to save contract:', err)
            toast({ title: msg('Error', 'خطأ'), description: err?.message || msg('Failed to save contract.', 'فشل حفظ العقد.'), variant: 'destructive' })
        } finally {
            setSaving(false)
        }
    }

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-12 w-full" />
                <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
                </div>
                <Skeleton className="h-64 w-full" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        {isRTL ? 'عقود العمل' : 'Employment Contracts'}
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {isRTL ? 'تسجيل وإدارة بنود عقود الموظفين' : 'Record and manage employee contract terms'}
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <Button aria-label={isRTL ? 'طباعة' : 'Print'} title={isRTL ? 'طباعة' : 'Print'} variant="outline" size="sm" onClick={handlePrintContracts} disabled={!filteredRecords.length}>
                        <Printer className="h-4 w-4" />
                    </Button>
                    <Button aria-label={isRTL ? 'تصدير CSV' : 'Export CSV'} title={isRTL ? 'تصدير CSV' : 'Export CSV'} variant="outline" size="sm" onClick={handleExportContracts} disabled={!filteredRecords.length}>
                        <Download className="h-4 w-4" />
                    </Button>
                    <Button aria-label="تحديث" title="تحديث" variant="outline" size="sm" onClick={() => loadRecords(true)} disabled={refreshing}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        {isRTL ? 'تحديث' : 'Refresh'}
                    </Button>
                    <Button aria-label="إضافة" title="إضافة" size="sm" onClick={openCreate}>
                        <Plus className="w-4 h-4 mr-2" />
                        {isRTL ? 'عقد جديد' : 'New Contract'}
                    </Button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="p-4 flex items-center justify-between">
                        <p className="text-sm text-red-700">{error}</p>
                        <Button variant="outline" size="sm" onClick={() => loadRecords()}>
                            {isRTL ? 'إعادة المحاولة' : 'Retry'}
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: isRTL ? 'الإجمالي' : 'Total', value: stats.total, color: 'text-primary', bg: 'bg-accent', icon: 'text-primary' },
                    { label: isRTL ? 'فعّال' : 'Active', value: stats.active, color: 'text-green-700', bg: 'bg-green-50', icon: 'text-green-600' },
                    { label: isRTL ? 'مسودة' : 'Draft', value: stats.draft, color: 'text-slate-700', bg: 'bg-slate-100', icon: 'text-slate-600' },
                    { label: isRTL ? 'منتهي' : 'Expired', value: stats.expired, color: 'text-amber-700', bg: 'bg-amber-50', icon: 'text-amber-600' },
                ].map(({ label, value, color, bg, icon }) => (
                    <Card key={label}>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 ${bg} rounded-lg`}><FileSignature className={`h-5 w-5 ${icon}`} /></div>
                                <div>
                                    <p className="text-sm text-muted-foreground">{label}</p>
                                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
                            <Input
                                placeholder={isRTL ? 'بحث...' : 'Search employee or contract...'}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger aria-label={isRTL ? 'كل الحالات' : 'All statuses'}>
                                <SelectValue placeholder={isRTL ? 'كل الحالات' : 'All statuses'} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{isRTL ? 'كل الحالات' : 'All statuses'}</SelectItem>
                                {STATUSES.map(s => <SelectItem key={s} value={s}>{isRTL ? (STATUS_AR[s] || s) : s}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger aria-label={isRTL ? 'كل الأنواع' : 'All types'}>
                                <SelectValue placeholder={isRTL ? 'كل الأنواع' : 'All types'} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{isRTL ? 'كل الأنواع' : 'All types'}</SelectItem>
                                {CONTRACT_TYPES.map(c => <SelectItem key={c} value={c}>{isRTL ? (CONTRACT_TYPE_AR[c] || c) : c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{isRTL ? 'الموظف' : 'Employee'}</TableHead>
                                <TableHead>{isRTL ? 'المسمى الوظيفي' : 'Designation'}</TableHead>
                                <TableHead>{isRTL ? 'نوع العقد' : 'Type'}</TableHead>
                                <TableHead>{isRTL ? 'البداية' : 'Start'}</TableHead>
                                <TableHead>{isRTL ? 'النهاية' : 'End'}</TableHead>
                                <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                                <TableHead className="text-right">{isRTL ? 'الإجراءات' : 'Actions'}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredRecords.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                                        <FileSignature className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                                        <p className="font-medium">
                                            {records.length === 0
                                                ? (isRTL ? 'لا توجد عقود مسجلة' : 'No contracts found')
                                                : (isRTL ? 'لا توجد نتائج مطابقة' : 'No matching records')}
                                        </p>
                                    </TableCell>
                                </TableRow>
                            ) : filteredRecords.map(record => (
                                <TableRow key={record.name} className="hover:bg-accent/50">
                                    <TableCell>
                                        <div className="font-medium">{record.employee_name || record.employee}</div>
                                        <div className="text-xs text-muted-foreground">{record.employee}</div>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{translateEnum('designation', record.designation, isRTL ? 'ar' : 'en') || '—'}</TableCell>
                                    <TableCell className="text-sm">{record.contract_type ? (isRTL ? (CONTRACT_TYPE_AR[record.contract_type] || record.contract_type) : record.contract_type) : '—'}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground tabular-nums">{formatDateShort(record.contract_start_date) || '—'}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground tabular-nums">{formatDateShort(record.contract_end_date) || '—'}</TableCell>
                                    <TableCell>
                                        <Badge className={`text-xs ${STATUS_STYLES[record.status] ?? 'bg-muted text-foreground/90'}`}>
                                            {isRTL ? (STATUS_AR[record.status] || record.status) : record.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button aria-label="عرض" title="عرض" variant="ghost" size="sm" className="h-8 px-2"
                                                onClick={() => setDetailsDialog({ open: true, record })}>
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button aria-label="تعديل" title="تعديل" variant="ghost" size="sm" className="h-8 px-2"
                                                onClick={() => openEdit(record)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {filteredRecords.length > 0 && (
                        <div className="px-6 py-3 border-t text-sm text-muted-foreground">
                            {isRTL
                                ? `عرض ${filteredRecords.length} من أصل ${records.length} عقد`
                                : `Showing ${filteredRecords.length} of ${records.length} records`}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ================================================================ */}
            {/* CREATE / EDIT DIALOG                                               */}
            {/* ================================================================ */}
            <Dialog open={dialogOpen} onOpenChange={(open) => !open && setDialogOpen(false)}>
                <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingName
                                ? (isRTL ? 'تعديل العقد' : 'Edit Contract')
                                : (isRTL ? 'عقد عمل جديد' : 'New Employment Contract')}
                        </DialogTitle>
                        <DialogDescription>
                            {isRTL ? 'سجّل بنود وشروط عقد الموظف' : 'Record the employee contract terms and conditions'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 pt-2">
                        {/* ---- Employee ---- */}
                        <div className="space-y-1.5">
                            <Label>{isRTL ? 'الموظف *' : 'Employee *'}</Label>
                            <Input
                                placeholder={isRTL ? 'ابحث باسم الموظف...' : 'Search employee...'}
                                value={employeeSearch}
                                onChange={(e) => { setEmployeeSearch(e.target.value); setForm(f => ({ ...f, employee: '' })) }}
                                disabled={!!editingName}
                            />
                            {!editingName && employeeSearch && !form.employee && filteredEmployees.length > 0 && (
                                <div className="border rounded-md bg-card shadow-sm max-h-40 overflow-y-auto">
                                    {filteredEmployees.map(emp => (
                                        <button key={emp.name}
                                            className="w-full text-start px-3 py-2 hover:bg-accent/50 text-sm border-b last:border-b-0"
                                            onClick={() => {
                                                setForm(f => ({
                                                    ...f,
                                                    employee: emp.name,
                                                    designation: f.designation || emp.designation || '',
                                                    company: f.company || emp.company || '',
                                                }))
                                                setEmployeeSearch(emp.employee_name)
                                            }}
                                        >
                                            <span className="font-medium">{emp.employee_name}</span>
                                            <span className="text-muted-foreground ml-2 text-xs">{emp.name}</span>
                                            {emp.designation && <span className="text-muted-foreground/70 ml-1 text-xs">· {translateEnum('designation', emp.designation, isRTL ? 'ar' : 'en')}</span>}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {form.employee && (
                                <p className="text-xs text-green-600">✓ {isRTL ? 'تم الاختيار: ' : 'Selected: '}{form.employee}</p>
                            )}
                        </div>

                        {/* ---- Designation & Type ---- */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>{isRTL ? 'المسمى الوظيفي' : 'Designation'}</Label>
                                <Input
                                    placeholder={isRTL ? 'اختياري' : 'Optional'}
                                    value={form.designation}
                                    onChange={(e) => setForm(f => ({ ...f, designation: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>{isRTL ? 'نوع العقد' : 'Contract Type'}</Label>
                                <Select value={form.contract_type} onValueChange={(v) => setForm(f => ({ ...f, contract_type: v }))}>
                                    <SelectTrigger aria-label={isRTL ? 'اختر' : 'Select'}><SelectValue placeholder={isRTL ? 'اختر' : 'Select'} /></SelectTrigger>
                                    <SelectContent>
                                        {CONTRACT_TYPES.map(c => <SelectItem key={c} value={c}>{isRTL ? (CONTRACT_TYPE_AR[c] || c) : c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* ---- Dates ---- */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>{isRTL ? 'تاريخ البداية' : 'Start Date'}</Label>
                                <Input type="date" value={form.contract_start_date}
                                    onChange={(e) => setForm(f => ({ ...f, contract_start_date: e.target.value }))} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>{isRTL ? 'تاريخ النهاية' : 'End Date'}</Label>
                                <Input type="date" value={form.contract_end_date}
                                    onChange={(e) => setForm(f => ({ ...f, contract_end_date: e.target.value }))} />
                            </div>
                        </div>

                        {/* ---- Salary & Allowances ---- */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>{isRTL ? 'الراتب الأساسي' : 'Basic Salary'}</Label>
                                <Input type="number" placeholder="0" value={form.basic_salary}
                                    onChange={(e) => setForm(f => ({ ...f, basic_salary: e.target.value }))} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>{isRTL ? 'بدل السكن' : 'Housing Allowance'}</Label>
                                <Input type="number" placeholder="0" value={form.housing_allowance}
                                    onChange={(e) => setForm(f => ({ ...f, housing_allowance: e.target.value }))} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>{isRTL ? 'بدل النقل' : 'Transport Allowance'}</Label>
                                <Input type="number" placeholder="0" value={form.transport_allowance}
                                    onChange={(e) => setForm(f => ({ ...f, transport_allowance: e.target.value }))} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>{isRTL ? 'بدلات أخرى' : 'Other Allowance'}</Label>
                                <Input type="number" placeholder="0" value={form.other_allowance}
                                    onChange={(e) => setForm(f => ({ ...f, other_allowance: e.target.value }))} />
                            </div>
                        </div>

                        {/* ---- Leave & Hours ---- */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>{isRTL ? 'مدة التجربة (أشهر)' : 'Probation (Months)'}</Label>
                                <Input type="number" placeholder="0" value={form.probation_period_months}
                                    onChange={(e) => setForm(f => ({ ...f, probation_period_months: e.target.value }))} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>{isRTL ? 'مدة الإشعار (أيام)' : 'Notice Period (Days)'}</Label>
                                <Input type="number" placeholder="0" value={form.notice_period_days}
                                    onChange={(e) => setForm(f => ({ ...f, notice_period_days: e.target.value }))} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>{isRTL ? 'أيام الإجازة السنوية' : 'Annual Leave Days'}</Label>
                                <Input type="number" placeholder="0" value={form.annual_leave_days}
                                    onChange={(e) => setForm(f => ({ ...f, annual_leave_days: e.target.value }))} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>{isRTL ? 'ساعات العمل يومياً' : 'Working Hours / Day'}</Label>
                                <Input type="number" step="0.5" placeholder="0" value={form.working_hours_per_day}
                                    onChange={(e) => setForm(f => ({ ...f, working_hours_per_day: e.target.value }))} />
                            </div>
                        </div>

                        {/* ---- Contract Terms ---- */}
                        <div className="space-y-1.5">
                            <Label>{isRTL ? 'بنود العقد' : 'Contract Terms'}</Label>
                            <Textarea
                                placeholder={isRTL ? 'اكتب بنود وشروط العقد...' : 'Enter the contract terms and conditions...'}
                                rows={5}
                                value={form.contract_terms}
                                onChange={(e) => setForm(f => ({ ...f, contract_terms: e.target.value }))}
                            />
                        </div>

                        {/* ---- Non-Compete Clause ---- */}
                        <div className="space-y-3 rounded-lg border border-border p-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <Checkbox
                                    checked={form.clause_non_compete}
                                    onCheckedChange={(v) => setForm(f => ({ ...f, clause_non_compete: v === true }))}
                                />
                                <span className="text-sm font-medium">{isRTL ? 'بند عدم المنافسة' : 'Non-Compete Clause'}</span>
                            </label>
                            {form.clause_non_compete && (
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <Label>{isRTL ? 'المدة (بالأشهر، بحد أقصى 24)' : 'Duration (months, max 24)'} <span className="text-destructive">*</span></Label>
                                        <Input type="number" min={1} max={24} placeholder="12" value={form.non_compete_duration}
                                            onChange={(e) => setForm(f => ({ ...f, non_compete_duration: e.target.value }))} />
                                    </div>
                                    <div className="space-y-1.5 sm:col-span-2">
                                        <Label>{isRTL ? 'النطاق: المكان ونوع النشاط' : 'Scope: place & type of business/activity'} <span className="text-destructive">*</span></Label>
                                        <Textarea rows={2}
                                            placeholder={isRTL ? 'النطاق الجغرافي + نوع النشاط أو العمل' : 'Geographic scope + type of business/activity'}
                                            value={form.non_compete_scope}
                                            onChange={(e) => setForm(f => ({ ...f, non_compete_scope: e.target.value }))} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ---- Contract Document ---- */}
                        <div className="space-y-1.5">
                            <Label>{isRTL ? 'وثيقة العقد الموقعة' : 'Signed Contract Document'}</Label>
                            <input
                                ref={docInputRef}
                                type="file"
                                accept=".pdf,.doc,.docx,image/*"
                                className="hidden"
                                onChange={handleDocSelect}
                            />
                            {form.contract_document ? (
                                <div className="flex items-center gap-2.5 px-3 py-2 border rounded-lg bg-card">
                                    <FileText className="w-4 h-4 text-muted-foreground/70 shrink-0" />
                                    <a href={getFileViewUrl(form.contract_document)} target="_blank" rel="noopener noreferrer"
                                        className="text-sm text-primary flex-1 truncate hover:underline">
                                        {form.contract_document.split('/').pop()}
                                    </a>
                                    <button type="button" onClick={() => setForm(f => ({ ...f, contract_document: '' }))}
                                        className="text-muted-foreground/70 hover:text-red-500 shrink-0">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ) : (
                                <Button type="button" variant="outline" size="sm"
                                    onClick={() => docInputRef.current?.click()} disabled={uploadingDoc}>
                                    {uploadingDoc
                                        ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />{isRTL ? 'جاري الرفع...' : 'Uploading...'}</>
                                        : <><Upload className="w-3.5 h-3.5 mr-1.5" />{isRTL ? 'رفع الوثيقة' : 'Upload document'}</>}
                                </Button>
                            )}
                        </div>

                        {/* ---- Status & Signed On ---- */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>{isRTL ? 'الحالة' : 'Status'}</Label>
                                <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {STATUSES.map(s => <SelectItem key={s} value={s}>{isRTL ? (STATUS_AR[s] || s) : s}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>{isRTL ? 'تاريخ التوقيع' : 'Signed On'}</Label>
                                <Input type="date" value={form.signed_on}
                                    onChange={(e) => setForm(f => ({ ...f, signed_on: e.target.value }))} />
                            </div>
                        </div>

                        {/* ---- Submit ---- */}
                        <div className="flex gap-3 pt-2">
                            <Button className="flex-1" onClick={handleSave} disabled={saving || uploadingDoc}>
                                {saving
                                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isRTL ? 'جاري الحفظ...' : 'Saving...'}</>
                                    : (isRTL ? 'حفظ' : 'Save')}
                            </Button>
                            <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}
                                disabled={saving || uploadingDoc}>
                                {isRTL ? 'إلغاء' : 'Cancel'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ================================================================ */}
            {/* DETAILS DIALOG                                                     */}
            {/* ================================================================ */}
            <Dialog open={detailsDialog.open} onOpenChange={(open) => !open && setDetailsDialog({ open: false, record: null })}>
                <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{isRTL ? 'تفاصيل العقد' : 'Contract Details'}</DialogTitle>
                    </DialogHeader>
                    {detailsDialog.record && (
                        <div className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { label: isRTL ? 'الموظف' : 'Employee', valueNode: (<><p className="font-semibold">{detailsDialog.record.employee_name}</p><p className="text-xs text-muted-foreground">{detailsDialog.record.employee}</p></>) },
                                    { label: isRTL ? 'المسمى الوظيفي' : 'Designation', value: detailsDialog.record.designation || '—' },
                                    { label: isRTL ? 'الشركة' : 'Company', value: detailsDialog.record.company || '—' },
                                    { label: isRTL ? 'نوع العقد' : 'Contract Type', value: detailsDialog.record.contract_type ? (isRTL ? (CONTRACT_TYPE_AR[detailsDialog.record.contract_type] || detailsDialog.record.contract_type) : detailsDialog.record.contract_type) : '—' },
                                    { label: isRTL ? 'الحالة' : 'Status', valueNode: (<Badge className={`text-xs mt-0.5 ${STATUS_STYLES[detailsDialog.record.status] ?? 'bg-muted text-foreground/90'}`}>{isRTL ? (STATUS_AR[detailsDialog.record.status] || detailsDialog.record.status) : detailsDialog.record.status}</Badge>) },
                                    { label: isRTL ? 'تاريخ البداية' : 'Start Date', value: detailsDialog.record.contract_start_date || '—' },
                                    { label: isRTL ? 'تاريخ النهاية' : 'End Date', value: detailsDialog.record.contract_end_date || '—' },
                                    { label: isRTL ? 'تاريخ التوقيع' : 'Signed On', value: detailsDialog.record.signed_on || '—' },
                                    { label: isRTL ? 'الراتب الأساسي' : 'Basic Salary', value: detailsDialog.record.basic_salary != null ? String(detailsDialog.record.basic_salary) : '—' },
                                    { label: isRTL ? 'بدل السكن' : 'Housing Allowance', value: detailsDialog.record.housing_allowance != null ? String(detailsDialog.record.housing_allowance) : '—' },
                                    { label: isRTL ? 'بدل النقل' : 'Transport Allowance', value: detailsDialog.record.transport_allowance != null ? String(detailsDialog.record.transport_allowance) : '—' },
                                    { label: isRTL ? 'بدلات أخرى' : 'Other Allowance', value: detailsDialog.record.other_allowance != null ? String(detailsDialog.record.other_allowance) : '—' },
                                    { label: isRTL ? 'مدة التجربة (أشهر)' : 'Probation (Months)', value: detailsDialog.record.probation_period_months != null ? String(detailsDialog.record.probation_period_months) : '—' },
                                    { label: isRTL ? 'مدة الإشعار (أيام)' : 'Notice Period (Days)', value: detailsDialog.record.notice_period_days != null ? String(detailsDialog.record.notice_period_days) : '—' },
                                    { label: isRTL ? 'الإجازة السنوية' : 'Annual Leave Days', value: detailsDialog.record.annual_leave_days != null ? String(detailsDialog.record.annual_leave_days) : '—' },
                                    { label: isRTL ? 'ساعات العمل يومياً' : 'Working Hours / Day', value: detailsDialog.record.working_hours_per_day != null ? String(detailsDialog.record.working_hours_per_day) : '—' },
                                ].map(({ label, value, valueNode }) => (
                                    <div key={label}>
                                        <p className="text-xs text-muted-foreground font-medium">{label}</p>
                                        {valueNode ?? <p className="font-semibold text-sm">{value}</p>}
                                    </div>
                                ))}
                            </div>

                            {detailsDialog.record.contract_terms && (
                                <div>
                                    <p className="text-xs text-muted-foreground font-medium mb-1">{isRTL ? 'بنود العقد' : 'Contract Terms'}</p>
                                    <div className="text-sm bg-muted/40 rounded-lg p-3 prose prose-sm max-w-none"
                                        dangerouslySetInnerHTML={{ __html: detailsDialog.record.contract_terms }} />
                                </div>
                            )}

                            {detailsDialog.record.contract_document && (
                                <div>
                                    <p className="text-xs text-muted-foreground font-medium mb-1">{isRTL ? 'وثيقة العقد' : 'Contract Document'}</p>
                                    <div className="flex items-center gap-2.5 px-3 py-2.5 border rounded-lg bg-card">
                                        <FileText className="w-4 h-4 text-muted-foreground/70 shrink-0" />
                                        <span className="text-sm text-foreground/90 flex-1 truncate">
                                            {detailsDialog.record.contract_document.split('/').pop()}
                                        </span>
                                        <a href={getFileViewUrl(detailsDialog.record.contract_document)} target="_blank" rel="noopener noreferrer"
                                            className="text-xs text-primary font-medium shrink-0 hover:underline">
                                            {isRTL ? 'عرض' : 'View'}
                                        </a>
                                    </div>
                                </div>
                            )}

                            <div className="pt-2 border-t">
                                <Button aria-label="تعديل" title="تعديل" variant="outline" size="sm"
                                    onClick={() => {
                                        const rec = detailsDialog.record!
                                        setDetailsDialog({ open: false, record: null })
                                        openEdit(rec)
                                    }}>
                                    <Pencil className="w-4 h-4 mr-2" />
                                    {isRTL ? 'تعديل' : 'Edit'}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
