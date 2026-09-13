/**
 * The card-terminal journal — a durable, local record of every transaction we ask a
 * terminal to run.
 *
 * WHY: the dangerous window is between "we told the terminal to charge 100 SAR" and
 * "we read the verdict back". If the browser is closed, the PC reboots, or the bridge
 * dies inside that window, the customer may have been charged for a sale that does not
 * exist anywhere in ERPNext. Nothing else in the till can detect that.
 *
 * So we write the intent BEFORE sending, and only ever move the record forward:
 *
 *      in_flight ──approved──> approved ──invoice attached──> settled
 *          │                       │
 *          │                       └──(sale failed to post)──> unresolved
 *          ├──declined/cancelled/error──> failed        (clean — nothing owed)
 *          └──timeout/unknown / found at boot──> unresolved ──human──> reconciled
 *
 * `unresolved` is the only state that costs money if ignored, so it is the only one
 * the UI is loud about, and it is never cleared automatically by a guess — only by a
 * positive `lastTransaction()` match or by a person.
 */

import { idbDelete, idbGet, idbGetAll, idbPut, STORES } from "@/lib/cashier/pos-db"
import type { TerminalRequest, TerminalResult, TerminalTxnKind } from "./types"

export type TerminalRecordState =
  | "in_flight"
  | "approved"
  | "settled"
  | "failed"
  | "unresolved"
  | "reconciled"

export interface TerminalRecord {
  /** Primary key — the same clientRef sent to the terminal. */
  clientRef: string
  kind: TerminalTxnKind
  /** What we ASKED for. The approved amount lives in `result.approvedAmount`. */
  amount: number
  currency: string
  state: TerminalRecordState
  startedAt: string
  updatedAt: string
  driverId: string
  result?: TerminalResult
  /** POS Invoice this payment belongs to, once the sale has posted. */
  invoice?: string
  /** Cashier Session at the time of the charge — for end-of-shift matching. */
  sessionId?: string
  cashier?: string
  /** Free-text note written when a human resolves an `unresolved` record. */
  note?: string
  resolvedBy?: string
  resolvedAt?: string
}

const nowIso = () => new Date().toISOString()

/** States a human still has to care about. */
const OPEN_STATES: readonly TerminalRecordState[] = ["in_flight", "approved", "unresolved"]

export function isOpen(rec: TerminalRecord): boolean {
  return OPEN_STATES.indexOf(rec.state) !== -1
}

/**
 * Record the INTENT to charge, before a single byte reaches the terminal.
 * If this write fails (storage unavailable) we still proceed — but the caller is told,
 * because a charge with no journal entry is exactly the case we cannot reconstruct.
 */
export async function beginTxn(
  req: TerminalRequest,
  meta: { driverId: string; sessionId?: string; cashier?: string },
): Promise<{ record: TerminalRecord; journaled: boolean }> {
  const record: TerminalRecord = {
    clientRef: req.clientRef,
    kind: req.kind,
    amount: req.amount,
    currency: req.currency,
    state: "in_flight",
    startedAt: nowIso(),
    updatedAt: nowIso(),
    driverId: meta.driverId,
    sessionId: meta.sessionId,
    cashier: meta.cashier,
  }
  const journaled = await idbPut(STORES.terminal, record)
  return { record, journaled }
}

/** Map a driver verdict onto the journal state machine. */
export function stateForResult(result: TerminalResult): TerminalRecordState {
  switch (result.outcome) {
    case "approved":
      return "approved"
    case "declined":
    case "cancelled":
    case "error":
      return "failed"
    case "timeout":
    case "unknown":
    default:
      return "unresolved"
  }
}

export async function recordVerdict(
  clientRef: string,
  result: TerminalResult,
): Promise<TerminalRecord | null> {
  const existing = await getTxn(clientRef)
  if (!existing) return null
  const next: TerminalRecord = {
    ...existing,
    state: stateForResult(result),
    result,
    updatedAt: nowIso(),
  }
  await idbPut(STORES.terminal, next)
  return next
}

/**
 * Bind an approved charge to the invoice it paid for. This is what closes the loop:
 * until it happens the money is banked but unaccounted, and the record stays `approved`
 * (i.e. still open) so the shift close can surface it.
 */
export async function attachInvoice(clientRef: string, invoice: string): Promise<void> {
  const existing = await getTxn(clientRef)
  if (!existing) return
  await idbPut(STORES.terminal, {
    ...existing,
    invoice,
    // Only an approved charge becomes settled; a failed/unresolved one keeps its state
    // even if an invoice name is attached, so it never disappears from the queue.
    state: existing.state === "approved" ? "settled" : existing.state,
    updatedAt: nowIso(),
  })
}

/** Demote an approved charge whose sale could not be posted — a human must refund or re-post. */
export async function markUnresolved(clientRef: string, note?: string): Promise<void> {
  const existing = await getTxn(clientRef)
  if (!existing) return
  await idbPut(STORES.terminal, {
    ...existing,
    state: "unresolved",
    note: note ?? existing.note,
    updatedAt: nowIso(),
  })
}

/** A person looked at the terminal slip / bank portal and made the call. */
export async function resolveTxn(
  clientRef: string,
  by: string,
  note: string,
): Promise<void> {
  const existing = await getTxn(clientRef)
  if (!existing) return
  await idbPut(STORES.terminal, {
    ...existing,
    state: "reconciled",
    resolvedBy: by,
    resolvedAt: nowIso(),
    note,
    updatedAt: nowIso(),
  })
}

export function getTxn(clientRef: string): Promise<TerminalRecord | null> {
  return idbGet<TerminalRecord>(STORES.terminal, clientRef)
}

export async function listTxns(): Promise<TerminalRecord[]> {
  const all = await idbGetAll<TerminalRecord>(STORES.terminal)
  return all.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
}

/** Everything a human still owes an answer on, newest first. */
export async function listOpenTxns(): Promise<TerminalRecord[]> {
  return (await listTxns()).filter(isOpen)
}

/**
 * Startup sweep. An `in_flight` record can only exist at boot because we died mid-
 * transaction — the flow itself always writes a verdict. Those are demoted to
 * `unresolved` so they surface, rather than sitting invisible forever.
 *
 * Returns the records it demoted, so the caller can attempt driver-assisted recovery.
 */
export async function sweepStaleInFlight(): Promise<TerminalRecord[]> {
  const stale = (await listTxns()).filter(r => r.state === "in_flight")
  for (const rec of stale) {
    await idbPut(STORES.terminal, {
      ...rec,
      state: "unresolved",
      note: rec.note ?? "انقطع الاتصال قبل قراءة نتيجة الجهاز",
      updatedAt: nowIso(),
    })
  }
  return stale.map(r => ({ ...r, state: "unresolved" as const }))
}

/**
 * Drop closed records older than `days`. Open ones are NEVER pruned regardless of age —
 * an unresolved charge from last month is still an unresolved charge.
 */
export async function pruneClosed(days = 30): Promise<number> {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  const all = await listTxns()
  let removed = 0
  for (const rec of all) {
    if (isOpen(rec)) continue
    if (new Date(rec.updatedAt).getTime() < cutoff) {
      await idbDelete(STORES.terminal, rec.clientRef)
      removed++
    }
  }
  return removed
}
