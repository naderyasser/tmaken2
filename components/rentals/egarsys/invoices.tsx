'use client'

// Ported from egarsys src/components/sections/invoices.tsx.
// Scope of THIS port (per the section-by-section plan):
//   • LIST view — rendered 1:1, reading the Frappe mirror via lib/rentals/invoices-data
//     (summary cards · search/status filters · report-range filters · quick-view presets ·
//     the printable report · the invoices table with document-type/status/ZATCA/WhatsApp chips).
//   • DETAIL / preview dialog — rendered 1:1 (contract header · tenant/lessor/property/contact ·
//     financial breakdown · dates · notes · related documents · ZATCA status + approved QR +
//     credit/debit-note reference), all from the mirror compat adapter.
//   • CREATE + PREVIEW (إنشاء فاتورة → معاينة قبل الإصدار) is WIRED: the final
//     «تأكيد وإصدار» saves a DRAFT `Rental Invoice` to the Frappe mirror via
//     lib/rentals/invoice-write.ts — status='draft', zatca_status='draft', NO
//     zatca_* payload, NO government submission (see the SAFETY note there).
//   • ISSUE/اعتماد (clear-to-ZATCA) / record-payment (تسجيل الدفع) / PDF /
//     print-invoice / WhatsApp / credit-debit-note / bulk actions / DELETE stay
//     GATED — buttons kept, wired to a «يُفعّل عند التحويل النهائي» toast (they
//     activate only at the final ZATCA cutover). The طباعة (browser print of the
//     on-screen list) is real.
// Mechanical changes vs the original: data fetches → adapter; zustand store →
// useRentalsShell(); @/components/ui/* → scoped ui; @/lib/* → scoped copies; the
// contract picker's SearchableSelect → the scoped <Select> (no combobox primitive
// in this shell); attachment upload is gated (mirror uses Frappe's file API).

import { useEffect, useState, useCallback, useMemo, type ReactNode } from 'react'
import {
  Search, Plus, Eye, Trash2, Loader2, Hash, User, Building2, CheckCircle2,
  Receipt, MapPin, Phone, Mail, Briefcase, Printer, FileText, Upload,
  XCircle, ShieldCheck, RefreshCw, MessageCircle, MoreHorizontal, Percent, Wallet, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { QRCodeSVG } from 'qrcode.react'

import { Card, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Skeleton } from './ui/skeleton'
import { DatePicker } from './ui/date-picker'
import { CompanyHeaderLogo } from './ui/company-header-logo'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from './ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from './ui/dropdown-menu'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select'
import PrintFooter from './print-footer'

import type { Invoice, RentalContract } from './types'
import { InvoiceStatusLabels, ContractTypeLabels, PaymentMethodLabels } from './types'
import { formatSAR, formatDate } from './format'
import { computeInvoiceTotals } from './engine/invoice-totals'
import { frequencyToPaymentsPerYear } from './engine/payment-schedule'
import { computeContractStatement } from './engine/property-statement'
import { useRentalsShell } from './store'
import { getInvoicesList } from '@/lib/rentals/invoices-data'
import { getContractsList } from '@/lib/rentals/contracts-data'
import {
  createInvoiceDraft, getInvoiceSeqContext,
  type InvoiceFormInput, type InvoiceSeqContext,
} from '@/lib/rentals/invoice-write'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type InvoiceStatusValue = 'paid' | 'unpaid' | 'overdue' | 'cancelled' | 'partial'
// PaymentMethodValue isn't exported by ./types — derive it from the label keys.
type PaymentMethodValue = 'bank_transfer' | 'platform' | 'cash' | 'deferred' | 'other'

// ── digit + Gregorian-date helpers (ported from egarsys src/components/sections/
//    invoices.tsx). The invoice form slices installment periods STRICTLY by the
//    Gregorian calendar, so only the Gregorian branches are ported (no Hijri deps). ──

/** Arabic-Indic → ASCII digits, so numeric inputs parse regardless of keyboard. */
function toAsciiDigits(s: string): string {
  return String(s ?? '').replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
}

/** Add whole months to a date (UTC), guarding non-finite / absurd offsets. */
function addMonths(date: Date, months: number): Date {
  if (!Number.isFinite(months)) return new Date(date)
  months = Math.trunc(months)
  if (Math.abs(months) > 6000) return new Date(date)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()))
}

function formatDateISO(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Subtract exactly one day (Gregorian). */
function subtractOneDay(date: Date): Date {
  const result = new Date(date)
  result.setDate(result.getDate() - 1)
  return result
}

/** Whole Gregorian months between two ISO dates (UTC). Falls back to 12 for
 *  invalid/zero/negative spans. */
function gregorianMonthsBetween(startISO: string, endISO: string): number {
  const s = new Date(startISO)
  const e = new Date(endISO)
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) return 12
  let m = (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth())
  if (e.getUTCDate() > s.getUTCDate()) m++
  return m >= 1 ? m : 12
}

/** Slice a contract into the From–To period of ONE installment using strict
 *  Gregorian month math (each installment = an exact whole number of months). The
 *  first installment starts on the contract start; the last ends on the end date. */
function sliceInstallmentPeriod(
  startISO: string,
  endISO: string,
  totalMonths: number,
  installmentNo: number,
  totalInstallments: number,
): { periodStart: string; periodEnd: string } {
  const start = new Date(startISO)
  const total = Math.max(1, totalInstallments)
  const monthsPerInstallment = totalMonths / total
  const periodStart =
    installmentNo <= 1
      ? startISO
      : formatDateISO(addMonths(start, Math.floor(monthsPerInstallment * (installmentNo - 1))))
  let periodEnd: string
  if (installmentNo >= total && endISO) {
    periodEnd = endISO
  } else {
    const nextStart = addMonths(start, Math.floor(monthsPerInstallment * installmentNo))
    periodEnd = formatDateISO(subtractOneDay(nextStart))
  }
  return { periodStart, periodEnd }
}

/** Ported from egarsys src/lib/attachments.ts (parseAttachments) — a stored value is
 *  either a JSON array of URLs or a single legacy URL string. */
function parseAttachments(value: string | null | undefined): string[] {
  if (value == null) return []
  const str = String(value).trim()
  if (!str) return []
  if (str.startsWith('[')) {
    try {
      const arr = JSON.parse(str)
      if (Array.isArray(arr)) return arr.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    } catch { /* not valid JSON — treat as one legacy file */ }
  }
  return [str]
}

/** Recalculate totalContractValue from actual contract dates — never trust stored value */
function calcTotalContractValue(annualRent: number, startDate?: string, endDate?: string, storedValue?: number): number {
  if (!startDate || !endDate) return storedValue ?? 0
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return storedValue ?? 0
  let totalMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  if (end.getDate() > start.getDate()) totalMonths++
  if (totalMonths < 1) totalMonths = 1
  return Math.round(annualRent * (totalMonths / 12))
}

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

function InvoiceStatusBadge({ status }: { status: InvoiceStatusValue }) {
  const label = InvoiceStatusLabels[status]
  const variants: Record<InvoiceStatusValue, string> = {
    paid: 'success',
    unpaid: 'warning',
    overdue: 'danger',
    cancelled: 'neutral',
    partial: 'neutral',
  }
  return (
    <Badge variant={(variants[status] || 'neutral') as never}>
      {label?.ar || status}
    </Badge>
  )
}

// «تم الإرسال عبر واتساب» delivery chip — mirrors the ZATCA ✓/✗ chip pattern in
// the status cell. Status vocabulary comes from Twilio via the status webhook.
const WHATSAPP_STATUS_AR: Record<string, { label: string; cls: string }> = {
  pending:     { label: 'واتساب: قيد الإرسال', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  queued:      { label: 'واتساب: قيد الإرسال', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  accepted:    { label: 'واتساب: قيد الإرسال', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  sending:     { label: 'واتساب: قيد الإرسال', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  sent:        { label: 'واتساب: أُرسلت', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  delivered:   { label: 'واتساب: وصلت ✓', cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  read:        { label: 'واتساب: قُرئت ✓✓', cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  failed:      { label: 'واتساب: فشل الإرسال', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  undelivered: { label: 'واتساب: فشل الإرسال', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  error:       { label: 'واتساب: فشل الإرسال', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
}

function WhatsappStatusChip({ status, sentAt }: { status?: string | null; sentAt?: string | null }) {
  if (!status) return null
  const s = WHATSAPP_STATUS_AR[status]
  if (!s) return null
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded ${s.cls}`}
      title={sentAt ? `آخر إرسال: ${formatDate(sentAt)}` : undefined}
    >
      {s.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function SummaryCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function TableSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Summary Card
// ---------------------------------------------------------------------------

interface SummaryCardProps {
  icon: ReactNode
  iconBg: string
  title: string
  value: string | number
  valueColor?: string
}

function SummaryCard({ icon, iconBg, title, value, valueColor }: SummaryCardProps) {
  return (
    <Card className="group relative overflow-hidden bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-100 dark:border-slate-800/80 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)] transition-all duration-300 hover:-translate-y-1">
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none" />
      <CardContent className="p-6 relative z-10">
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl shrink-0 shadow-inner transition-transform duration-300 group-hover:scale-105"
            style={{ background: `linear-gradient(135deg, ${iconBg}80, ${iconBg})` }}
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">{title}</p>
            <p className={`text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 tracking-tight ${valueColor || ''}`}>{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function InvoicesSection() {
  const { pendingFocus, setPendingFocus } = useRentalsShell()

  // GATED write/external flows (issue-to-ZATCA · record-payment · PDF · print ·
  // WhatsApp · credit/debit note · bulk · delete). They activate only at the final
  // ZATCA cutover — until then every trigger routes here. CREATE is NOT gated: it
  // saves a DRAFT (see openCreateForm / performSubmit below).
  const comingSoon = useCallback(() => {
    toast('يُفعّل عند التحويل النهائي')
  }, [])

  // In the mirror-backed port the delete UI is preserved but GATED (wired to comingSoon).
  const canDelete = true

  // ---- State ----
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  // Dashboard drill-down: consume a 'filter-status' deep-link SYNCHRONOUSLY at first
  // render so the very FIRST fetch is already filtered (deterministic-landing rule).
  const [statusFilter, setStatusFilter] = useState<string>(() =>
    pendingFocus?.section === 'invoices' && pendingFocus.contentType === 'filter-status' && pendingFocus.key
      ? pendingFocus.key
      : 'all',
  )
  // Report filters (client-side): issue-date range + invoice-number range.
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [invNoFrom, setInvNoFrom] = useState('')
  const [invNoTo, setInvNoTo] = useState('')
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([])

  // Dialogs
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)

  // ── CREATE (draft) + preview-before-issue ──
  const [contracts, setContracts] = useState<RentalContract[]>([])
  const contractOptions = useMemo(() => contracts.map((c) => ({
    value: c.id,
    label: `${c.contractNumber} — ${c.tenantName || c.tenantId || '—'}`,
  })), [contracts])
  const [seqCtx, setSeqCtx] = useState<InvoiceSeqContext>({ companyId: null, nextInvoiceNumber: 'INV-00000001' })
  const [formOpen, setFormOpen] = useState(false)
  // Submit opens a READ-ONLY preview; the DRAFT is created only on the second,
  // explicit «تأكيد وإصدار» from that preview.
  const [previewOpen, setPreviewOpen] = useState(false)
  // After saving a draft: a two-button confirmation (batch workflow) instead of a silent close.
  const [issuedSuccess, setIssuedSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedContract, setSelectedContract] = useState<RentalContract | null>(null)

  // Read-only documents related to the open invoice (its own attachment(s) only).
  const [relatedDocs, setRelatedDocs] = useState<{ url: string; source: 'contract' | 'invoice' }[]>([])
  const [loadingDocs] = useState(false)

  // Create-form state (mirrors egarsys's CreateFormState; only the CREATE subset is wired).
  const [formData, setFormData] = useState({
    contractId: '', installmentNo: '1', totalInstallments: '6',
    rentValue: '', vatAmount: '', servicesAmount: '0', totalValue: '',
    annualRent: '', totalContractValue: '', securityDeposit: '0',
    issueDate: '', supplyDate: '', dueDate: '', periodStart: '', periodEnd: '',
    status: 'unpaid' as string,
    paymentMethod: '' as PaymentMethodValue | '',
    paymentDate: '', referenceNumber: '', bankName: '', iban: '', bankAccountNumber: '',
    tenantBankName: '', tenantIban: '', tenantBankAccountNumber: '',
    chequeNumber: '', customPaymentMethod: '', notes: '',
  })

  // ---- Fetch Data ----
  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getInvoicesList({
        search: searchQuery || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      })
      setInvoices(data || [])
    } catch (error) {
      console.error('Error fetching invoices:', error)
      toast.error('فشلت العملية')
    } finally {
      setLoading(false)
    }
  }, [searchQuery, statusFilter])

  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  // ---- Create form: contracts list + per-company invoice_number sequence ----
  const fetchContracts = useCallback(async () => {
    try {
      const data = await getContractsList({})
      setContracts(data || [])
    } catch (error) {
      console.error('Error fetching contracts:', error)
    }
  }, [])

  useEffect(() => { fetchContracts() }, [fetchContracts])
  useEffect(() => {
    getInvoiceSeqContext().then(setSeqCtx).catch(() => {})
  }, [])

  // ---- Auto-recalculate dueDate/period when installmentNo or totalInstallments changes ----
  useEffect(() => {
    if (!selectedContract?.startDate || !selectedContract?.endDate) return
    const start = new Date(selectedContract.startDate)
    const end = new Date(selectedContract.endDate)
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return
    const rawStart = selectedContract.startDate.split('T')[0]
    const rawEnd = selectedContract.endDate.split('T')[0]
    const totalMonths = gregorianMonthsBetween(rawStart, rawEnd)
    const installmentNo = Number(formData.installmentNo) || 1
    const totalInstallments = Math.max(1, Number(formData.totalInstallments) || 1)
    const { periodStart, periodEnd } =
      sliceInstallmentPeriod(rawStart, rawEnd, totalMonths, installmentNo, totalInstallments)
    setFormData((prev) => ({ ...prev, dueDate: periodStart, periodStart, periodEnd }))
  }, [formData.installmentNo, formData.totalInstallments, selectedContract?.startDate, selectedContract?.endDate])

  // ---- Auto-calculate VAT (15%) and total when rentValue or servicesAmount changes ----
  useEffect(() => {
    const rentValue = Number(formData.rentValue) || 0
    const servicesAmount = Number(formData.servicesAmount) || 0
    const vatAmount = Math.round(rentValue * 0.15 * 100) / 100
    const totalValue = rentValue + vatAmount + servicesAmount
    setFormData((prev) => ({ ...prev, vatAmount: String(vatAmount), totalValue: String(totalValue) }))
  }, [formData.rentValue, formData.servicesAmount])

  // ---- Report filters: issue-date range + invoice-number range ----
  // Applied client-side over the already-loaded list. The "to" date is inclusive of the whole day.
  const filteredInvoices = useMemo(() => {
    const fromTime = dateFrom ? new Date(dateFrom).getTime() : null
    const toTime = dateTo ? new Date(dateTo).getTime() + 86_400_000 - 1 : null
    const noFrom = invNoFrom.trim() ? parseInt(invNoFrom.replace(/\D/g, ''), 10) : null
    const noTo = invNoTo.trim() ? parseInt(invNoTo.replace(/\D/g, ''), 10) : null
    return invoices.filter((inv) => {
      if (fromTime !== null || toTime !== null) {
        const t = inv.issueDate ? new Date(inv.issueDate).getTime() : NaN
        if (Number.isNaN(t)) return false
        if (fromTime !== null && t < fromTime) return false
        if (toTime !== null && t > toTime) return false
      }
      if (noFrom !== null || noTo !== null) {
        const n = parseInt(String(inv.invoiceNumber).replace(/\D/g, ''), 10)
        if (Number.isNaN(n)) return false
        if (noFrom !== null && n < noFrom) return false
        if (noTo !== null && n > noTo) return false
      }
      return true
    })
  }, [invoices, dateFrom, dateTo, invNoFrom, invNoTo])

  // Financial totals over EXACTLY the filtered/visible rows (WYSIWYG with the table).
  // Base totals exclude refund/credit notes AND cancelled invoices — those are surfaced
  // separately (refunds). ZATCA-compliance-sensitive; logic is in engine/invoice-totals.
  const financialTotals = useMemo(() => computeInvoiceTotals(filteredInvoices), [filteredInvoices])

  const rangeFiltersActive = Boolean(dateFrom || dateTo || invNoFrom.trim() || invNoTo.trim())
  const clearRangeFilters = useCallback(() => {
    setDateFrom('')
    setDateTo('')
    setInvNoFrom('')
    setInvNoTo('')
  }, [])

  const openDetail = useCallback((invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setDetailOpen(true)
  }, [])

  // ---- Create form helpers ----
  const resetForm = useCallback(() => {
    setFormData({
      contractId: '', installmentNo: '1', totalInstallments: '6',
      rentValue: '', vatAmount: '', servicesAmount: '0', totalValue: '',
      annualRent: '', totalContractValue: '', securityDeposit: '0',
      issueDate: '', supplyDate: '', dueDate: '', periodStart: '', periodEnd: '',
      status: 'unpaid', paymentMethod: '',
      paymentDate: '', referenceNumber: '', bankName: '', iban: '', bankAccountNumber: '',
      tenantBankName: '', tenantIban: '', tenantBankAccountNumber: '',
      chequeNumber: '', customPaymentMethod: '', notes: '',
    })
    setSelectedContract(null)
  }, [])

  const openCreateForm = useCallback(() => {
    resetForm()
    setFormOpen(true)
  }, [resetForm])

  // Contract selection → auto-fill financials + the installment period (identical
  // derivations to egarsys's handleContractChange), then best-effort pre-select the
  // NEXT installment to issue via the SAME statement engine the schedule table uses.
  const handleContractChange = useCallback((contractId: string) => {
    const contract = contracts.find((c) => c.id === contractId) || null
    setSelectedContract(contract)
    if (!contract) return

    const annualRent = contract.rentAmount
    const paymentsPerYear = frequencyToPaymentsPerYear(contract.paymentFrequency || 'quarterly')
    const rentValue = paymentsPerYear > 0 ? Math.round(annualRent / paymentsPerYear) : annualRent
    const taxPct = (contract.taxRate || 0) / 100
    const taxAmount = Math.round(rentValue * taxPct)
    const totalValue = rentValue + taxAmount

    const rawStart = (contract.startDate || '').split('T')[0]
    const rawEnd = (contract.endDate || '').split('T')[0]
    let totalMonths = 12
    if (rawStart && rawEnd) totalMonths = gregorianMonthsBetween(rawStart, rawEnd)
    if (!Number.isFinite(totalMonths) || totalMonths < 1) totalMonths = 12
    const computedTotalContractValue = Math.round(annualRent * (totalMonths / 12))

    const installmentNo = Number(formData.installmentNo) || 1
    const totalInstallments = Math.max(1, paymentsPerYear > 0
      ? Math.round(paymentsPerYear * (totalMonths / 12))
      : (Number(formData.totalInstallments) || 6))

    const { periodStart, periodEnd } =
      sliceInstallmentPeriod(rawStart, rawEnd, totalMonths, installmentNo, totalInstallments)

    const owner = contract.rentalProperty?.owner as { iban?: unknown; bankAccount?: unknown } | null | undefined
    setFormData((prev) => ({
      ...prev,
      contractId,
      installmentNo: '1',
      totalInstallments: String(totalInstallments),
      rentValue: String(rentValue),
      vatAmount: String(taxAmount),
      servicesAmount: '0',
      totalValue: String(totalValue),
      annualRent: String(annualRent),
      totalContractValue: String(computedTotalContractValue),
      securityDeposit: String(contract.securityDeposit || 0),
      dueDate: periodStart,
      periodStart,
      periodEnd,
      iban: owner?.iban ? String(owner.iban) : '',
      bankAccountNumber: owner?.bankAccount ? String(owner.bankAccount) : '',
      tenantBankName: '', tenantIban: '', tenantBankAccountNumber: '',
    }))

    // Auto-pick the next installment to issue (best-effort, race-guarded, editable).
    ;(async () => {
      try {
        const all = await getInvoicesList({})
        const existing = (all || []).filter((inv) => inv.contractId === contractId)
        const stmt = computeContractStatement(
          {
            startDate: contract.startDate || '', endDate: contract.endDate || '',
            rentAmount: contract.rentAmount, paymentFrequency: contract.paymentFrequency || 'quarterly',
            taxRate: contract.taxRate, prepaidSettled: contract.prepaidSettled,
            paidPreviously: contract.paidPreviouslyInstallments,
          },
          existing.map((inv) => ({
            installmentNo: Number(inv.installmentNo) || 0,
            documentType: (inv as { documentType?: string | null }).documentType,
            status: inv.status,
            totalValue: Number(inv.totalValue) || 0,
            vatAmount: Number(inv.vatAmount) || 0,
            paidAmount: inv.paidAmount == null ? null : Number(inv.paidAmount),
          })),
          new Date(),
        )
        if (stmt.nextDueNo == null) toast.info('تم إصدار جميع أقساط هذا العقد')
        const nextInstallmentNo = stmt.nextDueNo ?? totalInstallments
        setFormData((prev) => prev.contractId === contractId
          ? { ...prev, installmentNo: String(nextInstallmentNo) } : prev)
      } catch { /* best-effort: leave رقم القسط at its default */ }
    })()
  }, [contracts, formData.installmentNo, formData.totalInstallments])

  // The DRAFT create — called from the read-only preview's «تأكيد وإصدار». Saves a
  // draft `Rental Invoice` to the mirror (NO ZATCA / NO payment recording).
  const performSubmit = useCallback(async () => {
    try {
      setSubmitting(true)
      const payload: InvoiceFormInput = {
        contractId: formData.contractId,
        installmentNo: formData.installmentNo,
        totalInstallments: formData.totalInstallments,
        rentValue: formData.rentValue,
        vatAmount: formData.vatAmount,
        servicesAmount: formData.servicesAmount,
        totalValue: formData.totalValue,
        annualRent: formData.annualRent,
        totalContractValue: formData.totalContractValue,
        securityDeposit: formData.securityDeposit,
        issueDate: formData.issueDate,
        supplyDate: formData.supplyDate || undefined,
        dueDate: formData.dueDate,
        periodStart: formData.periodStart || formData.issueDate,
        periodEnd: formData.periodEnd || formData.dueDate,
        paymentMethod: formData.paymentMethod || undefined,
        referenceNumber: formData.referenceNumber || undefined,
        bankName: formData.bankName || undefined,
        iban: formData.iban || undefined,
        bankAccountNumber: formData.bankAccountNumber || undefined,
        tenantBankName: formData.tenantBankName || undefined,
        tenantIban: formData.tenantIban || undefined,
        tenantBankAccountNumber: formData.tenantBankAccountNumber || undefined,
        chequeNumber: formData.chequeNumber || undefined,
        customPaymentMethod: formData.customPaymentMethod || undefined,
        notes: formData.notes || undefined,
      }
      await createInvoiceDraft(payload, seqCtx)
      setPreviewOpen(false)
      setFormOpen(false)
      resetForm()
      await fetchInvoices()
      // Re-read the sequence so a second draft gets the next number.
      getInvoiceSeqContext().then(setSeqCtx).catch(() => {})
      toast.success('تم حفظ المسودة')
      setIssuedSuccess(true)
    } catch (error) {
      console.error('Error saving invoice draft:', error)
      toast.error((error as { message?: string })?.message || 'فشلت العملية')
    } finally {
      setSubmitting(false)
    }
  }, [formData, seqCtx, fetchInvoices, resetForm])

  // Submit = validate, then open the read-only preview. The draft is written only
  // after the explicit «تأكيد وإصدار» there.
  const handleSubmit = useCallback(() => {
    if (!formData.contractId || !formData.rentValue || !formData.dueDate || !formData.issueDate) return
    if (!formData.paymentMethod) { toast.error('يرجى اختيار طريقة الدفع'); return }
    if (formData.paymentMethod === 'bank_transfer' && !formData.bankAccountNumber) {
      toast.error('يرجى إدخال رقم الحساب للتحويل البنكي'); return
    }
    if (formData.paymentMethod === 'platform' && !formData.referenceNumber) {
      toast.error('يرجى إدخال رقم فاتورة المنصة'); return
    }
    if (formData.status === 'paid' && !formData.paymentDate) {
      toast.error('يرجى إدخال تاريخ التحصيل (السداد)'); return
    }
    setPreviewOpen(true)
  }, [formData])

  // Deep-link from the contracts «إصدار فاتورة» quick action (create-from-contract):
  // open the create form pre-selected to that contract, routed to the draft-create.
  useEffect(() => {
    if (!pendingFocus || pendingFocus.section !== 'invoices') return
    if (pendingFocus.contentType !== 'create-from-contract') return
    if (contracts.length === 0) return
    openCreateForm()
    handleContractChange(pendingFocus.key)
    setPendingFocus(null)
  }, [pendingFocus, contracts, openCreateForm, handleContractChange, setPendingFocus])

  // Deep-link: dashboard stat drill-down — land on the list pre-filtered to the
  // invoices behind the clicked chart segment (e.g. المتأخرة).
  useEffect(() => {
    if (!pendingFocus || pendingFocus.section !== 'invoices') return
    if (pendingFocus.contentType !== 'filter-status') return
    setStatusFilter(pendingFocus.key || 'all')
    setPendingFocus(null)
  }, [pendingFocus, setPendingFocus])

  // Deep-link: dashboard الإيرادات الشهرية bar click — land on the list filtered to the
  // clicked month's invoices (key = 'YYYY-MM'). Reuses the issue-date range filter.
  useEffect(() => {
    if (!pendingFocus || pendingFocus.section !== 'invoices') return
    if (pendingFocus.contentType !== 'filter-month') return
    const m = /^(\d{4})-(\d{2})$/.exec(pendingFocus.key || '')
    if (m) {
      const year = Number(m[1])
      const mon = Number(m[2]) // 1-based
      const lastDay = new Date(year, mon, 0).getDate()
      const pad = (n: number) => String(n).padStart(2, '0')
      setStatusFilter('all')
      setSearchInput('')
      setSearchQuery('')
      setInvNoFrom('')
      setInvNoTo('')
      setDateFrom(`${year}-${pad(mon)}-01`)
      setDateTo(`${year}-${pad(mon)}-${pad(lastDay)}`)
    }
    setPendingFocus(null)
  }, [pendingFocus, setPendingFocus])

  // Deep-link: open a specific invoice's detail when navigated from a notification
  useEffect(() => {
    if (!pendingFocus || pendingFocus.section !== 'invoices') return
    if (pendingFocus.contentType === 'create-from-contract') return // handled by the create-form effect
    if (pendingFocus.contentType === 'filter-status') return
    if (pendingFocus.contentType === 'filter-month') return
    if (invoices.length === 0) return
    const match = invoices.find(inv => String(parseInt(String(inv.invoiceNumber).replace(/\D/g, ''), 10)) === pendingFocus.key)
    if (match) {
      openDetail(match)
      setPendingFocus(null)
    }
  }, [pendingFocus, invoices, openDetail, setPendingFocus])

  // Resolve the documents to show for the open invoice: ONLY this invoice's own attachment(s).
  useEffect(() => {
    if (!detailOpen || !selectedInvoice) {
      setRelatedDocs([])
      return
    }
    setRelatedDocs(
      parseAttachments(selectedInvoice.invoiceAttachment).map((url) => ({ url, source: 'invoice' as const }))
    )
  }, [detailOpen, selectedInvoice])

  // ---------------------------------------------------------------------------
  // Render: Loading
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6" dir="rtl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SummaryCardSkeleton key={i} />
          ))}
        </div>
        <TableSkeleton />
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: Loaded
  // ---------------------------------------------------------------------------

  return (
    <div className="invoices-print-root space-y-6 p-4 md:p-6" dir="rtl">
      {/* ---- Page Title & Header ---- */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-gradient-to-r from-emerald-50/50 to-transparent dark:from-emerald-950/20 dark:border-emerald-800/30 p-6 rounded-2xl border border-emerald-100/50 dark:border-emerald-900/40">
        <div>
          <div className="flex items-center gap-3"><CompanyHeaderLogo className="h-11" /><h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">الفواتير</h1></div>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">
            إدارة فواتير الإيجار وفق نظام الفوترة الإلكترونية
          </p>
        </div>

        {/* Actions: print the current filtered list + add invoice */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => window.print()}
            variant="outline"
            className="gap-2 font-semibold whitespace-nowrap"
            title="طباعة قائمة الفواتير المعروضة"
          >
            <Printer className="h-4 w-4" />
            طباعة
          </Button>
          <Button
            onClick={openCreateForm}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 gap-2 font-semibold whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            إنشاء فاتورة
          </Button>
        </div>
      </div>

      {/* ---- Financial Summary Cards (react to the active filters) ---- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={<Receipt className="h-6 w-6 text-emerald-600" />}
          iconBg="#d1fae5"
          title="الإجمالي قبل الضريبة"
          value={formatSAR(financialTotals.baseExVat)}
        />
        <SummaryCard
          icon={<Percent className="h-6 w-6 text-blue-600" />}
          iconBg="#dbeafe"
          title="إجمالي الضريبة (ض.ق.م)"
          value={formatSAR(financialTotals.baseVat)}
          valueColor="text-blue-700 dark:text-blue-400"
        />
        <SummaryCard
          icon={<Wallet className="h-6 w-6 text-teal-600" />}
          iconBg="#ccfbf1"
          title="الإجمالي الكلي (شامل الضريبة)"
          value={formatSAR(financialTotals.baseGrand)}
          valueColor="text-teal-700 dark:text-teal-400"
        />
        <SummaryCard
          icon={<RefreshCw className="h-6 w-6 text-rose-600" />}
          iconBg="#ffe4e6"
          title="إجمالي الفواتير المستردة/الدائنة"
          value={formatSAR(financialTotals.refunds)}
          valueColor="text-rose-700 dark:text-rose-400"
        />
      </div>

      {/* ---- Filters Bar ---- */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-white dark:bg-slate-900/60 dark:border-slate-800/80 p-4 rounded-xl border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
        {/* Search */}
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pr-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus-visible:ring-emerald-500"
          />
        </div>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px] bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
            <SelectValue placeholder="جميع الحالات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            {Object.entries(InvoiceStatusLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label.ar}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ---- Report Range Filters: issue-date range + invoice-number range ---- */}
      <div className="flex flex-col lg:flex-row gap-4 lg:items-end bg-white dark:bg-slate-900/60 dark:border-slate-800/80 p-4 rounded-xl border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
        {/* Issue-date range */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">نطاق تاريخ الإصدار</span>
          <div className="flex items-center gap-2">
            <div className="w-40"><DatePicker value={dateFrom} onChange={setDateFrom} placeholder="من تاريخ" showDualDate /></div>
            <span className="text-slate-400 text-xs">—</span>
            <div className="w-40"><DatePicker value={dateTo} onChange={setDateTo} placeholder="إلى تاريخ" showDualDate /></div>
          </div>
        </div>
        {/* Invoice-number range */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">نطاق رقم الفاتورة</span>
          <div className="flex items-center gap-2">
            <Input value={invNoFrom} onChange={(e) => setInvNoFrom(e.target.value)} placeholder="من" inputMode="numeric" dir="ltr" className="w-28 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800" />
            <span className="text-slate-400 text-xs">—</span>
            <Input value={invNoTo} onChange={(e) => setInvNoTo(e.target.value)} placeholder="إلى" inputMode="numeric" dir="ltr" className="w-28 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800" />
          </div>
        </div>
        {/* Result count + clear */}
        {rangeFiltersActive && (
          <div className="flex items-center gap-3 lg:mr-auto">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{filteredInvoices.length} نتيجة</span>
            <Button variant="ghost" size="sm" onClick={clearRangeFilters} className="gap-1.5 text-slate-500 hover:text-slate-800">
              <XCircle className="h-4 w-4" />
              مسح الفلاتر
            </Button>
          </div>
        )}
      </div>

      {/* ---- Filter Presets / Saved Views ---- */}
      <div className="flex flex-wrap items-center gap-1.5 px-1 pb-1.5">
        <span className="text-[10px] font-bold text-slate-400 ml-2">مشاهدات سريعة:</span>
        {[
          { id: 'all', label: 'الكل' },
          { id: 'unpaid', label: 'غير مسددة' },
          { id: 'overdue', label: 'متأخرة السداد' },
          { id: 'paid', label: 'مسددة بالكامل' },
          { id: 'partial', label: 'مسددة جزئياً' },
        ].map(p => (
          <button
            key={p.id}
            className={`px-3.5 py-1 rounded-full text-[11px] font-bold border transition-all duration-150 cursor-pointer ${
              statusFilter === p.id
                ? 'bg-primary/10 text-primary border-primary/20 scale-105 shadow-sm'
                : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
            onClick={() => setStatusFilter(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Printable invoices summary — hidden on screen, shown only when printing.
          Prints exactly the current filtered/searched list. */}
      <style dangerouslySetInnerHTML={{ __html: `
@media print {
  body * { visibility: hidden; }
  #printable-invoices, #printable-invoices * { visibility: visible; }
  #printable-invoices { position: absolute; left: 0; top: 0; width: 100%; padding: 0; display: block; }
  .invoices-print-root > *:not(#printable-invoices) { display: none !important; }
  header, nav, aside, .no-print { display: none !important; }
  #printable-invoices thead { display: table-header-group; }
  #printable-invoices tr { page-break-inside: avoid; }
}
`}} />
      <div id="printable-invoices" className="hidden print:block" dir="rtl">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th colSpan={10} className="border-b-2 border-slate-800 pb-3 pt-0 font-normal">
                <h2 className="text-xl font-bold text-center">مختصر الفواتير{statusFilter !== 'all' ? ` — ${(InvoiceStatusLabels as Record<string, { ar: string }>)[statusFilter]?.ar || ''}` : ''}</h2>
                <p className="text-sm text-slate-500 text-center mt-1">
                  تاريخ التقرير: {new Date().toLocaleDateString('ar-SA')} | عدد الفواتير: {filteredInvoices.length}
                </p>
                <p className="text-sm font-semibold text-center mt-1">
                  الإجمالي قبل الضريبة: {formatSAR(financialTotals.baseExVat)} | إجمالي الضريبة: {formatSAR(financialTotals.baseVat)} | الإجمالي الكلي: {formatSAR(financialTotals.baseGrand)} | الفواتير المستردة/الدائنة: {formatSAR(financialTotals.refunds)}
                </p>
                {rangeFiltersActive && (
                  <p className="text-xs text-slate-500 text-center mt-1">
                    {(dateFrom || dateTo) ? `نطاق تاريخ الإصدار: ${dateFrom || '…'} ← ${dateTo || '…'}` : ''}
                    {(dateFrom || dateTo) && (invNoFrom || invNoTo) ? ' | ' : ''}
                    {(invNoFrom || invNoTo) ? `نطاق رقم الفاتورة: ${invNoFrom || '…'} ← ${invNoTo || '…'}` : ''}
                  </p>
                )}
              </th>
            </tr>
            <tr className="bg-slate-100">
              <th className="text-right p-2 border-b font-bold">#</th>
              <th className="text-right p-2 border-b font-bold">رقم الفاتورة</th>
              <th className="text-right p-2 border-b font-bold">رقم العقد</th>
              <th className="text-right p-2 border-b font-bold">المستأجر</th>
              <th className="text-right p-2 border-b font-bold">القسط</th>
              <th className="text-right p-2 border-b font-bold">قيمة الإيجار</th>
              <th className="text-right p-2 border-b font-bold">ض.ق.م</th>
              <th className="text-right p-2 border-b font-bold">الإجمالي</th>
              <th className="text-right p-2 border-b font-bold">تاريخ الاستحقاق</th>
              <th className="text-right p-2 border-b font-bold">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.map((inv, i) => (
              <tr key={inv.id} className="border-b border-slate-200">
                <td className="p-2 text-xs">{i + 1}</td>
                <td className="p-2 font-mono text-xs" dir="ltr">{inv.invoiceNumber}</td>
                <td className="p-2 font-mono text-xs" dir="ltr">{inv.contractNumber || '—'}</td>
                <td className="p-2">{inv.tenantName || inv.tenantCompanyName || '—'}</td>
                <td className="p-2 text-xs text-center">{inv.installmentNo}/{inv.totalInstallments}</td>
                <td className="p-2 text-xs">{formatSAR(inv.rentValue)}</td>
                <td className="p-2 text-xs">{formatSAR(inv.vatAmount)}</td>
                <td className="p-2 text-xs font-bold">{formatSAR(inv.totalValue)}</td>
                <td className="p-2 text-xs">{formatDate(inv.dueDate)}</td>
                <td className="p-2 text-xs">{(InvoiceStatusLabels as Record<string, { ar: string }>)[inv.status || '']?.ar || inv.status}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-bold border-t-2 border-slate-800">
              <td className="p-2 text-xs" colSpan={5}>الإجمالي (فواتير صالحة: {financialTotals.baseCount})</td>
              <td className="p-2 text-xs">{formatSAR(financialTotals.baseExVat)}</td>
              <td className="p-2 text-xs">{formatSAR(financialTotals.baseVat)}</td>
              <td className="p-2 text-xs">{formatSAR(financialTotals.baseGrand)}</td>
              <td className="p-2 text-xs" colSpan={2}></td>
            </tr>
            {financialTotals.refundsCount > 0 && (
              <tr className="font-semibold text-rose-700">
                <td className="p-2 text-xs" colSpan={5}>الفواتير المستردة/الدائنة ({financialTotals.refundsCount})</td>
                <td className="p-2 text-xs" colSpan={2}></td>
                <td className="p-2 text-xs">{formatSAR(financialTotals.refunds)}</td>
                <td className="p-2 text-xs" colSpan={2}></td>
              </tr>
            )}
          </tfoot>
        </table>
        <PrintFooter />
      </div>

      <Card className="border-slate-100 dark:border-slate-800/80 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.04)] overflow-hidden rounded-xl bg-white dark:bg-slate-900/60">
        <CardContent className="p-0">
          {filteredInvoices.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 text-center">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-primary focus:ring-primary size-4 cursor-pointer"
                        checked={filteredInvoices.length > 0 && selectedInvoiceIds.length === filteredInvoices.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedInvoiceIds(filteredInvoices.map(x => x.id))
                          } else {
                            setSelectedInvoiceIds([])
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead className="text-right whitespace-nowrap">رقم الفاتورة</TableHead>
                    <TableHead className="text-right whitespace-nowrap">رقم العقد</TableHead>
                    <TableHead className="text-right whitespace-nowrap">نوع العقد</TableHead>
                    <TableHead className="text-right whitespace-nowrap">المستأجر</TableHead>
                    <TableHead className="text-right whitespace-nowrap">القسط</TableHead>
                    <TableHead className="text-right whitespace-nowrap">قيمة الإيجار</TableHead>
                    <TableHead className="text-right whitespace-nowrap">ض.ق.م</TableHead>
                    <TableHead className="text-right whitespace-nowrap">الإجمالي</TableHead>
                    <TableHead className="text-right whitespace-nowrap">تاريخ الاستحقاق</TableHead>
                    <TableHead className="text-right whitespace-nowrap">الحالة</TableHead>
                    <TableHead className="text-right whitespace-nowrap">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow
                      key={invoice.id}
                      className={invoice.status === 'overdue' ? 'bg-red-50 hover:bg-red-100/70 dark:bg-red-950/20' : ''}
                    >
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-primary focus:ring-primary size-4 cursor-pointer"
                          checked={selectedInvoiceIds.includes(invoice.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedInvoiceIds(prev => [...prev, invoice.id])
                            } else {
                              setSelectedInvoiceIds(prev => prev.filter(id => id !== invoice.id))
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs font-medium">
                        <button onClick={() => openDetail(invoice)} className="text-blue-700 hover:underline" title="عرض تفاصيل الفاتورة" dir="ltr">
                          {invoice.invoiceNumber}
                        </button>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <button onClick={() => openDetail(invoice)} className="text-blue-700 hover:underline" title="عرض تفاصيل الفاتورة" dir="ltr">
                          {invoice.contractNumber || '—'}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Badge variant="neutral" className="text-xs">
                          {invoice.contractType ? ContractTypeLabels[invoice.contractType as keyof typeof ContractTypeLabels]?.ar || invoice.contractType : '—'}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[140px] truncate">
                        <div>
                          <button onClick={() => openDetail(invoice)} className="block max-w-full truncate text-right font-medium text-sm text-blue-700 hover:underline" title="عرض تفاصيل الفاتورة">{invoice.tenantName || '—'}</button>
                          {invoice.tenantCompanyName && (
                            <p className="text-[11px] text-muted-foreground truncate">{invoice.tenantCompanyName}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {invoice.installmentNo}/{invoice.totalInstallments}
                      </TableCell>
                      <TableCell className="font-medium text-sm tabular-nums whitespace-nowrap">{formatSAR(invoice.rentValue)}</TableCell>
                      <TableCell className="font-medium text-sm tabular-nums whitespace-nowrap">{formatSAR(invoice.vatAmount)}</TableCell>
                      <TableCell className="font-bold text-sm tabular-nums whitespace-nowrap">{formatSAR(invoice.totalValue)}</TableCell>
                      <TableCell className="text-xs tabular-nums whitespace-nowrap">{formatDate(invoice.dueDate)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <InvoiceStatusBadge status={invoice.status as InvoiceStatusValue} />
                          {(invoice.zatcaStatus === 'cleared' || invoice.zatcaStatus === 'reported') && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">ZATCA ✓</span>
                          )}
                          {(invoice.zatcaStatus === 'rejected' || invoice.zatcaStatus === 'failed' || invoice.zatcaStatus === 'error') && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">ZATCA ✗</span>
                          )}
                          <WhatsappStatusChip status={invoice.whatsappStatus} sentAt={invoice.whatsappSentAt} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="إجراءات">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => openDetail(invoice)}>
                              <Eye className="h-4 w-4 ml-2" /> عرض
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={comingSoon}>
                              <FileText className="h-4 w-4 ml-2" /> تنزيل PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={comingSoon}>
                              <Printer className="h-4 w-4 ml-2" /> طباعة / سند صرف
                            </DropdownMenuItem>
                            {invoice.status !== 'paid' && (
                              <DropdownMenuItem onClick={comingSoon}>
                                <CheckCircle2 className="h-4 w-4 ml-2" /> تسجيل الدفع
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={comingSoon}>
                              <MessageCircle className="h-4 w-4 ml-2" /> إرسال على واتساب
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={comingSoon}>
                              <MessageCircle className="h-4 w-4 ml-2" /> إرسال برقم آخر…
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {canDelete && (
                            <DropdownMenuItem onClick={comingSoon} className="text-red-600 focus:text-red-600">
                              <Trash2 className="h-4 w-4 ml-2" /> حذف
                            </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Receipt className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-sm">{rangeFiltersActive || statusFilter !== 'all' || searchQuery ? 'لا توجد فواتير مطابقة للفلاتر' : 'لا توجد فواتير'}</p>
              <p className="text-xs mt-1">{rangeFiltersActive || statusFilter !== 'all' || searchQuery ? 'جرّب تعديل نطاق التاريخ أو رقم الفاتورة أو الحالة' : 'ابدأ بإنشاء فاتورة جديدة'}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Floating Bulk Actions Panel */}
      {selectedInvoiceIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 dark:bg-slate-950/95 text-white px-6 py-3 rounded-2xl flex items-center gap-6 shadow-2xl backdrop-blur-md border border-slate-800 animate-in slide-in-from-bottom duration-300" dir="rtl">
          <span className="text-xs font-bold">{selectedInvoiceIds.length} فواتير محددة</span>

          <div className="h-4 w-px bg-slate-800" />

          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl px-4 py-1.5"
              onClick={comingSoon}
            >
              تأكيد السداد الجماعي
            </Button>

            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl px-4 py-1.5 gap-1.5"
              onClick={comingSoon}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              إرسال إلى ZATCA
            </Button>

            {canDelete && (
            <Button
              size="sm"
              variant="destructive"
              className="font-bold text-xs rounded-xl px-4 py-1.5"
              onClick={comingSoon}
            >
              حذف جماعي
            </Button>
            )}
          </div>

          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-slate-400 hover:text-white" onClick={() => setSelectedInvoiceIds([])}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ================================================================== */}
      {/* Invoice Detail Dialog - Concise Single Page                       */}
      {/* ================================================================== */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-emerald-600" />
              معاينة الفاتورة
            </DialogTitle>
            <DialogDescription>
              راجِع البيانات أدناه (الرقم الضريبي، المبالغ، التواريخ…) ثم اطبع الفاتورة أو أرسلها — {selectedInvoice?.invoiceNumber}
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-4">
              {/* Contract & Type Header */}
              <div className="flex items-center justify-between rounded-lg border bg-emerald-50 dark:bg-emerald-950/30 p-3">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-emerald-600" />
                  <span className="font-mono font-bold text-sm">{selectedInvoice.contractNumber}</span>
                </div>
                <Badge variant="neutral" className="bg-white dark:bg-gray-900">
                  {selectedInvoice.contractType ? ContractTypeLabels[selectedInvoice.contractType as keyof typeof ContractTypeLabels]?.ar : '—'}
                </Badge>
              </div>

              {/* Key Info Grid - concise */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {/* Tenant Info */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" /> المستأجر
                  </p>
                  <p className="font-medium">{selectedInvoice.tenantName || '—'}</p>
                  {selectedInvoice.tenantCompanyName && (
                    <p className="text-xs text-muted-foreground">{selectedInvoice.tenantCompanyName}</p>
                  )}
                </div>

                {/* Lessor Info */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> المالك (المؤجر)
                  </p>
                  <p className="font-medium">{selectedInvoice.lessorName || '—'}</p>
                  {selectedInvoice.lessorNationalId && (
                    <p className="text-xs text-muted-foreground">هوية: {selectedInvoice.lessorNationalId}</p>
                  )}
                </div>

                {/* Tenant CR */}
                {selectedInvoice.tenantCrNumber && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Briefcase className="h-3 w-3" /> السجل التجاري
                    </p>
                    <p className="font-mono text-xs">{selectedInvoice.tenantCrNumber}</p>
                    {selectedInvoice.tenantUnifiedNumber && (
                      <p className="text-xs text-muted-foreground">الرقم الموحد: {selectedInvoice.tenantUnifiedNumber}</p>
                    )}
                  </div>
                )}

                {/* Property */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> العقار
                  </p>
                  <p className="font-medium text-xs">{selectedInvoice.propertyTitle || '—'}</p>
                  <p className="text-xs text-muted-foreground">{selectedInvoice.propertyAddress}, {selectedInvoice.propertyCity}</p>
                </div>

                {/* Contact Info */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" /> التواصل
                  </p>
                  <p className="text-xs">{selectedInvoice.tenantPhone || '—'}</p>
                  {selectedInvoice.tenantEmail && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {selectedInvoice.tenantEmail}
                    </p>
                  )}
                </div>

                {/* Dates */}
                <div className="space-y-1">
                  {selectedInvoice.sealingLocation && (
                    <p className="text-xs text-muted-foreground">إبرام: {selectedInvoice.sealingLocation} - {formatDate(selectedInvoice.sealingDate)}</p>
                  )}
                </div>
              </div>

              {/* Financial Summary */}
              <div className="rounded-lg border p-3 space-y-2">
                <p className="font-semibold text-sm mb-2">البيانات المالية</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">قيمة الإيجار</span>
                    <span className="font-medium">{formatSAR(selectedInvoice.rentValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ضريبة القيمة المضافة</span>
                    <span className="font-medium">{formatSAR(selectedInvoice.vatAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">خدمات عامة</span>
                    <span>{formatSAR(selectedInvoice.servicesAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الإجمالي</span>
                    <span className="font-bold text-emerald-700">{formatSAR(selectedInvoice.totalValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الإيجار السنوي</span>
                    <span>{formatSAR(selectedInvoice.annualRent)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">إجمالي العقد</span>
                    <span>{formatSAR(calcTotalContractValue(selectedInvoice.annualRent, selectedInvoice.startDate, selectedInvoice.endDate, selectedInvoice.totalContractValue))}</span>
                  </div>
                </div>
              </div>

              {/* Payment & Dates */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">تاريخ الإصدار</span>
                  <span>{formatDate(selectedInvoice.issueDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">تاريخ السداد</span>
                  <span>{selectedInvoice.status === 'paid' && selectedInvoice.paidDate ? formatDate(selectedInvoice.paidDate) : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">تاريخ الاستحقاق</span>
                  <span className={selectedInvoice.status === 'overdue' ? 'text-red-600 font-bold' : ''}>{formatDate(selectedInvoice.dueDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">القسط</span>
                  <span>{selectedInvoice.installmentNo} من {selectedInvoice.totalInstallments}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الحالة</span>
                  <InvoiceStatusBadge status={selectedInvoice.status as InvoiceStatusValue} />
                </div>
                {selectedInvoice.vatNumber && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الرقم الضريبي</span>
                    <span className="font-mono text-xs">{selectedInvoice.vatNumber}</span>
                  </div>
                )}
                {selectedInvoice.paidDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">تاريخ الدفع</span>
                    <span>{formatDate(selectedInvoice.paidDate)}</span>
                  </div>
                )}
              </div>

              {/* Notes */}
              {selectedInvoice.notes && (
                <div className="text-sm bg-muted/50 rounded-md p-3">
                  <p className="text-xs text-muted-foreground mb-1">ملاحظات</p>
                  <p>{selectedInvoice.notes}</p>
                </div>
              )}

              {/* Related documents (read-only): this invoice's own attachment(s) only */}
              <div className="text-sm rounded-md border p-3 space-y-2">
                <p className="font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  المستندات المرتبطة
                </p>
                {loadingDocs ? (
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> جارٍ التحميل…
                  </p>
                ) : relatedDocs.length > 0 ? (
                  <ul className="space-y-1">
                    {relatedDocs.map((doc, i) => (
                      <li key={i} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate" dir="ltr">
                            {decodeURIComponent(doc.url.split('/').pop() || `ملف ${i + 1}`)}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                            {doc.source === 'contract' ? 'العقد' : 'الفاتورة'}
                          </span>
                        </span>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-700 hover:underline shrink-0"
                        >
                          عرض
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">لا توجد مستندات مرفقة</p>
                )}
              </div>

              {/* ZATCA e-invoicing (zero-touch: invoices auto-submit to ZATCA on issue). */}
              {(() => {
                const s = selectedInvoice.zatcaStatus || 'not_submitted'
                const isSuccess = s === 'cleared' || s === 'reported'
                const isFailure = s === 'rejected' || s === 'failed' || s === 'error'
                const errs = selectedInvoice.zatcaErrors as unknown
                const errArr: unknown[] | null = Array.isArray(errs)
                  ? errs
                  : Array.isArray((errs as { validationResults?: { errorMessages?: unknown[] } })?.validationResults?.errorMessages)
                    ? (errs as { validationResults: { errorMessages: unknown[] } }).validationResults.errorMessages
                    : null
                const errMsgs = errArr
                  ? errArr.map((e) => (e as { message?: string; code?: string })?.message || (e as { message?: string; code?: string })?.code || String(e)).filter(Boolean)
                  : errs && typeof errs === 'object'
                    ? [(errs as { detail?: string; message?: string; code?: string }).detail || (errs as { message?: string }).message || (errs as { code?: string }).code].filter(Boolean)
                    : []
                const firstCode: string = String((errArr?.[0] as { code?: string })?.code || (errs && typeof errs === 'object' ? (errs as { code?: string }).code : '') || '')
                const isNetworkError = isFailure && /^(UND_ERR|ECONN|ENOTFOUND|ETIMEDOUT|EAI_|UNKNOWN)/.test(firstCode)
                const badge = isSuccess
                  ? { t: s === 'cleared' ? 'مقبولة (مصادقة)' : 'مقبولة (إبلاغ)', c: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' }
                  : isNetworkError
                    ? { t: 'تعذّر الاتصال', c: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' }
                    : isFailure
                      ? { t: 'مرفوضة', c: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' }
                      : { t: 'بانتظار الإرسال التلقائي', c: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' }
                return (
                  <div className="text-sm rounded-md border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                        الفوترة الإلكترونية (ZATCA)
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${badge.c}`}>{badge.t}</span>
                    </div>

                    {typeof selectedInvoice.icv === 'number' && selectedInvoice.icv > 0 && (
                      <div className="text-xs text-muted-foreground">
                        ICV: {selectedInvoice.icv} · {selectedInvoice.invoiceType === 'standard' ? 'فاتورة ضريبية (مصادقة)' : 'فاتورة مبسطة (إبلاغ)'}
                      </div>
                    )}

                    {isSuccess && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                        تم تسجيل الفاتورة لدى هيئة الزكاة والضريبة والجمارك تلقائياً.
                      </p>
                    )}

                    {!isSuccess && !isFailure && (
                      <p className="text-xs text-muted-foreground">
                        سيتم إرسال الفاتورة إلى هيئة الزكاة تلقائياً.
                      </p>
                    )}

                    {isFailure && errMsgs.length > 0 && (
                      <p className="text-xs text-red-600 break-words" dir="ltr">
                        {errMsgs.slice(0, 3).join(' · ')}
                      </p>
                    )}

                    {/* Fallback retry button — ONLY when a submission failed (stubbed). */}
                    {isFailure && (
                      <div className="flex items-center gap-3">
                        <Button variant="outline" size="sm" className="gap-2" onClick={comingSoon}>
                          <RefreshCw className="h-4 w-4" />
                          إعادة المحاولة
                        </Button>
                      </div>
                    )}

                    {/* Approved QR — shown once cleared/reported. */}
                    {isSuccess && selectedInvoice.zatcaQr && (
                      <div className="flex flex-col items-center w-fit">
                        <div className="bg-white p-1 rounded border">
                          <QRCodeSVG value={selectedInvoice.zatcaQr} size={64} />
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-0.5">QR معتمد</span>
                      </div>
                    )}

                    {/* If this row is itself a note, show which invoice it references. */}
                    {(selectedInvoice.documentType === 'credit_note' || selectedInvoice.documentType === 'debit_note') && selectedInvoice.originalInvoiceNumber && (
                      <p className="text-[11px] text-muted-foreground">
                        {selectedInvoice.documentType === 'debit_note' ? 'إشعار مدين' : 'إشعار دائن'} على فاتورة {selectedInvoice.originalInvoiceNumber}
                      </p>
                    )}

                    {/* Already cancelled — no further notes allowed. */}
                    {isSuccess && selectedInvoice.status === 'cancelled' && (
                      <p className="text-[11px] text-muted-foreground">هذه الفاتورة ملغاة بإشعار دائن — لا يمكن إصدار إشعار آخر عليها.</p>
                    )}

                    {/* Credit/debit note (stubbed) — cancel or correct a cleared/reported invoice. */}
                    {isSuccess && (selectedInvoice.documentType ?? 'invoice') === 'invoice' && selectedInvoice.status !== 'cancelled' && (
                      <Button variant="outline" size="sm" className="gap-2 w-fit text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-300 dark:border-amber-700" onClick={comingSoon}>
                        <FileText className="h-4 w-4" />
                        إصدار إشعار دائن / مدين (إلغاء أو تصحيح)
                      </Button>
                    )}
                  </div>
                )
              })()}
            </div>
          )}

          <DialogFooter className="gap-2">
            {selectedInvoice && (
              <Button
                variant="outline"
                onClick={comingSoon}
                className="gap-2"
              >
                <Printer className="h-4 w-4" />
                طباعة
              </Button>
            )}
            {selectedInvoice && (
              <Button
                variant="outline"
                onClick={comingSoon}
                className="gap-2 text-green-600"
              >
                <MessageCircle className="h-4 w-4" />
                واتساب
              </Button>
            )}
            {selectedInvoice && selectedInvoice.status !== 'paid' && (
              <Button
                onClick={comingSoon}
                className="gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                تسجيل الدفع
              </Button>
            )}
            {canDelete && (
            <Button
              variant="destructive"
              onClick={comingSoon}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              حذف
            </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/* Create Invoice (DRAFT) Dialog                                       */}
      {/* ================================================================== */}
      <Dialog open={formOpen} onOpenChange={(open) => {
        if (!open) resetForm()
        setFormOpen(open)
      }}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              إنشاء فاتورة جديدة
            </DialogTitle>
            <DialogDescription>
              أدخل بيانات الفاتورة الجديدة — تُحفظ كمسودة (لا تُرسل لهيئة الزكاة).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Contract Selection */}
            <div className="space-y-2">
              <Label>العقد *</Label>
              <Select value={formData.contractId} onValueChange={handleContractChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر العقد..." />
                </SelectTrigger>
                <SelectContent>
                  {contractOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Contract Info */}
            {selectedContract && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">المستأجر: </span><span className="font-medium">{selectedContract.tenantName || '—'}</span></div>
                  <div><span className="text-muted-foreground">الإيجار: </span><span className="font-medium">{formatSAR(selectedContract.rentAmount)}</span></div>
                </div>
              </div>
            )}

            {/* Installment */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>رقم القسط</Label>
                <Input
                  type="text" inputMode="decimal" min="1"
                  value={formData.installmentNo}
                  onChange={(e) => setFormData((prev) => ({ ...prev, installmentNo: toAsciiDigits(e.target.value) }))}
                />
                {selectedContract && (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">القسط المستحق التالي — مختار تلقائياً، يمكنك تعديله</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>إجمالي الأقساط</Label>
                <Input
                  type="text" inputMode="decimal" min="1"
                  value={formData.totalInstallments}
                  onChange={(e) => setFormData((prev) => ({ ...prev, totalInstallments: toAsciiDigits(e.target.value) }))}
                />
              </div>
            </div>

            {/* Financials */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>قيمة الإيجار (ر.س) *</Label>
                <Input
                  type="text" inputMode="decimal" min="0" step="0.01"
                  value={formData.rentValue}
                  onChange={(e) => setFormData((prev) => ({ ...prev, rentValue: toAsciiDigits(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  ض.ق.م 15% (ر.س)
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full">تلقائي</span>
                </Label>
                <Input type="text" inputMode="decimal" value={formData.vatAmount} readOnly className="bg-muted cursor-not-allowed" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  الإجمالي (ر.س)
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full">تلقائي</span>
                </Label>
                <Input type="text" inputMode="decimal" value={formData.totalValue} readOnly className="bg-muted cursor-not-allowed font-bold" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الإيجار السنوي (ر.س)</Label>
                <Input
                  type="text" inputMode="decimal" min="0" step="0.01"
                  value={formData.annualRent}
                  onChange={(e) => setFormData((prev) => ({ ...prev, annualRent: toAsciiDigits(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>إجمالي العقد (ر.س)</Label>
                <Input
                  type="text" inputMode="decimal" min="0" step="0.01"
                  value={formData.totalContractValue}
                  onChange={(e) => setFormData((prev) => ({ ...prev, totalContractValue: toAsciiDigits(e.target.value) }))}
                />
              </div>
            </div>

            {/* Dates — Issue → Due (auto) → Supply */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>تاريخ الإصدار <span className="text-destructive">*</span></Label>
                <DatePicker
                  value={formData.issueDate}
                  onChange={(date) => setFormData((prev) => ({ ...prev, issueDate: date }))}
                  showDualDate showCalendarToggle
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  تاريخ الاستحقاق <span className="text-destructive">*</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full">تلقائي</span>
                </Label>
                <DatePicker value={formData.dueDate} onChange={() => {}} readOnly variant="auto" showDualDate />
                <p className="text-xs text-muted-foreground">يتم حسابه تلقائياً بناءً على رقم القسط والجدول الزمني للعقد</p>
              </div>
              <div className="space-y-2">
                <Label>تاريخ التوريد / الاستلام</Label>
                <DatePicker
                  value={formData.supplyDate}
                  onChange={(date) => setFormData((prev) => ({ ...prev, supplyDate: date }))}
                  showDualDate showCalendarToggle
                />
              </div>
            </div>

            {/* Payment method (required) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>طريقة الدفع <span className="text-destructive">*</span></Label>
                <Select
                  value={formData.paymentMethod}
                  onValueChange={(value) => {
                    const method = value as PaymentMethodValue
                    setFormData((prev) => {
                      const updates = { ...prev, paymentMethod: method }
                      if (method === 'bank_transfer' || method === 'platform' || method === 'cash') updates.status = 'paid'
                      else if (method === 'other' || method === 'deferred') updates.status = 'unpaid'
                      return updates
                    })
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="اختر طريقة الدفع..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PaymentMethodLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label.ar}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {formData.paymentMethod === 'platform' && (
                <div className="space-y-2">
                  <Label>رقم فاتورة المنصة <span className="text-destructive">*</span></Label>
                  <Input
                    value={formData.referenceNumber}
                    onChange={(e) => setFormData((prev) => ({ ...prev, referenceNumber: e.target.value }))}
                    placeholder="رقم الفاتورة في إيجار"
                  />
                </div>
              )}
              {formData.paymentMethod === 'other' && (
                <div className="space-y-2">
                  <Label>اذكر طريقة الدفع <span className="text-destructive">*</span></Label>
                  <Input
                    value={formData.customPaymentMethod}
                    onChange={(e) => setFormData((prev) => ({ ...prev, customPaymentMethod: e.target.value }))}
                    placeholder="مثال: شيك، نقدي، إلخ"
                  />
                </div>
              )}
            </div>

            {/* Collection date — shown when the invoice would be saved as PAID (blank + manual). */}
            {formData.status === 'paid' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>تاريخ التحصيل (السداد) <span className="text-destructive">*</span></Label>
                  <DatePicker
                    value={formData.paymentDate}
                    onChange={(date) => setFormData((prev) => ({ ...prev, paymentDate: date }))}
                    placeholder="اختر تاريخ التحصيل"
                    showDualDate showCalendarToggle
                  />
                </div>
              </div>
            )}

            {/* Bank details */}
            <div className="space-y-4">
              <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/30 p-3">
                <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-3">حسابات المالك (المؤجر)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>رقم الحساب <span className="text-destructive">*</span></Label>
                    <Input
                      value={formData.bankAccountNumber}
                      onChange={(e) => setFormData((prev) => ({ ...prev, bankAccountNumber: e.target.value }))}
                      dir="ltr" placeholder="رقم حساب المالك"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>اسم البنك (اختياري)</Label>
                    <Input
                      value={formData.bankName}
                      onChange={(e) => setFormData((prev) => ({ ...prev, bankName: e.target.value }))}
                      placeholder="اسم بنك المالك"
                    />
                  </div>
                </div>
              </div>
              <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/30 p-3">
                <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-3">حسابات المستأجر</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>رقم الحساب</Label>
                    <Input
                      value={formData.tenantBankAccountNumber}
                      onChange={(e) => setFormData((prev) => ({ ...prev, tenantBankAccountNumber: e.target.value }))}
                      dir="ltr" placeholder="رقم حساب المستأجر"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الآيبان</Label>
                    <Input
                      value={formData.tenantIban}
                      onChange={(e) => setFormData((prev) => ({ ...prev, tenantIban: e.target.value }))}
                      dir="ltr" placeholder="IBAN المستأجر"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>اسم البنك (اختياري)</Label>
                    <Input
                      value={formData.tenantBankName}
                      onChange={(e) => setFormData((prev) => ({ ...prev, tenantBankName: e.target.value }))}
                      placeholder="اسم بنك المستأجر"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>

            {/* Attachment — GATED (the mirror uses Frappe's file API; activates at final cutover). */}
            <div className="space-y-2">
              <Label>المرفقات (فاتورة / إيصال)</Label>
              <button
                type="button"
                onClick={comingSoon}
                className="w-full flex items-center justify-center gap-2 cursor-pointer border-2 border-dashed border-emerald-200 rounded-md p-3 text-sm text-emerald-600 hover:bg-emerald-50 transition-colors"
              >
                <Upload className="h-4 w-4" />
                إرفاق ملف (يُفعّل عند التحويل النهائي)
              </button>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => { setFormOpen(false); resetForm() }}
              disabled={submitting}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !formData.contractId || !formData.rentValue || !formData.dueDate || !formData.issueDate || !formData.paymentMethod}
              className="gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {!submitting && <Eye className="h-4 w-4" />}
              معاينة وإصدار
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/* Read-only preview — the DRAFT is created ONLY after «تأكيد وإصدار»  */}
      {/* ================================================================== */}
      <Dialog open={previewOpen} onOpenChange={(open) => { if (!submitting) setPreviewOpen(open) }}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              معاينة الفاتورة قبل الإصدار
            </DialogTitle>
            <DialogDescription>
              مراجعة للقراءة فقط — تُحفظ كمسودة فقط (ولن تُرسل لهيئة الزكاة) بعد الضغط على «تأكيد وإصدار».
            </DialogDescription>
          </DialogHeader>

          {(() => {
            const previewContract = selectedContract || contracts.find((c) => c.id === formData.contractId) || null
            const row = (label: string, value: ReactNode, cls = '') => (
              <div className="flex items-start justify-between gap-3 py-1.5">
                <span className="text-muted-foreground shrink-0">{label}</span>
                <span className={`text-left font-medium ${cls}`}>{value}</span>
              </div>
            )
            return (
              <div className="space-y-3 text-sm">
                <div className="rounded-lg border bg-muted/40 p-3">
                  {row('رقم الفاتورة (المسودة)', seqCtx.nextInvoiceNumber)}
                  {row('العقد', previewContract ? (previewContract.ejarContractNumber || previewContract.contractNumber) : formData.contractId)}
                  {row('المستأجر', previewContract?.tenantName || previewContract?.tenantId || '—')}
                  {row('القسط', `${formData.installmentNo || '—'} من ${formData.totalInstallments || '—'}`)}
                </div>
                <div className="rounded-lg border bg-muted/40 p-3">
                  {row('قيمة الإيجار', formatSAR(Number(formData.rentValue) || 0))}
                  {row('الضريبة', formatSAR(Number(formData.vatAmount) || 0))}
                  {Number(formData.servicesAmount) > 0 && row('الخدمات', formatSAR(Number(formData.servicesAmount)))}
                  {row('الإجمالي', formatSAR(Number(formData.totalValue) || 0), 'font-bold text-emerald-700 dark:text-emerald-400')}
                </div>
                <div className="rounded-lg border bg-muted/40 p-3">
                  {row('تاريخ الإصدار', formData.issueDate ? formatDate(formData.issueDate) : '—')}
                  {row('تاريخ الاستحقاق', formData.dueDate ? formatDate(formData.dueDate) : '—')}
                  {row('تاريخ التوريد / الاستلام', formData.supplyDate ? formatDate(formData.supplyDate) : '— (يدوي، غير محدد)')}
                </div>
                <div className="rounded-lg border bg-muted/40 p-3">
                  {row('طريقة الدفع', formData.paymentMethod ? (PaymentMethodLabels[formData.paymentMethod]?.ar || formData.paymentMethod) : '—')}
                  {formData.paymentMethod === 'other' && formData.customPaymentMethod && row('الطريقة (أخرى)', formData.customPaymentMethod)}
                  {formData.paymentMethod === 'platform' && row('رقم فاتورة المنصة', formData.referenceNumber || '—')}
                  {row('الحالة عند الحفظ', 'مسودة')}
                </div>
                {formData.notes && (
                  <div className="rounded-lg border bg-muted/40 p-3">
                    {row('ملاحظات', formData.notes)}
                  </div>
                )}
              </div>
            )
          })()}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(false)} disabled={submitting}>
              رجوع للتعديل
            </Button>
            <Button onClick={performSubmit} disabled={submitting} className="gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              تأكيد وإصدار الفاتورة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/* Post-save confirmation — two explicit next steps (batch workflow)  */}
      {/* ================================================================== */}
      <Dialog open={issuedSuccess} onOpenChange={setIssuedSuccess}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              تم حفظ المسودة بنجاح
            </DialogTitle>
            <DialogDescription>ماذا تريد أن تفعل الآن؟</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button autoFocus className="w-full gap-2" onClick={() => { setIssuedSuccess(false); openCreateForm() }}>
              <Plus className="h-4 w-4" /> فاتورة جديدة
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setIssuedSuccess(false)}>
              العودة للقائمة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
