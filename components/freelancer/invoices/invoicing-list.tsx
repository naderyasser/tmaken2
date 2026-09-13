/**
 * Invoicing & Payments (الفواتير والمدفوعات) — Freelancer workspace
 *
 * Section A "Ready to invoice": Accepted Sales Proposals not yet converted, with
 *   a "Convert to Invoice" action.
 * Section B "Invoices": Sales Invoices in a reusable DataTable with sorting,
 *   filtering, pagination, export, bulk actions, row actions (view / pay / PDF /
 *   edit / cancel / delete), an accurate computed status badge (incl. overdue
 *   days), and a detail side-panel showing payment history + the source proposal.
 *
 * Bilingual via inline isRTL ternaries (no lib/i18n.tsx edits).
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { frappeClient } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { formatCurrency, formatDateShort } from '@/lib/format'
import { cn } from '@/lib/utils'
import { LocalizedDateInput } from '@/components/ui/localized-date-input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/hooks/use-toast'
import {
  RefreshCw, FileText, Receipt, Loader2, AlertCircle, ArrowRight, CheckCircle2, CreditCard,
  Eye, Download, Trash2, Ban, Pencil, Bell, Copy, X, Plus,
} from 'lucide-react'
import {
  DataTable, emptyDash,
  type DataTableColumn, type DataTableRowAction, type DataTableBulkAction,
} from '@/components/freelancer/shared/data-table'
import {
  InvoiceDetailSheet, computeInvoiceStatus, invoicePrintUrl, buildReminderText, type InvoiceRow,
} from './invoice-detail-sheet'
import { ARSummary, invoiceAgingBucket } from './ar-summary'
import { NewInvoiceDialog } from './new-invoice-dialog'
import { usePersistedState } from '@/lib/freelancer/use-table-prefs'
import type { DateRange } from '@/components/freelancer/shared/date-range-filter'

interface ReadyProposal {
  name: string
  title?: string
  party_display_name?: string
  grand_total?: number
  converted_sales_invoice?: string | null
}

type ConfirmKind = 'delete' | 'cancel' | 'bulkDelete'

export function InvoicingList() {
  const { isRTL, lang } = useI18n()
  const { toast } = useToast()
  const msg = (en: string, ar: string) => (isRTL ? ar : en)

  const [ready, setReady] = useState<ReadyProposal[]>([])
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [converting, setConverting] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = usePersistedState('fl-invoices:status', 'all')
  const [bucketFilter, setBucketFilter] = usePersistedState('fl-invoices:bucket', 'all')
  const [dateRange, setDateRange] = usePersistedState<DateRange>('fl-invoices:dates', { from: '', to: '' })

  // Detail sheet
  const [detail, setDetail] = useState<InvoiceRow | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // New Invoice dialog (bill a client directly, no proposal needed)
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false)

  // Confirm (cancel / delete / bulk-delete)
  const [confirm, setConfirm] = useState<{ kind: ConfirmKind; invoice?: InvoiceRow; invoices?: InvoiceRow[] } | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  // Record Payment dialog
  const [payInvoice, setPayInvoice] = useState<InvoiceRow | null>(null)
  const [payForm, setPayForm] = useState({
    amount: '',
    mode_of_payment: '',
    reference_no: '',
    reference_date: new Date().toISOString().split('T')[0],
  })
  const [modesOfPayment, setModesOfPayment] = useState<string[]>([])
  const [recording, setRecording] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  const fmt = (amount?: number) => formatCurrency(amount ?? 0, { locale: lang, currency: 'SAR', decimals: 2 })

  const loadData = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true)
    setError(null)
    try {
      const [proposals, invs] = await Promise.all([
        frappeClient.getList<ReadyProposal>('Sales Proposal', {
          filters: [['status', '=', 'Accepted']] as any,
          fields: ['name', 'title', 'party_display_name', 'grand_total', 'converted_sales_invoice'],
          limit_page_length: 100,
        }),
        frappeClient.getList<InvoiceRow>('Sales Invoice', {
          fields: ['name', 'customer', 'customer_name', 'grand_total', 'outstanding_amount', 'status', 'posting_date', 'due_date', 'docstatus'],
          order_by: 'modified desc',
          limit_page_length: 0,
        }),
      ])
      setReady(proposals.filter((p) => !p.converted_sales_invoice))
      setInvoices(invs)
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    frappeClient
      .getList<{ name: string }>('Mode of Payment', { fields: ['name'], limit_page_length: 50 })
      .then((modes) => setModesOfPayment(modes.map((m) => m.name)))
      .catch(() => { /* optional — ignore */ })
  }, [])

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const handleConvert = async (name: string) => {
    setConverting(name)
    try {
      await frappeClient.call('base_meena.sales_proposal.api.convert_to_invoice', { name })
      toast({ title: msg('Success', 'تم بنجاح'), description: msg('Proposal converted to invoice', 'تم تحويل العرض إلى فاتورة') })
      await loadData(true)
    } catch (e: any) {
      toast({ title: msg('Error', 'خطأ'), description: e?.message || String(e), variant: 'destructive' })
    } finally {
      setConverting(null)
    }
  }

  const openDetail = (inv: InvoiceRow) => { setDetail(inv); setDetailOpen(true) }

  const copyReminder = (inv: InvoiceRow) => {
    navigator.clipboard
      ?.writeText(buildReminderText(inv, isRTL))
      .then(() => toast({ title: msg('Reminder copied', 'تم نسخ التذكير'), description: inv.name }))
      .catch(() => toast({ title: msg('Copy failed', 'فشل النسخ'), variant: 'destructive' }))
  }

  const openRecordPayment = (inv: InvoiceRow) => {
    setDetailOpen(false)
    setPayInvoice(inv)
    setPayError(null)
    setPayForm({
      amount: String(inv.outstanding_amount || ''),
      mode_of_payment: '',
      reference_no: '',
      reference_date: new Date().toISOString().split('T')[0],
    })
  }

  const handleRecordPayment = async () => {
    if (!payInvoice) return
    const amount = parseFloat(payForm.amount)
    if (isNaN(amount) || amount <= 0) {
      setPayError(msg('Enter a valid amount', 'أدخل مبلغاً صحيحاً'))
      return
    }
    setRecording(true)
    setPayError(null)
    try {
      await frappeClient.call('base_meena.sales_proposal.api.record_payment', {
        invoice: payInvoice.name,
        amount,
        mode_of_payment: payForm.mode_of_payment || undefined,
        reference_no: payForm.reference_no || undefined,
        reference_date: payForm.reference_date || undefined,
      })
      toast({ title: msg('Success', 'تم بنجاح'), description: msg('Payment recorded', 'تم تسجيل الدفعة') })
      setPayInvoice(null)
      await loadData(true)
    } catch (e: any) {
      setPayError(e?.message || String(e))
    } finally {
      setRecording(false)
    }
  }

  const runConfirm = async () => {
    if (!confirm) return
    setConfirmLoading(true)
    const snapshot = invoices // for optimistic rollback
    try {
      if (confirm.kind === 'delete' && confirm.invoice) {
        const name = confirm.invoice.name
        setInvoices((prev) => prev.filter((i) => i.name !== name)) // optimistic
        await frappeClient.delete('Sales Invoice', name)
        toast({ title: msg('Deleted', 'تم الحذف'), description: name })
      } else if (confirm.kind === 'cancel' && confirm.invoice) {
        const name = confirm.invoice.name
        setInvoices((prev) => prev.map((i) => (i.name === name ? { ...i, docstatus: 2 } : i))) // optimistic
        await frappeClient.call('frappe.client.cancel', { doctype: 'Sales Invoice', name })
        toast({ title: msg('Cancelled', 'تم الإلغاء'), description: name })
      } else if (confirm.kind === 'bulkDelete' && confirm.invoices) {
        const drafts = confirm.invoices.filter((i) => i.docstatus === 0)
        const names = new Set(drafts.map((d) => d.name))
        setInvoices((prev) => prev.filter((i) => !names.has(i.name))) // optimistic
        for (const inv of drafts) await frappeClient.delete('Sales Invoice', inv.name)
        toast({ title: msg('Deleted', 'تم الحذف'), description: msg(`${drafts.length} draft invoice(s) deleted`, `تم حذف ${drafts.length} فاتورة مسودة`) })
      }
      setConfirm(null)
      loadData(true) // reconcile with server in the background
    } catch (e: any) {
      setInvoices(snapshot) // rollback
      toast({ title: msg('Error', 'خطأ'), description: e?.message || String(e), variant: 'destructive' })
    } finally {
      setConfirmLoading(false)
    }
  }

  // -------------------------------------------------------------------------
  // DataTable config (Section B)
  // -------------------------------------------------------------------------

  const columns: DataTableColumn<InvoiceRow>[] = useMemo(() => [
    {
      id: 'name', header: msg('Invoice', 'الفاتورة'),
      cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.name}</span>,
      exportAccessor: (r) => r.name,
    },
    {
      id: 'customer', header: msg('Customer', 'العميل'),
      cell: (r) => <span className="font-medium">{emptyDash(r.customer_name || r.customer)}</span>,
      exportAccessor: (r) => r.customer_name || r.customer || '',
      sortable: true, sortAccessor: (r) => r.customer_name || r.customer || '',
    },
    {
      id: 'posting_date', header: msg('Date', 'التاريخ'),
      cell: (r) => <span className="text-sm text-muted-foreground">{emptyDash(fmtDate(r.posting_date))}</span>,
      exportAccessor: (r) => r.posting_date || '',
      sortable: true, sortAccessor: (r) => r.posting_date || '', hideOnMobile: true,
    },
    {
      id: 'due_date', header: msg('Due', 'الاستحقاق'),
      cell: (r) => <span className="text-sm text-muted-foreground">{emptyDash(fmtDate(r.due_date))}</span>,
      exportAccessor: (r) => r.due_date || '',
      sortable: true, sortAccessor: (r) => r.due_date || '', hideOnMobile: true,
    },
    {
      id: 'grand_total', header: msg('Total', 'الإجمالي'), align: 'end',
      cell: (r) => <span className="font-semibold">{fmt(r.grand_total)}</span>,
      exportAccessor: (r) => r.grand_total ?? 0,
      sortable: true, sortAccessor: (r) => r.grand_total ?? 0,
    },
    {
      id: 'outstanding_amount', header: msg('Outstanding', 'المستحق'), align: 'end',
      cell: (r) => (
        <span className={cn('font-semibold', (r.outstanding_amount ?? 0) <= 0 ? 'text-success' : 'text-red-600')}>
          {fmt(r.outstanding_amount)}
        </span>
      ),
      exportAccessor: (r) => r.outstanding_amount ?? 0,
      sortable: true, sortAccessor: (r) => r.outstanding_amount ?? 0,
    },
    {
      id: 'status', header: msg('Status', 'الحالة'),
      cell: (r) => {
        const s = computeInvoiceStatus(r, lang, isRTL)
        return <Badge className={cn('text-[10px]', s.cls)}>{s.label}</Badge>
      },
      exportAccessor: (r) => computeInvoiceStatus(r, lang, isRTL).key,
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [isRTL, lang])

  const rowActions: DataTableRowAction<InvoiceRow>[] = useMemo(() => [
    { id: 'view', label: msg('View details', 'عرض التفاصيل'), icon: Eye, onSelect: openDetail },
    {
      id: 'pay', label: msg('Record Payment', 'تسجيل دفعة'), icon: CreditCard,
      onSelect: openRecordPayment,
      hidden: (r) => (r.outstanding_amount ?? 0) <= 0 || r.docstatus !== 1,
    },
    {
      id: 'pdf', label: msg('Invoice PDF', 'فاتورة PDF'), icon: Download,
      onSelect: (r) => window.open(invoicePrintUrl(r.name), '_blank', 'noopener,noreferrer'),
    },
    {
      id: 'reminder', label: msg('Copy reminder', 'نسخ تذكير'), icon: Bell,
      onSelect: (r) => copyReminder(r),
      hidden: (r) => (r.outstanding_amount ?? 0) <= 0,
    },
    {
      id: 'edit', label: msg('Edit draft', 'تعديل المسودة'), icon: Pencil,
      onSelect: (r) => window.open(`/app/sales-invoice/${encodeURIComponent(r.name)}`, '_blank', 'noopener,noreferrer'),
      hidden: (r) => r.docstatus !== 0,
    },
    {
      id: 'cancel', label: msg('Cancel invoice', 'إلغاء الفاتورة'), icon: Ban, destructive: true, separatorBefore: true,
      onSelect: (r) => setConfirm({ kind: 'cancel', invoice: r }),
      hidden: (r) => r.docstatus !== 1 || (r.outstanding_amount ?? 0) <= 0,
    },
    {
      id: 'delete', label: msg('Delete draft', 'حذف المسودة'), icon: Trash2, destructive: true, separatorBefore: true,
      onSelect: (r) => setConfirm({ kind: 'delete', invoice: r }),
      hidden: (r) => r.docstatus !== 0,
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [isRTL])

  const bulkActions: DataTableBulkAction<InvoiceRow>[] = useMemo(() => [
    {
      id: 'bulkReminders', label: msg('Copy reminders', 'نسخ التذكيرات'), icon: Copy,
      onSelect: (rows) => {
        const due = rows.filter((r) => (r.outstanding_amount ?? 0) > 0)
        if (due.length === 0) {
          toast({ title: msg('Nothing due', 'لا مستحقات'), description: msg('Selected invoices have no outstanding balance.', 'الفواتير المحددة ليس عليها مستحقات.'), variant: 'destructive' })
          return
        }
        navigator.clipboard
          ?.writeText(due.map((r) => buildReminderText(r, isRTL)).join('\n\n———\n\n'))
          .then(() => toast({ title: msg('Reminders copied', 'تم نسخ التذكيرات'), description: msg(`${due.length} reminder(s)`, `${due.length} تذكير`) }))
          .catch(() => toast({ title: msg('Copy failed', 'فشل النسخ'), variant: 'destructive' }))
      },
    },
    {
      id: 'bulkDelete', label: msg('Delete drafts', 'حذف المسودات'), icon: Trash2, destructive: true,
      onSelect: (rows) => {
        const drafts = rows.filter((r) => r.docstatus === 0)
        if (drafts.length === 0) {
          toast({ title: msg('Nothing to delete', 'لا شيء للحذف'), description: msg('Only draft invoices can be deleted.', 'يمكن حذف الفواتير المسودة فقط.'), variant: 'destructive' })
          return
        }
        setConfirm({ kind: 'bulkDelete', invoices: rows })
      },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [isRTL])

  const statusFilterDef = useMemo(() => ({
    id: 'status', label: msg('All statuses', 'كل الحالات'), value: statusFilter, onChange: setStatusFilter,
    width: 'w-[160px]',
    options: [
      { value: 'all', label: msg('All statuses', 'كل الحالات') },
      { value: 'Paid', label: msg('Paid', 'مدفوعة') },
      { value: 'Partly Paid', label: msg('Partly Paid', 'مدفوعة جزئياً') },
      { value: 'Overdue', label: msg('Overdue', 'متأخرة') },
      { value: 'Unpaid', label: msg('Unpaid', 'غير مدفوعة') },
      { value: 'Draft', label: msg('Draft', 'مسودة') },
    ],
    predicate: (r: InvoiceRow, v: string) => computeInvoiceStatus(r, lang, isRTL).key === v,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [statusFilter, isRTL, lang])

  const bucketFilterDef = useMemo(() => ({
    id: 'bucket', label: msg('All ages', 'كل الأعمار'), value: bucketFilter, onChange: setBucketFilter,
    width: 'w-[150px]',
    options: [
      { value: 'all', label: msg('All ages', 'كل الأعمار') },
      { value: 'current', label: msg('Not due', 'غير مستحقة') },
      { value: '0-30', label: msg('0–30 days', '0–30 يوم') },
      { value: '31-60', label: msg('31–60 days', '31–60 يوم') },
      { value: '60+', label: msg('60+ days', '60+ يوم') },
    ],
    predicate: (r: InvoiceRow, v: string) => invoiceAgingBucket(r) === v,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [bucketFilter, isRTL])

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  const confirmCopy = () => {
    if (!confirm) return { title: '', description: '' }
    if (confirm.kind === 'cancel') return { title: msg('Cancel this invoice?', 'إلغاء هذه الفاتورة؟'), description: msg('The submitted invoice will be cancelled and its GL entries reversed.', 'سيتم إلغاء الفاتورة المعتمدة وعكس قيودها المحاسبية.') }
    if (confirm.kind === 'bulkDelete') {
      const n = (confirm.invoices || []).filter((i) => i.docstatus === 0).length
      return { title: msg('Delete draft invoices?', 'حذف الفواتير المسودة؟'), description: msg(`${n} draft invoice(s) will be permanently deleted. Submitted invoices are skipped.`, `سيتم حذف ${n} فاتورة مسودة نهائياً. تُتجاهل الفواتير المعتمدة.`) }
    }
    return { title: msg('Delete this draft?', 'حذف هذه المسودة؟'), description: msg('This draft invoice will be permanently deleted.', 'سيتم حذف الفاتورة المسودة نهائياً.') }
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 space-y-6">
      {/* Header */}
      <div className={cn('flex items-start justify-between gap-4', isRTL && 'flex-row-reverse')}>
        <div className={cn(isRTL && 'text-right')}>
          <h1 className="text-2xl font-bold text-gray-900">{msg('Invoicing & Payments', 'الفواتير والمدفوعات')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{msg('Convert accepted proposals and track invoices', 'تحويل العروض المقبولة ومتابعة الفواتير')}</p>
        </div>
        <div className={cn('flex items-center gap-2 flex-shrink-0', isRTL && 'flex-row-reverse')}>
          <Button size="sm" onClick={() => setNewInvoiceOpen(true)}>
            <Plus className={cn('h-4 w-4', isRTL ? 'ml-1.5' : 'mr-1.5')} />
            {msg('New Invoice', 'فاتورة جديدة')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={refreshing}>
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={() => loadData(true)}>{msg('Retry', 'إعادة المحاولة')}</Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Section A — Ready to invoice */}
      <section className="space-y-3">
        <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-gray-900">{msg('Ready to invoice', 'جاهزة للفوترة')}</h2>
          <Badge className="bg-accent text-accent-foreground text-[10px]">{ready.length}</Badge>
        </div>

        <Card className="overflow-hidden border-0 shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="text-xs font-semibold">{msg('Proposal', 'العرض')}</TableHead>
                <TableHead className="text-xs font-semibold">{msg('Client', 'العميل')}</TableHead>
                <TableHead className="text-xs font-semibold text-end">{msg('Total', 'الإجمالي')}</TableHead>
                <TableHead className="text-xs font-semibold w-40"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ready.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
                    {msg('No accepted proposals awaiting invoicing', 'لا توجد عروض مقبولة بانتظار الفوترة')}
                  </TableCell>
                </TableRow>
              ) : ready.map((p) => (
                <TableRow key={p.name} className="hover:bg-accent/40">
                  <TableCell>
                    <p className="text-sm font-medium">{p.title || p.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{p.name}</p>
                  </TableCell>
                  <TableCell className="text-sm text-gray-700">{emptyDash(p.party_display_name)}</TableCell>
                  <TableCell className="text-sm font-semibold text-end">{fmt(p.grand_total)}</TableCell>
                  <TableCell>
                    <Button size="sm" className="h-8 text-xs" onClick={() => handleConvert(p.name)} disabled={converting === p.name}>
                      {converting === p.name
                        ? <Loader2 className={cn('h-3.5 w-3.5 animate-spin', isRTL ? 'ml-1.5' : 'mr-1.5')} />
                        : <ArrowRight className={cn('h-3.5 w-3.5', isRTL ? 'ml-1.5 rotate-180' : 'mr-1.5')} />}
                      {msg('Convert to Invoice', 'تحويل إلى فاتورة')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>

      {/* Section B — Invoices */}
      <section className="space-y-3">
        <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
          <Receipt className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-gray-900">{msg('Invoices', 'الفواتير')}</h2>
          <Badge className="bg-accent text-accent-foreground text-[10px]">{invoices.length}</Badge>
        </div>

        {/* AR aging summary — cards act as bucket filters (toggle handled inside) */}
        <ARSummary
          invoices={invoices}
          isRTL={isRTL}
          lang={lang}
          activeBucket={bucketFilter}
          onSelect={(sel) => setBucketFilter(sel)}
        />

        {/* Active aging-filter chip — visible, dismissible, stays in sync with the cards + toolbar */}
        {bucketFilter !== 'all' && (
          <div className={cn('flex flex-wrap items-center gap-2', isRTL && 'flex-row-reverse')}>
            <span className="text-xs text-muted-foreground">{msg('Filtered by aging:', 'مصفّى حسب العمر:')}</span>
            <button
              type="button"
              onClick={() => setBucketFilter('all')}
              aria-label={msg('Clear aging filter', 'مسح تصفية العمر')}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {bucketFilterDef.options.find((o) => o.value === bucketFilter)?.label || bucketFilter}
              <span className="opacity-70">·</span>
              {invoices.filter((i) => invoiceAgingBucket(i) === bucketFilter).length} {msg('invoices', 'فاتورة')}
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        <DataTable<InvoiceRow>
          rows={invoices}
          columns={columns}
          getRowId={(r) => r.name}
          isRTL={isRTL}
          persistKey="fl-invoices"
          searchable
          searchAccessor={(r) => `${r.name} ${r.customer_name || ''} ${r.customer || ''}`}
          searchPlaceholder={msg('Search invoices…', 'بحث في الفواتير…')}
          filters={[statusFilterDef, bucketFilterDef]}
          dateFilter={{
            value: dateRange,
            onChange: setDateRange,
            accessor: (r) => r.posting_date,
            label: msg('Invoice date', 'تاريخ الفاتورة'),
            lang,
          }}
          rowActions={rowActions}
          bulkActions={bulkActions}
          onRowClick={openDetail}
          exportFilename={msg('invoices', 'الفواتير')}
          exportTitle={msg('Invoices', 'الفواتير')}
          emptyIcon={Receipt}
          emptyMessage={msg('No invoices found', 'لا توجد فواتير')}
        />
      </section>

      {/* Detail sheet */}
      <InvoiceDetailSheet
        invoice={detail}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        isRTL={isRTL}
        lang={lang}
        onRecordPayment={openRecordPayment}
      />

      {/* Confirm (cancel / delete / bulk delete) */}
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => { if (!o && !confirmLoading) setConfirm(null) }}
        title={confirmCopy().title}
        description={confirmCopy().description}
        confirmLabel={confirm?.kind === 'cancel' ? msg('Cancel invoice', 'إلغاء الفاتورة') : msg('Delete', 'حذف')}
        cancelLabel={msg('Back', 'رجوع')}
        onConfirm={runConfirm}
        loading={confirmLoading}
      />

      {/* Record Payment Dialog */}
      <Dialog open={!!payInvoice} onOpenChange={(open) => { if (!open && !recording) setPayInvoice(null) }}>
        <DialogContent className="max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse text-right')}>
              <CreditCard className="h-5 w-5 text-primary" />
              {msg('Record Payment', 'تسجيل دفعة')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {payInvoice && (
              <div className="bg-accent rounded-lg p-3 border border-primary/15">
                <p className="text-xs font-semibold text-accent-foreground mb-1">{msg('Linked to Invoice', 'مرتبط بفاتورة')}</p>
                <div className={cn('flex justify-between text-sm', isRTL && 'flex-row-reverse')}>
                  <span className="font-mono text-xs text-muted-foreground">{payInvoice.name}</span>
                  <span className="font-bold text-accent-foreground">{fmt(payInvoice.outstanding_amount)} {msg('outstanding', 'مستحق')}</span>
                </div>
              </div>
            )}

            {payError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{payError}</AlertDescription>
              </Alert>
            )}

            <div>
              <Label className="text-sm font-semibold">{msg('Amount (SAR)', 'المبلغ (ر.س)')} *</Label>
              <Input
                type="number" inputMode="decimal" placeholder="0.00"
                value={payForm.amount}
                onChange={(e) => setPayForm((prev) => ({ ...prev, amount: e.target.value }))}
                className="mt-1 text-lg font-bold" dir="ltr"
              />
            </div>

            <div>
              <Label className="text-sm font-semibold">{msg('Mode of Payment', 'طريقة الدفع')}</Label>
              <Select value={payForm.mode_of_payment} onValueChange={(v) => setPayForm((prev) => ({ ...prev, mode_of_payment: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={msg('Select mode', 'اختر طريقة الدفع')} /></SelectTrigger>
                <SelectContent>
                  {modesOfPayment.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-semibold">{msg('Reference No', 'رقم المرجع')}</Label>
                <Input
                  placeholder={msg('Cheque/Transfer #', 'رقم الشيك/التحويل')}
                  value={payForm.reference_no}
                  onChange={(e) => setPayForm((prev) => ({ ...prev, reference_no: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-semibold">{msg('Reference Date', 'تاريخ المرجع')}</Label>
                <LocalizedDateInput
                  locale={lang}
                  value={payForm.reference_date}
                  onChange={(iso) => setPayForm((prev) => ({ ...prev, reference_date: iso }))}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPayInvoice(null)} disabled={recording}>{msg('Cancel', 'إلغاء')}</Button>
            <Button onClick={handleRecordPayment} disabled={recording}>
              {recording ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CreditCard className="h-4 w-4 mr-1" />}
              {recording ? msg('Recording…', 'جاري التسجيل...') : msg('Record Payment', 'تسجيل الدفعة')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Invoice dialog — create a Sales Invoice directly (no proposal) */}
      <NewInvoiceDialog
        open={newInvoiceOpen}
        onOpenChange={setNewInvoiceOpen}
        onCreated={() => loadData(true)}
      />
    </div>
  )
}

// Module-level date formatter so column defs can use it.
function fmtDate(v?: string): string {
  return (v ? formatDateShort(v) : '') || ''
}
