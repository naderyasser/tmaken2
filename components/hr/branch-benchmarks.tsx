'use client'

/**
 * BranchBenchmarks — the "مقارنة الفروع / Cross-Branch Benchmarks" section:
 * compares a group's own branches against each other and the company average on
 * headcount, average monthly cost, absence rate and lateness. No invented market
 * data — everything is the customer's own numbers.
 *
 * Mirrors the other HR dashboard sections (token-only, logical-RTL, .theme-hr,
 * skeleton + retry, Arabic-first).
 */

import * as React from 'react'
import { useEffect, useState } from 'react'
import { GitCompareArrows, RefreshCw, AlertTriangle, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { fetchBranchBenchmarks, type BranchBenchmarks, type BranchBenchmarkRow } from '@/lib/hr-intelligence-api'

const CARD = 'hr-lift rounded-xl border border-border bg-card text-card-foreground shadow-card p-5'

function hhmm(t: string): string {
  const m = String(t || '').match(/(\d{1,2}):(\d{2})/)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '--:--'
}

type TX = (en: string, ar: string) => string

function money(v: number, ccy: string): string {
  return `${Math.round(v || 0).toLocaleString('en-US')} ${ccy}`
}

/** A metric cell: value + a relative bar (fraction of the max across branches). */
function Bar({ frac, tone }: { frac: number; tone: string }) {
  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${Math.max(3, Math.min(100, frac * 100))}%`, backgroundColor: `hsl(var(${tone}))` }}
      />
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
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 w-full animate-pulse rounded bg-muted" />
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────── main export ─────────────────────────── */

export default function BranchBenchmarksSection() {
  const { isRTL } = useI18n()
  const tx: TX = (en, ar) => (isRTL ? ar : en)

  const [data, setData] = useState<BranchBenchmarks | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = React.useCallback((signal?: AbortSignal) => {
    setLoading(true)
    setError(false)
    fetchBranchBenchmarks(signal)
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
  const ccy = data?.company?.currency ?? 'SAR'

  const maxCost = data ? Math.max(1, ...data.branches.map((b) => b.avg_cost)) : 1
  const maxHead = data ? Math.max(1, ...data.branches.map((b) => b.headcount)) : 1
  const maxAbs = data ? Math.max(1, ...data.branches.map((b) => b.absence_rate)) : 1

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <GitCompareArrows className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">
            {tx('Cross-Branch Benchmarks', 'مقارنة الفروع')}
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
            <p className="text-sm font-semibold text-foreground">{tx("Couldn't load branch benchmarks", 'تعذّر تحميل مقارنة الفروع')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{tx('Check your connection and try again.', 'تحقّق من الاتصال وحاول مرة أخرى.')}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => load()}>
            <RefreshCw className="me-1.5 h-3.5 w-3.5" />
            {tx('Retry', 'إعادة المحاولة')}
          </Button>
        </div>
      ) : loading || !data ? (
        <Skeleton />
      ) : (
        <section className={CARD}>
          {/* company reference line */}
          <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-accent px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Building2 className="h-4 w-4 text-primary" />
              {tx('Company average', 'متوسط الشركة')}
            </div>
            <div className="text-xs text-muted-foreground">
              {tx('Headcount', 'العدد')}: <span className="font-semibold tabular-nums text-foreground/80">{data.company.headcount}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {tx('Avg cost', 'متوسط التكلفة')}: <span className="font-semibold tabular-nums text-foreground/80">{money(data.company.avg_cost, ccy)}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {tx('Absence', 'الغياب')}: <span className="font-semibold tabular-nums text-foreground/80">{data.company.absence_rate}%</span>
            </div>
          </div>

          {/* per-branch rows */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="text-start text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 text-start font-medium">{tx('Branch', 'الفرع')}</th>
                  <th className="pb-2 text-start font-medium">{tx('Headcount', 'العدد')}</th>
                  <th className="pb-2 text-start font-medium">{tx('Avg cost', 'متوسط التكلفة')}</th>
                  <th className="pb-2 text-start font-medium">{tx('Absence %', 'الغياب %')}</th>
                  <th className="pb-2 text-start font-medium">{tx('Late / emp', 'تأخير/موظف')}</th>
                </tr>
              </thead>
              <tbody>
                {data.branches.map((b: BranchBenchmarkRow) => (
                  <tr key={b.branch} className="border-t border-border/60">
                    <td className="py-2.5 pe-3 font-medium text-foreground">{b.branch}</td>
                    <td className="py-2.5 pe-3 align-top">
                      <span className="tabular-nums text-foreground/80">{b.headcount}</span>
                      <Bar frac={b.headcount / maxHead} tone="--primary" />
                    </td>
                    <td className="py-2.5 pe-3 align-top">
                      <span className="tabular-nums text-foreground/80">{money(b.avg_cost, ccy)}</span>
                      <Bar frac={b.avg_cost / maxCost} tone="--info" />
                    </td>
                    <td className="py-2.5 pe-3 align-top">
                      <span className="tabular-nums text-foreground/80">{b.absence_rate}%</span>
                      <Bar frac={b.absence_rate / maxAbs} tone="--warning" />
                    </td>
                    <td className="py-2.5 align-top tabular-nums text-foreground/80">{b.late_rate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-[11px] text-muted-foreground">
            {tx('Absence & lateness over the last 30 days. Cost = average monthly base wage.', 'الغياب والتأخير خلال آخر 30 يوماً. التكلفة = متوسط الأجر الأساسي الشهري.')}
          </p>
        </section>
      )}
    </div>
  )
}
