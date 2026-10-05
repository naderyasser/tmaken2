'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { CalendarDays, Gift, AlertTriangle, CheckSquare, Umbrella, Loader2, Printer, Hourglass, Users, Fingerprint, MapPin, Radio } from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { frappeClient, isAuthError } from '@/lib/api-client'
import { frappeImageUrl } from '@/lib/utils'
import { subscribeRealtime } from '@/lib/frappe-realtime'
import { SessionRenew } from '@/components/login-page'
import { Skeleton } from '@/components/ui/skeleton'
import { APEX } from '@/lib/apex-colors'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/**
 * لوحة تحكم الحضور. Client redesign 2026-10-05: same data as before (one
 * get_dashboard call, live punches) in a layout of our own — framed panels,
 * the employees ring on the left, the status tiles in the middle, branch
 * summary as segmented bars and the 10-day trend as smooth areas.
 *
 * One call (base_meena.api.hr_dashboard.get_dashboard, branch-scoped) feeds
 * every widget. Live: each processed punch arrives over Frappe socket.io as
 * `hr_attendance_punch` (Apex: SignalR "AttandanceLog") and is prepended to
 * «حركات يوم …»; the cards/donut/branch chart then refresh (debounced 2s —
 * an enhancement over Apex, which only updates the table). 60s polling stays
 * as the fallback while the socket is down.
 */

type Bucket = 'present' | 'absent' | 'on_leave' | 'official_holiday' | 'weekly_off' | 'waiting'
type Totals = Record<Bucket, number> & { employees: number }
interface BranchRow extends Totals { branch: string; total: number }
interface Movement {
  id: string; code: string; name: string; image?: string | null; employee?: string | null
  transaction_time: string | null; location: { name: string }; branch?: string | null
  device?: string | null; status?: string; is_unknown?: boolean; clock_skew?: boolean
}
interface ListRow { code: string; name: string; branch?: string; shift?: string }
interface Dashboard {
  date: string; day_name: string; is_today: boolean; totals: Totals; by_branch: BranchRow[]
  max_value: number; movements: Movement[]; last_days: ({ date: string } & Totals)[]
  lists: Record<Bucket, ListRow[]>
}

const METHOD = 'base_meena.api.hr_dashboard.get_dashboard'
const POLL_MS = 60_000
const REFRESH_DEBOUNCE_MS = 2_000
const HIGHLIGHT_MS = 4_000
const WAITING = '#ffb62e' // --apex-amber
const WEEKLY = '#9d9fa0'

// Apex series colours (legend order = Apex legend order).
const SERIES: { key: Bucket; label: string; color: string }[] = [
  { key: 'present', label: 'حضور', color: APEX.chartPresent },
  { key: 'absent', label: 'الغياب', color: APEX.chartAbsent },
  { key: 'on_leave', label: 'الاجازات', color: APEX.chartLeave },
  { key: 'waiting', label: 'في الانتظار', color: WAITING },
  { key: 'weekly_off', label: 'عطله إسبوعية', color: WEEKLY },
]

// «ملخص حضور اليوم» cards, Apex RTL order (right → left).
const CARDS: { key: Bucket; label: string; icon: typeof CheckSquare; color: string; numberColor: string }[] = [
  { key: 'present', label: 'حضور', icon: CheckSquare, color: '#2960b6', numberColor: '#2960b6' },
  { key: 'absent', label: 'الغياب', icon: AlertTriangle, color: '#ff0000', numberColor: '#ff0000' },
  { key: 'weekly_off', label: 'عطله إسبوعية', icon: CalendarDays, color: '#808080', numberColor: '#808080' },
  { key: 'official_holiday', label: 'عطلات رسمية', icon: Gift, color: '#808080', numberColor: '#808080' },
  { key: 'on_leave', label: 'الاجازات', icon: Umbrella, color: '#2eaf7d', numberColor: '#2eaf7d' },
  { key: 'waiting', label: 'في الانتظار', icon: Hourglass, color: '#e59a0b', numberColor: '#c27c00' },
]

const EMPTY_TOTALS: Totals = { present: 0, absent: 0, on_leave: 0, official_holiday: 0, weekly_off: 0, waiting: 0, employees: 0 }

const pad = (n: number) => String(n).padStart(2, '0')
/** Apex «الحركة»: MM/DD/YYYY HH:mm:ss */
function apexDateTime(v: string | null): string {
  if (!v) return ''
  const d = new Date(v.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return v
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
function escapeHtml(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

function printList(title: string, rows: ListRow[]) {
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) return
  const body = rows.map((r) => `<tr><td>${escapeHtml(r.code)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.branch || '')}</td><td>${escapeHtml(r.shift || '')}</td></tr>`).join('')
    || '<tr><td colspan="4" style="text-align:center;padding:20px">لا توجد بيانات</td></tr>'
  w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><style>
    body{font-family:'Noto Kufi Arabic',Tahoma,sans-serif;padding:24px;direction:rtl}h1{font-size:18px;text-align:center}
    table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #ced4da;padding:6px 10px;text-align:right}thead tr{background:#bcc2d1}
  </style></head><body><h1>${escapeHtml(title)}</h1><table><thead><tr><th>الكود</th><th>الاسم</th><th>الفرع</th><th>الدوام</th></tr></thead><tbody>${body}</tbody></table></body></html>`)
  w.document.close(); w.focus(); w.print()
}

/** Chart tooltip: series title, then "<category>: <n>". */
function SeriesTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div dir="rtl" className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-[12px] shadow-lg backdrop-blur">
      <div className="mb-1 font-bold text-slate-700">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-1.5 text-slate-600">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color || p.stroke }} />
          {p.name}: <b className="text-slate-800">{p.value}</b>
        </div>
      ))}
    </div>
  )
}

/** A framed panel: thin coloured top rule, title with an icon chip, optional side slot. */
function Frame({ title, icon: Icon, side, children, className = '', testid }: {
  title: string; icon: typeof Users; side?: ReactNode; children: ReactNode; className?: string; testid?: string
}) {
  return (
    <section data-testid={testid}
      className={`relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,.04),0_8px_24px_-12px_rgba(41,96,182,.18)] ${className}`}>
      <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-l from-[#2960b6] via-[#3d8bd9] to-[#2eaf7d]" />
      <header className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#2960b6]/10 text-[#2960b6]">
            <Icon className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <h2 className="truncate text-[17px] font-bold text-slate-800">{title}</h2>
        </div>
        {side}
      </header>
      <div className="flex min-h-0 flex-1 flex-col px-5 pb-5">{children}</div>
    </section>
  )
}

function SeriesKey() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-slate-600">
      {SERIES.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}
        </span>
      ))}
    </div>
  )
}

function DefaultAvatar() {
  return (
    <svg viewBox="0 0 40 40" className="inline-block h-10 w-10" aria-hidden>
      <circle cx="20" cy="20" r="20" fill="#e8effb" />
      <circle cx="20" cy="15" r="7" fill="#2960b6" />
      <path d="M7 34c2-7 7-10 13-10s11 3 13 10a19 19 0 0 1-26 0z" fill="#2960b6" />
    </svg>
  )
}

const timeOf = (v: string | null) => (v ? v.slice(11, 19) : '')
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0)

export function PublicHrDashboard() {
  const params = useSearchParams()
  const date = params?.get('date') || undefined
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<'auth' | 'load' | null>(null)
  const [openCard, setOpenCard] = useState<Bucket | null>(null)
  const [live, setLive] = useState(false)
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dateRef = useRef<string | null>(null)

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const res = await frappeClient.call<Dashboard>(METHOD, date ? { date } : {})
      const payload = (res as any)?.message
      if (!payload?.totals) throw new Error('empty dashboard payload')
      dateRef.current = payload.date
      setData(payload)
      setError(null)
    } catch (e) {
      setError(isAuthError(e) ? 'auth' : 'load')
      if (!isAuthError(e)) console.error('Failed to load attendance dashboard:', e)
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => { load() }, [load])

  // Live punches: prepend + highlight, then a debounced full refresh.
  useEffect(() => {
    return subscribeRealtime<Movement & { removed?: boolean }>('hr_attendance_punch', (row) => {
      if (row?.removed) { // a held punch was replayed — its replacement arrives as its own event
        setData((d) => d && { ...d, movements: d.movements.filter((m) => m.id !== row.id) })
        return
      }
      if (!row?.transaction_time || row.transaction_time.slice(0, 10) !== dateRef.current) return
      setData((d) => {
        if (!d) return d
        const same = (m: Movement) => m.id === row.id
          || (m.code === row.code && m.transaction_time === row.transaction_time && m.device === row.device)
        return { ...d, movements: [row, ...d.movements.filter((m) => !same(m))] }
      })
      setFresh((s) => new Set(s).add(row.id))
      setTimeout(() => setFresh((s) => { const n = new Set(s); n.delete(row.id); return n }), HIGHLIGHT_MS)
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      refreshTimer.current = setTimeout(() => load(true), REFRESH_DEBOUNCE_MS)
    }, setLive)
  }, [load])

  // Fallback polling (paused while the tab is hidden).
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === 'visible') load(true) }, POLL_MS)
    return () => clearInterval(id)
  }, [load])

  const totals = data?.totals ?? EMPTY_TOTALS
  const off = totals.weekly_off + totals.official_holiday
  const expected = Math.max(0, totals.employees - off - totals.on_leave)
  const rate = pct(totals.present, expected)
  const ring = useMemo(() => [
    { name: 'حضور', value: totals.present, fill: APEX.chartPresent },
    { name: 'الغياب', value: totals.absent, fill: APEX.chartAbsent },
    { name: 'الاجازات', value: totals.on_leave, fill: APEX.chartLeave },
    { name: 'في الانتظار', value: totals.waiting, fill: WAITING },
    { name: 'عطله إسبوعية', value: off, fill: WEEKLY },
  ].filter((p) => p.value > 0), [totals, off])
  const branches = (data?.by_branch ?? []).map((b) => ({ ...b, weekly_off: b.weekly_off + b.official_holiday }))
  const lastDays = (data?.last_days ?? []).map((d) => ({ ...d, label: d.date.slice(5).split('-').reverse().join('/'), weekly_off: d.weekly_off + d.official_holiday }))
  const movements = data?.movements ?? []
  const card = CARDS.find((c) => c.key === openCard)
  const cardRows = openCard ? (data?.lists?.[openCard] ?? []) : []

  if (error === 'auth') return <div className="p-4"><SessionRenew /></div>

  return (
    <div className="min-h-full space-y-5 bg-[#f4f6fb] p-4 font-[family-name:var(--font-arabic)] md:p-6" dir="rtl" data-testid="hr-dashboard">
      {/* ── Banner ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-[#1f4f9e] via-[#2960b6] to-[#2f7fc4] px-6 py-5 text-white shadow-[0_12px_30px_-14px_rgba(31,79,158,.7)]">
        <svg aria-hidden className="pointer-events-none absolute -left-10 -top-16 h-64 w-64 opacity-[.12]" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="90" fill="none" stroke="white" strokeWidth="2" />
          <circle cx="100" cy="100" r="62" fill="none" stroke="white" strokeWidth="2" />
          <circle cx="100" cy="100" r="34" fill="none" stroke="white" strokeWidth="2" />
        </svg>
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[13px] text-white/75">ملخص حضور اليوم</p>
            <h1 className="mt-1 text-[22px] font-bold" data-testid="movements-title">
              {data ? `حركات يوم ${data.day_name} ${data.date}` : 'حركات اليوم'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/10 px-4 py-2 text-center ring-1 ring-white/20">
              <div className="text-[11px] text-white/75">نسبة الحضور</div>
              <div className="text-[20px] font-bold tabular-nums">{loading && !data ? '…' : `${rate}%`}</div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12px] ring-1 ring-white/20"
              title={live ? 'تحديث مباشر: متصل — تظهر كل بصمة فور تسجيلها' : 'تحديث مباشر غير متصل — يتم التحديث كل دقيقة'}>
              <span className={`h-2 w-2 rounded-full ${live ? 'animate-pulse bg-emerald-300' : 'bg-white/50'}`} data-testid="live-dot" data-live={live ? '1' : '0'} />
              {live ? 'مباشر' : 'كل دقيقة'}
            </span>
          </div>
        </div>
      </div>
      {error === 'load' && <p className="text-center text-[12px] text-rose-600">تعذّر تحميل البيانات من الخادم</p>}

      {/* ── Main row: movements (right) · status tiles (middle) · employees ring (left) ── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Frame title="حركات اليوم" icon={Fingerprint} className="xl:col-span-5"
          side={<span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[12px] font-bold text-slate-600 tabular-nums">{movements.length}</span>}>
          <div className="-mx-2 h-[430px] overflow-y-auto px-2" data-testid="movements">
            {loading && !data && <div className="py-16 text-center text-slate-400"><Loader2 className="inline h-5 w-5 animate-spin" aria-hidden /></div>}
            {!loading && movements.length === 0 && <div className="py-16 text-center text-[13px] text-slate-400">لا توجد حركات</div>}
            <ul className="space-y-2">
              {movements.map((m) => (
                <li key={m.id} data-testid="movement-row" data-code={m.code}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors duration-700 ${fresh.has(m.id) ? 'border-amber-300 bg-amber-50' : 'border-slate-100 bg-slate-50/60 hover:bg-slate-50'}`}>
                  {m.image
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={frappeImageUrl(m.image)} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-white" />
                    : <DefaultAvatar />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13.5px] font-bold text-slate-800" title={m.name}>{m.name}</span>
                      <span className="shrink-0 rounded-md bg-white px-1.5 text-[11px] text-slate-500 ring-1 ring-slate-200 tabular-nums">{m.code}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-slate-500" title={m.location?.name}>
                      <MapPin className="h-3 w-3 shrink-0" aria-hidden />{m.location?.name}
                    </div>
                  </div>
                  <div className="shrink-0 text-left">
                    <div className="rounded-lg bg-[#2960b6]/10 px-2 py-1 text-[13px] font-bold text-[#2960b6] tabular-nums" dir="ltr">
                      {timeOf(m.transaction_time)}
                      {m.clock_skew && <span className="ms-1 text-amber-600" title="ساعة جهاز البصمة غير مضبوطة — الحركة محفوظة وستُصحَّح تلقائياً">⚠</span>}
                    </div>
                    <div className="mt-0.5 text-[10.5px] text-slate-400 tabular-nums" dir="ltr">{apexDateTime(m.transaction_time).slice(0, 10)}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Frame>

        <Frame title="حالة الموظفين اليوم" icon={CheckSquare} className="xl:col-span-4">
          <div className="grid flex-1 grid-cols-2 gap-3">
            {CARDS.map((c) => (
              <button key={c.key} type="button" onClick={() => setOpenCard(c.key)} aria-haspopup="dialog" data-testid={`card-${c.key}`}
                className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-100 bg-gradient-to-b from-white to-slate-50 p-4 text-right transition hover:-translate-y-0.5 hover:shadow-md">
                <span aria-hidden className="absolute inset-y-3 right-0 w-1 rounded-l-full" style={{ background: c.color }} />
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${c.color}1a`, color: c.color }}>
                  <c.icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <span className="mt-3 text-[12.5px] text-slate-500">{c.label}</span>
                {loading && !data ? <Skeleton className="mt-1 h-7 w-10" />
                  : <span className="text-[26px] font-bold leading-tight tabular-nums" style={{ color: c.numberColor }}>{totals[c.key]}</span>}
              </button>
            ))}
          </div>
        </Frame>

        <Frame title="إجمالي الموظفين" icon={Users} className="xl:col-span-3">
          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="relative h-52 w-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart role="img" aria-label="إجمالي الموظفين">
                  <Pie data={ring.length ? ring : [{ name: '—', value: 1, fill: APEX.chartGrid }]} dataKey="value"
                    cx="50%" cy="50%" innerRadius={70} outerRadius={92} startAngle={90} endAngle={-270}
                    paddingAngle={ring.length > 1 ? 3 : 0} cornerRadius={8} stroke="none" isAnimationActive={false}>
                    {(ring.length ? ring : [{ fill: APEX.chartGrid }]).map((p, i) => <Cell key={i} fill={p.fill} />)}
                  </Pie>
                  {ring.length > 0 && <Tooltip contentStyle={{ direction: 'rtl', borderRadius: 10, fontSize: 12 }} />}
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[40px] font-bold leading-none text-slate-800 tabular-nums" data-testid="total-employees">{loading && !data ? '…' : totals.employees}</span>
                <span className="mt-1 text-[12px] text-slate-500">موظف</span>
              </div>
            </div>
            <div className="mt-4 w-full space-y-1.5">
              {ring.map((p) => (
                <div key={p.name} className="flex items-center justify-between text-[12.5px]">
                  <span className="inline-flex items-center gap-1.5 text-slate-600"><span className="h-2 w-2 rounded-full" style={{ background: p.fill }} />{p.name}</span>
                  <span className="font-bold text-slate-800 tabular-nums">{p.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Frame>
      </div>

      {/* ── Branches (segmented bars) · last 10 days (smooth areas) ── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Frame title="الحضور في الفروع" icon={MapPin} className="xl:col-span-5" testid="branch-chart">
          <div className="flex-1 space-y-4">
            {branches.length === 0 && <div className="py-10 text-center text-[13px] text-slate-400">لا توجد فروع</div>}
            {branches.map((b) => (
              <div key={b.branch}>
                <div className="mb-1.5 flex items-center justify-between text-[13px]">
                  <span className="truncate font-bold text-slate-700" title={b.branch}>{b.branch}</span>
                  <span className="shrink-0 text-slate-500 tabular-nums"><b className="text-[#2960b6]">{b.present}</b> / {b.total}</span>
                </div>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${b.branch}: ${b.present} حضور من ${b.total}`}>
                  {SERIES.map((s) => (b as any)[s.key] > 0 && (
                    <span key={s.key} title={`${s.label}: ${(b as any)[s.key]}`} style={{ width: `${pct((b as any)[s.key], b.total)}%`, background: s.color }} className="h-full" />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-slate-100 pt-3"><SeriesKey /></div>
        </Frame>

        <Frame title="حركات اخر 10 ايام" icon={Radio} className="xl:col-span-7" testid="trend-chart">
          <div className="h-[280px]">
            {loading && !data ? <Skeleton className="h-full w-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={lastDays} margin={{ right: 6, left: -22, top: 8, bottom: 0 }}>
                  <defs>
                    {SERIES.map((s) => (
                      <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid vertical={false} stroke={APEX.chartGrid} strokeDasharray="4 4" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: APEX.chartTick }} axisLine={false} tickLine={false} reversed />
                  <YAxis tick={{ fontSize: 11, fill: APEX.chartTick }} axisLine={false} tickLine={false} allowDecimals={false} orientation="right" />
                  <Tooltip content={<SeriesTooltip />} cursor={{ stroke: '#cbd5e1', strokeDasharray: '3 3' }} />
                  {SERIES.map((s) => (
                    <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2.5}
                      fill={`url(#g-${s.key})`} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-3 border-t border-slate-100 pt-3"><SeriesKey /></div>
        </Frame>
      </div>

      {/* ── «عرض <label>» drill-down ── */}
      <Dialog open={openCard !== null} onOpenChange={(o) => { if (!o) setOpenCard(null) }}>
        <DialogContent className="theme-hr hr-dialog-lg" data-testid="card-dialog">
          <DialogHeader><DialogTitle className="text-center">عرض {card?.label}</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-right text-[13px]">
              <thead className="sticky top-0">
                <tr className="h-11 border-y border-slate-300 bg-[var(--apex-thead)] text-[var(--apex-text)]">
                  <th className="px-3 font-bold">الكود</th><th className="px-3 font-bold">الاسم</th>
                  <th className="px-3 font-bold">الفرع</th><th className="px-3 font-bold">الدوام</th>
                </tr>
              </thead>
              <tbody>
                {cardRows.length === 0
                  ? <tr><td colSpan={4} className="py-8 text-center text-slate-400">لا توجد بيانات</td></tr>
                  : cardRows.map((r, i) => (
                    <tr key={`${r.code}-${i}`} className="h-11 border-b border-slate-100">
                      <td className="px-3">{r.code}</td><td className="px-3">{r.name}</td>
                      <td className="px-3 text-slate-600">{r.branch || '—'}</td><td className="px-3 text-slate-600">{r.shift || '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button type="button" onClick={() => printList(`عرض ${card?.label ?? ''}`, cardRows)}
              className="inline-flex h-9 items-center gap-1.5 rounded border border-slate-300 px-3 text-[13px] text-slate-600 hover:bg-slate-50">
              <Printer className="h-3.5 w-3.5" aria-hidden />الطباعة
            </button>
            <button type="button" onClick={() => setOpenCard(null)} className="h-9 rounded bg-[var(--apex-red)] px-6 text-[13px] text-white hover:opacity-90">إلغاء</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
