/**
 * Sales Orders List - View, create, submit, close sales orders
 */

'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { salesApi, type SalesOrder, type Item, type Customer, localDateISO } from '@/lib/sales-api'
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
import { useToast } from '@/hooks/use-toast'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Search, Plus, RefreshCw, MoreVertical, Send, XCircle, Eye, Download,
  ShoppingCart, Loader2, Trash2,
} from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

const statusColors: Record<string, string> = {
  'Draft': 'bg-gray-100 text-gray-700',
  'On Hold': 'bg-yellow-100 text-yellow-700',
  'To Deliver and Bill': 'bg-blue-100 text-blue-700',
  'To Bill': 'bg-indigo-100 text-indigo-700',
  'To Deliver': 'bg-cyan-100 text-cyan-700',
  'Completed': 'bg-emerald-100 text-emerald-700',
  'Cancelled': 'bg-red-100 text-red-700',
  'Closed': 'bg-gray-100 text-gray-600',
}

export function SalesOrdersList() {
  const { t, isRTL } = useI18n()
  const { toast } = useToast()
  const statusLabel = (s?: string | null) => {
    if (!s) return s ?? ''
    const key = 'sr.status.' + s.toLowerCase().replace(/ /g, '_')
    const v = t(key)
    return v === key ? s : v
  }
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pendingCancel, setPendingCancel] = useState<SalesOrder | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [items, setItems] = useState<Item[]>([])
  const itemsPerPage = 20

  const [form, setForm] = useState({
    customer: '', transaction_date: localDateISO(),
    delivery_date: '', order_type: 'Sales',
    lineItems: [{ item_code: '', qty: 1, rate: 0 }],
  })

  const loadData = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true)
      const [ordersData, custData, itemsData] = await Promise.all([
        salesApi.getSalesOrders(),
        salesApi.getCustomers({ fields: ['name', 'customer_name'], filters: [['Customer', 'disabled', '=', 0]] }),
        salesApi.getItems(),
      ])
      setOrders(ordersData)
      setCustomers(custData)
      setItems(itemsData)
    } catch (e) {
      toast({ title: t('sr.admin.common.error'), description: String(e), variant: 'destructive' })
    } finally { setLoading(false); setRefreshing(false) }
  }, [toast, t])

  useEffect(() => { loadData() }, [loadData])

  const filtered = useMemo(() => {
    let result = orders
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(o => o.name.toLowerCase().includes(q) || o.customer?.toLowerCase().includes(q) || o.customer_name?.toLowerCase().includes(q))
    }
    if (statusFilter !== 'all') result = result.filter(o => o.status === statusFilter)
    return result
  }, [orders, search, statusFilter])

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const handleCreate = async () => {
    if (!form.customer) { toast({ title: t('sr.admin.common.error'), description: t('sr.admin.common.select_customer_required'), variant: 'destructive' }); return }
    const validItems = form.lineItems.filter(i => i.item_code && i.qty > 0)
    if (!validItems.length) { toast({ title: t('sr.admin.common.error'), description: t('sr.admin.orders.add_one_item'), variant: 'destructive' }); return }
    setSaving(true)
    try {
      await salesApi.createSalesOrder({
        customer: form.customer, order_type: form.order_type as any,
        transaction_date: form.transaction_date, delivery_date: form.delivery_date || form.transaction_date,
        items: validItems.map(i => ({ item_code: i.item_code, qty: i.qty, rate: i.rate, delivery_date: form.delivery_date || form.transaction_date })),
      })
      toast({ title: t('sr.admin.common.created'), description: t('sr.admin.orders.created_desc') })
      setShowCreate(false)
      loadData(true)
    } catch (e: any) {
      toast({ title: t('sr.admin.common.error'), description: e.message, variant: 'destructive' })
    } finally { setSaving(false) }
  }

  const handleSubmit = async (order: SalesOrder) => {
    try {
      await salesApi.submitSalesOrder(order.name)
      toast({ title: t('sr.admin.common.submitted_title'), description: t('sr.admin.orders.submitted_desc').replace('{name}', order.name) })
      loadData(true)
    } catch (e: any) { toast({ title: t('sr.admin.common.error'), description: e.message, variant: 'destructive' }) }
  }

  const handleCancel = async (order: SalesOrder) => {
    setPendingCancel(null)
    try {
      await salesApi.cancelSalesOrder(order.name)
      toast({ title: t('sr.admin.orders.cancelled_title'), description: t('sr.admin.orders.cancelled_desc').replace('{name}', order.name) })
      loadData(true)
    } catch (e: any) { toast({ title: t('sr.admin.common.error'), description: e.message, variant: 'destructive' }) }
  }

  const addLineItem = () => setForm(f => ({ ...f, lineItems: [...f.lineItems, { item_code: '', qty: 1, rate: 0 }] }))
  const removeLineItem = (idx: number) => setForm(f => ({ ...f, lineItems: f.lineItems.filter((_, i) => i !== idx) }))
  const updateLineItem = (idx: number, field: string, value: any) => {
    setForm(f => ({
      ...f, lineItems: f.lineItems.map((item, i) => i === idx ? { ...item, [field]: value } : item)
    }))
  }

  if (loading) {
    return <div className="p-6 space-y-4"><Skeleton className="h-10 w-64" /><div className="grid grid-cols-3 gap-4">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14" />)}</div>
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('sr.admin.common.sales_orders')}</h1>
          <p className="text-sm text-gray-500">{filtered.length} {t('sr.admin.common.unit_orders')}</p>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={refreshing}>
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </Button>
          <Button size="sm" onClick={() => { setForm({ customer: '', transaction_date: localDateISO(), delivery_date: '', order_type: 'Sales', lineItems: [{ item_code: '', qty: 1, rate: 0 }] }); setShowCreate(true) }} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
            {t('sr.admin.orders.new_order')}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t('sr.admin.common.total_short'), value: orders.length, color: 'text-gray-900' },
          { label: t('sr.admin.common.draft'), value: orders.filter(o => o.docstatus === 0).length, color: 'text-gray-600' },
          { label: t('sr.admin.orders.active'), value: orders.filter(o => ['To Deliver and Bill', 'To Bill', 'To Deliver'].includes(o.status)).length, color: 'text-blue-600' },
          { label: t('sr.admin.orders.completed_fem'), value: orders.filter(o => o.status === 'Completed').length, color: 'text-emerald-600' },
        ].map((s, i) => (
          <Card key={i} className="border-0 shadow-sm"><CardContent className="p-4">
            <p className="text-xs text-gray-500">{s.label}</p><p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm"><CardContent className="p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
          <Input placeholder={t('sr.admin.common.search')} value={search} onChange={e => setSearch(e.target.value)} className={cn('h-9 text-sm', isRTL ? 'pr-9' : 'pl-9')} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] h-9 text-sm"><SelectValue placeholder={t('sr.admin.common.status')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('sr.admin.common.all')}</SelectItem>
            {Object.keys(statusColors).map(s => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
          </SelectContent>
        </Select>
      </CardContent></Card>

      {/* Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <Table>
          <TableHeader><TableRow className="bg-gray-50/50">
            <TableHead className="text-xs font-semibold">{t('sr.admin.common.id')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.common.customer')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.common.date')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.common.total')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.common.status')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.orders.delivery')}</TableHead>
            <TableHead className="text-xs font-semibold w-10"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-gray-400">{t('sr.admin.orders.empty')}</TableCell></TableRow>
            ) : paginated.map(order => (
              <TableRow key={order.name} className="hover:bg-gray-50/50">
                <TableCell className="text-xs font-mono text-gray-500">{order.name}</TableCell>
                <TableCell className="text-sm font-medium">{order.customer_name || order.customer}</TableCell>
                <TableCell className="text-sm text-gray-600">{order.transaction_date}</TableCell>
                <TableCell className="text-sm font-semibold">{order.grand_total?.toLocaleString()} {t('sr.admin.common.sar')}</TableCell>
                <TableCell><Badge className={cn('text-[10px]', statusColors[order.status] || 'bg-gray-100 text-gray-700')}>{statusLabel(order.status)}</Badge></TableCell>
                <TableCell className="text-sm text-gray-500">{order.delivery_status || '—'}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                      {order.docstatus === 0 && <DropdownMenuItem onClick={() => handleSubmit(order)}><Send className="h-4 w-4 mr-2" /> {t('sr.admin.common.submit')}</DropdownMenuItem>}
                      {order.docstatus === 1 && <DropdownMenuItem onClick={() => setPendingCancel(order)} className="text-red-600"><XCircle className="h-4 w-4 mr-2" /> {t('sr.admin.common.cancel')}</DropdownMenuItem>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{t('sr.admin.orders.pagination_showing').replace('{from}', String((currentPage-1)*itemsPerPage+1)).replace('{to}', String(Math.min(currentPage*itemsPerPage, filtered.length))).replace('{total}', String(filtered.length))}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage===1}>{t('sr.admin.common.previous')}</Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage===totalPages}>{t('sr.admin.common.next')}</Button>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('sr.admin.orders.new_so_dialog')}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('sr.admin.common.customer')} *</Label>
                <Select value={form.customer} onValueChange={v => setForm(f => ({ ...f, customer: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t('sr.admin.common.select_customer')} /></SelectTrigger>
                  <SelectContent>{customers.map(c => <SelectItem key={c.name} value={c.name}>{c.customer_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>{t('sr.admin.orders.order_date')}</Label><Input type="date" value={form.transaction_date} onChange={e => setForm(f => ({ ...f, transaction_date: e.target.value }))} className="mt-1" /></div>
              <div><Label>{t('sr.admin.orders.delivery_date')}</Label><Input type="date" value={form.delivery_date} onChange={e => setForm(f => ({ ...f, delivery_date: e.target.value }))} className="mt-1" /></div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2"><Label>{t('sr.admin.common.items')}</Label><Button type="button" variant="outline" size="sm" onClick={addLineItem}><Plus className="h-3 w-3 mr-1" /> {t('sr.admin.common.add')}</Button></div>
              {form.lineItems.map((li, idx) => (
                <div key={idx} className="flex items-center gap-2 mb-2">
                  <Select value={li.item_code} onValueChange={v => { const item = items.find(i => i.name === v); updateLineItem(idx, 'item_code', v); if (item?.standard_rate) updateLineItem(idx, 'rate', item.standard_rate) }}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder={t('sr.admin.orders.select_item')} /></SelectTrigger>
                    <SelectContent>{items.map(i => <SelectItem key={i.name} value={i.name}>{i.item_name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" value={li.qty} onChange={e => updateLineItem(idx, 'qty', parseInt(e.target.value) || 1)} className="w-20" placeholder={t('sr.admin.orders.qty_placeholder')} />
                  <Input type="number" value={li.rate} onChange={e => updateLineItem(idx, 'rate', parseFloat(e.target.value) || 0)} className="w-28" placeholder={t('sr.admin.orders.rate_placeholder')} />
                  {form.lineItems.length > 1 && <Button variant="ghost" size="sm" onClick={() => removeLineItem(idx)}><Trash2 className="h-4 w-4 text-red-500" /></Button>}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>{t('sr.admin.common.cancel')}</Button>
            <Button onClick={handleCreate} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} {t('sr.admin.common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pendingCancel}
        onOpenChange={(open) => !open && setPendingCancel(null)}
        title={t('sr.admin.orders.cancel_confirm_title')}
        description={t('sr.admin.orders.cancel_confirm_desc')}
        confirmLabel={t('sr.admin.orders.cancel_order')}
        cancelLabel={t('sr.admin.orders.go_back')}
        onConfirm={() => pendingCancel && handleCancel(pendingCancel)}
      />
    </div>
  )
}
