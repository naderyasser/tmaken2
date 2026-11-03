'use client'

/**
 * WorkforceAnalytics — the "Workforce Analytics / تحليلات القوى العاملة"
 * section of the HR dashboard, a visual sibling of DashboardIntelligence.
 * One backend call powers four polished cards:
 *
 *   1. Headcount trend   — big total, net delta chip, 6-month SVG area sparkline
 *   2. Diversity          — Saudization donut + gender split + top departments
 *   3. Labor cost         — monthly payroll hero, avg, coverage, per-branch bars
 *   4. Tenure             — segmented retention bar with a "loyal core" framing
 *
 * Token-only, logical-RTL, motion via the .theme-hr layer (hr-lift / hr-stagger
 * / hr-fade-up). Self-contained: fetch on mount, shimmer while loading, retry
 * on error. Mirrors dashboard-intelligence.tsx conventions exactly.
 */

import * as React from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  UserPlus,
  UserMinus,
  Users,
  Wallet,
  Award,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { formatCurrency, type AppLocale } from '@/lib/format'
import {
  fetchWorkforceAnalytics,
  type WorkforceAnalyticsData,
} from '@/lib/hr-intelligence-api'

/* ─────────────────────────── helpers ─────────────────────────── */

const CARD = 'hr-lift rounded-xl border border-border bg-card text-card-foreground shadow-card p-5'

function pct(n: number, d: number): number {
  if (!d) return 0
  return Math.max(0, Math.min(100, Math.round((n / d) * 100)))
}

/** Pull HH:MM out of a time or datetime string, defensively. */
function hhmm(t: string): string {
  const m = String(t || '').match(/(\d{1,2}):(\d{2})/)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '--:--'
}

/** "2026-02" | ISO → 3-letter English month for the LTR-pinned axis. */
function monthAbbr(month: string): string {
  const m = String(month || '').match(/^(\d{4})-(\d{1,2})/)
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, 1) : new Date(month)
  if (Number.isNaN(d.getTime())) return String(month || '').slice(-3)
  return new Intl.DateTimeFormat('en', { month: 'short' }).format(d)
}

type CardProps = {
  data: WorkforceAnalyticsData
  tx: (en: string, ar: string) => string
  locale: AppLocale
}

/* Common gender labels → bilingual; unknown names pass through. */
const GENDER_LABEL: Record<string, { en: string; ar: string }> = {
  Male: { en: 'Male', ar: 'ذكور' },
  Female: { en: 'Female', ar: 'إناث' },
  Other: { en: 'Other', ar: 'أخرى' },
}

/* ─────────────────────────── shared bits ─────────────────────────── */

function CardHeader({
  icon: Icon,
  iconClass,
  title,
  meta,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconClass: string
  title: string
  meta?: React.ReactNode
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="truncate text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {meta && <div className="shrink-0">{meta}</div>}
    </div>
  )
}

function EstimateBadge({ tx }: { tx: (en: string, ar: string) => string }) {
  return (
    <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
      {tx('Estimate', 'تقديري')}
    </span>
  )
}

/* ─────────────────────────── 1 · Headcount trend ─────────────────────────── */

function CountSparkline({ values }: { values: number[] }) {
  const W = 100
  const H = 34
  const pad = 4
  const pts = useMemo(() => {
    if (values.length < 2) return { line: '', area: '' }
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = max - min || 1
    const step = W / (values.length - 1)
    const coords = values.map((v, i) => {
      const x = i * step
      const y = pad + (1 - (v - min) / span) * (H - pad * 2)
      return [x, y] as const
    })
    const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
    const area = `${line} L${W},${H} L0,${H} Z`
    return { line, area }
  }, [values])

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-9 w-full" aria-hidden>
      <defs>
        <linearGradient id="headcountFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.24" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={pts.area} fill="url(#headcountFill)" />
      <path
        d={pts.line}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function HeadcountTrendCard({ data, tx }: CardProps) {
  const h = data.headcount
  const values = h.trend.map((p) => p.count)
  const net = h.net_this_month
  const up = net >= 0

  return (
    <section className={CARD}>
      <CardHeader
        icon={TrendingUp}
        iconClass="bg-primary/10 text-primary"
        title={tx('Headcount Trend', 'نمو القوى العاملة')}
        meta={<span className="text-[11px] font-medium text-muted-foreground">{tx('6 months', '6 أشهر')}</span>}
      />

      {/* Big total + net delta chip */}
      <div className="flex items-end gap-2">
        <span className="text-4xl font-bold leading-none tabular-nums text-foreground">{h.total}</span>
        <span className="pb-1 text-xs text-muted-foreground">{tx('employees', 'موظف')}</span>
        <span
          className={`ms-auto inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
            up ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
          }`}
        >
          {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {up ? '+' : ''}
          {net}
        </span>
      </div>

      {/* Joiners / leavers detail */}
      <div className="mt-2 flex items-center gap-3 text-[11px]">
        <span className="inline-flex items-center gap-1 text-success">
          <UserPlus className="h-3 w-3" />
          <span className="tabular-nums">{h.joiners_this_month}</span> {tx('joined', 'التحق')}
        </span>
        <span className="inline-flex items-center gap-1 text-destructive">
          <UserMinus className="h-3 w-3" />
          <span className="tabular-nums">{h.leavers_this_month}</span> {tx('left', 'غادر')}
        </span>
        <span className="ms-auto text-muted-foreground">{tx('this month', 'هذا الشهر')}</span>
      </div>

      {/* Sparkline + month axis (chronological → pinned LTR) */}
      <div dir="ltr" className="mt-4">
        <CountSparkline values={values} />
        <div className="mt-1.5 flex justify-between">
          {h.trend.map((p, i) => (
            <span key={`${p.month}-${i}`} className="text-[9px] tabular-nums text-muted-foreground">
              {monthAbbr(p.month)}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────── 2 · Diversity ─────────────────────────── */

function SaudizationDonut({
  saudi,
  total,
  label,
  caption,
}: {
  saudi: number
  total: number
  label: string
  caption: string
}) {
  const size = 128
  const cx = size / 2
  const r = 50
  const sw = 13
  const circ = 2 * Math.PI * r
  const frac = total ? Math.max(0, Math.min(1, saudi / total)) : 0
  const dash = circ * frac

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {/* Non-Saudi track */}
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={sw} />
        {/* Saudi arc */}
        {total > 0 && (
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            style={{ transition: 'stroke-dasharray 900ms cubic-bezier(0.16,1,0.3,1)' }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {total > 0 ? (
          <>
            <span className="text-3xl font-bold leading-none tabular-nums text-foreground">{label}</span>
            <span className="mt-1 text-[10px] font-medium uppercase tracking-wide text-primary">{caption}</span>
          </>
        ) : (
          <span className="text-2xl font-bold text-muted-foreground">—</span>
        )}
      </div>
    </div>
  )
}

function DiversityCard({ data, tx }: CardProps) {
  const d = data.diversity
  const maxDept = Math.max(1, ...d.top_departments.map((x) => x.count))

  return (
    <section className={CARD}>
      <CardHeader
        icon={Users}
        iconClass="bg-info/10 text-info"
        title={tx('Diversity', 'تنوّع القوى العاملة')}
        meta={<span className="text-[11px] font-medium tabular-nums text-muted-foreground">{d.total}</span>}
      />

      {/* Saudization donut */}
      <SaudizationDonut
        saudi={d.saudi}
        total={d.total}
        label={`${d.saudization_pct}%`}
        caption={tx('Saudization', 'سعودة')}
      />

      {/* Saudi / Non-Saudi legend */}
      <div className="mt-3 flex items-center justify-center gap-4 text-[11px]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          <span className="text-muted-foreground">{tx('Saudi', 'سعودي')}</span>
          <span className="font-semibold tabular-nums text-foreground">{d.saudi}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-muted" />
          <span className="text-muted-foreground">{tx('Non-Saudi', 'غير سعودي')}</span>
          <span className="font-semibold tabular-nums text-foreground">{d.non_saudi}</span>
        </span>
      </div>

      {/* Gender split chips */}
      {d.genders.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          {d.genders.map((g, i) => {
            const lbl = GENDER_LABEL[g.name]
            return (
              <span
                key={`${g.name}-${i}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[11px]"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: `hsl(var(--chart-${(i % 5) + 1}))` }}
                />
                <span className="text-muted-foreground">{lbl ? tx(lbl.en, lbl.ar) : g.name}</span>
                <span className="font-semibold tabular-nums text-foreground">{g.count}</span>
              </span>
            )
          })}
        </div>
      )}

      {/* Top departments mini bars */}
      {d.top_departments.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {tx('Top departments', 'أكبر الأقسام')}
          </p>
          <div className="space-y-2.5">
            {d.top_departments.slice(0, 3).map((dep, i) => (
              <div key={`${dep.name}-${i}`} className="hr-fade-up flex items-center gap-3">
                <span className="w-24 shrink-0 truncate text-xs text-muted-foreground" title={dep.name}>
                  {dep.name}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-info/70" style={{ width: `${pct(dep.count, maxDept)}%` }} />
                </div>
                <span className="w-7 shrink-0 text-end text-[11px] font-medium tabular-nums text-foreground">
                  {dep.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

/* ─────────────────────────── 3 · Labor cost ─────────────────────────── */

function LaborCostCard({ data, tx, locale }: CardProps) {
  const c = data.labor_cost
  const maxBranch = Math.max(1, ...c.by_branch.map((b) => b.cost))

  return (
    <section className={CARD}>
      <CardHeader
        icon={Wallet}
        iconClass="bg-success/10 text-success"
        title={tx('Monthly Payroll', 'نظرة الأجور الشهرية')}
        meta={c.is_estimate ? <EstimateBadge tx={tx} /> : undefined}
      />

      {/* Hero total */}
      <div className="flex items-end gap-1.5">
        <span className="text-2xl font-bold leading-none tabular-nums text-foreground">
          {formatCurrency(c.total_monthly, { locale })}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {tx('avg', 'المتوسط')}{' '}
        <span className="font-medium tabular-nums text-foreground/80">{formatCurrency(c.avg, { locale })}</span>{' '}
        / {tx('employee', 'موظف')}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {tx('covers', 'يغطّي')}{' '}
        <span className="tabular-nums text-foreground/80">
          {c.covered}/{c.headcount}
        </span>{' '}
        {tx('employees', 'موظف')}
      </p>

      {/* Top branches by cost */}
      {c.by_branch.length > 0 && (
        <div className="mt-4 space-y-2.5">
          {c.by_branch.slice(0, 5).map((b, i) => (
            <div key={`${b.branch}-${i}`} className="hr-fade-up">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate text-muted-foreground" title={b.branch}>
                  {b.branch}
                </span>
                <span className="shrink-0 tabular-nums text-foreground/90">{formatCurrency(b.cost, { locale })}</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-success/70" style={{ width: `${pct(b.cost, maxBranch)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {c.is_estimate && (
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          {tx('estimate — from assigned salary structures', 'تقديري — من هياكل الرواتب المعتمدة')}
        </p>
      )}
    </section>
  )
}

/* ─────────────────────────── 4 · Tenure ─────────────────────────── */

function TenureCard({ data, tx }: CardProps) {
  const t = data.tenure
  const buckets = t.buckets
  const known = buckets.reduce((s, b) => s + (b.count || 0), 0)
  const loyal = buckets.length ? buckets[buckets.length - 1] : null
  const loyalPct = pct(loyal?.count ?? 0, known)

  /** Sequential teal ramp — longer tenure reads stronger (retention). */
  const tenureColor = (i: number, n: number) => {
    const op = n <= 1 ? 1 : 0.32 + (i / (n - 1)) * 0.68
    return `hsl(var(--primary) / ${op.toFixed(2)})`
  }

  return (
    <section className={CARD}>
      <CardHeader
        icon={Award}
        iconClass="bg-primary/10 text-primary"
        title={tx('Tenure', 'توزيع مدة الخدمة')}
        meta={<span className="text-[11px] font-medium tabular-nums text-muted-foreground">{t.total}</span>}
      />

      {/* Loyal-core hero */}
      <div className="flex items-end gap-2">
        <span className="text-4xl font-bold leading-none tabular-nums text-foreground">{loyal?.count ?? 0}</span>
        <span className="inline-flex items-center gap-1 pb-1 text-xs font-medium text-primary">
          <ShieldCheck className="h-3.5 w-3.5" />
          {tx('loyal core', 'الركيزة الوفية')}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        <span className="font-semibold tabular-nums text-foreground/80">{loyalPct}%</span>{' '}
        {tx('with 5+ years of service', 'أمضوا 5 سنوات فأكثر')}
      </p>

      {/* Segmented retention bar (ordered short → long, pinned LTR) */}
      {known > 0 && (
        <div dir="ltr" className="mt-4">
          <div className="flex h-4 w-full gap-0.5 overflow-hidden rounded-full">
            {buckets.map((b, i) => {
              const w = (b.count / known) * 100
              if (w <= 0) return null
              return (
                <div
                  key={b.key}
                  className="h-full first:rounded-s-full last:rounded-e-full"
                  style={{ width: `${w}%`, backgroundColor: tenureColor(i, buckets.length) }}
                  title={`${b.label_en} · ${b.count}`}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
        {buckets.map((b, i) => {
          const isLoyal = i === buckets.length - 1
          return (
            <div key={b.key} className="hr-fade-up flex items-center gap-2 text-[11px]">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: tenureColor(i, buckets.length) }}
              />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{tx(b.label_en, b.label_ar)}</span>
              <span className="font-semibold tabular-nums text-foreground">{b.count}</span>
              {isLoyal && (
                <ShieldCheck className="h-3 w-3 shrink-0 text-primary" aria-label={tx('loyal core', 'الركيزة الوفية')} />
              )}
            </div>
          )
        })}
      </div>

      {t.unknown > 0 && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          <span className="tabular-nums">{t.unknown}</span> {tx('without a join date', 'دون تاريخ التحاق')}
        </p>
      )}
    </section>
  )
}

/* ─────────────────────────── skeleton ─────────────────────────── */

function SkeletonCard() {
  return (
    <div className={CARD}>
      <div className="mb-4 flex items-center gap-2.5">
        <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-28 animate-pulse rounded bg-muted" />
      </div>
      <div className="mb-4 h-10 w-24 animate-pulse rounded bg-muted" />
      <div className="space-y-2.5">
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
        <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
      </div>
    </div>
  )
}

/* ─────────────────────────── main export ─────────────────────────── */

export default function WorkforceAnalytics() {
  const { isRTL } = useI18n()
  const tx = (en: string, ar: string) => (isRTL ? ar : en)
  const locale: AppLocale = isRTL ? 'ar' : 'en'

  const [data, setData] = useState<WorkforceAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = React.useCallback((signal?: AbortSignal) => {
    setLoading(true)
    setError(false)
    fetchWorkforceAnalytics(signal)
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

  const updatedAt = data?.generated_at ? hhmm(data.generated_at) : null

  return (
    <div className="mb-8">
      {/* Section header */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">
            {tx('Workforce Analytics', 'تحليلات القوى العاملة')}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {updatedAt && !loading && !error && (
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {tx('Updated', 'آخر تحديث')} {updatedAt}
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
              {tx("Couldn't load workforce analytics", 'تعذّر تحميل تحليلات القوى العاملة')}
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
        <div className="hr-stagger grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="hr-stagger grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-4">
          <HeadcountTrendCard data={data} tx={tx} locale={locale} />
          <DiversityCard data={data} tx={tx} locale={locale} />
          <LaborCostCard data={data} tx={tx} locale={locale} />
          <TenureCard data={data} tx={tx} locale={locale} />
        </div>
      )}
    </div>
  )
}
