'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
    RefreshCw, Plus, FileText, Pencil, Link2, Download, Copy, Trash2, Eye, ArrowRight, Send, Tag, Loader2,
} from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useI18n } from '@/lib/i18n'
import { formatCurrency, formatDateShort } from '@/lib/format'
import { translateEnum } from '@/lib/enums'
import {
    DataTable, emptyDash, type DataTableColumn, type DataTableRowAction,
} from '@/components/freelancer/shared/data-table'
import { usePersistedState } from '@/lib/freelancer/use-table-prefs'
import { showUndoToast } from '@/lib/freelancer/undo-toast'
import { DataQualityFlags, missingFlags } from '@/components/freelancer/shared/data-quality-flags'
import type { DateRange } from '@/components/freelancer/shared/date-range-filter'
import { ProposalBuilder } from './proposal-builder'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProposalRecord {
    name: string
    title?: string
    proposal_to?: string
    party_name?: string
    party_display_name?: string
    company?: string
    currency?: string
    transaction_date?: string
    valid_till?: string
    status?: string
    grand_total?: number
    total?: number
    is_signed?: 0 | 1 | boolean
    public_token?: string
    view_count?: number
    first_viewed_on?: string
    last_viewed_on?: string
    converted_sales_invoice?: string | null
}

// ---------------------------------------------------------------------------
// Constants — backend values stay English; Arabic is display-only
// ---------------------------------------------------------------------------

export const PROPOSAL_STATUSES = ['Draft', 'Sent', 'Open', 'Accepted', 'Rejected', 'Expired']

export const STATUS_AR: Record<string, string> = {
    'Draft': 'مسودة',
    'Sent': 'مُرسل',
    'Open': 'مفتوح',
    'Accepted': 'مقبول',
    'Rejected': 'مرفوض',
    'Expired': 'منتهي',
}

const STATUS_STYLES: Record<string, string> = {
    'Draft': 'bg-slate-100 text-slate-600',
    'Sent': 'bg-blue-100 text-blue-700',
    'Open': 'bg-cyan-100 text-cyan-700',
    'Accepted': 'bg-green-100 text-green-800',
    'Rejected': 'bg-red-100 text-red-800',
    'Expired': 'bg-amber-100 text-amber-800',
}

// ---------------------------------------------------------------------------
// PDF helper (shared with builder via export)
// ---------------------------------------------------------------------------

export function proposalPdfUrl(name: string): string {
    const params = new URLSearchParams({
        doctype: 'Sales Proposal',
        name,
        format: 'Sales Proposal',
        no_letterhead: '0',
    })
    return `/api/method/frappe.utils.print_format.download_pdf?${params.toString()}`
}

// Frappe child/meta fields stripped before duplicating a record.
const META_FIELDS = [
    'name', 'parent', 'parentfield', 'parenttype', 'idx', 'docstatus',
    'creation', 'modified', 'modified_by', 'owner', '__islocal', '__unsaved',
]
function stripMeta<T extends Record<string, any>>(obj: T): Record<string, any> {
    const out: Record<string, any> = {}
    for (const [k, v] of Object.entries(obj)) {
        if (META_FIELDS.includes(k)) continue
        out[k] = Array.isArray(v) ? v.map((row) => (row && typeof row === 'object' ? stripMeta(row) : row)) : v
    }
    return out
}

const todayISO = () => new Date().toISOString().slice(0, 10)

// A proposal is effectively expired when its status says so, or its valid_till
// has passed and it isn't already won/lost.
function isExpiredRow(r: ProposalRecord): boolean {
    if (r.status === 'Expired') return true
    if (!r.valid_till) return false
    if (r.status === 'Accepted' || r.status === 'Rejected') return false
    return r.valid_till.slice(0, 10) < todayISO()
}
function expiresInDays(r: ProposalRecord): number | null {
    if (!r.valid_till) return null
    const ms = new Date(r.valid_till.slice(0, 10)).getTime() - new Date(todayISO()).getTime()
    return Math.round(ms / 86_400_000)
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ProposalList() {
    const [records, setRecords] = useState<ProposalRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Persisted filter prefs (remembered per section across reloads)
    const [statusFilter, setStatusFilter] = usePersistedState('fl-proposals:status', 'all')
    const [dateRange, setDateRange] = usePersistedState<DateRange>('fl-proposals:dates', { from: '', to: '' })

    // Builder dialog
    const [builderOpen, setBuilderOpen] = useState(false)
    const [editingName, setEditingName] = useState<string | null>(null)

    // Per-row async busy + delete confirmation + bulk status dialog
    const [busy, setBusy] = useState(false)
    const [confirm, setConfirm] = useState<{ rows: ProposalRecord[]; bulk: boolean } | null>(null)
    const [deleting, setDeleting] = useState(false)
    const [statusChange, setStatusChange] = useState<{ rows: ProposalRecord[]; value: string } | null>(null)
    const [applyingStatus, setApplyingStatus] = useState(false)

    const { toast } = useToast()
    const { isRTL, lang } = useI18n()
    const msg = (en: string, ar: string) => (isRTL ? ar : en)

    // ---------------------------------------------------------------------------
    // Data loading
    // ---------------------------------------------------------------------------

    const loadRecords = useCallback(async (showRefresh = false) => {
        try {
            if (showRefresh) setRefreshing(true)
            else setLoading(true)
            setError(null)

            const res = await frappeClient.call<ProposalRecord[]>(
                'base_meena.sales_proposal.api.get_proposals',
                { filters: {} }
            )
            setRecords(res?.message || [])
        } catch (err: any) {
            console.error('Failed to load proposals:', err)
            setError(err?.message || msg('Failed to load sales proposals.', 'فشل تحميل عروض المبيعات.'))
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => { loadRecords() }, [loadRecords])

    // ---------------------------------------------------------------------------
    // Stats
    // ---------------------------------------------------------------------------

    const stats = useMemo(() => {
        const by = (s: string) => records.filter(r => r.status === s).length
        return {
            total: records.length,
            draft: by('Draft'),
            sent: by('Sent') + by('Open'),
            accepted: by('Accepted'),
        }
    }, [records])

    // ---------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------

    const formatMoney = (v?: number, currency?: string) =>
        v != null ? formatCurrency(v, { locale: lang, currency: currency || 'SAR' }) : '—'

    const isViewed = (record: ProposalRecord) =>
        (record.view_count ?? 0) > 0 || record.status === 'Open'

    const rowFlags = (r: ProposalRecord) => missingFlags([
        { key: 'party', label: msg('client', 'العميل'), missing: !(r.party_display_name || r.party_name) },
        { key: 'valid_till', label: msg('valid till', 'تاريخ الصلاحية'), missing: !r.valid_till },
    ])

    // ---------------------------------------------------------------------------
    // Actions
    // ---------------------------------------------------------------------------

    const openCreate = () => { setEditingName(null); setBuilderOpen(true) }
    const openEdit = (record: ProposalRecord) => { setEditingName(record.name); setBuilderOpen(true) }

    const handleCopyLink = async (record: ProposalRecord) => {
        try {
            const res = await frappeClient.call<{ token: string; path: string }>(
                'base_meena.sales_proposal.api.generate_public_link',
                { name: record.name }
            )
            const path = res?.message?.path
            if (!path) throw new Error(msg('No link returned.', 'لم يتم إرجاع رابط.'))
            const fullUrl = window.location.origin + path
            await navigator.clipboard.writeText(fullUrl)
            toast({ title: msg('Link copied', 'تم نسخ الرابط'), description: fullUrl })
        } catch (err: any) {
            toast({
                title: msg('Error', 'خطأ'),
                description: err?.message || msg('Failed to generate public link.', 'فشل إنشاء الرابط العام.'),
                variant: 'destructive',
            })
        }
    }

    const handleDownloadPdf = (record: ProposalRecord) => {
        window.open(proposalPdfUrl(record.name), '_blank', 'noopener,noreferrer')
    }

    // Mark a draft as Sent (mints a public token server-side), optimistic.
    const handleSend = async (record: ProposalRecord) => {
        const prevStatus = record.status
        setBusy(true)
        setRecords((rs) => rs.map((r) => (r.name === record.name ? { ...r, status: 'Sent' } : r)))
        try {
            await frappeClient.call('base_meena.sales_proposal.api.send_proposal', { name: record.name })
            toast({ title: msg('Marked as sent', 'تم وضع علامة مُرسل'), description: record.title || record.name })
            await loadRecords(true)
        } catch (err: any) {
            setRecords((rs) => rs.map((r) => (r.name === record.name ? { ...r, status: prevStatus } : r)))
            toast({ title: msg('Error', 'خطأ'), description: err?.message || msg('Failed to send.', 'فشل الإرسال.'), variant: 'destructive' })
        } finally {
            setBusy(false)
        }
    }

    const handleDuplicate = async (record: ProposalRecord) => {
        setBusy(true)
        try {
            const full = (await frappeClient.call<Record<string, any>>(
                'base_meena.sales_proposal.api.get_proposal', { name: record.name }
            ))?.message
            if (!full) throw new Error(msg('Could not load the proposal.', 'تعذّر تحميل العرض.'))

            const payload = stripMeta(full)
            // Reset lifecycle / engagement / conversion state on the copy.
            payload.status = 'Draft'
            payload.is_signed = 0
            payload.public_token = null
            payload.view_count = 0
            payload.first_viewed_on = null
            payload.last_viewed_on = null
            payload.converted_sales_invoice = null
            payload.converted_quotation = null
            payload.title = (isRTL ? 'نسخة من ' : 'Copy of ') + (full.title || record.name)

            const created = (await frappeClient.call<{ name?: string }>(
                'base_meena.sales_proposal.api.create_proposal', { payload }
            ))?.message
            toast({
                title: msg('Proposal duplicated', 'تم نسخ العرض'),
                description: created?.name || payload.title,
            })
            await loadRecords(true)
        } catch (err: any) {
            toast({
                title: msg('Error', 'خطأ'),
                description: err?.message || msg('Failed to duplicate proposal.', 'فشل نسخ العرض.'),
                variant: 'destructive',
            })
        } finally {
            setBusy(false)
        }
    }

    const handleConvert = async (record: ProposalRecord) => {
        setBusy(true)
        try {
            const res = (await frappeClient.call<{ invoice?: string }>(
                'base_meena.sales_proposal.api.convert_to_invoice', { name: record.name }
            ))?.message
            toast({
                title: msg('Converted to invoice', 'تم التحويل إلى فاتورة'),
                description: res?.invoice || '',
            })
            await loadRecords(true)
        } catch (err: any) {
            toast({
                title: msg('Error', 'خطأ'),
                description: err?.message || msg('Failed to convert to invoice.', 'فشل التحويل إلى فاتورة.'),
                variant: 'destructive',
            })
        } finally {
            setBusy(false)
        }
    }

    // Optimistic delete with rollback-via-reload on failure.
    const performDelete = async () => {
        if (!confirm) return
        const rows = confirm.rows
        const snapshot = records
        setDeleting(true)
        setRecords((rs) => rs.filter((r) => !rows.some((x) => x.name === r.name)))
        let ok = 0
        let failMsg = ''
        for (const r of rows) {
            try {
                await frappeClient.delete('Sales Proposal', r.name)
                ok++
            } catch (err: any) {
                failMsg = err?.message || String(err)
            }
        }
        setDeleting(false)
        setConfirm(null)
        if (failMsg) {
            setRecords(snapshot)
            toast({ title: msg('Some deletions failed', 'تعذّر حذف بعضها'), description: failMsg, variant: 'destructive' })
            await loadRecords(true)
        } else if (ok > 0) {
            toast({
                title: msg('Deleted', 'تم الحذف'),
                description: confirm.bulk ? msg(`${ok} proposal(s) deleted`, `تم حذف ${ok} عرض`) : undefined,
            })
        }
    }

    // Bulk status change with optimistic update + Undo toast that restores.
    const undoStatus = async (prev: { name: string; status?: string }[]) => {
        setRecords((rs) => rs.map((r) => {
            const p = prev.find((x) => x.name === r.name)
            return p ? { ...r, status: p.status } : r
        }))
        for (const p of prev) {
            try {
                await frappeClient.call('base_meena.sales_proposal.api.update_proposal', { name: p.name, payload: { status: p.status } })
            } catch { /* best-effort restore */ }
        }
    }

    const applyBulkStatus = async (rows: ProposalRecord[], newStatus: string) => {
        const prev = rows.map((r) => ({ name: r.name, status: r.status }))
        setApplyingStatus(true)
        setRecords((rs) => rs.map((r) => (prev.some((p) => p.name === r.name) ? { ...r, status: newStatus } : r)))
        let ok = 0
        let failMsg = ''
        for (const r of rows) {
            try {
                await frappeClient.call('base_meena.sales_proposal.api.update_proposal', { name: r.name, payload: { status: newStatus } })
                ok++
            } catch (err: any) {
                failMsg = err?.message || String(err)
            }
        }
        setApplyingStatus(false)
        setStatusChange(null)
        if (failMsg) {
            toast({ title: msg('Some updates failed', 'تعذّر تحديث بعضها'), description: failMsg, variant: 'destructive' })
            await loadRecords(true)
            return
        }
        showUndoToast(toast, {
            title: msg('Status updated', 'تم تحديث الحالة'),
            description: msg(
                `${ok} → ${translateEnum('proposalStatus', newStatus, lang)}`,
                `${ok} → ${translateEnum('proposalStatus', newStatus, lang)}`,
            ),
            undoLabel: msg('Undo', 'تراجع'),
            onUndo: () => undoStatus(prev),
        })
    }

    // ---------------------------------------------------------------------------
    // Table config
    // ---------------------------------------------------------------------------

    const columns: DataTableColumn<ProposalRecord>[] = [
        {
            id: 'title',
            header: msg('Title', 'العنوان'),
            sortable: true,
            sortAccessor: (r) => (r.title || r.name).toLowerCase(),
            exportAccessor: (r) => r.title || r.name,
            cell: (r) => (
                <div className="flex items-start gap-2">
                    <div>
                        <div className="font-medium">{r.title || r.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{r.name}</div>
                    </div>
                    <DataQualityFlags flags={rowFlags(r)} isRTL={isRTL} />
                </div>
            ),
        },
        {
            id: 'client',
            header: msg('Client', 'العميل'),
            // Keep the header/cells from collapsing between the wide Title and
            // Date columns (esp. with long RTL titles) — the column used to
            // render visually empty when squeezed.
            headerClassName: 'whitespace-nowrap min-w-[140px]',
            className: 'min-w-[140px]',
            exportAccessor: (r) => r.party_display_name || r.party_name || '',
            cell: (r) => (
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {(r.party_display_name || r.party_name)
                        ? (r.party_display_name || r.party_name)
                        : <span className="text-muted-foreground/70 italic">{msg('No client', 'بدون عميل')}</span>}
                </span>
            ),
        },
        {
            id: 'date',
            header: msg('Date', 'التاريخ'),
            sortable: true,
            sortAccessor: (r) => r.transaction_date || '',
            exportAccessor: (r) => formatDateShort(r.transaction_date),
            cell: (r) => <span className="text-sm text-muted-foreground">{emptyDash(formatDateShort(r.transaction_date))}</span>,
        },
        {
            id: 'total',
            header: msg('Grand Total', 'الإجمالي'),
            align: 'end',
            sortable: true,
            sortAccessor: (r) => r.grand_total ?? r.total ?? 0,
            exportAccessor: (r) => r.grand_total ?? r.total ?? 0,
            cell: (r) => <span className="text-sm font-semibold">{formatMoney(r.grand_total ?? r.total, r.currency)}</span>,
        },
        {
            id: 'status',
            header: msg('Status', 'الحالة'),
            sortable: true,
            sortAccessor: (r) => r.status || '',
            exportAccessor: (r) => translateEnum('proposalStatus', r.status, lang) + (isExpiredRow(r) && r.status !== 'Expired' ? ` (${msg('expired', 'منتهي')})` : ''),
            cell: (r) => {
                const expired = isExpiredRow(r)
                const dleft = expiresInDays(r)
                const soon = !expired && dleft != null && dleft >= 0 && dleft <= 7 && r.status !== 'Accepted' && r.status !== 'Rejected'
                return (
                    <div className="flex flex-col items-start gap-1">
                        <Badge className={`text-xs ${STATUS_STYLES[r.status || ''] ?? 'bg-gray-100 text-gray-700'}`}>
                            {translateEnum('proposalStatus', r.status, lang)}
                        </Badge>
                        {expired && r.status !== 'Expired' && (
                            <Badge className="text-[10px] bg-amber-100 text-amber-800">{msg('Expired', 'منتهي')}</Badge>
                        )}
                        {soon && (
                            <span className="text-[10px] text-amber-600">
                                {msg(`Expires in ${dleft}d`, `تنتهي خلال ${dleft} يوم`)}
                            </span>
                        )}
                    </div>
                )
            },
        },
        {
            id: 'engagement',
            header: msg('Engagement', 'التفاعل'),
            exportAccessor: (r) => (isViewed(r) ? `${msg('Viewed', 'مُشاهَد')} (${r.view_count ?? 0})` : msg('Not viewed', 'لم تُشاهَد')),
            cell: (r) => isViewed(r) ? (
                <div className="flex flex-col gap-1">
                    <Badge className="w-fit gap-1 bg-primary/10 text-primary text-xs">
                        <Eye className="h-3 w-3" />
                        {msg('Viewed', 'مُشاهَد')}{(r.view_count ?? 0) > 0 ? ` · ${r.view_count}` : ''}
                    </Badge>
                    {formatDateShort(r.first_viewed_on) && (
                        <span className="text-[11px] text-muted-foreground">
                            {msg('First: ', 'أول مشاهدة: ')}{formatDateShort(r.first_viewed_on)}
                        </span>
                    )}
                </div>
            ) : (
                <span className="text-xs text-muted-foreground">{msg('Not viewed', 'لم تُشاهَد')}</span>
            ),
        },
    ]

    const rowActions: DataTableRowAction<ProposalRecord>[] = [
        { id: 'edit', label: msg('Edit', 'تعديل'), icon: Pencil, onSelect: openEdit },
        { id: 'duplicate', label: msg('Duplicate', 'نسخ'), icon: Copy, onSelect: handleDuplicate },
        {
            id: 'send', label: msg('Mark as sent', 'وضع علامة مُرسل'), icon: Send, onSelect: handleSend,
            hidden: (r) => r.status !== 'Draft',
        },
        {
            id: 'convert',
            label: msg('Convert to Invoice', 'تحويل إلى فاتورة'),
            icon: ArrowRight,
            onSelect: handleConvert,
            hidden: (r) => r.status !== 'Accepted' || !!r.converted_sales_invoice,
        },
        { id: 'link', label: msg('Copy public link', 'نسخ الرابط العام'), icon: Link2, onSelect: handleCopyLink },
        { id: 'pdf', label: msg('Download PDF', 'تنزيل PDF'), icon: Download, onSelect: handleDownloadPdf },
        {
            id: 'delete', label: msg('Delete', 'حذف'), icon: Trash2, destructive: true, separatorBefore: true,
            onSelect: (r) => setConfirm({ rows: [r], bulk: false }),
        },
    ]

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-12 w-full" />
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
                </div>
                <Skeleton className="h-64 w-full" />
            </div>
        )
    }

    return (
        <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
                        {isRTL ? 'عروض المبيعات' : 'Sales Proposals'}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {isRTL ? 'إنشاء وإدارة عروض المبيعات والعائد على الاستثمار' : 'Create and manage sales proposals and ROI offers'}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => loadRecords(true)} disabled={refreshing || busy}>
                        <RefreshCw className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'} ${refreshing ? 'animate-spin' : ''}`} />
                        {isRTL ? 'تحديث' : 'Refresh'}
                    </Button>
                    <Button size="sm" onClick={openCreate}>
                        <Plus className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                        {isRTL ? 'عرض جديد' : 'New Proposal'}
                    </Button>
                </div>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                    { label: isRTL ? 'الإجمالي' : 'Total', value: stats.total, bg: 'bg-primary/10', icon: 'text-primary', color: 'text-primary' },
                    { label: isRTL ? 'مسودة' : 'Draft', value: stats.draft, bg: 'bg-slate-100', icon: 'text-slate-600', color: 'text-slate-700' },
                    { label: isRTL ? 'مُرسل / مفتوح' : 'Sent / Open', value: stats.sent, bg: 'bg-primary/10', icon: 'text-primary', color: 'text-primary' },
                    { label: isRTL ? 'مقبول' : 'Accepted', value: stats.accepted, bg: 'bg-primary/10', icon: 'text-primary', color: 'text-primary' },
                ].map(({ label, value, bg, icon, color }) => (
                    <Card key={label}>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 ${bg} rounded-lg`}><FileText className={`h-5 w-5 ${icon}`} /></div>
                                <div>
                                    <p className="text-sm text-muted-foreground">{label}</p>
                                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Table */}
            <DataTable<ProposalRecord>
                rows={records}
                getRowId={(r) => r.name}
                isRTL={isRTL}
                error={error}
                onRetry={() => loadRecords()}
                persistKey="fl-proposals"
                columns={columns}
                searchable
                searchAccessor={(r) => `${r.title || ''} ${r.party_display_name || ''} ${r.party_name || ''} ${r.name}`}
                searchPlaceholder={isRTL ? 'بحث بالعنوان أو العميل...' : 'Search by title or client...'}
                filters={[
                    {
                        id: 'status',
                        label: isRTL ? 'كل الحالات' : 'All statuses',
                        value: statusFilter,
                        onChange: setStatusFilter,
                        width: 'w-[160px]',
                        options: [
                            { value: 'all', label: isRTL ? 'كل الحالات' : 'All statuses' },
                            ...PROPOSAL_STATUSES.map((s) => ({ value: s, label: translateEnum('proposalStatus', s, lang) })),
                        ],
                        predicate: (r: ProposalRecord, v) => r.status === v,
                    },
                ]}
                dateFilter={{
                    value: dateRange,
                    onChange: setDateRange,
                    accessor: (r) => r.transaction_date,
                    label: isRTL ? 'تاريخ العرض' : 'Proposal date',
                    lang,
                }}
                rowActions={rowActions}
                bulkActions={[
                    {
                        id: 'bulk-status', label: isRTL ? 'تغيير الحالة' : 'Change status', icon: Tag,
                        onSelect: (rows) => setStatusChange({ rows, value: '' }),
                    },
                    {
                        id: 'bulk-delete', label: isRTL ? 'حذف المحدد' : 'Delete selected', icon: Trash2, destructive: true,
                        onSelect: (rows) => setConfirm({ rows, bulk: true }),
                    },
                ]}
                exportFilename="proposals"
                exportTitle={isRTL ? 'عروض المبيعات' : 'Sales Proposals'}
                emptyMessage={isRTL ? 'لا توجد عروض مسجلة' : 'No proposals found'}
            />

            {/* Builder dialog */}
            <ProposalBuilder
                open={builderOpen}
                onOpenChange={setBuilderOpen}
                editingName={editingName}
                onSaved={() => loadRecords(true)}
            />

            {/* Bulk status-change dialog */}
            <Dialog open={!!statusChange} onOpenChange={(o) => { if (!o && !applyingStatus) setStatusChange(null) }}>
                <DialogContent className="max-w-sm" dir={isRTL ? 'rtl' : 'ltr'}>
                    <DialogHeader>
                        <DialogTitle>{msg('Change status', 'تغيير الحالة')}</DialogTitle>
                        <DialogDescription>
                            {msg(
                                `Apply a new status to ${statusChange?.rows.length ?? 0} proposal(s).`,
                                `تطبيق حالة جديدة على ${statusChange?.rows.length ?? 0} عرض.`,
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <Select
                        value={statusChange?.value || ''}
                        onValueChange={(v) => setStatusChange((s) => (s ? { ...s, value: v } : s))}
                    >
                        <SelectTrigger><SelectValue placeholder={msg('Select status', 'اختر الحالة')} /></SelectTrigger>
                        <SelectContent>
                            {PROPOSAL_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>{translateEnum('proposalStatus', s, lang)}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setStatusChange(null)} disabled={applyingStatus}>
                            {msg('Cancel', 'إلغاء')}
                        </Button>
                        <Button
                            disabled={!statusChange?.value || applyingStatus}
                            onClick={() => statusChange?.value && applyBulkStatus(statusChange.rows, statusChange.value)}
                        >
                            {applyingStatus
                                ? <Loader2 className={`h-4 w-4 animate-spin ${isRTL ? 'ml-1.5' : 'mr-1.5'}`} />
                                : null}
                            {msg('Apply', 'تطبيق')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirmation */}
            <ConfirmDialog
                open={!!confirm}
                onOpenChange={(o) => { if (!o && !deleting) setConfirm(null) }}
                title={confirm?.bulk
                    ? msg(`Delete ${confirm.rows.length} proposals?`, `حذف ${confirm?.rows.length} عرض؟`)
                    : msg('Delete this proposal?', 'حذف هذا العرض؟')}
                description={msg('This action cannot be undone.', 'لا يمكن التراجع عن هذا الإجراء.')}
                confirmLabel={msg('Delete', 'حذف')}
                cancelLabel={msg('Cancel', 'إلغاء')}
                loading={deleting}
                onConfirm={performDelete}
            />
        </div>
    )
}
