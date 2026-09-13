'use client'

import { useState } from 'react'
import { Badge } from './ui/badge'
import { Card, CardContent } from './ui/card'
import {
  Building2, AlertTriangle, Wallet, CheckCircle, Percent, TrendingDown, ChevronDown,
} from 'lucide-react'
import { formatSAR, formatDate, formatHijri, installmentLabelAr } from './format'
import type { StatementView } from './property-statement-html'

// Ported 1:1 from egarsys src/components/property-statement-view.tsx — the shared
// renderer for the per-property statement of account (كشف حساب عقار). Pure
// presentation; all figures are computed by lib/rentals/property-statement-data.

function dual(dateStr: string): string {
  const g = formatDate(dateStr)
  const h = formatHijri(dateStr)
  return h && h !== '—' ? `${g} · ${h}` : g
}

function statusBadgeClass(status: string): string {
  if (status === 'moved_out') return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300'
  if (status === 'expired' || status === 'terminated') return 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300'
  if (status === 'active') return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300'
  return 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300'
}

function timelineDotClass(status: string, departedOwing: boolean): string {
  if (departedOwing || status === 'moved_out') return 'bg-red-500 ring-red-200 dark:ring-red-900'
  if (status === 'active') return 'bg-emerald-500 ring-emerald-200 dark:ring-emerald-900'
  return 'bg-slate-400 ring-slate-200 dark:ring-slate-700'
}

export function PropertyStatementView({ data }: { data: StatementView }) {
  const p = data.property
  const hasDebt = data.debtTotal > 0
  const serials = [
    `الرقم التسلسلي: ${p.internalId || '—'}`,
    p.deedNumber ? `رقم الصك: ${p.deedNumber}` : null,
    p.shopNumber ? `رقم المحل: ${p.shopNumber}` : null,
  ].filter(Boolean)

  return (
    <div className="space-y-6 text-sm">
      {/* Property identity */}
      <section className="rounded-xl border border-emerald-200/70 border-r-4 border-r-emerald-500 bg-emerald-50/50 p-4 dark:border-emerald-900/50 dark:border-r-emerald-600 dark:bg-emerald-950/20">
        <div className="flex items-start gap-3">
          <Building2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
          <div className="flex-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {p.titleAr || p.title}
            </h3>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
              {serials.map((s) => (
                <span key={s as string} className="font-mono">{s}</span>
              ))}
            </div>
            <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {[p.address, p.district, p.city].filter(Boolean).join('، ') || '—'}
              {p.owner?.name ? ` — المالك: ${p.owner.name}` : ''}
              {` — الوحدات: ${p.unitsCount}`}
            </div>
          </div>
        </div>
      </section>

      {/* 1. Metric cards — debt first & loudest */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <Card
          className={`col-span-2 sm:col-span-4 lg:col-span-1 border-2 ${
            hasDebt
              ? 'border-red-400 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
              : 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
              <AlertTriangle className={`h-4 w-4 ${hasDebt ? 'text-red-600' : 'text-emerald-600'}`} />
              إجمالي المديونيات
            </div>
            <div className={`mt-1.5 text-2xl font-extrabold tracking-tight ${hasDebt ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
              {formatSAR(data.debtTotal)}
            </div>
            <div className="mt-1 text-[10px] leading-4 text-slate-500">
              مستحقات متأخرة بلا فواتير — يُحتسب لحظيًا وينخفض عند إصدار الفواتير
            </div>
          </CardContent>
        </Card>

        <MetricCard icon={<Wallet className="h-4 w-4 text-indigo-600" />} label="إجمالي الإيجارات" value={data.summary.totalRentsContracted} />
        <MetricCard
          icon={<CheckCircle className="h-4 w-4 text-emerald-600" />}
          label="المبالغ المحصَّلة"
          value={data.summary.totalCollected}
          valueClass="text-emerald-700 dark:text-emerald-400"
          sub={`${formatSAR(data.summary.totalCollectedBase)} أساس + ${formatSAR(data.summary.totalCollectedVat)} ضريبة`}
        />
        <MetricCard icon={<Percent className="h-4 w-4 text-slate-500" />} label="الضريبة" value={data.summary.totalVat} />
        <MetricCard icon={<TrendingDown className="h-4 w-4 text-amber-600" />} label="المصروفات" value={data.summary.totalExpenses} valueClass="text-amber-700 dark:text-amber-400" />
      </section>

      {/* 2. Overdue-uninvoiced (RED) */}
      <section>
        <h4 className="mb-2 font-bold text-red-700 dark:text-red-400">
          المستحقات المتأخرة (غير مُصدَّر لها فواتير)
        </h4>
        {data.overdueUninvoiced.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400">
            <CheckCircle className="h-4 w-4 shrink-0" />
            لا توجد مستحقات متأخرة — جميع الأقساط المستحقة صدرت لها فواتير
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-red-200 dark:border-red-900">
            <table className="w-full text-right text-xs">
              <thead className="bg-red-100/70 text-red-900 dark:bg-red-950/40 dark:text-red-200">
                <tr>
                  <th className="p-2 font-semibold">المستأجر</th>
                  <th className="p-2 font-semibold">رقم العقد</th>
                  <th className="p-2 font-semibold">القسط</th>
                  <th className="p-2 font-semibold">تاريخ الاستحقاق</th>
                  <th className="p-2 font-semibold">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {data.overdueUninvoiced.map((r, i) => (
                  <tr key={`${r.contractId}-${r.installmentNo}-${i}`} className="border-t border-red-100 text-red-800 dark:border-red-900/60 dark:text-red-300">
                    <td className="p-2 font-medium">{r.tenantName || '—'}</td>
                    <td className="p-2 font-mono" dir="ltr">{r.contractNumber}</td>
                    <td className="p-2">{installmentLabelAr(r.installmentNo)}</td>
                    <td className="p-2">{r.dueDateAD} · {r.dueDateAH} هـ</td>
                    <td className="p-2 font-bold">{formatSAR(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 3. Tenant succession — visual timeline */}
      <section>
        <h4 className="mb-3 font-bold text-slate-800 dark:text-slate-200">تسلسل المستأجرين</h4>
        {data.timeline.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
            لا توجد عقود مرتبطة بهذا العقار
          </div>
        ) : (
          <ol className="relative space-y-4 border-r-2 border-slate-200 pr-5 dark:border-slate-800">
            {data.timeline.map((t) => {
              const owes = t.outstanding > 0.005
              const departedOwing = t.isDeparted && owes
              return (
                <li key={t.contractId} className="relative">
                  <span
                    className={`absolute -right-[27px] top-1.5 h-3.5 w-3.5 rounded-full ring-4 ${timelineDotClass(t.status, departedOwing)}`}
                    aria-hidden
                  />
                  <div
                    className={`rounded-lg border p-3 ${
                      departedOwing
                        ? 'border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20'
                        : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{t.tenantName || '—'}</span>
                      <Badge className={statusBadgeClass(t.status)}>{t.statusLabelAr}</Badge>
                      {departedOwing && (
                        <span className="rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700 dark:bg-red-950/50 dark:text-red-400">
                          غادر مدينًا بـ {formatSAR(t.outstanding)}
                        </span>
                      )}
                      <span className="mr-auto font-mono text-[11px] text-slate-500" dir="ltr">
                        {t.ejarContractNumber || t.contractNumber}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                      <span>من: {dual(t.startDate)}</span>
                      <span>إلى: {dual(t.endDate)}</span>
                      {!departedOwing && (
                        <span className={owes ? 'font-semibold text-red-700 dark:text-red-400' : ''}>
                          الرصيد المتبقّي: {formatSAR(t.outstanding)}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      {/* 4. Detailed financial breakdown */}
      <DetailsSection data={data} />
    </div>
  )
}

function DetailsSection({ data }: { data: StatementView }) {
  const [open, setOpen] = useState(true)
  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between p-3 text-right font-bold text-slate-800 dark:text-slate-200"
      >
        التفاصيل المالية
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-slate-100 p-3 dark:border-slate-800">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <SummaryTile label="إجمالي الإيجارات المتعاقد عليها" value={data.summary.totalRentsContracted} />
            <SummaryTile label="إجمالي المُصدَّر (فواتير سارية)" value={data.summary.totalInvoiced} />
            <SummaryTile
              label="إجمالي المُحصَّل"
              value={data.summary.totalCollected}
              tone="emerald"
              sub={`${formatSAR(data.summary.totalCollectedBase)} أساس + ${formatSAR(data.summary.totalCollectedVat)} ضريبة`}
            />
            <SummaryTile label="إجمالي الضريبة" value={data.summary.totalVat} />
            <SummaryTile label="إجمالي مصروفات العقار" value={data.summary.totalExpenses} tone="amber" />
            <SummaryTile label="إشعارات دائنة / مردودات" value={data.summary.creditNotesTotal} tone="slate" note="تُعرض منفصلة" />
          </div>

          {data.summary.expenseByCategory.length > 0 && (
            <div className="mt-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <div className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-400">تفصيل المصروفات حسب البند</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {data.summary.expenseByCategory.map((c) => (
                  <span key={c.category} className="text-slate-700 dark:text-slate-300">
                    {c.category}: <span className="font-semibold">{formatSAR(c.amount)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function MetricCard({
  icon, label, value, valueClass, sub,
}: {
  icon: React.ReactNode
  label: string
  value: number
  valueClass?: string
  sub?: string
}) {
  return (
    <Card className="border border-slate-200 dark:border-slate-800">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          {icon}
          {label}
        </div>
        <div className={`mt-1.5 text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 ${valueClass || ''}`}>
          {formatSAR(value)}
        </div>
        {sub && <div className="mt-0.5 text-[10px] leading-tight text-slate-400 dark:text-slate-500">{sub}</div>}
      </CardContent>
    </Card>
  )
}

function SummaryTile({
  label, value, tone = 'slate', note, sub,
}: {
  label: string
  value: number
  tone?: 'slate' | 'emerald' | 'amber'
  note?: string
  sub?: string
}) {
  const toneClass =
    tone === 'emerald'
      ? 'text-emerald-700 dark:text-emerald-400'
      : tone === 'amber'
        ? 'text-amber-700 dark:text-amber-400'
        : 'text-slate-800 dark:text-slate-200'
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="text-[11px] text-slate-500 dark:text-slate-400">{label}{note ? ` · ${note}` : ''}</div>
      <div className={`mt-1 text-sm font-bold ${toneClass}`}>{formatSAR(value)}</div>
      {sub && <div className="mt-0.5 text-[10px] leading-tight text-slate-400 dark:text-slate-500">{sub}</div>}
    </div>
  )
}
