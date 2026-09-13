'use client'

// Ported from egarsys src/components/sections/zatca-settings.tsx
// («الفوترة الإلكترونية (ZATCA)»).
//
// Scope of THIS port — a read-only VIEW. egarsys drives this screen off its
// EGS-unit / onboarding tables (the CSR → compliance CSID → production CSID →
// active pipeline) plus a per-invoice ZATCA submission status, and its buttons
// fire REAL government calls (onboard / activate production CSID / retry submit).
//
// The Frappe mirror was NEVER onboarded to ZATCA: there is no EGS-unit or
// certificate data here, and NO production connection exists until the final
// cutover. So this section:
//   • renders egarsys's LAYOUT + labels 1:1 (header · intro · the seller-profile
//     onboarding card with its STATUS_META pipeline badges);
//   • reads the ONE piece of ZATCA state that does exist — `zatca_status` /
//     `zatca_icv` / `zatca_uuid` on the `Rental Invoice` mirror rows — via the
//     READ-ONLY lib/rentals/zatca-data adapter, and shows it as a status summary;
//   • GATES every action. onboard / generate CSR / submit compliance / get
//     production CSID / submit-or-retry invoice → all route to the
//     «يُفعّل عند التحويل النهائي» toast (matching every other ported section).
// It imports NO ZATCA library and makes NO onboarding/submission/government call.

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import {
  ShieldCheck, Plus, BadgeCheck, AlertTriangle, Loader2, RefreshCw, Lock, CheckCircle2,
} from 'lucide-react'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Skeleton } from './ui/skeleton'
import { CompanyHeaderLogo } from './ui/company-header-logo'
import { useRentalsShell } from './store'
import { formatDate } from './format'
import { getZatcaStatusSummary, type ZatcaStatusSummary } from '@/lib/rentals/zatca-data'

// ── egarsys onboarding-pipeline labels (1:1 from zatca-settings.tsx STATUS_META,
//    + dark: variants for the ported shell's scoped dark mode) ──
const STATUS_META: Record<string, { label: string; cls: string }> = {
  not_started: { label: 'لم يبدأ', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  csr_generated: { label: 'تم إنشاء CSR', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  compliance_csid: { label: 'شهادة الامتثال', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  production_csid: { label: 'شهادة الإنتاج', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  active: { label: 'نشط', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  failed: { label: 'فشل', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
}

// The onboarding pipeline, in order — rendered as a disabled stepper on the
// gated card so the labels egarsys shows still appear 1:1.
const PIPELINE: { key: string; label: string }[] = [
  { key: 'csr_generated', label: 'إنشاء CSR' },
  { key: 'compliance_csid', label: 'شهادة الامتثال' },
  { key: 'production_csid', label: 'شهادة الإنتاج' },
  { key: 'active', label: 'تفعيل الإرسال' },
]

// ── invoice ZATCA-status summary cards (semantics match the invoice detail
//    badge in invoices.tsx: cleared/reported = accepted; failed = rejected) ──
type Tone = 'neutral' | 'emerald' | 'sky' | 'amber' | 'red'

const TONE_CLS: Record<Tone, { value: string; ring: string }> = {
  neutral: { value: 'text-slate-700 dark:text-slate-200', ring: 'border-slate-200 dark:border-slate-800' },
  emerald: { value: 'text-emerald-700 dark:text-emerald-400', ring: 'border-emerald-200 dark:border-emerald-900/50' },
  sky: { value: 'text-sky-700 dark:text-sky-400', ring: 'border-sky-200 dark:border-sky-900/50' },
  amber: { value: 'text-amber-700 dark:text-amber-400', ring: 'border-amber-200 dark:border-amber-900/50' },
  red: { value: 'text-red-700 dark:text-red-400', ring: 'border-red-200 dark:border-red-900/50' },
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  const c = TONE_CLS[tone]
  return (
    <Card className={`py-0 ${c.ring}`}>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className={`text-2xl font-bold tabular-nums ${c.value}`}>{value.toLocaleString('ar-SA')}</p>
      </CardContent>
    </Card>
  )
}

export default function ZatcaSection() {
  const { companyName } = useRentalsShell()
  const [summary, setSummary] = useState<ZatcaStatusSummary | null>(null)
  const [loading, setLoading] = useState(true)

  // Every onboarding/submission ACTION is locked until the final ZATCA cutover.
  // No button here ever reaches a ZATCA endpoint — they all land on this toast,
  // exactly like the gated flows in the other ported sections.
  const comingSoon = useCallback(() => {
    toast('يُفعّل عند التحويل النهائي')
  }, [])

  useEffect(() => {
    let cancelled = false
    getZatcaStatusSummary()
      .then((s) => { if (!cancelled) setSummary(s) })
      .catch((e: unknown) => {
        if (!cancelled) toast.error((e as { message?: string })?.message || 'تعذّر تحميل حالة الفوترة الإلكترونية')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const notStarted = STATUS_META.not_started

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      {/* Header — 1:1 with egarsys (add-profile CTA gated). */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CompanyHeaderLogo />
          <ShieldCheck className="h-6 w-6 text-emerald-600" />
          الفوترة الإلكترونية (ZATCA)
        </h1>
        <Button onClick={comingSoon} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="h-4 w-4" /> إضافة ملف فوترة
        </Button>
      </div>

      <p className="text-sm text-muted-foreground max-w-2xl">
        أنشئ ملف الفوترة الإلكترونية (هوية البائع) ثم اضغط «تسجيل لدى ZATCA» للحصول على شهادة الامتثال.
        بعد ذلك تُوقَّع الفواتير وتُرسَل تلقائياً إلى الهيئة عند إصدارها (مع إمكانية الإرسال اليدوي من تفاصيل الفاتورة).
      </p>

      {/* Cutover gate banner — the connection is not live in this environment. */}
      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-300">
        <Lock className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          الاتصال بهيئة الزكاة والضريبة والجمارك غير مُفعَّل في هذه البيئة. التسجيل وإرسال الفواتير
          <span className="font-semibold"> يُفعّلان عند التحويل النهائي</span>. العرض أدناه للاطلاع فقط.
        </span>
      </div>

      {/* ── Invoice ZATCA status summary (read from the Rental Invoice mirror) ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">حالة الفواتير لدى الهيئة</h2>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : !summary || summary.total === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">لا توجد فواتير بعد.</CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <MetricCard label="إجمالي الفواتير" value={summary.total} tone="neutral" />
              <MetricCard label="مقبولة (مصادقة)" value={summary.cleared} tone="emerald" />
              <MetricCard label="مقبولة (إبلاغ)" value={summary.reported} tone="sky" />
              <MetricCard label="بانتظار الإرسال" value={summary.pending} tone="amber" />
              <MetricCard label="مرفوضة" value={summary.failed} tone="red" />
            </div>
            <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>فواتير موقّعة (ICV): {summary.withIcv.toLocaleString('ar-SA')}</span>
              <span>لها معرّف ZATCA (UUID): {summary.withUuid.toLocaleString('ar-SA')}</span>
              {summary.lastSubmittedAt && <span>آخر إرسال: {formatDate(summary.lastSubmittedAt)}</span>}
            </div>
          </>
        )}
      </section>

      {/* ── Seller profile / onboarding (1:1 card chrome, honest gated state) ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">ملف الفوترة الإلكترونية (هوية البائع)</h2>
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="space-y-1">
                <div className="font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  {companyName || 'منشأة الفوترة'}
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${notStarted.cls}`}>{notStarted.label}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">غير مُهيّأ</span>
                </div>
                <div className="text-xs text-muted-foreground font-mono" dir="ltr">VAT — · CRN —</div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="gap-2" onClick={comingSoon}>
                  <ShieldCheck className="h-4 w-4" />
                  تسجيل لدى ZATCA
                </Button>
                <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={comingSoon}>
                  <BadgeCheck className="h-4 w-4" />
                  تفعيل الإنتاج
                </Button>
              </div>
            </div>

            {/* Onboarding pipeline — labels shown 1:1, every step disabled/locked. */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {PIPELINE.map((step, i) => (
                <div key={step.key} className="flex items-center gap-2">
                  {i > 0 && <span className="text-muted-foreground/50 text-xs">←</span>}
                  <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <Lock className="h-3 w-3" />
                    {step.label}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              خطوات التسجيل (CSR ← شهادة الامتثال ← شهادة الإنتاج) معطّلة — تُفعّل عند التحويل النهائي.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Retry-to-ZATCA affordance for rejected invoices — kept, gated. */}
      {!loading && summary && summary.failed > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap rounded-md border border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/20 p-3">
          <span className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {summary.failed.toLocaleString('ar-SA')} فاتورة مرفوضة من الهيئة
          </span>
          <Button size="sm" variant="outline" className="gap-2" onClick={comingSoon}>
            <RefreshCw className="h-4 w-4" />
            إعادة إرسال المرفوضة
          </Button>
        </div>
      )}

      {!loading && summary && summary.failed === 0 && summary.total > 0 && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" />
          لا توجد فواتير مرفوضة.
        </p>
      )}
    </div>
  )
}
