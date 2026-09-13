'use client'

/**
 * Invoice detail side-panel + shared invoice helpers.
 *
 * Helpers (computeInvoiceStatus / STATUS_STYLES / invoicePrintUrl / buildReminderText / InvoiceRow) live
 * here and are imported by invoicing-list.tsx, so the dependency is one-directional
 * (list → sheet) with no import cycle.
 */

import { useEffect, useState } from 'react'
import {
  Receipt, CreditCard, Download, Loader2, FileText, User, CalendarDays, AlertCircle, Wallet,
  Copy, Mail,
} from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatDateShort } from '@/lib/format'
import { translateEnum } from '@/lib/enums'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'

// ---------------------------------------------------------------------------
// Shared types & helpers
// ---------------------------------------------------------------------------

export interface InvoiceRow {
  name: string
  customer?: string
  customer_name?: string
  grand_total?: number
  outstanding_amount?: number
  status?: string
  posting_date?: string
  due_date?: string
  docstatus?: number
}

export const STATUS_STYLES: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-700',
  Submitted: 'bg-blue-100 text-blue-700',
  Unpaid: 'bg-amber-100 text-amber-700',
  Paid: 'bg-emerald-100 text-emerald-700',
  Overdue: 'bg-red-100 text-red-700',
  Cancelled: 'bg-gray-100 text-gray-500',
  Return: 'bg-orange-100 text-orange-700',
  'Credit Note Issued': 'bg-purple-100 text-purple-700',
  'Partly Paid': 'bg-amber-100 text-amber-700',
}

export interface ComputedStatus {
  /** Stable key for filtering (Paid / Partly Paid / Overdue / Unpaid / Draft / Cancelled). */
  key: string
  /** Localized label, including overdue-days suffix. */
  label: string
  cls: string
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

function daysSince(dateISO: string): number {
  const ms = Date.parse(todayISO()) - Date.parse(dateISO)
  return Math.max(0, Math.floor(ms / 86_400_000))
}

/**
 * Derive an accurate status badge from the live amounts/dates rather than the
 * stored ERPNext status (which is what made unpaid invoices wrongly show
 * "Overdue"). Submitted invoices only.
 */
export function computeInvoiceStatus(inv: InvoiceRow, lang: 'ar' | 'en', isRTL: boolean): ComputedStatus {
  const outstanding = inv.outstanding_amount ?? 0
  const total = inv.grand_total ?? 0

  if (inv.docstatus === 0) return { key: 'Draft', label: translateEnum('invoiceStatus', 'Draft', lang), cls: STATUS_STYLES.Draft }
  if (inv.docstatus === 2) return { key: 'Cancelled', label: translateEnum('invoiceStatus', 'Cancelled', lang), cls: STATUS_STYLES.Cancelled }

  if (outstanding <= 0) return { key: 'Paid', label: translateEnum('invoiceStatus', 'Paid', lang), cls: STATUS_STYLES.Paid }

  // Outstanding remains → check overdue first.
  if (inv.due_date && inv.due_date < todayISO()) {
    const days = daysSince(inv.due_date)
    const base = translateEnum('invoiceStatus', 'Overdue', lang)
    return { key: 'Overdue', label: isRTL ? `${base} · ${days} يوم` : `${base} · ${days}d`, cls: STATUS_STYLES.Overdue }
  }

  if (outstanding < total) return { key: 'Partly Paid', label: translateEnum('invoiceStatus', 'Partly Paid', lang), cls: STATUS_STYLES['Partly Paid'] }

  // Full amount due, not yet overdue.
  return { key: 'Unpaid', label: translateEnum('invoiceStatus', 'Unpaid', lang), cls: STATUS_STYLES.Unpaid }
}

/**
 * Branded Arabic tax invoice. Uses the base_meena "Tax Invoice" print format
 * (present on every tenant — freelancer tenants don't have the ZATCA app/format).
 * Opened via /printview so the browser renders Arabic/RTL correctly (wkhtmltopdf
 * does not) → then Save as PDF. If a tenant lacks that format, change `format`.
 */
export function invoicePrintUrl(name: string, format = 'Tax Invoice'): string {
  // Browser-rendered print view: assets, Arabic font and the ZATCA QR all load
  // same-origin so it renders reliably. No `trigger_print`, so it opens a clean
  // formatted invoice the user can save-as-PDF / print at will — no forced OS
  // dialog. (Server-side download_pdf is intentionally avoided: wkhtmltopdf
  // can't resolve the site host in this environment — affects all formats.)
  const params = new URLSearchParams({
    doctype: 'Sales Invoice', name,
    format, no_letterhead: '0',
  })
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/printview?${params.toString()}`
}

/** Polite bilingual payment-reminder text for an outstanding invoice (manual copy / mailto). */
export function buildReminderText(inv: InvoiceRow, isRTL: boolean): string {
  const cust = inv.customer_name || inv.customer || ''
  const out = formatCurrency(inv.outstanding_amount ?? 0, { locale: isRTL ? 'ar' : 'en', currency: 'SAR', decimals: 2 })
  const due = inv.due_date ? formatDateShort(inv.due_date) : ''
  const overdue = inv.due_date && inv.due_date < todayISO() ? daysSince(inv.due_date) : 0
  if (isRTL) {
    return `السلام عليكم ${cust}،\n`
      + `نذكّركم بالفاتورة رقم ${inv.name} وعليها مبلغ مستحق ${out}`
      + (due ? `، تاريخ استحقاقها ${due}` : '')
      + (overdue ? ` (متأخرة ${overdue} يوم)` : '')
      + `.\nنأمل سداد المبلغ في أقرب وقت ممكن. شكراً لتعاونكم.`
  }
  return `Dear ${cust},\n`
    + `This is a friendly reminder for invoice ${inv.name} with an outstanding balance of ${out}`
    + (due ? `, due on ${due}` : '')
    + (overdue ? ` (${overdue} days overdue)` : '')
    + `.\nKindly arrange payment at your earliest convenience. Thank you.`
}

// ---------------------------------------------------------------------------
// Detail sheet
// ---------------------------------------------------------------------------

interface PaymentRow {
  parent: string
  allocated_amount?: number
  posting_date?: string
  mode_of_payment?: string
  docstatus?: number
}

interface LinkedProposal {
  name: string
  title?: string
  party_display_name?: string
}

interface Props {
  invoice: InvoiceRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  isRTL: boolean
  lang: 'ar' | 'en'
  onRecordPayment?: (inv: InvoiceRow) => void
}

export function InvoiceDetailSheet({ invoice, open, onOpenChange, isRTL, lang, onRecordPayment }: Props) {
  const msg = (en: string, ar: string) => (isRTL ? ar : en)
  const fmt = (n?: number) => formatCurrency(n ?? 0, { locale: lang, currency: 'SAR', decimals: 2 })
  const { toast } = useToast()

  const copyReminder = () => {
    if (!invoice) return
    navigator.clipboard
      ?.writeText(buildReminderText(invoice, isRTL))
      .then(() => toast({ title: msg('Reminder copied', 'تم نسخ التذكير'), description: invoice.name }))
      .catch(() => toast({ title: msg('Copy failed', 'فشل النسخ'), variant: 'destructive' }))
  }

  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [proposal, setProposal] = useState<LinkedProposal | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !invoice) return
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setLoadError(null)
      setPayments([])
      setProposal(null)
      try {
        // Linked proposal (the proposal this invoice was converted from).
        const props = await frappeClient
          .getList<LinkedProposal>('Sales Proposal', {
            filters: [['converted_sales_invoice', '=', invoice.name]] as any,
            fields: ['name', 'title', 'party_display_name'],
            limit_page_length: 1,
          })
          .catch(() => [] as LinkedProposal[])
        if (!cancelled && props.length) setProposal(props[0])

        // Payment history via the Payment Entry Reference child table.
        const refs = await frappeClient
          .getList<{ parent: string; allocated_amount?: number }>('Payment Entry Reference', {
            filters: [['reference_name', '=', invoice.name]] as any,
            fields: ['parent', 'allocated_amount'],
            limit_page_length: 0,
          })
          .catch(() => [] as { parent: string; allocated_amount?: number }[])

        const parents = Array.from(new Set(refs.map((r) => r.parent)))
        let entries: Record<string, { posting_date?: string; mode_of_payment?: string; docstatus?: number }> = {}
        if (parents.length) {
          const pes = await frappeClient
            .getList<{ name: string; posting_date?: string; mode_of_payment?: string; docstatus?: number }>('Payment Entry', {
              filters: [['name', 'in', parents]] as any,
              fields: ['name', 'posting_date', 'mode_of_payment', 'docstatus'],
              limit_page_length: 0,
            })
            .catch(() => [])
          entries = Object.fromEntries(pes.map((p) => [p.name, p]))
        }
        const rows: PaymentRow[] = refs
          .map((r) => ({
            parent: r.parent,
            allocated_amount: r.allocated_amount,
            posting_date: entries[r.parent]?.posting_date,
            mode_of_payment: entries[r.parent]?.mode_of_payment,
            docstatus: entries[r.parent]?.docstatus,
          }))
          .sort((a, b) => String(b.posting_date || '').localeCompare(String(a.posting_date || '')))
        if (!cancelled) setPayments(rows)
      } catch (e: any) {
        if (!cancelled) setLoadError(e?.message || String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [open, invoice])

  if (!invoice) return null
  const status = computeInvoiceStatus(invoice, lang, isRTL)
  const outstanding = invoice.outstanding_amount ?? 0
  const isPaid = outstanding <= 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isRTL ? 'left' : 'right'} className="w-full overflow-y-auto sm:max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
        <SheetHeader className={cn(isRTL && 'text-right')}>
          <SheetTitle className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
            <Receipt className="h-5 w-5 text-primary" />
            <span className="font-mono text-base">{invoice.name}</span>
          </SheetTitle>
          <SheetDescription className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
            <Badge className={cn('text-[11px]', status.cls)}>{status.label}</Badge>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 py-5">
          {/* Summary */}
          <div className="space-y-2.5 text-sm">
            <Row icon={User} label={msg('Customer', 'العميل')} isRTL={isRTL}>
              {invoice.customer_name || invoice.customer || '—'}
            </Row>
            <Row icon={CalendarDays} label={msg('Invoice date', 'تاريخ الفاتورة')} isRTL={isRTL}>
              {formatDateShort(invoice.posting_date) || '—'}
            </Row>
            <Row icon={CalendarDays} label={msg('Due date', 'تاريخ الاستحقاق')} isRTL={isRTL}>
              {formatDateShort(invoice.due_date) || '—'}
            </Row>
          </div>

          <Separator />

          {/* Amounts */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">{msg('Total', 'الإجمالي')}</p>
              <p className="mt-1 text-lg font-bold">{fmt(invoice.grand_total)}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">{msg('Outstanding', 'المستحق')}</p>
              <p className={cn('mt-1 text-lg font-bold', isPaid ? 'text-success' : 'text-red-600')}>{fmt(outstanding)}</p>
            </div>
          </div>

          {/* Linked proposal */}
          {proposal && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <p className={cn('flex items-center gap-1.5 text-xs font-semibold text-muted-foreground', isRTL && 'flex-row-reverse')}>
                  <FileText className="h-3.5 w-3.5" />
                  {msg('Source proposal', 'العرض المصدر')}
                </p>
                <div className="rounded-lg border p-3">
                  <p className="text-sm font-medium">{proposal.title || proposal.name}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{proposal.name}</p>
                  {proposal.party_display_name && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{proposal.party_display_name}</p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Payment history */}
          <Separator />
          <div className="space-y-2">
            <p className={cn('flex items-center gap-1.5 text-xs font-semibold text-muted-foreground', isRTL && 'flex-row-reverse')}>
              <Wallet className="h-3.5 w-3.5" />
              {msg('Payment history', 'سجل المدفوعات')}
            </p>

            {loading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {msg('Loading…', 'جارٍ التحميل…')}
              </div>
            ) : loadError ? (
              <div className={cn('flex items-center gap-2 py-3 text-sm text-red-600', isRTL && 'flex-row-reverse')}>
                <AlertCircle className="h-4 w-4" />
                {loadError}
              </div>
            ) : payments.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">{msg('No payments recorded yet.', 'لم تُسجَّل أي مدفوعات بعد.')}</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {payments.map((p, i) => (
                  <li key={`${p.parent}-${i}`} className={cn('flex items-center justify-between gap-3 px-3 py-2.5 text-sm', isRTL && 'flex-row-reverse')}>
                    <div className={cn('min-w-0', isRTL && 'text-right')}>
                      <p className="font-medium">{fmt(p.allocated_amount)}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {p.mode_of_payment || msg('Payment', 'دفعة')}
                        {p.docstatus === 0 ? ` · ${msg('Draft', 'مسودة')}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDateShort(p.posting_date) || '—'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Actions */}
          <Separator />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(invoicePrintUrl(invoice.name), '_blank', 'noopener,noreferrer')}
              title={msg('Download PDF (no print dialog)', 'تنزيل PDF (بدون نافذة طباعة)')}
            >
              <Download className={cn('h-4 w-4', isRTL ? 'ml-1.5' : 'mr-1.5')} />
              {msg('Invoice PDF', 'فاتورة PDF')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(invoicePrintUrl(invoice.name, 'Simplified Tax Invoice'), '_blank', 'noopener,noreferrer')}
              title={msg('Simplified tax invoice', 'فاتورة ضريبية مبسطة')}
            >
              <Receipt className={cn('h-4 w-4', isRTL ? 'ml-1.5' : 'mr-1.5')} />
              {msg('Simplified', 'مبسّطة')}
            </Button>
            {!isPaid && invoice.docstatus === 1 && onRecordPayment && (
              <Button size="sm" onClick={() => onRecordPayment(invoice)}>
                <CreditCard className={cn('h-4 w-4', isRTL ? 'ml-1.5' : 'mr-1.5')} />
                {msg('Record Payment', 'تسجيل دفعة')}
              </Button>
            )}
            {!isPaid && (
              <>
                <Button variant="outline" size="sm" onClick={copyReminder}>
                  <Copy className={cn('h-4 w-4', isRTL ? 'ml-1.5' : 'mr-1.5')} />
                  {msg('Copy reminder', 'نسخ تذكير')}
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`mailto:?subject=${encodeURIComponent(
                      msg(`Payment reminder — Invoice ${invoice.name}`, `تذكير بالدفع — فاتورة ${invoice.name}`),
                    )}&body=${encodeURIComponent(buildReminderText(invoice, isRTL))}`}
                  >
                    <Mail className={cn('h-4 w-4', isRTL ? 'ml-1.5' : 'mr-1.5')} />
                    {msg('Email draft', 'مسودة بريد')}
                  </a>
                </Button>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Row({
  icon: Icon, label, children, isRTL,
}: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode; isRTL: boolean }) {
  return (
    <div className={cn('flex items-center justify-between gap-3', isRTL && 'flex-row-reverse')}>
      <span className={cn('flex items-center gap-1.5 text-muted-foreground', isRTL && 'flex-row-reverse')}>
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <span className={cn('font-medium', isRTL && 'text-right')}>{children}</span>
    </div>
  )
}
