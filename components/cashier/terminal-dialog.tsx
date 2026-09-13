"use client"

/**
 * Card-terminal transaction dialog.
 *
 * This is the whole point of the feature from the cashier's side: pick «شبكة», the
 * amount is already on the terminal, and the customer taps. Nothing is keyed.
 *
 * The dialog is modal and non-dismissable while a charge is live — clicking the
 * backdrop must never abandon a transaction that is debiting someone's card. The only
 * ways out are the terminal's verdict, or an explicit Cancel that is itself relayed to
 * the terminal.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Loader2,
  RotateCcw,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { fmtCurrency } from "@/lib/cashier-utils"
import { useI18n } from "@/lib/i18n"
import { chargeCard } from "@/lib/cashier/terminal/flow"
import { loadTerminalConfig } from "@/lib/cashier/terminal/config"
import type {
  TerminalPhase,
  TerminalProgress,
  TerminalResult,
} from "@/lib/cashier/terminal/types"
import type { PaymentReference } from "@/lib/cashier-api"

export interface TerminalSettlement {
  reference: PaymentReference
  approvedAmount: number
}

interface TerminalDialogProps {
  open: boolean
  /** Amount to push to the terminal. */
  amount: number
  currency: string
  /** Mode of Payment being settled — journalled with the charge. */
  mode: string
  sessionId?: string
  cashier?: string
  /** Fired ONLY on a confirmed approval. */
  onApproved: (settlement: TerminalSettlement) => void
  /** Fired when the cashier gives up — the sale keeps its previous state. */
  onDismiss: () => void
}

type Stage = "charging" | "approved" | "rejected" | "attention" | "manual"

const PHASE_KEY: Record<TerminalPhase, string> = {
  connecting: "cashier.terminal.phase_connecting",
  sent: "cashier.terminal.phase_sent",
  waiting_card: "cashier.terminal.phase_waiting_card",
  processing: "cashier.terminal.phase_processing",
  done: "cashier.terminal.phase_done",
}

/** Build the reference we hand to the invoice from a terminal verdict. */
function referenceFromResult(result: TerminalResult): PaymentReference {
  return {
    rrn: result.rrn,
    authCode: result.authCode,
    maskedPan: result.maskedPan,
    scheme: result.scheme,
    cardType: result.cardType,
    terminalId: result.terminalId,
    merchantId: result.merchantId,
    stan: result.stan,
    batchNo: result.batchNo,
    responseCode: result.responseCode,
    approvedAmount: result.approvedAmount,
    at: result.at,
    clientRef: result.clientRef,
  }
}

export function TerminalDialog({
  open,
  amount,
  currency,
  mode,
  sessionId,
  cashier,
  onApproved,
  onDismiss,
}: TerminalDialogProps) {
  const { t, dir } = useI18n()
  const [stage, setStage] = useState<Stage>("charging")
  const [progress, setProgress] = useState<TerminalProgress>({ phase: "connecting" })
  const [result, setResult] = useState<TerminalResult | null>(null)
  const [journalWarning, setJournalWarning] = useState(false)
  const [manualRef, setManualRef] = useState("")
  const abortRef = useRef<AbortController | null>(null)
  /** Guards against a late verdict from an abandoned attempt overwriting a newer one. */
  const attemptRef = useRef(0)

  const run = useCallback(async () => {
    const attempt = ++attemptRef.current
    const controller = new AbortController()
    abortRef.current = controller
    setStage("charging")
    setResult(null)
    setProgress({ phase: "connecting" })

    const outcome = await chargeCard({
      amount,
      currency,
      mode,
      sessionId,
      cashier,
      signal: controller.signal,
      onProgress: p => {
        if (attemptRef.current === attempt) setProgress(p)
      },
    })

    if (attemptRef.current !== attempt) return // a retry superseded this attempt

    setResult(outcome.result)
    setJournalWarning(!outcome.journaled)

    if (outcome.approved) {
      setStage("approved")
      // The approval is the source of truth for how much was actually taken.
      onApproved({
        reference: referenceFromResult(outcome.result),
        approvedAmount: outcome.result.approvedAmount ?? amount,
      })
      return
    }
    setStage(outcome.needsAttention ? "attention" : "rejected")
  }, [amount, currency, mode, sessionId, cashier, onApproved])

  // Start on open; abort anything still running when the dialog goes away.
  useEffect(() => {
    if (!open) return
    void run()
    return () => {
      attemptRef.current++
      abortRef.current?.abort()
    }
    // `run` is stable for a given charge; re-running it on identity change would
    // double-charge the customer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const cfg = loadTerminalConfig()
  const busy = stage === "charging"

  const handleCancel = () => {
    abortRef.current?.abort()
  }

  const submitManual = () => {
    const ref = manualRef.trim()
    if (!ref) return
    onApproved({
      reference: { rrn: ref, manual: true, at: new Date().toISOString() },
      approvedAmount: amount,
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        // Never let a click-away abandon a live charge.
        if (!next && !busy) onDismiss()
      }}
    >
      <DialogContent
        dir={dir}
        // While a charge is live the X is hidden too, so the ONLY exit is a cancel that
        // is relayed to the terminal. (DialogContent always renders its own absolutely
        // positioned close button; this targets exactly that one, not our buttons.)
        className={`sm:max-w-[420px] ${busy ? "[&>button.absolute]:hidden" : ""}`}
        onPointerDownOutside={e => busy && e.preventDefault()}
        onEscapeKeyDown={e => busy && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-5 w-5 text-emerald-600" />
            {t("cashier.terminal.title")}
          </DialogTitle>
        </DialogHeader>

        {/* The amount, big — it is what the customer is being asked to approve. */}
        <div className="rounded-xl bg-slate-900 p-4 text-center">
          <p className="text-xs font-medium text-slate-400">{t("cashier.terminal.amount_on_device")}</p>
          <p className="mt-1 text-4xl font-black text-white tabular-nums">
            {fmtCurrency(amount)}
          </p>
          <p className="mt-1 text-xs text-slate-400">{mode}</p>
        </div>

        {stage === "charging" && (
          <div className="space-y-3 py-2 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-600" />
            <p className="text-sm font-semibold text-slate-800">
              {t(PHASE_KEY[progress.phase])}
            </p>
            {progress.message && (
              <p className="text-xs text-slate-500">{progress.message}</p>
            )}
            <p className="text-xs text-slate-400">{t("cashier.terminal.do_not_close")}</p>
            <Button variant="outline" className="w-full" onClick={handleCancel}>
              {t("cashier.terminal.cancel_on_device")}
            </Button>
          </div>
        )}

        {stage === "approved" && result && (
          <div className="space-y-2 py-2 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
            <p className="text-lg font-bold text-emerald-700">{t("cashier.terminal.approved")}</p>
            <ApprovalDetail result={result} />
            {journalWarning && (
              <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
                {t("cashier.terminal.journal_warning")}
              </p>
            )}
          </div>
        )}

        {stage === "rejected" && result && (
          <div className="space-y-3 py-2 text-center">
            <XCircle className="mx-auto h-10 w-10 text-red-500" />
            <p className="text-lg font-bold text-red-600">
              {result.outcome === "cancelled"
                ? t("cashier.terminal.cancelled")
                : t("cashier.terminal.declined")}
            </p>
            {result.message && <p className="text-sm text-slate-600">{result.message}</p>}
            <p className="text-xs text-slate-400">{t("cashier.terminal.nothing_charged")}</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onDismiss}>
                {t("cashier.terminal.back")}
              </Button>
              <Button className="flex-1 gap-1.5" onClick={() => void run()}>
                <RotateCcw className="h-4 w-4" />
                {t("cashier.terminal.retry")}
              </Button>
            </div>
          </div>
        )}

        {stage === "attention" && result && (
          <div className="space-y-3 py-2">
            <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
            <p className="text-center text-base font-bold text-amber-700">
              {t("cashier.terminal.unknown_title")}
            </p>
            {/* The cashier must look at the physical terminal — we genuinely cannot tell. */}
            <p className="rounded-lg bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
              {t("cashier.terminal.unknown_body")}
            </p>
            {result.message && (
              <p className="text-center text-xs text-slate-500">{result.message}</p>
            )}
            <div className="flex flex-col gap-2">
              <Button variant="outline" onClick={() => setStage("manual")}>
                {t("cashier.terminal.was_approved")}
              </Button>
              <Button variant="outline" onClick={() => void run()} className="gap-1.5">
                <RotateCcw className="h-4 w-4" />
                {t("cashier.terminal.was_not_approved")}
              </Button>
              <Button variant="ghost" onClick={onDismiss}>
                {t("cashier.terminal.decide_later")}
              </Button>
            </div>
          </div>
        )}

        {stage === "manual" && (
          <div className="space-y-3 py-2">
            <Label className="text-sm font-semibold">
              {t("cashier.terminal.manual_ref_label")}
            </Label>
            <p className="text-xs text-slate-500">{t("cashier.terminal.manual_ref_help")}</p>
            <Input
              autoFocus
              inputMode="numeric"
              dir="ltr"
              className="text-center text-lg tracking-wider"
              placeholder={t("cashier.terminal.manual_ref_ph")}
              value={manualRef}
              maxLength={30}
              onChange={e => setManualRef(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submitManual()}
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStage("attention")}>
                {t("cashier.terminal.back")}
              </Button>
              <Button className="flex-1" disabled={!manualRef.trim()} onClick={submitManual}>
                {t("cashier.terminal.confirm_manual")}
              </Button>
            </div>
          </div>
        )}

        {/* Escape hatch while the terminal is unreachable, if the tenant allows it. */}
        {stage === "rejected" && cfg.allowManualFallback && (
          <Button variant="ghost" className="text-xs" onClick={() => setStage("manual")}>
            {t("cashier.terminal.enter_manually")}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ApprovalDetail({ result }: { result: TerminalResult }) {
  const rows: Array<[string, string | undefined]> = [
    ["RRN", result.rrn],
    ["AUTH", result.authCode],
    [result.scheme ?? "CARD", result.maskedPan],
  ]
  const shown = rows.filter(([, v]) => !!v)
  if (shown.length === 0) return null
  return (
    <div dir="ltr" className="mx-auto w-fit space-y-0.5 rounded-lg bg-slate-50 px-3 py-2 text-xs font-mono text-slate-600">
      {shown.map(([k, v]) => (
        <p key={k}>
          <span className="text-slate-400">{k}</span> {v}
        </p>
      ))}
    </div>
  )
}
