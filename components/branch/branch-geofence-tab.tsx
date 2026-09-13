'use client'

/**
 * «نطاق الحضور» — the manager-facing half of the punch geofence.
 *
 * WHY IT WRITES `Branch.latitude/longitude/checkin_radius`
 * -------------------------------------------------------
 * The existing branch dialog saves `Biometric Branch Settings.geofence_*` — fields no
 * enforcement path reads — and hard-codes `enable_geofence: 0` besides. The server
 * enforces `Branch.latitude/longitude/checkin_radius` (see
 * `employee_checkin._validate_distance_from_branch_location`). This tab writes those,
 * through `geofence.save_branch_geofence`, so what HR sets is what the server applies.
 *
 * COVERAGE PANEL
 * --------------
 * Configuring a branch is only half the rule: an employee with no branch is not
 * restricted at all. The coverage panel names those employees instead of letting a
 * green "enabled" badge imply a protection that isn't there.
 *
 * Renders nothing unless `site_config.punch_geofence` is on for the tenant.
 */

import * as React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  MapPin, Loader2, Save, Crosshair, Link2, AlertTriangle, CheckCircle2,
  ShieldCheck, ShieldOff, Users,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { useI18n } from '@/lib/i18n'
import { getCurrentPosition, GeoError } from '@/lib/mobile-attendance/geo'
import {
  getBranchGeofences, saveBranchGeofence, getGeofenceCoverage,
  parseCoordinates, isShortMapsLink, formatDistance,
  type BranchGeofence, type GeofenceCoverage,
} from '@/lib/mobile-attendance/geofence'

const GeofenceMapPicker = dynamic(() => import('@/components/branch/geofence-map-picker'), {
  ssr: false,
  loading: () => <div className="h-[320px] rounded-lg border border-border bg-muted/40 animate-pulse" />,
})

const RADIUS_PRESETS = [50, 100, 200, 500]
const MIN_RADIUS = 20
const MAX_RADIUS = 20000

export function BranchGeofenceTab({ company }: { company?: string }) {
  const { isRTL } = useI18n()
  const tt = (en: string, ar: string) => (isRTL ? ar : en)
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [featureOn, setFeatureOn] = useState(false)
  const [geoTracking, setGeoTracking] = useState(true)
  const [branches, setBranches] = useState<BranchGeofence[]>([])
  const [coverage, setCoverage] = useState<GeofenceCoverage | null>(null)

  const [selected, setSelected] = useState<string>('')
  const [enabled, setEnabled] = useState(false)
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [radius, setRadius] = useState(100)
  const [pasted, setPasted] = useState('')
  const [locating, setLocating] = useState(false)
  const [saving, setSaving] = useState(false)

  const current = useMemo(
    () => branches.find((b) => b.branch === selected) || null,
    [branches, selected],
  )

  const load = useCallback(async () => {
    setLoading(true)
    const [res, cov] = await Promise.all([getBranchGeofences(company), getGeofenceCoverage()])
    setFeatureOn(res.feature_enabled)
    setGeoTracking(res.geolocation_tracking !== false)
    setBranches(res.branches || [])
    setCoverage(cov)
    setSelected((prev) => prev || res.branches?.[0]?.branch || '')
    setLoading(false)
  }, [company])

  useEffect(() => { void load() }, [load])

  // load the selected branch into the editor
  useEffect(() => {
    if (!current) return
    setEnabled(current.enabled)
    setLat(current.latitude)
    setLng(current.longitude)
    setRadius(current.radius_m || 100)
    setPasted('')
  }, [current])

  const useMyLocation = useCallback(async () => {
    setLocating(true)
    try {
      const pos = await getCurrentPosition()
      setLat(pos.latitude)
      setLng(pos.longitude)
      setEnabled(true)
      toast({
        title: '📍',
        description: tt(
          `Pin set to your position (±${Math.round(pos.accuracy)} m).`,
          `تم ضبط الدبوس على موقعك (±${Math.round(pos.accuracy)} م).`,
        ),
      })
    } catch (e: any) {
      toast({
        title: '❌',
        description: e instanceof GeoError ? (isRTL ? e.ar : e.en) : String(e?.message || e),
        variant: 'destructive',
      })
    } finally {
      setLocating(false)
    }
  }, [toast, tt, isRTL])

  const applyPasted = useCallback(() => {
    const hit = parseCoordinates(pasted)
    if (hit) {
      setLat(hit.latitude)
      setLng(hit.longitude)
      setEnabled(true)
      setPasted('')
      return
    }
    toast({
      title: '⚠️',
      description: isShortMapsLink(pasted)
        ? tt(
            'A shortened Google Maps link carries no coordinates. Open it in Maps first, then paste the full address-bar URL.',
            'الرابط المختصر من خرائط جوجل لا يحمل إحداثيات. افتحه في الخرائط أولًا ثم الصق الرابط الكامل من شريط العنوان.',
          )
        : tt(
            'No coordinates found. Paste a Google Maps URL or "latitude, longitude".',
            'لم يتم العثور على إحداثيات. الصق رابط خرائط جوجل أو «خط العرض، خط الطول».',
          ),
      variant: 'destructive',
    })
  }, [pasted, toast, tt])

  const save = useCallback(async () => {
    if (!selected) return
    if (enabled && (lat == null || lng == null)) {
      toast({
        title: '⚠️',
        description: tt('Set the site location first.', 'حدّد موقع المقر أولًا.'),
        variant: 'destructive',
      })
      return
    }
    if (enabled && (radius < MIN_RADIUS || radius > MAX_RADIUS)) {
      toast({
        title: '⚠️',
        description: tt(
          `Radius must be between ${MIN_RADIUS} and ${MAX_RADIUS} m.`,
          `يجب أن يكون نصف القطر بين ${MIN_RADIUS} و ${MAX_RADIUS} م.`,
        ),
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      await saveBranchGeofence({ branch: selected, latitude: lat, longitude: lng, radius_m: radius, enabled })
      toast({
        title: '✅',
        description: enabled
          ? tt(
              `Punching at ${selected} is now limited to ${radius} m from the pin.`,
              `تسجيل الحضور في ${selected} أصبح مقيّدًا بـ ${radius} م من الدبوس.`,
            )
          : tt(
              `Location restriction removed from ${selected}.`,
              `تم رفع قيد الموقع عن ${selected}.`,
            ),
      })
      await load()
    } catch (e: any) {
      toast({ title: '❌', description: String(e?.message || e), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }, [selected, enabled, lat, lng, radius, toast, tt, load])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" />
        {tt('Loading…', 'جارٍ التحميل…')}
      </div>
    )
  }

  if (!featureOn) return null

  const uncovered = coverage?.uncovered?.filter((u) => u.reason !== 'exempt_hr_manager') || []
  const exempt = coverage?.uncovered?.filter((u) => u.reason === 'exempt_hr_manager') || []

  const reasonText = (reason: string) =>
    reason === 'no_branch'
      ? tt('no branch assigned', 'لا يوجد فرع معيّن')
      : tt('branch has no location set', 'الفرع بدون موقع محدّد')

  return (
    <div className="space-y-6">
      {!geoTracking && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            {tt(
              'Geolocation tracking is OFF in HR Settings — no location rule is enforced until it is on.',
              'خاصية تتبّع الموقع مغلقة في إعدادات الموارد البشرية — لن يُطبَّق أي قيد موقع حتى تُفعَّل.',
            )}
          </span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ---------------- editor ---------------- */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              {tt('Check-in area', 'نطاق تسجيل الحضور')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* branch selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{tt('Branch', 'الفرع')}</label>
              <select
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                {branches.length === 0 && <option value="">{tt('No branches yet', 'لا توجد فروع بعد')}</option>}
                {branches.map((b) => (
                  <option key={b.branch} value={b.branch}>
                    {b.branch} · {b.employee_count} {tt('employees', 'موظف')}
                  </option>
                ))}
              </select>
            </div>

            {/* on/off */}
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{tt('Restrict punching to this location', 'تقييد البصم بهذا الموقع')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {tt(
                    'When off, employees of this branch can punch from anywhere.',
                    'عند الإيقاف، يستطيع موظفو هذا الفرع البصم من أي مكان.',
                  )}
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} disabled={!selected} />
            </div>

            {enabled && (
              <>
                {/* map */}
                {lat != null && lng != null ? (
                  <GeofenceMapPicker
                    latitude={lat}
                    longitude={lng}
                    radiusM={radius}
                    onMove={(la, ln) => { setLat(la); setLng(ln) }}
                  />
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    {tt(
                      'Set the site location using one of the options below.',
                      'حدّد موقع المقر بإحدى الطرق أدناه.',
                    )}
                  </div>
                )}
                {lat != null && lng != null && (
                  <p className="text-xs text-muted-foreground">
                    {tt('Drag the pin or tap the map to adjust.', 'اسحب الدبوس أو اضغط على الخريطة للتعديل.')}
                  </p>
                )}

                {/* set location */}
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="button" variant="outline" onClick={useMyLocation} disabled={locating} className="gap-2">
                    {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
                    {tt('Use my current location', 'استخدم موقعي الحالي')}
                  </Button>
                  <div className="flex gap-2">
                    <Input
                      value={pasted}
                      onChange={(e) => setPasted(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') applyPasted() }}
                      placeholder={tt('Maps link or "26.35, 43.95"', 'رابط الخرائط أو «26.35، 43.95»')}
                      className="text-sm"
                    />
                    <Button type="button" variant="outline" onClick={applyPasted} disabled={!pasted.trim()} className="shrink-0">
                      <Link2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* coordinates */}
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">{tt('Latitude', 'خط العرض')}</label>
                    <Input
                      value={lat ?? ''}
                      onChange={(e) => setLat(e.target.value === '' ? null : Number(e.target.value))}
                      inputMode="decimal"
                      className="text-sm tabular-nums"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">{tt('Longitude', 'خط الطول')}</label>
                    <Input
                      value={lng ?? ''}
                      onChange={(e) => setLng(e.target.value === '' ? null : Number(e.target.value))}
                      inputMode="decimal"
                      className="text-sm tabular-nums"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* radius */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    {tt('Allowed radius', 'نصف القطر المسموح')} — {formatDistance(radius, isRTL)}
                  </label>
                  <input
                    type="range"
                    min={MIN_RADIUS}
                    max={1000}
                    step={10}
                    value={Math.min(radius, 1000)}
                    onChange={(e) => setRadius(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex gap-2 flex-wrap">
                    {RADIUS_PRESETS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRadius(r)}
                        className={
                          'text-xs px-2.5 py-1 rounded-full border transition-colors ' +
                          (radius === r
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border text-muted-foreground hover:bg-accent')
                        }
                      >
                        {formatDistance(r, isRTL)}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tt(
                      'Phone GPS is accurate to roughly 10–40 m indoors — a radius under 50 m can reject someone standing in the office.',
                      'دقة الـ GPS داخل المباني تتراوح تقريبًا بين 10 و40 م — نصف قطر أقل من 50 م قد يرفض موظفًا واقفًا داخل المكتب.',
                    )}
                  </p>
                </div>
              </>
            )}

            <Button onClick={save} disabled={saving || !selected} className="w-full gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {tt('Save', 'حفظ')}
            </Button>
          </CardContent>
        </Card>

        {/* ---------------- coverage ---------------- */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                {tt('Who is restricted', 'مَن يخضع للقيد')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-success shrink-0" />
                <span>
                  <span className="font-semibold tabular-nums">{coverage?.covered?.length ?? 0}</span>{' '}
                  {tt('of', 'من')}{' '}
                  <span className="tabular-nums">{coverage?.total ?? 0}</span>{' '}
                  {tt('active employees', 'موظف نشط')}
                </span>
              </div>

              {uncovered.length > 0 && (
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 space-y-2">
                  <p className="text-xs font-medium text-warning flex items-center gap-1.5">
                    <ShieldOff className="h-3.5 w-3.5" />
                    {tt(
                      `${uncovered.length} employee(s) can still punch from anywhere`,
                      `${uncovered.length} موظف ما زال بإمكانه البصم من أي مكان`,
                    )}
                  </p>
                  <ul className="space-y-1">
                    {uncovered.slice(0, 8).map((u) => (
                      <li key={u.employee} className="text-xs flex items-start justify-between gap-2">
                        <span className="truncate">{u.employee_name}</span>
                        <span className="text-muted-foreground shrink-0">{reasonText(u.reason)}</span>
                      </li>
                    ))}
                  </ul>
                  {uncovered.length > 8 && (
                    <p className="text-xs text-muted-foreground">
                      {tt(`+${uncovered.length - 8} more`, `+${uncovered.length - 8} آخرين`)}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {tt(
                      'Assign them a branch from the Employees tab to bring them under the rule.',
                      'عيّن لهم فرعًا من تبويب الموظفين ليخضعوا للقيد.',
                    )}
                  </p>
                </div>
              )}

              {uncovered.length === 0 && (coverage?.total ?? 0) > 0 && (
                <p className="text-xs text-success flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {tt('Every employee is covered.', 'جميع الموظفين مشمولون بالقيد.')}
                </p>
              )}

              {exempt.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {tt(
                    `${exempt.length} HR Manager(s) are exempt by design and can punch from anywhere.`,
                    `${exempt.length} من مديري الموارد البشرية معفَون بحكم التصميم ويمكنهم البصم من أي مكان.`,
                  )}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{tt('Branches', 'الفروع')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {branches.map((b) => (
                <button
                  key={b.branch}
                  onClick={() => setSelected(b.branch)}
                  className={
                    'w-full text-start rounded-lg border p-2.5 transition-colors ' +
                    (b.branch === selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent')
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{b.branch}</span>
                    <Badge
                      variant="outline"
                      className={b.enabled ? 'border-success/40 text-success' : 'border-border text-muted-foreground'}
                    >
                      {b.enabled ? formatDistance(b.radius_m, isRTL) : tt('off', 'معطّل')}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {b.employee_count} {tt('employees', 'موظف')}
                  </p>
                </button>
              ))}
              {branches.length === 0 && (
                <p className="text-sm text-muted-foreground">{tt('No branches yet.', 'لا توجد فروع بعد.')}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
