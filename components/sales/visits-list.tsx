/**
 * Visits List - View and manage sales person visits
 */

'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { salesApi, type SalesPersonVisit, type SalesPerson, type Customer, localDateISO } from '@/lib/sales-api'
import { useI18n } from '@/lib/i18n'
import { visitTypeLabel } from '@/lib/sales-format'
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
import { Search, Plus, RefreshCw, MoreVertical, MapPin, Clock, CheckCircle, Loader2, Calendar, XCircle, AlertTriangle, Timer, Trash2, Pencil } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

const visitStatusColors: Record<string, string> = {
  'Scheduled': 'bg-blue-100 text-blue-700', 'In Progress': 'bg-amber-100 text-amber-700',
  'Completed': 'bg-emerald-100 text-emerald-700', 'Cancelled': 'bg-red-100 text-red-700',
}

/** Check if a visit's actual check-in was late (past scheduled time + grace period) */
function isVisitLate(visit: SalesPersonVisit): boolean | null {
  if (!visit.scheduled_check_in_time || !visit.check_in_time) return null // can't determine
  const dateStr = visit.visit_date.split('T')[0]
  const deadline = new Date(`${dateStr}T${visit.scheduled_check_in_time}`)
  deadline.setMinutes(deadline.getMinutes() + (visit.grace_period_minutes ?? 15))
  const actual = new Date(visit.check_in_time)
  return actual > deadline
}

export function VisitsList() {
  const { t, isRTL } = useI18n()
  const { toast } = useToast()
  const statusLabel = (s: string) => t('sr.status.' + s.toLowerCase().replace(/ /g, '_'))
  const [visits, setVisits] = useState<SalesPersonVisit[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState(localDateISO())
  const [repFilter, setRepFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [editingVisit, setEditingVisit] = useState<SalesPersonVisit | null>(null)
  const [saving, setSaving] = useState(false)
  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const itemsPerPage = 20

  const [form, setForm] = useState({
    sales_person: '', customer: '', visit_date: localDateISO(),
    visit_type: 'Sales Order' as SalesPersonVisit['visit_type'],
    scheduled_check_in_time: '',
    grace_period_minutes: 15,
  })

  const loadData = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true)
      const filters: any[] = []
      if (dateFilter) filters.push(['Sales Person Visit', 'visit_date', '=', dateFilter])

      const [visitsData, repsData, custData] = await Promise.all([
        salesApi.getVisits({ filters: filters.length ? filters : undefined, limit_page_length: 500 }),
        salesApi.getSalesPersons({ fields: ['name', 'sales_person_name'], filters: [['Sales Person', 'enabled', '=', 1]] }),
        salesApi.getCustomers({ fields: ['name', 'customer_name'], filters: [['Customer', 'disabled', '=', 0]] }),
      ])
      setVisits(visitsData); setSalesPersons(repsData); setCustomers(custData)
    } catch (e) { toast({ title: t('sr.admin.common.error_title'), description: String(e), variant: 'destructive' }) }
    finally { setLoading(false); setRefreshing(false) }
  }, [toast, dateFilter, t])

  useEffect(() => { loadData() }, [loadData])

  const filtered = useMemo(() => {
    let r = visits
    if (search) { const q = search.toLowerCase(); r = r.filter(v => v.name.toLowerCase().includes(q) || v.customer?.toLowerCase().includes(q) || v.sales_person?.toLowerCase().includes(q)) }
    if (statusFilter !== 'all') r = r.filter(v => v.visit_status === statusFilter)
    if (repFilter !== 'all') r = r.filter(v => v.sales_person === repFilter)
    return r
  }, [visits, search, statusFilter, repFilter])

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const handleCreate = async () => {
    if (!form.sales_person || !form.customer) return
    setSaving(true)
    try {
      // Time input gives HH:MM — backend expects HH:MM:SS
      const scheduledTime = form.scheduled_check_in_time
        ? (form.scheduled_check_in_time.length === 5 ? `${form.scheduled_check_in_time}:00` : form.scheduled_check_in_time)
        : undefined
      await salesApi.createVisit({
        sales_person: form.sales_person, customer: form.customer, visit_date: form.visit_date, visit_status: 'Scheduled', visit_type: form.visit_type,
        ...(scheduledTime ? { scheduled_check_in_time: scheduledTime, grace_period_minutes: form.grace_period_minutes } : {}),
      })
      toast({ title: t('sr.admin.common.created_title'), description: t('sr.admin.visits.toast_created_desc') })
      setShowCreate(false); loadData(true)
    } catch (e: any) { toast({ title: t('sr.admin.common.error_title'), description: e.message, variant: 'destructive' }) }
    finally { setSaving(false) }
  }

  const handleDelete = async (visit: SalesPersonVisit) => {
    if (!confirm(t('sr.admin.visits.confirm_delete').replace('{name}', visit.name))) return
    try {
      await salesApi.deleteVisit(visit.name)
      toast({ title: t('sr.admin.common.deleted_title'), description: t('sr.admin.visits.toast_deleted_desc') })
      loadData(true)
    } catch (e: any) {
      toast({ title: t('sr.admin.common.error_title'), description: e.message, variant: 'destructive' })
    }
  }

  const handleEditOpen = (visit: SalesPersonVisit) => {
    setEditingVisit(visit)
    setForm({
      sales_person: visit.sales_person || '',
      customer: visit.customer || '',
      visit_date: visit.visit_date?.split('T')[0] || localDateISO(),
      visit_type: visit.visit_type || 'Sales Order',
      scheduled_check_in_time: visit.scheduled_check_in_time
        ? (visit.scheduled_check_in_time.split(' ').pop()?.substring(0, 5) || visit.scheduled_check_in_time.substring(0, 5))
        : '',
      grace_period_minutes: visit.grace_period_minutes ?? 15,
    })
    setShowEdit(true)
  }

  const handleUpdate = async () => {
    if (!editingVisit || !form.sales_person || !form.customer) return
    setSaving(true)
    try {
      const scheduledTime = form.scheduled_check_in_time
        ? (form.scheduled_check_in_time.length === 5 ? `${form.scheduled_check_in_time}:00` : form.scheduled_check_in_time)
        : undefined
      await salesApi.updateVisit(editingVisit.name, {
        sales_person: form.sales_person,
        customer: form.customer,
        visit_date: form.visit_date,
        visit_type: form.visit_type,
        visit_status: editingVisit.visit_status,
        ...(scheduledTime
          ? { scheduled_check_in_time: scheduledTime, grace_period_minutes: form.grace_period_minutes }
          : { scheduled_check_in_time: '', grace_period_minutes: 15 }),
      })
      toast({ title: t('sr.admin.common.updated_title'), description: t('sr.admin.visits.toast_updated_desc') })
      setShowEdit(false)
      setEditingVisit(null)
      loadData(true)
    } catch (e: any) {
      toast({ title: t('sr.admin.common.error_title'), description: e.message, variant: 'destructive' })
    } finally { setSaving(false) }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-1.5 bg-gradient-to-r from-rose-500 via-pink-500 to-violet-500" />
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-1.5 bg-gradient-to-r from-rose-500 via-pink-500 to-violet-500" />
      <div className="p-6 space-y-5">
        <div className={cn('flex items-start justify-between gap-4', isRTL && 'flex-row-reverse')}>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">{t('sr.admin.visits.title')}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{filtered.length} {t('sr.admin.visits.count_unit')}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={refreshing} className="h-9"><RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} /></Button>
            <Button size="sm" onClick={() => { setForm({ sales_person: '', customer: '', visit_date: localDateISO(), visit_type: 'Sales Order', scheduled_check_in_time: '', grace_period_minutes: 15 }); setShowCreate(true) }} className="h-9 bg-rose-600 hover:bg-rose-700 shadow-sm shadow-rose-200">
              <Plus className={cn('h-4 w-4', isRTL ? 'ml-1.5' : 'mr-1.5')} /> {t('sr.admin.visits.new_btn')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: t('sr.admin.common.total'), value: visits.length, dot: 'bg-slate-400', bg: 'bg-slate-50' },
            { label: t('sr.admin.common.scheduled'), value: visits.filter(v => v.visit_status === 'Scheduled').length, dot: 'bg-blue-500', bg: 'bg-blue-50' },
            { label: t('sr.admin.visits.stat_in_progress'), value: visits.filter(v => v.visit_status === 'In Progress').length, dot: 'bg-amber-500', bg: 'bg-amber-50' },
            { label: t('sr.admin.common.completed'), value: visits.filter(v => v.visit_status === 'Completed').length, dot: 'bg-emerald-500', bg: 'bg-emerald-50' },
            { label: t('sr.admin.common.late_plural'), value: visits.filter(v => isVisitLate(v) === true).length, dot: 'bg-red-500', bg: 'bg-red-50' },
          ].map((s, i) => (
            <Card key={i} className="border-0 shadow-sm rounded-xl overflow-hidden">
              <CardContent className={cn('p-4', s.bg)}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn('w-2 h-2 rounded-full', s.dot)} />
                  <p className="text-[11px] font-medium text-gray-500">{s.label}</p>
                </div>
                <p className="text-2xl font-extrabold text-gray-900">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-0 shadow-sm rounded-xl"><CardContent className="p-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
            <Input placeholder={t('sr.admin.common.search_placeholder')} value={search} onChange={e => setSearch(e.target.value)} className={cn('h-9 text-sm', isRTL ? 'pr-9' : 'pl-9')} />
          </div>
          <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-[160px] h-9 text-sm" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue placeholder={t('sr.admin.common.th_status')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('sr.admin.common.all')}</SelectItem>
              {Object.keys(visitStatusColors).map(s => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={repFilter} onValueChange={setRepFilter}>
            <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue placeholder={t('sr.admin.common.sales_rep')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('sr.admin.common.all')}</SelectItem>
              {salesPersons.map(r => <SelectItem key={r.name} value={r.name}>{r.sales_person_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent></Card>

        <Card className="border-0 shadow-sm overflow-hidden rounded-xl">
          <Table>
            <TableHeader><TableRow className="bg-gray-50 border-b border-gray-100">
              <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{t('sr.admin.common.th_id')}</TableHead>
              <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{t('sr.admin.common.sales_rep')}</TableHead>
              <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{t('sr.admin.common.customer')}</TableHead>
              <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{t('sr.admin.common.th_type')}</TableHead>
              <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{t('sr.admin.visits.th_scheduled_time')}</TableHead>
              <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{t('sr.admin.visits.th_checkin')}</TableHead>
              <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{t('sr.admin.visits.th_duration')}</TableHead>
              <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{t('sr.admin.visits.th_order')}</TableHead>
              <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{t('sr.admin.common.th_status')}</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-16">
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                      <MapPin className="h-7 w-7 text-gray-300" />
                    </div>
                    <p className="text-sm font-medium">{t('sr.admin.visits.empty_title')}</p>
                    <p className="text-xs text-gray-400">{t('sr.admin.visits.empty_hint')}</p>
                  </div>
                </TableCell></TableRow>
              ) : paginated.map(visit => (
                <TableRow key={visit.name} className="hover:bg-slate-50/60 transition-colors duration-100">
                  <TableCell className="text-[11px] font-mono text-gray-400">{visit.name.slice(-8)}</TableCell>
                  <TableCell className="text-sm font-semibold text-gray-900">{visit.sales_person}</TableCell>
                  <TableCell className="text-sm text-gray-600">{visit.customer}</TableCell>
                  <TableCell className="text-[11px] text-gray-500 max-w-[100px] truncate">{visitTypeLabel(t, visit.visit_type)}</TableCell>
                  <TableCell className="text-xs">
                    {visit.scheduled_check_in_time ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-gray-700 font-medium flex items-center gap-1"><Timer className="h-3 w-3 text-slate-400" />{visit.scheduled_check_in_time.split(' ').pop()?.substring(0, 5) || visit.scheduled_check_in_time}</span>
                        {visit.grace_period_minutes ? <span className="text-[10px] text-gray-400">±{visit.grace_period_minutes}{t('sr.admin.visits.minutes_abbrev')}</span> : null}
                      </div>
                    ) : <span className="text-gray-300">—</span>}
                  </TableCell>
                  <TableCell className="text-xs">
                    {visit.check_in_time ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-700 font-medium">{visit.check_in_time.split(' ')[1]?.substring(0, 5)}</span>
                        {visit.is_within_radius ? <MapPin className="h-3 w-3 text-emerald-500" /> : null}
                        {(() => {
                          const late = isVisitLate(visit)
                          if (late === true) return <Badge className="text-[9px] px-1.5 py-0 bg-red-50 text-red-600 border border-red-200 hover:bg-red-50 gap-0.5"><AlertTriangle className="h-2.5 w-2.5" />{t('sr.admin.common.late')}</Badge>
                          if (late === false) return <Badge className="text-[9px] px-1.5 py-0 bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-50 gap-0.5"><CheckCircle className="h-2.5 w-2.5" />{t('sr.admin.visits.on_time')}</Badge>
                          return null
                        })()}
                      </div>
                    ) : <span className="text-gray-300">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{visit.visit_duration ? `${visit.visit_duration.toFixed(1)}h` : '—'}</TableCell>
                  <TableCell>{visit.has_order ? <Badge className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50 truncate max-w-[80px]">{visit.sales_order || 'Yes'}</Badge> : <span className="text-gray-300 text-xs">—</span>}</TableCell>
                  <TableCell>
                    <Badge className={cn('text-[10px] border font-semibold gap-1',
                      visit.visit_status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        visit.visit_status === 'In Progress' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          visit.visit_status === 'Scheduled' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            'bg-gray-100 text-gray-600 border-gray-200'
                    )}>
                      <span className={cn('w-1.5 h-1.5 rounded-full',
                        visit.visit_status === 'Completed' ? 'bg-emerald-500' :
                          visit.visit_status === 'In Progress' ? 'bg-amber-500' :
                            visit.visit_status === 'Scheduled' ? 'bg-blue-500' : 'bg-gray-400'
                      )} />
                      {statusLabel(visit.visit_status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg hover:bg-gray-100"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                        <DropdownMenuItem onClick={() => handleEditOpen(visit)}>
                          <Pencil className="h-4 w-4 mr-2" /> {t('sr.admin.common.edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(visit)} className="text-red-600 focus:text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" /> {t('sr.admin.common.delete')}
                        </DropdownMenuItem>
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
            <span>{filtered.length} {t('sr.admin.visits.count_unit')}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>{t('sr.admin.common.previous')}</Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>{t('sr.admin.common.next')}</Button>
            </div>
          </div>
        )}

        {/* Create Dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{t('sr.admin.visits.dialog_schedule_title')}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div>
                <Label>{t('sr.admin.common.sales_rep')} *</Label>
                <Select value={form.sales_person} onValueChange={v => setForm(f => ({ ...f, sales_person: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t('sr.admin.common.select')} /></SelectTrigger>
                  <SelectContent>{salesPersons.map(r => <SelectItem key={r.name} value={r.name}>{r.sales_person_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('sr.admin.common.customer')} *</Label>
                <Select value={form.customer} onValueChange={v => setForm(f => ({ ...f, customer: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t('sr.admin.common.select')} /></SelectTrigger>
                  <SelectContent>{customers.map(c => <SelectItem key={c.name} value={c.name}>{c.customer_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('sr.admin.common.date')}</Label>
                <Input type="date" value={form.visit_date} onChange={e => setForm(f => ({ ...f, visit_date: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="flex items-center gap-1.5"><Timer className="h-3.5 w-3.5" />{t('sr.admin.visits.label_scheduled_time')}</Label>
                <Input type="time" value={form.scheduled_check_in_time} onChange={e => setForm(f => ({ ...f, scheduled_check_in_time: e.target.value }))} className="mt-1" />
                <p className="text-[11px] text-gray-400 mt-1">{t('sr.admin.visits.scheduled_time_hint')}</p>
              </div>
              {form.scheduled_check_in_time && (
                <div>
                  <Label className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{t('sr.admin.visits.label_grace_period')}</Label>
                  <Select value={String(form.grace_period_minutes)} onValueChange={v => setForm(f => ({ ...f, grace_period_minutes: Number(v) }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[0, 5, 10, 15, 20, 30, 45, 60].map(m => (
                        <SelectItem key={m} value={String(m)}>{m === 0 ? t('sr.admin.visits.no_grace') : `${m} ${t('sr.admin.visits.minutes_unit')}`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {t('sr.admin.visits.grace_hint').replace('{time}', form.scheduled_check_in_time).replace('{minutes}', String(form.grace_period_minutes))}
                  </p>
                </div>
              )}
              <div>
                <Label>{t('sr.admin.common.th_type')}</Label>
                <Select value={form.visit_type} onValueChange={(v: any) => setForm(f => ({ ...f, visit_type: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Sales Order', 'Follow-up', 'Stock Check', 'Product Return', 'No Order - Visit Only'].map(vt => <SelectItem key={vt} value={vt}>{visitTypeLabel(t, vt)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>{t('sr.admin.common.cancel')}</Button>
              <Button onClick={handleCreate} disabled={saving} className="bg-rose-600 hover:bg-rose-700">{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} {t('sr.admin.visits.schedule_btn')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={showEdit} onOpenChange={open => { if (!open) { setShowEdit(false); setEditingVisit(null) } }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{t('sr.admin.visits.dialog_edit_title')}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div>
                <Label>{t('sr.admin.common.sales_rep')} *</Label>
                <Select value={form.sales_person} onValueChange={v => setForm(f => ({ ...f, sales_person: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t('sr.admin.common.select')} /></SelectTrigger>
                  <SelectContent>{salesPersons.map(r => <SelectItem key={r.name} value={r.name}>{r.sales_person_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('sr.admin.common.customer')} *</Label>
                <Select value={form.customer} onValueChange={v => setForm(f => ({ ...f, customer: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t('sr.admin.common.select')} /></SelectTrigger>
                  <SelectContent>{customers.map(c => <SelectItem key={c.name} value={c.name}>{c.customer_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('sr.admin.common.date')}</Label>
                <Input type="date" value={form.visit_date} onChange={e => setForm(f => ({ ...f, visit_date: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="flex items-center gap-1.5"><Timer className="h-3.5 w-3.5" />{t('sr.admin.visits.label_scheduled_time')}</Label>
                <Input type="time" value={form.scheduled_check_in_time} onChange={e => setForm(f => ({ ...f, scheduled_check_in_time: e.target.value }))} className="mt-1" />
                <p className="text-[11px] text-gray-400 mt-1">{t('sr.admin.visits.scheduled_time_hint')}</p>
              </div>
              {form.scheduled_check_in_time && (
                <div>
                  <Label className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{t('sr.admin.visits.label_grace_period')}</Label>
                  <Select value={String(form.grace_period_minutes)} onValueChange={v => setForm(f => ({ ...f, grace_period_minutes: Number(v) }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[0, 5, 10, 15, 20, 30, 45, 60].map(m => (
                        <SelectItem key={m} value={String(m)}>{m === 0 ? t('sr.admin.visits.no_grace') : `${m} ${t('sr.admin.visits.minutes_unit')}`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>{t('sr.admin.common.th_type')}</Label>
                <Select value={form.visit_type} onValueChange={(v: any) => setForm(f => ({ ...f, visit_type: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Sales Order', 'Follow-up', 'Stock Check', 'Product Return', 'No Order - Visit Only'].map(vt => <SelectItem key={vt} value={vt}>{visitTypeLabel(t, vt)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {editingVisit?.visit_status && editingVisit.visit_status !== 'Completed' && (
                <div>
                  <Label>{t('sr.admin.common.th_status')}</Label>
                  <Select value={editingVisit.visit_status} onValueChange={v => setEditingVisit(prev => prev ? { ...prev, visit_status: v as SalesPersonVisit['visit_status'] } : null)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['Scheduled', 'In Progress', 'Cancelled'].map(s => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowEdit(false); setEditingVisit(null) }}>{t('sr.admin.common.cancel')}</Button>
              <Button onClick={handleUpdate} disabled={saving} className="bg-rose-600 hover:bg-rose-700">{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} {t('sr.admin.common.save')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
