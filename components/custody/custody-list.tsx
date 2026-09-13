'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
    Search, RefreshCw, Plus, Loader2, Eye, Package,
    Smartphone, CreditCard, Monitor, Tablet, ShoppingBag,
    Key, Truck, Wrench, ArrowRightLeft, Paperclip,
    Image as ImageIcon, FileText, Grid3X3, PlayCircle, Volume2, Video,
    Upload, X, Camera,
} from 'lucide-react'
import { csrfFetch } from '@/lib/csrf'
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
import { useToast } from '@/hooks/use-toast'
import { useI18n } from '@/lib/i18n'
import { formatDateShort } from '@/lib/format'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CustodyRecord {
    name: string
    employee: string
    employee_name: string
    branch: string
    item_category: string
    item_name: string
    serial_no: string
    description: string
    item_image: string
    status: string
    assigned_date: string
    return_date: string
    assigned_by: string
    notes: string
    attachments?: CustodyAttachment[]
}

interface CustodyAttachment {
    name: string
    file: string
    file_name: string
    file_type: string
    description: string
}

interface PendingAttachment {
    file_url: string
    file_name: string
    file_type: string
    description: string
}

interface EmployeeOption {
    name: string
    employee_name: string
    branch: string
}

// ---------------------------------------------------------------------------
// Lookup maps
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<string, React.ElementType> = {
    'Phone': Smartphone,
    'SIM Card': CreditCard,
    'Laptop': Monitor,
    'Tablet': Tablet,
    'Uniform': ShoppingBag,
    'Keys': Key,
    'Vehicle': Truck,
    'Tools': Wrench,
}

const STATUS_STYLES: Record<string, string> = {
    'Pending Acknowledgement': 'bg-amber-100 text-amber-800',
    'Active': 'bg-green-100 text-green-800',
    'Returned': 'bg-slate-100 text-slate-600',
    'Damaged': 'bg-red-100 text-red-800',
    'Lost': 'bg-red-200 text-red-900',
}

const FILE_TYPE_ICONS: Record<string, React.ElementType> = {
    'Image': ImageIcon,
    'PDF': FileText,
    'Word': FileText,
    'Excel': Grid3X3,
    'PowerPoint': PlayCircle,
    'Audio': Volume2,
    'Video': Video,
}

const CATEGORIES = [
    'Phone', 'SIM Card', 'Laptop', 'Tablet',
    'Uniform', 'Keys', 'Vehicle', 'Tools', 'Other',
]

const STATUSES = [
    'Pending Acknowledgement', 'Active', 'Returned', 'Damaged', 'Lost',
]

// Display-only Arabic labels. Backend values stay the English keys above.
const CATEGORY_AR: Record<string, string> = {
    'Phone': 'هاتف',
    'SIM Card': 'شريحة اتصال',
    'Laptop': 'لابتوب',
    'Tablet': 'تابلت',
    'Uniform': 'زي رسمي',
    'Keys': 'مفاتيح',
    'Vehicle': 'مركبة',
    'Tools': 'أدوات',
    'Other': 'أخرى',
}

const STATUS_AR: Record<string, string> = {
    'Pending Acknowledgement': 'بانتظار الاستلام',
    'Active': 'فعّال',
    'Returned': 'مُسترجع',
    'Damaged': 'تالف',
    'Lost': 'مفقود',
}

// ---------------------------------------------------------------------------
// Upload helpers
// ---------------------------------------------------------------------------

async function uploadFileToFrappe(file: File): Promise<string> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('is_private', '0')
    formData.append('folder', 'Home/Attachments')

    // Use the /api/frappe generic proxy (matches the pattern used by all other
    // upload-enabled components in this codebase). The direct /api/upload_file
    // route is intercepted by the reverse proxy and forwarded to Frappe, which
    // doesn't expose that path — it expects /api/method/upload_file.
    const res = await csrfFetch(
        frappeApiUrl('/api/method/upload_file'),
        { method: 'POST', credentials: 'include', body: formData }
    )

    if (!res.ok) {
        if (res.status === 413) throw new Error('File is too large.')
        if (res.status === 403) throw new Error('Authentication error — please re-login.')
        throw new Error(`Upload failed (${res.status})`)
    }

    const data = await res.json()
    const url = data.message?.file_url || data.file_url
    if (!url) throw new Error('Upload succeeded but no file URL returned.')
    return url as string
}

function detectFileType(file: File): string {
    const t = file.type
    if (t.startsWith('image/')) return 'Image'
    if (t === 'application/pdf') return 'PDF'
    if (t.includes('word') || t.includes('document') || file.name.match(/\.docx?$/i)) return 'Word'
    if (t.includes('sheet') || t.includes('excel') || file.name.match(/\.xlsx?$/i)) return 'Excel'
    if (t.includes('presentation') || t.includes('powerpoint') || file.name.match(/\.pptx?$/i)) return 'PowerPoint'
    if (t.startsWith('audio/')) return 'Audio'
    if (t.startsWith('video/')) return 'Video'
    return 'Other'
}

function getFileViewUrl(fileUrl: string): string {
    if (!fileUrl) return ''
    if (fileUrl.startsWith('http')) return fileUrl
    return frappeImageUrl(fileUrl) || fileUrl
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CustodyList() {
    const [records, setRecords] = useState<CustodyRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [categoryFilter, setCategoryFilter] = useState('all')

    // Create dialog
    const [createOpen, setCreateOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [employees, setEmployees] = useState<EmployeeOption[]>([])
    const [employeeSearch, setEmployeeSearch] = useState('')
    const [form, setForm] = useState({
        employee: '',
        item_category: '',
        item_name: '',
        serial_no: '',
        description: '',
        status: 'Pending Acknowledgement',
        assigned_date: new Date().toISOString().split('T')[0],
        notes: '',
        item_image: '',
    })
    const [imagePreview, setImagePreview] = useState('')
    const [uploadingImage, setUploadingImage] = useState(false)
    const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([])
    const [uploadingFiles, setUploadingFiles] = useState(false)
    const imageInputRef = useRef<HTMLInputElement>(null)
    const filesInputRef = useRef<HTMLInputElement>(null)

    // Status update dialog
    const [statusDialog, setStatusDialog] = useState<{
        open: boolean; record: CustodyRecord | null; newStatus: string
    }>({ open: false, record: null, newStatus: '' })
    const [updatingStatus, setUpdatingStatus] = useState(false)

    // Details dialog
    const [detailsDialog, setDetailsDialog] = useState<{
        open: boolean; record: CustodyRecord | null
    }>({ open: false, record: null })
    const [loadingDetails, setLoadingDetails] = useState(false)
    const [addingAttachment, setAddingAttachment] = useState(false)
    const detailsFilesRef = useRef<HTMLInputElement>(null)

    const { toast } = useToast()
    const { isRTL } = useI18n()

    // Bilingual helper for custody-specific messages
    const msg = (en: string, ar: string) => isRTL ? ar : en

    // ---------------------------------------------------------------------------
    // Data loading
    // ---------------------------------------------------------------------------

    const loadRecords = useCallback(async (showRefresh = false) => {
        try {
            if (showRefresh) setRefreshing(true)
            else setLoading(true)

            const data = await frappeClient.getList<CustodyRecord>('Employee Custody', {
                fields: [
                    'name', 'employee', 'employee_name', 'branch',
                    'item_category', 'item_name', 'serial_no', 'item_image',
                    'status', 'assigned_date', 'return_date', 'assigned_by', 'description',
                ],
                order_by: 'assigned_date desc',
                limit_page_length: 500,
            })
            setRecords(data)
        } catch (error) {
            console.error('Failed to load custody records:', error)
            toast({ title: msg('Error', 'خطأ'), description: msg('Failed to load custody records.', 'فشل تحميل سجلات العهد.'), variant: 'destructive' })
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [toast])

    const loadEmployees = useCallback(async () => {
        try {
            const data = await frappeClient.getList<EmployeeOption>('Employee', {
                fields: ['name', 'employee_name', 'branch'],
                filters: [['status', '=', 'Active'] as any],
                order_by: 'employee_name asc',
                limit_page_length: 500,
            })
            setEmployees(data)
        } catch (error) {
            console.error('Failed to load employees:', error)
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
                r.item_name?.toLowerCase().includes(q) ||
                r.serial_no?.toLowerCase().includes(q)
            )
        }
        if (statusFilter !== 'all') filtered = filtered.filter(r => r.status === statusFilter)
        if (categoryFilter !== 'all') filtered = filtered.filter(r => r.item_category === categoryFilter)
        return filtered
    }, [records, searchQuery, statusFilter, categoryFilter])

    const stats = useMemo(() => ({
        total: records.length,
        active: records.filter(r => r.status === 'Active').length,
        pending: records.filter(r => r.status === 'Pending Acknowledgement').length,
        damaged: records.filter(r => r.status === 'Damaged').length,
    }), [records])

    // ---------------------------------------------------------------------------
    // Image upload (create dialog)
    // ---------------------------------------------------------------------------

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith('image/')) {
            toast({ title: msg('Invalid file', 'ملف غير صالح'), description: msg('Please select an image file.', 'يرجى اختيار ملف صورة.'), variant: 'destructive' })
            return
        }
        if (file.size > 5 * 1024 * 1024) {
            toast({ title: msg('File too large', 'الملف كبير جداً'), description: msg('Image must be under 5 MB.', 'يجب أن تكون الصورة أقل من 5 ميغابايت.'), variant: 'destructive' })
            return
        }

        // Immediate local preview
        const reader = new FileReader()
        reader.onloadend = () => setImagePreview(reader.result as string)
        reader.readAsDataURL(file)

        setUploadingImage(true)
        try {
            const url = await uploadFileToFrappe(file)
            setForm(f => ({ ...f, item_image: url }))
        } catch (err: any) {
            toast({ title: msg('Upload failed', 'فشل الرفع'), description: err.message, variant: 'destructive' })
            setImagePreview('')
        } finally {
            setUploadingImage(false)
            if (imageInputRef.current) imageInputRef.current.value = ''
        }
    }

    // ---------------------------------------------------------------------------
    // Multi-file attachment upload (create dialog)
    // ---------------------------------------------------------------------------

    const handleFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        if (!files.length) return
        if (filesInputRef.current) filesInputRef.current.value = ''

        setUploadingFiles(true)
        const results: PendingAttachment[] = []
        for (const file of files) {
            try {
                const url = await uploadFileToFrappe(file)
                results.push({
                    file_url: url,
                    file_name: file.name,
                    file_type: detectFileType(file),
                    description: '',
                })
            } catch (err: any) {
                toast({ title: `${msg('Failed', 'فشل')}: ${file.name}`, description: err.message, variant: 'destructive' })
            }
        }
        setPendingAttachments(prev => [...prev, ...results])
        setUploadingFiles(false)
    }

    const removePendingAttachment = (idx: number) => {
        setPendingAttachments(prev => prev.filter((_, i) => i !== idx))
    }

    // ---------------------------------------------------------------------------
    // Create new record
    // ---------------------------------------------------------------------------

    const openCreate = async () => {
        setForm({
            employee: '', item_category: '', item_name: '', serial_no: '',
            description: '', status: 'Pending Acknowledgement',
            assigned_date: new Date().toISOString().split('T')[0],
            notes: '', item_image: '',
        })
        setImagePreview('')
        setPendingAttachments([])
        setEmployeeSearch('')
        setCreateOpen(true)
        if (employees.length === 0) await loadEmployees()
    }

    const handleCreate = async () => {
        if (!form.employee || !form.item_category || !form.item_name) {
            toast({ title: msg('Validation', 'تحقق'), description: msg('Employee, category, and item name are required.', 'الموظف والفئة واسم العنصر مطلوبة.'), variant: 'destructive' })
            return
        }
        setSaving(true)
        try {
            const payload: any = { ...form }
            if (pendingAttachments.length > 0) {
                payload.attachments = pendingAttachments.map(a => ({
                    file: a.file_url,
                    file_name: a.file_name,
                    file_type: a.file_type,
                    description: a.description,
                }))
            }
            await frappeClient.post('Employee Custody', payload)
            const empName = employees.find(e => e.name === form.employee)?.employee_name || form.employee
            toast({ title: msg('Success', 'تم'), description: msg(`Custody item assigned to ${empName}.`, `تم تسليم العهدة إلى ${empName}.`) })
            setCreateOpen(false)
            await loadRecords(true)
        } catch (error: any) {
            console.error('Failed to create custody record:', error)
            toast({ title: msg('Error', 'خطأ'), description: error?.message || msg('Failed to assign custody item.', 'فشل تسليم العهدة.'), variant: 'destructive' })
        } finally {
            setSaving(false)
        }
    }

    // ---------------------------------------------------------------------------
    // Status update
    // ---------------------------------------------------------------------------

    const handleStatusUpdate = async () => {
        if (!statusDialog.record || statusDialog.newStatus === statusDialog.record.status) {
            setStatusDialog({ open: false, record: null, newStatus: '' })
            return
        }
        setUpdatingStatus(true)
        try {
            await frappeClient.put('Employee Custody', statusDialog.record.name, { status: statusDialog.newStatus } as any)
            toast({ title: msg('Success', 'تم'), description: msg(`Status updated to ${statusDialog.newStatus}.`, `تم تحديث الحالة إلى ${statusDialog.newStatus}.`) })
            setStatusDialog({ open: false, record: null, newStatus: '' })
            await loadRecords(true)
        } catch (error: any) {
            toast({ title: msg('Error', 'خطأ'), description: error?.message || msg('Failed to update status.', 'فشل تحديث الحالة.'), variant: 'destructive' })
        } finally {
            setUpdatingStatus(false)
        }
    }

    // ---------------------------------------------------------------------------
    // View details (with attachments)
    // ---------------------------------------------------------------------------

    const openDetails = async (record: CustodyRecord) => {
        setDetailsDialog({ open: true, record })
        if (!record.attachments) {
            setLoadingDetails(true)
            try {
                const res = await frappeClient.call<CustodyRecord[]>(
                    'base_meena.employee_custody_api.get_custody_items',
                    { employee: record.employee }
                )
                const full = (res?.message || []).find(r => r.name === record.name)
                if (full) {
                    setDetailsDialog({ open: true, record: full })
                    setRecords(prev => prev.map(r => r.name === full.name ? { ...r, attachments: full.attachments } : r))
                }
            } catch (err) {
                console.error('Failed to load details:', err)
            } finally {
                setLoadingDetails(false)
            }
        }
    }

    // ---------------------------------------------------------------------------
    // Add attachment to existing record (details dialog)
    // ---------------------------------------------------------------------------

    const handleAddAttachmentsToExisting = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        if (!files.length || !detailsDialog.record) return
        if (detailsFilesRef.current) detailsFilesRef.current.value = ''

        setAddingAttachment(true)
        for (const file of files) {
            try {
                const url = await uploadFileToFrappe(file)
                const res = await frappeClient.call<{ name: string; attachments: CustodyAttachment[] }>(
                    'base_meena.employee_custody_api.add_attachment',
                    {
                        custody_id: detailsDialog.record.name,
                        file_url: url,
                        file_name: file.name,
                        file_type: detectFileType(file),
                    }
                )
                const updated = res?.message
                if (updated) {
                    setDetailsDialog(d => d.record ? { ...d, record: { ...d.record, attachments: updated.attachments } } : d)
                    setRecords(prev => prev.map(r => r.name === updated.name ? { ...r, attachments: updated.attachments } : r))
                }
            } catch (err: any) {
                toast({ title: `${msg('Failed', 'فشل')}: ${file.name}`, description: err.message, variant: 'destructive' })
            }
        }
        setAddingAttachment(false)
    }

    // ---------------------------------------------------------------------------
    // Filtered employee list for create dialog
    // ---------------------------------------------------------------------------

    const filteredEmployees = useMemo(() => {
        if (!employeeSearch) return employees.slice(0, 50)
        const q = employeeSearch.toLowerCase()
        return employees.filter(e =>
            e.employee_name?.toLowerCase().includes(q) ||
            e.name?.toLowerCase().includes(q)
        ).slice(0, 50)
    }, [employees, employeeSearch])

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
                        {isRTL ? 'عهد الموظفين' : 'Employee Custody'}
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {isRTL ? 'إدارة العهد والمقتنيات الموزعة على الموظفين' : 'Manage items assigned to employees'}
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <Button aria-label="تحديث" title="تحديث" variant="outline" size="sm" onClick={() => loadRecords(true)} disabled={refreshing}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        {isRTL ? 'تحديث' : 'Refresh'}
                    </Button>
                    <Button aria-label="إضافة" title="إضافة" size="sm" onClick={openCreate}>
                        <Plus className="w-4 h-4 mr-2" />
                        {isRTL ? 'إضافة عهدة' : 'Assign Item'}
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: isRTL ? 'الإجمالي' : 'Total Items', value: stats.total, color: 'text-primary', bg: 'bg-accent', icon: 'text-primary' },
                    { label: isRTL ? 'فعّال' : 'Active', value: stats.active, color: 'text-green-700', bg: 'bg-green-50', icon: 'text-green-600' },
                    { label: isRTL ? 'بانتظار الاستلام' : 'Pending', value: stats.pending, color: 'text-amber-700', bg: 'bg-amber-50', icon: 'text-amber-600' },
                    { label: isRTL ? 'تالف' : 'Damaged', value: stats.damaged, color: 'text-red-700', bg: 'bg-red-50', icon: 'text-red-600' },
                ].map(({ label, value, color, bg, icon }) => (
                    <Card key={label}>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 ${bg} rounded-lg`}><Package className={`h-5 w-5 ${icon}`} /></div>
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
                                placeholder={isRTL ? 'بحث...' : 'Search employee or item...'}
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
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger aria-label={isRTL ? 'كل الفئات' : 'All categories'}>
                                <SelectValue placeholder={isRTL ? 'كل الفئات' : 'All categories'} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{isRTL ? 'كل الفئات' : 'All categories'}</SelectItem>
                                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{isRTL ? (CATEGORY_AR[c] || c) : c}</SelectItem>)}
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
                                <TableHead>{isRTL ? 'الفرع' : 'Branch'}</TableHead>
                                <TableHead>{isRTL ? 'الفئة' : 'Category'}</TableHead>
                                <TableHead>{isRTL ? 'اسم الصنف' : 'Item'}</TableHead>
                                <TableHead>{isRTL ? 'الرقم التسلسلي' : 'Serial No'}</TableHead>
                                <TableHead>{isRTL ? 'تاريخ التسليم' : 'Assigned'}</TableHead>
                                <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                                <TableHead className="text-right">{isRTL ? 'الإجراءات' : 'Actions'}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredRecords.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                                        <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                                        <p className="font-medium">
                                            {records.length === 0
                                                ? (isRTL ? 'لا توجد عهد مسجلة' : 'No custody records found')
                                                : (isRTL ? 'لا توجد نتائج مطابقة' : 'No matching records')
                                            }
                                        </p>
                                    </TableCell>
                                </TableRow>
                            ) : filteredRecords.map(record => {
                                const CategoryIcon = CATEGORY_ICONS[record.item_category] ?? Package
                                const imageUrl = record.item_image ? getFileViewUrl(record.item_image) : null
                                return (
                                    <TableRow key={record.name} className="hover:bg-accent/50">
                                        <TableCell>
                                            <div className="font-medium">{record.employee_name || record.employee}</div>
                                            <div className="text-xs text-muted-foreground">{record.employee}</div>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{record.branch || '—'}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <CategoryIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                                <span className="text-sm">{isRTL ? (CATEGORY_AR[record.item_category] || record.item_category) : record.item_category}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {imageUrl && (
                                                    <div className="w-8 h-8 rounded-md overflow-hidden bg-muted shrink-0">
                                                        <img src={imageUrl} alt={record.item_name}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                                                    </div>
                                                )}
                                                <span className="font-medium text-sm">{record.item_name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm font-mono text-muted-foreground">{record.serial_no || '—'}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground tabular-nums">{formatDateShort(record.assigned_date) || '—'}</TableCell>
                                        <TableCell>
                                            <Badge className={`text-xs ${STATUS_STYLES[record.status] ?? 'bg-muted text-foreground/90'}`}>
                                                {isRTL ? (STATUS_AR[record.status] || record.status) : record.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button aria-label="عرض" title="عرض" variant="ghost" size="sm" className="h-8 px-2" onClick={() => openDetails(record)}>
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                <Button aria-label="تغيير الحالة" title="تغيير الحالة" variant="ghost" size="sm" className="h-8 px-2"
                                                    onClick={() => setStatusDialog({ open: true, record, newStatus: record.status })}>
                                                    <ArrowRightLeft className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                    {filteredRecords.length > 0 && (
                        <div className="px-6 py-3 border-t text-sm text-muted-foreground">
                            {isRTL
                                ? `عرض ${filteredRecords.length} من أصل ${records.length} سجل`
                                : `Showing ${filteredRecords.length} of ${records.length} records`}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ================================================================ */}
            {/* CREATE DIALOG                                                      */}
            {/* ================================================================ */}
            <Dialog open={createOpen} onOpenChange={(open) => !open && setCreateOpen(false)}>
                <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{isRTL ? 'تسليم عهدة جديدة' : 'Assign Custody Item'}</DialogTitle>
                        <DialogDescription>
                            {isRTL ? 'أضف صنفًا جديدًا للموظف' : 'Assign a new item to an employee'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 pt-2">
                        {/* ---- Item Image ---- */}
                        <div className="space-y-1.5">
                            <Label>{isRTL ? 'صورة الصنف' : 'Item Image'}</Label>
                            <input
                                ref={imageInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleImageSelect}
                            />
                            <div
                                onClick={() => imageInputRef.current?.click()}
                                className="relative w-full h-36 rounded-xl border-2 border-dashed border-border bg-muted/40
                                           flex flex-col items-center justify-center gap-2 cursor-pointer
                                           hover:border-primary/40 hover:bg-accent transition-colors overflow-hidden"
                            >
                                {uploadingImage ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                        <p className="text-sm text-muted-foreground">{isRTL ? 'جاري الرفع...' : 'Uploading...'}</p>
                                    </div>
                                ) : imagePreview ? (
                                    <>
                                        <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity
                                                        flex items-center justify-center">
                                            <div className="flex flex-col items-center gap-1 text-white">
                                                <Camera className="w-6 h-6" />
                                                <p className="text-xs">{isRTL ? 'تغيير الصورة' : 'Change image'}</p>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-7 h-7 text-muted-foreground/70" />
                                        <p className="text-sm text-muted-foreground">
                                            {isRTL ? 'انقر لرفع صورة الصنف' : 'Click to upload item image'}
                                        </p>
                                        <p className="text-xs text-muted-foreground/70">PNG, JPG, WEBP — max 5 MB</p>
                                    </>
                                )}
                            </div>
                            {form.item_image && !uploadingImage && (
                                <button
                                    type="button"
                                    onClick={() => { setForm(f => ({ ...f, item_image: '' })); setImagePreview('') }}
                                    className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                                >
                                    <X className="w-3 h-3" /> {isRTL ? 'إزالة الصورة' : 'Remove image'}
                                </button>
                            )}
                        </div>

                        {/* ---- Employee ---- */}
                        <div className="space-y-1.5">
                            <Label>{isRTL ? 'الموظف *' : 'Employee *'}</Label>
                            <Input
                                placeholder={isRTL ? 'ابحث باسم الموظف...' : 'Search employee...'}
                                value={employeeSearch}
                                onChange={(e) => { setEmployeeSearch(e.target.value); setForm(f => ({ ...f, employee: '' })) }}
                            />
                            {employeeSearch && !form.employee && filteredEmployees.length > 0 && (
                                <div className="border rounded-md bg-card shadow-sm max-h-40 overflow-y-auto">
                                    {filteredEmployees.map(emp => (
                                        <button key={emp.name}
                                            className="w-full text-start px-3 py-2 hover:bg-accent/50 text-sm border-b last:border-b-0"
                                            onClick={() => { setForm(f => ({ ...f, employee: emp.name })); setEmployeeSearch(emp.employee_name) }}
                                        >
                                            <span className="font-medium">{emp.employee_name}</span>
                                            <span className="text-muted-foreground ml-2 text-xs">{emp.name}</span>
                                            {emp.branch && <span className="text-muted-foreground/70 ml-1 text-xs">· {emp.branch}</span>}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {form.employee && (
                                <p className="text-xs text-green-600">✓ {isRTL ? 'تم الاختيار: ' : 'Selected: '}{form.employee}</p>
                            )}
                        </div>

                        {/* ---- Category & Item ---- */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>{isRTL ? 'الفئة *' : 'Category *'}</Label>
                                <Select value={form.item_category} onValueChange={(v) => setForm(f => ({ ...f, item_category: v }))}>
                                    <SelectTrigger aria-label={isRTL ? 'اختر' : 'Select'}><SelectValue placeholder={isRTL ? 'اختر' : 'Select'} /></SelectTrigger>
                                    <SelectContent>
                                        {CATEGORIES.map(c => <SelectItem key={c} value={c}>{isRTL ? (CATEGORY_AR[c] || c) : c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>{isRTL ? 'اسم الصنف *' : 'Item Name *'}</Label>
                                <Input
                                    placeholder={isRTL ? 'مثال: iPhone 14' : 'e.g. iPhone 14'}
                                    value={form.item_name}
                                    onChange={(e) => setForm(f => ({ ...f, item_name: e.target.value }))}
                                />
                            </div>
                        </div>

                        {/* ---- Serial No & Date ---- */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>{isRTL ? 'الرقم التسلسلي' : 'Serial No'}</Label>
                                <Input
                                    placeholder={isRTL ? 'اختياري' : 'Optional'}
                                    value={form.serial_no}
                                    onChange={(e) => setForm(f => ({ ...f, serial_no: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>{isRTL ? 'تاريخ التسليم *' : 'Assigned Date *'}</Label>
                                <Input type="date" value={form.assigned_date}
                                    onChange={(e) => setForm(f => ({ ...f, assigned_date: e.target.value }))} />
                            </div>
                        </div>

                        {/* ---- Status ---- */}
                        <div className="space-y-1.5">
                            <Label>{isRTL ? 'الحالة' : 'Status'}</Label>
                            <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {STATUSES.map(s => <SelectItem key={s} value={s}>{isRTL ? (STATUS_AR[s] || s) : s}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* ---- Description & Notes ---- */}
                        <div className="space-y-1.5">
                            <Label>{isRTL ? 'الوصف' : 'Description'}</Label>
                            <Textarea placeholder={isRTL ? 'اختياري' : 'Optional'} rows={2}
                                value={form.description}
                                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>{isRTL ? 'ملاحظات' : 'Notes'}</Label>
                            <Textarea placeholder={isRTL ? 'اختياري' : 'Optional'} rows={2}
                                value={form.notes}
                                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
                        </div>

                        {/* ---- Attachments ---- */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>{isRTL ? 'المرفقات' : 'Documents & Attachments'}</Label>
                                <div>
                                    <input
                                        ref={filesInputRef}
                                        type="file"
                                        multiple
                                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,audio/*,video/*"
                                        className="hidden"
                                        onChange={handleFilesSelect}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => filesInputRef.current?.click()}
                                        disabled={uploadingFiles}
                                    >
                                        {uploadingFiles ? (
                                            <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />{isRTL ? 'جاري الرفع...' : 'Uploading...'}</>
                                        ) : (
                                            <><Upload className="w-3.5 h-3.5 mr-1.5" />{isRTL ? 'إضافة ملفات' : 'Add files'}</>
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {pendingAttachments.length === 0 ? (
                                <div className="border-2 border-dashed border-border rounded-lg py-6 text-center">
                                    <Paperclip className="w-6 h-6 mx-auto mb-1 text-muted-foreground/40" />
                                    <p className="text-xs text-muted-foreground/70">
                                        {isRTL
                                            ? 'صور، PDF، Word، Excel، PowerPoint، صوتيات، مقاطع فيديو'
                                            : 'Images, PDF, Word, Excel, PowerPoint, audio, video'}
                                    </p>
                                </div>
                            ) : (
                                <div className="border rounded-lg overflow-hidden">
                                    {pendingAttachments.map((att, idx) => {
                                        const FileIcon = FILE_TYPE_ICONS[att.file_type] ?? Paperclip
                                        return (
                                            <div key={idx} className="flex items-center gap-2.5 px-3 py-2 bg-card hover:bg-accent/50 border-b last:border-b-0">
                                                <FileIcon className="w-4 h-4 text-muted-foreground/70 shrink-0" />
                                                <span className="text-sm text-foreground/90 flex-1 truncate">{att.file_name}</span>
                                                <Badge variant="outline" className="text-xs shrink-0">{att.file_type}</Badge>
                                                <button type="button" onClick={() => removePendingAttachment(idx)}
                                                    className="text-muted-foreground/70 hover:text-red-500 shrink-0">
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* ---- Submit ---- */}
                        <div className="flex gap-3 pt-2">
                            <Button className="flex-1" onClick={handleCreate}
                                disabled={saving || uploadingImage || uploadingFiles}>
                                {saving
                                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isRTL ? 'جاري الحفظ...' : 'Saving...'}</>
                                    : (isRTL ? 'حفظ' : 'Save')
                                }
                            </Button>
                            <Button variant="outline" className="flex-1"
                                onClick={() => setCreateOpen(false)}
                                disabled={saving || uploadingImage || uploadingFiles}>
                                {isRTL ? 'إلغاء' : 'Cancel'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ================================================================ */}
            {/* STATUS UPDATE DIALOG                                               */}
            {/* ================================================================ */}
            <Dialog open={statusDialog.open} onOpenChange={(open) => !open && setStatusDialog({ open: false, record: null, newStatus: '' })}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{isRTL ? 'تغيير الحالة' : 'Change Status'}</DialogTitle>
                        <DialogDescription>
                            {statusDialog.record?.item_name} — {statusDialog.record?.employee_name}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <Select value={statusDialog.newStatus} onValueChange={(v) => setStatusDialog(d => ({ ...d, newStatus: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {STATUSES.map(s => <SelectItem key={s} value={s}>{isRTL ? (STATUS_AR[s] || s) : s}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <div className="flex gap-3">
                            <Button className="flex-1" onClick={handleStatusUpdate} disabled={updatingStatus}>
                                {updatingStatus
                                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isRTL ? 'جاري الحفظ...' : 'Saving...'}</>
                                    : (isRTL ? 'حفظ' : 'Save')}
                            </Button>
                            <Button variant="outline" className="flex-1"
                                onClick={() => setStatusDialog({ open: false, record: null, newStatus: '' })}
                                disabled={updatingStatus}>
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
                        <DialogTitle>{isRTL ? 'تفاصيل العهدة' : 'Custody Details'}</DialogTitle>
                    </DialogHeader>
                    {detailsDialog.record && (
                        <div className="space-y-5">
                            {/* Item image */}
                            {detailsDialog.record.item_image && (
                                <div className="flex justify-center">
                                    <img src={getFileViewUrl(detailsDialog.record.item_image)}
                                        alt={detailsDialog.record.item_name}
                                        className="w-36 h-36 rounded-xl object-cover border border-border"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                                </div>
                            )}

                            {/* Info grid */}
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { label: isRTL ? 'الموظف' : 'Employee', valueNode: (<><p className="font-semibold">{detailsDialog.record.employee_name}</p><p className="text-xs text-muted-foreground">{detailsDialog.record.employee}</p></>) },
                                    { label: isRTL ? 'الفرع' : 'Branch', value: detailsDialog.record.branch || '—' },
                                    { label: isRTL ? 'الفئة' : 'Category', value: isRTL ? (CATEGORY_AR[detailsDialog.record.item_category] || detailsDialog.record.item_category) : detailsDialog.record.item_category },
                                    { label: isRTL ? 'الصنف' : 'Item', value: detailsDialog.record.item_name },
                                    ...(detailsDialog.record.serial_no ? [{ label: isRTL ? 'الرقم التسلسلي' : 'Serial No', value: detailsDialog.record.serial_no }] : []),
                                    { label: isRTL ? 'الحالة' : 'Status', valueNode: (<Badge className={`text-xs mt-0.5 ${STATUS_STYLES[detailsDialog.record.status] ?? 'bg-muted text-foreground/90'}`}>{isRTL ? (STATUS_AR[detailsDialog.record.status] || detailsDialog.record.status) : detailsDialog.record.status}</Badge>) },
                                    { label: isRTL ? 'تاريخ التسليم' : 'Assigned Date', value: formatDateShort(detailsDialog.record.assigned_date) || '—' },
                                    ...(detailsDialog.record.return_date ? [{ label: isRTL ? 'تاريخ الاسترداد' : 'Return Date', value: formatDateShort(detailsDialog.record.return_date) }] : []),
                                ].map(({ label, value, valueNode }) => (
                                    <div key={label}>
                                        <p className="text-xs text-muted-foreground font-medium">{label}</p>
                                        {valueNode ?? <p className="font-semibold text-sm">{value}</p>}
                                    </div>
                                ))}
                            </div>

                            {detailsDialog.record.description && (
                                <div>
                                    <p className="text-xs text-muted-foreground font-medium mb-1">{isRTL ? 'الوصف' : 'Description'}</p>
                                    <p className="text-sm bg-muted/40 rounded-lg p-3">{detailsDialog.record.description}</p>
                                </div>
                            )}
                            {detailsDialog.record.notes && (
                                <div>
                                    <p className="text-xs text-muted-foreground font-medium mb-1">{isRTL ? 'ملاحظات' : 'Notes'}</p>
                                    <p className="text-sm bg-muted/40 rounded-lg p-3">{detailsDialog.record.notes}</p>
                                </div>
                            )}

                            {/* Attachments */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs text-muted-foreground font-medium">
                                        {isRTL ? 'المرفقات' : 'Attachments'}
                                        {detailsDialog.record.attachments && detailsDialog.record.attachments.length > 0
                                            ? ` (${detailsDialog.record.attachments.length})`
                                            : ''}
                                    </p>
                                    <div>
                                        <input
                                            ref={detailsFilesRef}
                                            type="file"
                                            multiple
                                            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,audio/*,video/*"
                                            className="hidden"
                                            onChange={handleAddAttachmentsToExisting}
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => detailsFilesRef.current?.click()}
                                            disabled={addingAttachment}
                                        >
                                            {addingAttachment
                                                ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />{isRTL ? 'جاري الرفع...' : 'Uploading...'}</>
                                                : <><Upload className="w-3.5 h-3.5 mr-1.5" />{isRTL ? 'إضافة مرفق' : 'Add files'}</>
                                            }
                                        </Button>
                                    </div>
                                </div>

                                {loadingDetails ? (
                                    <div className="flex items-center gap-2 py-3">
                                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                        <span className="text-sm text-muted-foreground">{isRTL ? 'جاري التحميل...' : 'Loading...'}</span>
                                    </div>
                                ) : !detailsDialog.record.attachments || detailsDialog.record.attachments.length === 0 ? (
                                    <div className="border-2 border-dashed border-border rounded-lg py-6 text-center">
                                        <Paperclip className="w-6 h-6 mx-auto mb-1 text-muted-foreground/40" />
                                        <p className="text-sm text-muted-foreground/70">{isRTL ? 'لا توجد مرفقات' : 'No attachments yet'}</p>
                                    </div>
                                ) : (
                                    <div className="border rounded-lg overflow-hidden">
                                        {detailsDialog.record.attachments.map(att => {
                                            const FileIcon = FILE_TYPE_ICONS[att.file_type] ?? Paperclip
                                            return (
                                                <div key={att.name} className="flex items-center gap-3 px-3 py-2.5 bg-card hover:bg-accent/50 border-b last:border-b-0">
                                                    <FileIcon className="w-4 h-4 text-muted-foreground/70 shrink-0" />
                                                    <span className="text-sm text-foreground/90 flex-1 truncate">{att.file_name || att.file}</span>
                                                    {att.file_type && <Badge variant="outline" className="text-xs shrink-0">{att.file_type}</Badge>}
                                                    <a href={getFileViewUrl(att.file)} target="_blank" rel="noopener noreferrer"
                                                        className="text-xs text-primary font-medium shrink-0 hover:underline">
                                                        {isRTL ? 'عرض' : 'View'}
                                                    </a>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Quick status change */}
                            <div className="pt-2 border-t">
                                <Button aria-label="تغيير الحالة" title="تغيير الحالة" variant="outline" size="sm"
                                    onClick={() => {
                                        setDetailsDialog({ open: false, record: null })
                                        setStatusDialog({ open: true, record: detailsDialog.record!, newStatus: detailsDialog.record!.status })
                                    }}>
                                    <ArrowRightLeft className="w-4 h-4 mr-2" />
                                    {isRTL ? 'تغيير الحالة' : 'Change Status'}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
