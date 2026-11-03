'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowRight, Loader2, LogIn, LogOut, Navigation, PauseCircle, Route, Timer } from 'lucide-react'

import { frappeClient } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import type { DayPunch, LivePin, Stop, TrailPoint, WorkLocation } from '@/components/hr/mobile-app/tracking-map'

const TrackingMap = dynamic(() => import('@/components/hr/mobile-app/tracking-map'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-slate-100" />,
})

const APP = 'base_meena.mobile_attendance.tamken_app'
const LIVE_REFRESH_MS = 30000

async function call<T = any>(method: string, args?: Record<string, any>): Promise<T> {
  const r = await frappeClient.call<T>(`${APP}.${method}`, args)
  return (r as any)?.message as T
}

interface LiveRow {
  employee: string
  employee_name: string
  number: string
  branch: string | null
  consent: boolean
  interval: number
  checked_in: boolean
  since: string | null
  last: { time: string; latitude: number; longitude: number; accuracy: number } | null
  points_today: number
}

interface DayData {
  employee: { name: string; employee_name: string; branch: string | null }
  date: string
  tracking: { tracking_enabled: boolean; tracking_consent: boolean; tracking_interval: number }
  punches: DayPunch[]
  trail: TrailPoint[]
  sessions: { checkin: string; in_time: string; out_time: string | null; points: number; distance_m: number }[]
  stops: Stop[]
  gaps: { from: string; to: string; minutes: number }[]
  locations: WorkLocation[]
  distance_m: number
}

/** Server times are Riyadh wall-clock strings; compare them against the server clock. */
function toMs(s: string) {
  const [d, t = '00:00:00'] = s.split(' ')
  const [y, mo, da] = d.split('-').map(Number)
  const [h, mi, se] = t.split(':').map((x) => Number(x.split('.')[0]))
  return new Date(y, mo - 1, da, h, mi, se || 0).getTime()
}

function hm(s: string) {
  return s.slice(11, 16)
}

function ago(mins: number) {
  if (mins < 1) return 'الآن'
  if (mins < 60) return `منذ ${mins} د`
  return `منذ ${Math.floor(mins / 60)} س ${mins % 60} د`
}

function km(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} كم` : `${m} م`
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type Status = 'live' | 'stale' | 'out' | 'consent'

function liveStatus(r: LiveRow, serverNow: number): { status: Status; minsAgo: number | null } {
  const minsAgo = r.last ? Math.max(0, Math.round((serverNow - toMs(r.last.time)) / 60000)) : null
  if (!r.consent) return { status: 'consent', minsAgo }
  if (!r.checked_in) return { status: 'out', minsAgo }
  // checked in but nothing for 3 intervals → app closed / no signal
  if (minsAgo == null ? true : minsAgo > r.interval * 3) return { status: 'stale', minsAgo }
  return { status: 'live', minsAgo }
}

const STATUS_UI: Record<Status, [string, string]> = {
  live: ['يُتتبَّع الآن', 'bg-emerald-50 text-emerald-700'],
  stale: ['حاضر — لا إشارة', 'bg-amber-50 text-amber-700'],
  out: ['خارج الدوام', 'bg-slate-100 text-slate-500'],
  consent: ['بانتظار موافقته', 'bg-amber-50 text-amber-700'],
}

export default function TrackingTab() {
  const [live, setLive] = useState<LiveRow[] | null>(null)
  const [serverNow, setServerNow] = useState(Date.now())
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [date, setDate] = useState(todayStr())

  const loadLive = useCallback(async () => {
    try {
      const r = await call<{ employees: LiveRow[]; server_time?: string }>('hr_tracking_live')
      setLive(r.employees)
      setServerNow(r.server_time ? toMs(r.server_time) : Date.now())
      setError('')
    } catch (e: any) {
      setError(e?.message || 'تعذّر تحميل بيانات التتبع')
    }
  }, [])

  useEffect(() => {
    loadLive()
    const t = setInterval(() => document.visibilityState === 'visible' && loadLive(), LIVE_REFRESH_MS)
    return () => clearInterval(t)
  }, [loadLive])

  const rows = useMemo(
    () =>
      (live || [])
        .map((r) => ({ ...r, ...liveStatus(r, serverNow) }))
        .sort((a, b) => ['live', 'stale', 'out', 'consent'].indexOf(a.status) - ['live', 'stale', 'out', 'consent'].indexOf(b.status)),
    [live, serverNow],
  )

  const pins: LivePin[] = useMemo(
    () =>
      rows
        .filter((r) => r.last && r.status !== 'consent')
        .map((r) => ({
          id: r.employee,
          label: r.employee_name.split(' ').filter((w) => w.length > 1).slice(0, 2).join(' '),
          latitude: r.last!.latitude,
          longitude: r.last!.longitude,
          tone: r.status === 'live' ? 'live' : r.status === 'stale' ? 'stale' : 'off',
        })),
    [rows],
  )

  if (error) {
    return (
      <div className="m-4 flex items-center gap-2 rounded bg-amber-50 border border-amber-200 px-3 py-2 text-[13px] text-amber-800">
        <AlertCircle className="h-4 w-4 shrink-0" />{error}
      </div>
    )
  }
  if (!live) return <div className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[var(--apex-blue)]" /></div>

  if (!live.length) {
    return (
      <div className="px-6 py-14 text-center">
        <Navigation className="mx-auto h-10 w-10 text-slate-300" />
        <p className="mt-3 text-[15px] font-bold text-slate-700">لا يوجد موظفون مفعّل لهم تتبع الموقع</p>
        <p className="mt-1 text-[13px] text-slate-500">
          فعّل «تتبع الموقع أثناء الدوام» للموظف من تبويب «الموظفون». بعد موافقته من التطبيق يُرسل موقعه من الحضور حتى الانصراف.
        </p>
      </div>
    )
  }

  const counts = {
    live: rows.filter((r) => r.status === 'live').length,
    stale: rows.filter((r) => r.status === 'stale').length,
    out: rows.filter((r) => r.status === 'out').length,
    consent: rows.filter((r) => r.status === 'consent').length,
  }

  return (
    <div className="grid lg:grid-cols-[320px_1fr] min-h-[560px]">
      <aside className="border-b lg:border-b-0 lg:border-e border-slate-200">
        <div className="grid grid-cols-4 gap-1 p-3 text-center text-[11.5px]">
          {([['live', 'يُتتبَّع', 'text-emerald-700'], ['stale', 'بلا إشارة', 'text-amber-700'], ['out', 'خارج الدوام', 'text-slate-500'], ['consent', 'بلا موافقة', 'text-amber-700']] as const).map(([k, label, cls]) => (
            <div key={k} className="rounded bg-slate-50 py-2">
              <p className={cn('text-[17px] font-bold tabular-nums', cls)}>{counts[k]}</p>
              <p className="text-slate-500">{label}</p>
            </div>
          ))}
        </div>
        <ul className="max-h-[480px] overflow-y-auto">
          {rows.map((r) => {
            const [label, cls] = STATUS_UI[r.status]
            return (
              <li key={r.employee}>
                <button
                  type="button"
                  onClick={() => setSelected(r.employee)}
                  className={cn(
                    'w-full border-t border-slate-100 px-3 py-2.5 text-right hover:bg-slate-50',
                    selected === r.employee && 'bg-[var(--apex-blue)]/5',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[13.5px] font-bold text-slate-800">{r.employee_name}</p>
                    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold', cls)}>{label}</span>
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-slate-500">
                    {r.number}
                    {r.since ? ` · حضور ${hm(r.since)}` : ''}
                    {r.minsAgo != null ? ` · آخر موقع ${ago(r.minsAgo)}` : ' · لا مواقع بعد'}
                    {` · كل ${r.interval} د`}
                  </p>
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      <section className="min-w-0">
        {selected ? (
          <DayView
            employee={selected}
            date={date}
            onDate={setDate}
            onBack={() => setSelected(null)}
          />
        ) : (
          <div className="flex h-full flex-col">
            <p className="px-4 py-3 text-[13px] text-slate-500">
              آخر موقع لكل موظف — يتحدّث كل 30 ثانية. اضغط على موظف لعرض مساره وتوقفاته.
            </p>
            <TrackingMap pins={pins} onPin={setSelected} className="min-h-[480px] flex-1" />
          </div>
        )}
      </section>
    </div>
  )
}

function DayView({ employee, date, onDate, onBack }: { employee: string; date: string; onDate: (d: string) => void; onBack: () => void }) {
  const [data, setData] = useState<DayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null)

  const load = useCallback(async () => {
    try {
      setData(await call<DayData>('hr_tracking_day', { employee, date }))
      setError('')
    } catch (e: any) {
      setError(e?.message || 'تعذّر تحميل المسار')
    } finally {
      setLoading(false)
    }
  }, [employee, date])

  useEffect(() => {
    setLoading(true)
    setData(null)
    load()
    if (date !== todayStr()) return
    const t = setInterval(() => document.visibilityState === 'visible' && load(), LIVE_REFRESH_MS)
    return () => clearInterval(t)
  }, [load, date])

  const timeline = useMemo(() => {
    if (!data) return []
    type Item = { t: string; kind: 'in' | 'out' | 'stop' | 'gap'; text: string; at?: { lat: number; lng: number } }
    const items: Item[] = [
      ...data.punches.map((p): Item => ({
        t: p.time,
        kind: p.log_type === 'IN' ? 'in' : 'out',
        text: p.log_type === 'IN' ? 'تسجيل حضور' : 'تسجيل انصراف',
        at: p.latitude != null && p.longitude != null ? { lat: p.latitude, lng: p.longitude } : undefined,
      })),
      ...data.stops.map((s, i): Item => ({
        t: s.from,
        kind: 'stop',
        text: `توقف ${i + 1} — ${s.minutes} د (حتى ${hm(s.to)})`,
        at: { lat: s.lat, lng: s.lng },
      })),
      ...data.gaps.map((g): Item => ({ t: g.from, kind: 'gap', text: `انقطاع الإشارة ${g.minutes} د (حتى ${hm(g.to)})` })),
    ]
    return items.sort((a, b) => a.t.localeCompare(b.t))
  }, [data])

  const icons = {
    in: <LogIn className="h-4 w-4 text-emerald-600" />,
    out: <LogOut className="h-4 w-4 text-red-600" />,
    stop: <Timer className="h-4 w-4 text-amber-600" />,
    gap: <PauseCircle className="h-4 w-4 text-slate-400" />,
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-100">
        <button type="button" onClick={onBack} className="inline-flex h-9 items-center gap-1 rounded border border-slate-200 px-3 text-[12.5px] font-bold text-slate-600 hover:bg-slate-50">
          <ArrowRight className="h-4 w-4" />كل الموظفين
        </button>
        <p className="text-[15px] font-bold text-slate-800">{data?.employee.employee_name || '…'}</p>
        <input
          type="date"
          value={date}
          max={todayStr()}
          onChange={(e) => e.target.value && onDate(e.target.value)}
          className="ms-auto h-9 rounded border border-[var(--apex-border)] bg-white px-2 text-[13px]"
          aria-label="التاريخ"
        />
      </div>

      {error ? (
        <div className="m-4 flex items-center gap-2 rounded bg-amber-50 border border-amber-200 px-3 py-2 text-[13px] text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
        </div>
      ) : loading || !data ? (
        <div className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[var(--apex-blue)]" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 text-center">
            <Stat icon={<Route className="h-4 w-4" />} label="المسافة المقطوعة" value={km(data.distance_m)} />
            <Stat icon={<Navigation className="h-4 w-4" />} label="نقاط الموقع" value={String(data.trail.length)} />
            <Stat icon={<Timer className="h-4 w-4" />} label="التوقفات (5 د فأكثر)" value={String(data.stops.length)} />
            <Stat icon={<PauseCircle className="h-4 w-4" />} label="انقطاعات" value={String(data.gaps.length)} warn={data.gaps.length > 0} />
          </div>
          <div className="grid xl:grid-cols-[1fr_300px] flex-1">
            <TrackingMap
              trail={data.trail}
              stops={data.stops}
              punches={data.punches}
              locations={data.locations}
              focus={focus}
              className="min-h-[420px]"
            />
            <div className="border-t xl:border-t-0 xl:border-s border-slate-200 max-h-[480px] overflow-y-auto">
              {timeline.length === 0 ? (
                <p className="px-4 py-10 text-center text-[13px] text-slate-400">
                  {data.punches.length ? 'لا توجد مواقع مسجّلة لهذا اليوم' : 'لا حركات حضور في هذا اليوم'}
                </p>
              ) : (
                <ol>
                  {timeline.map((it, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        disabled={!it.at}
                        onClick={() => it.at && setFocus({ ...it.at })}
                        className="flex w-full items-center gap-2.5 border-b border-slate-100 px-4 py-2.5 text-right text-[13px] enabled:hover:bg-slate-50"
                      >
                        {icons[it.kind]}
                        <span className="w-11 shrink-0 tabular-nums font-bold text-slate-700">{hm(it.t)}</span>
                        <span className={cn('flex-1', it.kind === 'gap' ? 'text-slate-400' : 'text-slate-700')}>{it.text}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              {!data.tracking.tracking_consent && data.tracking.tracking_enabled && (
                <p className="m-3 rounded bg-amber-50 px-3 py-2 text-[12px] text-amber-800">لم يوافق الموظف على التتبع من التطبيق بعد.</p>
              )}
              <p className="m-3 text-[11.5px] leading-relaxed text-slate-400">
                يُرسل التطبيق الموقع ما دام مفتوحاً على جوال الموظف؛ إغلاقه أو انقطاع الإنترنت يظهر هنا «انقطاعاً»، والنقاط المأخوذة بلا إنترنت تصل عند عودة الاتصال.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ icon, label, value, warn }: { icon: React.ReactNode; label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded border border-slate-200 bg-white py-2">
      <p className={cn('flex items-center justify-center gap-1.5 text-[16px] font-bold tabular-nums', warn ? 'text-amber-700' : 'text-slate-800')}>
        {icon}{value}
      </p>
      <p className="text-[11.5px] text-slate-500">{label}</p>
    </div>
  )
}
