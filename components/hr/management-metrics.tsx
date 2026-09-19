'use client'

/**
 * ManagementMetrics — the "Management Metrics / مؤشرات الإدارة" section of the
 * HR dashboard, a decision-support sibling of DashboardIntelligence and
 * WorkforceAnalytics. One backend call powers six management-grade cards:
 *
 *   1. EWA Exposure          — unsettled راتبي المرن advances, by branch
 *   2. Document Expiry Radar  — iqama/passport/… expiries 30/60/90 (R/A/G)
 *   3. Payroll Readiness      — "can we run payroll yet?" score + blockers
 *   4. Actions Due            — probation ending + contracts expiring
 *   5. EOSB & Leave Liability — end-of-service + unused leave on the books
 *   6. Absence & Lateness Cost — SAR lost this month + month-over-month trend
 *
 * Token-only, logical-RTL, motion via the .theme-hr layer (hr-lift / hr-stagger
 * / hr-fade-up). Self-contained: fetch on mount, shimmer while loading, retry on
 * error. Mirrors dashboard-intelligence.tsx conventions exactly.
 */

import * as React from 'react'
import { useEffect, useState } from 'react'
import {
  Wallet,
  ShieldAlert,
  Gauge,
  CalendarClock,
  Landmark,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  FileClock,
  GraduationCap,
  FileSignature,
  Clock,
  PartyPopper,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared'
import { useI18n } from '@/lib/i18n'
import { formatCurrency, type AppLocale } from '@/lib/format'
import {
  fetchHrManagementMetrics,
  type HrManagementMetrics,
  type BlockerTone,
} from '@/lib/hr-intelligence-api'
import type { ComplianceGrade } from '@/lib/hr-intelligence-api'

/* ─────────────────────────── helpers ─────────────────────────── */

const CARD = 'hr-lift rounded-xl border border-border bg-card text-card-foreground shadow-card p-5'

function pct(n: number, d: number): number {
  if (!d) return 0
  return Math.max(0, Math.min(100, Math.round((n / d) * 100)))
}

/** Pull HH:MM out of a time or datetime string, defensively. */
function hhmm(t: string): string {
  const m = String(t || '').match(/(\d{1,2}):(\d{2})/)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '--:--'
}

/** Compact SAR — full precision would overflow the hero row on big numbers. */
function sar(n: number, locale: AppLocale): string {
  return formatCurrency(Math.round(n || 0), { locale })
}

type CardProps = {
  data: HrManagementMetrics
  tx: (en: string, ar: string) => string
  locale: AppLocale
}

/* Compliance/readiness grade → design token + bilingual label */
const GRADE_META: Record<ComplianceGrade, { varName: string; en: string; ar: string }> = {
  excellent: { varName: '--success', en: 'Ready', ar: 'جاهز' },
  good: { varName: '--primary', en: 'Nearly ready', ar: 'شبه جاهز' },
  fair: { varName: '--warning', en: 'Needs work', ar: 'يحتاج عملاً' },
  at_risk: { varName: '--destructive', en: 'Blocked', ar: 'متعثّر' },
}

const TONE_CHIP: Record<BlockerTone, string> = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-destructive/10 text-destructive',
}

/* Document type key → bilingual label */
const DOC_LABEL: Record<string, { en: string; ar: string }> = {
  iqama: { en: 'Iqama', ar: 'الإقامة' },
  passport: { en: 'Passport', ar: 'الجواز' },
  health_cert: { en: 'Health cert.', ar: 'الشهادة الصحية' },
  work_permit: { en: 'Work permit', ar: 'رخصة العمل' },
  contract: { en: 'Contract', ar: 'العقد' },
}

function docLabel(t: string, tx: (en: string, ar: string) => string): string {
  const l = DOC_LABEL[t]
  return l ? tx(l.en, l.ar) : t
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
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="truncate text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {meta && <div className="shrink-0">{meta}</div>}
    </div>
  )
}

function EstimateBadge({ tx }: { tx: (en: string, ar: string) => string }) {
  return (
    <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
      {tx('Estimate', 'تقديري')}
    </span>
  )
}

/** Number of days → short bilingual "in N days" / "N days ago" / "today". */
function daysLabel(dl: number, tx: (en: string, ar: string) => string): string {
  if (dl === 0) return tx('today', 'اليوم')
  if (dl < 0) return tx(`${-dl}d ago`, `منذ ${-dl} يوم`)
  return tx(`in ${dl}d`, `خلال ${dl} يوم`)
}

/* ─────────────────────────── 1 · EWA Exposure ─────────────────────────── */

function EwaExposureCard({ data, tx, locale }: CardProps) {
  const e = data.ewa_exposure
  const maxBranch = Math.max(1, ...e.by_branch.map((b) => b.amount))

  return (
    <section className={CARD}>
      <CardHeader
        icon={Wallet}
        iconClass="bg-primary/10 text-primary"
        title={tx('Advance Exposure', 'انكشاف السلف')}
        meta={e.is_estimate ? <EstimateBadge tx={tx} /> : undefined}
      />

      {/* Hero total */}
      <div className="flex items-end gap-1.5">
        <span className="text-2xl font-bold leading-none tabular-nums text-foreground">{sar(e.total, locale)}</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {tx('unsettled across', 'غير مسدّدة لدى')}{' '}
        <span className="font-medium tabular-nums text-foreground/80">{e.employees}</span>{' '}
        {tx('employees', 'موظف')} · <span className="tabular-nums text-foreground/80">{e.requests}</span>{' '}
        {tx('advances', 'سلفة')}
      </p>

      {e.by_branch.length === 0 ? (
        <EmptyState
          icon={PartyPopper}
          title={tx('No outstanding advances 🎉', 'لا سلف قائمة 🎉')}
          description={tx('Every earned-wage advance is settled.', 'كل سلف الأجر المكتسب مسدّدة.')}
          className="py-8 sm:py-10"
        />
      ) : (
        <div className="mt-4 space-y-2.5">
          {e.by_branch.slice(0, 5).map((b, i) => (
            <div key={`${b.branch}-${i}`} className="hr-fade-up">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate text-muted-foreground" title={b.branch}>
                  {b.branch}
                </span>
                <span className="shrink-0 tabular-nums text-foreground/90">{sar(b.amount, locale)}</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct(b.amount, maxBranch)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/* ─────────────────────────── 2 · Document Expiry Radar ─────────────────────────── */

function RadarStat({ n, label, cls }: { n: number; label: string; cls: string }) {
  return (
    <div className={`flex flex-col items-center rounded-lg px-2 py-2.5 ${cls}`}>
      <span className="text-xl font-bold leading-none tabular-nums">{n}</span>
      <span className="mt-1 text-[10px] font-medium">{label}</span>
    </div>
  )
}

function DocumentRadarCard({ data, tx }: CardProps) {
  const d = data.document_radar

  return (
    <section className={CARD}>
      <CardHeader
        icon={ShieldAlert}
        iconClass="bg-warning/10 text-warning"
        title={tx('Document Radar', 'رادار الوثائق')}
        meta={
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
            {d.total}
          </span>
        }
      />

      {/* 30 / 60 / 90 buckets, colour-graded */}
      <div className="grid grid-cols-4 gap-2">
        <RadarStat n={d.expired} label={tx('Expired', 'منتهية')} cls="bg-destructive/15 text-destructive" />
        <RadarStat n={d.d30} label={tx('≤30d', '≤٣٠ي')} cls="bg-destructive/10 text-destructive" />
        <RadarStat n={d.d60} label={tx('≤60d', '≤٦٠ي')} cls="bg-warning/10 text-warning" />
        <RadarStat n={d.d90} label={tx('≤90d', '≤٩٠ي')} cls="bg-success/10 text-success" />
      </div>

      {/* Type chips */}
      {d.by_type.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {d.by_type.map((t) => (
            <span
              key={t.type}
              className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-[11px] text-muted-foreground"
            >
              <span className="text-foreground/80">{docLabel(t.type, tx)}</span>
              <span className="font-semibold tabular-nums text-foreground">{t.count}</span>
            </span>
          ))}
        </div>
      )}

      {/* Most-urgent drill list (PII-safe: no document numbers) */}
      {d.drill.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={tx('All documents valid 🎉', 'كل الوثائق سارية 🎉')}
          description={tx('Nothing expiring in the next 90 days.', 'لا شيء ينتهي خلال ٩٠ يوماً.')}
          className="py-8 sm:py-10"
        />
      ) : (
        <div className="mt-4 space-y-1">
          {d.drill.slice(0, 4).map((r, i) => {
            const overdue = r.days_left < 0
            const critical = r.days_left >= 0 && r.days_left <= 30
            return (
              <div key={`${r.employee_name}-${i}`} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
                <FileClock
                  className={`h-3.5 w-3.5 shrink-0 ${overdue || critical ? 'text-destructive' : 'text-warning'}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">{r.employee_name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{docLabel(r.doc_type, tx)}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${
                    overdue || critical ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'
                  }`}
                >
                  {daysLabel(r.days_left, tx)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

/* ─────────────────────────── 3 · Payroll Readiness ─────────────────────────── */

function PayrollReadinessCard({ data, tx }: CardProps) {
  const r = data.payroll_readiness
  const meta = GRADE_META[r.grade] ?? GRADE_META.fair
  const gradeColor = `hsl(var(${meta.varName}))`
  const hasScore = typeof r.score === 'number'
  const score = hasScore ? Math.max(0, Math.min(100, r.score as number)) : 0
  const lastRun = r.last_run ? hhmm(r.last_run) : null

  return (
    <section className={CARD}>
      <CardHeader
        icon={Gauge}
        iconClass="bg-primary/10 text-primary"
        title={tx('Payroll Readiness', 'جاهزية الرواتب')}
        meta={
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ backgroundColor: `hsl(var(${meta.varName}) / 0.12)`, color: gradeColor }}
          >
            {r.ready ? <CheckCircle2 className="h-3 w-3" /> : <CircleAlert className="h-3 w-3" />}
            {tx(meta.en, meta.ar)}
          </span>
        }
      />

      {/* Score hero */}
      <div className="flex items-baseline gap-1">
        <span className="text-4xl font-bold leading-none tabular-nums text-foreground">{hasScore ? score : '—'}</span>
        <span className="text-sm font-medium text-muted-foreground">/100</span>
        <span className="ms-auto text-[11px] text-muted-foreground">
          {r.total_blockers}{' '}
          {tx(r.total_blockers === 1 ? 'blocker' : 'blockers', 'معوّق')}
        </span>
      </div>

      {/* Score bar */}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${score}%`, backgroundColor: gradeColor }}
        />
      </div>

      {/* Blocker rows */}
      <div className="mt-4 space-y-2">
        {r.blockers.map((b) => (
          <div key={b.key} className="flex items-center gap-2.5">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${TONE_CHIP[b.tone]}`}>
              {b.count > 0 ? <CircleAlert className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-foreground/90">{tx(b.label_en, b.label_ar)}</span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                b.count > 0 ? TONE_CHIP[b.tone] : 'bg-muted text-muted-foreground'
              }`}
            >
              {b.count}
            </span>
          </div>
        ))}
      </div>

      {/* Auto-attendance last run */}
      <p className="mt-3 flex items-center gap-1.5 border-t border-border pt-2.5 text-[11px] text-muted-foreground">
        <Clock className="h-3 w-3" />
        {lastRun
          ? tx(`Auto-attendance last ran ${lastRun}`, `آخر احتساب آلي للحضور ${lastRun}`)
          : tx('Auto-attendance run time unavailable', 'وقت الاحتساب الآلي غير متاح')}
      </p>
    </section>
  )
}

/* ─────────────────────────── 4 · Actions Due ─────────────────────────── */

function ActionRow({
  name,
  branch,
  dl,
  tx,
}: {
  name: string
  branch: string | null
  dl: number
  tx: (en: string, ar: string) => string
}) {
  const overdue = dl < 0
  const soon = dl >= 0 && dl <= 14
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/60">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-foreground">{name}</p>
        {branch && <p className="truncate text-[11px] text-muted-foreground">{branch}</p>}
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${
          overdue ? 'bg-destructive/10 text-destructive' : soon ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'
        }`}
      >
        {daysLabel(dl, tx)}
      </span>
    </div>
  )
}

function ActionsDueCard({ data, tx }: CardProps) {
  const a = data.actions_due

  return (
    <section className={CARD}>
      <CardHeader
        icon={CalendarClock}
        iconClass="bg-info/10 text-info"
        title={tx('Actions Due', 'قرارات مطلوبة')}
        meta={
          a.total > 0 ? (
            <span className="rounded-full bg-info/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-info">
              {a.total}
            </span>
          ) : undefined
        }
      />

      {a.total === 0 ? (
        <EmptyState
          icon={PartyPopper}
          title={tx('Nothing needs a decision 🎉', 'لا قرارات معلّقة 🎉')}
          description={tx('No probation or contract deadlines soon.', 'لا مواعيد تجربة أو عقود قريبة.')}
          className="py-8 sm:py-10"
        />
      ) : (
        <div className="space-y-4">
          {/* Probation ending this month */}
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <GraduationCap className="h-3.5 w-3.5" />
              {tx('Probation ending', 'انتهاء فترة التجربة')}
              <span className="tabular-nums text-foreground/70">({a.probation_count})</span>
            </p>
            {a.probation_due.length === 0 ? (
              <p className="px-2 text-[12px] text-muted-foreground/70">{tx('None this month.', 'لا شيء هذا الشهر.')}</p>
            ) : (
              <div className="space-y-0.5">
                {a.probation_due.slice(0, 3).map((p, i) => (
                  <ActionRow key={`p-${i}`} name={p.employee_name} branch={p.branch} dl={p.days_left} tx={tx} />
                ))}
              </div>
            )}
          </div>

          {/* Contracts expiring soon */}
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <FileSignature className="h-3.5 w-3.5" />
              {tx('Contracts expiring', 'عقود تنتهي قريباً')}
              <span className="tabular-nums text-foreground/70">({a.contracts_count})</span>
            </p>
            {a.contracts_expiring.length === 0 ? (
              <p className="px-2 text-[12px] text-muted-foreground/70">{tx('None within 60 days.', 'لا شيء خلال ٦٠ يوماً.')}</p>
            ) : (
              <div className="space-y-0.5">
                {a.contracts_expiring.slice(0, 3).map((c, i) => (
                  <ActionRow key={`c-${i}`} name={c.employee_name} branch={c.branch} dl={c.days_left} tx={tx} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

/* ─────────────────────────── 5 · EOSB & Leave Liability ─────────────────────────── */

function LiabilityCard({ data, tx, locale }: CardProps) {
  const l = data.eosb_leave_liability
  const eosbPct = pct(l.eosb_total, l.total)
  const maxBranch = Math.max(1, ...l.by_branch.map((b) => b.total))

  return (
    <section className={CARD}>
      <CardHeader
        icon={Landmark}
        iconClass="bg-primary/10 text-primary"
        title={tx('EOSB & Leave Liability', 'مخصصات نهاية الخدمة والإجازات')}
        meta={l.is_estimate ? <EstimateBadge tx={tx} /> : undefined}
      />

      {/* Hero total */}
      <div className="flex items-end gap-1.5">
        <span className="text-2xl font-bold leading-none tabular-nums text-foreground">{sar(l.total, locale)}</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{tx('if everyone left today', 'إذا غادر الجميع اليوم')}</p>

      {/* EOSB vs leave split bar */}
      {l.total > 0 && (
        <div dir="ltr" className="mt-4">
          <div className="flex h-4 w-full gap-0.5 overflow-hidden rounded-full">
            <div
              className="h-full rounded-s-full bg-primary/80"
              style={{ width: `${eosbPct}%` }}
              title={`EOSB · ${sar(l.eosb_total, 'en')}`}
            />
            <div
              className="h-full rounded-e-full bg-info/70"
              style={{ width: `${100 - eosbPct}%` }}
              title={`Leave · ${sar(l.leave_total, 'en')}`}
            />
          </div>
        </div>
      )}
      <div className="mt-3 flex items-center justify-center gap-4 text-[11px]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary/80" />
          <span className="text-muted-foreground">{tx('End of service', 'نهاية الخدمة')}</span>
          <span className="font-semibold tabular-nums text-foreground">{sar(l.eosb_total, locale)}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-info/70" />
          <span className="text-muted-foreground">{tx('Leave', 'الإجازات')}</span>
          <span className="font-semibold tabular-nums text-foreground">{sar(l.leave_total, locale)}</span>
        </span>
      </div>

      {/* Per-branch bars */}
      {l.by_branch.length > 0 && (
        <div className="mt-4 space-y-2.5 border-t border-border pt-3">
          {l.by_branch.slice(0, 4).map((b, i) => (
            <div key={`${b.branch}-${i}`} className="hr-fade-up">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate text-muted-foreground" title={b.branch}>
                  {b.branch}
                </span>
                <span className="shrink-0 tabular-nums text-foreground/90">{sar(b.total, locale)}</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct(b.total, maxBranch)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        {tx('estimate — Art. 84 accrual + unused leave', 'تقديري — استحقاق المادة ٨٤ + رصيد الإجازات')}
      </p>
    </section>
  )
}

/* ─────────────────────────── 6 · Absence & Lateness Cost ─────────────────────────── */

function AbsenceCostCard({ data, tx, locale }: CardProps) {
  const c = data.absence_cost
  const up = (c.delta_pct ?? 0) >= 0
  const maxSeg = Math.max(1, c.absence, c.late, c.early)
  const segs = [
    { key: 'absence', label: tx('Absence', 'الغياب'), val: c.absence, cls: 'bg-destructive/70' },
    { key: 'late', label: tx('Lateness', 'التأخير'), val: c.late, cls: 'bg-warning/70' },
    { key: 'early', label: tx('Early leave', 'الانصراف المبكر'), val: c.early, cls: 'bg-info/70' },
  ]

  return (
    <section className={CARD}>
      <CardHeader
        icon={TrendingDown}
        iconClass="bg-destructive/10 text-destructive"
        title={tx('Absence & Lateness Cost', 'تكلفة الغياب والتأخير')}
        meta={c.is_estimate ? <EstimateBadge tx={tx} /> : undefined}
      />

      {/* Hero total + MoM trend */}
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold leading-none tabular-nums text-foreground">{sar(c.total, locale)}</span>
        {c.delta_pct !== null && (
          <span
            className={`mb-0.5 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
              up ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
            }`}
          >
            {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {up ? '+' : ''}
            {c.delta_pct}%
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {tx('this month', 'هذا الشهر')} ·{' '}
        <span className="tabular-nums text-foreground/80">{c.absent_days}</span> {tx('absent days', 'يوم غياب')}
        {c.delta_pct !== null && (
          <>
            {' · '}
            {tx('was', 'كانت')} <span className="tabular-nums text-foreground/80">{sar(c.prev_total, locale)}</span>
          </>
        )}
      </p>

      {/* Breakdown segments */}
      <div className="mt-4 space-y-2.5">
        {segs.map((s) => (
          <div key={s.key} className="hr-fade-up">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-muted-foreground">{s.label}</span>
              <span className="shrink-0 tabular-nums text-foreground/90">{sar(s.val, locale)}</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full ${s.cls}`} style={{ width: `${pct(s.val, maxSeg)}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Per-branch worst offenders */}
      {c.by_branch.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {tx('By branch', 'حسب الفرع')}
          </p>
          <div className="space-y-1.5">
            {c.by_branch.slice(0, 3).map((b, i) => (
              <div key={`${b.branch}-${i}`} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate text-muted-foreground" title={b.branch}>
                  {b.branch}
                </span>
                <span className="shrink-0 tabular-nums text-foreground/90">{sar(b.total, locale)}</span>
              </div>
            ))}
          </div>
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
        <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
      </div>
    </div>
  )
}

/* ─────────────────────────── main export ─────────────────────────── */

export default function ManagementMetrics() {
  const { isRTL } = useI18n()
  const tx = (en: string, ar: string) => (isRTL ? ar : en)
  const locale: AppLocale = isRTL ? 'ar' : 'en'

  const [data, setData] = useState<HrManagementMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = React.useCallback((signal?: AbortSignal) => {
    setLoading(true)
    setError(false)
    fetchHrManagementMetrics(signal)
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
      {/* Section header */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">
            {tx('Management Metrics', 'مؤشرات الإدارة')}
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
              {tx("Couldn't load management metrics", 'تعذّر تحميل مؤشرات الإدارة')}
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
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="hr-stagger grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          <EwaExposureCard data={data} tx={tx} locale={locale} />
          <DocumentRadarCard data={data} tx={tx} locale={locale} />
          <PayrollReadinessCard data={data} tx={tx} locale={locale} />
          <ActionsDueCard data={data} tx={tx} locale={locale} />
          <LiabilityCard data={data} tx={tx} locale={locale} />
          <AbsenceCostCard data={data} tx={tx} locale={locale} />
        </div>
      )}
    </div>
  )
}
