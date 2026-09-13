"use client"

import { Clock, User, History, ArrowLeftRight, BarChart3, LogOut, Wifi, WifiOff, ShoppingBag, Languages, Banknote, FileText, Maximize, Minimize, CloudUpload, CloudAlert, RefreshCw, Activity, Moon, Boxes } from "lucide-react"
import { useCashier } from "@/contexts/CashierContext"
import { useI18n } from "@/lib/i18n"
import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { setCashierLocale } from "@/lib/cashier-utils"
import { CashMovementDialog } from "@/components/cashier/cash-movement-dialog"
import { SyncQueueDialog } from "@/components/cashier/sync-queue-dialog"
import { DiagnosticsDialog } from "@/components/cashier/diagnostics-dialog"
import { useAuth } from "@/lib/auth-context"
import { XReportDialog } from "@/components/cashier/x-report-dialog"

export function SessionHeader() {
  const { session, serverTimeOffset, isOnline, syncPendingCount, syncFailedCount, isSyncing, offlineQueueCount } = useCashier()
  const { lang, setLang, t } = useI18n()
  const router = useRouter()
  const [wallTime, setWallTime] = useState("")
  // currency strings follow the UI language (ar-SA ⇄ en-US digits)
  setCashierLocale(lang === "ar" ? "ar-SA" : "en-US")
  const [cashMovementOpen, setCashMovementOpen] = useState(false)
  const [xReportOpen, setXReportOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  const [diagOpen, setDiagOpen] = useState(false)
  const { isAdmin, isCashierManager, moduleAccess } = useAuth()

  // Track fullscreen state
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { })
    } else {
      document.exitFullscreen().catch(() => { })
    }
  }, [])

  // Live wall clock — updates every second
  useEffect(() => {
    const tick = () => {
      const now = new Date(Date.now() + serverTimeOffset)
      setWallTime(
        now.toLocaleTimeString(lang === "ar" ? "ar-SA" : "en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      )
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [serverTimeOffset, lang])

  return (
    <>
    <header className="h-14 bg-slate-900 text-white flex items-center px-4 gap-3 shrink-0 z-30 shadow-md">
      {/* Brand / Session */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
          <ShoppingBag className="h-4 w-4 text-white" />
        </div>
        <div className="hidden sm:block leading-tight min-w-0">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">{t("cashier.session")}</p>
          <p className="text-sm font-bold text-white truncate max-w-[130px]">
            {session?.name || "—"}
          </p>
        </div>
      </div>

      <div className="h-6 w-px bg-slate-700 mx-0.5 shrink-0" />

      {/* Cashier name */}
      <div className="flex items-center gap-1.5 min-w-0 shrink-0">
        <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        <span className="text-sm font-medium text-slate-200 truncate max-w-[120px]">
          {session?.user || "—"}
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Live wall clock */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Clock className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-sm font-mono font-semibold text-slate-100 tabular-nums tracking-wide">
          {wallTime || "—"}
        </span>
      </div>

      <div className="h-6 w-px bg-slate-700 mx-0.5 shrink-0" />

      {/* Connection + sync status — 4 states: online / offline / pending sync / attention.
          Clicking it forces a sync pass; it never blocks the workflow. */}
      <button
        type="button"
        onClick={() => setQueueOpen(true)}
        title={t("cashier.tap_to_sync")}
        aria-label={`${t("cashier.sync_queue")} — ${syncFailedCount > 0 ? t("cashier.status_failed") : syncPendingCount > 0 ? t("cashier.status_pending") : isOnline ? t("cashier.online") : t("cashier.offline")}`}
        className="flex items-center gap-1.5 shrink-0 rounded-lg px-1.5 py-1 hover:bg-slate-800 transition-colors"
      >
        <span
          className={`h-2 w-2 rounded-full shrink-0 transition-colors ${
            syncFailedCount > 0
              ? "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]"
              : syncPendingCount > 0
                ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                : isOnline
                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                  : "bg-red-400"
          }`}
        />
        <span className={`text-xs font-medium hidden sm:inline ${
          syncFailedCount > 0 ? "text-rose-300"
            : syncPendingCount > 0 ? "text-amber-300"
              : isOnline ? "text-emerald-300" : "text-red-300"
        }`}>
          {syncFailedCount > 0
            ? `${t("cashier.status_failed")} (${syncFailedCount})`
            : syncPendingCount > 0
              ? `${t("cashier.status_pending")} (${syncPendingCount})`
              : isOnline ? t("cashier.online") : t("cashier.offline")}
        </span>
        {isSyncing
          ? <RefreshCw className="h-3 w-3 text-amber-300 animate-spin" />
          : syncFailedCount > 0
            ? <CloudAlert className="h-3 w-3 text-rose-400" />
            : syncPendingCount > 0
              ? <CloudUpload className="h-3 w-3 text-amber-400" />
              : isOnline
                ? <Wifi className="h-3 w-3 text-emerald-400 sm:hidden" />
                : <WifiOff className="h-3 w-3 text-red-400 sm:hidden" />
        }
      </button>

      <div className="h-6 w-px bg-slate-700 mx-0.5 shrink-0" />

      {/* Quick action icons — every icon-only button carries a localized accessible
          name (aria-label + title) and a tooltip that shows on hover AND keyboard focus
          (Radix tooltips open on focus by default). */}
      <TooltipProvider delayDuration={200}>
        <div className="flex items-center gap-1.5">
          {([
            { key: "history", label: t("cashier.history"), icon: <History className="h-4 w-4" />, cls: "text-slate-200 hover:text-white", onClick: () => router.push("/cashier/history") },
            { key: "returns", label: t("cashier.returns"), icon: <ArrowLeftRight className="h-4 w-4" />, cls: "text-slate-200 hover:text-white", onClick: () => router.push("/cashier/returns") },
            { key: "reports", label: t("cashier.reports"), icon: <BarChart3 className="h-4 w-4" />, cls: "text-slate-200 hover:text-white", onClick: () => router.push("/cashier/reports") },
            // Inventory has no card of its own any more; it is reached from here. Only
            // when the tenant actually has it — otherwise this leads to a blocked page.
            ...(moduleAccess?.inventory
              ? [{ key: "inventory", label: t("cashier.inventory"), icon: <Boxes className="h-4 w-4" />, cls: "text-orange-200 hover:text-orange-100", onClick: () => router.push("/inventory") }]
              : []),
            { key: "cash", label: t("cashier.cash_movement"), icon: <Banknote className="h-4 w-4" />, cls: "text-amber-200 hover:text-amber-100", onClick: () => setCashMovementOpen(true) },
            { key: "xreport", label: t("cashier.x_report"), icon: <FileText className="h-4 w-4" />, cls: "text-sky-200 hover:text-sky-100", onClick: () => setXReportOpen(true) },
            ...(isAdmin || isCashierManager
              ? [{ key: "diag", label: t("cashier.diagnostics"), icon: <Activity className="h-4 w-4" />, cls: "text-emerald-200 hover:text-emerald-100", onClick: () => setDiagOpen(true) }]
              : []),
            { key: "fullscreen", label: isFullscreen ? t("cashier.exit_fullscreen") : t("cashier.fullscreen"), icon: isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />, cls: "text-slate-200 hover:text-white", onClick: toggleFullscreen },
            { key: "theme", label: t("cashier.dark_mode"), icon: <Moon className="h-4 w-4" />, cls: "text-violet-200 hover:text-violet-100", onClick: () => window.dispatchEvent(new Event("cashier:theme")) },
          ] as const).map(btn => (
            <Tooltip key={btn.key}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  aria-label={btn.label}
                  title={btn.label}
                  className={`h-11 min-w-[44px] px-2.5 gap-1.5 hover:bg-slate-700 rounded-lg ${btn.cls}`}
                  onClick={btn.onClick}
                >
                  {btn.icon}
                  {/* visible short label — icons alone forced memorisation; hide only on
                      narrow screens where the tooltip still names the action */}
                  <span className="hidden xl:inline text-xs font-semibold text-slate-100">{btn.label}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs bg-slate-900 text-white border-slate-700">
                {btn.label}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>

      <div className="h-6 w-px bg-slate-700 mx-0.5 shrink-0" />

      {/* Language toggle */}
      <Button
        variant="ghost"
        size="sm"
        className="h-11 gap-1 text-xs font-semibold px-2.5 text-slate-200 hover:text-white hover:bg-slate-700 shrink-0"
        onClick={() => setLang(lang === "en" ? "ar" : "en")}
        title={t("cashier.switch_language")}
        aria-label={t("cashier.switch_language")}
      >
        <Languages className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{lang === "en" ? "AR" : "EN"}</span>
      </Button>

      {/* Close session */}
      <Button
        size="sm"
        className="h-11 gap-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white border-0 px-3.5 shrink-0"
        onClick={() => router.push("/cashier/close")}
        aria-label={t("cashier.close_session")}
        title={t("cashier.close_session")}
      >
        <LogOut className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{t("cashier.close_session")}</span>
      </Button>

      {/* Dialogs */}
      <CashMovementDialog open={cashMovementOpen} onOpenChange={setCashMovementOpen} />
      <XReportDialog open={xReportOpen} onOpenChange={setXReportOpen} />
      <SyncQueueDialog open={queueOpen} onOpenChange={setQueueOpen} />
      <DiagnosticsDialog open={diagOpen} onOpenChange={setDiagOpen} />
    </header>

    {/* Always-visible connection reassurance — on EVERY cashier screen */}
    {!isOnline && (
      <div role="status" className="bg-amber-500 text-white text-center py-1.5 text-xs font-semibold flex items-center justify-center gap-2 shrink-0">
        <WifiOff className="h-3.5 w-3.5" />
        {t("cashier.offline_banner")}
      </div>
    )}
    {offlineQueueCount > 0 && isOnline && (
      <button type="button" onClick={() => setQueueOpen(true)}
        className="w-full bg-emerald-600 text-white text-center py-1 text-xs font-medium flex items-center justify-center gap-2 shrink-0 hover:bg-emerald-700">
        {isSyncing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CloudUpload className="h-3.5 w-3.5" />}
        {offlineQueueCount} {t("cashier.pending_banner")}
      </button>
    )}
    </>
  )
}

