'use client'

/**
 * OvertimeBudget — the "سقف الأوفرتايم / Overtime Budget" section: a per-branch
 * monthly burn bar of APPROVED overtime hours against the branch cap. Turns amber
 * at >=80% and red at >=100% of the cap, and surfaces the cap amount (SAR) plus the
 * count of pending overtime requests awaiting a decision. Branch + month selectors.
 *
 * Reads base_meena.api.overtime_budget.get_budget_burn (HR-gated, feature-flagged
 * server-side). Mirrors the other HR dashboard sections (token-only, logical-RTL,
 * .theme-hr, skeleton + retry, Arabic-first). Fully self-contained.
 */

import * as React from 'react'
import { useEffect, useState } from 'react'
import {
  Timer,
  RefreshCw,
  AlertTriangle,
  Building2,
  CalendarDays,
  Clock,
  Gauge,
  Wallet,
  Hourglass,
  CircleAlert,
  CheckCircle2,
  Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import frappeClient from '@/lib/api-client'

const CARD = 'hr-lift rounded-xl border border-border bg-card text-card-foreground shadow-card p-5'

type TX = (en: string, ar: string) => string

/* ─────────────────────────── types + fetch (self-contained) ─────────────────────────── */

interface BudgetBurn {
  branch: string
  month: string
  cap_hours: number
  cap_amount: number
  used_hours: number
  pending_requests: number
  burn_pct: number | null
}

async function fetchBranches(signal?: AbortSignal): Promise<string[]> {
  const res = await frappeClient.call(
    'frappe.client.get_list',
    { doctype: 'Branch', fields: ['name'], limit_page_length: 0, order_by: 'name asc' },
    signal,
  )
  const rows = (res?.message ?? []) as Array<{ name: string }>
  return rows.map((r) => r.name).filter(Boolean)
}

async function fetchBudgetBurn(branch: string, month: string, signal?: AbortSignal): Promise<BudgetBurn> {
  const res = await frappeClient.call(
    'base_meena.api.overtime_budget.get_budget_burn',
    { branch, month },
    signal,
  )
  return res?.message as BudgetBurn
}

/* ─────────────────────────── helpers ─────────────────────────── */

const nf1 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })
const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

function thisMonth(): string {
  return new Date().toISOString().slice(0, 7) // YYYY-MM
}

interface BurnMeta {
  varName: string
  en: string
  ar: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
}

function burnMeta(pct: number | null): BurnMeta {
  if (pct == null) return { varName: '--muted-foreground', en: 'No cap set', ar: 'لا يوجد سقف', icon: CircleAlert }
  if (pct >= 100) return { varName: '--destructive', en: 'Over budget', ar: 'تجاوز السقف', icon: AlertTriangle }
  if (pct >= 80) return { varName: '--warning', en: 'Near cap', ar: 'قريب من السقف', icon: CircleAlert }
  return { varName: '--success', en: 'On track', ar: 'ضمن الحدود', icon: CheckCircle2 }
}

/* ─────────────────────────── stat tile ─────────────────────────── */

function StatTile({
  icon: Icon,
  label,
  value,
  suffix,
  accentVar,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  label: string
  value: string
  suffix?: string
  accentVar?: string
}) {
  const color = accentVar ? `hsl(var(${accentVar}))` : undefined
  return (
    <div className="rounded-lg bg-muted/60 p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" style={color ? { color } : undefined} />
        <span className="text-[11px] font-medium">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-bold leading-none tabular-nums text-foreground" style={color ? { color } : undefined}>
          {value}
        </span>
        {suffix && <span className="text-[11px] text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  )
}

/* ─────────────────────────── burn card ─────────────────────────── */

function BurnCard({ data, tx }: { data: BudgetBurn; tx: TX }) {
  const meta = burnMeta(data.burn_pct)
  const color = `hsl(var(${meta.varName}))`
  const pct = data.burn_pct
  const barW = Math.min(100, Math.max(0, pct ?? 0))
  const StatusIcon = meta.icon

  return (
    <section className={CARD}>
      {/* header: branch + status pill */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-4 w-4" />
          </span>
          <h3 className="truncate text-sm font-semibold text-foreground">{data.branch}</h3>
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: `hsl(var(${meta.varName}) / 0.12)`, color }}
        >
          <StatusIcon className="h-3 w-3" />
          {tx(meta.en, meta.ar)}
        </span>
      </div>

      {/* big burn % */}
      <div className="flex items-baseline gap-1.5">
        <Gauge className="me-0.5 h-4 w-4 self-center" style={{ color }} />
        {pct == null ? (
          <span className="text-2xl font-bold leading-none text-muted-foreground">—</span>
        ) : (
          <>
            <span className="text-4xl font-bold leading-none tabular-nums" style={{ color }}>
              {nf1.format(pct)}
            </span>
            <span className="text-lg font-semibold" style={{ color }}>
              %
            </span>
          </>
        )}
        <span className="ms-auto text-[11px] tabular-nums text-muted-foreground">
          {nf1.format(data.used_hours)} / {data.cap_hours ? nf1.format(data.cap_hours) : '—'} {tx('hrs', 'ساعة')}
        </span>
      </div>

      {/* progress bar */}
      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${barW}%`, backgroundColor: color }}
        />
      </div>
      {pct != null && pct > 100 && (
        <p className="mt-1.5 text-[11px] font-medium" style={{ color }}>
          {tx('Exceeded the cap by', 'تجاوز السقف بـ')} {nf1.format(data.used_hours - data.cap_hours)} {tx('hrs', 'ساعة')}
        </p>
      )}
      {pct == null && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {tx('No cap configured for this branch and month.', 'لم يُحدَّد سقف لهذا الفرع والشهر.')}
        </p>
      )}

      {/* stat tiles */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile
          icon={Clock}
          label={tx('Used', 'المستخدَم')}
          value={nf1.format(data.used_hours)}
          suffix={tx('hrs', 'ساعة')}
        />
        <StatTile
          icon={Layers}
          label={tx('Cap', 'السقف')}
          value={data.cap_hours ? nf1.format(data.cap_hours) : '—'}
          suffix={data.cap_hours ? tx('hrs', 'ساعة') : undefined}
        />
        <StatTile
          icon={Wallet}
          label={tx('Cap amount', 'قيمة السقف')}
          value={data.cap_amount ? nf0.format(data.cap_amount) : '—'}
          suffix={data.cap_amount ? tx('SAR', 'ر.س') : undefined}
        />
        <StatTile
          icon={Hourglass}
          label={tx('Pending', 'قيد الاعتماد')}
          value={nf0.format(data.pending_requests)}
          suffix={tx('req.', 'طلب')}
          accentVar={data.pending_requests > 0 ? '--warning' : undefined}
        />
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
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      </div>
      <div className="mb-3 h-10 w-28 animate-pulse rounded bg-muted" />
      <div className="mb-4 h-2.5 w-full animate-pulse rounded-full bg-muted" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────── main export ─────────────────────────── */

export default function OvertimeBudgetSection() {
  const { isRTL } = useI18n()
  const tx: TX = (en, ar) => (isRTL ? ar : en)

  const [branches, setBranches] = useState<string[] | null>(null)
  const [branch, setBranch] = useState<string>('')
  const [month, setMonth] = useState<string>(thisMonth())

  const [data, setData] = useState<BudgetBurn | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Load the branch list once.
  useEffect(() => {
    const ctrl = new AbortController()
    fetchBranches(ctrl.signal)
      .then((list) => {
        if (ctrl.signal.aborted) return
        setBranches(list)
        setBranch((cur) => cur || list[0] || '')
        if (list.length === 0) setLoading(false)
      })
      .catch(() => {
        if (ctrl.signal.aborted) return
        setError(true)
        setLoading(false)
      })
    return () => ctrl.abort()
  }, [])

  const load = React.useCallback(
    (b: string, m: string, signal?: AbortSignal) => {
      if (!b || !m) return
      setLoading(true)
      setError(false)
      fetchBudgetBurn(b, m, signal)
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

  // Refetch whenever branch or month changes.
  useEffect(() => {
    if (!branch || !month) return
    const ctrl = new AbortController()
    load(branch, month, ctrl.signal)
    return () => ctrl.abort()
  }, [branch, month, load])

  const noBranches = branches != null && branches.length === 0
  const selectCls =
    'h-9 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-foreground outline-none transition-colors hover:bg-accent focus:border-primary disabled:opacity-50'

  return (
    <div className="mb-8">
      {/* section header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">{tx('Overtime Budget', 'سقف الأوفرتايم')}</h2>
        </div>
        <button
          type="button"
          onClick={() => load(branch, month)}
          disabled={loading || !branch}
          aria-label={tx('Refresh', 'تحديث')}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* controls: branch + month */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Building2 className="h-3.5 w-3.5" />
          <span className="sr-only">{tx('Branch', 'الفرع')}</span>
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            disabled={!branches || noBranches}
            aria-label={tx('Branch', 'الفرع')}
            className={selectCls}
          >
            {!branches && <option value="">{tx('Loading…', 'جارٍ التحميل…')}</option>}
            {noBranches && <option value="">{tx('No branches', 'لا توجد فروع')}</option>}
            {branches?.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>

        <label className="inline-flex items-center gap-1.5 text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          <span className="sr-only">{tx('Month', 'الشهر')}</span>
          <input
            type="month"
            value={month}
            max={thisMonth()}
            onChange={(e) => setMonth(e.target.value || thisMonth())}
            aria-label={tx('Month', 'الشهر')}
            className={`${selectCls} tabular-nums`}
          />
        </label>
      </div>

      {/* content states */}
      {error ? (
        <div className={`${CARD} flex flex-col items-center gap-3 py-10 text-center`}>
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {tx("Couldn't load the overtime budget", 'تعذّر تحميل سقف الأوفرتايم')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {tx('Check your connection and try again.', 'تحقّق من الاتصال وحاول مرة أخرى.')}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => load(branch, month)} disabled={!branch}>
            <RefreshCw className="me-1.5 h-3.5 w-3.5" />
            {tx('Retry', 'إعادة المحاولة')}
          </Button>
        </div>
      ) : noBranches ? (
        <div className={`${CARD} flex flex-col items-center gap-3 py-10 text-center`}>
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Building2 className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">{tx('No branches configured', 'لا توجد فروع')}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {tx('Add a branch to track its overtime budget.', 'أضِف فرعًا لتتبّع سقف الأوفرتايم الخاص به.')}
            </p>
          </div>
        </div>
      ) : loading || !data ? (
        <SkeletonCard />
      ) : (
        <BurnCard data={data} tx={tx} />
      )}
    </div>
  )
}
