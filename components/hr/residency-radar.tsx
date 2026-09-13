'use client'

/**
 * ResidencyRadar — the "رادار الإقامات / Residency Radar" section: every Iqama
 * renewal, Exit/Re-entry, Final Exit, Transfer and Work Permit event coming due
 * across the HR-scoped active workforce in the next 90 days, each with an
 * estimated-cost column, grouped/severity-tinted by days-to-due — and the
 * rolling next-12-month budget forecast total shown prominently up top.
 *
 * One read-only backend call:
 *   base_meena.api.iqama_lifecycle.company_residency_radar  →  { message }
 *
 * Self-contained: fetch fn + TS interfaces live in this file. Mirrors the other
 * HR dashboard sections (token-only colors, logical-RTL, .theme-hr, skeleton +
 * retry, Arabic-first). No edits to any shared file.
 */

import * as React from 'react'
import { useEffect, useState } from 'react'
import {
  Radar,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Wallet,
  Users,
  CalendarClock,
  IdCard,
  Briefcase,
  PlaneTakeoff,
  LogOut,
  ArrowLeftRight,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import frappeClient from '@/lib/api-client'

/* ─────────────────────────── types (self-contained) ─────────────────────────── */

interface ResidencyRow {
  kind: string
  employee: string
  employee_name: string | null
  branch: string | null
  company: string | null
  idx: number | null
  event_type: string | null
  due_date: string | null
  due_hijri: string | null
  days_left: number | null
  est_cost: number
  status: string | null
}

interface BudgetForecast {
  window_months: number
  as_of: string
  until: string
  event_count: number
  total_est_cost: number
  by_event_type: Record<string, number>
}

interface ResidencyRadarData {
  as_of: string
  window_days: number
  currency: string
  employee_count: number
  count: number
  total_est_cost_90d: number
  rows: ResidencyRow[]
  budget_forecast: BudgetForecast
}

/* ─────────────────────────── fetch (self-contained) ─────────────────────────── */

async function fetchResidencyRadar(signal?: AbortSignal): Promise<ResidencyRadarData> {
  const res = await frappeClient.call<ResidencyRadarData>(
    'base_meena.api.iqama_lifecycle.company_residency_radar',
    {},
    signal,
  )
  const message = (res as { message?: ResidencyRadarData })?.message
  if (!message) throw new Error('Empty residency radar response')
  return message
}

/* ─────────────────────────── helpers ─────────────────────────── */

const CARD = 'hr-lift rounded-xl border border-border bg-card text-card-foreground shadow-card p-5'

type TX = (en: string, ar: string) => string

/** Latin-numeral currency, RTL-aware symbol placement. */
function money(amount: number | null | undefined, currency: string, isRTL: boolean): string {
  const n = Math.round(Number(amount) || 0)
  const num = n.toLocaleString('en-US')
  const cur = currency || 'SAR'
  const sym = cur === 'SAR' ? (isRTL ? 'ر.س' : 'SAR') : cur
  return isRTL ? `${num} ${sym}` : `${sym} ${num}`
}

type Bucket = 'urgent' | 'soon' | 'upcoming' | 'planned'

const BUCKET_META: Record<Bucket, { varName: string; en: string; ar: string }> = {
  urgent: { varName: '--destructive', en: '≤ 15 days', ar: 'خلال 15 يومًا' },
  soon: { varName: '--warning', en: '16–30 days', ar: '16–30 يومًا' },
  upcoming: { varName: '--info', en: '31–60 days', ar: '31–60 يومًا' },
  planned: { varName: '--success', en: '61–90 days', ar: '61–90 يومًا' },
}
const BUCKET_ORDER: Bucket[] = ['urgent', 'soon', 'upcoming', 'planned']

function bucketOf(days: number | null | undefined): Bucket {
  const d = days == null ? 999 : days
  if (d <= 15) return 'urgent'
  if (d <= 30) return 'soon'
  if (d <= 60) return 'upcoming'
  return 'planned'
}

const EVENT_META: Record<
  string,
  { ar: string; icon: React.ComponentType<{ className?: string }> }
> = {
  'Iqama Renewal': { ar: 'تجديد الإقامة', icon: IdCard },
  'Work Permit': { ar: 'رخصة العمل', icon: Briefcase },
  'Exit/Re-entry': { ar: 'تأشيرة خروج وعودة', icon: PlaneTakeoff },
  'Final Exit': { ar: 'خروج نهائي', icon: LogOut },
  'Transfer': { ar: 'نقل الكفالة', icon: ArrowLeftRight },
}

function eventLabel(type: string | null, tx: TX): string {
  if (!type) return tx('Event', 'حدث')
  const m = EVENT_META[type]
  return m ? tx(type, m.ar) : type
}
function eventIcon(type: string | null): React.ComponentType<{ className?: string }> {
  return (type && EVENT_META[type]?.icon) || FileText
}

/* ─────────────────────────── forecast hero + stats ─────────────────────────── */

function ForecastCard({ data, tx, isRTL }: { data: ResidencyRadarData; tx: TX; isRTL: boolean }) {
  const fc = data.budget_forecast
  const cur = data.currency
  const byType = Object.entries(fc.by_event_type || {}).sort((a, b) => b[1] - a[1])
  const maxVal = byType.reduce((m, [, v]) => Math.max(m, v), 0) || 1

  return (
    <section className={CARD}>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Wallet className="h-4 w-4" />
        </span>
        <h3 className="truncate text-sm font-semibold text-foreground">
          {tx('12-month budget forecast', 'توقّع ميزانية 12 شهرًا')}
        </h3>
      </div>

      {/* Prominent forecast total */}
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold leading-none tabular-nums text-foreground sm:text-4xl">
          {money(fc.total_est_cost, cur, isRTL)}
        </span>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <CalendarClock className="h-3 w-3" />
        <span className="tabular-nums text-foreground/70">{fc.event_count}</span>
        {tx('renewals estimated through', 'تجديد متوقّع حتى')}{' '}
        <span className="tabular-nums text-foreground/70">{fc.until}</span>
      </p>

      {/* by-event-type breakdown bars */}
      {byType.length > 0 && (
        <div className="mt-4 space-y-2.5">
          {byType.map(([type, val]) => {
            const Icon = eventIcon(type)
            return (
              <div key={type}>
                <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                  <span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
                    <Icon className="h-3 w-3 shrink-0 text-primary" />
                    <span className="truncate text-foreground/80">{eventLabel(type, tx)}</span>
                  </span>
                  <span className="shrink-0 tabular-nums font-medium text-foreground/80">
                    {money(val, cur, isRTL)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
                    style={{ width: `${Math.max(4, (val / maxVal) * 100)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* secondary stat tiles */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center rounded-lg bg-accent py-2.5">
          <span className="text-lg font-bold leading-none tabular-nums text-foreground">
            {money(data.total_est_cost_90d, cur, isRTL)}
          </span>
          <span className="mt-1 text-[10px] font-medium text-muted-foreground">
            {tx('Due in 90 days', 'مستحق خلال 90 يومًا')}
          </span>
        </div>
        <div className="flex flex-col items-center rounded-lg bg-accent py-2.5">
          <span className="text-lg font-bold leading-none tabular-nums text-foreground">{data.count}</span>
          <span className="mt-1 text-[10px] font-medium text-muted-foreground">
            {tx('Events', 'أحداث')}
          </span>
        </div>
        <div className="flex flex-col items-center rounded-lg bg-accent py-2.5">
          <span className="inline-flex items-center gap-1 text-lg font-bold leading-none tabular-nums text-foreground">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            {data.employee_count}
          </span>
          <span className="mt-1 text-[10px] font-medium text-muted-foreground">
            {tx('Scanned', 'تم الفحص')}
          </span>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────── severity strip ─────────────────────────── */

function SeverityStrip({ counts, tx }: { counts: Record<Bucket, number>; tx: TX }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {BUCKET_ORDER.map((b) => {
        const meta = BUCKET_META[b]
        const n = counts[b]
        return (
          <div
            key={b}
            className="flex flex-col items-center rounded-lg py-2.5"
            style={{
              backgroundColor: `hsl(var(${meta.varName}) / ${n > 0 ? 0.12 : 0.06})`,
              color: `hsl(var(${meta.varName}))`,
            }}
          >
            <span className="text-xl font-bold leading-none tabular-nums">{n}</span>
            <span className="mt-1 text-[10px] font-medium">{tx(meta.en, meta.ar)}</span>
          </div>
        )
      })}
    </div>
  )
}

/* ─────────────────────────── events table ─────────────────────────── */

function EventsTable({ data, tx, isRTL }: { data: ResidencyRadarData; tx: TX; isRTL: boolean }) {
  const cur = data.currency
  return (
    <section className={CARD}>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <CalendarClock className="h-4 w-4" />
        </span>
        <h3 className="truncate text-sm font-semibold text-foreground">
          {tx('Upcoming residency events', 'الأحداث القادمة للإقامات')}
        </h3>
        <span className="ms-auto text-[11px] tabular-nums text-muted-foreground">
          {tx('next', 'خلال')} {data.window_days} {tx('days', 'يومًا')}
        </span>
      </div>

      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-start text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] text-muted-foreground">
              <th className="px-2 py-2 text-start font-medium">{tx('Employee', 'الموظف')}</th>
              <th className="px-2 py-2 text-start font-medium">{tx('Event', 'الحدث')}</th>
              <th className="px-2 py-2 text-start font-medium">{tx('Due date', 'تاريخ الاستحقاق')}</th>
              <th className="px-2 py-2 text-center font-medium">{tx('Days left', 'الأيام المتبقية')}</th>
              <th className="px-2 py-2 text-end font-medium">{tx('Est. cost', 'التكلفة المقدّرة')}</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r, i) => {
              const b = bucketOf(r.days_left)
              const meta = BUCKET_META[b]
              const color = `hsl(var(${meta.varName}))`
              const Icon = eventIcon(r.event_type)
              return (
                <tr
                  key={`${r.employee}-${r.idx}-${i}`}
                  className="border-b border-border/60 last:border-0 hover:bg-accent/40"
                >
                  <td className="px-2 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-foreground">
                        {r.employee_name || r.employee}
                      </div>
                      {r.branch && (
                        <div className="truncate text-[11px] text-muted-foreground">{r.branch}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-foreground/90">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="truncate">{eventLabel(r.event_type, tx)}</span>
                    </span>
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="text-foreground/90">{r.due_hijri || r.due_date || '—'}</div>
                    {r.due_hijri && r.due_date && (
                      <div className="text-[11px] tabular-nums text-muted-foreground">{r.due_date}</div>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <span
                      className="inline-flex min-w-[2.5rem] items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums"
                      style={{ backgroundColor: `hsl(var(${meta.varName}) / 0.12)`, color }}
                    >
                      {r.days_left == null ? '—' : r.days_left}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-end font-medium tabular-nums text-foreground">
                    {money(r.est_cost, cur, isRTL)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border text-sm">
              <td className="px-2 py-2.5 font-semibold text-foreground" colSpan={4}>
                {tx('Total due in 90 days', 'إجمالي المستحق خلال 90 يومًا')}
              </td>
              <td className="px-2 py-2.5 text-end font-bold tabular-nums text-foreground">
                {money(data.total_est_cost_90d, cur, isRTL)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}

/* ─────────────────────────── skeleton ─────────────────────────── */

function SkeletonCard() {
  return (
    <div className={CARD}>
      <div className="mb-4 flex items-center gap-2.5">
        <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
      </div>
      <div className="mb-4 h-10 w-48 animate-pulse rounded bg-muted" />
      <div className="space-y-2.5">
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
        <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
      </div>
    </div>
  )
}

/* ─────────────────────────── main export ─────────────────────────── */

export default function ResidencyRadarSection() {
  const { isRTL } = useI18n()
  const tx: TX = (en, ar) => (isRTL ? ar : en)

  const [data, setData] = useState<ResidencyRadarData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = React.useCallback((signal?: AbortSignal) => {
    setLoading(true)
    setError(false)
    fetchResidencyRadar(signal)
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
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    load(ctrl.signal)
    return () => ctrl.abort()
  }, [load])

  const counts: Record<Bucket, number> = { urgent: 0, soon: 0, upcoming: 0, planned: 0 }
  if (data) for (const r of data.rows) counts[bucketOf(r.days_left)] += 1

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Radar className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">
            {tx('Residency Radar', 'رادار الإقامات')}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {data?.as_of && !loading && !error && (
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {tx('As of', 'حتى')} {data.as_of}
            </span>
          )}
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            aria-label={tx('Refresh', 'تحديث')}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error ? (
        <div className={`${CARD} flex flex-col items-center gap-3 py-10 text-center`}>
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {tx("Couldn't load the residency radar", 'تعذّر تحميل رادار الإقامات')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {tx('Check your connection and try again.', 'تحقّق من الاتصال وحاول مرة أخرى.')}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => load()}>
            <RefreshCw className="me-1.5 h-3.5 w-3.5" />
            {tx('Retry', 'إعادة المحاولة')}
          </Button>
        </div>
      ) : loading || !data ? (
        <div className="hr-stagger grid grid-cols-1 gap-5 lg:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : data.rows.length === 0 ? (
        <div className="hr-stagger grid grid-cols-1 gap-5 lg:grid-cols-2">
          <ForecastCard data={data} tx={tx} isRTL={isRTL} />
          <div className={`${CARD} flex flex-col items-center justify-center gap-3 py-10 text-center`}>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {tx('No residency events due soon 🎉', 'لا أحداث إقامة مستحقة قريبًا 🎉')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {tx('Nothing falls due in the next 90 days across ', 'لا شيء مستحق خلال 90 يومًا عبر ')}
                <span className="tabular-nums">{data.employee_count}</span>{' '}
                {tx('active employees.', 'موظف نشط.')}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="hr-stagger space-y-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <ForecastCard data={data} tx={tx} isRTL={isRTL} />
            <div className={`${CARD} flex flex-col justify-center gap-4`}>
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Radar className="h-4 w-4" />
                </span>
                <h3 className="truncate text-sm font-semibold text-foreground">
                  {tx('By urgency', 'حسب الأولوية')}
                </h3>
              </div>
              <SeverityStrip counts={counts} tx={tx} />
              <p className="text-[11px] text-muted-foreground">
                {tx('Grouped by days-to-due across ', 'مُجمّعة حسب الأيام المتبقية عبر ')}
                <span className="tabular-nums text-foreground/70">{data.count}</span>{' '}
                {tx('open events.', 'حدثًا مفتوحًا.')}
              </p>
            </div>
          </div>
          <EventsTable data={data} tx={tx} isRTL={isRTL} />
        </div>
      )}
    </div>
  )
}
