// Ported from egarsys src/lib/property-statement-html.ts — just the installment
// view type + its Arabic state labels the contract detail dialog's schedule table
// consumes. Structurally identical to the engine's ScheduleInstallment.

export type InstallmentStateView =
  | 'paid' | 'invoiced' | 'invoiced_overdue' | 'settled' | 'overdue' | 'next' | 'upcoming'

export interface InstallmentView {
  installmentNo: number
  dueDateAD: string
  dueDateAH: string
  rentValue: number
  vat: number
  amount: number
  state: InstallmentStateView
  /** ISO تاريخ السداد for installments settled via an explicit paid-previously record. */
  paidPreviouslyDate?: string | null
}

/** Arabic label for each installment state (client-confirmed strict wording 2026-07-10).
 *  `upcoming` is deliberately EMPTY — future installments stay blank until their turn. */
export const INSTALLMENT_STATE_LABELS: Record<InstallmentStateView, string> = {
  paid: 'مدفوع بفاتورة',
  invoiced: 'مفوترة — بانتظار السداد',
  invoiced_overdue: 'مفوترة ولم تُسدد',
  settled: 'مدفوع مسبقاً',
  overdue: 'متأخرة ولم تُسدد',
  next: 'القسط القادم',
  upcoming: '',
}
