'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ApexDialog } from './dialog'
import { frappeClient } from '@/lib/api-client'
import { fmtDateTime } from '@/lib/hr-format'

export type VersionLogDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  doctype: string
  /** `null` while no row is selected — the dialog only fetches once both are set. */
  name: string | null
}

type VersionRow = { owner: string; creation: string; changed: [string, unknown, unknown][] }

/** Apex «سجل الحركات» — Frappe `Version` rows for the doc (who / when / changed fields). */
export function VersionLogDialog({ open, onOpenChange, doctype, name }: VersionLogDialogProps) {
  const [rows, setRows] = useState<VersionRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !name) return
    setLoading(true)
    frappeClient.call<VersionRow[]>('base_meena.api.hr_lists.get_version_log', { doctype, name })
      .then((r) => setRows((r as any)?.message ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [open, doctype, name])

  return (
    <ApexDialog open={open} onOpenChange={onOpenChange} title="سجل الحركات" size="lg">
      <div className="col-span-2">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--apex-blue)]" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-[14px] text-slate-500">لا يوجد سجل حركات لهذا السجل</p>
        ) : (
          <div className="max-h-[50vh] divide-y divide-slate-100 overflow-y-auto">
            {rows.map((v, i) => (
              <div key={i} className="py-3">
                <p className="mb-1 text-[13px] text-slate-500">{v.owner} — {fmtDateTime(v.creation)}</p>
                {v.changed.length === 0 ? (
                  <p className="text-[13px] text-slate-400">إنشاء السجل</p>
                ) : (
                  <ul className="space-y-1">
                    {v.changed.map(([field, oldV, newV], j) => (
                      <li key={j} className="text-[13px] text-slate-700">
                        <span className="font-bold">{field}</span>
                        {': '}
                        <span className="text-slate-500">{String(oldV ?? '—')}</span>
                        {' ← '}
                        <span className="text-[var(--apex-green)]">{String(newV ?? '—')}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </ApexDialog>
  )
}
