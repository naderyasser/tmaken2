'use client'

// Ported 1:1 from egarsys src/components/installment-schedule-table.tsx.
// Only the imports changed: scoped format + scoped installment-view types.
import { formatSAR, formatDate } from './format'
import { INSTALLMENT_STATE_LABELS, type InstallmentView } from './engine/installment-view'

export function installmentChipClass(state: InstallmentView['state']): string {
  switch (state) {
    case 'next': return 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300'
    case 'paid': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
    case 'overdue':
    case 'invoiced_overdue': return 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300'
    case 'invoiced': return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
    case 'settled': return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
    default: return 'bg-slate-50 text-slate-500 dark:bg-slate-800/50 dark:text-slate-400'
  }
}

export function installmentRowBg(state: InstallmentView['state']): string {
  if (state === 'next') return 'bg-orange-50/70 dark:bg-orange-950/20'
  if (state === 'overdue' || state === 'invoiced_overdue') return 'bg-red-50/50 dark:bg-red-950/10'
  if (state === 'paid') return 'bg-emerald-50/50 dark:bg-emerald-950/10'
  return ''
}

/** A compact legend explaining the row colors — pair it above the table. */
export function InstallmentLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400">
      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-500" /> القسط القادم — تُصدَر عليه الفاتورة (★)</span>
      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> مدفوع بفاتورة</span>
      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> لم يُسدد (متأخر)</span>
      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-400" /> مفوترة بانتظار السداد</span>
      <span className="inline-flex items-center gap-1">مدفوع مسبقاً = سُدِّد دون فاتورة</span>
      <span className="inline-flex items-center gap-1">الأقساط المستقبلية تبقى فارغة حتى يحين دورها</span>
    </div>
  )
}

export function NextPaymentSummary({
  nextDueNo,
  nextDueState,
  nextDueReason,
}: {
  nextDueNo: number | null
  nextDueState?: 'due' | 'upcoming' | null
  nextDueReason?: 'fully_invoiced' | null
}) {
  if (nextDueNo == null) {
    return (
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
        <span className="h-2 w-2 rounded-full bg-slate-400" />
        {nextDueReason === 'fully_invoiced' ? 'تم إصدار فاتورة لكل الأقساط — لا يوجد قسط قادم' : 'لا يوجد قسط قادم'}
      </p>
    )
  }
  return (
    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-orange-700 dark:text-orange-300">
      <span className="h-2 w-2 rounded-full bg-orange-500" />
      القسط القادم للإصدار: القسط {nextDueNo}
      {nextDueState && (
        <span className={nextDueState === 'due' ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'}>
          {nextDueState === 'due' ? '· حان موعده' : '· لم يحن موعده بعد'}
        </span>
      )}
    </p>
  )
}

export function InstallmentScheduleTable({
  schedule,
  nextDueNo,
  nextDueState,
  nextDueReason,
  canManagePaidPreviously = false,
  onMarkPaidPreviously,
  onClearPaidPreviously,
}: {
  schedule: InstallmentView[]
  nextDueNo: number | null
  nextDueState?: 'due' | 'upcoming' | null
  nextDueReason?: 'fully_invoiced' | null
  canManagePaidPreviously?: boolean
  onMarkPaidPreviously?: (installmentNo: number) => void
  onClearPaidPreviously?: (installmentNo: number) => void
}) {
  if (!schedule || !schedule.length) return null
  const showActions = canManagePaidPreviously && !!onMarkPaidPreviously
  return (
    <div className="space-y-1.5">
    <NextPaymentSummary nextDueNo={nextDueNo} nextDueState={nextDueState} nextDueReason={nextDueReason} />
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
      <table className="w-full text-right text-[11px]">
        <thead className="bg-slate-100 dark:bg-slate-800/60">
          <tr>
            <th className="p-1.5 font-semibold">القسط</th>
            <th className="p-1.5 font-semibold">تاريخ الاستحقاق</th>
            <th className="p-1.5 font-semibold">المبلغ</th>
            <th className="p-1.5 font-semibold">الحالة</th>
            {showActions && <th className="p-1.5 font-semibold" />}
          </tr>
        </thead>
        <tbody>
          {schedule.map((it) => {
            const isNext = it.state === 'next'
            const hasPaidPrevDate = it.state === 'settled' && !!it.paidPreviouslyDate
            const canMark = (it.state === 'overdue' || it.state === 'next' || (it.state === 'settled' && !it.paidPreviouslyDate))
            return (
              <tr key={it.installmentNo} className={`border-t border-slate-100 dark:border-slate-800 ${installmentRowBg(it.state)}`}>
                <td className="p-1.5 font-medium">
                  القسط {it.installmentNo}
                  {isNext && <span title="القسط القادم"> ★</span>}
                </td>
                <td className="p-1.5 whitespace-nowrap">{it.dueDateAD} · {it.dueDateAH} هـ</td>
                <td className="p-1.5 font-semibold">{formatSAR(it.amount)}</td>
                <td className="p-1.5">
                  {it.state !== 'upcoming' && (
                    <span className={`inline-flex flex-wrap items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${installmentChipClass(it.state)}`}>
                      {INSTALLMENT_STATE_LABELS[it.state]}
                      {hasPaidPrevDate && <span className="font-normal opacity-80">· {formatDate(it.paidPreviouslyDate)}</span>}
                    </span>
                  )}
                </td>
                {showActions && (
                  <td className="p-1.5 whitespace-nowrap text-left">
                    {hasPaidPrevDate ? (
                      <button
                        type="button"
                        onClick={() => onClearPaidPreviously?.(it.installmentNo)}
                        className="rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800"
                        title="إلغاء تعليم «مدفوع مسبقاً» لهذا القسط"
                      >
                        ✕ إلغاء
                      </button>
                    ) : canMark ? (
                      <button
                        type="button"
                        onClick={() => onMarkPaidPreviously?.(it.installmentNo)}
                        className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-amber-950/30"
                        title="تسجيل هذا القسط كمدفوع مسبقاً (سُدِّد قبل إدخال العقد — دون فاتورة)"
                      >
                        مدفوع مسبقاً؟
                      </button>
                    ) : null}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
    </div>
  )
}
