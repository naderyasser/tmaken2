'use client'

/**
 * LeadershipMetrics — the "Leadership Metrics / مؤشرات القيادة" section of the HR
 * dashboard, an executive/governance sibling of DashboardIntelligence,
 * WorkforceAnalytics and ManagementMetrics. One backend call powers five cards,
 * ordered by the Saudi employer's real anxieties (compliance → cost → ops → people):
 *
 *   1. Nitaqat Simulator   — band + "Saudi hires to move up / buffer to drop"
 *   2. WPS Readiness        — IBAN coverage + last payroll vs payday
 *   3. Overtime Cost        — SAR + hours this month by branch, MoM trend
 *   4. Leave & Coverage     — who's out + per-branch coverage gaps
 *   5. Turnover & Retention — attrition %, leavers trend, tenure-at-exit
 *
 * Token-only, logical-RTL, motion via the .theme-hr layer. Self-contained: fetch
 * on mount, shimmer while loading, retry on error. Mirrors the sibling widgets.
 */

import * as React from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  Flag,
  Banknote,
  Clock,
  CalendarDays,
  UserMinus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  ArrowUpRight,
  ArrowDownRight,
  UserPlus,
  ShieldCheck,
  PartyPopper,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared'
import { useI18n } from '@/lib/i18n'
import { formatCurrency, type AppLocale } from '@/lib/format'
import { fetchHrLeadershipMetrics, type HrLeadershipMetrics } from '@/lib/hr-intelligence-api'

/* ─────────────────────────── helpers ─────────────────────────── */

const CARD = 'hr-lift rounded-xl border border-border bg-card text-card-foreground shadow-card p-5'

function pct(n: number, d: number): number {
  if (!d) return 0
  return Math.max(0, Math.min(100, Math.round((n / d) * 100)))
}

function hhmm(t: string): string {
  const m = String(t || '').match(/(\d{1,2}):(\d{2})/)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '--:--'
}

function sar(n: number, locale: AppLocale): string {
  return formatCurrency(Math.round(n || 0), { locale })
}

/** Nitaqat band key → design token. */
function bandVar(key?: string): string {
  if (key === 'red') return '--destructive'
  if (key === 'yellow') return '--warning'
  if (key === 'platinum') return '--primary'
  return '--success' // low/mid/high green
}

type CardProps = {
  data: HrLeadershipMetrics
  tx: (en: string, ar: string) => string
  locale: AppLocale
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

function monthAbbr(month: string): string {
  const m = String(month || '').match(/^(\d{4})-(\d{1,2})/)
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, 1) : new Date(month)
  if (Number.isNaN(d.getTime())) return String(month || '').slice(-3)
  return new Intl.DateTimeFormat('en', { month: 'short' }).format(d)
}

function dMon(dateStr: string): string {
  const m = String(dateStr || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!m) return String(dateStr || '')
  return `${m[3].padStart(2, '0')}/${m[2].padStart(2, '0')}`
}

/* ─────────────────────────── 1 · Nitaqat Simulator ─────────────────────────── */

function NitaqatCard({ data, tx }: CardProps) {
  const n = data.nitaqat
  const bandColor = `hsl(var(${bandVar(n.band?.key)}))`
  // ladder ascending (red → platinum) for a natural LTR climb
  const ladder = useMemo(() => [...n.ladder].sort((a, b) => a.min_pct - b.min_pct), [n.ladder])

  return (
    <section className={CARD}>
      <CardHeader
        icon={Flag}
        iconClass="bg-primary/10 text-primary"
        title={tx('Nitaqat (Simulator)', 'نطاقات (محاكاة)')}
        meta={n.is_estimate ? <EstimateBadge tx={tx} /> : undefined}
      />

      {/* Current band + pct */}
      <div className="flex items-end gap-2">
        <span className="text-3xl font-bold leading-none tabular-nums text-foreground">{n.pct}%</span>
        {n.band && (
          <span
            className="mb-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold"
            style={{ backgroundColor: `hsl(var(${bandVar(n.band.key)}) / 0.14)`, color: bandColor }}
          >
            {tx(n.band.label_en, n.band.label_ar)}
          </span>
        )}
        <span className="ms-auto pb-0.5 text-[11px] tabular-nums text-muted-foreground">
          {n.saudi}/{n.total} {tx('Saudi', 'سعودي')}
        </span>
      </div>

      {/* Band ladder */}
      <div dir="ltr" className="mt-4 flex gap-1">
        {ladder.map((b) => (
          <div
            key={b.key}
            className="h-6 flex-1 rounded-[5px] ring-1 ring-inset ring-border/40"
            style={{
              backgroundColor: b.current
                ? `hsl(var(${bandVar(b.key)}))`
                : `hsl(var(${bandVar(b.key)}) / 0.20)`,
            }}
            title={`${b.label_en} · ≥${b.min_pct}%`}
          />
        ))}
      </div>

      {/* Actionable insight */}
      <div className="mt-4 space-y-2">
        {n.next_band && n.hires_to_next != null ? (
          <div className="flex items-center gap-2.5 rounded-lg bg-accent px-3 py-2">
            <UserPlus className="h-4 w-4 shrink-0 text-primary" />
            <p className="text-[13px] text-foreground/90">
              {tx('To reach ', 'للوصول إلى ')}
              <span className="font-semibold" style={{ color: `hsl(var(${bandVar(n.next_band.key)}))` }}>
                {tx(n.next_band.label_en, n.next_band.label_ar)}
              </span>
              {tx(': hire ', ': وظّف ')}
              <span className="font-bold tabular-nums text-foreground">{n.hires_to_next}</span>
              {tx(' Saudi', ' سعودي')}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-lg bg-success/10 px-3 py-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
            <p className="text-[13px] text-foreground/90">{tx('Top band reached 🎉', 'أعلى نطاق 🎉')}</p>
          </div>
        )}
        {n.margin_down != null && (
          <p className="px-1 text-[11px] text-muted-foreground">
            {tx('Buffer: ', 'الهامش: ')}
            <span className="font-semibold tabular-nums text-foreground/80">{n.margin_down}</span>
            {tx(' Saudi departure(s) before dropping a band', ' مغادرة قبل الهبوط نطاقاً')}
          </p>
        )}
      </div>

      {(n.disclaimer_en || n.disclaimer_ar) && (
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          {tx(n.disclaimer_en || '', n.disclaimer_ar || '')}
        </p>
      )}
    </section>
  )
}

/* ─────────────────────────── 2 · WPS Readiness ─────────────────────────── */

function WpsCard({ data, tx }: CardProps) {
  const w = data.wps
  const maxMiss = Math.max(1, ...w.missing_by_branch.map((b) => b.count))

  return (
    <section className={CARD}>
      <CardHeader
        icon={Banknote}
        iconClass="bg-info/10 text-info"
        title={tx('WPS Readiness', 'جاهزية حماية الأجور')}
        meta={w.is_estimate ? <EstimateBadge tx={tx} /> : undefined}
      />

      {/* Ready % hero */}
      <div className="flex items-end gap-2">
        <span className="text-4xl font-bold leading-none tabular-nums text-foreground">{w.ready_pct}</span>
        <span className="pb-1 text-lg font-medium text-muted-foreground">%</span>
        <span className="ms-auto pb-1 text-[11px] tabular-nums text-muted-foreground">
          {w.wps_ready}/{w.headcount} {tx('with IBAN', 'لديه آيبان')}
        </span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${w.ready_pct >= 80 ? 'bg-success' : w.ready_pct >= 40 ? 'bg-warning' : 'bg-destructive'}`}
          style={{ width: `${w.ready_pct}%` }}
        />
      </div>

      {/* Missing IBAN by branch */}
      {w.wps_missing > 0 ? (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <CircleAlert className="h-3.5 w-3.5 text-destructive" />
            {tx('Missing IBAN', 'ينقصه آيبان')} · <span className="tabular-nums text-foreground/70">{w.wps_missing}</span>
          </p>
          <div className="space-y-2">
            {w.missing_by_branch.slice(0, 4).map((b, i) => (
              <div key={`${b.branch}-${i}`} className="flex items-center gap-3">
                <span className="w-24 shrink-0 truncate text-xs text-muted-foreground" title={b.branch}>
                  {b.branch}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-destructive/60" style={{ width: `${pct(b.count, maxMiss)}%` }} />
                </div>
                <span className="w-6 shrink-0 text-end text-[11px] font-medium tabular-nums text-foreground">{b.count}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-4 flex items-center gap-1.5 text-[12px] text-success">
          <CheckCircle2 className="h-4 w-4" />
          {tx('All employees WPS-ready', 'كل الموظفين جاهزون لحماية الأجور')}
        </p>
      )}

      {/* Last payroll vs payday */}
      <div className="mt-4 border-t border-border pt-3 text-[11px] text-muted-foreground">
        {w.last_payroll?.date ? (
          <p className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            {tx('Last payroll ', 'آخر رواتب ')}
            <span className="tabular-nums text-foreground/80">{w.last_payroll.date}</span>
            {w.on_time != null && (
              <span
                className={`ms-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${w.on_time ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}
              >
                {w.on_time ? tx('on time', 'في موعده') : tx('late', 'متأخر')}
              </span>
            )}
          </p>
        ) : (
          <p className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            {tx('No payroll run recorded yet', 'لا يوجد تشغيل رواتب مسجّل')}
          </p>
        )}
        {w.payday != null && (
          <p className="mt-0.5">{tx('Payday: day ', 'يوم الراتب: ')}<span className="tabular-nums text-foreground/70">{w.payday}</span></p>
        )}
      </div>
    </section>
  )
}

/* ─────────────────────────── 3 · Overtime Cost ─────────────────────────── */

function OvertimeCard({ data, tx, locale }: CardProps) {
  const o = data.overtime
  const up = (o.delta_pct ?? 0) >= 0
  const maxBranch = Math.max(1, ...o.by_branch.map((b) => b.cost))

  return (
    <section className={CARD}>
      <CardHeader
        icon={Clock}
        iconClass="bg-warning/10 text-warning"
        title={tx('Overtime Cost', 'تكلفة العمل الإضافي')}
        meta={o.is_estimate ? <EstimateBadge tx={tx} /> : undefined}
      />

      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold leading-none tabular-nums text-foreground">{sar(o.cost, locale)}</span>
        {o.delta_pct !== null && (
          <span
            className={`mb-0.5 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${up ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}
          >
            {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {up ? '+' : ''}
            {o.delta_pct}%
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {tx('this month', 'هذا الشهر')} · <span className="tabular-nums text-foreground/80">{o.hours}</span>{' '}
        {tx('hours', 'ساعة')} · <span className="tabular-nums text-foreground/80">{o.employees}</span>{' '}
        {tx('employees', 'موظف')}
      </p>

      {o.by_branch.length === 0 ? (
        <EmptyState
          icon={PartyPopper}
          title={tx('No overtime this month 🎉', 'لا عمل إضافي هذا الشهر 🎉')}
          description={tx('No overtime cost recorded.', 'لا تكلفة عمل إضافي مسجّلة.')}
          className="py-8 sm:py-10"
        />
      ) : (
        <div className="mt-4 space-y-2.5">
          {o.by_branch.slice(0, 5).map((b, i) => (
            <div key={`${b.branch}-${i}`} className="hr-fade-up">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate text-muted-foreground" title={b.branch}>
                  {b.branch}
                </span>
                <span className="shrink-0 tabular-nums text-foreground/90">
                  {sar(b.cost, locale)} · {b.hours}
                  {tx('h', 'س')}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-warning/70" style={{ width: `${pct(b.cost, maxBranch)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/* ─────────────────────────── 4 · Leave & Coverage ─────────────────────────── */

function LeaveCard({ data, tx }: CardProps) {
  const l = data.leave

  return (
    <section className={CARD}>
      <CardHeader
        icon={CalendarDays}
        iconClass="bg-info/10 text-info"
        title={tx('Leave & Coverage', 'رادار الإجازات والتغطية')}
        meta={
          l.upcoming_14d > 0 ? (
            <span className="rounded-full bg-info/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-info">
              {l.upcoming_14d}
            </span>
          ) : undefined
        }
      />

      {/* Today / upcoming */}
      <div className="flex items-end gap-3">
        <div>
          <span className="text-4xl font-bold leading-none tabular-nums text-foreground">{l.on_leave_today}</span>
          <p className="mt-1 text-xs text-muted-foreground">{tx('on leave today', 'في إجازة اليوم')}</p>
        </div>
        <div className="ms-auto text-end">
          <span className="text-lg font-semibold tabular-nums text-foreground/80">{l.upcoming_14d}</span>
          <p className="text-[11px] text-muted-foreground">{tx('next 14 days', 'خلال 14 يوماً')}</p>
        </div>
      </div>

      {l.upcoming.length === 0 ? (
        <EmptyState
          icon={PartyPopper}
          title={tx('Full coverage 🎉', 'تغطية كاملة 🎉')}
          description={tx('No upcoming leave in the next two weeks.', 'لا إجازات قادمة خلال أسبوعين.')}
          className="py-8 sm:py-10"
        />
      ) : (
        <>
          {/* Per-branch coverage gaps */}
          {l.by_branch.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {tx('Coverage gaps', 'فجوات التغطية')}
              </p>
              <div className="space-y-2">
                {l.by_branch.slice(0, 3).map((b, i) => (
                  <div key={`${b.branch}-${i}`} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 truncate text-xs text-muted-foreground" title={b.branch}>
                      {b.branch}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${b.pct >= 30 ? 'bg-destructive/70' : 'bg-warning/60'}`}
                        style={{ width: `${Math.max(6, b.pct)}%` }}
                      />
                    </div>
                    <span className="w-12 shrink-0 text-end text-[11px] font-medium tabular-nums text-foreground">
                      {b.on_leave}/{b.total}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming list */}
          <div className="mt-4 space-y-1">
            {l.upcoming.slice(0, 4).map((u, i) => (
              <div key={`${u.employee_name}-${i}`} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">{u.employee_name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{u.leave_type}</p>
                </div>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground" dir="ltr">
                  {dMon(u.from_date)}–{dMon(u.to_date)}
                </span>
                {u.active && (
                  <span className="shrink-0 rounded-full bg-info/10 px-1.5 py-0.5 text-[10px] font-semibold text-info">
                    {tx('now', 'الآن')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

/* ─────────────────────────── 5 · Turnover & Retention ─────────────────────────── */

function TurnoverSparkline({ values }: { values: number[] }) {
  const W = 100
  const H = 30
  const pad = 3
  const pts = useMemo(() => {
    if (values.length < 2) return { line: '', area: '' }
    const max = Math.max(1, ...values)
    const step = W / (values.length - 1)
    const coords = values.map((v, i) => {
      const x = i * step
      const y = pad + (1 - v / max) * (H - pad * 2)
      return [x, y] as const
    })
    const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
    const area = `${line} L${W},${H} L0,${H} Z`
    return { line, area }
  }, [values])

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-8 w-full" aria-hidden>
      <defs>
        <linearGradient id="turnoverFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity="0.20" />
          <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={pts.area} fill="url(#turnoverFill)" />
      <path
        d={pts.line}
        fill="none"
        stroke="hsl(var(--destructive))"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function TurnoverCard({ data, tx }: CardProps) {
  const t = data.turnover
  const values = t.trend.map((p) => p.count)
  const maxBranch = Math.max(1, ...t.by_branch.map((b) => b.count))

  return (
    <section className={CARD}>
      <CardHeader
        icon={UserMinus}
        iconClass="bg-destructive/10 text-destructive"
        title={tx('Turnover & Retention', 'الدوران والاستبقاء')}
        meta={t.is_estimate ? <EstimateBadge tx={tx} /> : undefined}
      />

      {/* Rate hero */}
      <div className="flex items-end gap-2">
        <span className="text-4xl font-bold leading-none tabular-nums text-foreground">{t.turnover_pct}</span>
        <span className="pb-1 text-lg font-medium text-muted-foreground">%</span>
        <span className="ms-auto pb-1 text-[11px] text-muted-foreground">{tx('12-month rate', 'معدّل 12 شهراً')}</span>
      </div>
      <div className="mt-1 flex items-center gap-3 text-[11px]">
        <span className="inline-flex items-center gap-1 text-destructive">
          <UserMinus className="h-3 w-3" />
          <span className="tabular-nums">{t.leavers_this_month}</span> {tx('this month', 'هذا الشهر')}
        </span>
        <span className="text-muted-foreground">
          <span className="tabular-nums text-foreground/70">{t.leavers_ytd}</span> {tx('YTD', 'منذ بداية العام')}
        </span>
      </div>

      {/* 6-month leavers trend */}
      <div dir="ltr" className="mt-4">
        <TurnoverSparkline values={values} />
        <div className="mt-1.5 flex justify-between">
          {t.trend.map((p, i) => (
            <span key={`${p.month}-${i}`} className="text-[9px] tabular-nums text-muted-foreground">
              {monthAbbr(p.month)}
            </span>
          ))}
        </div>
      </div>

      {/* Avg tenure at exit + by branch */}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[11px]">
        <span className="text-muted-foreground">{tx('Avg tenure at exit', 'متوسط الخدمة عند المغادرة')}</span>
        <span className="font-semibold tabular-nums text-foreground">
          {t.avg_tenure_years_at_exit} {tx('yrs', 'سنة')}
        </span>
      </div>

      {t.by_branch.length > 0 && (
        <div className="mt-3 space-y-2">
          {t.by_branch.slice(0, 3).map((b, i) => (
            <div key={`${b.branch}-${i}`} className="flex items-center gap-3">
              <span className="w-24 shrink-0 truncate text-xs text-muted-foreground" title={b.branch}>
                {b.branch}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-destructive/60" style={{ width: `${pct(b.count, maxBranch)}%` }} />
              </div>
              <span className="w-6 shrink-0 text-end text-[11px] font-medium tabular-nums text-foreground">{b.count}</span>
            </div>
          ))}
        </div>
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

export default function LeadershipMetrics() {
  const { isRTL } = useI18n()
  const tx = (en: string, ar: string) => (isRTL ? ar : en)
  const locale: AppLocale = isRTL ? 'ar' : 'en'

  const [data, setData] = useState<HrLeadershipMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = React.useCallback((signal?: AbortSignal) => {
    setLoading(true)
    setError(false)
    fetchHrLeadershipMetrics(signal)
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
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">
            {tx('Leadership Metrics', 'مؤشرات القيادة')}
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
              {tx("Couldn't load leadership metrics", 'تعذّر تحميل مؤشرات القيادة')}
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
        <div className="hr-stagger grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="hr-stagger grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          <NitaqatCard data={data} tx={tx} locale={locale} />
          <WpsCard data={data} tx={tx} locale={locale} />
          <OvertimeCard data={data} tx={tx} locale={locale} />
          <LeaveCard data={data} tx={tx} locale={locale} />
          <TurnoverCard data={data} tx={tx} locale={locale} />
        </div>
      )}
    </div>
  )
}
