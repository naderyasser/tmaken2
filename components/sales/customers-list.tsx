/**
 * Customers List - Full CRUD for Customer management
 */

'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  salesApi, customerGroupLabel, customerClassification,
  customerClassificationLabel, customerClassificationBadgeClass, type Customer,
} from '@/lib/sales-api'
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
  Search, UserPlus, RefreshCw, MoreVertical, Edit, Trash2, Eye,
  MapPin, Users, Download, Filter, Building2, Loader2, ChevronsUpDown, Check,
} from 'lucide-react'
import dynamic from 'next/dynamic'
const LocationPickerMap = dynamic(() => import('@/components/sales/location-picker-map').then(m => m.LocationPickerMap), { ssr: false, loading: () => <div className="h-[280px] rounded-lg bg-gray-100 animate-pulse" /> })
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'

export function CustomersList() {
  const { t, isRTL } = useI18n()
  const { toast } = useToast()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [territoryFilter, setTerritoryFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('active')
  const [classificationFilter, setClassificationFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [showDialog, setShowDialog] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Customer | null>(null)
  const [territories, setTerritories] = useState<string[]>([])
  const [customerGroups, setCustomerGroups] = useState<string[]>([])
  const [salesPersons, setSalesPersons] = useState<{ name: string, sales_person_name: string }[]>([])
  const itemsPerPage = 20

  // Form state
  const [form, setForm] = useState({
    customer_name: '', customer_type: 'Company' as Customer['customer_type'],
    customer_group: '', territory: '', tax_id: '',
    primary_sales_person: '', customer_lat: '', customer_lng: '',
    visit_frequency_days: 7,
    // ZATCA fields
    zatca_customer_name_in_arabic: '', custom_b2c: 0, custom_buyer_id_type: '', custom_buyer_id: '',
  })

  const loadData = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true)
      const [custData, terr, groups, reps] = await Promise.all([
        salesApi.getCustomers(),
        salesApi.getTerritories().catch(() => []),
        salesApi.getCustomerGroups().catch(() => []),
        salesApi.getSalesPersons({ fields: ['name', 'sales_person_name'], filters: [['Sales Person', 'enabled', '=', 1]] }).catch(() => []),
      ])
      setCustomers(custData)
      setTerritories(terr)
      setCustomerGroups(groups)
      setSalesPersons(reps as any)
    } catch (e) {
      toast({ title: t('sr.admin.common.error_title'), description: t('sr.admin.customers.err_load_failed'), variant: 'destructive' })
    } finally { setLoading(false); setRefreshing(false) }
  }, [toast, t])

  useEffect(() => { loadData() }, [loadData])

  const filtered = useMemo(() => {
    let result = customers
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) || c.customer_name.toLowerCase().includes(q) ||
        c.territory?.toLowerCase().includes(q) || c.customer_group?.toLowerCase().includes(q) ||
        c.primary_sales_person?.toLowerCase().includes(q)
      )
    }
    if (territoryFilter !== 'all') result = result.filter(c => c.territory === territoryFilter)
    if (groupFilter !== 'all') result = result.filter(c => c.customer_group === groupFilter)
    if (statusFilter === 'active') result = result.filter(c => !c.disabled)
    else if (statusFilter === 'disabled') result = result.filter(c => c.disabled)
    if (classificationFilter !== 'all') result = result.filter(c => customerClassification(c) === classificationFilter)
    return result
  }, [customers, search, territoryFilter, groupFilter, statusFilter, classificationFilter])

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  useEffect(() => { setCurrentPage(1) }, [search, territoryFilter, groupFilter, statusFilter, classificationFilter])

  const openCreate = () => {
    setNameError(false)
    setEditingCustomer(null)
    setForm({ customer_name: '', customer_type: 'Company', customer_group: '', territory: '', tax_id: '', primary_sales_person: '', customer_lat: '', customer_lng: '', visit_frequency_days: 7, zatca_customer_name_in_arabic: '', custom_b2c: 0, custom_buyer_id_type: '', custom_buyer_id: '' })
    setShowDialog(true)
  }

  const openEdit = async (customer: Customer) => {
    setNameError(false)
    setEditingCustomer(customer)
    setForm({
      customer_name: customer.customer_name || '',
      customer_type: customer.customer_type || 'Company',
      customer_group: customer.customer_group || '',
      territory: customer.territory || '',
      tax_id: customer.tax_id || '',
      primary_sales_person: customer.primary_sales_person || '',
      customer_lat: customer.customer_lat || '',
      customer_lng: customer.customer_lng || '',
      visit_frequency_days: customer.visit_frequency_days || 7,
      zatca_customer_name_in_arabic: customer.zatca_customer_name_in_arabic || '',
      custom_b2c: customer.custom_b2c || 0,
      custom_buyer_id_type: customer.custom_buyer_id_type || '',
      custom_buyer_id: customer.custom_buyer_id || '',
    })
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!form.customer_name.trim()) {
      setNameError(true)
      toast({ title: t('sr.admin.common.error_title'), description: t('sr.admin.customers.err_name_required'), variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      if (editingCustomer) {
        await salesApi.updateCustomer(editingCustomer.name, form as any)
        toast({ title: t('sr.admin.customers.toast_updated_title'), description: t('sr.admin.customers.toast_updated_desc') })
      } else {
        await salesApi.createCustomer(form as any)
        toast({ title: t('sr.admin.customers.toast_created_title'), description: t('sr.admin.customers.toast_created_desc') })
      }
      setShowDialog(false)
      loadData(true)
    } catch (e: any) {
      toast({ title: t('sr.admin.common.error_title'), description: e.message || 'Failed', variant: 'destructive' })
    } finally { setSaving(false) }
  }

  const handleDelete = async (customer: Customer) => {
    setPendingDelete(null)
    const ok = await salesApi.deleteCustomer(customer.name)
    if (ok) {
      toast({ title: t('sr.admin.common.deleted_title_alt'), description: t('sr.admin.customers.toast_deleted_desc') })
      loadData(true)
    } else {
      toast({ title: t('sr.admin.common.error_title'), description: t('sr.admin.customers.err_delete_failed'), variant: 'destructive' })
    }
  }

  const exportCSV = () => {
    const escape = (v: string | number | null | undefined) => {
      const s = v == null ? '' : String(v)
      if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return '"' + s.replace(/"/g, '""') + '"'
      }
      return s
    }
    const headers = ['ID', 'Name', 'Type', 'Group', 'Classification', 'Territory', 'Sales Person', 'Tax ID']
    const rows = filtered.map(c => [escape(c.name), escape(c.customer_name), escape(c.customer_type), escape(c.customer_group), escape(customerClassification(c)), escape(c.territory), escape(c.primary_sales_person), escape(c.tax_id)].join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'customers.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        <Skeleton className="h-12 rounded-xl" />
        {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('sr.admin.nav.customers')}</h1>
          <p className="text-sm text-gray-500">{`${filtered.length} ${t('sr.admin.customers.count_unit')}`}</p>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={refreshing}>
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700">
            <UserPlus className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
            {t('sr.admin.customers.new_btn')}
          </Button>
        </div>
      </div>

      {/* Stats — computed from the CURRENT filtered set so they follow search/filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="p-4">
          <p className="text-xs text-gray-500">{t('sr.admin.common.total')}</p>
          <p className="text-2xl font-bold text-gray-900">{filtered.length}</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4">
          <p className="text-xs text-gray-500">{t('sr.admin.common.active')}</p>
          <p className="text-2xl font-bold text-emerald-600">{filtered.filter(c => !c.disabled).length}</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4">
          <p className="text-xs text-gray-500">{t('sr.admin.customers.stat_with_gps')}</p>
          <p className="text-2xl font-bold text-blue-600">{filtered.filter(c => c.customer_lat && c.customer_lng).length}</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4">
          <p className="text-xs text-gray-500">{t('sr.admin.customers.stat_assigned_rep')}</p>
          <p className="text-2xl font-bold text-indigo-600">{filtered.filter(c => c.primary_sales_person).length}</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
              <Input
                placeholder={t('sr.admin.customers.search_placeholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn('h-9 text-sm', isRTL ? 'pr-9' : 'pl-9')}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('sr.admin.common.all')}</SelectItem>
                <SelectItem value="active">{t('sr.admin.common.active')}</SelectItem>
                <SelectItem value="disabled">{t('sr.admin.common.disabled')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={territoryFilter} onValueChange={setTerritoryFilter}>
              <SelectTrigger className="w-[150px] h-9 text-sm"><SelectValue placeholder={t('sr.admin.common.territory')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('sr.admin.customers.all_territories')}</SelectItem>
                {territories.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="w-[150px] h-9 text-sm"><SelectValue placeholder={t('sr.admin.customers.group')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('sr.admin.customers.all_groups')}</SelectItem>
                {customerGroups.map(g => <SelectItem key={g} value={g}>{customerGroupLabel(t, g)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={classificationFilter} onValueChange={setClassificationFilter}>
              <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue placeholder={t('sr.admin.customers.th_classification')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('sr.admin.customers.all_classifications')}</SelectItem>
                {(['Potential', 'Active', 'Dead'] as const).map(v => (
                  <SelectItem key={v} value={v}>{customerClassificationLabel(t, v)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/50">
              <TableHead className="text-xs font-semibold">{t('sr.admin.customers.th_id')}</TableHead>
              <TableHead className="text-xs font-semibold">{t('sr.admin.common.th_name')}</TableHead>
              <TableHead className="text-xs font-semibold">{t('sr.admin.common.th_type')}</TableHead>
              <TableHead className="text-xs font-semibold">{t('sr.admin.customers.group')}</TableHead>
              <TableHead className="text-xs font-semibold">{t('sr.admin.customers.th_classification')}</TableHead>
              <TableHead className="text-xs font-semibold">{t('sr.admin.common.territory')}</TableHead>
              <TableHead className="text-xs font-semibold">{t('sr.admin.common.sales_rep')}</TableHead>
              <TableHead className="text-xs font-semibold">{t('sr.admin.common.th_status')}</TableHead>
              <TableHead className="text-xs font-semibold w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-gray-400">
                  {t('sr.admin.customers.empty')}
                </TableCell>
              </TableRow>
            ) : paginated.map(customer => (
              <TableRow
                key={customer.name}
                className="hover:bg-gray-50/50 cursor-pointer"
                onClick={() => openEdit(customer)}
              >
                <TableCell className="text-xs text-gray-500 font-mono">{customer.name}</TableCell>
                <TableCell className="font-medium text-sm">{customer.customer_name}</TableCell>
                <TableCell className="text-sm text-gray-600">{customer.customer_type}</TableCell>
                <TableCell className="text-sm text-gray-600">{customerGroupLabel(t, customer.customer_group) || '—'}</TableCell>
                <TableCell>
                  <Badge className={cn('text-[10px]', customerClassificationBadgeClass(customerClassification(customer)))}>
                    {customerClassificationLabel(t, customer.customer_classification)}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-gray-600">{customer.territory || '—'}</TableCell>
                <TableCell className="text-sm text-gray-600">{customer.primary_sales_person || '—'}</TableCell>
                <TableCell>
                  <Badge variant={customer.disabled ? 'destructive' : 'default'} className={cn('text-[10px]', !customer.disabled && 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100')}>
                    {customer.disabled ? t('sr.admin.common.disabled') : t('sr.admin.common.active')}
                  </Badge>
                </TableCell>
                <TableCell onClick={e => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                      <DropdownMenuItem onClick={() => openEdit(customer)}>
                        <Edit className="h-4 w-4 mr-2" /> {t('sr.admin.common.edit')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setPendingDelete(customer)} className="text-red-600">
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{t('sr.admin.customers.pagination_showing').replace('{from}', String((currentPage - 1) * itemsPerPage + 1)).replace('{to}', String(Math.min(currentPage * itemsPerPage, filtered.length))).replace('{total}', String(filtered.length))}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>{t('sr.admin.common.previous')}</Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>{t('sr.admin.common.next')}</Button>
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? t('sr.admin.customers.dialog_edit_title') : t('sr.admin.customers.new_btn')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>{t('sr.admin.customers.label_name')} *</Label>
                <Input
                  value={form.customer_name}
                  onChange={e => { setForm(f => ({ ...f, customer_name: e.target.value })); if (e.target.value.trim()) setNameError(false) }}
                  className={cn('mt-1', nameError && 'border-red-500 focus-visible:ring-red-400')}
                  aria-invalid={nameError}
                />
                {nameError && <p className="text-xs text-red-600 mt-1">{t('sr.admin.customers.err_name_inline')}</p>}
              </div>
              <div>
                <Label>{t('sr.admin.common.th_type')}</Label>
                <Select value={form.customer_type} onValueChange={(v: any) => setForm(f => ({ ...f, customer_type: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Company">{t('sr.admin.customers.type_company')}</SelectItem>
                    <SelectItem value="Individual">{t('sr.admin.customers.type_individual')}</SelectItem>
                    <SelectItem value="Partnership">{t('sr.admin.customers.type_partnership')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('sr.admin.customers.label_group')}</Label>
                <Select value={form.customer_group || 'none'} onValueChange={v => setForm(f => ({ ...f, customer_group: v === 'none' ? '' : v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('sr.admin.customers.none')}</SelectItem>
                    {customerGroups.map(g => <SelectItem key={g} value={g}>{customerGroupLabel(t, g)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('sr.admin.common.territory')}</Label>
                <Select value={form.territory || 'none'} onValueChange={v => setForm(f => ({ ...f, territory: v === 'none' ? '' : v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('sr.admin.customers.none')}</SelectItem>
                    {territories.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('sr.admin.common.sales_person')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className={cn('w-full mt-1 justify-between font-normal', !form.primary_sales_person && 'text-muted-foreground')}>
                      {form.primary_sales_person
                        ? (salesPersons.find(sp => sp.name === form.primary_sales_person)?.sales_person_name || form.primary_sales_person)
                        : t('sr.admin.common.search_sales_person')}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder={t('sr.admin.common.type_to_search')} />
                      <CommandList>
                        <CommandEmpty>{t('sr.admin.common.no_results')}</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="__none__"
                            onSelect={() => setForm(f => ({ ...f, primary_sales_person: '' }))}
                          >
                            <Check className={cn('mr-2 h-4 w-4', !form.primary_sales_person ? 'opacity-100' : 'opacity-0')} />
                            {t('sr.admin.customers.none')}
                          </CommandItem>
                          {salesPersons.map(sp => (
                            <CommandItem
                              key={sp.name}
                              value={sp.sales_person_name || sp.name}
                              onSelect={() => setForm(f => ({ ...f, primary_sales_person: sp.name }))}
                            >
                              <Check className={cn('mr-2 h-4 w-4', form.primary_sales_person === sp.name ? 'opacity-100' : 'opacity-0')} />
                              {sp.sales_person_name || sp.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>{t('sr.admin.customers.label_tax_id')}</Label>
                <Input value={form.tax_id} onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>{t('sr.admin.customers.label_visit_freq')}</Label>
                <Input type="number" value={form.visit_frequency_days} onChange={e => setForm(f => ({ ...f, visit_frequency_days: parseInt(e.target.value) || 7 }))} className="mt-1" />
              </div>
            </div>

            {/* ZATCA E-Invoicing Section */}
            <div className="col-span-2 border-t pt-3 mt-1">
              <p className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-1.5">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                {t('sr.admin.customers.zatca_section')}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t('sr.admin.customers.zatca_arabic_name')}</Label>
                  <Input value={form.zatca_customer_name_in_arabic} onChange={e => setForm(f => ({ ...f, zatca_customer_name_in_arabic: e.target.value }))} className="mt-1" dir="rtl" placeholder={t('sr.admin.customers.zatca_arabic_name_placeholder')} />
                </div>
                <div>
                  <Label>{t('sr.admin.customers.zatca_buyer_id_type')}</Label>
                  <Select value={form.custom_buyer_id_type || 'none'} onValueChange={v => setForm(f => ({ ...f, custom_buyer_id_type: v === 'none' ? '' : v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('sr.admin.customers.zatca_none')}</SelectItem>
                      <SelectItem value="TIN">{t('sr.admin.customers.zatca_tin')}</SelectItem>
                      <SelectItem value="CRN">{t('sr.admin.customers.zatca_crn')}</SelectItem>
                      <SelectItem value="MOM">{t('sr.admin.customers.zatca_mom')}</SelectItem>
                      <SelectItem value="MLS">{t('sr.admin.customers.zatca_mls')}</SelectItem>
                      <SelectItem value="SAG">{t('sr.admin.customers.zatca_sag')}</SelectItem>
                      <SelectItem value="NAT">{t('sr.admin.customers.zatca_nat')}</SelectItem>
                      <SelectItem value="GCC">{t('sr.admin.customers.zatca_gcc')}</SelectItem>
                      <SelectItem value="IQA">{t('sr.admin.customers.zatca_iqa')}</SelectItem>
                      <SelectItem value="PAS">{t('sr.admin.customers.zatca_pas')}</SelectItem>
                      <SelectItem value="OTH">{t('sr.admin.customers.zatca_oth')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('sr.admin.customers.zatca_buyer_id')}</Label>
                  <Input value={form.custom_buyer_id} onChange={e => setForm(f => ({ ...f, custom_buyer_id: e.target.value }))} className="mt-1" placeholder={t('sr.admin.customers.zatca_buyer_id_placeholder')} />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, custom_b2c: f.custom_b2c ? 0 : 1 }))}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${form.custom_b2c ? 'bg-green-600' : 'bg-gray-300'}`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition ${form.custom_b2c ? (isRTL ? '-translate-x-4' : 'translate-x-4') : 'translate-x-0'}`} />
                  </button>
                  <Label className="cursor-pointer" onClick={() => setForm(f => ({ ...f, custom_b2c: f.custom_b2c ? 0 : 1 }))}>
                    {t('sr.admin.customers.zatca_b2c')}
                  </Label>
                </div>
              </div>
            </div>

            {/* Location Picker Map */}
            <div className="col-span-2">
              <Label className="mb-2 block">{t('sr.admin.customers.label_location')}</Label>
              <LocationPickerMap
                lat={form.customer_lat}
                lng={form.customer_lng}
                onChange={(newLat, newLng) => setForm(f => ({ ...f, customer_lat: newLat, customer_lng: newLng }))}
                height="280px"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>{t('sr.admin.common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingCustomer ? t('sr.admin.common.update') : t('sr.admin.common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={t('sr.admin.common.confirm_delete_title').replace('{name}', pendingDelete?.customer_name || '')}
        description={t('sr.admin.customers.confirm_delete_desc')}
        confirmLabel={t('sr.admin.common.delete')}
        cancelLabel={t('sr.admin.common.cancel')}
        onConfirm={() => pendingDelete && handleDelete(pendingDelete)}
      />
    </div>
  )
}
