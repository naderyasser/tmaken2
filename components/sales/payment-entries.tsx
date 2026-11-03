/**
 * Payment Entries — Full CRUD for payments against sales invoices
 * Admin can: view invoices, create payment entries (with amount/mode/reference),
 * submit, list existing PEs, and delete draft PEs — all inline.
 */

'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { salesApi, type SalesInvoice, localDateISO } from '@/lib/sales-api'
import { frappeClient } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { formatSAR, formatNumber, formatDateShort } from '@/lib/sales-format'
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
import {
  Search, RefreshCw, DollarSign, Receipt, AlertTriangle,
  CheckCircle2, Clock, Loader2, CreditCard, TrendingDown, Ban,
  Plus, Trash2, Send, RotateCcw, Wallet, ArrowDownLeft,
} from 'lucide-react'

interface PaymentEntryRow {
  name: string
  posting_date: string
  party: string
  party_name?: string
  paid_amount: number
  payment_type: string
  mode_of_payment?: string
  reference_no?: string
  docstatus: number
  status?: string
  company?: string
}

export function PaymentEntries() {
  const { t, lang, isRTL } = useI18n()
  const { toast } = useToast()

  // Invoices tab
  const [invoices, setInvoices] = useState<SalesInvoice[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(true)
  const [invoiceSearch, setInvoiceSearch] = useState('')
  const [invoiceStatus, setInvoiceStatus] = useState('unpaid')
  const [invoicePage, setInvoicePage] = useState(1)

  // Payment Entries tab
  const [payments, setPayments] = useState<PaymentEntryRow[]>([])
  const [loadingPayments, setLoadingPayments] = useState(true)
  const [paymentSearch, setPaymentSearch] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('all')
  const [paymentPage, setPaymentPage] = useState(1)

  // Create Payment dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createFromInvoice, setCreateFromInvoice] = useState<SalesInvoice | null>(null)
  const [payForm, setPayForm] = useState({
    amount: '',
    mode_of_payment: '',
    reference_no: '',
    reference_date: localDateISO(),
    posting_date: localDateISO(),
  })
  const [modesOfPayment, setModesOfPayment] = useState<string[]>([])
  const [customers, setCustomers] = useState<{ name: string; customer_name: string }[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [creating, setCreating] = useState(false)
  const [defaultCompany, setDefaultCompany] = useState('')

  // Delete dialog
  const [deletingPE, setDeletingPE] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('invoices')
  const itemsPerPage = 20

  // Refund dialog
  const [showRefundDialog, setShowRefundDialog] = useState(false)
  const [refundInvoice, setRefundInvoice] = useState<SalesInvoice | null>(null)
  const [refundForm, setRefundForm] = useState({
    amount: '',
    mode_of_payment: '',
    reference_no: '',
    reference_date: localDateISO(),
    posting_date: localDateISO(),
  })
  const [creatingRefund, setCreatingRefund] = useState(false)

  // Customer credits
  const [customerCredits, setCustomerCredits] = useState<{ customer: string; customer_name: string; credit_balance: number; credit_notes_count: number }[]>([])
  const [loadingCredits, setLoadingCredits] = useState(true)
  const [creditSearch, setCreditSearch] = useState('')

  // Load all data
  const loadInvoices = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoadingInvoices(true)
      const data = await salesApi.getSalesInvoices({
        fields: ['name', 'customer', 'customer_name', 'status', 'grand_total', 'outstanding_amount', 'posting_date', 'due_date', 'docstatus', 'is_return', 'return_against'],
        limit_page_length: 500,
      })
      setInvoices(data)
    } catch (e) {
      toast({ title: t('sr.admin.common.error'), description: String(e), variant: 'destructive' })
    } finally { setLoadingInvoices(false); setRefreshing(false) }
  }, [toast, t])

  const loadPayments = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoadingPayments(true)
      const data = await frappeClient.getList<PaymentEntryRow>('Payment Entry', {
        fields: ['name', 'posting_date', 'party', 'party_name', 'paid_amount', 'payment_type', 'mode_of_payment', 'reference_no', 'docstatus', 'status', 'company'],
        filters: [['Payment Entry', 'payment_type', 'in', ['Receive', 'Pay']], ['Payment Entry', 'party_type', '=', 'Customer']] as any,
        order_by: 'posting_date desc, creation desc',
        limit_page_length: 500,
      })
      setPayments(data)
    } catch (e) {
      toast({ title: t('sr.admin.common.error'), description: String(e), variant: 'destructive' })
    } finally { setLoadingPayments(false); setRefreshing(false) }
  }, [toast, t])

  const loadDefaults = useCallback(async () => {
    try {
      const [modes, companies, custs] = await Promise.all([
        frappeClient.getList<{ name: string }>('Mode of Payment', { fields: ['name'], limit_page_length: 50 }),
        frappeClient.getList<{ name: string }>('Company', { fields: ['name'], limit_page_length: 1 }),
        frappeClient.getList<{ name: string; customer_name: string }>('Customer', {
          fields: ['name', 'customer_name'],
          filters: [['Customer', 'disabled', '=', 0]],
          limit_page_length: 500,
        }),
      ])
      setModesOfPayment(modes.map(m => m.name))
      if (companies.length > 0) setDefaultCompany(companies[0].name)
      setCustomers(custs)
    } catch { /* ignore */ }
  }, [])

  const loadCustomerCredits = useCallback(async (refresh = false) => {
    try {
      if (!refresh) setLoadingCredits(true)
      const credits = await salesApi.getAllCustomerCreditBalances()
      setCustomerCredits(credits)
    } catch { /* ignore */ }
    finally { setLoadingCredits(false) }
  }, [])

  useEffect(() => {
    loadInvoices()
    loadPayments()
    loadDefaults()
    loadCustomerCredits()
  }, [loadInvoices, loadPayments, loadDefaults, loadCustomerCredits])

  const refreshAll = () => {
    loadInvoices(true)
    loadPayments(true)
    loadCustomerCredits(true)
  }

  // Invoice filtering
  const filteredInvoices = useMemo(() => {
    let result = invoices
    if (invoiceSearch) {
      const q = invoiceSearch.toLowerCase()
      result = result.filter(i =>
        i.name.toLowerCase().includes(q) || i.customer?.toLowerCase().includes(q) ||
        i.customer_name?.toLowerCase().includes(q)
      )
    }
    if (invoiceStatus === 'unpaid') result = result.filter(i => !i.is_return && (i.outstanding_amount || 0) > 0)
    else if (invoiceStatus === 'paid') result = result.filter(i => !i.is_return && (i.outstanding_amount || 0) === 0 && i.docstatus === 1)
    else if (invoiceStatus === 'overdue') result = result.filter(i => {
      const due = i.due_date ? new Date(i.due_date) : null
      return !i.is_return && (i.outstanding_amount || 0) > 0 && due && due < new Date()
    })
    else if (invoiceStatus === 'credit_notes') result = result.filter(i => i.is_return === 1)
    return result
  }, [invoices, invoiceSearch, invoiceStatus])

  // Payment filtering
  const filteredPayments = useMemo(() => {
    let result = payments
    if (paymentSearch) {
      const q = paymentSearch.toLowerCase()
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) || p.party?.toLowerCase().includes(q) ||
        p.party_name?.toLowerCase().includes(q)
      )
    }
    if (paymentStatus === 'draft') result = result.filter(p => p.docstatus === 0)
    else if (paymentStatus === 'submitted') result = result.filter(p => p.docstatus === 1)
    else if (paymentStatus === 'cancelled') result = result.filter(p => p.docstatus === 2)
    return result
  }, [payments, paymentSearch, paymentStatus])

  const invPages = Math.ceil(filteredInvoices.length / itemsPerPage)
  const paginatedInvoices = filteredInvoices.slice((invoicePage - 1) * itemsPerPage, invoicePage * itemsPerPage)
  const pePages = Math.ceil(filteredPayments.length / itemsPerPage)
  const paginatedPayments = filteredPayments.slice((paymentPage - 1) * itemsPerPage, paymentPage * itemsPerPage)

  useEffect(() => { setInvoicePage(1) }, [invoiceSearch, invoiceStatus])
  useEffect(() => { setPaymentPage(1) }, [paymentSearch, paymentStatus])

  // Stats
  const stats = useMemo(() => {
    const submitted = invoices.filter(i => i.docstatus === 1)
    const regularInvoices = submitted.filter(i => !i.is_return)
    const creditNotes = submitted.filter(i => i.is_return === 1)
    const totalOutstanding = regularInvoices.reduce((s, i) => s + (i.outstanding_amount || 0), 0)
    const totalRevenue = regularInvoices.reduce((s, i) => s + (i.grand_total || 0), 0)
    const unpaidCount = regularInvoices.filter(i => (i.outstanding_amount || 0) > 0).length
    const overdueCount = regularInvoices.filter(i => {
      const due = i.due_date ? new Date(i.due_date) : null
      return (i.outstanding_amount || 0) > 0 && due && due < new Date()
    }).length
    const totalCollected = payments.filter(p => p.docstatus === 1).reduce((s, p) => s + (p.paid_amount || 0), 0)
    const totalCreditNotes = creditNotes.reduce((s, i) => s + Math.abs(i.grand_total || 0), 0)
    const creditNotesCount = creditNotes.length
    const totalCreditBalance = customerCredits.reduce((s, c) => s + c.credit_balance, 0)
    return { totalOutstanding, totalRevenue, unpaidCount, overdueCount, totalCollected, totalCreditNotes, creditNotesCount, totalCreditBalance }
  }, [invoices, payments, customerCredits])

  const formatCurrency = (amount: number) => formatSAR(amount, lang)

  // ── Create Payment Entry ──
  const openCreatePayment = (invoice?: SalesInvoice) => {
    if (invoice) {
      setCreateFromInvoice(invoice)
      setSelectedCustomer(invoice.customer || '')
      setPayForm(prev => ({
        ...prev,
        amount: String(invoice.outstanding_amount || invoice.grand_total || ''),
      }))
    } else {
      setCreateFromInvoice(null)
      setSelectedCustomer('')
      setPayForm(prev => ({ ...prev, amount: '' }))
    }
    setShowCreateDialog(true)
  }

  const handleCreatePayment = async () => {
    const amount = parseFloat(payForm.amount)
    if (isNaN(amount) || amount <= 0) {
      toast({ title: t('sr.admin.common.error'), description: t('sr.admin.payments.enter_valid_amount'), variant: 'destructive' })
      return
    }
    const customer = createFromInvoice?.customer || selectedCustomer
    if (!customer) {
      toast({ title: t('sr.admin.common.error'), description: t('sr.admin.common.select_customer_required'), variant: 'destructive' })
      return
    }

    setCreating(true)
    try {
      let peName = ''

      if (createFromInvoice) {
        // Strategy A: From invoice — use get_payment_entry for pre-filled PE
        const peDataRes = await frappeClient.call(
          'erpnext.accounts.doctype.payment_entry.payment_entry.get_payment_entry',
          { dt: 'Sales Invoice', dn: createFromInvoice.name }
        )
        const pe = peDataRes?.message
        if (!pe) throw new Error(t('sr.admin.payments.fetch_pe_failed'))

        // Re-fetch latest outstanding to avoid stale data
        let latestOutstanding = amount
        try {
          const freshInv = await frappeClient.get<any>('Sales Invoice', createFromInvoice.name)
          latestOutstanding = Math.abs(freshInv?.data?.outstanding_amount || 0)
        } catch { /* use PE data as fallback */ }

        const safeAmount = Math.min(amount, latestOutstanding)
        pe.paid_amount = safeAmount
        pe.received_amount = safeAmount
        if (payForm.mode_of_payment) pe.mode_of_payment = payForm.mode_of_payment
        if (payForm.reference_no) {
          pe.reference_no = payForm.reference_no
          pe.reference_date = payForm.reference_date
        }
        pe.posting_date = payForm.posting_date

        // Adjust references allocation — cap at fresh outstanding per reference
        // Note: for return invoices (credit notes), outstanding is negative, so allocated must also be negative
        if (pe.references && pe.references.length > 0) {
          let remaining = safeAmount
          pe.references = pe.references.map((ref: any) => {
            const refOutstanding = ref.outstanding_amount || 0
            const absOutstanding = Math.abs(refOutstanding)
            const allocate = Math.min(remaining, absOutstanding)
            remaining -= allocate
            return { ...ref, allocated_amount: refOutstanding < 0 ? -allocate : allocate }
          }).filter((ref: any) => ref.allocated_amount !== 0)
        }

        delete pe.name
        pe.doctype = 'Payment Entry'

        // Try to insert; if allocation error, retry without references
        let insertRes: any
        try {
          insertRes = await frappeClient.call('frappe.client.insert', { doc: pe })
        } catch (insertErr: any) {
          if (String(insertErr).includes('Allocated Amount') || String(insertErr).includes('outstanding')) {
            // Retry without references (unallocated payment)
            pe.references = []
            insertRes = await frappeClient.call('frappe.client.insert', { doc: pe })
          } else {
            throw insertErr
          }
        }
        peName = insertRes?.message?.name
      } else {
        // Strategy B: Advance payment / no specific invoice
        const company = defaultCompany
        if (!company) throw new Error(t('sr.admin.payments.company_not_found'))

        // Resolve bank/cash account
        let bankAcct: any = null
        try {
          const res = await frappeClient.call(
            'erpnext.accounts.doctype.payment_entry.payment_entry.get_default_bank_cash_account',
            { company, mode_of_payment: payForm.mode_of_payment || undefined }
          )
          bankAcct = res?.message
        } catch { /* ignore */ }
        if (!bankAcct?.account) {
          try {
            const res = await frappeClient.call(
              'erpnext.accounts.doctype.payment_entry.payment_entry.get_default_bank_cash_account',
              { company }
            )
            bankAcct = res?.message
          } catch { /* ignore */ }
        }
        if (!bankAcct?.account) throw new Error(t('sr.admin.payments.no_bank_account'))

        let receivableAccount = ''
        try {
          const companyDoc = await frappeClient.get<any>('Company', company)
          receivableAccount = companyDoc?.data?.default_receivable_account || ''
        } catch { /* ignore */ }

        const peDoc: Record<string, any> = {
          doctype: 'Payment Entry',
          payment_type: 'Receive',
          posting_date: payForm.posting_date,
          company,
          party_type: 'Customer',
          party: customer,
          paid_amount: amount,
          received_amount: amount,
          target_exchange_rate: 1,
          source_exchange_rate: 1,
          paid_to: bankAcct.account,
          paid_to_account_currency: bankAcct.account_currency || 'SAR',
          ...(receivableAccount ? { paid_from: receivableAccount, paid_from_account_currency: 'SAR' } : {}),
          ...(payForm.mode_of_payment ? { mode_of_payment: payForm.mode_of_payment } : {}),
          ...(payForm.reference_no ? { reference_no: payForm.reference_no, reference_date: payForm.reference_date } : {}),
        }

        const insertRes = await frappeClient.call('frappe.client.insert', { doc: peDoc })
        peName = insertRes?.message?.name
      }

      if (!peName) throw new Error(t('sr.admin.payments.create_pe_failed'))

      // Try to submit
      let submitted = false
      try {
        const freshDoc = await frappeClient.get<any>('Payment Entry', peName)
        if (freshDoc?.data) {
          await frappeClient.call('frappe.client.submit', {
            doc: { ...freshDoc.data, doctype: 'Payment Entry' },
          })
          submitted = true
        }
      } catch (err) {
        console.warn('[PaymentEntries] Submit failed, saved as draft:', err)
      }

      toast({
        title: t('sr.admin.common.success'),
        description: submitted
          ? t('sr.admin.payments.pe_created_submitted').replace('{name}', peName)
          : t('sr.admin.payments.pe_created_draft').replace('{name}', peName),
      })

      setShowCreateDialog(false)
      setPayForm({ amount: '', mode_of_payment: '', reference_no: '', reference_date: localDateISO(), posting_date: localDateISO() })
      refreshAll()
    } catch (err: any) {
      toast({ title: t('sr.admin.common.error'), description: err?.message || String(err), variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  // ── Submit Draft PE ──
  const handleSubmitPE = async (peName: string) => {
    try {
      const freshDoc = await frappeClient.get<any>('Payment Entry', peName)
      if (!freshDoc?.data) throw new Error(t('sr.admin.payments.not_found'))
      await frappeClient.call('frappe.client.submit', {
        doc: { ...freshDoc.data, doctype: 'Payment Entry' },
      })
      toast({ title: t('sr.admin.common.success'), description: t('sr.admin.payments.pe_submitted').replace('{name}', peName) })
      loadPayments(true)
      loadInvoices(true)
    } catch (err: any) {
      toast({ title: t('sr.admin.common.error'), description: err?.message || String(err), variant: 'destructive' })
    }
  }

  // ── Cancel PE ──
  const handleCancelPE = async (peName: string) => {
    try {
      await frappeClient.call('frappe.client.cancel', {
        doctype: 'Payment Entry',
        name: peName,
      })
      toast({ title: t('sr.admin.common.success'), description: t('sr.admin.payments.pe_cancelled').replace('{name}', peName) })
      loadPayments(true)
      loadInvoices(true)
    } catch (err: any) {
      toast({ title: t('sr.admin.common.error'), description: err?.message || String(err), variant: 'destructive' })
    }
  }

  // ── Delete Draft PE ──
  const handleDeletePE = async () => {
    if (!deletingPE) return
    setDeleting(true)
    try {
      await frappeClient.delete('Payment Entry', deletingPE)
      toast({ title: t('sr.admin.common.success'), description: t('sr.admin.payments.pe_deleted').replace('{name}', deletingPE) })
      setDeletingPE(null)
      loadPayments(true)
    } catch (err: any) {
      toast({ title: t('sr.admin.common.error'), description: err?.message || String(err), variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  // ── Refund (Pay type PE against Credit Note) ──
  const openRefundDialog = (creditNote: SalesInvoice) => {
    setRefundInvoice(creditNote)
    setRefundForm(prev => ({
      ...prev,
      amount: String(Math.abs(creditNote.outstanding_amount || creditNote.grand_total || 0)),
    }))
    setShowRefundDialog(true)
  }

  const handleCreateRefund = async () => {
    const amount = parseFloat(refundForm.amount)
    if (isNaN(amount) || amount <= 0) {
      toast({ title: t('sr.admin.common.error'), description: t('sr.admin.payments.enter_valid_amount'), variant: 'destructive' })
      return
    }
    if (!refundInvoice) return

    setCreatingRefund(true)
    try {
      const result = await salesApi.createRefundPayment({
        customer: refundInvoice.customer,
        amount,
        mode_of_payment: refundForm.mode_of_payment || undefined,
        reference_no: refundForm.reference_no || undefined,
        reference_date: refundForm.reference_date,
        posting_date: refundForm.posting_date,
        company: defaultCompany || undefined,
        credit_note: refundInvoice.name,
      })

      toast({
        title: t('sr.admin.common.success'),
        description: result.submitted
          ? t('sr.admin.payments.refund_created_submitted').replace('{name}', result.name)
          : t('sr.admin.payments.refund_created_draft').replace('{name}', result.name),
      })

      setShowRefundDialog(false)
      setRefundInvoice(null)
      setRefundForm({ amount: '', mode_of_payment: '', reference_no: '', reference_date: localDateISO(), posting_date: localDateISO() })
      refreshAll()
    } catch (err: any) {
      toast({ title: t('sr.admin.common.error'), description: err?.message || String(err), variant: 'destructive' })
    } finally {
      setCreatingRefund(false)
    }
  }

  // Helpers
  const getInvoiceBadge = (invoice: SalesInvoice) => {
    if (invoice.is_return === 1) return { label: t('sr.admin.payments.credit_note'), class: 'bg-purple-100 text-purple-700' }
    const outstanding = invoice.outstanding_amount || 0
    const due = invoice.due_date ? new Date(invoice.due_date) : null
    if (outstanding === 0 && invoice.docstatus === 1) return { label: t('sr.admin.common.paid'), class: 'bg-emerald-100 text-emerald-700' }
    if (outstanding > 0 && due && due < new Date()) return { label: t('sr.admin.payments.overdue'), class: 'bg-red-100 text-red-700' }
    if (outstanding > 0) return { label: t('sr.admin.common.unpaid'), class: 'bg-amber-100 text-amber-700' }
    if (invoice.docstatus === 0) return { label: t('sr.admin.common.draft'), class: 'bg-gray-100 text-gray-600' }
    return { label: invoice.status || 'Unknown', class: 'bg-gray-100 text-gray-600' }
  }

  const getPEBadge = (pe: PaymentEntryRow) => {
    if (pe.docstatus === 0) return { label: t('sr.admin.common.draft'), class: 'bg-amber-100 text-amber-700' }
    if (pe.docstatus === 1) return { label: t('sr.admin.payments.submitted'), class: 'bg-emerald-100 text-emerald-700' }
    if (pe.docstatus === 2) return { label: t('sr.admin.payments.cancelled'), class: 'bg-red-100 text-red-700' }
    return { label: '—', class: 'bg-gray-100 text-gray-600' }
  }

  const isLoading = loadingInvoices || loadingPayments

  if (isLoading && invoices.length === 0 && payments.length === 0) return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-7 gap-3">{[1, 2, 3, 4, 5, 6, 7].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className={cn('flex items-start justify-between gap-4', isRTL && 'flex-row-reverse')}>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">{t('sr.admin.payments.title')}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{t('sr.admin.payments.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button size="sm" className="h-9 bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-200" onClick={() => openCreatePayment()}>
              <Plus className={cn('h-4 w-4', isRTL ? 'ml-1' : 'mr-1')} />
              {t('sr.admin.payments.new_payment')}
            </Button>
            <Button variant="outline" size="sm" onClick={refreshAll} disabled={refreshing} className="h-9">
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
          {[
            { label: t('sr.admin.payments.total_revenue'), value: formatCurrency(stats.totalRevenue), Icon: DollarSign, dot: 'bg-slate-400', bg: 'bg-white' },
            { label: t('sr.admin.payments.outstanding_kpi'), value: formatCurrency(stats.totalOutstanding), Icon: TrendingDown, dot: 'bg-amber-500', bg: 'bg-amber-50' },
            { label: t('sr.admin.common.collected'), value: formatCurrency(stats.totalCollected), Icon: CheckCircle2, dot: 'bg-emerald-500', bg: 'bg-emerald-50' },
            { label: t('sr.admin.payments.credit_notes'), value: stats.creditNotesCount > 0 ? `${stats.creditNotesCount} (≈${formatCurrency(stats.totalCreditNotes)})` : '0', Icon: RotateCcw, dot: 'bg-purple-500', bg: 'bg-purple-50' },
            { label: t('sr.admin.payments.credit_balances'), value: formatCurrency(stats.totalCreditBalance), Icon: Wallet, dot: 'bg-teal-500', bg: 'bg-teal-50' },
            { label: t('sr.admin.common.unpaid'), value: String(stats.unpaidCount), Icon: Clock, dot: 'bg-blue-500', bg: 'bg-blue-50' },
            { label: t('sr.admin.payments.overdue'), value: String(stats.overdueCount), Icon: AlertTriangle, dot: 'bg-red-500', bg: 'bg-red-50' },
          ].map((s, i) => {
            const Icon = s.Icon
            return (
              <Card key={i} className={cn('border-0 shadow-sm rounded-xl overflow-hidden')}>
                <CardContent className={cn('p-4', s.bg)}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className={cn('w-2 h-2 rounded-full flex-shrink-0', s.dot)} />
                    <p className="text-[10px] font-semibold text-gray-500 truncate">{s.label}</p>
                  </div>
                  <p className="text-lg font-extrabold text-gray-900 truncate">{s.value}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-gray-100 rounded-xl">
            <TabsTrigger value="invoices" className="text-sm rounded-lg">
              <Receipt className={cn('h-4 w-4', isRTL ? 'ml-1.5' : 'mr-1.5')} />
              {t('sr.admin.common.invoices')} ({filteredInvoices.length})
            </TabsTrigger>
            <TabsTrigger value="payments" className="text-sm rounded-lg">
              <CreditCard className={cn('h-4 w-4', isRTL ? 'ml-1.5' : 'mr-1.5')} />
              {t('sr.admin.payments.payment_entries')} ({filteredPayments.length})
            </TabsTrigger>
            <TabsTrigger value="credits" className="text-sm rounded-lg">
              <Wallet className={cn('h-4 w-4', isRTL ? 'ml-1.5' : 'mr-1.5')} />
              {t('sr.admin.payments.customer_credits')} ({customerCredits.length})
            </TabsTrigger>
          </TabsList>

          {/* ─── Invoices Tab ─── */}
          <TabsContent value="invoices" className="mt-4 space-y-3">
            <Card className="border-0 shadow-sm rounded-xl">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
                    <Input placeholder={t('sr.admin.payments.search_invoices')} value={invoiceSearch} onChange={e => setInvoiceSearch(e.target.value)} className={cn('h-9 text-sm', isRTL ? 'pr-9' : 'pl-9')} />
                  </div>
                  <Select value={invoiceStatus} onValueChange={setInvoiceStatus}>
                    <SelectTrigger className="w-[150px] h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('sr.admin.common.all')}</SelectItem>
                      <SelectItem value="unpaid">{t('sr.admin.common.unpaid')}</SelectItem>
                      <SelectItem value="overdue">{t('sr.admin.payments.overdue')}</SelectItem>
                      <SelectItem value="paid">{t('sr.admin.common.paid')}</SelectItem>
                      <SelectItem value="credit_notes">{t('sr.admin.payments.credit_notes')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    <TableHead className="text-xs font-semibold">{t('sr.admin.payments.invoice')}</TableHead>
                    <TableHead className="text-xs font-semibold">{t('sr.admin.common.customer')}</TableHead>
                    <TableHead className="text-xs font-semibold">{t('sr.admin.common.date')}</TableHead>
                    <TableHead className="text-xs font-semibold text-right">{t('sr.admin.common.total')}</TableHead>
                    <TableHead className="text-xs font-semibold text-right">{t('sr.admin.common.outstanding_header')}</TableHead>
                    <TableHead className="text-xs font-semibold">{t('sr.admin.common.status')}</TableHead>
                    <TableHead className="text-xs font-semibold w-28"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-16 text-gray-400">
                        <Receipt className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                        {t('sr.admin.payments.empty_invoices')}
                      </TableCell>
                    </TableRow>
                  ) : paginatedInvoices.map(invoice => {
                    const badge = getInvoiceBadge(invoice)
                    return (
                      <TableRow key={invoice.name} className="hover:bg-gray-50/50">
                        <TableCell className="text-xs font-mono text-gray-500">{invoice.name}</TableCell>
                        <TableCell className="text-sm font-medium">{invoice.customer_name || invoice.customer}</TableCell>
                        <TableCell className="text-sm text-gray-600">{formatDateShort(invoice.posting_date, lang)}</TableCell>
                        <TableCell className="text-sm text-right font-medium">{invoice.is_return ? '-' : ''}{formatCurrency(Math.abs(invoice.grand_total))}</TableCell>
                        <TableCell className={cn('text-sm text-right font-bold', invoice.is_return ? 'text-purple-600' : (invoice.outstanding_amount || 0) > 0 ? 'text-amber-600' : 'text-emerald-600')}>
                          {invoice.is_return ? '-' : ''}{formatCurrency(Math.abs(invoice.outstanding_amount || 0))}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn('text-[10px]', badge.class)}>{badge.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {(invoice.outstanding_amount || 0) > 0 && invoice.docstatus === 1 && !invoice.is_return && (
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                              onClick={() => openCreatePayment(invoice)}
                            >
                              <CreditCard className={cn('h-3 w-3', isRTL ? 'ml-1' : 'mr-1')} />
                              {t('sr.admin.payments.pay')}
                            </Button>
                          )}
                          {invoice.is_return === 1 && invoice.docstatus === 1 && (invoice.outstanding_amount || 0) < 0 && (
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-purple-600 hover:bg-purple-700"
                              onClick={() => openRefundDialog(invoice)}
                            >
                              <ArrowDownLeft className={cn('h-3 w-3', isRTL ? 'ml-1' : 'mr-1')} />
                              {t('sr.admin.payments.refund')}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </Card>

            {invPages > 1 && (
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>{t('sr.admin.common.pagination_range').replace('{from}', String((invoicePage - 1) * itemsPerPage + 1)).replace('{to}', String(Math.min(invoicePage * itemsPerPage, filteredInvoices.length))).replace('{total}', String(filteredInvoices.length))}</span>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => setInvoicePage(p => Math.max(1, p - 1))} disabled={invoicePage === 1}>{t('sr.admin.common.prev')}</Button>
                  <Button variant="outline" size="sm" onClick={() => setInvoicePage(p => Math.min(invPages, p + 1))} disabled={invoicePage === invPages}>{t('sr.admin.common.next')}</Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ─── Payment Entries Tab ─── */}
          <TabsContent value="payments" className="mt-4 space-y-3">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
                    <Input placeholder={t('sr.admin.payments.search_pes')} value={paymentSearch} onChange={e => setPaymentSearch(e.target.value)} className={cn('h-9 text-sm', isRTL ? 'pr-9' : 'pl-9')} />
                  </div>
                  <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                    <SelectTrigger className="w-[150px] h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('sr.admin.common.all')}</SelectItem>
                      <SelectItem value="draft">{t('sr.admin.common.draft')}</SelectItem>
                      <SelectItem value="submitted">{t('sr.admin.payments.submitted')}</SelectItem>
                      <SelectItem value="cancelled">{t('sr.admin.payments.cancelled')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    <TableHead className="text-xs font-semibold">{t('sr.admin.payments.payment_entry')}</TableHead>
                    <TableHead className="text-xs font-semibold">{t('sr.admin.common.date')}</TableHead>
                    <TableHead className="text-xs font-semibold">{t('sr.admin.common.customer')}</TableHead>
                    <TableHead className="text-xs font-semibold text-right">{t('sr.admin.common.amount')}</TableHead>
                    <TableHead className="text-xs font-semibold">{t('sr.admin.payments.mode')}</TableHead>
                    <TableHead className="text-xs font-semibold">{t('sr.admin.payments.reference')}</TableHead>
                    <TableHead className="text-xs font-semibold">{t('sr.admin.common.status')}</TableHead>
                    <TableHead className="text-xs font-semibold w-32"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-16 text-gray-400">
                        <CreditCard className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                        {t('sr.admin.payments.empty_pes')}
                      </TableCell>
                    </TableRow>
                  ) : paginatedPayments.map(pe => {
                    const badge = getPEBadge(pe)
                    return (
                      <TableRow key={pe.name} className="hover:bg-gray-50/50">
                        <TableCell className="text-xs font-mono text-gray-500">{pe.name}</TableCell>
                        <TableCell className="text-sm text-gray-600">{formatDateShort(pe.posting_date, lang)}</TableCell>
                        <TableCell className="text-sm font-medium">{pe.party_name || pe.party}</TableCell>
                        <TableCell className={cn('text-sm text-right font-bold', pe.payment_type === 'Pay' ? 'text-purple-600' : 'text-emerald-600')}>
                          {pe.payment_type === 'Pay' ? '-' : ''}{formatCurrency(pe.paid_amount)}
                          {pe.payment_type === 'Pay' && (
                            <span className="block text-[10px] font-normal text-purple-400">{t('sr.admin.payments.refund')}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">{pe.mode_of_payment || '—'}</TableCell>
                        <TableCell className="text-xs font-mono text-gray-400">{pe.reference_no || '—'}</TableCell>
                        <TableCell>
                          <Badge className={cn('text-[10px]', badge.class)}>{badge.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {pe.docstatus === 0 && (
                              <>
                                <Button
                                  size="sm"
                                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                                  onClick={() => handleSubmitPE(pe.name)}
                                >
                                  <Send className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => setDeletingPE(pe.name)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                            {pe.docstatus === 1 && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleCancelPE(pe.name)}
                              >
                                <Ban className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </Card>

            {pePages > 1 && (
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>{t('sr.admin.common.pagination_range').replace('{from}', String((paymentPage - 1) * itemsPerPage + 1)).replace('{to}', String(Math.min(paymentPage * itemsPerPage, filteredPayments.length))).replace('{total}', String(filteredPayments.length))}</span>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => setPaymentPage(p => Math.max(1, p - 1))} disabled={paymentPage === 1}>{t('sr.admin.common.prev')}</Button>
                  <Button variant="outline" size="sm" onClick={() => setPaymentPage(p => Math.min(pePages, p + 1))} disabled={paymentPage === pePages}>{t('sr.admin.common.next')}</Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ─── Customer Credits Tab ─── */}
          <TabsContent value="credits" className="mt-4 space-y-3">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
                    <Input
                      placeholder={t('sr.admin.payments.search_by_customer')}
                      value={creditSearch}
                      onChange={e => setCreditSearch(e.target.value)}
                      className={cn('h-9 text-sm', isRTL ? 'pr-9' : 'pl-9')}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {loadingCredits ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
            ) : (
              <Card className="border-0 shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/50">
                      <TableHead className="text-xs font-semibold">{t('sr.admin.common.customer')}</TableHead>
                      <TableHead className="text-xs font-semibold text-right">{t('sr.admin.payments.credit_balance')}</TableHead>
                      <TableHead className="text-xs font-semibold text-center">{t('sr.admin.payments.notes_count')}</TableHead>
                      <TableHead className="text-xs font-semibold w-32"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const filteredCredits = creditSearch
                        ? customerCredits.filter(c =>
                          c.customer.toLowerCase().includes(creditSearch.toLowerCase()) ||
                          c.customer_name.toLowerCase().includes(creditSearch.toLowerCase())
                        )
                        : customerCredits

                      if (filteredCredits.length === 0) return (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-16 text-gray-400">
                            <Wallet className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                            {t('sr.admin.payments.empty_credits')}
                          </TableCell>
                        </TableRow>
                      )

                      return filteredCredits.map(credit => (
                        <TableRow key={credit.customer} className="hover:bg-gray-50/50">
                          <TableCell>
                            <p className="text-sm font-medium">{credit.customer_name}</p>
                            <p className="text-[10px] text-gray-400 font-mono">{credit.customer}</p>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-sm font-bold text-purple-600">{formatCurrency(credit.credit_balance)}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-purple-100 text-purple-700 text-[10px]">{credit.credit_notes_count}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-purple-600 hover:bg-purple-700"
                                onClick={() => {
                                  // Find the first outstanding credit note for this customer and open refund
                                  const firstCN = invoices.find(i => i.is_return === 1 && i.customer === credit.customer && (i.outstanding_amount || 0) < 0 && i.docstatus === 1)
                                  if (firstCN) openRefundDialog(firstCN)
                                  else {
                                    // Switch to invoices tab with credit notes filter
                                    setInvoiceStatus('credit_notes')
                                    setInvoiceSearch(credit.customer_name)
                                    setActiveTab('invoices')
                                  }
                                }}
                              >
                                <ArrowDownLeft className={cn('h-3 w-3', isRTL ? 'ml-1' : 'mr-1')} />
                                {t('sr.admin.payments.refund')}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => {
                                  setInvoiceStatus('credit_notes')
                                  setInvoiceSearch(credit.customer_name)
                                  setActiveTab('invoices')
                                }}
                              >
                                {t('sr.admin.payments.details')}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    })()}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* ─── Create Payment Dialog ─── */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-emerald-600" />
                {t('sr.admin.payments.create_pe')}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Invoice info */}
              {createFromInvoice && (
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                  <p className="text-xs font-semibold text-blue-700 mb-1">{t('sr.admin.payments.linked_invoice')}</p>
                  <div className="flex justify-between text-sm">
                    <span className="font-mono text-xs text-gray-500">{createFromInvoice.name}</span>
                    <span className="font-bold text-blue-700">{formatCurrency(createFromInvoice.outstanding_amount || 0)} {t('sr.admin.payments.outstanding_suffix')}</span>
                  </div>
                </div>
              )}

              {/* Customer (only when no invoice selected) */}
              {!createFromInvoice && (
                <div>
                  <Label className="text-sm font-semibold">{t('sr.admin.common.customer')} *</Label>
                  <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder={t('sr.admin.common.select_customer')} /></SelectTrigger>
                    <SelectContent>
                      {customers.map(c => (
                        <SelectItem key={c.name} value={c.name}>{c.customer_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Amount */}
              <div>
                <Label className="text-sm font-semibold">{t('sr.admin.payments.amount_sar')} *</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={payForm.amount}
                  onChange={(e) => setPayForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="mt-1 text-lg font-bold"
                  dir="ltr"
                />
              </div>

              {/* Mode of Payment */}
              <div>
                <Label className="text-sm font-semibold">{t('sr.admin.payments.mode_of_payment')}</Label>
                <Select value={payForm.mode_of_payment} onValueChange={(v) => setPayForm(prev => ({ ...prev, mode_of_payment: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t('sr.admin.payments.select_mode')} /></SelectTrigger>
                  <SelectContent>
                    {modesOfPayment.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reference No */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-semibold">{t('sr.admin.payments.reference_no')}</Label>
                  <Input
                    placeholder={t('sr.admin.payments.cheque_transfer_no')}
                    value={payForm.reference_no}
                    onChange={(e) => setPayForm(prev => ({ ...prev, reference_no: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold">{t('sr.admin.payments.reference_date')}</Label>
                  <Input
                    type="date"
                    value={payForm.reference_date}
                    onChange={(e) => setPayForm(prev => ({ ...prev, reference_date: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Posting Date */}
              <div>
                <Label className="text-sm font-semibold">{t('sr.admin.payments.posting_date')}</Label>
                <Input
                  type="date"
                  value={payForm.posting_date}
                  onChange={(e) => setPayForm(prev => ({ ...prev, posting_date: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={creating}>
                {t('sr.admin.common.cancel')}
              </Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleCreatePayment} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CreditCard className="h-4 w-4 mr-1" />}
                {creating ? t('sr.admin.payments.creating') : t('sr.admin.payments.create_submit')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Delete Confirmation Dialog ─── */}
        <Dialog open={!!deletingPE} onOpenChange={(open) => { if (!open) setDeletingPE(null) }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-red-600 flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                {t('sr.admin.payments.delete_pe')}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600">
              {t('sr.admin.payments.delete_confirm').replace('{name}', deletingPE || '')}
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDeletingPE(null)} disabled={deleting}>
                {t('sr.admin.common.cancel')}
              </Button>
              <Button variant="destructive" onClick={handleDeletePE} disabled={deleting}>
                {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                {deleting ? t('sr.admin.payments.deleting') : t('sr.admin.common.delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Refund Dialog ─── */}
        <Dialog open={showRefundDialog} onOpenChange={(open) => { if (!open) { setShowRefundDialog(false); setRefundInvoice(null) } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowDownLeft className="h-5 w-5 text-purple-600" />
                {t('sr.admin.payments.refund_to_customer')}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {refundInvoice && (
                <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                  <p className="text-xs font-semibold text-purple-700 mb-1">{t('sr.admin.payments.credit_note')}</p>
                  <div className="flex justify-between text-sm">
                    <span className="font-mono text-xs text-gray-500">{refundInvoice.name}</span>
                    <span className="font-bold text-purple-700">{formatCurrency(Math.abs(refundInvoice.outstanding_amount || 0))} {t('sr.admin.payments.owed_suffix')}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{t('sr.admin.common.customer_colon')} {refundInvoice.customer_name || refundInvoice.customer}</p>
                </div>
              )}

              <div>
                <Label className="text-sm font-semibold">{t('sr.admin.payments.refund_amount_sar')} *</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={refundForm.amount}
                  onChange={(e) => setRefundForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="mt-1 text-lg font-bold"
                  dir="ltr"
                />
              </div>

              <div>
                <Label className="text-sm font-semibold">{t('sr.admin.payments.mode_of_payment')}</Label>
                <Select value={refundForm.mode_of_payment} onValueChange={(v) => setRefundForm(prev => ({ ...prev, mode_of_payment: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t('sr.admin.payments.select_mode')} /></SelectTrigger>
                  <SelectContent>
                    {modesOfPayment.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-semibold">{t('sr.admin.payments.reference_no')}</Label>
                  <Input
                    placeholder={t('sr.admin.payments.transfer_no')}
                    value={refundForm.reference_no}
                    onChange={(e) => setRefundForm(prev => ({ ...prev, reference_no: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold">{t('sr.admin.payments.posting_date')}</Label>
                  <Input
                    type="date"
                    value={refundForm.posting_date}
                    onChange={(e) => setRefundForm(prev => ({ ...prev, posting_date: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setShowRefundDialog(false); setRefundInvoice(null) }} disabled={creatingRefund}>
                {t('sr.admin.common.cancel')}
              </Button>
              <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleCreateRefund} disabled={creatingRefund}>
                {creatingRefund ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ArrowDownLeft className="h-4 w-4 mr-1" />}
                {creatingRefund ? t('sr.admin.payments.processing') : t('sr.admin.payments.process_refund')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
