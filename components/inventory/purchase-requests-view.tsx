'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useI18n } from '@/lib/i18n'
import { useCompany } from '@/hooks/use-company'
import { useToast } from '@/hooks/use-toast'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
    purchaseApi,
    type MaterialRequest,
    type MaterialRequestItem,
    type PurchaseItem,
} from '@/lib/purchase-api'
import { stockApi, type BinStock, type Warehouse } from '@/lib/stock-api'
import { printDoc } from '@/lib/print-doc'
import { useBrand } from '@/hooks/use-brand'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
    Search,
    Plus,
    RefreshCw,
    Loader2,
    X,
    Send,
    ClipboardList,
    AlertTriangle,
    Package,
    ArrowRight,
    Clock,
    CheckCircle2,
    XCircle,
    ShoppingCart,
    Trash2,
    Eye,
    ChevronDown,
    ChevronUp,
    FileText,
    TrendingDown,
    Printer,
} from 'lucide-react'

// ═══════════════════════════════════════════════
// Translations
// ═══════════════════════════════════════════════
const L = {
    en: {
        title: 'Purchase Requests',
        subtitle: 'Request items from the purchasing department',
        newRequest: 'New Request',
        searchPlaceholder: 'Search requests...',
        noRequests: 'No Purchase Requests',
        noRequestsDesc: 'Create a request to send to the purchasing department for stock replenishment.',
        requestDate: 'Request Date',
        requiredBy: 'Required By',
        items: 'Items',
        status: 'Status',
        actions: 'Actions',
        ordered: '% Ordered',
        submit: 'Submit',
        cancel: 'Cancel',
        delete: 'Delete',
        view: 'View Details',
        confirmSubmit: 'Submit this request to purchasing?',
        confirmDelete: 'Delete this draft request?',
        submitted: 'Request submitted successfully',
        deleted: 'Request deleted',
        error: 'An error occurred',
        // Form
        createRequest: 'Create Purchase Request',
        warehouse: 'Target Warehouse',
        scheduleDate: 'Required By Date',
        itemName: 'Item',
        quantity: 'Qty',
        uom: 'UOM',
        addItem: 'Add Item',
        creating: 'Creating...',
        createAndSubmit: 'Create & Submit',
        saveDraft: 'Save as Draft',
        created: 'Request created successfully',
        // Status
        draft: 'Draft',
        pending: 'Pending',
        partiallyOrdered: 'Partially Ordered',
        fullyOrdered: 'Ordered',
        transferred: 'Transferred',
        cancelled: 'Cancelled',
        // Low stock
        lowStockSuggestions: 'Low Stock Items',
        lowStockDesc: 'Items that may need restocking',
        currentStock: 'Current Stock',
        addToRequest: 'Add to Request',
        selectAll: 'Select All Low Stock',
        noLowStock: 'All items are well stocked',
        // Detail
        requestDetail: 'Request Details',
        requestNo: 'Request #',
        createdOn: 'Created',
        warehouse_label: 'Warehouse',
        itemCode: 'Item Code',
        rate: 'Rate',
        amount: 'Amount',
        totalItems: 'Total Items',
        // Filters
        all: 'All',
        filterByStatus: 'Filter by Status',
    },
    ar: {
        title: 'طلبات الشراء',
        subtitle: 'أرسل طلب للمشتريات لتوفير بضاعة',
        newRequest: 'طلب جديد',
        searchPlaceholder: 'بحث في الطلبات...',
        noRequests: 'لا توجد طلبات شراء',
        noRequestsDesc: 'أنشئ طلب شراء لإرساله لقسم المشتريات لتزويد المخزون.',
        requestDate: 'تاريخ الطلب',
        requiredBy: 'مطلوب بتاريخ',
        items: 'الأصناف',
        status: 'الحالة',
        actions: 'إجراءات',
        ordered: '% مطلوب',
        submit: 'إرسال',
        cancel: 'إلغاء',
        delete: 'حذف',
        view: 'عرض التفاصيل',
        confirmSubmit: 'إرسال هذا الطلب للمشتريات؟',
        confirmDelete: 'حذف هذا الطلب المسودة؟',
        submitted: 'تم إرسال الطلب بنجاح',
        deleted: 'تم حذف الطلب',
        error: 'حدث خطأ',
        // Form
        createRequest: 'إنشاء طلب شراء',
        warehouse: 'المستودع المستهدف',
        scheduleDate: 'تاريخ الاحتياج',
        itemName: 'الصنف',
        quantity: 'الكمية',
        uom: 'الوحدة',
        addItem: 'إضافة صنف',
        creating: 'جاري الإنشاء...',
        createAndSubmit: 'إنشاء وإرسال',
        saveDraft: 'حفظ كمسودة',
        created: 'تم إنشاء الطلب بنجاح',
        // Status
        draft: 'مسودة',
        pending: 'معلق',
        partiallyOrdered: 'طُلب جزئياً',
        fullyOrdered: 'تم الطلب',
        transferred: 'تم النقل',
        cancelled: 'ملغى',
        // Low stock
        lowStockSuggestions: 'أصناف مخزون منخفض',
        lowStockDesc: 'أصناف قد تحتاج إعادة تزويد',
        currentStock: 'المخزون الحالي',
        addToRequest: 'إضافة للطلب',
        selectAll: 'اختيار كل المنخفض',
        noLowStock: 'جميع الأصناف بمخزون كافي',
        // Detail
        requestDetail: 'تفاصيل الطلب',
        requestNo: 'طلب رقم',
        createdOn: 'تاريخ الإنشاء',
        warehouse_label: 'المستودع',
        itemCode: 'كود الصنف',
        rate: 'السعر',
        amount: 'المبلغ',
        totalItems: 'إجمالي الأصناف',
        // Filters
        all: 'الكل',
        filterByStatus: 'تصفية حسب الحالة',
    },
}

const LOW_STOCK_THRESHOLD = 10

function today() {
    return new Date().toISOString().slice(0, 10)
}

function formatDate(d?: string) {
    if (!d) return '—'
    try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return d }
}

function statusColor(status?: string): string {
    switch (status) {
        case 'Draft': return 'bg-gray-100 text-gray-600'
        case 'Pending': return 'bg-amber-100 text-amber-700'
        case 'Partially Ordered': return 'bg-blue-100 text-blue-700'
        case 'Ordered': return 'bg-emerald-100 text-emerald-700'
        case 'Transferred': return 'bg-purple-100 text-purple-700'
        case 'Cancelled': return 'bg-red-100 text-red-600'
        default: return 'bg-gray-100 text-gray-600'
    }
}

function statusLabel(status: string | undefined, lang: 'en' | 'ar'): string {
    const t = L[lang]
    switch (status) {
        case 'Draft': return t.draft
        case 'Pending': return t.pending
        case 'Partially Ordered': return t.partiallyOrdered
        case 'Ordered': return t.fullyOrdered
        case 'Transferred': return t.transferred
        case 'Cancelled': return t.cancelled
        default: return status || t.draft
    }
}

function statusIcon(status?: string) {
    switch (status) {
        case 'Draft': return <FileText className="w-3.5 h-3.5" />
        case 'Pending': return <Clock className="w-3.5 h-3.5" />
        case 'Partially Ordered': return <ShoppingCart className="w-3.5 h-3.5" />
        case 'Ordered': return <CheckCircle2 className="w-3.5 h-3.5" />
        case 'Cancelled': return <XCircle className="w-3.5 h-3.5" />
        default: return <FileText className="w-3.5 h-3.5" />
    }
}

// ═══════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════
export function PurchaseRequestsView() {
    const { isRTL, lang } = useI18n()
    const { company } = useCompany()
    const { toast } = useToast()
    const t = L[lang as 'en' | 'ar'] || L.en

    const [requests, setRequests] = useState<MaterialRequest[]>([])
    const [pendingAction, setPendingAction] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [showForm, setShowForm] = useState(false)
    const [detailMR, setDetailMR] = useState<MaterialRequest | null>(null)
    const [loadingDetail, setLoadingDetail] = useState(false)

    // Low stock data
    const [binStock, setBinStock] = useState<BinStock[]>([])

    const loadRequests = useCallback(async () => {
        setLoading(true)
        try {
            const r = await purchaseApi.getMaterialRequests({
                company: company || undefined,
                type: 'Purchase',
            })
            setRequests(r)
        } catch { /* */ }
        setLoading(false)
    }, [company])

    const loadBinStock = useCallback(async () => {
        try {
            const bins = await stockApi.getBinStock()
            setBinStock(bins)
        } catch { /* */ }
    }, [])

    useEffect(() => { loadRequests(); loadBinStock() }, [loadRequests, loadBinStock])

    // Compute low stock items
    const lowStockItems = useMemo(() => {
        const itemTotals: Record<string, { item_code: string; item_name?: string; total_qty: number; stock_uom?: string; warehouses: string[] }> = {}
        for (const b of binStock) {
            if (!itemTotals[b.item_code]) {
                itemTotals[b.item_code] = { item_code: b.item_code, item_name: b.item_name, total_qty: 0, stock_uom: b.stock_uom, warehouses: [] }
            }
            itemTotals[b.item_code].total_qty += b.actual_qty
            if (b.actual_qty > 0 && !itemTotals[b.item_code].warehouses.includes(b.warehouse)) {
                itemTotals[b.item_code].warehouses.push(b.warehouse)
            }
        }
        return Object.values(itemTotals)
            .filter(i => i.total_qty >= 0 && i.total_qty <= LOW_STOCK_THRESHOLD)
            .sort((a, b) => a.total_qty - b.total_qty)
    }, [binStock])

    const filtered = useMemo(() => {
        let result = requests
        if (statusFilter !== 'all') {
            result = result.filter(r => r.status === statusFilter)
        }
        if (search) {
            const q = search.toLowerCase()
            result = result.filter(r =>
                r.name?.toLowerCase().includes(q) ||
                r.title?.toLowerCase().includes(q)
            )
        }
        return result
    }, [requests, search, statusFilter])

    const handleSubmit = (name: string) => {
        setPendingAction({
            title: t.confirmSubmit,
            description: '',
            onConfirm: async () => {
                try {
                    await purchaseApi.submitMaterialRequest(name)
                    toast({ title: t.submitted, variant: 'default' })
                    loadRequests()
                } catch (e: any) {
                    toast({ title: e?.message || t.error, variant: 'destructive' })
                }
            },
        })
    }

    const handleDelete = (name: string) => {
        setPendingAction({
            title: t.confirmDelete,
            description: '',
            onConfirm: async () => {
                try {
                    await purchaseApi.cancelMaterialRequest(name)
                    toast({ title: t.deleted, variant: 'default' })
                    loadRequests()
                } catch (e: any) {
                    toast({ title: e?.message || t.error, variant: 'destructive' })
                }
            },
        })
    }

    const handleViewDetail = async (name: string) => {
        setLoadingDetail(true)
        try {
            const detail = await purchaseApi.getMaterialRequest(name)
            setDetailMR(detail)
        } catch { /* */ }
        setLoadingDetail(false)
    }

    const showToast = (msg: string, type: 'success' | 'error') => {
        toast({ title: msg, variant: type === 'error' ? 'destructive' : 'default' })
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        )
    }

    const statusCounts = {
        all: requests.length,
        Draft: requests.filter(r => r.docstatus === 0).length,
        Pending: requests.filter(r => r.status === 'Pending').length,
        'Partially Ordered': requests.filter(r => r.status === 'Partially Ordered').length,
        Ordered: requests.filter(r => r.status === 'Ordered').length,
    }

    return (
        <div className="p-6 space-y-6 max-w-[1400px] mx-auto" dir={isRTL ? 'rtl' : 'ltr'}>
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">{t.title}</h1>
                    <p className="text-sm text-gray-500 mt-0.5">{t.subtitle}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        onClick={() => setShowForm(true)}
                        className="bg-orange-600 hover:bg-orange-700 text-white gap-2"
                        size="sm"
                    >
                        <Plus className="w-4 h-4" /> {t.newRequest}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { loadRequests(); loadBinStock() }}>
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Status filter pills */}
            <div className="flex flex-wrap gap-2">
                {(['all', 'Draft', 'Pending', 'Partially Ordered', 'Ordered'] as const).map(s => (
                    <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={cn(
                            'px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                            statusFilter === s
                                ? 'bg-orange-600 text-white border-orange-600'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        )}
                    >
                        {s === 'all' ? t.all : statusLabel(s, lang as 'en' | 'ar')}
                        <span className="ms-1.5 opacity-70">({statusCounts[s] || 0})</span>
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    className="w-full ps-10 pe-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
                    placeholder={t.searchPlaceholder}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* Low Stock Suggestions */}
            {lowStockItems.length > 0 && !showForm && (
                <LowStockBanner
                    items={lowStockItems}
                    lang={lang as 'en' | 'ar'}
                    isRTL={isRTL}
                    onCreateRequest={(items) => setShowForm(true)}
                />
            )}

            {/* Request list */}
            {filtered.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border">
                    <ClipboardList className="w-14 h-14 mx-auto text-orange-200 mb-3" />
                    <h3 className="font-semibold text-gray-600 mb-1">{t.noRequests}</h3>
                    <p className="text-sm text-gray-400 max-w-sm mx-auto">{t.noRequestsDesc}</p>
                    <Button onClick={() => setShowForm(true)} className="mt-4 bg-orange-600 hover:bg-orange-700 text-white gap-2" size="sm">
                        <Plus className="w-4 h-4" /> {t.newRequest}
                    </Button>
                </div>
            ) : (
                <div className="bg-white rounded-xl border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-600">
                                <tr>
                                    <th className="text-start px-4 py-3 font-medium">#</th>
                                    <th className="text-start px-4 py-3 font-medium">{t.requestDate}</th>
                                    <th className="text-start px-4 py-3 font-medium">{t.requiredBy}</th>
                                    <th className="text-center px-4 py-3 font-medium">{t.items}</th>
                                    <th className="text-center px-4 py-3 font-medium">{t.ordered}</th>
                                    <th className="text-center px-4 py-3 font-medium">{t.status}</th>
                                    <th className="text-center px-4 py-3 font-medium">{t.actions}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filtered.map(mr => (
                                    <tr key={mr.name} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <span className="font-mono text-xs text-orange-700 font-medium">{mr.name}</span>
                                            {mr.title && <p className="text-[11px] text-gray-400 mt-0.5">{mr.title}</p>}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">{formatDate(mr.transaction_date)}</td>
                                        <td className="px-4 py-3 text-gray-600">{formatDate(mr.schedule_date)}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="inline-flex items-center gap-1 text-gray-600">
                                                <Package className="w-3.5 h-3.5 text-gray-400" />
                                                {mr.items?.length || '—'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-emerald-500 rounded-full transition-all"
                                                        style={{ width: `${mr.per_ordered ?? 0}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs text-gray-500">{mr.per_ordered ?? 0}%</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium', statusColor(mr.status))}>
                                                {statusIcon(mr.status)}
                                                {statusLabel(mr.status, lang as 'en' | 'ar')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => handleViewDetail(mr.name)}
                                                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"
                                                    title={t.view}
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                {mr.docstatus === 0 && (
                                                    <>
                                                        <button
                                                            onClick={() => handleSubmit(mr.name)}
                                                            className="p-1.5 hover:bg-orange-50 rounded-lg text-orange-600"
                                                            title={t.submit}
                                                        >
                                                            <Send className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(mr.name)}
                                                            className="p-1.5 hover:bg-red-50 rounded-lg text-red-400"
                                                            title={t.delete}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Create form modal */}
            {showForm && company && (
                <PurchaseRequestForm
                    lang={lang as 'en' | 'ar'}
                    isRTL={isRTL}
                    company={company}
                    lowStockItems={lowStockItems}
                    binStock={binStock}
                    onSaved={() => {
                        setShowForm(false)
                        showToast(t.created, 'success')
                        loadRequests()
                    }}
                    onClose={() => setShowForm(false)}
                />
            )}

            {/* Detail modal */}
            {detailMR && (
                <RequestDetailModal
                    mr={detailMR}
                    lang={lang as 'en' | 'ar'}
                    isRTL={isRTL}
                    onClose={() => setDetailMR(null)}
                />
            )}

            <ConfirmDialog
                open={!!pendingAction}
                onOpenChange={(open) => !open && setPendingAction(null)}
                title={pendingAction?.title ?? ''}
                description={pendingAction?.description || undefined}
                confirmLabel={isRTL ? 'تأكيد' : 'Confirm'}
                cancelLabel={isRTL ? 'إلغاء' : 'Cancel'}
                onConfirm={() => { pendingAction?.onConfirm(); setPendingAction(null) }}
            />
        </div>
    )
}

// ═══════════════════════════════════════════════
// Low Stock Banner
// ═══════════════════════════════════════════════
function LowStockBanner({
    items,
    lang,
    isRTL,
    onCreateRequest,
}: {
    items: Array<{ item_code: string; item_name?: string; total_qty: number; stock_uom?: string; warehouses: string[] }>
    lang: 'en' | 'ar'
    isRTL: boolean
    onCreateRequest: (items: Array<{ item_code: string; item_name?: string; total_qty: number; stock_uom?: string; warehouses: string[] }>) => void
}) {
    const t = L[lang]
    const [expanded, setExpanded] = useState(false)
    const displayItems = expanded ? items : items.slice(0, 6)

    return (
        <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
            <div className="flex items-center justify-between p-4 bg-amber-50/50">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                        <TrendingDown className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-800">{t.lowStockSuggestions}</h3>
                        <p className="text-xs text-gray-500">{t.lowStockDesc} ({items.length} {isRTL ? 'صنف' : 'items'})</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        className="text-orange-600 border-orange-200 hover:bg-orange-50 gap-1"
                        onClick={() => onCreateRequest(items)}
                    >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        {t.addToRequest}
                    </Button>
                    {items.length > 6 && (
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="p-1.5 hover:bg-amber-100 rounded-lg text-amber-600"
                        >
                            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-4">
                {displayItems.map(item => (
                    <div
                        key={item.item_code}
                        className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-amber-200 transition-colors"
                    >
                        <div className={cn(
                            'w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0',
                            item.total_qty <= 3 ? 'bg-red-100 text-red-700' :
                                item.total_qty <= 5 ? 'bg-amber-100 text-amber-700' :
                                    'bg-yellow-50 text-yellow-700'
                        )}>
                            {item.total_qty}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-700 truncate">
                                {item.item_name || item.item_code}
                            </p>
                            <p className="text-[10px] text-gray-400 truncate">
                                {item.item_code} · {item.stock_uom || 'Nos'}
                            </p>
                        </div>
                        {item.total_qty <= 3 && (
                            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                        )}
                    </div>
                ))}
            </div>
            {items.length > 6 && !expanded && (
                <div className="px-4 pb-3 text-center">
                    <button onClick={() => setExpanded(true)} className="text-xs text-amber-600 hover:underline">
                        +{items.length - 6} {isRTL ? 'أصناف أخرى' : 'more items'}
                    </button>
                </div>
            )}
        </div>
    )
}

// ═══════════════════════════════════════════════
// Create Form
// ═══════════════════════════════════════════════
function PurchaseRequestForm({
    lang,
    isRTL,
    company,
    lowStockItems,
    binStock,
    onSaved,
    onClose,
}: {
    lang: 'en' | 'ar'
    isRTL: boolean
    company: string
    lowStockItems: Array<{ item_code: string; item_name?: string; total_qty: number; stock_uom?: string }>
    binStock: BinStock[]
    onSaved: () => void
    onClose: () => void
}) {
    const t = L[lang]
    const [txnDate, setTxnDate] = useState(today())
    const [schedDate, setSchedDate] = useState(today())
    const [mrItems, setMRItems] = useState<Array<{ item_code: string; item_name: string; qty: number; uom: string }>>([
        { item_code: '', item_name: '', qty: 1, uom: 'Nos' },
    ])
    const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([])
    const [warehouses, setWarehouses] = useState<Array<{ name: string; warehouse_name: string }>>([])
    const [warehouse, setWarehouse] = useState('')
    const [uoms, setUoms] = useState<Array<{ name: string }>>([{ name: 'Nos' }, { name: 'Unit' }, { name: 'Box' }, { name: 'Kg' }])
    const [saving, setSaving] = useState(false)
    const [showLowStockPicker, setShowLowStockPicker] = useState(false)

    useEffect(() => {
        purchaseApi.getWarehouses(company).then(whs => {
            setWarehouses(whs)
            const stores = whs.find(w => w.warehouse_name === 'Stores' || w.warehouse_name === 'المخازن')
            if (stores && !warehouse) setWarehouse(stores.name)
        }).catch(() => { })
        purchaseApi.getUOMs().then(setUoms).catch(() => { })
    }, [company])

    useEffect(() => {
        purchaseApi.getPurchaseItems(undefined, undefined, company).then(setPurchaseItems).catch(() => { })
    }, [company])

    const updateItem = (i: number, data: Partial<typeof mrItems[0]>) => {
        setMRItems(prev => prev.map((item, idx) => idx === i ? { ...item, ...data } : item))
    }
    const addItem = () => setMRItems(prev => [...prev, { item_code: '', item_name: '', qty: 1, uom: 'Nos' }])
    const removeItem = (i: number) => setMRItems(prev => prev.filter((_, idx) => idx !== i))

    const addLowStockItems = () => {
        const newItems = lowStockItems
            .filter(ls => !mrItems.some(mi => mi.item_code === ls.item_code))
            .map(ls => ({
                item_code: ls.item_code,
                item_name: ls.item_name || ls.item_code,
                qty: Math.max(LOW_STOCK_THRESHOLD * 2 - ls.total_qty, 1), // Suggest qty to bring up to 2x threshold
                uom: ls.stock_uom || 'Nos',
            }))
        if (newItems.length > 0) {
            setMRItems(prev => {
                // Remove empty first row if exists
                const existing = prev.filter(it => it.item_code)
                return [...existing, ...newItems]
            })
        }
        setShowLowStockPicker(false)
    }

    const handleSave = async (autoSubmit: boolean) => {
        if (mrItems.every(it => !it.item_code)) return
        setSaving(true)
        try {
            const created = await purchaseApi.createMaterialRequest({
                company,
                transaction_date: txnDate,
                schedule_date: schedDate,
                items: mrItems.filter(it => it.item_code).map(it => ({
                    item_code: it.item_code,
                    qty: it.qty,
                    uom: it.uom,
                    warehouse: warehouse,
                    schedule_date: schedDate,
                })),
            })
            if (autoSubmit && created?.name) {
                try { await purchaseApi.submitMaterialRequest(created.name) } catch { /* */ }
            }
            onSaved()
        } catch (e: any) {
            console.error(e)
        }
        setSaving(false)
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">{t.createRequest}</h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {isRTL ? 'سيتم إرسال الطلب لقسم المشتريات' : 'This will be sent to the purchasing department'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <div className="p-5 space-y-4">
                    {/* Date + Warehouse row */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.warehouse} *</label>
                            <select
                                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                                value={warehouse}
                                onChange={e => setWarehouse(e.target.value)}
                            >
                                <option value="">--</option>
                                {warehouses.map(w => (
                                    <option key={w.name} value={w.name}>{w.warehouse_name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.requestDate}</label>
                            <input
                                type="date"
                                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                                value={txnDate}
                                onChange={e => setTxnDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.scheduleDate}</label>
                            <input
                                type="date"
                                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                                value={schedDate}
                                onChange={e => setSchedDate(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Low stock quick-add */}
                    {lowStockItems.length > 0 && (
                        <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                                <span className="text-sm text-amber-800">
                                    {lowStockItems.length} {isRTL ? 'صنف بمخزون منخفض' : 'low stock items detected'}
                                </span>
                            </div>
                            <button
                                onClick={addLowStockItems}
                                className="px-3 py-1 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                            >
                                {t.selectAll}
                            </button>
                        </div>
                    )}

                    {/* Items table */}
                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="text-start px-3 py-2 font-medium">{t.itemName}</th>
                                    <th className="text-center px-3 py-2 font-medium w-20">{t.currentStock}</th>
                                    <th className="text-center px-3 py-2 font-medium w-20">{t.quantity}</th>
                                    <th className="text-center px-3 py-2 font-medium w-16">{t.uom}</th>
                                    <th className="w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {mrItems.map((item, i) => {
                                    // Calculate current stock for selected item
                                    const currentStock = item.item_code
                                        ? binStock
                                            .filter(b => b.item_code === item.item_code)
                                            .reduce((sum, b) => sum + b.actual_qty, 0)
                                        : null
                                    return (
                                        <tr key={i} className="border-b last:border-0">
                                            <td className="px-3 py-2">
                                                <select
                                                    className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                                                    value={item.item_code}
                                                    onChange={e => {
                                                        const picked = purchaseItems.find(p => p.name === e.target.value)
                                                        updateItem(i, {
                                                            item_code: e.target.value,
                                                            item_name: picked?.item_name || '',
                                                            uom: picked?.stock_uom || 'Nos',
                                                        })
                                                    }}
                                                >
                                                    <option value="">--</option>
                                                    {purchaseItems.map(p => (
                                                        <option key={p.name} value={p.name}>
                                                            {p.item_name} ({p.name})
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                {currentStock !== null ? (
                                                    <span className={cn(
                                                        'text-xs font-medium px-2 py-0.5 rounded-full',
                                                        currentStock <= 3 ? 'bg-red-100 text-red-700' :
                                                            currentStock <= LOW_STOCK_THRESHOLD ? 'bg-amber-100 text-amber-700' :
                                                                'bg-emerald-100 text-emerald-700'
                                                    )}>
                                                        {currentStock}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-300">—</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="number"
                                                    min={1}
                                                    className="w-full border rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-200"
                                                    value={item.qty}
                                                    onChange={e => updateItem(i, { qty: Number(e.target.value) })}
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <select
                                                    className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-200"
                                                    value={item.uom}
                                                    onChange={e => updateItem(i, { uom: e.target.value })}
                                                >
                                                    {uoms.map(u => (
                                                        <option key={u.name} value={u.name}>{u.name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                {mrItems.length > 1 && (
                                                    <button
                                                        onClick={() => removeItem(i)}
                                                        className="p-1 hover:bg-red-50 rounded text-red-400"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                    <button
                        onClick={addItem}
                        className="flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700"
                    >
                        <Plus className="w-4 h-4" /> {t.addItem}
                    </button>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 p-5 border-t">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                        {t.cancel}
                    </button>
                    <button
                        onClick={() => handleSave(false)}
                        disabled={saving}
                        className="px-4 py-2 text-sm border border-orange-200 text-orange-700 rounded-lg hover:bg-orange-50 disabled:opacity-50"
                    >
                        {t.saveDraft}
                    </button>
                    <button
                        onClick={() => handleSave(true)}
                        disabled={saving}
                        className="px-5 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        {saving ? t.creating : t.createAndSubmit}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════
// Request Detail Modal
// ═══════════════════════════════════════════════
function RequestDetailModal({
    mr,
    lang,
    isRTL,
    onClose,
}: {
    mr: MaterialRequest
    lang: 'en' | 'ar'
    isRTL: boolean
    onClose: () => void
}) {
    const t = L[lang]
    const brand = useBrand()

    const handlePrint = () => {
        const items = mr.items || []
        printDoc({
            rtl: isRTL,
            brandName: brand.appName || (isRTL ? 'نظام المخازن' : 'Inventory System'),
            brandTagline: brand.tagline,
            logoUrl: brand.logo,
            title: isRTL ? 'طلب شراء' : 'Purchase Request',
            docNo: mr.name,
            date: mr.transaction_date,
            meta: [
                ...(mr.company ? [{ label: isRTL ? 'الشركة' : 'Company', value: mr.company }] : []),
                ...(mr.schedule_date ? [{ label: isRTL ? 'مطلوب بحلول' : 'Required by', value: mr.schedule_date }] : []),
                { label: isRTL ? 'الحالة' : 'Status', value: statusLabel(mr.status, lang) },
                ...(mr.per_ordered != null ? [{ label: isRTL ? 'نسبة الطلب' : '% ordered', value: `${mr.per_ordered}%` }] : []),
            ],
            columns: [
                { key: 'item', label: isRTL ? 'كود الصنف' : 'Item No.', ltr: true },
                { key: 'qty', label: isRTL ? 'الكمية' : 'Qty', align: 'center' },
                { key: 'uom', label: isRTL ? 'الوحدة' : 'UOM', align: 'center' },
                { key: 'warehouse', label: isRTL ? 'المستودع' : 'Warehouse' },
            ],
            rows: items.map((it) => ({
                item: it.item_code,
                qty: it.qty,
                uom: it.uom || it.stock_uom || '—',
                warehouse: it.warehouse || '—',
            })),
            totals: [{ label: isRTL ? 'إجمالي الكمية' : 'Total qty', value: String(items.reduce((tq, it) => tq + (it.qty || 0), 0)), bold: true }],
            signatures: isRTL ? ['مقدّم الطلب', 'قسم المشتريات', 'الاعتماد'] : ['Requested by', 'Purchasing dept.', 'Approved by'],
        })
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">{t.requestDetail}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-gray-500 font-mono">{mr.name}</span>
                            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', statusColor(mr.status))}>
                                {statusIcon(mr.status)}
                                {statusLabel(mr.status, lang)}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={handlePrint} title={isRTL ? 'طباعة الطلب' : 'Print request'} className="p-1.5 hover:bg-gray-100 rounded-lg">
                            <Printer className="w-5 h-5 text-gray-500" />
                        </button>
                        <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Info */}
                <div className="p-5">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                        <div>
                            <p className="text-xs text-gray-400 mb-0.5">{t.requestDate}</p>
                            <p className="text-sm font-medium text-gray-700">{formatDate(mr.transaction_date)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 mb-0.5">{t.requiredBy}</p>
                            <p className="text-sm font-medium text-gray-700">{formatDate(mr.schedule_date)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 mb-0.5">{t.ordered}</p>
                            <div className="flex items-center gap-2">
                                <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-emerald-500 rounded-full"
                                        style={{ width: `${mr.per_ordered ?? 0}%` }}
                                    />
                                </div>
                                <span className="text-sm font-medium text-gray-700">{mr.per_ordered ?? 0}%</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 mb-0.5">{t.createdOn}</p>
                            <p className="text-sm font-medium text-gray-700">{formatDate(mr.creation)}</p>
                        </div>
                    </div>

                    {/* Items table */}
                    {mr.items && mr.items.length > 0 ? (
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="text-start px-4 py-2 font-medium text-gray-600">{t.itemCode}</th>
                                        <th className="text-start px-4 py-2 font-medium text-gray-600">{t.itemName}</th>
                                        <th className="text-center px-4 py-2 font-medium text-gray-600">{t.quantity}</th>
                                        <th className="text-center px-4 py-2 font-medium text-gray-600">{t.uom}</th>
                                        <th className="text-start px-4 py-2 font-medium text-gray-600">{t.warehouse_label}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {mr.items.map((item, i) => (
                                        <tr key={i} className="hover:bg-gray-50">
                                            <td className="px-4 py-2 font-mono text-xs text-orange-700">{item.item_code}</td>
                                            <td className="px-4 py-2 text-gray-700">{item.item_name || '—'}</td>
                                            <td className="px-4 py-2 text-center font-medium">{item.qty}</td>
                                            <td className="px-4 py-2 text-center text-gray-500">{item.uom || item.stock_uom || 'Nos'}</td>
                                            <td className="px-4 py-2 text-gray-500 text-xs">{item.warehouse || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400 text-center py-8">{isRTL ? 'لا توجد أصناف' : 'No items'}</p>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center p-5 border-t">
                    <div className="text-sm text-gray-500">
                        {t.totalItems}: <span className="font-medium text-gray-700">{mr.items?.length || 0}</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                        {isRTL ? 'إغلاق' : 'Close'}
                    </button>
                </div>
            </div>
        </div>
    )
}
