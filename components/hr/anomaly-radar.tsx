'use client'

/**
 * AnomalyRadar — the "كشف الشذوذ / Anomaly Radar" section: attendance & payroll
 * integrity flags a Saudi employer can act on — duplicate/buddy punches,
 * attendance marked present with no biometric evidence, and pay edits slipped in
 * near the payroll cutoff. Read-only, branch-scoped, severity-ranked.
 *
 * Mirrors the other HR dashboard sections (token-only, logical-RTL, .theme-hr,
 * skeleton + retry, Arabic-first).
 */

import * as React from 'react'
import { useEffect, useState } from 'react'
import {
  Radar,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Copy,
  Users,
  Fingerprint,
  PenLine,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import {
  fetchAnomalyRadar,
  type AnomalyRadar,
  type Anomaly,
  type AnomalyType,
  type AnomalySeverity,
} from '@/lib/hr-intelligence-api'

const CARD = 'hr-lift rounded-xl border border-border bg-card text-card-foreground shadow-card p-5'

function hhmm(t: string): string {
  const m = String(t || '').match(/(\d{1,2}):(\d{2})/)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '--:--'
}

type TX = (en: string, ar: string) => string

const SEV_META: Record<AnomalySeverity, { varName: string; en: string; ar: string }> = {
  high: { varName: '--destructive', en: 'High', ar: 'حرِج' },
  medium: { varName: '--warning', en: 'Medium', ar: 'متوسط' },
}

const TYPE_META: Record<AnomalyType, { en: string; ar: string; icon: React.ComponentType<{ className?: string }> }> = {
  duplicate_punch: { en: 'Duplicate punch', ar: 'بصمة مكررة', icon: Copy },
  buddy_punch: { en: 'Buddy punch', ar: 'بصمة بالنيابة', icon: Users },
  present_no_punch: { en: 'Present, no biometric', ar: 'حضور بلا بصمة', icon: Fingerprint },
  late_pay_edit: { en: 'Last-minute pay edit', ar: 'تعديل راتب متأخر', icon: PenLine },
}

/* ─────────────────────────── anomaly row ─────────────────────────── */

function AnomalyCard({ a, tx }: { a: Anomaly; tx: TX }) {
  const sev = SEV_META[a.severity] ?? SEV_META.medium
  const color = `hsl(var(${sev.varName}))`
  const tm = TYPE_META[a.type]
  const Icon = tm?.icon ?? AlertTriangle

  return (
    <section className={CARD}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `hsl(var(${sev.varName}) / 0.12)`, color }}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">{a.employee_name}</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {tx(tm?.en ?? a.type, tm?.ar ?? a.type)} · {a.branch}
            </p>
          </div>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums"
          style={{ backgroundColor: `hsl(var(${sev.varName}) / 0.12)`, color }}
        >
          {tx(sev.en, sev.ar)}
        </span>
      </div>

      <p className="text-[12px] leading-relaxed text-foreground/85">{a.detail_ar}</p>
      <p className="mt-1.5 text-[11px] tabular-nums text-muted-foreground">{a.date}</p>
    </section>
  )
}

/* ─────────────────────────── summary card ─────────────────────────── */

function SummaryCard({ data, tx }: { data: AnomalyRadar; tx: TX }) {
  return (
    <section className={CARD}>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Radar className="h-4 w-4" />
        </span>
        <h3 className="truncate text-sm font-semibold text-foreground">{tx('Integrity scan', 'فحص النزاهة')}</h3>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(['high', 'medium'] as AnomalySeverity[]).map((sev) => {
          const meta = SEV_META[sev]
          const n = data.by_severity[sev]
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

      <p className="mt-3 text-[11px] text-muted-foreground">
        {tx('Last 30 days of attendance & payroll activity.', 'آخر ٣٠ يوماً من نشاط الحضور والرواتب.')}
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
      <div className="mb-4 h-8 w-20 animate-pulse rounded bg-muted" />
      <div className="space-y-2.5">
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
      </div>
    </div>
  )
}

/* ─────────────────────────── main export ─────────────────────────── */

export default function AnomalyRadarSection() {
  const { isRTL } = useI18n()
  const tx: TX = (en, ar) => (isRTL ? ar : en)

  const [data, setData] = useState<AnomalyRadar | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = React.useCallback((signal?: AbortSignal) => {
    setLoading(true)
    setError(false)
    fetchAnomalyRadar(signal)
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
          <Radar className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">
            {tx('Anomaly Radar', 'كشف الشذوذ')}
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
              {tx("Couldn't load the anomaly radar", 'تعذّر تحميل كشف الشذوذ')}
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
      ) : data.anomalies.length === 0 ? (
        <div className="hr-stagger grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          <SummaryCard data={data} tx={tx} />
          <div className={`${CARD} flex flex-col items-center justify-center gap-3 py-10 text-center lg:col-span-1 xl:col-span-2`}>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">{tx('No anomalies detected 🎉', 'لا شذوذ مكتشف 🎉')}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {tx('Attendance and payroll look clean for the last 30 days.', 'الحضور والرواتب سليمة خلال آخر ٣٠ يوماً.')}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="hr-stagger grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          <SummaryCard data={data} tx={tx} />
          {data.anomalies.map((a, i) => (
            <AnomalyCard key={`${a.type}-${a.employee}-${i}`} a={a} tx={tx} />
          ))}
        </div>
      )}
    </div>
  )
}
