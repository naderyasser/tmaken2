"use client"

/**
 * Unresolved card charges — the safety net made visible.
 *
 * The terminal journal records money the till believes may have left the customer's
 * card without an invoice behind it. That record is worthless if nobody sees it, so
 * this mounts on every cashier screen: it sweeps crashed charges on boot, then keeps a
 * banner up until each one has been accounted for.
 *
 * Nothing here moves money. A charge is closed by a person reading the terminal slip
 * and saying what happened — we only make sure they are asked.
 */

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { fmtCurrency } from "@/lib/cashier-utils"
import { useI18n } from "@/lib/i18n"
import { recoverPendingCharges } from "@/lib/cashier/terminal/flow"
import { listOpenTxns, resolveTxn, type TerminalRecord } from "@/lib/cashier/terminal/store"
import { loadTerminalConfig } from "@/lib/cashier/terminal/config"
import { useAuth } from "@/lib/auth-context"

/** Only records a human still has to answer for. An approved-and-invoiced charge is done. */
function needsAnswer(rec: TerminalRecord): boolean {
  return rec.state === "unresolved" || (rec.state === "approved" && !rec.invoice)
}

export function TerminalRecovery() {
  const { t } = useI18n()
  const { user } = useAuth()
  const [records, setRecords] = useState<TerminalRecord[]>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notes, setNotes] = useState<Record<string, string>>({})

  const refresh = useCallback(async () => {
    setRecords((await listOpenTxns()).filter(needsAnswer))
  }, [])

  useEffect(() => {
    if (!loadTerminalConfig().enabled) return
    let alive = true
    // Boot sweep: anything left "in flight" means the tab died mid-charge. Ask the
    // terminal what really happened before bothering the cashier about it.
    // Refresh either way: a driver that cannot answer still leaves records to show.
    const settle = () => { if (alive) void refresh() }
    void recoverPendingCharges().then(settle, settle)
    return () => { alive = false }
  }, [refresh])

  const resolve = async (rec: TerminalRecord) => {
    const note = (notes[rec.clientRef] ?? "").trim()
    if (!note) return
    setBusy(true)
    try {
      await resolveTxn(rec.clientRef, user?.email ?? "unknown", note)
      setNotes(prev => {
        const next = { ...prev }
        delete next[rec.clientRef]
        return next
      })
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  if (records.length === 0) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 bg-red-600 px-4 py-2 text-start text-sm font-semibold text-white hover:bg-red-700"
      >
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {t("cashier.terminal.recovery.banner").replace("{n}", String(records.length))}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="text-base">{t("cashier.terminal.recovery.title")}</DialogTitle>
          </DialogHeader>

          <p className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
            {t("cashier.terminal.recovery.help")}
          </p>

          <div className="max-h-[50vh] space-y-3 overflow-y-auto">
            {records.map(rec => (
              <div key={rec.clientRef} className="rounded-lg border border-slate-200 p-3 space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-black tabular-nums">{fmtCurrency(rec.amount)}</span>
                  <span className="text-xs text-slate-500">
                    {new Date(rec.startedAt).toLocaleString("en-GB")}
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  {t(`cashier.terminal.recovery.state_${rec.state}`)}
                  {rec.note ? ` — ${rec.note}` : ""}
                </p>
                {rec.result?.rrn && (
                  <p dir="ltr" className="text-[11px] font-mono text-slate-500">RRN {rec.result.rrn}</p>
                )}
                {rec.invoice && (
                  <p dir="ltr" className="text-[11px] font-mono text-slate-500">{rec.invoice}</p>
                )}
                <div className="flex gap-2">
                  <Input
                    className="h-8 text-xs"
                    placeholder={t("cashier.terminal.recovery.note_ph")}
                    value={notes[rec.clientRef] ?? ""}
                    onChange={e => setNotes(prev => ({ ...prev, [rec.clientRef]: e.target.value }))}
                  />
                  <Button
                    size="sm"
                    className="h-8 shrink-0"
                    disabled={busy || !(notes[rec.clientRef] ?? "").trim()}
                    onClick={() => void resolve(rec)}
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("cashier.terminal.recovery.resolve")}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-slate-400">{t("cashier.terminal.recovery.footer")}</p>
        </DialogContent>
      </Dialog>
    </>
  )
}
