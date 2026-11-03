'use client'

/**
 * ExpensesByBranch — the "Expenses by Branch / المصاريف حسب الفرع" section.
 *
 * Two panels, one screen:
 *  1) Monthly approved-expense-by-branch widget (Approved + Paid), from
 *     base_meena.api.expense_claims.monthly_by_branch — grand total, per-branch
 *     bars, paid-share, count. A month stepper drives the `month` param.
 *  2) Pending Expense Claim Lite queue (read via the Frappe list resource, since
 *     the module ships no HR list endpoint) with per-claim Approve
 *     (Add-to-Salary / Petty-Cash) and Reject actions wired to
 *     base_meena.api.expense_claims.approve_claim / reject_claim.
 *
 * Self-contained: fetchers + types live here. Mirrors the other HR dashboard
 * sections (token-only colors, logical-RTL, .theme-hr, skeleton + retry,
 * Arabic-first).
 */

import * as React from 'react'
import { useEffect, useState } from 'react'
import {
  Receipt,
  RefreshCw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Building2,
  Wallet,
  CheckCircle2,
  Plane,
  UtensilsCrossed,
  Package,
  Fuel,
  Tag,
  Check,
  X,
  Inbox,
  FolderGit2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { frappeClient } from '@/lib/api-client'
import { formatSAR } from '@/lib/format'

const CARD = 'hr-lift rounded-xl border border-border bg-card text-card-foreground shadow-card p-5'

type TX = (en: string, ar: string) => string

/* ─────────────────────────── types (matches backend) ─────────────────────────── */

interface BranchRow {
  branch: string
  total: number
  count: number
  paid: number
}

interface MonthlyByBranch {
  month: string
  period: { from: string; to: string }
  by_branch: BranchRow[]
  grand_total: number
  branch_count: number
}

type ExpenseCategory = 'Travel' | 'Meals' | 'Supplies' | 'Fuel' | 'Other'
type PayoutMethod = 'Add to Salary' | 'Petty Cash'

interface PendingClaim {
  name: string
  employee_name?: string
  branch?: string | null
  category: ExpenseCategory | string
  amount: number
  project?: string | null
  creation?: string
  status: string
}

/* ─────────────────────────── fetchers (self-contained) ─────────────────────────── */

async function fetchMonthlyByBranch(month: string, signal?: AbortSignal): Promise<MonthlyByBranch> {
  const res = await frappeClient.call<MonthlyByBranch>(
    'base_meena.api.expense_claims.monthly_by_branch',
    { month },
    signal,
  )
  const message = (res as { message?: MonthlyByBranch })?.message
  if (!message) throw new Error('Empty monthly-by-branch response')
  return message
}

async function fetchPendingClaims(): Promise<PendingClaim[]> {
  // No HR list endpoint in the module — read the doctype directly (HR-scoped
  // permissions apply server-side).
  return frappeClient.getList<PendingClaim>('Expense Claim Lite', {
    fields: ['name', 'employee_name', 'branch', 'category', 'amount', 'project', 'creation', 'status'],
    filters: [['Expense Claim Lite', 'status', '=', 'Pending']],
    order_by: 'creation desc',
    limit_page_length: 100,
  })
}

async function approveClaim(name: string, payout_method: PayoutMethod): Promise<void> {
  await frappeClient.call('base_meena.api.expense_claims.approve_claim', { name, payout_method })
}

async function rejectClaim(name: string): Promise<void> {
  await frappeClient.call('base_meena.api.expense_claims.reject_claim', { name })
}

/* ─────────────────────────── helpers ─────────────────────────── */

const CATEGORY_META: Record<string, { en: string; ar: string; icon: React.ComponentType<{ className?: string }> }> = {
  Travel: { en: 'Travel', ar: 'سفر', icon: Plane },
  Meals: { en: 'Meals', ar: 'وجبات', icon: UtensilsCrossed },
  Supplies: { en: 'Supplies', ar: 'لوازم', icon: Package },
  Fuel: { en: 'Fuel', ar: 'وقود', icon: Fuel },
  Other: { en: 'Other', ar: 'أخرى', icon: Tag },
}

const PAYOUT_META: Record<PayoutMethod, { en: string; ar: string }> = {
  'Add to Salary': { en: 'Add to salary', ar: 'إضافة للراتب' },
  'Petty Cash': { en: 'Petty cash', ar: 'نقدية' },
}

/** Current month as 'YYYY-MM' from the browser clock. */
function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Step a 'YYYY-MM' string by ±1 month. */
function stepMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map((n) => parseInt(n, 10))
  const d = new Date(y, (m - 1) + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Human month label, e.g. 'July 2026' / 'يوليو 2026' via Intl (Latin digits kept). */
function monthLabel(month: string, isRTL: boolean): string {
  const [y, m] = month.split('-').map((n) => parseInt(n, 10))
  if (!y || !m) return month
  const d = new Date(y, m - 1, 1)
  try {
    return new Intl.DateTimeFormat(isRTL ? 'ar' : 'en', {
      month: 'long',
      year: 'numeric',
      numberingSystem: 'latn',
    }).format(d)
  } catch {
    return month
  }
}

function branchLabel(branch: string | null | undefined, tx: TX): string {
  if (!branch || branch === '—') return tx('Unspecified', 'غير محدد')
  return branch
}

/* ─────────────────────────── monthly widget ─────────────────────────── */

function MonthlyWidget({
  data,
  month,
  onStep,
  atCurrent,
  tx,
  isRTL,
}: {
  data: MonthlyByBranch
  month: string
  onStep: (delta: number) => void
  atCurrent: boolean
  tx: TX
  isRTL: boolean
}) {
  const rows = data.by_branch ?? []
  const max = rows.reduce((acc, r) => Math.max(acc, r.total), 0) || 1
  // In RTL, the "older" (previous) control sits on the visual right.
  const PrevIcon = isRTL ? ChevronRight : ChevronLeft
  const NextIcon = isRTL ? ChevronLeft : ChevronRight

  return (
    <section className={CARD}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-4 w-4" />
          </span>
          <h3 className="truncate text-sm font-semibold text-foreground">
            {tx('Approved expense by branch', 'المصاريف المعتمدة حسب الفرع')}
          </h3>
        </div>
        {/* month stepper */}
        <div className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
          <button
            type="button"
            onClick={() => onStep(-1)}
            aria-label={tx('Previous month', 'الشهر السابق')}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <PrevIcon className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[6.5rem] px-1 text-center text-[11px] font-medium tabular-nums text-foreground">
            {monthLabel(month, isRTL)}
          </span>
          <button
            type="button"
            onClick={() => onStep(1)}
            disabled={atCurrent}
            aria-label={tx('Next month', 'الشهر التالي')}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
          >
            <NextIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* grand total */}
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] text-muted-foreground">{tx('Total approved', 'إجمالي المعتمد')}</p>
          <p className="text-3xl font-bold leading-none tabular-nums text-foreground">
            {formatSAR(data.grand_total)}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-1 text-[11px] text-muted-foreground">
          <Building2 className="h-3 w-3" />
          <span className="tabular-nums text-foreground/80">{data.branch_count}</span>
          {tx('branches', 'فرع')}
        </span>
      </div>

      {/* per-branch bars */}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <Inbox className="h-6 w-6 text-muted-foreground/60" />
          <p className="text-xs text-muted-foreground">
            {tx('No approved expense this month.', 'لا مصاريف معتمدة هذا الشهر.')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const pct = Math.max(2, Math.round((r.total / max) * 100))
            const paidPct = r.total > 0 ? Math.round((r.paid / r.total) * 100) : 0
            return (
              <div key={r.branch}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs font-medium text-foreground">{branchLabel(r.branch, tx)}</span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
                    {formatSAR(r.total)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted" style={{ maxWidth: `${pct}%` }}>
                    {/* paid share (settled) rendered darker on top of the approved bar */}
                    <div className="relative h-full w-full" style={{ backgroundColor: 'hsl(var(--primary) / 0.35)' }}>
                      <div
                        className="h-full rounded-full transition-[width] duration-500 ease-out"
                        style={{ width: `${paidPct}%`, backgroundColor: 'hsl(var(--primary))' }}
                      />
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                    {r.count} {tx('clm', 'طلب')}
                  </span>
                </div>
                {r.paid > 0 && (
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <CheckCircle2 className="h-2.5 w-2.5" style={{ color: 'hsl(var(--success))' }} />
                    {tx('Paid', 'مدفوع')} <span className="tabular-nums">{formatSAR(r.paid)}</span>
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

/* ─────────────────────────── pending claim card ─────────────────────────── */

function PendingCard({
  claim,
  payout,
  busy,
  error,
  onPayout,
  onApprove,
  onReject,
  tx,
}: {
  claim: PendingClaim
  payout: PayoutMethod
  busy: boolean
  error?: string
  onPayout: (m: PayoutMethod) => void
  onApprove: () => void
  onReject: () => void
  tx: TX
}) {
  const cat = CATEGORY_META[claim.category] ?? CATEGORY_META.Other
  const CatIcon = cat.icon

  return (
    <section className={CARD}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-muted-foreground">
            <CatIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {claim.employee_name || claim.name}
            </h3>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
              <span>{tx(cat.en, cat.ar)}</span>
              <span className="text-border">•</span>
              <span>{branchLabel(claim.branch, tx)}</span>
              {claim.project && (
                <>
                  <span className="text-border">•</span>
                  <span className="inline-flex items-center gap-1">
                    <FolderGit2 className="h-3 w-3" />
                    {claim.project}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
        <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">{formatSAR(claim.amount)}</span>
      </div>

      {/* payout method segmented control */}
      <div className="mb-3">
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {tx('Payout method', 'طريقة الصرف')}
        </p>
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
          {(['Add to Salary', 'Petty Cash'] as PayoutMethod[]).map((m) => {
            const active = payout === m
            const Icon = m === 'Add to Salary' ? Wallet : Receipt
            return (
              <button
                key={m}
                type="button"
                disabled={busy}
                onClick={() => onPayout(m)}
                className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50 ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <Icon className="h-3 w-3" />
                {tx(PAYOUT_META[m].en, PAYOUT_META[m].ar)}
              </button>
            )
          })}
        </div>
      </div>

      {error && (
        <p className="mb-2 flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span className="min-w-0">{error}</span>
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button size="sm" className="flex-1" onClick={onApprove} disabled={busy}>
          {busy ? (
            <RefreshCw className="me-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="me-1.5 h-3.5 w-3.5" />
          )}
          {tx('Approve', 'اعتماد')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onReject}
          disabled={busy}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <X className="me-1.5 h-3.5 w-3.5" />
          {tx('Reject', 'رفض')}
        </Button>
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

export default function ExpensesByBranchSection() {
  const { isRTL } = useI18n()
  const tx: TX = (en, ar) => (isRTL ? ar : en)

  const nowMonth = React.useMemo(() => currentMonth(), [])
  const [month, setMonth] = useState<string>(nowMonth)

  const [monthly, setMonthly] = useState<MonthlyByBranch | null>(null)
  const [monthlyLoading, setMonthlyLoading] = useState(true)
  const [monthlyError, setMonthlyError] = useState(false)

  const [pending, setPending] = useState<PendingClaim[] | null>(null)
  const [pendingLoading, setPendingLoading] = useState(true)
  const [pendingError, setPendingError] = useState(false)

  const [payoutById, setPayoutById] = useState<Record<string, PayoutMethod>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [errorById, setErrorById] = useState<Record<string, string>>({})

  const loadMonthly = React.useCallback((m: string, signal?: AbortSignal) => {
    setMonthlyLoading(true)
    setMonthlyError(false)
    fetchMonthlyByBranch(m, signal)
      .then((d) => {
        if (signal?.aborted) return
        setMonthly(d)
        setMonthlyLoading(false)
      })
      .catch(() => {
        if (signal?.aborted) return
        setMonthlyError(true)
        setMonthlyLoading(false)
      })
  }, [])

  const loadPending = React.useCallback(() => {
    setPendingLoading(true)
    setPendingError(false)
    fetchPendingClaims()
      .then((list) => {
        setPending(list)
        setPendingLoading(false)
      })
      .catch(() => {
        setPendingError(true)
        setPendingLoading(false)
      })
  }, [])

  // Monthly reloads whenever the selected month changes.
  useEffect(() => {
    const ctrl = new AbortController()
    loadMonthly(month, ctrl.signal)
    return () => ctrl.abort()
  }, [month, loadMonthly])

  // Pending queue loads once (and on manual refresh / after actions).
  useEffect(() => {
    loadPending()
  }, [loadPending])

  const refreshAll = React.useCallback(() => {
    loadMonthly(month)
    loadPending()
  }, [month, loadMonthly, loadPending])

  const payoutFor = (name: string): PayoutMethod => payoutById[name] ?? 'Add to Salary'

  const handleApprove = async (claim: PendingClaim) => {
    setBusyId(claim.name)
    setErrorById((e) => ({ ...e, [claim.name]: '' }))
    try {
      await approveClaim(claim.name, payoutFor(claim.name))
      // Remove from the queue and refresh the monthly widget — an approved claim
      // now counts toward the approved-by-branch totals.
      setPending((list) => (list ? list.filter((c) => c.name !== claim.name) : list))
      loadMonthly(month)
    } catch (err) {
      setErrorById((e) => ({
        ...e,
        [claim.name]: err instanceof Error ? err.message : tx('Action failed', 'فشل الإجراء'),
      }))
    } finally {
      setBusyId(null)
    }
  }

  const handleReject = async (claim: PendingClaim) => {
    setBusyId(claim.name)
    setErrorById((e) => ({ ...e, [claim.name]: '' }))
    try {
      await rejectClaim(claim.name)
      setPending((list) => (list ? list.filter((c) => c.name !== claim.name) : list))
    } catch (err) {
      setErrorById((e) => ({
        ...e,
        [claim.name]: err instanceof Error ? err.message : tx('Action failed', 'فشل الإجراء'),
      }))
    } finally {
      setBusyId(null)
    }
  }

  const stepTo = (delta: number) => setMonth((m) => stepMonth(m, delta))
  const atCurrent = month >= nowMonth
  const loading = monthlyLoading || pendingLoading
  const pendingCount = pending?.length ?? 0

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">
            {tx('Expenses by Branch', 'المصاريف حسب الفرع')}
          </h2>
          {!pendingLoading && !pendingError && pendingCount > 0 && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ backgroundColor: 'hsl(var(--warning) / 0.14)', color: 'hsl(var(--warning))' }}
            >
              {pendingCount} {tx('pending', 'معلّق')}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={refreshAll}
          disabled={loading}
          aria-label={tx('Refresh', 'تحديث')}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {/* ── monthly widget (left column) ── */}
        <div className="lg:col-span-1">
          {monthlyError ? (
            <div className={`${CARD} flex flex-col items-center gap-3 py-10 text-center`}>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {tx("Couldn't load monthly expenses", 'تعذّر تحميل المصاريف الشهرية')}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {tx('Check your connection and try again.', 'تحقّق من الاتصال وحاول مرة أخرى.')}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => loadMonthly(month)}>
                <RefreshCw className="me-1.5 h-3.5 w-3.5" />
                {tx('Retry', 'إعادة المحاولة')}
              </Button>
            </div>
          ) : monthlyLoading || !monthly ? (
            <SkeletonCard />
          ) : (
            <MonthlyWidget
              data={monthly}
              month={month}
              onStep={stepTo}
              atCurrent={atCurrent}
              tx={tx}
              isRTL={isRTL}
            />
          )}
        </div>

        {/* ── pending queue (right, spans remaining columns) ── */}
        <div className="lg:col-span-1 xl:col-span-2">
          {pendingError ? (
            <div className={`${CARD} flex h-full flex-col items-center justify-center gap-3 py-10 text-center`}>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {tx("Couldn't load pending claims", 'تعذّر تحميل الطلبات المعلّقة')}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {tx('Check your connection and try again.', 'تحقّق من الاتصال وحاول مرة أخرى.')}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={loadPending}>
                <RefreshCw className="me-1.5 h-3.5 w-3.5" />
                {tx('Retry', 'إعادة المحاولة')}
              </Button>
            </div>
          ) : pendingLoading || !pending ? (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : pending.length === 0 ? (
            <div className={`${CARD} flex h-full flex-col items-center justify-center gap-3 py-10 text-center`}>
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
                <CheckCircle2 className="h-6 w-6" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {tx('No pending claims 🎉', 'لا طلبات معلّقة 🎉')}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {tx('Every expense claim has been actioned.', 'تم البتّ في كل مطالبات المصروفات.')}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              {pending.map((claim) => (
                <PendingCard
                  key={claim.name}
                  claim={claim}
                  payout={payoutFor(claim.name)}
                  busy={busyId === claim.name}
                  error={errorById[claim.name] || undefined}
                  onPayout={(m) => setPayoutById((p) => ({ ...p, [claim.name]: m }))}
                  onApprove={() => handleApprove(claim)}
                  onReject={() => handleReject(claim)}
                  tx={tx}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
