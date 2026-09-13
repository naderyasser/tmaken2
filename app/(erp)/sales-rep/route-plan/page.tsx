"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  MapPin, Clock, CheckCircle2, Circle, ArrowRight,
  Loader2, AlertCircle, RefreshCw, Navigation, Phone,
  ChevronDown, ChevronUp, Route,
} from "lucide-react"
import Link from "next/link"
import { useSalesRep } from "@/contexts/SalesRepContext"
import { useI18n } from "@/lib/i18n"
import { displayLocale } from '@/lib/sales-format'
import {
  salesApi,
  localDateISO,
  type DailyRoutePlan,
  type RoutePlanCustomer,
  type SalesPersonVisit,
} from "@/lib/sales-api"

// Visual styles kept at module scope (color/icon are not translatable).
// Status labels are resolved inside the component via t('sr.status.*').
const VISIT_STATUS_MAP: Record<string, { color: string; icon: typeof CheckCircle2 }> = {
  Completed: { color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  "In Progress": { color: "bg-blue-100 text-blue-700 animate-pulse", icon: Clock },
  Scheduled: { color: "bg-slate-100 text-slate-600", icon: Circle },
  Cancelled: { color: "bg-red-100 text-red-600", icon: AlertCircle },
}

export default function RoutePlanPage() {
  const { salesPerson, customers } = useSalesRep()
  const { t, lang } = useI18n()
  const dl = displayLocale(lang)
  const statusLabel = (s: string) => t('sr.status.' + s.toLowerCase().replace(/ /g, '_'))

  const [routePlan, setRoutePlan] = useState<DailyRoutePlan | null>(null)
  const [todayVisits, setTodayVisits] = useState<SalesPersonVisit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null)

  const today = localDateISO()

  const loadRoutePlan = useCallback(async () => {
    if (!salesPerson) return
    setLoading(true)
    setError(null)

    try {
      // Fetch today's route plan
      const plans = await salesApi.getRoutePlans({
        filters: [
          ["Daily Route Plan", "sales_person", "=", salesPerson.name],
          ["Daily Route Plan", "route_date", "=", today],
        ],
      })

      if (plans.length > 0) {
        // Get full plan with customers child table
        const full = await salesApi.getRoutePlan(plans[0].name)
        setRoutePlan(full)
      } else {
        setRoutePlan(null)
      }

      // Fetch today's visits regardless
      const visits = await salesApi.getVisits({
        filters: [
          ["Sales Person Visit", "sales_person", "=", salesPerson.name],
          ["Sales Person Visit", "visit_date", "=", today],
        ],
      })
      setTodayVisits(visits)
    } catch (err) {
      console.error("[RoutePlan] Failed to load:", err)
      setError(t('sr.route.load_error'))
    } finally {
      setLoading(false)
    }
  }, [salesPerson, today])

  useEffect(() => {
    loadRoutePlan()
  }, [loadRoutePlan])

  const getCustomerDetails = (customerName: string) =>
    customers.find((c) => c.name === customerName)

  const getVisitForCustomer = (customerName: string) =>
    todayVisits.find((v) => v.customer === customerName)

  const getVisitStatus = (customer: RoutePlanCustomer): string => {
    const visit = getVisitForCustomer(customer.customer)
    if (visit) return visit.visit_status
    if (customer.visit_status) return customer.visit_status
    return "Scheduled"
  }

  const completedCount = routePlan
    ? (routePlan.customers || []).filter(
      (c) => getVisitStatus(c) === "Completed"
    ).length
    : todayVisits.filter((v) => v.visit_status === "Completed").length

  const totalCount = routePlan
    ? routePlan.customers?.length || 0
    : todayVisits.length

  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const openGoogleMaps = (lat: string, lng: string) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank")
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-3" />
          <p className="text-muted-foreground">{t('sr.route.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white pb-6 px-5 rounded-b-[2rem]">
        <div className="pt-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">{t('sr.route.title')}</h1>
              <p className="text-blue-200 text-sm mt-1">
                {new Date().toLocaleDateString(dl, {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={loadRoutePlan}
            >
              <RefreshCw className="w-5 h-5" />
            </Button>
          </div>

          {/* Progress bar */}
          {totalCount > 0 && (
            <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-blue-100">{t('sr.route.progress')}</span>
                <span className="font-bold text-lg">{completedCount}/{totalCount}</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-3">
                <div
                  className="bg-white rounded-full h-3 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-blue-200 mt-2">
                {progress === 100
                  ? t('sr.route.all_done')
                  : t('sr.route.remaining').replace('{n}', String(totalCount - completedCount))}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-5 space-y-4">
        {error && (
          <Card className="p-4 bg-red-50 border-red-200">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <p>{error}</p>
            </div>
          </Card>
        )}

        {/* No route plan */}
        {!routePlan && todayVisits.length === 0 && !error && (
          <Card className="p-12 text-center">
            <Route className="w-16 h-16 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="text-xl font-bold mb-2">{t('sr.route.no_plan_title')}</h3>
            <p className="text-muted-foreground mb-4">
              {t('sr.route.no_plan_desc')}
            </p>
            <Link href="/sales-rep">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <ArrowRight className="w-4 h-4 ml-2" />
                {t('sr.route.go_home')}
              </Button>
            </Link>
          </Card>
        )}

        {/* Route plan customers */}
        {routePlan?.customers && routePlan.customers.length > 0 && (
          <div className="space-y-3">
            {[...routePlan.customers]
              .sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
              .map((planCustomer, index) => {
                const cust = getCustomerDetails(planCustomer.customer)
                const visit = getVisitForCustomer(planCustomer.customer)
                const status = getVisitStatus(planCustomer)
                const statusInfo = VISIT_STATUS_MAP[status] || VISIT_STATUS_MAP.Scheduled
                const StatusIcon = statusInfo.icon
                const isExpanded = expandedCustomer === planCustomer.customer

                return (
                  <Card
                    key={planCustomer.customer}
                    className={`overflow-hidden border-2 transition-all ${status === "Completed"
                      ? "border-emerald-200 bg-emerald-50/30"
                      : status === "In Progress"
                        ? "border-blue-300 bg-blue-50/30"
                        : "border-slate-200"
                      }`}
                  >
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() => setExpandedCustomer(isExpanded ? null : planCustomer.customer)}
                    >
                      <div className="flex items-start gap-3">
                        {/* Sequence number */}
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${status === "Completed"
                            ? "bg-emerald-500 text-white"
                            : status === "In Progress"
                              ? "bg-blue-500 text-white"
                              : "bg-slate-200 text-slate-600"
                            }`}
                        >
                          {status === "Completed" ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            index + 1
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-bold text-base truncate">
                              {planCustomer.customer_name || cust?.customer_name || planCustomer.customer}
                            </h3>
                            <Badge className={`${statusInfo.color} text-xs`}>
                              <StatusIcon className="w-3 h-3 ml-1" />
                              {statusLabel(status)}
                            </Badge>
                          </div>

                          {cust?.territory && (
                            <p className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                              <MapPin className="w-3 h-3" />
                              {cust.territory}
                            </p>
                          )}

                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            {planCustomer.scheduled_time && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {planCustomer.scheduled_time}
                              </span>
                            )}
                            {planCustomer.priority && (
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${planCustomer.priority === "High"
                                  ? "border-red-300 text-red-600"
                                  : planCustomer.priority === "Low"
                                    ? "border-slate-300 text-slate-500"
                                    : ""
                                  }`}
                              >
                                {planCustomer.priority === "High"
                                  ? t('sr.urgency.high')
                                  : planCustomer.priority === "Low"
                                    ? t('sr.urgency.low')
                                    : t('sr.urgency.normal')}
                              </Badge>
                            )}
                            {visit?.check_in_time && (
                              <span className="text-emerald-600">
                                {t('sr.route.checkin_short').replace('{time}', visit.check_in_time.split(" ")[1]?.slice(0, 5) ?? '')}
                              </span>
                            )}
                            {visit?.check_out_time && (
                              <span className="text-blue-600">
                                {t('sr.route.checkout_short').replace('{time}', visit.check_out_time.split(" ")[1]?.slice(0, 5) ?? '')}
                              </span>
                            )}
                          </div>
                        </div>

                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0 mt-1" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 mt-1" />
                        )}
                      </div>
                    </div>

                    {/* Expanded actions */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0 space-y-3 border-t border-slate-100">
                        {planCustomer.notes && (
                          <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl mt-3">
                            📝 {planCustomer.notes}
                          </p>
                        )}

                        {visit?.visit_duration && visit.visit_duration > 0 && (
                          <p className="text-xs text-slate-500">
                            {t('sr.route.visit_duration').replace('{n}', String(visit.visit_duration))}
                          </p>
                        )}

                        <div className="flex gap-2 mt-2">
                          {status !== "Completed" && (
                            <Link
                              href={`/sales-rep/new-order?customerId=${encodeURIComponent(planCustomer.customer)}`}
                              className="flex-1"
                            >
                              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11">
                                {status === "In Progress" ? t('sr.route.continue_visit') : t('sr.common.i_arrived')}
                              </Button>
                            </Link>
                          )}

                          {cust?.customer_lat && cust?.customer_lng && (
                            <Button
                              variant="outline"
                              className="rounded-xl h-11 bg-transparent"
                              onClick={() =>
                                openGoogleMaps(cust.customer_lat!, cust.customer_lng!)
                              }
                            >
                              <Navigation className="w-4 h-4" />
                            </Button>
                          )}

                          {(cust as any)?.mobile_no && (
                            <Button
                              variant="outline"
                              className="rounded-xl h-11 bg-transparent"
                              onClick={() => window.open(`tel:${(cust as any).mobile_no}`, "_self")}
                            >
                              <Phone className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </Card>
                )
              })}
          </div>
        )}

        {/* Today's visits (no route plan but has visits) */}
        {!routePlan && todayVisits.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-800">{t('sr.common.today_visits')}</h2>
            {todayVisits.map((visit) => {
              const cust = getCustomerDetails(visit.customer)
              const statusInfo = VISIT_STATUS_MAP[visit.visit_status] || VISIT_STATUS_MAP.Scheduled
              const StatusIcon = statusInfo.icon

              return (
                <Card key={visit.name} className="p-4 border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold truncate">
                      {visit.customer_name || cust?.customer_name || visit.customer}
                    </h3>
                    <Badge className={`${statusInfo.color} text-xs`}>
                      <StatusIcon className="w-3 h-3 ml-1" />
                      {statusLabel(visit.visit_status)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    {visit.check_in_time && (
                      <span>{t('sr.route.checkin_short').replace('{time}', visit.check_in_time.split(" ")[1]?.slice(0, 5) ?? '')}</span>
                    )}
                    {visit.check_out_time && (
                      <span>{t('sr.route.checkout_short').replace('{time}', visit.check_out_time.split(" ")[1]?.slice(0, 5) ?? '')}</span>
                    )}
                    {visit.has_order === 1 && (
                      <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">{t('sr.route.order_badge')}</Badge>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        {/* Route plan notes */}
        {routePlan?.notes && (
          <Card className="p-4 bg-amber-50 border-amber-200">
            <p className="text-sm text-amber-800">📌 {routePlan.notes}</p>
          </Card>
        )}
      </div>
    </div>
  )
}
