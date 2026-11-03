'use client'

/**
 * The employee-facing half of the punch geofence: "you can only punch at the office".
 *
 * Renders the rule up-front (office name + radius) and, on a user gesture only, the
 * employee's live distance from it. Nothing here touches geolocation on mount — the
 * whole /me punch flow is deliberately gesture-driven so a phone never shows a
 * location prompt just for opening the page.
 *
 * Inert unless the tenant has the feature on (`site_config.punch_geofence`).
 */

import * as React from 'react'
import { useCallback, useState } from 'react'
import { MapPin, Loader2, CheckCircle2, AlertTriangle, Navigation, ExternalLink } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { getCurrentPosition, GeoError } from '@/lib/mobile-attendance/geo'
import {
  formatDistance,
  isInsideFence,
  type PunchGeofence,
} from '@/lib/mobile-attendance/geofence'

export function PunchGeofenceBanner({ fence }: { fence: PunchGeofence | null }) {
  const { isRTL } = useI18n()
  const tt = (en: string, ar: string) => (isRTL ? ar : en)

  const [checking, setChecking] = useState(false)
  const [distance, setDistance] = useState<number | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [err, setErr] = useState('')

  const checkDistance = useCallback(async () => {
    setErr('')
    setChecking(true)
    try {
      const pos = await getCurrentPosition()
      const { distance: d } = isInsideFence(fence, pos)
      setDistance(d)
      setAccuracy(pos.accuracy)
    } catch (e: any) {
      setErr(e instanceof GeoError ? (isRTL ? e.ar : e.en) : String(e?.message || e))
      setDistance(null)
    } finally {
      setChecking(false)
    }
  }, [fence, isRTL])

  if (!fence?.feature_enabled || !fence.enabled || fence.exempt) return null

  const radius = fence.radius_m ?? 0
  const label = fence.label || tt('your branch', 'فرعك')
  const inside = distance != null && distance <= radius
  const mapsHref = `https://www.google.com/maps?q=${fence.latitude},${fence.longitude}`

  return (
    <div
      className={
        'rounded-lg border p-3 space-y-2 ' +
        (distance == null
          ? 'border-border bg-accent/40'
          : inside
            ? 'border-success/30 bg-success/10'
            : 'border-destructive/30 bg-destructive/10')
      }
    >
      <div className="flex items-start gap-2">
        <MapPin
          className={
            'h-4 w-4 mt-0.5 shrink-0 ' +
            (distance == null ? 'text-primary' : inside ? 'text-success' : 'text-destructive')
          }
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            {tt(
              `Punching is limited to ${label}`,
              `تسجيل الحضور مقيّد بموقع ${label}`,
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tt(
              `You must be within ${radius} m of the site to check in or out.`,
              `يجب أن تكون داخل ${radius} م من الموقع لتسجيل الحضور أو الانصراف.`,
            )}
          </p>
        </div>
      </div>

      {distance != null && (
        <div
          className={
            'flex items-start gap-2 text-sm ' + (inside ? 'text-success' : 'text-destructive')
          }
        >
          {inside ? (
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          )}
          <span>
            {inside
              ? tt(
                  `You are inside the allowed area (${formatDistance(distance, false)} away).`,
                  `أنت داخل النطاق المسموح (تبعد ${formatDistance(distance, true)}).`,
                )
              : tt(
                  `You are ${formatDistance(distance, false)} away — outside the allowed area.`,
                  `تبعد ${formatDistance(distance, true)} — خارج النطاق المسموح.`,
                )}
            {accuracy != null && accuracy > radius && (
              <span className="block text-xs text-muted-foreground mt-0.5">
                {tt(
                  `Your GPS accuracy is only ±${Math.round(accuracy)} m — move outdoors for a better fix.`,
                  `دقة تحديد موقعك ±${Math.round(accuracy)} م فقط — اخرج للعراء لقراءة أدق.`,
                )}
              </span>
            )}
          </span>
        </div>
      )}

      {err && <p className="text-sm text-destructive">{err}</p>}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={checkDistance}
          disabled={checking}
          className="text-xs font-medium text-primary hover:underline flex items-center gap-1 disabled:opacity-60"
        >
          {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation className="h-3.5 w-3.5" />}
          {checking
            ? tt('Checking…', 'جارٍ التحقق…')
            : distance == null
              ? tt('How far am I?', 'كم أبعد عن الموقع؟')
              : tt('Re-check', 'إعادة التحقق')}
        </button>
        <a
          href={mapsHref}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-muted-foreground hover:underline flex items-center gap-1"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {tt('View site on map', 'عرض الموقع على الخريطة')}
        </a>
      </div>
    </div>
  )
}
