"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ArrowLeftRight, Loader2, AlertCircle, RefreshCw,
  CheckCircle2, Plus, Minus, Package, Clock,
  XCircle, ArrowRight, Warehouse as WarehouseIcon,
} from "lucide-react"
import { useSalesRep } from "@/contexts/SalesRepContext"
import { stockApi, type StockTransferRequest, type Warehouse } from "@/lib/stock-api"
import { frappeImageUrl } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"
import { displayLocale } from '@/lib/sales-format'

export default function StockRequestsPage() {
  const { salesPerson, warehouse, repStock, items } = useSalesRep()
  const { t, lang } = useI18n()
  const dl = displayLocale(lang)

  const [activeView, setActiveView] = useState<"list" | "new">("list")
  const [requests, setRequests] = useState<StockTransferRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Available source warehouses
  const [availableWarehouses, setAvailableWarehouses] = useState<Warehouse[]>([])
  const [selectedFromWarehouse, setSelectedFromWarehouse] = useState<string>("")
  const [loadingWarehouses, setLoadingWarehouses] = useState(false)

  // New request form
  const [requestItems, setRequestItems] = useState<Map<string, number>>(new Map())

  const loadRequests = useCallback(async () => {
    if (!salesPerson) return
    setLoading(true)
    try {
      const data = await stockApi.getTransferRequests({
        filters: [
          ["Stock Transfer Request", "sales_person", "=", salesPerson.name],
        ],
        order_by: "creation desc",
        limit_page_length: 30,
      })
      setRequests(data)
    } catch {
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [salesPerson])

  const loadWarehouses = useCallback(async () => {
    if (!warehouse) return
    setLoadingWarehouses(true)
    try {
      // getWarehouses already filters is_group=0 and disabled=0
      const whs = await stockApi.getWarehouses()
      // Exclude the rep's own van warehouse
      const filtered = whs.filter(w => w.name !== warehouse)
      setAvailableWarehouses(filtered)
      // Auto-select a sensible default: prefer Main type, then stores/مخزن/main
      if (filtered.length > 0 && !selectedFromWarehouse) {
        const mainType = filtered.find(w => w.custom_warehouse_type === 'Main')
        const preferred = filtered.find(w =>
          w.name.toLowerCase().includes('store') ||
          w.name.includes('مخزن') ||
          w.name.toLowerCase().includes('main')
        )
        setSelectedFromWarehouse(mainType?.name || preferred?.name || filtered[0]?.name || '')
      }
    } catch {
      setAvailableWarehouses([])
    } finally {
      setLoadingWarehouses(false)
    }
  }, [warehouse, selectedFromWarehouse])

  useEffect(() => {
    loadRequests()
    loadWarehouses()
  }, [loadRequests, loadWarehouses])

  const getItemDetails = (itemCode: string) =>
    items.find((i) => i.name === itemCode)

  const getCurrentStock = (itemCode: string) =>
    repStock.find((s) => s.item_code === itemCode)?.actual_qty || 0

  const updateRequestQty = (itemCode: string, delta: number) => {
    setRequestItems((prev) => {
      const newMap = new Map(prev)
      const current = newMap.get(itemCode) || 0
      const next = Math.max(0, current + delta)
      if (next === 0) {
        newMap.delete(itemCode)
      } else {
        newMap.set(itemCode, next)
      }
      return newMap
    })
  }

  const setRequestQty = (itemCode: string, qty: number) => {
    setRequestItems((prev) => {
      const newMap = new Map(prev)
      if (qty <= 0) {
        newMap.delete(itemCode)
      } else {
        newMap.set(itemCode, qty)
      }
      return newMap
    })
  }

  const handleSubmitRequest = async () => {
    if (!salesPerson || !warehouse || requestItems.size === 0) return

    if (!selectedFromWarehouse) {
      setError(t('sr.stockreq.err_select_source'))
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await stockApi.createTransferRequest({
        from_warehouse: selectedFromWarehouse,
        to_warehouse: warehouse,
        sales_person: salesPerson.name,
        items: Array.from(requestItems.entries()).map(([item_code, qty]) => ({
          item_code,
          requested_qty: qty,
        })),
      })

      setSuccess(t('sr.stockreq.success_sent'))
      setRequestItems(new Map())
      setActiveView("list")
      loadRequests()
    } catch (err: any) {
      console.error("[StockRequest] Failed:", err)
      setError(err?.message || t('sr.stockreq.err_send'))
    } finally {
      setSubmitting(false)
    }
  }

  const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
    Pending: { label: t('sr.stockreq.status.pending'), color: "bg-amber-100 text-amber-700", icon: Clock },
    Accepted: { label: t('sr.stockreq.status.accepted'), color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
    "Partially Accepted": { label: t('sr.stockreq.status.partially_accepted'), color: "bg-blue-100 text-blue-700", icon: CheckCircle2 },
    Rejected: { label: t('sr.stockreq.status.rejected'), color: "bg-red-100 text-red-600", icon: XCircle },
    Completed: { label: t('sr.common.status_completed'), color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-violet-600 via-violet-700 to-purple-800 text-white pb-6 px-5 rounded-b-[2rem]">
        <div className="pt-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ArrowLeftRight className="w-6 h-6" />
              {t('sr.stockreq.title')}
            </h1>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={loadRequests}
              >
                <RefreshCw className="w-5 h-5" />
              </Button>
            </div>
          </div>
          <p className="text-violet-200 text-sm">
            {warehouse ? `${t('sr.common.warehouse')}: ${warehouse}` : t('sr.stockreq.no_warehouse')}
          </p>
        </div>
      </div>

      <div className="px-4 py-5 space-y-4">
        {error && (
          <Card className="p-4 bg-red-50 border-red-200">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <p className="text-sm">{error}</p>
            </div>
          </Card>
        )}

        {success && (
          <Card className="p-4 bg-emerald-50 border-emerald-200">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
              <p className="text-sm">{success}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-emerald-600"
              onClick={() => setSuccess(null)}
            >
              {t('sr.stockreq.close')}
            </Button>
          </Card>
        )}

        {/* Toggle between list and new */}
        <div className="flex gap-2">
          <Button
            variant={activeView === "list" ? "default" : "outline"}
            className={`flex-1 rounded-xl h-11 ${
              activeView === "list" ? "bg-violet-600 hover:bg-violet-700" : "bg-transparent"
            }`}
            onClick={() => setActiveView("list")}
          >
            <Clock className="w-4 h-4 ml-1" />
            {t('sr.stockreq.tab_previous')}
          </Button>
          <Button
            variant={activeView === "new" ? "default" : "outline"}
            className={`flex-1 rounded-xl h-11 ${
              activeView === "new" ? "bg-violet-600 hover:bg-violet-700" : "bg-transparent"
            }`}
            onClick={() => setActiveView("new")}
            disabled={!warehouse}
          >
            <Plus className="w-4 h-4 ml-1" />
            {t('sr.stockreq.new_request')}
          </Button>
        </div>

        {/* List view */}
        {activeView === "list" && (
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
                <p className="text-muted-foreground">{t('sr.common.loading')}</p>
              </div>
            ) : requests.length === 0 ? (
              <Card className="p-12 text-center">
                <ArrowLeftRight className="w-16 h-16 mx-auto text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-bold mb-2">{t('sr.common.no_orders.stockreq')}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('sr.stockreq.empty_desc')}
                </p>
                <Button
                  className="bg-violet-600 hover:bg-violet-700"
                  onClick={() => setActiveView("new")}
                  disabled={!warehouse}
                >
                  <Plus className="w-4 h-4 ml-1" />
                  {t('sr.stockreq.new_request')}
                </Button>
              </Card>
            ) : (
              requests.map((req) => {
                const statusInfo = STATUS_MAP[req.status] || STATUS_MAP.Pending
                const StatusIcon = statusInfo.icon
                return (
                  <Card key={req.name} className="p-4 border border-slate-200 rounded-2xl">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-xs text-slate-500 font-mono" dir="ltr">
                          {req.name}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(req.request_date).toLocaleDateString(dl)}
                        </p>
                      </div>
                      <Badge className={`${statusInfo.color} text-xs`}>
                        <StatusIcon className="w-3 h-3 ml-1" />
                        {statusInfo.label}
                      </Badge>
                    </div>

                    {req.items && req.items.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {req.items.map((item, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between text-sm bg-slate-50 px-3 py-2 rounded-lg"
                          >
                            <span className="truncate flex-1">
                              {item.item_name || item.item_code}
                            </span>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-bold">{item.requested_qty}</span>
                              {item.accepted_qty !== undefined && item.accepted_qty !== item.requested_qty && (
                                <span className="text-emerald-600">
                                  ← {item.accepted_qty}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {req.rejection_reason && (
                      <p className="text-xs text-red-500 mt-2 bg-red-50 px-3 py-2 rounded-lg">
                        {t('sr.stockreq.rejection_reason').replace('{reason}', req.rejection_reason)}
                      </p>
                    )}
                  </Card>
                )
              })
            )}
          </div>
        )}

        {/* New request view */}
        {activeView === "new" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              {t('sr.stockreq.new_intro')}
            </p>

            {/* Source Warehouse Picker */}
            <Card className="p-4 border-2 border-violet-200 bg-violet-50/30 rounded-2xl">
              <div className="flex items-center gap-2 mb-3">
                <WarehouseIcon className="w-5 h-5 text-violet-600" />
                <Label className="font-bold text-sm text-violet-900">{t('sr.stockreq.source_warehouse')}</Label>
              </div>
              {loadingWarehouses ? (
                <div className="flex items-center gap-2 py-2 text-sm text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" /> {t('sr.stockreq.loading_warehouses')}
                </div>
              ) : availableWarehouses.length === 0 ? (
                <p className="text-sm text-red-500">{t('sr.stockreq.no_warehouses')}</p>
              ) : (
                <Select value={selectedFromWarehouse} onValueChange={setSelectedFromWarehouse}>
                  <SelectTrigger aria-label={t('sr.stockreq.source_placeholder')} className="h-11 text-sm bg-white rounded-xl border-violet-200">
                    <SelectValue placeholder={t('sr.stockreq.source_placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableWarehouses.map(wh => (
                      <SelectItem key={wh.name} value={wh.name}>
                        <div className="flex items-center gap-2">
                          <span>{wh.warehouse_name || wh.name}</span>
                          {wh.custom_warehouse_type && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                              {wh.custom_warehouse_type}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                <ArrowRight className="w-3 h-3" />
                <span>{t('sr.stockreq.transfer_to').replace('{warehouse}', '')}<span className="font-bold text-slate-600">{warehouse}</span></span>
              </div>
            </Card>

            {/* Items list */}
            <div className="space-y-3">
              {items.map((item) => {
                const currentQty = getCurrentStock(item.name)
                const requestedQty = requestItems.get(item.name) || 0

                return (
                  <Card
                    key={item.name}
                    className={`p-4 border-2 rounded-2xl transition-all ${
                      requestedQty > 0
                        ? "border-violet-300 bg-violet-50/30"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {item.image && (
                        <img
                          src={frappeImageUrl(item.image)}
                          alt={item.item_name}
                          className="w-12 h-12 rounded-xl object-cover bg-muted flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm truncate">{item.item_name}</h4>
                        <p className="text-xs text-slate-500">{item.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {t('sr.stockreq.current_stock').replace('{n}', '')}
                          <span className={currentQty > 0 ? "text-emerald-600 font-bold" : "text-red-500 font-bold"}>
                            {currentQty}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="w-8 h-8 rounded-lg bg-transparent"
                          onClick={() => updateRequestQty(item.name, -1)}
                          disabled={requestedQty === 0}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <Input
                          type="number"
                          inputMode="numeric"
                          value={requestedQty || ""}
                          onChange={(e) => setRequestQty(item.name, parseInt(e.target.value) || 0)}
                          className="w-14 h-8 text-center text-sm rounded-lg"
                          dir="ltr"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="w-8 h-8 rounded-lg bg-transparent"
                          onClick={() => updateRequestQty(item.name, 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>

            {/* Summary and submit */}
            {requestItems.size > 0 && (
              <Card className="p-4 bg-violet-50 border-violet-200 rounded-2xl sticky bottom-24">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold">
                    {t('sr.stockreq.summary').replace('{n}', String(requestItems.size)).replace('{m}', String(Array.from(requestItems.values()).reduce((a, b) => a + b, 0)))}
                  </span>
                </div>
                <Button
                  className="w-full h-12 rounded-xl bg-violet-600 hover:bg-violet-700 font-bold"
                  onClick={handleSubmitRequest}
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin ml-2" />
                  ) : (
                    <ArrowLeftRight className="w-5 h-5 ml-2" />
                  )}
                  {submitting ? t('sr.stockreq.sending') : t('sr.stockreq.submit')}
                </Button>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
