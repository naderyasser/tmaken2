'use client'

/**
 * SelfiePunch — a device-free attendance punch for /me: capture a live selfie
 * from the front camera + GPS, and post to the geofenced, ignore-permissions
 * endpoint `base_meena.mobile_attendance.selfie_punch.punch_with_selfie`. The
 * selfie is stored (private) with the checkin as an anti-buddy-punch audit trail.
 *
 * An alternative to the passkey punch for phones without a registered passkey.
 * Self-contained: manages its own camera stream, GPS, and inline result. The
 * camera / geolocation prompts fire only on user gesture (opening the sheet /
 * tapping capture), never on mount. Feature-flag-safe: on a 404 it stays inert.
 */

import * as React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Aperture, Loader2, CheckCircle2, XCircle, RefreshCw, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { frappeClient } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { getCurrentPosition, GeoError } from '@/lib/mobile-attendance/geo'
import { newPunchId, type PunchResult } from '@/lib/mobile-attendance/punch-queue'
import { isInsideFence, OutsideGeofenceError, type PunchGeofence } from '@/lib/mobile-attendance/geofence'

const SELFIE_METHOD = 'base_meena.mobile_attendance.selfie_punch.punch_with_selfie'

type Phase = 'idle' | 'camera' | 'capturing' | 'locating' | 'punching' | 'success' | 'error'

function hhmm(t?: string | null): string {
  const m = String(t || '').match(/(\d{1,2}):(\d{2})/)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '--:--'
}

function deviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Web'
  const ua = navigator.userAgent
  const m = ua.match(/(iPhone|iPad|Android|Windows|Macintosh|Linux)/i)
  return `Web selfie · ${m ? m[1] : 'device'}`
}

export default function SelfiePunch({
  nextLogType,
  onPunched,
  fence,
}: {
  nextLogType: 'IN' | 'OUT'
  onPunched?: () => void
  /** Resolved by the parent card; the selfie path must honour the same fence. */
  fence?: PunchGeofence | null
}) {
  const { isRTL } = useI18n()
  const tt = (en: string, ar: string) => (isRTL ? ar : en)

  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [errMsg, setErrMsg] = useState('')
  const [result, setResult] = useState<PunchResult | null>(null)
  const [restartKey, setRestartKey] = useState(0)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const closeSheet = useCallback(() => {
    stopCamera()
    setOpen(false)
    setPhase('idle')
  }, [stopCamera])

  // start the camera when the sheet opens; always release on close/unmount
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setErrMsg('')
    setResult(null)
    setPhase('camera')
    ;(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('nocam')
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
      } catch {
        if (cancelled) return
        setPhase('error')
        setErrMsg(tt('Camera access is required for a selfie punch.', 'يلزم السماح بالكاميرا لتسجيل الحضور بالسيلفي.'))
      }
    })()
    return () => {
      cancelled = true
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, restartKey])

  const capture = useCallback(async () => {
    const video = videoRef.current
    if (!video || !streamRef.current) return
    setErrMsg('')
    setPhase('capturing')
    try {
      // grab the current frame → square JPEG data URL
      const size = Math.min(video.videoWidth || 480, video.videoHeight || 480) || 480
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('canvas')
      const sx = ((video.videoWidth || size) - size) / 2
      const sy = ((video.videoHeight || size) - size) / 2
      ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size)
      const image = canvas.toDataURL('image/jpeg', 0.6)
      stopCamera()

      setPhase('locating')
      const pos = await getCurrentPosition()

      // Same fence as the passkey path — the selfie route must not be a way around it.
      const check = isInsideFence(fence ?? null, pos)
      if (check.applies && !check.inside && check.distance != null) {
        throw new OutsideGeofenceError(check.distance, fence!.radius_m ?? 0, fence!.label || '')
      }

      setPhase('punching')
      const res = await frappeClient.call<PunchResult>(SELFIE_METHOD, {
        image,
        latitude: pos.latitude,
        longitude: pos.longitude,
        log_type: nextLogType,
        client_ref: newPunchId(),
        device_label: deviceLabel(),
      })
      const message = (res as { message?: PunchResult })?.message ?? (res as unknown as PunchResult)
      setResult(message)
      setPhase('success')
      onPunched?.()
    } catch (e: unknown) {
      let msg = tt('Punch failed. Please try again.', 'تعذّر تسجيل الحضور. حاول مجددًا.')
      if (e instanceof OutsideGeofenceError) {
        msg = tt(e.en, e.ar)
      } else if (e instanceof GeoError) {
        msg = tt('Location is required. Enable GPS and retry.', 'يلزم تحديد الموقع. فعّل الـ GPS وأعد المحاولة.')
      } else if (e instanceof Error && e.message) {
        // surface the backend's bilingual verdict (outside radius / etc.)
        msg = e.message
      }
      setErrMsg(msg)
      setPhase('error')
      stopCamera()
    }
  }, [nextLogType, onPunched, stopCamera, tt, fence])

  const busy = phase === 'capturing' || phase === 'locating' || phase === 'punching'

  return (
    <>
      {/* trigger — a quiet secondary option under the primary passkey button */}
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="w-full gap-2"
      >
        <Camera className="h-4 w-4" />
        {tt('Punch with a selfie', 'تسجيل بالسيلفي')}
      </Button>

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : closeSheet())}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {nextLogType === 'OUT' ? tt('Selfie check-out', 'انصراف بالسيلفي') : tt('Selfie check-in', 'حضور بالسيلفي')}
            </DialogTitle>
            <DialogDescription>
              {tt('Center your face, then capture. Your location is verified.', 'ضع وجهك في الإطار ثم التقط. يتم التحقق من موقعك.')}
            </DialogDescription>
          </DialogHeader>

          {phase === 'success' && result ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
                <CheckCircle2 className="h-7 w-7" />
              </span>
              <p className="text-sm font-semibold text-foreground">
                {result.log_type === 'OUT'
                  ? tt(`Checked out at ${hhmm(result.time)}`, `تم تسجيل الانصراف عند ${hhmm(result.time)}`)
                  : tt(`Checked in at ${hhmm(result.time)}`, `تم تسجيل الحضور عند ${hhmm(result.time)}`)}
              </p>
              <Button onClick={closeSheet} className="w-full">
                {tt('Done', 'تم')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* camera preview */}
              <div className="relative mx-auto aspect-square w-full max-w-[16rem] overflow-hidden rounded-2xl bg-muted">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
                {busy && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                    <Loader2 className="h-7 w-7 animate-spin text-primary" />
                  </div>
                )}
              </div>

              {phase === 'error' && errMsg && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errMsg}</span>
                </div>
              )}

              {busy ? (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {phase === 'locating'
                    ? tt('Verifying location…', 'جارٍ التحقق من الموقع…')
                    : phase === 'punching'
                      ? tt('Recording punch…', 'جارٍ تسجيل الحضور…')
                      : tt('Capturing…', 'جارٍ الالتقاط…')}
                </div>
              ) : phase === 'error' ? (
                <Button onClick={() => setRestartKey((k) => k + 1)} variant="outline" className="w-full gap-2">
                  <RefreshCw className="h-4 w-4" />
                  {tt('Retry', 'إعادة المحاولة')}
                </Button>
              ) : (
                <Button onClick={capture} disabled={phase !== 'camera'} className="w-full gap-2">
                  <Aperture className="h-5 w-5" />
                  {tt('Capture & punch', 'التقاط وتسجيل')}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
