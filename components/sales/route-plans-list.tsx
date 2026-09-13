/**
 * Route Plans List - Manage daily route plans for sales reps
 */

'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { salesApi, type DailyRoutePlan, type SalesPerson, type Customer, localDateISO } from '@/lib/sales-api'
import { useI18n } from '@/lib/i18n'
import { visitTypeLabel, formatDateShort } from '@/lib/sales-format'
import { EmptyState } from '@/components/sales/empty-state'
import type { RouteStop } from './route-map'

const RouteMap = dynamic(() => import('./route-map').then(m => m.RouteMap), { ssr: false, loading: () => <div className="h-[260px] rounded-lg bg-gray-100 animate-pulse" /> })
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
import { Search, Plus, RefreshCw, MoreVertical, Send, Loader2, Trash2, Pencil, XCircle, GripVertical, ArrowUp, ArrowDown, MapPin, Route } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

const statusColors: Record<string, string> = {
  'Draft': 'bg-gray-100 text-gray-700', 'Active': 'bg-blue-100 text-blue-700',
  'Completed': 'bg-emerald-100 text-emerald-700', 'Cancelled': 'bg-red-100 text-red-700',
}

export function RoutePlansList() {
  const { isRTL, t, lang } = useI18n()
  const statusLabel = (s: string) => t('sr.status.' + s.toLowerCase())
  const priorityLabel = (p: string) => t('sr.priority.' + p.toLowerCase())
  const { toast } = useToast()
  const [plans, setPlans] = useState<DailyRoutePlan[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [editingPlan, setEditingPlan] = useState<DailyRoutePlan | null>(null)
  const [showMap, setShowMap] = useState(false)
  const [viewingPlan, setViewingPlan] = useState<DailyRoutePlan | null>(null)
  const [viewStops, setViewStops] = useState<RouteStop[]>([])
  const [saving, setSaving] = useState(false)
  const [pendingAction, setPendingAction] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null)
  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [territories, setTerritories] = useState<string[]>([])
  const itemsPerPage = 20

  const [form, setForm] = useState({
    sales_person: '', route_date: localDateISO(), territory: '', notes: '',
    selectedCustomers: [] as string[],
    customerVisitTypes: {} as Record<string, string>,
    customerPriorities: {} as Record<string, string>,
    customerTimes: {} as Record<string, string>,
    customerDurations: {} as Record<string, number>,
    customerNotes: {} as Record<string, string>,
  })

  const loadData = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true)
      const [plansData, repsData, custData, terrData] = await Promise.all([
        salesApi.getRoutePlans(),
        salesApi.getSalesPersons({ fields: ['name', 'sales_person_name'], filters: [['Sales Person', 'enabled', '=', 1]] }),
        salesApi.getCustomers({ fields: ['name', 'customer_name', 'customer_lat', 'customer_lng'], filters: [['Customer', 'disabled', '=', 0]] }),
        salesApi.getTerritories().catch(() => []),
      ])
      setPlans(plansData); setSalesPersons(repsData); setCustomers(custData); setTerritories(terrData)
    } catch (e) { toast({ title: t('sr.admin.common.error_title'), description: String(e), variant: 'destructive' }) }
    finally { setLoading(false); setRefreshing(false) }
  }, [toast])

  useEffect(() => { loadData() }, [loadData])

  const filtered = useMemo(() => {
    let r = plans
    if (search) { const q = search.toLowerCase(); r = r.filter(p => p.name.toLowerCase().includes(q) || p.sales_person?.toLowerCase().includes(q) || p.territory?.toLowerCase().includes(q)) }
    if (statusFilter !== 'all') r = r.filter(p => p.status === statusFilter)
    return r
  }, [plans, search, statusFilter])

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  // ---- Helpers ----
  const getCustomerName = (id: string) => customers.find(c => c.name === id)?.customer_name || id

  const mapStops: RouteStop[] = useMemo(() => form.selectedCustomers.map((cId, idx) => {
    const c = customers.find(x => x.name === cId)
    return {
      customer: cId,
      customer_name: c?.customer_name || cId,
      lat: parseFloat(c?.customer_lat || '0'),
      lng: parseFloat(c?.customer_lng || '0'),
      sequence: idx + 1,
      priority: form.customerPriorities[cId],
    }
  }), [form.selectedCustomers, form.customerPriorities, customers])

  const toggleCustomer = (name: string) => {
    setForm(f => {
      if (f.selectedCustomers.includes(name)) {
        const { [name]: _vt, ...restVT } = f.customerVisitTypes
        const { [name]: _p, ...restP } = f.customerPriorities
        const { [name]: _t, ...restT } = f.customerTimes
        const { [name]: _d, ...restD } = f.customerDurations
        const { [name]: _n, ...restN } = f.customerNotes
        return { ...f, selectedCustomers: f.selectedCustomers.filter(c => c !== name), customerVisitTypes: restVT, customerPriorities: restP, customerTimes: restT, customerDurations: restD, customerNotes: restN }
      }
      return {
        ...f,
        selectedCustomers: [...f.selectedCustomers, name],
        customerVisitTypes: { ...f.customerVisitTypes, [name]: 'Regular Visit' },
        customerPriorities: { ...f.customerPriorities, [name]: 'Medium' },
        customerDurations: { ...f.customerDurations, [name]: 30 },
      }
    })
  }

  const moveCustomer = (index: number, direction: 'up' | 'down') => {
    setForm(f => {
      const arr = [...f.selectedCustomers]
      const target = direction === 'up' ? index - 1 : index + 1
      if (target < 0 || target >= arr.length) return f
      ;[arr[index], arr[target]] = [arr[target], arr[index]]
      return { ...f, selectedCustomers: arr }
    })
  }

  const removeCustomer = (name: string) => {
    setForm(f => {
      const { [name]: _vt, ...restVT } = f.customerVisitTypes
      const { [name]: _p, ...restP } = f.customerPriorities
      const { [name]: _t, ...restT } = f.customerTimes
      const { [name]: _d, ...restD } = f.customerDurations
      const { [name]: _n, ...restN } = f.customerNotes
      return { ...f, selectedCustomers: f.selectedCustomers.filter(c => c !== name), customerVisitTypes: restVT, customerPriorities: restP, customerTimes: restT, customerDurations: restD, customerNotes: restN }
    })
  }

  // ---- Handlers ----
  const handleCreate = async () => {
    if (!form.sales_person || form.selectedCustomers.length === 0) return
    setSaving(true)
    try {
      await salesApi.createRoutePlan({
        sales_person: form.sales_person, route_date: form.route_date, territory: form.territory || undefined,
        notes: form.notes || undefined,
        customers: form.selectedCustomers.map((c, i) => ({
          customer: c, sequence: i + 1,
          visit_type: (form.customerVisitTypes[c] || 'Regular Visit') as any,
          priority: (form.customerPriorities[c] || 'Medium') as any,
          ...(form.customerTimes[c] ? { scheduled_time: form.customerTimes[c].length === 5 ? `${form.customerTimes[c]}:00` : form.customerTimes[c] } : {}),
          estimated_duration_minutes: form.customerDurations[c] || 30,
          ...(form.customerNotes[c] ? { notes: form.customerNotes[c] } : {}),
        })),
      })
      toast({ title: t('sr.admin.common.created_title'), description: t('sr.admin.routes.toast_created_desc') })
      setShowCreate(false); loadData(true)
    } catch (e: any) { toast({ title: t('sr.admin.common.error_title'), description: e.message, variant: 'destructive' }) }
    finally { setSaving(false) }
  }

  const handleSubmit = (plan: DailyRoutePlan) => {
    setPendingAction({
      title: t('sr.admin.routes.confirm_activate_title').replace('{name}', plan.name),
      description: t('sr.admin.routes.confirm_activate_desc'),
      onConfirm: async () => {
        try {
          await salesApi.submitRoutePlan(plan.name)
          toast({ title: t('sr.admin.routes.toast_activated_title'), description: t('sr.admin.routes.toast_activated_desc').replace('{name}', plan.name) })
          loadData(true)
        } catch (e: any) { toast({ title: t('sr.admin.common.error_title'), description: e.message, variant: 'destructive' }) }
      },
    })
  }

  const handleEditOpen = async (plan: DailyRoutePlan) => {
    try {
      // Fetch full plan with customers child table
      const full = await salesApi.getRoutePlan(plan.name)
      if (!full) throw new Error('Plan not found')
      setEditingPlan(full)
      const sorted = (full.customers || []).sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
      setForm({
        sales_person: full.sales_person || '',
        route_date: full.route_date?.split('T')[0] || localDateISO(),
        territory: full.territory || '',
        notes: full.notes || '',
        selectedCustomers: sorted.map(c => c.customer),
        customerVisitTypes: Object.fromEntries(sorted.map(c => [c.customer, c.visit_type || 'Regular Visit'])),
        customerPriorities: Object.fromEntries(sorted.map(c => [c.customer, c.priority || 'Medium'])),
        customerTimes: Object.fromEntries(sorted.filter(c => c.scheduled_time).map(c => [c.customer, c.scheduled_time!.substring(0, 5)])),
        customerDurations: Object.fromEntries(sorted.map(c => [c.customer, c.estimated_duration_minutes || 30])),
        customerNotes: Object.fromEntries(sorted.filter(c => c.notes).map(c => [c.customer, c.notes!])),
      })
      setShowEdit(true)
    } catch (e: any) { toast({ title: t('sr.admin.common.error_title'), description: e.message, variant: 'destructive' }) }
  }

  const handleUpdate = async () => {
    if (!editingPlan || !form.sales_person || form.selectedCustomers.length === 0) return
    setSaving(true)
    try {
      await salesApi.updateRoutePlan(editingPlan.name, {
        sales_person: form.sales_person,
        route_date: form.route_date,
        territory: form.territory || undefined,
        notes: form.notes || undefined,
        customers: form.selectedCustomers.map((c, i) => ({
          customer: c, sequence: i + 1,
          visit_type: (form.customerVisitTypes[c] || 'Regular Visit') as any,
          priority: (form.customerPriorities[c] || 'Medium') as any,
          ...(form.customerTimes[c] ? { scheduled_time: form.customerTimes[c].length === 5 ? `${form.customerTimes[c]}:00` : form.customerTimes[c] } : {}),
          estimated_duration_minutes: form.customerDurations[c] || 30,
          ...(form.customerNotes[c] ? { notes: form.customerNotes[c] } : {}),
        })),
      })
      toast({ title: t('sr.admin.common.updated_title'), description: t('sr.admin.routes.toast_updated_desc') })
      setShowEdit(false); setEditingPlan(null); loadData(true)
    } catch (e: any) { toast({ title: t('sr.admin.common.error_title'), description: e.message, variant: 'destructive' }) }
    finally { setSaving(false) }
  }

  const handleCancel = (plan: DailyRoutePlan) => {
    setPendingAction({
      title: t('sr.admin.routes.confirm_cancel_title').replace('{name}', plan.name),
      description: t('sr.admin.routes.confirm_cancel_desc'),
      onConfirm: async () => {
        try {
          await salesApi.cancelRoutePlan(plan.name)
          toast({ title: t('sr.admin.routes.toast_cancelled_title'), description: t('sr.admin.routes.toast_cancelled_desc') })
          loadData(true)
        } catch (e: any) { toast({ title: t('sr.admin.common.error_title'), description: e.message, variant: 'destructive' }) }
      },
    })
  }

  const handleDelete = (plan: DailyRoutePlan) => {
    setPendingAction({
      title: t('sr.admin.common.confirm_delete_title').replace('{name}', plan.name),
      description: t('sr.admin.routes.confirm_delete_desc'),
      onConfirm: async () => {
        try {
          if (plan.docstatus === 1) {
            await salesApi.cancelRoutePlan(plan.name)
          }
          await salesApi.deleteRoutePlan(plan.name)
          toast({ title: t('sr.admin.common.deleted_title'), description: t('sr.admin.routes.toast_deleted_desc') })
          loadData(true)
        } catch (e: any) { toast({ title: t('sr.admin.common.error_title'), description: e.message, variant: 'destructive' }) }
      },
    })
  }

  const handleViewRoute = async (plan: DailyRoutePlan) => {
    try {
      const full = await salesApi.getRoutePlan(plan.name)
      if (!full) throw new Error('Plan not found')
      const sorted = (full.customers || []).sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
      const stops: RouteStop[] = sorted.map((c, idx) => {
        const cust = customers.find(x => x.name === c.customer)
        return {
          customer: c.customer,
          customer_name: c.customer_name || cust?.customer_name || c.customer,
          lat: parseFloat(cust?.customer_lat || '0'),
          lng: parseFloat(cust?.customer_lng || '0'),
          sequence: c.sequence || idx + 1,
          priority: c.priority,
        }
      })
      setViewStops(stops)
      setViewingPlan(full)
      setShowMap(true)
    } catch (e: any) { toast({ title: t('sr.admin.common.error_title'), description: e.message, variant: 'destructive' }) }
  }

  if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-10 w-64" />{[1,2,3].map(i => <Skeleton key={i} className="h-14" />)}</div>

  // ---- Customer picker shared between create & edit dialogs ----
  const visitTypes = ['Regular Visit', 'Follow-up', 'New Customer', 'Urgent']

  const priorities = ['High', 'Medium', 'Low']

  const renderCustomerPicker = () => (
    <div>
      <Label className="mb-2 block">{t('sr.admin.nav.customers')} ({form.selectedCustomers.length} {t('sr.admin.routes.selected_unit')}) *</Label>

      {/* Selected customers with ordering */}
      {form.selectedCustomers.length > 0 && (
        <div className="mb-3 border rounded-lg p-2 space-y-2">
          <p className="text-[11px] text-gray-400 px-2">{t('sr.admin.routes.visit_order_hint')}</p>
          {form.selectedCustomers.map((cId, idx) => (
            <div key={cId} className="rounded-md bg-cyan-50 text-cyan-800 text-sm">
              {/* Row 1: sequence, name, arrows, remove */}
              <div className="flex items-center gap-2 px-2 pt-1.5 pb-1">
                <GripVertical className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                <span className="font-medium text-xs bg-cyan-200 text-cyan-800 rounded-full w-5 h-5 flex items-center justify-center shrink-0">{idx + 1}</span>
                <span className="flex-1 truncate font-medium">{getCustomerName(cId)}</span>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={idx === 0} onClick={() => moveCustomer(idx, 'up')}><ArrowUp className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={idx === form.selectedCustomers.length - 1} onClick={() => moveCustomer(idx, 'down')}><ArrowDown className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-700" onClick={() => removeCustomer(cId)}><XCircle className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              {/* Row 2: visit_type, priority, time, duration */}
              <div className="flex flex-wrap items-center gap-2 px-2 pb-1.5">
                <Select value={form.customerVisitTypes[cId] || 'Regular Visit'} onValueChange={v => setForm(f => ({ ...f, customerVisitTypes: { ...f.customerVisitTypes, [cId]: v } }))}>
                  <SelectTrigger className="h-8 w-[130px] text-xs bg-white border-cyan-200"><SelectValue /></SelectTrigger>
                  <SelectContent>{visitTypes.map(vt => <SelectItem key={vt} value={vt} className="text-xs">{visitTypeLabel(t, vt)}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={form.customerPriorities[cId] || 'Medium'} onValueChange={v => setForm(f => ({ ...f, customerPriorities: { ...f.customerPriorities, [cId]: v } }))}>
                  <SelectTrigger className={cn('h-8 w-[100px] text-xs bg-white border-cyan-200', form.customerPriorities[cId] === 'High' && 'text-red-600 font-medium')}><SelectValue /></SelectTrigger>
                  <SelectContent>{priorities.map(p => <SelectItem key={p} value={p} className="text-xs">{priorityLabel(p)}</SelectItem>)}</SelectContent>
                </Select>
                <Input
                  type="time" value={form.customerTimes[cId] || ''}
                  onChange={e => setForm(f => ({ ...f, customerTimes: { ...f.customerTimes, [cId]: e.target.value } }))}
                  className="h-8 w-[110px] text-xs bg-white border-cyan-200 px-2"
                  placeholder="HH:MM"
                />
                <div className="flex items-center gap-1">
                  <Input
                    type="number" min={5} max={480} value={form.customerDurations[cId] || 30}
                    onChange={e => setForm(f => ({ ...f, customerDurations: { ...f.customerDurations, [cId]: Number(e.target.value) || 30 } }))}
                    className="h-8 w-[65px] text-xs bg-white border-cyan-200 px-2"
                  />
                  <span className="text-[11px] text-cyan-500">{t('sr.admin.routes.min_abbrev')}</span>
                </div>
              </div>
              {/* Row 3: per-stop notes */}
              <div className="px-2 pb-2">
                <Input
                  value={form.customerNotes[cId] || ''}
                  onChange={e => setForm(f => ({ ...f, customerNotes: { ...f.customerNotes, [cId]: e.target.value } }))}
                  className="h-8 text-xs bg-white border-cyan-200 px-2"
                  placeholder={t('sr.admin.routes.stop_notes_placeholder')}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Customer selection list */}
      <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
        {customers.filter(c => !form.selectedCustomers.includes(c.name)).length === 0 && form.selectedCustomers.length > 0 ? (
          <p className="text-xs text-gray-400 text-center py-2">{t('sr.admin.routes.all_customers_selected')}</p>
        ) : (
          customers.filter(c => !form.selectedCustomers.includes(c.name)).map(c => (
            <button
              key={c.name}
              type="button"
              onClick={() => toggleCustomer(c.name)}
              className="w-full flex items-center gap-2.5 text-start px-3 py-2 rounded-md text-sm transition-colors hover:bg-cyan-50/60 text-gray-600 group"
            >
              <span className="w-4 h-4 rounded border-2 border-gray-300 group-hover:border-cyan-400 flex-shrink-0 transition-colors" aria-hidden />
              <span className="flex-1 truncate">{c.customer_name}</span>
              <Plus className="h-3.5 w-3.5 text-gray-300 group-hover:text-cyan-500 flex-shrink-0" />
            </button>
          ))
        )}
      </div>
    </div>
  )

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('sr.admin.nav.route_plans')}</h1>
          <p className="text-sm text-gray-500">{filtered.length} {t('sr.admin.routes.count_unit')}</p>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={refreshing}><RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} /></Button>
          <Button size="sm" onClick={() => { setForm({ sales_person: '', route_date: localDateISO(), territory: '', notes: '', selectedCustomers: [], customerVisitTypes: {}, customerPriorities: {}, customerTimes: {}, customerDurations: {}, customerNotes: {} }); setShowCreate(true) }} className="bg-cyan-600 hover:bg-cyan-700">
            <Plus className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} /> {t('sr.admin.routes.new_btn')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t('sr.admin.common.total'), value: plans.length, color: 'text-gray-900' },
          { label: t('sr.admin.routes.stat_draft'), value: plans.filter(p => p.status === 'Draft').length, color: 'text-gray-600' },
          { label: t('sr.admin.routes.stat_active'), value: plans.filter(p => p.status === 'Active').length, color: 'text-blue-600' },
          { label: t('sr.status.completed'), value: plans.filter(p => p.status === 'Completed').length, color: 'text-emerald-600' },
        ].map((s, i) => (
          <Card key={i} className="border-0 shadow-sm"><CardContent className="p-4">
            <p className="text-xs text-gray-500">{s.label}</p><p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <Card className="border-0 shadow-sm"><CardContent className="p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
          <Input placeholder={t('sr.admin.common.search_placeholder')} value={search} onChange={e => setSearch(e.target.value)} className={cn('h-9 text-sm', isRTL ? 'pr-9' : 'pl-9')} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('sr.admin.common.all')}</SelectItem>
            {Object.keys(statusColors).map(s => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
          </SelectContent>
        </Select>
      </CardContent></Card>

      <Card className="border-0 shadow-sm overflow-hidden">
        <Table>
          <TableHeader><TableRow className="bg-gray-50/50">
            <TableHead className="text-xs font-semibold">{t('sr.admin.common.th_id')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.common.sales_rep')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.common.date')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.common.territory')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.nav.customers')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.routes.th_progress')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.common.th_status')}</TableHead>
            <TableHead className="text-xs font-semibold w-10"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow><TableCell colSpan={8}><EmptyState icon={Route} title={t('sr.admin.routes.empty')} hint={t('sr.admin.routes.empty_hint')} /></TableCell></TableRow>
            ) : paginated.map(plan => (
              <TableRow key={plan.name} className="hover:bg-gray-50/50">
                <TableCell className="text-xs font-mono text-gray-500">{plan.name}</TableCell>
                <TableCell className="text-sm font-medium">{plan.sales_person}</TableCell>
                <TableCell className="text-sm text-gray-600">{formatDateShort(plan.route_date, lang)}</TableCell>
                <TableCell className="text-sm text-gray-600">{plan.territory || '—'}</TableCell>
                <TableCell className="text-sm">{plan.total_customers}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${plan.total_customers > 0 ? (plan.visited_customers / plan.total_customers) * 100 : 0}%` }} />
                    </div>
                    <span className="text-xs text-gray-500">{plan.visited_customers}/{plan.total_customers}</span>
                  </div>
                </TableCell>
                <TableCell><Badge className={cn('text-[10px]', statusColors[plan.status] || 'bg-gray-100')}>{statusLabel(plan.status)}</Badge></TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                      {/* View Route — always available */}
                      <DropdownMenuItem onClick={() => handleViewRoute(plan)}>
                        <MapPin className="h-4 w-4 mr-2" /> {t('sr.admin.routes.view_route')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {/* Draft: Edit, Activate, Delete */}
                      {plan.status === 'Draft' && (
                        <>
                          <DropdownMenuItem onClick={() => handleEditOpen(plan)}>
                            <Pencil className="h-4 w-4 mr-2" /> {t('sr.admin.common.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSubmit(plan)}>
                            <Send className="h-4 w-4 mr-2" /> {t('sr.admin.routes.activate')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDelete(plan)} className="text-red-600 focus:text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" /> {t('sr.admin.common.delete')}
                          </DropdownMenuItem>
                        </>
                      )}
                      {/* Active / Completed: Cancel */}
                      {(plan.status === 'Active' || plan.status === 'Completed') && (
                        <DropdownMenuItem onClick={() => handleCancel(plan)} className="text-amber-600 focus:text-amber-600">
                          <XCircle className="h-4 w-4 mr-2" /> {t('sr.admin.routes.cancel_plan')}
                        </DropdownMenuItem>
                      )}
                      {/* Cancelled: Delete only */}
                      {plan.status === 'Cancelled' && (
                        <DropdownMenuItem onClick={() => handleDelete(plan)} className="text-red-600 focus:text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" /> {t('sr.admin.common.delete')}
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
          <span>{filtered.length} {t('sr.admin.routes.count_unit')}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage===1}>{t('sr.admin.common.previous')}</Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage===totalPages}>{t('sr.admin.common.next')}</Button>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('sr.admin.routes.dialog_create_title')}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>{t('sr.admin.common.sales_rep')} *</Label>
              <Select value={form.sales_person} onValueChange={v => setForm(f => ({ ...f, sales_person: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={t('sr.admin.common.select')} /></SelectTrigger>
                <SelectContent>{salesPersons.map(r => <SelectItem key={r.name} value={r.name}>{r.sales_person_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t('sr.admin.common.date')}</Label><Input type="date" value={form.route_date} onChange={e => setForm(f => ({ ...f, route_date: e.target.value }))} className="mt-1" /></div>
            <div>
              <Label>{t('sr.admin.common.territory')}</Label>
              <Select value={form.territory || 'none'} onValueChange={v => setForm(f => ({ ...f, territory: v === 'none' ? '' : v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('sr.admin.common.all')}</SelectItem>
                  {territories.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('sr.admin.routes.label_notes')}</Label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-y" placeholder={t('sr.admin.routes.notes_placeholder')} />
            </div>
            {form.selectedCustomers.length > 0 && mapStops.some(s => s.lat && s.lng) && (
              <div>
                <Label className="mb-2 block">{t('sr.admin.routes.route_map_label')}</Label>
                <RouteMap stops={mapStops} />
              </div>
            )}
            {renderCustomerPicker()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>{t('sr.admin.common.cancel')}</Button>
            <Button onClick={handleCreate} disabled={saving || form.selectedCustomers.length === 0} className="bg-cyan-600 hover:bg-cyan-700">{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} {t('sr.admin.common.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={open => { if (!open) { setShowEdit(false); setEditingPlan(null) } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('sr.admin.routes.dialog_edit_title')}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>{t('sr.admin.common.sales_rep')} *</Label>
              <Select value={form.sales_person} onValueChange={v => setForm(f => ({ ...f, sales_person: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={t('sr.admin.common.select')} /></SelectTrigger>
                <SelectContent>{salesPersons.map(r => <SelectItem key={r.name} value={r.name}>{r.sales_person_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t('sr.admin.common.date')}</Label><Input type="date" value={form.route_date} onChange={e => setForm(f => ({ ...f, route_date: e.target.value }))} className="mt-1" /></div>
            <div>
              <Label>{t('sr.admin.common.territory')}</Label>
              <Select value={form.territory || 'none'} onValueChange={v => setForm(f => ({ ...f, territory: v === 'none' ? '' : v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('sr.admin.common.all')}</SelectItem>
                  {territories.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('sr.admin.routes.label_notes')}</Label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-y" placeholder={t('sr.admin.routes.notes_placeholder')} />
            </div>
            {form.selectedCustomers.length > 0 && mapStops.some(s => s.lat && s.lng) && (
              <div>
                <Label className="mb-2 block">{t('sr.admin.routes.route_map_label')}</Label>
                <RouteMap stops={mapStops} />
              </div>
            )}
            {renderCustomerPicker()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEdit(false); setEditingPlan(null) }}>{t('sr.admin.common.cancel')}</Button>
            <Button onClick={handleUpdate} disabled={saving || form.selectedCustomers.length === 0} className="bg-cyan-600 hover:bg-cyan-700">{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} {t('sr.admin.common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Route Map Dialog */}
      <Dialog open={showMap} onOpenChange={open => { if (!open) { setShowMap(false); setViewingPlan(null); setViewStops([]) } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-cyan-600" />
              {viewingPlan?.name} — {t('sr.admin.routes.route_map_label')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Plan info summary */}
            <div className="flex flex-wrap gap-3 text-sm">
              <Badge variant="outline">{viewingPlan?.sales_person}</Badge>
              <Badge variant="outline">{viewingPlan?.route_date}</Badge>
              {viewingPlan?.territory && <Badge variant="outline">{viewingPlan.territory}</Badge>}
              <Badge className={cn('text-[10px]', statusColors[viewingPlan?.status || ''] || 'bg-gray-100')}>{viewingPlan?.status ? statusLabel(viewingPlan.status) : ''}</Badge>
            </div>

            {/* The map */}
            {viewStops.some(s => s.lat && s.lng) ? (
              <RouteMap stops={viewStops} height="360px" />
            ) : (
              <div className="h-[200px] rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 text-sm">
                <MapPin className="h-5 w-5 mr-2 opacity-50" />
                {t('sr.admin.routes.no_coords')}
              </div>
            )}

            {/* Stops list */}
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">{t('sr.admin.routes.visit_stops')} ({viewStops.length})</Label>
              {viewStops.map(s => (
                <div key={s.customer} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 text-sm">
                  <span className="font-bold text-xs bg-cyan-600 text-white rounded-full w-5 h-5 flex items-center justify-center shrink-0">{s.sequence}</span>
                  <span className="flex-1 font-medium">{s.customer_name}</span>
                  {s.priority && <Badge variant="outline" className={cn('text-[10px]', s.priority === 'High' && 'border-red-300 text-red-600', s.priority === 'Low' && 'text-gray-500')}>{priorityLabel(s.priority)}</Badge>}
                  {s.lat && s.lng ? (
                    <span className="text-[10px] text-gray-400">{s.lat.toFixed(3)}, {s.lng.toFixed(3)}</span>
                  ) : (
                    <span className="text-[10px] text-amber-500">{t('sr.admin.routes.no_coords_short')}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowMap(false); setViewingPlan(null); setViewStops([]) }}>{t('sr.admin.routes.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pendingAction}
        onOpenChange={(open) => !open && setPendingAction(null)}
        title={pendingAction?.title ?? ''}
        description={pendingAction?.description}
        confirmLabel={t('sr.admin.routes.confirm')}
        cancelLabel={t('sr.admin.common.cancel')}
        onConfirm={() => { pendingAction?.onConfirm(); setPendingAction(null) }}
      />
    </div>
  )
}
