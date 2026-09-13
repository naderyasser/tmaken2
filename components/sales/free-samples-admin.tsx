/**
 * Free Samples Admin — Manage sample allocations & view distribution history
 * Product-centric: pick an item → assign reps with individual quantities → set allowed customers
 */

'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
    salesApi,
    type FreeSampleAllocation,
    type FreeSampleDistribution,
    type SalesPerson,
    type Item,
    type Customer,
} from '@/lib/sales-api'
import { frappeClient } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { useToast } from '@/hooks/use-toast'
import {
    Search, RefreshCw, Gift, Package, Plus, Loader2,
    Eye, CheckCircle2, XCircle, Users,
    X, History, ChevronsUpDown,
    Pencil, Trash2, AlertTriangle,
} from 'lucide-react'

const STATUS_MAP: Record<string, { label: string; labelAr: string; class: string }> = {
    Active: { label: 'Active', labelAr: 'نشط', class: 'bg-emerald-100 text-emerald-700' },
    Exhausted: { label: 'Exhausted', labelAr: 'مستنفد', class: 'bg-amber-100 text-amber-700' },
    Cancelled: { label: 'Cancelled', labelAr: 'ملغي', class: 'bg-red-100 text-red-700' },
}

const DIST_STATUS_MAP: Record<string, { label: string; labelAr: string; class: string }> = {
    Completed: { label: 'Completed', labelAr: 'مكتمل', class: 'bg-emerald-100 text-emerald-700' },
    Cancelled: { label: 'Cancelled', labelAr: 'ملغي', class: 'bg-red-100 text-red-700' },
}

// ── Form types ──
interface FormRep {
    sales_person: string
    sales_person_name: string
    allocated_qty: number
}

interface FormCustomer {
    customer: string
    customer_name: string
}

export function FreeSamplesAdmin() {
    const { isRTL } = useI18n()
    const { toast } = useToast()

    // ── Tabs ──
    const [activeTab, setActiveTab] = useState<'allocations' | 'distributions'>('allocations')

    // ── Allocations state ──
    const [allocations, setAllocations] = useState<FreeSampleAllocation[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')

    // ── Distributions state ──
    const [distributions, setDistributions] = useState<FreeSampleDistribution[]>([])
    const [distLoading, setDistLoading] = useState(false)
    const [distSearch, setDistSearch] = useState('')

    // ── Create dialog ──
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [creating, setCreating] = useState(false)
    const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([])
    const [items, setItems] = useState<Item[]>([])
    const [customers, setCustomers] = useState<Customer[]>([])

    // Form fields
    const [formItemCode, setFormItemCode] = useState('')
    const [formAllowAll, setFormAllowAll] = useState(true)
    const [formMaxPerCustomer, setFormMaxPerCustomer] = useState(5)
    const [formNotes, setFormNotes] = useState('')
    // Search states for dropdowns
    const [repSearch, setRepSearch] = useState('')
    const [customerSearchForm, setCustomerSearchForm] = useState('')
    const [formReps, setFormReps] = useState<FormRep[]>([])
    const [formCustomers, setFormCustomers] = useState<FormCustomer[]>([])
    const [repComboOpen, setRepComboOpen] = useState(false)
    const [customerComboOpen, setCustomerComboOpen] = useState(false)

    // ── Detail dialog ──
    const [selectedAlloc, setSelectedAlloc] = useState<FreeSampleAllocation | null>(null)

    // ── Detail distribution ──
    const [selectedDist, setSelectedDist] = useState<FreeSampleDistribution | null>(null)

    // ── Edit mode ──
    const [editingAlloc, setEditingAlloc] = useState<FreeSampleAllocation | null>(null)

    // ── Delete confirmation ──
    const [deletingAlloc, setDeletingAlloc] = useState<FreeSampleAllocation | null>(null)
    const [deleteLoading, setDeleteLoading] = useState(false)

    // ── Load allocations ──
    const loadAllocations = useCallback(async () => {
        try {
            const data = await frappeClient.getList<FreeSampleAllocation>('Free Sample Allocation', {
                fields: ['name', 'item_code', 'item_name', 'status',
                    'allow_all_customers', 'max_qty_per_customer', 'notes',
                    'creation', 'modified'],
                order_by: 'creation desc',
                limit_page_length: 100,
            })
            setAllocations(data)
        } catch {
            setAllocations([])
        }
    }, [])

    // ── Load distributions ──
    const loadDistributions = useCallback(async () => {
        setDistLoading(true)
        try {
            const data = await frappeClient.getList<FreeSampleDistribution>('Free Sample Distribution', {
                fields: ['name', 'sales_person', 'sales_person_name', 'customer', 'customer_name',
                    'distribution_date', 'total_qty', 'customer_confirmed', 'status', 'gps_latitude', 'gps_longitude'],
                order_by: 'creation desc',
                limit_page_length: 200,
            })
            setDistributions(data)
        } catch {
            setDistributions([])
        } finally {
            setDistLoading(false)
        }
    }, [])

    // ── Load form data (each call independent — one failure doesn't block others) ──
    const loadFormData = useCallback(async () => {
        salesApi.getSalesPersons()
            .then(sp => setSalesPersons(sp.filter(s => s.name !== 'Sales Team')))
            .catch(() => { })
        salesApi.getItems({ filters: [['Item', 'disabled', '=', 0]] })
            .then(itms => setItems(itms))
            .catch(() => { })
        salesApi.getCustomers()
            .then(custs => setCustomers(custs))
            .catch(() => { })
    }, [])

    // ── Initial load ──
    useEffect(() => {
        async function init() {
            setLoading(true)
            await Promise.all([loadAllocations(), loadDistributions(), loadFormData()])
            setLoading(false)
        }
        init()
    }, [loadAllocations, loadDistributions, loadFormData])

    const handleRefresh = async () => {
        setRefreshing(true)
        await Promise.all([loadAllocations(), loadDistributions()])
        setRefreshing(false)
    }

    // ── Filtered allocations ──
    const filteredAllocations = useMemo(() => {
        return allocations.filter(a => {
            if (statusFilter !== 'all' && a.status !== statusFilter) return false
            if (search) {
                const q = search.toLowerCase()
                return (
                    a.name.toLowerCase().includes(q) ||
                    a.item_code?.toLowerCase().includes(q) ||
                    (a.item_name || '').toLowerCase().includes(q)
                )
            }
            return true
        })
    }, [allocations, search, statusFilter])

    // ── Filtered distributions ──
    const filteredDistributions = useMemo(() => {
        if (!distSearch) return distributions
        const q = distSearch.toLowerCase()
        return distributions.filter(d =>
            d.name.toLowerCase().includes(q) ||
            d.sales_person?.toLowerCase().includes(q) ||
            (d.sales_person_name || '').toLowerCase().includes(q) ||
            d.customer?.toLowerCase().includes(q) ||
            (d.customer_name || '').toLowerCase().includes(q)
        )
    }, [distributions, distSearch])

    // ── Form: add rep ──
    const addFormRep = (spName: string) => {
        if (formReps.find(r => r.sales_person === spName)) return
        const sp = salesPersons.find(s => s.name === spName)
        if (!sp) return
        setFormReps(prev => [...prev, {
            sales_person: sp.name,
            sales_person_name: sp.sales_person_name || sp.name,
            allocated_qty: 10,
        }])
    }

    const removeFormRep = (spName: string) => {
        setFormReps(prev => prev.filter(r => r.sales_person !== spName))
    }

    const updateFormRepQty = (spName: string, qty: number) => {
        setFormReps(prev => prev.map(r =>
            r.sales_person === spName ? { ...r, allocated_qty: Math.max(1, qty) } : r
        ))
    }

    // ── Form: add customer ──
    const addFormCustomer = (custName: string) => {
        if (formCustomers.find(c => c.customer === custName)) return
        const cust = customers.find(c => c.name === custName)
        if (!cust) return
        setFormCustomers(prev => [...prev, {
            customer: cust.name,
            customer_name: cust.customer_name || cust.name,
        }])
    }

    const removeFormCustomer = (custName: string) => {
        setFormCustomers(prev => prev.filter(c => c.customer !== custName))
    }

    // ── Create allocation ──
    const handleCreate = async () => {
        if (!formItemCode || formReps.length === 0) {
            toast({ title: isRTL ? 'خطأ' : 'Error', description: isRTL ? 'اختر المنتج وأضف مندوب واحد على الأقل' : 'Select a product and add at least one rep', variant: 'destructive' })
            return
        }
        if (!formAllowAll && formCustomers.length === 0) {
            toast({ title: isRTL ? 'خطأ' : 'Error', description: isRTL ? 'أضف عميل واحد على الأقل أو اختر السماح لجميع العملاء' : 'Add at least one customer or allow all customers', variant: 'destructive' })
            return
        }

        setCreating(true)
        try {
            const payload = {
                item_code: formItemCode,
                allow_all_customers: formAllowAll ? 1 : 0,
                max_qty_per_customer: formMaxPerCustomer,
                max_distributions_per_month: 0,
                notes: formNotes || '',
                reps: formReps.map(r => ({
                    sales_person: r.sales_person,
                    allocated_qty: r.allocated_qty,
                })),
                allowed_customers: formAllowAll ? [] : formCustomers.map(c => ({
                    customer: c.customer,
                })),
            }

            // Create the document (status is set to 'Active' by backend validate)
            const insertRes = await frappeClient.call('frappe.client.insert', {
                doc: { doctype: 'Free Sample Allocation', ...payload },
            })
            const docName = insertRes?.message?.name
            if (!docName) throw new Error('Failed to create allocation')

            toast({
                title: isRTL ? 'تم' : 'Success',
                description: isRTL ? 'تم إنشاء وتفعيل التخصيص بنجاح' : 'Allocation created and activated',
            })
            setShowCreateDialog(false)
            resetForm()
            await loadAllocations()
        } catch (err: any) {
            console.error('[FreeSamples] Create error:', err)
            const msg = err?.message || err?.exc || err?.toString() || 'Failed to create allocation'
            toast({
                title: isRTL ? 'خطأ' : 'Error',
                description: msg.length > 200 ? msg.substring(0, 200) + '...' : msg,
                variant: 'destructive'
            })
        } finally {
            setCreating(false)
        }
    }

    const resetForm = () => {
        setFormItemCode('')
        setFormAllowAll(true)
        setFormMaxPerCustomer(5)
        setFormNotes('')
        setRepSearch('')
        setCustomerSearchForm('')
        setFormReps([])
        setFormCustomers([])
        setRepComboOpen(false)
        setCustomerComboOpen(false)
        setEditingAlloc(null)
    }

    // ── Open edit dialog (pre-fill form with allocation data) ──
    const openEditDialog = async (alloc: FreeSampleAllocation) => {
        try {
            const doc = await frappeClient.get<FreeSampleAllocation>('Free Sample Allocation', alloc.name)
            const fullAlloc = doc?.data || doc as any
            setEditingAlloc(fullAlloc)
            setFormItemCode(fullAlloc.item_code || '')
            setFormAllowAll(!!fullAlloc.allow_all_customers)
            setFormMaxPerCustomer(fullAlloc.max_qty_per_customer || 5)
            setFormNotes(fullAlloc.notes || '')
            setFormReps((fullAlloc.reps || []).map((r: any) => ({
                sales_person: r.sales_person,
                sales_person_name: r.sales_person_name || r.sales_person,
                allocated_qty: r.allocated_qty || 0,
            })))
            setFormCustomers((fullAlloc.allowed_customers || []).map((c: any) => ({
                customer: c.customer,
                customer_name: c.customer_name || c.customer,
            })))
            setShowCreateDialog(true)
        } catch (err: any) {
            toast({ title: isRTL ? 'خطأ' : 'Error', description: isRTL ? 'فشل تحميل بيانات التخصيص' : 'Failed to load allocation data', variant: 'destructive' })
        }
    }

    // ── Save edit (update existing allocation) ──
    const handleUpdate = async () => {
        if (!editingAlloc) return
        if (!formItemCode || formReps.length === 0) {
            toast({ title: isRTL ? 'خطأ' : 'Error', description: isRTL ? 'اختر المنتج وأضف مندوب واحد على الأقل' : 'Select a product and add at least one rep', variant: 'destructive' })
            return
        }
        if (!formAllowAll && formCustomers.length === 0) {
            toast({ title: isRTL ? 'خطأ' : 'Error', description: isRTL ? 'أضف عميل واحد على الأقل أو اختر السماح لجميع العملاء' : 'Add at least one customer or allow all customers', variant: 'destructive' })
            return
        }

        setCreating(true)
        try {
            // Build the full doc with updated fields
            const updatePayload: Record<string, any> = {
                item_code: formItemCode,
                allow_all_customers: formAllowAll ? 1 : 0,
                max_qty_per_customer: formMaxPerCustomer,
                notes: formNotes || '',
                reps: formReps.map(r => ({
                    sales_person: r.sales_person,
                    allocated_qty: r.allocated_qty,
                })),
                allowed_customers: formAllowAll ? [] : formCustomers.map(c => ({
                    customer: c.customer,
                })),
            }

            await frappeClient.call('frappe.client.save', {
                doc: {
                    doctype: 'Free Sample Allocation',
                    name: editingAlloc.name,
                    ...updatePayload,
                },
            })

            toast({
                title: isRTL ? 'تم' : 'Success',
                description: isRTL ? 'تم تحديث التخصيص بنجاح' : 'Allocation updated successfully',
            })
            setShowCreateDialog(false)
            resetForm()
            await loadAllocations()
        } catch (err: any) {
            console.error('[FreeSamples] Update error:', err)
            let msg = err?.message || err?.exc || err?.toString() || 'Failed to update allocation'
            msg = msg.replace(/<[^>]*>/g, '').trim()
            toast({
                title: isRTL ? 'خطأ' : 'Error',
                description: msg.length > 200 ? msg.substring(0, 200) + '...' : msg,
                variant: 'destructive'
            })
        } finally {
            setCreating(false)
        }
    }

    // ── Delete allocation ──
    const handleDelete = async () => {
        if (!deletingAlloc) return
        setDeleteLoading(true)
        try {
            await frappeClient.delete('Free Sample Allocation', deletingAlloc.name)
            toast({
                title: isRTL ? 'تم' : 'Deleted',
                description: isRTL ? `تم حذف التخصيص ${deletingAlloc.name}` : `Allocation ${deletingAlloc.name} deleted`,
            })
            setDeletingAlloc(null)
            setSelectedAlloc(null)
            await loadAllocations()
        } catch (err: any) {
            console.error('[FreeSamples] Delete error:', err)
            let msg = err?.message || err?.exc || err?.toString() || 'Failed to delete allocation'
            msg = msg.replace(/<[^>]*>/g, '').trim()
            toast({
                title: isRTL ? 'خطأ' : 'Error',
                description: msg.length > 200 ? msg.substring(0, 200) + '...' : msg,
                variant: 'destructive'
            })
        } finally {
            setDeleteLoading(false)
        }
    }

    // ── View allocation detail (load reps + customers) ──
    const viewAllocationDetail = async (alloc: FreeSampleAllocation) => {
        try {
            const doc = await frappeClient.get<FreeSampleAllocation>('Free Sample Allocation', alloc.name)
            setSelectedAlloc(doc?.data || doc as any)
        } catch {
            setSelectedAlloc(alloc)
        }
    }

    // ── View distribution detail ──
    const viewDistributionDetail = async (dist: FreeSampleDistribution) => {
        try {
            const doc = await frappeClient.get<FreeSampleDistribution>('Free Sample Distribution', dist.name)
            setSelectedDist(doc?.data || doc as any)
        } catch {
            setSelectedDist(dist)
        }
    }

    // ── Loading skeleton ──
    if (loading) {
        return (
            <div className="p-6 space-y-4">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-12 w-full" />
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
        )
    }

    return (
        <div className="p-6 space-y-5" dir={isRTL ? 'rtl' : 'ltr'}>
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <Gift className="h-5 w-5 text-orange-600" />
                        {isRTL ? 'إدارة العينات المجانية' : 'Free Samples Management'}
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {isRTL ? 'تخصيص العينات للمناديب ومتابعة التوزيع' : 'Allocate samples to reps & track distributions'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                        <RefreshCw className={cn('h-4 w-4', isRTL ? 'ml-1' : 'mr-1', refreshing && 'animate-spin')} />
                        {isRTL ? 'تحديث' : 'Refresh'}
                    </Button>
                    <Button size="sm" className="bg-orange-600 hover:bg-orange-700" onClick={() => setShowCreateDialog(true)}>
                        <Plus className={cn('h-4 w-4', isRTL ? 'ml-1' : 'mr-1')} />
                        {isRTL ? 'تخصيص جديد' : 'New Allocation'}
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
                <button
                    className={cn('px-4 py-2 rounded-md text-sm font-medium transition-all',
                        activeTab === 'allocations' ? 'bg-white shadow-sm text-orange-700' : 'text-gray-500 hover:text-gray-700')}
                    onClick={() => setActiveTab('allocations')}
                >
                    <Package className="h-4 w-4 inline-block mr-1.5" />
                    {isRTL ? 'التخصيصات' : 'Allocations'} ({allocations.length})
                </button>
                <button
                    className={cn('px-4 py-2 rounded-md text-sm font-medium transition-all',
                        activeTab === 'distributions' ? 'bg-white shadow-sm text-orange-700' : 'text-gray-500 hover:text-gray-700')}
                    onClick={() => setActiveTab('distributions')}
                >
                    <History className="h-4 w-4 inline-block mr-1.5" />
                    {isRTL ? 'التوزيعات' : 'Distributions'} ({distributions.length})
                </button>
            </div>

            {/* ═══════ Allocations Tab ═══════ */}
            {activeTab === 'allocations' && (
                <>
                    {/* Filters */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="relative flex-1 min-w-[200px] max-w-sm">
                            <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
                            <Input
                                placeholder={isRTL ? 'بحث بالمنتج أو الرقم...' : 'Search by product or number...'}
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className={cn('h-9 text-sm', isRTL ? 'pr-9' : 'pl-9')}
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="h-9 w-[140px] text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
                                <SelectItem value="Active">{isRTL ? 'نشط' : 'Active'}</SelectItem>
                                <SelectItem value="Exhausted">{isRTL ? 'مستنفد' : 'Exhausted'}</SelectItem>
                                <SelectItem value="Cancelled">{isRTL ? 'ملغي' : 'Cancelled'}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Allocations Table */}
                    <Card>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="font-semibold">{isRTL ? 'الرقم' : 'ID'}</TableHead>
                                        <TableHead className="font-semibold">{isRTL ? 'المنتج' : 'Product'}</TableHead>
                                        <TableHead className="font-semibold">{isRTL ? 'الحالة' : 'Status'}</TableHead>
                                        <TableHead className="font-semibold">{isRTL ? 'العملاء' : 'Customers'}</TableHead>
                                        <TableHead className="font-semibold">{isRTL ? 'الحد / عميل' : 'Max/Customer'}</TableHead>
                                        <TableHead className="font-semibold text-center">{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredAllocations.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-12 text-gray-400">
                                                <Gift className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                                {isRTL ? 'لا توجد تخصيصات' : 'No allocations found'}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredAllocations.map(alloc => {
                                            const st = STATUS_MAP[alloc.status] || STATUS_MAP.Active
                                            return (
                                                <TableRow key={alloc.name} className="hover:bg-gray-50/50">
                                                    <TableCell className="font-mono text-xs">{alloc.name}</TableCell>
                                                    <TableCell>
                                                        <div className="font-medium">{alloc.item_name || alloc.item_code}</div>
                                                        <div className="text-xs text-gray-400">{alloc.item_code}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge className={cn('text-xs', st.class)}>{isRTL ? st.labelAr : st.label}</Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="text-xs">
                                                            <Users className="h-3 w-3 mr-1" />
                                                            {alloc.allow_all_customers ? (isRTL ? 'الكل' : 'All') : (isRTL ? 'محدد' : 'Specific')}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center">{alloc.max_qty_per_customer}</TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <Button variant="ghost" size="sm" onClick={() => viewAllocationDetail(alloc)} title={isRTL ? 'عرض' : 'View'}>
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="sm" onClick={() => openEditDialog(alloc)} title={isRTL ? 'تعديل' : 'Edit'}>
                                                                <Pencil className="h-4 w-4 text-blue-600" />
                                                            </Button>
                                                            <Button variant="ghost" size="sm" onClick={() => setDeletingAlloc(alloc)} title={isRTL ? 'حذف' : 'Delete'}>
                                                                <Trash2 className="h-4 w-4 text-red-500" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </>
            )}

            {/* ═══════ Distributions Tab ═══════ */}
            {activeTab === 'distributions' && (
                <>
                    <div className="relative max-w-sm">
                        <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
                        <Input
                            placeholder={isRTL ? 'بحث بالمندوب أو العميل...' : 'Search by rep or customer...'}
                            value={distSearch}
                            onChange={e => setDistSearch(e.target.value)}
                            className={cn('h-9 text-sm', isRTL ? 'pr-9' : 'pl-9')}
                        />
                    </div>

                    {distLoading ? (
                        <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
                    ) : (
                        <Card>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="font-semibold">{isRTL ? 'الرقم' : 'ID'}</TableHead>
                                            <TableHead className="font-semibold">{isRTL ? 'المندوب' : 'Sales Person'}</TableHead>
                                            <TableHead className="font-semibold">{isRTL ? 'العميل' : 'Customer'}</TableHead>
                                            <TableHead className="font-semibold">{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                                            <TableHead className="font-semibold">{isRTL ? 'الكمية' : 'Qty'}</TableHead>
                                            <TableHead className="font-semibold">{isRTL ? 'تأكيد العميل' : 'Confirmed'}</TableHead>
                                            <TableHead className="font-semibold">{isRTL ? 'الحالة' : 'Status'}</TableHead>
                                            <TableHead className="font-semibold text-center">{isRTL ? 'تفاصيل' : 'Details'}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredDistributions.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={8} className="text-center py-12 text-gray-400">
                                                    <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                                    {isRTL ? 'لا توجد توزيعات' : 'No distributions found'}
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredDistributions.map(dist => {
                                                const st = DIST_STATUS_MAP[dist.status] || DIST_STATUS_MAP.Completed
                                                const date = new Date(dist.distribution_date)
                                                return (
                                                    <TableRow key={dist.name} className="hover:bg-gray-50/50">
                                                        <TableCell className="font-mono text-xs">{dist.name}</TableCell>
                                                        <TableCell className="font-medium">{dist.sales_person_name || dist.sales_person}</TableCell>
                                                        <TableCell>{dist.customer_name || dist.customer}</TableCell>
                                                        <TableCell className="text-sm">
                                                            {date.toLocaleDateString('en-GB')} {date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                                        </TableCell>
                                                        <TableCell className="font-bold text-orange-600">{dist.total_qty}</TableCell>
                                                        <TableCell>
                                                            {dist.customer_confirmed
                                                                ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                                : <XCircle className="h-4 w-4 text-gray-300" />
                                                            }
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge className={cn('text-xs', st.class)}>{isRTL ? st.labelAr : st.label}</Badge>
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Button variant="ghost" size="sm" onClick={() => viewDistributionDetail(dist)}>
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}

            {/* ═══════ Create / Edit Allocation Dialog ═══════ */}
            <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open) { setShowCreateDialog(false); resetForm() } }}>
                <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {editingAlloc ? <Pencil className="h-5 w-5 text-blue-600" /> : <Gift className="h-5 w-5 text-orange-600" />}
                            {editingAlloc
                                ? (isRTL ? `تعديل التخصيص ${editingAlloc.name}` : `Edit Allocation ${editingAlloc.name}`)
                                : (isRTL ? 'تخصيص عينات جديد' : 'New Sample Allocation')
                            }
                        </DialogTitle>
                        <DialogDescription>
                            {editingAlloc
                                ? (isRTL ? 'عدّل بيانات التخصيص ثم اضغط حفظ' : 'Modify allocation details and save')
                                : (isRTL ? 'اختر المنتج ثم حدد المناديب والكميات والعملاء' : 'Select a product, then assign reps with quantities and allowed customers')
                            }
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Product */}
                        <div>
                            <Label className="text-sm font-medium">{isRTL ? 'المنتج' : 'Product'} *</Label>
                            <Select value={formItemCode} onValueChange={setFormItemCode}>
                                <SelectTrigger className="mt-1">
                                    <SelectValue placeholder={isRTL ? 'اختر المنتج...' : 'Select product...'} />
                                </SelectTrigger>
                                <SelectContent>
                                    {items.map(item => (
                                        <SelectItem key={item.name} value={item.name}>
                                            {item.item_name} ({item.name})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Reps */}
                        <div>
                            <Label className="text-sm font-medium">{isRTL ? 'المناديب' : 'Sales Representatives'} *</Label>
                            <Popover open={repComboOpen} onOpenChange={setRepComboOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={repComboOpen}
                                        className={cn('w-full justify-between mt-1 h-9 text-sm font-normal', !repSearch && 'text-muted-foreground')}
                                    >
                                        <span className="truncate">{isRTL ? 'اختر مندوب...' : 'Select rep...'}</span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder={isRTL ? 'ابحث عن مندوب...' : 'Search rep...'} />
                                        <CommandList>
                                            <CommandEmpty>{isRTL ? 'لا توجد نتائج' : 'No results'}</CommandEmpty>
                                            <CommandGroup>
                                                {salesPersons
                                                    .filter(sp => !formReps.find(r => r.sales_person === sp.name))
                                                    .map(sp => (
                                                        <CommandItem
                                                            key={sp.name}
                                                            value={`${sp.sales_person_name || sp.name} ${sp.name}`}
                                                            onSelect={() => {
                                                                addFormRep(sp.name)
                                                                setRepComboOpen(false)
                                                            }}
                                                        >
                                                            <Users className={cn('h-4 w-4 text-blue-500', isRTL ? 'ml-2' : 'mr-2')} />
                                                            <span className="font-medium">{sp.sales_person_name || sp.name}</span>
                                                            <span className="text-xs text-muted-foreground ml-auto">{sp.name}</span>
                                                        </CommandItem>
                                                    ))
                                                }
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>

                            {formReps.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    {formReps.map(rep => (
                                        <div key={rep.sales_person} className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                                            <Users className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{rep.sales_person_name}</p>
                                                <p className="text-[10px] text-gray-500">{rep.sales_person}</p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-xs text-gray-500">{isRTL ? 'الكمية' : 'Qty'}:</span>
                                                <Input
                                                    type="number"
                                                    value={rep.allocated_qty}
                                                    onChange={e => updateFormRepQty(rep.sales_person, Number(e.target.value))}
                                                    min={1}
                                                    className="w-20 h-8 text-sm text-center"
                                                />
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeFormRep(rep.sales_person)}>
                                                <X className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Allowed Customers */}
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Checkbox
                                    id="allow-all"
                                    checked={formAllowAll}
                                    onCheckedChange={(checked) => setFormAllowAll(!!checked)}
                                />
                                <Label htmlFor="allow-all" className="text-sm font-medium cursor-pointer">
                                    {isRTL ? 'السماح لجميع العملاء' : 'Allow All Customers'}
                                </Label>
                            </div>

                            {!formAllowAll && (
                                <>
                                    <Popover open={customerComboOpen} onOpenChange={setCustomerComboOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={customerComboOpen}
                                                className={cn('w-full justify-between mt-1 h-9 text-sm font-normal', !customerSearchForm && 'text-muted-foreground')}
                                            >
                                                <span className="truncate">{isRTL ? 'اختر عميل...' : 'Select customer...'}</span>
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-full p-0" align="start">
                                            <Command>
                                                <CommandInput placeholder={isRTL ? 'ابحث عن عميل...' : 'Search customer...'} />
                                                <CommandList>
                                                    <CommandEmpty>{isRTL ? 'لا توجد نتائج' : 'No results'}</CommandEmpty>
                                                    <CommandGroup>
                                                        {customers
                                                            .filter(c => !formCustomers.find(fc => fc.customer === c.name))
                                                            .map(cust => (
                                                                <CommandItem
                                                                    key={cust.name}
                                                                    value={`${cust.customer_name || cust.name} ${cust.name}`}
                                                                    onSelect={() => {
                                                                        addFormCustomer(cust.name)
                                                                        setCustomerComboOpen(false)
                                                                    }}
                                                                >
                                                                    <Users className={cn('h-4 w-4 text-green-500', isRTL ? 'ml-2' : 'mr-2')} />
                                                                    <span className="font-medium">{cust.customer_name || cust.name}</span>
                                                                    <span className="text-xs text-muted-foreground ml-auto">{cust.name}</span>
                                                                </CommandItem>
                                                            ))
                                                        }
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>

                                    {formCustomers.length > 0 && (
                                        <div className="mt-3 space-y-1.5">
                                            {formCustomers.map(c => (
                                                <div key={c.customer} className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-200">
                                                    <Users className="h-4 w-4 text-green-500 flex-shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium truncate">{c.customer_name}</p>
                                                        <p className="text-[10px] text-gray-500">{c.customer}</p>
                                                    </div>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeFormCustomer(c.customer)}>
                                                        <X className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Limits */}
                        <div>
                            <Label className="text-sm font-medium">{isRTL ? 'الحد لكل عميل' : 'Max Qty/Customer'}</Label>
                            <Input type="number" value={formMaxPerCustomer} onChange={e => setFormMaxPerCustomer(Number(e.target.value))} min={1} className="mt-1 max-w-[200px]" />
                        </div>

                        {/* Notes */}
                        <div>
                            <Label className="text-sm font-medium">{isRTL ? 'ملاحظات' : 'Notes'}</Label>
                            <Textarea
                                value={formNotes}
                                onChange={e => setFormNotes(e.target.value)}
                                placeholder={isRTL ? 'ملاحظات اختيارية...' : 'Optional notes...'}
                                className="mt-1 resize-none"
                                rows={2}
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0 mt-4">
                        <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm() }}>
                            {isRTL ? 'إلغاء' : 'Cancel'}
                        </Button>
                        {editingAlloc ? (
                            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleUpdate} disabled={creating}>
                                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Pencil className="h-4 w-4 mr-1" />}
                                {isRTL ? 'حفظ التعديلات' : 'Save Changes'}
                            </Button>
                        ) : (
                            <Button className="bg-orange-600 hover:bg-orange-700" onClick={handleCreate} disabled={creating}>
                                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                                {isRTL ? 'إنشاء' : 'Create'}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ═══════ Allocation Detail Dialog ═══════ */}
            <Dialog open={!!selectedAlloc} onOpenChange={(open) => !open && setSelectedAlloc(null)}>
                <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Package className="h-5 w-5 text-orange-600" />
                            {selectedAlloc?.name}
                        </DialogTitle>
                    </DialogHeader>

                    {selectedAlloc && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="text-gray-500">{isRTL ? 'المنتج:' : 'Product:'}</div>
                                <div className="font-medium">{selectedAlloc.item_name || selectedAlloc.item_code}</div>
                                <div className="text-gray-500">{isRTL ? 'كود المنتج:' : 'Item Code:'}</div>
                                <div className="font-mono text-xs">{selectedAlloc.item_code}</div>
                                <div className="text-gray-500">{isRTL ? 'الحالة:' : 'Status:'}</div>
                                <div>
                                    <Badge className={cn('text-xs', (STATUS_MAP[selectedAlloc.status] || STATUS_MAP.Active).class)}>
                                        {isRTL ? (STATUS_MAP[selectedAlloc.status] || STATUS_MAP.Active).labelAr : selectedAlloc.status}
                                    </Badge>
                                </div>
                                <div className="text-gray-500">{isRTL ? 'الحد / عميل:' : 'Max/Customer:'}</div>
                                <div className="font-medium">{selectedAlloc.max_qty_per_customer}</div>
                                <div className="text-gray-500">{isRTL ? 'العملاء:' : 'Customers:'}</div>
                                <div className="font-medium">
                                    {selectedAlloc.allow_all_customers
                                        ? (isRTL ? 'جميع العملاء' : 'All Customers')
                                        : `${(selectedAlloc.allowed_customers || []).length} ${isRTL ? 'عميل محدد' : 'specific'}`
                                    }
                                </div>
                            </div>

                            {/* Reps table */}
                            {selectedAlloc.reps && selectedAlloc.reps.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-bold mb-2">{isRTL ? 'المناديب:' : 'Sales Reps:'}</h4>
                                    <div className="space-y-1.5">
                                        {selectedAlloc.reps.map((rep, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-2 bg-blue-50 rounded-lg text-sm">
                                                <div>
                                                    <span className="font-medium">{rep.sales_person_name || rep.sales_person}</span>
                                                </div>
                                                <div className="flex gap-3 text-xs">
                                                    <span className="text-gray-500">{isRTL ? 'مخصص' : 'Alloc'}: <b>{rep.allocated_qty}</b></span>
                                                    <span className="text-orange-600">{isRTL ? 'موزع' : 'Dist'}: <b>{rep.distributed_qty}</b></span>
                                                    <span className="text-emerald-600">{isRTL ? 'متبقي' : 'Rem'}: <b>{rep.remaining_qty}</b></span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Allowed customers */}
                            {!selectedAlloc.allow_all_customers && selectedAlloc.allowed_customers && selectedAlloc.allowed_customers.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-bold mb-2">{isRTL ? 'العملاء المسموح لهم:' : 'Allowed Customers:'}</h4>
                                    <div className="space-y-1">
                                        {selectedAlloc.allowed_customers.map((c, idx) => (
                                            <div key={idx} className="flex items-center gap-2 p-1.5 bg-green-50 rounded text-sm">
                                                <Users className="h-3.5 w-3.5 text-green-500" />
                                                <span className="font-medium">{c.customer_name || c.customer}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedAlloc.notes && (
                                <div className="text-sm bg-gray-50 p-2 rounded-lg">
                                    <span className="text-gray-500">{isRTL ? 'ملاحظات: ' : 'Notes: '}</span>{selectedAlloc.notes}
                                </div>
                            )}

                            {/* Edit / Delete actions */}
                            <div className="flex gap-2 pt-2 border-t">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                                    onClick={() => {
                                        setSelectedAlloc(null)
                                        openEditDialog(selectedAlloc)
                                    }}
                                >
                                    <Pencil className="h-4 w-4 mr-1" />
                                    {isRTL ? 'تعديل' : 'Edit'}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                                    onClick={() => {
                                        setSelectedAlloc(null)
                                        setDeletingAlloc(selectedAlloc)
                                    }}
                                >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    {isRTL ? 'حذف' : 'Delete'}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ═══════ Distribution Detail Dialog ═══════ */}
            <Dialog open={!!selectedDist} onOpenChange={(open) => !open && setSelectedDist(null)}>
                <DialogContent className="max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Gift className="h-5 w-5 text-orange-600" />
                            {selectedDist?.name}
                        </DialogTitle>
                    </DialogHeader>

                    {selectedDist && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="text-gray-500">{isRTL ? 'المندوب:' : 'Sales Person:'}</div>
                                <div className="font-medium">{selectedDist.sales_person_name || selectedDist.sales_person}</div>
                                <div className="text-gray-500">{isRTL ? 'العميل:' : 'Customer:'}</div>
                                <div className="font-medium">{selectedDist.customer_name || selectedDist.customer}</div>
                                <div className="text-gray-500">{isRTL ? 'التاريخ:' : 'Date:'}</div>
                                <div className="font-medium">{new Date(selectedDist.distribution_date).toLocaleString('en-GB')}</div>
                                <div className="text-gray-500">{isRTL ? 'الإجمالي:' : 'Total Qty:'}</div>
                                <div className="font-bold text-orange-600">{selectedDist.total_qty}</div>
                                <div className="text-gray-500">{isRTL ? 'تأكيد العميل:' : 'Confirmed:'}</div>
                                <div>{selectedDist.customer_confirmed ? <CheckCircle2 className="h-4 w-4 text-emerald-500 inline" /> : <XCircle className="h-4 w-4 text-gray-300 inline" />}</div>
                                {(selectedDist.gps_latitude && selectedDist.gps_longitude) ? (
                                    <>
                                        <div className="text-gray-500">GPS:</div>
                                        <div className="text-xs font-mono">{selectedDist.gps_latitude}, {selectedDist.gps_longitude}</div>
                                    </>
                                ) : null}
                            </div>

                            {selectedDist.items && selectedDist.items.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-bold mb-2">{isRTL ? 'الأصناف:' : 'Items:'}</h4>
                                    <div className="space-y-1.5">
                                        {selectedDist.items.map((item, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
                                                <span className="font-medium">{item.item_name || item.item_code}</span>
                                                <span className="font-bold">{item.qty} {item.uom || ''}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedDist.notes && (
                                <div className="text-sm bg-gray-50 p-2 rounded-lg">
                                    <span className="text-gray-500">{isRTL ? 'ملاحظات: ' : 'Notes: '}</span>{selectedDist.notes}
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
            {/* ═══════ Delete Confirmation Dialog ═══════ */}
            <Dialog open={!!deletingAlloc} onOpenChange={(open) => !open && setDeletingAlloc(null)}>
                <DialogContent className="max-w-sm" dir={isRTL ? 'rtl' : 'ltr'}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="h-5 w-5" />
                            {isRTL ? 'تأكيد الحذف' : 'Confirm Delete'}
                        </DialogTitle>
                        <DialogDescription>
                            {isRTL
                                ? 'هل أنت متأكد من حذف هذا التخصيص؟ لا يمكن التراجع عن هذه العملية.'
                                : 'Are you sure you want to delete this allocation? This action cannot be undone.'
                            }
                        </DialogDescription>
                    </DialogHeader>

                    {deletingAlloc && (
                        <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-sm space-y-1">
                            <div className="flex justify-between">
                                <span className="text-gray-600">{isRTL ? 'الرقم:' : 'ID:'}</span>
                                <span className="font-mono font-medium">{deletingAlloc.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">{isRTL ? 'المنتج:' : 'Product:'}</span>
                                <span className="font-medium">{deletingAlloc.item_name || deletingAlloc.item_code}</span>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setDeletingAlloc(null)} disabled={deleteLoading}>
                            {isRTL ? 'إلغاء' : 'Cancel'}
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
                            {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                            {isRTL ? 'حذف' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
