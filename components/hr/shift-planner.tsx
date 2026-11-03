'use client'

/**
 * ShiftPlanner — the "تغطية المناوبات والأوفرتايم / Shift Coverage & Overtime" section:
 * the honest, data-driven half of shift planning — who is scheduled vs unscheduled
 * (by branch), the roster of shift types, and an overtime hours+cost forecast with
 * an early cost warning. Read-only, branch-scoped server-side.
 *
 * Mirrors the other HR dashboard sections (token-only, logical-RTL, .theme-hr,
 * skeleton + retry, Arabic-first).
 */

import * as React from 'react'
import { useEffect, useState } from 'react'
import { CalendarClock, RefreshCw, AlertTriangle, Clock, Users, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { fetchShiftOverview, type ShiftOverview } from '@/lib/hr-intelligence-api'

const CARD = 'hr-lift rounded-xl border border-border bg-card text-card-foreground shadow-card p-5'

function hhmm(t: string): string {
  const m = String(t || '').match(/(\d{1,2}):(\d{2})/)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '--:--'
}
function money(v: number, ccy: string): string {
  return `${Math.round(v || 0).toLocaleString('en-US')} ${ccy}`
}

type TX = (en: string, ar: string) => string

const SEV_VAR: Record<string, string> = { high: '--destructive', medium: '--warning', low: '--info' }

function Skeleton() {
  return (
    <div className={CARD}>
      <div className="mb-4 flex items-center gap-2.5">
        <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 w-full animate-pulse rounded bg-muted" />
        ))}
      </div>
    </div>
  )
}

export default function ShiftPlannerSection() {
  const { isRTL } = useI18n()
  const tx: TX = (en, ar) => (isRTL ? ar : en)

  const [data, setData] = useState<ShiftOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = React.useCallback((signal?: AbortSignal) => {
    setLoading(true)
    setError(false)
    fetchShiftOverview(signal)
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
  const ccy = data?.currency ?? 'SAR'
  const coveragePct = data && data.headcount ? Math.round((100 * data.coverage.scheduled) / data.headcount) : 0

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">
            {tx('Shift Coverage & Overtime', 'تغطية المناوبات والأوفرتايم')}
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
          <p className="text-sm font-semibold text-foreground">{tx("Couldn't load shift coverage", 'تعذّر تحميل تغطية المناوبات')}</p>
          <Button variant="outline" size="sm" onClick={() => load()}>
            <RefreshCw className="me-1.5 h-3.5 w-3.5" />
            {tx('Retry', 'إعادة المحاولة')}
          </Button>
        </div>
      ) : loading || !data ? (
        <Skeleton />
      ) : (
        <div className="hr-stagger grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {/* coverage */}
          <section className={CARD}>
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-4 w-4" />
              </span>
              <h3 className="text-sm font-semibold text-foreground">{tx('Coverage', 'التغطية')}</h3>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold leading-none tabular-nums text-foreground">{coveragePct}%</span>
              <span className="ms-auto text-[11px] text-muted-foreground">
                {data.coverage.scheduled}/{data.headcount} {tx('scheduled', 'مجدول')}
              </span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out" style={{ width: `${coveragePct}%` }} />
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              <span className="font-semibold text-warning">{data.coverage.unscheduled}</span> {tx('without an active shift', 'بدون مناوبة نشطة')}
            </p>
            {data.coverage.by_branch.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {data.coverage.by_branch.slice(0, 4).map((b) => (
                  <div key={b.branch} className="flex items-center justify-between text-[11px]">
                    <span className="truncate text-muted-foreground">{b.branch}</span>
                    <span className="font-semibold tabular-nums text-foreground/80">{b.unscheduled}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* roster */}
          <section className={CARD}>
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Clock className="h-4 w-4" />
              </span>
              <h3 className="text-sm font-semibold text-foreground">{tx('Roster', 'المناوبات')}</h3>
            </div>
            {data.shift_types.length ? (
              <div className="space-y-2.5">
                {data.shift_types.map((s) => (
                  <div key={s.name} className="flex items-center justify-between gap-2 border-b border-border/50 pb-2 last:border-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{s.name}</p>
                      <p className="text-[11px] text-muted-foreground">{s.hours} {tx('hrs', 'ساعة')}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold tabular-nums text-foreground/80">
                      {s.assigned}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{tx('No shift types defined.', 'لا توجد مناوبات معرّفة.')}</p>
            )}
          </section>

          {/* overtime */}
          <section className={CARD}>
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Timer className="h-4 w-4" />
              </span>
              <h3 className="text-sm font-semibold text-foreground">{tx('Overtime (30d)', 'الأوفرتايم (30 يوم)')}</h3>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold leading-none tabular-nums text-foreground">{data.overtime.total_hours}</span>
              <span className="text-sm text-muted-foreground">{tx('hrs', 'ساعة')}</span>
              <span className="ms-auto text-sm font-semibold tabular-nums text-warning">{money(data.overtime.total_cost, ccy)}</span>
            </div>
            {data.overtime.top.length ? (
              <div className="mt-3 space-y-1.5">
                {data.overtime.top.map((t) => (
                  <div key={t.employee} className="flex items-center justify-between text-[11px]">
                    <span className="truncate text-muted-foreground">{t.employee_name}</span>
                    <span className="font-semibold tabular-nums text-foreground/80">{t.hours} {tx('h', 'س')}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-[11px] text-muted-foreground">{tx('No overtime logged in the last 30 days.', 'لا أوفرتايم مسجّل في آخر 30 يوماً.')}</p>
            )}
          </section>

          {/* warnings — spans full width */}
          {data.warnings.length > 0 && (
            <section className={`${CARD} lg:col-span-2 xl:col-span-3`}>
              <h3 className="mb-3 text-sm font-semibold text-foreground">{tx('Early warnings', 'إنذارات مبكرة')}</h3>
              <div className="flex flex-col gap-2">
                {data.warnings.map((w, i) => {
                  const color = `hsl(var(${SEV_VAR[w.severity] ?? '--info'}))`
                  return (
                    <div key={i} className="flex items-center gap-2.5 rounded-lg px-3 py-2" style={{ backgroundColor: `hsl(var(${SEV_VAR[w.severity] ?? '--info'}) / 0.1)` }}>
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-[12px] text-foreground/85">{w.ar}</span>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
