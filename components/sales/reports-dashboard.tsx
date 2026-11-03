/**
 * Reports Dashboard — Comprehensive sales reports hub
 * Shows everything produced by the mobile app:
 *  - Visit History (with order/return links)
 *  - Order Pipeline (SO → DN → SI per transaction)
 *  - Product Returns & Withdrawals
 *  - Customer Inventory Snapshots
 *  - Daily Activity Summary
 *  - Sales Summary KPIs
 *  - Rep Performance Scorecard
 */

'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { salesApi, type SalesPersonVisit, type SalesPerson, type SalesOrder, type SalesInvoice, type Customer, type ProductReturn, type CustomerInventoryRecord, localDateISO } from '@/lib/sales-api'
import { useI18n } from '@/lib/i18n'
import { defaultReportDateRange, formatSAR, formatNumber, formatDateShort, formatTime, visitTypeLabel } from '@/lib/sales-format'
import { ValueUnit } from '@/components/sales/value-unit'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  Search, RefreshCw, Users, MapPin, DollarSign,
  Calendar, Download, TrendingUp, ClipboardList, Clock, Activity,
  FileBarChart, Truck, Package, Undo2, Eye, Loader2,
  ArrowRight, CheckCircle2, XCircle, AlertTriangle, ShoppingCart,
  Receipt, BarChart3,
} from 'lucide-react'

type ReportTab = 'visit-history' | 'order-pipeline' | 'returns' | 'customer-inventory' | 'daily-activity' | 'sales-summary'

export function ReportsDashboard() {
  const { t, lang, isRTL } = useI18n()
  const { toast } = useToast()
  const statusLabel = (s?: string | null) => {
    if (!s) return s ?? ''
    const key = 'sr.status.' + s.toLowerCase().replace(/ /g, '_')
    const v = t(key)
    return v === key ? s : v
  }
  const [tab, setTab] = useState<ReportTab>('visit-history')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Data
  const [visits, setVisits] = useState<SalesPersonVisit[]>([])
  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([])
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([])
  const [invoices, setInvoices] = useState<SalesInvoice[]>([])
  const [deliveryNotes, setDeliveryNotes] = useState<any[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [productReturns, setProductReturns] = useState<ProductReturn[]>([])
  const [custInventory, setCustInventory] = useState<CustomerInventoryRecord[]>([])

  // Filters
  const [dateFrom, setDateFrom] = useState(() => defaultReportDateRange().from)
  const [dateTo, setDateTo] = useState(() => defaultReportDateRange().to)
  const [repFilter, setRepFilter] = useState('all')
  const [search, setSearch] = useState('')

  // Detail dialog
  const [detailItem, setDetailItem] = useState<any>(null)
  const [detailType, setDetailType] = useState<string>('')
  const [loadingDetail, setLoadingDetail] = useState(false)

  const loadData = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true)
      const [v, sp, so, inv, dn, cust, ret, ci] = await Promise.all([
        salesApi.getVisits({
          filters: [['Sales Person Visit', 'visit_date', '>=', dateFrom], ['Sales Person Visit', 'visit_date', '<=', dateTo]],
          limit_page_length: 1000,
        }).catch(() => []),
        salesApi.getSalesPersons().catch(() => []),
        salesApi.getSalesOrders({
          filters: [['Sales Order', 'transaction_date', '>=', dateFrom], ['Sales Order', 'transaction_date', '<=', dateTo]],
          limit_page_length: 1000,
        }).catch(() => []),
        salesApi.getSalesInvoices({
          filters: [['Sales Invoice', 'posting_date', '>=', dateFrom], ['Sales Invoice', 'posting_date', '<=', dateTo]],
          limit_page_length: 1000,
        }).catch(() => []),
        salesApi.getDeliveryNotes({
          filters: [['Delivery Note', 'posting_date', '>=', dateFrom], ['Delivery Note', 'posting_date', '<=', dateTo]],
          limit_page_length: 1000,
        }).catch(() => []),
        salesApi.getCustomers({ fields: ['name', 'customer_name', 'primary_sales_person', 'territory'] }).catch(() => []),
        salesApi.getProductReturns({
          filters: [['Product Return From Customer', 'return_date', '>=', dateFrom], ['Product Return From Customer', 'return_date', '<=', dateTo]],
          limit_page_length: 1000,
        }).catch(() => []),
        salesApi.getCustomerInventory({ limit_page_length: 500 }).catch(() => []),
      ])
      setVisits(v); setSalesPersons(sp); setSalesOrders(so); setInvoices(inv)
      setDeliveryNotes(dn); setCustomers(cust); setProductReturns(ret); setCustInventory(ci)
    } catch (e) {
      toast({ title: t('sr.admin.common.error_title'), description: String(e), variant: 'destructive' })
    } finally { setLoading(false); setRefreshing(false) }
  }, [dateFrom, dateTo, toast, t])

  useEffect(() => { loadData() }, [loadData])

  const formatCurrency = (amount: number) => formatSAR(amount, lang)

  const exportCSV = (headers: string[], rows: string[][], filename: string) => {
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  }

  // ========== VISIT HISTORY DATA ==========
  const visitData = useMemo(() => {
    let filtered = visits
    if (repFilter !== 'all') filtered = filtered.filter(v => v.sales_person === repFilter)
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(v =>
        v.customer?.toLowerCase().includes(q) || v.sales_person?.toLowerCase().includes(q) || v.name?.toLowerCase().includes(q)
      )
    }
    return filtered.sort((a, b) => b.visit_date.localeCompare(a.visit_date))
  }, [visits, repFilter, search])

  // ========== ORDER PIPELINE DATA ==========
  const pipelineData = useMemo(() => {
    let filtered = salesOrders
    if (repFilter !== 'all') {
      filtered = filtered.filter(so => so.sales_team?.some((t: any) => t.sales_person === repFilter))
    }
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(so =>
        so.name?.toLowerCase().includes(q) || so.customer?.toLowerCase().includes(q) || so.customer_name?.toLowerCase().includes(q)
      )
    }
    return filtered.map(so => {
      // Find matching DN and SI for this SO
      const matchedDN = deliveryNotes.find((dn: any) => dn.customer === so.customer && dn.posting_date === so.transaction_date)
      const matchedSI = invoices.find(si => si.customer === so.customer && si.posting_date === so.transaction_date)
      return {
        ...so,
        delivery_note: matchedDN?.name || null,
        dn_status: matchedDN?.status || null,
        invoice: matchedSI?.name || null,
        si_status: matchedSI?.status || null,
        si_outstanding: matchedSI?.outstanding_amount || 0,
        pipeline_complete: so.docstatus === 1 && matchedDN?.docstatus === 1 && matchedSI?.docstatus === 1,
      }
    })
  }, [salesOrders, deliveryNotes, invoices, repFilter, search])

  // ========== RETURNS DATA ==========
  const returnsData = useMemo(() => {
    let filtered = productReturns
    if (repFilter !== 'all') filtered = filtered.filter(r => r.sales_person === repFilter)
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(r =>
        r.customer?.toLowerCase().includes(q) || r.sales_person?.toLowerCase().includes(q) || r.name?.toLowerCase().includes(q)
      )
    }
    return filtered.sort((a, b) => (b.return_date || '').localeCompare(a.return_date || ''))
  }, [productReturns, repFilter, search])

  // ========== CUSTOMER INVENTORY DATA ==========
  const custInvData = useMemo(() => {
    let filtered = custInventory
    if (repFilter !== 'all') filtered = filtered.filter(c => c.sales_person === repFilter)
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(c =>
        c.customer?.toLowerCase().includes(q) || c.sales_person?.toLowerCase().includes(q) || c.name?.toLowerCase().includes(q)
      )
    }
    return filtered
  }, [custInventory, repFilter, search])

  // ========== DAILY ACTIVITY DATA ==========
  const dailyActivityData = useMemo(() => {
    const byDate: Record<string, {
      date: string; visits: number; completed: number; orders: number;
      invoiceAmt: number; deliveries: number; returns: number; returnAmt: number
    }> = {}
    const filteredVisits = repFilter !== 'all' ? visits.filter(v => v.sales_person === repFilter) : visits
    filteredVisits.forEach(v => {
      const date = v.visit_date.split('T')[0]
      if (!byDate[date]) byDate[date] = { date, visits: 0, completed: 0, orders: 0, invoiceAmt: 0, deliveries: 0, returns: 0, returnAmt: 0 }
      byDate[date].visits++
      if (v.visit_status === 'Completed') byDate[date].completed++
    })
    salesOrders.forEach(so => {
      const date = so.transaction_date?.split('T')[0]
      if (date && byDate[date]) byDate[date].orders++
    })
    invoices.forEach(inv => {
      const date = inv.posting_date?.split('T')[0]
      if (date && byDate[date]) byDate[date].invoiceAmt += inv.grand_total || 0
    })
    deliveryNotes.forEach((dn: any) => {
      const date = dn.posting_date?.split('T')[0]
      if (date && byDate[date]) byDate[date].deliveries++
    })
    productReturns.forEach(r => {
      const date = r.return_date?.split('T')[0]
      if (date && byDate[date]) { byDate[date].returns++; byDate[date].returnAmt += r.total_amount || 0 }
    })
    return Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date))
  }, [visits, salesOrders, invoices, deliveryNotes, productReturns, repFilter])

  // ========== SALES SUMMARY DATA ==========
  const salesSummary = useMemo(() => {
    const totalOrders = salesOrders.length
    const totalOrderValue = salesOrders.reduce((s, o) => s + (o.grand_total || 0), 0)
    const submittedOrders = salesOrders.filter(o => o.docstatus === 1).length
    const totalDNs = deliveryNotes.length
    const submittedDNs = deliveryNotes.filter((d: any) => d.docstatus === 1).length
    const dnValue = deliveryNotes.filter((d: any) => d.docstatus === 1).reduce((s: number, d: any) => s + (d.grand_total || 0), 0)
    const totalInv = invoices.filter(i => i.docstatus === 1).length
    const invValue = invoices.filter(i => i.docstatus === 1).reduce((s, i) => s + (i.grand_total || 0), 0)
    const outstanding = invoices.filter(i => i.docstatus === 1).reduce((s, i) => s + (i.outstanding_amount || 0), 0)
    const collected = invValue - outstanding
    const collectionRate = invValue > 0 ? (collected / invValue) * 100 : 0
    const totalReturns = productReturns.length
    const returnValue = productReturns.reduce((s, r) => s + (r.total_amount || 0), 0)
    const totalVisits = visits.length
    const completedVisits = visits.filter(v => v.visit_status === 'Completed').length
    return {
      totalOrders, totalOrderValue, submittedOrders,
      totalDNs, submittedDNs, dnValue,
      totalInv, invValue, outstanding, collected, collectionRate,
      totalReturns, returnValue,
      totalVisits, completedVisits,
    }
  }, [salesOrders, deliveryNotes, invoices, productReturns, visits])

  // Detail view for customer inventory
  const viewCustInvDetail = async (record: CustomerInventoryRecord) => {
    setDetailType('cust-inventory')
    setDetailItem(record)
    setLoadingDetail(true)
    try {
      const full = await salesApi.getCustomerInventoryById(record.name)
      if (full) setDetailItem(full)
    } catch (e) { console.error(e) }
    finally { setLoadingDetail(false) }
  }

  if (loading) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-10 w-full" />
      {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14" />)}
    </div>
  )

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('sr.admin.reports.title')}</h1>
          <p className="text-sm text-gray-500">{t('sr.admin.reports.subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={refreshing}>
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
        </Button>
      </div>

      {/* Global Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-gray-500 whitespace-nowrap">{t('sr.admin.common.from')}</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 w-40 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-gray-500 whitespace-nowrap">{t('sr.admin.common.to')}</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 w-40 text-sm" />
            </div>
            <Select value={repFilter} onValueChange={setRepFilter}>
              <SelectTrigger className="w-[180px] h-8 text-sm"><SelectValue placeholder={t('sr.admin.reports.all_reps')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('sr.admin.reports.all_reps')}</SelectItem>
                {salesPersons.filter(sp => sp.enabled).map(sp => (
                  <SelectItem key={sp.name} value={sp.name}>{sp.sales_person_name || sp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative flex-1 min-w-[180px]">
              <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
              <Input placeholder={t('sr.admin.common.search')} value={search} onChange={e => setSearch(e.target.value)} className={cn('h-8 text-sm', isRTL ? 'pr-9' : 'pl-9')} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={v => setTab(v as ReportTab)}>
        <div className="overflow-x-auto">
          <TabsList className="bg-gray-100 inline-flex w-auto min-w-full">
            <TabsTrigger value="visit-history" className="gap-1.5 text-xs"><MapPin className="h-3.5 w-3.5" /> {t('sr.admin.reports.visits')}</TabsTrigger>
            <TabsTrigger value="order-pipeline" className="gap-1.5 text-xs"><ShoppingCart className="h-3.5 w-3.5" /> {t('sr.admin.reports.order_pipeline')}</TabsTrigger>
            <TabsTrigger value="returns" className="gap-1.5 text-xs"><Undo2 className="h-3.5 w-3.5" /> {t('sr.admin.common.returns')}</TabsTrigger>
            <TabsTrigger value="customer-inventory" className="gap-1.5 text-xs"><Package className="h-3.5 w-3.5" /> {t('sr.admin.reports.customer_stock')}</TabsTrigger>
            <TabsTrigger value="daily-activity" className="gap-1.5 text-xs"><Activity className="h-3.5 w-3.5" /> {t('sr.admin.reports.daily_activity')}</TabsTrigger>
            <TabsTrigger value="sales-summary" className="gap-1.5 text-xs"><DollarSign className="h-3.5 w-3.5" /> {t('sr.admin.reports.sales_summary')}</TabsTrigger>
          </TabsList>
        </div>

        {/* ===== 1. VISIT HISTORY ===== */}
        <TabsContent value="visit-history" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs">{visitData.length} {t('sr.admin.reports.unit_visits')}</Badge>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
              exportCSV(
                [t('sr.admin.common.date'), t('sr.admin.common.sales_person'), t('sr.admin.common.customer'), t('sr.admin.reports.type'), t('sr.admin.common.status'), t('sr.admin.reports.has_order'), t('sr.admin.reports.check_in'), t('sr.admin.reports.check_out'), `${t('sr.admin.reports.duration')} (min)`],
                visitData.map(v => [v.visit_date?.split('T')[0], v.sales_person, v.customer, statusLabel(v.visit_type), statusLabel(v.visit_status), v.has_order ? t('sr.admin.reports.yes') : t('sr.admin.reports.no'), v.check_in_time || '', v.check_out_time || '', String(v.visit_duration || 0)]),
                'visit-history.csv'
              )
            }}>
              <Download className="h-3 w-3 mr-1" /> {t('sr.admin.reports.export')}
            </Button>
          </div>
          <Card className="border-0 shadow-sm overflow-hidden">
            <Table>
              <TableHeader><TableRow className="bg-gray-50/50">
                <TableHead className="text-xs font-semibold">{t('sr.admin.common.date')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.common.rep')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.common.customer')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.reports.type')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.common.status')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.reports.has_order')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.reports.check_in')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.reports.check_out')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.reports.duration')}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {visitData.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-12 text-gray-400"><MapPin className="h-6 w-6 mx-auto mb-2 text-gray-300" />{t('sr.admin.reports.no_visits')}</TableCell></TableRow>
                ) : visitData.slice(0, 100).map(v => (
                  <TableRow key={v.name} className="hover:bg-gray-50/50">
                    <TableCell className="text-sm">{formatDateShort(v.visit_date, lang)}</TableCell>
                    <TableCell className="text-sm font-medium">{v.sales_person}</TableCell>
                    <TableCell className="text-sm">{v.customer}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{visitTypeLabel(t, v.visit_type)}</Badge></TableCell>
                    <TableCell>
                      <Badge className={cn('text-[10px]',
                        v.visit_status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                        v.visit_status === 'In Progress' ? 'bg-amber-100 text-amber-700' :
                        v.visit_status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      )}>{statusLabel(v.visit_status)}</Badge>
                    </TableCell>
                    <TableCell>
                      {v.has_order ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-gray-300" />}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">{v.check_in_time ? formatTime(v.check_in_time, lang) : '—'}</TableCell>
                    <TableCell className="text-xs text-gray-500">{v.check_out_time ? formatTime(v.check_out_time, lang) : '—'}</TableCell>
                    <TableCell className="text-sm font-medium">{v.visit_duration ? <ValueUnit value={v.visit_duration} unit={t('sr.admin.stops.min_abbr')} /> : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ===== 2. ORDER PIPELINE (SO → DN → SI) ===== */}
        <TabsContent value="order-pipeline" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: t('sr.admin.common.sales_orders'), value: pipelineData.length, color: 'text-indigo-600', icon: ShoppingCart },
              { label: t('sr.admin.reports.delivery_notes_short'), value: pipelineData.filter(p => p.delivery_note).length, color: 'text-cyan-600', icon: Truck },
              { label: t('sr.admin.reports.invoices_short'), value: pipelineData.filter(p => p.invoice).length, color: 'text-purple-600', icon: Receipt },
              { label: t('sr.admin.reports.complete'), value: pipelineData.filter(p => p.pipeline_complete).length, color: 'text-emerald-600', icon: CheckCircle2 },
            ].map((s, i) => {
              const Icon = s.icon
              return <Card key={i} className="border-0 shadow-sm"><CardContent className="p-4 flex items-center gap-3">
                <Icon className={cn('h-5 w-5', s.color)} />
                <div><p className="text-xs text-gray-500">{s.label}</p><p className={cn('text-xl font-bold', s.color)}>{s.value}</p></div>
              </CardContent></Card>
            })}
          </div>
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs">{pipelineData.length} {t('sr.admin.common.unit_orders')}</Badge>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
              exportCSV(
                [t('sr.admin.common.date'), t('sr.admin.reports.so'), t('sr.admin.common.customer'), t('sr.admin.common.amount'), `${t('sr.admin.common.status')} (${t('sr.admin.reports.so')})`, t('sr.admin.reports.dn'), `${t('sr.admin.common.status')} (${t('sr.admin.reports.dn')})`, t('sr.admin.reports.invoice'), `${t('sr.admin.common.status')} (${t('sr.admin.reports.invoice')})`, t('sr.admin.reports.outstanding'), t('sr.admin.reports.pipeline')],
                pipelineData.map(p => [p.transaction_date, p.name, p.customer_name || p.customer, String(p.grand_total || 0), p.status ? statusLabel(p.status) : '', p.delivery_note || '', p.dn_status ? statusLabel(p.dn_status) : '', p.invoice || '', p.si_status ? statusLabel(p.si_status) : '', String(p.si_outstanding), p.pipeline_complete ? t('sr.admin.reports.complete_masc') : t('sr.admin.reports.incomplete')]),
                'order-pipeline.csv'
              )
            }}>
              <Download className="h-3 w-3 mr-1" /> {t('sr.admin.reports.export')}
            </Button>
          </div>
          <Card className="border-0 shadow-sm overflow-hidden">
            <Table>
              <TableHeader><TableRow className="bg-gray-50/50">
                <TableHead className="text-xs font-semibold">{t('sr.admin.common.date')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.common.customer')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.common.value')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.reports.so')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.reports.dn')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.reports.invoice')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.reports.outstanding')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.reports.pipeline')}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {pipelineData.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-12 text-gray-400"><ShoppingCart className="h-6 w-6 mx-auto mb-2 text-gray-300" />{t('sr.admin.reports.no_orders')}</TableCell></TableRow>
                ) : pipelineData.slice(0, 100).map(p => (
                  <TableRow key={p.name} className="hover:bg-gray-50/50">
                    <TableCell className="text-sm">{formatDateShort(p.transaction_date, lang)}</TableCell>
                    <TableCell className="text-sm font-medium">{p.customer_name || p.customer}</TableCell>
                    <TableCell className="text-sm font-medium text-emerald-600">{formatCurrency(p.grand_total || 0)}</TableCell>
                    <TableCell>
                      <Badge className={cn('text-[10px]', p.docstatus === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600')}>
                        {p.status ? statusLabel(p.status) : (p.docstatus === 1 ? '✓' : t('sr.status.draft'))}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {p.delivery_note
                        ? <Badge className="text-[10px] bg-cyan-100 text-cyan-700">{p.dn_status ? statusLabel(p.dn_status) : '✓'}</Badge>
                        : <span className="text-xs text-gray-300">—</span>}
                    </TableCell>
                    <TableCell>
                      {p.invoice
                        ? <Badge className="text-[10px] bg-purple-100 text-purple-700">{p.si_status ? statusLabel(p.si_status) : '✓'}</Badge>
                        : <span className="text-xs text-gray-300">—</span>}
                    </TableCell>
                    <TableCell className={cn('text-sm', p.si_outstanding > 0 ? 'text-red-600 font-medium' : 'text-gray-400')}>
                      {p.si_outstanding > 0 ? formatCurrency(p.si_outstanding) : '—'}
                    </TableCell>
                    <TableCell>
                      {p.pipeline_complete
                        ? <Badge className="text-[10px] bg-emerald-100 text-emerald-700">{t('sr.admin.reports.complete_masc')}</Badge>
                        : <Badge className="text-[10px] bg-amber-100 text-amber-700">{t('sr.admin.reports.in_progress')}</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ===== 3. PRODUCT RETURNS / WITHDRAWALS ===== */}
        <TabsContent value="returns" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: t('sr.admin.reports.total_returns'), value: returnsData.length, color: 'text-red-600' },
              { label: t('sr.admin.common.submitted_fem'), value: returnsData.filter(r => r.docstatus === 1).length, color: 'text-blue-600' },
              { label: t('sr.admin.common.total_value'), value: formatCurrency(returnsData.reduce((s, r) => s + (r.total_amount || 0), 0)), color: 'text-orange-600' },
              { label: t('sr.admin.common.total_qty'), value: returnsData.reduce((s, r) => s + (r.total_qty || 0), 0), color: 'text-purple-600' },
            ].map((s, i) => (
              <Card key={i} className="border-0 shadow-sm"><CardContent className="p-4">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={cn('text-xl font-bold', s.color)}>{typeof s.value === 'number' ? formatNumber(s.value, lang) : s.value}</p>
              </CardContent></Card>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs">{returnsData.length} {t('sr.admin.common.unit_returns')}</Badge>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
              exportCSV(
                [t('sr.admin.common.date'), t('sr.admin.common.id'), t('sr.admin.common.sales_person'), t('sr.admin.common.customer'), t('sr.admin.common.reason'), t('sr.admin.common.qty'), t('sr.admin.common.amount'), t('sr.admin.common.status')],
                returnsData.map(r => [r.return_date, r.name, r.sales_person, r.customer, r.return_reason ? statusLabel(r.return_reason) : '—', String(r.total_qty || 0), String(r.total_amount || 0), r.docstatus === 1 ? t('sr.admin.common.submitted_masc') : t('sr.admin.common.draft')]),
                'product-returns.csv'
              )
            }}>
              <Download className="h-3 w-3 mr-1" /> {t('sr.admin.reports.export')}
            </Button>
          </div>
          <Card className="border-0 shadow-sm overflow-hidden">
            <Table>
              <TableHeader><TableRow className="bg-gray-50/50">
                <TableHead className="text-xs font-semibold">{t('sr.admin.common.date')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.common.id')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.common.rep')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.common.customer')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.common.reason')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.common.qty')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.common.value')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.common.status')}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {returnsData.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-12 text-gray-400"><Undo2 className="h-6 w-6 mx-auto mb-2 text-gray-300" />{t('sr.admin.common.no_returns')}</TableCell></TableRow>
                ) : returnsData.slice(0, 100).map(r => (
                  <TableRow key={r.name} className="hover:bg-gray-50/50">
                    <TableCell className="text-sm">{r.return_date}</TableCell>
                    <TableCell className="text-xs font-mono text-gray-500">{r.name}</TableCell>
                    <TableCell className="text-sm">{r.sales_person}</TableCell>
                    <TableCell className="text-sm font-medium">{r.customer}</TableCell>
                    <TableCell>
                      {r.return_reason ? (
                        <Badge variant="outline" className={cn('text-[10px]',
                          r.return_reason === 'Damaged' ? 'border-red-300 text-red-700' :
                          r.return_reason === 'Expired' ? 'border-orange-300 text-orange-700' :
                          r.return_reason === 'Quality Issue' ? 'border-amber-300 text-amber-700' :
                          'border-gray-300 text-gray-600'
                        )}>{statusLabel(r.return_reason)}</Badge>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{r.total_qty || 0}</TableCell>
                    <TableCell className="text-sm font-medium text-red-600">{formatCurrency(r.total_amount || 0)}</TableCell>
                    <TableCell>
                      <Badge className={cn('text-[10px]', r.docstatus === 1 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600')}>
                        {r.docstatus === 1 ? t('sr.admin.common.submitted_masc') : t('sr.admin.common.draft')}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ===== 4. CUSTOMER INVENTORY SNAPSHOTS ===== */}
        <TabsContent value="customer-inventory" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs">{custInvData.length} {t('sr.admin.reports.unit_records')}</Badge>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
              exportCSV(
                [t('sr.admin.common.id'), t('sr.admin.common.customer'), t('sr.admin.common.sales_person'), t('sr.admin.reports.visit_date'), t('sr.admin.common.items_products')],
                custInvData.map(c => [c.name, c.customer, c.sales_person, c.visit_date || '', String(c.items?.length || 0)]),
                'customer-inventory.csv'
              )
            }}>
              <Download className="h-3 w-3 mr-1" /> {t('sr.admin.reports.export')}
            </Button>
          </div>
          <Card className="border-0 shadow-sm overflow-hidden">
            <Table>
              <TableHeader><TableRow className="bg-gray-50/50">
                <TableHead className="text-xs font-semibold">{t('sr.admin.common.id')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.common.customer')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.common.rep')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.reports.visit_date')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.common.items_products')}</TableHead>
                <TableHead className="text-xs font-semibold w-10"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {custInvData.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-12 text-gray-400"><Package className="h-6 w-6 mx-auto mb-2 text-gray-300" />{t('sr.admin.reports.no_records')}</TableCell></TableRow>
                ) : custInvData.slice(0, 100).map(c => (
                  <TableRow key={c.name} className="hover:bg-gray-50/50 cursor-pointer" onClick={() => viewCustInvDetail(c)}>
                    <TableCell className="text-xs font-mono text-gray-500">{c.name}</TableCell>
                    <TableCell className="text-sm font-medium">{c.customer}</TableCell>
                    <TableCell className="text-sm text-gray-600">{c.sales_person}</TableCell>
                    <TableCell className="text-sm text-gray-600">{formatDateShort(c.visit_date, lang) || '—'}</TableCell>
                    <TableCell className="text-sm">{c.items?.length || '—'}</TableCell>
                    <TableCell><Eye className="h-4 w-4 text-gray-400" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ===== 5. DAILY ACTIVITY ===== */}
        <TabsContent value="daily-activity" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs">{dailyActivityData.length} {t('sr.admin.reports.unit_days')}</Badge>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
              exportCSV(
                [t('sr.admin.common.date'), t('sr.admin.reports.visits'), t('sr.admin.reports.done'), `${t('sr.admin.reports.rate')}%`, t('sr.admin.reports.orders'), t('sr.admin.reports.invoice_value'), t('sr.admin.reports.deliveries'), t('sr.admin.common.returns'), t('sr.admin.reports.return_value')],
                dailyActivityData.map(d => [d.date, String(d.visits), String(d.completed), d.visits > 0 ? `${Math.round(d.completed / d.visits * 100)}%` : '0%', String(d.orders), String(d.invoiceAmt), String(d.deliveries), String(d.returns), String(d.returnAmt)]),
                'daily-activity.csv'
              )
            }}>
              <Download className="h-3 w-3 mr-1" /> {t('sr.admin.reports.export')}
            </Button>
          </div>
          <Card className="border-0 shadow-sm overflow-hidden">
            <Table>
              <TableHeader><TableRow className="bg-gray-50/50">
                <TableHead className="text-xs font-semibold">{t('sr.admin.common.date')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.reports.visits')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.reports.done')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.reports.rate')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.reports.orders')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.reports.dns')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.reports.invoice_value')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.common.returns')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.reports.return_value')}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {dailyActivityData.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-12 text-gray-400">{t('sr.admin.reports.no_data')}</TableCell></TableRow>
                ) : dailyActivityData.map(d => (
                  <TableRow key={d.date} className="hover:bg-gray-50/50">
                    <TableCell className="text-sm font-medium">{formatDateShort(d.date, lang)}</TableCell>
                    <TableCell className="text-sm">{d.visits}</TableCell>
                    <TableCell className="text-sm">{d.completed}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${d.visits > 0 ? (d.completed / d.visits) * 100 : 0}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{d.visits > 0 ? Math.round((d.completed / d.visits) * 100) : 0}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{d.orders}</TableCell>
                    <TableCell className="text-sm">{d.deliveries}</TableCell>
                    <TableCell className="text-sm font-medium text-emerald-600">{formatCurrency(d.invoiceAmt)}</TableCell>
                    <TableCell className={cn('text-sm', d.returns > 0 ? 'text-red-600 font-medium' : 'text-gray-400')}>{d.returns || '—'}</TableCell>
                    <TableCell className={cn('text-sm', d.returnAmt > 0 ? 'text-red-600' : 'text-gray-400')}>{d.returnAmt > 0 ? formatCurrency(d.returnAmt) : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ===== 6. SALES SUMMARY ===== */}
        <TabsContent value="sales-summary" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: t('sr.admin.reports.visits'), value: `${salesSummary.completedVisits}/${salesSummary.totalVisits}`, sub: `${salesSummary.totalVisits > 0 ? Math.round(salesSummary.completedVisits / salesSummary.totalVisits * 100) : 0}% ${t('sr.admin.reports.completed_unit')}`, icon: MapPin, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: t('sr.admin.common.sales_orders'), value: salesSummary.totalOrders, sub: formatCurrency(salesSummary.totalOrderValue), icon: ShoppingCart, color: 'text-indigo-600', bg: 'bg-indigo-50' },
              { label: t('sr.admin.reports.deliveries'), value: `${salesSummary.submittedDNs}/${salesSummary.totalDNs}`, sub: formatCurrency(salesSummary.dnValue), icon: Truck, color: 'text-cyan-600', bg: 'bg-cyan-50' },
              { label: t('sr.admin.common.invoices'), value: salesSummary.totalInv, sub: formatCurrency(salesSummary.invValue), icon: Receipt, color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: t('sr.admin.common.collected'), value: formatCurrency(salesSummary.collected), sub: `${salesSummary.collectionRate.toFixed(1)}% ${t('sr.admin.reports.rate_unit')}`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: t('sr.admin.reports.outstanding'), value: formatCurrency(salesSummary.outstanding), sub: t('sr.admin.reports.pending_sub'), icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: t('sr.admin.common.returns'), value: salesSummary.totalReturns, sub: formatCurrency(salesSummary.returnValue), icon: Undo2, color: 'text-red-600', bg: 'bg-red-50' },
              { label: t('sr.admin.reports.net_sales'), value: formatCurrency(salesSummary.invValue - salesSummary.returnValue), sub: t('sr.admin.reports.invoices_minus_returns'), icon: DollarSign, color: 'text-gray-900', bg: 'bg-gray-50' },
            ].map((s, i) => {
              const Icon = s.icon
              return (
                <Card key={i} className="border-0 shadow-sm">
                  <CardContent className={cn('p-4 rounded-lg', s.bg)}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Icon className="h-4 w-4 text-gray-400" />
                      <p className="text-xs text-gray-500 font-medium">{s.label}</p>
                    </div>
                    <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{s.sub}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Sales Funnel */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <h3 className="text-sm font-bold text-gray-900 mb-4">{t('sr.admin.reports.sales_funnel')}</h3>
              <div className="space-y-3">
                {[
                  { label: t('sr.admin.reports.completed_visits'), value: salesSummary.completedVisits, color: 'bg-blue-500' },
                  { label: t('sr.admin.common.sales_orders'), value: salesSummary.totalOrders, color: 'bg-indigo-500' },
                  { label: t('sr.admin.common.delivery_notes'), value: salesSummary.submittedDNs, color: 'bg-cyan-500' },
                  { label: t('sr.admin.common.invoices'), value: salesSummary.totalInv, color: 'bg-purple-500' },
                ].map((step, i, arr) => {
                  const max = Math.max(...arr.map(a => a.value)) || 1
                  return (
                    <div key={i} className="flex items-center gap-4">
                      <span className="text-xs text-gray-500 w-36 text-right truncate">{step.label}</span>
                      <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden relative">
                        <div className={cn('h-full rounded-lg transition-all duration-700', step.color)} style={{ width: `${Math.max((step.value / max) * 100, 5)}%` }} />
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white mix-blend-difference">{step.value}</span>
                      </div>
                      {i > 0 && (
                        <span className="text-[10px] text-gray-400 w-12 text-center">
                          {arr[i - 1].value > 0 ? `${Math.round((step.value / arr[i - 1].value) * 100)}%` : '—'}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Customer Inventory Detail Dialog */}
      <Dialog open={!!detailItem && detailType === 'cust-inventory'} onOpenChange={(open) => { if (!open) { setDetailItem(null); setDetailType('') } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-teal-600" />
              {detailItem?.name} — {detailItem?.customer}
            </DialogTitle>
          </DialogHeader>
          {detailItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><p className="text-xs text-gray-500">{t('sr.admin.common.customer')}</p><p className="font-medium">{detailItem.customer}</p></div>
                <div><p className="text-xs text-gray-500">{t('sr.admin.common.rep')}</p><p className="font-medium">{detailItem.sales_person}</p></div>
                <div><p className="text-xs text-gray-500">{t('sr.admin.reports.visit_date')}</p><p className="font-medium">{detailItem.visit_date || '—'}</p></div>
              </div>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold mb-2">{t('sr.admin.reports.items_at_customer')}</h4>
                {loadingDetail ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
                ) : detailItem.items && detailItem.items.length > 0 ? (
                  <Table>
                    <TableHeader><TableRow className="bg-gray-50/50">
                      <TableHead className="text-xs">{t('sr.admin.common.item')}</TableHead>
                      <TableHead className="text-xs">{t('sr.admin.common.code')}</TableHead>
                      <TableHead className="text-xs">{t('sr.admin.reports.current_stock')}</TableHead>
                      <TableHead className="text-xs">{t('sr.admin.reports.batch')}</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {detailItem.items.map((item: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="text-sm font-medium">{item.item_name || item.item_code}</TableCell>
                          <TableCell className="text-xs font-mono text-gray-500">{item.item_code}</TableCell>
                          <TableCell className={cn('text-sm font-medium', (item.current_stock || 0) <= 0 ? 'text-red-500' : 'text-emerald-600')}>{item.current_stock ?? 0}</TableCell>
                          <TableCell className="text-xs text-gray-500">{item.batch_no || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4">{t('sr.admin.reports.no_items')}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
