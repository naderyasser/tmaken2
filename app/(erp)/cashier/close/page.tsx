"use client"

/**
 * Close Session Page — Redesigned (Phase 2 + Cash Movements)
 * Fixes: B2 (pre-fill with expected cash), D4 (multi-payment reconciliation)
 * New: Cash In/Out movements section, adjusted expected amount
 */

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  LogOut, Loader2, TrendingUp, TrendingDown, CheckCircle2,
  ShoppingBag, Receipt, RotateCcw, Wallet, AlertTriangle,
  ArrowDownCircle, ArrowUpCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SessionHeader } from "@/components/cashier/session-header"
import { useCashier } from "@/contexts/CashierContext"
import { fmtCurrency } from "@/lib/cashier-utils"
import { cashierApi, type CashMovement } from "@/lib/cashier-api"
import { accountingApi } from "@/lib/accounting-api"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useI18n } from "@/lib/i18n"

export default function CloseSessionPage() {
  const { t, dir, lang } = useI18n()
  const router = useRouter()
  const { session, settings, isLoadingSession, closeSession } = useCashier()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)

  // B8 fix: guard against no active session
  useEffect(() => {
    if (!isLoadingSession && session?.status !== "Active") {
      router.replace("/cashier")
    }
  }, [isLoadingSession, session, router])

  const paymentMethods = settings?.payment_methods ?? []
  const expectedCash = session?.expected_cash ?? 0

  // Cash movements
  const [cashMovements, setCashMovements] = useState<CashMovement[]>([])
  const totalCashIn = cashMovements.filter(m => m.type === "in").reduce((s, m) => s + m.amount, 0)
  const totalCashOut = cashMovements.filter(m => m.type === "out").reduce((s, m) => s + m.amount, 0)
  // Adjusted expected: original expected + cash_in - cash_out
  const adjustedExpectedCash = expectedCash + totalCashIn - totalCashOut

  useEffect(() => {
    if (session?.name) {
      cashierApi.getSessionCashMovements(session.name)
        .then(res => setCashMovements(res.movements || []))
        .catch(() => { })
    }
  }, [session?.name])

  // B2 fix: populate closing amounts after session loads
  const [closingAmounts, setClosingAmounts] = useState<Record<string, string>>({})

  useEffect(() => {
    if (session && paymentMethods.length > 0) {
      const initial: Record<string, string> = {}
      paymentMethods.forEach(pm => {
        const isCash =
          pm.mode_of_payment.toLowerCase().includes("cash") ||
          pm.mode_of_payment.includes("\u0646\u0642\u062F") // "نقد" (cash) — data match, kept escaped
        initial[pm.mode_of_payment] = isCash ? String(adjustedExpectedCash) : "0"
      })
      setClosingAmounts(initial)
    }
  }, [session, paymentMethods.length, adjustedExpectedCash]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateAmount = (mode: string, val: string) =>
    setClosingAmounts(prev => ({ ...prev, [mode]: val }))

  /** D4: Compute per-method rows */
  const rows = paymentMethods.map(pm => {
    const actual = parseFloat(closingAmounts[pm.mode_of_payment] || "0") || 0
    const isCash =
      pm.mode_of_payment.toLowerCase().includes("cash") ||
      pm.mode_of_payment.includes("\u0646\u0642\u062F") // "نقد" (cash) — data match, kept escaped
    const expected = isCash ? adjustedExpectedCash : 0
    return { mode: pm.mode_of_payment, actual, expected, variance: actual - expected, isCash }
  })

  const totalActual = rows.reduce((s, r) => s + r.actual, 0)
  const totalExpected = rows.reduce((s, r) => s + r.expected, 0)
  const totalVariance = totalActual - totalExpected

  const handleClose = async () => {
    setError("")
    setSubmitting(true)
    try {
      const amounts: Record<string, number> = {}
      rows.forEach(r => { amounts[r.mode] = r.actual })
      await closeSession(amounts)

      // Post JE for cash variance if non-zero
      if (totalVariance !== 0 && session?.company) {
        try {
          const allAccounts = await accountingApi.getAccounts({
            company: session.company,
            is_group: false,
          })
          const cashAcct = allAccounts.find(a => a.account_type === "Cash" && !a.is_group)
          const varianceAcct =
            allAccounts.find(a =>
              a.name.includes("Cash Shortage") ||
              a.name.includes("Cash Overage") ||
              a.name.includes("\u0639\u062C\u0632") || // "عجز" (shortage) — account-name match
              a.name.includes("\u0641\u0627\u0626\u0636") // "فائض" (overage) — account-name match
            ) ||
            allAccounts.find(
              a => !a.is_group && a.root_type === "Expense" &&
                (a.name.includes("Miscellaneous") || a.name.includes("\u0645\u062A\u0646\u0648\u0639\u0629")) // "متنوعة"
            ) ||
            allAccounts.find(
              a => !a.is_group && a.root_type === "Expense" && a.account_type === "Chargeable"
            )

          if (cashAcct && varianceAcct) {
            const accounts =
              totalVariance > 0
                ? [
                  { account: cashAcct.name, debit_in_account_currency: Math.abs(totalVariance) },
                  { account: varianceAcct.name, credit_in_account_currency: Math.abs(totalVariance) },
                ]
                : [
                  { account: varianceAcct.name, debit_in_account_currency: Math.abs(totalVariance) },
                  { account: cashAcct.name, credit_in_account_currency: Math.abs(totalVariance) },
                ]

            const je = await accountingApi.createJournalEntry({
              company: session.company,
              voucher_type: "Journal Entry",
              user_remark: `Cash variance on session close (${session.name}): ${totalVariance > 0 ? "Overage" : "Shortage"
                } of ${Math.abs(totalVariance).toFixed(2)}`,
              accounts,
            })
            await accountingApi.submitJournalEntry(je.name)
          } else {
            console.error("No Cash or Variance account found for company:", session.company)
          }
        } catch (jeErr) {
          console.error("Failed to post cash variance JE:", jeErr)
        }
      }

      router.replace("/cashier")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("cashier.close_failed"))
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
      </div>
    )
  }

  return (
    <div
      className="flex flex-col h-screen overflow-hidden bg-slate-50 [font-family:var(--font-arabic)]"
      dir={dir}
    >
      <SessionHeader />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-2xl mx-auto space-y-5">

          {/* ── Page title ── */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-rose-100 flex items-center justify-center">
              <LogOut className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800">{t("cashier.close_session")}</h1>
              <p className="text-xs text-slate-500">
                {session?.name} &nbsp;·&nbsp; {session?.user}
              </p>
            </div>
            <div className="ms-auto">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-slate-600 hover:text-slate-900"
                onClick={() => router.back()}
              >
                {t("cashier.back")}
              </Button>
            </div>
          </div>

          {/* ── Session summary KPI cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KPICard
              icon={<Wallet className="h-5 w-5 text-emerald-600" />}
              bg="bg-emerald-50"
              label={t("cashier.opening_cash")}
              value={fmtCurrency(Number(session?.opening_cash ?? 0))}
            />
            <KPICard
              icon={<ShoppingBag className="h-5 w-5 text-sky-600" />}
              bg="bg-sky-50"
              label={t("cashier.expected_adjusted")}
              value={fmtCurrency(adjustedExpectedCash)}
            />
            <KPICard
              icon={<Receipt className="h-5 w-5 text-violet-600" />}
              bg="bg-violet-50"
              label={t("cashier.drawer_total")}
              value={fmtCurrency(totalActual)}
            />
            <KPICard
              icon={
                totalVariance === 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : totalVariance > 0 ? (
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-rose-600" />
                )
              }
              bg={
                totalVariance === 0
                  ? "bg-emerald-50"
                  : totalVariance > 0
                    ? "bg-blue-50"
                    : "bg-rose-50"
              }
              label={t("cashier.total_variance")}
              value={`${totalVariance >= 0 ? "+" : ""}${fmtCurrency(Math.abs(totalVariance))}`}
              valueColor={
                totalVariance === 0
                  ? "text-emerald-600"
                  : totalVariance > 0
                    ? "text-blue-600"
                    : "text-rose-600"
              }
            />
          </div>

          {/* ── Cash Movements section ── */}
          {cashMovements.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700">{t("cashier.cash_movements_title")}</h3>
                <div className="flex items-center gap-3 text-xs font-semibold">
                  <span className="text-emerald-600 flex items-center gap-1">
                    <ArrowDownCircle className="h-3.5 w-3.5" />
                    {t("cashier.cash_in")}: {fmtCurrency(totalCashIn)}
                  </span>
                  <span className="text-rose-600 flex items-center gap-1">
                    <ArrowUpCircle className="h-3.5 w-3.5" />
                    {t("cashier.cash_out")}: {fmtCurrency(totalCashOut)}
                  </span>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {cashMovements.map((m, i) => (
                  <div key={m.name || i} className="flex items-center gap-3 px-4 py-2.5">
                    <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${m.type === "in" ? "bg-emerald-100" : "bg-rose-100"
                      }`}>
                      {m.type === "in"
                        ? <ArrowDownCircle className="h-3.5 w-3.5 text-emerald-600" />
                        : <ArrowUpCircle className="h-3.5 w-3.5 text-rose-600" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700">{m.reason}</p>
                      {m.note && <p className="text-[11px] text-slate-400 truncate">{m.note}</p>}
                    </div>
                    <span className={`text-sm font-bold ${m.type === "in" ? "text-emerald-600" : "text-rose-600"}`}>
                      {m.type === "in" ? "+" : "-"}{fmtCurrency(m.amount)}
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {m.created_at ? new Date(m.created_at).toLocaleTimeString(lang === "ar" ? "ar-SA" : "en-US", { hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Reconciliation table ── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-4 gap-0 bg-slate-50 border-b border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <span>{t("cashier.payment_method")}</span>
              <span className="text-center">{t("cashier.expected")}</span>
              <span className="text-center">{t("cashier.actual")}</span>
              <span className="text-center">{t("cashier.variance")}</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-100">
              {rows.map(r => (
                <div
                  key={r.mode}
                  className="grid grid-cols-4 gap-0 items-center px-4 py-3"
                >
                  {/* Method name */}
                  <span className="text-sm font-semibold text-slate-700">{r.mode}</span>

                  {/* Expected */}
                  <span className="text-center text-sm text-slate-500">
                    {r.isCash ? fmtCurrency(r.expected) : "—"}
                  </span>

                  {/* Actual — input */}
                  <div className="flex justify-center">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      className="w-28 h-8 text-center text-sm font-semibold rounded-lg border-slate-200 bg-slate-50 focus-visible:ring-1 focus-visible:ring-emerald-500"
                      value={closingAmounts[r.mode] ?? ""}
                      onChange={e => updateAmount(r.mode, e.target.value)}
                      placeholder="0.00"
                    />
                  </div>

                  {/* Variance badge */}
                  <div className="flex justify-center">
                    {r.isCash ? (
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${r.variance === 0
                          ? "bg-emerald-100 text-emerald-700"
                          : r.variance > 0
                            ? "bg-blue-100 text-blue-700"
                            : "bg-rose-100 text-rose-700"
                          }`}
                      >
                        {r.variance > 0 && <TrendingUp className="h-3 w-3" />}
                        {r.variance < 0 && <TrendingDown className="h-3 w-3" />}
                        {r.variance >= 0 ? "+" : ""}
                        {r.variance.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Total variance footer */}
            <div
              className={`px-4 py-3 border-t flex items-center justify-between ${totalVariance === 0
                ? "bg-emerald-50 border-emerald-200"
                : totalVariance > 0
                  ? "bg-blue-50 border-blue-200"
                  : "bg-rose-50 border-rose-200"
                }`}
            >
              <span className="text-sm font-bold text-slate-700">{t("cashier.total_variance")}</span>
              <span
                className={`text-lg font-black ${totalVariance === 0
                  ? "text-emerald-600"
                  : totalVariance > 0
                    ? "text-blue-600"
                    : "text-rose-600"
                  }`}
              >
                {totalVariance >= 0 ? "+" : ""}
                {totalVariance.toFixed(2)}
              </span>
            </div>
          </div>

          {/* ── Variance warning ── */}
          {Math.abs(totalVariance) > 0 && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800">
                {totalVariance > 0
                  ? `${t("cashier.cash_overage_of")} ${fmtCurrency(Math.abs(totalVariance))} — ${t("cashier.variance_je_note")}`
                  : `${t("cashier.cash_shortage_of")} ${fmtCurrency(Math.abs(totalVariance))} — ${t("cashier.variance_je_note")}`}
              </p>
            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          )}

          {/* ── Action buttons ── */}
          <Button
            size="lg"
            className="w-full h-14 text-base font-bold rounded-xl bg-rose-600 hover:bg-rose-700 gap-2"
            onClick={() => setConfirmOpen(true)}
            disabled={submitting}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                {t("cashier.closing_in_progress")}
              </span>
            ) : (
              <>
                <LogOut className="h-5 w-5" />
                {t("cashier.close_session")}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ── Confirmation dialog ── */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("cashier.confirm_close_title")}
        description={t("cashier.confirm_close_desc")}
        confirmLabel={t("cashier.confirm_close_yes")}
        cancelLabel={t("cashier.cancel")}
        variant="destructive"
        onConfirm={handleClose}
      />
    </div>
  )
}

function KPICard({
  icon,
  bg,
  label,
  value,
  valueColor = "text-slate-800",
}: {
  icon: React.ReactNode
  bg: string
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className={`h-9 w-9 rounded-lg ${bg} flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className={`text-base font-black ${valueColor}`}>{value}</p>
    </div>
  )
}
