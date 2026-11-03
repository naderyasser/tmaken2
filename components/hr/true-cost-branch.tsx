'use client'

/**
 * TrueCostByBranch — the "True Cost by Branch / بطاقة التكلفة الحقيقية" section:
 * the fully-loaded average monthly cost of an employee per branch (base + employer
 * GOSI + iqama/work-permit + dependent levy + medical + EOSB provision + ticket),
 * shown as a ranked table with relative bars and the company-average reference
 * line. Currency-aware. Includes an on-demand single-employee cost breakdown.
 *
 * Self-contained: its own fetch fns + TS types live in this file. Backend:
 *   base_meena.api.true_cost.true_cost_by_branch  →  { branches, currency, company_avg, headcount }
 *   base_meena.api.true_cost.employee_true_cost(employee)  →  full line breakdown
 *
 * Mirrors the other HR dashboard sections (token-only, logical-RTL, .theme-hr,
 * skeleton + retry, Arabic-first).
 */

import * as React from 'react'
import { useEffect, useState } from 'react'
import {
  Building2,
  RefreshCw,
  AlertTriangle,
  Info,
  Users,
  Layers,
  Wallet,
  Search,
  ChevronDown,
  UserRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import frappeClient from '@/lib/api-client'

/* ─────────────────────────── types ─────────────────────────── */

interface BranchCost {
  branch: string
  avg_monthly: number
  headcount: number
}

interface TrueCostByBranch {
  branches: BranchCost[]
  currency: string
  company_avg: number
  headcount?: number
}

interface CostLine {
  key: string
  label_ar: string
  amount: number
}

interface EmployeeTrueCost {
  employee: string
  employee_name: string
  branch: string
  currency: string
  base: number
  dependents: number
  lines: CostLine[]
  total_monthly: number
  total_annual: number
  is_estimate: boolean
}

type TX = (en: string, ar: string) => string

/* ─────────────────────────── data ─────────────────────────── */

async function fetchTrueCostByBranch(signal?: AbortSignal): Promise<TrueCostByBranch> {
  const res = await frappeClient.call<TrueCostByBranch>(
    'base_meena.api.true_cost.true_cost_by_branch',
    {},
    signal,
  )
  const message = (res as { message?: TrueCostByBranch })?.message
  if (!message) throw new Error('Empty true cost response')
  return message
}

async function fetchEmployeeTrueCost(employee: string, signal?: AbortSignal): Promise<EmployeeTrueCost> {
  const res = await frappeClient.call<EmployeeTrueCost>(
    'base_meena.api.true_cost.employee_true_cost',
    { employee },
    signal,
  )
  const message = (res as { message?: EmployeeTrueCost })?.message
  if (!message) throw new Error('Empty employee true cost response')
  return message
}

/* ─────────────────────────── helpers ─────────────────────────── */

const CARD = 'hr-lift rounded-xl border border-border bg-card text-card-foreground shadow-card p-5'

/** English labels for the per-line breakdown keys (backend only ships label_ar). */
const LINE_EN: Record<string, string> = {
  base: 'Base salary',
  gosi: 'GOSI (employer)',
  iqama: 'Iqama fee (monthly)',
  work_permit: 'Work permit (monthly)',
  dependent_levy: 'Dependent levy',
  medical: 'Medical insurance',
  eosb: 'End-of-service provision',
  ticket: 'Flight ticket provision',
}

function fmtInt(n: number | null | undefined): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0))
}

/** Currency-aware money render: Latin digits + currency code, RTL-safe. */
function Money({
  n,
  currency,
  className,
}: {
  n: number | null | undefined
  currency: string
  className?: string
}) {
  return (
    <span className={className}>
      <span className="tabular-nums">{fmtInt(n)}</span>{' '}
      <span className="text-[0.72em] font-normal opacity-70">{currency}</span>
    </span>
  )
}

/* ─────────────────────────── branch row ─────────────────────────── */

function BranchRow({
  b,
  scaleMax,
  companyAvg,
  currency,
  tx,
}: {
  b: BranchCost
  scaleMax: number
  companyAvg: number
  currency: string
  tx: TX
}) {
  const width = scaleMax > 0 ? Math.max(2, Math.min(100, (b.avg_monthly / scaleMax) * 100)) : 0
  const refPos = scaleMax > 0 ? Math.max(0, Math.min(100, (companyAvg / scaleMax) * 100)) : 0

  const pct = companyAvg > 0 ? ((b.avg_monthly - companyAvg) / companyAvg) * 100 : 0
  const above = pct > 2
  const below = pct < -2
  const deltaVar = above ? '--warning' : below ? '--success' : '--muted-foreground'
  const deltaColor = `hsl(var(${deltaVar}))`
  const barColor = above ? 'hsl(var(--warning))' : 'hsl(var(--primary))'

  return (
    <div className="py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium text-foreground">{b.branch}</span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-muted-foreground">
            <Users className="h-2.5 w-2.5" />
            <span className="tabular-nums">{fmtInt(b.headcount)}</span>
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-end">
          <Money n={b.avg_monthly} currency={currency} className="text-sm font-semibold text-foreground" />
          {companyAvg > 0 && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
              style={{ backgroundColor: `hsl(var(${deltaVar}) / 0.12)`, color: deltaColor }}
              title={tx('vs company average', 'مقارنة بمتوسط الشركة')}
            >
              {pct >= 0 ? '+' : '−'}
              {fmtInt(Math.abs(pct))}%
            </span>
          )}
        </div>
      </div>

      {/* relative bar with company-average reference line */}
      <div
        className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted"
        title={`${tx('Average', 'المتوسط')}: ${fmtInt(b.avg_monthly)} ${currency}`}
      >
        <div
          className="absolute inset-y-0 start-0 rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${width}%`, backgroundColor: barColor }}
        />
        {companyAvg > 0 && (
          <div
            className="absolute inset-y-[-2px] z-10 w-0 border-e border-dashed"
            style={{ insetInlineStart: `${refPos}%`, borderColor: 'hsl(var(--foreground) / 0.55)' }}
          />
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────── single-employee breakdown ─────────────────────────── */

function EmployeeBreakdown({ tx }: { tx: TX }) {
  const [open, setOpen] = useState(false)
  const [id, setId] = useState('')
  const [data, setData] = useState<EmployeeTrueCost | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = () => {
    const emp = id.trim()
    if (!emp) return
    setLoading(true)
    setError(null)
    fetchEmployeeTrueCost(emp)
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch(() => {
        setError(tx('No cost found for that employee ID.', 'لا توجد تكلفة لرقم الموظف هذا.'))
        setData(null)
        setLoading(false)
      })
  }

  const lineMax = data ? Math.max(1, ...data.lines.map((l) => l.amount)) : 1

  return (
    <div className="mt-5 rounded-lg border border-border bg-muted/30 p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-start"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <UserRound className="h-4 w-4 text-primary" />
          {tx('Single-employee cost breakdown', 'تفصيل تكلفة موظف واحد')}
        </span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={id}
                onChange={(e) => setId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') run()
                }}
                placeholder={tx('Employee ID (e.g. HR-EMP-0001)', 'رقم الموظف (مثال: HR-EMP-0001)')}
                className="w-full rounded-md border border-border bg-background py-2 pe-3 ps-8 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              />
            </div>
            <Button size="sm" onClick={run} disabled={loading || !id.trim()} className="shrink-0">
              {loading ? (
                <RefreshCw className="me-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wallet className="me-1.5 h-3.5 w-3.5" />
              )}
              {tx('Compute', 'احسب')}
            </Button>
          </div>

          {error && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              {error}
            </p>
          )}

          {data && !error && (
            <div className="mt-4">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{data.employee_name}</p>
                  <p className="text-[11px] text-muted-foreground">{data.branch}</p>
                </div>
                <div className="text-end">
                  <Money n={data.total_monthly} currency={data.currency} className="text-lg font-bold text-primary" />
                  <p className="text-[10px] text-muted-foreground">
                    {tx('per month', 'شهرياً')} ·{' '}
                    <span className="tabular-nums">{fmtInt(data.total_annual)}</span> {data.currency}{' '}
                    {tx('/ yr', '/ سنوياً')}
                  </p>
                </div>
              </div>

              <ul className="space-y-1.5">
                {data.lines.map((l) => {
                  const w = Math.max(2, Math.min(100, (l.amount / lineMax) * 100))
                  return (
                    <li key={l.key} className="flex items-center gap-3">
                      <span className="w-32 shrink-0 truncate text-[11px] text-muted-foreground sm:w-40">
                        {tx(LINE_EN[l.key] ?? l.key, l.label_ar)}
                      </span>
                      <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className="absolute inset-y-0 start-0 rounded-full bg-primary/70"
                          style={{ width: `${w}%` }}
                        />
                      </span>
                      <Money
                        n={l.amount}
                        currency={data.currency}
                        className="w-24 shrink-0 text-end text-[11px] font-medium tabular-nums text-foreground"
                      />
                    </li>
                  )
                })}
              </ul>

              {data.is_estimate && (
                <p className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Info className="h-3 w-3" />
                  {tx('Estimate — fee lines from company settings.', 'تقديري — بنود الرسوم من إعدادات الشركة.')}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────── skeleton ─────────────────────────── */

function Skeleton() {
  return (
    <div className={CARD}>
      <div className="mb-5 grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="py-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-2.5 w-full animate-pulse rounded-full bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────── main export ─────────────────────────── */

export default function TrueCostByBranchSection() {
  const { isRTL } = useI18n()
  const tx: TX = (en, ar) => (isRTL ? ar : en)

  const [data, setData] = useState<TrueCostByBranch | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = React.useCallback((signal?: AbortSignal) => {
    setLoading(true)
    setError(false)
    fetchTrueCostByBranch(signal)
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

  const currency = data?.currency ?? 'SAR'
  const companyAvg = data?.company_avg ?? 0
  const branches = data?.branches ?? []
  const totalHeadcount = data?.headcount ?? branches.reduce((s, b) => s + (b.headcount || 0), 0)
  const scaleMax = Math.max(companyAvg, ...branches.map((b) => b.avg_monthly), 1)

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">
            {tx('True Cost by Branch', 'التكلفة الحقيقية حسب الفرع')}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {!loading && !error && data && (
            <span
              className="hidden items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] text-muted-foreground sm:inline-flex"
              title={tx('Estimate — fee lines from company settings.', 'تقديري — بنود الرسوم من إعدادات الشركة.')}
            >
              <Info className="h-3 w-3" />
              {tx('Estimate', 'تقديري')}
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
              {tx("Couldn't load the true-cost card", 'تعذّر تحميل بطاقة التكلفة الحقيقية')}
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
        <Skeleton />
      ) : branches.length === 0 ? (
        <div className={`${CARD} flex flex-col items-center gap-3 py-10 text-center`}>
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Layers className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {tx('No branch cost data yet', 'لا توجد بيانات تكلفة للفروع بعد')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {tx('No active employees are in your scope, or salaries are not set.', 'لا يوجد موظفون نشطون ضمن نطاقك، أو لم تُحدَّد الرواتب.')}
            </p>
          </div>
          <EmployeeBreakdown tx={tx} />
        </div>
      ) : (
        <div className={CARD}>
          {/* summary strip */}
          <div className="mb-5 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-primary/10 px-3 py-2.5 text-primary">
              <p className="text-[10px] font-medium opacity-80">{tx('Company average', 'متوسط الشركة')}</p>
              <Money n={companyAvg} currency={currency} className="text-base font-bold leading-tight" />
            </div>
            <div className="rounded-lg bg-accent px-3 py-2.5">
              <p className="text-[10px] font-medium text-muted-foreground">{tx('Branches', 'الفروع')}</p>
              <p className="text-base font-bold leading-tight tabular-nums text-foreground">{fmtInt(branches.length)}</p>
            </div>
            <div className="rounded-lg bg-accent px-3 py-2.5">
              <p className="text-[10px] font-medium text-muted-foreground">{tx('Headcount', 'إجمالي الموظفين')}</p>
              <p className="text-base font-bold leading-tight tabular-nums text-foreground">{fmtInt(totalHeadcount)}</p>
            </div>
          </div>

          {/* reference-line legend */}
          {companyAvg > 0 && (
            <div className="mb-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="inline-block h-3 w-0 border-e border-dashed" style={{ borderColor: 'hsl(var(--foreground) / 0.55)' }} />
              {tx('Dashed line = company average', 'الخط المتقطّع = متوسط الشركة')}
            </div>
          )}

          {/* ranked branch bars */}
          <div className="divide-y divide-border">
            {branches.map((b) => (
              <BranchRow
                key={b.branch}
                b={b}
                scaleMax={scaleMax}
                companyAvg={companyAvg}
                currency={currency}
                tx={tx}
              />
            ))}
          </div>

          <p className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Info className="h-3 w-3" />
            {tx(
              'Fully-loaded monthly cost: base + employer GOSI + iqama/permit + levy + medical + EOSB + tickets.',
              'التكلفة الشهرية الكاملة: الأساسي + تأمينات رب العمل + الإقامة/الرخصة + المرافقين + الطبي + نهاية الخدمة + التذاكر.',
            )}
          </p>

          <EmployeeBreakdown tx={tx} />
        </div>
      )}
    </div>
  )
}
