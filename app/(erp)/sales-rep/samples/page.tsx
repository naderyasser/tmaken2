"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Gift, Loader2, AlertCircle, RefreshCw,
    CheckCircle2, Plus, Minus, Package, Search,
    MapPin, History, User, ChevronDown, ChevronUp,
    Send, X,
} from "lucide-react"
import { useSalesRep } from "@/contexts/SalesRepContext"
import {
    salesApi,
    type AvailableSample,
    type FreeSampleDistribution,
    type AllowedCustomersResponse,
    type Customer,
} from "@/lib/sales-api"
import { useI18n } from "@/lib/i18n"
import { displayLocale } from '@/lib/sales-format'

export default function FreeSamplesPage() {
    const { salesPerson, customers } = useSalesRep()
    const { t, lang, dir } = useI18n()
    const dl = displayLocale(lang)

    // ── State ─────────────────────────────────────────────
    const [activeView, setActiveView] = useState<"available" | "distribute" | "history">("available")
    const [availableSamples, setAvailableSamples] = useState<AvailableSample[]>([])
    const [distributionHistory, setDistributionHistory] = useState<FreeSampleDistribution[]>([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    // Distribution form
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
    const [customerSearch, setCustomerSearch] = useState("")
    const [showCustomerPicker, setShowCustomerPicker] = useState(false)
    const [selectedItems, setSelectedItems] = useState<Map<string, { qty: number; item_name: string; uom: string; max: number }>>(new Map())
    const [notes, setNotes] = useState("")
    const [customerConfirmed, setCustomerConfirmed] = useState(false)
    const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null)

    // Confirmation dialog
    const [showConfirmDialog, setShowConfirmDialog] = useState(false)

    // History expansion
    const [expandedHistory, setExpandedHistory] = useState<string | null>(null)

    // Allowed customers
    const [allowedCustomersData, setAllowedCustomersData] = useState<AllowedCustomersResponse>({ allow_all: true, customers: [] })

    // ── Load data ─────────────────────────────────────────
    const loadAvailableSamples = useCallback(async () => {
        if (!salesPerson) return
        try {
            const data = await salesApi.getAvailableSamples(salesPerson.name)
            setAvailableSamples(data)
        } catch {
            setAvailableSamples([])
        }
    }, [salesPerson])

    const loadHistory = useCallback(async () => {
        if (!salesPerson) return
        try {
            const data = await salesApi.getDistributionHistory(salesPerson.name)
            setDistributionHistory(data)
        } catch {
            setDistributionHistory([])
        }
    }, [salesPerson])

    const loadAllowedCustomers = useCallback(async () => {
        if (!salesPerson) return
        try {
            const data = await salesApi.getAllowedCustomers(salesPerson.name)
            setAllowedCustomersData(data)
        } catch {
            setAllowedCustomersData({ allow_all: false, customers: [] })
        }
    }, [salesPerson])

    const loadAll = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            await Promise.all([loadAvailableSamples(), loadHistory(), loadAllowedCustomers()])
        } catch {
            setError(t('sr.samples.err_load'))
        } finally {
            setLoading(false)
        }
    }, [loadAvailableSamples, loadHistory, loadAllowedCustomers])

    useEffect(() => {
        loadAll()
    }, [loadAll])

    // Get GPS on mount
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setGpsLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => {/* ignore */ },
                { enableHighAccuracy: true, timeout: 10000 }
            )
        }
    }, [])

    // ── Helpers ───────────────────────────────────────────
    // Filter customers based on allowed list from allocations
    // When items are selected in distribute tab, narrow down to customers allowed for those specific items
    const allowedCustomersList = (() => {
        const perItem = allowedCustomersData.per_item
        const selectedItemCodes = Array.from(selectedItems.keys())

        // If no per_item data or no items selected, use global allow_all / customers list
        if (!perItem || selectedItemCodes.length === 0) {
            return allowedCustomersData.allow_all
                ? customers
                : customers.filter(c => allowedCustomersData.customers.some(ac => ac.customer === c.name))
        }

        // Find customers allowed for ALL selected items (intersection)
        let result: Customer[] | null = null
        for (const itemCode of selectedItemCodes) {
            const itemPerms = perItem[itemCode]
            if (!itemPerms || itemPerms.allow_all) {
                // This item allows all customers, no restriction from this item
                continue
            }
            // Filter to only customers allowed for this item
            const allowedSet = new Set(itemPerms.customers.map(c => c.customer))
            const filtered = customers.filter(c => allowedSet.has(c.name))
            if (result === null) {
                result = filtered
            } else {
                const filteredSet = new Set(filtered.map(c => c.name))
                result = result.filter(c => filteredSet.has(c.name))
            }
        }

        // If result is null, all items have allow_all → show all customers
        return result ?? customers
    })()

    const filteredCustomers = allowedCustomersList.filter((c) =>
        !customerSearch ||
        c.customer_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.name.toLowerCase().includes(customerSearch.toLowerCase())
    )

    const totalSelectedQty = Array.from(selectedItems.values()).reduce((sum, i) => sum + i.qty, 0)

    const updateItemQty = (itemCode: string, delta: number) => {
        setSelectedItems((prev) => {
            const next = new Map(prev)
            const existing = next.get(itemCode)
            if (!existing) return prev
            const newQty = Math.max(0, Math.min(existing.max, existing.qty + delta))
            if (newQty === 0) {
                next.delete(itemCode)
            } else {
                next.set(itemCode, { ...existing, qty: newQty })
            }
            return next
        })
    }

    const addItem = (sample: AvailableSample) => {
        setSelectedItems((prev) => {
            const next = new Map(prev)
            if (next.has(sample.item_code)) return prev
            next.set(sample.item_code, {
                qty: 1,
                item_name: sample.item_name,
                uom: sample.stock_uom || 'Nos',
                max: sample.total_remaining,
            })
            return next
        })
    }

    const removeItem = (itemCode: string) => {
        setSelectedItems((prev) => {
            const next = new Map(prev)
            next.delete(itemCode)
            return next
        })
    }

    const resetForm = () => {
        setSelectedCustomer(null)
        setSelectedItems(new Map())
        setNotes("")
        setCustomerConfirmed(false)
        setCustomerSearch("")
    }

    // ── Submit ────────────────────────────────────────────
    const handleDistribute = async () => {
        if (!salesPerson || !selectedCustomer || selectedItems.size === 0) return

        setShowConfirmDialog(false)
        setSubmitting(true)
        setError(null)
        setSuccess(null)

        try {
            const items = Array.from(selectedItems.entries()).map(([item_code, info]) => ({
                item_code,
                qty: info.qty,
                uom: info.uom,
            }))

            await salesApi.distributeSamples({
                salesPerson: salesPerson.name,
                customer: selectedCustomer.name,
                items,
                gpsLatitude: gpsLocation?.lat,
                gpsLongitude: gpsLocation?.lng,
                customerConfirmed,
                notes,
            })

            setSuccess(t('sr.samples.success_distributed').replace('{n}', String(totalSelectedQty)).replace('{name}', selectedCustomer.customer_name))
            resetForm()
            await loadAll()
            // Switch to available view after success
            setTimeout(() => setActiveView("available"), 1500)
        } catch (err: any) {
            let msg = err?.message || err?.exc || t('sr.samples.err_distribute')
            if (typeof msg !== "string") msg = JSON.stringify(msg)
            // Strip HTML tags that Frappe sometimes wraps errors in
            msg = msg.replace(/<[^>]*>/g, '').trim()
            // Clean up common Frappe error prefixes
            msg = msg.replace(/^CALL .* failed \(HTTP \d+\)\s*/, '')
            setError(msg || t('sr.samples.err_distribute'))
        } finally {
            setSubmitting(false)
        }
    }

    // ── Render ────────────────────────────────────────────
    if (!salesPerson) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-24" dir={dir}>
            {/* Header */}
            <div className="bg-gradient-to-l from-amber-500 to-orange-600 text-white px-4 pt-12 pb-6">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                            <Gift className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold">{t('sr.samples.title')}</h1>
                            <p className="text-sm text-white/80">{t('sr.samples.subtitle')}</p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-white hover:bg-white/20 rounded-xl"
                        onClick={loadAll}
                        disabled={loading}
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
                    </Button>
                </div>

                {/* Summary badges */}
                <div className="flex gap-2 mt-3">
                    <Badge className="bg-white/20 text-white border-0 px-3 py-1.5">
                        <Package className="w-3.5 h-3.5 ml-1" />
                        {t('sr.samples.badge_available').replace('{n}', String(availableSamples.length))}
                    </Badge>
                    <Badge className="bg-white/20 text-white border-0 px-3 py-1.5">
                        <Gift className="w-3.5 h-3.5 ml-1" />
                        {t('sr.samples.badge_remaining').replace('{n}', String(availableSamples.reduce((s, a) => s + a.total_remaining, 0)))}
                    </Badge>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="px-4 -mt-3">
                <Card className="p-1 flex gap-1 rounded-xl bg-white shadow-sm border border-slate-200">
                    {[
                        { key: "available" as const, label: t('sr.samples.tab_available'), icon: Package },
                        { key: "distribute" as const, label: t('sr.samples.tab_distribute'), icon: Send },
                        { key: "history" as const, label: t('sr.samples.tab_history'), icon: History },
                    ].map(({ key, label, icon: Icon }) => (
                        <button
                            key={key}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeView === key
                                ? "bg-orange-600 text-white shadow-md"
                                : "text-slate-500 hover:bg-slate-100"
                                }`}
                            onClick={() => setActiveView(key)}
                        >
                            <Icon className="w-4 h-4" />
                            {label}
                        </button>
                    ))}
                </Card>
            </div>

            {/* Error / Success messages */}
            {error && (
                <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                    <button className="mr-auto" onClick={() => setError(null)}>
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {success && (
                <div className="mx-4 mt-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{success}</span>
                    <button className="mr-auto" onClick={() => setSuccess(null)}>
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
                </div>
            )}

            {/* ─── Available Samples View ─── */}
            {!loading && activeView === "available" && (
                <div className="px-4 py-4 space-y-3">
                    {availableSamples.length === 0 ? (
                        <Card className="p-8 text-center">
                            <Package className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                            <p className="text-slate-500 font-medium">{t('sr.samples.empty_available')}</p>
                            <p className="text-slate-400 text-sm mt-1">{t('sr.samples.empty_available_desc')}</p>
                        </Card>
                    ) : (
                        <>
                            {availableSamples.map((sample) => (
                                <Card
                                    key={sample.item_code}
                                    className="p-4 rounded-xl border border-slate-200 hover:shadow-md transition-all"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
                                                <Package className="w-5 h-5 text-orange-600" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-sm text-slate-800">{sample.item_name}</h3>
                                                <p className="text-xs text-slate-500">{sample.item_code}</p>
                                            </div>
                                        </div>
                                        <div className="text-left">
                                            <div className="text-lg font-bold text-orange-600">{sample.total_remaining}</div>
                                            <div className="text-[10px] text-slate-500">{isNaN(sample.total_allocated as any) ? '' : `${sample.total_distributed}/${sample.total_allocated}`}</div>
                                        </div>
                                    </div>
                                </Card>
                            ))}

                            <Button
                                className="w-full mt-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl py-6 text-base font-bold"
                                onClick={() => setActiveView("distribute")}
                            >
                                <Send className="w-5 h-5 ml-2" />
                                {t('sr.samples.distribute_cta')}
                            </Button>
                        </>
                    )}
                </div>
            )}

            {/* ─── Distribute View ─── */}
            {!loading && activeView === "distribute" && (
                <div className="px-4 py-4 space-y-4">
                    {availableSamples.length === 0 ? (
                        <Card className="p-8 text-center">
                            <Package className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                            <p className="text-slate-500 font-medium">{t('sr.samples.empty_distribute')}</p>
                        </Card>
                    ) : (
                        <>
                            {/* Step 1: Select Customer */}
                            <Card className="p-4 rounded-xl border border-slate-200">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                                    <h3 className="font-bold text-sm">{t('sr.samples.select_customer')}</h3>
                                </div>

                                {selectedCustomer ? (
                                    <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <User className="w-4 h-4 text-blue-600" />
                                            <div>
                                                <p className="font-bold text-sm">{selectedCustomer.customer_name}</p>
                                                <p className="text-xs text-slate-500">{selectedCustomer.name}</p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => { setSelectedCustomer(null); setShowCustomerPicker(true) }}
                                            className="text-blue-600"
                                        >
                                            {t('sr.samples.change')}
                                        </Button>
                                    </div>
                                ) : (
                                    <Button
                                        variant="outline"
                                        className="w-full rounded-lg border-dashed border-2 py-6"
                                        onClick={() => setShowCustomerPicker(true)}
                                    >
                                        <Search className="w-4 h-4 ml-2" />
                                        {t('sr.samples.search_customer')}
                                    </Button>
                                )}
                            </Card>

                            {/* Step 2: Select Items */}
                            <Card className="p-4 rounded-xl border border-slate-200">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-7 h-7 bg-orange-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                                    <h3 className="font-bold text-sm">{t('sr.samples.select_items')}</h3>
                                </div>

                                <div className="space-y-2">
                                    {availableSamples.map((sample) => {
                                        const selected = selectedItems.get(sample.item_code)
                                        const isSelected = !!selected

                                        return (
                                            <div
                                                key={sample.item_code}
                                                className={`p-3 rounded-lg border transition-all ${isSelected ? "border-orange-300 bg-orange-50" : "border-slate-200"
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2 flex-1">
                                                        <Package className="w-4 h-4 text-slate-400" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-sm truncate">{sample.item_name}</p>
                                                            <p className="text-[10px] text-slate-500">
                                                                {t('sr.common.remaining').replace('{value}', String(sample.total_remaining))}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {isSelected ? (
                                                        <div className="flex items-center gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="icon"
                                                                className="h-7 w-7 rounded-full"
                                                                onClick={() => updateItemQty(sample.item_code, -1)}
                                                            >
                                                                <Minus className="w-3 h-3" />
                                                            </Button>
                                                            <span className="w-8 text-center font-bold text-sm">
                                                                {selected.qty}
                                                            </span>
                                                            <Button
                                                                variant="outline"
                                                                size="icon"
                                                                className="h-7 w-7 rounded-full"
                                                                onClick={() => updateItemQty(sample.item_code, 1)}
                                                            >
                                                                <Plus className="w-3 h-3" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-red-500"
                                                                onClick={() => removeItem(sample.item_code)}
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="text-orange-600 border-orange-300 hover:bg-orange-50"
                                                            onClick={() => addItem(sample)}
                                                        >
                                                            <Plus className="w-3 h-3 ml-1" />
                                                            {t('sr.samples.add')}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </Card>

                            {/* Step 3: Notes & Confirmation */}
                            <Card className="p-4 rounded-xl border border-slate-200">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-7 h-7 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                                    <h3 className="font-bold text-sm">{t('sr.samples.details_confirm')}</h3>
                                </div>

                                <div className="space-y-3">
                                    <Textarea
                                        placeholder={t('sr.samples.notes_placeholder')}
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        className="rounded-lg resize-none"
                                        rows={2}
                                    />

                                    <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                                        <Checkbox
                                            id="customer-confirm"
                                            checked={customerConfirmed}
                                            onCheckedChange={(v) => setCustomerConfirmed(!!v)}
                                        />
                                        <label htmlFor="customer-confirm" className="text-sm font-medium cursor-pointer">
                                            {t('sr.samples.customer_confirmed')}
                                        </label>
                                    </div>

                                    {gpsLocation && (
                                        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg">
                                            <MapPin className="w-3.5 h-3.5" />
                                            <span>
                                                {t('sr.samples.location').replace('{lat}', gpsLocation.lat.toFixed(5)).replace('{lng}', gpsLocation.lng.toFixed(5))}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </Card>

                            {/* Summary & Submit */}
                            {selectedItems.size > 0 && selectedCustomer && (
                                <Card className="p-4 rounded-xl border-2 border-orange-300 bg-orange-50">
                                    <h4 className="font-bold text-sm mb-2">{t('sr.samples.summary_title')}</h4>
                                    <div className="space-y-1 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">{t('sr.common.customer')}:</span>
                                            <span className="font-bold">{selectedCustomer.customer_name}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">{t('sr.samples.items_count_label')}</span>
                                            <span className="font-bold">{selectedItems.size}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">{t('sr.samples.total_qty_label')}</span>
                                            <span className="font-bold text-orange-600">{totalSelectedQty}</span>
                                        </div>
                                    </div>

                                    <Button
                                        className="w-full mt-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl py-5 text-base font-bold"
                                        onClick={() => setShowConfirmDialog(true)}
                                        disabled={submitting}
                                    >
                                        {submitting ? (
                                            <Loader2 className="w-5 h-5 animate-spin ml-2" />
                                        ) : (
                                            <Send className="w-5 h-5 ml-2" />
                                        )}
                                        {t('sr.samples.confirm_distribution')}
                                    </Button>
                                </Card>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* ─── History View ─── */}
            {!loading && activeView === "history" && (
                <div className="px-4 py-4 space-y-3">
                    {distributionHistory.length === 0 ? (
                        <Card className="p-8 text-center">
                            <History className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                            <p className="text-slate-500 font-medium">{t('sr.samples.empty_history')}</p>
                        </Card>
                    ) : (
                        distributionHistory.map((dist) => {
                            const isExpanded = expandedHistory === dist.name
                            const date = new Date(dist.distribution_date)
                            const formattedDate = date.toLocaleDateString(dl, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                            })
                            const formattedTime = date.toLocaleTimeString(dl, {
                                hour: "2-digit",
                                minute: "2-digit",
                            })

                            return (
                                <Card
                                    key={dist.name}
                                    className="rounded-xl border border-slate-200 overflow-hidden"
                                >
                                    <button
                                        className="w-full p-4 flex items-center justify-between text-right"
                                        onClick={() => setExpandedHistory(isExpanded ? null : dist.name)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${dist.status === "Completed" ? "bg-green-50" : "bg-red-50"
                                                }`}>
                                                {dist.status === "Completed" ? (
                                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                                ) : (
                                                    <X className="w-5 h-5 text-red-600" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm">{dist.customer_name || dist.customer}</p>
                                                <p className="text-xs text-slate-500">
                                                    {formattedDate} • {formattedTime}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant={dist.customer_confirmed ? "default" : "secondary"} className="text-[10px]">
                                                {dist.customer_confirmed ? t('sr.samples.confirmed') : t('sr.samples.unconfirmed')}
                                            </Badge>
                                            <Badge className="bg-orange-100 text-orange-700 border-0">
                                                {t('sr.common.units_count').replace('{n}', String(dist.total_qty))}
                                            </Badge>
                                            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div className="px-4 pb-4 border-t border-slate-100 pt-3">
                                            <div className="space-y-2">
                                                {dist.items?.map((item, idx) => (
                                                    <div key={idx} className="flex items-center justify-between text-sm bg-slate-50 p-2 rounded-lg">
                                                        <div className="flex items-center gap-2">
                                                            <Package className="w-3.5 h-3.5 text-slate-400" />
                                                            <span>{item.item_name || item.item_code}</span>
                                                        </div>
                                                        <span className="font-bold">
                                                            {item.qty} {item.uom || ""}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                            {dist.notes && (
                                                <p className="text-xs text-slate-500 mt-2 bg-slate-50 p-2 rounded-lg">
                                                    📝 {dist.notes}
                                                </p>
                                            )}
                                            {(dist.gps_latitude && dist.gps_longitude) ? (
                                                <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-2">
                                                    <MapPin className="w-3 h-3" />
                                                    {dist.gps_latitude?.toFixed(5)}, {dist.gps_longitude?.toFixed(5)}
                                                </div>
                                            ) : null}
                                            <div className="text-[10px] text-slate-400 mt-1">{dist.name}</div>
                                        </div>
                                    )}
                                </Card>
                            )
                        })
                    )}
                </div>
            )}

            {/* ─── Customer Picker Dialog ─── */}
            <Dialog open={showCustomerPicker} onOpenChange={setShowCustomerPicker}>
                <DialogContent className="max-w-md max-h-[80vh]" dir={dir}>
                    <DialogHeader>
                        <DialogTitle>{t('sr.samples.select_customer')}</DialogTitle>
                        <DialogDescription>{t('sr.samples.picker_desc')}</DialogDescription>
                    </DialogHeader>

                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder={t('sr.samples.picker_placeholder')}
                            value={customerSearch}
                            onChange={(e) => setCustomerSearch(e.target.value)}
                            className="pr-9 rounded-lg"
                            autoFocus
                        />
                    </div>

                    <div className="max-h-[50vh] overflow-y-auto space-y-1">
                        {filteredCustomers.slice(0, 50).map((c) => (
                            <button
                                key={c.name}
                                className="w-full p-3 text-right rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-3"
                                onClick={() => {
                                    setSelectedCustomer(c)
                                    setShowCustomerPicker(false)
                                    setCustomerSearch("")
                                }}
                            >
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                    <User className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                    <p className="font-bold text-sm">{c.customer_name}</p>
                                    <p className="text-xs text-slate-500">{c.name}</p>
                                </div>
                            </button>
                        ))}
                        {filteredCustomers.length === 0 && (
                            <p className="text-center text-sm text-slate-500 py-4">{t('sr.samples.no_results')}</p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* ─── Confirmation Dialog ─── */}
            <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <DialogContent className="max-w-sm" dir={dir}>
                    <DialogHeader>
                        <DialogTitle>{t('sr.samples.confirm_distribution')}</DialogTitle>
                        <DialogDescription>
                            {t('sr.samples.confirm_question')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-slate-600">{t('sr.common.customer')}:</span>
                            <span className="font-bold">{selectedCustomer?.customer_name}</span>
                        </div>
                        {Array.from(selectedItems.entries()).map(([code, info]) => (
                            <div key={code} className="flex justify-between bg-slate-50 p-2 rounded-lg">
                                <span>{info.item_name}</span>
                                <span className="font-bold">{info.qty} {info.uom}</span>
                            </div>
                        ))}
                        <div className="flex justify-between font-bold pt-2 border-t">
                            <span>{t('sr.samples.total_label')}</span>
                            <span className="text-orange-600">{t('sr.common.units_count').replace('{n}', String(totalSelectedQty))}</span>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
                            {t('sr.common.cancel')}
                        </Button>
                        <Button
                            className="bg-orange-600 hover:bg-orange-700 text-white"
                            onClick={handleDistribute}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <Loader2 className="w-4 h-4 animate-spin ml-1" />
                            ) : (
                                <CheckCircle2 className="w-4 h-4 ml-1" />
                            )}
                            {t('sr.common.confirm')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
