'use client'

import { useEffect, useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Loader2, AlertTriangle, FileText, Printer, ScrollText } from 'lucide-react'
import { buildStatementHtml, type StatementView } from './property-statement-html'
import { printHtmlContent } from './print-doc'
import { PropertyStatementView } from './property-statement-view'
import { getPropertyStatement } from '@/lib/rentals/property-statement-data'

// Ported from egarsys src/components/property-statement-dialog.tsx — the per-property
// كشف حساب عقار dialog. Reads the mirror via lib/rentals/property-statement-data
// (no server round-trip) and prints the same official layout (buildStatementHtml).

export function PropertyStatementDialog({
  propertyId,
  open,
  onOpenChange,
  onOpenLedger,
}: {
  propertyId: string | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onOpenLedger?: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<StatementView | null>(null)

  const load = useCallback(async () => {
    if (!propertyId) return
    setLoading(true)
    setError(null)
    try {
      const res = await getPropertyStatement(propertyId)
      if (!res) throw new Error('لم يتم العثور على العقار')
      setData(res)
    } catch (e) {
      setError((e as Error)?.message || 'تعذّر تحميل كشف الحساب')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [propertyId])

  useEffect(() => {
    if (open && propertyId) load()
    if (!open) setData(null)
  }, [open, propertyId, load])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pl-7">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-emerald-600" />
              كشف حساب عقار
            </DialogTitle>
            <div className="flex items-center gap-2">
              {onOpenLedger && data && !loading && (
                <button
                  type="button"
                  onClick={onOpenLedger}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                >
                  <ScrollText className="h-4 w-4" /> سجل الحركات
                </button>
              )}
              {data && !loading && (
                <button
                  type="button"
                  onClick={() => printHtmlContent(buildStatementHtml(data))}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <Printer className="h-4 w-4" /> طباعة
                </button>
              )}
            </div>
          </div>
          <DialogDescription className="sr-only">كشف حساب العقار المالي التفصيلي</DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> جارٍ تحميل كشف الحساب…
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            <AlertTriangle className="h-5 w-5 shrink-0" /> {error}
          </div>
        )}

        {data && !loading && <PropertyStatementView data={data} />}
      </DialogContent>
    </Dialog>
  )
}
