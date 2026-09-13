"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Package, FileText, Clock, Loader2, AlertCircle,
  RefreshCw, ChevronDown, ChevronUp, CheckCircle2,
  XCircle, Eye, Receipt,
} from "lucide-react"
import { useSalesRep } from "@/contexts/SalesRepContext"
import { salesApi, type SalesPersonVisit } from "@/lib/sales-api"
import { frappeClient } from "@/lib/api-client"
import { useI18n } from "@/lib/i18n"
import { displayLocale } from '@/lib/sales-format'

interface SalesOrder {
  name: string
  customer: string
  customer_name?: string
  transaction_date: string
  grand_total: number
  status: string
  docstatus: number
}

interface SalesInvoice {
  name: string
  customer: string
  customer_name?: string
  posting_date: string
  grand_total: number
  outstanding_amount?: number
  status: string
  docstatus: number
}

export default function OrderHistoryPage() {
  const { salesPerson, customers } = useSalesRep()
  const { t, lang } = useI18n()
  const dl = displayLocale(lang)

  const SO_STATUS_MAP: Record<string, { label: string; color: string }> = {
    Draft: { label: t('sr.orders.status.draft'), color: "bg-slate-100 text-slate-600" },
    "To Deliver and Bill": { label: t('sr.orders.status.to_deliver_and_bill'), color: "bg-amber-100 text-amber-700" },
    "To Bill": { label: t('sr.orders.status.to_bill'), color: "bg-blue-100 text-blue-700" },
    "To Deliver": { label: t('sr.orders.status.to_deliver'), color: "bg-orange-100 text-orange-700" },
    Completed: { label: t('sr.common.status_completed'), color: "bg-emerald-100 text-emerald-700" },
    Cancelled: { label: t('sr.orders.status.cancelled'), color: "bg-red-100 text-red-600" },
    Closed: { label: t('sr.orders.status.closed'), color: "bg-slate-100 text-slate-600" },
  }

  const SI_STATUS_MAP: Record<string, { label: string; color: string }> = {
    Draft: { label: t('sr.orders.status.draft'), color: "bg-slate-100 text-slate-600" },
    Unpaid: { label: t('sr.orders.status.unpaid'), color: "bg-red-100 text-red-600" },
    Paid: { label: t('sr.orders.status.paid'), color: "bg-emerald-100 text-emerald-700" },
    "Partly Paid": { label: t('sr.orders.status.partly_paid'), color: "bg-amber-100 text-amber-700" },
    Overdue: { label: t('sr.orders.status.overdue'), color: "bg-red-100 text-red-700" },
    Cancelled: { label: t('sr.orders.status.cancelled'), color: "bg-red-100 text-red-600" },
    "Return": { label: t('sr.orders.status.return'), color: "bg-orange-100 text-orange-700" },
  }

  // Helper to resolve customer name from context
  const getCustomerName = (customerId: string) =>
    customers.find(c => c.name === customerId)?.customer_name || customerId

  const [activeTab, setActiveTab] = useState<"orders" | "invoices" | "visits">("orders")
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([])
  const [invoices, setInvoices] = useState<SalesInvoice[]>([])
  const [visits, setVisits] = useState<SalesPersonVisit[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedItem, setExpandedItem] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!salesPerson) return
    setLoading(true)

    try {
      // Build customer name list for filtering orders/invoices
      const customerNames = customers.map((c) => c.name)

      const [soData, siData, visitData] = await Promise.all([
        // Filter by customers assigned to this sales rep (avoids child table filter issue)
        customerNames.length > 0
          ? frappeClient.call("frappe.client.get_list", {
              doctype: "Sales Order",
              filters: [["Sales Order", "customer", "in", customerNames]],
              fields: ["name", "customer", "customer_name", "transaction_date", "grand_total", "status", "docstatus"],
              order_by: "transaction_date desc",
              limit_page_length: 50,
            }).then((r: any) => r?.message || []).catch(() => [])
          : Promise.resolve([]),

        customerNames.length > 0
          ? frappeClient.call("frappe.client.get_list", {
              doctype: "Sales Invoice",
              filters: [["Sales Invoice", "customer", "in", customerNames]],
              fields: ["name", "customer", "customer_name", "posting_date", "grand_total", "outstanding_amount", "status", "docstatus"],
              order_by: "posting_date desc",
              limit_page_length: 50,
            }).then((r: any) => r?.message || []).catch(() => [])
          : Promise.resolve([]),

        salesApi.getVisits({
          filters: [
            ["Sales Person Visit", "sales_person", "=", salesPerson.name],
          ],
        }).catch(() => []),
      ])

      setSalesOrders(soData as SalesOrder[])
      setInvoices(siData as SalesInvoice[])
      setVisits(visitData)
    } finally {
      setLoading(false)
    }
  }, [salesPerson, customers])

  useEffect(() => {
    loadData()
  }, [loadData])

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(dl, {
      style: "currency",
      currency: "SAR",
      minimumFractionDigits: 2,
    }).format(amount)

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString(dl, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white pb-6 px-5 rounded-b-[2rem]">
        <div className="pt-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold">{t('sr.orders.title')}</h1>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={loadData}
              disabled={loading}
            >
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3 text-center border border-white/20">
              <div className="text-xl font-bold">{salesOrders.length}</div>
              <div className="text-[10px] text-blue-200">{t('sr.orders.stat_order')}</div>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3 text-center border border-white/20">
              <div className="text-xl font-bold">{invoices.length}</div>
              <div className="text-[10px] text-blue-200">{t('sr.orders.stat_invoice')}</div>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3 text-center border border-white/20">
              <div className="text-xl font-bold">{visits.length}</div>
              <div className="text-[10px] text-blue-200">{t('sr.common.visit_unit')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-5">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-3 mb-5 bg-white p-1.5 rounded-2xl h-14 shadow-sm border border-slate-200">
            <TabsTrigger
              value="orders"
              className="rounded-xl text-xs font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <Package className="w-3.5 h-3.5 ml-1" />
              {t('sr.orders.tab_orders')}
            </TabsTrigger>
            <TabsTrigger
              value="invoices"
              className="rounded-xl text-xs font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <Receipt className="w-3.5 h-3.5 ml-1" />
              {t('sr.orders.tab_invoices')}
            </TabsTrigger>
            <TabsTrigger
              value="visits"
              className="rounded-xl text-xs font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <Clock className="w-3.5 h-3.5 ml-1" />
              {t('sr.orders.tab_visits')}
            </TabsTrigger>
          </TabsList>

          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
              <p className="text-muted-foreground">{t('sr.common.loading')}</p>
            </div>
          ) : (
            <>
              {/* Sales Orders */}
              <TabsContent value="orders" className="space-y-3 mt-4">
                {salesOrders.length === 0 ? (
                  <Card className="p-12 text-center">
                    <Package className="w-16 h-16 mx-auto text-muted-foreground/40 mb-4" />
                    <h3 className="text-lg font-bold mb-2">{t('sr.common.no_orders')}</h3>
                    <p className="text-sm text-muted-foreground">{t('sr.orders.empty_orders_desc')}</p>
                  </Card>
                ) : (
                  salesOrders.map((so) => {
                    const statusInfo = SO_STATUS_MAP[so.status] || { label: so.status, color: "bg-slate-100 text-slate-600" }
                    return (
                      <Card key={so.name} className="p-4 border border-slate-200 rounded-2xl">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-500 font-mono" dir="ltr">{so.name}</p>
                            <h3 className="font-bold text-base truncate mt-1">
                              {so.customer_name || so.customer}
                            </h3>
                          </div>
                          <Badge className={`${statusInfo.color} text-xs`}>
                            {statusInfo.label}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                          <span className="text-xs text-slate-500">
                            {formatDate(so.transaction_date)}
                          </span>
                          <span className="font-bold text-blue-600">
                            {formatCurrency(so.grand_total)}
                          </span>
                        </div>
                      </Card>
                    )
                  })
                )}
              </TabsContent>

              {/* Sales Invoices */}
              <TabsContent value="invoices" className="space-y-3 mt-4">
                {invoices.length === 0 ? (
                  <Card className="p-12 text-center">
                    <Receipt className="w-16 h-16 mx-auto text-muted-foreground/40 mb-4" />
                    <h3 className="text-lg font-bold mb-2">{t('sr.orders.empty_invoices')}</h3>
                    <p className="text-sm text-muted-foreground">{t('sr.orders.empty_invoices_desc')}</p>
                  </Card>
                ) : (
                  invoices.map((si) => {
                    const statusInfo = SI_STATUS_MAP[si.status] || { label: si.status, color: "bg-slate-100 text-slate-600" }
                    return (
                      <Card key={si.name} className="p-4 border border-slate-200 rounded-2xl">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-500 font-mono" dir="ltr">{si.name}</p>
                            <h3 className="font-bold text-base truncate mt-1">
                              {si.customer_name || si.customer}
                            </h3>
                          </div>
                          <Badge className={`${statusInfo.color} text-xs`}>
                            {statusInfo.label}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                          <span className="text-xs text-slate-500">
                            {formatDate(si.posting_date)}
                          </span>
                          <div className="text-left">
                            <span className="font-bold text-blue-600 block">
                              {formatCurrency(si.grand_total)}
                            </span>
                            {si.outstanding_amount && si.outstanding_amount > 0 && (
                              <span className="text-[10px] text-red-500">
                                {t('sr.common.remaining').replace('{value}', formatCurrency(si.outstanding_amount))}
                              </span>
                            )}
                          </div>
                        </div>
                      </Card>
                    )
                  })
                )}
              </TabsContent>

              {/* Visits */}
              <TabsContent value="visits" className="space-y-3 mt-4">
                {visits.length === 0 ? (
                  <Card className="p-12 text-center">
                    <Clock className="w-16 h-16 mx-auto text-muted-foreground/40 mb-4" />
                    <h3 className="text-lg font-bold mb-2">{t('sr.orders.empty_visits')}</h3>
                    <p className="text-sm text-muted-foreground">{t('sr.orders.empty_visits_desc')}</p>
                  </Card>
                ) : (
                  visits.map((visit) => {
                    const isCompleted = visit.visit_status === "Completed"
                    return (
                      <Card key={visit.name} className="p-4 border border-slate-200 rounded-2xl">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-base truncate">
                              {visit.customer_name || getCustomerName(visit.customer)}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                              {formatDate(visit.visit_date)}
                            </p>
                          </div>
                          <Badge
                            className={
                              isCompleted
                                ? "bg-emerald-100 text-emerald-700"
                                : visit.visit_status === "In Progress"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-slate-100 text-slate-600"
                            }
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="w-3 h-3 ml-1" />
                            ) : (
                              <Clock className="w-3 h-3 ml-1" />
                            )}
                            {visit.visit_status === "Completed"
                              ? t('sr.common.completed_fem')
                              : visit.visit_status === "In Progress"
                              ? t('sr.orders.visit_status.in_progress')
                              : visit.visit_status === "Cancelled"
                              ? t('sr.orders.visit_status.cancelled')
                              : t('sr.orders.visit_status.scheduled')}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-2">
                          {visit.check_in_time && (
                            <span>{t('sr.orders.visit_checkin').replace('{time}', visit.check_in_time.split(" ")[1]?.slice(0, 5) || '')}</span>
                          )}
                          {visit.check_out_time && (
                            <span>{t('sr.orders.visit_checkout').replace('{time}', visit.check_out_time.split(" ")[1]?.slice(0, 5) || '')}</span>
                          )}
                          {visit.visit_duration && visit.visit_duration > 0 && (
                            <span>⏱️ {t('sr.orders.visit_duration').replace('{n}', String(visit.visit_duration))}</span>
                          )}
                          {visit.has_order === 1 && (
                            <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">
                              {t('sr.orders.stat_order')}
                            </Badge>
                          )}
                        </div>
                      </Card>
                    )
                  })
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  )
}
