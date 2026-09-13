'use client'

/**
 * PayrollAudit — the "Payroll Pre-flight Audit / تدقيق الرواتب قبل الصرف" section:
 * a forensic scan that surfaces what must be cleared BEFORE running payroll —
 * duplicate IBANs / national IDs (fraud/ghost), employees with no salary
 * structure or missing IBAN (un-payable), zero-base, and suspicious salary
 * spikes. One backend call; read-only; severity-ranked.
 *
 * Mirrors the other HR dashboard sections (token-only, logical-RTL, .theme-hr,
 * skeleton + retry, Arabic-first).
 */

import * as React from 'react'
import { useEffect, useState } from 'react'
import {
  ShieldAlert,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  OctagonAlert,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import {
  fetchPayrollAudit,
  type PayrollAudit,
  type AuditFinding,
  type AuditSeverity,
} from '@/lib/hr-intelligence-api'

const CARD = 'hr-lift rounded-xl border border-border bg-card text-card-foreground shadow-card p-5'

function hhmm(t: string): string {
  const m = String(t || '').match(/(\d{1,2}):(\d{2})/)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '--:--'
}

const SEV_META: Record<AuditSeverity, { varName: string; en: string; ar: string; icon: React.ComponentType<{ className?: string }> }> = {
  high: { varName: '--destructive', en: 'Critical', ar: 'حرِج', icon: OctagonAlert },
  medium: { varName: '--warning', en: 'Warning', ar: 'تحذير', icon: CircleAlert },
  low: { varName: '--info', en: 'Notice', ar: 'ملاحظة', icon: CircleAlert },
}

type TX = (en: string, ar: string) => string

/* ─────────────────────────── verdict card ─────────────────────────── */

function VerdictCard({ data, tx }: { data: PayrollAudit; tx: TX }) {
  const gradeColor =
    data.grade === 'excellent'
      ? 'hsl(var(--success))'
      : data.grade === 'good'
        ? 'hsl(var(--primary))'
        : data.grade === 'fair'
          ? 'hsl(var(--warning))'
          : 'hsl(var(--destructive))'

  return (
    <section className={CARD}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldAlert className="h-4 w-4" />
          </span>
          <h3 className="truncate text-sm font-semibold text-foreground">{tx('Pay-run verdict', 'حكم تشغيل الرواتب')}</h3>
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: `${gradeColor.replace(')', ' / 0.12)').replace('hsl(', 'hsl(')}`, color: gradeColor }}
        >
          {data.ready ? <CheckCircle2 className="h-3 w-3" /> : <CircleAlert className="h-3 w-3" />}
          {data.ready ? tx('Clear to run', 'جاهز للصرف') : tx('Hold', 'أوقِف')}
        </span>
      </div>

      <div className="flex items-baseline gap-1">
        <span className="text-4xl font-bold leading-none tabular-nums text-foreground">{data.score}</span>
        <span className="text-sm font-medium text-muted-foreground">/100</span>
        <span className="ms-auto text-[11px] tabular-nums text-muted-foreground">
          {data.total_flags} {tx('flags', 'ملاحظة')}
        </span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${data.score}%`, backgroundColor: gradeColor }}
        />
      </div>

      {/* Severity summary */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {(['high', 'medium', 'low'] as AuditSeverity[]).map((sev) => {
          const meta = SEV_META[sev]
          const n = data.severity[sev]
          return (
            <div
              key={sev}
              className="flex flex-col items-center rounded-lg py-2.5"
              style={{ backgroundColor: `hsl(var(${meta.varName}) / ${n > 0 ? 0.12 : 0.06})`, color: `hsl(var(${meta.varName}))` }}
            >
              <span className="text-xl font-bold leading-none tabular-nums">{n}</span>
              <span className="mt-1 text-[10px] font-medium">{tx(meta.en, meta.ar)}</span>
            </div>
          )
        })}
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Users className="h-3 w-3" />
        {tx('Scanned', 'تم فحص')} <span className="tabular-nums text-foreground/70">{data.active_count}</span>{' '}
        {tx('active employees', 'موظف نشط')}
      </p>
    </section>
  )
}

/* ─────────────────────────── finding card ─────────────────────────── */

function FindingCard({ f, tx }: { f: AuditFinding; tx: TX }) {
  const meta = SEV_META[f.severity] ?? SEV_META.low
  const color = `hsl(var(${meta.varName}))`
  const Icon = meta.icon

  return (
    <section className={CARD}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `hsl(var(${meta.varName}) / 0.12)`, color }}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">{tx(f.title_en, f.title_ar)}</h3>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{tx(f.detail_en, f.detail_ar)}</p>
          </div>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums"
          style={{ backgroundColor: `hsl(var(${meta.varName}) / 0.12)`, color }}
        >
          {f.count}
        </span>
      </div>

      {f.samples.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {f.samples.map((s, i) => (
            <span
              key={`${s.employee_name}-${i}`}
              className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-[11px] text-muted-foreground"
            >
              <span className="text-foreground/80">{s.employee_name}</span>
              {s.value != null && s.value !== '' && (
                <span className="font-semibold tabular-nums" style={{ color }}>
                  {String(s.value)}
                </span>
              )}
            </span>
          ))}
          {f.count > f.samples.length && (
            <span className="inline-flex items-center rounded-md px-2 py-1 text-[11px] text-muted-foreground">
              +{f.count - f.samples.length} {tx('more', 'آخر')}
            </span>
          )}
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
      </div>
    </div>
  )
}

/* ─────────────────────────── main export ─────────────────────────── */

export default function PayrollAuditSection() {
  const { isRTL } = useI18n()
  const tx: TX = (en, ar) => (isRTL ? ar : en)

  const [data, setData] = useState<PayrollAudit | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = React.useCallback((signal?: AbortSignal) => {
    setLoading(true)
    setError(false)
    fetchPayrollAudit(signal)
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
          <ShieldAlert className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">
            {tx('Payroll Pre-flight Audit', 'تدقيق الرواتب قبل الصرف')}
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
              {tx("Couldn't load the payroll audit", 'تعذّر تحميل تدقيق الرواتب')}
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
      ) : data.clean ? (
        <div className={`${CARD} flex flex-col items-center gap-3 py-10 text-center`}>
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">{tx('Payroll is clean to run 🎉', 'الرواتب جاهزة للصرف 🎉')}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {tx('No fraud, gaps, or anomalies found across ', 'لا احتيال ولا نواقص ولا شذوذ عبر ')}
              <span className="tabular-nums">{data.active_count}</span> {tx('employees.', 'موظف.')}
            </p>
          </div>
        </div>
      ) : (
        <div className="hr-stagger grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          <VerdictCard data={data} tx={tx} />
          {data.findings.map((f) => (
            <FindingCard key={f.key} f={f} tx={tx} />
          ))}
        </div>
      )}
    </div>
  )
}
