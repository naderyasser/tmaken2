'use client'

/**
 * Tamkeen Go — G1 "verified passkey mobile attendance punch" card for /me.
 *
 * Mobile-first punch flow, fully user-gestured (no geolocation / passkey prompt
 * fires on mount — only on the punch button tap):
 *   locate → get challenge → (register passkey if none) → assert → punch (sync).
 * A transient NETWORK error during the punch POST hands off to the slim offline
 * retry buffer (lib/mobile-attendance/punch-queue); a SERVER verdict (outside
 * radius / expired challenge / no passkey) surfaces inline.
 *
 * Feature-flag-safe: if the backend endpoints 404 (feature off on this tenant)
 * the card renders nothing.
 */

import * as React from 'react'
import { useCallback, useEffect, useState } from 'react'
import {
  Fingerprint, LogIn, LogOut, Loader2, CheckCircle2, XCircle, Smartphone,
  Trash2, Plus, Clock3, MapPin, RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { frappeClient } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { formatDateShort } from '@/lib/format'
import {
  registerPasskey, assertPasskey, getPunchChallenge, listMyPasskeys, revokePasskey,
  isPasskeySupported, PasskeyError, type PasskeyRow,
} from '@/lib/mobile-attendance/webauthn'
import { getCurrentPosition, GeoError } from '@/lib/mobile-attendance/geo'
import {
  getMyGeofence, isInsideFence, OutsideGeofenceError, type PunchGeofence,
} from '@/lib/mobile-attendance/geofence'
import { PunchGeofenceBanner } from '@/components/me/punch-geofence-banner'
import {
  punchDirect, enqueuePunch, newPunchId, isNetworkError, discardPunch,
  installPunchSyncTriggers, subscribePunchQueue, getPunchQueueSnapshot,
  type PunchResult, type PunchQueueSnapshot,
} from '@/lib/mobile-attendance/punch-queue'
import SelfiePunch from '@/components/me/selfie-punch'

const MOD = 'base_meena.mobile_attendance'

interface AttendanceToday {
  last_log_type?: 'IN' | 'OUT' | null
  last_time?: string | null
  count_today?: number
  checkins?: { time: string; log_type: string; device_id?: string }[]
}

type Phase = 'idle' | 'locating' | 'challenge' | 'registering' | 'verifying' | 'punching' | 'success' | 'error'

const BUSY: Phase[] = ['locating', 'challenge', 'registering', 'verifying', 'punching']

/** Pick the bilingual copy off a typed error, else fall back to its raw message. */
function msgOf(e: any, isRTL: boolean): string {
  if (e && (e instanceof PasskeyError || e instanceof GeoError || e instanceof OutsideGeofenceError)) {
    return isRTL ? e.ar : e.en
  }
  return String(e?.message || e || '')
}

/** HH:MM out of a "YYYY-MM-DD HH:MM:SS" / ISO datetime string. */
function hhmm(t?: string | null): string {
  if (!t) return ''
  const m = String(t).match(/(\d{2}):(\d{2})/)
  return m ? `${m[1]}:${m[2]}` : String(t)
}

function deviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Device'
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS device'
  if (/Android/i.test(ua)) return 'Android device'
  if (/Macintosh/i.test(ua)) return 'Mac'
  if (/Windows/i.test(ua)) return 'Windows PC'
  return 'This device'
}

export function AttendanceCard() {
  const { isRTL } = useI18n()
  const tt = (en: string, ar: string) => (isRTL ? ar : en)

  const [available, setAvailable] = useState<boolean | null>(null)
  const [today, setToday] = useState<AttendanceToday>({})
  const [phase, setPhase] = useState<Phase>('idle')
  const [errMsg, setErrMsg] = useState('')
  const [result, setResult] = useState<PunchResult | null>(null)
  const [devicesOpen, setDevicesOpen] = useState(false)
  const [queue, setQueue] = useState<PunchQueueSnapshot>({ pending: 0, failed: 0, syncing: false, lastError: null, items: [] })
  const [fence, setFence] = useState<PunchGeofence | null>(null)

  const refreshToday = useCallback(async () => {
    const r = await frappeClient.call(`${MOD}.punch_api.get_my_attendance_today`)
    setToday(((r as any)?.message as AttendanceToday) || {})
  }, [])

  // Availability probe (feature flag) + queue wiring. No permission-prompting APIs here.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await refreshToday()
        if (!cancelled) setAvailable(true)
      } catch {
        if (!cancelled) setAvailable(false)
        return
      }
      // The rule itself needs no GPS — fetch it so the employee sees it before
      // tapping, and so doPunch can stop an out-of-radius punch before the ceremony.
      const f = await getMyGeofence()
      if (!cancelled) setFence(f)
    })()
    installPunchSyncTriggers()
    const unsub = subscribePunchQueue(() => { void getPunchQueueSnapshot().then((s) => setQueue(s)) })
    void getPunchQueueSnapshot().then((s) => setQueue(s))
    return () => { cancelled = true; unsub() }
  }, [refreshToday])

  // Auto-clear the transient success banner.
  useEffect(() => {
    if (phase !== 'success') return
    const id = setTimeout(() => setPhase('idle'), 5000)
    return () => clearTimeout(id)
  }, [phase])

  const isCheckedIn = today.last_log_type === 'IN'
  const nextLogType: 'IN' | 'OUT' = isCheckedIn ? 'OUT' : 'IN'
  const busy = BUSY.includes(phase)

  const doPunch = useCallback(async () => {
    if (busy) return
    setErrMsg('')
    setResult(null)
    try {
      if (!isPasskeySupported()) {
        throw new PasskeyError('unsupported', 'Passkeys are not supported on this device.', 'مفاتيح المرور غير مدعومة على هذا الجهاز.')
      }

      setPhase('locating')
      const pos = await getCurrentPosition()

      // Stop an out-of-radius punch HERE. The server rejects it either way, but
      // failing now spares the employee a passkey ceremony that was never going to
      // be accepted — and tells them exactly how far off they are.
      const check = isInsideFence(fence, pos)
      if (check.applies && !check.inside && check.distance != null) {
        throw new OutsideGeofenceError(check.distance, fence!.radius_m ?? 0, fence!.label || '')
      }

      setPhase('challenge')
      let ch = await getPunchChallenge()

      if (!ch.has_passkey) {
        setPhase('registering')
        await registerPasskey(deviceLabel())
        // A freshly-registered passkey isn't in the previous challenge's allow list —
        // re-fetch so allow_credentials is populated for the assertion.
        ch = await getPunchChallenge()
        if (!ch.has_passkey || !(ch.allow_credentials || []).length) {
          throw new PasskeyError('incomplete', 'Passkey setup did not complete. Try again.', 'لم يكتمل إعداد مفتاح المرور. حاول مجددًا.')
        }
      }

      setPhase('verifying')
      const assertion = await assertPasskey(ch.challenge, ch.allow_credentials)

      setPhase('punching')
      const clientRef = newPunchId()
      const payload = {
        ...assertion,
        latitude: pos.latitude,
        longitude: pos.longitude,
        log_type: nextLogType,
        device_label: deviceLabel(),
      }

      try {
        const res = await punchDirect(payload, clientRef)
        setResult(res)
        setPhase('success')
        await refreshToday()
      } catch (e) {
        if (isNetworkError(e)) {
          // transient blip — retry inside the challenge window; queue banner takes over.
          await enqueuePunch(payload, clientRef)
          setPhase('idle')
        } else {
          throw e
        }
      }
    } catch (e: any) {
      setErrMsg(msgOf(e, isRTL))
      setPhase('error')
    }
  }, [busy, nextLogType, isRTL, refreshToday, fence])

  const dismissFailed = useCallback(async () => {
    for (const it of queue.items.filter((i) => i.status === 'failed')) {
      await discardPunch(it.id)
    }
  }, [queue.items])

  if (available !== true) return null

  const phaseLabel: Record<Phase, string> = {
    idle: '',
    locating: tt('Getting your location…', 'جارٍ تحديد موقعك…'),
    challenge: tt('Preparing…', 'جارٍ التحضير…'),
    registering: tt('Set up your passkey…', 'إعداد مفتاح المرور…'),
    verifying: tt('Verify with your device…', 'التحقق عبر جهازك…'),
    punching: tt('Recording…', 'جارٍ التسجيل…'),
    success: '',
    error: '',
  }

  const checkins = today.checkins || []
  const showQueueRetry = queue.pending > 0
  const showQueueFailed = queue.failed > 0

  return (
    <>
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Fingerprint className="h-4 w-4 text-primary" />
            {tt('Attendance', 'الحضور')}
          </CardTitle>
          <button
            onClick={() => setDevicesOpen(true)}
            className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
          >
            <Smartphone className="h-3.5 w-3.5" />
            {tt('My devices', 'أجهزتي')}
          </button>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {/* Current state */}
          <div className="rounded-lg border border-border bg-accent/40 p-3">
            <p className="text-xs text-muted-foreground">{tt('Current status', 'الحالة الحالية')}</p>
            <p className="text-lg font-semibold text-foreground mt-0.5">
              {isCheckedIn
                ? tt(`Checked in since ${hhmm(today.last_time)}`, `مُسجّل حضور منذ ${hhmm(today.last_time)}`)
                : today.last_log_type === 'OUT'
                  ? tt(`Checked out at ${hhmm(today.last_time)}`, `مُسجّل انصراف عند ${hhmm(today.last_time)}`)
                  : tt('Not checked in', 'غير مسجّل الحضور')}
            </p>
          </div>

          {/* The location rule, stated before the button rather than after it */}
          <PunchGeofenceBanner fence={fence} />

          {/* Primary punch button */}
          <Button
            onClick={doPunch}
            disabled={busy}
            className="w-full h-14 text-base bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isCheckedIn ? (
              <LogOut className="h-5 w-5" />
            ) : (
              <LogIn className="h-5 w-5" />
            )}
            {isCheckedIn ? tt('Check out', 'تسجيل انصراف') : tt('Check in', 'تسجيل حضور')}
          </Button>

          {/* Selfie punch — device-free alternative (front camera + GPS + geofence) */}
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[11px] text-muted-foreground">{tt('or', 'أو')}</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <SelfiePunch nextLogType={nextLogType} onPunched={refreshToday} fence={fence} />

          {/* Inline flow state */}
          {busy && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {phaseLabel[phase]}
            </div>
          )}
          {phase === 'success' && result && (
            <div className="flex items-start gap-2 rounded-lg bg-success/10 text-success p-3 text-sm">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                {result.log_type === 'OUT'
                  ? tt(`Checked out at ${hhmm(result.time)}`, `تم تسجيل الانصراف عند ${hhmm(result.time)}`)
                  : tt(`Checked in at ${hhmm(result.time)}`, `تم تسجيل الحضور عند ${hhmm(result.time)}`)}
                {result.idempotent_replay ? tt(' (already recorded)', ' (مسجّل مسبقًا)') : ''}
              </span>
            </div>
          )}
          {phase === 'error' && errMsg && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 text-destructive p-3 text-sm">
              <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{errMsg}</span>
            </div>
          )}

          {/* Offline retry buffer state */}
          {showQueueRetry && (
            <div className="flex items-center gap-2 rounded-lg bg-warning/15 text-warning p-3 text-sm">
              <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
              {tt(`Punch saved — retrying to sync… (${queue.pending})`, `تم حفظ التسجيل — جارٍ إعادة المزامنة… (${queue.pending})`)}
            </div>
          )}
          {showQueueFailed && (
            <div className="flex items-start justify-between gap-2 rounded-lg bg-destructive/10 text-destructive p-3 text-sm">
              <span>
                {tt(
                  'A punch expired before it could sync. Please punch again.',
                  'انتهت صلاحية التسجيل قبل مزامنته. يُرجى إعادة التسجيل.',
                )}
              </span>
              <button onClick={dismissFailed} className="shrink-0 underline text-xs">
                {tt('Dismiss', 'تجاهل')}
              </button>
            </div>
          )}

          {/* Today's log */}
          <div>
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5">
              <Clock3 className="h-3.5 w-3.5" />
              {tt("Today's log", 'سجل اليوم')}
            </p>
            {checkins.length === 0 ? (
              <p className="text-sm text-muted-foreground py-1">{tt('No punches yet today.', 'لا توجد تسجيلات اليوم بعد.')}</p>
            ) : (
              <div className="space-y-1">
                {checkins.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5">
                      {c.log_type === 'IN' ? (
                        <LogIn className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      {c.log_type === 'IN' ? tt('Check in', 'حضور') : tt('Check out', 'انصراف')}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{hhmm(c.time)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <PasskeyManager open={devicesOpen} onOpenChange={setDevicesOpen} />
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Passkey management dialog — list / register / revoke
// ─────────────────────────────────────────────────────────────────────────────

function PasskeyManager({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { isRTL } = useI18n()
  const tt = (en: string, ar: string) => (isRTL ? ar : en)

  const [rows, setRows] = useState<PasskeyRow[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [label, setLabel] = useState('')
  const [confirmId, setConfirmId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      setRows((await listMyPasskeys()) || [])
    } catch (e: any) {
      setErr(msgOf(e, isRTL))
    } finally {
      setLoading(false)
    }
  }, [isRTL])

  useEffect(() => {
    if (open) {
      setConfirmId('')
      void load()
    }
  }, [open, load])

  const add = useCallback(async () => {
    setBusy(true)
    setErr('')
    try {
      await registerPasskey(label.trim() || deviceLabel())
      setLabel('')
      await load()
    } catch (e: any) {
      setErr(msgOf(e, isRTL))
    } finally {
      setBusy(false)
    }
  }, [label, isRTL, load])

  const remove = useCallback(async (name: string) => {
    setBusy(true)
    setErr('')
    try {
      await revokePasskey(name)
      setConfirmId('')
      await load()
    } catch (e: any) {
      setErr(msgOf(e, isRTL))
    } finally {
      setBusy(false)
    }
  }, [isRTL, load])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={isRTL ? 'rtl' : 'ltr'} className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-primary" />
            {tt('My devices', 'أجهزتي')}
          </DialogTitle>
          <DialogDescription>
            {tt('Passkeys registered for verified punching.', 'مفاتيح المرور المسجّلة للتسجيل الموثّق.')}
          </DialogDescription>
        </DialogHeader>

        {err && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/10 text-destructive p-2.5 text-sm">
            <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{err}</span>
          </div>
        )}

        {/* Existing passkeys */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center">
              {tt('No passkeys yet. Add this device below.', 'لا توجد مفاتيح مرور بعد. أضف هذا الجهاز أدناه.')}
            </p>
          ) : (
            rows.map((r) => (
              <div key={r.name} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate flex items-center gap-2">
                    {r.device_label || tt('Device', 'جهاز')}
                    {r.disabled ? (
                      <Badge variant="outline" className="text-[10px]">{tt('Revoked', 'ملغى')}</Badge>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.created_on ? formatDateShort(r.created_on) : ''}
                    {r.last_used_on ? ` · ${tt('used', 'آخر استخدام')} ${formatDateShort(r.last_used_on)}` : ''}
                  </p>
                </div>
                {!r.disabled && (
                  confirmId === r.name ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="destructive" className="h-8" disabled={busy} onClick={() => remove(r.name)}>
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : tt('Confirm', 'تأكيد')}
                      </Button>
                      <Button size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => setConfirmId('')}>
                        {tt('Cancel', 'إلغاء')}
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="h-8 gap-1 text-destructive border-destructive/30 shrink-0" onClick={() => setConfirmId(r.name)}>
                      <Trash2 className="h-3.5 w-3.5" />
                      {tt('Remove', 'إزالة')}
                    </Button>
                  )
                )}
              </div>
            ))
          )}
        </div>

        {/* Register new */}
        <div className="border-t border-border pt-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{tt('Add this device', 'إضافة هذا الجهاز')}</p>
          <div className="flex items-center gap-2">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={tt('Device name (optional)', 'اسم الجهاز (اختياري)')}
              className="h-9"
            />
            <Button onClick={add} disabled={busy} className="gap-1.5 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {tt('Add', 'إضافة')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
