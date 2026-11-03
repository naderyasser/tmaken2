"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  CreditCard, Loader2, AlertCircle, RefreshCw,
  CheckCircle2, Search, DollarSign, User,
  ArrowRight, Banknote,
} from "lucide-react"
import { useSalesRep } from "@/contexts/SalesRepContext"
import { frappeClient } from "@/lib/api-client"
import { salesApi, localDateISO } from "@/lib/sales-api"
import { walletApi } from "@/lib/wallet-api"
import type { Customer } from "@/lib/sales-api"
import { useI18n } from "@/lib/i18n"
import { displayLocale } from '@/lib/sales-format'

type PaymentMode = { name: string; label: string }

interface OutstandingInvoice {
  name: string
  posting_date: string
  grand_total: number
  outstanding_amount: number
  company?: string
}

export default function PaymentsPage() {
  const { salesPerson, customers } = useSalesRep()
  const { t, lang } = useI18n()
  const dl = displayLocale(lang)

  const [step, setStep] = useState<"select" | "amount" | "confirm" | "done">("select")
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [amount, setAmount] = useState("")
  const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([])
  const [selectedMode, setSelectedMode] = useState("")
  const [referenceNo, setReferenceNo] = useState("")
  const [outstandingInvoices, setOutstandingInvoices] = useState<OutstandingInvoice[]>([])
  const [defaultCompany, setDefaultCompany] = useState("")
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ payment_entry?: string; message?: string } | null>(null)

  // Fetch Mode of Payment list and default company on mount
  useEffect(() => {
    async function loadDefaults() {
      // Fetch modes of payment (no filter — Mode of Payment may lack 'enabled' field)
      try {
        const modes = await frappeClient.getList<{ name: string }>("Mode of Payment", {
          fields: ["name"],
          limit_page_length: 50,
        })
        const modeList = modes.map((m) => ({ name: m.name, label: m.name }))
        setPaymentModes(modeList)
        if (modeList.length > 0) setSelectedMode(modeList[0].name)
      } catch (err) {
        console.warn("[Payment] Failed to fetch modes of payment:", err)
        // No fallback — leave empty so we don't send a non-existent mode name
        setPaymentModes([])
        setSelectedMode("")
      }

      // Fetch default company
      try {
        const companies = await frappeClient.getList<{ name: string }>("Company", {
          fields: ["name"],
          limit_page_length: 1,
        })
        if (companies.length > 0) setDefaultCompany(companies[0].name)
      } catch (err) {
        console.warn("[Payment] Failed to fetch company:", err)
      }
    }

    loadDefaults()
  }, [])

  const filteredCustomers = customers.filter(
    (c) =>
      c.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const loadOutstanding = useCallback(async (customerId: string) => {
    setLoadingInvoices(true)
    try {
      const invoices = await salesApi.getSalesInvoices({
        filters: [
          ["Sales Invoice", "customer", "=", customerId],
          ["Sales Invoice", "outstanding_amount", ">", 0],
          ["Sales Invoice", "docstatus", "=", 1],
        ],
        fields: ["name", "posting_date", "grand_total", "outstanding_amount", "company"],
        order_by: "posting_date asc",
      })
      setOutstandingInvoices(invoices as unknown as OutstandingInvoice[])
      // Use the company from the first invoice if we don't have one yet
      if (invoices.length > 0 && !defaultCompany) {
        const inv = invoices[0] as unknown as OutstandingInvoice
        if (inv.company) setDefaultCompany(inv.company)
      }
    } catch {
      setOutstandingInvoices([])
    } finally {
      setLoadingInvoices(false)
    }
  }, [defaultCompany])

  // ✅ Fix: sum outstanding_amount (what's actually owed) not grand_total
  const totalOutstanding = outstandingInvoices.reduce(
    (sum, inv) => sum + (inv.outstanding_amount || 0),
    0
  )

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer)
    setStep("amount")
    loadOutstanding(customer.name)
  }

  const isNonCashMode = selectedMode && !selectedMode.toLowerCase().includes("cash") && !selectedMode.includes("نقد")

  const handleSubmitPayment = async () => {
    if (!selectedCustomer || !salesPerson || !amount) return

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError(t('sr.payments.err_invalid_amount'))
      return
    }

    // Require reference_no for non-cash payment modes
    if (isNonCashMode && !referenceNo.trim()) {
      setError(t('sr.payments.err_ref_required'))
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      let peName = ""

      if (outstandingInvoices.length > 0) {
        // ── Strategy A: Outstanding invoices exist ──
        // Use get_payment_entry from the first invoice — gives a fully pre-filled PE
        const peData = await frappeClient.call(
          "erpnext.accounts.doctype.payment_entry.payment_entry.get_payment_entry",
          { dt: "Sales Invoice", dn: outstandingInvoices[0].name }
        )
        const pe = peData?.message
        if (!pe) throw new Error(t('sr.payments.err_pe_fetch'))

        // Adjust amount
        pe.paid_amount = parsedAmount
        pe.received_amount = parsedAmount

        // Set mode of payment
        if (selectedMode) pe.mode_of_payment = selectedMode
        if (referenceNo) {
          pe.reference_no = referenceNo
          pe.reference_date = localDateISO()
        }

        // Rebuild references — allocate across invoices oldest-first
        // Use outstanding_amount for allocation (ERPNext validates against it)
        pe.references = []
        let remaining = parsedAmount
        for (const inv of outstandingInvoices) {
          if (remaining <= 0) break
          const allocate = Math.min(remaining, inv.outstanding_amount)
          pe.references.push({
            reference_doctype: "Sales Invoice",
            reference_name: inv.name,
            total_amount: inv.grand_total,
            outstanding_amount: inv.outstanding_amount,
            allocated_amount: allocate,
          })
          remaining -= allocate
        }

        // Remove name so Frappe creates a new document, keep doctype
        delete pe.name
        pe.doctype = "Payment Entry"

        // Save via insert
        const insertRes = await frappeClient.call("frappe.client.insert", { doc: pe })
        peName = insertRes?.message?.name
      } else {
        // ── Strategy B: No outstanding invoices — advance payment ──
        const company = defaultCompany
        if (!company) {
          throw new Error(t('sr.payments.err_no_company'))
        }

        // Resolve paid_to (bank/cash account) via ERPNext helper
        // Try with selected mode first; if that mode has no default account, retry without mode
        let bankAcct: any = null
        try {
          const bankAcctRes = await frappeClient.call(
            "erpnext.accounts.doctype.payment_entry.payment_entry.get_default_bank_cash_account",
            { company, mode_of_payment: selectedMode || undefined }
          )
          bankAcct = bankAcctRes?.message
        } catch {
          // Mode of payment has no default account configured — fall back to company default
        }
        if (!bankAcct?.account && selectedMode) {
          try {
            const fallbackRes = await frappeClient.call(
              "erpnext.accounts.doctype.payment_entry.payment_entry.get_default_bank_cash_account",
              { company }
            )
            bankAcct = fallbackRes?.message
          } catch { /* ignore */ }
        }
        if (!bankAcct?.account) {
          throw new Error(t('sr.payments.err_no_account'))
        }

        // Resolve paid_from (receivable account) from Company defaults
        let receivableAccount = ""
        let receivableCurrency = bankAcct.account_currency || "SAR"
        try {
          const companyDoc = await frappeClient.get<any>("Company", company)
          receivableAccount = companyDoc?.data?.default_receivable_account || ""
          receivableCurrency = companyDoc?.data?.default_currency || receivableCurrency
        } catch { /* will let ERPNext try to resolve */ }

        const peDoc: Record<string, any> = {
          doctype: "Payment Entry",
          payment_type: "Receive",
          posting_date: localDateISO(),
          company,
          party_type: "Customer",
          party: selectedCustomer.name,
          paid_amount: parsedAmount,
          received_amount: parsedAmount,
          target_exchange_rate: 1,
          source_exchange_rate: 1,
          paid_to: bankAcct.account,
          paid_to_account_currency: bankAcct.account_currency || receivableCurrency,
          ...(receivableAccount ? {
            paid_from: receivableAccount,
            paid_from_account_currency: receivableCurrency,
          } : {}),
          ...(selectedMode ? { mode_of_payment: selectedMode } : {}),
          ...(referenceNo
            ? { reference_no: referenceNo, reference_date: localDateISO() }
            : {}),
        }

        const insertRes = await frappeClient.call("frappe.client.insert", { doc: peDoc })
        peName = insertRes?.message?.name
      }

      if (!peName) {
        throw new Error(t('sr.payments.err_pe_create'))
      }

      // Try to submit the Payment Entry
      let submitted = false
      try {
        const freshDoc = await frappeClient.get<any>("Payment Entry", peName)
        if (freshDoc?.data) {
          await frappeClient.call("frappe.client.submit", {
            doc: { ...freshDoc.data, doctype: "Payment Entry" },
          })
          submitted = true
        }
      } catch (err) {
        console.warn("[Payment] PE created as draft — submit failed:", err)
      }

      // Credit the sales rep's wallet
      try {
        const myWallet = await walletApi.getMyWallet()
        if (myWallet) {
          await walletApi.creditSales({
            wallet: myWallet.name,
            amount: parsedAmount,
            invoice_name: outstandingInvoices.length > 0 ? outstandingInvoices[0].name : undefined,
            customer: selectedCustomer.name,
            customer_name: selectedCustomer.customer_name || selectedCustomer.name,
            remarks: t('sr.payments.wallet_remarks').replace('{customer}', selectedCustomer.customer_name || selectedCustomer.name).replace('{pe}', peName),
          })
        }
      } catch (walletErr) {
        console.warn("[Payment] Wallet credit failed:", walletErr)
      }

      setResult({
        payment_entry: peName,
        message: submitted
          ? t('sr.payments.success_submitted')
          : t('sr.payments.success_draft').replace('{name}', peName),
      })
      setStep("done")
    } catch (err: any) {
      console.error("[Payment] Failed:", err)
      const msg = err?.message || err?.exc || t('sr.payments.err_failed')
      setError(typeof msg === "string" ? msg : t('sr.payments.err_failed_retry'))
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setStep("select")
    setSelectedCustomer(null)
    setAmount("")
    setSelectedMode(paymentModes.length > 0 ? paymentModes[0].name : "")
    setReferenceNo("")
    setOutstandingInvoices([])
    setError(null)
    setResult(null)
  }

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat(dl, {
      style: "currency",
      currency: "SAR",
      minimumFractionDigits: 2,
    }).format(n)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white pb-6 px-5 rounded-b-[2rem]">
        <div className="pt-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CreditCard className="w-6 h-6" />
              {t('sr.payments.title')}
            </h1>
            {step !== "select" && step !== "done" && (
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
                onClick={reset}
              >
                <ArrowRight className="w-4 h-4 ml-1" />
                {t('sr.payments.back')}
              </Button>
            )}
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-4">
            {[t('sr.payments.step_select'), t('sr.payments.amount'), t('sr.common.confirm')].map((label, i) => {
              const stepIndex = ["select", "amount", "confirm"].indexOf(step)
              const isActive = i <= stepIndex
              return (
                <div key={label} className="flex items-center gap-2 flex-1">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isActive ? "bg-white text-emerald-700" : "bg-white/20 text-white/60"
                      }`}
                  >
                    {i + 1}
                  </div>
                  <span className={`text-xs ${isActive ? "text-white" : "text-white/50"}`}>
                    {label}
                  </span>
                  {i < 2 && <div className="flex-1 h-0.5 bg-white/20" />}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="px-4 py-5">
        {error && (
          <Card className="p-4 bg-red-50 border-red-200 mb-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          </Card>
        )}

        {/* Step 1: Select Customer */}
        {step === "select" && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder={t('sr.payments.search_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10 h-12 rounded-xl bg-white"
              />
            </div>

            <div className="space-y-2">
              {filteredCustomers.map((customer) => (
                <Card
                  key={customer.name}
                  className="p-4 cursor-pointer hover:shadow-md transition-all border border-slate-200 rounded-2xl"
                  onClick={() => handleSelectCustomer(customer)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                      <User className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold truncate">{customer.customer_name}</h3>
                      {customer.territory && (
                        <p className="text-xs text-slate-500">{customer.territory}</p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}

              {filteredCustomers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <User className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                  <p>{t('sr.payments.no_matching')}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Enter Amount */}
        {step === "amount" && selectedCustomer && (
          <div className="space-y-4">
            <Card className="p-4 bg-emerald-50 border-emerald-200 rounded-2xl">
              <h3 className="font-bold text-lg">{selectedCustomer.customer_name}</h3>
              {loadingInvoices ? (
                <Loader2 className="w-4 h-4 animate-spin mt-2" />
              ) : outstandingInvoices.length > 0 ? (
                <div className="mt-2">
                  <p className="text-sm text-emerald-700">
                    {t('sr.payments.total_outstanding').replace('{amount}', '')}<span className="font-bold">{formatCurrency(totalOutstanding)}</span>
                  </p>
                  <div className="mt-2 space-y-1">
                    {outstandingInvoices.map((inv) => (
                      <div key={inv.name} className="flex items-center justify-between text-xs text-slate-600">
                        <span className="font-mono" dir="ltr">{inv.name}</span>
                        <span className="text-red-600 font-medium">
                          {formatCurrency(inv.outstanding_amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500 mt-1">{t('sr.payments.no_outstanding')}</p>
              )}
            </Card>

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-bold mb-2 block">{t('sr.payments.amount_sar')}</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-14 text-2xl text-center rounded-xl bg-white font-bold"
                  dir="ltr"
                />
                {totalOutstanding > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 text-emerald-600"
                    onClick={() => setAmount(totalOutstanding.toFixed(2))}
                  >
                    {t('sr.payments.fill_full').replace('{amount}', formatCurrency(totalOutstanding))}
                  </Button>
                )}
              </div>

              <div>
                <Label className="text-sm font-bold mb-2 block">{t('sr.payments.mode')}</Label>
                <Select value={selectedMode} onValueChange={setSelectedMode}>
                  <SelectTrigger aria-label={t('sr.payments.mode_placeholder')} className="h-12 rounded-xl bg-white">
                    <SelectValue placeholder={t('sr.payments.mode_placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentModes.map((mode) => (
                      <SelectItem key={mode.name} value={mode.name}>
                        {mode.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isNonCashMode && (
                <div>
                  <Label className="text-sm font-bold mb-2 block">{t('sr.payments.reference_no')} *</Label>
                  <Input
                    placeholder={t('sr.payments.reference_placeholder')}
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    className="h-12 rounded-xl bg-white"
                  />
                </div>
              )}

              <Button
                className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-lg font-bold"
                disabled={!amount || parseFloat(amount) <= 0}
                onClick={() => setStep("confirm")}
              >
                {t('sr.payments.continue')}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === "confirm" && selectedCustomer && (
          <div className="space-y-4">
            <Card className="p-6 border-2 border-emerald-200 rounded-2xl">
              <h3 className="font-bold text-lg text-center mb-4">{t('sr.payments.confirm_title')}</h3>

              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">{t('sr.common.customer')}</span>
                  <span className="font-bold">{selectedCustomer.customer_name}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">{t('sr.payments.amount')}</span>
                  <span className="font-bold text-emerald-600 text-xl">
                    {formatCurrency(parseFloat(amount))}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">{t('sr.payments.mode')}</span>
                  <span className="font-medium">{selectedMode || "—"}</span>
                </div>
                {referenceNo && (
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">{t('sr.payments.reference_no')}</span>
                    <span className="font-mono text-sm" dir="ltr">{referenceNo}</span>
                  </div>
                )}
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-14 rounded-2xl bg-transparent"
                onClick={() => setStep("amount")}
                disabled={submitting}
              >
                {t('sr.common.edit')}
              </Button>
              <Button
                className="h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 font-bold"
                onClick={handleSubmitPayment}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin ml-2" />
                ) : (
                  <Banknote className="w-5 h-5 ml-2" />
                )}
                {submitting ? t('sr.payments.submitting') : t('sr.payments.confirm_pay')}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Done */}
        {step === "done" && result && (
          <div className="text-center py-8">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">{t('sr.payments.success_title')}</h2>
            <p className="text-muted-foreground mb-2">{result.message}</p>
            {result.payment_entry && (
              <p className="text-xs text-muted-foreground font-mono mb-6" dir="ltr">
                {result.payment_entry}
              </p>
            )}

            <Button
              className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 font-bold"
              onClick={reset}
            >
              {t('sr.payments.collect_another')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
