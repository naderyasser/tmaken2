'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, RefreshCw, Calendar, CalendarDays, FileText, ClipboardList, Shield, Plus, Eye, Building2, Zap, Trash2, ChevronUp } from 'lucide-react'
import { frappeClient, HolidayList as ApiHolidayList } from '@/lib/api-client'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useI18n } from '@/lib/i18n'
import { formatDateShort } from '@/lib/format'
import { translateEnum, translateDepartment } from '@/lib/enums'

// ==================== Types ====================

interface LeaveType {
    name: string
    leave_type_name?: string
    max_leaves_allowed?: number
    applicable_after?: number
    max_continuous_days_allowed?: number
    is_carry_forward?: number
    is_lwp?: number
    is_compensatory?: number
    include_holiday?: number
    allow_negative?: number
}

interface LeaveAllocation {
    name: string
    employee: string
    employee_name?: string
    department?: string
    leave_type?: string
    new_leaves_allocated?: number
    total_leaves_allocated?: number
    from_date?: string
    to_date?: string
    docstatus?: number
}

interface LeavePolicy {
    name: string
    title?: string
    leave_policy_details?: any[]
}

interface HolidayListLocal {
    name: string
    holiday_list_name?: string
    from_date?: string
    to_date?: string
    total_holidays?: number
    country?: string
    weekly_off?: string
}

interface CompensatoryLeaveRequest {
    name: string
    employee: string
    employee_name?: string
    department?: string
    leave_type?: string
    work_from_date?: string
    work_end_date?: string
    reason?: string
    status?: string
}

interface HolidayEntry {
    holiday_date: string
    description: string
    weekly_off?: 0 | 1
}

// Display-only Arabic labels for compensatory-request statuses (backend stores English).
const COMP_STATUS_AR: Record<string, string> = {
    'Approved': 'مقبول',
    'Rejected': 'مرفوض',
    'Draft': 'مسودة',
    'Open': 'قيد الانتظار',
    'Cancelled': 'ملغي',
}

// ==================== Main Component ====================

export function LeaveSetupList() {
    const [activeTab, setActiveTab] = useState('leave-types')
    const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
    const [allocations, setAllocations] = useState<LeaveAllocation[]>([])
    const [policies, setPolicies] = useState<LeavePolicy[]>([])
    const [holidays, setHolidays] = useState<HolidayListLocal[]>([])
    const [compLeaves, setCompLeaves] = useState<CompensatoryLeaveRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const { toast } = useToast()
    const { t, isRTL, lang } = useI18n()
    const locale = lang === 'en' ? 'en' : 'ar'
    const { activeCompany } = useAuth()

    // Holiday CRUD state
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [creating, setCreating] = useState(false)
    const [expandedHoliday, setExpandedHoliday] = useState<string | null>(null)
    const [holidayDetail, setHolidayDetail] = useState<ApiHolidayList | null>(null)
    const [loadingDetail, setLoadingDetail] = useState(false)
    const [settingDefault, setSettingDefault] = useState<string | null>(null)
    const [quickSetupLoading, setQuickSetupLoading] = useState(false)

    // Create form state
    const currentYear = new Date().getFullYear()
    const [formName, setFormName] = useState('')
    const [formFromDate, setFormFromDate] = useState(`${currentYear}-01-01`)
    const [formToDate, setFormToDate] = useState(`${currentYear}-12-31`)
    const [formWeeklyOff, setFormWeeklyOff] = useState('Friday')
    const [formHolidays, setFormHolidays] = useState<HolidayEntry[]>([])

    const loadLeaveTypes = useCallback(async () => {
        try {
            setLoading(true)
            const response = await frappeClient.get<LeaveType[]>('Leave Type', undefined, {
                fields: ['name', 'max_leaves_allowed', 'applicable_after', 'max_continuous_days_allowed', 'is_carry_forward', 'is_lwp', 'is_compensatory', 'include_holiday', 'allow_negative'],
                order_by: 'name asc',
                limit_page_length: 50,
            })
            setLeaveTypes(response.data || [])
        } catch (error) { console.error('Failed to load leave types:', error) }
        finally { setLoading(false) }
    }, [])

    const loadAllocations = useCallback(async () => {
        try {
            setLoading(true)
            const response = await frappeClient.get<LeaveAllocation[]>('Leave Allocation', undefined, {
                fields: ['name', 'employee', 'employee_name', 'department', 'leave_type', 'new_leaves_allocated', 'total_leaves_allocated', 'from_date', 'to_date', 'docstatus'],
                order_by: 'from_date desc',
                limit_page_length: 100,
            })
            setAllocations(response.data || [])
        } catch (error) { console.error('Failed to load allocations:', error) }
        finally { setLoading(false) }
    }, [])

    const loadPolicies = useCallback(async () => {
        try {
            setLoading(true)
            const response = await frappeClient.get<LeavePolicy[]>('Leave Policy', undefined, {
                fields: ['name', 'title'],
                order_by: 'name asc',
                limit_page_length: 50,
            })
            setPolicies(response.data || [])
        } catch (error) { console.error('Failed to load leave policies:', error) }
        finally { setLoading(false) }
    }, [])

    const loadHolidays = useCallback(async () => {
        try {
            setLoading(true)
            const response = await frappeClient.get<HolidayListLocal[]>('Holiday List', undefined, {
                fields: ['name', 'holiday_list_name', 'from_date', 'to_date', 'total_holidays', 'country', 'weekly_off'],
                order_by: 'from_date desc',
                limit_page_length: 50,
            })
            setHolidays(response.data || [])
        } catch (error) { console.error('Failed to load holiday lists:', error) }
        finally { setLoading(false) }
    }, [])

    const loadCompLeaves = useCallback(async () => {
        try {
            setLoading(true)
            const response = await frappeClient.get<CompensatoryLeaveRequest[]>('Compensatory Leave Request', undefined, {
                fields: ['name', 'employee', 'employee_name', 'department', 'leave_type', 'work_from_date', 'work_end_date', 'reason', 'status'],
                order_by: 'creation desc',
                limit_page_length: 100,
            })
            setCompLeaves(response.data || [])
        } catch (error) { console.error('Failed to load compensatory leaves:', error) }
        finally { setLoading(false) }
    }, [])

    useEffect(() => {
        if (activeTab === 'leave-types') loadLeaveTypes()
        else if (activeTab === 'allocations') loadAllocations()
        else if (activeTab === 'policies') loadPolicies()
        else if (activeTab === 'holidays') loadHolidays()
        else if (activeTab === 'compensatory') loadCompLeaves()
    }, [activeTab, loadLeaveTypes, loadAllocations, loadPolicies, loadHolidays, loadCompLeaves])

    const stats = useMemo(() => ({
        totalTypes: leaveTypes.length,
        totalAllocations: allocations.length,
        totalPolicies: policies.length,
        totalHolidayLists: holidays.length,
    }), [leaveTypes, allocations, policies, holidays])

    // === Holiday CRUD handlers ===

    const handleCreateHoliday = async () => {
        if (!formName.trim() || !formFromDate || !formToDate) {
            toast({ title: t('lsetup.hl_name_required'), variant: 'destructive' })
            return
        }
        setCreating(true)
        try {
            await frappeClient.createHolidayList({
                holiday_list_name: formName.trim(),
                from_date: formFromDate,
                to_date: formToDate,
                weekly_off: formWeeklyOff || undefined,
                holidays: formHolidays.length > 0 ? formHolidays : undefined,
            })
            toast({ title: t('lsetup.hl_created') })
            setShowCreateDialog(false)
            resetForm()
            loadHolidays()
        } catch (err: any) {
            toast({ title: t('lsetup.hl_create_failed'), description: err?.message || String(err), variant: 'destructive' })
        } finally {
            setCreating(false)
        }
    }

    const resetForm = () => {
        setFormName('')
        setFormFromDate(`${currentYear}-01-01`)
        setFormToDate(`${currentYear}-12-31`)
        setFormWeeklyOff('Friday')
        setFormHolidays([])
    }

    const toggleHolidayDetail = async (name: string) => {
        if (expandedHoliday === name) {
            setExpandedHoliday(null)
            setHolidayDetail(null)
            return
        }
        setExpandedHoliday(name)
        setLoadingDetail(true)
        try {
            const detail = await frappeClient.getHolidayList(name)
            setHolidayDetail(detail)
        } catch (err) {
            console.error('Failed to load holiday detail:', err)
            setHolidayDetail(null)
        } finally {
            setLoadingDetail(false)
        }
    }

    const handleSetCompanyDefault = async (hlName: string) => {
        if (!activeCompany) {
            toast({ title: t('lsetup.hl_no_company'), variant: 'destructive' })
            return
        }
        setSettingDefault(hlName)
        try {
            await frappeClient.setCompanyDefaultHolidayList(activeCompany, hlName)
            toast({ title: t('lsetup.hl_set_default_ok') })
        } catch (err: any) {
            toast({ title: t('lsetup.hl_set_default_fail'), description: err?.message || String(err), variant: 'destructive' })
        } finally {
            setSettingDefault(null)
        }
    }

    const handleQuickSetup = async () => {
        if (!activeCompany) {
            toast({ title: t('lsetup.hl_no_company'), variant: 'destructive' })
            return
        }
        setQuickSetupLoading(true)
        try {
            const hlName = await frappeClient.ensureCompanyHolidayList(activeCompany)
            toast({ title: t('lsetup.hl_quick_ok'), description: hlName })
            loadHolidays()
        } catch (err: any) {
            toast({ title: t('lsetup.hl_quick_fail'), description: err?.message || String(err), variant: 'destructive' })
        } finally {
            setQuickSetupLoading(false)
        }
    }

    const addHolidayEntry = () => {
        setFormHolidays(prev => [...prev, { holiday_date: '', description: '' }])
    }

    const updateHolidayEntry = (idx: number, field: keyof HolidayEntry, value: string) => {
        setFormHolidays(prev => prev.map((h, i) => i === idx ? { ...h, [field]: value } : h))
    }

    const removeHolidayEntry = (idx: number) => {
        setFormHolidays(prev => prev.filter((_, i) => i !== idx))
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-foreground">{t('lsetup.title')}</h1>
                <p className="text-muted-foreground mt-1">{t('lsetup.subtitle')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-accent rounded-lg"><FileText className="h-5 w-5 text-primary" /></div><div><p className="text-sm text-muted-foreground">{t('lsetup.leave_types')}</p><p className="text-2xl font-bold">{stats.totalTypes}</p></div></div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-green-50 rounded-lg"><ClipboardList className="h-5 w-5 text-green-600" /></div><div><p className="text-sm text-muted-foreground">{t('lsetup.allocations')}</p><p className="text-2xl font-bold">{stats.totalAllocations}</p></div></div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-purple-50 rounded-lg"><Shield className="h-5 w-5 text-purple-600" /></div><div><p className="text-sm text-muted-foreground">{t('lsetup.policies')}</p><p className="text-2xl font-bold">{stats.totalPolicies}</p></div></div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-red-50 rounded-lg"><CalendarDays className="h-5 w-5 text-red-600" /></div><div><p className="text-sm text-muted-foreground">{t('lsetup.holiday_lists')}</p><p className="text-2xl font-bold">{stats.totalHolidayLists}</p></div></div></CardContent></Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="leave-types">{t('lsetup.leave_types')}</TabsTrigger>
                    <TabsTrigger value="allocations">{t('lsetup.allocations')}</TabsTrigger>
                    <TabsTrigger value="policies">{t('lsetup.policies')}</TabsTrigger>
                    <TabsTrigger value="holidays">{t('lsetup.holidays')}</TabsTrigger>
                    <TabsTrigger value="compensatory">{t('lsetup.compensatory')}</TabsTrigger>
                </TabsList>

                <TabsContent value="leave-types" className="mt-4">
                    <Card>
                        <CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-lg">{t('lsetup.leave_types')}</CardTitle><Button aria-label="تحديث" title="تحديث" variant="outline" size="icon" onClick={loadLeaveTypes}><RefreshCw className="h-4 w-4" /></Button></div></CardHeader>
                        <CardContent>
                            {loading ? <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
                                : leaveTypes.length === 0 ? (
                                    <div className="text-center py-12"><FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" /><h3 className="text-lg font-medium text-foreground">{t('lsetup.no_types')}</h3><p className="text-muted-foreground mt-1">{t('lsetup.no_types_sub')}</p></div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {leaveTypes.map((lt) => (
                                            <Card key={lt.name} className="border">
                                                <CardContent className="p-4">
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <div className="p-2 bg-accent rounded-lg"><Calendar className="h-5 w-5 text-primary" /></div>
                                                        <div><h3 className="font-medium">{translateEnum('leaveType', lt.name, locale)}</h3><p className="text-sm text-muted-foreground">{isRTL ? 'الحد الأقصى' : 'Max'}: {lt.max_leaves_allowed || '∞'} {isRTL ? 'يوم' : 'days'}</p></div>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {lt.is_carry_forward ? <Badge className="bg-accent text-accent-foreground text-xs">{t('lsetup.carry_forward')}</Badge> : null}
                                                        {lt.is_lwp ? <Badge className="bg-yellow-100 text-yellow-800 text-xs">{t('lsetup.lwp')}</Badge> : null}
                                                        {lt.is_compensatory ? <Badge className="bg-green-100 text-green-800 text-xs">{t('lsetup.compensatory')}</Badge> : null}
                                                        {lt.allow_negative ? <Badge className="bg-red-100 text-red-800 text-xs">{t('lsetup.allow_negative')}</Badge> : null}
                                                        {lt.include_holiday ? <Badge variant="outline" className="text-xs">{t('lsetup.include_holiday')}</Badge> : null}
                                                    </div>
                                                    {lt.max_continuous_days_allowed ? <p className="text-xs text-muted-foreground mt-2">{isRTL ? 'الحد الأقصى المتواصل' : 'Max continuous'}: {lt.max_continuous_days_allowed} {isRTL ? 'يوم' : 'days'}</p> : null}
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="allocations" className="mt-4">
                    <Card>
                        <CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-lg">{t('lsetup.leave_allocations')}</CardTitle><div className="flex gap-2"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" /><Input placeholder={isRTL ? 'بحث...' : 'Search...'} className="pl-9 w-64" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div><Button aria-label="تحديث" title="تحديث" variant="outline" size="icon" onClick={loadAllocations}><RefreshCw className="h-4 w-4" /></Button></div></div></CardHeader>
                        <CardContent>
                            {loading ? <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                                : allocations.length === 0 ? (
                                    <div className="text-center py-12"><ClipboardList className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" /><h3 className="text-lg font-medium text-foreground">{t('lsetup.no_allocations')}</h3><p className="text-muted-foreground mt-1">{t('lsetup.no_allocations_sub')}</p></div>
                                ) : (
                                    <Table>
                                        <TableHeader><TableRow><TableHead>{t('employee')}</TableHead><TableHead>{t('lsetup.leave_types')}</TableHead><TableHead>{t('lsetup.allocated')}</TableHead><TableHead>{t('lsetup.total')}</TableHead><TableHead>{t('leave.from')}</TableHead><TableHead>{t('leave.to')}</TableHead><TableHead>{t('status')}</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {allocations.filter(a => !searchQuery || a.employee_name?.toLowerCase().includes(searchQuery.toLowerCase())).map((a) => (
                                                <TableRow key={a.name}>
                                                    <TableCell className="font-medium">{a.employee_name || a.employee}</TableCell>
                                                    <TableCell>{a.leave_type ? translateEnum('leaveType', a.leave_type, locale) : '-'}</TableCell>
                                                    <TableCell>{a.new_leaves_allocated || 0}</TableCell>
                                                    <TableCell className="font-bold">{a.total_leaves_allocated || 0}</TableCell>
                                                    <TableCell className="tabular-nums">{formatDateShort(a.from_date) || '-'}</TableCell>
                                                    <TableCell className="tabular-nums">{formatDateShort(a.to_date) || '-'}</TableCell>
                                                    <TableCell>
                                                        {a.docstatus === 1 ? <Badge className="bg-green-100 text-green-800">{isRTL ? 'معتمد' : 'Submitted'}</Badge> :
                                                            a.docstatus === 2 ? <Badge className="bg-red-100 text-red-800">{isRTL ? 'ملغي' : 'Cancelled'}</Badge> :
                                                                <Badge className="bg-yellow-100 text-yellow-800">{isRTL ? 'مسودة' : 'Draft'}</Badge>}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="policies" className="mt-4">
                    <Card>
                        <CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-lg">{t('lsetup.leave_policies')}</CardTitle><Button aria-label="تحديث" title="تحديث" variant="outline" size="icon" onClick={loadPolicies}><RefreshCw className="h-4 w-4" /></Button></div></CardHeader>
                        <CardContent>
                            {loading ? <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
                                : policies.length === 0 ? (
                                    <div className="text-center py-12"><Shield className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" /><h3 className="text-lg font-medium text-foreground">{t('lsetup.no_policies')}</h3><p className="text-muted-foreground mt-1">{t('lsetup.no_policies_sub')}</p></div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {policies.map((p) => (
                                            <Card key={p.name} className="border">
                                                <CardContent className="p-4">
                                                    <div className="flex items-center gap-3"><div className="p-2 bg-purple-50 rounded-lg"><Shield className="h-5 w-5 text-purple-600" /></div><div><h3 className="font-medium">{p.title || p.name}</h3></div></div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ===== HOLIDAYS TAB (with CRUD) ===== */}
                <TabsContent value="holidays" className="mt-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <CardTitle className="text-lg">{t('lsetup.holiday_lists')}</CardTitle>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" className="gap-1.5" onClick={handleQuickSetup} disabled={quickSetupLoading || !activeCompany}>
                                        <Zap className="h-4 w-4" />
                                        {quickSetupLoading ? '...' : t('lsetup.hl_quick_setup')}
                                    </Button>
                                    <Button aria-label="إضافة" title="إضافة" size="sm" className="gap-1.5" onClick={() => { resetForm(); setShowCreateDialog(true) }}>
                                        <Plus className="h-4 w-4" />
                                        {t('lsetup.hl_create')}
                                    </Button>
                                    <Button aria-label="تحديث" title="تحديث" variant="outline" size="icon" onClick={loadHolidays}><RefreshCw className="h-4 w-4" /></Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loading ? <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
                                : holidays.length === 0 ? (
                                    <div className="text-center py-12">
                                        <CalendarDays className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                                        <h3 className="text-lg font-medium text-foreground">{t('lsetup.no_holidays')}</h3>
                                        <p className="text-muted-foreground mt-1 mb-4">{t('lsetup.no_holidays_sub')}</p>
                                        <div className="flex justify-center gap-2">
                                            <Button variant="outline" onClick={handleQuickSetup} disabled={quickSetupLoading || !activeCompany}>
                                                <Zap className="h-4 w-4 mr-1.5" />
                                                {t('lsetup.hl_quick_setup')}
                                            </Button>
                                            <Button aria-label="إضافة" title="إضافة" onClick={() => { resetForm(); setShowCreateDialog(true) }}>
                                                <Plus className="h-4 w-4 mr-1.5" />
                                                {t('lsetup.hl_create')}
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {holidays.map((h) => (
                                            <Card key={h.name} className="border">
                                                <CardContent className="p-4">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-red-50 rounded-lg"><CalendarDays className="h-5 w-5 text-red-600" /></div>
                                                            <div>
                                                                <h3 className="font-medium">{h.holiday_list_name || h.name}</h3>
                                                                <p className="text-sm text-muted-foreground tabular-nums">{formatDateShort(h.from_date)} → {formatDateShort(h.to_date)}</p>
                                                                <div className="flex gap-1.5 mt-1 flex-wrap">
                                                                    {h.weekly_off && <Badge variant="outline" className="text-xs">{h.weekly_off}</Badge>}
                                                                    {h.country && <Badge variant="outline" className="text-xs">{h.country}</Badge>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="text-right mr-2">
                                                                <p className="text-2xl font-bold text-red-600">{h.total_holidays || 0}</p>
                                                                <p className="text-xs text-muted-foreground">{t('lsetup.holidays_count')}</p>
                                                            </div>
                                                            <Button
                                                                variant="outline" size="sm"
                                                                onClick={() => toggleHolidayDetail(h.name)}
                                                                title={t('lsetup.hl_view_details')}
                                                            >
                                                                {expandedHoliday === h.name ? <ChevronUp className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                            </Button>
                                                            <Button
                                                                variant="outline" size="sm"
                                                                onClick={() => handleSetCompanyDefault(h.name)}
                                                                disabled={settingDefault === h.name || !activeCompany}
                                                                title={t('lsetup.hl_set_default')}
                                                            >
                                                                {settingDefault === h.name ? '...' : <Building2 className="h-4 w-4" />}
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    {/* Expanded detail view */}
                                                    {expandedHoliday === h.name && (
                                                        <div className="mt-4 border-t pt-3">
                                                            {loadingDetail ? (
                                                                <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                                                            ) : holidayDetail?.holidays && holidayDetail.holidays.length > 0 ? (
                                                                <Table>
                                                                    <TableHeader>
                                                                        <TableRow>
                                                                            <TableHead>{t('lsetup.hl_date')}</TableHead>
                                                                            <TableHead>{t('lsetup.hl_description')}</TableHead>
                                                                            <TableHead>{t('lsetup.hl_weekly_off')}</TableHead>
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {holidayDetail.holidays.map((hd, idx) => (
                                                                            <TableRow key={idx}>
                                                                                <TableCell className="font-mono text-sm">{hd.holiday_date}</TableCell>
                                                                                <TableCell>{hd.description}</TableCell>
                                                                                <TableCell>
                                                                                    {hd.weekly_off ? <Badge className="bg-muted text-foreground/90 text-xs">{t('lsetup.hl_weekly_off')}</Badge> : '-'}
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        ))}
                                                                    </TableBody>
                                                                </Table>
                                                            ) : (
                                                                <p className="text-sm text-muted-foreground text-center py-4">{t('lsetup.hl_no_entries')}</p>
                                                            )}
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                        </CardContent>
                    </Card>

                    {/* Create Holiday List Dialog */}
                    <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>{t('lsetup.hl_create')}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div>
                                    <Label>{t('lsetup.hl_name_label')}</Label>
                                    <Input
                                        value={formName}
                                        onChange={e => setFormName(e.target.value)}
                                        placeholder={`${activeCompany || 'Company'} - ${currentYear}`}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label>{t('leave.from')}</Label>
                                        <Input type="date" value={formFromDate} onChange={e => setFormFromDate(e.target.value)} />
                                    </div>
                                    <div>
                                        <Label>{t('leave.to')}</Label>
                                        <Input type="date" value={formToDate} onChange={e => setFormToDate(e.target.value)} />
                                    </div>
                                </div>
                                <div>
                                    <Label>{t('lsetup.hl_weekly_off')}</Label>
                                    <Select value={formWeeklyOff} onValueChange={setFormWeeklyOff}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => (
                                                <SelectItem key={d} value={d}>{d}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Individual holiday entries */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <Label>{t('lsetup.hl_custom_holidays')}</Label>
                                        <Button aria-label="إضافة" title="إضافة" variant="outline" size="sm" onClick={addHolidayEntry}>
                                            <Plus className="h-3 w-3 mr-1" /> {t('lsetup.hl_add_day')}
                                        </Button>
                                    </div>
                                    {formHolidays.length > 0 && (
                                        <div className="space-y-2">
                                            {formHolidays.map((h, idx) => (
                                                <div key={idx} className="flex gap-2 items-center">
                                                    <Input
                                                        type="date"
                                                        className="w-40"
                                                        value={h.holiday_date}
                                                        onChange={e => updateHolidayEntry(idx, 'holiday_date', e.target.value)}
                                                    />
                                                    <Input
                                                        className="flex-1"
                                                        placeholder={t('lsetup.hl_description')}
                                                        value={h.description}
                                                        onChange={e => updateHolidayEntry(idx, 'description', e.target.value)}
                                                    />
                                                    <Button aria-label="حذف" title="حذف" variant="ghost" size="icon" onClick={() => removeHolidayEntry(idx)}>
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-1">{t('lsetup.hl_custom_hint')}</p>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>{t('leave.cancel_btn')}</Button>
                                <Button onClick={handleCreateHoliday} disabled={creating}>
                                    {creating ? '...' : t('lsetup.hl_create')}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </TabsContent>

                <TabsContent value="compensatory" className="mt-4">
                    <Card>
                        <CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-lg">{t('lsetup.comp_requests')}</CardTitle><Button aria-label="تحديث" title="تحديث" variant="outline" size="icon" onClick={loadCompLeaves}><RefreshCw className="h-4 w-4" /></Button></div></CardHeader>
                        <CardContent>
                            {loading ? <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                                : compLeaves.length === 0 ? (
                                    <div className="text-center py-12"><Calendar className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" /><h3 className="text-lg font-medium text-foreground">{t('lsetup.no_comp')}</h3><p className="text-muted-foreground mt-1">{t('lsetup.no_comp_sub')}</p></div>
                                ) : (
                                    <Table>
                                        <TableHeader><TableRow><TableHead>{t('employee')}</TableHead><TableHead>{t('department')}</TableHead><TableHead>{t('lsetup.leave_types')}</TableHead><TableHead>{t('leave.from')}</TableHead><TableHead>{t('leave.to')}</TableHead><TableHead>{t('status')}</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {compLeaves.map((cl) => (
                                                <TableRow key={cl.name}>
                                                    <TableCell className="font-medium">{cl.employee_name || cl.employee}</TableCell>
                                                    <TableCell>{cl.department ? translateDepartment(cl.department, locale) : '-'}</TableCell>
                                                    <TableCell>{cl.leave_type ? translateEnum('leaveType', cl.leave_type, locale) : '-'}</TableCell>
                                                    <TableCell className="tabular-nums">{formatDateShort(cl.work_from_date) || '-'}</TableCell>
                                                    <TableCell className="tabular-nums">{formatDateShort(cl.work_end_date) || '-'}</TableCell>
                                                    <TableCell>
                                                        {cl.status === 'Approved' ? <Badge className="bg-green-100 text-green-800">{isRTL ? COMP_STATUS_AR['Approved'] : 'Approved'}</Badge> :
                                                            cl.status === 'Rejected' ? <Badge className="bg-red-100 text-red-800">{isRTL ? COMP_STATUS_AR['Rejected'] : 'Rejected'}</Badge> :
                                                                <Badge className="bg-yellow-100 text-yellow-800">{isRTL ? (COMP_STATUS_AR[cl.status || 'Draft'] || cl.status || 'Draft') : (cl.status || 'Draft')}</Badge>}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
