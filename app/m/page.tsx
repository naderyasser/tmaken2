'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, CheckCircle2, Clock3, Crosshair, Fingerprint, Loader2, LocateFixed,
  LogIn, MapPin, MapPinOff, RefreshCw, ShieldCheck,
} from 'lucide-react'

import { useGeoWatch, useHome } from '@/components/m/use-home'
import {
  duration, errorText, evaluateFence, formatDistance, hhmm, longDate, mcall, newClientRef,
  parseServerTime, workedMinutes, type PunchResult,
} from '@/lib/m/api'
import { assertPasskey, getPunchChallenge, isPasskeySupported, registerPasskey } from '@/lib/mobile-attendance/webauthn'

const FenceMap = dynamic(() => import('@/components/m/fence-map'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#e3ecec]" />,
})

const WEAK_ACCURACY_M = 150

type Sheet =
  | { kind: 'success'; result: PunchResult }
  | { kind: 'error'; title: string; text: string }
  | null

export default function MobileHomePage() {
  const { data, error, loading, reload } = useHome()
  const geo = useGeoWatch(!!data?.punch_enabled)
  // the clock and «worked» time follow the server (Riyadh) clock, not the phone's
  const offset = useMemo(() => (data ? parseServerTime(data.server_time).getTime() - Date.now() : 0), [data])
  const now = useNow(offset)
  const [busy, setBusy] = useState<'' | 'punch' | 'register'>('')
  const [sheet, setSheet] = useState<Sheet>(null)
  const clientRef = useRef<string | null>(null)

  const fence = useMemo(
    () => (data && geo.fix ? evaluateFence(data.locations, geo.fix.latitude, geo.fix.longitude) : null),
    [data, geo.fix],
  )

  if (loading && !data) return <HomeSkeleton />
  if (!data) return <ErrorState text={error} onRetry={reload} />

  const first = data.employee.employee_name.split(' ')[0]
  const isIn = data.next_log_type === 'IN'
  const lastPunch = data.today[data.today.length - 1]
  const worked = workedMinutes(data.today, now)
  const needsPasskey = data.require_passkey && data.passkeys === 0
  const noLocations = data.punch_enabled && data.locations.length === 0

  const canPunch = data.punch_enabled && !noLocations && !needsPasskey && geo.status === 'ok' && !!fence?.inside && !busy

  const doRegister = async () => {
    setBusy('register')
    try {
      await registerPasskey(deviceLabel())
      await reload()
    } catch (e) {
      setSheet({ kind: 'error', title: 'تعذّر تسجيل بصمة الجهاز', text: errorText(e) })
    } finally {
      setBusy('')
    }
  }

  const doPunch = async () => {
    if (!geo.fix || !canPunch) return
    setBusy('punch')
    // one key per attempt: a retried network failure can't create a second checkin
    clientRef.current = clientRef.current || newClientRef()
    try {
      let proof: Record<string, string> = {}
      if (data.require_passkey) {
        const ch = await getPunchChallenge()
        proof = { ...(await assertPasskey(ch.challenge, ch.allow_credentials)) }
      }
      const result = await mcall<PunchResult>('punch', {
        ...proof,
        latitude: geo.fix.latitude,
        longitude: geo.fix.longitude,
        accuracy: geo.fix.accuracy,
        client_ref: clientRef.current,
      })
      clientRef.current = null
      if (navigator.vibrate) navigator.vibrate(60)
      setSheet({ kind: 'success', result })
      reload()
    } catch (e) {
      const cancelled = (e as { code?: string })?.code === 'cancelled'
      if (!cancelled && !/network|fetch|HTTP 5/i.test(String((e as Error)?.message))) clientRef.current = null
      setSheet({
        kind: 'error',
        title: cancelled ? 'لم يكتمل التحقق' : 'لم يتم تسجيل البصمة',
        text: cancelled ? 'تم إلغاء التحقق ببصمة الجوال. حاول مرة أخرى.' : errorText(e),
      })
    } finally {
      setBusy('')
    }
  }

  return (
    <>
      {/* ── header ───────────────────────────────────────────── */}
      <header className="relative overflow-hidden bg-gradient-to-b from-[#1d4d56] to-[#163d44] px-5 pb-16 pt-[max(18px,env(safe-area-inset-top))] text-white">
        <div aria-hidden className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-[#2c9c9a]/20 blur-2xl" />
        <div className="relative flex items-center justify-between">
          <img src="/branding/masar/masar-logo-white.png" alt="Masar Time" className="h-[26px] w-auto" />
          <Avatar name={data.employee.employee_name} image={data.employee.image} />
        </div>
        <div className="relative mt-5">
          <p className="text-[14px] text-white/70">{now.getHours() < 12 ? 'صباح الخير' : 'مساء الخير'}، {first}</p>
          <p dir="ltr" className="mt-1 text-right text-[44px] font-bold leading-none tracking-tight tabular-nums">
            {hhmm(now).replace(/ [صم]$/, '')}
            <span className="ms-2 text-[16px] font-semibold text-white/60">{now.getHours() < 12 ? 'ص' : 'م'}</span>
          </p>
          <p className="mt-2 text-[13px] text-white/65">{longDate(now)}</p>
        </div>
      </header>

      <div className="relative -mt-11 space-y-4 px-4">
        {/* ── status ───────────────────────────────────────── */}
        <section className="rounded-2xl bg-white p-4 shadow-[0_10px_30px_-18px_rgba(15,42,47,.45)]">
          <div className="flex items-center gap-3">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${lastPunch?.log_type === 'IN' ? 'bg-[#e3f4ec] text-[#2f9e6f]' : 'bg-[#eef3f3] text-[#5b7a7f]'}`}>
              {lastPunch?.log_type === 'IN' ? <LogIn className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold">
                {!lastPunch ? 'لم تسجّل حضورك اليوم' : lastPunch.log_type === 'IN' ? `حاضر منذ ${hhmm(lastPunch.time)}` : `آخر انصراف ${hhmm(lastPunch.time)}`}
              </p>
              <p className="mt-0.5 truncate text-[12.5px] text-[#6b8589]">
                {data.shift?.name ? `الدوام: ${data.shift.name}` : 'لا يوجد دوام محدد اليوم'}
                {data.shift?.start && data.shift?.end ? ` · ${hhmm(data.shift.start)} – ${hhmm(data.shift.end)}` : ''}
              </p>
            </div>
            {worked > 0 && (
              <div className="text-left">
                <p className="text-[11px] text-[#6b8589]">ساعات العمل</p>
                <p className="text-[15px] font-bold tabular-nums text-[#1d4d56]">{duration(worked)}</p>
              </div>
            )}
          </div>
        </section>

        {/* ── blockers ─────────────────────────────────────── */}
        {!data.punch_enabled && (
          <Notice tone="warn" icon={<AlertTriangle className="h-5 w-5" />} title="البصمة من الجوال غير مفعّلة لك">
            يمكنك متابعة سجلك، أما تسجيل الحضور من الجوال فيفعّله قسم الموارد البشرية.
          </Notice>
        )}
        {noLocations && (
          <Notice tone="warn" icon={<MapPinOff className="h-5 w-5" />} title="لم يُحدد لك موقع عمل">
            اطلب من الموارد البشرية تحديد موقع عملك حتى تتمكن من البصمة.
          </Notice>
        )}
        {data.punch_enabled && needsPasskey && (
          <section className="rounded-2xl border border-[#2c9c9a]/30 bg-[#e6f4f2] p-4">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-[#24817f]" />
              <div>
                <p className="text-[15px] font-bold text-[#1d4d56]">سجّل بصمة جهازك أولاً</p>
                <p className="mt-1 text-[13px] leading-relaxed text-[#46676c]">
                  نستخدم بصمة الإصبع أو بصمة الوجه في جوالك للتأكد أنك أنت من يسجّل. تُحفظ البصمة في جوالك فقط.
                </p>
              </div>
            </div>
            {isPasskeySupported() ? (
              <button
                onClick={doRegister}
                disabled={!!busy}
                className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#24817f] text-[15px] font-bold text-white disabled:opacity-60"
              >
                {busy === 'register' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Fingerprint className="h-5 w-5" />}
                تسجيل بصمة الجهاز
              </button>
            ) : (
              <p className="mt-3 rounded-lg bg-white px-3 py-2 text-[13px] text-[#a1621a]">
                هذا المتصفح لا يدعم البصمة. افتح التطبيق من Chrome أو Safari بعد تفعيل قفل الشاشة.
              </p>
            )}
          </section>
        )}

        {/* ── punch ────────────────────────────────────────── */}
        {data.punch_enabled && !noLocations && (
          <section className="flex flex-col items-center rounded-2xl bg-white px-4 pb-5 pt-6 shadow-[0_10px_30px_-18px_rgba(15,42,47,.45)]">
            <PunchButton isIn={isIn} disabled={!canPunch} busy={busy === 'punch'} onClick={doPunch} />
            <p className="mt-4 min-h-[20px] text-center text-[13px] text-[#5b7a7f]">
              {punchHint({ needsPasskey, geoStatus: geo.status, inside: !!fence?.inside, busy: busy === 'punch' })}
            </p>
          </section>
        )}

        {/* ── location ─────────────────────────────────────── */}
        {data.punch_enabled && !noLocations && (
          <section className="overflow-hidden rounded-2xl bg-white shadow-[0_10px_30px_-18px_rgba(15,42,47,.45)]">
            <div className="flex items-start gap-3 p-4">
              <LocationBadge status={geo.status} inside={!!fence?.inside} />
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-bold">{locationTitle(geo.status, fence)}</p>
                <p className="mt-0.5 text-[12.5px] text-[#6b8589]">
                  {fence?.nearest
                    ? `${fence.nearest.label} · النطاق ${formatDistance(fence.nearest.radius_m)}`
                    : data.locations.map((l) => l.label).join('، ')}
                  {geo.fix ? ` · دقة ±${formatDistance(geo.fix.accuracy)}` : ''}
                </p>
                {geo.fix && geo.fix.accuracy > WEAK_ACCURACY_M && (
                  <p className="mt-1 text-[12px] text-[#b26b12]">دقة الموقع ضعيفة — اقترب من نافذة أو فعّل «الدقة العالية».</p>
                )}
              </div>
              <button
                onClick={geo.retry}
                aria-label="تحديث الموقع"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#2f7480] hover:bg-[#eef3f3]"
              >
                <RefreshCw className={`h-[18px] w-[18px] ${geo.status === 'locating' ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {geo.status === 'denied' ? (
              <p className="border-t border-[#eef3f3] px-4 py-3 text-[13px] leading-relaxed text-[#a1621a]">
                تم رفض إذن الموقع. افتح إعدادات المتصفح ← أذونات الموقع، واسمح لهذا الموقع ثم اضغط تحديث.
              </p>
            ) : (
              <FenceMap
                className="h-48 w-full border-t border-[#eef3f3]"
                locations={data.locations}
                position={geo.fix}
                activeName={fence?.inside ? fence.nearest?.name : null}
              />
            )}
          </section>
        )}

        {/* ── today ────────────────────────────────────────── */}
        <section className="rounded-2xl bg-white p-4 shadow-[0_10px_30px_-18px_rgba(15,42,47,.45)]">
          <h2 className="mb-3 text-[15px] font-bold">حركات اليوم</h2>
          {data.today.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-[#7b9396]">لا توجد حركات مسجلة اليوم</p>
          ) : (
            <ol className="relative space-y-3 border-s-2 border-dashed border-[#dbe5e6] ps-4">
              {[...data.today].reverse().map((p) => (
                <li key={p.name} className="relative flex items-center justify-between">
                  <span className={`absolute -start-[23px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full ring-4 ring-white ${p.log_type === 'IN' ? 'bg-[#6cc196]' : 'bg-[#f0ae4f]'}`} />
                  <span className="text-[14px] font-semibold">{p.log_type === 'IN' ? 'حضور' : 'انصراف'}</span>
                  <span className="flex items-center gap-2 text-[13px] text-[#5b7a7f]">
                    <SourceTag source={p.source} />
                    <span className="tabular-nums">{hhmm(p.time)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {sheet && <ResultSheet sheet={sheet} onClose={() => setSheet(null)} />}
    </>
  )
}

// ── pieces ─────────────────────────────────────────────────────────────────

function useNow(offsetMs: number) {
  const [now, setNow] = useState(() => new Date(Date.now() + offsetMs))
  useEffect(() => {
    setNow(new Date(Date.now() + offsetMs))
    const t = setInterval(() => setNow(new Date(Date.now() + offsetMs)), 1000)
    return () => clearInterval(t)
  }, [offsetMs])
  return now
}

function deviceLabel() {
  const ua = navigator.userAgent
  if (/iphone/i.test(ua)) return 'iPhone'
  if (/ipad/i.test(ua)) return 'iPad'
  const m = ua.match(/Android [\d.]+; ([^;)]+)/)
  if (m) return m[1].trim()
  return /android/i.test(ua) ? 'Android' : 'متصفح'
}

function punchHint(s: { needsPasskey: boolean; geoStatus: string; inside: boolean; busy: boolean }) {
  if (s.busy) return 'جارٍ التحقق وتسجيل البصمة…'
  if (s.needsPasskey) return 'سجّل بصمة جهازك أولاً'
  if (s.geoStatus === 'denied') return 'اسمح بالوصول إلى الموقع لتتمكن من البصمة'
  if (s.geoStatus !== 'ok') return 'جارٍ تحديد موقعك…'
  if (!s.inside) return 'اقترب من موقع العمل لتفعيل البصمة'
  return 'اضغط وأكّد ببصمة الإصبع أو الوجه'
}

function locationTitle(status: string, fence: ReturnType<typeof evaluateFence> | null) {
  if (status === 'denied') return 'إذن الموقع مرفوض'
  if (status === 'unsupported') return 'تحديد الموقع غير مدعوم'
  if (status === 'unavailable') return 'تعذّر تحديد موقعك'
  if (status !== 'ok' || !fence) return 'جارٍ تحديد موقعك…'
  if (fence.inside) return 'أنت داخل نطاق العمل'
  return fence.nearest ? `خارج النطاق — تبعد ${formatDistance(Math.max(0, fence.nearest.distance_m - fence.nearest.radius_m))}` : 'خارج النطاق'
}

function LocationBadge({ status, inside }: { status: string; inside: boolean }) {
  const base = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl'
  if (status !== 'ok') return <span className={`${base} bg-[#eef3f3] text-[#5b7a7f]`}><Crosshair className="h-5 w-5" /></span>
  if (inside) return <span className={`${base} bg-[#e3f4ec] text-[#2f9e6f]`}><LocateFixed className="h-5 w-5" /></span>
  return <span className={`${base} bg-[#fdf1df] text-[#c27a17]`}><MapPin className="h-5 w-5" /></span>
}

function PunchButton({ isIn, disabled, busy, onClick }: { isIn: boolean; disabled: boolean; busy: boolean; onClick: () => void }) {
  const color = isIn
    ? 'from-[#4fc28c] to-[#2a9468] shadow-[0_18px_40px_-14px_rgba(47,158,111,.8)]'
    : 'from-[#f4b860] to-[#dc8f2c] shadow-[0_18px_40px_-14px_rgba(220,143,44,.8)]'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={isIn ? 'تسجيل حضور' : 'تسجيل انصراف'}
      className="group relative flex h-[184px] w-[184px] items-center justify-center rounded-full disabled:cursor-not-allowed"
    >
      {!disabled && <span aria-hidden className={`absolute inset-0 animate-ping rounded-full opacity-20 ${isIn ? 'bg-[#6cc196]' : 'bg-[#f0ae4f]'}`} style={{ animationDuration: '2.4s' }} />}
      <span aria-hidden className={`absolute inset-0 rounded-full ${disabled ? 'bg-[#e8eeee]' : isIn ? 'bg-[#e3f4ec]' : 'bg-[#fdf1df]'}`} />
      <span
        className={`relative flex h-[152px] w-[152px] flex-col items-center justify-center gap-1.5 rounded-full bg-gradient-to-b text-white transition-transform group-active:scale-95 ${
          disabled ? 'from-[#c5d3d4] to-[#aebfc1]' : color
        }`}
      >
        {busy ? <Loader2 className="h-12 w-12 animate-spin" /> : <Fingerprint className="h-14 w-14" strokeWidth={1.6} />}
        <span className="text-[16px] font-bold">{isIn ? 'تسجيل حضور' : 'تسجيل انصراف'}</span>
      </span>
    </button>
  )
}

function SourceTag({ source }: { source: string }) {
  const map: Record<string, [string, string]> = {
    app: ['الجوال', 'bg-[#e6f4f2] text-[#24817f]'],
    device: ['جهاز البصمة', 'bg-[#eef3f3] text-[#46676c]'],
    manual: ['يدوي', 'bg-[#fdf1df] text-[#a1621a]'],
  }
  const [label, cls] = map[source] || map.manual
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>
}

function Avatar({ name, image }: { name: string; image?: string | null }) {
  const initial = (name || '؟').trim().charAt(0)
  if (image) return <img src={image} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-white/30" />
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-[16px] font-bold ring-2 ring-white/25">{initial}</span>
  )
}

function Notice({ tone, icon, title, children }: { tone: 'warn'; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className={`flex gap-3 rounded-2xl border p-4 ${tone === 'warn' ? 'border-[#f0ae4f]/40 bg-[#fdf6ea] text-[#7a4c0f]' : ''}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-[14.5px] font-bold">{title}</p>
        <p className="mt-1 text-[13px] leading-relaxed opacity-90">{children}</p>
      </div>
    </section>
  )
}

function ResultSheet({ sheet, onClose }: { sheet: NonNullable<Sheet>; onClose: () => void }) {
  const ok = sheet.kind === 'success'
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0f2a2f]/50 backdrop-blur-[2px]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-[480px] rounded-t-3xl bg-white px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-3 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#dbe5e6]" />
        {ok ? (
          <>
            <CheckCircle2 className="mx-auto h-16 w-16 text-[#2f9e6f]" strokeWidth={1.6} />
            <p className="mt-3 text-[20px] font-bold">
              {sheet.result.log_type === 'IN' ? 'تم تسجيل الحضور' : 'تم تسجيل الانصراف'}
            </p>
            <p className="mt-1 text-[30px] font-bold tabular-nums text-[#1d4d56]">{hhmm(parseServerTime(sheet.result.time))}</p>
            {sheet.result.location && (
              <p className="mt-1 text-[13px] text-[#6b8589]">
                {sheet.result.location}
                {sheet.result.distance_m != null ? ` · على بعد ${formatDistance(sheet.result.distance_m)}` : ''}
              </p>
            )}
          </>
        ) : (
          <>
            <AlertTriangle className="mx-auto h-14 w-14 text-[#dc8f2c]" strokeWidth={1.7} />
            <p className="mt-3 text-[18px] font-bold">{sheet.title}</p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-[#5b7a7f]">{sheet.text}</p>
          </>
        )}
        <button onClick={onClose} className="mt-6 h-12 w-full rounded-xl bg-[#1d4d56] text-[15px] font-bold text-white">
          حسناً
        </button>
      </div>
    </div>
  )
}

function HomeSkeleton() {
  return (
    <div aria-busy="true" aria-label="جارٍ التحميل">
      <div className="h-[220px] bg-gradient-to-b from-[#1d4d56] to-[#163d44]" />
      <div className="-mt-11 space-y-4 px-4">
        {[76, 250, 120].map((h, i) => (
          <div key={i} className="animate-pulse rounded-2xl bg-white" style={{ height: h }} />
        ))}
      </div>
    </div>
  )
}

function ErrorState({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <AlertTriangle className="h-12 w-12 text-[#dc8f2c]" />
      <p className="mt-3 text-[16px] font-bold">تعذّر فتح التطبيق</p>
      <p className="mt-1.5 text-[14px] leading-relaxed text-[#5b7a7f]">{text}</p>
      <div className="mt-6 flex gap-3">
        <button onClick={onRetry} className="h-11 rounded-xl bg-[#1d4d56] px-6 text-[14px] font-bold text-white">
          إعادة المحاولة
        </button>
        <a href="/m/profile" className="flex h-11 items-center rounded-xl border border-[#dbe5e6] px-6 text-[14px] font-bold text-[#1d4d56]">
          حسابي
        </a>
      </div>
    </div>
  )
}
