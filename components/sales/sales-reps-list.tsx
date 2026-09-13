/**
 * Sales Reps List - Manage sales persons linked to HR Employees
 * 
 * Create flow:
 *   PRIMARY: Pick an existing Employee → auto-creates Sales Person linked to HR
 *   FALLBACK: "External Agent" mode → manual name + mobile_app_user (no HR link)
 */

'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { salesApi, type SalesPerson, type RepZone } from '@/lib/sales-api'
import { stockApi } from '@/lib/stock-api'
import { frappeClient } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { useCompany } from '@/hooks/use-company'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import {
  Search, Plus, RefreshCw, MoreVertical, Edit,
  UserCheck, Loader2, Package, Building2, ExternalLink, Info,
  Eye, EyeOff, KeyRound, Mail, Warehouse as WarehouseIcon, MapPin,
} from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

// leaflet inside — load client-side only
const ZoneEditorDialog = dynamic(
  () => import('@/components/sales/zone-editor-dialog').then(m => m.ZoneEditorDialog),
  { ssr: false }
)

type CreateMode = 'employee' | 'external'

interface AvailableEmployee {
  name: string
  employee_name: string
  user_id?: string
  company?: string
}

export function SalesRepsList() {
  const { isRTL, t } = useI18n()
  const { toast } = useToast()
  const { company: activeCompany } = useCompany()
  const [reps, setReps] = useState<SalesPerson[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('enabled')
  const [currentPage, setCurrentPage] = useState(1)
  const [showDialog, setShowDialog] = useState(false)
  const [editingRep, setEditingRep] = useState<SalesPerson | null>(null)
  const [saving, setSaving] = useState(false)
  const [warehouses, setWarehouses] = useState<string[]>([])
  const [availableEmployees, setAvailableEmployees] = useState<AvailableEmployee[]>([])
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [createMode, setCreateMode] = useState<CreateMode>('employee')
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [createAccount, setCreateAccount] = useState(true)
  const [creatingWarehouse, setCreatingWarehouse] = useState(false)
  const [newWarehouseName, setNewWarehouseName] = useState('')
  const [showNewWarehouseInput, setShowNewWarehouseInput] = useState(false)
  const [zones, setZones] = useState<Record<string, RepZone>>({})
  const [zoneRep, setZoneRep] = useState<SalesPerson | null>(null)
  const itemsPerPage = 20

  const [form, setForm] = useState({
    sales_person_name: '',
    enabled: 1,
    employee: '',
    mobile_app_user: '',
    has_inventory: 1,
    inventory_warehouse: '',
    user_email: '',
    user_password: '',
  })

  const loadData = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true)
      const [repsData, wh, zoneRows] = await Promise.all([
        salesApi.getSalesPersons({ company: activeCompany || undefined }),
        salesApi.getWarehouses(activeCompany || undefined).catch(() => []),
        salesApi.getRepZones().catch(() => [] as RepZone[]),
      ])
      setReps(repsData)
      setWarehouses(wh)
      const zmap: Record<string, RepZone> = {}
      zoneRows.forEach(z => { zmap[z.name] = z })
      setZones(zmap)
    } catch (e) {
      toast({ title: t('sr.admin.common.error_title'), description: String(e), variant: 'destructive' })
    } finally { setLoading(false); setRefreshing(false) }
  }, [toast, activeCompany])

  useEffect(() => { loadData() }, [loadData])

  const filtered = useMemo(() => {
    let r = reps
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(rep =>
        rep.name.toLowerCase().includes(q) ||
        rep.sales_person_name.toLowerCase().includes(q) ||
        rep.employee?.toLowerCase().includes(q) ||
        rep.mobile_app_user?.toLowerCase().includes(q)
      )
    }
    if (statusFilter === 'enabled') r = r.filter(rep => rep.enabled)
    else if (statusFilter === 'disabled') r = r.filter(rep => !rep.enabled)
    return r
  }, [reps, search, statusFilter])

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const filteredEmployees = useMemo(() => {
    if (!employeeSearch) return availableEmployees
    const q = employeeSearch.toLowerCase()
    return availableEmployees.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.employee_name.toLowerCase().includes(q) ||
      e.user_id?.toLowerCase().includes(q)
    )
  }, [availableEmployees, employeeSearch])

  const openCreate = async () => {
    setEditingRep(null)
    setCreateMode('employee')
    setEmployeeSearch('')
    setShowPassword(false)
    setCreateAccount(true)
    setForm({ sales_person_name: '', enabled: 1, employee: '', mobile_app_user: '', has_inventory: 1, inventory_warehouse: '', user_email: '', user_password: '' })
    setShowNewWarehouseInput(false)
    setNewWarehouseName('')
    setShowDialog(true)

    // Load available employees
    setLoadingEmployees(true)
    try {
      const employees = await salesApi.getAvailableEmployees(reps, activeCompany || undefined)
      setAvailableEmployees(employees)
    } catch { setAvailableEmployees([]) }
    finally { setLoadingEmployees(false) }
  }

  const openEdit = (rep: SalesPerson) => {
    setEditingRep(rep)
    setCreateMode(rep.employee ? 'employee' : 'external')
    setCreateAccount(false)
    setForm({
      sales_person_name: rep.sales_person_name,
      enabled: rep.enabled,
      employee: rep.employee || '',
      mobile_app_user: rep.mobile_app_user || '',
      has_inventory: rep.has_inventory || 0,
      inventory_warehouse: rep.inventory_warehouse || '',
      user_email: '',
      user_password: '',
    })
    setShowDialog(true)
  }

  const selectEmployee = (emp: AvailableEmployee) => {
    setForm(f => ({
      ...f,
      employee: emp.name,
      sales_person_name: emp.employee_name,
      mobile_app_user: emp.user_id || '',
    }))
  }

  const handleSave = async () => {
    if (createMode === 'employee' && !editingRep && !form.employee) {
      toast({ title: t('sr.admin.common.error_title'), description: t('sr.admin.reps.err_select_employee'), variant: 'destructive' })
      return
    }
    if (!form.sales_person_name.trim()) {
      toast({ title: t('sr.admin.common.error_title'), description: t('sr.admin.reps.err_name_required'), variant: 'destructive' })
      return
    }
    // Validate user account fields for external agents
    if (createMode === 'external' && !editingRep && createAccount) {
      if (!form.user_email.trim() || !form.user_email.includes('@')) {
        toast({ title: t('sr.admin.common.error_title'), description: t('sr.admin.reps.err_email_required'), variant: 'destructive' })
        return
      }
      if (!form.user_password || form.user_password.length < 6) {
        toast({ title: t('sr.admin.common.error_title'), description: t('sr.admin.reps.err_password_min'), variant: 'destructive' })
        return
      }
    }

    setSaving(true)
    try {
      // Check if we need to auto-create a warehouse AFTER the sales person is created
      const needsAutoWarehouse = form.has_inventory && !form.inventory_warehouse && !editingRep

      const payload: Partial<SalesPerson> = {
        sales_person_name: form.sales_person_name,
        enabled: form.enabled,
        has_inventory: form.has_inventory,
        inventory_warehouse: form.has_inventory ? form.inventory_warehouse : '',
      }

      let createdSpName = ''
      let warehouseCreated = ''

      if (editingRep) {
        // ---- UPDATE existing ----
        if (createMode === 'employee') {
          if (form.employee) payload.employee = form.employee
        } else {
          payload.mobile_app_user = form.mobile_app_user
        }
        await salesApi.updateSalesPerson(editingRep.name, payload)
        toast({ title: t('sr.admin.common.updated_title'), description: t('sr.admin.reps.toast_updated_desc') })
      } else if (createMode === 'external' && createAccount) {
        // ---- CREATE external agent WITH user account ----
        // Explicitly clear employee to prevent server auto-populating from logged-in user
        payload.employee = ''
        const result = await salesApi.createSalesRepWithUser({
          email: form.user_email.trim(),
          full_name: form.sales_person_name,
          password: form.user_password,
          salesPersonData: payload,
        })
        createdSpName = result.salesPerson?.name || ''
      } else {
        // ---- CREATE without user account (employee mode or external without account) ----
        if (createMode === 'employee') {
          if (form.employee) payload.employee = form.employee
        } else {
          // Explicitly clear employee to prevent server auto-populating from logged-in user
          payload.employee = ''
          payload.mobile_app_user = form.mobile_app_user
        }
        const sp = await salesApi.createSalesPerson(payload)
        createdSpName = sp?.name || ''
      }

      // Auto-assign Sales User + Stock User roles when linking an HR employee
      if (!editingRep && createMode === 'employee' && form.employee) {
        const selectedEmp = availableEmployees.find(e => e.name === form.employee)
        const userEmail = selectedEmp?.user_id
        if (userEmail) {
          const rolesToAdd = ['Sales User', 'Stock User']
          try {
            const userData = await frappeClient.get<any>('User', userEmail)
            const existingRoles: Array<{ role: string }> = (userData.data?.roles || []).map((r: any) => ({ role: r.role }))
            const existingRoleNames = existingRoles.map(r => r.role)
            const newRoles = rolesToAdd.filter(r => !existingRoleNames.includes(r))
            if (newRoles.length > 0) {
              const allRoles = [...existingRoles, ...newRoles.map(r => ({ role: r }))]
              const roleRes = await frappeClient.put('User', userEmail, { roles: allRoles })
              if (roleRes.data) {
                console.log(`[SalesReps] Auto-assigned roles [${rolesToAdd.join(', ')}] to ${userEmail}`)
              } else {
                console.warn('[SalesReps] Could not assign roles — may need manual assignment')
                toast({ title: t('sr.admin.common.note_title'), description: t('sr.admin.reps.toast_role_manual') })
              }
            } else {
              console.warn('[SalesReps] ⚠️ Could not fetch user for role assignment')
              toast({ title: t('sr.admin.common.note_title'), description: t('sr.admin.reps.toast_role_manual') })
            }
          } catch (roleErr) {
            console.warn('[SalesReps] Role assignment failed (sales rep was still created):', roleErr)
          }
        }
      }

      // Auto-assign Stock User role for external agents
      if (!editingRep && createMode === 'external' && createAccount && form.user_email) {
        try {
          const userData = await frappeClient.get<any>('User', form.user_email.trim())
          const existingRoles: Array<{ role: string }> = (userData.data?.roles || []).map((r: any) => ({ role: r.role }))
          if (!existingRoles.some(r => r.role === 'Stock User')) {
            const allRoles = [...existingRoles, { role: 'Stock User' }]
            await frappeClient.put('User', form.user_email.trim(), { roles: allRoles })
             console.log(`[SalesReps] Auto-assigned Stock User role to external agent ${form.user_email}`)
            }
          } catch (roleErr) {
          console.warn('[SalesReps] Stock User role assignment failed for external agent:', roleErr)
        }
      }

      // Auto-create Van warehouse AFTER Sales Person exists (avoids LinkValidationError)
      if (needsAutoWarehouse && createdSpName) {
        try {
          // Determine company: prefer the selected employee's company, then activeCompany from auth, then fallback to API
          const selectedEmp = availableEmployees.find(e => e.name === form.employee)
          let company = selectedEmp?.company || activeCompany || ''
          if (!company) {
            const companies = await stockApi.getCompanies()
            company = companies[0]?.name || ''
          }
          if (company) {
            const whName = `${form.sales_person_name} - Van`
            const newWh = await stockApi.createWarehouse({
              warehouse_name: whName,
              company,
              custom_warehouse_type: 'Van',
              custom_linked_sales_person: createdSpName,
            })
            warehouseCreated = newWh.name
            // Update the Sales Person with the new warehouse
            await salesApi.updateSalesPerson(createdSpName, {
              inventory_warehouse: newWh.name,
            })
            console.log('[SalesReps] Auto-created Van warehouse:', newWh.name)
          }
        } catch (whErr) {
          console.warn('[SalesReps] Auto-create warehouse failed (sales rep was created without warehouse):', whErr)
          toast({ title: t('sr.admin.common.warning_title'), description: t('sr.admin.reps.toast_wh_autocreate_failed'), variant: 'destructive' })
        }
      }

      // Show success toast for new creates
      if (!editingRep) {
        if (createMode === 'external' && createAccount) {
          const whPart = warehouseCreated ? t('sr.admin.reps.toast_wh_suffix').replace('{warehouse}', warehouseCreated) : ''
          toast({
            title: t('sr.admin.common.created_title'),
            description: t('sr.admin.reps.toast_created_with_user').replace('{email}', form.user_email).replace('{whPart}', whPart),
          })
        } else {
          const whSuffix = warehouseCreated ? t('sr.admin.reps.toast_wh_suffix').replace('{warehouse}', warehouseCreated) : ''
          toast({
            title: t('sr.admin.common.created_title'),
            description: createMode === 'employee'
              ? t('sr.admin.reps.toast_created_employee').replace('{whSuffix}', whSuffix)
              : t('sr.admin.reps.toast_created_external').replace('{whSuffix}', whSuffix),
          })
        }
      }

      setShowDialog(false)
      loadData(true)
    } catch (e: any) {
      toast({ title: t('sr.admin.common.error_title'), description: e.message, variant: 'destructive' })
    } finally { setSaving(false) }
  }

  const linkedCount = reps.filter(r => r.employee).length
  const externalCount = reps.filter(r => !r.employee).length

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Coloured top bar */}
      <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />

      <div className="p-6 space-y-5">
        {/* Header */}
        <div className={cn('flex items-start justify-between gap-4', isRTL && 'flex-row-reverse')}>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">{t('sr.admin.reps.title')}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{filtered.length} {t('sr.admin.reps.count_unit')}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={refreshing} className="h-9">
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </Button>
            <Button size="sm" onClick={openCreate} className="h-9 bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-200">
              <Plus className={cn('h-4 w-4', isRTL ? 'ml-1.5' : 'mr-1.5')} />
              {t('sr.admin.reps.add_btn')}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: t('sr.admin.reps.stat_total'), value: reps.length, iconBg: 'bg-slate-100', iconText: 'text-slate-600', icon: <UserCheck className="h-4 w-4" /> },
            { label: t('sr.admin.common.active'), value: reps.filter(r => r.enabled).length, iconBg: 'bg-emerald-100', iconText: 'text-emerald-600', icon: <UserCheck className="h-4 w-4" /> },
            { label: t('sr.admin.reps.stat_hr_linked'), value: linkedCount, iconBg: 'bg-blue-100', iconText: 'text-blue-600', icon: <Building2 className="h-4 w-4" /> },
            { label: t('sr.admin.reps.stat_external'), value: externalCount, iconBg: 'bg-amber-100', iconText: 'text-amber-600', icon: <ExternalLink className="h-4 w-4" /> },
          ].map((s, i) => (
            <Card key={i} className="border-0 shadow-sm rounded-xl">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', s.iconBg, s.iconText)}>{s.icon}</div>
                <div>
                  <p className="text-2xl font-extrabold text-gray-900 leading-none">{s.value}</p>
                  <p className="text-[12px] text-gray-500 mt-1">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-sm rounded-xl">
          <CardContent className="p-3 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
              <Input
                placeholder={t('sr.admin.reps.search_placeholder')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={cn('h-9 text-sm', isRTL ? 'pr-9' : 'pl-9')}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('sr.admin.common.all')}</SelectItem>
                <SelectItem value="enabled">{t('sr.admin.common.active')}</SelectItem>
                <SelectItem value="disabled">{t('sr.admin.common.disabled')}</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="border-0 shadow-sm overflow-hidden rounded-xl">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 border-b border-gray-100">
                <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{t('sr.admin.common.th_name')}</TableHead>
                <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{t('sr.admin.reps.th_employee')}</TableHead>
                <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{t('sr.admin.common.th_type')}</TableHead>
                <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{t('sr.admin.nav.inventory')}</TableHead>
                <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{t('sr.admin.common.th_status')}</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                        <UserCheck className="h-7 w-7 text-gray-300" />
                      </div>
                      <p className="text-sm font-medium">{t('sr.admin.reps.empty_title')}</p>
                      <p className="text-xs text-gray-400">{t('sr.admin.reps.empty_hint')}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginated.map(rep => {
                const initials = rep.sales_person_name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
                const avatarColors = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-indigo-500', 'bg-teal-500']
                const avatarBg = avatarColors[rep.name.charCodeAt(rep.name.length - 1) % avatarColors.length]
                return (
                  <TableRow key={rep.name} className="hover:bg-slate-50/60 transition-colors duration-100 cursor-pointer" onClick={() => openEdit(rep)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0', avatarBg)}>{initials}</div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{rep.sales_person_name}</p>
                          <p className="text-[11px] text-gray-400 font-mono">{rep.name}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {rep.employee ? (
                        <div className="flex items-center gap-1.5 text-sm text-blue-700">
                          <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                          <span>{rep.employee}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">{rep.mobile_app_user || '—'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {rep.employee ? (
                        <Badge className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-50 gap-1">
                          <Building2 className="h-3 w-3" />{t('sr.admin.reps.badge_hr')}
                        </Badge>
                      ) : (
                        <Badge className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-50 gap-1">
                          <ExternalLink className="h-3 w-3" />{t('sr.admin.reps.badge_external')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        {rep.has_inventory ? (
                          <>
                            <Badge className="text-[10px] bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-50 gap-1 w-fit">
                              <Package className="h-3 w-3" /> {t('sr.admin.reps.badge_stocked')}
                            </Badge>
                            {rep.inventory_warehouse && <p className="text-[10px] text-gray-400">{rep.inventory_warehouse}</p>}
                          </>
                        ) : <span className="text-gray-400 text-xs">—</span>}
                        {zones[rep.name] && (
                          <Badge
                            className="text-[10px] gap-1 w-fit border bg-white hover:bg-white"
                            style={{ color: zones[rep.name].zone_color || '#7c3aed', borderColor: zones[rep.name].zone_color || '#7c3aed' }}
                          >
                            <MapPin className="h-3 w-3" />
                            {zones[rep.name].zone_name || t('sr.admin.zone.zone_set')}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('text-[10px] border font-semibold', rep.enabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50' : 'bg-gray-100 text-gray-500 border-gray-200')}>
                        <span className={cn('w-1.5 h-1.5 rounded-full inline-block mr-1.5', rep.enabled ? 'bg-emerald-500' : 'bg-gray-400')} />
                        {rep.enabled ? t('sr.admin.common.active') : t('sr.admin.common.disabled')}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg hover:bg-gray-100"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                          <DropdownMenuItem onClick={() => openEdit(rep)}>
                            <Edit className="h-4 w-4 mr-2" /> {t('sr.admin.common.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setZoneRep(rep)}>
                            <MapPin className="h-4 w-4 mr-2" /> {t('sr.admin.zone.assign_action')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>{filtered.length} {t('sr.admin.reps.count_unit')}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                {t('sr.admin.common.previous')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                {t('sr.admin.common.next')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ==================== Create / Edit Dialog ==================== */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRep ? t('sr.admin.reps.dialog_edit_title') : t('sr.admin.reps.dialog_add_title')}
            </DialogTitle>
            {!editingRep && (
              <DialogDescription>
                {t('sr.admin.reps.dialog_add_desc')}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Mode selector — only for new reps */}
            {!editingRep && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { setCreateMode('employee'); setForm(f => ({ ...f, employee: '', sales_person_name: '', mobile_app_user: '', user_email: '', user_password: '' })) }}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center',
                    createMode === 'employee'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  )}
                >
                  <Building2 className="h-6 w-6" />
                  <span className="text-sm font-semibold">{t('sr.admin.reps.mode_hr')}</span>
                  <span className="text-[11px] opacity-70">{t('sr.admin.reps.mode_hr_hint')}</span>
                </button>
                <button
                  onClick={() => { setCreateMode('external'); setForm(f => ({ ...f, employee: '', sales_person_name: '', mobile_app_user: '', user_email: '', user_password: '' })) }}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center',
                    createMode === 'external'
                      ? 'border-amber-500 bg-amber-50 text-amber-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  )}
                >
                  <ExternalLink className="h-6 w-6" />
                  <span className="text-sm font-semibold">{t('sr.admin.reps.mode_external')}</span>
                  <span className="text-[11px] opacity-70">{t('sr.admin.reps.mode_external_hint')}</span>
                </button>
              </div>
            )}

            {/* ---- Employee mode: pick from HR ---- */}
            {createMode === 'employee' && !editingRep && (
              <div>
                <Label className="mb-2 block">{t('sr.admin.reps.label_select_employee')} *</Label>
                {loadingEmployees ? (
                  <div className="flex items-center gap-2 p-4 text-sm text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('sr.admin.reps.loading_employees')}
                  </div>
                ) : (
                  <>
                    <div className="relative mb-2">
                      <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
                      <Input
                        placeholder={t('sr.admin.reps.search_employees_placeholder')}
                        value={employeeSearch}
                        onChange={e => setEmployeeSearch(e.target.value)}
                        className={cn('h-9 text-sm', isRTL ? 'pr-9' : 'pl-9')}
                      />
                    </div>
                    <div className="border rounded-lg max-h-[200px] overflow-y-auto">
                      {filteredEmployees.length === 0 ? (
                        <div className="p-4 text-center text-sm text-gray-400">
                          {availableEmployees.length === 0
                            ? t('sr.admin.reps.all_employees_linked')
                            : t('sr.admin.reps.no_matches')}
                        </div>
                      ) : filteredEmployees.map(emp => (
                        <button
                          key={emp.name}
                          onClick={() => selectEmployee(emp)}
                          className={cn(
                            'w-full flex items-center justify-between p-3 text-start hover:bg-gray-50 transition-colors border-b last:border-b-0',
                            form.employee === emp.name && 'bg-blue-50 border-blue-100'
                          )}
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-900">{emp.employee_name}</p>
                            <p className="text-[11px] text-gray-400">{emp.name}{emp.user_id ? ` · ${emp.user_id}` : ''}</p>
                          </div>
                          {form.employee === emp.name && (
                            <UserCheck className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                    {form.employee && (
                      <div className="mt-2 flex items-center gap-2 p-2 bg-blue-50 rounded-lg text-sm text-blue-700">
                        <UserCheck className="h-4 w-4" />
                        <span className="font-medium">{form.sales_person_name}</span>
                        <span className="text-blue-500">({form.employee})</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Show linked employee info in edit mode */}
            {editingRep && form.employee && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg text-sm">
                <Building2 className="h-4 w-4 text-blue-600" />
                <div>
                  <span className="font-medium text-blue-700">{t('sr.admin.reps.linked_to_employee')}: </span>
                  <span className="text-blue-600">{form.employee}</span>
                </div>
              </div>
            )}

            {/* Show external agent info in edit mode */}
            {editingRep && !form.employee && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg text-sm">
                <ExternalLink className="h-4 w-4 text-amber-600" />
                <span className="font-medium text-amber-700">{t('sr.admin.reps.external_not_linked')}</span>
              </div>
            )}

            {/* ---- External mode: manual name + user account ---- */}
            {createMode === 'external' && !editingRep && (
              <>
                <div>
                  <Label>{t('sr.admin.common.th_name')} *</Label>
                  <Input
                    value={form.sales_person_name}
                    onChange={e => setForm(f => ({ ...f, sales_person_name: e.target.value }))}
                    className="mt-1"
                    placeholder={t('sr.admin.reps.placeholder_agent_name')}
                  />
                </div>

                {/* Create user account toggle */}
                <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-amber-600" />
                    <div>
                      <Label className="text-sm font-medium text-amber-800">{t('sr.admin.reps.label_create_account')}</Label>
                      <p className="text-[11px] text-amber-600">{t('sr.admin.reps.create_account_hint')}</p>
                    </div>
                  </div>
                  <Switch checked={createAccount} onCheckedChange={setCreateAccount} />
                </div>

                {createAccount ? (
                  <>
                    {/* Email */}
                    <div>
                      <Label>{t('sr.admin.reps.label_email')} *</Label>
                      <div className="relative mt-1">
                        <Mail className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
                        <Input
                          type="email"
                          value={form.user_email}
                          onChange={e => setForm(f => ({ ...f, user_email: e.target.value }))}
                          className={cn('text-sm', isRTL ? 'pr-9' : 'pl-9')}
                          placeholder="agent@company.com"
                        />
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {t('sr.admin.reps.email_hint')}
                      </p>
                    </div>
                    {/* Password */}
                    <div>
                      <Label>{t('sr.admin.reps.label_password')} *</Label>
                      <div className="relative mt-1">
                        <KeyRound className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          value={form.user_password}
                          onChange={e => setForm(f => ({ ...f, user_password: e.target.value }))}
                          className={cn('text-sm', isRTL ? 'pr-9 pl-9' : 'pl-9 pr-9')}
                          placeholder={t('sr.admin.reps.placeholder_password')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(v => !v)}
                          className={cn('absolute top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600', isRTL ? 'left-3' : 'right-3')}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    {/* Role info */}
                    <div className="flex gap-2 p-3 bg-blue-50 rounded-lg text-[12px] text-blue-600">
                      <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <span>
                        {t('sr.admin.reps.info_account_role')}
                      </span>
                    </div>
                  </>
                ) : (
                  <div>
                    <Label>{t('sr.admin.reps.label_mobile_user_optional')}</Label>
                    <Input
                      value={form.mobile_app_user}
                      onChange={e => setForm(f => ({ ...f, mobile_app_user: e.target.value }))}
                      className="mt-1"
                      placeholder="existing-user@company.com"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      {t('sr.admin.reps.mobile_user_hint')}
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Name field (editable) for employee mode once selected, or in edit mode */}
            {((createMode === 'employee' && form.employee && !editingRep) || editingRep) ? (
              <div>
                <Label>{t('sr.admin.reps.label_sp_name')}</Label>
                <Input
                  value={form.sales_person_name}
                  onChange={e => setForm(f => ({ ...f, sales_person_name: e.target.value }))}
                  className="mt-1"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  {t('sr.admin.reps.sp_name_hint')}
                </p>
              </div>
            ) : null}

            {/* External agent: mobile_app_user field in edit mode */}
            {editingRep && !form.employee && (
              <div>
                <Label>{t('sr.admin.reps.label_mobile_user')}</Label>
                <Input
                  value={form.mobile_app_user}
                  onChange={e => setForm(f => ({ ...f, mobile_app_user: e.target.value }))}
                  className="mt-1"
                  placeholder="user@company.com"
                />
              </div>
            )}

            {/* Common fields */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <Label>{t('sr.admin.reps.label_enabled')}</Label>
              <Switch checked={!!form.enabled} onCheckedChange={v => setForm(f => ({ ...f, enabled: v ? 1 : 0 }))} />
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-teal-600" />
                <div>
                  <Label>{t('sr.admin.reps.label_has_inventory')}</Label>
                  {!editingRep && <p className="text-[11px] text-gray-400">{t('sr.admin.reps.has_inventory_hint')}</p>}
                </div>
              </div>
              <Switch checked={!!form.has_inventory} onCheckedChange={v => setForm(f => ({ ...f, has_inventory: v ? 1 : 0 }))} />
            </div>

            {form.has_inventory ? (
              <div>
                <Label>{t('sr.admin.common.warehouse')}</Label>
                {!showNewWarehouseInput ? (
                  <>
                    <Select
                      value={form.inventory_warehouse || 'auto'}
                      onValueChange={v => {
                        if (v === 'create-new') {
                          setShowNewWarehouseInput(true)
                          setNewWarehouseName(form.sales_person_name ? `${form.sales_person_name} - Van` : '')
                        } else {
                          setForm(f => ({ ...f, inventory_warehouse: v === 'auto' ? '' : v }))
                        }
                      }}
                    >
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {!editingRep && <SelectItem value="auto">
                          <span className="flex items-center gap-1.5 text-teal-600">
                            <WarehouseIcon className="h-3.5 w-3.5" />
                            {t('sr.admin.reps.wh_auto_create')}
                          </span>
                        </SelectItem>}
                        <SelectItem value="create-new">
                          <span className="flex items-center gap-1.5 text-blue-600">
                            <Plus className="h-3.5 w-3.5" />
                            {t('sr.admin.reps.wh_create_new')}
                          </span>
                        </SelectItem>
                        {warehouses.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {!form.inventory_warehouse && !editingRep && (
                      <p className="text-[11px] text-teal-600 mt-1 flex items-center gap-1">
                        <WarehouseIcon className="h-3 w-3" />
                        {t('sr.admin.reps.wh_auto_hint')}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="mt-1 space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={newWarehouseName}
                        onChange={e => setNewWarehouseName(e.target.value)}
                        placeholder={t('sr.admin.reps.placeholder_new_wh_name')}
                        className="flex-1 h-9 text-sm"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={creatingWarehouse || !newWarehouseName.trim()}
                        onClick={async () => {
                          if (!newWarehouseName.trim()) return
                          setCreatingWarehouse(true)
                          try {
                            // Determine company: prefer selected employee's company, then activeCompany from auth, then fallback
                            const selectedEmp = availableEmployees.find(e => e.name === form.employee)
                            let company = selectedEmp?.company || activeCompany || ''
                            if (!company) {
                              const companies = await stockApi.getCompanies()
                              company = companies[0]?.name || ''
                            }
                            if (!company) { toast({ title: t('sr.admin.reps.err_no_company'), variant: 'destructive' }); return }
                            const newWh = await stockApi.createWarehouse({
                              warehouse_name: newWarehouseName.trim(),
                              company,
                              custom_warehouse_type: 'Van',
                              custom_linked_sales_person: form.sales_person_name || '',
                            })
                            setWarehouses(prev => [...prev, newWh.name])
                            setForm(f => ({ ...f, inventory_warehouse: newWh.name }))
                            setShowNewWarehouseInput(false)
                            setNewWarehouseName('')
                            toast({ title: t('sr.admin.reps.toast_wh_created'), description: newWh.name })
                          } catch (e: any) {
                            toast({ title: t('sr.admin.common.error_title'), description: e.message, variant: 'destructive' })
                          } finally { setCreatingWarehouse(false) }
                        }}
                        className="bg-teal-600 hover:bg-teal-700 text-white h-9"
                      >
                        {creatingWarehouse ? <Loader2 className="h-4 w-4 animate-spin" /> : t('sr.admin.common.create')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowNewWarehouseInput(false)} className="h-9">
                        {t('sr.admin.common.cancel')}
                      </Button>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      {t('sr.admin.reps.wh_new_hint')}
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            {/* Info hint */}
            {!editingRep && createMode === 'employee' && (
              <div className="flex gap-2 p-3 bg-gray-50 rounded-lg text-[12px] text-gray-500">
                <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  {t('sr.admin.reps.info_hr_record')}
                </span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              {t('sr.admin.common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingRep ? t('sr.admin.common.update') : t('sr.admin.common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Work Zone Editor ==================== */}
      <ZoneEditorDialog
        open={!!zoneRep}
        onOpenChange={(o) => { if (!o) setZoneRep(null) }}
        rep={zoneRep}
        existing={zoneRep ? zones[zoneRep.name] || null : null}
        center={(() => {
          const lat = parseFloat(zoneRep?.current_location_lat || '')
          const lng = parseFloat(zoneRep?.current_location_lng || '')
          return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0 ? [lat, lng] as [number, number] : null
        })()}
        onSaved={() => loadData(true)}
      />
    </div>
  )
}
