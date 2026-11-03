/**
 * Delivery Notes List - View all delivery notes with details
 */

'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { salesApi } from '@/lib/sales-api'
import { useI18n } from '@/lib/i18n'
import { formatSAR, formatNumber, formatDateShort } from '@/lib/sales-format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { Search, RefreshCw, Truck, Loader2, Eye } from 'lucide-react'

const statusColors: Record<string, string> = {
  'Draft': 'bg-gray-100 text-gray-700',
  'To Bill': 'bg-blue-100 text-blue-700',
  'Completed': 'bg-emerald-100 text-emerald-700',
  'Cancelled': 'bg-red-100 text-red-700',
  'Return': 'bg-orange-100 text-orange-700',
}

interface DeliveryNote {
  name: string
  customer: string
  customer_name?: string
  posting_date: string
  status: string
  docstatus: number
  grand_total: number
  total_qty: number
  set_warehouse?: string
  items?: any[]
}

export function DeliveryNotesList() {
  const { t, lang, isRTL } = useI18n()
  const statusLabel = (s: string) => {
    const key = 'sr.status.' + s.toLowerCase().replace(/ /g, '_')
    const v = t(key)
    return v === key ? s : v
  }
  const { toast } = useToast()
  const [notes, setNotes] = useState<DeliveryNote[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedNote, setSelectedNote] = useState<DeliveryNote | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const itemsPerPage = 20

  const loadData = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true)
      const data = await salesApi.getDeliveryNotes()
      setNotes(data)
    } catch (e) {
      toast({ title: t('sr.admin.common.error'), description: String(e), variant: 'destructive' })
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }, [toast, t])

  useEffect(() => { loadData() }, [loadData])

  const filtered = useMemo(() => {
    let r = notes
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(n =>
        n.name.toLowerCase().includes(q) ||
        n.customer?.toLowerCase().includes(q) ||
        n.customer_name?.toLowerCase().includes(q) ||
        n.set_warehouse?.toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'all') r = r.filter(n => n.status === statusFilter)
    return r
  }, [notes, search, statusFilter])

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const viewDetail = async (dn: DeliveryNote) => {
    setLoadingDetail(true)
    setSelectedNote(dn)
    try {
      const full = await salesApi.getDeliveryNoteById(dn.name)
      if (full) setSelectedNote(full)
    } catch (e) {
      console.error('Failed to load DN detail:', e)
    } finally {
      setLoadingDetail(false)
    }
  }

  const formatCurrency = (amount: number) => formatSAR(amount, lang)

  // Summary stats
  const stats = useMemo(() => ({
    total: notes.length,
    submitted: notes.filter(n => n.docstatus === 1).length,
    draft: notes.filter(n => n.docstatus === 0).length,
    totalValue: notes.filter(n => n.docstatus === 1).reduce((s, n) => s + (n.grand_total || 0), 0),
    totalQty: notes.filter(n => n.docstatus === 1).reduce((s, n) => s + (n.total_qty || 0), 0),
  }), [notes])

  if (loading) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20" />)}
      </div>
      {[1, 2, 3].map(i => <Skeleton key={i} className="h-14" />)}
    </div>
  )

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('sr.admin.common.delivery_notes')}</h1>
          <p className="text-sm text-gray-500">{t('sr.admin.dn.subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={refreshing}>
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: t('sr.admin.common.total_short'), value: stats.total, color: 'text-gray-900' },
          { label: t('sr.admin.common.submitted_fem'), value: stats.submitted, color: 'text-blue-600' },
          { label: t('sr.admin.common.draft'), value: stats.draft, color: 'text-gray-500' },
          { label: t('sr.admin.common.total_value'), value: formatCurrency(stats.totalValue), color: 'text-emerald-600' },
          { label: t('sr.admin.common.total_qty'), value: stats.totalQty, color: 'text-violet-600' },
        ].map((s, i) => (
          <Card key={i} className="border-0 shadow-sm"><CardContent className="p-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={cn('text-2xl font-bold', s.color)}>{typeof s.value === 'number' ? formatNumber(s.value, lang) : s.value}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm"><CardContent className="p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
          <Input placeholder={t('sr.admin.dn.search')} value={search} onChange={e => setSearch(e.target.value)} className={cn('h-9 text-sm', isRTL ? 'pr-9' : 'pl-9')} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue /></SelectTrigger>
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
            <TableHead className="text-xs font-semibold">{t('sr.admin.dn.warehouse')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.common.qty')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.common.value')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.common.status')}</TableHead>
            <TableHead className="text-xs font-semibold w-10"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-12 text-gray-400">
                <Truck className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                {t('sr.admin.dn.empty')}
              </TableCell></TableRow>
            ) : paginated.map(dn => (
              <TableRow key={dn.name} className="hover:bg-gray-50/50 cursor-pointer" onClick={() => viewDetail(dn)}>
                <TableCell className="text-xs font-mono text-gray-500">{dn.name}</TableCell>
                <TableCell className="text-sm font-medium">{dn.customer_name || dn.customer}</TableCell>
                <TableCell className="text-sm text-gray-600">{formatDateShort(dn.posting_date, lang)}</TableCell>
                <TableCell className="text-xs text-gray-500 max-w-[150px] truncate">{dn.set_warehouse || '—'}</TableCell>
                <TableCell className="text-sm font-medium">{dn.total_qty || 0}</TableCell>
                <TableCell className="text-sm font-medium text-emerald-600">{formatCurrency(dn.grand_total || 0)}</TableCell>
                <TableCell>
                  <Badge className={cn('text-[10px]', statusColors[dn.status] || 'bg-gray-100 text-gray-700')}>
                    {statusLabel(dn.status)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Eye className="h-4 w-4 text-gray-400" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{filtered.length} {t('sr.admin.dn.unit')}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>{t('sr.admin.common.previous')}</Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>{t('sr.admin.common.next')}</Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedNote} onOpenChange={(open) => { if (!open) setSelectedNote(null) }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-600" />
              {selectedNote?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedNote && (
            <div className="space-y-4">
              {/* Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500">{t('sr.admin.common.customer')}</p>
                  <p className="font-medium">{selectedNote.customer_name || selectedNote.customer}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('sr.admin.common.date')}</p>
                  <p className="font-medium">{formatDateShort(selectedNote.posting_date, lang)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('sr.admin.common.status')}</p>
                  <Badge className={cn('text-xs', statusColors[selectedNote.status] || 'bg-gray-100')}>{statusLabel(selectedNote.status)}</Badge>
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('sr.admin.dn.warehouse')}</p>
                  <p className="font-medium">{selectedNote.set_warehouse || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('sr.admin.common.total_qty')}</p>
                  <p className="font-medium">{selectedNote.total_qty || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('sr.admin.dn.grand_total')}</p>
                  <p className="font-bold text-emerald-600">{formatCurrency(selectedNote.grand_total || 0)}</p>
                </div>
              </div>

              <Separator />

              {/* Items Table */}
              <div>
                <h4 className="text-sm font-semibold mb-2">{t('sr.admin.dn.delivered_items')}</h4>
                {loadingDetail ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : selectedNote.items && selectedNote.items.length > 0 ? (
                  <Table>
                    <TableHeader><TableRow className="bg-gray-50/50">
                      <TableHead className="text-xs">{t('sr.admin.common.item')}</TableHead>
                      <TableHead className="text-xs">{t('sr.admin.common.code')}</TableHead>
                      <TableHead className="text-xs">{t('sr.admin.common.qty')}</TableHead>
                      <TableHead className="text-xs">{t('sr.admin.dn.rate')}</TableHead>
                      <TableHead className="text-xs">{t('sr.admin.common.amount')}</TableHead>
                      <TableHead className="text-xs">{t('sr.admin.dn.warehouse')}</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {selectedNote.items.map((item: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="text-sm font-medium">{item.item_name || item.item_code}</TableCell>
                          <TableCell className="text-xs font-mono text-gray-500">{item.item_code}</TableCell>
                          <TableCell className="text-sm">{item.qty} {item.uom || item.stock_uom || ''}</TableCell>
                          <TableCell className="text-sm">{formatCurrency(item.rate || 0)}</TableCell>
                          <TableCell className="text-sm font-medium">{formatCurrency(item.amount || 0)}</TableCell>
                          <TableCell className="text-xs text-gray-500 max-w-[120px] truncate">{item.warehouse || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4">{t('sr.admin.dn.no_item_details')}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
