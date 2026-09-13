'use client'

/**
 * RetentionRadar — the "رادار الاستقالة / Retention Radar" section: a transparent,
 * rules-based attrition-risk score per employee. Not "AI" — every point is
 * traceable to a concrete signal (lateness, rising withdrawals, contract ending,
 * no raise, absence) and the reasons ship next to the score so a manager knows
 * exactly who to talk to and why.
 *
 * Mirrors the other HR dashboard sections (token-only, logical-RTL, .theme-hr,
 * skeleton + retry, Arabic-first).
 */

import * as React from 'react'
import { useEffect, useState } from 'react'
import {
  HeartPulse,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Clock,
  Wallet,
  CalendarClock,
  TrendingDown,
  UserMinus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import {
  fetchRetentionRadar,
  type RetentionRadar,
  type RetentionEmployee,
  type RetentionSignal,
  type RiskLevel,
} from '@/lib/hr-intelligence-api'

const CARD = 'hr-lift rounded-xl border border-border bg-card text-card-foreground shadow-card p-5'

function hhmm(t: string): string {
  const m = String(t || '').match(/(\d{1,2}):(\d{2})/)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '--:--'
}

type TX = (en: string, ar: string) => string

const LEVEL_META: Record<RiskLevel, { varName: string; en: string; ar: string }> = {
  high: { varName: '--destructive', en: 'High risk', ar: 'خطر مرتفع' },
  medium: { varName: '--warning', en: 'Watch', ar: 'راقب' },
  low: { varName: '--success', en: 'Stable', ar: 'مستقر' },
}

const SIGNAL_META: Record<RetentionSignal, { en: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }> = {
  tardiness: { en: 'Repeated lateness', icon: Clock },
  advances: { en: 'Rising withdrawals', icon: Wallet },
  contract: { en: 'Contract ending', icon: CalendarClock },
  stagnation: { en: 'No raise 2+ yrs', icon: TrendingDown },
  absence: { en: 'Frequent absence', icon: UserMinus },
}

/* ─────────────────────────── employee card ─────────────────────────── */

function RiskCard({ e, tx }: { e: RetentionEmployee; tx: TX }) {
  const meta = LEVEL_META[e.level] ?? LEVEL_META.medium
  const color = `hsl(var(${meta.varName}))`

  return (
    <section className={CARD}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-foreground">{e.employee_name}</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{e.branch}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ backgroundColor: `hsl(var(${meta.varName}) / 0.12)`, color }}
          >
            {tx(meta.en, meta.ar)}
          </span>
          <span className="text-lg font-bold leading-none tabular-nums" style={{ color }}>
            {e.score}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {e.reasons.map((r, i) => {
          const sm = SIGNAL_META[r.key]
          const Icon = sm?.icon ?? AlertTriangle
          return (
            <span
              key={`${r.key}-${i}`}
              className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-[11px] text-muted-foreground"
            >
              <Icon className="h-3 w-3" style={{ color }} />
              <span className="text-foreground/80">{tx(sm?.en ?? r.key, r.ar)}</span>
            </span>
          )
        })}
      </div>
    </section>
  )
}

/* ─────────────────────────── summary card ─────────────────────────── */

function SummaryCard({ data, tx }: { data: RetentionRadar; tx: TX }) {
  return (
    <section className={CARD}>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <HeartPulse className="h-4 w-4" />
        </span>
        <h3 className="truncate text-sm font-semibold text-foreground">{tx('Team stability', 'استقرار الفريق')}</h3>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(['high', 'medium', 'low'] as RiskLevel[]).map((lvl) => {
          const meta = LEVEL_META[lvl]
          const n = data.summary[lvl]
          return (
            <div
              key={lvl}
              className="flex flex-col items-center rounded-lg py-2.5"
              style={{ backgroundColor: `hsl(var(${meta.varName}) / ${n > 0 ? 0.12 : 0.06})`, color: `hsl(var(${meta.varName}))` }}
            >
              <span className="text-xl font-bold leading-none tabular-nums">{n}</span>
              <span className="mt-1 text-[10px] font-medium">{tx(meta.en, meta.ar)}</span>
            </div>
          )
        })}
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        {tx('Scored', 'تم تقييم')} <span className="tabular-nums text-foreground/70">{data.total_scored}</span>{' '}
        {tx('active employees on 5 transparent signals.', 'موظف نشط على ٥ إشارات شفّافة.')}
      </p>
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
      </div>
    </div>
  )
}

/* ─────────────────────────── main export ─────────────────────────── */

export default function RetentionRadarSection() {
  const { isRTL } = useI18n()
  const tx: TX = (en, ar) => (isRTL ? ar : en)

  const [data, setData] = useState<RetentionRadar | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = React.useCallback((signal?: AbortSignal) => {
    setLoading(true)
    setError(false)
    fetchRetentionRadar(signal)
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
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">
            {tx('Retention Radar', 'رادار الاستقالة')}
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
              {tx("Couldn't load the retention radar", 'تعذّر تحميل رادار الاستقالة')}
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
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : data.flagged.length === 0 ? (
        <div className="hr-stagger grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          <SummaryCard data={data} tx={tx} />
          <div className={`${CARD} flex flex-col items-center justify-center gap-3 py-10 text-center lg:col-span-1 xl:col-span-2`}>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">{tx('No one at elevated risk 🎉', 'لا أحد في خطر مرتفع 🎉')}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {tx('No employee crossed the risk threshold on the current signals.', 'لم يتجاوز أي موظف حدّ الخطر على الإشارات الحالية.')}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="hr-stagger grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          <SummaryCard data={data} tx={tx} />
          {data.flagged.map((e) => (
            <RiskCard key={e.employee} e={e} tx={tx} />
          ))}
        </div>
      )}
    </div>
  )
}
