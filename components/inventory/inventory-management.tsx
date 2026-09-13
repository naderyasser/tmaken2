'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/hooks/use-toast'
import { csrfFetch } from '@/lib/csrf'
import { frappeClient } from '@/lib/api-client'
import { printDoc } from '@/lib/print-doc'
import { printPartsInvoice } from '@/lib/print-parts-invoice'
import { parseInvoiceDocument, dashifyToyotaCode } from '@/lib/invoice-file'
import { useBrand, type TenantBrand } from '@/hooks/use-brand'
import { useCompany } from '@/hooks/use-company'
import {
    stockApi,
    type Warehouse,
    type StockTransferRequest,
    type StockMovementAudit,
    type BinStock,
    type SalesPerson,
    type Item,
    type ItemGroup,
    type UOM,
    type UOMConversionDetail,
    type StockReconciliation,
} from '@/lib/stock-api'
import { salesApi, type ProductReturn, type ProductReturnItem } from '@/lib/sales-api'
import { cn } from '@/lib/utils'
import { getStatusClass } from '@/lib/status-config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
    Package,
    Warehouse as WarehouseIcon,
    ArrowRightLeft,
    RotateCcw,
    ClipboardList,
    Database,
    RefreshCw,
    Search,
    Plus,
    Eye,
    Printer,
    MoreHorizontal,
    ChevronLeft,
    ChevronRight,
    AlertCircle,
    AlertTriangle,
    X,
    Truck,
    MapPin,
    Users,
    BarChart3,
    Ban,
    CheckCircle2,
    Pencil,
    Link2,
    BoxesIcon,
    ArrowDownUp,
    Trash2,
    TrendingUp,
    TrendingDown,
    User,
    FileText,
    Scan,
    ShoppingBag,
    Tag,
    Hash,
    DollarSign,
    ToggleLeft,
    ToggleRight,
    Image as ImageIcon,
    Scale,
    Download,
    Upload,
    Filter,
} from 'lucide-react'

// ═══════════════════════════════════════════════
// TRANSLATION MAPS
// ═══════════════════════════════════════════════
const WAREHOUSE_TYPE_AR: Record<string, string> = {
    Main: 'رئيسي', Van: 'فان', 'Customer Location': 'موقع عميل',
    Temporary: 'مؤقت', Damaged: 'تالف', Returns: 'مرتجعات',
}
const TRANSFER_STATUS_AR: Record<string, string> = {
    Pending: 'معلق', Accepted: 'مقبول', 'Partially Accepted': 'مقبول جزئياً',
    Rejected: 'مرفوض', Completed: 'مكتمل',
}
const MOVEMENT_TYPE_AR: Record<string, string> = {
    In: 'وارد', Out: 'صادر', Transfer: 'تحويل',
}
const RETURN_REASON_AR: Record<string, string> = {
    Damaged: 'تالف', Expired: 'منتهي الصلاحية', 'Wrong Product': 'منتج خاطئ',
    'Quality Issue': 'مشكلة جودة', Other: 'أخرى',
}
const RETURN_STATUS_AR: Record<string, string> = {
    Draft: 'مسودة', Submitted: 'مُرسَل', Accepted: 'مقبول',
    Rejected: 'مرفوض', 'Credit Note Issued': 'إشعار دائن', Cancelled: 'ملغى',
}
const UOM_AR: Record<string, string> = {
    Nos: 'قطعة', Kg: 'كيلوجرام', Gram: 'جرام', Liter: 'لتر', Meter: 'متر',
    Box: 'صندوق', Pack: 'عبوة', Carton: 'كرتون', Pair: 'زوج', Dozen: 'درزن',
    Set: 'طقم', Roll: 'رول', Bag: 'كيس', Bottle: 'زجاجة', Can: 'علبة',
}
/** Helper: translate a value using a map if RTL, else return original */
function tr(map: Record<string, string>, val: string, isRTL: boolean): string {
    return isRTL ? (map[val] || val) : val
}
/** Currency label */
function cur(isRTL: boolean): string { return isRTL ? 'ر.س' : 'SAR' }

/** Letterhead name for printed documents: tenant brand, else a generic label. */
function brandLabel(brand: TenantBrand | undefined, isRTL: boolean): string {
    return brand?.appName || (isRTL ? 'نظام المخازن' : 'Inventory System')
}

// ── html5-qrcode lazy import ──
let Html5QrcodeModule: any = null
async function getHtml5Qrcode() {
    if (!Html5QrcodeModule) {
        Html5QrcodeModule = await import('html5-qrcode')
    }
    return Html5QrcodeModule
}

// Barcode formats to support (linear + 2D)
function getBarcodeFormats(mod: any) {
    const f = mod.Html5QrcodeSupportedFormats
    if (!f) return undefined
    return [
        f.QR_CODE,
        f.EAN_13, f.EAN_8,
        f.UPC_A, f.UPC_E,
        f.CODE_128, f.CODE_39, f.CODE_93,
        f.ITF,
        f.CODABAR,
        f.DATA_MATRIX,
        f.PDF_417,
    ].filter(Boolean)
}

// ═══════════════════════════════════════════════
// ITEM SEARCH INPUT  (search by code OR name + barcode scan)
// ═══════════════════════════════════════════════
function ItemSearchInput({
    value, onChange, placeholder, className,
}: {
    value: string
    onChange: (val: string) => void
    placeholder?: string
    className?: string
}) {
    const { isRTL } = useI18n()
    const [results, setResults] = useState<Array<{ name: string; item_name: string; stock_uom: string; _matchedBy?: 'code' | 'name' }>>([])
    const [open, setOpen] = useState(false)
    const [searching, setSearching] = useState(false)
    const [scanning, setScanning] = useState(false)
    const [camError, setCamError] = useState<string | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const html5ScannerRef = useRef<any>(null)
    const scannerContainerRef = useRef<HTMLDivElement>(null)

    // close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    // search by both item code and item name
    useEffect(() => {
        if (!value || value.length < 2) { setResults([]); setOpen(false); return }
        const timer = setTimeout(async () => {
            setSearching(true)
            try {
                const res = await stockApi.searchItems(value, 10)
                setResults(res)
                setOpen(res.length > 0)
            } catch { } finally { setSearching(false) }
        }, 300)
        return () => clearTimeout(timer)
    }, [value])

    // cleanup on unmount
    useEffect(() => () => stopCamera(), [])

    const stopCamera = () => {
        if (html5ScannerRef.current) {
            try {
                const s = html5ScannerRef.current
                html5ScannerRef.current = null
                s.stop().catch(() => { })
            } catch { }
        }
        setScanning(false)
    }

    // When overlay is rendered, start html5-qrcode
    const pendingStartRef = useRef<{ mod: any } | null>(null)
    useEffect(() => {
        if (!scanning || !pendingStartRef.current) return
        const { mod } = pendingStartRef.current
        pendingStartRef.current = null
        const tryStart = (attempt: number) => {
            const el = scannerContainerRef.current
            if (!el) {
                if (attempt < 15) setTimeout(() => tryStart(attempt + 1), 100)
                return
            }
            const scannerId = 'item-search-scanner-' + Date.now()
            el.id = scannerId
            const formats = getBarcodeFormats(mod)
            const scanner = new mod.Html5Qrcode(scannerId, formats ? { formatsToSupport: formats, verbose: false } : undefined)
            html5ScannerRef.current = scanner
            scanner.start(
                { facingMode: 'environment' },
                { fps: 15, qrbox: { width: 300, height: 150 }, aspectRatio: 1.777 },
                (decodedText: string) => {
                    onChange(decodedText)
                    stopCamera()
                },
                () => { }
            ).catch((err: any) => {
                console.error('Scanner start error:', err)
                setCamError(isRTL ? 'تعذر الوصول للكاميرا' : 'Camera access denied')
                stopCamera()
            })
        }
        tryStart(0)
    }, [scanning])

    const startScan = async () => {
        setCamError(null)
        try {
            const mod = await getHtml5Qrcode()
            pendingStartRef.current = { mod }
            setScanning(true)
        } catch {
            setCamError(isRTL ? 'تعذر تحميل ماسح الباركود' : 'Failed to load barcode scanner')
        }
    }

    return (
        <div ref={containerRef} className="relative flex-1">
            {/* Input + scan button */}
            <div className="flex gap-1 items-center">
                <div className="relative flex-1">
                    <Input
                        className={cn('h-8 text-xs', className)}
                        placeholder={placeholder}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onFocus={() => results.length > 0 && setOpen(true)}
                    />
                    {searching && <RefreshCw className="absolute right-2 top-1.5 h-3.5 w-3.5 animate-spin text-gray-400 pointer-events-none" />}
                </div>
                <button
                    type="button"
                    onClick={startScan}
                    title={isRTL ? 'مسح الباركود' : 'Scan barcode'}
                    className="h-8 w-8 flex items-center justify-center rounded-md border border-gray-200 hover:bg-orange-50 hover:border-orange-300 text-gray-400 hover:text-orange-600 transition-colors flex-shrink-0"
                >
                    <Scan className="h-3.5 w-3.5" />
                </button>
            </div>

            {/* Camera error message */}
            {camError && <p className="text-[10px] text-red-500 mt-0.5 px-1">{camError}</p>}

            {/* Barcode scanner overlay */}
            {scanning && (
                <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col items-center justify-center">
                    <div className="relative w-full max-w-sm mx-4">
                        <div ref={scannerContainerRef} className="rounded-2xl overflow-hidden" />
                        <p className="text-white/80 text-sm text-center mt-3">{isRTL ? 'وجّه الكاميرا نحو الباركود' : 'Point the camera at the barcode'}</p>
                        <button
                            type="button"
                            onClick={stopCamera}
                            className="mt-3 w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm border border-white/20 transition-colors"
                        >
                            {isRTL ? 'إلغاء' : 'Cancel'}
                        </button>
                    </div>
                </div>
            )}

            {/* Dropdown results */}
            {open && results.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg max-h-44 overflow-y-auto">
                    {results.map((r) => (
                        <button
                            key={r.name}
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-orange-50 border-b border-gray-50 last:border-0"
                            onMouseDown={(e) => { e.preventDefault(); onChange(r.name); setOpen(false) }}
                        >
                            {r._matchedBy === 'name' ? (
                                // Matched by item_name — show name prominently
                                <>
                                    <span className="block text-xs font-semibold text-gray-800">{r.item_name}</span>
                                    <span className="text-[10px] text-gray-400">{r.name}{r.stock_uom && ` · ${isRTL ? (UOM_AR[r.stock_uom] || r.stock_uom) : r.stock_uom}`}</span>
                                </>
                            ) : (
                                // Matched by item code
                                <>
                                    <span className="text-xs font-medium text-gray-800">{r.name}</span>
                                    {r.item_name !== r.name && <span className="text-[10px] text-gray-400 ml-1.5">— {r.item_name}</span>}
                                    {r.stock_uom && <span className="text-orange-500 ml-1.5 text-[10px]">({isRTL ? (UOM_AR[r.stock_uom] || r.stock_uom) : r.stock_uom})</span>}
                                </>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

// ═══════════════════════════════════════════════
// CUSTOMER SEARCH INPUT
// ═══════════════════════════════════════════════
function CustomerSearchInput({
    value, onChange, isRTL,
}: {
    value: string
    onChange: (val: string) => void
    isRTL: boolean
}) {
    const [mode, setMode] = useState<'registered' | 'external'>('registered')
    const [results, setResults] = useState<Array<{ name: string; customer_name: string; customer_group?: string }>>([])
    const [open, setOpen] = useState(false)
    const [searching, setSearching] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    useEffect(() => {
        if (mode !== 'registered' || !value || value.length < 2) { setResults([]); setOpen(false); return }
        const timer = setTimeout(async () => {
            setSearching(true)
            try {
                const res = await stockApi.searchCustomers(value, 8)
                setResults(res)
                setOpen(res.length > 0)
            } catch { } finally { setSearching(false) }
        }, 300)
        return () => clearTimeout(timer)
    }, [value, mode])

    const handleModeChange = (newMode: 'registered' | 'external') => {
        setMode(newMode)
        onChange('')
        setResults([])
        setOpen(false)
    }

    return (
        <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
                {isRTL ? 'العميل (اختياري)' : 'Customer (optional)'}
            </label>
            {/* Toggle */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-2 w-fit">
                <button
                    type="button"
                    onClick={() => handleModeChange('registered')}
                    className={cn(
                        'px-3 py-1 text-xs font-medium transition-colors',
                        mode === 'registered' ? 'bg-purple-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                    )}
                >
                    {isRTL ? 'مسجّل في النظام' : 'Registered'}
                </button>
                <button
                    type="button"
                    onClick={() => handleModeChange('external')}
                    className={cn(
                        'px-3 py-1 text-xs font-medium transition-colors border-l border-gray-200',
                        mode === 'external' ? 'bg-purple-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                    )}
                >
                    {isRTL ? 'عميل خارجي' : 'External'}
                </button>
            </div>

            {mode === 'registered' ? (
                <div ref={containerRef} className="relative">
                    <Input
                        className="h-9 text-sm"
                        placeholder={isRTL ? 'ابحث باسم العميل...' : 'Search customer name...'}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onFocus={() => results.length > 0 && setOpen(true)}
                    />
                    {searching && <RefreshCw className="absolute right-2.5 top-2.5 h-3.5 w-3.5 animate-spin text-gray-400 pointer-events-none" />}
                    {value && !searching && (
                        <button
                            type="button"
                            className="absolute right-2.5 top-2.5 text-gray-300 hover:text-gray-500"
                            onMouseDown={(e) => { e.preventDefault(); onChange(''); setOpen(false) }}
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                    {open && results.length > 0 && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg max-h-44 overflow-y-auto">
                            {results.map((c) => (
                                <button
                                    key={c.name}
                                    type="button"
                                    className="w-full text-left px-3 py-2 hover:bg-purple-50 text-sm border-b border-gray-50 last:border-0"
                                    onMouseDown={(e) => { e.preventDefault(); onChange(c.customer_name); setOpen(false) }}
                                >
                                    <span className="font-medium text-gray-800">{c.customer_name}</span>
                                    {c.name !== c.customer_name && (
                                        <span className="text-gray-400 text-xs ml-2">({c.name})</span>
                                    )}
                                    {c.customer_group && (
                                        <span className="text-purple-400 text-xs ml-2">{c.customer_group}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                    {value.length >= 2 && !searching && results.length === 0 && !open && (
                        <p className="text-[11px] text-gray-400 mt-1">{isRTL ? 'لا يوجد عميل بهذا الاسم' : 'No customer found'}</p>
                    )}
                </div>
            ) : (
                <Input
                    className="h-9 text-sm"
                    placeholder={isRTL ? 'اكتب اسم العميل الخارجي...' : 'Enter external customer name...'}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
            )}
        </div>
    )
}

// ═══════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════
interface InventoryManagementProps {
    activeTab: string
    onTabChange: (tab: string) => void
    /** Tenant has the sales-reps module. When false the inventory UI drops every
     *  rep/customer-rep trace so it reads as a standalone warehouse system. */
    hasSales?: boolean
}

export function InventoryManagement({ activeTab, onTabChange, hasSales = true }: InventoryManagementProps) {
    const { isRTL } = useI18n()
    const { toast } = useToast()
    const { company: activeCompanyFilter, isAdmin, allCompanies } = useCompany()
    const brand = useBrand()

    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [loadErrors, setLoadErrors] = useState<string[]>([])

    const [warehouses, setWarehouses] = useState<Warehouse[]>([])
    const [transferRequests, setTransferRequests] = useState<StockTransferRequest[]>([])
    const [returnLogs, setReturnLogs] = useState<ProductReturn[]>([])
    const [auditLogs, setAuditLogs] = useState<StockMovementAudit[]>([])
    const [binStock, setBinStock] = useState<BinStock[]>([])
    const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([])
    const [items, setItems] = useState<Item[]>([])
    const [itemGroups, setItemGroups] = useState<ItemGroup[]>([])
    const [uoms, setUOMs] = useState<UOM[]>([])
    const [reconciliations, setReconciliations] = useState<StockReconciliation[]>([])

    const pendingTransfers = useMemo(
        () => transferRequests.filter((r) => r.status === 'Pending'),
        [transferRequests]
    )

    // ── Lazy Loading: per-tab data requirements ──
    type DataKey = 'warehouses' | 'transferRequests' | 'returnLogs' | 'auditLogs' | 'binStock' | 'salesPersons' | 'items' | 'itemGroups' | 'uoms' | 'reconciliations'

    const TAB_DATA_NEEDS: Record<string, DataKey[]> = {
        dashboard: ['warehouses', 'transferRequests', 'returnLogs', 'auditLogs', 'binStock'],
        warehouses: ['warehouses', 'binStock', 'salesPersons'],
        products: ['items', 'itemGroups', 'uoms', 'warehouses', 'binStock'],
        inventory: ['binStock', 'warehouses'],
        transfers: ['transferRequests', 'warehouses', 'salesPersons'],
        returns: ['returnLogs', 'warehouses'],
        audit: ['auditLogs'],
        reconciliation: ['binStock', 'warehouses', 'reconciliations', 'items', 'itemGroups'],
    }

    const loadedKeysRef = useRef<Set<DataKey>>(new Set())
    const inFlightRef = useRef<Map<string, Promise<string | null>>>(new Map())

    const parseMsg = useCallback((reason: unknown, label: string) => {
        const msg = (reason as Error)?.message || String(reason)
        if (msg.includes('does not exist') || msg.includes('not found') || msg.includes('No module'))
            return `${label}: ${isRTL ? 'DocType غير موجود — تأكد من تطبيق bench migrate على السيرفر' : 'DocType not found — run bench migrate on server'}`
        if (msg.includes('403') || msg.includes('PermissionError') || msg.includes('not permitted'))
            return `${label}: ${isRTL ? 'لا صلاحية' : 'No permission'}`
        return `${label}: ${msg}`
    }, [isRTL])

    const fetchKey = useCallback(async (key: DataKey): Promise<string | null> => {
        try {
            switch (key) {
                case 'warehouses': { const d = await stockApi.getWarehouses(activeCompanyFilter ? { company: activeCompanyFilter } : undefined); setWarehouses(d); break }
                case 'transferRequests': { const d = await stockApi.getTransferRequests(); setTransferRequests(d); break }
                case 'returnLogs': { const d = await salesApi.getProductReturns(); setReturnLogs(d); break }
                case 'auditLogs': { const d = await stockApi.getAuditLogs(); setAuditLogs(d); break }
                case 'binStock': { const d = await stockApi.getBinStock(); setBinStock(d); break }
                case 'salesPersons': { const d = await stockApi.getSalesPersons(activeCompanyFilter || undefined); setSalesPersons(d); break }
                case 'items': { const d = await stockApi.getItems(); setItems(d); break }
                case 'itemGroups': { const d = await stockApi.getItemGroups(); setItemGroups(d); break }
                case 'uoms': { const d = await stockApi.getUOMs(); setUOMs(d); break }
                case 'reconciliations': { const d = await stockApi.getStockReconciliations(); setReconciliations(d); break }
            }
            loadedKeysRef.current.add(key)
            return null
        } catch (err) {
            const labels: Record<DataKey, [string, string]> = {
                warehouses: ['المستودعات', 'Warehouses'],
                transferRequests: ['طلبات النقل', 'Transfers'],
                returnLogs: ['المرتجعات', 'Returns'],
                auditLogs: ['سجل الحركات', 'Audit Log'],
                binStock: ['المخزون', 'Stock'],
                salesPersons: ['المندوبين', 'Sales Persons'],
                items: ['المنتجات', 'Products'],
                itemGroups: ['مجموعات الأصناف', 'Item Groups'],
                uoms: ['الوحدات', 'UOMs'],
                reconciliations: ['تسوية الجرد', 'Reconciliations'],
            }
            const [ar, en] = labels[key]
            // Silently skip non-critical DocType errors (may not exist or no permission)
            if (key === 'itemGroups' || key === 'uoms' || key === 'reconciliations') return null
            return parseMsg(err, isRTL ? ar : en)
        }
    }, [isRTL, parseMsg, activeCompanyFilter])

    /** fetchKey with concurrent-duplicate suppression. */
    const fetchKeyDedup = useCallback((key: DataKey): Promise<string | null> => {
        const sig = `${key}|${activeCompanyFilter || ''}`
        const existing = inFlightRef.current.get(sig)
        if (existing) return existing
        const p = fetchKey(key).finally(() => { inFlightRef.current.delete(sig) })
        inFlightRef.current.set(sig, p)
        return p
    }, [fetchKey, activeCompanyFilter])

    /** Load only the data needed for a specific tab (skips already-loaded keys unless forceRefresh) */
    const loadForTab = useCallback(async (tab: string, forceRefresh = false) => {
        const needed = (TAB_DATA_NEEDS[tab] || TAB_DATA_NEEDS.dashboard)
            // Stock-only tenant: sales persons don't exist as a concept in the UI.
            .filter(k => hasSales || k !== 'salesPersons')
        const keysToFetch = forceRefresh ? needed : needed.filter(k => !loadedKeysRef.current.has(k))
        if (keysToFetch.length === 0) return

        if (forceRefresh) setRefreshing(true)
        else setLoading(true)

        const results = await Promise.all(keysToFetch.map(k => fetchKeyDedup(k)))
        const errors = results.filter((r): r is string => r !== null)

        if (errors.length > 0) setLoadErrors(prev => {
            const combined = [...prev.filter(e => !errors.some(ne => ne === e)), ...errors]
            return combined
        })
        setLoading(false)
        setRefreshing(false)
    }, [fetchKeyDedup, hasSales])

    /** Backward-compatible loadAll — fetches ALL 9 data keys (used for global refresh) */
    const loadAll = useCallback(async (isRefresh = false) => {
        loadedKeysRef.current.clear()
        setLoadErrors([])
        if (isRefresh) setRefreshing(true)
        else setLoading(true)

        const allKeys: DataKey[] = ['warehouses', 'transferRequests', 'returnLogs', 'auditLogs', 'binStock', 'salesPersons', 'items', 'itemGroups', 'uoms', 'reconciliations']
        const results = await Promise.all(allKeys.map(k => fetchKeyDedup(k)))
        const errors = results.filter((r): r is string => r !== null)

        setLoadErrors(errors)
        setLoading(false)
        setRefreshing(false)
    }, [fetchKeyDedup])

    // On mount + tab change: lazy-load only what's needed
    useEffect(() => { loadForTab(activeTab) }, [activeTab, loadForTab])

    // When company filter changes, force reload company-dependent data
    useEffect(() => {
        if (activeCompanyFilter !== undefined) {
            // Clear loaded keys for company-dependent data so they get refetched
            loadedKeysRef.current.delete('warehouses')
            loadedKeysRef.current.delete('salesPersons')
            loadForTab(activeTab)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeCompanyFilter])

    return (
        <div className="h-full flex flex-col">
            {/* ── Top gradient accent ── */}
            <div className="h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 flex-shrink-0" />
            {/* ── Refresh bar ── */}
            <div className="flex items-center justify-end px-6 py-3 border-b border-gray-100 bg-white flex-shrink-0">
                <Button variant="outline" size="sm" onClick={() => loadForTab(activeTab, true)} disabled={refreshing}>
                    <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
                    <span className={cn('text-xs', isRTL ? 'mr-1.5' : 'ml-1.5')}>{isRTL ? 'تحديث' : 'Refresh'}</span>
                </Button>
            </div>

            {/* ── Error banner ── */}
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

            {/* ── Tab Content ── */}
            <div className="flex-1 overflow-auto">
                {activeTab === 'dashboard' && (
                    <DashboardView
                        warehouses={warehouses}
                        pendingTransfers={pendingTransfers}
                        returnLogs={returnLogs}
                        auditLogs={auditLogs}
                        binStock={binStock}
                        loading={loading}
                        onNavigate={onTabChange}
                    />
                )}
                {activeTab === 'warehouses' && (
                    <WarehousesView
                        warehouses={warehouses}
                        binStock={binStock}
                        salesPersons={salesPersons}
                        loading={loading}
                        onRefresh={() => loadForTab('warehouses', true)}
                        companyFromAuth={activeCompanyFilter}
                        isAdmin={isAdmin}
                        allCompanies={allCompanies}
                    />
                )}
                {activeTab === 'inventory' && (
                    <LiveInventoryView
                        binStock={binStock}
                        warehouses={warehouses}
                        loading={loading}
                        brand={brand}
                    />
                )}
                {activeTab === 'transfers' && (
                    <TransfersView
                        requests={transferRequests}
                        warehouses={warehouses}
                        salesPersons={salesPersons}
                        loading={loading}
                        onRefresh={() => loadForTab('transfers', true)}
                        hasSales={hasSales}
                        brand={brand}
                    />
                )}
                {activeTab === 'returns' && (
                    <ReturnsView
                        returnLogs={returnLogs}
                        warehouses={warehouses}
                        loading={loading}
                        onRefresh={() => loadForTab('returns', true)}
                        hasSales={hasSales}
                        brand={brand}
                    />
                )}
                {activeTab === 'products' && (
                    <ProductsView
                        items={items}
                        itemGroups={itemGroups}
                        uoms={uoms}
                        warehouses={warehouses}
                        binStock={binStock}
                        loading={loading}
                        onRefresh={() => loadForTab('products', true)}
                        onUomsChange={setUOMs}
                    />
                )}
                {activeTab === 'audit' && (
                    <AuditView
                        auditLogs={auditLogs}
                        loading={loading}
                        onRefresh={() => loadForTab('audit', true)}
                    />
                )}
                {activeTab === 'reconciliation' && (
                    <ReconciliationView
                        binStock={binStock}
                        warehouses={warehouses}
                        items={items}
                        itemGroups={itemGroups}
                        reconciliations={reconciliations}
                        loading={loading}
                        onRefresh={() => loadForTab('reconciliation', true)}
                        onReconciliationsChange={setReconciliations}
                        brand={brand}
                    />
                )}

            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════
// 8. RECONCILIATION — Stock Reconciliation (تسوية الجرد)
// ═══════════════════════════════════════════════
// Count mode types
type CountMode = {
    value: string
    label: string
    label_ar: string
    doctype: string
}

const COUNT_MODES: CountMode[] = [
    { value: "items", label: "Items (Inventory)", label_ar: "الأصناف (المخزون)", doctype: "Item" },
    { value: "sales_returns", label: "Sales Returns", label_ar: "مرتجعات المبيعات", doctype: "Sales Return" },
    { value: "purchase_returns", label: "Purchase Returns", label_ar: "مرتجعات المشتريات", doctype: "Purchase Return" },
    { value: "assets", label: "Assets", label_ar: "الأصول", doctype: "Asset" },
    { value: "batch", label: "Batch Items", label_ar: "الأصناف بالدفعات", doctype: "Batch" },
    { value: "serial", label: "Serial Items", label_ar: "الأصناف بالسيريال", doctype: "Serial No" },
]

function ReconciliationView({
    binStock,
    warehouses,
    items,
    itemGroups,
    reconciliations,
    loading,
    onRefresh,
    onReconciliationsChange,
    brand,
}: {
    binStock: BinStock[]
    warehouses: Warehouse[]
    items: Item[]
    itemGroups: ItemGroup[]
    reconciliations: StockReconciliation[]
    loading: boolean
    onRefresh: () => void
    onReconciliationsChange: (r: StockReconciliation[]) => void
    brand?: TenantBrand
}) {
    const { isRTL } = useI18n()
    const { toast } = useToast()

    const [selectedWarehouse, setSelectedWarehouse] = useState('')
    const [countMode, setCountMode] = useState('items')
    const [actualQties, setActualQties] = useState<Record<string, string>>({})
    const [submitting, setSubmitting] = useState(false)
    const [historyOpen, setHistoryOpen] = useState(false)
    const [remarks, setRemarks] = useState('')
    const [showChangesOnly, setShowChangesOnly] = useState(false)
    const [confirmOpen, setConfirmOpen] = useState(false)

    // ── NEW: Dynamic count data for different doctypes ──
    const [countData, setCountData] = useState<BinStock[]>([])
    const [loadingCountData, setLoadingCountData] = useState(false)

    // ── NEW: Search, Item-Group filter, pagination, barcode ──
    const [search, setSearch] = useState('')
    const [groupFilter, setGroupFilter] = useState('all')
    const [currentPage, setCurrentPage] = useState(1)
    const perPage = 50
    const fileInputRef = useRef<HTMLInputElement>(null)
    const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({})

    // ── Barcode scanner state ──
    const [scanning, setScanning] = useState(false)
    const [camError, setCamError] = useState<string | null>(null)
    const html5ScannerRef = useRef<any>(null)
    const scannerContainerRef = useRef<HTMLDivElement>(null)

    // ── Fetch count data based on doctype ──
    useEffect(() => {
        const fetchCountData = async () => {
            if (!selectedWarehouse) {
                setCountData([])
                return
            }

            setLoadingCountData(true)
            try {
                const selectedMode = COUNT_MODES.find(m => m.value === countMode)
                const doctype = selectedMode?.doctype || 'Item'

                if (doctype === 'Item') {
                    // Use existing binStock for Items
                    setCountData(binStock.filter(b => b.warehouse === selectedWarehouse && (b.actual_qty ?? 0) > 0))
                } else {
                    // Fetch data for other doctypes
                    const res = await csrfFetch(
                        `/api/method/base_meena.api.inventory_api.get_count_data?doctype=${doctype}&warehouse=${selectedWarehouse}`,
                        { credentials: 'include' }
                    )
                    if (!res.ok) {
                        throw new Error(`Failed to fetch ${doctype} data`)
                    }
                    const data = await res.json()
                    // Transform data to BinStock format
                    const transformedData: BinStock[] = (data.message || []).map((item: any) => ({
                        item_code: item.name || item.item_code,
                        item_name: item.item_name || item.title || item.name,
                        warehouse: selectedWarehouse,
                        actual_qty: item.qty || item.quantity || 0,
                        valuation_rate: item.valuation_rate || 0,
                        stock_uom: item.stock_uom || item.uom || 'Nos',
                    }))
                    setCountData(transformedData)
                }
            } catch (err) {
                toast({
                    title: isRTL ? 'خطأ في تحميل البيانات' : 'Error loading data',
                    description: (err as Error).message,
                    variant: 'destructive',
                })
                setCountData([])
            } finally {
                setLoadingCountData(false)
            }
        }

        fetchCountData()
    }, [selectedWarehouse, countMode, binStock, toast, isRTL])

    // item_code → Item lookup for group info
    const itemMap = useMemo(() => {
        const map: Record<string, Item> = {}
        items.forEach(i => { map[i.name] = i; if (i.item_code) map[i.item_code] = i })
        return map
    }, [items])

    // item groups that exist in the warehouse
    const warehouseGroups = useMemo(() => {
        if (!selectedWarehouse) return [] as string[]
        const groups = new Set<string>()
        countData.forEach(b => {
            const g = itemMap[b.item_code]?.item_group
            if (g) groups.add(g)
        })
        return Array.from(groups).sort()
    }, [countData, selectedWarehouse, itemMap])

    // items in the selected warehouse from countData
    const warehouseItems = useMemo(
        () => countData,
        [countData]
    )

    // Reset inputs when warehouse or count mode changes
    useEffect(() => {
        setActualQties({})
        setSearch('')
        setGroupFilter('all')
        setCurrentPage(1)
    }, [selectedWarehouse, countMode])

    // Reset page on filter change
    useEffect(() => { setCurrentPage(1) }, [search, groupFilter])

    // Per-row computed values (before filtering)
    const allRows = useMemo(() =>
        warehouseItems.map(b => {
            const systemQty = b.actual_qty ?? 0
            const rawActual = actualQties[b.item_code]
            const actualQty = rawActual !== undefined ? parseFloat(rawActual) : systemQty
            const qty = isNaN(actualQty) ? systemQty : actualQty
            const diff = qty - systemQty
            const valRate = b.valuation_rate ?? 0
            const netValueChange = diff * valRate
            const itemInfo = itemMap[b.item_code]
            const itemGroup = itemInfo?.item_group || ''
            const barcode = itemInfo?.custom_barcode || ''
            return { ...b, systemQty, actualQty: qty, diff, valRate, netValueChange, itemGroup, barcode }
        }),
        [warehouseItems, actualQties, itemMap]
    )

    // Filtered rows (search + group + changes-only)
    const filteredRows = useMemo(() => {
        let res = allRows
        if (showChangesOnly) res = res.filter(r => {
            const raw = actualQties[r.item_code]
            return raw !== undefined && parseFloat(raw) !== r.systemQty
        })
        if (groupFilter !== 'all') res = res.filter(r => r.itemGroup === groupFilter)
        if (search.trim()) {
            const q = search.trim().toLowerCase()
            res = res.filter(r =>
                r.item_code.toLowerCase().includes(q) ||
                (r.item_name || '').toLowerCase().includes(q) ||
                r.barcode.toLowerCase().includes(q)
            )
        }
        return res
    }, [allRows, groupFilter, search, showChangesOnly, actualQties])

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / perPage))
    const paginatedRows = useMemo(
        () => filteredRows.slice((currentPage - 1) * perPage, currentPage * perPage),
        [filteredRows, currentPage]
    )

    // Summary (from ALL rows, not just filtered)
    const summary = useMemo(() => {
        const changedRows = allRows.filter(r => {
            const rawActual = actualQties[r.item_code]
            return rawActual !== undefined && parseFloat(rawActual) !== r.systemQty
        })
        const surplusValue = allRows.filter(r => r.diff > 0).reduce((s, r) => s + r.netValueChange, 0)
        const deficitValue = allRows.filter(r => r.diff < 0).reduce((s, r) => s + Math.abs(r.netValueChange), 0)
        return {
            total: allRows.length,
            filtered: filteredRows.length,
            surplus: allRows.filter(r => r.diff > 0).length,
            deficit: allRows.filter(r => r.diff < 0).length,
            surplusValue,
            deficitValue,
            netValue: allRows.reduce((s, r) => s + r.netValueChange, 0),
            changedCount: changedRows.length,
            topChanges: [...changedRows].sort((a, b) => Math.abs(b.netValueChange) - Math.abs(a.netValueChange)).slice(0, 5),
        }
    }, [allRows, filteredRows, actualQties])

    // Max absolute diff for heat-map intensity
    const maxAbsDiff = useMemo(() => {
        const m = Math.max(...allRows.map(r => Math.abs(r.diff)), 1)
        return m
    }, [allRows])

    // ── Quick actions ──
    const handleZeroFill = () => {
        const newQties: Record<string, string> = {}
        allRows.forEach(r => { newQties[r.item_code] = '0' })
        setActualQties(newQties)
        toast({ title: isRTL ? 'تم تصفير الكل' : 'All quantities set to zero' })
    }

    const handleCopySystemQty = () => {
        const newQties: Record<string, string> = {}
        allRows.forEach(r => { newQties[r.item_code] = String(r.systemQty) })
        setActualQties(newQties)
        toast({ title: isRTL ? 'تم نسخ كميات النظام' : 'System quantities copied' })
    }

    // ── Barcode Scanner ──
    const stopCamera = useCallback(() => {
        if (html5ScannerRef.current) {
            try {
                const s = html5ScannerRef.current
                html5ScannerRef.current = null
                s.stop().catch(() => { })
            } catch { }
        }
        setScanning(false)
    }, [])

    useEffect(() => () => stopCamera(), [stopCamera])

    // When overlay is rendered, start html5-qrcode
    const pendingStartRef = useRef<{ mod: any } | null>(null)
    useEffect(() => {
        if (!scanning || !pendingStartRef.current) return
        const { mod } = pendingStartRef.current
        pendingStartRef.current = null
        const tryStart = (attempt: number) => {
            const el = scannerContainerRef.current
            if (!el) {
                if (attempt < 15) setTimeout(() => tryStart(attempt + 1), 100)
                return
            }
            const scannerId = 'recon-scanner-' + Date.now()
            el.id = scannerId
            const formats = getBarcodeFormats(mod)
            const scanner = new mod.Html5Qrcode(scannerId, formats ? { formatsToSupport: formats, verbose: false } : undefined)
            html5ScannerRef.current = scanner
            scanner.start(
                { facingMode: 'environment' },
                { fps: 15, qrbox: { width: 300, height: 150 }, aspectRatio: 1.777 },
                (decodedText: string) => {
                    handleBarcodeResult(decodedText)
                    stopCamera()
                },
                () => { }
            ).catch((err: any) => {
                console.error('Scanner start error:', err)
                setCamError(isRTL ? 'تعذر الوصول للكاميرا' : 'Camera access denied')
                stopCamera()
            })
        }
        tryStart(0)
    }, [scanning])

    const startScan = async () => {
        setCamError(null)
        try {
            const mod = await getHtml5Qrcode()
            pendingStartRef.current = { mod }
            setScanning(true)
        } catch {
            setCamError(isRTL ? 'تعذر تحميل ماسح الباركود' : 'Failed to load barcode scanner')
        }
    }

    const handleBarcodeResult = (code: string) => {
        // Find item by barcode or item_code
        const match = allRows.find(r => r.barcode === code || r.item_code === code)
        if (match) {
            setSearch(code)
            setGroupFilter('all')
            setCurrentPage(1)
            // Scroll to row after render
            setTimeout(() => {
                const el = rowRefs.current[match.item_code]
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    el.classList.add('ring-2', 'ring-teal-400')
                    setTimeout(() => el.classList.remove('ring-2', 'ring-teal-400'), 2000)
                }
                // Focus the actual-qty input
                const input = document.querySelector(`[data-testid="actual-qty-${match.item_code}"]`) as HTMLInputElement
                input?.focus()
                input?.select()
            }, 100)
            toast({ title: isRTL ? '✅ تم العثور على الصنف' : '✅ Item found', description: `${match.item_code}${match.item_name ? ' — ' + match.item_name : ''}` })
        } else {
            toast({ title: isRTL ? 'لم يُعثر على الصنف' : 'Item not found', description: code, variant: 'destructive' })
        }
    }

    // ── Export CSV ──
    const handleExport = () => {
        const header = ['item_code', 'item_name', 'item_group', 'stock_uom', 'system_qty', 'actual_qty']
        const csvRows = [header.join(',')]
        allRows.forEach(r => {
            csvRows.push([
                `"${r.item_code}"`,
                `"${(r.item_name || '').replace(/"/g, '""')}"`,
                `"${r.itemGroup}"`,
                `"${r.stock_uom || ''}"`,
                r.systemQty,
                actualQties[r.item_code] !== undefined ? actualQties[r.item_code] : r.systemQty,
            ].join(','))
        })
        const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `reconciliation_${selectedWarehouse.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)
        toast({ title: isRTL ? '✅ تم التصدير' : '✅ Exported', description: isRTL ? `${allRows.length} صنف` : `${allRows.length} items` })
    }

    // ── Import CSV ──
    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (ev) => {
            const text = ev.target?.result as string
            if (!text) return
            const lines = text.split(/\r?\n/).filter(l => l.trim())
            if (lines.length < 2) {
                toast({ title: isRTL ? 'ملف فارغ' : 'Empty file', variant: 'destructive' })
                return
            }
            // Parse header
            const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''))
            const codeIdx = header.findIndex(h => h === 'item_code')
            const actualIdx = header.findIndex(h => h === 'actual_qty')
            if (codeIdx === -1 || actualIdx === -1) {
                toast({
                    title: isRTL ? 'تنسيق خاطئ' : 'Invalid format',
                    description: isRTL ? 'الملف يجب أن يحتوي على أعمدة item_code و actual_qty' : 'CSV must have item_code and actual_qty columns',
                    variant: 'destructive',
                })
                return
            }
            const newQties: Record<string, string> = { ...actualQties }
            let imported = 0
            const itemSet = new Set(allRows.map(r => r.item_code))
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''))
                const code = cols[codeIdx]
                const qty = cols[actualIdx]
                if (code && qty && itemSet.has(code) && !isNaN(parseFloat(qty))) {
                    newQties[code] = qty
                    imported++
                }
            }
            setActualQties(newQties)
            toast({
                title: isRTL ? '✅ تم الاستيراد' : '✅ Imported',
                description: isRTL ? `${imported} صنف من ${lines.length - 1}` : `${imported} of ${lines.length - 1} rows`,
            })
        }
        reader.readAsText(file)
        // reset so same file can be re-imported
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const handlePost = async () => {
        if (!selectedWarehouse) return
        const changedRows = allRows.filter(r => {
            const rawActual = actualQties[r.item_code]
            return rawActual !== undefined && parseFloat(rawActual) !== r.systemQty
        })
        if (changedRows.length === 0) {
            toast({ title: isRTL ? 'لا تغييرات' : 'No changes', description: isRTL ? 'لم تقم بتعديل أي كمية' : 'No quantities were modified', variant: 'destructive' })
            return
        }
        // Show confirmation dialog instead of posting directly
        setConfirmOpen(true)
    }

    const handleConfirmedPost = async () => {
        setConfirmOpen(false)
        const changedRows = allRows.filter(r => {
            const rawActual = actualQties[r.item_code]
            return rawActual !== undefined && parseFloat(rawActual) !== r.systemQty
        })
        if (changedRows.length === 0) return
        setSubmitting(true)
        try {
            const selectedMode = COUNT_MODES.find(m => m.value === countMode)
            const doctype = selectedMode?.doctype || 'Item'

            if (doctype === 'Item') {
                // Standard stock reconciliation for items
                const result = await stockApi.createStockReconciliation({
                    remarks: remarks || undefined,
                    items: changedRows.map(r => ({
                        item_code: r.item_code,
                        warehouse: selectedWarehouse,
                        qty: r.actualQty,
                        ...(r.valRate ? { valuation_rate: r.valRate } : {}),
                    })),
                })
                onReconciliationsChange([result, ...reconciliations])
                setActualQties({})
                setRemarks('')
                toast({
                    title: isRTL ? '✅ تمت تسوية الجرد' : '✅ Reconciliation posted',
                    description: isRTL ? `${result.name} — ${changedRows.length} صنف` : `${result.name} — ${changedRows.length} item(s)`,
                })
            } else {
                // For other doctypes, create a generic reconciliation record
                const res = await csrfFetch(
                    `/api/method/base_meena.api.inventory_api.create_count_reconciliation`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({
                            doctype,
                            warehouse: selectedWarehouse,
                            remarks: remarks || undefined,
                            items: changedRows.map(r => ({
                                code: r.item_code,
                                name: r.item_name || r.item_code,
                                counted_qty: r.actualQty,
                                system_qty: r.systemQty,
                                difference: r.diff,
                            })),
                        }),
                    }
                )
                if (!res.ok) {
                    throw new Error(`Failed to submit ${doctype} reconciliation`)
                }
                const data = await res.json()
                setActualQties({})
                setRemarks('')
                toast({
                    title: isRTL ? '✅ تمت تسوية الجرد' : '✅ Reconciliation posted',
                    description: isRTL ? `${changedRows.length} عنصر` : `${changedRows.length} item(s)`,
                })
            }
            onRefresh()
        } catch (err) {
            toast({
                title: isRTL ? 'فشلت التسوية' : 'Reconciliation failed',
                description: (err as Error).message,
                variant: 'destructive',
            })
        } finally {
            setSubmitting(false)
        }
    }

    const [printingRecon, setPrintingRecon] = useState<string | null>(null)
    const handlePrintReconciliation = async (rec: StockReconciliation) => {
        setPrintingRecon(rec.name)
        let full = rec
        try {
            const res = await frappeClient.get<StockReconciliation>('Stock Reconciliation', rec.name)
            if (res?.data) full = res.data
        } catch { /* print the summary row */ }
        const rows = (full.items || []).map((it) => {
            const sysQty = it.current_qty
            const diff = it.quantity_difference ?? (sysQty != null ? (it.qty ?? 0) - sysQty : undefined)
            return {
                item: it.item_code,
                warehouse: it.warehouse,
                system: sysQty ?? '—',
                counted: it.qty,
                diff: diff != null ? (diff > 0 ? `+${diff}` : String(diff)) : '—',
            }
        })
        printDoc({
            rtl: isRTL,
            brandName: brandLabel(brand, isRTL),
            brandTagline: brand?.tagline,
            logoUrl: brand?.logo,
            title: isRTL ? 'محضر تسوية جرد' : 'Stock Reconciliation Minutes',
            docNo: full.name,
            date: full.posting_date,
            meta: [
                ...(full.company ? [{ label: isRTL ? 'الشركة' : 'Company', value: full.company }] : []),
                { label: isRTL ? 'الحالة' : 'Status', value: full.docstatus === 1 ? (isRTL ? 'مرحّل' : 'Submitted') : (isRTL ? 'مسودة' : 'Draft') },
                { label: isRTL ? 'عدد البنود' : 'Lines', value: String((full.items || []).length) },
            ],
            columns: [
                { key: 'item', label: isRTL ? 'كود الصنف' : 'Item No.', ltr: true },
                { key: 'warehouse', label: isRTL ? 'المستودع' : 'Warehouse' },
                { key: 'system', label: isRTL ? 'كمية النظام' : 'System qty', align: 'center' },
                { key: 'counted', label: isRTL ? 'الكمية الفعلية' : 'Counted qty', align: 'center' },
                { key: 'diff', label: isRTL ? 'الفرق' : 'Difference', align: 'center' },
            ],
            rows,
            notes: full.remarks || undefined,
            signatures: isRTL ? ['أمين المستودع', 'لجنة الجرد', 'الاعتماد'] : ['Storekeeper', 'Count committee', 'Approved by'],
        })
        setPrintingRecon(null)
    }

    if (loading) {
        return (
            <div className="p-6 space-y-4">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
            </div>
        )
    }

    return (
        <div className="p-6 space-y-5 max-w-6xl mx-auto">
            {/* Hidden file input for import */}
            <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden" data-testid="csv-import-input" onChange={handleImport} />

            {/* ── Header ── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-teal-50">
                        <Scale className="h-5 w-5 text-teal-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">{isRTL ? 'تسوية الجرد' : 'Stock Reconciliation'}</h2>
                        <p className="text-xs text-gray-500">{isRTL ? 'قارن الكمية الفعلية بالكمية في النظام وسجّل الفروق' : 'Compare physical count with system qty and post adjustments'}</p>
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
                        <FileText className="h-4 w-4" />
                        <span className={cn('text-xs', isRTL ? 'mr-1.5' : 'ml-1.5')}>{isRTL ? 'السجل' : 'History'}</span>
                    </Button>
                </div>
            </div>

            {/* ── Count Type, Warehouse selector + remarks ── */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">{isRTL ? 'نوع الجرد' : 'Count Type'}</label>
                    <select
                        data-testid="count-mode-select"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        value={countMode}
                        onChange={e => setCountMode(e.target.value)}
                    >
                        {COUNT_MODES.map(mode => (
                            <option key={mode.value} value={mode.value}>
                                {isRTL ? mode.label_ar : mode.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex-1 min-w-[220px]">
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">{isRTL ? 'المستودع' : 'Warehouse'}</label>
                    <select
                        data-testid="warehouse-select"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        value={selectedWarehouse}
                        onChange={e => setSelectedWarehouse(e.target.value)}
                    >
                        <option value="">{isRTL ? '— اختر المستودع —' : '— Select warehouse —'}</option>
                        {warehouses.map(w => <option key={w.name} value={w.name}>{w.name}</option>)}
                    </select>
                </div>
                <div className="flex-1 min-w-[220px]">
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">{isRTL ? 'ملاحظات (اختياري)' : 'Remarks (optional)'}</label>
                    <Input
                        placeholder={isRTL ? 'سبب التسوية...' : 'Reason for adjustment...'}
                        value={remarks}
                        onChange={e => setRemarks(e.target.value)}
                        className="text-sm"
                    />
                </div>
            </div>

            {/* ── Loading state ── */}
            {selectedWarehouse && loadingCountData && (
                <div className="text-center py-16">
                    <RefreshCw className="h-8 w-8 mx-auto mb-3 text-teal-600 animate-spin" />
                    <p className="text-sm text-gray-500">{isRTL ? 'جاري تحميل البيانات...' : 'Loading data...'}</p>
                </div>
            )}

            {/* ── Empty state ── */}
            {selectedWarehouse && !loadingCountData && warehouseItems.length === 0 && (
                <div className="text-center py-16 text-gray-400">
                    <Scale className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">{isRTL ? 'لا توجد عناصر في هذا المستودع' : 'No items found in this warehouse'}</p>
                </div>
            )}

            {/* ── Main content (when warehouse has items) ── */}
            {selectedWarehouse && !loadingCountData && warehouseItems.length > 0 && (
                <>
                    {/* ── Summary bar ── */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <div className="rounded-xl p-3 text-center bg-gray-50 text-gray-700">
                            <p className="text-xs opacity-70 mb-0.5">{isRTL ? 'الأصناف' : 'Items'}</p>
                            <p className="text-xl font-bold">{summary.total}</p>
                        </div>
                        <div className="rounded-xl p-3 text-center bg-green-50 text-green-700">
                            <p className="text-xs opacity-70 mb-0.5">{isRTL ? 'زيادة' : 'Surplus'}</p>
                            <p className="text-xl font-bold">{summary.surplus}</p>
                            {summary.surplusValue > 0 && <p className="text-[10px] opacity-60 mt-0.5">+{summary.surplusValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>}
                        </div>
                        <div className="rounded-xl p-3 text-center bg-red-50 text-red-700">
                            <p className="text-xs opacity-70 mb-0.5">{isRTL ? 'عجز' : 'Deficit'}</p>
                            <p className="text-xl font-bold">{summary.deficit}</p>
                            {summary.deficitValue > 0 && <p className="text-[10px] opacity-60 mt-0.5">-{summary.deficitValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>}
                        </div>
                        <div className="rounded-xl p-3 text-center bg-amber-50 text-amber-700">
                            <p className="text-xs opacity-70 mb-0.5">{isRTL ? 'تم تعديله' : 'Changed'}</p>
                            <p className="text-xl font-bold">{summary.changedCount}</p>
                        </div>
                        <div className={cn('rounded-xl p-3 text-center', summary.netValue >= 0 ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700')}>
                            <p className="text-xs opacity-70 mb-0.5">{isRTL ? 'صافي القيمة' : 'Net Value'}</p>
                            <p className="text-lg font-bold">{summary.netValue >= 0 ? '+' : ''}{summary.netValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                        </div>
                    </div>

                    {/* ── Search + Filter + Import/Export toolbar ── */}
                    <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                        {/* Search + barcode */}
                        <div className="flex gap-1.5 items-center flex-1 min-w-0">
                            <div className="relative flex-1">
                                <Search className={cn('absolute top-2 h-4 w-4 text-gray-400 pointer-events-none', isRTL ? 'right-2.5' : 'left-2.5')} />
                                <Input
                                    data-testid="recon-search"
                                    className={cn('h-9 text-sm', isRTL ? 'pr-8 pl-2' : 'pl-8 pr-2')}
                                    placeholder={isRTL ? 'بحث بالكود أو الاسم أو الباركود...' : 'Search by code, name, or barcode...'}
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                            <button
                                type="button"
                                onClick={startScan}
                                data-testid="recon-barcode-btn"
                                title={isRTL ? 'مسح الباركود' : 'Scan barcode'}
                                className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-teal-50 hover:border-teal-300 text-gray-400 hover:text-teal-600 transition-colors flex-shrink-0"
                            >
                                <Scan className="h-4 w-4" />
                            </button>
                        </div>
                        {/* Item group filter */}
                        <div className="flex items-center gap-1.5 min-w-[180px]">
                            <Filter className="h-4 w-4 text-gray-400 shrink-0" />
                            <select
                                data-testid="recon-group-filter"
                                className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                                value={groupFilter}
                                onChange={e => setGroupFilter(e.target.value)}
                            >
                                <option value="all">{isRTL ? 'كل المجموعات' : 'All Groups'}</option>
                                {warehouseGroups.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>
                        {/* Import / Export buttons */}
                        <div className="flex gap-1.5">
                            <Button variant="outline" size="sm" onClick={handleExport} title={isRTL ? 'تصدير CSV' : 'Export CSV'} data-testid="recon-export-btn">
                                <Download className="h-4 w-4" />
                                <span className={cn('text-xs', isRTL ? 'mr-1' : 'ml-1')}>{isRTL ? 'تصدير' : 'Export'}</span>
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} title={isRTL ? 'استيراد CSV' : 'Import CSV'} data-testid="recon-import-btn">
                                <Upload className="h-4 w-4" />
                                <span className={cn('text-xs', isRTL ? 'mr-1' : 'ml-1')}>{isRTL ? 'استيراد' : 'Import'}</span>
                            </Button>
                        </div>
                    </div>

                    {/* ── Quick Actions toolbar ── */}
                    <div className="flex flex-wrap gap-2 items-center">
                        <Button
                            variant={showChangesOnly ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => { setShowChangesOnly(p => !p); setCurrentPage(1) }}
                            className={cn('text-xs', showChangesOnly && 'bg-amber-500 hover:bg-amber-600 text-white')}
                        >
                            {showChangesOnly ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                            <span className={cn(isRTL ? 'mr-1' : 'ml-1')}>{isRTL ? 'المتغيرة فقط' : 'Changes Only'}</span>
                            {showChangesOnly && <span className="text-[10px] opacity-80">({summary.changedCount})</span>}
                        </Button>
                        <div className="h-4 w-px bg-gray-200" />
                        <Button variant="outline" size="sm" className="text-xs text-gray-600" onClick={handleZeroFill}>
                            <Ban className="h-3.5 w-3.5" />
                            <span className={cn(isRTL ? 'mr-1' : 'ml-1')}>{isRTL ? 'صفّر الكل' : 'Zero All'}</span>
                        </Button>
                        <Button variant="outline" size="sm" className="text-xs text-gray-600" onClick={handleCopySystemQty}>
                            <ClipboardList className="h-3.5 w-3.5" />
                            <span className={cn(isRTL ? 'mr-1' : 'ml-1')}>{isRTL ? 'نسخ كميات النظام' : 'Copy System Qty'}</span>
                        </Button>
                        <Button variant="outline" size="sm" className="text-xs text-gray-600" onClick={() => { setActualQties({}); toast({ title: isRTL ? 'تم إعادة التعيين' : 'Reset' }) }}>
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span className={cn(isRTL ? 'mr-1' : 'ml-1')}>{isRTL ? 'إعادة تعيين' : 'Reset'}</span>
                        </Button>
                    </div>

                    {/* Camera error */}
                    {camError && <p className="text-[11px] text-red-500 px-1">{camError}</p>}

                    {/* Barcode scanner overlay */}
                    {scanning && (
                        <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col items-center justify-center">
                            <div className="relative w-full max-w-sm mx-4">
                                <div ref={scannerContainerRef} className="rounded-2xl overflow-hidden" />
                                <p className="text-white/80 text-sm text-center mt-3">{isRTL ? 'وجّه الكاميرا نحو الباركود' : 'Point the camera at the barcode'}</p>
                                <button type="button" onClick={stopCamera} className="mt-3 w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm border border-white/20 transition-colors">
                                    {isRTL ? 'إلغاء' : 'Cancel'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Filter result info */}
                    {(search || groupFilter !== 'all') && (
                        <p className="text-xs text-gray-400 px-1" data-testid="recon-filter-info">
                            {isRTL
                                ? `عرض ${filteredRows.length} من ${allRows.length} صنف`
                                : `Showing ${filteredRows.length} of ${allRows.length} items`}
                        </p>
                    )}

                    {/* ── Table ── */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500">
                                        <th className={cn('px-4 py-3 font-semibold', isRTL ? 'text-right' : 'text-left')}>{isRTL ? 'الصنف' : 'Item'}</th>
                                        <th className="px-4 py-3 font-semibold text-center">{isRTL ? 'الوحدة' : 'UOM'}</th>
                                        <th className="px-4 py-3 font-semibold text-center">{isRTL ? 'كمية النظام' : 'System Qty'}</th>
                                        <th className="px-4 py-3 font-semibold text-center">{isRTL ? 'الكمية الفعلية' : 'Actual Qty'}</th>
                                        <th className="px-4 py-3 font-semibold text-center">{isRTL ? 'الفرق' : 'Diff'}</th>
                                        <th className="px-4 py-3 font-semibold text-center">{isRTL ? 'فرق القيمة' : 'Value Diff'}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {paginatedRows.map(row => {
                                        // ── Heat-map intensity: stronger color for bigger differences ──
                                        const intensity = Math.min(Math.abs(row.diff) / maxAbsDiff, 1)
                                        const alpha = row.diff === 0 ? 0 : Math.max(0.08, intensity * 0.45)
                                        const rowBg = row.diff > 0
                                            ? `rgba(34,197,94,${alpha})`
                                            : row.diff < 0
                                                ? `rgba(239,68,68,${alpha})`
                                                : undefined
                                        return (
                                            <tr
                                                key={row.item_code}
                                                ref={el => { rowRefs.current[row.item_code] = el }}
                                                className="hover:brightness-95 transition-all"
                                                style={rowBg ? { backgroundColor: rowBg } : undefined}
                                            >
                                                <td className={cn('px-4 py-3', isRTL ? 'text-right' : 'text-left')}>
                                                    <p className="font-medium text-gray-900 text-sm">{row.item_code}</p>
                                                    {row.item_name && row.item_name !== row.item_code && (
                                                        <p className="text-xs text-gray-400">{row.item_name}</p>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center text-xs text-gray-500">{isRTL ? (UOM_AR[row.stock_uom || ''] || row.stock_uom || '—') : (row.stock_uom || '—')}</td>
                                                <td className="px-4 py-3 text-center font-mono text-sm text-gray-700">{row.systemQty}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="any"
                                                        data-testid={`actual-qty-${row.item_code}`}
                                                        className={cn(
                                                            'w-24 border rounded-lg px-2 py-1 text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-teal-500',
                                                            actualQties[row.item_code] !== undefined && parseFloat(actualQties[row.item_code]) !== row.systemQty
                                                                ? 'border-amber-400 bg-amber-50'
                                                                : 'border-gray-200 bg-white'
                                                        )}
                                                        value={actualQties[row.item_code] ?? row.systemQty}
                                                        onChange={e => setActualQties(prev => ({ ...prev, [row.item_code]: e.target.value }))}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {row.diff === 0 ? (
                                                        <Badge variant="secondary" className="bg-gray-100 text-gray-400 text-xs font-mono">0</Badge>
                                                    ) : (
                                                        <Badge
                                                            variant="secondary"
                                                            className={cn(
                                                                'text-xs font-bold font-mono',
                                                                row.diff > 0
                                                                    ? 'bg-green-100 text-green-700 border border-green-200'
                                                                    : 'bg-red-100 text-red-700 border border-red-200'
                                                            )}
                                                        >
                                                            {row.diff > 0 ? '+' : ''}{row.diff.toFixed(2)}
                                                        </Badge>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {row.netValueChange === 0 ? (
                                                        <span className="text-xs text-gray-300 font-mono">—</span>
                                                    ) : (
                                                        <span className={cn('text-xs font-bold font-mono', row.netValueChange > 0 ? 'text-green-600' : 'text-red-600')}>
                                                            {row.netValueChange > 0 ? '+' : ''}{row.netValueChange.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    {paginatedRows.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="text-center py-10 text-sm text-gray-400">
                                                {isRTL ? 'لا توجد نتائج' : 'No results found'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                                <p className="text-xs text-gray-500">
                                    {(currentPage - 1) * perPage + 1}–{Math.min(currentPage * perPage, filteredRows.length)} / {filteredRows.length}
                                </p>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                                        {isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                                    </Button>
                                    <span className="text-xs text-gray-500 px-2 py-1">{currentPage} / {totalPages}</span>
                                    <Button variant="ghost" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                                        {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Post button ── */}
                    <div className={cn('flex', isRTL ? 'justify-start' : 'justify-end')}>
                        <Button
                            onClick={handlePost}
                            disabled={submitting || summary.changedCount === 0}
                            className="bg-teal-600 hover:bg-teal-700 text-white px-6 shadow-lg shadow-teal-200"
                            data-testid="post-reconciliation-btn"
                        >
                            {submitting ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                                <Scale className="h-4 w-4" />
                            )}
                            <span className={cn('font-semibold', isRTL ? 'mr-2' : 'ml-2')}>
                                {submitting
                                    ? (isRTL ? 'جار الترحيل...' : 'Posting...')
                                    : (isRTL ? `ترحيل التسوية (${summary.changedCount})` : `Post Reconciliation (${summary.changedCount})`)}
                            </span>
                        </Button>
                    </div>
                </>
            )}

            {/* ── No warehouse selected placeholder ── */}
            {!selectedWarehouse && (
                <div className="text-center py-20 text-gray-300">
                    <Scale className="h-14 w-14 mx-auto mb-4 opacity-40" />
                    <p className="text-base font-medium text-gray-400">{isRTL ? 'اختر مستودعاً للبدء' : 'Select a warehouse to start'}</p>
                    <p className="text-xs text-gray-400 mt-1">{isRTL ? 'سيتم عرض أصناف المستودع وكمياتها' : "The warehouse's items and quantities will appear here"}</p>
                </div>
            )}

            {/* ── Confirmation Summary Dialog ── */}
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle className={cn('flex items-center gap-2', isRTL ? 'flex-row-reverse' : '')}>
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            {isRTL ? 'تأكيد ترحيل التسوية' : 'Confirm Reconciliation'}
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-3 text-sm">
                                <p className="text-gray-500">{isRTL ? 'سيتم تعديل الكميات التالية في النظام:' : 'The following adjustments will be posted:'}</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="rounded-lg bg-amber-50 p-2.5 text-center">
                                        <p className="text-xs text-amber-600">{isRTL ? 'أصناف معدّلة' : 'Items Changed'}</p>
                                        <p className="text-lg font-bold text-amber-700">{summary.changedCount}</p>
                                    </div>
                                    <div className={cn('rounded-lg p-2.5 text-center', summary.netValue >= 0 ? 'bg-blue-50' : 'bg-orange-50')}>
                                        <p className={cn('text-xs', summary.netValue >= 0 ? 'text-blue-600' : 'text-orange-600')}>{isRTL ? 'صافي فرق القيمة' : 'Net Value Impact'}</p>
                                        <p className={cn('text-lg font-bold', summary.netValue >= 0 ? 'text-blue-700' : 'text-orange-700')}>{summary.netValue >= 0 ? '+' : ''}{summary.netValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                    </div>
                                    <div className="rounded-lg bg-green-50 p-2.5 text-center">
                                        <p className="text-xs text-green-600">{isRTL ? 'زيادة' : 'Surplus'}</p>
                                        <p className="text-sm font-bold text-green-700">{summary.surplus} {isRTL ? 'صنف' : 'items'}</p>
                                    </div>
                                    <div className="rounded-lg bg-red-50 p-2.5 text-center">
                                        <p className="text-xs text-red-600">{isRTL ? 'عجز' : 'Deficit'}</p>
                                        <p className="text-sm font-bold text-red-700">{summary.deficit} {isRTL ? 'صنف' : 'items'}</p>
                                    </div>
                                </div>
                                {summary.topChanges.length > 0 && (
                                    <div>
                                        <p className="text-xs font-semibold text-gray-500 mb-1.5">{isRTL ? 'أكبر الفروقات:' : 'Biggest differences:'}</p>
                                        <div className="rounded-lg border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                                            {summary.topChanges.map(r => (
                                                <div key={r.item_code} className="flex items-center justify-between px-3 py-1.5 text-xs">
                                                    <span className="font-medium text-gray-700 truncate max-w-[180px]">{r.item_code}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className={cn('font-mono font-bold', r.diff > 0 ? 'text-green-600' : 'text-red-600')}>
                                                            {r.diff > 0 ? '+' : ''}{r.diff.toFixed(1)}
                                                        </span>
                                                        <span className={cn('font-mono text-[10px]', r.netValueChange > 0 ? 'text-green-500' : 'text-red-500')}>
                                                            ({r.netValueChange > 0 ? '+' : ''}{r.netValueChange.toLocaleString(undefined, { maximumFractionDigits: 0 })})
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{isRTL ? 'مراجعة' : 'Review'}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmedPost} className="bg-teal-600 hover:bg-teal-700 text-white">
                            <Scale className="h-4 w-4" />
                            <span className={cn(isRTL ? 'mr-1.5' : 'ml-1.5')}>{isRTL ? 'تأكيد الترحيل' : 'Confirm Post'}</span>
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── History Dialog ── */}
            <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className={cn('flex items-center gap-2', isRTL ? 'flex-row-reverse' : '')}>
                            <FileText className="h-5 w-5 text-teal-600" />
                            {isRTL ? 'سجل تسويات الجرد' : 'Reconciliation History'}
                        </DialogTitle>
                    </DialogHeader>
                    {reconciliations.length === 0 ? (
                        <p className="text-center py-8 text-sm text-gray-400">{isRTL ? 'لا توجد تسويات سابقة' : 'No reconciliations yet'}</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 text-xs text-gray-500">
                                    <th className={cn('px-3 py-2 font-semibold', isRTL ? 'text-right' : 'text-left')}>{isRTL ? 'الرقم' : 'Name'}</th>
                                    <th className="px-3 py-2 font-semibold text-center">{isRTL ? 'التاريخ' : 'Date'}</th>
                                    <th className="px-3 py-2 font-semibold text-center">{isRTL ? 'الشركة' : 'Company'}</th>
                                    <th className="px-3 py-2 font-semibold text-center">{isRTL ? 'الحالة' : 'Status'}</th>
                                    <th className="px-3 py-2 font-semibold text-center">{isRTL ? 'طباعة' : 'Print'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {reconciliations.map(r => (
                                    <tr key={r.name} className="hover:bg-gray-50">
                                        <td className={cn('px-3 py-2.5 font-mono text-xs text-teal-700', isRTL ? 'text-right' : 'text-left')}>{r.name}</td>
                                        <td className="px-3 py-2.5 text-center text-xs text-gray-600">{r.posting_date}</td>
                                        <td className="px-3 py-2.5 text-center text-xs text-gray-500">{r.company || '—'}</td>
                                        <td className="px-3 py-2.5 text-center">
                                            <Badge variant="secondary" className={cn('text-xs', r.docstatus === 1 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600')}>
                                                {r.docstatus === 1 ? (isRTL ? 'مرحّل' : 'Submitted') : (isRTL ? 'مسودة' : 'Draft')}
                                            </Badge>
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                            <button onClick={() => handlePrintReconciliation(r)} disabled={printingRecon === r.name} title={isRTL ? 'طباعة المحضر' : 'Print'} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50">
                                                {printingRecon === r.name ? <RefreshCw className="h-3.5 w-3.5 animate-spin text-gray-400" /> : <Printer className="h-3.5 w-3.5 text-gray-500" />}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setHistoryOpen(false)}>{isRTL ? 'إغلاق' : 'Close'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
// ═══════════════════════════════════════════════
// 7. PRODUCTS — Items CRUD
// ═══════════════════════════════════════════════
function ProductsView({
    items, itemGroups, uoms, warehouses, binStock, loading, onRefresh, onUomsChange,
}: {
    items: Item[]
    itemGroups: ItemGroup[]
    uoms: UOM[]
    warehouses: Warehouse[]
    binStock: BinStock[]
    loading: boolean
    onRefresh: () => void
    onUomsChange: (uoms: UOM[]) => void
}) {
    const { isRTL } = useI18n()
    const { toast } = useToast()
    const [search, setSearch] = useState('')
    const [groupFilter, setGroupFilter] = useState<string>('all')
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all')
    const [currentPage, setCurrentPage] = useState(1)
    const perPage = 20

    // ── Dialog ──
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingItem, setEditingItem] = useState<Item | null>(null)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({
        item_code: '',
        item_name: '',
        item_group: '',
        stock_uom: 'Nos',
        description: '',
        standard_rate: '',
    })
    // UOM Conversion rows (alternative UOMs for this item)
    const [uomConversions, setUomConversions] = useState<Array<{ uom: string; conversion_factor: string }>>([])
    // Multi-warehouse entries for opening stock (up to 4)
    const [warehouseEntries, setWarehouseEntries] = useState<Array<{ warehouse: string; qty: string }>>([{ warehouse: '', qty: '' }])

    // ── Detail dialog ──
    const [detailOpen, setDetailOpen] = useState(false)
    const [detailItem, setDetailItem] = useState<Item | null>(null)
    const [detailLoading, setDetailLoading] = useState(false)

    // ── Toggle confirmation dialog ──
    const [toggleConfirm, setToggleConfirm] = useState<{ open: boolean; item: Item | null }>({ open: false, item: null })
    const [toggling, setToggling] = useState(false)

    // ── Barcode scanner for item code ──
    const [itemCodeScanning, setItemCodeScanning] = useState(false)
    const [itemCodeCamError, setItemCodeCamError] = useState<string | null>(null)
    const itemCodeScannerRef = useRef<any>(null)
    const itemCodeScannerContainerRef = useRef<HTMLDivElement>(null)
    const itemCodePendingStartRef = useRef<{ mod: any } | null>(null)

    const stopItemCodeCamera = useCallback(() => {
        if (itemCodeScannerRef.current) {
            try {
                const s = itemCodeScannerRef.current
                itemCodeScannerRef.current = null
                s.stop().catch(() => { })
            } catch { }
        }
        setItemCodeScanning(false)
    }, [])

    useEffect(() => {
        if (!itemCodeScanning || !itemCodePendingStartRef.current) return
        const { mod } = itemCodePendingStartRef.current
        itemCodePendingStartRef.current = null
        const tryStart = (attempt: number) => {
            const el = itemCodeScannerContainerRef.current
            if (!el) {
                if (attempt < 15) setTimeout(() => tryStart(attempt + 1), 100)
                return
            }
            const scannerId = 'item-code-scanner-' + Date.now()
            el.id = scannerId
            const formats = getBarcodeFormats(mod)
            const scanner = new mod.Html5Qrcode(scannerId, formats ? { formatsToSupport: formats, verbose: false } : undefined)
            itemCodeScannerRef.current = scanner
            scanner.start(
                { facingMode: 'environment' },
                { fps: 15, qrbox: { width: 300, height: 150 }, aspectRatio: 1.777 },
                (decodedText: string) => {
                    setForm(prev => ({ ...prev, item_code: decodedText }))
                    stopItemCodeCamera()
                },
                () => { }
            ).catch((err: any) => {
                console.error('Scanner start error:', err)
                setItemCodeCamError(isRTL ? 'تعذر الوصول للكاميرا' : 'Camera access denied')
                stopItemCodeCamera()
            })
        }
        tryStart(0)
    }, [itemCodeScanning, isRTL, stopItemCodeCamera])

    useEffect(() => () => stopItemCodeCamera(), [stopItemCodeCamera])

    const startItemCodeScan = async () => {
        setItemCodeCamError(null)
        try {
            const mod = await getHtml5Qrcode()
            itemCodePendingStartRef.current = { mod }
            setItemCodeScanning(true)
        } catch {
            setItemCodeCamError(isRTL ? 'تعذر تحميل ماسح الباركود' : 'Failed to load barcode scanner')
        }
    }

    // ── UOM Management dialog ──
    const [uomDialogOpen, setUomDialogOpen] = useState(false)
    const [uomEditDialog, setUomEditDialog] = useState<{ open: boolean; uom: UOM | null }>({ open: false, uom: null })
    const [uomFormName, setUomFormName] = useState('')
    const [uomEditName, setUomEditName] = useState('')
    const [uomFormWholeNumber, setUomFormWholeNumber] = useState(false)
    const [uomSaving, setUomSaving] = useState(false)
    const [uomDeleting, setUomDeleting] = useState<string | null>(null)
    const [uomSeeding, setUomSeeding] = useState(false)

    // Common UOMs to seed
    const COMMON_UOMS: { name: string; ar: string; whole: boolean }[] = [
        { name: 'Nos', ar: 'قطعة', whole: true },
        { name: 'Kg', ar: 'كيلوجرام', whole: false },
        { name: 'Gram', ar: 'جرام', whole: false },
        { name: 'Liter', ar: 'لتر', whole: false },
        { name: 'Meter', ar: 'متر', whole: false },
        { name: 'Box', ar: 'صندوق', whole: true },
        { name: 'Pack', ar: 'عبوة', whole: true },
        { name: 'Carton', ar: 'كرتون', whole: true },
        { name: 'Pair', ar: 'زوج', whole: true },
        { name: 'Dozen', ar: 'درزن', whole: true },
        { name: 'Set', ar: 'طقم', whole: true },
        { name: 'Roll', ar: 'رول', whole: true },
        { name: 'Bag', ar: 'كيس', whole: true },
        { name: 'Bottle', ar: 'زجاجة', whole: true },
        { name: 'Can', ar: 'علبة', whole: true },
    ]

    // ── UOM CRUD helpers ──
    const handleUomCreate = async () => {
        const name = uomFormName.trim()
        if (!name) return
        setUomSaving(true)
        try {
            await stockApi.createUOM({ uom_name: name, must_be_whole_number: uomFormWholeNumber ? 1 : 0 })
            const updated = await stockApi.getUOMs()
            onUomsChange(updated)
            setUomFormName('')
            setUomFormWholeNumber(false)
            toast({ title: isRTL ? 'تمت الإضافة' : 'UOM created' })
        } catch (e: any) {
            toast({ title: isRTL ? 'خطأ' : 'Error', description: e?.message || String(e), variant: 'destructive' })
        } finally { setUomSaving(false) }
    }

    const handleUomUpdate = async () => {
        if (!uomEditDialog.uom) return
        setUomSaving(true)
        try {
            const oldName = uomEditDialog.uom.name
            const newName = uomEditName.trim()
            // Rename if name changed
            if (newName && newName !== oldName) {
                await stockApi.renameUOM(oldName, newName)
            }
            // Update whole-number flag
            const targetName = (newName && newName !== oldName) ? newName : oldName
            await stockApi.updateUOM(targetName, { must_be_whole_number: uomFormWholeNumber ? 1 : 0 })
            const updated = await stockApi.getUOMs()
            onUomsChange(updated)
            setUomEditDialog({ open: false, uom: null })
            toast({ title: isRTL ? 'تم التحديث' : 'UOM updated' })
        } catch (e: any) {
            toast({ title: isRTL ? 'خطأ' : 'Error', description: e?.message || String(e), variant: 'destructive' })
        } finally { setUomSaving(false) }
    }

    const handleUomDelete = async (uomName: string) => {
        setUomDeleting(uomName)
        try {
            const result = await stockApi.deleteUOM(uomName)
            const updated = await stockApi.getUOMs()
            onUomsChange(updated)
            const desc = result.cleaned_count > 0
                ? (isRTL ? `تم تنظيف ${result.cleaned_count} سجل مرتبط` : `${result.cleaned_count} linked record(s) cleaned up`)
                : undefined
            toast({ title: isRTL ? 'تم الحذف' : 'UOM deleted', description: desc })
        } catch (e: any) {
            toast({ title: isRTL ? 'خطأ' : 'Error', description: e?.message || String(e), variant: 'destructive' })
        } finally { setUomDeleting(null) }
    }

    const handleSeedUOMs = async () => {
        const existing = new Set(uoms.map(u => u.name.toLowerCase()))
        const toCreate = COMMON_UOMS.filter(c => !existing.has(c.name.toLowerCase()))
        if (toCreate.length === 0) {
            toast({ title: isRTL ? 'جميع الوحدات الشائعة موجودة بالفعل' : 'All common UOMs already exist' })
            return
        }
        setUomSeeding(true)
        let created = 0
        for (const c of toCreate) {
            try {
                await stockApi.createUOM({ uom_name: c.name, must_be_whole_number: c.whole ? 1 : 0 })
                created++
            } catch { /* skip duplicates or errors */ }
        }
        const updated = await stockApi.getUOMs()
        onUomsChange(updated)
        toast({ title: isRTL ? `تم إضافة ${created} وحدة قياس` : `${created} UOMs added` })
        setUomSeeding(false)
    }

    const seedableCount = COMMON_UOMS.filter(c => !uoms.some(u => u.name.toLowerCase() === c.name.toLowerCase())).length

    // ── Filter / search ──
    const uniqueGroups = useMemo(() => {
        const groups = new Set(items.map((i) => i.item_group).filter(Boolean))
        return Array.from(groups).sort()
    }, [items])

    const filtered = useMemo(() => {
        let list = items
        if (statusFilter === 'active') list = list.filter((i) => !i.disabled)
        if (statusFilter === 'disabled') list = list.filter((i) => i.disabled)
        if (groupFilter !== 'all') list = list.filter((i) => i.item_group === groupFilter)
        if (search.trim()) {
            const q = search.toLowerCase()
            list = list.filter((i) =>
                i.name.toLowerCase().includes(q) ||
                i.item_name.toLowerCase().includes(q) ||
                (i.item_group || '').toLowerCase().includes(q) ||
                (i.description || '').toLowerCase().includes(q)
            )
        }
        return list
    }, [items, search, groupFilter, statusFilter])

    const paginated = filtered.slice((currentPage - 1) * perPage, currentPage * perPage)
    const totalPages = Math.ceil(filtered.length / perPage)

    // ── Stats ──
    const activeCount = items.filter((i) => !i.disabled).length
    const disabledCount = items.filter((i) => i.disabled).length

    // ── Stock qty lookup ──
    const stockByItem = useMemo(() => {
        const map: Record<string, number> = {}
        for (const b of binStock) {
            map[b.item_code] = (map[b.item_code] || 0) + b.actual_qty
        }
        return map
    }, [binStock])

    // ── Active (non-group) warehouses for dropdown ──
    const activeWarehouses = useMemo(() =>
        warehouses.filter(w => !w.disabled && !w.is_group).sort((a, b) => (a.warehouse_name || a.name).localeCompare(b.warehouse_name || b.name)),
        [warehouses]
    )

    // ── Open create dialog ──
    const openCreate = () => {
        setEditingItem(null)
        setForm({
            item_code: '', item_name: '', item_group: itemGroups.filter(g => !g.is_group)[0]?.name || '',
            stock_uom: 'Nos', description: '', standard_rate: '',
        })
        setUomConversions([])
        setWarehouseEntries([{ warehouse: '', qty: '' }])
        setDialogOpen(true)
    }

    // ── Open edit dialog ──
    const openEdit = async (item: Item) => {
        // Fetch full item data (includes uoms child table)
        let fullItem = item
        try {
            const fetched = await stockApi.getItem(item.name)
            if (fetched) fullItem = fetched
        } catch { /* use list-level data */ }
        setEditingItem(fullItem)
        setForm({
            item_code: fullItem.name,
            item_name: fullItem.item_name,
            item_group: fullItem.item_group || '',
            stock_uom: fullItem.stock_uom || 'Nos',
            description: fullItem.description || '',
            standard_rate: fullItem.standard_rate?.toString() || '',
        })
        // Load existing UOM conversions (skip the stock_uom row which has factor 1)
        const existingConversions = (fullItem.uoms || [])
            .filter(u => u.uom !== (fullItem.stock_uom || 'Nos'))
            .map(u => ({ uom: u.uom, conversion_factor: u.conversion_factor.toString() }))
        setUomConversions(existingConversions)
        setWarehouseEntries([{ warehouse: '', qty: '' }])
        setDialogOpen(true)
    }

    // ── View detail ──
    const viewDetail = async (item: Item) => {
        setDetailLoading(true)
        setDetailOpen(true)
        try {
            const full = await stockApi.getItem(item.name)
            setDetailItem(full || item)
        } catch {
            setDetailItem(item)
        }
        setDetailLoading(false)
    }

    // ── Save ──
    const handleSave = async () => {
        if (!form.item_name.trim()) {
            toast({ variant: 'destructive', title: isRTL ? 'اسم المنتج مطلوب' : 'Product name is required' })
            return
        }


        // Validate: for each warehouse entry with qty, warehouse must be selected and vice versa
        const validEntries = warehouseEntries.filter(e => e.warehouse && parseFloat(e.qty) > 0)
        const invalidEntries = warehouseEntries.filter(e => (e.warehouse && (!e.qty || parseFloat(e.qty) <= 0)) || (!e.warehouse && e.qty && parseFloat(e.qty) > 0))
        if (invalidEntries.length > 0) {
            toast({ variant: 'destructive', title: isRTL ? 'أكمل بيانات المخزن والكمية' : 'Complete warehouse and quantity for each entry' })
            return
        }

        setSaving(true)
        // Auto-resolve item_group: use form value, or first non-group, or 'All Item Groups'
        const resolvedGroup = form.item_group || itemGroups.filter(g => !g.is_group)[0]?.name || itemGroups[0]?.name || 'All Item Groups'
        // Build valid UOM conversion rows
        const validConversions: UOMConversionDetail[] = uomConversions
            .filter(c => c.uom && c.uom !== form.stock_uom && parseFloat(c.conversion_factor) > 0)
            .map(c => ({ uom: c.uom, conversion_factor: parseFloat(c.conversion_factor) }))
        try {
            if (editingItem) {
                // Build full uoms array: stock_uom with factor 1 + additional conversions
                const uomRows = [
                    { uom: form.stock_uom, conversion_factor: 1 },
                    ...validConversions,
                ]
                await stockApi.updateItem(editingItem.name, {
                    item_name: form.item_name,
                    item_group: resolvedGroup,
                    stock_uom: form.stock_uom,
                    description: form.description || undefined,
                    standard_rate: form.standard_rate ? parseFloat(form.standard_rate) : undefined,
                    uoms: uomRows,
                })
                // Create Material Receipt for each warehouse entry
                if (validEntries.length > 0) {
                    for (const entry of validEntries) {
                        const wh = warehouses.find(w => w.name === entry.warehouse)
                        await stockApi.createMaterialReceipt({
                            warehouse: entry.warehouse,
                            company: wh?.company || undefined,
                            items: [{
                                item_code: editingItem.name,
                                qty: parseFloat(entry.qty),
                                rate: form.standard_rate ? parseFloat(form.standard_rate) : undefined,
                            }],
                            remarks: isRTL
                                ? `إضافة مخزون: ${parseFloat(entry.qty)} ${UOM_AR[form.stock_uom] || form.stock_uom} إلى ${entry.warehouse}`
                                : `Stock addition: ${parseFloat(entry.qty)} ${form.stock_uom} to ${entry.warehouse}`,
                        })
                    }
                    toast({ title: isRTL ? `تم تحديث المنتج وإضافة المخزون في ${validEntries.length} مستودع` : `Product updated & stock added to ${validEntries.length} warehouse(s)` })
                } else {
                    toast({ title: isRTL ? 'تم تحديث المنتج' : 'Product updated' })
                }
            } else {
                const created = await stockApi.createItem({
                    item_code: form.item_code || undefined,
                    item_name: form.item_name,
                    item_group: resolvedGroup,
                    stock_uom: form.stock_uom,
                    description: form.description || undefined,
                    standard_rate: form.standard_rate ? parseFloat(form.standard_rate) : undefined,
                    uoms: validConversions,
                })
                // Create Material Receipt for each warehouse entry
                if (validEntries.length > 0) {
                    const itemCode = created.name || form.item_code || form.item_name
                    for (const entry of validEntries) {
                        const wh = warehouses.find(w => w.name === entry.warehouse)
                        await stockApi.createMaterialReceipt({
                            warehouse: entry.warehouse,
                            company: wh?.company || undefined,
                            items: [{
                                item_code: itemCode,
                                qty: parseFloat(entry.qty),
                                rate: form.standard_rate ? parseFloat(form.standard_rate) : undefined,
                            }],
                            remarks: isRTL
                                ? `رصيد افتتاحي: ${parseFloat(entry.qty)} ${UOM_AR[form.stock_uom] || form.stock_uom} في ${entry.warehouse}`
                                : `Opening stock: ${parseFloat(entry.qty)} ${form.stock_uom} in ${entry.warehouse}`,
                        })
                    }
                    toast({ title: isRTL ? `تم إنشاء المنتج وإضافته في ${validEntries.length} مستودع` : `Product created & added to ${validEntries.length} warehouse(s)` })
                } else {
                    toast({ title: isRTL ? 'تم إنشاء المنتج' : 'Product created' })
                }
            }
            setDialogOpen(false)
            onRefresh()
        } catch (err: any) {
            toast({ variant: 'destructive', title: isRTL ? 'فشل الحفظ' : 'Save failed', description: err.message })
        }
        setSaving(false)
    }

    // ── Toggle (with confirmation) ──
    const handleToggle = (item: Item) => {
        setToggleConfirm({ open: true, item })
    }

    const confirmToggle = async () => {
        const item = toggleConfirm.item
        if (!item) return
        setToggling(true)
        try {
            await stockApi.toggleItem(item.name, !item.disabled)
            toast({
                title: item.disabled
                    ? (isRTL ? 'تم تفعيل المنتج' : 'Product enabled')
                    : (isRTL ? 'تم تعطيل المنتج' : 'Product disabled'),
            })
            setToggleConfirm({ open: false, item: null })
            onRefresh()
        } catch (err: any) {
            toast({ variant: 'destructive', title: isRTL ? 'فشل التحديث' : 'Update failed', description: err.message })
        }
        setToggling(false)
    }

    if (loading) return <div className="p-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>

    return (
        <div className="p-6 space-y-5">
            {/* ── Summary cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                    { labelEn: 'Total Products', labelAr: 'إجمالي المنتجات', value: items.length, icon: ShoppingBag, bg: 'bg-orange-50', color: 'text-orange-600' },
                    { labelEn: 'Active', labelAr: 'نشط', value: activeCount, icon: CheckCircle2, bg: 'bg-green-50', color: 'text-green-600' },
                    { labelEn: 'Disabled', labelAr: 'معطل', value: disabledCount, icon: Ban, bg: 'bg-red-50', color: 'text-red-600' },
                ].map((card, i) => {
                    const Icon = card.icon
                    return (
                        <div key={i} className="bg-white rounded-xl border border-gray-100 p-4">
                            <div className="flex items-center gap-3">
                                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', card.bg)}>
                                    <Icon className={cn('h-4 w-4', card.color)} />
                                </div>
                                <div>
                                    <p className="text-xl font-bold text-gray-900">{card.value}</p>
                                    <p className="text-xs text-gray-500">{isRTL ? card.labelAr : card.labelEn}</p>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* ── Toolbar ── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="relative flex-1 w-full">
                    <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
                    <Input
                        placeholder={isRTL ? 'بحث بالكود أو الاسم أو المجموعة...' : 'Search by code, name or group...'}
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
                        className={cn('h-9 text-sm', isRTL ? 'pr-9' : 'pl-9')}
                    />
                </div>
                {/* Group filter */}
                <select
                    value={groupFilter}
                    onChange={(e) => { setGroupFilter(e.target.value); setCurrentPage(1) }}
                    className="h-9 text-xs border border-gray-200 rounded-lg px-3 bg-white focus:ring-1 focus:ring-orange-500 outline-none"
                >
                    <option value="all">{isRTL ? 'كل المجموعات' : 'All Groups'}</option>
                    {uniqueGroups.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                {/* Status filter */}
                <div className="flex gap-1.5">
                    {(['all', 'active', 'disabled'] as const).map((s) => (
                        <button
                            key={s}
                            onClick={() => { setStatusFilter(s); setCurrentPage(1) }}
                            className={cn(
                                'px-3 py-1 rounded-full text-xs font-medium',
                                statusFilter === s ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            )}
                        >
                            {s === 'all' ? (isRTL ? 'الكل' : 'All') : s === 'active' ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'معطل' : 'Disabled')}
                        </button>
                    ))}
                </div>
                <Button size="sm" variant="outline" onClick={() => setUomDialogOpen(true)}>
                    <Scale className="h-4 w-4" />
                    <span className={cn('text-xs', isRTL ? 'mr-1' : 'ml-1')}>{isRTL ? 'وحدات القياس' : 'UOMs'}</span>
                </Button>
                <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white" onClick={openCreate}>
                    <Plus className="h-4 w-4" />
                    <span className={cn('text-xs', isRTL ? 'mr-1' : 'ml-1')}>{isRTL ? 'منتج جديد' : 'New Product'}</span>
                </Button>
            </div>

            {/* ── Table ── */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50/80 border-b border-gray-100">
                                <th className={cn('px-4 py-3 text-xs font-semibold text-gray-500 uppercase', isRTL ? 'text-right' : 'text-left')}>{isRTL ? 'كود الصنف' : 'Item Code'}</th>
                                <th className={cn('px-4 py-3 text-xs font-semibold text-gray-500 uppercase', isRTL ? 'text-right' : 'text-left')}>{isRTL ? 'اسم المنتج' : 'Product Name'}</th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-center">{isRTL ? 'المجموعة' : 'Group'}</th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-center">{isRTL ? 'الوحدة' : 'UOM'}</th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-center">{isRTL ? 'السعر' : 'Rate'}</th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-center">{isRTL ? 'المخزون' : 'Stock'}</th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-center">{isRTL ? 'الحالة' : 'Status'}</th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-center">{isRTL ? 'إجراءات' : 'Actions'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {paginated.map((item) => {
                                const qty = stockByItem[item.name] || 0
                                return (
                                    <tr key={item.name} className="hover:bg-orange-50/30 transition-colors">
                                        <td className={cn('px-4 py-3', isRTL ? 'text-right' : 'text-left')}>
                                            <button onClick={() => viewDetail(item)} className="text-sm font-medium text-orange-600 hover:underline">{item.name}</button>
                                        </td>
                                        <td className={cn('px-4 py-3 text-sm text-gray-700', isRTL ? 'text-right' : 'text-left')}>
                                            {item.item_name}
                                            {item.item_name !== item.name && <p className="text-[11px] text-gray-400 mt-0.5">{item.description?.slice(0, 60) || ''}</p>}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{item.item_group || '—'}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center text-xs text-gray-500">{isRTL ? (UOM_AR[item.stock_uom || ''] || item.stock_uom || '—') : (item.stock_uom || '—')}</td>
                                        <td className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                                            {item.standard_rate ? `${item.standard_rate.toLocaleString()} ${cur(isRTL)}` : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={cn('text-sm font-semibold', qty > 0 ? 'text-green-600' : 'text-gray-400')}>
                                                {qty > 0 ? qty.toLocaleString() : '0'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={cn(
                                                'text-xs font-medium px-2 py-0.5 rounded-full',
                                                item.disabled ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                                            )}>
                                                {item.disabled ? (isRTL ? 'معطل' : 'Disabled') : (isRTL ? 'نشط' : 'Active')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => viewDetail(item)}>
                                                    <Eye className="h-3.5 w-3.5 text-gray-400" />
                                                </Button>
                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(item)}>
                                                    <Pencil className="h-3.5 w-3.5 text-gray-400" />
                                                </Button>
                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleToggle(item)}>
                                                    {item.disabled
                                                        ? <ToggleLeft className="h-3.5 w-3.5 text-red-400" />
                                                        : <ToggleRight className="h-3.5 w-3.5 text-green-500" />
                                                    }
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                            {paginated.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="text-center py-12 text-sm text-gray-400">
                                        <ShoppingBag className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                                        {isRTL ? 'لا توجد منتجات' : 'No products found'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                        <p className="text-xs text-gray-500">{(currentPage - 1) * perPage + 1}-{Math.min(currentPage * perPage, filtered.length)} / {filtered.length}</p>
                        <div className="flex gap-1">
                            <Button variant="ghost" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>{isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</Button>
                            <Button variant="ghost" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>{isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</Button>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ Create / Edit Dialog ═══ */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingItem ? (isRTL ? 'تعديل المنتج' : 'Edit Product') : (isRTL ? 'منتج جديد' : 'New Product')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-3">
                        {/* Item Code */}
                        {!editingItem && (
                            <div>
                                <label className="text-xs font-medium text-gray-700 mb-1 block">{isRTL ? 'كود الصنف (اختياري)' : 'Item Code (optional)'}</label>
                                <div className="flex gap-1 items-center">
                                    <Input
                                        placeholder={isRTL ? 'يُنشأ تلقائياً إذا تُرك فارغاً' : 'Auto-generated if left empty'}
                                        value={form.item_code}
                                        onChange={(e) => setForm({ ...form, item_code: e.target.value })}
                                        className="h-9 text-sm flex-1"
                                    />
                                    <button
                                        type="button"
                                        onClick={startItemCodeScan}
                                        title={isRTL ? 'مسح الباركود' : 'Scan barcode'}
                                        className="h-9 w-9 flex items-center justify-center rounded-md border border-gray-200 hover:bg-orange-50 hover:border-orange-300 text-gray-400 hover:text-orange-600 transition-colors flex-shrink-0"
                                    >
                                        <Scan className="h-4 w-4" />
                                    </button>
                                </div>
                                {itemCodeCamError && <p className="text-[10px] text-red-500 mt-0.5 px-1">{itemCodeCamError}</p>}
                                {/* Barcode scanner overlay */}
                                {itemCodeScanning && (
                                    <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col items-center justify-center">
                                        <div className="relative w-full max-w-sm mx-4">
                                            <div ref={itemCodeScannerContainerRef} className="rounded-2xl overflow-hidden" />
                                            <p className="text-white/80 text-sm text-center mt-3">{isRTL ? 'وجّه الكاميرا نحو الباركود' : 'Point the camera at the barcode'}</p>
                                            <button
                                                type="button"
                                                onClick={stopItemCodeCamera}
                                                className="mt-3 w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm border border-white/20 transition-colors"
                                            >
                                                {isRTL ? 'إلغاء' : 'Cancel'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {/* Item Name */}
                        <div>
                            <label className="text-xs font-medium text-gray-700 mb-1 block">{isRTL ? 'اسم المنتج' : 'Product Name'} *</label>
                            <Input
                                placeholder={isRTL ? 'أدخل اسم المنتج' : 'Enter product name'}
                                value={form.item_name}
                                onChange={(e) => setForm({ ...form, item_name: e.target.value })}
                                className="h-9 text-sm"
                            />
                        </div>

                        {/* UOM + Rate */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-medium text-gray-700 mb-1 block">{isRTL ? 'وحدة القياس' : 'UOM'}</label>
                                <select
                                    value={form.stock_uom}
                                    onChange={(e) => setForm({ ...form, stock_uom: e.target.value })}
                                    className="w-full h-9 text-sm border border-gray-200 rounded-lg px-3 bg-white focus:ring-1 focus:ring-orange-500 outline-none"
                                >
                                    {uoms.map((u) => {
                                        const ar = COMMON_UOMS.find(c => c.name.toLowerCase() === u.name.toLowerCase())?.ar
                                        return <option key={u.name} value={u.name}>{isRTL && ar ? `${ar} (${u.name})` : u.name}</option>
                                    })}
                                    {uoms.length === 0 && (
                                        <>
                                            <option value="Nos">{isRTL ? 'قطعة' : 'Nos'}</option>
                                            <option value="Kg">{isRTL ? 'كجم' : 'Kg'}</option>
                                            <option value="Box">{isRTL ? 'صندوق' : 'Box'}</option>
                                            <option value="Pair">{isRTL ? 'زوج' : 'Pair'}</option>
                                        </>
                                    )}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-700 mb-1 block">{isRTL ? `السعر (ر.س)` : 'Rate (SAR)'}</label>
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    value={form.standard_rate}
                                    onChange={(e) => setForm({ ...form, standard_rate: e.target.value })}
                                    className="h-9 text-sm"
                                    min={0}
                                    step={0.01}
                                />
                            </div>
                        </div>

                        {/* ── UOM Conversions (تحويل الوحدات) ── */}
                        <div className="border border-orange-100 bg-orange-50/30 rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                                    🔄 {isRTL ? 'تحويل الوحدات' : 'UOM Conversions'}
                                    <span className="text-[10px] text-gray-400 font-normal">
                                        ({isRTL ? `الوحدة الأساسية: ${UOM_AR[form.stock_uom] || form.stock_uom}` : `Base: ${form.stock_uom}`})
                                    </span>
                                </p>
                                {uomConversions.length < 6 && (
                                    <Button
                                        type="button" variant="ghost" size="sm"
                                        onClick={() => setUomConversions(prev => [...prev, { uom: '', conversion_factor: '' }])}
                                        className="h-6 text-[11px] text-orange-600 hover:text-orange-700 px-2"
                                    >
                                        <Plus className="h-3 w-3 mr-0.5" />{isRTL ? 'إضافة وحدة' : 'Add UOM'}
                                    </Button>
                                )}
                            </div>
                            {uomConversions.length === 0 && (
                                <p className="text-[11px] text-gray-400 text-center py-1">
                                    {isRTL ? 'لا توجد وحدات إضافية — اضغط "إضافة وحدة" لتحديد معامل التحويل' : 'No extra UOMs — click "Add UOM" to define conversion factors'}
                                </p>
                            )}
                            {uomConversions.map((conv, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <span className="text-[11px] text-gray-500 whitespace-nowrap shrink-0">1</span>
                                    <select
                                        value={conv.uom}
                                        onChange={(e) => setUomConversions(prev => prev.map((c, i) => i === idx ? { ...c, uom: e.target.value } : c))}
                                        className="flex-1 h-8 text-xs border border-gray-200 rounded-md px-2 bg-white focus:ring-1 focus:ring-orange-500 outline-none"
                                    >
                                        <option value="">{isRTL ? 'اختر وحدة' : 'Select UOM'}</option>
                                        {uoms.filter(u => u.name !== form.stock_uom).map((u) => (
                                            <option key={u.name} value={u.name}>{isRTL ? (UOM_AR[u.name] || u.name) : u.name}</option>
                                        ))}
                                        {uoms.length === 0 && (
                                            <>
                                                <option value="Box">{isRTL ? 'صندوق' : 'Box'}</option>
                                                <option value="Kg">{isRTL ? 'كجم' : 'Kg'}</option>
                                                <option value="Pair">{isRTL ? 'زوج' : 'Pair'}</option>
                                                <option value="Dozen">{isRTL ? 'درزن' : 'Dozen'}</option>
                                                <option value="Carton">{isRTL ? 'كرتون' : 'Carton'}</option>
                                            </>
                                        )}
                                    </select>
                                    <span className="text-[11px] text-gray-500 whitespace-nowrap shrink-0">=</span>
                                    <input
                                        type="number"
                                        placeholder="12"
                                        value={conv.conversion_factor}
                                        onChange={(e) => setUomConversions(prev => prev.map((c, i) => i === idx ? { ...c, conversion_factor: e.target.value } : c))}
                                        className="w-20 h-8 text-xs border border-gray-200 rounded-md px-2 bg-white focus:ring-1 focus:ring-orange-500 outline-none text-center"
                                        min={0.001}
                                        step="any"
                                    />
                                    <span className="text-[11px] text-gray-500 whitespace-nowrap shrink-0">{isRTL ? (UOM_AR[form.stock_uom] || form.stock_uom) : form.stock_uom}</span>
                                    <button
                                        type="button"
                                        onClick={() => setUomConversions(prev => prev.filter((_, i) => i !== idx))}
                                        className="text-red-400 hover:text-red-600 shrink-0"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}
                            {uomConversions.filter(c => c.uom && parseFloat(c.conversion_factor) > 0).length > 0 && (
                                <div className="text-[10px] text-orange-600 bg-orange-50 rounded px-2 py-1 mt-1 space-y-0.5">
                                    {uomConversions.filter(c => c.uom && parseFloat(c.conversion_factor) > 0).map((c, i) => (
                                        <p key={i}>
                                            {isRTL
                                                ? `• 1 ${UOM_AR[c.uom] || c.uom} = ${c.conversion_factor} ${UOM_AR[form.stock_uom] || form.stock_uom}`
                                                : `• 1 ${c.uom} = ${c.conversion_factor} ${form.stock_uom}`
                                            }
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Description */}
                        <div>
                            <label className="text-xs font-medium text-gray-700 mb-1 block">{isRTL ? 'الوصف' : 'Description'}</label>
                            <textarea
                                rows={2}
                                placeholder={isRTL ? 'وصف المنتج (اختياري)' : 'Product description (optional)'}
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-1 focus:ring-orange-500 outline-none resize-none"
                            />
                        </div>

                        {/* ── Warehouse + Opening Quantity (up to 4) ── */}
                        <div className="border-t border-gray-100 pt-4 mt-1">
                            <p className="text-xs font-semibold text-gray-600 mb-3 flex items-center gap-1.5">
                                <WarehouseIcon className="h-3.5 w-3.5" />
                                {isRTL ? 'إضافة للمخازن (حتى 4)' : 'Add to Warehouses (up to 4)'}
                                <span className="text-[10px] text-gray-400 font-normal">{isRTL ? '(اختياري)' : '(optional)'}</span>
                            </p>
                            {warehouseEntries.map((entry, idx) => (
                                <div key={idx} className="flex gap-2 mb-2 items-center">
                                    <div className="flex-1">
                                        <select
                                            value={entry.warehouse}
                                            onChange={(e) => setWarehouseEntries(prev => prev.map((en, i) => i === idx ? { ...en, warehouse: e.target.value } : en))}
                                            className="w-full h-9 text-sm border border-gray-200 rounded-lg px-3 bg-white focus:ring-1 focus:ring-orange-500 outline-none"
                                        >
                                            <option value="">{isRTL ? 'اختر المخزن' : 'Select warehouse'}</option>
                                            {activeWarehouses.map((w) => (
                                                <option key={w.name} value={w.name}>{w.warehouse_name || w.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <input
                                        type="number"
                                        placeholder={isRTL ? 'الكمية' : 'Qty'}
                                        value={entry.qty}
                                        onChange={(e) => setWarehouseEntries(prev => prev.map((en, i) => i === idx ? { ...en, qty: e.target.value } : en))}
                                        className="w-24 h-9 text-sm border border-gray-200 rounded-lg px-3 bg-white focus:ring-1 focus:ring-orange-500 outline-none"
                                        min={0}
                                        step={1}
                                    />
                                    {warehouseEntries.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => setWarehouseEntries(prev => prev.filter((_, i) => i !== idx))}
                                            className="text-red-400 hover:text-red-600"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                            {warehouseEntries.length < 4 && (
                                <Button
                                    type="button"
                                    variant="ghost" size="sm"
                                    onClick={() => setWarehouseEntries(prev => [...prev, { warehouse: '', qty: '' }])}
                                    className="text-xs text-blue-600"
                                >
                                    <Plus className="h-3 w-3 mr-1" />{isRTL ? 'إضافة مخزن آخر' : 'Add Another Warehouse'}
                                </Button>
                            )}
                            {warehouseEntries.filter(e => e.warehouse && parseFloat(e.qty) > 0).length > 0 && (
                                <div className="text-[11px] text-orange-600 mt-2 bg-orange-50 rounded-lg px-3 py-1.5 space-y-0.5">
                                    {warehouseEntries.filter(e => e.warehouse && parseFloat(e.qty) > 0).map((e, i) => (
                                        <p key={i}>
                                            {isRTL
                                                ? `• ${parseFloat(e.qty).toLocaleString()} ${UOM_AR[form.stock_uom] || form.stock_uom} → "${activeWarehouses.find(w => w.name === e.warehouse)?.warehouse_name || e.warehouse}"`
                                                : `• ${parseFloat(e.qty).toLocaleString()} ${form.stock_uom} → "${activeWarehouses.find(w => w.name === e.warehouse)?.warehouse_name || e.warehouse}"`
                                            }
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
                        <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white" onClick={handleSave} disabled={saving}>
                            {saving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : editingItem ? (isRTL ? 'تحديث' : 'Update') : (isRTL ? 'إنشاء' : 'Create')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ═══ Detail Dialog ═══ */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{isRTL ? 'تفاصيل المنتج' : 'Product Details'}</DialogTitle>
                    </DialogHeader>
                    {detailLoading ? (
                        <div className="space-y-3 py-4"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-2/3" /></div>
                    ) : detailItem && (
                        <div className="space-y-3 py-3 text-sm">
                            <div className="flex justify-between"><span className="text-gray-500">{isRTL ? 'كود الصنف' : 'Item Code'}</span><span className="font-medium">{detailItem.name}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">{isRTL ? 'الاسم' : 'Name'}</span><span className="font-medium">{detailItem.item_name}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">{isRTL ? 'المجموعة' : 'Group'}</span><span className="font-medium">{detailItem.item_group || '—'}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">{isRTL ? 'الوحدة' : 'UOM'}</span><span className="font-medium">{isRTL ? (UOM_AR[detailItem.stock_uom || ''] || detailItem.stock_uom || '—') : (detailItem.stock_uom || '—')}</span></div>
                            {/* UOM Conversions */}
                            {(() => {
                                const conversions = (detailItem.uoms || []).filter(u => u.uom !== detailItem.stock_uom)
                                if (conversions.length === 0) return null
                                return (
                                    <div className="bg-orange-50 rounded-lg p-3 space-y-1.5">
                                        <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                                            🔄 {isRTL ? 'تحويل الوحدات' : 'UOM Conversions'}
                                        </p>
                                        {conversions.map((c, i) => (
                                            <div key={i} className="flex justify-between text-xs">
                                                <span className="text-gray-500">1 {isRTL ? (UOM_AR[c.uom] || c.uom) : c.uom}</span>
                                                <span className="font-medium text-orange-600">= {c.conversion_factor} {isRTL ? (UOM_AR[detailItem.stock_uom || ''] || detailItem.stock_uom) : detailItem.stock_uom}</span>
                                            </div>
                                        ))}
                                    </div>
                                )
                            })()}
                            <div className="flex justify-between"><span className="text-gray-500">{isRTL ? 'السعر' : 'Rate'}</span><span className="font-medium">{detailItem.standard_rate ? `${detailItem.standard_rate} ${cur(isRTL)}` : '—'}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">{isRTL ? 'المخزون الحالي' : 'Current Stock'}</span><span className={cn('font-semibold', (stockByItem[detailItem.name] || 0) > 0 ? 'text-green-600' : 'text-gray-400')}>{(stockByItem[detailItem.name] || 0).toLocaleString()}</span></div>
                            {/* Per-warehouse stock breakdown */}
                            {(() => {
                                const warehouseStocks = binStock.filter(b => b.item_code === detailItem.name && b.actual_qty > 0)
                                if (warehouseStocks.length === 0) return null
                                return (
                                    <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
                                        <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                                            <WarehouseIcon className="h-3 w-3" />
                                            {isRTL ? 'توزيع المخزون على المخازن' : 'Stock per Warehouse'}
                                        </p>
                                        {warehouseStocks.map((ws) => (
                                            <div key={ws.warehouse} className="flex justify-between text-xs">
                                                <span className="text-gray-500 truncate max-w-[60%]">{ws.warehouse}</span>
                                                <span className="font-medium text-green-600">{ws.actual_qty.toLocaleString()} {isRTL ? (UOM_AR[ws.stock_uom || detailItem.stock_uom || ''] || ws.stock_uom || detailItem.stock_uom || '') : (ws.stock_uom || detailItem.stock_uom || '')}</span>
                                            </div>
                                        ))}
                                    </div>
                                )
                            })()}
                            {detailItem.description && (
                                <div>
                                    <p className="text-gray-500 mb-1">{isRTL ? 'الوصف' : 'Description'}</p>
                                    <p className="text-gray-700 text-xs bg-gray-50 rounded-lg p-2">{detailItem.description}</p>
                                </div>
                            )}
                            <div className="flex justify-between text-[11px] text-gray-400 pt-2 border-t border-gray-100">
                                <span>{isRTL ? 'تاريخ الإنشاء' : 'Created'}: {detailItem.creation?.split(' ')[0] || '—'}</span>
                                <span>{isRTL ? 'آخر تعديل' : 'Modified'}: {detailItem.modified?.split(' ')[0] || '—'}</span>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ── Toggle Confirmation Dialog ── */}
            <AlertDialog open={toggleConfirm.open} onOpenChange={(open) => !open && setToggleConfirm({ open: false, item: null })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {toggleConfirm.item?.disabled
                                ? (isRTL ? 'تفعيل المنتج' : 'Enable Product')
                                : (isRTL ? 'تعطيل المنتج' : 'Disable Product')}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {toggleConfirm.item?.disabled
                                ? (isRTL
                                    ? `هل تريد تفعيل "${toggleConfirm.item?.item_name || toggleConfirm.item?.name}"؟`
                                    : `Are you sure you want to enable "${toggleConfirm.item?.item_name || toggleConfirm.item?.name}"?`)
                                : (isRTL
                                    ? `هل تريد تعطيل "${toggleConfirm.item?.item_name || toggleConfirm.item?.name}"؟ لن يظهر في عمليات المخزون.`
                                    : `Are you sure you want to disable "${toggleConfirm.item?.item_name || toggleConfirm.item?.name}"? It will not appear in stock operations.`)}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={toggling}>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmToggle}
                            disabled={toggling}
                            className={toggleConfirm.item?.disabled ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
                        >
                            {toggling
                                ? (isRTL ? 'جاري...' : 'Processing...')
                                : toggleConfirm.item?.disabled
                                    ? (isRTL ? 'تفعيل' : 'Enable')
                                    : (isRTL ? 'تعطيل' : 'Disable')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── UOM Management Dialog ── */}
            <Dialog open={uomDialogOpen} onOpenChange={setUomDialogOpen}>
                <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{isRTL ? 'إدارة وحدات القياس' : 'Manage UOMs'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        {/* Seed common UOMs */}
                        {seedableCount > 0 && (
                            <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                                <span className="text-xs text-orange-700">
                                    {isRTL ? `${seedableCount} وحدة شائعة يمكن إضافتها` : `${seedableCount} common UOMs available to add`}
                                </span>
                                <Button size="sm" variant="outline" onClick={handleSeedUOMs} disabled={uomSeeding} className="h-7 text-xs border-orange-300 text-orange-700 hover:bg-orange-100">
                                    {uomSeeding ? <RefreshCw className="h-3 w-3 animate-spin" /> : (isRTL ? 'إضافة الشائعة' : 'Add Common')}
                                </Button>
                            </div>
                        )}
                        {/* New UOM form */}
                        <div className="flex gap-2 items-end">
                            <div className="flex-1">
                                <label className="text-xs font-medium text-gray-600 mb-1 block">{isRTL ? 'وحدة جديدة' : 'New UOM'}</label>
                                <Input
                                    value={uomFormName}
                                    onChange={(e) => setUomFormName(e.target.value)}
                                    placeholder={isRTL ? 'مثال: كرتون' : 'e.g. Carton'}
                                    className="h-9 text-sm"
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleUomCreate() }}
                                />
                            </div>
                            <div className="flex items-center gap-1.5 pb-0.5">
                                <input type="checkbox" id="uom-whole" checked={uomFormWholeNumber} onChange={(e) => setUomFormWholeNumber(e.target.checked)} className="h-3.5 w-3.5 rounded border-gray-300 text-orange-600 focus:ring-orange-500" />
                                <label htmlFor="uom-whole" className="text-[11px] text-gray-500 whitespace-nowrap">{isRTL ? 'أعداد صحيحة فقط' : 'Whole'}</label>
                            </div>
                            <Button size="sm" onClick={handleUomCreate} disabled={uomSaving} className="bg-orange-600 hover:bg-orange-700 text-white h-9">
                                {uomSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                            </Button>
                        </div>
                        {/* UOM list */}
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 text-xs text-gray-500">
                                        <th className={cn('px-3 py-2 font-medium', isRTL ? 'text-right' : 'text-left')}>{isRTL ? 'الوحدة' : 'UOM'}</th>
                                        <th className="px-3 py-2 font-medium text-center">{isRTL ? 'أعداد صحيحة فقط' : 'Whole'}</th>
                                        <th className="px-3 py-2 font-medium text-center w-20">{isRTL ? 'إجراء' : 'Action'}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {uoms.map((u) => {
                                        const ar = COMMON_UOMS.find(c => c.name.toLowerCase() === u.name.toLowerCase())?.ar
                                        return (
                                            <tr key={u.name} className="hover:bg-gray-50/50">
                                                <td className={cn('px-3 py-2 font-medium text-gray-800', isRTL ? 'text-right' : 'text-left')}>
                                                    {u.name}
                                                    {ar && <span className="text-[11px] text-gray-400 mx-1">({ar})</span>}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <span className={cn('text-xs', u.must_be_whole_number ? 'text-blue-600' : 'text-gray-300')}>
                                                        {u.must_be_whole_number ? '✓' : '—'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <div className="flex items-center justify-center gap-0.5">
                                                        <button
                                                            onClick={() => { setUomEditDialog({ open: true, uom: u }); setUomEditName(u.name); setUomFormWholeNumber(!!u.must_be_whole_number) }}
                                                            className="p-1 rounded hover:bg-gray-100"
                                                            title={isRTL ? 'تعديل' : 'Edit'}
                                                        >
                                                            <Pencil className="h-3 w-3 text-gray-400" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleUomDelete(u.name)}
                                                            disabled={uomDeleting === u.name}
                                                            className="p-1 rounded hover:bg-red-50"
                                                            title={isRTL ? 'حذف' : 'Delete'}
                                                        >
                                                            {uomDeleting === u.name ? <RefreshCw className="h-3 w-3 animate-spin text-gray-400" /> : <Trash2 className="h-3 w-3 text-red-400" />}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    {uoms.length === 0 && <tr><td colSpan={3} className="text-center py-6 text-xs text-gray-400">{isRTL ? 'لا توجد وحدات' : 'No UOMs'}</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Edit UOM Dialog (whole number toggle) ── */}
            <Dialog open={uomEditDialog.open} onOpenChange={(o) => setUomEditDialog({ open: o, uom: o ? uomEditDialog.uom : null })}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{isRTL ? 'تعديل' : 'Edit'} {uomEditDialog.uom?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div>
                            <label htmlFor="edit-uom-name" className="text-xs font-medium text-gray-600 mb-1 block">{isRTL ? 'اسم الوحدة' : 'UOM Name'}</label>
                            <Input
                                id="edit-uom-name"
                                value={uomEditName}
                                onChange={(e) => setUomEditName(e.target.value)}
                                placeholder={uomEditDialog.uom?.name}
                                className="h-9 text-sm"
                            />
                            {uomEditName.trim() && uomEditName.trim() !== uomEditDialog.uom?.name && (
                                <p className="text-[11px] text-amber-600 mt-1">
                                    {isRTL ? 'سيتم تحديث اسم الوحدة في جميع السجلات المرتبطة' : 'This will rename the UOM across all linked records'}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <input type="checkbox" id="edit-uom-whole" checked={uomFormWholeNumber} onChange={(e) => setUomFormWholeNumber(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500" />
                            <label htmlFor="edit-uom-whole" className="text-sm text-gray-700">{isRTL ? 'أعداد صحيحة فقط (بدون كسور)' : 'Must be whole number (no fractions)'}</label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setUomEditDialog({ open: false, uom: null })}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
                        <Button onClick={handleUomUpdate} disabled={uomSaving} className="bg-orange-600 hover:bg-orange-700 text-white">
                            {uomSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : (isRTL ? 'تحديث' : 'Update')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
// ═══════════════════════════════════════════════
// 1. DASHBOARD
// ═══════════════════════════════════════════════
function DashboardView({
    warehouses, pendingTransfers, returnLogs, auditLogs, binStock, loading, onNavigate,
}: {
    warehouses: Warehouse[]
    pendingTransfers: StockTransferRequest[]
    returnLogs: ProductReturn[]
    auditLogs: StockMovementAudit[]
    binStock: BinStock[]
    loading: boolean
    onNavigate: (tab: string) => void
}) {
    const { isRTL } = useI18n()

    const activeWarehouses = warehouses.filter((w) => !w.disabled && !w.is_group)
    const vanWarehouses = warehouses.filter((w) => w.custom_warehouse_type === 'Van' && !w.disabled)
    const mainWarehouses = warehouses.filter((w) => w.custom_warehouse_type === 'Main' && !w.disabled)
    const totalSKUs = new Set(binStock.map((b) => b.item_code)).size
    const totalStockValue = binStock.reduce((sum, b) => sum + (b.stock_value || 0), 0)
    const recentAudit = auditLogs.slice(0, 5)

    if (loading) return <div className="p-6 space-y-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}</div>

    const statCards = [
        {
            labelAr: 'المستودعات النشطة', labelEn: 'Active Warehouses', value: activeWarehouses.length,
            sub: `${mainWarehouses.length} ${isRTL ? 'رئيسي' : 'main'} · ${vanWarehouses.length} ${isRTL ? 'فان' : 'van'}`,
            icon: WarehouseIcon, color: 'text-blue-600', bg: 'bg-blue-50', onClick: () => onNavigate('warehouses'),
        },
        {
            labelAr: 'أصناف في المخزون', labelEn: 'SKUs in Stock', value: totalSKUs,
            sub: `${isRTL ? 'القيمة:' : 'Value:'} ${totalStockValue.toLocaleString()} ${cur(isRTL)}`,
            icon: Database, color: 'text-emerald-600', bg: 'bg-emerald-50', onClick: () => onNavigate('inventory'),
        },
        {
            labelAr: 'طلبات نقل معلقة', labelEn: 'Pending Transfers', value: pendingTransfers.length,
            sub: isRTL ? 'بانتظار المراجعة' : 'Awaiting review',
            icon: ArrowRightLeft, color: 'text-amber-600', bg: 'bg-amber-50', onClick: () => onNavigate('transfers'),
        },
        {
            labelAr: 'المرتجعات', labelEn: 'Returns', value: returnLogs.length,
            sub: `${returnLogs.filter((r) => !r.docstatus || r.docstatus === 0).length} ${isRTL ? 'مسودة' : 'drafts'}`,
            icon: RotateCcw, color: 'text-purple-600', bg: 'bg-purple-50', onClick: () => onNavigate('returns'),
        },
    ]

    return (
        <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
            {/* Stats grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((card, i) => {
                    const Icon = card.icon
                    return (
                        <button
                            key={i}
                            onClick={card.onClick}
                            className="bg-white rounded-xl border border-gray-100 p-5 text-start hover:shadow-md hover:border-gray-200 transition-all group"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', card.bg)}>
                                    <Icon className={cn('h-5 w-5', card.color)} />
                                </div>
                                <ChevronRight className={cn('h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors', isRTL && 'rotate-180')} />
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{card.value.toLocaleString()}</p>
                            <p className="text-sm font-medium text-gray-600 mt-0.5">{isRTL ? card.labelAr : card.labelEn}</p>
                            <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
                        </button>
                    )
                })}
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Warehouse types breakdown */}
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">
                        {isRTL ? 'توزيع المستودعات' : 'Warehouse Distribution'}
                    </h3>
                    <div className="space-y-3">
                        {(['Main', 'Van', 'Customer Location', 'Temporary', 'Damaged', 'Returns'] as const).map((type) => {
                            const count = warehouses.filter((w) => w.custom_warehouse_type === type && !w.is_group).length
                            const total = activeWarehouses.length || 1
                            const pct = Math.round((count / total) * 100)
                            const colors: Record<string, string> = {
                                Main: 'bg-blue-500', Van: 'bg-emerald-500', 'Customer Location': 'bg-violet-500',
                                Temporary: 'bg-amber-500', Damaged: 'bg-red-500', Returns: 'bg-gray-500',
                            }
                            return (
                                <div key={type} className="flex items-center gap-3">
                                    <span className="text-xs text-gray-500 w-28 truncate">{tr(WAREHOUSE_TYPE_AR, type, isRTL)}</span>
                                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div className={cn('h-full rounded-full transition-all', colors[type])} style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="text-xs font-medium text-gray-600 w-8 text-right">{count}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Recent movements */}
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-700">
                            {isRTL ? 'آخر الحركات' : 'Recent Movements'}
                        </h3>
                        <button onClick={() => onNavigate('audit')} className="text-xs text-orange-600 hover:underline">
                            {isRTL ? 'عرض الكل' : 'View all'}
                        </button>
                    </div>
                    {recentAudit.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-6">{isRTL ? 'لا توجد حركات' : 'No movements'}</p>
                    ) : (
                        <div className="space-y-2">
                            {recentAudit.map((a) => (
                                <div key={a.name} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                                    <div className={cn(
                                        'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold',
                                        a.movement_type === 'In' ? 'bg-green-50 text-green-600' :
                                            a.movement_type === 'Out' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                                    )}>
                                        {a.movement_type === 'In' ? <TrendingUp className="h-4 w-4" /> :
                                            a.movement_type === 'Out' ? <TrendingDown className="h-4 w-4" /> :
                                                <ArrowDownUp className="h-4 w-4" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-700 truncate">{a.item_code}</p>
                                        <p className="text-xs text-gray-400 truncate">{a.warehouse}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className={cn('text-sm font-semibold', a.quantity_change > 0 ? 'text-green-600' : 'text-red-600')}>
                                            {a.quantity_change > 0 ? '+' : ''}{a.quantity_change}
                                        </p>
                                        <p className="text-[10px] text-gray-400">{a.movement_date}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Low Stock Alerts */}
            {(() => {
                const LOW_STOCK_THRESHOLD = 10
                // Group binStock by item_code, summing actual_qty
                const itemTotals: Record<string, { item_code: string; total_qty: number; warehouses: string[] }> = {}
                for (const b of binStock) {
                    if (!itemTotals[b.item_code]) {
                        itemTotals[b.item_code] = { item_code: b.item_code, total_qty: 0, warehouses: [] }
                    }
                    itemTotals[b.item_code].total_qty += b.actual_qty
                    if (b.actual_qty > 0 && !itemTotals[b.item_code].warehouses.includes(b.warehouse)) {
                        itemTotals[b.item_code].warehouses.push(b.warehouse)
                    }
                }
                const lowStockItems = Object.values(itemTotals)
                    .filter(i => i.total_qty > 0 && i.total_qty <= LOW_STOCK_THRESHOLD)
                    .sort((a, b) => a.total_qty - b.total_qty)
                    .slice(0, 8)

                if (lowStockItems.length === 0) return null

                return (
                    <div className="bg-white rounded-xl border border-amber-200 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-700">
                                        {isRTL ? 'تنبيهات المخزون المنخفض' : 'Low Stock Alerts'}
                                    </h3>
                                    <p className="text-xs text-gray-400">
                                        {isRTL ? `أصناف بكمية أقل من ${LOW_STOCK_THRESHOLD}` : `Items with quantity below ${LOW_STOCK_THRESHOLD}`}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => onNavigate('inventory')} className="text-xs text-orange-600 hover:underline">
                                {isRTL ? 'عرض المخزون' : 'View Inventory'}
                            </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {lowStockItems.map((item) => (
                                <div key={item.item_code} className="flex items-center gap-3 p-3 rounded-lg border border-amber-100 bg-amber-50/30">
                                    <div className={cn(
                                        'w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold',
                                        item.total_qty <= 3 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                    )}>
                                        {item.total_qty}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-700 truncate">{item.item_code}</p>
                                        <p className="text-[10px] text-gray-400 truncate">
                                            {item.warehouses.length} {isRTL ? 'مستودع' : item.warehouses.length === 1 ? 'warehouse' : 'warehouses'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            })()}
        </div>
    )
}

// ═══════════════════════════════════════════════
// 2. WAREHOUSES — Full CRUD + Sales Person Links
// ═══════════════════════════════════════════════
// Warehouse type colours → lib/status-config.ts getStatusClass()

export function WarehousesView({
    warehouses, binStock, salesPersons, loading, onRefresh,
    companyFromAuth, isAdmin: isAdminUser, allCompanies: authCompanies,
}: {
    warehouses: Warehouse[]
    binStock: BinStock[]
    salesPersons: SalesPerson[]
    loading: boolean
    onRefresh: () => void
    companyFromAuth?: string | null
    isAdmin?: boolean
    allCompanies?: string[]
}) {
    const { isRTL } = useI18n()
    const { toast } = useToast()
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState<string>('all')
    const [companyFilter, setCompanyFilter] = useState<string>('')
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 15

    // ── Create / Edit dialog ──
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({
        warehouse_name: '',
        custom_warehouse_type: 'Main' as string,
        company: '',
        parent_warehouse: '',
        custom_gps_lat: '',
        custom_gps_lng: '',
    })

    // ── Detail dialog ──
    const [detailOpen, setDetailOpen] = useState(false)
    const [detailWarehouse, setDetailWarehouse] = useState<Warehouse | null>(null)

    // ── Toggle confirmation dialog ──
    const [toggleConfirm, setToggleConfirm] = useState<{ open: boolean; warehouse: Warehouse | null }>({ open: false, warehouse: null })
    const [toggling, setToggling] = useState(false)

    // ── Delete confirmation dialog ──
    const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; warehouse: Warehouse | null }>({ open: false, warehouse: null })
    const [deleting, setDeleting] = useState(false)

    // Dropdown data
    const [companies, setCompanies] = useState<Array<{ name: string; company_name: string }>>([])
    const [warehouseGroups, setWarehouseGroups] = useState<Warehouse[]>([])

    useEffect(() => {
        // If we have company info from auth, use it instead of fetching all companies
        if (companyFromAuth) {
            // Non-admin user: use their company only
            setCompanies([{ name: companyFromAuth, company_name: companyFromAuth }])
            if (!companyFilter) setCompanyFilter(companyFromAuth)
        } else if (isAdminUser && authCompanies && authCompanies.length > 0) {
            // Admin with all companies from auth context
            setCompanies(authCompanies.map(c => ({ name: c, company_name: c })))
            if (!companyFilter && authCompanies.length > 0) setCompanyFilter(authCompanies[0])
        } else {
            // Fallback: fetch from API (backward compat)
            stockApi.getCompanies().then((list) => {
                setCompanies(list)
                if (list.length > 0 && !companyFilter) setCompanyFilter(list[0].name)
            }).catch(() => { })
        }
        stockApi.getWarehouseGroups().then(setWarehouseGroups).catch(() => { })
    }, [companyFromAuth, isAdminUser, authCompanies])

    const leafWarehouses = useMemo(() => warehouses.filter((w) => !w.is_group), [warehouses])

    const filtered = useMemo(() => {
        let list = leafWarehouses
        if (companyFilter) list = list.filter((w) => w.company === companyFilter)
        if (typeFilter !== 'all') list = list.filter((w) => w.custom_warehouse_type === typeFilter)
        if (search) {
            const q = search.toLowerCase()
            list = list.filter(
                (w) =>
                    w.name.toLowerCase().includes(q) ||
                    w.warehouse_name.toLowerCase().includes(q)
            )
        }
        return list
    }, [leafWarehouses, search, typeFilter, companyFilter])

    const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    const totalPages = Math.ceil(filtered.length / itemsPerPage)

    const getSkuCount = (warehouseName: string) =>
        new Set(binStock.filter((b) => b.warehouse === warehouseName).map((b) => b.item_code)).size

    const getStockValue = (warehouseName: string) =>
        binStock.filter((b) => b.warehouse === warehouseName).reduce((sum, b) => sum + (b.stock_value || 0), 0)

    const openCreate = () => {
        setEditingWarehouse(null)
        setForm({
            warehouse_name: '',
            custom_warehouse_type: 'Main',
            company: companyFilter || companies[0]?.name || '',
            parent_warehouse: '',
            custom_gps_lat: '',
            custom_gps_lng: '',
        })
        setDialogOpen(true)
    }

    const openEdit = (w: Warehouse) => {
        setEditingWarehouse(w)
        setForm({
            warehouse_name: w.warehouse_name,
            custom_warehouse_type: w.custom_warehouse_type || 'Main',
            company: w.company || companyFilter || companies[0]?.name || '',
            parent_warehouse: w.parent_warehouse || '',
            custom_gps_lat: w.custom_gps_lat || '',
            custom_gps_lng: w.custom_gps_lng || '',
        })
        setDialogOpen(true)
    }

    const handleSave = async () => {
        if (!form.warehouse_name.trim()) {
            toast({ title: isRTL ? 'اسم المستودع مطلوب' : 'Warehouse name required', variant: 'destructive' })
            return
        }
        if (!form.company) {
            toast({ title: isRTL ? 'الشركة مطلوبة' : 'Company required', variant: 'destructive' })
            return
        }
        setSaving(true)
        try {
            if (editingWarehouse) {
                await stockApi.updateWarehouse(editingWarehouse.name, {
                    warehouse_name: form.warehouse_name,
                    custom_warehouse_type: form.custom_warehouse_type as any,
                    custom_gps_lat: form.custom_gps_lat || undefined,
                    custom_gps_lng: form.custom_gps_lng || undefined,
                })
                toast({ title: isRTL ? 'تم تحديث المستودع' : 'Warehouse updated' })
            } else {
                await stockApi.createWarehouse({
                    warehouse_name: form.warehouse_name,
                    company: form.company,
                    custom_warehouse_type: form.custom_warehouse_type as Warehouse['custom_warehouse_type'],
                    parent_warehouse: form.parent_warehouse || undefined,
                    custom_gps_lat: form.custom_gps_lat || undefined,
                    custom_gps_lng: form.custom_gps_lng || undefined,
                })
                toast({ title: isRTL ? 'تم إنشاء المستودع' : 'Warehouse created' })
            }
            setDialogOpen(false)
            onRefresh()
        } catch (e: any) {
            toast({ title: isRTL ? 'خطأ' : 'Error', description: e?.message, variant: 'destructive' })
        } finally {
            setSaving(false)
        }
    }

    const handleToggle = (w: Warehouse) => {
        setToggleConfirm({ open: true, warehouse: w })
    }

    const confirmToggle = async () => {
        const w = toggleConfirm.warehouse
        if (!w) return
        setToggling(true)
        try {
            await stockApi.toggleWarehouse(w.name, !w.disabled)
            toast({ title: isRTL ? (w.disabled ? 'تم التفعيل' : 'تم التعطيل') : (w.disabled ? 'Enabled' : 'Disabled') })
            setToggleConfirm({ open: false, warehouse: null })
            onRefresh()
        } catch (e: any) {
            toast({ title: isRTL ? 'خطأ' : 'Error', description: e?.message, variant: 'destructive' })
        }
        setToggling(false)
    }

    const handleDelete = (w: Warehouse) => {
        setDeleteConfirm({ open: true, warehouse: w })
    }

    const confirmDelete = async () => {
        const w = deleteConfirm.warehouse
        if (!w) return
        setDeleting(true)
        try {
            await stockApi.deleteWarehouse(w.name)
            toast({ title: isRTL ? 'تم حذف المستودع' : 'Warehouse deleted' })
            setDeleteConfirm({ open: false, warehouse: null })
            onRefresh()
        } catch (e: any) {
            toast({ title: isRTL ? 'فشل الحذف' : 'Delete failed', description: e?.message, variant: 'destructive' })
        }
        setDeleting(false)
    }

    const openDetail = (w: Warehouse) => {
        setDetailWarehouse(w)
        setDetailOpen(true)
    }

    const typeOptions = ['all', 'Main', 'Van', 'Customer Location', 'Temporary', 'Damaged', 'Returns']

    if (loading) return <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>

    return (
        <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
            {/* Filters & Actions */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
                    <Input
                        placeholder={isRTL ? 'بحث في المستودعات...' : 'Search warehouses...'}
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
                        className={cn('h-9 text-sm', isRTL ? 'pr-9' : 'pl-9')}
                    />
                </div>
                {companies.length > 1 && (
                    <select
                        value={companyFilter}
                        onChange={(e) => { setCompanyFilter(e.target.value); setCurrentPage(1) }}
                        className="h-9 text-xs border border-gray-200 rounded-lg px-3 bg-white focus:ring-1 focus:ring-orange-500 outline-none"
                    >
                        {companies.map((c) => <option key={c.name} value={c.name}>{c.company_name || c.name}</option>)}
                    </select>
                )}
                <div className="flex flex-wrap gap-1.5">
                    {typeOptions.map((t) => {
                        const base = companyFilter ? leafWarehouses.filter(w => w.company === companyFilter) : leafWarehouses
                        const count = t === 'all' ? base.length : base.filter((w) => w.custom_warehouse_type === t).length
                        return (
                            <button
                                key={t}
                                onClick={() => { setTypeFilter(t); setCurrentPage(1) }}
                                className={cn(
                                    'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                                    typeFilter === t ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                )}
                            >
                                {t === 'all' ? (isRTL ? 'الكل' : 'All') : tr(WAREHOUSE_TYPE_AR, t, isRTL)} ({count})
                            </button>
                        )
                    })}
                </div>
                <Button size="sm" onClick={openCreate} className="bg-orange-600 hover:bg-orange-700 text-white">
                    <Plus className="h-4 w-4" />
                    <span className={cn('text-xs', isRTL ? 'mr-1' : 'ml-1')}>{isRTL ? 'مستودع جديد' : 'New Warehouse'}</span>
                </Button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                    { label: isRTL ? 'إجمالي' : 'Total', value: filtered.length, icon: WarehouseIcon, color: 'text-gray-600' },
                    { label: isRTL ? 'رئيسي' : 'Main', value: filtered.filter((w) => w.custom_warehouse_type === 'Main').length, icon: Package, color: 'text-blue-600' },
                    { label: isRTL ? 'فان' : 'Van', value: filtered.filter((w) => w.custom_warehouse_type === 'Van').length, icon: Truck, color: 'text-emerald-600' },
                ].map((s, i) => {
                    const Icon = s.icon
                    return (
                        <div key={i} className="bg-white rounded-lg border border-gray-100 px-4 py-3 flex items-center gap-3">
                            <Icon className={cn('h-5 w-5', s.color)} />
                            <div>
                                <p className="text-lg font-bold text-gray-900">{s.value}</p>
                                <p className="text-xs text-gray-500">{s.label}</p>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                                <th className={cn('px-4 py-3 font-medium', isRTL ? 'text-right' : 'text-left')}>{isRTL ? 'المستودع' : 'Warehouse'}</th>
                                <th className={cn('px-4 py-3 font-medium', isRTL ? 'text-right' : 'text-left')}>{isRTL ? 'النوع' : 'Type'}</th>
                                <th className="px-4 py-3 font-medium text-center">{isRTL ? 'الأصناف' : 'SKUs'}</th>
                                <th className="px-4 py-3 font-medium text-center">{isRTL ? 'القيمة' : 'Value'}</th>
                                <th className="px-4 py-3 font-medium text-center">{isRTL ? 'الحالة' : 'Status'}</th>
                                <th className="px-4 py-3 font-medium text-center">{isRTL ? 'إجراءات' : 'Actions'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {paginated.map((w) => {
                                const skus = getSkuCount(w.name)
                                const val = getStockValue(w.name)
                                return (
                                    <tr key={w.name} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <button onClick={() => openDetail(w)} className="text-sm font-medium text-gray-800 hover:text-orange-600 transition-colors">
                                                {w.warehouse_name}
                                            </button>
                                            <p className="text-xs text-gray-400 truncate max-w-[200px]">{w.name}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', getStatusClass(w.custom_warehouse_type))}>
                                                {tr(WAREHOUSE_TYPE_AR, w.custom_warehouse_type || '—', isRTL)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {skus > 0 ? (
                                                <Badge variant="secondary" className="text-xs">{skus}</Badge>
                                            ) : (
                                                <span className="text-xs text-gray-300">0</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center text-xs text-gray-600">
                                            {val > 0 ? val.toLocaleString() : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {w.disabled ? (
                                                <Badge variant="outline" className="text-xs text-red-500 border-red-200"><Ban className="h-3 w-3 mr-1" />{isRTL ? 'معطل' : 'Disabled'}</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-xs text-green-600 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />{isRTL ? 'نشط' : 'Active'}</Badge>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => openDetail(w)} className="p-1.5 rounded-lg hover:bg-gray-100" title={isRTL ? 'عرض' : 'View'}>
                                                    <Eye className="h-3.5 w-3.5 text-gray-500" />
                                                </button>
                                                <button onClick={() => openEdit(w)} className="p-1.5 rounded-lg hover:bg-gray-100" title={isRTL ? 'تعديل' : 'Edit'}>
                                                    <Pencil className="h-3.5 w-3.5 text-gray-500" />
                                                </button>
                                                <button onClick={() => handleToggle(w)} className="p-1.5 rounded-lg hover:bg-gray-100" title={isRTL ? 'تعطيل/تفعيل' : 'Toggle'}>
                                                    {w.disabled ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Ban className="h-3.5 w-3.5 text-red-400" />}
                                                </button>
                                                <button onClick={() => handleDelete(w)} className="p-1.5 rounded-lg hover:bg-red-50" title={isRTL ? 'حذف' : 'Delete'}>
                                                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                            {paginated.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center py-12 text-sm text-gray-400">
                                        {isRTL ? 'لا توجد مستودعات' : 'No warehouses found'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                        <p className="text-xs text-gray-500">
                            {isRTL
                                ? `عرض ${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, filtered.length)} من ${filtered.length}`
                                : `${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, filtered.length)} of ${filtered.length}`}
                        </p>
                        <div className="flex gap-1">
                            <Button variant="ghost" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
                                {isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                                {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Create/Edit Dialog ── */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingWarehouse ? (isRTL ? 'تعديل مستودع' : 'Edit Warehouse') : (isRTL ? 'مستودع جديد' : 'New Warehouse')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">{isRTL ? 'اسم المستودع' : 'Warehouse Name'} *</label>
                            <Input value={form.warehouse_name} onChange={(e) => setForm((f) => ({ ...f, warehouse_name: e.target.value }))} placeholder={isRTL ? 'مثال: مستودع الرياض الرئيسي' : 'e.g. Riyadh Main Warehouse'} />
                        </div>
                        {!editingWarehouse && (
                            <div>
                                <label className="text-xs font-medium text-gray-600 mb-1 block">{isRTL ? 'الشركة' : 'Company'} *</label>
                                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}>
                                    <option value="">{isRTL ? 'اختر شركة' : 'Select company'}</option>
                                    {companies.map((c) => <option key={c.name} value={c.name}>{c.company_name || c.name}</option>)}
                                </select>
                            </div>
                        )}
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">{isRTL ? 'نوع المستودع' : 'Warehouse Type'}</label>
                            <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.custom_warehouse_type} onChange={(e) => setForm((f) => ({ ...f, custom_warehouse_type: e.target.value }))}>
                                {['Main', 'Van', 'Customer Location', 'Temporary', 'Damaged', 'Returns'].map((t) => <option key={t} value={t}>{tr(WAREHOUSE_TYPE_AR, t, isRTL)}</option>)}
                            </select>
                        </div>
                        {!editingWarehouse && (
                            <div>
                                <label className="text-xs font-medium text-gray-600 mb-1 block">{isRTL ? 'المستودع الأب' : 'Parent Warehouse'}</label>
                                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.parent_warehouse} onChange={(e) => setForm((f) => ({ ...f, parent_warehouse: e.target.value }))}>
                                    <option value="">{isRTL ? 'بدون' : 'None'}</option>
                                    {warehouseGroups.map((g) => <option key={g.name} value={g.name}>{g.warehouse_name}</option>)}
                                </select>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-medium text-gray-600 mb-1 block"><MapPin className="inline h-3.5 w-3.5 mr-1" />{isRTL ? 'خط العرض' : 'Latitude'}</label>
                                <Input value={form.custom_gps_lat} onChange={(e) => setForm((f) => ({ ...f, custom_gps_lat: e.target.value }))} placeholder="24.7136" />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-600 mb-1 block"><MapPin className="inline h-3.5 w-3.5 mr-1" />{isRTL ? 'خط الطول' : 'Longitude'}</label>
                                <Input value={form.custom_gps_lng} onChange={(e) => setForm((f) => ({ ...f, custom_gps_lng: e.target.value }))} placeholder="46.6753" />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
                        <Button onClick={handleSave} disabled={saving} className="bg-orange-600 hover:bg-orange-700 text-white">
                            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : (editingWarehouse ? (isRTL ? 'حفظ' : 'Save') : (isRTL ? 'إنشاء' : 'Create'))}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Detail Dialog ── */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{detailWarehouse?.warehouse_name || ''}</DialogTitle>
                    </DialogHeader>
                    {detailWarehouse && (
                        <div className="space-y-5">
                            {/* Info grid */}
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { label: isRTL ? 'الاسم الفني' : 'System Name', value: detailWarehouse.name },
                                    { label: isRTL ? 'النوع' : 'Type', value: tr(WAREHOUSE_TYPE_AR, detailWarehouse.custom_warehouse_type || '—', isRTL) },
                                    { label: isRTL ? 'الشركة' : 'Company', value: detailWarehouse.company || '—' },
                                    { label: isRTL ? 'المستودع الأب' : 'Parent', value: detailWarehouse.parent_warehouse || '—' },
                                    { label: isRTL ? 'الإحداثيات' : 'GPS', value: detailWarehouse.custom_gps_lat && detailWarehouse.custom_gps_lng ? `${detailWarehouse.custom_gps_lat}, ${detailWarehouse.custom_gps_lng}` : '—' },
                                    { label: isRTL ? 'الحالة' : 'Status', value: detailWarehouse.disabled ? (isRTL ? 'معطل' : 'Disabled') : (isRTL ? 'نشط' : 'Active') },
                                ].map((field, i) => (
                                    <div key={i}>
                                        <p className="text-xs text-gray-400 mb-0.5">{field.label}</p>
                                        <p className="text-sm font-medium text-gray-800">{field.value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Stock in this warehouse */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                                    {isRTL ? 'المخزون في هذا المستودع' : 'Stock in this Warehouse'}
                                </h4>
                                {(() => {
                                    const items = binStock.filter((b) => b.warehouse === detailWarehouse.name)
                                    if (items.length === 0)
                                        return <p className="text-sm text-gray-400 text-center py-4">{isRTL ? 'لا يوجد مخزون' : 'No stock'}</p>
                                    return (
                                        <div className="border rounded-lg overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="bg-gray-50 text-xs text-gray-500">
                                                        <th className={cn('px-3 py-2', isRTL ? 'text-right' : 'text-left')}>{isRTL ? 'الصنف' : 'Item'}</th>
                                                        <th className="px-3 py-2 text-center">{isRTL ? 'الكمية' : 'Qty'}</th>
                                                        <th className="px-3 py-2 text-center">{isRTL ? 'الوحدة' : 'UOM'}</th>
                                                        <th className="px-3 py-2 text-center">{isRTL ? 'القيمة' : 'Value'}</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {items.slice(0, 20).map((b, i) => (
                                                        <tr key={i}>
                                                            <td className={cn('px-3 py-2 font-medium', isRTL ? 'text-right' : 'text-left')}>{b.item_code}</td>
                                                            <td className="px-3 py-2 text-center">{b.actual_qty}</td>
                                                            <td className="px-3 py-2 text-center text-gray-500">{isRTL ? (UOM_AR[b.stock_uom || ''] || b.stock_uom || '—') : (b.stock_uom || '—')}</td>
                                                            <td className="px-3 py-2 text-center">{(b.stock_value || 0).toLocaleString()}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {items.length > 20 && (
                                                <p className="text-xs text-gray-400 text-center py-2">
                                                    {isRTL ? `و ${items.length - 20} صنف آخر...` : `and ${items.length - 20} more...`}
                                                </p>
                                            )}
                                        </div>
                                    )
                                })()}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ── Toggle Confirmation Dialog ── */}
            <AlertDialog open={toggleConfirm.open} onOpenChange={(open) => !open && setToggleConfirm({ open: false, warehouse: null })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {toggleConfirm.warehouse?.disabled
                                ? (isRTL ? 'تفعيل المستودع' : 'Enable Warehouse')
                                : (isRTL ? 'تعطيل المستودع' : 'Disable Warehouse')}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {toggleConfirm.warehouse?.disabled
                                ? (isRTL
                                    ? `هل تريد تفعيل "${toggleConfirm.warehouse?.warehouse_name}"؟`
                                    : `Are you sure you want to enable "${toggleConfirm.warehouse?.warehouse_name}"?`)
                                : (isRTL
                                    ? `هل تريد تعطيل "${toggleConfirm.warehouse?.warehouse_name}"؟ لن يظهر في عمليات النقل والمخزون.`
                                    : `Are you sure you want to disable "${toggleConfirm.warehouse?.warehouse_name}"? It will not appear in transfer and stock operations.`)}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={toggling}>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmToggle}
                            disabled={toggling}
                            className={toggleConfirm.warehouse?.disabled ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
                        >
                            {toggling
                                ? (isRTL ? 'جاري...' : 'Processing...')
                                : toggleConfirm.warehouse?.disabled
                                    ? (isRTL ? 'تفعيل' : 'Enable')
                                    : (isRTL ? 'تعطيل' : 'Disable')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── Delete Confirmation Dialog ── */}
            <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => !open && setDeleteConfirm({ open: false, warehouse: null })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{isRTL ? 'حذف المستودع' : 'Delete Warehouse'}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {isRTL
                                ? `هل تريد حذف "${deleteConfirm.warehouse?.warehouse_name}"؟ لا يمكن التراجع عن هذا الإجراء.`
                                : `Are you sure you want to delete "${deleteConfirm.warehouse?.warehouse_name}"? This action cannot be undone.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            disabled={deleting}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {deleting ? (isRTL ? 'جاري الحذف...' : 'Deleting...') : (isRTL ? 'حذف' : 'Delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

// ═══════════════════════════════════════════════
// 3. LIVE INVENTORY
// ═══════════════════════════════════════════════
function LiveInventoryView({
    binStock, warehouses, loading, brand,
}: {
    binStock: BinStock[]
    warehouses: Warehouse[]
    loading: boolean
    brand?: TenantBrand
}) {
    const { isRTL } = useI18n()
    const { toast } = useToast()
    const [search, setSearch] = useState('')
    const [warehouseFilter, setWarehouseFilter] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const perPage = 25

    // Check availability dialog
    const [checkOpen, setCheckOpen] = useState(false)
    const [checkItem, setCheckItem] = useState('')
    const [checkWh, setCheckWh] = useState('')
    const [checkQty, setCheckQty] = useState('1')
    const [checkResult, setCheckResult] = useState<any>(null)
    const [checking, setChecking] = useState(false)

    // Material Receipt (إدخال مخزون) dialog — supports up to 4 warehouses
    type ReceiptItem = { item_code: string; qty: string; rate: string; disc: string; uom: string; part_name?: string; case_number?: string; source_code?: string }
    const emptyReceiptItem = (): ReceiptItem => ({ item_code: '', qty: '1', rate: '', disc: '', uom: '' })
    const [receiptOpen, setReceiptOpen] = useState(false)
    const [receiptWarehouses, setReceiptWarehouses] = useState<string[]>([''])
    const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([emptyReceiptItem()])
    const [receiptRemarks, setReceiptRemarks] = useState('')
    // Document numbers for the client's «فاتورة قطع غيار» sheet. They come off
    // the supplier's paperwork, so they're typed per receipt rather than derived.
    const emptyDocNumbers = () => ({ invoiceDate: '', invoiceNumber: '', salesOrderNumber: '', customerOrderNumber: '', caseNumber: '' })
    const [receiptDocNumbers, setReceiptDocNumbers] = useState(emptyDocNumbers())
    const [submittingReceipt, setSubmittingReceipt] = useState(false)
    const [receiptResults, setReceiptResults] = useState<string[]>([])
    // Snapshot of the last successful submission so the created receipts stay
    // printable after the form resets.
    const [lastReceipt, setLastReceipt] = useState<{
        warehouses: string[]
        items: ReceiptItem[]
        remarks: string
        docNumbers: ReturnType<typeof emptyDocNumbers>
    } | null>(null)

    // ── Invoice file import (Excel/DBF/CSV: كود الصنف/الكمية/السعر/الخصم) ──
    const importInputRef = useRef<HTMLInputElement>(null)
    const [importing, setImporting] = useState(false)
    const [importCheck, setImportCheck] = useState<{ missing: string[]; nonStock: string[] } | null>(null)
    const [enablingStock, setEnablingStock] = useState(false)

    const handleImportFile = async (file: File) => {
        setImporting(true)
        setImportCheck(null)
        try {
            const doc = await parseInvoiceDocument(file)
            let lines = doc.lines
            if (!lines.length) {
                toast({ title: isRTL ? 'الملف فارغ أو غير مقروء' : 'File empty or unreadable', variant: 'destructive' })
                return
            }
            // Validate codes against the Item master: unknown codes are dropped
            // (listed in the warning), non-stock items block submission until enabled.
            const dashedLines = lines.map((l) => ({ ...l, dashed: dashifyToyotaCode(l.item_code) }))
            const codes = Array.from(new Set(dashedLines.flatMap((l) => l.item_code === l.dashed ? [l.item_code] : [l.item_code, l.dashed])))
            const found = await frappeClient.getList<{ name: string; is_stock_item?: number }>('Item', {
                filters: [['Item', 'name', 'in', codes]],
                fields: ['name', 'is_stock_item'],
                limit_page_length: 0,
            })
            const foundMap = new Map(found.map((i) => [i.name, i]))
            // Prefer the exact code; fall back to the dashed Toyota form.
            lines = dashedLines.map((l) => ({
                ...l,
                source_code: l.item_code,
                item_code: foundMap.has(l.item_code) ? l.item_code : (foundMap.has(l.dashed) ? l.dashed : l.item_code),
            }))
            const missing = lines.map((l) => l.item_code).filter((c) => !foundMap.has(c))
            const nonStock = found.filter((i) => !i.is_stock_item).map((i) => i.name)
            const usable = lines.filter((l) => foundMap.has(l.item_code))
            if (!usable.length) {
                toast({ title: isRTL ? 'لا يوجد أي صنف من الملف معرّف في النظام' : 'No file item exists in the system', variant: 'destructive' })
                setImportCheck({ missing, nonStock: [] })
                return
            }
            setReceiptItems(usable.map((l) => ({
                item_code: l.item_code, qty: l.qty, rate: l.rate, disc: l.disc, uom: '',
                ...(l.part_name ? { part_name: l.part_name } : {}),
                ...(l.case_number ? { case_number: l.case_number } : {}),
                ...(l.source_code ? { source_code: l.source_code } : {}),
            })))
            // Prefill the printed-invoice header from the file; anything it
            // doesn't carry keeps whatever is already typed in the form.
            setReceiptDocNumbers((prev) => ({
                invoiceDate: doc.date || prev.invoiceDate,
                invoiceNumber: doc.invoiceNumber || prev.invoiceNumber,
                salesOrderNumber: doc.salesOrderNumber || prev.salesOrderNumber,
                customerOrderNumber: doc.customerOrderNumber || prev.customerOrderNumber,
                caseNumber: lines.find((l) => l.case_number)?.case_number || prev.caseNumber,
            }))
            setReceiptRemarks(isRTL ? `استيراد من ملف: ${file.name}` : `Imported from file: ${file.name}`)
            setImportCheck({ missing, nonStock })
            toast({ title: isRTL ? `تم استيراد ${usable.length} صنفاً من الملف` : `Imported ${usable.length} line(s)` })
        } catch (e: any) {
            toast({ title: isRTL ? 'فشل قراءة الملف' : 'Failed to read file', description: e?.message, variant: 'destructive' })
        } finally {
            setImporting(false)
        }
    }

    /** One-click fix for legacy non-stock items: flips is_stock_item through the
     *  normal Item API (runs ERPNext validation) so the receipt can post. */
    const handleEnableStockItems = async () => {
        if (!importCheck?.nonStock.length) return
        setEnablingStock(true)
        const failed: string[] = []
        for (const code of importCheck.nonStock) {
            try {
                await stockApi.updateItem(code, { is_stock_item: 1 } as any)
            } catch {
                failed.push(code)
            }
        }
        setEnablingStock(false)
        setImportCheck({ ...importCheck, nonStock: failed })
        toast(failed.length
            ? { title: isRTL ? `تعذّر تفعيل ${failed.length} صنفاً` : `${failed.length} item(s) failed`, variant: 'destructive' }
            : { title: isRTL ? 'تم تفعيل جميع الأصناف كأصناف مخزنية ✓' : 'All items enabled as stock items ✓' })
    }

    const handleReceiptItemChange = (idx: number, field: keyof ReceiptItem, value: string) => {
        setReceiptItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
    }

    const handleReceiptWarehouseChange = (idx: number, value: string) => {
        setReceiptWarehouses((prev) => prev.map((wh, i) => i === idx ? value : wh))
    }

    const handleSubmitReceipt = async () => {
        const validWarehouses = receiptWarehouses.filter(wh => wh.trim())
        if (validWarehouses.length === 0) {
            toast({ title: isRTL ? 'اختر مستودعاً واحداً على الأقل' : 'Select at least one warehouse', variant: 'destructive' }); return
        }
        const valid = receiptItems.filter((i) => i.item_code.trim() && Number(i.qty) > 0)
        if (!valid.length) {
            toast({ title: isRTL ? 'أضف صنفاً واحداً على الأقل' : 'Add at least one item', variant: 'destructive' }); return
        }
        setSubmittingReceipt(true)
        setReceiptResults([])
        try {
            const results: string[] = []
            for (const whName of validWarehouses) {
                const wh = warehouses.find(w => w.name === whName)
                const res = await stockApi.createMaterialReceipt({
                    warehouse: whName,
                    company: wh?.company || undefined,
                    items: valid.map((i) => {
                        const gross = Number(i.rate) || 0
                        const disc = Math.min(Math.max(Number(i.disc) || 0, 0), 100)
                        const net = gross * (1 - disc / 100)
                        return {
                            item_code: i.item_code.trim(),
                            qty: Number(i.qty),
                            ...(net > 0 ? { rate: Number(net.toFixed(4)) } : {}),
                            ...(i.uom.trim() ? { uom: i.uom.trim() } : {}),
                        }
                    }),
                    ...(receiptRemarks.trim() ? { remarks: receiptRemarks.trim() } : {}),
                })
                results.push(res.stock_entry)
            }
            setReceiptResults(results)
            setLastReceipt({ warehouses: validWarehouses, items: valid, remarks: receiptRemarks.trim(), docNumbers: receiptDocNumbers })
            toast({ title: isRTL ? `تم إنشاء ${results.length} إيصال` : `Created ${results.length} receipt(s): ${results.join(', ')}` })
            setReceiptWarehouses(['']); setReceiptItems([emptyReceiptItem()]); setReceiptRemarks(''); setReceiptDocNumbers(emptyDocNumbers())
        } catch (e: any) {
            toast({ title: isRTL ? 'فشل الإدخال' : 'Receipt failed', description: e?.message, variant: 'destructive' })
        } finally {
            setSubmittingReceipt(false)
        }
    }

    const activeWarehouses = useMemo(() => warehouses.filter((w) => !w.is_group && !w.disabled), [warehouses])

    const filtered = useMemo(() => {
        let list = binStock
        if (warehouseFilter) list = list.filter((b) => b.warehouse === warehouseFilter)
        if (search) {
            const q = search.toLowerCase()
            list = list.filter((b) => b.item_code.toLowerCase().includes(q) || (b.item_name || '').toLowerCase().includes(q) || b.warehouse.toLowerCase().includes(q))
        }
        return list
    }, [binStock, search, warehouseFilter])

    const paginated = filtered.slice((currentPage - 1) * perPage, currentPage * perPage)
    const totalPages = Math.ceil(filtered.length / perPage)
    const totalValue = filtered.reduce((s, b) => s + (b.stock_value || 0), 0)
    const totalSKUs = new Set(filtered.map((b) => b.item_code)).size

    /** Tenants configured with invoice.format === "parts" print the client's
     *  «فاتورة قطع غيار» sheet; everyone else keeps the branded receipt note. */
    const partsInvoice = brand?.invoice?.format === 'parts'
    const [printingReceipt, setPrintingReceipt] = useState<string | null>(null)

    const handlePrintReceipt = async (entryName: string, idx: number) => {
        if (!lastReceipt) return
        const wh = lastReceipt.warehouses[idx] || lastReceipt.warehouses[0] || ''
        const whName = warehouses.find(w => w.name === wh)?.warehouse_name || wh
        const items = lastReceipt.items
        const totalQty = items.reduce((t, it) => t + (Number(it.qty) || 0), 0)
        const lineNet = (it: ReceiptItem) => {
            const gross = Number(it.rate) || 0
            const disc = Math.min(Math.max(Number(it.disc) || 0, 0), 100)
            return (Number(it.qty) || 0) * gross * (1 - disc / 100)
        }
        const grandNet = items.reduce((t, it) => t + lineNet(it), 0)

        if (partsInvoice) {
            // Imported lines carry the supplier's own part name; only rows typed
            // by hand need the Item master, and a failed lookup prints blank
            // names rather than blocking the document.
            let names = new Map<string, string>()
            const needLookup = Array.from(new Set(
                items.filter((i) => !i.part_name).map((i) => i.item_code.trim()).filter(Boolean)
            ))
            if (needLookup.length) {
                setPrintingReceipt(entryName)
                try {
                    const found = await frappeClient.getList<{ name: string; item_name?: string }>('Item', {
                        filters: [['Item', 'name', 'in', needLookup]],
                        fields: ['name', 'item_name'],
                        limit_page_length: 0,
                    })
                    names = new Map(found.map((i) => [i.name, i.item_name || '']))
                } catch { /* print without names */ } finally {
                    setPrintingReceipt(null)
                }
            }
            const d = lastReceipt.docNumbers
            printPartsInvoice({
                date: d.invoiceDate || new Date().toISOString().split('T')[0],
                soldToParty: brand?.invoice?.soldToParty || '',
                shipToParty: brand?.invoice?.shipToParty || '',
                salesOrderNumber: d.salesOrderNumber,
                // Fall back to the ERPNext stock-entry name when the supplier's
                // invoice number wasn't entered, so the sheet is never unlabelled.
                invoiceNumber: d.invoiceNumber || entryName,
                customerOrderNumber: d.customerOrderNumber,
                vatPercent: brand?.invoice?.vatPercent ?? 15,
                lines: items.map((it) => ({
                    partNumber: (it.source_code || it.item_code).trim(),
                    partName: it.part_name || names.get(it.item_code.trim()) || '',
                    qty: it.qty,
                    // The source sheet varies the case number per line; the form
                    // field is the fallback for hand-entered rows.
                    caseNumber: it.case_number || d.caseNumber,
                    unitPrice: it.rate,
                    discountPct: it.disc,
                })),
            })
            return
        }

        printDoc({
            rtl: isRTL,
            brandName: brandLabel(brand, isRTL),
            brandTagline: brand?.tagline,
            logoUrl: brand?.logo,
            title: isRTL ? 'فاتورة استلام بضاعة' : 'Goods Receipt Invoice',
            docNo: entryName,
            date: new Date().toISOString().split('T')[0],
            meta: [
                { label: isRTL ? 'المستودع المستلِم' : 'Receiving warehouse', value: whName },
                { label: isRTL ? 'عدد الأصناف' : 'Items', value: String(items.length) },
            ],
            columns: [
                { key: 'item', label: isRTL ? 'كود الصنف' : 'Item No.', ltr: true },
                { key: 'qty', label: isRTL ? 'الكمية' : 'Qty', align: 'center' },
                { key: 'rate', label: isRTL ? 'السعر' : 'Price', align: 'center' },
                { key: 'disc', label: isRTL ? 'الخصم %' : 'Disc %', align: 'center' },
                { key: 'amount', label: isRTL ? 'الإجمالي' : 'Total', align: 'end' },
            ],
            rows: items.map((it) => ({
                item: it.item_code,
                qty: it.qty,
                rate: Number(it.rate) > 0 ? Number(it.rate).toLocaleString() : '—',
                disc: Number(it.disc) > 0 ? Number(it.disc).toLocaleString() : '—',
                amount: lineNet(it).toLocaleString(undefined, { maximumFractionDigits: 2 }),
            })),
            totals: [
                { label: isRTL ? 'إجمالي الكمية' : 'Total qty', value: String(totalQty) },
                { label: isRTL ? 'الإجمالي الصافي' : 'Net total', value: `${grandNet.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${cur(isRTL)}`, bold: true },
            ],
            notes: lastReceipt.remarks || undefined,
            signatures: isRTL ? ['أمين المستودع', 'المُورِّد / المُسلِّم', 'الاعتماد'] : ['Storekeeper', 'Supplier / deliverer', 'Approved by'],
        })
    }

    const handlePrintStockReport = () => {
        const whName = warehouseFilter
            ? (warehouses.find(w => w.name === warehouseFilter)?.warehouse_name || warehouseFilter)
            : (isRTL ? 'كل المستودعات' : 'All warehouses')
        printDoc({
            rtl: isRTL,
            brandName: brandLabel(brand, isRTL),
            brandTagline: brand?.tagline,
            logoUrl: brand?.logo,
            title: isRTL ? 'تقرير المخزون الحالي' : 'Current Stock Report',
            date: new Date().toISOString().split('T')[0],
            meta: [
                { label: isRTL ? 'المستودع' : 'Warehouse', value: whName },
                { label: isRTL ? 'عدد الأصناف' : 'SKUs', value: String(totalSKUs) },
                { label: isRTL ? 'عدد السجلات' : 'Records', value: String(filtered.length) },
                ...(search ? [{ label: isRTL ? 'بحث' : 'Search', value: search }] : []),
            ],
            columns: [
                { key: 'idx', label: '#', align: 'center' },
                { key: 'item', label: isRTL ? 'كود الصنف' : 'Item No.', ltr: true },
                { key: 'warehouse', label: isRTL ? 'المستودع' : 'Warehouse' },
                { key: 'qty', label: isRTL ? 'الكمية' : 'Qty', align: 'center' },
                { key: 'uom', label: isRTL ? 'الوحدة' : 'UOM', align: 'center' },
                { key: 'rate', label: isRTL ? 'سعر الوحدة' : 'Rate', align: 'center' },
                { key: 'value', label: isRTL ? 'القيمة' : 'Value', align: 'end' },
            ],
            rows: filtered.map((b, i) => ({
                idx: i + 1,
                item: b.item_code,
                warehouse: b.warehouse,
                qty: b.actual_qty,
                uom: b.stock_uom ? tr(UOM_AR, b.stock_uom, isRTL) : '—',
                rate: b.valuation_rate ? b.valuation_rate.toLocaleString() : '—',
                value: (b.stock_value || 0).toLocaleString(),
            })),
            totals: [{ label: isRTL ? 'إجمالي قيمة المخزون' : 'Total stock value', value: `${totalValue.toLocaleString()} ${cur(isRTL)}`, bold: true }],
        })
    }

    const handleCheck = async () => {
        if (!checkItem || !checkWh) return
        setChecking(true)
        try {
            const res = await stockApi.checkItemAvailability(checkItem, checkWh, Number(checkQty) || 1)
            setCheckResult(res)
        } catch (e: any) {
            toast({ title: isRTL ? 'خطأ' : 'Error', description: e?.message, variant: 'destructive' })
        } finally {
            setChecking(false)
        }
    }

    if (loading) return <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>

    return (
        <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
            {/* Top bar */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
                    <Input
                        placeholder={isRTL ? 'بحث بكود الصنف أو اسمه...' : 'Search by item code or name...'}
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
                        className={cn('h-9 text-sm', isRTL ? 'pr-9' : 'pl-9')}
                    />
                </div>
                <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[180px]"
                    value={warehouseFilter}
                    onChange={(e) => { setWarehouseFilter(e.target.value); setCurrentPage(1) }}
                >
                    <option value="">{isRTL ? 'كل المستودعات' : 'All Warehouses'}</option>
                    {activeWarehouses.map((w) => <option key={w.name} value={w.name}>{w.warehouse_name}</option>)}
                </select>
                <Button variant="outline" size="sm" onClick={() => { setCheckOpen(true); setCheckResult(null) }}>
                    <BarChart3 className="h-4 w-4" />
                    <span className={cn('text-xs', isRTL ? 'mr-1' : 'ml-1')}>{isRTL ? 'فحص التوفر' : 'Check Availability'}</span>
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrintStockReport} disabled={filtered.length === 0}>
                    <Printer className="h-4 w-4" />
                    <span className={cn('text-xs', isRTL ? 'mr-1' : 'ml-1')}>{isRTL ? 'طباعة التقرير' : 'Print Report'}</span>
                </Button>
                <Button size="sm" onClick={() => { setReceiptOpen(true); setReceiptResults([]) }} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Plus className="h-4 w-4" />
                    <span className={cn('text-xs', isRTL ? 'mr-1' : 'ml-1')}>{isRTL ? 'إدخال مخزون' : 'Stock In'}</span>
                </Button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-lg border border-gray-100 px-4 py-3">
                    <p className="text-xs text-gray-500">{isRTL ? 'إجمالي الأصناف' : 'Total SKUs'}</p>
                    <p className="text-xl font-bold text-gray-900">{totalSKUs.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-lg border border-gray-100 px-4 py-3">
                    <p className="text-xs text-gray-500">{isRTL ? 'سجلات المخزون' : 'Stock Records'}</p>
                    <p className="text-xl font-bold text-gray-900">{filtered.length.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-lg border border-gray-100 px-4 py-3">
                    <p className="text-xs text-gray-500">{isRTL ? 'إجمالي القيمة' : 'Total Value'}</p>
                    <p className="text-xl font-bold text-gray-900">{totalValue.toLocaleString()} <span className="text-xs font-normal text-gray-400">{cur(isRTL)}</span></p>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                                <th className={cn('px-4 py-3 font-medium', isRTL ? 'text-right' : 'text-left')}>{isRTL ? 'الصنف' : 'Item'}</th>
                                <th className={cn('px-4 py-3 font-medium', isRTL ? 'text-right' : 'text-left')}>{isRTL ? 'المستودع' : 'Warehouse'}</th>
                                <th className="px-4 py-3 font-medium text-center">{isRTL ? 'الكمية' : 'Qty'}</th>
                                <th className="px-4 py-3 font-medium text-center">{isRTL ? 'الوحدة' : 'UOM'}</th>
                                <th className="px-4 py-3 font-medium text-center">{isRTL ? 'سعر الوحدة' : 'Rate'}</th>
                                <th className="px-4 py-3 font-medium text-center">{isRTL ? 'القيمة' : 'Value'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {paginated.map((b, i) => (
                                <tr key={`${b.item_code}-${b.warehouse}-${i}`} className="hover:bg-gray-50/50">
                                    <td className={cn('px-4 py-2.5', isRTL ? 'text-right' : 'text-left')}>
                                        <p className="font-medium text-gray-800">{b.item_name || b.item_code}</p>
                                        {b.item_name && b.item_name !== b.item_code && (
                                            <p className="text-[11px] text-gray-400 mt-0.5">{b.item_code}</p>
                                        )}
                                    </td>
                                    <td className={cn('px-4 py-2.5 text-gray-600', isRTL ? 'text-right' : 'text-left')}>{b.warehouse}</td>
                                    <td className="px-4 py-2.5 text-center font-semibold">{b.actual_qty}</td>
                                    <td className="px-4 py-2.5 text-center text-gray-500">{isRTL ? (UOM_AR[b.stock_uom || ''] || b.stock_uom || '—') : (b.stock_uom || '—')}</td>
                                    <td className="px-4 py-2.5 text-center text-gray-500">{(b.valuation_rate || 0).toFixed(2)}</td>
                                    <td className="px-4 py-2.5 text-center font-medium">{(b.stock_value || 0).toLocaleString()}</td>
                                </tr>
                            ))}
                            {paginated.length === 0 && (
                                <tr><td colSpan={6} className="text-center py-10 text-sm text-gray-400">{isRTL ? 'لا يوجد مخزون' : 'No stock found'}</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                        <p className="text-xs text-gray-500">{(currentPage - 1) * perPage + 1}-{Math.min(currentPage * perPage, filtered.length)} / {filtered.length}</p>
                        <div className="flex gap-1">
                            <Button variant="ghost" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
                                {isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                                {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Material Receipt Dialog ── */}
            <Dialog open={receiptOpen} onOpenChange={(o) => { setReceiptOpen(o); if (!o) { setReceiptResults([]); setImportCheck(null) } }}>
                <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{isRTL ? 'إدخال مخزون (استلام بضاعة)' : 'Stock In (Material Receipt)'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {receiptResults.length > 0 && (
                            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 space-y-1">
                                <span className="font-semibold">{isRTL ? '✓ تم إنشاء:' : '✓ Created:'}</span>
                                {receiptResults.map((r, i) => (
                                    <div key={i} className="flex items-center justify-between gap-2">
                                        <span>{r}</span>
                                        <Button size="sm" variant="ghost" className="h-7 text-green-700 hover:text-green-900" disabled={printingReceipt === r} onClick={() => handlePrintReceipt(r, i)}>
                                            {printingReceipt === r
                                                ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                                : <Printer className="h-3.5 w-3.5" />}
                                            <span className={cn('text-xs', isRTL ? 'mr-1' : 'ml-1')}>
                                                {partsInvoice ? (isRTL ? 'طباعة الفاتورة' : 'Print invoice') : (isRTL ? 'طباعة السند' : 'Print')}
                                            </span>
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <input
                            ref={importInputRef}
                            type="file"
                            accept=".xls,.xlsx,.xlsm,.dbf,.csv,.txt"
                            className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); e.target.value = '' }}
                        />
                        <Button variant="outline" size="sm" className="w-full border-dashed" disabled={importing} onClick={() => importInputRef.current?.click()}>
                            {importing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            <span className={cn('text-xs', isRTL ? 'mr-1.5' : 'ml-1.5')}>
                                {isRTL ? 'استيراد فاتورة من ملف (Excel / DBF / CSV)' : 'Import invoice file (Excel / DBF / CSV)'}
                            </span>
                        </Button>
                        {importCheck && importCheck.missing.length > 0 && (
                            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                                <p className="font-semibold mb-0.5">
                                    {isRTL ? `${importCheck.missing.length} صنفاً غير معرّف في النظام — تم تخطّيهم:` : `${importCheck.missing.length} unknown item(s) skipped:`}
                                </p>
                                <p className="font-mono break-all">{importCheck.missing.slice(0, 10).join('، ')}{importCheck.missing.length > 10 ? ' …' : ''}</p>
                            </div>
                        )}
                        {importCheck && importCheck.nonStock.length > 0 && (
                            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 space-y-2">
                                <p className="font-semibold">
                                    {isRTL
                                        ? `${importCheck.nonStock.length} صنفاً مسجّل «غير مخزني» — لا يمكن استلامه قبل التفعيل:`
                                        : `${importCheck.nonStock.length} item(s) are flagged non-stock and can't be received:`}
                                </p>
                                <p className="font-mono break-all">{importCheck.nonStock.slice(0, 10).join('، ')}{importCheck.nonStock.length > 10 ? ' …' : ''}</p>
                                <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white h-7" disabled={enablingStock} onClick={handleEnableStockItems}>
                                    {enablingStock ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
                                    <span className={cn('text-xs', isRTL ? 'mr-1' : 'ml-1')}>
                                        {isRTL ? `تفعيلهم كأصناف مخزنية (${importCheck.nonStock.length})` : `Enable as stock items (${importCheck.nonStock.length})`}
                                    </span>
                                </Button>
                            </div>
                        )}
                        {partsInvoice && (
                            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 space-y-2">
                                <p className="text-xs font-semibold text-gray-700">
                                    {isRTL ? 'بيانات الفاتورة (تُطبع في فاتورة قطع الغيار)' : 'Invoice details (printed on the parts invoice)'}
                                </p>
                                <p className="text-[11px] text-gray-500">
                                    {isRTL
                                        ? 'تُملأ تلقائياً عند استيراد ملف المورد؛ عدّلها لو لزم.'
                                        : 'Filled automatically when a supplier file is imported — edit if needed.'}
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    {([
                                        ['invoiceDate', isRTL ? 'تاريخ الفاتورة' : 'Date'],
                                        ['invoiceNumber', isRTL ? 'رقم الفاتورة' : 'Invoice Number'],
                                        ['salesOrderNumber', isRTL ? 'رقم أمر البيع' : 'Sales Order Number'],
                                        ['customerOrderNumber', isRTL ? 'رقم طلب العميل' : 'Customer Order Number'],
                                        ['caseNumber', isRTL ? 'رقم الحالة' : 'Case Number'],
                                    ] as Array<[keyof typeof receiptDocNumbers, string]>).map(([key, label]) => (
                                        <div key={key}>
                                            <label className="text-[11px] text-gray-500 mb-0.5 block">{label}</label>
                                            <Input
                                                dir="ltr"
                                                type={key === 'invoiceDate' ? 'date' : 'text'}
                                                className="h-8 text-xs font-mono"
                                                value={receiptDocNumbers[key]}
                                                onChange={(e) => setReceiptDocNumbers((prev) => ({ ...prev, [key]: e.target.value }))}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">
                                {isRTL ? 'المستودعات المستلِمة (حتى 4)' : 'Target Warehouses (up to 4)'} *
                            </label>
                            {receiptWarehouses.map((wh, idx) => (
                                <div key={idx} className="flex gap-2 mb-2 items-center">
                                    <select
                                        className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
                                        value={wh}
                                        onChange={(e) => handleReceiptWarehouseChange(idx, e.target.value)}
                                    >
                                        <option value="">{isRTL ? 'اختر مستودعاً' : 'Select warehouse'}</option>
                                        {activeWarehouses.map((w) => (
                                            <option key={w.name} value={w.name}>{w.warehouse_name}</option>
                                        ))}
                                    </select>
                                    {receiptWarehouses.length > 1 && (
                                        <button
                                            onClick={() => setReceiptWarehouses(receiptWarehouses.filter((_, i) => i !== idx))}
                                            className="text-red-400 hover:text-red-600 flex-shrink-0"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                            {receiptWarehouses.length < 4 && (
                                <Button
                                    variant="ghost" size="sm"
                                    onClick={() => setReceiptWarehouses([...receiptWarehouses, ''])}
                                    className="text-xs text-blue-600"
                                >
                                    <Plus className="h-3 w-3 mr-1" />{isRTL ? 'إضافة مستودع' : 'Add Warehouse'}
                                </Button>
                            )}
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-2 block">{isRTL ? 'الأصناف' : 'Items'} *</label>
                            {receiptItems.map((item, idx) => (
                                <div key={idx} className="flex gap-2 mb-2 items-center">
                                    <div className="flex-1">
                                        <ItemSearchInput
                                            placeholder={isRTL ? 'كود الصنف' : 'Item code'}
                                            value={item.item_code}
                                            onChange={(val) => handleReceiptItemChange(idx, 'item_code', val)}
                                        />
                                    </div>
                                    <Input
                                        className="w-20 h-8 text-xs"
                                        type="number" min="0.001" step="any"
                                        placeholder={isRTL ? 'كمية' : 'Qty'}
                                        value={item.qty}
                                        onChange={(e) => handleReceiptItemChange(idx, 'qty', e.target.value)}
                                    />
                                    <Input
                                        className="w-24 h-8 text-xs"
                                        type="number" min="0" step="any"
                                        placeholder={isRTL ? 'السعر' : 'Rate'}
                                        value={item.rate}
                                        onChange={(e) => handleReceiptItemChange(idx, 'rate', e.target.value)}
                                    />
                                    <Input
                                        className="w-[70px] h-8 text-xs"
                                        type="number" min="0" max="100" step="any"
                                        placeholder={isRTL ? 'خصم %' : 'Disc %'}
                                        value={item.disc}
                                        onChange={(e) => handleReceiptItemChange(idx, 'disc', e.target.value)}
                                    />
                                    <Input
                                        className="w-20 h-8 text-xs"
                                        placeholder={isRTL ? 'وحدة' : 'UOM'}
                                        value={item.uom}
                                        onChange={(e) => handleReceiptItemChange(idx, 'uom', e.target.value)}
                                    />
                                    {receiptItems.length > 1 && (
                                        <button
                                            onClick={() => setReceiptItems(receiptItems.filter((_, i) => i !== idx))}
                                            className="text-red-400 hover:text-red-600 flex-shrink-0"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                            <p className="text-[10px] text-gray-400 mb-2">{isRTL ? '* الوحدة اختيارية — سيتم أخذها من بيانات الصنف تلقائياً' : '* UOM optional — auto-filled from item if blank'}</p>
                            <Button
                                variant="ghost" size="sm"
                                onClick={() => setReceiptItems([...receiptItems, emptyReceiptItem()])}
                                className="text-xs text-emerald-600"
                            >
                                <Plus className="h-3 w-3 mr-1" />{isRTL ? 'إضافة صنف' : 'Add Item'}
                            </Button>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">{isRTL ? 'ملاحظات (اختياري)' : 'Remarks (optional)'}</label>
                            <Input
                                value={receiptRemarks}
                                onChange={(e) => setReceiptRemarks(e.target.value)}
                                placeholder={isRTL ? 'مثل: شحنة يناير 2026' : 'e.g. January 2026 shipment'}
                                className="h-9 text-sm"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setReceiptOpen(false)}>{isRTL ? 'إغلاق' : 'Close'}</Button>
                        <Button
                            onClick={handleSubmitReceipt}
                            disabled={submittingReceipt || (importCheck?.nonStock.length ?? 0) > 0}
                            title={(importCheck?.nonStock.length ?? 0) > 0 ? (isRTL ? 'فعّل الأصناف غير المخزنية أولاً' : 'Enable the non-stock items first') : undefined}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            {submittingReceipt
                                ? <RefreshCw className="h-4 w-4 animate-spin" />
                                : (isRTL ? 'تأكيد الاستلام' : 'Confirm Receipt')
                            }
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Check availability dialog */}
            <Dialog open={checkOpen} onOpenChange={setCheckOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>{isRTL ? 'فحص توفر الصنف' : 'Check Item Availability'}</DialogTitle></DialogHeader>
                    <div className="space-y-3 py-2">
                        <ItemSearchInput
                            placeholder={isRTL ? 'ابحث عن صنف...' : 'Search item...'}
                            value={checkItem}
                            onChange={setCheckItem}
                        />
                        <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={checkWh} onChange={(e) => setCheckWh(e.target.value)}>
                            <option value="">{isRTL ? 'اختر مستودع' : 'Select warehouse'}</option>
                            {activeWarehouses.map((w) => <option key={w.name} value={w.name}>{w.warehouse_name}</option>)}
                        </select>
                        <Input type="number" placeholder={isRTL ? 'الكمية' : 'Quantity'} value={checkQty} onChange={(e) => setCheckQty(e.target.value)} min="1" />
                        <Button onClick={handleCheck} disabled={checking} className="w-full bg-orange-600 hover:bg-orange-700 text-white">
                            {checking ? <RefreshCw className="h-4 w-4 animate-spin" /> : (isRTL ? 'فحص' : 'Check')}
                        </Button>
                        {checkResult && (
                            <div className={cn('rounded-lg px-4 py-3 text-sm', checkResult.is_available ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200')}>
                                <p className="font-semibold mb-1">{checkResult.is_available ? (isRTL ? '✓ متوفر' : '✓ Available') : (isRTL ? '✗ غير كافي' : '✗ Insufficient')}</p>
                                <p>{isRTL ? 'المتاح:' : 'Available:'} {checkResult.available_qty} | {isRTL ? 'المطلوب:' : 'Requested:'} {checkResult.requested_qty}</p>
                                {!checkResult.is_available && <p>{isRTL ? 'النقص:' : 'Shortage:'} {checkResult.shortage}</p>}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

// ═══════════════════════════════════════════════
// 4. TRANSFERS
// ═══════════════════════════════════════════════
// Transfer status colours → lib/status-config.ts getStatusClass()

function TransfersView({
    requests, warehouses, salesPersons, loading, onRefresh, hasSales = true, brand,
}: {
    requests: StockTransferRequest[]
    warehouses: Warehouse[]
    salesPersons: SalesPerson[]
    loading: boolean
    onRefresh: () => void
    hasSales?: boolean
    brand?: TenantBrand
}) {
    const { isRTL } = useI18n()
    const { toast } = useToast()
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('Pending')
    const [processing, setProcessing] = useState<string | null>(null)
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 15
    const [viewDialog, setViewDialog] = useState<{ open: boolean; request: StockTransferRequest | null }>({ open: false, request: null })
    const [loadingDetail, setLoadingDetail] = useState(false)
    const [rejectDialog, setRejectDialog] = useState<{ open: boolean; request: StockTransferRequest | null }>({ open: false, request: null })
    const [rejectReason, setRejectReason] = useState('')

    // Create dialog
    type NewItem = { item_code: string; requested_qty: string; uom: string }
    const emptyItem = (): NewItem => ({ item_code: '', requested_qty: '1', uom: '' })
    const [createOpen, setCreateOpen] = useState(false)
    const [newFromWh, setNewFromWh] = useState('')
    const [newToWh, setNewToWh] = useState('')
    const [newSalesPerson, setNewSalesPerson] = useState('')
    const [newItems, setNewItems] = useState<NewItem[]>([emptyItem()])
    const [creating, setCreating] = useState(false)

    const allActiveWh = useMemo(() => warehouses.filter((w) => !w.is_group && !w.disabled), [warehouses])

    const handleCreate = async () => {
        if (!newFromWh || !newToWh) { toast({ title: isRTL ? 'اختر المستودعين' : 'Select both warehouses', variant: 'destructive' }); return }
        const validItems = newItems.filter((i) => i.item_code.trim() && Number(i.requested_qty) > 0)
        if (validItems.length === 0) { toast({ title: isRTL ? 'أضف صنفاً واحداً' : 'Add at least one item', variant: 'destructive' }); return }
        setCreating(true)
        try {
            await stockApi.createTransferRequest({
                from_warehouse: newFromWh,
                to_warehouse: newToWh,
                ...(newSalesPerson ? { sales_person: newSalesPerson } : {}),
                items: validItems.map((i) => ({ item_code: i.item_code.trim(), requested_qty: Number(i.requested_qty), ...(i.uom ? { uom: i.uom } : {}) })),
            })
            toast({ title: isRTL ? 'تم إنشاء الطلب' : 'Transfer request created' })
            setCreateOpen(false)
            setNewFromWh(''); setNewToWh(''); setNewSalesPerson(''); setNewItems([emptyItem()])
            onRefresh()
        } catch (e: any) {
            toast({ title: isRTL ? 'خطأ' : 'Error', description: e?.message, variant: 'destructive' })
        } finally {
            setCreating(false)
        }
    }

    const filtered = useMemo(() => {
        let list = requests
        if (statusFilter !== 'all') list = list.filter((r) => r.status === statusFilter)
        if (search) {
            const q = search.toLowerCase()
            list = list.filter((r) => r.name.toLowerCase().includes(q) || r.from_warehouse?.toLowerCase().includes(q) || r.to_warehouse?.toLowerCase().includes(q) || r.sales_person?.toLowerCase().includes(q))
        }
        return list
    }, [requests, search, statusFilter])

    const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    const totalPages = Math.ceil(filtered.length / itemsPerPage)

    const handleAccept = async (req: StockTransferRequest) => {
        setProcessing(req.name)
        try {
            await stockApi.acceptTransferRequest(req.name)
            toast({ title: isRTL ? 'تم القبول' : 'Accepted' })
            onRefresh()
        } catch (e: any) {
            toast({ title: isRTL ? 'خطأ' : 'Error', description: e.message, variant: 'destructive' })
        } finally { setProcessing(null) }
    }

    const handleReject = async () => {
        if (!rejectDialog.request || !rejectReason.trim()) { toast({ title: isRTL ? 'سبب الرفض مطلوب' : 'Reason required', variant: 'destructive' }); return }
        setProcessing(rejectDialog.request.name)
        try {
            await stockApi.rejectTransferRequest(rejectDialog.request.name, rejectReason)
            toast({ title: isRTL ? 'تم الرفض' : 'Rejected' })
            setRejectDialog({ open: false, request: null }); setRejectReason('')
            onRefresh()
        } catch (e: any) {
            toast({ title: isRTL ? 'خطأ' : 'Error', description: e.message, variant: 'destructive' })
        } finally { setProcessing(null) }
    }

    const handleView = async (req: StockTransferRequest) => {
        setViewDialog({ open: true, request: req })
        setLoadingDetail(true)
        try {
            const detail = await stockApi.getTransferRequest(req.name)
            if (detail) setViewDialog({ open: true, request: detail })
        } catch { /* keep summary */ } finally { setLoadingDetail(false) }
    }

    const handlePrint = async (req: StockTransferRequest) => {
        let full = req
        if (!full.items || full.items.length === 0) {
            try { const d = await stockApi.getTransferRequest(req.name); if (d) full = d } catch { /* print what we have */ }
        }
        const items = full.items || []
        printDoc({
            rtl: isRTL,
            brandName: brandLabel(brand, isRTL),
            brandTagline: brand?.tagline,
            logoUrl: brand?.logo,
            title: isRTL ? 'إذن نقل مخزون' : 'Stock Transfer Note',
            docNo: full.name,
            date: full.request_date,
            meta: [
                { label: isRTL ? 'من مستودع' : 'From warehouse', value: full.from_warehouse },
                { label: isRTL ? 'إلى مستودع' : 'To warehouse', value: full.to_warehouse },
                ...(hasSales && full.sales_person ? [{ label: isRTL ? 'المندوب' : 'Rep', value: full.sales_person }] : []),
                { label: isRTL ? 'الحالة' : 'Status', value: tr(TRANSFER_STATUS_AR, full.status, isRTL) },
                ...(full.accepted_by ? [{ label: isRTL ? 'اعتمده' : 'Accepted by', value: full.accepted_by }] : []),
                ...(full.stock_entry ? [{ label: isRTL ? 'قيد المخزون' : 'Stock entry', value: full.stock_entry }] : []),
            ],
            columns: [
                { key: 'item', label: isRTL ? 'كود الصنف' : 'Item No.', ltr: true },
                { key: 'requested', label: isRTL ? 'الكمية المطلوبة' : 'Requested', align: 'center' },
                { key: 'accepted', label: isRTL ? 'الكمية المقبولة' : 'Accepted', align: 'center' },
                { key: 'uom', label: isRTL ? 'الوحدة' : 'UOM', align: 'center' },
            ],
            rows: items.map((it) => ({
                item: it.item_code,
                requested: it.requested_qty,
                accepted: it.accepted_qty ?? '—',
                uom: tr(UOM_AR, it.uom || '', isRTL) || '—',
            })),
            totals: [{
                label: isRTL ? 'إجمالي الكمية المطلوبة' : 'Total requested qty',
                value: String(full.total_quantity ?? items.reduce((t, it) => t + (it.requested_qty || 0), 0)),
                bold: true,
            }],
            notes: full.rejection_reason || undefined,
            signatures: isRTL
                ? ['أمين المستودع المُرسِل', 'أمين المستودع المُستلِم', 'الاعتماد']
                : ['Issuing storekeeper', 'Receiving storekeeper', 'Approved by'],
        })
    }

    const statusOptions = ['all', 'Pending', 'Accepted', 'Partially Accepted', 'Rejected', 'Completed']

    if (loading) return <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>

    return (
        <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
                    <Input placeholder={isRTL ? 'بحث...' : 'Search...'} value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }} className={cn('h-9 text-sm', isRTL ? 'pr-9' : 'pl-9')} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {statusOptions.map((s) => {
                        const count = s === 'all' ? requests.length : requests.filter((r) => r.status === s).length
                        return (
                            <button key={s} onClick={() => { setStatusFilter(s); setCurrentPage(1) }} className={cn('px-3 py-1 rounded-full text-xs font-medium', statusFilter === s ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                                {s === 'all' ? (isRTL ? 'الكل' : 'All') : tr(TRANSFER_STATUS_AR, s, isRTL)} ({count})
                            </button>
                        )
                    })}
                </div>
                <Button size="sm" onClick={() => setCreateOpen(true)} className="bg-orange-600 hover:bg-orange-700 text-white">
                    <Plus className="h-4 w-4" /><span className={cn('text-xs', isRTL ? 'mr-1' : 'ml-1')}>{isRTL ? 'طلب جديد' : 'New Request'}</span>
                </Button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                                <th className={cn('px-4 py-3 font-medium', isRTL ? 'text-right' : 'text-left')}>{isRTL ? 'الرقم' : '#'}</th>
                                <th className={cn('px-4 py-3 font-medium', isRTL ? 'text-right' : 'text-left')}>{isRTL ? 'من' : 'From'}</th>
                                <th className={cn('px-4 py-3 font-medium', isRTL ? 'text-right' : 'text-left')}>{isRTL ? 'إلى' : 'To'}</th>
                                {hasSales && <th className={cn('px-4 py-3 font-medium', isRTL ? 'text-right' : 'text-left')}>{isRTL ? 'المندوب' : 'Rep'}</th>}
                                <th className="px-4 py-3 font-medium text-center">{isRTL ? 'الحالة' : 'Status'}</th>
                                <th className="px-4 py-3 font-medium text-center">{isRTL ? 'التاريخ' : 'Date'}</th>
                                <th className="px-4 py-3 font-medium text-center">{isRTL ? 'إجراءات' : 'Actions'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {paginated.map((r) => (
                                <tr key={r.name} className="hover:bg-gray-50/50">
                                    <td className="px-4 py-2.5">
                                        <button onClick={() => handleView(r)} className="text-sm font-medium text-orange-600 hover:underline">{r.name}</button>
                                    </td>
                                    <td className="px-4 py-2.5 text-sm text-gray-700">{r.from_warehouse}</td>
                                    <td className="px-4 py-2.5 text-sm text-gray-700">{r.to_warehouse}</td>
                                    {hasSales && <td className="px-4 py-2.5 text-sm text-gray-600">{r.sales_person || '—'}</td>}
                                    <td className="px-4 py-2.5 text-center">
                                        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', getStatusClass(r.status))}>{tr(TRANSFER_STATUS_AR, r.status, isRTL)}</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-center text-xs text-gray-500">{r.request_date}</td>
                                    <td className="px-4 py-2.5 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <button onClick={() => handleView(r)} className="p-1.5 rounded-lg hover:bg-gray-100"><Eye className="h-3.5 w-3.5 text-gray-500" /></button>
                                            <button onClick={() => handlePrint(r)} title={isRTL ? 'طباعة' : 'Print'} className="p-1.5 rounded-lg hover:bg-gray-100"><Printer className="h-3.5 w-3.5 text-gray-500" /></button>
                                            {r.status === 'Pending' && (
                                                <>
                                                    <Button size="sm" variant="ghost" className="text-green-600 text-xs h-7" onClick={() => handleAccept(r)} disabled={processing === r.name}>
                                                        {processing === r.name ? <RefreshCw className="h-3 w-3 animate-spin" /> : (isRTL ? 'قبول' : 'Accept')}
                                                    </Button>
                                                    <Button size="sm" variant="ghost" className="text-red-600 text-xs h-7" onClick={() => setRejectDialog({ open: true, request: r })}>
                                                        {isRTL ? 'رفض' : 'Reject'}
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {paginated.length === 0 && <tr><td colSpan={hasSales ? 7 : 6} className="text-center py-10 text-sm text-gray-400">{isRTL ? 'لا توجد طلبات' : 'No requests'}</td></tr>}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                        <p className="text-xs text-gray-500">{(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filtered.length)} / {filtered.length}</p>
                        <div className="flex gap-1">
                            <Button variant="ghost" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>{isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</Button>
                            <Button variant="ghost" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>{isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</Button>
                        </div>
                    </div>
                )}
            </div>

            {/* View detail dialog */}
            <Dialog open={viewDialog.open} onOpenChange={(o) => setViewDialog({ open: o, request: o ? viewDialog.request : null })}>
                <DialogContent className="max-w-lg">
                    <DialogHeader><DialogTitle>{viewDialog.request?.name}</DialogTitle></DialogHeader>
                    {viewDialog.request && (
                        <div className="space-y-3 text-sm">
                            <div className="grid grid-cols-2 gap-3">
                                <div><p className="text-xs text-gray-400">{isRTL ? 'من' : 'From'}</p><p className="font-medium">{viewDialog.request.from_warehouse}</p></div>
                                <div><p className="text-xs text-gray-400">{isRTL ? 'إلى' : 'To'}</p><p className="font-medium">{viewDialog.request.to_warehouse}</p></div>
                                <div><p className="text-xs text-gray-400">{isRTL ? 'الحالة' : 'Status'}</p><span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', getStatusClass(viewDialog.request.status))}>{tr(TRANSFER_STATUS_AR, viewDialog.request.status, isRTL)}</span></div>
                                <div><p className="text-xs text-gray-400">{isRTL ? 'التاريخ' : 'Date'}</p><p className="font-medium">{viewDialog.request.request_date}</p></div>
                                {hasSales && viewDialog.request.sales_person && (
                                    <div><p className="text-xs text-gray-400">{isRTL ? 'المندوب' : 'Sales Person'}</p><p className="font-medium">{viewDialog.request.sales_person}</p></div>
                                )}
                                {viewDialog.request.total_quantity != null && (
                                    <div><p className="text-xs text-gray-400">{isRTL ? 'إجمالي الكميات' : 'Total Qty'}</p><p className="font-medium">{viewDialog.request.total_quantity}</p></div>
                                )}
                                {viewDialog.request.stock_entry && (
                                    <div className="col-span-2"><p className="text-xs text-gray-400">{isRTL ? 'قيد المخزون' : 'Stock Entry'}</p><p className="font-medium text-orange-600">{viewDialog.request.stock_entry}</p></div>
                                )}
                                {viewDialog.request.rejection_reason && (
                                    <div className="col-span-2"><p className="text-xs text-gray-400">{isRTL ? 'سبب الرفض' : 'Rejection Reason'}</p><p className="font-medium text-red-600">{viewDialog.request.rejection_reason}</p></div>
                                )}
                            </div>
                            {loadingDetail && <Skeleton className="h-20" />}
                            {viewDialog.request.items && viewDialog.request.items.length > 0 && (
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead><tr className="bg-gray-50 text-gray-500"><th className="px-3 py-2 text-left">{isRTL ? 'الصنف' : 'Item'}</th><th className="px-3 py-2 text-center">{isRTL ? 'المطلوب' : 'Requested'}</th><th className="px-3 py-2 text-center">{isRTL ? 'المقبول' : 'Accepted'}</th></tr></thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {viewDialog.request.items.map((item, i) => (
                                                <tr key={i}><td className="px-3 py-2">{item.item_code}</td><td className="px-3 py-2 text-center">{item.requested_qty}</td><td className="px-3 py-2 text-center">{item.accepted_qty ?? '—'}</td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            <div className="flex justify-end pt-2">
                                <Button size="sm" variant="outline" onClick={() => viewDialog.request && handlePrint(viewDialog.request)}>
                                    <Printer className="h-3.5 w-3.5" />
                                    <span className={cn('text-xs', isRTL ? 'mr-1.5' : 'ml-1.5')}>{isRTL ? 'طباعة الإذن' : 'Print note'}</span>
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Reject dialog */}
            <Dialog open={rejectDialog.open} onOpenChange={(o) => { if (!o) setRejectDialog({ open: false, request: null }) }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>{isRTL ? 'سبب الرفض' : 'Rejection Reason'}</DialogTitle></DialogHeader>
                    <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder={isRTL ? 'أدخل السبب...' : 'Enter reason...'} />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRejectDialog({ open: false, request: null })}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
                        <Button onClick={handleReject} disabled={processing !== null} className="bg-red-600 hover:bg-red-700 text-white">
                            {processing ? <RefreshCw className="h-4 w-4 animate-spin" /> : (isRTL ? 'رفض' : 'Reject')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create dialog */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>{isRTL ? 'طلب نقل جديد' : 'New Transfer Request'}</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-medium text-gray-600 mb-1 block">{isRTL ? 'من مستودع' : 'From Warehouse'}</label>
                                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={newFromWh} onChange={(e) => setNewFromWh(e.target.value)}>
                                    <option value="">{isRTL ? 'اختر' : 'Select'}</option>
                                    {allActiveWh.map((w) => <option key={w.name} value={w.name}>{w.warehouse_name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-600 mb-1 block">{isRTL ? 'إلى مستودع' : 'To Warehouse'}</label>
                                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={newToWh} onChange={(e) => setNewToWh(e.target.value)}>
                                    <option value="">{isRTL ? 'اختر' : 'Select'}</option>
                                    {allActiveWh.map((w) => <option key={w.name} value={w.name}>{w.warehouse_name}</option>)}
                                </select>
                            </div>
                        </div>
                        {hasSales && <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">{isRTL ? 'المندوب (اختياري)' : 'Sales Person (optional)'}</label>
                            <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={newSalesPerson} onChange={(e) => setNewSalesPerson(e.target.value)}>
                                <option value="">{isRTL ? 'بدون' : 'None'}</option>
                                {salesPersons.map((sp) => <option key={sp.name} value={sp.name}>{sp.sales_person_name}</option>)}
                            </select>
                        </div>}
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-2 block">{isRTL ? 'الأصناف' : 'Items'}</label>
                            {newItems.map((item, idx) => (
                                <div key={idx} className="flex gap-2 mb-2 items-center">
                                    <ItemSearchInput
                                        placeholder={isRTL ? 'كود الصنف' : 'Item code'}
                                        value={item.item_code}
                                        onChange={(val) => { const items = [...newItems]; items[idx].item_code = val; setNewItems(items) }}
                                    />
                                    <Input className="w-20 h-8 text-xs" type="number" min="1" placeholder={isRTL ? 'كمية' : 'Qty'} value={item.requested_qty} onChange={(e) => { const items = [...newItems]; items[idx].requested_qty = e.target.value; setNewItems(items) }} />
                                    {newItems.length > 1 && <button onClick={() => setNewItems(newItems.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
                                </div>
                            ))}
                            <Button variant="ghost" size="sm" onClick={() => setNewItems([...newItems, emptyItem()])} className="text-xs text-orange-600">
                                <Plus className="h-3 w-3 mr-1" />{isRTL ? 'إضافة صنف' : 'Add Item'}
                            </Button>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
                        <Button onClick={handleCreate} disabled={creating} className="bg-orange-600 hover:bg-orange-700 text-white">
                            {creating ? <RefreshCw className="h-4 w-4 animate-spin" /> : (isRTL ? 'إنشاء' : 'Create')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

// ═══════════════════════════════════════════════
// 5. RETURNS (Product Return From Customer)
// ═══════════════════════════════════════════════
// Return status colours → lib/status-config.ts getStatusClass()
// Note: 'Credit Note Issued' added to STATUS_CLASS_MAP if needed.

/** Derive display status from docstatus + return_status fields */
function getReturnDisplayStatus(r: ProductReturn): string {
    if (r.docstatus === 2) return 'Cancelled'
    if (r.return_status) return r.return_status
    if (r.docstatus === 1) return 'Submitted'
    return 'Draft'
}

function ReturnsView({
    returnLogs, warehouses, loading, onRefresh, hasSales = true, brand,
}: {
    returnLogs: ProductReturn[]
    warehouses: Warehouse[]
    loading: boolean
    onRefresh: () => void
    hasSales?: boolean
    brand?: TenantBrand
}) {
    const { isRTL } = useI18n()
    const { toast } = useToast()
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 15
    const [viewDialog, setViewDialog] = useState<{ open: boolean; ret: ProductReturn | null }>({ open: false, ret: null })
    const [loadingDetail, setLoadingDetail] = useState(false)
    const [submittingReturn, setSubmittingReturn] = useState(false)
    const [processingAction, setProcessingAction] = useState<string | null>(null)

    // Create dialog
    const [createOpen, setCreateOpen] = useState(false)
    const [creating, setCreating] = useState(false)
    const [newCustomer, setNewCustomer] = useState('')
    const [newSalesPerson, setNewSalesPerson] = useState('')
    const [newReturnReason, setNewReturnReason] = useState<string>('')
    type ReturnItem = { item_code: string; qty: string; rate: string; batch_no?: string }
    const emptyReturnItem = (): ReturnItem => ({ item_code: '', qty: '1', rate: '' })
    const [newReturnItems, setNewReturnItems] = useState<ReturnItem[]>([emptyReturnItem()])

    const handleCreate = async () => {
        if (!newCustomer.trim()) { toast({ title: isRTL ? 'العميل مطلوب' : 'Customer is required', variant: 'destructive' }); return }
        const validItems = newReturnItems.filter((i) => i.item_code.trim() && Number(i.qty) > 0)
        if (!validItems.length) { toast({ title: isRTL ? 'أضف صنف واحد على الأقل' : 'Add at least one item', variant: 'destructive' }); return }
        setCreating(true)
        try {
            const created = await salesApi.createProductReturn({
                return_date: new Date().toISOString().split('T')[0],
                customer: newCustomer.trim(),
                sales_person: newSalesPerson.trim() || undefined,
                return_reason: (newReturnReason as any) || 'Other',
                items: validItems.map((i) => ({
                    item_code: i.item_code.trim(),
                    qty: Number(i.qty),
                    rate: Number(i.rate) || 0,
                    ...(i.batch_no ? { batch_no: i.batch_no } : {}),
                })),
            })
            if (created) {
                toast({ title: isRTL ? 'تم إنشاء المرتجع' : 'Product return created' })
                setCreateOpen(false); setNewCustomer(''); setNewSalesPerson(''); setNewReturnReason(''); setNewReturnItems([emptyReturnItem()])
                onRefresh()
            }
        } catch (e: any) {
            toast({ title: isRTL ? 'خطأ' : 'Error', description: e?.message, variant: 'destructive' })
        } finally { setCreating(false) }
    }

    const handlePrintReturn = (ret: ProductReturn) => {
        const items = ret.items || []
        printDoc({
            rtl: isRTL,
            brandName: brandLabel(brand, isRTL),
            brandTagline: brand?.tagline,
            logoUrl: brand?.logo,
            title: isRTL ? 'سند مرتجع' : 'Return Note',
            docNo: ret.name,
            date: ret.return_date,
            meta: [
                { label: isRTL ? 'العميل' : 'Customer', value: ret.customer || '—' },
                ...(hasSales && ret.sales_person ? [{ label: isRTL ? 'المندوب' : 'Rep', value: ret.sales_person }] : []),
                { label: isRTL ? 'سبب الإرجاع' : 'Reason', value: tr(RETURN_REASON_AR, ret.return_reason || '—', isRTL) },
                { label: isRTL ? 'الحالة' : 'Status', value: tr(RETURN_STATUS_AR, getReturnDisplayStatus(ret), isRTL) },
                ...(ret.stock_entry ? [{ label: isRTL ? 'قيد المخزون' : 'Stock entry', value: ret.stock_entry }] : []),
            ],
            columns: [
                { key: 'item', label: isRTL ? 'كود الصنف' : 'Item No.', ltr: true },
                { key: 'qty', label: isRTL ? 'الكمية' : 'Qty', align: 'center' },
                { key: 'rate', label: isRTL ? 'السعر' : 'Price', align: 'center' },
                { key: 'amount', label: isRTL ? 'الإجمالي' : 'Total', align: 'end' },
            ],
            rows: items.map((it) => ({
                item: it.item_code,
                qty: it.qty,
                rate: it.rate ? it.rate.toLocaleString() : '—',
                amount: (it.amount ?? it.qty * (it.rate || 0)).toLocaleString(),
            })),
            totals: [
                { label: isRTL ? 'إجمالي الكمية' : 'Total qty', value: String(ret.total_qty ?? items.reduce((t, it) => t + (it.qty || 0), 0)) },
                { label: isRTL ? 'إجمالي القيمة' : 'Total amount', value: `${(ret.total_amount || ret.total_return_value || items.reduce((t, it) => t + (it.amount ?? it.qty * (it.rate || 0)), 0)).toLocaleString()} ${cur(isRTL)}`, bold: true },
            ],
            notes: ret.notes || undefined,
            signatures: isRTL ? ['أمين المستودع', 'المُسلِّم', 'الاعتماد'] : ['Storekeeper', 'Returned by', 'Approved by'],
        })
    }

    const handleInlineSubmit = async (ret: ProductReturn) => {
        setProcessingAction(ret.name)
        try {
            await salesApi.submitProductReturn(ret.name)
            toast({ title: isRTL ? 'تم ترحيل المرتجع بنجاح' : 'Return submitted successfully' })
            onRefresh()
        } catch (e: any) {
            toast({ title: isRTL ? 'فشل الترحيل' : 'Submit failed', description: e?.message, variant: 'destructive' })
        } finally { setProcessingAction(null) }
    }

    const statuses = ['all', 'Draft', 'Submitted', 'Accepted', 'Rejected', 'Credit Note Issued']

    const filtered = useMemo(() => {
        let list = returnLogs
        if (statusFilter !== 'all') list = list.filter((r) => getReturnDisplayStatus(r) === statusFilter)
        if (search) {
            const q = search.toLowerCase()
            list = list.filter((r) =>
                r.name.toLowerCase().includes(q) ||
                (r.customer || '').toLowerCase().includes(q) ||
                (r.sales_person || '').toLowerCase().includes(q) ||
                (r.return_reason || '').toLowerCase().includes(q)
            )
        }
        return list
    }, [returnLogs, search, statusFilter])

    const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    const totalPages = Math.ceil(filtered.length / itemsPerPage)

    // Stats
    const totalReturns = returnLogs.length
    const draftCount = returnLogs.filter(r => !r.docstatus || r.docstatus === 0).length
    const submittedCount = returnLogs.filter(r => getReturnDisplayStatus(r) === 'Submitted').length
    const acceptedCount = returnLogs.filter(r => getReturnDisplayStatus(r) === 'Accepted').length
    const totalQty = returnLogs.reduce((sum, r) => sum + (r.total_qty || 0), 0)

    const handleView = async (ret: ProductReturn) => {
        setViewDialog({ open: true, ret })
        setLoadingDetail(true)
        try {
            const detail = await salesApi.getProductReturn(ret.name)
            if (detail) setViewDialog({ open: true, ret: detail })
        } catch { } finally { setLoadingDetail(false) }
    }

    const handleSubmitFromDialog = async () => {
        if (!viewDialog.ret) return
        setSubmittingReturn(true)
        try {
            await salesApi.submitProductReturn(viewDialog.ret.name)
            toast({ title: isRTL ? 'تم ترحيل المرتجع بنجاح' : 'Return submitted' })
            setViewDialog({ open: false, ret: null })
            onRefresh()
        } catch (e: any) {
            toast({ title: isRTL ? 'فشل الترحيل' : 'Submit failed', description: e?.message, variant: 'destructive' })
        } finally { setSubmittingReturn(false) }
    }

    if (loading) return <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>

    return (
        <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                    { label: isRTL ? 'إجمالي المرتجعات' : 'Total Returns', value: totalReturns, color: 'text-gray-900' },
                    { label: isRTL ? 'مسودة' : 'Draft', value: draftCount, color: 'text-gray-500' },
                    { label: isRTL ? 'مُرسَل' : 'Submitted', value: submittedCount, color: 'text-blue-600' },
                    { label: isRTL ? 'مقبول' : 'Accepted', value: acceptedCount, color: 'text-green-600' },
                    { label: isRTL ? 'إجمالي الكمية' : 'Total Qty', value: totalQty, color: 'text-orange-600' },
                ].map((s, i) => (
                    <div key={i} className="bg-white rounded-lg border border-gray-100 px-4 py-3">
                        <p className="text-xs text-gray-500">{s.label}</p>
                        <p className={cn('text-xl font-bold', s.color)}>{s.value.toLocaleString()}</p>
                    </div>
                ))}
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
                    <Input placeholder={hasSales ? (isRTL ? 'بحث بالاسم أو العميل أو المندوب...' : 'Search by name, customer, or rep...') : (isRTL ? 'بحث بالاسم أو العميل...' : 'Search by name or customer...')} value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }} className={cn('h-9 text-sm', isRTL ? 'pr-9' : 'pl-9')} />
                </div>
                <Button variant="outline" size="sm" onClick={onRefresh}><RefreshCw className="h-4 w-4" /></Button>
                <div className="flex flex-wrap gap-1.5">
                    {statuses.map((s) => {
                        const count = s === 'all' ? returnLogs.length : returnLogs.filter((r) => getReturnDisplayStatus(r) === s).length
                        const labelMap: Record<string, [string, string]> = {
                            all: ['الكل', 'All'],
                            Draft: ['مسودة', 'Draft'],
                            Submitted: ['مُرسَل', 'Submitted'],
                            Accepted: ['مقبول', 'Accepted'],
                            Rejected: ['مرفوض', 'Rejected'],
                            'Credit Note Issued': ['إشعار دائن', 'Credit Note'],
                        }
                        const [ar, en] = labelMap[s] || [s, s]
                        return (
                            <button key={s} onClick={() => { setStatusFilter(s); setCurrentPage(1) }} className={cn('px-3 py-1 rounded-full text-xs font-medium', statusFilter === s ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                                {isRTL ? ar : en} ({count})
                            </button>
                        )
                    })}
                </div>
                <Button size="sm" onClick={() => setCreateOpen(true)} className="bg-orange-600 hover:bg-orange-700 text-white">
                    <Plus className="h-4 w-4" /><span className={cn('text-xs', isRTL ? 'mr-1' : 'ml-1')}>{isRTL ? 'مرتجع جديد' : 'New Return'}</span>
                </Button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                                <th className={cn('px-4 py-3 font-medium', isRTL ? 'text-right' : 'text-left')}>{isRTL ? 'الرقم' : '#'}</th>
                                <th className={cn('px-4 py-3 font-medium', isRTL ? 'text-right' : 'text-left')}>{isRTL ? 'العميل' : 'Customer'}</th>
                                {hasSales && <th className={cn('px-4 py-3 font-medium', isRTL ? 'text-right' : 'text-left')}>{isRTL ? 'المندوب' : 'Rep'}</th>}
                                <th className="px-4 py-3 font-medium text-center">{isRTL ? 'السبب' : 'Reason'}</th>
                                <th className="px-4 py-3 font-medium text-center">{isRTL ? 'الكمية' : 'Qty'}</th>
                                <th className="px-4 py-3 font-medium text-center">{isRTL ? 'القيمة' : 'Amount'}</th>
                                <th className="px-4 py-3 font-medium text-center">{isRTL ? 'الحالة' : 'Status'}</th>
                                <th className="px-4 py-3 font-medium text-center">{isRTL ? 'التاريخ' : 'Date'}</th>
                                <th className="px-4 py-3 font-medium text-center">{isRTL ? 'إجراءات' : 'Actions'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {paginated.map((r) => {
                                const displayStatus = getReturnDisplayStatus(r)
                                return (
                                    <tr key={r.name} className="hover:bg-gray-50/50">
                                        <td className="px-4 py-2.5"><button onClick={() => handleView(r)} className="text-sm font-medium text-orange-600 hover:underline">{r.name}</button></td>
                                        <td className="px-4 py-2.5 text-sm text-gray-700">{r.customer || '—'}</td>
                                        {hasSales && <td className="px-4 py-2.5 text-sm text-gray-600">{r.sales_person || '—'}</td>}
                                        <td className="px-4 py-2.5 text-center">
                                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{tr(RETURN_REASON_AR, r.return_reason || '—', isRTL)}</span>
                                        </td>
                                        <td className="px-4 py-2.5 text-center font-semibold">{r.total_qty || 0}</td>
                                        <td className="px-4 py-2.5 text-center text-sm">
                                            {(r.total_amount || r.total_return_value) ? `${(r.total_amount || r.total_return_value || 0).toLocaleString()} ${cur(isRTL)}` : '—'}
                                        </td>
                                        <td className="px-4 py-2.5 text-center">
                                            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', getStatusClass(displayStatus))}>{tr(RETURN_STATUS_AR, displayStatus, isRTL)}</span>
                                        </td>
                                        <td className="px-4 py-2.5 text-center text-xs text-gray-500">{r.return_date}</td>
                                        <td className="px-4 py-2.5 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => handleView(r)} className="p-1.5 rounded-lg hover:bg-gray-100"><Eye className="h-3.5 w-3.5 text-gray-500" /></button>
                                                <button onClick={async () => { let full = r; if (!full.items?.length) { try { const d = await salesApi.getProductReturn(r.name); if (d) full = d } catch { /* print summary */ } } handlePrintReturn(full) }} title={isRTL ? 'طباعة' : 'Print'} className="p-1.5 rounded-lg hover:bg-gray-100"><Printer className="h-3.5 w-3.5 text-gray-500" /></button>
                                                {(!r.docstatus || r.docstatus === 0) && (
                                                    <Button size="sm" variant="ghost" className="text-blue-600 text-xs h-7" onClick={() => handleInlineSubmit(r)} disabled={processingAction === r.name}>
                                                        {processingAction === r.name ? <RefreshCw className="h-3 w-3 animate-spin" /> : (isRTL ? 'ترحيل' : 'Submit')}
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                            {paginated.length === 0 && <tr><td colSpan={hasSales ? 9 : 8} className="text-center py-10 text-sm text-gray-400">{isRTL ? 'لا توجد مرتجعات' : 'No returns'}</td></tr>}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                        <p className="text-xs text-gray-500">{(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filtered.length)} / {filtered.length}</p>
                        <div className="flex gap-1">
                            <Button variant="ghost" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>{isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</Button>
                            <Button variant="ghost" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>{isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</Button>
                        </div>
                    </div>
                )}
            </div>

            {/* View dialog */}
            <Dialog open={viewDialog.open} onOpenChange={(o) => setViewDialog({ open: o, ret: o ? viewDialog.ret : null })}>
                <DialogContent className="max-w-lg">
                    <DialogHeader><DialogTitle>{viewDialog.ret?.name}</DialogTitle></DialogHeader>
                    {viewDialog.ret && (
                        <div className="space-y-3 text-sm">
                            <div className="grid grid-cols-2 gap-3">
                                <div><p className="text-xs text-gray-400">{isRTL ? 'العميل' : 'Customer'}</p><p className="font-medium">{viewDialog.ret.customer || '—'}</p></div>
                                {hasSales && <div><p className="text-xs text-gray-400">{isRTL ? 'المندوب' : 'Rep'}</p><p className="font-medium">{viewDialog.ret.sales_person || '—'}</p></div>}
                                <div><p className="text-xs text-gray-400">{isRTL ? 'السبب' : 'Reason'}</p><p className="font-medium">{tr(RETURN_REASON_AR, viewDialog.ret.return_reason || '—', isRTL)}</p></div>
                                <div><p className="text-xs text-gray-400">{isRTL ? 'التاريخ' : 'Date'}</p><p className="font-medium">{viewDialog.ret.return_date}</p></div>
                                <div><p className="text-xs text-gray-400">{isRTL ? 'الكمية' : 'Total Qty'}</p><p className="font-medium">{viewDialog.ret.total_qty || 0}</p></div>
                                <div><p className="text-xs text-gray-400">{isRTL ? 'القيمة' : 'Total Amount'}</p><p className="font-medium">{(viewDialog.ret.total_amount || viewDialog.ret.total_return_value || 0).toLocaleString()} {cur(isRTL)}</p></div>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 mb-1">{isRTL ? 'الحالة' : 'Status'}</p>
                                <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', getStatusClass(getReturnDisplayStatus(viewDialog.ret)))}>
                                    {tr(RETURN_STATUS_AR, getReturnDisplayStatus(viewDialog.ret), isRTL)}
                                </span>
                            </div>
                            {loadingDetail && <Skeleton className="h-20" />}
                            {viewDialog.ret.items && viewDialog.ret.items.length > 0 && (
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead><tr className="bg-gray-50 text-gray-500">
                                            <th className="px-3 py-2 text-left">{isRTL ? 'الصنف' : 'Item'}</th>
                                            <th className="px-3 py-2 text-center">{isRTL ? 'الكمية' : 'Qty'}</th>
                                            <th className="px-3 py-2 text-center">{isRTL ? 'السعر' : 'Rate'}</th>
                                            <th className="px-3 py-2 text-center">{isRTL ? 'المبلغ' : 'Amount'}</th>
                                        </tr></thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {viewDialog.ret.items.map((item, i) => (
                                                <tr key={i}>
                                                    <td className="px-3 py-2">
                                                        <p className="font-medium">{item.item_name || item.item_code}</p>
                                                        {item.item_name && item.item_name !== item.item_code && <p className="text-[10px] text-gray-400">{item.item_code}</p>}
                                                        {item.batch_no && <p className="text-[10px] text-gray-400">{isRTL ? 'الدفعة:' : 'Batch:'} {item.batch_no}</p>}
                                                    </td>
                                                    <td className="px-3 py-2 text-center">{item.qty}</td>
                                                    <td className="px-3 py-2 text-center">{item.rate || '—'}</td>
                                                    <td className="px-3 py-2 text-center">{item.amount || (item.qty * (item.rate || 0)).toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            {/* Actions */}
                            <div className="flex gap-2 pt-2">
                                <Button size="sm" variant="outline" onClick={() => viewDialog.ret && handlePrintReturn(viewDialog.ret)}>
                                    <Printer className="h-3.5 w-3.5" />
                                    <span className={cn('text-xs', isRTL ? 'mr-1.5' : 'ml-1.5')}>{isRTL ? 'طباعة السند' : 'Print note'}</span>
                                </Button>
                                {(!viewDialog.ret.docstatus || viewDialog.ret.docstatus === 0) && (
                                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={submittingReturn} onClick={handleSubmitFromDialog}>
                                        {submittingReturn ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : (isRTL ? 'ترحيل المرتجع' : 'Submit Return')}
                                    </Button>
                                )}
                                {viewDialog.ret.stock_entry && (
                                    <span className="text-xs text-gray-500 self-center">
                                        {isRTL ? 'قيد المخزون: ' : 'Stock Entry: '}{viewDialog.ret.stock_entry}
                                    </span>
                                )}
                                {viewDialog.ret.sales_invoice && (
                                    <span className="text-xs text-gray-500 self-center">
                                        {isRTL ? 'الفاتورة: ' : 'Invoice: '}{viewDialog.ret.sales_invoice}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Create dialog */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>{isRTL ? 'مرتجع جديد' : 'New Product Return'}</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <CustomerSearchInput value={newCustomer} onChange={setNewCustomer} isRTL={isRTL} />
                        {hasSales && <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">{isRTL ? 'المندوب (اختياري)' : 'Sales Person (optional)'}</label>
                            <Input placeholder={isRTL ? 'اسم المندوب' : 'Sales person name'} value={newSalesPerson} onChange={(e) => setNewSalesPerson(e.target.value)} className="h-9 text-sm" />
                        </div>}
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">{isRTL ? 'سبب الإرجاع' : 'Return Reason'} *</label>
                            <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={newReturnReason} onChange={(e) => setNewReturnReason(e.target.value)}>
                                <option value="">{isRTL ? 'اختر السبب' : 'Select reason'}</option>
                                <option value="Damaged">{isRTL ? 'تالف' : 'Damaged'}</option>
                                <option value="Expired">{isRTL ? 'منتهي الصلاحية' : 'Expired'}</option>
                                <option value="Wrong Product">{isRTL ? 'منتج خاطئ' : 'Wrong Product'}</option>
                                <option value="Quality Issue">{isRTL ? 'مشكلة جودة' : 'Quality Issue'}</option>
                                <option value="Other">{isRTL ? 'أخرى' : 'Other'}</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-2 block">{isRTL ? 'الأصناف' : 'Items'} *</label>
                            {newReturnItems.map((item, idx) => (
                                <div key={idx} className="flex gap-2 mb-2 items-center">
                                    <ItemSearchInput
                                        placeholder={isRTL ? 'كود الصنف' : 'Item code'}
                                        value={item.item_code}
                                        onChange={(val) => { const items = [...newReturnItems]; items[idx].item_code = val; setNewReturnItems(items) }}
                                    />
                                    <Input className="w-20 h-8 text-xs" type="number" min="1" placeholder={isRTL ? 'كمية' : 'Qty'} value={item.qty} onChange={(e) => { const items = [...newReturnItems]; items[idx].qty = e.target.value; setNewReturnItems(items) }} />
                                    <Input className="w-24 h-8 text-xs" type="number" placeholder={isRTL ? 'السعر' : 'Rate'} value={item.rate} onChange={(e) => { const items = [...newReturnItems]; items[idx].rate = e.target.value; setNewReturnItems(items) }} />
                                    {newReturnItems.length > 1 && <button onClick={() => setNewReturnItems(newReturnItems.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
                                </div>
                            ))}
                            <Button variant="ghost" size="sm" onClick={() => setNewReturnItems([...newReturnItems, emptyReturnItem()])} className="text-xs text-orange-600">
                                <Plus className="h-3 w-3 mr-1" />{isRTL ? 'إضافة صنف' : 'Add Item'}
                            </Button>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
                        <Button onClick={handleCreate} disabled={creating} className="bg-orange-600 hover:bg-orange-700 text-white">
                            {creating ? <RefreshCw className="h-4 w-4 animate-spin" /> : (isRTL ? 'إنشاء' : 'Create')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

// ═══════════════════════════════════════════════
// 6. AUDIT LOG
// ═══════════════════════════════════════════════
// Movement colours → lib/status-config.ts getStatusClass()

function AuditView({
    auditLogs, loading, onRefresh,
}: {
    auditLogs: StockMovementAudit[]
    loading: boolean
    onRefresh: () => void
}) {
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
            list = list.filter((a) => a.item_code.toLowerCase().includes(q) || a.warehouse.toLowerCase().includes(q) || a.reference_name?.toLowerCase().includes(q))
        }
        return list
    }, [auditLogs, search, typeFilter])

    const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    const totalPages = Math.ceil(filtered.length / itemsPerPage)

    if (loading) return <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>

    return (
        <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
                    <Input placeholder={isRTL ? 'بحث...' : 'Search...'} value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }} className={cn('h-9 text-sm', isRTL ? 'pr-9' : 'pl-9')} />
                </div>
                <div className="flex gap-1.5">
                    {['all', 'In', 'Out', 'Transfer'].map((t) => (
                        <button key={t} onClick={() => { setTypeFilter(t); setCurrentPage(1) }} className={cn('px-3 py-1 rounded-full text-xs font-medium', typeFilter === t ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                            {t === 'all' ? (isRTL ? 'الكل' : 'All') : tr(MOVEMENT_TYPE_AR, t, isRTL)}
                        </button>
                    ))}
                </div>
                <Button variant="outline" size="sm" onClick={onRefresh}><RefreshCw className="h-4 w-4" /></Button>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                                <th className={cn('px-4 py-3 font-medium', isRTL ? 'text-right' : 'text-left')}>{isRTL ? 'الصنف' : 'Item'}</th>
                                <th className={cn('px-4 py-3 font-medium', isRTL ? 'text-right' : 'text-left')}>{isRTL ? 'المستودع' : 'Warehouse'}</th>
                                <th className="px-4 py-3 font-medium text-center">{isRTL ? 'النوع' : 'Type'}</th>
                                <th className="px-4 py-3 font-medium text-center">{isRTL ? 'التغيير' : 'Change'}</th>
                                <th className="px-4 py-3 font-medium text-center">{isRTL ? 'السابق → الجديد' : 'Prev → New'}</th>
                                <th className={cn('px-4 py-3 font-medium', isRTL ? 'text-right' : 'text-left')}>{isRTL ? 'المرجع' : 'Reference'}</th>
                                <th className="px-4 py-3 font-medium text-center">{isRTL ? 'التاريخ' : 'Date'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {paginated.map((a) => (
                                <tr key={a.name} className="hover:bg-gray-50/50">
                                    <td className={cn('px-4 py-2.5 font-medium text-gray-800', isRTL ? 'text-right' : 'text-left')}>{a.item_code}</td>
                                    <td className={cn('px-4 py-2.5 text-gray-600', isRTL ? 'text-right' : 'text-left')}>{a.warehouse}</td>
                                    <td className="px-4 py-2.5 text-center">
                                        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', getStatusClass(a.movement_type))}>{tr(MOVEMENT_TYPE_AR, a.movement_type, isRTL)}</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-center">
                                        <span className={cn('text-sm font-semibold', a.quantity_change > 0 ? 'text-green-600' : 'text-red-600')}>
                                            {a.quantity_change > 0 ? '+' : ''}{a.quantity_change}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2.5 text-center text-xs text-gray-500">{a.previous_qty} → {a.new_qty}</td>
                                    <td className={cn('px-4 py-2.5 text-xs text-gray-500 truncate max-w-[150px]', isRTL ? 'text-right' : 'text-left')}>
                                        {a.reference_name || '—'}
                                    </td>
                                    <td className="px-4 py-2.5 text-center text-xs text-gray-500">{a.movement_date}</td>
                                </tr>
                            ))}
                            {paginated.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-sm text-gray-400">{isRTL ? 'لا توجد حركات' : 'No movements'}</td></tr>}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                        <p className="text-xs text-gray-500">{(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filtered.length)} / {filtered.length}</p>
                        <div className="flex gap-1">
                            <Button variant="ghost" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>{isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</Button>
                            <Button variant="ghost" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>{isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

