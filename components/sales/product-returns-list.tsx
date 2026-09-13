/**
 * Product Returns List - Manage customer product returns
 */

'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { salesApi, type ProductReturn, type SalesPerson, type Customer, type Item } from '@/lib/sales-api'
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
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { Search, Plus, RefreshCw, MoreVertical, Send, Loader2, RotateCcw, X } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

const statusColors: Record<string, string> = {
  'Draft': 'bg-gray-100 text-gray-700', 'Submitted': 'bg-blue-100 text-blue-700',
  'Accepted': 'bg-emerald-100 text-emerald-700', 'Rejected': 'bg-red-100 text-red-700',
  'Credit Note Issued': 'bg-purple-100 text-purple-700',
}

export function ProductReturnsList() {
  const { t, isRTL } = useI18n()
  const statusLabel = (s?: string) => {
    if (!s) return ''
    const key = 'sr.status.' + s.toLowerCase().replace(/ /g, '_')
    const v = t(key)
    return v === key ? s : v
  }
  const { toast } = useToast()
  const [returns, setReturns] = useState<ProductReturn[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const itemsPerPage = 20

  const [form, setForm] = useState({
    customer: '', sales_person: '', return_reason: 'Damaged' as ProductReturn['return_reason'],
    notes: '',
    items: [{ item_code: '', quantity: 1, return_reason: 'Damaged' }] as { item_code: string, quantity: number, return_reason: string }[],
  })

  const loadData = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true)
      const [returnsData, repsData, custData] = await Promise.all([
        salesApi.getProductReturns(),
        salesApi.getSalesPersons({ fields: ['name', 'sales_person_name'], filters: [['Sales Person', 'enabled', '=', 1]] }),
        salesApi.getCustomers({ fields: ['name', 'customer_name'], filters: [['Customer', 'disabled', '=', 0]] }),
      ])
      setReturns(returnsData); setSalesPersons(repsData); setCustomers(custData)
    } catch (e) { toast({ title: t('sr.admin.common.error_title'), description: String(e), variant: 'destructive' }) }
    finally { setLoading(false); setRefreshing(false) }
  }, [toast, t])

  useEffect(() => { loadData() }, [loadData])

  const filtered = useMemo(() => {
    let r = returns
    if (search) { const q = search.toLowerCase(); r = r.filter(ret => ret.name.toLowerCase().includes(q) || ret.customer?.toLowerCase().includes(q) || ret.sales_person?.toLowerCase().includes(q)) }
    if (statusFilter !== 'all') r = r.filter(ret => ret.return_status === statusFilter)
    return r
  }, [returns, search, statusFilter])

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { item_code: '', quantity: 1, return_reason: 'Damaged' }] }))
  const removeItem = (i: number) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))

  const handleCreate = async () => {
    if (!form.customer || !form.sales_person || form.items.filter(i => i.item_code).length === 0) return
    setSaving(true)
    try {
      await salesApi.createProductReturn({
        customer: form.customer, sales_person: form.sales_person,
        return_reason: form.return_reason,
        items: form.items.filter(i => i.item_code).map(i => ({ item_code: i.item_code, qty: i.quantity, rate: 0 })),
      })
      toast({ title: t('sr.admin.common.created'), description: t('sr.admin.returns.created_desc') })
      setShowCreate(false); loadData(true)
    } catch (e: any) { toast({ title: t('sr.admin.common.error_title'), description: e.message, variant: 'destructive' }) }
    finally { setSaving(false) }
  }

  const handleSubmit = async (ret: ProductReturn) => {
    try {
      await salesApi.submitProductReturn(ret.name)
      toast({ title: t('sr.admin.common.submitted_title') })
      loadData(true)
    } catch (e: any) { toast({ title: t('sr.admin.common.error_title'), description: e.message, variant: 'destructive' }) }
  }

  if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-10 w-64" />{[1, 2, 3].map(i => <Skeleton key={i} className="h-14" />)}</div>

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('sr.admin.returns.title')}</h1>
          <p className="text-sm text-gray-500">{filtered.length} {t('sr.admin.common.unit_returns')}</p>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={refreshing}><RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} /></Button>
          <Button size="sm" onClick={() => { setForm({ customer: '', sales_person: '', return_reason: 'Damaged', notes: '', items: [{ item_code: '', quantity: 1, return_reason: 'Damaged' }] }); setShowCreate(true) }} className="bg-red-600 hover:bg-red-700">
            <Plus className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} /> {t('sr.admin.returns.new_return')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: t('sr.admin.common.total_short'), value: returns.length, color: 'text-gray-900' },
          { label: t('sr.admin.common.draft'), value: returns.filter(r => r.return_status === 'Draft').length, color: 'text-gray-600' },
          { label: t('sr.admin.common.submitted_masc'), value: returns.filter(r => r.return_status === 'Submitted').length, color: 'text-blue-600' },
          { label: t('sr.admin.common.accepted'), value: returns.filter(r => r.return_status === 'Accepted').length, color: 'text-emerald-600' },
          { label: t('sr.admin.common.rejected'), value: returns.filter(r => r.return_status === 'Rejected').length, color: 'text-red-600' },
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
            <TableHead className="text-xs font-semibold">{t('sr.admin.returns.sales_rep')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.common.reason')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.common.items_products')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.common.value')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.common.status')}</TableHead>
            <TableHead className="text-xs font-semibold w-10"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-12 text-gray-400">{t('sr.admin.common.no_returns')}</TableCell></TableRow>
            ) : paginated.map(ret => (
              <TableRow key={ret.name} className="hover:bg-gray-50/50">
                <TableCell className="text-xs font-mono text-gray-500">{ret.name}</TableCell>
                <TableCell className="text-sm font-medium">{ret.customer}</TableCell>
                <TableCell className="text-sm text-gray-600">{ret.sales_person}</TableCell>
                <TableCell className="text-xs text-gray-500">{statusLabel(ret.return_reason)}</TableCell>
                <TableCell className="text-sm">{ret.items?.length || 0}</TableCell>
                <TableCell className="text-sm font-medium text-red-600">{ret.total_amount?.toLocaleString() || '—'}</TableCell>
                <TableCell><Badge className={cn('text-[10px]', statusColors[ret.return_status || ''] || 'bg-gray-100')}>{statusLabel(ret.return_status)}</Badge></TableCell>
                <TableCell>
                  {ret.return_status === 'Draft' && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                        <DropdownMenuItem onClick={() => handleSubmit(ret)}><Send className="h-4 w-4 mr-2" /> {t('sr.admin.returns.submit')}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{filtered.length} {t('sr.admin.common.unit_returns')}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>{t('sr.admin.common.previous')}</Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>{t('sr.admin.common.next')}</Button>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('sr.admin.returns.new_return_dialog')}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>{t('sr.admin.common.customer')} *</Label>
              <Select value={form.customer} onValueChange={v => setForm(f => ({ ...f, customer: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={t('sr.admin.common.select')} /></SelectTrigger>
                <SelectContent>{customers.map(c => <SelectItem key={c.name} value={c.name}>{c.customer_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('sr.admin.common.sales_person')} *</Label>
              <Select value={form.sales_person} onValueChange={v => setForm(f => ({ ...f, sales_person: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={t('sr.admin.common.select')} /></SelectTrigger>
                <SelectContent>{salesPersons.map(r => <SelectItem key={r.name} value={r.name}>{r.sales_person_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('sr.admin.returns.return_reason')}</Label>
              <Select value={form.return_reason} onValueChange={(v: any) => setForm(f => ({ ...f, return_reason: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Damaged', 'Expired', 'Wrong Item', 'Customer Rejection', 'Quality Issue'].map(r => <SelectItem key={r} value={r}>{statusLabel(r)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('sr.admin.common.notes')}</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="mt-1" rows={2} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>{t('sr.admin.common.items_products')}</Label>
                <Button variant="outline" size="sm" type="button" onClick={addItem}><Plus className="h-3 w-3 mr-1" /> {t('sr.admin.common.add')}</Button>
              </div>
              {form.items.map((item, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <Input placeholder={t('sr.admin.returns.item_code_placeholder')} value={item.item_code} onChange={e => { const items = [...form.items]; items[i].item_code = e.target.value; setForm(f => ({ ...f, items })) }} className="flex-1 h-9 text-sm" />
                  <Input type="number" min={1} value={item.quantity} onChange={e => { const items = [...form.items]; items[i].quantity = Number(e.target.value); setForm(f => ({ ...f, items })) }} className="w-20 h-9 text-sm" />
                  {form.items.length > 1 && <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-red-400" onClick={() => removeItem(i)}><X className="h-4 w-4" /></Button>}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>{t('sr.admin.common.cancel')}</Button>
            <Button onClick={handleCreate} disabled={saving} className="bg-red-600 hover:bg-red-700">{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} {t('sr.admin.common.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
