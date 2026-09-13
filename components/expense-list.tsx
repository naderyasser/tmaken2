'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, RefreshCw, FileText, DollarSign, CreditCard, Receipt, Download } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useI18n } from '@/lib/i18n'
import { formatDateShort } from '@/lib/format'
import { translateDepartment } from '@/lib/enums'

// ==================== Types ====================

interface ExpenseClaim {
    name: string
    employee: string
    employee_name?: string
    department?: string
    expense_type?: string
    posting_date?: string
    total_claimed_amount?: number
    total_sanctioned_amount?: number
    total_amount_reimbursed?: number
    status?: string
    approval_status?: string
    docstatus?: number
}

interface EmployeeAdvance {
    name: string
    employee: string
    employee_name?: string
    department?: string
    posting_date?: string
    purpose?: string
    advance_amount?: number
    paid_amount?: number
    return_amount?: number
    status?: string
    docstatus?: number
}

interface TravelRequest {
    name: string
    employee: string
    employee_name?: string
    department?: string
    travel_type?: string
    purpose_of_travel?: string
    posting_date?: string
    status?: string
    docstatus?: number
}

// ==================== Main Component ====================

export function ExpenseList() {
    const [activeTab, setActiveTab] = useState('expense-claims')
    const [expenseClaims, setExpenseClaims] = useState<ExpenseClaim[]>([])
    const [advances, setAdvances] = useState<EmployeeAdvance[]>([])
    const [travelRequests, setTravelRequests] = useState<TravelRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const { toast } = useToast()
    const { t, isRTL } = useI18n()

    const loadExpenseClaims = useCallback(async () => {
        try {
            setLoading(true)
            const response = await frappeClient.get<ExpenseClaim[]>('Expense Claim', undefined, {
                fields: ['name', 'employee', 'employee_name', 'department', 'posting_date', 'total_claimed_amount', 'total_sanctioned_amount', 'total_amount_reimbursed', 'status', 'approval_status', 'docstatus'],
                order_by: 'posting_date desc',
                limit_page_length: 100,
            })
            setExpenseClaims(response.data || [])
        } catch (error) {
            console.error('Failed to load expense claims:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    const loadAdvances = useCallback(async () => {
        try {
            setLoading(true)
            const response = await frappeClient.get<EmployeeAdvance[]>('Employee Advance', undefined, {
                fields: ['name', 'employee', 'employee_name', 'department', 'posting_date', 'purpose', 'advance_amount', 'paid_amount', 'return_amount', 'status', 'docstatus'],
                order_by: 'posting_date desc',
                limit_page_length: 100,
            })
            setAdvances(response.data || [])
        } catch (error) {
            console.error('Failed to load advances:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    const loadTravelRequests = useCallback(async () => {
        try {
            setLoading(true)
            const response = await frappeClient.get<TravelRequest[]>('Travel Request', undefined, {
                fields: ['name', 'employee', 'employee_name', 'department', 'travel_type', 'purpose_of_travel', 'posting_date', 'status', 'docstatus'],
                order_by: 'posting_date desc',
                limit_page_length: 100,
            })
            setTravelRequests(response.data || [])
        } catch (error) {
            console.error('Failed to load travel requests:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (activeTab === 'expense-claims') loadExpenseClaims()
        else if (activeTab === 'advances') loadAdvances()
        else if (activeTab === 'travel') loadTravelRequests()
    }, [activeTab, loadExpenseClaims, loadAdvances, loadTravelRequests])

    const formatCurrency = (amount: number | undefined) => {
        if (!amount) return '0.00'
        return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }

    const stats = useMemo(() => ({
        totalClaimed: expenseClaims.reduce((sum, e) => sum + (e.total_claimed_amount || 0), 0),
        totalSanctioned: expenseClaims.reduce((sum, e) => sum + (e.total_sanctioned_amount || 0), 0),
        totalAdvances: advances.reduce((sum, a) => sum + (a.advance_amount || 0), 0),
        pendingClaims: expenseClaims.filter(e => e.approval_status === 'Pending' || e.status === 'Unpaid').length,
    }), [expenseClaims, advances])

    const STATUS_LABEL_AR: Record<string, string> = {
        Draft: 'مسودة', Unpaid: 'غير مسدد', Unsanctioned: 'غير معتمد', Sanctioned: 'معتمد',
        Paid: 'مدفوع', Rejected: 'مرفوض', Cancelled: 'ملغى', Claimed: 'مُطالب به',
        Pending: 'قيد الانتظار', Approved: 'معتمد', Submitted: 'مُرسل',
        Active: 'نشط', Inactive: 'غير نشط',
    }
    const statusBadge = (status: string | undefined) => {
        const map: Record<string, string> = {
            'Draft': 'bg-muted text-foreground',
            'Unpaid': 'bg-yellow-100 text-yellow-800',
            'Unsanctioned': 'bg-orange-100 text-orange-800',
            'Sanctioned': 'bg-accent text-accent-foreground',
            'Paid': 'bg-green-100 text-green-800',
            'Rejected': 'bg-red-100 text-red-800',
            'Cancelled': 'bg-muted text-foreground',
            'Claimed': 'bg-accent text-accent-foreground',
            'Returned': 'bg-purple-100 text-purple-800',
            'Pending': 'bg-yellow-100 text-yellow-800',
            'Approved': 'bg-green-100 text-green-800',
        }
        return <Badge className={map[status || ''] || 'bg-muted text-foreground'}>{isRTL ? (STATUS_LABEL_AR[status || 'Draft'] || status || 'مسودة') : (status || 'Draft')}</Badge>
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">{t('exp.title')}</h1>
                    <p className="text-muted-foreground mt-1">{t('exp.subtitle')}</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-accent rounded-lg"><Receipt className="h-5 w-5 text-primary" /></div>
                            <div><p className="text-sm text-muted-foreground">{t('exp.total_claimed')}</p><p className="text-2xl font-bold">{formatCurrency(stats.totalClaimed)}</p></div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-50 rounded-lg"><DollarSign className="h-5 w-5 text-green-600" /></div>
                            <div><p className="text-sm text-muted-foreground">{t('exp.total_sanctioned')}</p><p className="text-2xl font-bold">{formatCurrency(stats.totalSanctioned)}</p></div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-50 rounded-lg"><CreditCard className="h-5 w-5 text-purple-600" /></div>
                            <div><p className="text-sm text-muted-foreground">{t('exp.advances_given')}</p><p className="text-2xl font-bold">{formatCurrency(stats.totalAdvances)}</p></div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-yellow-50 rounded-lg"><FileText className="h-5 w-5 text-yellow-600" /></div>
                            <div><p className="text-sm text-muted-foreground">{t('exp.pending_claims')}</p><p className="text-2xl font-bold">{stats.pendingClaims}</p></div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="expense-claims">{t('exp.claims')}</TabsTrigger>
                    <TabsTrigger value="advances">{t('exp.advances')}</TabsTrigger>
                    <TabsTrigger value="travel">{t('exp.travel')}</TabsTrigger>
                </TabsList>

                {/* Expense Claims */}
                <TabsContent value="expense-claims" className="mt-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">{t('exp.claims')}</CardTitle>
                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                                        <Input placeholder="Search..." className="pl-9 w-64" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                                    </div>
                                    <Button aria-label="تحديث" title="تحديث" variant="outline" size="icon" onClick={loadExpenseClaims}><RefreshCw className="h-4 w-4" /></Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                            ) : expenseClaims.length === 0 ? (
                                <div className="text-center py-12">
                                    <Receipt className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                                    <h3 className="text-lg font-medium text-foreground">{t('exp.no_claims')}</h3>
                                    <p className="text-muted-foreground mt-1">{t('exp.no_claims_sub')}</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>ID</TableHead>
                                            <TableHead>{t('employee')}</TableHead>
                                            <TableHead>{t('department')}</TableHead>
                                            <TableHead>{t('date')}</TableHead>
                                            <TableHead className="text-right">{t('exp.claimed')}</TableHead>
                                            <TableHead className="text-right">{t('exp.sanctioned')}</TableHead>
                                            <TableHead className="text-right">Reimbursed</TableHead>
                                            <TableHead>{t('status')}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {expenseClaims.filter(e => !searchQuery || e.employee_name?.toLowerCase().includes(searchQuery.toLowerCase())).map((claim) => (
                                            <TableRow key={claim.name}>
                                                <TableCell className="font-mono text-xs">{claim.name}</TableCell>
                                                <TableCell className="font-medium">{claim.employee_name || claim.employee}</TableCell>
                                                <TableCell>{claim.department ? translateDepartment(claim.department, isRTL ? 'ar' : 'en') : '-'}</TableCell>
                                                <TableCell className="tabular-nums">{formatDateShort(claim.posting_date) || '-'}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(claim.total_claimed_amount)}</TableCell>
                                                <TableCell className="text-right text-primary">{formatCurrency(claim.total_sanctioned_amount)}</TableCell>
                                                <TableCell className="text-right text-green-600 font-medium">{formatCurrency(claim.total_amount_reimbursed)}</TableCell>
                                                <TableCell>{statusBadge(claim.status || claim.approval_status)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Employee Advances */}
                <TabsContent value="advances" className="mt-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">{t('exp.advances')}</CardTitle>
                                <Button aria-label="تحديث" title="تحديث" variant="outline" size="icon" onClick={loadAdvances}><RefreshCw className="h-4 w-4" /></Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                            ) : advances.length === 0 ? (
                                <div className="text-center py-12">
                                    <CreditCard className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                                    <h3 className="text-lg font-medium text-foreground">{t('exp.no_advances')}</h3>
                                    <p className="text-muted-foreground mt-1">{t('exp.no_advances_sub')}</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>ID</TableHead>
                                            <TableHead>{t('employee')}</TableHead>
                                            <TableHead>{t('exp.purpose')}</TableHead>
                                            <TableHead>{t('date')}</TableHead>
                                            <TableHead className="text-right">{t('exp.amount')}</TableHead>
                                            <TableHead className="text-right">{t('exp.paid')}</TableHead>
                                            <TableHead className="text-right">{t('exp.returned')}</TableHead>
                                            <TableHead>{t('status')}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {advances.map((adv) => (
                                            <TableRow key={adv.name}>
                                                <TableCell className="font-mono text-xs">{adv.name}</TableCell>
                                                <TableCell className="font-medium">{adv.employee_name || adv.employee}</TableCell>
                                                <TableCell>{adv.purpose || '-'}</TableCell>
                                                <TableCell className="tabular-nums">{formatDateShort(adv.posting_date) || '-'}</TableCell>
                                                <TableCell className="text-right font-medium">{formatCurrency(adv.advance_amount)}</TableCell>
                                                <TableCell className="text-right text-green-600">{formatCurrency(adv.paid_amount)}</TableCell>
                                                <TableCell className="text-right text-red-600">{formatCurrency(adv.return_amount)}</TableCell>
                                                <TableCell>{statusBadge(adv.status)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Travel Requests */}
                <TabsContent value="travel" className="mt-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">{t('exp.travel')}</CardTitle>
                                <Button aria-label="تحديث" title="تحديث" variant="outline" size="icon" onClick={loadTravelRequests}><RefreshCw className="h-4 w-4" /></Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                            ) : travelRequests.length === 0 ? (
                                <div className="text-center py-12">
                                    <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                                    <h3 className="text-lg font-medium text-foreground">{t('exp.no_travel')}</h3>
                                    <p className="text-muted-foreground mt-1">{t('exp.no_travel_sub')}</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>ID</TableHead>
                                            <TableHead>{t('employee')}</TableHead>
                                            <TableHead>{t('department')}</TableHead>
                                            <TableHead>{t('exp.travel_type')}</TableHead>
                                            <TableHead>{t('exp.purpose')}</TableHead>
                                            <TableHead>{t('date')}</TableHead>
                                            <TableHead>{t('status')}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {travelRequests.map((tr) => (
                                            <TableRow key={tr.name}>
                                                <TableCell className="font-mono text-xs">{tr.name}</TableCell>
                                                <TableCell className="font-medium">{tr.employee_name || tr.employee}</TableCell>
                                                <TableCell>{tr.department ? translateDepartment(tr.department, isRTL ? 'ar' : 'en') : '-'}</TableCell>
                                                <TableCell>{tr.travel_type || '-'}</TableCell>
                                                <TableCell>{tr.purpose_of_travel || '-'}</TableCell>
                                                <TableCell className="tabular-nums">{formatDateShort(tr.posting_date) || '-'}</TableCell>
                                                <TableCell>{statusBadge(tr.status)}</TableCell>
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
