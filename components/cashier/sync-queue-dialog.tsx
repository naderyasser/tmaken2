"use client"

/**
 * Sync-queue management dialog — opened from the header status badge.
 * Shows every unsynced action with its live status (pending / syncing / synced /
 * failed), a manual "Sync now", per-item retry + delete (confirmed), and admin-only
 * "Clear queue" + stale-failed cleanup, both confirmation-guarded.
 */

import { useEffect, useState, useCallback } from "react"
import { RefreshCw, Trash2, CloudUpload, AlertTriangle, CheckCircle2, Loader2, Eraser } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useI18n } from "@/lib/i18n"
import { useAuth } from "@/lib/auth-context"
import { fmtCurrency } from "@/lib/cashier-utils"
import {
  getSyncSnapshot,
  subscribeSync,
  kickSync,
  retryAction,
  discardAction,
  clearQueue,
  cleanupStaleFailed,
  type QueuedAction,
} from "@/lib/cashier/sync"

function StatusBadge({ status }: { status: QueuedAction["status"] }) {
  const { t } = useI18n()
  switch (status) {
    case "syncing":
      return <Badge className="bg-amber-100 text-amber-800 border-0 gap-1"><Loader2 className="h-3 w-3 animate-spin" />{t("cashier.status_syncing")}</Badge>
    case "failed":
      return <Badge className="bg-rose-100 text-rose-800 border-0 gap-1"><AlertTriangle className="h-3 w-3" />{t("cashier.status_failed")}</Badge>
    case "synced":
      return <Badge className="bg-emerald-100 text-emerald-800 border-0 gap-1"><CheckCircle2 className="h-3 w-3" />{t("cashier.status_synced")}</Badge>
    default:
      return <Badge className="bg-slate-100 text-slate-700 border-0">{t("cashier.status_pending")}</Badge>
  }
}

const saleTotal = (a: QueuedAction): number | null => {
  const payments = a.payload?.payments as Array<{ amount: number }> | undefined
  if (!payments?.length) return null
  return payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
}

export function SyncQueueDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t, lang } = useI18n()
  const { isAdmin, isCashierManager } = useAuth()
  const canAdmin = isAdmin || isCashierManager
  const [items, setItems] = useState<QueuedAction[]>([])
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const refresh = useCallback(() => {
    void getSyncSnapshot().then(s => { setItems(s.items); setLastSync(s.lastSyncedAt) })
  }, [])

  useEffect(() => {
    if (!open) return
    refresh()
    return subscribeSync(refresh)
  }, [open, refresh])

  const fmtTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(lang === "ar" ? "ar-SA" : "en-US", { dateStyle: "short", timeStyle: "short" }) : t("cashier.never")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CloudUpload className="h-5 w-5 text-emerald-600" />
            {t("cashier.sync_queue")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{t("cashier.last_sync")}: {fmtTime(lastSync)}</span>
          <Button size="sm" className="h-8 gap-1.5" onClick={() => void kickSync("manual")}>
            <RefreshCw className="h-3.5 w-3.5" />
            {t("cashier.sync_now")}
          </Button>
        </div>

        {items.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500 flex flex-col items-center gap-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            {t("cashier.queue_empty")}
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(a => {
              const total = saleTotal(a)
              return (
                <div key={a.id} className="rounded-xl border border-slate-200 p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">
                        {a.kind === "sale" ? t("cashier.kind_sale") : t("cashier.kind_close")}
                      </span>
                      {total != null && <span className="text-xs font-bold text-slate-600">{fmtCurrency(total)}</span>}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate" dir="ltr">
                      {new Date(a.createdAt).toLocaleString(lang === "ar" ? "ar-SA" : "en-US")} · {a.attempts} {t("cashier.attempts")}
                    </p>
                    {a.lastError && a.status === "failed" && (
                      <p className="text-[11px] text-rose-600 truncate" title={a.lastError}>{a.lastError}</p>
                    )}
                  </div>
                  <StatusBadge status={a.status} />
                  {a.status === "failed" && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" title={t("cashier.retry")} aria-label={t("cashier.retry")}
                      onClick={() => void retryAction(a.id)}>
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-500 hover:text-rose-700" title={t("cashier.delete")} aria-label={t("cashier.delete")}
                    onClick={() => setConfirmDelete(a.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}

        {canAdmin && items.length > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs"
              onClick={() => void cleanupStaleFailed().then(refresh)}>
              <Eraser className="h-3.5 w-3.5" />
              {t("cashier.cleanup_stale")}
            </Button>
            <Button size="sm" variant="destructive" className="h-8 gap-1.5 text-xs ms-auto"
              onClick={() => setConfirmClear(true)}>
              <Trash2 className="h-3.5 w-3.5" />
              {t("cashier.clear_queue")}
            </Button>
          </div>
        )}

        <ConfirmDialog
          open={!!confirmDelete}
          onOpenChange={(o) => { if (!o) setConfirmDelete(null) }}
          title={t("cashier.delete_item_q")}
          description={t("cashier.delete_item_warn")}
          confirmLabel={t("cashier.delete")}
          cancelLabel={t("cashier.cancel")}
          variant="destructive"
          onConfirm={() => { if (confirmDelete) void discardAction(confirmDelete).then(refresh); setConfirmDelete(null) }}
        />
        <ConfirmDialog
          open={confirmClear}
          onOpenChange={setConfirmClear}
          title={t("cashier.clear_queue_q")}
          description={t("cashier.clear_queue_warn")}
          confirmLabel={t("cashier.clear_queue")}
          cancelLabel={t("cashier.cancel")}
          variant="destructive"
          onConfirm={() => { void clearQueue().then(refresh); setConfirmClear(false) }}
        />
      </DialogContent>
    </Dialog>
  )
}
