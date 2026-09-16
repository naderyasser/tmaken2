'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
    Calendar, Search, Plus, RefreshCw, Download, Eye, MapPin, Camera,
    Clock, Loader2, Filter, Fingerprint, User, LogIn, LogOut, Image as ImageIcon, Printer
} from 'lucide-react'
import { frappeClient, isAuthError, type EmployeeCheckin } from '@/lib/api-client'
import { SessionRenew } from '@/components/login-page'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
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
import { useCompany } from '@/hooks/use-company'
import { EmployeeCheckinDialog } from './employee-checkin-dialog'
import { format } from 'date-fns'
import { dualDate, hijriShort, formatDateShort } from '@/lib/format'
import { printRows, exportRowsToCsv, type ExportColumn } from '@/lib/export-utils'

interface EmployeeCheckinListProps {
    onAddCheckin?: () => void
}

/** Server-side cap on how many check-ins are fetched for one view. */
const FETCH_LIMIT = 500

export function EmployeeCheckinList({ onAddCheckin }: EmployeeCheckinListProps) {
    const [checkins, setCheckins] = useState<EmployeeCheckin[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [logTypeFilter, setLogTypeFilter] = useState<string>('all')
    const [verificationFilter, setVerificationFilter] = useState<string>('all')
    const [dateFilter, setDateFilter] = useState<string>('today')
    const [dialogOpen, setDialogOpen] = useState(false)
    const [detailsDialog, setDetailsDialog] = useState<{
        open: boolean
        checkin: EmployeeCheckin | null
    }>({ open: false, checkin: null })
    const { toast } = useToast()
    const { t, isRTL } = useI18n()
    const { company: activeCompany } = useCompany()
    const { isAuthenticated, isLoading: authLoading } = useAuth()
    const [authRequired, setAuthRequired] = useState(false)

    const loadCheckins = useCallback(async (showRefresh = false) => {
        if (!authLoading && !isAuthenticated) {
            setCheckins([])
            setAuthRequired(true)
            setLoading(false)
            setRefreshing(false)
            return
        }
        try {
            if (showRefresh) setRefreshing(true)
            else setLoading(true)
            setAuthRequired(false)

            // Determine date range based on filter
            const today = new Date()
            let fromDate = format(today, 'yyyy-MM-dd')
            let toDate = format(today, 'yyyy-MM-dd')

            if (dateFilter === 'yesterday') {
                const yesterday = new Date(today)
                yesterday.setDate(yesterday.getDate() - 1)
                fromDate = format(yesterday, 'yyyy-MM-dd')
                toDate = format(yesterday, 'yyyy-MM-dd')
            } else if (dateFilter === 'week') {
                const weekAgo = new Date(today)
                weekAgo.setDate(weekAgo.getDate() - 7)
                fromDate = format(weekAgo, 'yyyy-MM-dd')
            } else if (dateFilter === 'month') {
                const monthAgo = new Date(today)
                monthAgo.setMonth(monthAgo.getMonth() - 1)
                fromDate = format(monthAgo, 'yyyy-MM-dd')
            }

            // Build filters including company filter via linked Employee doctype
            const filters: any[] = [
                ['Employee Checkin', 'time', '>=', `${fromDate} 00:00:00`],
                ['Employee Checkin', 'time', '<=', `${toDate} 23:59:59`]
            ]

            // Frappe ORM cannot do cross-doctype JOINs via ['Employee', 'company', '=', ...]
            // on Employee Checkin. Instead, fetch employee IDs for the company first.
            if (activeCompany) {
                const empRes = await frappeClient.get<{ name: string }[]>('Employee', undefined, {
                    filters: [['company', '=', activeCompany]],
                    fields: ['name'],
                    limit_page_length: 0,
                })
                const empIds = (empRes.data || []).map(e => e.name)
                if (empIds.length === 0) {
                    setCheckins([])
                    return
                }
                filters.push(['employee', 'in', empIds])
            }

            const data = await frappeClient.getEmployeeCheckins({
                filters,
                fields: [
                    'name', 'employee', 'employee_name', 'time', 'log_type',
                    'shift', 'device_id', 'checkin_method', 'photo_image',
                    'biometric_verified', 'biometric_type', 'latitude', 'longitude',
                    'shift_start', 'shift_end', 'attendance'
                ],
                order_by: 'time desc',
                limit_page_length: FETCH_LIMIT,
            })
            setCheckins(data)
        } catch (error) {
            if (isAuthError(error)) {
                setCheckins([])
                setAuthRequired(true)
            } else {
                console.error('Failed to load checkins:', error)
                toast({
                    title: t('error'),
                    description: t('ckl.loadFail'),
                    variant: 'destructive'
                })
            }
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [toast, t, dateFilter, activeCompany, authLoading, isAuthenticated])

    useEffect(() => { if (!authLoading) loadCheckins() }, [loadCheckins, authLoading])

    const filteredCheckins = useMemo(() => {
        let filtered = checkins
        
        // Search filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            filtered = filtered.filter(c =>
                c.employee_name?.toLowerCase().includes(q) ||
                c.employee.toLowerCase().includes(q) ||
                c.device_id?.toLowerCase().includes(q)
            )
        }
        
        // Log type filter
        if (logTypeFilter !== 'all') {
            filtered = filtered.filter(c => c.log_type === logTypeFilter)
        }
        
        // Verification filter
        if (verificationFilter === 'photo') {
            filtered = filtered.filter(c => c.photo_image)
        } else if (verificationFilter === 'biometric') {
            filtered = filtered.filter(c => c.biometric_verified === 1)
        }
        
        return filtered
    }, [checkins, searchQuery, logTypeFilter, verificationFilter])

    // Every record matching the filters is on the page. This is a log people
    // scan and search; splitting it across 21 pages of 20 rows meant almost all
    // of it was behind a Next button, and the rows were already fetched anyway.
    const exportColumns = useMemo<ExportColumn<EmployeeCheckin>[]>(() => [
        { header: t('ckl.employee'), value: (r) => `${r.employee_name || ''} (${r.employee})` },
        { header: t('ckl.dateTime'), value: (r) => r.time ? format(new Date(r.time), 'yyyy-MM-dd HH:mm:ss') : '' },
        { header: t('ckl.type'), value: (r) => r.log_type === 'IN' ? t('ckl.checkIn') : r.log_type === 'OUT' ? t('ckl.checkOut') : '' },
        { header: t('ckl.shift'), value: (r) => r.shift || '-' },
        { header: t('ckl.verification'), value: (r) => r.biometric_verified ? (r.biometric_type || t('ckl.verified')) : '-' },
        { header: t('ckl.device'), value: (r) => r.device_id || '-' },
        { header: t('ckl.location'), value: (r) => (r.latitude && r.longitude) ? `${Number(r.latitude).toFixed(5)}, ${Number(r.longitude).toFixed(5)}` : '-' },
    ], [t])

    const printSubtitle = () =>
        `${t('ckl.recordCount').replace('{n}', String(filteredCheckins.length))} — ${formatDateShort(new Date().toISOString())}`

    const handlePrint = () => {
        if (!filteredCheckins.length) return
        printRows({ title: t('ckl.title'), subtitle: printSubtitle(), isRTL }, exportColumns, filteredCheckins)
    }

    const handleExportCsv = () => {
        if (!filteredCheckins.length) return
        exportRowsToCsv(`checkins_${format(new Date(), 'yyyy-MM-dd')}`, exportColumns, filteredCheckins)
    }

    const stats = useMemo(() => ({
        total: checkins.length,
        checkIns: checkins.filter(c => c.log_type === 'IN').length,
        checkOuts: checkins.filter(c => c.log_type === 'OUT').length,
        withPhoto: checkins.filter(c => c.photo_image).length,
        withBiometric: checkins.filter(c => c.biometric_verified === 1).length,
        withLocation: checkins.filter(c => c.latitude && c.longitude).length,
    }), [checkins])

    // Hide always-empty columns: show a column only when at least one loaded row has data for it.
    const showShift = useMemo(() => checkins.some(c => !!c.shift), [checkins])
    const showVerification = useMemo(
        () => checkins.some(c => c.photo_image || c.biometric_verified === 1),
        [checkins]
    )
    const showDevice = useMemo(() => checkins.some(c => !!c.device_id), [checkins])
    // Employee, Date/Time, Type, Location, Actions are always shown (5); the rest are conditional.
    const visibleColSpan = 5 + (showShift ? 1 : 0) + (showVerification ? 1 : 0) + (showDevice ? 1 : 0)

    const getLogTypeBadge = (logType?: string) => {
        if (logType === 'IN') {
            return <Badge className="inline-flex items-center gap-1 bg-green-100 text-green-800 hover:bg-green-100">
                <LogIn className="w-3 h-3" />
                {t('ckl.checkIn')}
            </Badge>
        } else if (logType === 'OUT') {
            return <Badge className="inline-flex items-center gap-1 bg-accent text-accent-foreground hover:bg-accent">
                <LogOut className="w-3 h-3" />
                {t('ckl.checkOut')}
            </Badge>
        }
        return <Badge variant="secondary" className="inline-flex items-center gap-1">{t('ckl.na')}</Badge>
    }

    const viewDetails = (checkin: EmployeeCheckin) => {
        setDetailsDialog({ open: true, checkin })
    }

    const formatDateTime = (dateTimeStr?: string) => {
        if (!dateTimeStr) return t('ckl.na')
        try {
            const date = new Date(dateTimeStr)
            // Hijri-first (Umm al-Qura) + Gregorian, then time — via canonical util
            return `${dualDate(date)} — ${format(date, 'HH:mm:ss')}`
        } catch {
            return dateTimeStr
        }
    }

    const formatTime = (dateTimeStr?: string) => {
        if (!dateTimeStr) return t('ckl.na')
        try {
            const date = new Date(dateTimeStr)
            return format(date, 'HH:mm:ss')
        } catch {
            return dateTimeStr
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
            {/* Header — stacks on a phone. As a single non-wrapping row the four
                buttons were wider than the viewport, which pushed the whole PAGE
                wider than the screen: the title got clipped and the user had to
                pinch-zoom to reach anything. The table below was never the
                problem; it scrolls inside its own box. */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('ckl.title')}</h1>
                    <p className="text-muted-foreground mt-1 text-sm sm:text-base">{t('ckl.subtitle')}</p>
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                    <Button variant="outline" size="sm" onClick={handlePrint} disabled={!filteredCheckins.length}>
                        <Printer className="w-4 h-4 mr-2" />
                        {t('ckl.print')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={!filteredCheckins.length}>
                        <Download className="w-4 h-4 mr-2" />
                        {t('ckl.exportCsv')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => loadCheckins(true)} disabled={refreshing}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        {t('refresh')}
                    </Button>
                    <Button size="sm" onClick={() => setDialogOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        {t('ckl.newCheckin')}
                    </Button>
                </div>
            </div>

            {/* Stats — 2-up and compact on a phone. As six full-width cards with
                desktop padding this block alone was two screens of scrolling
                before any actual record came into view. */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 sm:gap-4">
                {([
                    { key: 'ckl.total', value: stats.total, tone: '' },
                    { key: 'ckl.checkIns', value: stats.checkIns, tone: 'text-green-600' },
                    { key: 'ckl.checkOuts', value: stats.checkOuts, tone: 'text-primary' },
                    { key: 'ckl.withPhoto', value: stats.withPhoto, tone: 'text-purple-600' },
                    { key: 'ckl.biometric', value: stats.withBiometric, tone: 'text-orange-600' },
                    { key: 'ckl.withLocation', value: stats.withLocation, tone: 'text-teal-600' },
                ] as const).map(stat => (
                    <Card key={stat.key}>
                        <CardContent className="p-3 sm:p-4">
                            <div className="text-xs sm:text-sm text-muted-foreground truncate">{t(stat.key)}</div>
                            <div className={`text-2xl sm:text-3xl font-bold mt-0.5 ${stat.tone}`}>{stat.value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div className="md:col-span-2 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/70" />
                            <Input 
                                placeholder={t('ckl.searchPlaceholder')} 
                                value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value) }} 
                                className="pl-10" 
                            />
                        </div>
                        <Select value={dateFilter} onValueChange={(v) => { setDateFilter(v) }}>
                            <SelectTrigger aria-label={t('ckl.dateRange')}><SelectValue placeholder={t('ckl.dateRange')} /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="today">{t('ckl.today')}</SelectItem>
                                <SelectItem value="yesterday">{t('ckl.yesterday')}</SelectItem>
                                <SelectItem value="week">{t('ckl.last7Days')}</SelectItem>
                                <SelectItem value="month">{t('ckl.last30Days')}</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={logTypeFilter} onValueChange={(v) => { setLogTypeFilter(v) }}>
                            <SelectTrigger aria-label={t('ckl.allTypes')}><SelectValue placeholder={t('ckl.allTypes')} /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('ckl.allTypes')}</SelectItem>
                                <SelectItem value="IN">{t('ckl.checkIn')}</SelectItem>
                                <SelectItem value="OUT">{t('ckl.checkOut')}</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={verificationFilter} onValueChange={(v) => { setVerificationFilter(v) }}>
                            <SelectTrigger aria-label={t('ckl.allVerifications')}><SelectValue placeholder={t('ckl.allVerifications')} /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('ckl.allVerifications')}</SelectItem>
                                <SelectItem value="photo">{t('ckl.withPhotoFilter')}</SelectItem>
                                <SelectItem value="biometric">{t('ckl.biometricOnly')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    {/* Phone: one row per record instead of an eight-column table.
                        The table scrolls rather than overflowing the page, but at
                        375px the date column alone wrapped onto four lines, so a
                        screen held barely two records. */}
                    <div className="md:hidden divide-y">
                        {filteredCheckins.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <Calendar className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                                {checkins.length === 0 ? t('ckl.noRecords') : t('ckl.noMatching')}
                            </div>
                        ) : filteredCheckins.map(checkin => (
                            <button
                                key={checkin.name}
                                type="button"
                                onClick={() => viewDetails(checkin)}
                                className="w-full text-start p-3 flex items-start gap-3 hover:bg-accent/50"
                            >
                                {checkin.photo_image ? (
                                    <img
                                        src={checkin.photo_image}
                                        alt={checkin.employee_name || checkin.employee}
                                        className="w-9 h-9 rounded-full object-cover border shrink-0"
                                    />
                                ) : (
                                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                                        <User className="w-4 h-4 text-muted-foreground" />
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-medium truncate">
                                            {checkin.employee_name || checkin.employee}
                                        </span>
                                        <span className="shrink-0">{getLogTypeBadge(checkin.log_type)}</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                                        {formatDateShort(checkin.time)} · {formatTime(checkin.time)}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1 mt-1">
                                        {checkin.photo_image && (
                                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                                <Camera className="w-3 h-3 me-1" />{t('ckl.photo')}
                                            </Badge>
                                        )}
                                        {checkin.biometric_verified === 1 && (
                                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                                <Fingerprint className="w-3 h-3 me-1" />
                                                {checkin.biometric_type || t('ckl.bio_short')}
                                            </Badge>
                                        )}
                                        {checkin.latitude && checkin.longitude && (
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                                <MapPin className="w-3 h-3 me-1" />{t('ckl.view')}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="hidden md:block">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t('ckl.employee')}</TableHead>
                                <TableHead>{t('ckl.dateTime')}</TableHead>
                                <TableHead>{t('ckl.type')}</TableHead>
                                {showShift && <TableHead>{t('ckl.shift')}</TableHead>}
                                {showVerification && <TableHead>{t('ckl.verification')}</TableHead>}
                                {showDevice && <TableHead>{t('ckl.device')}</TableHead>}
                                <TableHead>{t('ckl.location')}</TableHead>
                                <TableHead className="text-right">{t('ckl.actions')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredCheckins.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={visibleColSpan} className="text-center py-12 text-muted-foreground">
                                        <Calendar className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                                        {checkins.length === 0 ? t('ckl.noRecords') : t('ckl.noMatching')}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredCheckins.map(checkin => (
                                    <TableRow key={checkin.name} className="hover:bg-accent/50">
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                {checkin.photo_image ? (
                                                    <img 
                                                        src={checkin.photo_image} 
                                                        alt={checkin.employee_name || checkin.employee}
                                                        className="w-10 h-10 rounded-full object-cover border-2 border-border"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                                        <User className="w-5 h-5 text-muted-foreground" />
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="font-medium">{checkin.employee_name || checkin.employee}</div>
                                                    <div className="text-xs text-muted-foreground">{checkin.employee}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div>
                                                <div className="font-medium">{hijriShort(checkin.time)}</div>
                                                <div className="text-xs text-muted-foreground">{formatDateShort(checkin.time)}</div>
                                                <div className="text-sm text-muted-foreground flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {formatTime(checkin.time)}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>{getLogTypeBadge(checkin.log_type)}</TableCell>
                                        {showShift && (
                                            <TableCell>
                                                {checkin.shift ? (
                                                    <Badge variant="outline" className="text-xs">
                                                        {checkin.shift}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted-foreground/70 text-sm">-</span>
                                                )}
                                            </TableCell>
                                        )}
                                        {showVerification && (
                                            <TableCell>
                                                <div className="flex gap-1">
                                                    {checkin.photo_image && (
                                                        <Badge variant="secondary" className="text-xs">
                                                            <Camera className="w-3 h-3 mr-1" />
                                                            {t('ckl.photo')}
                                                        </Badge>
                                                    )}
                                                    {checkin.biometric_verified === 1 && (
                                                        <Badge variant="secondary" className="text-xs">
                                                            <Fingerprint className="w-3 h-3 mr-1" />
                                                            {checkin.biometric_type || t('ckl.bio_short')}
                                                        </Badge>
                                                    )}
                                                    {!checkin.photo_image && checkin.biometric_verified !== 1 && (
                                                        <span className="text-muted-foreground/70 text-sm">-</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                        )}
                                        {showDevice && (
                                            <TableCell>
                                                <span className="text-sm text-muted-foreground">{checkin.device_id || '-'}</span>
                                            </TableCell>
                                        )}
                                        <TableCell>
                                            {checkin.latitude && checkin.longitude ? (
                                                <a 
                                                    href={`https://www.google.com/maps?q=${checkin.latitude},${checkin.longitude}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1 text-primary hover:text-primary/80 text-sm"
                                                >
                                                    <MapPin className="w-3 h-3" />
                                                    {t('ckl.view')}
                                                </a>
                                            ) : (
                                                <span className="text-muted-foreground/70 text-sm">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => viewDetails(checkin)}
                                                className="h-8 px-2"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                    </div>
                    {filteredCheckins.length > 0 && (
                        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t text-sm text-muted-foreground">
                            {isRTL
                                ? `عرض ${filteredCheckins.length} سجل`
                                : `Showing all ${filteredCheckins.length} records`}
                            {filteredCheckins.length >= FETCH_LIMIT && (
                                <span className="ms-2 text-amber-600">
                                    {isRTL
                                        ? `— هذا أقصى ${FETCH_LIMIT} سجل، ضيّق الفترة لرؤية المزيد`
                                        : `— capped at ${FETCH_LIMIT}, narrow the date range to see more`}
                                </span>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Checkin Dialog */}
            <EmployeeCheckinDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSuccess={() => loadCheckins(true)}
            />

            {/* Details Dialog */}
            <Dialog open={detailsDialog.open} onOpenChange={(open) => !open && setDetailsDialog({ open: false, checkin: null })}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{t('ckl.detailsTitle')}</DialogTitle>
                        <DialogDescription>
                            {t('ckl.detailsDescription')}
                        </DialogDescription>
                    </DialogHeader>
                    {detailsDialog.checkin && (
                        <div className="space-y-6">
                            {/* Employee & Photo */}
                            <div className="flex items-start gap-6">
                                {detailsDialog.checkin.photo_image && (
                                    <img 
                                        src={detailsDialog.checkin.photo_image} 
                                        alt={detailsDialog.checkin.employee_name || detailsDialog.checkin.employee}
                                        className="w-32 h-32 rounded-lg object-cover border-2 border-border"
                                    />
                                )}
                                <div className="flex-1 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-medium text-muted-foreground">{t('ckl.employee')}</label>
                                            <p className="text-base font-semibold">{detailsDialog.checkin.employee_name}</p>
                                            <p className="text-xs text-muted-foreground">{detailsDialog.checkin.employee}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-muted-foreground">{t('ckl.checkinType')}</label>
                                            <div className="mt-1">{getLogTypeBadge(detailsDialog.checkin.log_type)}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Time & Shift Details */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">{t('ckl.checkinTime')}</label>
                                    <p className="text-base font-semibold">{formatDateTime(detailsDialog.checkin.time)}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">{t('ckl.shift')}</label>
                                    <p className="text-base font-semibold">{detailsDialog.checkin.shift || t('ckl.na')}</p>
                                </div>
                                {detailsDialog.checkin.shift_start && (
                                    <div>
                                        <label className="text-sm font-medium text-muted-foreground">{t('ckl.shiftStart')}</label>
                                        <p className="text-base">{formatDateTime(detailsDialog.checkin.shift_start)}</p>
                                    </div>
                                )}
                                {detailsDialog.checkin.shift_end && (
                                    <div>
                                        <label className="text-sm font-medium text-muted-foreground">{t('ckl.shiftEnd')}</label>
                                        <p className="text-base">{formatDateTime(detailsDialog.checkin.shift_end)}</p>
                                    </div>
                                )}
                            </div>

                            {/* Verification Details */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">{t('ckl.checkinMethod')}</label>
                                    <p className="text-base">{detailsDialog.checkin.checkin_method || t('ckl.manual')}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">{t('ckl.device')}</label>
                                    <p className="text-base">{detailsDialog.checkin.device_id || t('ckl.na')}</p>
                                </div>
                                {detailsDialog.checkin.biometric_verified === 1 && (
                                    <>
                                        <div>
                                            <label className="text-sm font-medium text-muted-foreground">{t('ckl.biometricVerification')}</label>
                                            <Badge className="mt-1 bg-green-100 text-green-800">
                                                <Fingerprint className="w-3 h-3 mr-1" />
                                                {t('ckl.verified')}
                                            </Badge>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-muted-foreground">{t('ckl.biometricType')}</label>
                                            <p className="text-base">{detailsDialog.checkin.biometric_type || t('ckl.na')}</p>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Location Details */}
                            {(detailsDialog.checkin.latitude && detailsDialog.checkin.longitude) && (
                                <div className="space-y-3">
                                    <label className="text-sm font-medium text-muted-foreground">{t('ckl.location')}</label>
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1">
                                            <p className="text-sm">
                                                <span className="font-medium">{t('ckl.latitude')}:</span> {Number(detailsDialog.checkin.latitude).toFixed(6)}
                                            </p>
                                            <p className="text-sm">
                                                <span className="font-medium">{t('ckl.longitude')}:</span> {Number(detailsDialog.checkin.longitude).toFixed(6)}
                                            </p>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => window.open(
                                                `https://www.google.com/maps?q=${detailsDialog.checkin?.latitude},${detailsDialog.checkin?.longitude}`,
                                                '_blank'
                                            )}
                                        >
                                            <MapPin className="w-4 h-4 mr-2" />
                                            {t('ckl.viewOnMap')}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Linked Attendance */}
                            {detailsDialog.checkin.attendance && (
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">{t('ckl.linkedAttendance')}</label>
                                    <p className="text-base font-mono text-primary">{detailsDialog.checkin.attendance}</p>
                                </div>
                            )}

                            {/* Record Info */}
                            <div className="pt-4 border-t text-xs text-muted-foreground">
                                <p><span className="font-medium">{t('ckl.recordId')}:</span> {detailsDialog.checkin.name}</p>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
