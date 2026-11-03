/**
 * Quotations List - Manage quotations, convert to SO
 */

'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { salesApi, type Quotation, type Customer, type Item, localDateISO } from '@/lib/sales-api'
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
import { Search, Plus, RefreshCw, MoreVertical, ArrowRight, Loader2, Trash2, FileText } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

const statusColors: Record<string, string> = {
  'Draft': 'bg-gray-100 text-gray-700', 'Open': 'bg-blue-100 text-blue-700',
  'Replied': 'bg-cyan-100 text-cyan-700', 'Partially Ordered': 'bg-amber-100 text-amber-700',
  'Ordered': 'bg-emerald-100 text-emerald-700', 'Lost': 'bg-red-100 text-red-700',
  'Cancelled': 'bg-gray-100 text-gray-500', 'Expired': 'bg-orange-100 text-orange-700',
}

export function QuotationsList() {
  const { t, isRTL } = useI18n()
  const statusLabel = (s?: string) => {
    if (!s) return ''
    const key = 'sr.status.' + s.toLowerCase().replace(/ /g, '_')
    const v = t(key)
    return v === key ? s : v
  }
  const { toast } = useToast()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [items, setItems] = useState<Item[]>([])
  const itemsPerPage = 20

  const [form, setForm] = useState({
    party_name: '', transaction_date: localDateISO(),
    valid_till: '', lineItems: [{ item_code: '', qty: 1, rate: 0 }],
  })

  const loadData = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true)
      const [qData, custData, itemsData] = await Promise.all([
        salesApi.getQuotations(), salesApi.getCustomers({ fields: ['name', 'customer_name'], filters: [['Customer', 'disabled', '=', 0]] }), salesApi.getItems(),
      ])
      setQuotations(qData); setCustomers(custData); setItems(itemsData)
    } catch (e) { toast({ title: t('sr.admin.common.error_title'), description: String(e), variant: 'destructive' }) }
    finally { setLoading(false); setRefreshing(false) }
  }, [toast, t])

  useEffect(() => { loadData() }, [loadData])

  const filtered = useMemo(() => {
    let r = quotations
    if (search) { const q = search.toLowerCase(); r = r.filter(q2 => q2.name.toLowerCase().includes(q) || q2.party_name?.toLowerCase().includes(q)) }
    if (statusFilter !== 'all') r = r.filter(q2 => q2.status === statusFilter)
    return r
  }, [quotations, search, statusFilter])

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const handleCreate = async () => {
    if (!form.party_name) return
    const validItems = form.lineItems.filter(i => i.item_code && i.qty > 0)
    if (!validItems.length) return
    setSaving(true)
    try {
      await salesApi.createQuotation({
        quotation_to: 'Customer', party_name: form.party_name,
        transaction_date: form.transaction_date, valid_till: form.valid_till || undefined,
        items: validItems.map(i => ({ item_code: i.item_code, qty: i.qty, rate: i.rate })),
      })
      toast({ title: t('sr.admin.common.created'), description: t('sr.admin.quotes.created_desc') })
      setShowCreate(false); loadData(true)
    } catch (e: any) { toast({ title: t('sr.admin.common.error_title'), description: e.message, variant: 'destructive' }) }
    finally { setSaving(false) }
  }

  const handleConvert = async (q: Quotation) => {
    try {
      await salesApi.convertQuotationToSO(q.name)
      toast({ title: t('sr.admin.quotes.converted_title'), description: t('sr.admin.quotes.converted_desc').replace('{name}', q.name) })
      loadData(true)
    } catch (e: any) { toast({ title: t('sr.admin.common.error_title'), description: e.message, variant: 'destructive' }) }
  }

  const addLineItem = () => setForm(f => ({ ...f, lineItems: [...f.lineItems, { item_code: '', qty: 1, rate: 0 }] }))
  const removeLineItem = (idx: number) => setForm(f => ({ ...f, lineItems: f.lineItems.filter((_, i) => i !== idx) }))
  const updateLineItem = (idx: number, field: string, value: any) => setForm(f => ({ ...f, lineItems: f.lineItems.map((item, i) => i === idx ? { ...item, [field]: value } : item) }))

  if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-10 w-64" />{[1,2,3,4].map(i => <Skeleton key={i} className="h-14" />)}</div>

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('sr.admin.common.quotations')}</h1>
          <p className="text-sm text-gray-500">{filtered.length} {t('sr.admin.quotes.unit')}</p>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={refreshing}><RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} /></Button>
          <Button size="sm" onClick={() => { setForm({ party_name: '', transaction_date: localDateISO(), valid_till: '', lineItems: [{ item_code: '', qty: 1, rate: 0 }] }); setShowCreate(true) }} className="bg-amber-600 hover:bg-amber-700">
            <Plus className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} /> {t('sr.admin.quotes.new_quotation')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t('sr.admin.common.total_short'), value: quotations.length, color: 'text-gray-900' },
          { label: t('sr.admin.quotes.open'), value: quotations.filter(q => q.status === 'Open' || q.status === 'Draft').length, color: 'text-blue-600' },
          { label: t('sr.admin.quotes.ordered'), value: quotations.filter(q => q.status === 'Ordered').length, color: 'text-emerald-600' },
          { label: t('sr.admin.quotes.lost'), value: quotations.filter(q => q.status === 'Lost').length, color: 'text-red-600' },
        ].map((s, i) => (
          <Card key={i} className="border-0 shadow-sm"><CardContent className="p-4">
            <p className="text-xs text-gray-500">{s.label}</p><p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
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
      </CardContent></Card>

      <Card className="border-0 shadow-sm overflow-hidden">
        <Table>
          <TableHeader><TableRow className="bg-gray-50/50">
            <TableHead className="text-xs font-semibold">{t('sr.admin.common.id')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.common.customer')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.common.date')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.quotes.valid_till')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.common.total')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.common.status')}</TableHead>
            <TableHead className="text-xs font-semibold w-10"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-gray-400">{t('sr.admin.quotes.empty')}</TableCell></TableRow>
            ) : paginated.map(q => (
              <TableRow key={q.name} className="hover:bg-gray-50/50">
                <TableCell className="text-xs font-mono text-gray-500">{q.name}</TableCell>
                <TableCell className="text-sm font-medium">{q.party_name}</TableCell>
                <TableCell className="text-sm text-gray-600">{q.transaction_date}</TableCell>
                <TableCell className="text-sm text-gray-600">{q.valid_till || '—'}</TableCell>
                <TableCell className="text-sm font-semibold">{q.grand_total?.toLocaleString()} {t('sr.admin.common.sar')}</TableCell>
                <TableCell><Badge className={cn('text-[10px]', statusColors[q.status] || 'bg-gray-100')}>{statusLabel(q.status)}</Badge></TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                      {(q.status === 'Open' || q.status === 'Draft') && (
                        <DropdownMenuItem onClick={() => handleConvert(q)}>
                          <ArrowRight className="h-4 w-4 mr-2" /> {t('sr.admin.quotes.convert_to_so')}
                        </DropdownMenuItem>
                      )}
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
          <span>{filtered.length} {t('sr.admin.quotes.unit_items')}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage===1}>{t('sr.admin.common.previous')}</Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage===totalPages}>{t('sr.admin.common.next')}</Button>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('sr.admin.quotes.new_quotation_dialog')}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('sr.admin.common.customer')} *</Label>
                <Select value={form.party_name} onValueChange={v => setForm(f => ({ ...f, party_name: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t('sr.admin.quotes.select_customer_short')} /></SelectTrigger>
                  <SelectContent>{customers.map(c => <SelectItem key={c.name} value={c.name}>{c.customer_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>{t('sr.admin.common.date')}</Label><Input type="date" value={form.transaction_date} onChange={e => setForm(f => ({ ...f, transaction_date: e.target.value }))} className="mt-1" /></div>
              <div><Label>{t('sr.admin.quotes.valid_till')}</Label><Input type="date" value={form.valid_till} onChange={e => setForm(f => ({ ...f, valid_till: e.target.value }))} className="mt-1" /></div>
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
            <Button onClick={handleCreate} disabled={saving} className="bg-amber-600 hover:bg-amber-700">{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} {t('sr.admin.common.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
