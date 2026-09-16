'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
    Calendar, Search, Plus, RefreshCw, Download, Eye, CheckCircle, XCircle,
    Clock, Loader2, Filter, MoreVertical, FileText, Paperclip, Check, X
} from 'lucide-react'
import { frappeClient, isAuthError, type LeaveApplication } from '@/lib/api-client'
import { SessionRenew } from '@/components/login-page'
import { frappeImageUrl } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { useI18n } from '@/lib/i18n'
import { translateEnum } from '@/lib/enums'
import { formatDateShort } from '@/lib/format'
import { LeaveApplicationDialog } from './leave-application-dialog'

interface LeaveListProps {
    onAddLeave?: () => void
}

export function LeaveList({ onAddLeave }: LeaveListProps) {
    const [leaves, setLeaves] = useState<LeaveApplication[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [currentPage, setCurrentPage] = useState(1)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [processingLeave, setProcessingLeave] = useState<string | null>(null)
    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean
        action: 'approve' | 'reject' | 'cancel'
        leave: LeaveApplication | null
    }>({ open: false, action: 'approve', leave: null })
    const [detailsDialog, setDetailsDialog] = useState<{
        open: boolean
        leave: LeaveApplication | null
    }>({ open: false, leave: null })
    // Files attached to the opened leave (the PWA attaches the certificate as a standard
    // document attachment, not into the custom field — so we list real attachments here).
    const [detailAttachments, setDetailAttachments] = useState<Array<{ name: string; file_name: string; file_url: string }>>([])
    const itemsPerPage = 20
    const { toast } = useToast()
    const { t, isRTL } = useI18n()
    const locale = isRTL ? 'ar' : 'en'
    const { user, isAuthenticated, isLoading: authLoading } = useAuth()
    const [authRequired, setAuthRequired] = useState(false)
    // Separation of duties: an admin must not approve/reject their OWN leave request.
    // The backend enforces this too (source of truth); here we disable the buttons up-front.
    const currentEmployee = user?.employee || null
    const isOwnLeave = (leave: LeaveApplication) => !!currentEmployee && leave.employee === currentEmployee

    const loadLeaves = useCallback(async (showRefresh = false) => {
        if (!authLoading && !isAuthenticated) {
            setLeaves([])
            setAuthRequired(true)
            setLoading(false)
            setRefreshing(false)
            return
        }
        try {
            if (showRefresh) setRefreshing(true)
            else setLoading(true)
            setAuthRequired(false)

            const data = await frappeClient.getLeaveApplications({
                fields: [
                    'name', 'employee', 'employee_name', 'leave_type',
                    'from_date', 'to_date', 'total_leave_days', 'description',
                    'status', 'leave_approver',
                    'custom_illness_type', 'custom_medical_certificate',
                ],
                order_by: 'creation desc',
                limit_page_length: 100,
            })

            // Fetch leave type info to get is_lwp
            let leaveTypeMap: Record<string, boolean> = {}
            try {
                const ltResponse = await frappeClient.get('Leave Type', undefined, {
                    fields: ['name', 'is_lwp'],
                    limit_page_length: 50,
                })
                const ltData = (ltResponse.data || []) as any[]
                ltData.forEach((lt: any) => { leaveTypeMap[lt.name] = !!lt.is_lwp })
            } catch { /* ignore */ }

            // Enrich leave data with is_lwp
            const enriched = data.map(l => ({
                ...l,
                is_lwp: leaveTypeMap[l.leave_type] ? 1 : 0,
            }))

            setLeaves(enriched)
            if (enriched.length >= 100) {
                toast({
                    title: t('info') || 'Info',
                    description: isRTL
                        ? 'يتم عرض أحدث 100 طلب إجازة فقط. استخدم الفلاتر لتضييق النتائج.'
                        : 'Showing the latest 100 leave applications. Use filters to narrow results.',
                })
            }
        } catch (error) {
            if (isAuthError(error)) {
                setLeaves([])
                setAuthRequired(true)
            } else {
                console.error('Failed to load leaves:', error)
                toast({ title: t('error'), description: t('leave.load_fail'), variant: 'destructive' })
            }
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [toast, isRTL, t, authLoading, isAuthenticated])

    useEffect(() => { if (!authLoading) loadLeaves() }, [loadLeaves, authLoading])

    const filteredLeaves = useMemo(() => {
        let filtered = leaves
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            filtered = filtered.filter(l =>
                l.employee_name?.toLowerCase().includes(q) ||
                l.leave_type.toLowerCase().includes(q) ||
                l.employee.toLowerCase().includes(q)
            )
        }
        if (statusFilter !== 'all') {
            filtered = filtered.filter(l => l.status === statusFilter)
        }
        return filtered
    }, [leaves, searchQuery, statusFilter])

    const paginatedLeaves = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage
        return filteredLeaves.slice(start, start + itemsPerPage)
    }, [filteredLeaves, currentPage])

    const totalPages = Math.ceil(filteredLeaves.length / itemsPerPage)

    const stats = useMemo(() => ({
        total: leaves.length,
        open: leaves.filter(l => l.status === 'Open').length,
        approved: leaves.filter(l => l.status === 'Approved').length,
        rejected: leaves.filter(l => l.status === 'Rejected').length,
    }), [leaves])

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Approved': return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">{t('leave.approved')}</Badge>
            case 'Rejected': return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">{t('leave.rejected')}</Badge>
            case 'Open': return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">{t('leave.pending')}</Badge>
            case 'Cancelled': return <Badge className="bg-muted text-foreground hover:bg-accent">{t('cancelled')}</Badge>
            default: return <Badge variant="secondary">{status}</Badge>
        }
    }

    const handleApprove = async (leave: LeaveApplication) => {
        setConfirmDialog({ open: true, action: 'approve', leave })
    }

    const handleReject = async (leave: LeaveApplication) => {
        setConfirmDialog({ open: true, action: 'reject', leave })
    }

    const handleCancel = async (leave: LeaveApplication) => {
        setConfirmDialog({ open: true, action: 'cancel', leave })
    }

    const confirmAction = async () => {
        const { action, leave } = confirmDialog
        if (!leave) return

        setProcessingLeave(leave.name)
        try {
            if (action === 'approve') {
                await frappeClient.approveLeaveApplication(leave.name)
                toast({
                    title: t('success'),
                    description: t('leave.approve_success'),
                })
            } else if (action === 'reject') {
                await frappeClient.rejectLeaveApplication(leave.name)
                toast({
                    title: t('success'),
                    description: t('leave.reject_success'),
                })
            } else if (action === 'cancel') {
                await frappeClient.cancelLeaveApplication(leave.name)
                toast({
                    title: t('success'),
                    description: t('leave.cancel_success'),
                })
            }
            await loadLeaves(true)
        } catch (error) {
            console.error(`Failed to ${action} leave:`, error)
            // Map known backend errors to friendly Arabic; otherwise show the exact backend
            // message (e.g. the medical-certificate ValidationError), else a generic fallback.
            const raw = error instanceof Error ? error.message.trim() : ''
            const lower = raw.toLowerCase()
            let description = raw
            if (lower.includes('self-approval') || lower.includes('self approval')) {
                description = t('leave.cannot_approve_own')
            } else if (lower.includes('insufficient leave balance')) {
                description = t('leave.insufficient_balance')
            }
            toast({
                title: t('error'),
                description: description || t('leave.action_fail'),
                variant: 'destructive',
            })
        } finally {
            setProcessingLeave(null)
            setConfirmDialog({ open: false, action: 'approve', leave: null })
        }
    }

    const viewDetails = async (leave: LeaveApplication) => {
        setDetailsDialog({ open: true, leave })
        setDetailAttachments([])
        try {
            const res = await frappeClient.get('File', undefined, {
                filters: [
                    ['File', 'attached_to_doctype', '=', 'Leave Application'],
                    ['File', 'attached_to_name', '=', leave.name],
                ],
                fields: ['name', 'file_name', 'file_url'],
                limit_page_length: 20,
            })
            setDetailAttachments((res.data as any[]) || [])
        } catch (e) {
            console.error('Failed to load leave attachments', e)
        }
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-12 w-full" />
                <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
                </div>
                <Skeleton className="h-64 w-full" />
            </div>
        )
    }

    if (authRequired) return <SessionRenew />

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t('leave.title')}</h1>
                    <p className="text-muted-foreground mt-1">{t('leave.subtitle')}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <Button aria-label="تحديث" title="تحديث" variant="outline" size="sm" onClick={() => loadLeaves(true)} disabled={refreshing}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        {t('refresh')}
                    </Button>
                    <Button aria-label="إضافة" title="إضافة" size="sm" onClick={() => setDialogOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        {t('leave.new')}
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('leave.total')}</CardTitle></CardHeader>
                    <CardContent><div className="text-3xl font-bold">{stats.total}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('leave.pending')}</CardTitle></CardHeader>
                    <CardContent><div className="text-3xl font-bold text-yellow-600">{stats.open}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('leave.approved')}</CardTitle></CardHeader>
                    <CardContent><div className="text-3xl font-bold text-green-600">{stats.approved}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('leave.rejected')}</CardTitle></CardHeader>
                    <CardContent><div className="text-3xl font-bold text-red-600">{stats.rejected}</div></CardContent></Card>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/70" />
                            <Input placeholder={t('leave.search')} value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }} className="pl-10" />
                        </div>
                        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1) }}>
                            <SelectTrigger aria-label={t('leave.all_statuses')}><SelectValue placeholder={t('leave.all_statuses')} /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('leave.all_statuses')}</SelectItem>
                                <SelectItem value="Open">{t('leave.pending')}</SelectItem>
                                <SelectItem value="Approved">{t('leave.approved')}</SelectItem>
                                <SelectItem value="Rejected">{t('leave.rejected')}</SelectItem>
                                <SelectItem value="Cancelled">{t('cancelled')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t('employee')}</TableHead>
                                <TableHead>{t('leave.type')}</TableHead>
                                <TableHead>{t('leave.from')}</TableHead>
                                <TableHead>{t('leave.to')}</TableHead>
                                <TableHead>{t('leave.days')}</TableHead>
                                <TableHead>{t('leave.paid_unpaid')}</TableHead>
                                <TableHead>{t('status')}</TableHead>
                                <TableHead className="text-right">{t('actions')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedLeaves.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                                        <Calendar className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                                        {leaves.length === 0 ? t('leave.no_found') : t('leave.no_match')}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedLeaves.map(leave => (
                                    <TableRow key={leave.name} className="hover:bg-accent/50">
                                        <TableCell>
                                            <div>
                                                <div className="font-medium">{leave.employee_name || leave.employee}</div>
                                                <div className="text-xs text-muted-foreground">{leave.employee}</div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                {translateEnum('leaveType', leave.leave_type, locale)}
                                            </div>
                                        </TableCell>
                                        <TableCell className="tabular-nums">{formatDateShort(leave.from_date) || '—'}</TableCell>
                                        <TableCell className="tabular-nums">{formatDateShort(leave.to_date) || '—'}</TableCell>
                                        <TableCell>
                                            <span className="font-semibold">{leave.total_leave_days}</span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-xs">
                                                {leave.is_lwp ? (
                                                    <span className="text-orange-600">✗ {t('leave.unpaid')}</span>
                                                ) : (
                                                    <span className="text-green-600">✓ {t('leave.paid')}</span>
                                                )}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{getStatusBadge(leave.status)}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => viewDetails(leave)}
                                                    title={isRTL ? 'عرض' : 'View'}
                                                    aria-label={isRTL ? 'عرض' : 'View'}
                                                    className="h-8 px-2"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                {leave.status === 'Open' && (
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleApprove(leave)}
                                                            disabled={processingLeave === leave.name || isOwnLeave(leave)}
                                                            title={isOwnLeave(leave) ? t('leave.cannot_approve_own') : (isRTL ? 'اعتماد' : 'Approve')}
                                                            aria-label={isRTL ? 'اعتماد' : 'Approve'}
                                                            className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50 disabled:opacity-40"
                                                        >
                                                            {processingLeave === leave.name ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <Check className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleReject(leave)}
                                                            disabled={processingLeave === leave.name || isOwnLeave(leave)}
                                                            title={isOwnLeave(leave) ? t('leave.cannot_reject_own') : (isRTL ? 'رفض' : 'Reject')}
                                                            aria-label={isRTL ? 'رفض' : 'Reject'}
                                                            className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-40"
                                                        >
                                                            {processingLeave === leave.name ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <X className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    </>
                                                )}
                                                {(leave.status === 'Approved' || leave.status === 'Open') && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleCancel(leave)}
                                                        disabled={processingLeave === leave.name}
                                                        title={isRTL ? 'إلغاء الطلب' : 'Cancel request'}
                                                        aria-label={isRTL ? 'إلغاء الطلب' : 'Cancel request'}
                                                        className="h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-accent/50"
                                                    >
                                                        <XCircle className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 border-t">
                            <div className="text-sm text-muted-foreground">
                                {t('page')} {currentPage} {t('of')} {totalPages}
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>{t('previous')}</Button>
                                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>{t('next')}</Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <LeaveApplicationDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSuccess={() => loadLeaves(true)}
            />

            {/* Confirmation Dialog */}
            <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ ...confirmDialog, open: false })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {confirmDialog.action === 'approve' && t('leave.approve_title')}
                            {confirmDialog.action === 'reject' && t('leave.reject_title')}
                            {confirmDialog.action === 'cancel' && t('leave.cancel_title')}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmDialog.action === 'approve' && (
                                <>
                                    {t('leave.approve_confirm')}{' '}
                                    <strong>{confirmDialog.leave?.employee_name}</strong>?
                                    <br />
                                    <span className="text-sm text-muted-foreground mt-2 block">
                                        {confirmDialog.leave?.total_leave_days} {t('leave.days_from_to')}{' '}
                                        {formatDateShort(confirmDialog.leave?.from_date)} {t('leave.to')} {formatDateShort(confirmDialog.leave?.to_date)}
                                    </span>
                                </>
                            )}
                            {confirmDialog.action === 'reject' && (
                                <>
                                    {t('leave.reject_confirm')}{' '}
                                    <strong>{confirmDialog.leave?.employee_name}</strong>?
                                    <br />
                                    <span className="text-sm text-muted-foreground mt-2 block">
                                        {t('leave.cannot_undo')}
                                    </span>
                                </>
                            )}
                            {confirmDialog.action === 'cancel' && (
                                <>
                                    {t('leave.cancel_confirm')}{' '}
                                    <strong>{confirmDialog.leave?.employee_name}</strong>?
                                    <br />
                                    <span className="text-sm text-muted-foreground mt-2 block">
                                        {t('leave.cannot_undo')}
                                    </span>
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={processingLeave !== null}>{t('leave.cancel_btn')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmAction}
                            disabled={processingLeave !== null}
                            className={
                                confirmDialog.action === 'approve'
                                    ? 'bg-green-600 hover:bg-green-700'
                                    : confirmDialog.action === 'reject'
                                        ? 'bg-red-600 hover:bg-red-700'
                                        : 'bg-gray-600 hover:bg-gray-700'
                            }
                        >
                            {processingLeave ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {t('leave.processing')}
                                </>
                            ) : (
                                <>
                                    {confirmDialog.action === 'approve' && t('leave.approve')}
                                    {confirmDialog.action === 'reject' && t('leave.reject')}
                                    {confirmDialog.action === 'cancel' && t('leave.cancel_leave')}
                                </>
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Details Dialog */}
            <Dialog open={detailsDialog.open} onOpenChange={(open) => !open && setDetailsDialog({ open: false, leave: null })}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{t('leave.details_title')}</DialogTitle>
                        <DialogDescription>
                            {t('leave.details_desc')}
                        </DialogDescription>
                    </DialogHeader>
                    {detailsDialog.leave && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">{t('employee')}</label>
                                    <p className="text-base font-semibold">{detailsDialog.leave.employee_name}</p>
                                    <p className="text-xs text-muted-foreground">{detailsDialog.leave.employee}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">{t('leave.type')}</label>
                                    <p className="text-base font-semibold">{translateEnum('leaveType', detailsDialog.leave.leave_type, locale)}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">{t('leave.from_date')}</label>
                                    <p className="text-base font-semibold tabular-nums">{formatDateShort(detailsDialog.leave.from_date)}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">{t('leave.to_date')}</label>
                                    <p className="text-base font-semibold tabular-nums">{formatDateShort(detailsDialog.leave.to_date)}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">{t('leave.total_days')}</label>
                                    <p className="text-base font-semibold">{detailsDialog.leave.total_leave_days}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">{t('status')}</label>
                                    <div className="mt-1">{getStatusBadge(detailsDialog.leave.status)}</div>
                                </div>
                            </div>
                            {detailsDialog.leave.description && (
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">{t('leave.reason')}</label>
                                    <p className="text-base mt-1 p-3 bg-muted/40 rounded-md">
                                        {detailsDialog.leave.description}
                                    </p>
                                </div>
                            )}
                            {/* Illness reason — Sick Leave only */}
                            {detailsDialog.leave.leave_type === 'Sick Leave' && (
                                <div className="space-y-2 p-3 rounded-md border border-amber-200 bg-amber-50">
                                    <div>
                                        <label className="text-sm font-medium text-muted-foreground">
                                            {isRTL ? 'سبب المرض' : 'Illness Reason'}
                                        </label>
                                        <p className="text-base mt-1">
                                            {detailsDialog.leave.custom_illness_type || (isRTL ? 'غير محدد' : 'Not provided')}
                                        </p>
                                    </div>
                                    {!detailsDialog.leave.custom_medical_certificate && detailAttachments.length === 0 && (
                                        <p className="text-sm text-red-600">
                                            {isRTL ? 'لم يتم إرفاق تقرير طبي' : 'No medical certificate attached'}
                                        </p>
                                    )}
                                </div>
                            )}
                            {/* Attachments — list every file on the document (+ the custom certificate field if set) */}
                            {(detailAttachments.length > 0 || detailsDialog.leave.custom_medical_certificate) && (
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">
                                        {isRTL ? 'المرفقات' : 'Attachments'}
                                    </label>
                                    <div className="mt-1 space-y-1.5">
                                        {detailsDialog.leave.custom_medical_certificate && (
                                            <a
                                                href={frappeImageUrl(detailsDialog.leave.custom_medical_certificate)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1.5 text-primary hover:underline text-sm font-medium break-all"
                                            >
                                                <FileText className="h-4 w-4 flex-shrink-0" />
                                                {isRTL ? 'التقرير الطبي' : 'Medical certificate'}
                                            </a>
                                        )}
                                        {detailAttachments.map((f) => (
                                            <a
                                                key={f.name}
                                                href={frappeImageUrl(f.file_url)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1.5 text-primary hover:underline text-sm font-medium break-all"
                                            >
                                                <FileText className="h-4 w-4 flex-shrink-0" />
                                                {f.file_name || (isRTL ? 'مرفق' : 'attachment')}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {detailsDialog.leave.leave_approver && (
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">{t('leave.approver')}</label>
                                    <p className="text-base">{detailsDialog.leave.leave_approver}</p>
                                </div>
                            )}
                            {detailsDialog.leave.status === 'Open' && (
                                <div className="pt-4 border-t">
                                    {isOwnLeave(detailsDialog.leave) && (
                                        <p className="mb-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2.5 text-right">
                                            {t('leave.cannot_approve_own_note')}
                                        </p>
                                    )}
                                    <div className="flex gap-3">
                                    <Button
                                        onClick={() => {
                                            setDetailsDialog({ open: false, leave: null })
                                            handleApprove(detailsDialog.leave!)
                                        }}
                                        disabled={isOwnLeave(detailsDialog.leave)}
                                        title={isOwnLeave(detailsDialog.leave) ? t('leave.cannot_approve_own') : ''}
                                        className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-40"
                                    >
                                        <Check className="mr-2 h-4 w-4" />
                                        {t('leave.approve')}
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            setDetailsDialog({ open: false, leave: null })
                                            handleReject(detailsDialog.leave!)
                                        }}
                                        disabled={isOwnLeave(detailsDialog.leave)}
                                        title={isOwnLeave(detailsDialog.leave) ? t('leave.cannot_reject_own') : ''}
                                        variant="destructive"
                                        className="flex-1 disabled:opacity-40"
                                    >
                                        <X className="mr-2 h-4 w-4" />
                                        {t('leave.reject')}
                                    </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
