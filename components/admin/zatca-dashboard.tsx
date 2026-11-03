/**
 * ZATCA E-Invoicing Dashboard
 * Shows ZATCA invoice submission analytics, status overview, and recent logs
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { zatcaApi, type ZatcaDashboard, type InvoiceZatcaListItem, type ZatcaLog } from '@/lib/zatca-api'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Shield, CheckCircle2, XCircle, AlertTriangle, Clock,
  RefreshCw, Search, Send, FileText, QrCode, Eye, RotateCcw, Loader2,
  BarChart3, TrendingUp, Receipt, Upload, Printer
} from 'lucide-react'

const ZATCA_STATUS_COLORS: Record<string, string> = {
  'CLEARED': 'bg-green-100 text-green-700',
  'Cleared': 'bg-green-100 text-green-700',
  'REPORTED': 'bg-blue-100 text-blue-700',
  'Reported': 'bg-blue-100 text-blue-700',
  'Not Submitted': 'bg-gray-100 text-gray-700',
  'REJECTED': 'bg-red-100 text-red-700',
  'Rejected': 'bg-red-100 text-red-700',
  'ERROR': 'bg-red-100 text-red-700',
  '503': 'bg-amber-100 text-amber-700',
}

function getZatcaStatusColor(status: string) {
  if (!status) return 'bg-gray-100 text-gray-600'
  for (const [key, val] of Object.entries(ZATCA_STATUS_COLORS)) {
    if (status.toUpperCase().includes(key.toUpperCase())) return val
  }
  return 'bg-gray-100 text-gray-600'
}

function getZatcaStatusIcon(status: string) {
  if (!status) return <Clock className="h-3.5 w-3.5" />
  const upper = status.toUpperCase()
  if (upper.includes('CLEARED') || upper.includes('REPORTED')) return <CheckCircle2 className="h-3.5 w-3.5" />
  if (upper.includes('REJECT') || upper.includes('ERROR')) return <XCircle className="h-3.5 w-3.5" />
  if (upper.includes('503')) return <AlertTriangle className="h-3.5 w-3.5" />
  return <Clock className="h-3.5 w-3.5" />
}

interface ZatcaDashboardPageProps {
  company?: string
}

export function ZatcaDashboardPage({ company }: ZatcaDashboardPageProps) {
  const { isRTL } = useI18n()
  const { toast } = useToast()
  const [dashboard, setDashboard] = useState<ZatcaDashboard | null>(null)
  const [invoices, setInvoices] = useState<InvoiceZatcaListItem[]>([])
  const [logs, setLogs] = useState<ZatcaLog[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceZatcaListItem | null>(null)
  const [invoiceDetail, setInvoiceDetail] = useState<any>(null)
  const [resubmitting, setResubmitting] = useState<string | null>(null)
  const [selectedForBulk, setSelectedForBulk] = useState<Set<string>>(new Set())
  const [bulkSending, setBulkSending] = useState(false)

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)

      const [dashData, invData, logData] = await Promise.all([
        zatcaApi.getDashboard(company),
        zatcaApi.getInvoicesStatus(100, undefined, company),
        zatcaApi.getLogs(30),
      ])

      setDashboard(dashData)
      setInvoices(invData)
      setLogs(logData)
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [company, toast])

  useEffect(() => { loadData() }, [loadData])

  const filtered = useMemo(() => {
    let r = invoices
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(i => i.name.toLowerCase().includes(q) || i.customer_name?.toLowerCase().includes(q) || i.customer?.toLowerCase().includes(q))
    }
    if (statusFilter !== 'all') {
      r = r.filter(i => (i.custom_zatca_status || 'Not Submitted') === statusFilter)
    }
    return r
  }, [invoices, search, statusFilter])

  const handleViewInvoice = async (inv: InvoiceZatcaListItem) => {
    setSelectedInvoice(inv)
    try {
      const detail = await zatcaApi.getInvoiceStatus(inv.name)
      setInvoiceDetail(detail)
    } catch (e) {
      setInvoiceDetail(null)
    }
  }

  const handleResubmit = async (invoiceName: string) => {
    setResubmitting(invoiceName)
    try {
      const result = await zatcaApi.resubmitInvoice(invoiceName)
      if (result.success) {
        toast({ title: isRTL ? 'تم' : 'Success', description: isRTL ? 'تم إعادة إرسال الفاتورة' : `Invoice ${invoiceName} resubmitted` })
        loadData(true)
      } else {
        toast({ title: 'Error', description: result.error || 'Resubmission failed', variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setResubmitting(null)
    }
  }

  // Bulk selection helpers
  const selectableInvoices = useMemo(() => {
    return filtered.slice(0, 50).filter(inv => {
      const s = (inv.custom_zatca_status || '').toUpperCase()
      return !s.includes('CLEARED') && !s.includes('REPORTED')
    })
  }, [filtered])

  const toggleBulkSelect = (name: string) => {
    setSelectedForBulk(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name); else next.add(name)
      return next
    })
  }

  const toggleSelectAll = () => {
    const allSelected = selectableInvoices.every(inv => selectedForBulk.has(inv.name))
    if (allSelected) {
      setSelectedForBulk(prev => { const next = new Set(prev); selectableInvoices.forEach(inv => next.delete(inv.name)); return next })
    } else {
      setSelectedForBulk(prev => { const next = new Set(prev); selectableInvoices.forEach(inv => next.add(inv.name)); return next })
    }
  }

  const handleBulkSend = async () => {
    const names = Array.from(selectedForBulk)
    if (!names.length) return
    setBulkSending(true)
    try {
      const result = await zatcaApi.bulkSubmitToZatca(names)
      toast({
        title: isRTL ? 'تم الإرسال لزاتكا' : 'Sent to ZATCA',
        description: isRTL
          ? `نجح: ${result.success_count} | فشل: ${result.fail_count} من أصل ${result.total}`
          : `Success: ${result.success_count} | Failed: ${result.fail_count} of ${result.total}`,
        variant: result.fail_count > 0 ? 'destructive' : 'default',
      })
      setSelectedForBulk(new Set())
      loadData(true)
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setBulkSending(false)
    }
  }

  // Print invoice with ZATCA QR (opens Frappe print view in new tab)
  const handlePrint = (inv: InvoiceZatcaListItem) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    window.open(`${origin}/printview?doctype=${encodeURIComponent('Sales Invoice')}&name=${encodeURIComponent(inv.name)}&format=ZATCA%20Tax%20Invoice&no_letterhead=0&trigger_print=1`, '_blank')
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-green-600" />
            {isRTL ? 'لوحة تحكم زاتكا' : 'ZATCA Dashboard'}
          </h1>
          <p className="text-sm text-gray-500">{isRTL ? 'حالة الفواتير الإلكترونية' : 'E-Invoice Status Overview'}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={refreshing}>
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: isRTL ? 'إجمالي' : 'Total', value: dashboard?.total_invoices || 0, icon: Receipt, color: 'text-gray-900', bg: 'bg-gray-50' },
          { label: isRTL ? 'تمت المقاصة' : 'Cleared', value: dashboard?.total_cleared || 0, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
          { label: isRTL ? 'تم الإبلاغ' : 'Reported', value: dashboard?.total_reported || 0, icon: Send, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: isRTL ? 'فشل' : 'Failed', value: dashboard?.total_failed || 0, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
          { label: isRTL ? 'معلق' : 'Pending', value: dashboard?.total_pending || 0, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((s, i) => (
          <Card key={i} className={cn('border-0 shadow-sm', s.bg)}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={cn('h-8 w-8', s.color)} />
              <div>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Invoices Table & Logs */}
      <Tabs defaultValue="invoices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="invoices" className="gap-1">
            <FileText className="h-4 w-4" />
            {isRTL ? 'الفواتير' : 'Invoices'}
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1">
            <BarChart3 className="h-4 w-4" />
            {isRTL ? 'سجل الأحداث' : 'Event Logs'}
          </TabsTrigger>
        </TabsList>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="space-y-3">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
                <Input
                  placeholder={isRTL ? 'بحث...' : 'Search invoices...'}
                  value={search} onChange={e => setSearch(e.target.value)}
                  className={cn('h-9 text-sm', isRTL ? 'pr-9' : 'pl-9')}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isRTL ? 'كل الحالات' : 'All Status'}</SelectItem>
                  <SelectItem value="CLEARED">{isRTL ? 'تمت المقاصة' : 'Cleared'}</SelectItem>
                  <SelectItem value="REPORTED">{isRTL ? 'تم الإبلاغ' : 'Reported'}</SelectItem>
                  <SelectItem value="Not Submitted">{isRTL ? 'لم يُرسل' : 'Not Submitted'}</SelectItem>
                  <SelectItem value="REJECTED">{isRTL ? 'مرفوض' : 'Rejected'}</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Bulk Action Bar */}
          {selectedForBulk.size > 0 && (
            <Card className="border-0 shadow-sm bg-blue-50">
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-blue-800">
                    {isRTL ? `تم اختيار ${selectedForBulk.size} فاتورة` : `${selectedForBulk.size} invoice(s) selected`}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedForBulk(new Set())} className="text-xs text-blue-600">
                    {isRTL ? 'إلغاء التحديد' : 'Clear'}
                  </Button>
                </div>
                <Button size="sm" onClick={handleBulkSend} disabled={bulkSending} className="bg-green-600 hover:bg-green-700 text-white gap-2">
                  {bulkSending ? <><Loader2 className="h-4 w-4 animate-spin" /> {isRTL ? 'جاري الإرسال...' : 'Sending...'}</> : <><Upload className="h-4 w-4" /> {isRTL ? 'إرسال لـ ZATCA' : 'Send to ZATCA'}</>}
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="border-0 shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50">
                  <TableHead className="w-10 text-center">
                    <Checkbox
                      checked={selectableInvoices.length > 0 && selectableInvoices.every(inv => selectedForBulk.has(inv.name))}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="text-xs font-semibold">{isRTL ? 'رقم الفاتورة' : 'Invoice'}</TableHead>
                  <TableHead className="text-xs font-semibold">{isRTL ? 'العميل' : 'Customer'}</TableHead>
                  <TableHead className="text-xs font-semibold">{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                  <TableHead className="text-xs font-semibold">{isRTL ? 'الإجمالي' : 'Total'}</TableHead>
                  <TableHead className="text-xs font-semibold">{isRTL ? 'النوع' : 'Type'}</TableHead>
                  <TableHead className="text-xs font-semibold">{isRTL ? 'حالة زاتكا' : 'ZATCA Status'}</TableHead>
                  <TableHead className="text-xs font-semibold w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-12 text-gray-400">
                    {isRTL ? 'لا توجد فواتير' : 'No invoices found'}
                  </TableCell></TableRow>
                ) : filtered.slice(0, 50).map(inv => {
                  const zatcaUpper = (inv.custom_zatca_status || '').toUpperCase()
                  const isSuccess = zatcaUpper.includes('CLEARED') || zatcaUpper.includes('REPORTED')
                  const canSelect = !isSuccess
                  return (
                  <TableRow key={inv.name} className={cn('hover:bg-gray-50/50', selectedForBulk.has(inv.name) && 'bg-blue-50/50')}>
                    <TableCell className="text-center">
                      {canSelect ? (
                        <Checkbox checked={selectedForBulk.has(inv.name)} onCheckedChange={() => toggleBulkSelect(inv.name)} />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-400 mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{inv.name}</TableCell>
                    <TableCell className="text-sm">{inv.customer_name || inv.customer}</TableCell>
                    <TableCell className="text-sm text-gray-600">{inv.posting_date}</TableCell>
                    <TableCell className="text-sm font-semibold">{inv.grand_total?.toLocaleString()} SAR</TableCell>
                    <TableCell>
                      {inv.is_return ? (
                        <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-600">{isRTL ? 'إرجاع' : 'Return'}</Badge>
                      ) : inv.custom_b2c ? (
                        <Badge variant="outline" className="text-[10px] border-purple-300 text-purple-600">B2C</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-600">B2B</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('text-[10px] gap-1', getZatcaStatusColor(inv.custom_zatca_status))}>
                        {getZatcaStatusIcon(inv.custom_zatca_status)}
                        {inv.custom_zatca_status || 'Not Submitted'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleViewInvoice(inv)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {(inv.custom_zatca_status || '').toUpperCase().includes('NOT') || !inv.custom_zatca_status || (inv.custom_zatca_status || '').toUpperCase().includes('REJECT') || (inv.custom_zatca_status || '').includes('503') ? (
                          <Button
                            variant="ghost" size="sm" className="h-7 w-7 p-0"
                            onClick={() => handleResubmit(inv.name)}
                            disabled={resubmitting === inv.name}
                          >
                            {resubmitting === inv.name
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <RotateCcw className="h-3.5 w-3.5 text-blue-600" />}
                          </Button>
                        ) : null}
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handlePrint(inv)} title={isRTL ? 'طباعة' : 'Print'}>
                          <Printer className="h-3.5 w-3.5 text-gray-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )})}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-3">
          <Card className="border-0 shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50">
                  <TableHead className="text-xs font-semibold">{isRTL ? 'الوقت' : 'Time'}</TableHead>
                  <TableHead className="text-xs font-semibold">{isRTL ? 'الفاتورة' : 'Invoice'}</TableHead>
                  <TableHead className="text-xs font-semibold">{isRTL ? 'الحالة' : 'Status'}</TableHead>
                  <TableHead className="text-xs font-semibold">{isRTL ? 'الرسالة' : 'Message'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-12 text-gray-400">
                    {isRTL ? 'لا توجد سجلات' : 'No logs found'}
                  </TableCell></TableRow>
                ) : logs.map(log => (
                  <TableRow key={log.name} className="hover:bg-gray-50/50">
                    <TableCell className="text-xs text-gray-500">{log.creation?.split('.')[0]}</TableCell>
                    <TableCell className="text-xs font-mono">{log.invoice_number || '—'}</TableCell>
                    <TableCell>
                      <Badge className={cn('text-[10px]', getZatcaStatusColor(log.status || ''))}>
                        {log.status || '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-gray-600 max-w-[300px] truncate">{log.response_message || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invoice Detail Dialog */}
      <Dialog open={!!selectedInvoice} onOpenChange={() => { setSelectedInvoice(null); setInvoiceDetail(null) }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {isRTL ? 'تفاصيل الفاتورة - زاتكا' : 'Invoice ZATCA Details'}
            </DialogTitle>
          </DialogHeader>
          {invoiceDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-2 bg-gray-50 rounded">
                  <p className="text-xs text-gray-400">{isRTL ? 'رقم الفاتورة' : 'Invoice'}</p>
                  <p className="font-mono font-medium">{invoiceDetail.name}</p>
                </div>
                <div className="p-2 bg-gray-50 rounded">
                  <p className="text-xs text-gray-400">{isRTL ? 'حالة زاتكا' : 'ZATCA Status'}</p>
                  <Badge className={cn('text-xs mt-1', getZatcaStatusColor(invoiceDetail.zatca_status))}>
                    {getZatcaStatusIcon(invoiceDetail.zatca_status)}
                    <span className="ml-1">{invoiceDetail.zatca_status || 'Not Submitted'}</span>
                  </Badge>
                </div>
                <div className="p-2 bg-gray-50 rounded">
                  <p className="text-xs text-gray-400">UUID</p>
                  <p className="font-mono text-xs break-all">{invoiceDetail.uuid || '—'}</p>
                </div>
                <div className="p-2 bg-gray-50 rounded">
                  <p className="text-xs text-gray-400">{isRTL ? 'النوع' : 'Type'}</p>
                  <p>{invoiceDetail.is_b2c ? 'B2C (Simplified)' : 'B2B (Standard)'} {invoiceDetail.is_return ? '- Return' : ''}</p>
                </div>
              </div>

              {invoiceDetail.qr_code && (
                <div className="text-center p-4 bg-white border rounded-lg">
                  <p className="text-sm font-medium mb-2 flex items-center justify-center gap-1">
                    <QrCode className="h-4 w-4" />
                    {isRTL ? 'رمز QR الإلكتروني' : 'E-Invoice QR Code'}
                  </p>
                  <img
                    src={invoiceDetail.qr_code.startsWith('data:') ? invoiceDetail.qr_code : `data:image/png;base64,${invoiceDetail.qr_code}`}
                    alt="ZATCA QR Code"
                    className="mx-auto max-w-[200px]"
                  />
                </div>
              )}

              {invoiceDetail.status_notification && (
                <div className="p-3 bg-blue-50 rounded-lg text-sm">
                  <p className="text-xs font-medium text-blue-700 mb-1">{isRTL ? 'إشعار زاتكا' : 'ZATCA Notification'}</p>
                  <p className="text-blue-600 text-xs">{invoiceDetail.status_notification}</p>
                </div>
              )}

              {invoiceDetail.zatca_response && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-700 mb-1">{isRTL ? 'الرد الكامل' : 'Full Response'}</p>
                  <pre className="text-[10px] text-gray-500 overflow-auto max-h-40 whitespace-pre-wrap">
                    {typeof invoiceDetail.zatca_response === 'string'
                      ? invoiceDetail.zatca_response
                      : JSON.stringify(invoiceDetail.zatca_response, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
