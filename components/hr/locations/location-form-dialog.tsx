'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DEFAULT_LAT, DEFAULT_LNG, DEFAULT_RADIUS_M,
  type LocationGroupOption, type LocationRow,
} from './types'

const GeofenceMapPicker = dynamic(() => import('@/components/branch/geofence-map-picker'), {
  ssr: false,
  loading: () => <div className="h-[280px] rounded-lg border border-[var(--apex-border)] bg-slate-50 animate-pulse" />,
})

/**
 * «اضافة موقع» / «تعديل موقع» — Apex M5's add/edit dialog: name, an optional
 * مجموعة المواقع (a `Location` marked `is_group=1`), a draggable map pin +
 * radius circle, and the active/inactive status.
 */
export function LocationFormDialog({
  open, onOpenChange, editing, groups, onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: LocationRow | null
  groups: LocationGroupOption[]
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [locationName, setLocationName] = useState('')
  const [parentLocation, setParentLocation] = useState('')
  const [lat, setLat] = useState(DEFAULT_LAT)
  const [lng, setLng] = useState(DEFAULT_LNG)
  const [radius, setRadius] = useState(DEFAULT_RADIUS_M)
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active')
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState('')

  useEffect(() => {
    if (!open) return
    setLocationName(editing?.location_name || '')
    setParentLocation(editing?.parent_location || '')
    setLat(editing?.latitude ?? DEFAULT_LAT)
    setLng(editing?.longitude ?? DEFAULT_LNG)
    setRadius(editing?.custom_radius_m ?? DEFAULT_RADIUS_M)
    setStatus((editing?.custom_status as 'Active' | 'Inactive') || 'Active')
    setNameError('')
  }, [open, editing])

  const save = async () => {
    const name = locationName.trim()
    if (!name) {
      setNameError('اسم الموقع مطلوب')
      return
    }
    setSaving(true)
    try {
      await frappeClient.call('base_meena.api.hr_locations.save_location', {
        name: editing?.name,
        location_name: name,
        parent_location: parentLocation || undefined,
        latitude: lat,
        longitude: lng,
        custom_radius_m: radius,
        custom_status: status,
      })
      toast({ title: 'تم الحفظ' })
      onOpenChange(false)
      onSaved()
    } catch (e: any) {
      toast({ title: 'فشل الحفظ', description: e?.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'تعديل موقع' : 'اضافة موقع'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1 max-h-[70vh] overflow-y-auto">
          <div className="space-y-1.5">
            <Label className="text-[13px] text-slate-600">
              اسم الموقع<span className="text-red-500"> *</span>
            </Label>
            <Input
              value={locationName}
              onChange={(e) => { setLocationName(e.target.value); if (nameError) setNameError('') }}
              aria-invalid={!!nameError || undefined}
              className="rounded-sm border-slate-300 text-right"
            />
            {nameError && <p className="text-[12px] text-red-500">{nameError}</p>}
          </div>

          {groups.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-[13px] text-slate-600">مجموعة المواقع</Label>
              <select
                value={parentLocation}
                onChange={(e) => setParentLocation(e.target.value)}
                className="w-full h-10 rounded-sm border border-slate-300 bg-white px-3 text-[14px] text-right"
              >
                <option value="">بدون مجموعة</option>
                {groups.map((g) => (
                  <option key={g.name} value={g.name}>{g.location_name || g.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-[13px] text-slate-600">الموقع على الخريطة</Label>
            <GeofenceMapPicker
              latitude={lat}
              longitude={lng}
              radiusM={radius}
              onMove={(la, ln) => { setLat(la); setLng(ln) }}
              height="260px"
            />
            <p className="text-[12px] text-slate-500">اسحب الدبوس أو اضغط على الخريطة لتحديد الموقع.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[13px] text-slate-600">خط العرض</Label>
              <Input
                value={lat}
                onChange={(e) => setLat(Number(e.target.value) || 0)}
                inputMode="decimal"
                dir="ltr"
                className="rounded-sm border-slate-300 text-right tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-slate-600">خط الطول</Label>
              <Input
                value={lng}
                onChange={(e) => setLng(Number(e.target.value) || 0)}
                inputMode="decimal"
                dir="ltr"
                className="rounded-sm border-slate-300 text-right tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[13px] text-slate-600">نطاق الموقع بالمتر</Label>
              <Input
                type="number"
                min={0}
                value={radius}
                onChange={(e) => setRadius(Math.max(0, Number(e.target.value) || 0))}
                dir="ltr"
                className="rounded-sm border-slate-300 text-right tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-slate-600">الحالة</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as 'Active' | 'Inactive')}>
                <SelectTrigger className="rounded-sm border-slate-300 text-right"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">نشط</SelectItem>
                  <SelectItem value="Inactive">غير نشط</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>إلغاء</Button>
          <Button onClick={save} disabled={saving} className="bg-[var(--apex-green)] hover:bg-[var(--apex-green-dark)] text-white">
            {saving && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
