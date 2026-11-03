/**
 * Pure payment math for the till — extracted from the payment panel so the rules are
 * unit-testable and identical everywhere they're needed.
 *
 * Rules:
 * - Any mix of payment modes (cash + card + …) may be entered on one invoice.
 * - Overpay is allowed (cash handed over > total) — change is computed live.
 * - The sale is complete when the sum of entries covers the grand total.
 */

import type { PaymentEntry, PaymentReference } from "@/lib/cashier-api"

export interface PaymentState {
  totalPaid: number
  /** What's still owed (never negative). */
  remaining: number
  /** Change due back to the customer (never negative). */
  change: number
  isComplete: boolean
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function paymentState(entries: PaymentEntry[], grandTotal: number): PaymentState {
  const totalPaid = round2(entries.reduce((s, e) => s + (Number(e.amount) || 0), 0))
  const remaining = round2(Math.max(0, grandTotal - totalPaid))
  const change = round2(Math.max(0, totalPaid - grandTotal))
  return { totalPaid, remaining, change, isComplete: totalPaid >= round2(grandTotal) }
}

/**
 * A SETTLED payment is one where the customer's card has already been debited for
 * exactly that amount. Its figure is no longer ours to edit.
 *
 * Keyed off an explicit flag rather than "has a reference", because a reference alone
 * does not mean money moved — a cashier may type one as a record when the terminal
 * integration is switched off entirely.
 */
export function isSettled(entry: PaymentEntry | undefined): boolean {
  return entry?.reference?.settled === true
}

/**
 * Replace (or remove, when amount ≤ 0) the entry for one payment mode.
 *
 * A settled entry is immutable — keystrokes on it are ignored rather than silently
 * desyncing the invoice from what the terminal actually charged. Undoing one is an
 * explicit act (see `removeEntry`), because it means refunding or voiding on the
 * terminal too.
 */
export function upsertEntry(entries: PaymentEntry[], mode: string, amount: number): PaymentEntry[] {
  if (isSettled(entries.find(e => e.mode_of_payment === mode))) return entries
  const rest = entries.filter(e => e.mode_of_payment !== mode)
  const amt = round2(Number(amount) || 0)
  return amt > 0 ? [...rest, { mode_of_payment: mode, amount: amt }] : rest
}

/**
 * Record a terminal-approved payment. The amount comes from the APPROVAL, never from
 * what was requested — partial approvals exist, and the invoice must follow the money.
 */
export function settleEntry(
  entries: PaymentEntry[],
  mode: string,
  reference: PaymentReference,
  approvedAmount: number,
): PaymentEntry[] {
  const rest = entries.filter(e => e.mode_of_payment !== mode)
  const amt = round2(Number(approvedAmount) || 0)
  if (amt <= 0) return rest
  // Forced here rather than trusted from the caller: forgetting it would leave a
  // charged card editable from the numpad.
  return [...rest, { mode_of_payment: mode, amount: amt, reference: { ...reference, settled: true } }]
}

/** Explicitly drop a payment line, settled or not. */
export function removeEntry(entries: PaymentEntry[], mode: string): PaymentEntry[] {
  return entries.filter(e => e.mode_of_payment !== mode)
}

/**
 * Attach a reference the cashier typed for the record — a slip number when the till
 * has no terminal integration. It documents the payment without freezing it: nothing
 * here claims to know that money moved.
 */
export function annotateEntry(
  entries: PaymentEntry[],
  mode: string,
  note: string,
): PaymentEntry[] {
  return entries.map(e => {
    if (e.mode_of_payment !== mode || isSettled(e)) return e
    const trimmed = note.trim()
    if (!trimmed) {
      const { reference: _dropped, ...rest } = e
      return rest
    }
    return { ...e, reference: { ...e.reference, rrn: trimmed, manual: true } }
  })
}

/**
 * Numpad keystroke semantics for the amount field:
 * the PREFILLED value (suggested remaining) is "pristine" — the first typed digit
 * REPLACES it instead of appending, so the cashier can immediately key the tendered
 * amount (e.g. total 27.25, customer hands 50 → press "5","0" → 50, change 22.75).
 * Backspace on a pristine value clears to "0". After that, edits behave normally.
 */
export function applyNumpadKeystroke(
  previous: string,
  next: string,
  pristine: boolean,
): { value: string; pristine: boolean } {
  if (!pristine) return { value: next, pristine: false }
  if (next.length > previous.length && next.startsWith(previous)) {
    // appended character(s) onto the prefill → start fresh with just the new keys
    const fresh = next.slice(previous.length)
    return { value: fresh === "." ? "0." : fresh || "0", pristine: false }
  }
  if (next.length < previous.length) {
    // backspace on the prefill → clear
    return { value: "0", pristine: false }
  }
  return { value: next, pristine: false }
}
