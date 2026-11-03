/**
 * Sales Invoices List - View, create, submit invoices
 */

'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { salesApi, type SalesInvoice, type Customer, type Item, localDateISO } from '@/lib/sales-api'
import { zatcaApi } from '@/lib/zatca-api'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { Search, Plus, RefreshCw, MoreVertical, Send, Loader2, Trash2, Receipt, DollarSign, Upload, CheckCircle2, XCircle, Printer } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ZatcaStatusBadge, ZatcaQRPopover, ZatcaResubmitButton } from '@/components/sales/zatca-status-badge'

const statusColors: Record<string, string> = {
  'Draft': 'bg-gray-100 text-gray-700', 'Submitted': 'bg-blue-100 text-blue-700',
  'Unpaid': 'bg-amber-100 text-amber-700', 'Paid': 'bg-emerald-100 text-emerald-700',
  'Overdue': 'bg-red-100 text-red-700', 'Cancelled': 'bg-gray-100 text-gray-500',
  'Return': 'bg-orange-100 text-orange-700', 'Credit Note Issued': 'bg-purple-100 text-purple-700',
}

export function SalesInvoicesList() {
  const { t, isRTL } = useI18n()
  const { toast } = useToast()
  const statusLabel = (s?: string | null) => {
    if (!s) return s ?? ''
    const key = 'sr.status.' + s.toLowerCase().replace(/ /g, '_')
    const v = t(key)
    return v === key ? s : v
  }
  const [invoices, setInvoices] = useState<SalesInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [zatcaFilter, setZatcaFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set())
  const [bulkSending, setBulkSending] = useState(false)
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 })
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [items, setItems] = useState<Item[]>([])
  const itemsPerPage = 20

  const [form, setForm] = useState({
    customer: '', posting_date: localDateISO(), due_date: '',
    lineItems: [{ item_code: '', qty: 1, rate: 0 }],
  })

  const loadData = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true)
      const [invData, custData, itemsData] = await Promise.all([
        salesApi.getSalesInvoices(), salesApi.getCustomers({ fields: ['name', 'customer_name'], filters: [['Customer', 'disabled', '=', 0]] }), salesApi.getItems(),
      ])
      setInvoices(invData); setCustomers(custData); setItems(itemsData)
    } catch (e) { toast({ title: t('sr.admin.common.error_title'), description: String(e), variant: 'destructive' }) }
    finally { setLoading(false); setRefreshing(false) }
  }, [toast, t])

  useEffect(() => { loadData() }, [loadData])

  const filtered = useMemo(() => {
    let r = invoices
    if (search) { const q = search.toLowerCase(); r = r.filter(i => i.name.toLowerCase().includes(q) || i.customer?.toLowerCase().includes(q) || i.customer_name?.toLowerCase().includes(q)) }
    if (statusFilter !== 'all') r = r.filter(i => i.status === statusFilter)
    if (zatcaFilter !== 'all') {
      if (zatcaFilter === 'not_submitted') r = r.filter(i => !i.custom_zatca_status || i.custom_zatca_status === 'Not Submitted')
      else if (zatcaFilter === 'cleared') r = r.filter(i => (i.custom_zatca_status || '').toUpperCase().includes('CLEARED'))
      else if (zatcaFilter === 'reported') r = r.filter(i => (i.custom_zatca_status || '').toUpperCase().includes('REPORTED'))
      else if (zatcaFilter === 'failed') r = r.filter(i => { const s = (i.custom_zatca_status || '').toUpperCase(); return s.includes('REJECT') || s.includes('ERROR') || s.includes('503') })
    }
    return r
  }, [invoices, search, statusFilter, zatcaFilter])

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const totalOutstanding = useMemo(() => invoices.reduce((sum, i) => sum + (i.outstanding_amount || 0), 0), [invoices])

  const handleCreate = async () => {
    if (!form.customer) return
    const validItems = form.lineItems.filter(i => i.item_code && i.qty > 0)
    if (!validItems.length) return
    setSaving(true)
    try {
      await salesApi.createSalesInvoice({
        customer: form.customer, posting_date: form.posting_date, due_date: form.due_date || undefined,
        items: validItems.map(i => ({ item_code: i.item_code, qty: i.qty, rate: i.rate })),
      })
      toast({ title: t('sr.admin.common.created'), description: t('sr.admin.invoices.created_desc') })
      setShowCreate(false); loadData(true)
    } catch (e: any) { toast({ title: t('sr.admin.common.error_title'), description: e.message, variant: 'destructive' }) }
    finally { setSaving(false) }
  }

  const handleSubmit = async (inv: SalesInvoice) => {
    try {
      await salesApi.submitSalesInvoice(inv.name)
      toast({ title: t('sr.admin.common.submitted_title'), description: `${inv.name}` })
      loadData(true)
    } catch (e: any) { toast({ title: t('sr.admin.common.error_title'), description: e.message, variant: 'destructive' }) }
  }

  const addLineItem = () => setForm(f => ({ ...f, lineItems: [...f.lineItems, { item_code: '', qty: 1, rate: 0 }] }))
  const removeLineItem = (idx: number) => setForm(f => ({ ...f, lineItems: f.lineItems.filter((_, i) => i !== idx) }))
  const updateLineItem = (idx: number, field: string, value: any) => setForm(f => ({ ...f, lineItems: f.lineItems.map((item, i) => i === idx ? { ...item, [field]: value } : item) }))

  // ZATCA selection helpers
  const toggleSelect = (name: string) => {
    setSelectedInvoices(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name); else next.add(name)
      return next
    })
  }

  const selectableInvoices = useMemo(() => {
    return paginated.filter(inv => {
      const s = (inv.custom_zatca_status || '').toUpperCase()
      return inv.docstatus === 1 && !s.includes('CLEARED') && !s.includes('REPORTED')
    })
  }, [paginated])

  const toggleSelectAll = () => {
    const allSelected = selectableInvoices.every(inv => selectedInvoices.has(inv.name))
    if (allSelected) {
      setSelectedInvoices(prev => {
        const next = new Set(prev)
        selectableInvoices.forEach(inv => next.delete(inv.name))
        return next
      })
    } else {
      setSelectedInvoices(prev => {
        const next = new Set(prev)
        selectableInvoices.forEach(inv => next.add(inv.name))
        return next
      })
    }
  }

  const handleBulkSendToZatca = async () => {
    const names = Array.from(selectedInvoices)
    if (!names.length) return
    setBulkSending(true)
    setBulkProgress({ done: 0, total: names.length })
    try {
      const result = await zatcaApi.bulkSubmitToZatca(names)
      setBulkProgress({ done: result.total, total: result.total })
      toast({
        title: t('sr.admin.invoices.zatca_sent'),
        description: t('sr.admin.invoices.zatca_bulk_result')
          .replace('{ok}', String(result.success_count))
          .replace('{fail}', String(result.fail_count))
          .replace('{total}', String(result.total)),
        variant: result.fail_count > 0 ? 'destructive' : 'default',
      })
      setSelectedInvoices(new Set())
      loadData(true)
    } catch (e: any) {
      toast({ title: t('sr.admin.common.error_title'), description: e.message, variant: 'destructive' })
    } finally {
      setBulkSending(false)
    }
  }

  if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-10 w-64" />{[1,2,3,4].map(i => <Skeleton key={i} className="h-14" />)}</div>

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('sr.admin.invoices.title')}</h1>
          <p className="text-sm text-gray-500">{filtered.length} {t('sr.admin.invoices.unit')}</p>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={refreshing}><RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} /></Button>
          <Button size="sm" onClick={() => { setForm({ customer: '', posting_date: localDateISO(), due_date: '', lineItems: [{ item_code: '', qty: 1, rate: 0 }] }); setShowCreate(true) }} className="bg-purple-600 hover:bg-purple-700">
            <Plus className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} /> {t('sr.admin.invoices.new_invoice')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t('sr.admin.common.total_short'), value: invoices.length, color: 'text-gray-900', isCurrency: false },
          { label: t('sr.admin.common.unpaid'), value: invoices.filter(i => i.status === 'Unpaid' || i.status === 'Overdue').length, color: 'text-amber-600', isCurrency: false },
          { label: t('sr.admin.common.paid'), value: invoices.filter(i => i.status === 'Paid').length, color: 'text-emerald-600', isCurrency: false },
          { label: t('sr.admin.invoices.outstanding_amount'), value: totalOutstanding, color: 'text-red-600', isCurrency: true },
        ].map((s, i) => (
          <Card key={i} className="border-0 shadow-sm"><CardContent className="p-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={cn('text-2xl font-bold', s.color)}>{s.isCurrency ? `${s.value.toLocaleString()} ${t('sr.admin.common.sar')}` : s.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <Card className="border-0 shadow-sm"><CardContent className="p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
          <Input placeholder={t('sr.admin.common.search')} value={search} onChange={e => setSearch(e.target.value)} className={cn('h-9 text-sm', isRTL ? 'pr-9' : 'pl-9')} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('sr.admin.common.all')}</SelectItem>
            {Object.keys(statusColors).map(s => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={zatcaFilter} onValueChange={setZatcaFilter}>
          <SelectTrigger className="w-[180px] h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('sr.admin.invoices.zatca_all')}</SelectItem>
            <SelectItem value="not_submitted">{t('sr.admin.invoices.zatca_not_submitted')}</SelectItem>
            <SelectItem value="cleared">{t('sr.admin.invoices.zatca_cleared')}</SelectItem>
            <SelectItem value="reported">{t('sr.admin.invoices.zatca_reported')}</SelectItem>
            <SelectItem value="failed">{t('sr.admin.invoices.zatca_failed')}</SelectItem>
          </SelectContent>
        </Select>
      </CardContent></Card>

      {/* Bulk Action Bar */}
      {selectedInvoices.size > 0 && (
        <Card className="border-0 shadow-sm bg-blue-50">
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-blue-800">
                {t('sr.admin.invoices.selected_count').replace('{n}', String(selectedInvoices.size))}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setSelectedInvoices(new Set())} className="text-xs text-blue-600 hover:text-blue-800">
                {t('sr.admin.invoices.clear_selection')}
              </Button>
            </div>
            <Button
              size="sm"
              onClick={handleBulkSendToZatca}
              disabled={bulkSending}
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
            >
              {bulkSending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> {t('sr.admin.invoices.sending_progress').replace('{done}', String(bulkProgress.done)).replace('{total}', String(bulkProgress.total))}</>
              ) : (
                <><Upload className="h-4 w-4" /> {t('sr.admin.invoices.send_to_zatca')}</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-sm overflow-hidden">
        <Table>
          <TableHeader><TableRow className="bg-gray-50/50">
            <TableHead className="w-10 text-center">
              <Checkbox
                checked={selectableInvoices.length > 0 && selectableInvoices.every(inv => selectedInvoices.has(inv.name))}
                onCheckedChange={toggleSelectAll}
                aria-label={t('sr.admin.invoices.select_all')}
              />
            </TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.common.id')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.common.customer')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.common.date')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.common.total')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.common.outstanding_header')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.common.status')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.invoices.zatca_col')}</TableHead>
            <TableHead className="text-xs font-semibold w-10"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-12 text-gray-400">{t('sr.admin.invoices.empty')}</TableCell></TableRow>
            ) : paginated.map(inv => {
              const zatcaUpper = (inv.custom_zatca_status || '').toUpperCase()
              const isCleared = zatcaUpper.includes('CLEARED') || zatcaUpper.includes('REPORTED')
              const canSelect = inv.docstatus === 1 && !isCleared
              return (
              <TableRow key={inv.name} className={cn('hover:bg-gray-50/50', selectedInvoices.has(inv.name) && 'bg-blue-50/50')}>
                <TableCell className="text-center">
                  {canSelect ? (
                    <Checkbox checked={selectedInvoices.has(inv.name)} onCheckedChange={() => toggleSelect(inv.name)} />
                  ) : (
                    isCleared ? <CheckCircle2 className="h-4 w-4 text-green-400 mx-auto" /> : null
                  )}
                </TableCell>
                <TableCell className="text-xs font-mono text-gray-500">{inv.name}</TableCell>
                <TableCell className="text-sm font-medium">{inv.customer_name || inv.customer}</TableCell>
                <TableCell className="text-sm text-gray-600">{inv.posting_date}</TableCell>
                <TableCell className="text-sm font-semibold">{inv.grand_total?.toLocaleString()}</TableCell>
                <TableCell className={cn('text-sm font-semibold', (inv.outstanding_amount || 0) > 0 ? 'text-red-600' : 'text-emerald-600')}>{inv.outstanding_amount?.toLocaleString() || '0'}</TableCell>
                <TableCell><Badge className={cn('text-[10px]', statusColors[inv.status] || 'bg-gray-100')}>{statusLabel(inv.status)}</Badge></TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <ZatcaStatusBadge status={inv.custom_zatca_status} />
                    <ZatcaQRPopover qrCode={inv.ksa_einv_qr} invoiceName={inv.name} zatcaStatus={inv.custom_zatca_status} />
                    <ZatcaResubmitButton invoiceName={inv.name} zatcaStatus={inv.custom_zatca_status} onSuccess={() => loadData(true)} />
                  </div>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                      {inv.docstatus === 0 && <DropdownMenuItem onClick={() => handleSubmit(inv)}><Send className="h-4 w-4 mr-2" /> {t('sr.admin.common.submit')}</DropdownMenuItem>}
                      <DropdownMenuItem onClick={() => {
                        const origin = typeof window !== 'undefined' ? window.location.origin : ''
                        window.open(`${origin}/printview?doctype=${encodeURIComponent('Sales Invoice')}&name=${encodeURIComponent(inv.name)}&format=ZATCA%20Tax%20Invoice&no_letterhead=0&trigger_print=1`, '_blank')
                      }}><Printer className="h-4 w-4 mr-2" /> {t('sr.admin.invoices.print')}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )})}
          </TableBody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{filtered.length} {t('sr.admin.invoices.unit')}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage===1}>{t('sr.admin.common.previous')}</Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage===totalPages}>{t('sr.admin.common.next')}</Button>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('sr.admin.invoices.new_si_dialog')}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('sr.admin.common.customer')} *</Label>
                <Select value={form.customer} onValueChange={v => setForm(f => ({ ...f, customer: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t('sr.admin.common.select')} /></SelectTrigger>
                  <SelectContent>{customers.map(c => <SelectItem key={c.name} value={c.name}>{c.customer_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>{t('sr.admin.invoices.invoice_date')}</Label><Input type="date" value={form.posting_date} onChange={e => setForm(f => ({ ...f, posting_date: e.target.value }))} className="mt-1" /></div>
              <div><Label>{t('sr.admin.invoices.due_date')}</Label><Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="mt-1" /></div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2"><Label>{t('sr.admin.common.items')}</Label><Button type="button" variant="outline" size="sm" onClick={addLineItem}><Plus className="h-3 w-3 mr-1" /> {t('sr.admin.common.add')}</Button></div>
              {form.lineItems.map((li, idx) => (
                <div key={idx} className="flex items-center gap-2 mb-2">
                  <Select value={li.item_code} onValueChange={v => { const item = items.find(i => i.name === v); updateLineItem(idx, 'item_code', v); if (item?.standard_rate) updateLineItem(idx, 'rate', item.standard_rate) }}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder={t('sr.admin.common.item_placeholder')} /></SelectTrigger>
                    <SelectContent>{items.map(i => <SelectItem key={i.name} value={i.name}>{i.item_name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" value={li.qty} onChange={e => updateLineItem(idx, 'qty', parseInt(e.target.value) || 1)} className="w-20" />
                  <Input type="number" value={li.rate} onChange={e => updateLineItem(idx, 'rate', parseFloat(e.target.value) || 0)} className="w-28" />
                  {form.lineItems.length > 1 && <Button variant="ghost" size="sm" onClick={() => removeLineItem(idx)}><Trash2 className="h-4 w-4 text-red-500" /></Button>}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>{t('sr.admin.common.cancel')}</Button>
            <Button onClick={handleCreate} disabled={saving} className="bg-purple-600 hover:bg-purple-700">{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} {t('sr.admin.common.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
