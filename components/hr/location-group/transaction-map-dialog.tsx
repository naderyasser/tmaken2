'use client'

import dynamic from 'next/dynamic'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { fmtNumber } from '@/lib/hr-format'
import type { TransactionRow } from './types'

const GeofenceMapPicker = dynamic(() => import('@/components/branch/geofence-map-picker'), {
  ssr: false,
  loading: () => <div className="h-[260px] rounded-lg border border-[var(--apex-border)] bg-slate-50 animate-pulse" />,
})

/** «عرض» — read-only map preview for one البصمات row's captured GPS point
 *  (no radius circle — a punch is a point, not a geofence). Drag/click on
 *  the underlying picker are ignored; this is display-only. */
export function TransactionMapDialog({
  row, onOpenChange,
}: {
  row: TransactionRow | null
  onOpenChange: (open: boolean) => void
}) {
  if (!row || row.latitude == null || row.longitude == null) return null
  const lat = row.latitude
  const lng = row.longitude

  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>موقع البصمة — {row.employee_name || row.employee}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="pointer-events-none">
            <GeofenceMapPicker latitude={lat} longitude={lng} radiusM={0} onMove={() => {}} height="260px" />
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
            <dt className="text-slate-500">خط العرض</dt>
            <dd className="text-slate-800 tabular-nums" dir="ltr">{fmtNumber(lat, 6)}</dd>
            <dt className="text-slate-500">خط الطول</dt>
            <dd className="text-slate-800 tabular-nums" dir="ltr">{fmtNumber(lng, 6)}</dd>
          </dl>
        </div>
      </DialogContent>
    </Dialog>
  )
}
