/**
 * Admin Stock Management
 * Full CRUD view for warehouse stock operations: overview, warehouses,
 * transfer requests (accept/reject), return logs, and audit trail.
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { getStatusClass } from '@/lib/status-config'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/hooks/use-toast'
import {
    stockApi,
    type Warehouse,
    type StockTransferRequest,
    type ReturnLog,
    type StockMovementAudit,
    type BinStock,
    type StockStatus,
} from '@/lib/stock-api'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
    Package,
    Warehouse as WarehouseIcon,
    ArrowRightLeft,
    RotateCcw,
    ClipboardList,
    RefreshCw,
    Search,
    Check,
    X,
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    Eye,
    Truck,
    BoxIcon,
    AlertCircle,
    Plus,
    BarChart3,
    Database,
    Trash2,
} from 'lucide-react'

// ─────────────────────────────────────────────
// 1. OVERVIEW TAB
// ─────────────────────────────────────────────
function StockOverview({
    warehouses,
    pendingTransfers,
    returnLogs,
    auditLogs,
    loading,
    onNavigate,
}: {
    warehouses: Warehouse[]
    pendingTransfers: StockTransferRequest[]
    returnLogs: ReturnLog[]
    auditLogs: StockMovementAudit[]
    loading: boolean
    onNavigate?: (tab: string) => void
}) {
    const { isRTL } = useI18n()
    const today = new Date().toISOString().split('T')[0]  // YYYY-MM-DD

    const vanCount = warehouses.filter((w) => w.custom_warehouse_type === 'Van').length
    const mainCount = warehouses.filter((w) => w.custom_warehouse_type === 'Main').length
    const todayLogs = auditLogs.filter((a) => a.movement_date === today)
    const totalQtyIn = todayLogs
        .filter((a) => a.movement_type === 'In')
        .reduce((s, a) => s + (a.quantity_change || 0), 0)
    const totalQtyOut = todayLogs
        .filter((a) => a.movement_type === 'Out')
        .reduce((s, a) => s + Math.abs(a.quantity_change || 0), 0)

    const stats = [
        {
            label: isRTL ? 'المستودعات' : 'Warehouses',
            value: warehouses.length,
            sub: isRTL ? `${vanCount} مندوب / ${mainCount} رئيسي` : `${vanCount} van / ${mainCount} main`,
            icon: WarehouseIcon,
            color: 'text-orange-600',
            bg: 'bg-orange-50',
        },
        {
            label: isRTL ? 'طلبات نقل معلقة' : 'Pending Transfers',
            value: pendingTransfers.length,
            sub: isRTL ? 'تحتاج موافقة' : 'Awaiting approval',
            icon: ArrowRightLeft,
            color: pendingTransfers.length > 0 ? 'text-amber-600' : 'text-emerald-600',
            bg: pendingTransfers.length > 0 ? 'bg-amber-50' : 'bg-emerald-50',
        },
        {
            label: isRTL ? 'حركات واردة (اليوم)' : 'Stock In (today)',
            value: totalQtyIn.toLocaleString(),
            sub: isRTL ? 'وحدة دخلت المخزون' : 'units received',
            icon: TrendingUp,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
        },
        {
            label: isRTL ? 'حركات صادرة (اليوم)' : 'Stock Out (today)',
            value: totalQtyOut.toLocaleString(),
            sub: isRTL ? 'وحدة خرجت من المخزون' : 'units issued',
            icon: TrendingDown,
            color: 'text-red-600',
            bg: 'bg-red-50',
        },
        {
            label: isRTL ? 'سجلات المرتجعات' : 'Return Logs',
            value: returnLogs.length,
            sub: isRTL ? 'مرتجع مسجل' : 'logged returns',
            icon: RotateCcw,
            color: 'text-violet-600',
            bg: 'bg-violet-50',
        },
    ]

    const recentTransfers = pendingTransfers.slice(0, 5)

    if (loading) {
        return (
            <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {stats.map((_, i) => <Skeleton key={i} className="h-24" />)}
                </div>
                <Skeleton className="h-48" />
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {stats.map((s, i) => (
                    <Card key={i} className="border-0 shadow-sm">
                        <CardContent className="p-4">
                            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center mb-3', s.bg)}>
                                <s.icon className={cn('h-5 w-5', s.color)} />
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                            <p className="text-xs font-medium text-gray-700 mt-0.5">{s.label}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">{s.sub}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Pending Transfers quick list */}
            {recentTransfers.length > 0 && (
                <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                                {isRTL ? 'طلبات النقل المعلقة' : 'Pending Transfer Requests'}
                            </CardTitle>
                            {onNavigate && (
                                <Button variant="ghost" size="sm" className="text-xs text-orange-600 hover:text-orange-700" onClick={() => onNavigate('transfers')}>
                                    {isRTL ? 'عرض الكل' : 'View all'} →
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50/50">
                                    <TableHead className="text-xs">{isRTL ? 'رقم الطلب' : 'Request #'}</TableHead>
                                    <TableHead className="text-xs">{isRTL ? 'من' : 'From'}</TableHead>
                                    <TableHead className="text-xs">{isRTL ? 'إلى' : 'To'}</TableHead>
                                    <TableHead className="text-xs">{isRTL ? 'المندوب' : 'Sales Rep'}</TableHead>
                                    <TableHead className="text-xs">{isRTL ? 'الكمية' : 'Qty'}</TableHead>
                                    <TableHead className="text-xs">{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentTransfers.map((t) => (
                                    <TableRow key={t.name} className="hover:bg-gray-50/50">
                                        <TableCell className="font-mono text-xs text-gray-500">{t.name}</TableCell>
                                        <TableCell className="text-sm">{t.from_warehouse}</TableCell>
                                        <TableCell className="text-sm">{t.to_warehouse}</TableCell>
                                        <TableCell className="text-sm text-gray-600">{t.sales_person || '—'}</TableCell>
                                        <TableCell>
                                            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px]">
                                                {t.total_quantity}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs text-gray-500">{t.request_date}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

// ─────────────────────────────────────────────
// 2. WAREHOUSES TAB
// ─────────────────────────────────────────────
// Warehouse type colours are now in lib/status-config.ts → getStatusClass()

function WarehousesView({
    warehouses,
    binStock,
    loading,
}: {
    warehouses: Warehouse[]
    binStock: BinStock[]
    loading: boolean
}) {
    const { isRTL } = useI18n()
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState<string>('all')
    const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null)

    const filtered = useMemo(() => {
        let list = warehouses
        if (search) {
            const q = search.toLowerCase()
            list = list.filter(
                (w) =>
                    w.warehouse_name?.toLowerCase().includes(q) ||
                    w.custom_linked_sales_person?.toLowerCase().includes(q)
            )
        }
        if (typeFilter !== 'all') {
            list = list.filter((w) => w.custom_warehouse_type === typeFilter)
        }
        return list
    }, [warehouses, search, typeFilter])

    const warehouseTypes = ['Main', 'Van', 'Customer Location', 'Temporary', 'Damaged', 'Returns']

    const warehouseBinStock = useMemo(
        () => (selectedWarehouse ? binStock.filter((b) => b.warehouse === selectedWarehouse.name) : []),
        [selectedWarehouse, binStock]
    )

    if (loading) return <div className="p-6 space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12" />)}</div>

    return (
        <div className="p-6 space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
                    <Input
                        placeholder={isRTL ? 'بحث في المستودعات...' : 'Search warehouses...'}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className={cn('h-9 text-sm', isRTL ? 'pr-9' : 'pl-9')}
                    />
                </div>
                <div className="flex flex-wrap gap-1.5">
                    <button
                        onClick={() => setTypeFilter('all')}
                        className={cn(
                            'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                            typeFilter === 'all' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        )}
                    >
                        {isRTL ? 'الكل' : 'All'} ({warehouses.length})
                    </button>
                    {warehouseTypes.map((t) => {
                        const count = warehouses.filter((w) => w.custom_warehouse_type === t).length
                        if (count === 0) return null
                        return (
                            <button
                                key={t}
                                onClick={() => setTypeFilter(t === typeFilter ? 'all' : t)}
                                className={cn(
                                    'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                                    typeFilter === t ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                )}
                            >
                                {t} ({count})
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Table — rows are clickable to see bin stock */}
            <Card className="border-0 shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50/50">
                            <TableHead className="text-xs font-semibold">{isRTL ? 'اسم المستودع' : 'Warehouse Name'}</TableHead>
                            <TableHead className="text-xs font-semibold">{isRTL ? 'النوع' : 'Type'}</TableHead>
                            <TableHead className="text-xs font-semibold">{isRTL ? 'المندوب المرتبط' : 'Linked Rep'}</TableHead>
                            <TableHead className="text-xs font-semibold">{isRTL ? 'الشركة' : 'Company'}</TableHead>
                            <TableHead className="text-xs font-semibold">{isRTL ? 'ديناميكي' : 'Dynamic'}</TableHead>
                            <TableHead className="text-xs font-semibold text-right">{isRTL ? 'الأصناف' : 'SKUs'}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-12 text-gray-400">
                                    {isRTL ? 'لا توجد مستودعات' : 'No warehouses found'}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((w) => {
                                const skus = binStock.filter((b) => b.warehouse === w.name).length
                                return (
                                    <TableRow
                                        key={w.name}
                                        className="hover:bg-orange-50/40 cursor-pointer transition-colors"
                                        onClick={() => setSelectedWarehouse(w)}
                                    >
                                        <TableCell className="font-medium text-sm">{w.warehouse_name}</TableCell>
                                        <TableCell>
                                            {w.custom_warehouse_type ? (
                                                <Badge className={cn('text-[10px]', getStatusClass(w.custom_warehouse_type))}>
                                                    {w.custom_warehouse_type}
                                                </Badge>
                                            ) : (
                                                <span className="text-xs text-gray-400">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm text-gray-600">{w.custom_linked_sales_person || '—'}</TableCell>
                                        <TableCell className="text-xs text-gray-500">{w.company || '—'}</TableCell>
                                        <TableCell>
                                            {w.custom_is_dynamic ? (
                                                <span className="text-[10px] font-medium text-emerald-600">✓</span>
                                            ) : (
                                                <span className="text-xs text-gray-300">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {skus > 0 ? (
                                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px]">{skus}</Badge>
                                            ) : (
                                                <span className="text-xs text-gray-300">0</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </Card>

            {/* ── Warehouse Detail Dialog (bin stock) ── */}
            <Dialog open={!!selectedWarehouse} onOpenChange={(open) => !open && setSelectedWarehouse(null)}>
                <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Database className="h-5 w-5 text-orange-600" />
                            {selectedWarehouse?.warehouse_name}
                            {selectedWarehouse?.custom_warehouse_type && (
                                <Badge className={cn('text-[10px]', getStatusClass(selectedWarehouse.custom_warehouse_type))}>
                                    {selectedWarehouse.custom_warehouse_type}
                                </Badge>
                            )}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto">
                        {warehouseBinStock.length === 0 ? (
                            <p className="py-12 text-center text-sm text-gray-400">
                                {isRTL ? 'لا يوجد مخزون في هذا المستودع' : 'No stock in this warehouse'}
                            </p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50/50">
                                        <TableHead className="text-xs">{isRTL ? 'كود الصنف' : 'Item Code'}</TableHead>
                                        <TableHead className="text-xs text-right">{isRTL ? 'الكمية' : 'Qty'}</TableHead>
                                        <TableHead className="text-xs">{isRTL ? 'الوحدة' : 'UOM'}</TableHead>
                                        <TableHead className="text-xs text-right">{isRTL ? 'القيمة' : 'Value'}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {warehouseBinStock.map((b, idx) => (
                                        <TableRow key={`${b.item_code}-${idx}`}>
                                            <TableCell className="font-mono text-xs">{b.item_code}</TableCell>
                                            <TableCell className="text-sm font-bold text-right tabular-nums text-emerald-700">{b.actual_qty.toLocaleString()}</TableCell>
                                            <TableCell className="text-xs text-gray-500">{b.stock_uom || '—'}</TableCell>
                                            <TableCell className="text-sm text-right tabular-nums text-gray-700">
                                                {b.stock_value != null
                                                    ? b.stock_value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                                                    : '—'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                    <DialogFooter className="border-t pt-3">
                        <span className="text-xs text-gray-400 flex-1">
                            {warehouseBinStock.length} {isRTL ? 'صنف' : 'SKUs'} •{' '}
                            {isRTL ? 'إجمالي القيمة' : 'Total value'}:{' '}
                            <strong>
                                {warehouseBinStock.reduce((s, b) => s + (b.stock_value || 0), 0)
                                    .toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </strong>
                        </span>
                        <Button variant="outline" size="sm" onClick={() => setSelectedWarehouse(null)}>
                            {isRTL ? 'إغلاق' : 'Close'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

// ─────────────────────────────────────────────
// 3. TRANSFER REQUESTS TAB
// ─────────────────────────────────────────────
// Transfer request status colours are now in lib/status-config.ts → getStatusClass()

function TransferRequestsView({
    requests,
    warehouses,
    loading,
    onRefresh,
}: {
    requests: StockTransferRequest[]
    warehouses: Warehouse[]
    loading: boolean
    onRefresh: () => void
}) {
    const { isRTL } = useI18n()
    const { toast } = useToast()
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('Pending')
    const [processing, setProcessing] = useState<string | null>(null)
    const [rejectDialog, setRejectDialog] = useState<{ open: boolean; request: StockTransferRequest | null }>({ open: false, request: null })
    const [rejectReason, setRejectReason] = useState('')
    const [viewDialog, setViewDialog] = useState<{ open: boolean; request: StockTransferRequest | null }>({ open: false, request: null })
    const [loadingDetail, setLoadingDetail] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 15

    // ── create new request ──
    type NewItem = { item_code: string; requested_qty: string; uom: string }
    const emptyItem = (): NewItem => ({ item_code: '', requested_qty: '1', uom: '' })
    const [createOpen, setCreateOpen] = useState(false)
    const [newFromWh, setNewFromWh] = useState('')
    const [newToWh, setNewToWh] = useState('')
    const [newItems, setNewItems] = useState<NewItem[]>([emptyItem()])
    const [creating, setCreating] = useState(false)

    const mainWarehouses = useMemo(() => warehouses.filter((w) => w.custom_warehouse_type === 'Main' && !w.is_group && !w.disabled), [warehouses])
    const vanWarehouses = useMemo(() => warehouses.filter((w) => w.custom_warehouse_type === 'Van' && !w.is_group && !w.disabled), [warehouses])
    const allActiveWh = useMemo(() => warehouses.filter((w) => !w.is_group && !w.disabled), [warehouses])

    const handleCreate = async () => {
        if (!newFromWh || !newToWh) { toast({ title: isRTL ? 'يرجى اختيار المستودعين' : 'Select both warehouses', variant: 'destructive' }); return }
        const validItems = newItems.filter((i) => i.item_code.trim() && Number(i.requested_qty) > 0)
        if (validItems.length === 0) { toast({ title: isRTL ? 'أضف صنفاً واحداً على الأقل' : 'Add at least one item', variant: 'destructive' }); return }
        setCreating(true)
        try {
            await stockApi.createTransferRequest({
                from_warehouse: newFromWh,
                to_warehouse: newToWh,
                items: validItems.map((i) => ({ item_code: i.item_code.trim(), requested_qty: Number(i.requested_qty), ...(i.uom ? { uom: i.uom } : {}) })),
            })
            toast({ title: isRTL ? 'تم إنشاء الطلب' : 'Transfer request created' })
            setCreateOpen(false)
            setNewFromWh(''); setNewToWh(''); setNewItems([emptyItem()])
            onRefresh()
        } catch (e: any) {
            toast({ title: 'Error', description: e?.message, variant: 'destructive' })
        } finally {
            setCreating(false)
        }
    }

    const filtered = useMemo(() => {
        let list = requests
        if (statusFilter !== 'all') list = list.filter((r) => r.status === statusFilter)
        if (search) {
            const q = search.toLowerCase()
            list = list.filter(
                (r) =>
                    r.name.toLowerCase().includes(q) ||
                    r.from_warehouse?.toLowerCase().includes(q) ||
                    r.to_warehouse?.toLowerCase().includes(q) ||
                    r.sales_person?.toLowerCase().includes(q)
            )
        }
        return list
    }, [requests, search, statusFilter])

    const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    const totalPages = Math.ceil(filtered.length / itemsPerPage)

    const handleAccept = async (req: StockTransferRequest) => {
        setProcessing(req.name)
        try {
            await stockApi.acceptTransferRequest(req.name)
            toast({ title: isRTL ? 'تم القبول' : 'Accepted', description: isRTL ? `تم قبول طلب ${req.name} وإنشاء قيد المخزون` : `Request ${req.name} accepted. Stock entry created.` })
            onRefresh()
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' })
        } finally {
            setProcessing(null)
        }
    }

    const handleReject = async () => {
        if (!rejectDialog.request) return
        if (!rejectReason.trim()) {
            toast({ title: isRTL ? 'مطلوب سبب الرفض' : 'Rejection reason required', variant: 'destructive' })
            return
        }
        setProcessing(rejectDialog.request.name)
        try {
            await stockApi.rejectTransferRequest(rejectDialog.request.name, rejectReason)
            toast({ title: isRTL ? 'تم الرفض' : 'Rejected' })
            setRejectDialog({ open: false, request: null })
            setRejectReason('')
            onRefresh()
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' })
        } finally {
            setProcessing(null)
        }
    }

    const handleView = async (req: StockTransferRequest) => {
        setViewDialog({ open: true, request: req })
        setLoadingDetail(true)
        try {
            const detail = await stockApi.getTransferRequest(req.name)
            if (detail) setViewDialog({ open: true, request: detail })
        } catch {
            // keep summary
        } finally {
            setLoadingDetail(false)
        }
    }

    const statusOptions = ['all', 'Pending', 'Accepted', 'Partially Accepted', 'Rejected', 'Completed']

    if (loading) return <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>

    return (
        <div className="p-6 space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
                    <Input
                        placeholder={isRTL ? 'بحث...' : 'Search...'}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className={cn('h-9 text-sm', isRTL ? 'pr-9' : 'pl-9')}
                    />
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {statusOptions.map((s) => {
                        const count = s === 'all' ? requests.length : requests.filter((r) => r.status === s).length
                        return (
                            <button
                                key={s}
                                onClick={() => { setStatusFilter(s); setCurrentPage(1) }}
                                className={cn(
                                    'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                                    statusFilter === s ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                )}
                            >
                                {s === 'all' ? (isRTL ? 'الكل' : 'All') : s} ({count})
                            </button>
                        )
                    })}
                </div>
                <Button variant="outline" size="sm" onClick={onRefresh}>
                    <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                    onClick={() => { setCreateOpen(true); setNewFromWh(''); setNewToWh(''); setNewItems([emptyItem()]) }}
                >
                    <Plus className="h-4 w-4" />
                    <span className={cn('text-xs', isRTL ? 'mr-1' : 'ml-1')}>{isRTL ? 'طلب جديد' : 'New Request'}</span>
                </Button>
            </div>

            {/* Table */}
            <Card className="border-0 shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50/50">
                            <TableHead className="text-xs font-semibold">{isRTL ? 'رقم' : '#'}</TableHead>
                            <TableHead className="text-xs font-semibold">{isRTL ? 'من' : 'From'}</TableHead>
                            <TableHead className="text-xs font-semibold">{isRTL ? 'إلى' : 'To'}</TableHead>
                            <TableHead className="text-xs font-semibold">{isRTL ? 'المندوب' : 'Rep'}</TableHead>
                            <TableHead className="text-xs font-semibold">{isRTL ? 'الكمية' : 'Qty'}</TableHead>
                            <TableHead className="text-xs font-semibold">{isRTL ? 'الحالة' : 'Status'}</TableHead>
                            <TableHead className="text-xs font-semibold">{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                            <TableHead className="text-xs font-semibold">{isRTL ? 'إجراء' : 'Action'}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginated.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-12 text-gray-400">
                                    {isRTL ? 'لا توجد طلبات' : 'No requests found'}
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginated.map((req) => (
                                <TableRow key={req.name} className="hover:bg-gray-50/50">
                                    <TableCell className="font-mono text-xs text-gray-500">{req.name}</TableCell>
                                    <TableCell className="text-sm max-w-[150px] truncate">{req.from_warehouse}</TableCell>
                                    <TableCell className="text-sm max-w-[150px] truncate">{req.to_warehouse}</TableCell>
                                    <TableCell className="text-sm text-gray-600">{req.sales_person || '—'}</TableCell>
                                    <TableCell className="text-sm font-medium">{req.total_quantity}</TableCell>
                                    <TableCell>
                                        <Badge className={cn('text-[10px]', getStatusClass(req.status))}>
                                            {req.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-gray-500">{req.request_date}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleView(req)}>
                                                <Eye className="h-3.5 w-3.5 text-gray-500" />
                                            </Button>
                                            {req.status === 'Pending' && (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        className="h-7 px-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px]"
                                                        disabled={processing === req.name}
                                                        onClick={() => handleAccept(req)}
                                                    >
                                                        <Check className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 px-2 border-red-200 text-red-600 hover:bg-red-50 text-[11px]"
                                                        disabled={processing === req.name}
                                                        onClick={() => { setRejectDialog({ open: true, request: req }); setRejectReason('') }}
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{isRTL ? `${filtered.length} طلب` : `${filtered.length} requests`}</span>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span>{currentPage} / {totalPages}</span>
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* View Detail Dialog */}
            <Dialog open={viewDialog.open} onOpenChange={(o) => !o && setViewDialog({ open: false, request: null })}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{isRTL ? 'تفاصيل طلب النقل' : 'Transfer Request Details'}</DialogTitle>
                    </DialogHeader>
                    {loadingDetail ? (
                        <div className="space-y-2 py-4">
                            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-6" />)}
                        </div>
                    ) : viewDialog.request && (
                        <div className="space-y-3 text-sm">
                            <div className="grid grid-cols-2 gap-3">
                                <div><span className="text-gray-500">{isRTL ? 'من:' : 'From:'}</span> <span className="font-medium">{viewDialog.request.from_warehouse}</span></div>
                                <div><span className="text-gray-500">{isRTL ? 'إلى:' : 'To:'}</span> <span className="font-medium">{viewDialog.request.to_warehouse}</span></div>
                                <div><span className="text-gray-500">{isRTL ? 'المندوب:' : 'Rep:'}</span> <span className="font-medium">{viewDialog.request.sales_person || '—'}</span></div>
                                <div><span className="text-gray-500">{isRTL ? 'الحالة:' : 'Status:'}</span> <Badge className={cn('text-[10px]', getStatusClass(viewDialog.request.status))}>{viewDialog.request.status}</Badge></div>
                            </div>
                            {viewDialog.request.items && viewDialog.request.items.length > 0 && (
                                <div>
                                    <p className="font-semibold mb-2">{isRTL ? 'الأصناف' : 'Items'}</p>
                                    <div className="border rounded-lg overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-gray-50">
                                                    <TableHead className="text-xs">{isRTL ? 'الصنف' : 'Item'}</TableHead>
                                                    <TableHead className="text-xs">{isRTL ? 'مطلوب' : 'Requested'}</TableHead>
                                                    <TableHead className="text-xs">{isRTL ? 'مقبول' : 'Accepted'}</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {viewDialog.request.items.map((item, i) => (
                                                    <TableRow key={i}>
                                                        <TableCell className="text-xs">{item.item_code}</TableCell>
                                                        <TableCell className="text-xs">{item.requested_qty}</TableCell>
                                                        <TableCell className="text-xs">{item.accepted_qty ?? '—'}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}
                            {viewDialog.request.stock_entry && (
                                <div className="p-2 bg-emerald-50 rounded text-xs text-emerald-700">
                                    {isRTL ? 'قيد المخزون:' : 'Stock Entry:'} <span className="font-mono">{viewDialog.request.stock_entry}</span>
                                </div>
                            )}
                            {viewDialog.request.rejection_reason && (
                                <div className="p-2 bg-red-50 rounded text-xs text-red-700">
                                    {isRTL ? 'سبب الرفض:' : 'Rejection reason:'} {viewDialog.request.rejection_reason}
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Reject Dialog */}
            <Dialog open={rejectDialog.open} onOpenChange={(o) => !o && setRejectDialog({ open: false, request: null })}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{isRTL ? 'رفض طلب النقل' : 'Reject Transfer Request'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <p className="text-sm text-gray-600">
                            {isRTL ? `سيتم رفض الطلب: ${rejectDialog.request?.name}` : `Rejecting request: ${rejectDialog.request?.name}`}
                        </p>
                        <div>
                            <Label className="text-xs font-medium">{isRTL ? 'سبب الرفض *' : 'Rejection Reason *'}</Label>
                            <Textarea
                                placeholder={isRTL ? 'اكتب سبب الرفض...' : 'Enter rejection reason...'}
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                className="mt-1.5 text-sm h-20 resize-none"
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setRejectDialog({ open: false, request: null })}>
                            {isRTL ? 'إلغاء' : 'Cancel'}
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleReject}
                            disabled={!rejectReason.trim() || processing !== null}
                        >
                            {isRTL ? 'رفض' : 'Reject'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Create Transfer Request Dialog ── */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ArrowRightLeft className="h-5 w-5 text-orange-600" />
                            {isRTL ? 'طلب نقل مخزون جديد' : 'New Stock Transfer Request'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs font-medium">{isRTL ? 'من مستودع *' : 'From Warehouse *'}</Label>
                                <select
                                    value={newFromWh}
                                    onChange={(e) => setNewFromWh(e.target.value)}
                                    className="mt-1 w-full h-9 rounded-md border border-gray-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                                >
                                    <option value="">{isRTL ? '— اختر —' : '— Select —'}</option>
                                    {(mainWarehouses.length > 0 ? mainWarehouses : allActiveWh).map((w) => (
                                        <option key={w.name} value={w.name}>{w.warehouse_name || w.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <Label className="text-xs font-medium">{isRTL ? 'إلى مستودع *' : 'To Warehouse *'}</Label>
                                <select
                                    value={newToWh}
                                    onChange={(e) => setNewToWh(e.target.value)}
                                    className="mt-1 w-full h-9 rounded-md border border-gray-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                                >
                                    <option value="">{isRTL ? '— اختر —' : '— Select —'}</option>
                                    {(vanWarehouses.length > 0 ? vanWarehouses : allActiveWh).map((w) => (
                                        <option key={w.name} value={w.name}>{w.warehouse_name || w.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Items */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <Label className="text-xs font-medium">{isRTL ? 'الأصناف *' : 'Items *'}</Label>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-orange-600"
                                    onClick={() => setNewItems((prev) => [...prev, emptyItem()])}
                                >
                                    <Plus className="h-3 w-3 mr-1" /> {isRTL ? 'إضافة صنف' : 'Add item'}
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {newItems.map((item, idx) => (
                                    <div key={idx} className="flex gap-2 items-center">
                                        <Input
                                            className="h-8 text-xs flex-1"
                                            placeholder={isRTL ? 'كود الصنف' : 'Item code'}
                                            value={item.item_code}
                                            onChange={(e) => setNewItems((prev) => prev.map((it, i) => i === idx ? { ...it, item_code: e.target.value } : it))}
                                        />
                                        <Input
                                            className="h-8 text-xs w-20"
                                            type="number"
                                            min="0.001"
                                            step="any"
                                            placeholder={isRTL ? 'الكمية' : 'Qty'}
                                            value={item.requested_qty}
                                            onChange={(e) => setNewItems((prev) => prev.map((it, i) => i === idx ? { ...it, requested_qty: e.target.value } : it))}
                                        />
                                        <Input
                                            className="h-8 text-xs w-16"
                                            placeholder="UOM"
                                            value={item.uom}
                                            onChange={(e) => setNewItems((prev) => prev.map((it, i) => i === idx ? { ...it, uom: e.target.value } : it))}
                                        />
                                        {newItems.length > 1 && (
                                            <button
                                                onClick={() => setNewItems((prev) => prev.filter((_, i) => i !== idx))}
                                                className="text-red-400 hover:text-red-600"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
                        <Button
                            size="sm"
                            className="bg-orange-600 hover:bg-orange-700 text-white"
                            onClick={handleCreate}
                            disabled={creating}
                        >
                            {creating ? <RefreshCw className="h-4 w-4 animate-spin" /> : (isRTL ? 'إنشاء' : 'Create')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

// ─────────────────────────────────────────────
// 4. RETURN LOGS TAB
// ─────────────────────────────────────────────
function ReturnLogsView({
    returnLogs,
    warehouses,
    loading,
    onRefresh,
}: {
    returnLogs: ReturnLog[]
    warehouses: Warehouse[]
    loading: boolean
    onRefresh: () => void
}) {
    const { isRTL } = useI18n()
    const { toast } = useToast()
    const [search, setSearch] = useState('')
    const [viewDialog, setViewDialog] = useState<{ open: boolean; log: ReturnLog | null }>({ open: false, log: null })
    const [loadingDetail, setLoadingDetail] = useState(false)
    const [submittingReturn, setSubmittingReturn] = useState(false)
    const [cancellingReturn, setCancellingReturn] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
    const itemsPerPage = 15

    // ── create new return log ──
    type NewReturnItem = { item_code: string; quantity: string; rate: string; uom: string }
    const emptyReturnItem = (): NewReturnItem => ({ item_code: '', quantity: '1', rate: '', uom: '' })
    const [createOpen, setCreateOpen] = useState(false)
    const [newWarehouse, setNewWarehouse] = useState('')
    const [newReturnReason, setNewReturnReason] = useState('')
    const [newCustomer, setNewCustomer] = useState('')
    const [newReturnItems, setNewReturnItems] = useState<NewReturnItem[]>([emptyReturnItem()])
    const [creating, setCreating] = useState(false)

    const activeWarehouses = useMemo(() => warehouses.filter((w) => !w.is_group && !w.disabled), [warehouses])

    const handleCreate = async () => {
        if (!newWarehouse) { toast({ title: isRTL ? 'يرجى اختيار المستودع' : 'Select a warehouse', variant: 'destructive' }); return }
        const validItems = newReturnItems.filter((i) => i.item_code.trim() && Number(i.quantity) > 0)
        if (validItems.length === 0) { toast({ title: isRTL ? 'أضف صنفاً واحداً على الأقل' : 'Add at least one item', variant: 'destructive' }); return }
        setCreating(true)
        try {
            await stockApi.createReturnLog({
                warehouse: newWarehouse,
                return_reason: newReturnReason || undefined,
                customer: newCustomer || undefined,
                items: validItems.map((i) => ({
                    item_code: i.item_code.trim(),
                    quantity: Number(i.quantity),
                    ...(i.rate ? { rate: Number(i.rate) } : {}),
                    ...(i.uom ? { uom: i.uom } : {}),
                })),
            })
            toast({ title: isRTL ? 'تم إنشاء سجل المرتجع' : 'Return log created' })
            setCreateOpen(false)
            setNewWarehouse(''); setNewReturnReason(''); setNewCustomer(''); setNewReturnItems([emptyReturnItem()])
            onRefresh()
        } catch (e: any) {
            toast({ title: 'Error', description: e?.message, variant: 'destructive' })
        } finally {
            setCreating(false)
        }
    }

    // Return status colours are now in lib/status-config.ts → getStatusClass()

    const filtered = useMemo(() => {
        if (!search) return returnLogs
        const q = search.toLowerCase()
        return returnLogs.filter(
            (r) =>
                r.name.toLowerCase().includes(q) ||
                r.sales_person?.toLowerCase().includes(q) ||
                r.customer?.toLowerCase().includes(q) ||
                r.warehouse?.toLowerCase().includes(q)
        )
    }, [returnLogs, search])

    const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    const totalPages = Math.ceil(filtered.length / itemsPerPage)

    const handleView = async (log: ReturnLog) => {
        setViewDialog({ open: true, log })
        setLoadingDetail(true)
        try {
            const detail = await stockApi.getReturnLog(log.name)
            if (detail) setViewDialog({ open: true, log: detail })
        } catch {
            // keep summary
        } finally {
            setLoadingDetail(false)
        }
    }

    const handleSubmitReturn = async () => {
        if (!viewDialog.log) return
        setSubmittingReturn(true)
        try {
            await stockApi.submitReturnLog(viewDialog.log.name)
            toast({ title: isRTL ? 'تم ترحيل المرتجع بنجاح' : 'Return log submitted successfully' })
            setViewDialog({ open: false, log: null })
            onRefresh()
        } catch (e: any) {
            toast({ title: isRTL ? 'فشل الترحيل' : 'Submit failed', description: e?.message, variant: 'destructive' })
        } finally { setSubmittingReturn(false) }
    }

    const handleCancelReturn = async () => {
        if (!viewDialog.log) return
        setCancelConfirmOpen(false)
        setCancellingReturn(true)
        try {
            await stockApi.cancelReturnLog(viewDialog.log.name)
            toast({ title: isRTL ? 'تم إلغاء المرتجع' : 'Return log cancelled' })
            setViewDialog({ open: false, log: null })
            onRefresh()
        } catch (e: any) {
            toast({ title: isRTL ? 'فشل الإلغاء' : 'Cancel failed', description: e?.message, variant: 'destructive' })
        } finally { setCancellingReturn(false) }
    }

    if (loading) return <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
                    <Input
                        placeholder={isRTL ? 'بحث في المرتجعات...' : 'Search return logs...'}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className={cn('h-9 text-sm', isRTL ? 'pr-9' : 'pl-9')}
                    />
                </div>
                <Button variant="outline" size="sm" onClick={onRefresh}>
                    <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                    onClick={() => { setCreateOpen(true); setNewWarehouse(''); setNewReturnReason(''); setNewCustomer(''); setNewReturnItems([emptyReturnItem()]) }}
                >
                    <Plus className="h-4 w-4" />
                    <span className={cn('text-xs', isRTL ? 'mr-1' : 'ml-1')}>{isRTL ? 'مرتجع جديد' : 'New Return'}</span>
                </Button>
            </div>

            <Card className="border-0 shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50/50">
                            <TableHead className="text-xs font-semibold">{isRTL ? 'رقم' : '#'}</TableHead>
                            <TableHead className="text-xs font-semibold">{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                            <TableHead className="text-xs font-semibold">{isRTL ? 'المستودع' : 'Warehouse'}</TableHead>
                            <TableHead className="text-xs font-semibold">{isRTL ? 'المندوب' : 'Sales Rep'}</TableHead>
                            <TableHead className="text-xs font-semibold">{isRTL ? 'العميل' : 'Customer'}</TableHead>
                            <TableHead className="text-xs font-semibold">{isRTL ? 'السبب' : 'Reason'}</TableHead>
                            <TableHead className="text-xs font-semibold">{isRTL ? 'الكمية' : 'Qty'}</TableHead>
                            <TableHead className="text-xs font-semibold">{isRTL ? 'القيمة' : 'Value'}</TableHead>
                            <TableHead className="text-xs font-semibold">{isRTL ? 'الحالة' : 'Status'}</TableHead>
                            <TableHead />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginated.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={10} className="text-center py-12 text-gray-400">
                                    {isRTL ? 'لا توجد مرتجعات' : 'No return logs found'}
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginated.map((log) => (
                                <TableRow key={log.name} className="hover:bg-gray-50/50">
                                    <TableCell className="font-mono text-xs text-gray-500">{log.name}</TableCell>
                                    <TableCell className="text-sm">{log.return_date}</TableCell>
                                    <TableCell className="text-sm max-w-[130px] truncate">{log.warehouse}</TableCell>
                                    <TableCell className="text-sm text-gray-600">{log.sales_person || '—'}</TableCell>
                                    <TableCell className="text-sm text-gray-600">{log.customer || '—'}</TableCell>
                                    <TableCell className="text-xs text-gray-500">{log.return_reason || '—'}</TableCell>
                                    <TableCell className="text-sm font-medium">{log.total_quantity ?? '—'}</TableCell>
                                    <TableCell className="text-sm font-medium text-orange-700">
                                        {log.total_value ? log.total_value.toLocaleString() : '—'}
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={cn('text-[10px]', getStatusClass(log.status))}>
                                            {log.status || 'Draft'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleView(log)}>
                                            <Eye className="h-3.5 w-3.5 text-gray-500" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>

            {totalPages > 1 && (
                <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{filtered.length} {isRTL ? 'مرتجع' : 'returns'}</span>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span>{currentPage} / {totalPages}</span>
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* View Detail Dialog */}
            <Dialog open={viewDialog.open} onOpenChange={(o) => !o && setViewDialog({ open: false, log: null })}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{isRTL ? 'تفاصيل المرتجع' : 'Return Log Details'}</DialogTitle>
                    </DialogHeader>
                    {loadingDetail ? (
                        <div className="space-y-2 py-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-6" />)}</div>
                    ) : viewDialog.log && (
                        <div className="space-y-3 text-sm">
                            <div className="grid grid-cols-2 gap-3">
                                <div><span className="text-gray-500">{isRTL ? 'التاريخ:' : 'Date:'}</span> <span className="font-medium">{viewDialog.log.return_date}</span></div>
                                <div><span className="text-gray-500">{isRTL ? 'المستودع:' : 'Warehouse:'}</span> <span className="font-medium">{viewDialog.log.warehouse}</span></div>
                                <div><span className="text-gray-500">{isRTL ? 'المندوب:' : 'Rep:'}</span> <span className="font-medium">{viewDialog.log.sales_person || '—'}</span></div>
                                <div><span className="text-gray-500">{isRTL ? 'العميل:' : 'Customer:'}</span> <span className="font-medium">{viewDialog.log.customer || '—'}</span></div>
                                <div><span className="text-gray-500">{isRTL ? 'السبب:' : 'Reason:'}</span> <span className="font-medium">{viewDialog.log.return_reason || '—'}</span></div>
                                <div><span className="text-gray-500">{isRTL ? 'القيمة:' : 'Value:'}</span> <span className="font-medium text-orange-700">{viewDialog.log.total_value?.toLocaleString() || '—'}</span></div>
                            </div>
                            {viewDialog.log.items && viewDialog.log.items.length > 0 && (
                                <div>
                                    <p className="font-semibold mb-2">{isRTL ? 'الأصناف' : 'Items'}</p>
                                    <div className="border rounded-lg overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-gray-50">
                                                    <TableHead className="text-xs">{isRTL ? 'الصنف' : 'Item'}</TableHead>
                                                    <TableHead className="text-xs">{isRTL ? 'الكمية' : 'Qty'}</TableHead>
                                                    <TableHead className="text-xs">{isRTL ? 'السعر' : 'Rate'}</TableHead>
                                                    <TableHead className="text-xs">{isRTL ? 'الإجمالي' : 'Amount'}</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {viewDialog.log.items.map((item, i) => (
                                                    <TableRow key={i}>
                                                        <TableCell className="text-xs">{item.item_code}</TableCell>
                                                        <TableCell className="text-xs">{item.quantity}</TableCell>
                                                        <TableCell className="text-xs">{item.rate ?? '—'}</TableCell>
                                                        <TableCell className="text-xs">{item.amount?.toLocaleString() ?? '—'}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}
                            {viewDialog.log.stock_entry && (
                                <div className="p-2 bg-emerald-50 rounded text-xs text-emerald-700">
                                    {isRTL ? 'قيد المخزون:' : 'Stock Entry:'} <span className="font-mono">{viewDialog.log.stock_entry}</span>
                                </div>
                            )}
                            {/* Submit / Cancel actions */}
                            <div className="flex gap-2 pt-1">
                                {(!viewDialog.log.docstatus || viewDialog.log.docstatus === 0) && (
                                    <Button
                                        size="sm"
                                        className="bg-blue-600 hover:bg-blue-700 text-white"
                                        disabled={submittingReturn}
                                        onClick={handleSubmitReturn}
                                    >
                                        {submittingReturn ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : (isRTL ? 'ترحيل المرتجع' : 'Submit Return')}
                                    </Button>
                                )}
                                {viewDialog.log.docstatus === 1 && (
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        disabled={cancellingReturn}
                                        onClick={() => setCancelConfirmOpen(true)}
                                    >
                                        {cancellingReturn ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : (isRTL ? 'إلغاء المرتجع' : 'Cancel Return')}
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ── Create Return Log Dialog ── */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <RotateCcw className="h-5 w-5 text-orange-600" />
                            {isRTL ? 'سجل مرتجع جديد' : 'New Return Log'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto space-y-4 py-2">
                        <div>
                            <Label className="text-xs font-medium">{isRTL ? 'المستودع *' : 'Warehouse *'}</Label>
                            <select
                                value={newWarehouse}
                                onChange={(e) => setNewWarehouse(e.target.value)}
                                className="mt-1 w-full h-9 rounded-md border border-gray-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                            >
                                <option value="">{isRTL ? '— اختر مستودع —' : '— Select warehouse —'}</option>
                                {activeWarehouses.map((w) => (
                                    <option key={w.name} value={w.name}>{w.warehouse_name || w.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs font-medium">{isRTL ? 'العميل' : 'Customer'}</Label>
                                <Input
                                    className="mt-1 h-9 text-sm"
                                    placeholder={isRTL ? 'اسم العميل' : 'Customer name'}
                                    value={newCustomer}
                                    onChange={(e) => setNewCustomer(e.target.value)}
                                />
                            </div>
                            <div>
                                <Label className="text-xs font-medium">{isRTL ? 'سبب المرتجع' : 'Return Reason'}</Label>
                                <Input
                                    className="mt-1 h-9 text-sm"
                                    placeholder={isRTL ? 'سبب الإرجاع...' : 'Reason...'}
                                    value={newReturnReason}
                                    onChange={(e) => setNewReturnReason(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Items */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <Label className="text-xs font-medium">{isRTL ? 'الأصناف *' : 'Items *'}</Label>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-orange-600"
                                    onClick={() => setNewReturnItems((prev) => [...prev, emptyReturnItem()])}
                                >
                                    <Plus className="h-3 w-3 mr-1" /> {isRTL ? 'إضافة صنف' : 'Add item'}
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {newReturnItems.map((item, idx) => (
                                    <div key={idx} className="flex gap-2 items-center">
                                        <Input
                                            className="h-8 text-xs flex-1"
                                            placeholder={isRTL ? 'كود الصنف' : 'Item code'}
                                            value={item.item_code}
                                            onChange={(e) => setNewReturnItems((prev) => prev.map((it, i) => i === idx ? { ...it, item_code: e.target.value } : it))}
                                        />
                                        <Input
                                            className="h-8 text-xs w-20"
                                            type="number"
                                            min="0.001"
                                            step="any"
                                            placeholder={isRTL ? 'كمية' : 'Qty'}
                                            value={item.quantity}
                                            onChange={(e) => setNewReturnItems((prev) => prev.map((it, i) => i === idx ? { ...it, quantity: e.target.value } : it))}
                                        />
                                        <Input
                                            className="h-8 text-xs w-20"
                                            type="number"
                                            min="0"
                                            step="any"
                                            placeholder={isRTL ? 'سعر' : 'Rate'}
                                            value={item.rate}
                                            onChange={(e) => setNewReturnItems((prev) => prev.map((it, i) => i === idx ? { ...it, rate: e.target.value } : it))}
                                        />
                                        {newReturnItems.length > 1 && (
                                            <button
                                                onClick={() => setNewReturnItems((prev) => prev.filter((_, i) => i !== idx))}
                                                className="text-red-400 hover:text-red-600"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
                        <Button
                            size="sm"
                            className="bg-orange-600 hover:bg-orange-700 text-white"
                            onClick={handleCreate}
                            disabled={creating}
                        >
                            {creating ? <RefreshCw className="h-4 w-4 animate-spin" /> : (isRTL ? 'إنشاء' : 'Create')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        <ConfirmDialog
            open={cancelConfirmOpen}
            onOpenChange={setCancelConfirmOpen}
            title={isRTL ? 'إلغاء المرتجع؟' : 'Cancel this return?'}
            description={isRTL ? 'هل أنت متأكد من إلغاء هذا المرتجع؟' : 'This action cannot be undone.'}
            confirmLabel={isRTL ? 'إلغاء المرتجع' : 'Cancel Return'}
            cancelLabel={isRTL ? 'رجوع' : 'Go Back'}
            onConfirm={handleCancelReturn}
        />
        </div>
    )
}
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// 5. AUDIT LOG TAB
// ─────────────────────────────────────────────
// Movement type colours are now in lib/status-config.ts → getStatusClass()

function AuditLogView({ auditLogs, loading, onRefresh }: { auditLogs: StockMovementAudit[]; loading: boolean; onRefresh: () => void }) {
    const { isRTL } = useI18n()
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState<string>('all')
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 20

    const filtered = useMemo(() => {
        let list = auditLogs
        if (typeFilter !== 'all') list = list.filter((a) => a.movement_type === typeFilter)
        if (search) {
            const q = search.toLowerCase()
            list = list.filter(
                (a) =>
                    a.item_code?.toLowerCase().includes(q) ||
                    a.warehouse?.toLowerCase().includes(q) ||
                    a.reference_name?.toLowerCase().includes(q) ||
                    a.user?.toLowerCase().includes(q)
            )
        }
        return list
    }, [auditLogs, search, typeFilter])

    const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    const totalPages = Math.ceil(filtered.length / itemsPerPage)

    if (loading) return <div className="p-6 space-y-3">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10" />)}</div>

    return (
        <div className="p-6 space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
                    <Input
                        placeholder={isRTL ? 'بحث في سجل الحركات...' : 'Search audit log...'}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className={cn('h-9 text-sm', isRTL ? 'pr-9' : 'pl-9')}
                    />
                </div>
                <div className="flex gap-1.5">
                    {['all', 'In', 'Out', 'Transfer'].map((t) => (
                        <button
                            key={t}
                            onClick={() => { setTypeFilter(t); setCurrentPage(1) }}
                            className={cn(
                                'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                                typeFilter === t ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            )}
                        >
                            {t === 'all' ? (isRTL ? 'الكل' : 'All') : t}
                        </button>
                    ))}
                </div>
                <Button variant="outline" size="sm" onClick={onRefresh}>
                    <RefreshCw className="h-4 w-4" />
                </Button>
            </div>

            <Card className="border-0 shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50/50">
                            <TableHead className="text-xs font-semibold">{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                            <TableHead className="text-xs font-semibold">{isRTL ? 'الصنف' : 'Item'}</TableHead>
                            <TableHead className="text-xs font-semibold">{isRTL ? 'المستودع' : 'Warehouse'}</TableHead>
                            <TableHead className="text-xs font-semibold">{isRTL ? 'النوع' : 'Type'}</TableHead>
                            <TableHead className="text-xs font-semibold text-right">{isRTL ? 'التغيير' : 'Change'}</TableHead>
                            <TableHead className="text-xs font-semibold text-right">{isRTL ? 'القبل' : 'Before'}</TableHead>
                            <TableHead className="text-xs font-semibold text-right">{isRTL ? 'البعد' : 'After'}</TableHead>
                            <TableHead className="text-xs font-semibold">{isRTL ? 'المرجع' : 'Reference'}</TableHead>
                            <TableHead className="text-xs font-semibold">{isRTL ? 'المستخدم' : 'User'}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginated.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center py-12 text-gray-400">
                                    {isRTL ? 'لا توجد حركات' : 'No audit entries found'}
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginated.map((log) => (
                                <TableRow key={log.name} className="hover:bg-gray-50/50">
                                    <TableCell className="text-xs text-gray-500">{log.movement_date}</TableCell>
                                    <TableCell className="text-sm font-medium">{log.item_code}</TableCell>
                                    <TableCell className="text-xs text-gray-600 max-w-[120px] truncate">{log.warehouse}</TableCell>
                                    <TableCell>
                                        <Badge className={cn('text-[10px]', getStatusClass(log.movement_type))}>
                                            {log.movement_type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className={cn('text-sm font-bold text-right tabular-nums', log.quantity_change > 0 ? 'text-emerald-600' : 'text-red-600')}>
                                        {log.quantity_change > 0 ? '+' : ''}{log.quantity_change}
                                    </TableCell>
                                    <TableCell className="text-sm text-right tabular-nums text-gray-500">{log.previous_qty}</TableCell>
                                    <TableCell className="text-sm text-right tabular-nums font-medium">{log.new_qty}</TableCell>
                                    <TableCell className="text-xs font-mono text-gray-400">{log.reference_name || '—'}</TableCell>
                                    <TableCell className="text-xs text-gray-500 max-w-[100px] truncate">{log.user || '—'}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>

            {totalPages > 1 && (
                <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{filtered.length} {isRTL ? 'حركة' : 'entries'}</span>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span>{currentPage} / {totalPages}</span>
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─────────────────────────────────────────────
// 6. BIN STOCK TAB  (live inventory from ERPNext Bin)
// ─────────────────────────────────────────────
function BinStockView({
    binStock,
    warehouses,
    loading,
}: {
    binStock: BinStock[]
    warehouses: Warehouse[]
    loading: boolean
}) {
    const { isRTL } = useI18n()
    const { toast } = useToast()
    const [warehouseFilter, setWarehouseFilter] = useState<string>('all')
    const [search, setSearch] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 25

    // ── availability check ──
    const [checkOpen, setCheckOpen] = useState(false)
    const [checkItem, setCheckItem] = useState('')
    const [checkWarehouse, setCheckWarehouse] = useState('')
    const [checkQty, setCheckQty] = useState('')
    const [checkResult, setCheckResult] = useState<{
        is_available: boolean
        available_qty: number
        requested_qty: number
        shortage: number
    } | null>(null)
    const [checkLoading, setCheckLoading] = useState(false)

    const filtered = useMemo(() => {
        let list = binStock
        if (warehouseFilter !== 'all') list = list.filter((b) => b.warehouse === warehouseFilter)
        if (search) {
            const q = search.toLowerCase()
            list = list.filter(
                (b) =>
                    b.item_code?.toLowerCase().includes(q) ||
                    (b.item_name as string | undefined)?.toLowerCase().includes(q) ||
                    b.warehouse?.toLowerCase().includes(q)
            )
        }
        return list
    }, [binStock, warehouseFilter, search])

    const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    const totalPages = Math.ceil(filtered.length / itemsPerPage)
    const totalValue = filtered.reduce((s, b) => s + (b.stock_value || 0), 0)

    const handleCheckAvailability = async () => {
        if (!checkItem || !checkWarehouse || !checkQty) return
        setCheckLoading(true)
        setCheckResult(null)
        try {
            const result = await stockApi.checkItemAvailability(checkItem, checkWarehouse, Number(checkQty))
            setCheckResult(result)
        } catch (e: any) {
            toast({ title: 'Error', description: e?.message, variant: 'destructive' })
        } finally {
            setCheckLoading(false)
        }
    }

    const activeWarehouses = useMemo(() =>
        warehouses.filter((w) => !w.is_group && !w.disabled),
        [warehouses])

    if (loading) return (
        <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10" />)}
        </div>
    )

    return (
        <div className="p-6 space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
                <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                        <p className="text-2xl font-bold text-gray-900">{binStock.length.toLocaleString()}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{isRTL ? 'إجمالي الأصناف (كل المستودعات)' : 'Total SKUs (all warehouses)'}</p>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                        <p className="text-2xl font-bold text-gray-900">{filtered.length.toLocaleString()}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{isRTL ? 'الأصناف حسب الفلتر' : 'SKUs (filtered)'}</p>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                        <p className="text-2xl font-bold text-gray-900">{totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{isRTL ? 'إجمالي قيمة المخزون (فلتر)' : 'Total stock value (filtered)'}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters row */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
                    <Input
                        placeholder={isRTL ? 'ابحث بكود أو اسم الصنف...' : 'Search by item code or name...'}
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
                        className={cn('h-9 text-sm', isRTL ? 'pr-9' : 'pl-9')}
                    />
                </div>
                <select
                    value={warehouseFilter}
                    onChange={(e) => { setWarehouseFilter(e.target.value); setCurrentPage(1) }}
                    className="h-9 rounded-md border border-gray-200 px-3 text-sm text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                    <option value="all">{isRTL ? 'كل المستودعات' : 'All Warehouses'} ({binStock.length})</option>
                    {activeWarehouses.map((w) => {
                        const cnt = binStock.filter((b) => b.warehouse === w.name).length
                        if (cnt === 0) return null
                        return (
                            <option key={w.name} value={w.name}>
                                {w.warehouse_name || w.name} ({cnt})
                            </option>
                        )
                    })}
                </select>
                <Button
                    variant="outline"
                    size="sm"
                    className="text-orange-600 border-orange-200 hover:bg-orange-50"
                    onClick={() => { setCheckOpen(true); setCheckResult(null); setCheckItem(''); setCheckWarehouse(''); setCheckQty('') }}
                >
                    <BarChart3 className="h-4 w-4" />
                    <span className={cn('text-xs', isRTL ? 'mr-1.5' : 'ml-1.5')}>{isRTL ? 'فحص التوفر' : 'Check Availability'}</span>
                </Button>
            </div>

            {/* Table */}
            <Card className="border-0 shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50/50">
                            <TableHead className="text-xs font-semibold">{isRTL ? 'كود الصنف' : 'Item Code'}</TableHead>
                            <TableHead className="text-xs font-semibold">{isRTL ? 'اسم الصنف' : 'Item Name'}</TableHead>
                            <TableHead className="text-xs font-semibold">{isRTL ? 'المستودع' : 'Warehouse'}</TableHead>
                            <TableHead className="text-xs font-semibold text-right">{isRTL ? 'الكمية الفعلية' : 'Actual Qty'}</TableHead>
                            <TableHead className="text-xs font-semibold">{isRTL ? 'الوحدة' : 'UOM'}</TableHead>
                            <TableHead className="text-xs font-semibold text-right">{isRTL ? 'سعر التقييم' : 'Val. Rate'}</TableHead>
                            <TableHead className="text-xs font-semibold text-right">{isRTL ? 'قيمة المخزون' : 'Stock Value'}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginated.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-12 text-gray-400 text-sm">
                                    {isRTL ? 'لا يوجد مخزون بالفلتر الحالي' : 'No stock found for current filter'}
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginated.map((b, idx) => (
                                <TableRow key={`${b.item_code}-${b.warehouse}-${idx}`} className="hover:bg-gray-50/50">
                                    <TableCell className="font-mono text-xs font-medium text-gray-800">{b.item_code}</TableCell>
                                    <TableCell className="text-xs text-gray-600 max-w-[150px] truncate">{(b as any).item_name || '—'}</TableCell>
                                    <TableCell className="text-xs text-gray-600 max-w-[160px] truncate">{b.warehouse}</TableCell>
                                    <TableCell className="text-sm font-bold text-right tabular-nums text-emerald-700">{b.actual_qty.toLocaleString()}</TableCell>
                                    <TableCell className="text-xs text-gray-500">{b.stock_uom || '—'}</TableCell>
                                    <TableCell className="text-sm text-right tabular-nums text-gray-600">
                                        {b.valuation_rate != null
                                            ? b.valuation_rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                            : '—'}
                                    </TableCell>
                                    <TableCell className="text-sm font-semibold text-right tabular-nums text-gray-900">
                                        {b.stock_value != null
                                            ? b.stock_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                            : '—'}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{filtered.length.toLocaleString()} {isRTL ? 'صنف' : 'items'}</span>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span>{currentPage} / {totalPages}</span>
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* ── Check Availability Dialog ── */}
            <Dialog open={checkOpen} onOpenChange={setCheckOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-orange-600" />
                            {isRTL ? 'فحص توفر الصنف' : 'Check Item Availability'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div>
                            <Label className="text-xs font-medium">{isRTL ? 'كود الصنف *' : 'Item Code *'}</Label>
                            <Input
                                className="mt-1 h-9"
                                value={checkItem}
                                onChange={(e) => setCheckItem(e.target.value)}
                                placeholder="e.g. ITEM-001"
                            />
                        </div>
                        <div>
                            <Label className="text-xs font-medium">{isRTL ? 'المستودع *' : 'Warehouse *'}</Label>
                            <select
                                value={checkWarehouse}
                                onChange={(e) => setCheckWarehouse(e.target.value)}
                                className="mt-1 w-full h-9 rounded-md border border-gray-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                            >
                                <option value="">{isRTL ? '— اختر مستودع —' : '— Select warehouse —'}</option>
                                {activeWarehouses.map((w) => (
                                    <option key={w.name} value={w.name}>{w.warehouse_name || w.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <Label className="text-xs font-medium">{isRTL ? 'الكمية المطلوبة *' : 'Requested Qty *'}</Label>
                            <Input
                                className="mt-1 h-9"
                                type="number"
                                min="0.001"
                                step="any"
                                value={checkQty}
                                onChange={(e) => setCheckQty(e.target.value)}
                                placeholder="1"
                            />
                        </div>

                        {checkResult && (
                            <div className={cn(
                                'rounded-lg border p-4 text-sm',
                                checkResult.is_available
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                    : 'bg-red-50 border-red-200 text-red-800'
                            )}>
                                <p className="font-bold text-base">
                                    {checkResult.is_available
                                        ? (isRTL ? '✅ متوفر' : '✅ Available')
                                        : (isRTL ? '❌ غير كافٍ' : '❌ Insufficient stock')}
                                </p>
                                <div className="mt-2 space-y-1 text-xs">
                                    <p>{isRTL ? 'الكمية المتاحة' : 'Available'}: <strong>{checkResult.available_qty}</strong></p>
                                    <p>{isRTL ? 'الكمية المطلوبة' : 'Requested'}: <strong>{checkResult.requested_qty}</strong></p>
                                    {!checkResult.is_available && (
                                        <p className="font-semibold">{isRTL ? 'النقص' : 'Shortage'}: <strong>{checkResult.shortage}</strong></p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setCheckOpen(false)}>
                            {isRTL ? 'إغلاق' : 'Close'}
                        </Button>
                        <Button
                            size="sm"
                            className="bg-orange-600 hover:bg-orange-700 text-white"
                            onClick={handleCheckAvailability}
                            disabled={checkLoading || !checkItem || !checkWarehouse || !checkQty}
                        >
                            {checkLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : (isRTL ? 'فحص' : 'Check')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export function AdminStockManagement() {
    const { isRTL } = useI18n()
    const [activeTab, setActiveTab] = useState('overview')
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [loadErrors, setLoadErrors] = useState<string[]>([])

    const [warehouses, setWarehouses] = useState<Warehouse[]>([])
    const [transferRequests, setTransferRequests] = useState<StockTransferRequest[]>([])
    const [returnLogs, setReturnLogs] = useState<ReturnLog[]>([])
    const [auditLogs, setAuditLogs] = useState<StockMovementAudit[]>([])
    const [binStock, setBinStock] = useState<BinStock[]>([])

    const pendingTransfers = useMemo(() => transferRequests.filter((r) => r.status === 'Pending'), [transferRequests])

    const loadAll = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true)
        else setLoading(true)

        // Use allSettled so a single failed endpoint doesn't blank the whole page
        const [whRes, trRes, rlRes, alRes, binRes] = await Promise.allSettled([
            stockApi.getWarehouses(),
            stockApi.getTransferRequests(),
            stockApi.getReturnLogs(),
            stockApi.getAuditLogs(),
            stockApi.getBinStock(),
        ])

        const errors: string[] = []

        if (whRes.status === 'fulfilled') setWarehouses(whRes.value)
        else errors.push(`Warehouses: ${(whRes.reason as Error)?.message || 'Failed to load'}`)

        if (trRes.status === 'fulfilled') setTransferRequests(trRes.value)
        else errors.push(`Transfer Requests: ${(trRes.reason as Error)?.message || 'Failed to load'}`)

        if (rlRes.status === 'fulfilled') setReturnLogs(rlRes.value)
        else errors.push(`Return Logs: ${(rlRes.reason as Error)?.message || 'Failed to load'}`)

        if (alRes.status === 'fulfilled') setAuditLogs(alRes.value)
        else errors.push(`Audit Log: ${(alRes.reason as Error)?.message || 'Failed to load'}`)

        if (binRes.status === 'fulfilled') setBinStock(binRes.value)
        else errors.push(`Bin Stock: ${(binRes.reason as Error)?.message || 'Failed to load'}`)

        setLoadErrors(errors)
        setLoading(false)
        setRefreshing(false)
    }, [])

    useEffect(() => { loadAll() }, [loadAll])

    const tabs = [
        { id: 'overview', labelAr: 'نظرة عامة', labelEn: 'Overview', icon: Package },
        { id: 'inventory', labelAr: 'المخزون الحي', labelEn: 'Live Inventory', icon: Database },
        { id: 'warehouses', labelAr: 'المستودعات', labelEn: 'Warehouses', icon: WarehouseIcon },
        {
            id: 'transfers',
            labelAr: 'طلبات النقل',
            labelEn: 'Transfer Requests',
            icon: ArrowRightLeft,
            badge: pendingTransfers.length || undefined,
        },
        { id: 'returns', labelAr: 'المرتجعات', labelEn: 'Return Logs', icon: RotateCcw },
        { id: 'audit', labelAr: 'سجل الحركات', labelEn: 'Audit Log', icon: ClipboardList },
    ]

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
                        <BoxIcon className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                        <h2 className="text-[15px] font-bold text-gray-900">
                            {isRTL ? 'إدارة المخزون' : 'Stock Management'}
                        </h2>
                        <p className="text-[11px] text-gray-400">
                            {isRTL ? 'المستودعات، النقل، المرتجعات، الحركات' : 'Warehouses, transfers, returns, movements'}
                        </p>
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => loadAll(true)} disabled={refreshing}>
                    <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
                    <span className={cn('text-xs', isRTL ? 'mr-1.5' : 'ml-1.5')}>{isRTL ? 'تحديث' : 'Refresh'}</span>
                </Button>
            </div>

            {/* Tabs */}
            <div className={cn('flex border-b border-gray-100 bg-white px-4 flex-shrink-0 overflow-x-auto')}>
                {tabs.map((tab) => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.id
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap relative',
                                isActive
                                    ? 'border-orange-600 text-orange-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
                            )}
                        >
                            <Icon className="h-4 w-4" />
                            {isRTL ? tab.labelAr : tab.labelEn}
                            {tab.badge != null && tab.badge > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Error banner — shown when one or more endpoints fail */}
            {loadErrors.length > 0 && (
                <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="flex-1">
                        <p className="font-semibold">{isRTL ? 'فشل تحميل بعض البيانات' : 'Some data failed to load'}</p>
                        <ul className="mt-1 list-disc list-inside space-y-0.5 text-xs opacity-80">
                            {loadErrors.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                    </div>
                    <button className="shrink-0 text-red-400 hover:text-red-600" onClick={() => setLoadErrors([])}>
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Tab content */}
            <div className="flex-1 overflow-auto">
                {activeTab === 'overview' && (
                    <StockOverview
                        warehouses={warehouses}
                        pendingTransfers={pendingTransfers}
                        returnLogs={returnLogs}
                        auditLogs={auditLogs}
                        loading={loading}
                        onNavigate={setActiveTab}
                    />
                )}
                {activeTab === 'inventory' && (
                    <BinStockView
                        binStock={binStock}
                        warehouses={warehouses}
                        loading={loading}
                    />
                )}
                {activeTab === 'warehouses' && (
                    <WarehousesView
                        warehouses={warehouses}
                        binStock={binStock}
                        loading={loading}
                    />
                )}
                {activeTab === 'transfers' && (
                    <TransferRequestsView
                        requests={transferRequests}
                        warehouses={warehouses}
                        loading={loading}
                        onRefresh={() => loadAll(true)}
                    />
                )}
                {activeTab === 'returns' && (
                    <ReturnLogsView
                        returnLogs={returnLogs}
                        warehouses={warehouses}
                        loading={loading}
                        onRefresh={() => loadAll(true)}
                    />
                )}
                {activeTab === 'audit' && (
                    <AuditLogView
                        auditLogs={auditLogs}
                        loading={loading}
                        onRefresh={() => loadAll(true)}
                    />
                )}
            </div>
        </div>
    )
}
