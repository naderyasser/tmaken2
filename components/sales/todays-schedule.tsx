/**
 * Today's Schedule — Daily visit overview with quick check-in support
 * Shows today's visits per rep, allows one-tap check-in/check-out
 */

'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { salesApi, type SalesPersonVisit, type SalesPerson, type Customer, type DailyRoutePlan, localDateISO } from '@/lib/sales-api'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  Search, RefreshCw, MapPin, Clock, CheckCircle2, LogIn, LogOut,
  Calendar, User, ChevronRight, ChevronLeft, AlertTriangle, Plus,
  Loader2, Timer, XCircle, Zap, Navigation,
} from 'lucide-react'

const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  'Scheduled': { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: <Clock className="h-3.5 w-3.5" /> },
  'In Progress': { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <Timer className="h-3.5 w-3.5" /> },
  'Completed': { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  'Cancelled': { color: 'bg-red-100 text-red-700 border-red-200', icon: <XCircle className="h-3.5 w-3.5" /> },
}

function isVisitLate(visit: SalesPersonVisit): boolean | null {
  if (!visit.scheduled_check_in_time || !visit.check_in_time) return null
  const dateStr = visit.visit_date.split('T')[0]
  const deadline = new Date(`${dateStr}T${visit.scheduled_check_in_time}`)
  deadline.setMinutes(deadline.getMinutes() + (visit.grace_period_minutes ?? 15))
  return new Date(visit.check_in_time) > deadline
}

export function TodaysSchedule() {
  const { t, isRTL } = useI18n()
  const { toast } = useToast()
  const statusLabel = (s: string) => t('sr.status.' + s.toLowerCase().replace(/ /g, '_'))
  const visitTypeLabel = (vt: string) => {
    const map: Record<string, string> = {
      'Sales Order': 'sr.admin.schedule.vt_sales_order',
      'Follow-up': 'sr.admin.schedule.vt_followup',
      'Stock Check': 'sr.admin.schedule.vt_stock_check',
      'Product Return': 'sr.admin.schedule.vt_product_return',
      'No Order - Visit Only': 'sr.admin.schedule.vt_visit_only',
    }
    return map[vt] ? t(map[vt]) : vt
  }
  const [visits, setVisits] = useState<SalesPersonVisit[]>([])
  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [routePlans, setRoutePlans] = useState<DailyRoutePlan[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedDate, setSelectedDate] = useState(localDateISO())
  const [repFilter, setRepFilter] = useState('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Quick check-in dialog
  const [showQuickCheckin, setShowQuickCheckin] = useState(false)
  const [quickForm, setQuickForm] = useState({
    sales_person: '', customer: '',
    visit_type: 'Sales Order' as SalesPersonVisit['visit_type'],
  })
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true)
      const [v, sp, c, rp] = await Promise.all([
        salesApi.getVisits({
          filters: [['Sales Person Visit', 'visit_date', '=', selectedDate]],
          order_by: 'scheduled_check_in_time asc, visit_date asc',
        }),
        salesApi.getSalesPersons({ filters: [['Sales Person', 'enabled', '=', 1]] }),
        salesApi.getCustomers({ fields: ['name', 'customer_name', 'customer_lat', 'customer_lng', 'primary_sales_person'] }),
        salesApi.getRoutePlans({
          filters: [['Daily Route Plan', 'route_date', '=', selectedDate]],
        }).catch(() => []),
      ])
      setVisits(v); setSalesPersons(sp); setCustomers(c); setRoutePlans(rp)
    } catch (e) {
      toast({ title: t('sr.admin.common.error_title'), description: String(e), variant: 'destructive' })
    } finally { setLoading(false); setRefreshing(false) }
  }, [selectedDate, toast, t])

  useEffect(() => { loadData() }, [loadData])

  // Group visits by sales person
  const groupedVisits = useMemo(() => {
    let filtered = visits
    if (repFilter !== 'all') filtered = filtered.filter(v => v.sales_person === repFilter)
    const groups: Record<string, SalesPersonVisit[]> = {}
    filtered.forEach(v => {
      const key = v.sales_person || 'Unknown'
      if (!groups[key]) groups[key] = []
      groups[key].push(v)
    })
    return groups
  }, [visits, repFilter])

  // Stats
  const stats = useMemo(() => {
    const total = visits.length
    const completed = visits.filter(v => v.visit_status === 'Completed').length
    const inProgress = visits.filter(v => v.visit_status === 'In Progress').length
    const scheduled = visits.filter(v => v.visit_status === 'Scheduled').length
    const late = visits.filter(v => isVisitLate(v) === true).length
    const activeReps = new Set(visits.map(v => v.sales_person)).size
    return { total, completed, inProgress, scheduled, late, activeReps }
  }, [visits])

  const handleCheckIn = async (visit: SalesPersonVisit) => {
    setActionLoading(visit.name)
    try {
      // Use a default location for admin override (0,0 signals admin action)
      await salesApi.checkIn(visit.name, 0, 0)
      toast({ title: t('sr.admin.schedule.toast_checkin_title'), description: t('sr.admin.schedule.toast_checkin_desc') })
      loadData(true)
    } catch (e: any) {
      toast({ title: t('sr.admin.common.error_title'), description: e.message, variant: 'destructive' })
    } finally { setActionLoading(null) }
  }

  const handleCheckOut = async (visit: SalesPersonVisit) => {
    setActionLoading(visit.name)
    try {
      await salesApi.checkOut(visit.name, 0, 0)
      toast({ title: t('sr.admin.schedule.toast_checkout_title'), description: t('sr.admin.schedule.toast_checkout_desc') })
      loadData(true)
    } catch (e: any) {
      toast({ title: t('sr.admin.common.error_title'), description: e.message, variant: 'destructive' })
    } finally { setActionLoading(null) }
  }

  const handleQuickCheckin = async () => {
    if (!quickForm.sales_person || !quickForm.customer) return
    setSaving(true)
    try {
      // Create visit + immediately check in
      const visit = await salesApi.createVisit({
        sales_person: quickForm.sales_person,
        customer: quickForm.customer,
        visit_date: selectedDate,
        visit_type: quickForm.visit_type,
        visit_status: 'Scheduled',
      })
      if (visit) {
        try {
          await salesApi.checkIn(visit.name, 0, 0)
        } catch {
          // Visit created even if check-in fails
        }
      }
      toast({ title: t('sr.admin.schedule.toast_done_title'), description: t('sr.admin.schedule.toast_quick_desc') })
      setShowQuickCheckin(false)
      loadData(true)
    } catch (e: any) {
      toast({ title: t('sr.admin.common.error_title'), description: e.message, variant: 'destructive' })
    } finally { setSaving(false) }
  }

  const navigateDate = (dir: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + dir)
    setSelectedDate(localDateISO(d))
  }

  const isToday = selectedDate === localDateISO()
  const ArrowPrev = isRTL ? ChevronRight : ChevronLeft
  const ArrowNext = isRTL ? ChevronLeft : ChevronRight

  if (loading) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-3 gap-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
    </div>
  )

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('sr.admin.nav.todays_schedule')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {t('sr.admin.schedule.subtitle')}
          </p>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={refreshing}>
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </Button>
          <Button size="sm" onClick={() => {
            setQuickForm({ sales_person: '', customer: '', visit_type: 'Sales Order' })
            setShowQuickCheckin(true)
          }} className="bg-violet-600 hover:bg-violet-700">
            <Zap className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
            {t('sr.admin.schedule.quick_checkin')}
          </Button>
        </div>
      </div>

      {/* Date Navigation */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigateDate(isRTL ? 1 : -1)} className="h-8 w-8 p-0">
                <ArrowPrev className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="h-8 w-40 text-sm"
                />
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigateDate(isRTL ? -1 : 1)} className="h-8 w-8 p-0">
                <ArrowNext className="h-4 w-4" />
              </Button>
              {!isToday && (
                <Button variant="outline" size="sm" onClick={() => setSelectedDate(localDateISO())} className="h-8 text-xs">
                  {t('sr.admin.schedule.today_btn')}
                </Button>
              )}
            </div>
            <Select value={repFilter} onValueChange={setRepFilter}>
              <SelectTrigger className="w-[180px] h-8 text-sm"><SelectValue placeholder={t('sr.admin.common.all_reps')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('sr.admin.common.all_reps')}</SelectItem>
                {salesPersons.map(sp => (
                  <SelectItem key={sp.name} value={sp.name}>{sp.sales_person_name || sp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: t('sr.admin.schedule.stat_total_visits'), value: stats.total, color: 'text-gray-900', bg: 'bg-gray-50' },
          { label: t('sr.admin.common.completed'), value: stats.completed, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: t('sr.admin.schedule.stat_in_progress'), value: stats.inProgress, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: t('sr.admin.common.scheduled'), value: stats.scheduled, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: t('sr.admin.common.late_plural'), value: stats.late, color: 'text-red-600', bg: 'bg-red-50' },
          { label: t('sr.admin.stats.active_reps'), value: stats.activeReps, color: 'text-violet-600', bg: 'bg-violet-50' },
        ].map((s, i) => (
          <Card key={i} className="border-0 shadow-sm">
            <CardContent className={cn('p-3 rounded-lg', s.bg)}>
              <p className="text-[11px] text-gray-500 font-medium">{s.label}</p>
              <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Route Plans for the day */}
      {routePlans.length > 0 && (
        <Card className="border-0 shadow-sm border-l-4 border-l-cyan-400">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Navigation className="h-4 w-4 text-cyan-600" />
              <span className="text-sm font-semibold text-gray-700">{t('sr.admin.schedule.route_plans_today')}</span>
              <Badge className="bg-cyan-100 text-cyan-700 text-[10px]">{routePlans.length}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {routePlans.map(rp => (
                <Badge key={rp.name} variant="outline" className="text-xs gap-1">
                  <User className="h-3 w-3" /> {rp.sales_person} — {rp.total_customers} {t('sr.admin.schedule.stops_unit')}
                  <Badge className={cn('text-[9px] ml-1', rp.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : rp.status === 'Completed' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600')}>{statusLabel(rp.status)}</Badge>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Visits grouped by sales person */}
      {Object.keys(groupedVisits).length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">{t('sr.admin.schedule.empty_title')}</p>
            <p className="text-xs text-gray-400 mt-1">{t('sr.admin.schedule.empty_hint')}</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedVisits).map(([repName, repVisits]) => {
          const rep = salesPersons.find(sp => sp.name === repName)
          const completed = repVisits.filter(v => v.visit_status === 'Completed').length
          return (
            <Card key={repName} className="border-0 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-slate-50 to-white px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center">
                    <User className="h-4 w-4 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{rep?.sales_person_name || repName}</p>
                    <p className="text-[11px] text-gray-500">{completed}/{repVisits.length} {t('sr.admin.schedule.completed_of')}</p>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${repVisits.length > 0 ? (completed / repVisits.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <CardContent className="p-0">
                {repVisits.map((visit, idx) => {
                  const customer = customers.find(c => c.name === visit.customer)
                  const late = isVisitLate(visit)
                  const sc = statusConfig[visit.visit_status] || statusConfig['Scheduled']
                  return (
                    <div key={visit.name} className={cn(
                      'flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 transition-colors',
                      idx < repVisits.length - 1 && 'border-b border-gray-50'
                    )}>
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold', sc.color)}>
                          {sc.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 truncate">{customer?.customer_name || visit.customer}</p>
                            {late === true && (
                              <Badge className="bg-red-50 text-red-600 text-[9px] gap-0.5 border border-red-200">
                                <AlertTriangle className="h-2.5 w-2.5" /> {t('sr.admin.common.late')}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-0.5">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {visitTypeLabel(visit.visit_type)}
                            </span>
                            {visit.scheduled_check_in_time && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" /> {visit.scheduled_check_in_time}
                              </span>
                            )}
                            {visit.check_in_time && (
                              <span className="flex items-center gap-1 text-emerald-500">
                                <LogIn className="h-3 w-3" /> {new Date(visit.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                            {visit.check_out_time && (
                              <span className="flex items-center gap-1 text-blue-500">
                                <LogOut className="h-3 w-3" /> {new Date(visit.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={cn('text-[10px]', sc.color)}>{statusLabel(visit.visit_status)}</Badge>
                        {visit.visit_status === 'Scheduled' && (
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => handleCheckIn(visit)}
                            disabled={actionLoading === visit.name}
                          >
                            {actionLoading === visit.name ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogIn className={cn('h-3 w-3', isRTL ? 'ml-1' : 'mr-1')} />}
                            {t('sr.admin.schedule.checkin_btn')}
                          </Button>
                        )}
                        {visit.visit_status === 'In Progress' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-blue-300 text-blue-600 hover:bg-blue-50"
                            onClick={() => handleCheckOut(visit)}
                            disabled={actionLoading === visit.name}
                          >
                            {actionLoading === visit.name ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogOut className={cn('h-3 w-3', isRTL ? 'ml-1' : 'mr-1')} />}
                            {t('sr.admin.schedule.checkout_btn')}
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )
        })
      )}

      {/* Quick Check-in Dialog */}
      <Dialog open={showQuickCheckin} onOpenChange={setShowQuickCheckin}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-violet-600" />
              {t('sr.admin.schedule.quick_checkin')}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">{t('sr.admin.schedule.quick_desc')}</p>
          <div className="grid gap-4 py-4">
            <div>
              <Label>{t('sr.admin.common.sales_person')} *</Label>
              <Select value={quickForm.sales_person} onValueChange={v => setQuickForm(f => ({ ...f, sales_person: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={t('sr.admin.schedule.select_rep_placeholder')} /></SelectTrigger>
                <SelectContent>
                  {salesPersons.map(sp => (
                    <SelectItem key={sp.name} value={sp.name}>{sp.sales_person_name || sp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('sr.admin.common.customer')} *</Label>
              <Select value={quickForm.customer} onValueChange={v => setQuickForm(f => ({ ...f, customer: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={t('sr.admin.schedule.select_customer_placeholder')} /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => (
                    <SelectItem key={c.name} value={c.name}>{c.customer_name || c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('sr.admin.schedule.label_visit_type')}</Label>
              <Select value={quickForm.visit_type} onValueChange={(v: any) => setQuickForm(f => ({ ...f, visit_type: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sales Order">{t('sr.admin.schedule.vt_sales_order')}</SelectItem>
                  <SelectItem value="Follow-up">{t('sr.admin.schedule.vt_followup')}</SelectItem>
                  <SelectItem value="Stock Check">{t('sr.admin.schedule.vt_stock_check')}</SelectItem>
                  <SelectItem value="Product Return">{t('sr.admin.schedule.vt_product_return')}</SelectItem>
                  <SelectItem value="No Order - Visit Only">{t('sr.admin.schedule.vt_visit_only')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuickCheckin(false)}>{t('sr.admin.common.cancel')}</Button>
            <Button onClick={handleQuickCheckin} disabled={saving || !quickForm.sales_person || !quickForm.customer} className="bg-violet-600 hover:bg-violet-700">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Zap className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
              {t('sr.admin.schedule.create_checkin_btn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
