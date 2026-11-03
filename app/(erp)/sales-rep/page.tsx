"use client"

import { useState, useEffect, useCallback } from "react"
import { useHiddenRepFeatures } from "@/lib/sales-rep-features"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  MapPin, Plus, Navigation, Clock, Package, History,
  RefreshCw, Loader2, User, AlertCircle, Route,
  CreditCard, ArrowLeftRight, CheckCircle2, ChevronLeft, CalendarPlus, Gift, Wallet,
} from "lucide-react"
import { ScheduleVisitDialog } from "@/components/sales/schedule-visit-dialog"
import Link from "next/link"
import { useSalesRep } from "@/contexts/SalesRepContext"
import { useAuth } from "@/lib/auth-context"
import { frappeImageUrl } from "@/lib/utils"
import {
  salesApi, type Customer, type DailyRoutePlan, type SalesPersonVisit, localDateISO,
  customerGroupLabel, customerClassification, customerClassificationLabel,
  customerClassificationBadgeClass, type CustomerClassification,
} from "@/lib/sales-api"
import { useI18n } from "@/lib/i18n"
import { displayLocale } from '@/lib/sales-format'

export default function SalesRepDashboard() {
  const { user } = useAuth()
  const { t, lang } = useI18n()
  const dl = displayLocale(lang)
  const {
    salesPerson, customers, items, repStock,
    loading, initialLoading, error,
    getSalesPersonName, refreshAll,
  } = useSalesRep()
  const hiddenFeatures = useHiddenRepFeatures()

  const [activeTab, setActiveTab] = useState<"customers" | "inventory">("customers")
  const [classificationFilter, setClassificationFilter] = useState<CustomerClassification | 'all'>('all')
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [routePlan, setRoutePlan] = useState<DailyRoutePlan | null>(null)
  const [todayVisits, setTodayVisits] = useState<SalesPersonVisit[]>([])
  const [activeVisit, setActiveVisit] = useState<SalesPersonVisit | null>(null)
  const [showScheduleDialog, setShowScheduleDialog] = useState(false)

  const today = localDateISO()

  // Load route plan and today's visits
  useEffect(() => {
    if (!salesPerson) return
    let cancelled = false

    async function loadTodayData() {
      try {
        const [plans, visits] = await Promise.all([
          salesApi.getRoutePlans({
            filters: [
              ["Daily Route Plan", "sales_person", "=", salesPerson!.name],
              ["Daily Route Plan", "route_date", "=", today],
            ],
          }).catch(() => []),
          salesApi.getVisits({
            filters: [
              ["Sales Person Visit", "sales_person", "=", salesPerson!.name],
              ["Sales Person Visit", "visit_date", "=", today],
            ],
          }).catch(() => []),
        ])

        if (cancelled) return

        if (plans.length > 0) {
          const full = await salesApi.getRoutePlan(plans[0].name).catch(() => null)
          setRoutePlan(full)
        }

        setTodayVisits(visits)
        // Check for active (in-progress) visit
        const active = visits.find((v) => v.visit_status === "In Progress")
        setActiveVisit(active || null)
      } catch {
        // ignore
      }
    }

    loadTodayData()
    return () => { cancelled = true }
  }, [salesPerson, today])

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => { }
      )
    }
  }, [])

  const getDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  const getCustomerDistance = (c: Customer): number | null => {
    if (!userLocation || !c.customer_lat || !c.customer_lng) return null
    const lat = parseFloat(c.customer_lat)
    const lng = parseFloat(c.customer_lng)
    if (isNaN(lat) || isNaN(lng)) return null
    return Math.round(getDistance(userLocation.lat, userLocation.lng, lat, lng) * 10) / 10
  }

  const visibleCustomers = classificationFilter === 'all'
    ? customers
    : customers.filter(c => customerClassification(c) === classificationFilter)

  const sortedCustomers = [...visibleCustomers].sort((a, b) => {
    const dA = getCustomerDistance(a)
    const dB = getCustomerDistance(b)
    if (dA === null && dB === null) return 0
    if (dA === null) return 1
    if (dB === null) return -1
    return dA - dB
  })

  const totalStock = repStock.reduce((sum, s) => sum + (Number(s.actual_qty) || 0), 0)

  // Helper to find item details from items catalog
  const getItemDetails = (itemCode: string) => items.find(i => i.name === itemCode)

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-3" />
          <p className="text-muted-foreground">{t('sr.home.loading_data')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">{t('sr.common.error')}</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <p className="text-xs text-muted-foreground/60 mb-6 font-mono direction-ltr" dir="ltr">
            {user?.email || "—"}
          </p>
          <Button onClick={() => window.location.reload()} variant="outline" className="bg-transparent">
            <RefreshCw className="w-4 h-4 ml-2" />
            {t('sr.home.retry')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white pb-8 px-5 rounded-b-[2rem]">
        <div className="pt-8 md:pt-10">
          <div className="flex items-center justify-between mb-6">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold mb-1 truncate">{t('sr.home.greeting').replace('{name}', getSalesPersonName())}</h1>
              <p className="text-blue-100 flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                {userLocation ? t('sr.home.location_found') : t('sr.home.locating')}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={() => refreshAll()}
                disabled={loading}
              >
                <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-3 text-center border border-white/20">
                <div className="text-2xl font-bold">{customers.length}</div>
                <div className="text-xs text-blue-100">{t('sr.home.customers_unit')}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Link href="/sales-rep/new-order">
              <Button
                size="lg"
                className="w-full bg-white text-blue-700 hover:bg-blue-50 font-bold text-sm py-5 rounded-2xl shadow-lg border-0"
              >
                <MapPin className="w-4 h-4 ml-2" />
                {t('sr.home.visit_customer')}
              </Button>
            </Link>
            <Link href="/sales-rep/new-order">
              <Button
                size="lg"
                className="w-full bg-white/15 backdrop-blur-sm text-white hover:bg-white/25 font-bold text-sm py-5 rounded-2xl border border-white/30"
              >
                <Plus className="w-4 h-4 ml-2" />
                {t('sr.common.new_customer')}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Active Visit Banner */}
      {activeVisit && (
        <div className="px-4 -mt-4 mb-2 relative z-10">
          <Link href={`/sales-rep/new-order?customerId=${encodeURIComponent(activeVisit.customer)}`}>
            <Card className="p-3 bg-blue-600 text-white border-0 rounded-2xl shadow-lg ring-2 ring-white/40 ring-offset-2 ring-offset-blue-600">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold">{t('sr.home.active_visit')}</p>
                  <p className="text-xs text-blue-200">{activeVisit.customer_name || activeVisit.customer}</p>
                </div>
                <ChevronLeft className="w-5 h-5 text-white/60" />
              </div>
            </Card>
          </Link>
        </div>
      )}

      {/* Route Plan Summary */}
      {routePlan && (routePlan.customers?.length || 0) > 0 && (
        <div className="px-4 pt-3">
          <Link href="/sales-rep/route-plan">
            <Card className="p-4 bg-gradient-to-l from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                    <Route className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">{t('sr.route.title')}</h3>
                    <p className="text-xs text-slate-500">
                      {t('sr.home.visits_progress')
                        .replace('{done}', String(todayVisits.filter((v) => v.visit_status === "Completed").length))
                        .replace('{total}', String(routePlan.customers?.length || 0))}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                    <span className="text-white text-sm font-bold">
                      {Math.round(
                        ((todayVisits.filter((v) => v.visit_status === "Completed").length) /
                          (routePlan.customers?.length || 1)) *
                        100
                      )}%
                    </span>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            </Card>
          </Link>
        </div>
      )}

      {/* Quick Actions */}
      <div className="px-4 pt-3">
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => setShowScheduleDialog(true)}>
            <Card className="p-3 text-center hover:shadow-md transition-all border border-slate-200 rounded-xl">
              <CalendarPlus className="w-5 h-5 mx-auto text-blue-600 mb-1" />
              <span className="text-[10px] font-medium text-slate-600">{t('sr.home.schedule_visit')}</span>
            </Card>
          </button>
          {!hiddenFeatures.has('payments') && (
          <Link href="/sales-rep/payments">
            <Card className="p-3 text-center hover:shadow-md transition-all border border-slate-200 rounded-xl">
              <CreditCard className="w-5 h-5 mx-auto text-emerald-600 mb-1" />
              <span className="text-[10px] font-medium text-slate-600">{t('sr.home.collect_payment')}</span>
            </Card>
          </Link>
          )}
          {!hiddenFeatures.has('samples') && (
          <Link href="/sales-rep/samples">
            <Card className="p-3 text-center hover:shadow-md transition-all border border-slate-200 rounded-xl">
              <Gift className="w-5 h-5 mx-auto text-orange-600 mb-1" />
              <span className="text-[10px] font-medium text-slate-600">{t('sr.home.samples')}</span>
            </Card>
          </Link>
          )}
          {!hiddenFeatures.has('wallet') && (
          <Link href="/sales-rep/wallet">
            <Card className="p-3 text-center hover:shadow-md transition-all border border-emerald-200 bg-emerald-50 rounded-xl">
              <Wallet className="w-5 h-5 mx-auto text-emerald-700 mb-1" />
              <span className="text-[10px] font-medium text-emerald-700">{t('sr.nav.wallet')}</span>
            </Card>
          </Link>
          )}
          <Link href="/sales-rep/stock-requests">
            <Card className="p-3 text-center hover:shadow-md transition-all border border-slate-200 rounded-xl">
              <ArrowLeftRight className="w-5 h-5 mx-auto text-violet-600 mb-1" />
              <span className="text-[10px] font-medium text-slate-600">{t('sr.home.stock_request')}</span>
            </Card>
          </Link>
          <Link href="/sales-rep/order-history">
            <Card className="p-3 text-center hover:shadow-md transition-all border border-slate-200 rounded-xl">
              <History className="w-5 h-5 mx-auto text-blue-600 mb-1" />
              <span className="text-[10px] font-medium text-slate-600">{t('sr.nav.orders')}</span>
            </Card>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 md:px-6 py-5">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "customers" | "inventory")} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-5 bg-white p-1.5 rounded-2xl h-14 shadow-sm border border-slate-200">
            <TabsTrigger
              value="customers"
              className="rounded-xl text-sm font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              <MapPin className="w-4 h-4 ml-2" />
              {t('sr.home.customers')}
            </TabsTrigger>
            <TabsTrigger
              value="inventory"
              className="rounded-xl text-sm font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              <Package className="w-4 h-4 ml-2" />
              {t('sr.home.my_inventory')}
            </TabsTrigger>
          </TabsList>

          {/* Customers Tab */}
          <TabsContent value="customers" className="space-y-4 mt-4">
            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
                <p className="text-muted-foreground">{t('sr.home.loading_customers')}</p>
              </div>
            ) : customers.length === 0 ? (
              <Card className="p-12 text-center">
                <User className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-xl font-bold mb-2">{t('sr.home.no_customers_title')}</h3>
                <p className="text-muted-foreground">{t('sr.home.no_customers_desc')}</p>
              </Card>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-slate-800">
                    {userLocation ? t('sr.home.customers_nearby') : t('sr.home.customers')}
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={() => {
                      navigator.geolocation?.getCurrentPosition(
                        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                        () => { }
                      )
                    }}
                  >
                    <Navigation className="w-4 h-4 ml-2" />
                    {t('sr.home.update_location')}
                  </Button>
                </div>

                {/* Classification filter chips */}
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  {(['all', 'Potential', 'Active', 'Dead'] as const).map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setClassificationFilter(v)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                        classificationFilter === v
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {v === 'all' ? t('sr.custclass.all') : customerClassificationLabel(t, v)}
                    </button>
                  ))}
                </div>

                {sortedCustomers.length === 0 && (
                  <Card className="p-8 text-center text-sm text-muted-foreground">
                    {t('sr.custclass.none_in_filter')}
                  </Card>
                )}

                {sortedCustomers.map((customer) => {
                  const distance = getCustomerDistance(customer)
                  return (
                    <Card
                      key={customer.name}
                      className="p-4 bg-white hover:shadow-lg transition-all duration-300 border border-slate-200 rounded-2xl"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h3 className="text-base font-bold text-slate-800 truncate">
                              {customer.customer_name}
                            </h3>
                            <Badge className={`text-xs ${customerClassificationBadgeClass(customerClassification(customer))}`}>
                              {customerClassificationLabel(t, customer.customer_classification)}
                            </Badge>
                            {customer.customer_group && (
                              <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100 text-xs">
                                {customerGroupLabel(t, customer.customer_group)}
                              </Badge>
                            )}
                          </div>
                          {customer.territory && (
                            <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate">{customer.territory}</span>
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                            {customer.last_visit_date && (
                              <div className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                <span>{t('sr.home.last_visit').replace('{date}', new Date(customer.last_visit_date).toLocaleDateString(dl))}</span>
                              </div>
                            )}
                            {customer.tax_id && (
                              <Badge variant="outline" className="text-xs">
                                {t('sr.home.tax_badge').replace('{taxId}', customer.tax_id)}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {distance !== null && (
                          <div className="text-center mr-3 flex-shrink-0">
                            <div className="bg-blue-50 rounded-2xl w-14 h-14 flex items-center justify-center">
                              <div>
                                <div className="text-lg font-bold text-blue-600">{distance}</div>
                                <div className="text-[10px] text-blue-500">{t('sr.home.km_unit')}</div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
                        <Link href={`/sales-rep/new-order?customerId=${encodeURIComponent(customer.name)}`} className="flex-1">
                          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11">
                            {t('sr.common.i_arrived')}
                          </Button>
                        </Link>
                        {customer.customer_inventory_tracked === 1 && (
                          <Link href={`/sales-rep/customer-inventory?customerId=${encodeURIComponent(customer.name)}`}>
                            <Button variant="outline" className="border-slate-200 hover:bg-slate-50 rounded-xl h-11 bg-transparent">
                              <Package className="w-4 h-4 ml-1" />
                              {t('sr.home.inventory_btn')}
                            </Button>
                          </Link>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </>
            )}
          </TabsContent>

          {/* Inventory Tab */}
          <TabsContent value="inventory" className="space-y-4 mt-6">
            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
                <p className="text-muted-foreground">{t('sr.home.loading_inventory')}</p>
              </div>
            ) : repStock.length === 0 ? (
              <Card className="p-12 text-center">
                <Package className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-xl font-bold mb-2">{t('sr.home.no_stock_title')}</h3>
                <p className="text-muted-foreground">{t('sr.home.no_stock_desc')}</p>
              </Card>
            ) : (
              <>
                {/* Inventory Stats */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <Card className="p-4 bg-primary/5 border-primary/30">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 p-3 rounded-xl">
                        <Package className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-primary">{totalStock}</div>
                        <div className="text-sm text-muted-foreground">{t('sr.home.total_stock')}</div>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4 bg-blue-50 border-blue-200">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-100 p-3 rounded-xl">
                        <History className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-blue-600">{repStock.length}</div>
                        <div className="text-sm text-blue-600/70">{t('sr.home.products_unit')}</div>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Stock Items */}
                <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  {t('sr.home.available_stock')}
                </h3>
                <div className="space-y-3">
                  {repStock.map((stock) => {
                    const itemDetails = getItemDetails(stock.item_code)
                    return (
                      <Card key={`${stock.item_code}-${stock.warehouse}`} className="p-4 border-2 border-green-200 bg-green-50/50">
                        <div className="flex items-center gap-4">
                          {itemDetails?.image && (
                            <img
                              src={frappeImageUrl(itemDetails.image)}
                              alt={stock.item_name || stock.item_code}
                              className="w-16 h-16 rounded-xl object-cover bg-muted flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-lg truncate">{itemDetails?.item_name || stock.item_name || stock.item_code}</h4>
                            <p className="text-sm text-muted-foreground">{stock.item_code}</p>
                            {stock.stock_uom && (
                              <p className="text-xs text-muted-foreground">{stock.stock_uom}</p>
                            )}
                            {Number(stock.valuation_rate) > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {t('sr.home.price_label').replace('{price}', Number(stock.valuation_rate).toFixed(2))}
                              </p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-3xl font-bold text-green-600">{Number(stock.actual_qty) || 0}</div>
                            <div className="text-xs text-muted-foreground">{stock.stock_uom || t('sr.common.unit_default')}</div>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>

                <Link href="/sales-rep/inventory-records" className="block mt-6">
                  <Button variant="outline" className="w-full border-2 py-6 rounded-2xl bg-transparent">
                    <History className="w-5 h-5 ml-2" />
                    {t('sr.home.view_stock_log')}
                  </Button>
                </Link>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
      {/* Schedule Visit Dialog */}
      {salesPerson && (
        <ScheduleVisitDialog
          open={showScheduleDialog}
          onOpenChange={setShowScheduleDialog}
          salesPersonName={salesPerson.name}
          customers={customers}
          onVisitCreated={() => {
            // Refresh today's visits
            salesApi.getVisits({
              filters: [
                ["Sales Person Visit", "sales_person", "=", salesPerson.name],
                ["Sales Person Visit", "visit_date", "=", today],
              ],
            }).then(setTodayVisits).catch(() => { })
          }}
        />
      )}
    </div>
  )
}
