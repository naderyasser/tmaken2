"use client"

/**
 * Offline self-check / diagnostics panel (admin & store-manager only).
 * Reports: app-shell cache state (asked from the service worker via postMessage),
 * locally-cached catalog/customer counts, queued operation count, last successful
 * sync time, and service-worker registration status.
 */

import { useCallback, useEffect, useState } from "react"
import { Activity, CheckCircle2, XCircle, RefreshCw, AlertTriangle, Loader2, PlayCircle, Wifi, Printer } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"
import { fmtCurrency } from "@/lib/cashier-utils"
import { useCashier } from "@/contexts/CashierContext"
import { cashierApi } from "@/lib/cashier-api"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { idbGetAll, STORES } from "@/lib/cashier/pos-db"
import { getSyncSnapshot, getLastSyncedAt } from "@/lib/cashier/sync"
import { buildReceiptHtml, buildTestReceipt, printHtml, getRollWidth, setRollWidth, type RollWidth } from "@/lib/cashier/print"
import { getBrandSync, printableLogo } from "@/hooks/use-brand"
import { evaluateSetup } from "@/lib/cashier/setup-check"
import { runOfflineSelfTest, type SelfTestStep } from "@/lib/cashier/selftest"

interface Diag {
  shellComplete: boolean | null   // null = SW didn't answer
  shellEntries: number
  routesCached: string[]
  catalogCount: number
  sellableCount: number
  customerCount: number
  queuedCount: number
  lastSync: string | null
  swStatus: "active" | "inactive"
}

async function askShellStatus(): Promise<{ shellComplete: boolean; totalEntries: number; routesCached: string[] } | null> {
  if (!("serviceWorker" in navigator)) return null
  const reg = await navigator.serviceWorker.getRegistration("/cashier")
  const sw = reg?.active
  if (!sw) return null
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 3000)
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type !== "cashier-shell-status") return
      clearTimeout(timeout)
      navigator.serviceWorker.removeEventListener("message", onMsg)
      resolve(e.data)
    }
    navigator.serviceWorker.addEventListener("message", onMsg)
    sw.postMessage({ type: "cashier-shell-status" })
  })
}

export function DiagnosticsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t, lang } = useI18n()
  const { settings } = useCashier()
  const [diag, setDiag] = useState<Diag | null>(null)
  const [width, setWidth] = useState<RollWidth>("80")
  useEffect(() => { setWidth(getRollWidth()) }, [])
  // (1) read-only setup detection + (2) in-app offline self-test
  const [selfTest, setSelfTest] = useState<SelfTestStep[] | null>(null)
  const [running, setRunning] = useState(false)
  const runSelfTest = async () => {
    setRunning(true)
    try { await runOfflineSelfTest(setSelfTest) } finally { setRunning(false); void run() }
  }
  // (5) pre-handover hygiene: dry-run plan, then a confirmation-guarded armed purge
  type PurgePlan = Awaited<ReturnType<typeof cashierApi.purgeTestData>>
  const [purgePlan, setPurgePlan] = useState<PurgePlan | null>(null)
  const [purging, setPurging] = useState(false)
  const [purgeConfirm, setPurgeConfirm] = useState(false)
  const [purgeResult, setPurgeResult] = useState<string | null>(null)

  const run = useCallback(async () => {
    const [shell, catalog, customers, snap, lastSync] = await Promise.all([
      askShellStatus(),
      idbGetAll(STORES.catalog),
      idbGetAll(STORES.customers),
      getSyncSnapshot(),
      getLastSyncedAt(),
    ])
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration("/cashier") : null
    setDiag({
      shellComplete: shell ? shell.shellComplete : null,
      shellEntries: shell?.totalEntries ?? 0,
      routesCached: shell?.routesCached ?? [],
      catalogCount: catalog.length,
      sellableCount: (catalog as any[]).filter(it => !(it.actual_qty != null && it.actual_qty <= 0)).length,
      customerCount: customers.length,
      queuedCount: snap.pending + snap.failed,
      lastSync,
      swStatus: reg?.active ? "active" : "inactive",
    })
  }, [])

  useEffect(() => { if (open) void run() }, [open, run])

  const Row = ({ label, value, ok }: { label: string; value: string; ok?: boolean | null }) => (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="flex items-center gap-1.5 font-semibold text-slate-800">
        {ok === true && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
        {(ok === false || ok === null) && <XCircle className="h-4 w-4 text-rose-500" />}
        {value}
      </span>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-600" />
            {t("cashier.diagnostics")}
          </DialogTitle>
        </DialogHeader>

        {/* (1) Setup check — READ-ONLY guidance for the two go-live config blockers.
            Never changes the warehouse or writes stock; just detects + instructs. */}
        {diag && (() => {
          const setup = evaluateSetup({
            sellableCount: diag.sellableCount,
            catalogCount: diag.catalogCount,
            warehouse: settings?.default_warehouse,
          })
          if (setup.ok) return null
          return (
            <div className="space-y-2">
              {setup.issues.map(issue => (
                <div key={issue.code}
                  className={`rounded-xl border p-3 ${issue.severity === "error" ? "bg-rose-50 border-rose-200" : "bg-amber-50 border-amber-200"}`}>
                  <p className={`flex items-center gap-1.5 text-sm font-bold ${issue.severity === "error" ? "text-rose-700" : "text-amber-700"}`}>
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {t(issue.titleKey)}
                  </p>
                  <p className="text-xs leading-5 text-slate-600 mt-1">{t(issue.bodyKey)}</p>
                  {issue.code === "van_warehouse" && settings?.default_warehouse && (
                    <p className="text-[11px] text-slate-500 mt-1" dir="ltr">{settings.default_warehouse}</p>
                  )}
                </div>
              ))}
            </div>
          )
        })()}

        {diag && (
          <div>
            <Row
              label={t("cashier.shell_cached")}
              ok={diag.shellComplete}
              value={diag.shellComplete === null
                ? t("cashier.no")
                : diag.shellComplete
                  ? `${t("cashier.yes")} (${diag.routesCached.length}/6)`
                  : `${t("cashier.no")} (${diag.routesCached.length}/6)`}
            />
            <Row label={t("cashier.warehouse")} value={settings?.default_warehouse || "—"} ok={!!settings?.default_warehouse} />
            <Row label={t("cashier.catalog_count")} value={String(diag.catalogCount)} ok={diag.catalogCount > 0} />
            <Row label={t("cashier.sellable_count")} value={String(diag.sellableCount)} ok={diag.sellableCount > 0} />
            <Row label={t("cashier.customers_cached")} value={String(diag.customerCount)} />
            <Row label={t("cashier.queued_count")} value={String(diag.queuedCount)} />
            <Row
              label={t("cashier.last_sync")}
              value={diag.lastSync
                ? new Date(diag.lastSync).toLocaleString(lang === "ar" ? "ar-SA" : "en-US", { dateStyle: "short", timeStyle: "short" })
                : t("cashier.never")}
            />
            <Row label={t("cashier.sw_status")} ok={diag.swStatus === "active"}
              value={diag.swStatus === "active" ? t("cashier.sw_active") : t("cashier.sw_inactive")} />
          </div>
        )}
        {/* (3) printer validation: roll width + a test print through the REAL pipeline —
            run this on the customer's actual thermal printer before go-live. */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-xs text-slate-500">{t("cashier.roll_width")}</span>
          {(["80", "58"] as RollWidth[]).map(w => (
            <Button key={w} size="sm" variant={width === w ? "default" : "outline"} className="h-8 px-3 text-xs"
              onClick={() => { setRollWidth(w); setWidth(w) }}>
              {w}mm
            </Button>
          ))}
          <Button size="sm" className="h-8 gap-1.5 text-xs ms-auto bg-emerald-600 hover:bg-emerald-700"
            onClick={() => void printHtml(buildReceiptHtml(
              // Test print carries the real logo so the cashier sees exactly what a
              // customer receipt will look like on this printer.
              { ...buildTestReceipt(lang as "ar" | "en"), logoUrl: printableLogo(getBrandSync()) },
              { width },
            ))}>
            <Printer className="h-3.5 w-3.5" />
            {t("cashier.test_print")}
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => void run()}>
            <RefreshCw className="h-3.5 w-3.5" />
            {t("cashier.refresh")}
          </Button>
        </div>

        {/* (2) in-app Offline Self-Test — proves queue→sync→drain on this device and
            cleans up the test invoice. Does NOT replace the physical airplane-mode
            checklist (docs/CASHIER_GO_LIVE_CHECKLIST.md). */}
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">{t("cashier.selftest_title")}</span>
            <Button size="sm" className="h-8 gap-1.5 text-xs ms-auto bg-sky-600 hover:bg-sky-700" disabled={running}
              onClick={() => void runSelfTest()}>
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
              {t("cashier.selftest_run")}
            </Button>
          </div>
          {selfTest && (
            <div className="space-y-1">
              {selfTest.map(step => (
                <div key={step.key} className="flex items-center gap-2 text-xs">
                  {step.status === "pass" ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    : step.status === "fail" ? <XCircle className="h-4 w-4 text-rose-500 shrink-0" />
                    : step.status === "waiting" ? <Wifi className="h-4 w-4 text-amber-500 animate-pulse shrink-0" />
                    : step.status === "running" ? <Loader2 className="h-4 w-4 text-sky-500 animate-spin shrink-0" />
                    : <span className="h-4 w-4 rounded-full border border-slate-300 shrink-0" />}
                  <span className="text-slate-700">{t(`cashier.selftest_step_${step.key}`)}</span>
                  {step.detail && (
                    <span className="text-slate-400 ms-auto truncate max-w-[45%]" dir="ltr">
                      {/^cashier\./.test(step.detail) ? t(step.detail) : step.detail}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* (5) pre-handover data hygiene — DRY-RUN FIRST, then an armed run behind a
            confirmation. Items/customers are DISABLED (reversible), only unambiguous
            test invoices are removed. */}
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">{t("cashier.purge_title")}</span>
            <Button size="sm" variant="outline" className="h-8 text-xs ms-auto" disabled={purging}
              onClick={() => { setPurging(true); setPurgeResult(null); void cashierApi.purgeTestData(true).then(p => setPurgePlan(p)).finally(() => setPurging(false)) }}>
              {t("cashier.purge_dry_run")}
            </Button>
            <Button size="sm" variant="destructive" className="h-8 text-xs" disabled={purging || !purgePlan}
              onClick={() => setPurgeConfirm(true)}>
              {t("cashier.purge_run")}
            </Button>
          </div>
          {purgePlan && (
            <div className="space-y-2">
              {/* Owner sign-off: every flagged invoice with date / total / items / WHY,
                  so the shop owner can confirm test-vs-real BEFORE the armed run. */}
              <p className="text-[11px] text-slate-500">{t("cashier.purge_review_hint")}</p>
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="grid grid-cols-[1.4fr_0.8fr_0.7fr_1.1fr] bg-slate-50 text-[10px] font-semibold text-slate-500 px-2 py-1.5" dir="ltr">
                  <span>{t("cashier.purge_invoices")}</span>
                  <span>{t("cashier.date")}</span>
                  <span className="text-end">{t("cashier.total")}</span>
                  <span>{t("cashier.purge_reason")}</span>
                </div>
                <div className="max-h-32 overflow-y-auto divide-y divide-slate-100">
                  {(purgePlan.invoice_details ?? []).length === 0 && (
                    <p className="px-2 py-2 text-[11px] text-slate-400">—</p>
                  )}
                  {(purgePlan.invoice_details ?? []).map(d => (
                    <div key={d.name} className="grid grid-cols-[1.4fr_0.8fr_0.7fr_1.1fr] px-2 py-1.5 text-[11px] text-slate-600 items-center" dir="ltr">
                      <span className="font-mono truncate" title={`${d.owner} · ${d.items.join(", ")}`}>{d.name.replace("ACC-PSINV-", "…")}</span>
                      <span className="text-slate-400">{d.posting_date}</span>
                      <span className="text-end font-semibold">{fmtCurrency(d.grand_total)}</span>
                      <span className="text-[10px] text-amber-700 truncate">
                        {d.reasons.map(r => t(`cashier.purge_reason_${r}`)).join(" · ")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="text-[11px] text-slate-600">
                <b>{t("cashier.purge_items")} ({purgePlan.items?.length ?? 0}):</b> {(purgePlan.items ?? []).join(", ") || "—"}
                {" · "}
                <b>{t("cashier.purge_customers")} ({purgePlan.customers?.length ?? 0}):</b> {(purgePlan.customers ?? []).join(", ") || "—"}
              </div>
            </div>
          )}
          {purgeResult && <p className="text-xs text-emerald-700">{purgeResult}</p>}
        </div>

        <ConfirmDialog
          open={purgeConfirm}
          onOpenChange={setPurgeConfirm}
          title={t("cashier.purge_confirm_q")}
          description={t("cashier.purge_confirm_warn")}
          confirmLabel={t("cashier.purge_run")}
          cancelLabel={t("cashier.cancel")}
          variant="destructive"
          onConfirm={() => {
            setPurgeConfirm(false); setPurging(true)
            void cashierApi.purgeTestData(false)
              .then(r => { setPurgeResult(`${t("cashier.purge_done")}: ${JSON.stringify(r.removed)}`); setPurgePlan(null); void run() })
              .finally(() => setPurging(false))
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
