"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Banknote, CreditCard, Building2, CheckCircle2, ArrowLeft, Send, Lock, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Numpad } from "./numpad"
import {
  paymentState,
  upsertEntry,
  settleEntry,
  removeEntry,
  annotateEntry,
  isSettled,
  applyNumpadKeystroke,
} from "@/lib/cashier/payment-math"
import { isCardMode, isCashMode } from "@/lib/cashier/payment-modes"
import { loadTerminalConfig, routesToTerminal } from "@/lib/cashier/terminal/config"
import { TerminalDialog, type TerminalSettlement } from "./terminal-dialog"
import type { PaymentEntry } from "@/lib/cashier-api"
import { fmtCurrency, setCashierCurrency } from "@/lib/cashier-utils"
import { useI18n } from "@/lib/i18n"
import { paymentMethodLabel } from "@/lib/cashier/payment-labels"

interface PaymentMethod {
  mode_of_payment: string
  default: number
}

interface PaymentPanelProps {
  grandTotal: number
  paymentMethods: PaymentMethod[]
  entries: PaymentEntry[]
  onChange: (entries: PaymentEntry[]) => void
  onConfirm: () => void
  loading?: boolean
  currency?: string  // G10
  /** Active shift — journalled with every card charge so the close-out can match it. */
  sessionId?: string
  cashierName?: string
}

export function PaymentPanel({
  grandTotal,
  paymentMethods,
  entries,
  onChange,
  onConfirm,
  loading,
  currency,
  sessionId,
  cashierName,
}: PaymentPanelProps) {
  const { t, lang } = useI18n()
  // L7 fix: derive default mode reactively, not just on mount
  const defaultMode = useMemo(() => {
    const def = paymentMethods.find(m => m.default)
    return def?.mode_of_payment ?? paymentMethods[0]?.mode_of_payment ?? ""
  }, [paymentMethods])

  // Sync currency to global fmtCurrency helper
  useEffect(() => {
    if (currency) setCashierCurrency(currency)
  }, [currency])

  const [activeMode, setActiveMode] = useState(defaultMode)
  const [numpadValue, setNumpadValue] = useState("0")
  const [cardRef, setCardRef] = useState("")

  // Per-till terminal config. Read once: it is changed on the settings screen, which
  // remounts this panel, and re-reading it every render would thrash localStorage.
  const terminalCfg = useMemo(() => loadTerminalConfig(), [])
  const [terminalCharge, setTerminalCharge] = useState<{ mode: string; amount: number } | null>(null)
  /** Modes the cashier explicitly backed out of, so auto-send does not re-fire on them. */
  const [autoSendBlocked, setAutoSendBlocked] = useState<string[]>([])

  const activeEntry = entries.find(e => e.mode_of_payment === activeMode)
  const activeIsSettled = isSettled(activeEntry)
  const activeUsesTerminal = routesToTerminal(activeMode, terminalCfg)

  // L7 fix: update activeMode when settings finally load
  useEffect(() => {
    if (defaultMode && !activeMode) {
      setActiveMode(defaultMode)
    }
  }, [defaultMode, activeMode])

  const { totalPaid, remaining, change, isComplete } = paymentState(entries, grandTotal)

  // Prefill the suggested amount ONLY when the active mode changes. Re-running this on
  // every entries/remaining change locked the field to the total (erase → snap back).
  // The prefill is "pristine": the first keystroke REPLACES it (see payment-math.ts),
  // so overpay for cash change is one natural gesture — total 27.25, key "5","0" → 50.
  const pristineRef = useRef(true)
  useEffect(() => {
    const curr = entries.find(e => e.mode_of_payment === activeMode)
    setNumpadValue(curr ? String(curr.amount) : remaining > 0 ? remaining.toFixed(2) : "0")
    pristineRef.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMode])

  /**
   * The feature the client asked for: choosing «شبكة» pushes the amount to the terminal
   * on its own, so the cashier keys nothing and cannot mistype it.
   *
   * Guarded so it fires once per selection — not when the mode is already paid, not
   * after the cashier backed out of it, and never for a zero balance.
   */
  useEffect(() => {
    if (!activeUsesTerminal || !terminalCfg.autoSend) return
    if (terminalCharge || activeIsSettled) return
    if (autoSendBlocked.indexOf(activeMode) !== -1) return
    if (remaining <= 0) return
    setTerminalCharge({ mode: activeMode, amount: remaining })
    // `remaining` is deliberately excluded: it changes as other tender is entered, and
    // re-firing on it would relaunch a charge mid-transaction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMode, activeUsesTerminal, activeIsSettled, terminalCfg.autoSend])

  const applyAmount = (valueOverride?: string) => {
    const amount = parseFloat(valueOverride ?? numpadValue) || 0
    onChange(upsertEntry(entries, activeMode, amount))
  }

  const handleNumpadChange = (v: string) => {
    const r = applyNumpadKeystroke(numpadValue, v, pristineRef.current)
    pristineRef.current = r.pristine
    setNumpadValue(r.value)
    applyAmount(r.value)
  }

  // Classification lives in lib/cashier/payment-modes so «شبكة» / «مدى» / «صراف آلي»
  // are recognised as card here, at the close-out, and by the terminal router alike.
  const getIcon = (mode: string) => {
    if (isCashMode(mode)) return <Banknote className="h-5 w-5" />
    if (isCardMode(mode)) return <CreditCard className="h-5 w-5" />
    return <Building2 className="h-5 w-5" />
  }

  const getEmoji = (mode: string) => {
    if (isCashMode(mode)) return "💵"
    if (isCardMode(mode)) return "💳"
    return "🏦"
  }

  const activeModeIsCard = isCardMode(activeMode)

  /** A confirmed approval — the amount comes from the terminal, never from the numpad. */
  const handleApproved = (settlement: TerminalSettlement) => {
    const mode = terminalCharge?.mode ?? activeMode
    onChange(settleEntry(entries, mode, settlement.reference, settlement.approvedAmount))
    setTerminalCharge(null)
  }

  const handleTerminalDismiss = () => {
    // Remember the back-out so selecting the same mode again does not instantly
    // relaunch the charge the cashier just walked away from.
    const mode = terminalCharge?.mode
    if (mode) setAutoSendBlocked(prev => (prev.indexOf(mode) === -1 ? [...prev, mode] : prev))
    setTerminalCharge(null)
  }

  /** Undo a settled card payment. The money is still with the acquirer — say so. */
  const handleRemoveSettled = () => {
    onChange(removeEntry(entries, activeMode))
    setAutoSendBlocked(prev => (prev.indexOf(activeMode) === -1 ? [...prev, activeMode] : prev))
  }

  const sendToTerminal = () => {
    if (remaining <= 0 && !activeEntry) return
    setAutoSendBlocked(prev => prev.filter(m => m !== activeMode))
    setTerminalCharge({ mode: activeMode, amount: activeEntry?.amount || remaining })
  }

  const handleCardRefChange = (value: string) => {
    setCardRef(value)
    // Previously this field was collected and silently discarded. It now rides along
    // with the payment as a manual note (it does NOT claim the money moved).
    onChange(annotateEntry(entries, activeMode, value))
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* ── Summary card ── */}
      <div className="rounded-xl bg-emerald-600 p-4 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold text-emerald-100">{t("cashier.total")}</span>
          <span className="text-2xl font-black text-white">{fmtCurrency(grandTotal)}</span>
        </div>
        <Separator className="bg-emerald-500" />
        <div className="flex justify-between text-sm">
          <span className="text-emerald-200">{t("cashier.paid")}</span>
          <span className="text-white font-semibold">{fmtCurrency(totalPaid)}</span>
        </div>
        {remaining > 0 ? (
          <div className="flex justify-between text-sm">
            <span className="text-amber-200 font-medium">{t("cashier.remaining")}</span>
            <span className="text-amber-200 font-bold text-lg">{fmtCurrency(remaining)}</span>
          </div>
        ) : change > 0 ? (
          <div className="flex justify-between items-center pt-1 border-t border-emerald-500">
            <span className="text-emerald-100 font-semibold">{t("cashier.change_due")}</span>
            <span className="text-white font-black text-xl">{fmtCurrency(change)}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-emerald-200 font-medium pt-1 border-t border-emerald-500">
            <CheckCircle2 className="h-4 w-4 text-white" />
            <span>{t("cashier.paid_in_full")}</span>
          </div>
        )}
      </div>

      {/* ── Payment method buttons (2-col grid) ── */}
      <div>
        <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">{t("cashier.payment_method")}</p>
        <div className="grid grid-cols-2 gap-2">
          {paymentMethods.map(m => {
            const isPaid = entries.find(e => e.mode_of_payment === m.mode_of_payment)
            const isActive = activeMode === m.mode_of_payment
            return (
              <button
                key={m.mode_of_payment}
                onClick={() => setActiveMode(m.mode_of_payment)}
                className={`
                  flex flex-col items-center gap-1.5 p-3 rounded-xl text-sm font-semibold border-2 transition-all
                  ${isActive
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                    : "bg-white text-slate-700 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50"
                  }
                `}
              >
                <span className="text-xl">{getEmoji(m.mode_of_payment)}</span>
                <span className="text-xs leading-tight text-center">{paymentMethodLabel(m.mode_of_payment, lang)}</span>
                {isPaid && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700"
                    }`}>
                    {fmtCurrency(isPaid.amount)}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Active mode input area ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500 font-medium">{paymentMethodLabel(activeMode, lang)}</p>
          <p className="text-2xl font-black text-slate-800">
            {fmtCurrency(parseFloat(numpadValue) || 0)}
          </p>
        </div>

        {/* ── Settled by the terminal: the figure is the acquirer's, not ours ── */}
        {activeIsSettled && activeEntry && (
          <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-3 space-y-2">
            <div className="flex items-center gap-2 text-emerald-800">
              <Lock className="h-4 w-4 shrink-0" />
              <span className="text-sm font-bold">{t("cashier.terminal.settled")}</span>
              <span className="ms-auto font-black tabular-nums">{fmtCurrency(activeEntry.amount)}</span>
            </div>
            {(activeEntry.reference?.rrn || activeEntry.reference?.maskedPan) && (
              <p dir="ltr" className="text-[11px] font-mono text-emerald-700 text-start">
                {[activeEntry.reference?.rrn && `RRN ${activeEntry.reference.rrn}`,
                  activeEntry.reference?.maskedPan &&
                    `${activeEntry.reference.scheme ?? ""} ${activeEntry.reference.maskedPan}`.trim(),
                ].filter(Boolean).join("  ·  ")}
              </p>
            )}
            {activeEntry.reference?.manual && (
              <p className="text-[11px] text-amber-700">{t("cashier.terminal.manual_badge")}</p>
            )}
            {/* Removing this line does not un-charge the card — the wording says so. */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 gap-1.5"
              onClick={handleRemoveSettled}
            >
              <X className="h-3.5 w-3.5" />
              {t("cashier.terminal.remove_settled")}
            </Button>
          </div>
        )}

        {/* ── Push to the terminal (manual trigger / retry) ── */}
        {activeUsesTerminal && !activeIsSettled && (
          <Button
            variant="outline"
            className="w-full h-12 rounded-xl border-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 gap-2 font-bold"
            disabled={remaining <= 0 && !activeEntry}
            onClick={sendToTerminal}
          >
            <Send className="h-4 w-4" />
            {t("cashier.terminal.send")} · {fmtCurrency(activeEntry?.amount || remaining)}
          </Button>
        )}

        {/* Reference note — only when this mode is NOT settled on a terminal. */}
        {activeModeIsCard && !activeIsSettled && !activeUsesTerminal && (
          <div>
            <p className="text-xs text-slate-500 mb-1.5">{t("cashier.card_ref")}</p>
            <Input
              className="h-9 text-sm rounded-xl bg-slate-50 border-slate-200"
              placeholder={t("cashier.card_ref_ph")}
              value={cardRef}
              onChange={e => handleCardRefChange(e.target.value)}
              maxLength={30}
            />
          </div>
        )}

        {/* Numpad — hidden for a settled card line, whose amount is not ours to change. */}
        {!activeIsSettled && <Numpad value={numpadValue} onChange={handleNumpadChange} />}

        {/* Prominent change display for cash */}
        {isCashMode(activeMode) && change > 0 && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center">
            <p className="text-xs text-emerald-600 font-medium">{t("cashier.change_due")}</p>
            <p className="text-3xl font-black text-emerald-700 mt-0.5">{fmtCurrency(change)}</p>
          </div>
        )}
      </div>

      <Separator />

      {/* ── Confirm button ── */}
      <Button
        size="lg"
        className="w-full h-14 text-base font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60"
        disabled={!isComplete || loading}
        onClick={onConfirm}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            {t("cashier.processing")}
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            {t("cashier.complete_sale")}
            {isComplete && change > 0
              ? ` · ${t("cashier.change")} ${fmtCurrency(change)}`
              : ""}
            <ArrowLeft className="h-4 w-4 ms-auto opacity-70" />
          </span>
        )}
      </Button>

      {terminalCharge && (
        <TerminalDialog
          open
          amount={terminalCharge.amount}
          currency={currency || "SAR"}
          mode={terminalCharge.mode}
          sessionId={sessionId}
          cashier={cashierName}
          onApproved={handleApproved}
          onDismiss={handleTerminalDismiss}
        />
      )}
    </div>
  )
}


