'use client'

/**
 * HiringPlanner — the "مخطّط التوظيف والميزانية / Hiring & Budget Planner" section:
 * an interactive what-if. Enter a hiring plan (headcount, average wage, how many
 * Saudi) and see the fully-loaded annual cost (wages + employer GOSI + EOSB
 * accrual) AND the Nitaqat band before → after, live. Math mirrors the backend
 * (base_meena.api.hiring_planner) exactly; the baseline (current Saudization,
 * average wage, GOSI rates) comes from one server call.
 *
 * Mirrors the other HR dashboard sections (token-only, logical-RTL, .theme-hr,
 * skeleton + retry, Arabic-first).
 */

import * as React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { UserPlus, RefreshCw, AlertTriangle, ArrowRight, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { fetchHiringBaseline, type HiringBaseline } from '@/lib/hr-intelligence-api'

const CARD = 'hr-lift rounded-xl border border-border bg-card text-card-foreground shadow-card p-5'
const EOSB_MONTHS_PER_YEAR = 0.5

type TX = (en: string, ar: string) => string

// Nitaqat ladder (min_pct desc) — mirrors the backend.
const BANDS = [
  { min: 60, key: 'platinum', ar: 'بلاتيني', varName: '--info' },
  { min: 40, key: 'high_green', ar: 'أخضر مرتفع', varName: '--success' },
  { min: 30, key: 'mid_green', ar: 'أخضر متوسط', varName: '--success' },
  { min: 20, key: 'low_green', ar: 'أخضر منخفض', varName: '--success' },
  { min: 10, key: 'yellow', ar: 'أصفر', varName: '--warning' },
  { min: 0, key: 'red', ar: 'أحمر', varName: '--destructive' },
]
function bandFor(pct: number) {
  return BANDS.find((b) => pct >= b.min) ?? BANDS[BANDS.length - 1]
}

function money(v: number, ccy: string): string {
  return `${Math.round(v || 0).toLocaleString('en-US')} ${ccy}`
}

/* ─────────────────────────── number stepper ─────────────────────────── */

function Stepper({ label, value, setValue, min, max }: { label: string; value: number; setValue: (n: number) => void; min: number; max: number }) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n))
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setValue(clamp(value - 1))}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground hover:bg-accent"
        >
          −
        </button>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(e) => setValue(clamp(Number(e.target.value) || 0))}
          className="h-8 w-full rounded-lg border border-border bg-background px-2 text-center text-sm tabular-nums text-foreground focus:border-primary focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setValue(clamp(value + 1))}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground hover:bg-accent"
        >
          +
        </button>
      </div>
    </div>
  )
}

/* ─────────────────────────── skeleton ─────────────────────────── */

function Skeleton() {
  return (
    <div className={CARD}>
      <div className="mb-4 flex items-center gap-2.5">
        <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-40 w-full animate-pulse rounded bg-muted" />
        <div className="h-40 w-full animate-pulse rounded bg-muted" />
      </div>
    </div>
  )
}

/* ─────────────────────────── main export ─────────────────────────── */

export default function HiringPlannerSection() {
  const { isRTL } = useI18n()
  const tx: TX = (en, ar) => (isRTL ? ar : en)

  const [base, setBase] = useState<HiringBaseline | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [count, setCount] = useState(5)
  const [avgSalary, setAvgSalary] = useState(6000)
  const [saudiCount, setSaudiCount] = useState(3)

  const load = React.useCallback((signal?: AbortSignal) => {
    setLoading(true)
    setError(false)
    fetchHiringBaseline(signal)
      .then((d) => {
        if (signal?.aborted) return
        setBase(d)
        if (d.avg_base > 0) setAvgSalary(Math.round(d.avg_base))
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

  const ccy = base?.currency ?? 'SAR'
  const saudiN = Math.min(count, saudiCount)

  const result = useMemo(() => {
    if (!base) return null
    const gs = (base.gosi_saudi_pct ?? 11.75) / 100
    const gn = (base.gosi_nonsaudi_pct ?? 2) / 100
    const nonSaudi = count - saudiN
    const wages = count * avgSalary * 12
    const gosi = saudiN * avgSalary * 12 * gs + nonSaudi * avgSalary * 12 * gn
    const eosb = count * avgSalary * EOSB_MONTHS_PER_YEAR
    const total = wages + gosi + eosb

    const beforePct = base.saudization_pct
    const beforeBand = bandFor(beforePct)
    const newSaudi = base.saudi + saudiN
    const newTotal = base.total + count
    const afterPct = newTotal ? (100 * newSaudi) / newTotal : 0
    const afterBand = bandFor(afterPct)

    return {
      wages, gosi, eosb, total, monthly: total / 12, perHire: count ? total / count : 0,
      beforePct, beforeBand, afterPct: Math.round(afterPct * 100) / 100, afterBand,
      moved: beforeBand.key !== afterBand.key,
    }
  }, [base, count, avgSalary, saudiN])

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">
            {tx('Hiring & Budget Planner', 'مخطّط التوظيف والميزانية')}
          </h2>
        </div>
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

      {error ? (
        <div className={`${CARD} flex flex-col items-center gap-3 py-10 text-center`}>
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <p className="text-sm font-semibold text-foreground">{tx("Couldn't load the planner", 'تعذّر تحميل المخطّط')}</p>
          <Button variant="outline" size="sm" onClick={() => load()}>
            <RefreshCw className="me-1.5 h-3.5 w-3.5" />
            {tx('Retry', 'إعادة المحاولة')}
          </Button>
        </div>
      ) : loading || !base || !result ? (
        <Skeleton />
      ) : (
        <section className={CARD}>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* inputs */}
            <div className="flex flex-col gap-4">
              <Stepper label={tx('New hires', 'عدد التعيينات')} value={count} setValue={setCount} min={0} max={500} />
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{tx('Avg monthly wage', 'متوسط الأجر الشهري')}</label>
                <input
                  type="number"
                  value={avgSalary}
                  min={0}
                  onChange={(e) => setAvgSalary(Math.max(0, Number(e.target.value) || 0))}
                  className="h-8 w-full rounded-lg border border-border bg-background px-2 text-sm tabular-nums text-foreground focus:border-primary focus:outline-none"
                />
              </div>
              <Stepper label={tx('Saudi hires', 'منهم سعوديون')} value={saudiN} setValue={setSaudiCount} min={0} max={count} />
              <p className="text-[11px] text-muted-foreground">
                {tx('GOSI', 'التأمينات')}: {base.gosi_saudi_pct}% {tx('Saudi', 'سعودي')} · {base.gosi_nonsaudi_pct}% {tx('non-Saudi', 'غير سعودي')} ·
                {' '}{tx('EOSB accrual ½ month/yr', 'مخصص نهاية خدمة نصف شهر/سنة')}
              </p>
            </div>

            {/* results */}
            <div className="flex flex-col gap-4">
              {/* cost */}
              <div className="rounded-xl bg-accent p-4">
                <p className="text-xs text-muted-foreground">{tx('Fully-loaded annual cost', 'التكلفة السنوية الكاملة')}</p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums text-foreground">{money(result.total, ccy)}</p>
                <div className="mt-3 space-y-1 text-xs">
                  <Row label={tx('Wages', 'الأجور')} value={money(result.wages, ccy)} />
                  <Row label={tx('Employer GOSI', 'التأمينات (رب العمل)')} value={money(result.gosi, ccy)} />
                  <Row label={tx('EOSB accrual', 'مخصص نهاية الخدمة')} value={money(result.eosb, ccy)} />
                  <div className="mt-1 border-t border-border/60 pt-1" />
                  <Row label={tx('Monthly', 'شهرياً')} value={money(result.monthly, ccy)} />
                  <Row label={tx('Per hire / yr', 'للموظف/سنة')} value={money(result.perHire, ccy)} />
                </div>
              </div>

              {/* nitaqat before -> after */}
              <div className="rounded-xl border border-border p-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {tx('Nitaqat impact', 'أثر النطاقات')}
                </p>
                <div className="flex items-center justify-center gap-3">
                  <BandChip pct={result.beforePct} band={result.beforeBand} />
                  <ArrowRight className={`h-4 w-4 text-muted-foreground ${isRTL ? 'rotate-180' : ''}`} />
                  <BandChip pct={result.afterPct} band={result.afterBand} highlight />
                </div>
                {result.moved && (
                  <p className="mt-2 text-center text-[11px] font-semibold text-success">
                    {tx('Band changes with this plan', 'النطاق يتغيّر بهذه الخطة')}
                  </p>
                )}
              </div>
            </div>
          </div>
          <p className="mt-4 text-[11px] text-muted-foreground">
            {tx('Estimate from your own data. Confirm GOSI/EOSB with your official schedules.', 'تقدير من بياناتك. تأكّد من نسب التأمينات ومخصص نهاية الخدمة من جداولك الرسمية.')}
          </p>
        </section>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums text-foreground/85">{value}</span>
    </div>
  )
}

function BandChip({ pct, band, highlight }: { pct: number; band: { ar: string; varName: string }; highlight?: boolean }) {
  const color = `hsl(var(${band.varName}))`
  return (
    <div
      className="flex flex-col items-center rounded-lg px-3 py-2"
      style={{ backgroundColor: `hsl(var(${band.varName}) / ${highlight ? 0.16 : 0.1})`, color }}
    >
      <span className="text-lg font-bold leading-none tabular-nums">{pct}%</span>
      <span className="mt-1 text-[10px] font-semibold">{band.ar}</span>
    </div>
  )
}
