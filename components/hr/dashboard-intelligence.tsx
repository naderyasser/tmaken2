'use client'

/**
 * DashboardIntelligence — the "HR Intelligence / رؤى الموارد البشرية" section
 * of the HR dashboard. One backend call powers five polished cards:
 *
 *   1. Live Presence board     — present/total, live pulse, per-branch, recent check-ins
 *   2. Attendance Pulse (14d)   — heatmap row + week average + inline SVG sparkline
 *   3. At-Risk employees        — ranked follow-up list with level pills
 *   4. Compliance dial          — hand-rolled SVG radial gauge (the hero)
 *   5. Smart Insights feed       — AI-flavoured tone-tinted bullets
 *
 * Token-only, logical-RTL, motion via the .theme-hr layer (hr-lift / hr-stagger).
 * Self-contained: fetch on mount, shimmer while loading, retry on error.
 */

import * as React from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Trophy,
  AlertTriangle,
  UserX,
  ShieldCheck,
  Radio,
  HeartPulse,
  Sparkles,
  Gauge,
  RefreshCw,
  PartyPopper,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared'
import { useI18n } from '@/lib/i18n'
import {
  fetchHrIntelligence,
  type HrIntelligence,
  type ComplianceGrade,
  type InsightIcon,
  type InsightTone,
  type RiskLevel,
} from '@/lib/hr-intelligence-api'

/* ─────────────────────────── helpers ─────────────────────────── */

const CARD = 'hr-lift rounded-xl border border-border bg-card text-card-foreground shadow-card p-5'

function initials(name: string): string {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/** Pull HH:MM out of a time or datetime string, defensively. */
function hhmm(t: string): string {
  const m = String(t || '').match(/(\d{1,2}):(\d{2})/)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '--:--'
}

function pct(n: number, d: number): number {
  if (!d) return 0
  return Math.max(0, Math.min(100, Math.round((n / d) * 100)))
}

/** Continuous token-based heat tint from an attendance rate (0..100). */
function heatTint(rate: number): string {
  const t = Math.max(0, Math.min(100, rate)) / 100
  const varName = rate >= 82 ? '--success' : rate >= 55 ? '--warning' : '--destructive'
  // Map rate → opacity 0.22 .. 1 so higher rates read stronger.
  const op = (0.22 + t * 0.78).toFixed(2)
  return `hsl(var(${varName}) / ${op})`
}

/** Band may arrive as a plain string or as a rich {key,label_en,label_ar} object
 *  (the compliance backend now returns the latter). Coerce to a display string so
 *  it is never rendered as a raw React child. */
function bandText(band: unknown, tx: (en: string, ar: string) => string): string {
  if (!band) return ''
  if (typeof band === 'string') return band
  if (typeof band === 'object') {
    const b = band as { label_en?: string; label_ar?: string; key?: string }
    if (b.label_en || b.label_ar) return tx(b.label_en || b.key || '', b.label_ar || b.key || '')
    return b.key || ''
  }
  return String(band)
}

/* Compliance grade → design token + bilingual label */
const GRADE_META: Record<ComplianceGrade, { varName: string; en: string; ar: string }> = {
  excellent: { varName: '--success', en: 'Excellent', ar: 'ممتاز' },
  good: { varName: '--primary', en: 'Good', ar: 'جيد' },
  fair: { varName: '--warning', en: 'Fair', ar: 'مقبول' },
  at_risk: { varName: '--destructive', en: 'At Risk', ar: 'متعثر' },
}

/* Risk level → pill styling + bilingual label */
const LEVEL_META: Record<RiskLevel, { cls: string; en: string; ar: string }> = {
  high: { cls: 'bg-destructive/10 text-destructive', en: 'High', ar: 'مرتفع' },
  medium: { cls: 'bg-warning/10 text-warning', en: 'Medium', ar: 'متوسط' },
  low: { cls: 'bg-muted text-muted-foreground', en: 'Low', ar: 'منخفض' },
}

/* Insight icon key → lucide component */
const INSIGHT_ICON: Record<InsightIcon, React.ComponentType<{ className?: string }>> = {
  activity: Activity,
  trophy: Trophy,
  alert: AlertTriangle,
  'user-alert': UserX,
  shield: ShieldCheck,
}

/* Insight tone → token bg/text chip */
const TONE_CHIP: Record<InsightTone, string> = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-destructive/10 text-destructive',
  info: 'bg-info/10 text-info',
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
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="truncate text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {meta && <div className="shrink-0">{meta}</div>}
    </div>
  )
}

function Avatar({ name, tone = 'primary' }: { name: string; tone?: 'primary' | 'muted' }) {
  const cls =
    tone === 'primary'
      ? 'bg-gradient-to-br from-primary/85 to-primary text-primary-foreground'
      : 'bg-muted text-muted-foreground'
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold shadow-sm ${cls}`}
    >
      {initials(name)}
    </span>
  )
}

/* ─────────────────────────── 1 · Live Presence ─────────────────────────── */

function LivePresenceCard({ intel, tx }: { intel: HrIntelligence; tx: (en: string, ar: string) => string }) {
  const { present, total, by_branch, recent } = intel.presence
  const rate = pct(present, total)
  return (
    <section className={CARD}>
      <CardHeader
        icon={Radio}
        iconClass="bg-primary/10 text-primary"
        title={tx('Live Presence', 'الحضور المباشر')}
        meta={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            {tx('Live', 'مباشر')}
          </span>
        }
      />

      {/* Big present / total */}
      <div className="flex items-end gap-2">
        <span className="text-4xl font-bold leading-none tabular-nums text-foreground">{present}</span>
        <span className="pb-1 text-lg font-medium tabular-nums text-muted-foreground">/ {total}</span>
        <span className="ms-auto pb-1 text-sm font-semibold tabular-nums text-primary">{rate}%</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{tx('present today', 'حاضرون اليوم')}</p>

      {/* Present % bar */}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
          style={{ width: `${rate}%` }}
        />
      </div>

      {/* Per-branch mini rows */}
      {by_branch.length > 0 && (
        <div className="mt-4 space-y-2.5">
          {by_branch.slice(0, 5).map((b) => {
            const br = pct(b.present, b.total)
            return (
              <div key={b.branch} className="flex items-center gap-3">
                <span className="w-24 shrink-0 truncate text-xs text-muted-foreground" title={b.branch}>
                  {b.branch}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary/70" style={{ width: `${br}%` }} />
                </div>
                <span className="w-12 shrink-0 text-end text-[11px] font-medium tabular-nums text-foreground">
                  {b.present}/{b.total}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Recent check-ins strip */}
      {recent.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {tx('Recent check-ins', 'آخر التسجيلات')}
          </p>
          <div className="space-y-2">
            {recent.slice(0, 4).map((r, i) => (
              <div key={`${r.employee_name}-${i}`} className="flex items-center gap-2.5">
                <Avatar name={r.employee_name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">{r.employee_name}</p>
                  {r.branch && <p className="truncate text-[11px] text-muted-foreground">{r.branch}</p>}
                </div>
                <span className="shrink-0 rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-foreground">
                  {hhmm(r.time)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

/* ─────────────────────────── 2 · Attendance Pulse ─────────────────────────── */

function Sparkline({ rates }: { rates: number[] }) {
  const W = 100
  const H = 30
  const pad = 3
  const pts = useMemo(() => {
    if (rates.length < 2) return { line: '', area: '' }
    const step = W / (rates.length - 1)
    const coords = rates.map((r, i) => {
      const x = i * step
      const y = pad + (1 - Math.max(0, Math.min(100, r)) / 100) * (H - pad * 2)
      return [x, y] as const
    })
    const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
    const area = `${line} L${W},${H} L0,${H} Z`
    return { line, area }
  }, [rates])

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-8 w-full" aria-hidden>
      <defs>
        <linearGradient id="pulseFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.22" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={pts.area} fill="url(#pulseFill)" />
      <path
        d={pts.line}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function AttendancePulseCard({ intel, tx }: { intel: HrIntelligence; tx: (en: string, ar: string) => string }) {
  const trend = intel.attendance_trend
  const avg = useMemo(() => {
    if (!trend.length) return 0
    return Math.round(trend.reduce((s, d) => s + (d.rate || 0), 0) / trend.length)
  }, [trend])
  const rates = trend.map((d) => d.rate || 0)

  return (
    <section className={CARD}>
      <CardHeader
        icon={HeartPulse}
        iconClass="bg-info/10 text-info"
        title={tx('Attendance Pulse', 'نبض الحضور')}
        meta={<span className="text-[11px] font-medium text-muted-foreground">{tx('14 days', '١٤ يوم')}</span>}
      />

      {/* Week average */}
      <div className="flex items-end gap-2">
        <span className="text-4xl font-bold leading-none tabular-nums text-foreground">{avg}</span>
        <span className="pb-1 text-lg font-medium text-muted-foreground">%</span>
        <span className="ms-auto pb-1 text-xs text-muted-foreground">{tx('avg attendance', 'متوسط الحضور')}</span>
      </div>

      {/* Heatmap + sparkline share one LTR (chronological) axis */}
      <div dir="ltr" className="mt-4">
        <div className="flex gap-1">
          {trend.map((d, i) => (
            <div
              key={`${d.date}-${i}`}
              className="group relative h-7 flex-1 rounded-[5px] ring-1 ring-inset ring-border/40 transition-transform hover:scale-[1.12]"
              style={{ backgroundColor: heatTint(d.rate) }}
              title={`${d.date} · ${Math.round(d.rate)}%`}
            />
          ))}
        </div>

        <div className="mt-3">
          <Sparkline rates={rates} />
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center justify-end gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: heatTint(40) }} />
          {tx('Low', 'منخفض')}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: heatTint(70) }} />
          {tx('Fair', 'متوسط')}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: heatTint(95) }} />
          {tx('High', 'مرتفع')}
        </span>
      </div>
    </section>
  )
}

/* ─────────────────────────── 4 · Compliance Dial (hero) ─────────────────────────── */

function ComplianceDialCard({ intel, tx }: { intel: HrIntelligence; tx: (en: string, ar: string) => string }) {
  const c = intel.compliance_score
  const meta = GRADE_META[c.grade] ?? GRADE_META.fair
  const gradeColor = `hsl(var(${meta.varName}))`

  // Geometry
  const size = 148
  const cx = size / 2
  const r = 60
  const circ = 2 * Math.PI * r
  const hasScore = typeof c.score === 'number'
  const score = hasScore ? Math.max(0, Math.min(100, c.score as number)) : 0
  const offset = circ * (1 - score / 100)

  return (
    <section className={CARD}>
      <CardHeader
        icon={Gauge}
        iconClass="bg-primary/10 text-primary"
        title={tx('Compliance', 'مؤشر الالتزام')}
        meta={
          c.is_estimate ? (
            <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
              {tx('Estimate', 'تقديري')}
            </span>
          ) : undefined
        }
      />

      {/* Gauge */}
      <div className="relative mx-auto" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <defs>
            <linearGradient id="compGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={gradeColor} stopOpacity="0.55" />
              <stop offset="100%" stopColor={gradeColor} stopOpacity="1" />
            </linearGradient>
          </defs>
          {/* track */}
          <circle cx={cx} cy={cx} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={12} />
          {/* progress */}
          {hasScore && (
            <circle
              cx={cx}
              cy={cx}
              r={r}
              fill="none"
              stroke="url(#compGrad)"
              strokeWidth={12}
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.16,1,0.3,1)' }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {hasScore ? (
            <>
              <div className="flex items-baseline gap-0.5">
                <span className="text-4xl font-bold leading-none tabular-nums text-foreground">{score}</span>
                <span className="text-sm font-medium text-muted-foreground">/100</span>
              </div>
              <span className="mt-1 text-xs font-bold" style={{ color: gradeColor }}>
                {tx(meta.en, meta.ar)}
              </span>
              {bandText(c.band, tx) && (
                <span className="mt-0.5 text-[10px] text-muted-foreground">{bandText(c.band, tx)}</span>
              )}
            </>
          ) : (
            <>
              <span className="text-3xl font-bold leading-none text-muted-foreground">—</span>
              <span className="mt-1.5 max-w-[7rem] text-center text-[11px] text-muted-foreground">
                {tx('Not enough data', 'لا توجد بيانات كافية')}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Factor chips */}
      {c.factors.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {c.factors.map((f) => (
            <span
              key={f.key}
              className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-[11px] text-muted-foreground"
            >
              <span className="text-foreground/80">{tx(f.label_en, f.label_ar)}</span>
              <span className={`font-semibold tabular-nums ${f.penalty > 0 ? 'text-destructive' : 'text-foreground'}`}>
                {f.value}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Disclaimer */}
      {(c.disclaimer_en || c.disclaimer_ar) && (
        <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
          {tx(c.disclaimer_en, c.disclaimer_ar)}
        </p>
      )}
    </section>
  )
}

/* ─────────────────────────── 3 · At-Risk ─────────────────────────── */

function AtRiskCard({ intel, tx }: { intel: HrIntelligence; tx: (en: string, ar: string) => string }) {
  const rows = intel.at_risk
  return (
    <section className={CARD}>
      <CardHeader
        icon={UserX}
        iconClass="bg-destructive/10 text-destructive"
        title={tx('Needs Follow-up', 'بحاجة متابعة')}
        meta={
          rows.length > 0 ? (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-destructive">
              {rows.length}
            </span>
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={PartyPopper}
          title={tx('No one at risk 🎉', 'لا أحد بحاجة متابعة 🎉')}
          description={tx('Attendance is healthy across the team.', 'الحضور منتظم لدى الفريق.')}
          className="py-8 sm:py-10"
        />
      ) : (
        <div className="space-y-1">
          {rows.slice(0, 6).map((e) => {
            const lvl = LEVEL_META[e.level] ?? LEVEL_META.low
            return (
              <div
                key={e.employee}
                className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent/60"
              >
                <Avatar name={e.employee_name} tone="muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-foreground">{e.employee_name}</p>
                  <p className="truncate text-[11px] tabular-nums text-muted-foreground">
                    {e.absent} {tx('absent', 'غياب')} · {e.late} {tx('late', 'تأخير')}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${lvl.cls}`}>
                  {tx(lvl.en, lvl.ar)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

/* ─────────────────────────── 5 · Smart Insights ─────────────────────────── */

function InsightsCard({ intel, tx }: { intel: HrIntelligence; tx: (en: string, ar: string) => string }) {
  const rows = intel.insights
  return (
    <section className={CARD}>
      <CardHeader
        icon={Sparkles}
        iconClass="bg-primary/10 text-primary"
        title={tx('Smart Insights', 'رؤى ذكية')}
        meta={
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-primary/15 to-info/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
            <Sparkles className="h-3 w-3" />
            AI
          </span>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title={tx('No insights yet', 'لا توجد رؤى بعد')}
          description={tx('Insights appear as attendance data builds up.', 'تظهر الرؤى مع تراكم بيانات الحضور.')}
          className="py-8 sm:py-10"
        />
      ) : (
        <div className="space-y-2.5">
          {rows.map((ins, i) => {
            const Icon = INSIGHT_ICON[ins.icon] ?? Activity
            const chip = TONE_CHIP[ins.tone] ?? TONE_CHIP.info
            return (
              <div key={i} className="hr-fade-up flex items-start gap-3">
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${chip}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <p className="text-[13px] leading-relaxed text-foreground/90">{tx(ins.text_en, ins.text_ar)}</p>
              </div>
            )
          })}
          <p className="flex items-center gap-1.5 border-t border-border pt-2.5 text-[11px] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            {tx('Ask Copilot to dig deeper into any signal.', 'اطلب من كوبايلوت تحليلاً أعمق لأي مؤشر.')}
          </p>
        </div>
      )}
    </section>
  )
}

/* ─────────────────────────── skeleton + error ─────────────────────────── */

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

export default function DashboardIntelligence() {
  const { isRTL } = useI18n()
  const tx = (en: string, ar: string) => (isRTL ? ar : en)

  const [intel, setIntel] = useState<HrIntelligence | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = React.useCallback((signal?: AbortSignal) => {
    setLoading(true)
    setError(false)
    fetchHrIntelligence(signal)
      .then((data) => {
        if (signal?.aborted) return
        setIntel(data)
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

  const updatedAt = intel?.generated_at ? hhmm(intel.generated_at) : null

  return (
    <div className="mb-8">
      {/* Section header */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">
            {tx('HR Intelligence', 'رؤى الموارد البشرية')}
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
              {tx("Couldn't load HR intelligence", 'تعذّر تحميل رؤى الموارد البشرية')}
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
      ) : loading || !intel ? (
        <div className="hr-stagger grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="hr-stagger grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          <LivePresenceCard intel={intel} tx={tx} />
          <AttendancePulseCard intel={intel} tx={tx} />
          <ComplianceDialCard intel={intel} tx={tx} />
          <AtRiskCard intel={intel} tx={tx} />
          <InsightsCard intel={intel} tx={tx} />
        </div>
      )}
    </div>
  )
}
