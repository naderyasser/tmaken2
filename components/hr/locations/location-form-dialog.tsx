'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { arabizeError } from '@/lib/frappe-error'
import { ApexDialog } from '@/components/hr/apex/dialog'
import {
  DEFAULT_LAT, DEFAULT_LNG, DEFAULT_RADIUS_M,
  type LocationGroupOption, type LocationRow,
} from './types'

const GeofenceMapPicker = dynamic(() => import('@/components/branch/geofence-map-picker'), {
  ssr: false,
  loading: () => <div className="h-[300px] rounded border border-[var(--apex-border)] bg-slate-50 animate-pulse" />,
})

const FIELD = 'h-[42px] w-full rounded border border-[var(--apex-border)] bg-white px-3 text-[14px] text-slate-800 outline-none focus:border-[var(--apex-blue)]'

/**
 * Apex «اضافة المواقع» (app-add-modal, agm-map): اسم بالعربيه* · اسم بالانجليزية ·
 * المسافة* · الحالة (نشط / غير نشط), then the map with a marker. On «اضافة» the
 * browser's own location is requested straight away (Apex does the same) so
 * the pin starts where the user stands; the map click/drag still moves it.
 * A location's group (مجموعات المواقع) is managed on that screen and kept as is.
 */
export function LocationFormDialog({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: LocationRow | null
  groups?: LocationGroupOption[]
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [nameAr, setNameAr] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [lat, setLat] = useState(DEFAULT_LAT)
  const [lng, setLng] = useState(DEFAULT_LNG)
  const [radius, setRadius] = useState(String(DEFAULT_RADIUS_M))
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setNameAr(editing?.location_name || '')
    setNameEn(editing?.custom_name_en || '')
    setLat(editing?.latitude ?? DEFAULT_LAT)
    setLng(editing?.longitude ?? DEFAULT_LNG)
    setRadius(String(editing?.custom_radius_m ?? DEFAULT_RADIUS_M))
    setStatus((editing?.custom_status as 'Active' | 'Inactive') || 'Active')
    // new location → ask the browser where we are (the permission prompt Apex shows)
    if (!editing && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { setLat(Number(pos.coords.latitude.toFixed(6))); setLng(Number(pos.coords.longitude.toFixed(6))) },
        () => { /* denied / unavailable — keep the default centre */ },
        { enableHighAccuracy: true, timeout: 10000 },
      )
    }
  }, [open, editing])

  const save = async () => {
    const name = nameAr.trim()
    if (!name) { toast({ title: 'اسم بالعربيه مطلوب', variant: 'destructive' }); return }
    if (!/^\d+$/.test(radius) || Number(radius) <= 0) { toast({ title: 'المسافة مطلوبة', description: 'أدخل رقماً موجباً بالمتر', variant: 'destructive' }); return }
    setSaving(true)
    try {
      await frappeClient.call('base_meena.api.hr_locations.save_location', {
        name: editing?.name,
        location_name: name,
        custom_name_en: nameEn.trim(),
        parent_location: editing?.parent_location || undefined,
        latitude: lat,
        longitude: lng,
        custom_radius_m: Number(radius),
        custom_status: status,
      })
      toast({ title: editing ? 'تم التعديل' : 'تمت الإضافة' })
      onOpenChange(false)
      onSaved()
    } catch (e: any) {
      toast({ title: 'فشل الحفظ', description: arabizeError(e?.message), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <ApexDialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}
      title={editing ? 'تعديل المواقع' : 'اضافة المواقع'} size="lg"
      primary={{ label: editing ? 'تعديل' : 'اضافة', onClick: save, loading: saving }}>
      <div>
        <label className="block text-[13px] text-slate-700 mb-1">اسم بالعربيه <span className="text-red-500">*</span></label>
        <input value={nameAr} onChange={(e) => setNameAr(e.target.value)} className={FIELD} />
      </div>
      <div>
        <label className="block text-[13px] text-slate-700 mb-1">اسم بالانجليزية</label>
        <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} dir="ltr" className={`${FIELD} text-right`} />
      </div>
      <div>
        <label className="block text-[13px] text-slate-700 mb-1">المسافة <span className="text-red-500">*</span></label>
        <input value={radius} inputMode="numeric" onChange={(e) => setRadius(e.target.value.replace(/[^\d]/g, ''))} dir="ltr" className={`${FIELD} text-right tabular-nums`} />
      </div>
      <div>
        <span className="block text-[13px] text-slate-700 mb-2">الحالة</span>
        <div className="flex items-center gap-6 h-[42px]" role="radiogroup" aria-label="الحالة">
          {([['Active', 'نشط'], ['Inactive', 'غير نشط']] as const).map(([v, label]) => (
            <label key={v} className="flex items-center gap-2 text-[14px] cursor-pointer">
              <input type="radio" name="location-status" checked={status === v} onChange={() => setStatus(v)} className="h-4 w-4 accent-[var(--apex-pink,#e91e63)]" />
              {label}
            </label>
          ))}
        </div>
      </div>
      <div className="col-span-2">
        <GeofenceMapPicker
          latitude={lat}
          longitude={lng}
          radiusM={Number(radius) || 0}
          onMove={(la, ln) => { setLat(la); setLng(ln) }}
          height="300px"
        />
      </div>
    </ApexDialog>
  )
}
