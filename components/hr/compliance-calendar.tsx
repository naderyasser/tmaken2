'use client'

/**
 * GovernmentDeadlineCalendar — the "تقويم المواعيد الحكومية / Government Deadline
 * Calendar" section: a month view + list of Compliance Deadlines (Mudad / GOSI /
 * Qiwa / Nitaqat / Insurance / custom) auto-merged with document-expiry items,
 * colored by deadline type and status (Open / Overdue / Done). A "mark done"
 * action clears a deadline; prev / next walk the months.
 *
 * Self-contained: its own fetch fns + TS types live in this file. Mirrors the
 * other HR dashboard sections (token-only, logical-RTL, .theme-hr, skeleton +
 * retry, Arabic-first).
 */

import * as React from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  CalendarClock,
  CalendarDays,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Check,
  Clock,
  FileWarning,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import frappeClient from '@/lib/api-client'

/* ─────────────────────────── types (self-contained) ─────────────────────────── */

type DeadlineStatus = 'Open' | 'Overdue' | 'Done'

interface DeadlineRow {
  name: string
  title: string
  deadline_type: string
  company?: string | null
  due_date: string
  status: DeadlineStatus
  assignee?: string | null
  source_doctype?: string | null
  source_name?: string | null
}

interface DocExpiryRow {
  title: string
  due_date: string
  deadline_type: string // "Document Expiry"
  source_doctype?: string | null
  source_name?: string | null
}

interface DeadlinesResponse {
  deadlines: DeadlineRow[]
  document_expiries: DocExpiryRow[]
  from: string
  to: string
}

/** Normalized calendar item unifying deadlines + document expiries. */
interface CalItem {
  key: string
  /** Compliance Deadline name — present only for real records (mark-done target). */
  name: string | null
  title: string
  deadline_type: string
  due_date: string // YYYY-MM-DD
  status: DeadlineStatus | null // null for document expiries
  isDoc: boolean
}

type TX = (en: string, ar: string) => string

/* ─────────────────────────── data layer (self-contained) ─────────────────────────── */

async function fetchDeadlines(
  fromDate: string,
  toDate: string,
  signal?: AbortSignal,
): Promise<DeadlinesResponse> {
  const res = await frappeClient.call<DeadlinesResponse>(
    'base_meena.api.compliance_calendar.get_deadlines',
    { from_date: fromDate, to_date: toDate },
    signal,
  )
  const m = res?.message
  return {
    deadlines: Array.isArray(m?.deadlines) ? m!.deadlines : [],
    document_expiries: Array.isArray(m?.document_expiries) ? m!.document_expiries : [],
    from: m?.from ?? fromDate,
    to: m?.to ?? toDate,
  }
}

async function markDeadlineDone(name: string, signal?: AbortSignal): Promise<void> {
  await frappeClient.call(
    'base_meena.api.compliance_calendar.mark_done',
    { name },
    signal,
  )
}

/* ─────────────────────────── date helpers (Gregorian, Latin numerals) ─────────────────────────── */

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]
const MONTHS_SHORT_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]
// Sunday-first, matching JS getDay() index 0..6
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAYS_AR = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
function ymd(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`
}
/** Parse a "YYYY-MM-DD" string → {y,m(0-based),d} without timezone drift. */
function parseYmd(s: string): { y: number; m: number; d: number } | null {
  const parts = String(s || '').split('-')
  if (parts.length < 3) return null
  const y = Number(parts[0])
  const m = Number(parts[1]) - 1
  const d = Number(parts[2].slice(0, 2))
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null
  return { y, m, d }
}

/* ─────────────────────────── tone / type / status meta ─────────────────────────── */

// Primary tone drives the dot + row accent. Overdue > Done > Open; docs = warning.
function toneVar(item: CalItem): string {
  if (item.isDoc) return '--warning'
  if (item.status === 'Overdue') return '--destructive'
  if (item.status === 'Done') return '--success'
  return '--info'
}

const TYPE_META: Record<string, { en: string; ar: string; varName: string }> = {
  GOSI: { en: 'GOSI', ar: 'التأمينات', varName: '--info' },
  Mudad: { en: 'Mudad', ar: 'مدد', varName: '--primary' },
  Qiwa: { en: 'Qiwa', ar: 'قوى', varName: '--warning' },
  Nitaqat: { en: 'Nitaqat', ar: 'نطاقات', varName: '--success' },
  Insurance: { en: 'Insurance', ar: 'تأمين', varName: '--info' },
  'Document Expiry': { en: 'Document Expiry', ar: 'انتهاء وثيقة', varName: '--muted-foreground' },
}
function typeMeta(t: string) {
  return TYPE_META[t] ?? { en: t || 'Other', ar: t || 'أخرى', varName: '--muted-foreground' }
}

const STATUS_META: Record<DeadlineStatus, { en: string; ar: string; varName: string }> = {
  Open: { en: 'Open', ar: 'مفتوح', varName: '--info' },
  Overdue: { en: 'Overdue', ar: 'متأخر', varName: '--destructive' },
  Done: { en: 'Done', ar: 'منجز', varName: '--success' },
}

const CARD = 'hr-lift rounded-xl border border-border bg-card text-card-foreground shadow-card p-5'

/* ─────────────────────────── small pieces ─────────────────────────── */

function Badge({ varName, label }: { varName: string; label: string }) {
  const color = `hsl(var(${varName}))`
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ backgroundColor: `hsl(var(${varName}) / 0.12)`, color }}
    >
      {label}
    </span>
  )
}

function StatTile({
  varName,
  n,
  label,
}: {
  varName: string
  n: number
  label: string
}) {
  return (
    <div
      className="flex flex-col items-center rounded-lg py-2.5"
      style={{
        backgroundColor: `hsl(var(${varName}) / ${n > 0 ? 0.12 : 0.06})`,
        color: `hsl(var(${varName}))`,
      }}
    >
      <span className="text-xl font-bold leading-none tabular-nums">{n}</span>
      <span className="mt-1 text-[10px] font-medium">{label}</span>
    </div>
  )
}

/* ─────────────────────────── list row ─────────────────────────── */

function DeadlineRowItem({
  item,
  tx,
  pending,
  onMarkDone,
}: {
  item: CalItem
  tx: TX
  pending: boolean
  onMarkDone: (name: string) => void
}) {
  const tone = toneVar(item)
  const tm = typeMeta(item.deadline_type)
  const p = parseYmd(item.due_date)
  const dateLabel = p ? `${p.d} ${tx(MONTHS_SHORT_EN[p.m], MONTHS_AR[p.m])}` : item.due_date
  const canMark = !!item.name && item.status !== 'Done'

  return (
    <li className="flex items-center gap-3 rounded-lg border border-border/60 bg-accent/30 px-3 py-2.5">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: `hsl(var(${tone}))` }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge varName={tm.varName} label={tx(tm.en, tm.ar)} />
          <span className="inline-flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground">
            <Clock className="h-3 w-3" />
            {dateLabel}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {item.isDoc ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
            <FileWarning className="h-3.5 w-3.5" style={{ color: 'hsl(var(--warning))' }} />
          </span>
        ) : (
          item.status && (
            <Badge varName={STATUS_META[item.status].varName} label={tx(STATUS_META[item.status].en, STATUS_META[item.status].ar)} />
          )
        )}

        {canMark && (
          <button
            type="button"
            onClick={() => item.name && onMarkDone(item.name)}
            disabled={pending}
            aria-label={tx('Mark done', 'وضع كمنجز')}
            title={tx('Mark done', 'وضع كمنجز')}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-border px-2 text-[11px] font-medium text-foreground transition-colors hover:bg-success/10 hover:text-success disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{tx('Done', 'إنجاز')}</span>
          </button>
        )}
      </div>
    </li>
  )
}

/* ─────────────────────────── month grid ─────────────────────────── */

function MonthGrid({
  year,
  month,
  itemsByDay,
  today,
  selectedDay,
  onSelectDay,
  tx,
}: {
  year: number
  month: number
  itemsByDay: Map<number, CalItem[]>
  today: { y: number; m: number; d: number }
  selectedDay: number | null
  onSelectDay: (d: number | null) => void
  tx: TX
}) {
  const firstWeekday = new Date(year, month, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS_EN.map((w, i) => (
          <div key={w} className="pb-1 text-center text-[10px] font-semibold text-muted-foreground">
            {tx(w, WEEKDAYS_AR[i])}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (day == null) return <div key={`e-${idx}`} className="min-h-[58px] sm:min-h-[76px]" />
          const items = itemsByDay.get(day) ?? []
          const isToday = today.y === year && today.m === month && today.d === day
          const isSelected = selectedDay === day
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelectDay(isSelected ? null : day)}
              className={[
                'group relative flex min-h-[58px] flex-col rounded-lg border p-1.5 text-start transition-colors sm:min-h-[76px]',
                isSelected
                  ? 'border-primary bg-accent'
                  : 'border-border/60 hover:border-primary/50 hover:bg-accent/50',
              ].join(' ')}
            >
              <span
                className={[
                  'inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-md px-1 text-[11px] tabular-nums',
                  isToday ? 'bg-primary font-bold text-primary-foreground' : 'font-medium text-muted-foreground',
                ].join(' ')}
              >
                {day}
              </span>
              {items.length > 0 && (
                <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
                  {items.slice(0, 4).map((it) => (
                    <span
                      key={it.key}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: `hsl(var(${toneVar(it)}))` }}
                    />
                  ))}
                  {items.length > 4 && (
                    <span className="text-[9px] font-semibold leading-none text-muted-foreground">
                      +{items.length - 4}
                    </span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ─────────────────────────── skeleton ─────────────────────────── */

function SkeletonBlock() {
  return (
    <div className={CARD}>
      <div className="mb-4 flex items-center justify-between">
        <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
        <div className="h-5 w-32 animate-pulse rounded bg-muted" />
        <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="min-h-[58px] animate-pulse rounded-lg bg-muted sm:min-h-[76px]" />
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────── main export ─────────────────────────── */

export default function GovernmentDeadlineCalendarSection() {
  const { isRTL } = useI18n()
  const tx: TX = (en, ar) => (isRTL ? ar : en)

  const now = new Date()
  const today = { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() }

  const [cursor, setCursor] = useState<{ year: number; month: number }>({
    year: today.y,
    month: today.m,
  })
  const [data, setData] = useState<DeadlinesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [pending, setPending] = useState<Set<string>>(new Set())

  const load = React.useCallback(
    (year: number, month: number, signal?: AbortSignal) => {
      setLoading(true)
      setError(false)
      const from = ymd(year, month, 1)
      const to = ymd(year, month, new Date(year, month + 1, 0).getDate())
      fetchDeadlines(from, to, signal)
        .then((d) => {
          if (signal?.aborted) return
          setData(d)
          setLoading(false)
        })
        .catch(() => {
          if (signal?.aborted) return
          setError(true)
          setLoading(false)
        })
    },
    [],
  )

  useEffect(() => {
    const ctrl = new AbortController()
    setSelectedDay(null)
    load(cursor.year, cursor.month, ctrl.signal)
    return () => ctrl.abort()
  }, [cursor, load])

  const goMonth = (delta: number) => {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  /* combine deadlines + document expiries into normalized items */
  const items: CalItem[] = useMemo(() => {
    if (!data) return []
    const out: CalItem[] = []
    data.deadlines.forEach((r, i) =>
      out.push({
        key: `d-${r.name || i}`,
        name: r.name || null,
        title: r.title,
        deadline_type: r.deadline_type,
        due_date: r.due_date,
        status: r.status,
        isDoc: false,
      }),
    )
    data.document_expiries.forEach((r, i) =>
      out.push({
        key: `x-${r.source_name || i}`,
        name: null,
        title: r.title,
        deadline_type: r.deadline_type || 'Document Expiry',
        due_date: r.due_date,
        status: null,
        isDoc: true,
      }),
    )
    out.sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0))
    return out
  }, [data])

  const itemsByDay = useMemo(() => {
    const map = new Map<number, CalItem[]>()
    for (const it of items) {
      const p = parseYmd(it.due_date)
      if (!p || p.y !== cursor.year || p.m !== cursor.month) continue
      const arr = map.get(p.d) ?? []
      arr.push(it)
      map.set(p.d, arr)
    }
    return map
  }, [items, cursor])

  const counts = useMemo(() => {
    let open = 0,
      overdue = 0,
      done = 0,
      docs = 0
    for (const it of items) {
      if (it.isDoc) docs++
      else if (it.status === 'Overdue') overdue++
      else if (it.status === 'Done') done++
      else open++
    }
    return { open, overdue, done, docs }
  }, [items])

  const visibleItems = useMemo(() => {
    if (selectedDay == null) return items
    return items.filter((it) => {
      const p = parseYmd(it.due_date)
      return p && p.d === selectedDay && p.y === cursor.year && p.m === cursor.month
    })
  }, [items, selectedDay, cursor])

  const monthLabel = `${tx(MONTHS_EN[cursor.month], MONTHS_AR[cursor.month])} ${cursor.year}`
  const isCurrentMonth = cursor.year === today.y && cursor.month === today.m

  const handleMarkDone = (name: string) => {
    setPending((prev) => new Set(prev).add(name))
    // optimistic
    setData((prev) =>
      prev
        ? { ...prev, deadlines: prev.deadlines.map((d) => (d.name === name ? { ...d, status: 'Done' as DeadlineStatus } : d)) }
        : prev,
    )
    markDeadlineDone(name)
      .catch(() => {
        // revert by reloading the month
        load(cursor.year, cursor.month)
      })
      .finally(() => {
        setPending((prev) => {
          const n = new Set(prev)
          n.delete(name)
          return n
        })
      })
  }

  /* Prev/next chevrons respect reading direction. */
  const PrevIcon = isRTL ? ChevronRight : ChevronLeft
  const NextIcon = isRTL ? ChevronLeft : ChevronRight

  return (
    <div className="mb-8" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* section header */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">
            {tx('Government Deadline Calendar', 'تقويم المواعيد الحكومية')}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => load(cursor.year, cursor.month)}
          disabled={loading}
          aria-label={tx('Refresh', 'تحديث')}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error ? (
        <div className={`${CARD} flex flex-col items-center gap-3 py-10 text-center`}>
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {tx("Couldn't load the deadline calendar", 'تعذّر تحميل تقويم المواعيد')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {tx('Check your connection and try again.', 'تحقّق من الاتصال وحاول مرة أخرى.')}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => load(cursor.year, cursor.month)}>
            <RefreshCw className="me-1.5 h-3.5 w-3.5" />
            {tx('Retry', 'إعادة المحاولة')}
          </Button>
        </div>
      ) : loading || !data ? (
        <SkeletonBlock />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          {/* calendar */}
          <section className={`${CARD} lg:col-span-3`}>
            {/* month navigator */}
            <div className="mb-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => goMonth(-1)}
                aria-label={tx('Previous month', 'الشهر السابق')}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <PrevIcon className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold tabular-nums text-foreground">{monthLabel}</span>
              </div>
              <div className="flex items-center gap-1">
                {!isCurrentMonth && (
                  <button
                    type="button"
                    onClick={() => setCursor({ year: today.y, month: today.m })}
                    className="rounded-lg px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    {tx('Today', 'اليوم')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => goMonth(1)}
                  aria-label={tx('Next month', 'الشهر التالي')}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <NextIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            <MonthGrid
              year={cursor.year}
              month={cursor.month}
              itemsByDay={itemsByDay}
              today={today}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              tx={tx}
            />

            {/* month summary tiles */}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatTile varName="--info" n={counts.open} label={tx('Open', 'مفتوح')} />
              <StatTile varName="--destructive" n={counts.overdue} label={tx('Overdue', 'متأخر')} />
              <StatTile varName="--success" n={counts.done} label={tx('Done', 'منجز')} />
              <StatTile varName="--warning" n={counts.docs} label={tx('Expiries', 'انتهاءات')} />
            </div>
          </section>

          {/* list */}
          <section className={`${CARD} lg:col-span-2`}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="truncate text-sm font-semibold text-foreground">
                {selectedDay != null
                  ? tx(`Deadlines on ${selectedDay}`, `مواعيد يوم ${selectedDay}`)
                  : tx('Deadlines this month', 'مواعيد هذا الشهر')}
              </h3>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-[11px] tabular-nums text-muted-foreground">{visibleItems.length}</span>
                {selectedDay != null && (
                  <button
                    type="button"
                    onClick={() => setSelectedDay(null)}
                    className="rounded-lg px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    {tx('Clear', 'إلغاء')}
                  </button>
                )}
              </div>
            </div>

            {visibleItems.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success/10 text-success">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <p className="text-sm font-semibold text-foreground">
                  {tx('Nothing due here 🎉', 'لا مواعيد مستحقة 🎉')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedDay != null
                    ? tx('No deadlines on the selected day.', 'لا مواعيد في اليوم المحدد.')
                    : tx('No compliance deadlines or expiries this month.', 'لا مواعيد امتثال أو انتهاءات هذا الشهر.')}
                </p>
              </div>
            ) : (
              <ul className="hr-stagger flex max-h-[520px] flex-col gap-2 overflow-y-auto pe-0.5">
                {visibleItems.map((it) => (
                  <DeadlineRowItem
                    key={it.key}
                    item={it}
                    tx={tx}
                    pending={!!it.name && pending.has(it.name)}
                    onMarkDone={handleMarkDone}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
