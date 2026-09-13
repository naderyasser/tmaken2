import { generatePaymentSchedule, type PaymentRow } from './payment-schedule'

/**
 * Per-property statement of account (كشف حساب عقار) — pure derivation layer.
 *
 * NOTHING here touches the DB or mutates anything; it takes plain contract +
 * invoice data and derives the money figures, so it is fully unit-testable and
 * the route stays a thin orchestrator. All figures are RECOMPUTED on every call
 * (never stored) — see computeContractStatement for why that matters for the
 * live debt total.
 */

/**
 * The shared "valid invoice" scope used across the app's money math: a real
 * invoice (documentType 'invoice') that has NOT been cancelled. Credit/debit
 * notes and cancelled invoices are excluded on purpose — a cancelled invoice
 * does NOT settle its installment, so the debt it was meant to cover stays
 * outstanding (client-confirmed semantics).
 */
export function isValidInvoice(inv: { documentType?: string | null; status?: string | null }): boolean {
  return (inv.documentType ?? 'invoice') === 'invoice' && inv.status !== 'cancelled'
}

/**
 * The app-wide COLLECTED convention (client-confirmed, 2026-07):
 * a status='paid' invoice counts as collected for its FULL totalValue when no
 * explicit paidAmount is recorded; a populated paidAmount (partial payment)
 * always wins. Used by the statement, the جرد summary, the ledger payment
 * entries and the dashboard settlement donut — ONE number everywhere.
 */
export function collectedAmount(inv: {
  status?: string | null
  totalValue?: number | null
  paidAmount?: number | null
}): number {
  return inv.paidAmount ?? (inv.status === 'paid' ? inv.totalValue ?? 0 : 0)
}

export interface CollectedSplit {
  /** collected portion attributable to the rent base (excl VAT) */
  base: number
  /** collected portion attributable to VAT */
  vat: number
  /** base + vat — equals collectedAmount(inv) */
  total: number
}

/**
 * Split an invoice's COLLECTED amount into base vs VAT (client-confirmed, 2026-07).
 * RULE: split the collected amount PRO-RATA by the invoice's own VAT ratio
 * (vatAmount / totalValue). A fully-collected invoice therefore contributes its
 * exact base + vat; a partial paidAmount splits proportionally. base + vat always
 * equals collectedAmount(inv) to the cent (base is derived as total − vat).
 * Falls back to all-base when the invoice carries no total (can't form a ratio).
 */
export function collectedSplit(inv: {
  status?: string | null
  totalValue?: number | null
  vatAmount?: number | null
  paidAmount?: number | null
}): CollectedSplit {
  const total = round2(collectedAmount(inv))
  if (total <= 0) return { base: 0, vat: 0, total: 0 }
  const tv = inv.totalValue ?? 0
  if (tv <= 0) return { base: total, vat: 0, total }
  const vatRatio = (inv.vatAmount ?? 0) / tv
  const vat = round2(total * vatRatio)
  const base = round2(total - vat) // total & vat are 2dp → base + vat === total exactly
  return { base, vat, total }
}

export interface StatementContractInput {
  startDate: Date | string
  endDate: Date | string
  rentAmount: number
  paymentFrequency: string
  taxRate?: number | null
  /** «مسدد مسبقاً» — legacy prepaid contract: settle everything up to now (المتبقية → 0)
   *  without any invoice. Equivalent to assumeOlderPaid; opts.assumeOlderPaid still wins. */
  prepaidSettled?: boolean | null
  /** Raw RentalContract.paidPreviouslyInstallments JSON — an array of { no, paidDate }
   *  logging individual installments PAID before the contract entered the system. Each
   *  listed installment is treated as `settled` (dropped from debt, «مدفوع مسبقاً» + its
   *  date on the schedule) with no invoice. Normalized defensively; empty/invalid = no-op. */
  paidPreviously?: unknown
}

export interface StatementInvoiceInput {
  installmentNo: number
  documentType?: string | null
  status?: string | null
  totalValue?: number | null
  vatAmount?: number | null
  paidAmount?: number | null
}

export interface OverdueUninvoicedRow {
  installmentNo: number
  dueDateAD: string
  dueDateAH: string
  rentValue: number
  vat: number
  amount: number
}

/**
 * Per-installment display state. This is a PURE display/derivation layer — it
 * creates NO invoices and writes nothing (ZATCA sequence untouched). Client-confirmed
 * strict coloring (2026-07-10 voice notes):
 *   paid     — a valid invoice covers it AND its money is fully collected (green,
 *              «مدفوع بفاتورة»)
 *   invoiced — a valid invoice covers it, not collected, not yet due (neutral —
 *              awaiting payment)
 *   invoiced_overdue — a valid invoice covers it, not collected, past its due
 *              date: unpaid = red, even though a فاتورة exists
 *   settled  — no invoice, but an earlier-or-equal installment is already PAID, so
 *              by sequential payment this one is assumed paid too (مدفوع مسبقاً).
 *              NOT debt. (neutral)
 *   overdue  — no invoice, past its due date, ABOVE the paid watermark: genuinely
 *              came due and unpaid (red). Their sum is the indebtedness.
 *   next     — the single next installment to issue (orange). At most one row —
 *              may itself be past due (DEC-C) yet stays orange, reds are behind it.
 *   upcoming — a later not-yet-due uninvoiced installment. Rendered completely
 *              BLANK (no chip, no color) until its turn comes.
 */
export type InstallmentState = 'paid' | 'invoiced' | 'invoiced_overdue' | 'settled' | 'overdue' | 'next' | 'upcoming'

export interface ScheduleInstallment {
  installmentNo: number
  dueDateAD: string
  dueDateAH: string
  rentValue: number
  vat: number
  amount: number
  state: InstallmentState
  /** ISO date this installment was paid BEFORE the system (تاريخ السداد), when it is
   *  `settled` because of an explicit paid-previously record. null for every other row
   *  (incl. watermark/prepaid-derived `settled`). Display-only. */
  paidPreviouslyDate?: string | null
}

export interface ContractStatement {
  /** Past-due installments with NO valid invoice AND above the paid watermark (assumed-paid earlier ones excluded). Flagged red. */
  overdueUninvoiced: OverdueUninvoicedRow[]
  /** Σ overdueUninvoiced.amount — this contract's contribution to the LIVE debt total. */
  overdueTotal: number
  /** Σ scheduled installment totals whose due date has passed (came-due-to-date, incl VAT). */
  dueToDate: number
  /** Σ valid-invoice totalValue for this contract. */
  invoiced: number
  /** Σ collectedAmount() over valid invoices (paidAmount ?? paid→totalValue). Invoice is the live billing system; Payment is legacy. */
  collected: number
  /** Σ collectedSplit().base over valid invoices — the rent-base portion of `collected`. */
  collectedBase: number
  /** Σ collectedSplit().vat over valid invoices — the VAT portion of `collected` (collectedBase + collectedVat === collected). */
  collectedVat: number
  /** Σ scheduled rentValue over the whole contract (excl VAT). */
  contractedRent: number
  /** Σ scheduled totalValue over the whole contract (incl VAT). */
  contractedTotal: number
  /** dueToDate − collected. Client formula: what a departed tenant still owes (invoiced-but-unpaid counts). */
  outstanding: number
  /** Every scheduled installment, classified for display (see InstallmentState). Debt math unaffected. */
  schedule: ScheduleInstallment[]
  /** The next payment to invoice = anchorNo + 1 (may already be past due — DEC-C). null when every installment is already invoiced. */
  nextDueNo: number | null
  /** The anchor installment — last-invoiced when any invoice exists, else (most-recent-elapsed − 1). */
  anchorNo: number
  /** Whether the next payment has already come due vs is still upcoming; null when there is no next payment. */
  nextDueState: 'due' | 'upcoming' | null
  /** Why there's no next payment (currently only 'fully_invoiced'); null when there is one. */
  nextDueReason: 'fully_invoiced' | null
  /** BLUE / "عليه مستحقات" amount (D1) — reached-and-unpaid uninvoiced installments above the settled cut-off + unpaid valid-invoice balances. */
  outstandingTotal: number
  /** outstandingTotal > 0 — drives the amber contracts-row chip. */
  hasOutstanding: boolean
}

function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * PER-CONTRACT "assume older periods paid" input — opts.assumeOlderPaid on
 * computeContractStatement. When a contract's older un-invoiced periods were genuinely
 * paid in cash (never invoiced) rather than owed, passing true moves THAT contract's
 * settled cut-off from the paid-watermark up to the anchor, so those periods show as
 * 'settled' (not 'overdue') and drop out of its debt.
 *
 * Deliberately NOT a global switch. Some un-invoiced periods are genuine arrears (the
 * جرد proves it — e.g. مينا's real debt), so a blanket "old = paid" would hide real
 * money owed. Default = false = current behaviour for EVERY contract until the client
 * classifies each one (cash-paid vs arrears). Pure derivation either way — no writes,
 * no invoices, no ZATCA. See [[installment-payment-watermark]].
 *
 * PER-INSTALLMENT persistence (client 2026-07-16): the finer-grained classification is
 * now stored on RentalContract.paidPreviouslyInstallments (a JSON array of { no, paidDate })
 * and fed in via StatementContractInput.paidPreviously. Each listed installment joins the
 * `settled` set below (dropped from debt, «مدفوع مسبقاً» + its historical date on the
 * schedule) INDEPENDENTLY of the watermark/anchor — additive, so a contract with no such
 * records behaves EXACTLY as before. Still pure derivation: no invoice, no ZATCA.
 */

/**
 * Normalize the raw RentalContract.paidPreviouslyInstallments JSON into a
 * (installmentNo → paidDate|null) map, defensively — a malformed/legacy value yields an
 * empty map (so the engine is a no-op for it), never a throw.
 */
function normalizePaidPreviously(raw: unknown): Map<number, string | null> {
  const map = new Map<number, string | null>()
  if (!Array.isArray(raw)) return map
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const no = Number((item as { no?: unknown }).no)
    if (!Number.isInteger(no) || no <= 0) continue
    const paidDate = (item as { paidDate?: unknown }).paidDate
    map.set(no, typeof paidDate === 'string' ? paidDate : null)
  }
  return map
}

/**
 * Compute every statement figure for a SINGLE contract.
 *
 * The installment schedule is DERIVED from the contract terms (there is no
 * first-class Installment table) via generatePaymentSchedule, using the same
 * `taxRate || 15` VAT fallback the rest of the app uses so the derived amounts
 * match what an issued invoice would carry. Each scheduled installment is
 * anti-joined against the set of VALID invoices (matched by installment number):
 * an installment is "overdue-uninvoiced" iff its due date has passed AND no
 * valid invoice covers it.
 *
 * This is recomputed LIVE on every call. Issuing an invoice for one of these
 * installments adds its number to the valid set, so the row — and its amount in
 * the debt total — disappears on the next load. Cancelling an invoice removes it
 * from the valid set, so the installment reappears as owed. Nothing is stored.
 */
export function computeContractStatement(
  contract: StatementContractInput,
  invoices: StatementInvoiceInput[],
  now: Date,
  opts?: { assumeOlderPaid?: boolean },
): ContractStatement {
  // PER-CONTRACT (never global): default false = current behaviour until this contract
  // is classified cash-paid vs arrears. See the doc block above.
  // «مسدد مسبقاً» prepaid contracts settle up to now with no invoice; an explicit
  // opts.assumeOlderPaid still overrides (e.g. a caller forcing the live view).
  const assumeOlderPaid = opts?.assumeOlderPaid ?? !!contract.prepaidSettled

  // Per-installment legacy paid-previously records (installmentNo → historical تاريخ السداد).
  // Empty when the contract has none → the engine is a strict no-op vs the pre-feature logic.
  const paidPreviouslyMap = normalizePaidPreviously(contract.paidPreviously)

  const endDate = toDate(contract.endDate)
  const rawSchedule = generatePaymentSchedule({
    startDate: toDate(contract.startDate),
    endDate,
    rentAmount: contract.rentAmount,
    paymentFrequency: contract.paymentFrequency,
    // Match the app-wide convention (contracts list / contract PDF): a 0/unset
    // taxRate falls back to 15% so derived amounts equal the issued invoices'.
    vatPercent: contract.taxRate || 15,
  })
  // Hijri-ceil guard: the row count is a ceil over the Hijri-month span, which can add
  // ONE trailing period that starts on/after the lease end — a rounding artifact, never
  // a real payment period. Drop it here so it can never be displayed, counted as debt,
  // or picked as the "next payment". Localised to the statement; generatePaymentSchedule
  // stays unchanged for the invoice-form / contract-PDF callers. Due dates are monotonic,
  // so the dropped rows are always a trailing block → remaining rows keep no === index+1.
  const isRealPeriod = (row: PaymentRow) => {
    const due = new Date(row.dueDateAD)
    return isNaN(due.getTime()) || isNaN(endDate.getTime()) || due < endDate
  }
  const schedule = rawSchedule.filter(isRealPeriod)
  const totalRows = schedule.length

  const valid = invoices.filter(isValidInvoice)
  const invoicedNos = new Set(valid.map((i) => i.installmentNo))
  // At most one valid invoice per installment (the create route rejects a second
  // non-cancelled invoice for the same installment, and isValidInvoice drops the
  // cancelled original + credit-note of a correction — e.g. فود لاين's INV-35
  // cancelled / INV-36 credit-note / INV-37 the valid reissue). Map defensively by
  // installment number so a stray duplicate can never double-count.
  const validByNo = new Map<number, StatementInvoiceInput>()
  for (const i of valid) if (!validByNo.has(i.installmentNo)) validByNo.set(i.installmentNo, i)

  // Sequential-payment watermark (client-confirmed, ZATCA-safe): the highest PAID
  // installment. A tenant can't pay #7 while skipping #1-6, so earlier ones are
  // assumed paid. This is the LIVE settled cut-off when assumeOlderPaid is false (default).
  const paidNos = valid.filter((i) => collectedAmount(i) > 0).map((i) => i.installmentNo)
  const paidWatermark = paidNos.length ? Math.max(...paidNos) : 0

  // ---- Single "next payment" rule (unifies engine / dashboard / issue-form) ----
  const isElapsed = (row: PaymentRow) => {
    const due = new Date(row.dueDateAD)
    return !isNaN(due.getTime()) && due < now
  }
  let mostRecentElapsed = 0
  for (const row of schedule) if (isElapsed(row)) mostRecentElapsed = Math.max(mostRecentElapsed, row.no)

  // Anchor = last-INVOICED when any invoice exists (DEC-D: an issued-but-unpaid invoice
  // still advances it), else the period BEFORE the most-recent elapsed one — so the
  // next payment lands on the most-recent elapsed period for a never-invoiced contract.
  const lastInvoiced = invoicedNos.size ? Math.max(...invoicedNos) : 0
  const anchorNo = invoicedNos.size ? lastInvoiced : Math.max(0, mostRecentElapsed - 1)

  // Settled cut-off — everything uninvoiced at/below it is treated as paid. OFF =
  // paid-watermark (current live numbers, debt unchanged); ON = anchor (drops debt).
  const settleCutoff = assumeOlderPaid ? anchorNo : paidWatermark

  // An uninvoiced installment is "settled" (shown «مدفوع مسبقاً», excluded from debt) when it
  // is at/below the sequential cut-off OR explicitly logged as paid-previously. Purely
  // additive: with no paid-previously records this is just `no <= settleCutoff`, as before.
  const isSettled = (no: number) => no <= settleCutoff || paidPreviouslyMap.has(no)

  // Next payment = the FIRST installment past the anchor that isn't already settled, so the
  // orange «القسط القادم» chip never lands on a «مدفوع مسبقاً» legacy period. Without any
  // paid-previously records the first candidate (anchor + 1) is never settled — anchor+1 is
  // always above the cut-off by the anchor rule — so this is identical to the old anchor+1.
  let nextDueNo: number | null = null
  let nextDueState: 'due' | 'upcoming' | null = null
  let nextDueReason: 'fully_invoiced' | null = null
  let nextRow: PaymentRow | undefined
  for (let n = anchorNo + 1; n <= totalRows; n++) {
    if (isSettled(n)) continue
    nextDueNo = n
    nextRow = schedule[n - 1]
    break
  }
  if (!nextRow) {
    nextDueReason = 'fully_invoiced'
  } else {
    nextDueState = isElapsed(nextRow) ? 'due' : 'upcoming'
  }

  const overdueUninvoiced: OverdueUninvoicedRow[] = []
  let dueToDate = 0
  let contractedRent = 0
  let contractedTotal = 0
  let assumedPaidTotal = 0 // past-due, uninvoiced, at/below the cut-off → treated as paid
  let unpaidInvoiceBalance = 0 // invoiced but unpaid, and already come due (DEC-D)

  for (const row of schedule) {
    contractedRent += row.rentValue
    contractedTotal += row.totalValue
    if (isElapsed(row)) {
      dueToDate += row.totalValue
      if (invoicedNos.has(row.no)) {
        const inv = validByNo.get(row.no)
        if (inv) {
          const bal = round2((inv.totalValue ?? 0) - collectedAmount(inv))
          if (bal > 0) unpaidInvoiceBalance += bal
        }
      } else if (isSettled(row.no)) {
        assumedPaidTotal += row.totalValue // assumed paid by sequence / logged paid-previously — not owed
      } else {
        overdueUninvoiced.push({
          installmentNo: row.no,
          dueDateAD: row.dueDateAD,
          dueDateAH: row.dueDateAH,
          rentValue: row.rentValue,
          vat: row.vat,
          amount: row.totalValue,
        })
      }
    }
  }

  const invoiced = valid.reduce((s, i) => s + (i.totalValue ?? 0), 0)
  const collected = valid.reduce((s, i) => s + collectedAmount(i), 0)
  // base/VAT split of the collected amount (pro-rata per invoice — see collectedSplit)
  const collectedParts = valid.reduce(
    (acc, i) => { const p = collectedSplit(i); acc.base += p.base; acc.vat += p.vat; return acc },
    { base: 0, vat: 0 },
  )
  const overdueTotal = overdueUninvoiced.reduce((s, r) => s + r.amount, 0)
  // BLUE / "عليه مستحقات" (D1): reached-and-unpaid uninvoiced installments above the
  // cut-off, PLUS unpaid balances on invoices whose period has already come due.
  const outstandingTotal = round2(overdueTotal + unpaidInvoiceBalance)

  // Classify every scheduled installment for display. Precedence: a recorded invoice
  // wins (split paid / awaiting / overdue by its collected state); then the cut-off
  // makes earlier rows 'settled'; then the single next payment → orange (DEC-C, even
  // if past due); then any other reached-and-unpaid → overdue (red); else upcoming
  // (blank). The debt SUM above is independent of these labels.
  const classified: ScheduleInstallment[] = schedule.map((row) => {
    let state: InstallmentState
    if (invoicedNos.has(row.no)) {
      const inv = validByNo.get(row.no)
      const got = inv ? collectedAmount(inv) : 0
      // Fully collected = paid (green). A partial payment leaves a balance owed, so
      // the row stays un-paid for display until the remainder is collected.
      const fullyPaid = !!inv && (got > 0 || inv.status === 'paid') && got + 0.005 >= (inv.totalValue ?? 0)
      state = fullyPaid ? 'paid' : isElapsed(row) ? 'invoiced_overdue' : 'invoiced'
    }
    else if (isSettled(row.no)) state = 'settled'
    else if (row.no === nextDueNo) state = 'next'
    else if (isElapsed(row)) state = 'overdue'
    else state = 'upcoming'
    return {
      installmentNo: row.no,
      dueDateAD: row.dueDateAD,
      dueDateAH: row.dueDateAH,
      rentValue: round2(row.rentValue),
      vat: round2(row.vat),
      amount: round2(row.totalValue),
      state,
      // Surface the historical تاريخ السداد only for installments settled via an explicit
      // paid-previously record (not watermark/prepaid-derived `settled`). null otherwise.
      paidPreviouslyDate: paidPreviouslyMap.get(row.no) ?? null,
    }
  })

  return {
    overdueUninvoiced,
    overdueTotal: round2(overdueTotal),
    dueToDate: round2(dueToDate),
    invoiced: round2(invoiced),
    collected: round2(collected),
    collectedBase: round2(collectedParts.base),
    collectedVat: round2(collectedParts.vat),
    contractedRent: round2(contractedRent),
    contractedTotal: round2(contractedTotal),
    // came-due minus what's been settled: actual collections PLUS the amounts assumed
    // paid under the cut-off (never negative).
    outstanding: round2(Math.max(0, dueToDate - collected - assumedPaidTotal)),
    schedule: classified,
    nextDueNo,
    anchorNo,
    nextDueState,
    nextDueReason,
    outstandingTotal,
    hasOutstanding: outstandingTotal > 0,
  }
}

export interface NextPaymentInfo {
  /** installment number of the unified next payment (= nextDueNo) */
  installmentNo: number
  dueDateAD: string
  dueDateAH: string
  /** total incl VAT — matches the invoice that would be issued for it */
  amount: number
}

/**
 * The unified "next payment" as a concrete date + amount pair — the nextDueNo row
 * of the classified (phantom-guarded) schedule. This is what the contracts
 * list/detail expose as nextPaymentDate / nextPaymentAmount, so those can never
 * drift from the schedule's green «القسط القادم» row. null when fully invoiced.
 */
export function nextPaymentOf(stmt: ContractStatement): NextPaymentInfo | null {
  if (stmt.nextDueNo == null) return null
  const row = stmt.schedule.find((r) => r.installmentNo === stmt.nextDueNo)
  if (!row) return null
  return { installmentNo: row.installmentNo, dueDateAD: row.dueDateAD, dueDateAH: row.dueDateAH, amount: row.amount }
}

/**
 * Convenience wrapper returning just the overdue-uninvoiced rows for a contract.
 * Delegates to computeContractStatement so the derivation lives in one place.
 */
export function computeOverdueUninvoiced(
  contract: StatementContractInput,
  invoices: StatementInvoiceInput[],
  now: Date,
): OverdueUninvoicedRow[] {
  return computeContractStatement(contract, invoices, now).overdueUninvoiced
}
