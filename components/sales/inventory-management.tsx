/**
 * Inventory Management - Sales Rep Inventory + Customer Inventory Records
 */

'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { salesApi, type SalesRepInventory, type CustomerInventoryRecord, type Item } from '@/lib/sales-api'
import { buildWarehouseFields, repVanRequired, selectableWarehouses, stockCheckWarehouse, warehouseFormFromRecord } from '@/lib/sales-inventory'
import { stockApi, type BinStock } from '@/lib/stock-api'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Search, Plus, RefreshCw, Package, Store, Loader2, MoreVertical, Trash2, X, ChevronsUpDown, Check, Warehouse, ArrowRightLeft, AlertTriangle, Pencil, ChevronDown, ChevronRight, Eye } from 'lucide-react'
import { EmptyState } from '@/components/sales/empty-state'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'

export function InventoryManagement() {
  const { isRTL, t } = useI18n()
  const { toast } = useToast()
  const [tab, setTab] = useState('rep-inventory')
  const [repInventory, setRepInventory] = useState<SalesRepInventory[]>([])
  const [custInventory, setCustInventory] = useState<CustomerInventoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [salesPersons, setSalesPersons] = useState<{ name: string; sales_person_name: string; inventory_warehouse?: string }[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [warehouses, setWarehouses] = useState<string[]>([])
  const [vanWarehouses, setVanWarehouses] = useState<string[]>([])
  const [uoms, setUoms] = useState<string[]>([])
  const [itemValidUOMs, setItemValidUOMs] = useState<Record<string, string[]>>({})
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [validating, setValidating] = useState(false)
  const [editingRecord, setEditingRecord] = useState<string | null>(null) // name of record being edited
  const [deleting, setDeleting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SalesRepInventory | null>(null)
  const [expandedCustRecord, setExpandedCustRecord] = useState<string | null>(null)
  const [custRecordItems, setCustRecordItems] = useState<Record<string, any[]>>({})
  const [loadingCustDetail, setLoadingCustDetail] = useState<string | null>(null)
  const [warehouseStock, setWarehouseStock] = useState<{ warehouse: string; salesPerson: string; items: BinStock[] }[]>([])
  const [mainWarehouseStock, setMainWarehouseStock] = useState<{ warehouse: string; items: BinStock[] }[]>([])
  const [loadingWarehouseStock, setLoadingWarehouseStock] = useState(false)
  const [whStockSearch, setWhStockSearch] = useState('')
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [addingProduct, setAddingProduct] = useState(false)
  const [productMode, setProductMode] = useState<'new' | 'existing'>('new')
  const [productForm, setProductForm] = useState({
    item_name: '', item_code: '', existing_item: '', uom: 'Nos',
    standard_rate: 0, valuation_rate: 0, qty: 0, warehouse: '',
  })
  const itemsPerPage = 20

  type FormItem = { item_code: string; quantity: number; uom: string; rate: number }
  const [form, setForm] = useState({
    sales_person: '',
    transaction_type: 'Load' as 'Load' | 'Unload' | 'Adjustment' | 'Transfer',
    warehouse: '',
    source_warehouse: '',
    items: [{ item_code: '', quantity: 1, uom: '', rate: 0 }] as FormItem[],
  })

  /** The selected rep's van — the implicit destination (Load) / source (Unload). */
  const selectedRepVan = useMemo(
    () => salesPersons.find(sp => sp.name === form.sales_person)?.inventory_warehouse || '',
    [salesPersons, form.sales_person]
  )
  const vanSet = useMemo(() => {
    const s = new Set(vanWarehouses)
    salesPersons.forEach(sp => { if (sp.inventory_warehouse) s.add(sp.inventory_warehouse) })
    return s
  }, [vanWarehouses, salesPersons])
  const pickableWarehouses = useMemo(
    () => selectableWarehouses(form.transaction_type, warehouses, vanSet),
    [form.transaction_type, warehouses, vanSet]
  )

  const loadData = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true)
      const [rep, cust, reps, itemsList, wh, uomList, vans] = await Promise.all([
        salesApi.getSalesRepInventory(),
        salesApi.getCustomerInventory(),
        salesApi.getSalesPersons({ fields: ['name', 'sales_person_name', 'inventory_warehouse'], filters: [['Sales Person', 'enabled', '=', 1]] }).catch(() => []),
        salesApi.getItems({ fields: ['name', 'item_name', 'item_group', 'stock_uom', 'standard_rate'] }).catch(() => []),
        salesApi.getWarehouses().catch(() => []),
        salesApi.getUOMs().catch(() => []),
        salesApi.getVanWarehouses(),
      ])
      setRepInventory(rep); setCustInventory(cust); setSalesPersons(reps as any); setItems(itemsList); setWarehouses(wh); setUoms(uomList); setVanWarehouses(vans)
    } catch (e) { toast({ title: t('sr.admin.common.error_title'), description: String(e), variant: 'destructive' }) }
    finally { setLoading(false); setRefreshing(false) }
  }, [toast])

  useEffect(() => { loadData() }, [loadData])

  const loadWarehouseStock = useCallback(async () => {
    setLoadingWarehouseStock(true)
    try {
      // Get all sales persons with their warehouses
      const reps = await salesApi.getSalesPersons({
        fields: ['name', 'sales_person_name', 'inventory_warehouse'],
        filters: [['Sales Person', 'enabled', '=', 1]],
      }).catch(() => []) as any[]

      const repsWithWH = reps.filter((r: any) => r.inventory_warehouse)
      const stockResults = await Promise.allSettled(
        repsWithWH.map(async (rep: any) => {
          const items = await stockApi.getBinStock(rep.inventory_warehouse)
          return { warehouse: rep.inventory_warehouse, salesPerson: rep.sales_person_name || rep.name, items }
        })
      )
      const data = stockResults
        .filter((r): r is PromiseFulfilledResult<{ warehouse: string; salesPerson: string; items: BinStock[] }> => r.status === 'fulfilled')
        .map(r => r.value)
        .filter(d => d.items.length > 0)
      setWarehouseStock(data)

      // Main (non-rep-van) warehouses — shown with their stock even when
      // empty, so the admin always has the "Add Product" entry point
      const repWHs = new Set(repsWithWH.map((r: any) => r.inventory_warehouse))
      const mains = warehouses.filter(w => !repWHs.has(w))
      const mainResults = await Promise.allSettled(
        mains.map(async (w) => ({ warehouse: w, items: await stockApi.getBinStock(w) }))
      )
      setMainWarehouseStock(
        mainResults
          .filter((r): r is PromiseFulfilledResult<{ warehouse: string; items: BinStock[] }> => r.status === 'fulfilled')
          .map(r => r.value)
      )
    } catch (e) { console.error('Failed to load warehouse stock:', e) }
    finally { setLoadingWarehouseStock(false) }
  }, [warehouses])

  const mainWarehouseNames = useMemo(() => mainWarehouseStock.map(w => w.warehouse), [mainWarehouseStock])

  const openAddProduct = () => {
    setProductMode('new')
    setProductForm({
      item_name: '', item_code: '', existing_item: '', uom: 'Nos',
      standard_rate: 0, valuation_rate: 0, qty: 0,
      warehouse: mainWarehouseNames[0] || warehouses[0] || '',
    })
    setShowAddProduct(true)
  }

  const handleAddProduct = async () => {
    if (productMode === 'new' && !productForm.item_name.trim()) {
      toast({ title: t('sr.admin.common.warning_title'), description: t('sr.admin.mainv.err_name_required'), variant: 'destructive' })
      return
    }
    if (productMode === 'existing' && !productForm.existing_item) {
      toast({ title: t('sr.admin.common.warning_title'), description: t('sr.admin.mainv.err_item_required'), variant: 'destructive' })
      return
    }
    if (productMode === 'existing' && (!productForm.qty || productForm.qty <= 0)) {
      toast({ title: t('sr.admin.common.warning_title'), description: t('sr.admin.inv.err_qty_positive'), variant: 'destructive' })
      return
    }
    if ((productMode === 'existing' || productForm.qty > 0) && !productForm.warehouse) {
      toast({ title: t('sr.admin.common.warning_title'), description: t('sr.admin.inv.err_select_wh'), variant: 'destructive' })
      return
    }
    setAddingProduct(true)
    try {
      if (productMode === 'new') {
        const res = await stockApi.addProduct({
          item_name: productForm.item_name.trim(),
          item_code: productForm.item_code.trim() || undefined,
          uom: productForm.uom || undefined,
          standard_rate: productForm.standard_rate || 0,
          warehouse: productForm.warehouse || undefined,
          opening_qty: productForm.qty || 0,
          valuation_rate: productForm.valuation_rate || undefined,
        })
        toast({
          title: t('sr.admin.common.created_title'),
          description: t('sr.admin.mainv.toast_added').replace('{item}', res?.item_code || productForm.item_name),
        })
      } else {
        const res = await stockApi.createMaterialReceipt({ warehouse: productForm.warehouse, items: [{
          item_code: productForm.existing_item,
          qty: productForm.qty,
          rate: productForm.valuation_rate || 0,
        }] })
        toast({
          title: t('sr.admin.common.created_title'),
          description: t('sr.admin.mainv.toast_received').replace('{se}', res?.stock_entry || ''),
        })
      }
      setShowAddProduct(false)
      loadData(true)
      loadWarehouseStock()
    } catch (e: any) {
      toast({ title: t('sr.admin.common.error_title'), description: e?.message || String(e), variant: 'destructive' })
    } finally { setAddingProduct(false) }
  }

  // Clear validation errors when warehouse/rep/transaction context changes
  useEffect(() => { setValidationErrors({}) }, [form.warehouse, form.source_warehouse, form.transaction_type, form.sales_person])

  const filteredRep = useMemo(() => {
    if (!search) return repInventory
    const q = search.toLowerCase()
    return repInventory.filter(r => r.sales_person?.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))
  }, [repInventory, search])

  const filteredCust = useMemo(() => {
    if (!search) return custInventory
    const q = search.toLowerCase()
    return custInventory.filter(c => c.customer?.toLowerCase().includes(q) || c.sales_person?.toLowerCase().includes(q))
  }, [custInventory, search])

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { item_code: '', quantity: 1, uom: '', rate: 0 }] }))
  const removeItem = (i: number) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))

  const setItemField = (index: number, field: keyof FormItem, value: string | number) => {
    setForm(f => {
      const newItems = [...f.items]
      newItems[index] = { ...newItems[index], [field]: value }
      return { ...f, items: newItems }
    })
    // Clear validation error for changed field
    const errorKeyMap: Record<string, string> = { item_code: 'item', quantity: 'qty', uom: 'uom' }
    const errKey = errorKeyMap[field]
    if (errKey) setValidationErrors(prev => { const n = { ...prev }; delete n[`${index}-${errKey}`]; return n })
  }

  // Auto-fill UOM + rate when item selected; fetch valid UOMs in background
  const selectItem = async (index: number, itemCode: string) => {
    const found = items.find(it => it.name === itemCode)
    setForm(f => {
      const newItems = [...f.items]
      newItems[index] = {
        ...newItems[index],
        item_code: itemCode,
        uom: found?.stock_uom || newItems[index].uom || '',
        rate: found?.standard_rate || newItems[index].rate || 0,
      }
      return { ...f, items: newItems }
    })
    // Clear errors for this row
    setValidationErrors(prev => {
      const n = { ...prev }; delete n[`${index}-item`]; delete n[`${index}-qty`]; delete n[`${index}-uom`]; return n
    })
    // Fetch valid UOMs for this item if not cached
    if (!itemValidUOMs[itemCode]) {
      try {
        const conversions = await salesApi.getItemUOMs(itemCode)
        const validSet = new Set<string>()
        if (found?.stock_uom) validSet.add(found.stock_uom)
        conversions.forEach(u => validSet.add(u))
        if (validSet.size > 0) setItemValidUOMs(prev => ({ ...prev, [itemCode]: Array.from(validSet) }))
      } catch { /* falls back to showing all UOMs */ }
    }
  }

  const resetForm = () => {
    setForm({ sales_person: '', transaction_type: 'Load', warehouse: '', source_warehouse: '', items: [{ item_code: '', quantity: 1, uom: '', rate: 0 }] })
    setValidationErrors({})
  }

  /** Validate stock availability, UOMs, and quantities */
  const validateItems = async (): Promise<boolean> => {
    const errors: Record<string, string> = {}
    const validItems = form.items.filter(i => i.item_code)
    if (validItems.length === 0) {
      toast({ title: t('sr.admin.common.warning_title'), description: t('sr.admin.inv.err_add_item'), variant: 'destructive' })
      return false
    }
    // Quantity > 0
    form.items.forEach((item, idx) => {
      if (!item.item_code) return
      if (!item.quantity || item.quantity <= 0) errors[`${idx}-qty`] = t('sr.admin.inv.err_qty_positive')
    })
    // UOM valid for item
    for (let idx = 0; idx < form.items.length; idx++) {
      const item = form.items[idx]
      if (!item.item_code) continue
      if (!item.uom) { errors[`${idx}-uom`] = t('sr.admin.inv.err_select_uom'); continue }
      const valid = itemValidUOMs[item.item_code]
      if (valid?.length && !valid.includes(item.uom)) {
        errors[`${idx}-uom`] = t('sr.admin.inv.err_uom_invalid')
          .replace('{uom}', item.uom)
          .replace('{list}', valid.join(isRTL ? '، ' : ', '))
      }
    }
    if (!form.warehouse) errors['warehouse'] = t('sr.admin.inv.err_select_wh')
    // Stock availability — checked against whichever warehouse stock LEAVES
    // (Load: the picked source; Unload: the rep's van; Transfer: the source;
    // Adjustment is a receipt, nothing to check)
    const sourceWH = stockCheckWarehouse(form, selectedRepVan)
    if (sourceWH) {
      try {
        const stockMap = await salesApi.getStockBalance(sourceWH, validItems.map(i => i.item_code))
        form.items.forEach((item, idx) => {
          if (!item.item_code) return
          const avail = stockMap[item.item_code]
          if (avail === undefined) {
            errors[`${idx}-item`] = t('sr.admin.inv.err_never_stocked').replace('{warehouse}', sourceWH)
          } else if (avail <= 0) {
            errors[`${idx}-qty`] = t('sr.admin.inv.err_out_of_stock').replace('{warehouse}', sourceWH).replace('{balance}', String(avail))
          } else if (item.quantity > avail) {
            errors[`${idx}-qty`] = t('sr.admin.inv.err_qty_exceeds').replace('{requested}', String(item.quantity)).replace('{available}', String(avail))
          }
        })
      } catch (e) { console.warn('Stock check skipped:', e) }
    }
    setValidationErrors(errors)
    if (Object.keys(errors).length > 0) {
      toast({ title: t('sr.admin.inv.err_validation_title'), description: t('sr.admin.inv.err_validation_desc'), variant: 'destructive' })
      return false
    }
    return true
  }

  const handleCreate = async () => {
    if (!form.sales_person) {
      toast({ title: t('sr.admin.common.warning_title'), description: t('sr.admin.inv.err_select_rep'), variant: 'destructive' })
      return
    }
    if (!form.warehouse) {
      toast({ title: t('sr.admin.common.warning_title'), description: t('sr.admin.inv.err_select_wh'), variant: 'destructive' })
      return
    }
    if (form.transaction_type === 'Transfer' && !form.source_warehouse) {
      toast({ title: t('sr.admin.common.warning_title'), description: t('sr.admin.inv.err_select_source_wh'), variant: 'destructive' })
      return
    }
    if (repVanRequired(form.transaction_type) && !selectedRepVan) {
      toast({ title: t('sr.admin.common.warning_title'), description: t('sr.admin.inv.err_rep_no_van'), variant: 'destructive' })
      return
    }
    setValidating(true)
    const isValid = await validateItems()
    setValidating(false)
    if (!isValid) return
    setSaving(true)
    try {
      const created = await salesApi.createSalesRepInventory({
        sales_person: form.sales_person,
        transaction_type: form.transaction_type,
        ...buildWarehouseFields(form, selectedRepVan),
        items: form.items.filter(i => i.item_code).map(i => ({
          item_code: i.item_code,
          qty: i.quantity,
          rate: i.rate,
          ...(i.uom ? { uom: i.uom } : {}),
        })),
      })
      // Auto-submit so stock actually moves in ERPNext
      if (created?.name) {
        try {
          await salesApi.submitSalesRepInventory(created.name)
          toast({ title: t('sr.admin.inv.toast_created_submitted_title'), description: t('sr.admin.inv.toast_created_submitted_desc') })
        } catch (submitErr: any) {
          console.error('[Inventory] Submit failed:', submitErr)
          toast({ title: t('sr.admin.common.warning_title'), description: t('sr.admin.inv.toast_submit_failed').replace('{error}', submitErr?.message || ''), variant: 'destructive' })
        }
      } else {
        toast({ title: t('sr.admin.common.created_title'), description: t('sr.admin.inv.toast_created_desc') })
      }
      setShowCreate(false); loadData(true)
    } catch (e: any) { toast({ title: t('sr.admin.common.error_title'), description: e.message, variant: 'destructive' }) }
    finally { setSaving(false) }
  }

  const openEdit = async (record: SalesRepInventory) => {
    if (record.docstatus === 1) {
      toast({ title: t('sr.admin.common.warning_title'), description: t('sr.admin.inv.err_edit_submitted'), variant: 'destructive' })
      return
    }
    try {
      setSaving(true)
      const full = await salesApi.getSalesRepInventoryById(record.name)
      if (!full) throw new Error('Record not found')
      setForm({
        sales_person: full.sales_person || '',
        transaction_type: full.transaction_type || 'Load',
        // legacy drafts (pre-contract-fix) come back with an empty picker —
        // the stored `warehouse` must not be misread as the picked leg
        ...warehouseFormFromRecord(full),
        items: full.items?.length
          ? full.items.map(it => ({ item_code: it.item_code, quantity: it.qty, uom: it.uom || '', rate: it.rate || 0 }))
          : [{ item_code: '', quantity: 1, uom: '', rate: 0 }],
      })
      setValidationErrors({})
      setEditingRecord(record.name)
      setShowCreate(true)
    } catch (e: any) { toast({ title: t('sr.admin.common.error_title'), description: e.message, variant: 'destructive' }) }
    finally { setSaving(false) }
  }

  const handleUpdate = async () => {
    if (!editingRecord) return
    if (!form.sales_person) {
      toast({ title: t('sr.admin.common.warning_title'), description: t('sr.admin.inv.err_select_rep'), variant: 'destructive' })
      return
    }
    if (!form.warehouse) {
      toast({ title: t('sr.admin.common.warning_title'), description: t('sr.admin.inv.err_select_wh'), variant: 'destructive' })
      return
    }
    if (form.transaction_type === 'Transfer' && !form.source_warehouse) {
      toast({ title: t('sr.admin.common.warning_title'), description: t('sr.admin.inv.err_select_source_wh_short'), variant: 'destructive' })
      return
    }
    if (repVanRequired(form.transaction_type) && !selectedRepVan) {
      toast({ title: t('sr.admin.common.warning_title'), description: t('sr.admin.inv.err_rep_no_van'), variant: 'destructive' })
      return
    }
    setValidating(true)
    const isValid = await validateItems()
    setValidating(false)
    if (!isValid) return
    setSaving(true)
    try {
      await salesApi.updateSalesRepInventory(editingRecord, {
        sales_person: form.sales_person,
        transaction_type: form.transaction_type,
        ...buildWarehouseFields(form, selectedRepVan),
        items: form.items.filter(i => i.item_code).map(i => ({
          item_code: i.item_code,
          qty: i.quantity,
          rate: i.rate,
          ...(i.uom ? { uom: i.uom } : {}),
        })),
      })
      toast({ title: t('sr.admin.common.updated_title'), description: t('sr.admin.inv.toast_updated_desc') })
      setShowCreate(false); setEditingRecord(null); loadData(true)
    } catch (e: any) { toast({ title: t('sr.admin.common.error_title'), description: e.message, variant: 'destructive' }) }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    if (deleteTarget.docstatus === 1) {
      toast({ title: t('sr.admin.common.warning_title'), description: t('sr.admin.inv.err_delete_submitted'), variant: 'destructive' })
      setDeleteTarget(null)
      return
    }
    setDeleting(true)
    try {
      await salesApi.deleteSalesRepInventory(deleteTarget.name)
      toast({ title: t('sr.admin.common.deleted_title_alt'), description: t('sr.admin.inv.toast_deleted_desc').replace('{name}', deleteTarget.name) })
      setDeleteTarget(null); loadData(true)
    } catch (e: any) { toast({ title: t('sr.admin.common.error_title'), description: e.message, variant: 'destructive' }) }
    finally { setDeleting(false) }
  }

  if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-10 w-64" />{[1, 2, 3].map(i => <Skeleton key={i} className="h-14" />)}</div>

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('sr.admin.inv.title')}</h1>
          <p className="text-sm text-gray-500">{t('sr.admin.inv.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={refreshing}><RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} /></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t('sr.admin.inv.stat_rep_records'), value: repInventory.length, color: 'text-blue-600' },
          { label: t('sr.admin.inv.stat_loads'), value: repInventory.filter(r => r.transaction_type === 'Load').length, color: 'text-emerald-600' },
          { label: t('sr.admin.inv.stat_unloads'), value: repInventory.filter(r => r.transaction_type === 'Unload').length, color: 'text-amber-600' },
          { label: t('sr.admin.inv.stat_customer_records'), value: custInventory.length, color: 'text-purple-600' },
        ].map((s, i) => (
          <Card key={i} className="border-0 shadow-sm"><CardContent className="p-4">
            <p className="text-xs text-gray-500">{s.label}</p><p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); if (v === 'warehouse-stock' && warehouseStock.length === 0) loadWarehouseStock() }}>
        <TabsList className="bg-gray-100">
          <TabsTrigger value="rep-inventory" className="gap-2"><Package className="h-4 w-4" /> {t('sr.admin.inv.tab_rep')}</TabsTrigger>
          <TabsTrigger value="customer-inventory" className="gap-2"><Store className="h-4 w-4" /> {t('sr.admin.inv.tab_customer')}</TabsTrigger>
          <TabsTrigger value="warehouse-stock" className="gap-2"><Warehouse className="h-4 w-4" /> {t('sr.admin.inv.tab_warehouse')}</TabsTrigger>
        </TabsList>

        {/* Rep Inventory Tab */}
        <TabsContent value="rep-inventory" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
              <Input placeholder={t('sr.admin.common.search_placeholder')} value={search} onChange={e => setSearch(e.target.value)} className={cn('h-9 text-sm', isRTL ? 'pr-9' : 'pl-9')} />
            </div>
            <Button size="sm" onClick={() => { resetForm(); setShowCreate(true) }} className="bg-teal-600 hover:bg-teal-700">
              <Plus className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} /> {t('sr.admin.inv.new_record_btn')}
            </Button>
          </div>

          <Card className="border-0 shadow-sm overflow-hidden">
            <Table>
              <TableHeader><TableRow className="bg-gray-50/50">
                <TableHead className="text-xs font-semibold">{t('sr.admin.common.th_id')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.common.sales_rep')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.common.th_type')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.common.date')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.inv.th_items')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.common.th_status')}</TableHead>
                <TableHead className="text-xs font-semibold w-10"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredRep.length === 0 ? (
                  <TableRow><TableCell colSpan={7}><EmptyState icon={Package} title={t('sr.admin.inv.empty_records')} hint={t('sr.admin.inv.empty_records_hint')} /></TableCell></TableRow>
                ) : filteredRep.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(r => (
                  <TableRow key={r.name} className="hover:bg-gray-50/50">
                    <TableCell className="text-xs font-mono text-gray-500">{r.name}</TableCell>
                    <TableCell className="text-sm font-medium">{r.sales_person}</TableCell>
                    <TableCell>
                      <Badge className={cn('text-[10px]',
                        r.transaction_type === 'Load' ? 'bg-emerald-100 text-emerald-700'
                        : r.transaction_type === 'Unload' ? 'bg-amber-100 text-amber-700'
                        : r.transaction_type === 'Adjustment' ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                      )}>
                        {r.transaction_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{r.posting_date}</TableCell>
                    <TableCell className="text-sm">{r.items?.length || 0}</TableCell>
                    <TableCell><Badge className={cn('text-[10px]', r.docstatus === 1 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600')}>{r.docstatus === 1 ? t('sr.status.submitted') : t('sr.status.draft')}</Badge></TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                          <DropdownMenuItem onClick={() => openEdit(r)} disabled={r.docstatus === 1}>
                            <Pencil className="h-3.5 w-3.5 mr-2" /> {t('sr.admin.common.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDeleteTarget(r)} disabled={r.docstatus === 1} className="text-red-600 focus:text-red-600">
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> {t('sr.admin.common.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Customer Inventory Tab */}
        <TabsContent value="customer-inventory" className="mt-4 space-y-4">
          <Card className="border-0 shadow-sm"><CardContent className="p-3">
            <div className="relative">
              <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
              <Input placeholder={t('sr.admin.common.search_placeholder')} value={search} onChange={e => setSearch(e.target.value)} className={cn('h-9 text-sm', isRTL ? 'pr-9' : 'pl-9')} />
            </div>
          </CardContent></Card>

          <Card className="border-0 shadow-sm overflow-hidden">
            <Table>
              <TableHeader><TableRow className="bg-gray-50/50">
                <TableHead className="text-xs font-semibold w-8"></TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.common.th_id')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.common.customer')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.common.sales_rep')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.common.date')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.inv.th_items')}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredCust.length === 0 ? (
                  <TableRow><TableCell colSpan={6}><EmptyState icon={Store} title={t('sr.admin.inv.empty_records')} hint={t('sr.admin.inv.empty_records_hint')} /></TableCell></TableRow>
                ) : filteredCust.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(c => {
                  const isExpanded = expandedCustRecord === c.name
                  const isLoadingThis = loadingCustDetail === c.name
                  const detailItems = custRecordItems[c.name]

                  const toggleExpand = async () => {
                    if (isExpanded) { setExpandedCustRecord(null); return }
                    setExpandedCustRecord(c.name)
                    if (!custRecordItems[c.name]) {
                      setLoadingCustDetail(c.name)
                      try {
                        const full = await salesApi.getCustomerInventoryById(c.name)
                        setCustRecordItems(prev => ({ ...prev, [c.name]: full?.items || [] }))
                      } catch (e) { console.error('Failed to load customer inventory detail:', e) }
                      finally { setLoadingCustDetail(null) }
                    }
                  }

                  return (
                    <React.Fragment key={c.name}>
                      <TableRow className="hover:bg-gray-50/50 cursor-pointer" onClick={toggleExpand}>
                        <TableCell className="w-8 px-2">
                          {isLoadingThis ? (
                            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                          ) : isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-gray-500">{c.name}</TableCell>
                        <TableCell className="text-sm font-medium">{c.customer}</TableCell>
                        <TableCell className="text-sm text-gray-600">{c.sales_person}</TableCell>
                        <TableCell className="text-sm text-gray-600">{c.visit_date || c.creation?.split(' ')[0] || ''}</TableCell>
                        <TableCell className="text-sm text-gray-400">{isExpanded ? (detailItems?.length || '...') : '⟩'}</TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${c.name}-detail`}>
                          <TableCell colSpan={6} className="p-0 bg-gray-50/80">
                            <div className="px-6 py-3">
                              <p className="text-xs font-semibold text-gray-500 mb-2">{t('sr.admin.inv.cust_detail_title')}</p>
                              {isLoadingThis ? (
                                <div className="flex items-center gap-2 py-4 text-gray-400 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> {t('sr.admin.common.loading')}</div>
                              ) : detailItems && detailItems.length > 0 ? (
                                <Table>
                                  <TableHeader><TableRow className="bg-white/60">
                                    <TableHead className="text-[11px] font-semibold">{t('sr.admin.inv.th_item')}</TableHead>
                                    <TableHead className="text-[11px] font-semibold">{t('sr.admin.inv.th_code')}</TableHead>
                                    <TableHead className="text-[11px] font-semibold">{t('sr.admin.inv.th_current_stock')}</TableHead>
                                    <TableHead className="text-[11px] font-semibold">{t('sr.admin.inv.th_batch')}</TableHead>
                                    <TableHead className="text-[11px] font-semibold">{t('sr.admin.inv.th_reorder')}</TableHead>
                                  </TableRow></TableHeader>
                                  <TableBody>
                                    {detailItems.map((item: any, idx: number) => (
                                      <TableRow key={idx} className="border-b border-gray-100">
                                        <TableCell className="text-sm">{item.item_name || item.item_code}</TableCell>
                                        <TableCell className="text-xs font-mono text-gray-500">{item.item_code}</TableCell>
                                        <TableCell className={cn('text-sm font-medium', (item.current_stock || 0) <= 0 ? 'text-red-500' : 'text-emerald-600')}>
                                          {item.current_stock ?? 0}
                                        </TableCell>
                                        <TableCell className="text-xs text-gray-500">{item.batch_no || '—'}</TableCell>
                                        <TableCell className="text-xs text-gray-500">{item.reorder_level || '—'}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              ) : (
                                <p className="text-sm text-gray-400 py-3">{t('sr.admin.inv.empty_items')}</p>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Warehouse Stock Tab */}
        <TabsContent value="warehouse-stock" className="mt-4 space-y-4">
          <Card className="border-0 shadow-sm"><CardContent className="p-3 flex items-center gap-3">
            <div className="relative flex-1">
              <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
              <Input placeholder={t('sr.admin.inv.wh_search_placeholder')} value={whStockSearch} onChange={e => setWhStockSearch(e.target.value)} className={cn('h-9 text-sm', isRTL ? 'pr-9' : 'pl-9')} />
            </div>
            <Button size="sm" onClick={openAddProduct} className="bg-blue-600 hover:bg-blue-700">
              <Plus className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} /> {t('sr.admin.mainv.add_product_btn')}
            </Button>
            <Button variant="outline" size="sm" onClick={loadWarehouseStock} disabled={loadingWarehouseStock}>
              <RefreshCw className={cn('h-4 w-4', loadingWarehouseStock && 'animate-spin')} />
            </Button>
          </CardContent></Card>

          {loadingWarehouseStock ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-40" />)}</div>
          ) : (
            <>
            {/* Main (company) warehouses — always visible so stock can be added */}
            {mainWarehouseStock.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t('sr.admin.mainv.main_section')}</p>
                {mainWarehouseStock.map((wh, idx) => {
                  const q = whStockSearch.toLowerCase()
                  const filteredItems = q
                    ? wh.items.filter(i => i.item_code?.toLowerCase().includes(q) || i.item_name?.toLowerCase().includes(q) || wh.warehouse.toLowerCase().includes(q))
                    : wh.items
                  if (q && filteredItems.length === 0) return null
                  return (
                    <Card key={idx} className="border-0 shadow-sm overflow-hidden">
                      <div className="bg-gradient-to-r from-blue-50 to-sky-50 px-4 py-3 border-b border-blue-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Warehouse className="h-4 w-4 text-blue-600" />
                            <p className="text-sm font-bold text-gray-900">{wh.warehouse}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-blue-100 text-blue-700 text-xs">{filteredItems.length} {t('sr.admin.inv.items_unit')}</Badge>
                            <Button
                              size="sm" variant="outline" className="h-7 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                              onClick={() => { openAddProduct(); setProductForm(f => ({ ...f, warehouse: wh.warehouse })) }}
                            >
                              <Plus className="h-3 w-3 mr-1" /> {t('sr.admin.mainv.add_product_btn')}
                            </Button>
                          </div>
                        </div>
                      </div>
                      {filteredItems.length === 0 ? (
                        <CardContent className="py-6 text-center text-xs text-gray-400">{t('sr.admin.mainv.empty_main')}</CardContent>
                      ) : (
                        <Table>
                          <TableHeader><TableRow className="bg-gray-50/50">
                            <TableHead className="text-[11px] font-semibold">{t('sr.admin.inv.th_item')}</TableHead>
                            <TableHead className="text-[11px] font-semibold">{t('sr.admin.inv.th_code')}</TableHead>
                            <TableHead className="text-[11px] font-semibold">{t('sr.admin.inv.th_qty')}</TableHead>
                            <TableHead className="text-[11px] font-semibold">{t('sr.admin.inv.th_uom')}</TableHead>
                            <TableHead className="text-[11px] font-semibold">{t('sr.admin.inv.th_value')}</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {filteredItems.map((item, iIdx) => (
                              <TableRow key={iIdx} className="border-b border-gray-50">
                                <TableCell className="text-sm">{items.find(it => it.name === item.item_code)?.item_name || item.item_name || item.item_code}</TableCell>
                                <TableCell className="text-xs font-mono text-gray-500">{item.item_code}</TableCell>
                                <TableCell className={cn('text-sm font-medium', (item.actual_qty || 0) <= 0 ? 'text-red-500' : 'text-emerald-600')}>
                                  {item.actual_qty ?? 0}
                                </TableCell>
                                <TableCell className="text-xs text-gray-500">{item.stock_uom || '—'}</TableCell>
                                <TableCell className="text-sm text-gray-600">{(item.stock_value || 0).toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </Card>
                  )
                })}
              </div>
            )}

            {/* Rep (van) warehouses */}
            {warehouseStock.length > 0 && (
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t('sr.admin.mainv.rep_section')}</p>
            )}
            {mainWarehouseStock.length === 0 && warehouseStock.length === 0 ? (
            <Card className="border-0 shadow-sm"><CardContent className="py-12 text-center text-gray-400">
              <Warehouse className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p>{t('sr.admin.inv.empty_warehouses')}</p>
              <p className="text-xs mt-1">{t('sr.admin.inv.empty_warehouses_hint')}</p>
            </CardContent></Card>
          ) : (
            warehouseStock.map((wh, idx) => {
              const q = whStockSearch.toLowerCase()
              const filteredItems = q
                ? wh.items.filter(i => i.item_code?.toLowerCase().includes(q) || i.item_name?.toLowerCase().includes(q) || wh.salesPerson.toLowerCase().includes(q))
                : wh.items
              if (q && filteredItems.length === 0) return null

              return (
                <Card key={idx} className="border-0 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 border-b border-amber-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{wh.salesPerson}</p>
                        <p className="text-xs text-gray-500">{wh.warehouse}</p>
                      </div>
                      <Badge className="bg-amber-100 text-amber-700 text-xs">{filteredItems.length} {t('sr.admin.inv.items_unit')}</Badge>
                    </div>
                  </div>
                  <Table>
                    <TableHeader><TableRow className="bg-gray-50/50">
                      <TableHead className="text-[11px] font-semibold">{t('sr.admin.inv.th_item')}</TableHead>
                      <TableHead className="text-[11px] font-semibold">{t('sr.admin.inv.th_code')}</TableHead>
                      <TableHead className="text-[11px] font-semibold">{t('sr.admin.inv.th_qty')}</TableHead>
                      <TableHead className="text-[11px] font-semibold">{t('sr.admin.inv.th_uom')}</TableHead>
                      <TableHead className="text-[11px] font-semibold">{t('sr.admin.inv.th_value')}</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {filteredItems.map((item, iIdx) => (
                        <TableRow key={iIdx} className="border-b border-gray-50">
                          <TableCell className="text-sm">{items.find(it => it.name === item.item_code)?.item_name || item.item_name || item.item_code}</TableCell>
                          <TableCell className="text-xs font-mono text-gray-500">{item.item_code}</TableCell>
                          <TableCell className={cn('text-sm font-medium', (item.actual_qty || 0) <= 0 ? 'text-red-500' : 'text-emerald-600')}>
                            {item.actual_qty ?? 0}
                          </TableCell>
                          <TableCell className="text-xs text-gray-500">{item.stock_uom || '—'}</TableCell>
                          <TableCell className="text-sm text-gray-600">{(item.stock_value || 0).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )
            })
          )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Create / Edit Inventory Record Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) setEditingRecord(null) }}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingRecord ? t('sr.admin.inv.dialog_edit_title').replace('{name}', editingRecord) : t('sr.admin.inv.dialog_create_title')}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Row 1: Sales Person + Transaction Type */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('sr.admin.common.sales_person')} *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className={cn('w-full mt-1 justify-between font-normal', !form.sales_person && 'text-muted-foreground')}>
                      {form.sales_person
                        ? (salesPersons.find(sp => sp.name === form.sales_person)?.sales_person_name || form.sales_person)
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
                          {salesPersons.map(sp => (
                            <CommandItem key={sp.name} value={sp.sales_person_name || sp.name} onSelect={() => setForm(f => ({
                              ...f,
                              sales_person: sp.name,
                              // adjustments target the rep's own van by default
                              warehouse: f.transaction_type === 'Adjustment' && !f.warehouse ? (sp.inventory_warehouse || '') : f.warehouse,
                            }))}>
                              <Check className={cn('mr-2 h-4 w-4', form.sales_person === sp.name ? 'opacity-100' : 'opacity-0')} />
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
                <Label>{t('sr.admin.inv.label_transaction_type')} *</Label>
                <Select value={form.transaction_type} onValueChange={(v: typeof form.transaction_type) => setForm(f => ({
                  ...f,
                  transaction_type: v,
                  // a van can't stay picked once the van leg becomes implicit
                  warehouse: repVanRequired(v) && vanSet.has(f.warehouse) ? '' : f.warehouse,
                }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Load">📦 {t('sr.admin.inv.tt_load')}</SelectItem>
                    <SelectItem value="Unload">📤 {t('sr.admin.inv.tt_unload')}</SelectItem>
                    <SelectItem value="Adjustment">🔧 {t('sr.admin.inv.tt_adjustment')}</SelectItem>
                    <SelectItem value="Transfer">🔄 {t('sr.admin.inv.tt_transfer')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Warehouse(s) */}
            <div className={cn('grid gap-3', form.transaction_type === 'Transfer' ? 'grid-cols-2' : 'grid-cols-1')}>
              <div>
                <Label className="flex items-center gap-1.5">
                  <Warehouse className="h-3.5 w-3.5" />
                  {form.transaction_type === 'Transfer'
                    ? t('sr.admin.inv.label_dest_wh')
                    : form.transaction_type === 'Load'
                      ? t('sr.admin.inv.label_source_wh')
                      : t('sr.admin.common.warehouse')
                  } *
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className={cn('w-full mt-1 justify-between font-normal text-sm', !form.warehouse && 'text-muted-foreground', validationErrors['warehouse'] && 'border-red-400 bg-red-50')}>
                      {form.warehouse || t('sr.admin.inv.select_wh_placeholder')}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder={t('sr.admin.inv.search_short')} />
                      <CommandList>
                        <CommandEmpty>{t('sr.admin.inv.none_found')}</CommandEmpty>
                        <CommandGroup>
                          {pickableWarehouses.map(w => (
                            <CommandItem key={w} value={w} onSelect={() => setForm(f => ({ ...f, warehouse: w }))}>
                              <Check className={cn('mr-2 h-4 w-4', form.warehouse === w ? 'opacity-100' : 'opacity-0')} />
                              {w}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {validationErrors['warehouse'] && (
                  <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3 shrink-0" />{validationErrors['warehouse']}</p>
                )}
                {repVanRequired(form.transaction_type) && form.sales_person && (
                  selectedRepVan ? (
                    <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
                      <ArrowRightLeft className="h-3 w-3 shrink-0" />
                      {(form.transaction_type === 'Load' ? t('sr.admin.inv.van_dest_hint') : t('sr.admin.inv.van_source_hint')).replace('{van}', selectedRepVan)}
                    </p>
                  ) : (
                    <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 shrink-0" />{t('sr.admin.inv.err_rep_no_van')}
                    </p>
                  )
                )}
              </div>
              {form.transaction_type === 'Transfer' && (
                <div>
                  <Label className="flex items-center gap-1.5">
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    {t('sr.admin.inv.label_source_wh')} *
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className={cn('w-full mt-1 justify-between font-normal text-sm', !form.source_warehouse && 'text-muted-foreground')}>
                        {form.source_warehouse || t('sr.admin.inv.select_source_wh_placeholder')}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder={t('sr.admin.inv.search_short')} />
                        <CommandList>
                          <CommandEmpty>{t('sr.admin.inv.none_found')}</CommandEmpty>
                          <CommandGroup>
                            {warehouses.filter(w => w !== form.warehouse).map(w => (
                              <CommandItem key={w} value={w} onSelect={() => setForm(f => ({ ...f, source_warehouse: w }))}>
                                <Check className={cn('mr-2 h-4 w-4', form.source_warehouse === w ? 'opacity-100' : 'opacity-0')} />
                                {w}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            {/* Contextual hint */}
            <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
              {form.transaction_type === 'Load' && t('sr.admin.inv.hint_load')}
              {form.transaction_type === 'Unload' && t('sr.admin.inv.hint_unload')}
              {form.transaction_type === 'Adjustment' && t('sr.admin.inv.hint_adjustment')}
              {form.transaction_type === 'Transfer' && t('sr.admin.inv.hint_transfer')}
            </div>

            {/* Items section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>{t('sr.admin.inv.th_items')} *</Label>
                <Button variant="outline" size="sm" type="button" onClick={addItem}><Plus className="h-3 w-3 mr-1" /> {t('sr.admin.inv.add_item_btn')}</Button>
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-[1fr_80px_120px_90px_36px] gap-2 mb-1 px-1">
                <span className="text-[11px] font-medium text-gray-500">{t('sr.admin.inv.th_item')}</span>
                <span className="text-[11px] font-medium text-gray-500">{t('sr.admin.inv.th_qty')}</span>
                <span className="text-[11px] font-medium text-gray-500">{t('sr.admin.inv.th_uom')}</span>
                <span className="text-[11px] font-medium text-gray-500">{t('sr.admin.inv.th_rate')}</span>
                <span></span>
              </div>

              {form.items.map((item, i) => (
                <div key={i} className="grid grid-cols-[1fr_80px_120px_90px_36px] gap-2 mb-2 items-center">
                  {/* Item combobox */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className={cn('h-9 justify-between font-normal text-sm w-full', !item.item_code && 'text-muted-foreground', validationErrors[`${i}-item`] && 'border-red-400 bg-red-50')}>
                        <span className="truncate">
                          {item.item_code
                            ? (items.find(it => it.name === item.item_code)?.item_name || item.item_code)
                            : (t('sr.admin.inv.search_short'))}
                        </span>
                        <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[320px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder={t('sr.admin.inv.item_search_placeholder')} />
                        <CommandList>
                          <CommandEmpty>{t('sr.admin.inv.no_items_found')}</CommandEmpty>
                          <CommandGroup>
                            {items.map(it => (
                              <CommandItem
                                key={it.name}
                                value={`${it.name} ${it.item_name}`}
                                onSelect={() => selectItem(i, it.name)}
                              >
                                <Check className={cn('mr-2 h-4 w-4 shrink-0', item.item_code === it.name ? 'opacity-100' : 'opacity-0')} />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{it.item_name}</p>
                                  <p className="text-xs text-muted-foreground">{it.name}{it.stock_uom ? ` · ${it.stock_uom}` : ''}</p>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {/* Quantity */}
                  <Input type="number" min={0.01} step="any" value={item.quantity} onChange={e => setItemField(i, 'quantity', Number(e.target.value) || 0)} className={cn('h-9 text-sm', validationErrors[`${i}-qty`] && 'border-red-400 bg-red-50')} />

                  {/* UOM combobox */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className={cn('h-9 justify-between font-normal text-sm w-full', !item.uom && 'text-muted-foreground', validationErrors[`${i}-uom`] && 'border-red-400 bg-red-50')}>
                        <span className="truncate">{item.uom || t('sr.admin.inv.unit_placeholder')}</span>
                        <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder={t('sr.admin.inv.search_short')} />
                        <CommandList>
                          <CommandEmpty>{t('sr.admin.inv.uom_none')}</CommandEmpty>
                          <CommandGroup>
                            {(item.item_code && itemValidUOMs[item.item_code]?.length ? itemValidUOMs[item.item_code] : uoms).map(u => (
                              <CommandItem key={u} value={u} onSelect={() => setItemField(i, 'uom', u)}>
                                <Check className={cn('mr-2 h-4 w-4', item.uom === u ? 'opacity-100' : 'opacity-0')} />
                                {u}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {/* Rate */}
                  <Input type="number" min={0} step="any" value={item.rate} onChange={e => setItemField(i, 'rate', Number(e.target.value) || 0)} className="h-9 text-sm" />

                  {/* Remove */}
                  {form.items.length > 1
                    ? <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-red-400 hover:text-red-600" onClick={() => removeItem(i)}><X className="h-4 w-4" /></Button>
                    : <div className="w-9" />
                  }
                  {/* Inline validation errors */}
                  {(validationErrors[`${i}-item`] || validationErrors[`${i}-qty`] || validationErrors[`${i}-uom`]) && (
                    <div className="col-span-5 -mt-1 space-y-0.5">
                      {validationErrors[`${i}-item`] && <p className="text-[11px] text-red-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3 shrink-0" />{validationErrors[`${i}-item`]}</p>}
                      {validationErrors[`${i}-qty`] && <p className="text-[11px] text-red-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3 shrink-0" />{validationErrors[`${i}-qty`]}</p>}
                      {validationErrors[`${i}-uom`] && <p className="text-[11px] text-red-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3 shrink-0" />{validationErrors[`${i}-uom`]}</p>}
                    </div>
                  )}
                </div>
              ))}

              {/* Total summary */}
              {form.items.some(i => i.item_code) && (
                <div className="flex items-center justify-end gap-4 mt-2 pt-2 border-t text-sm text-gray-600">
                  <span>{t('sr.admin.inv.total_items')} <strong>{form.items.filter(i => i.item_code).length}</strong></span>
                  <span>{t('sr.admin.inv.total_qty')} <strong>{form.items.reduce((s, i) => s + (i.item_code ? i.quantity : 0), 0)}</strong></span>
                  <span>{t('sr.admin.inv.total_value')} <strong>{form.items.reduce((s, i) => s + (i.item_code ? i.quantity * i.rate : 0), 0).toFixed(2)}</strong></span>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setEditingRecord(null) }}>{t('sr.admin.common.cancel')}</Button>
            <Button
              onClick={editingRecord ? handleUpdate : handleCreate}
              disabled={saving || validating}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {(saving || validating) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {validating
                ? t('sr.admin.inv.validating')
                : editingRecord
                  ? t('sr.admin.inv.save_changes')
                  : t('sr.admin.common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Product to Main Inventory */}
      <Dialog open={showAddProduct} onOpenChange={setShowAddProduct}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('sr.admin.mainv.dialog_title')}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            {/* Mode toggle */}
            <div className="grid grid-cols-2 gap-2">
              {([['new', t('sr.admin.mainv.mode_new')], ['existing', t('sr.admin.mainv.mode_existing')]] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setProductMode(mode)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                    productMode === mode
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {productMode === 'new' ? (
              <>
                <div>
                  <Label>{t('sr.admin.mainv.name_label')} *</Label>
                  <Input value={productForm.item_name} onChange={e => setProductForm(f => ({ ...f, item_name: e.target.value }))} className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{t('sr.admin.mainv.code_label')}</Label>
                    <Input value={productForm.item_code} onChange={e => setProductForm(f => ({ ...f, item_code: e.target.value }))} className="mt-1 font-mono" />
                  </div>
                  <div>
                    <Label>{t('sr.admin.inv.th_uom')}</Label>
                    <Select value={productForm.uom} onValueChange={(v) => setProductForm(f => ({ ...f, uom: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(uoms.length ? uoms : ['Nos']).map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <Label>{t('sr.admin.inv.th_item')} *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className={cn('w-full mt-1 justify-between font-normal', !productForm.existing_item && 'text-muted-foreground')}>
                      <span className="truncate">
                        {productForm.existing_item
                          ? (items.find(it => it.name === productForm.existing_item)?.item_name || productForm.existing_item)
                          : t('sr.admin.inv.item_search_placeholder')}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder={t('sr.admin.inv.item_search_placeholder')} />
                      <CommandList>
                        <CommandEmpty>{t('sr.admin.inv.no_items_found')}</CommandEmpty>
                        <CommandGroup>
                          {items.map(it => (
                            <CommandItem key={it.name} value={`${it.name} ${it.item_name}`} onSelect={() => setProductForm(f => ({ ...f, existing_item: it.name }))}>
                              <Check className={cn('mr-2 h-4 w-4 shrink-0', productForm.existing_item === it.name ? 'opacity-100' : 'opacity-0')} />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{it.item_name}</p>
                                <p className="text-xs text-muted-foreground">{it.name}{it.stock_uom ? ` · ${it.stock_uom}` : ''}</p>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Warehouse */}
            <div>
              <Label className="flex items-center gap-1.5">
                <Warehouse className="h-3.5 w-3.5" /> {t('sr.admin.common.warehouse')} {productMode === 'existing' || productForm.qty > 0 ? '*' : ''}
              </Label>
              <Select value={productForm.warehouse} onValueChange={(v) => setProductForm(f => ({ ...f, warehouse: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={t('sr.admin.inv.select_wh_placeholder')} /></SelectTrigger>
                <SelectContent>
                  {(mainWarehouseNames.length ? mainWarehouseNames : warehouses).map(w => (
                    <SelectItem key={w} value={w}>{w}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Qty + prices */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>{t('sr.admin.mainv.qty_label')}{productMode === 'existing' ? ' *' : ''}</Label>
                <Input type="number" min={0} step="any" value={productForm.qty}
                  onChange={e => setProductForm(f => ({ ...f, qty: Number(e.target.value) || 0 }))} className="mt-1" />
              </div>
              {productMode === 'new' && (
                <div>
                  <Label>{t('sr.admin.mainv.rate_label')}</Label>
                  <Input type="number" min={0} step="any" value={productForm.standard_rate}
                    onChange={e => setProductForm(f => ({ ...f, standard_rate: Number(e.target.value) || 0 }))} className="mt-1" />
                </div>
              )}
              <div>
                <Label>{t('sr.admin.mainv.valuation_label')}</Label>
                <Input type="number" min={0} step="any" value={productForm.valuation_rate}
                  onChange={e => setProductForm(f => ({ ...f, valuation_rate: Number(e.target.value) || 0 }))} className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddProduct(false)}>{t('sr.admin.common.cancel')}</Button>
            <Button onClick={handleAddProduct} disabled={addingProduct} className="bg-blue-600 hover:bg-blue-700">
              {addingProduct && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('sr.admin.mainv.add_product_btn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('sr.admin.inv.confirm_delete_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('sr.admin.inv.confirm_delete_desc').replace('{name}', deleteTarget?.name ?? '')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('sr.admin.common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('sr.admin.common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
