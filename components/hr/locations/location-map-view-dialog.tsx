'use client'

import dynamic from 'next/dynamic'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { fmtNumber } from '@/lib/hr-format'
import { DEFAULT_LAT, DEFAULT_LNG, LOCATION_STATUS_AR, type LocationRow } from './types'

const GeofenceMapPicker = dynamic(() => import('@/components/branch/geofence-map-picker'), {
  ssr: false,
  loading: () => <div className="h-[280px] rounded-lg border border-[var(--apex-border)] bg-slate-50 animate-pulse" />,
})

/** «عرض» — read-only map preview opened from the «الموقع» column: shows the
 *  pin and radius circle but ignores drag/click (the row's own edit dialog
 *  is where the location actually changes). */
export function LocationMapViewDialog({
  row, onOpenChange,
}: {
  row: LocationRow | null
  onOpenChange: (open: boolean) => void
}) {
  if (!row) return null
  const lat = row.latitude ?? DEFAULT_LAT
  const lng = row.longitude ?? DEFAULT_LNG

  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>الموقع — {row.location_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="pointer-events-none">
            <GeofenceMapPicker
              latitude={lat}
              longitude={lng}
              radiusM={row.custom_radius_m || 0}
              onMove={() => {}}
              height="280px"
            />
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
            <dt className="text-slate-500">خط العرض</dt>
            <dd className="text-slate-800 tabular-nums" dir="ltr">{fmtNumber(lat, 6)}</dd>
            <dt className="text-slate-500">خط الطول</dt>
            <dd className="text-slate-800 tabular-nums" dir="ltr">{fmtNumber(lng, 6)}</dd>
            <dt className="text-slate-500">نطاق الموقع بالمتر</dt>
            <dd className="text-slate-800 tabular-nums">{fmtNumber(row.custom_radius_m || 0)}</dd>
            <dt className="text-slate-500">الحالة</dt>
            <dd className="text-slate-800">{LOCATION_STATUS_AR[row.custom_status || 'Active']}</dd>
          </dl>
        </div>
      </DialogContent>
    </Dialog>
  )
}
