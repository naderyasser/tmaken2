/**
 * The charge flow — the only entry point the till uses to move money on a card.
 *
 * It exists so the ordering rules live in ONE place and cannot be forgotten by a caller:
 *
 *   1. journal the intent BEFORE the terminal is asked,
 *   2. ask the driver,
 *   3. journal the verdict,
 *   4. if the verdict is indeterminate, ask the terminal what it actually did — once —
 *      before handing the ambiguity to a human.
 *
 * Step 4 is what turns most "unknown" results back into a definite answer without
 * anyone having to read a paper slip.
 */

import { newClientId } from "@/lib/cashier/pos-db"
import {
  attachInvoice,
  beginTxn,
  markUnresolved,
  recordVerdict,
  sweepStaleInFlight,
  type TerminalRecord,
} from "./store"
import { getTerminalDriver } from "./index"
import type {
  TerminalDriver,
  TerminalProgress,
  TerminalRequest,
  TerminalResult,
  TerminalTxnKind,
} from "./types"

export interface ChargeParams {
  amount: number
  currency: string
  /** The Mode of Payment the cashier picked — carried for the journal and the receipt. */
  mode: string
  kind?: TerminalTxnKind
  originalRrn?: string
  invoiceHint?: string
  sessionId?: string
  cashier?: string
  onProgress?: (p: TerminalProgress) => void
  /** External cancel (the dialog's Cancel button). */
  signal?: AbortSignal
  /** Injectable for tests; defaults to the configured driver. */
  driver?: TerminalDriver
}

export interface ChargeOutcome {
  /** The verdict, after any recovery attempt. */
  result: TerminalResult
  record: TerminalRecord | null
  /** True only for a confirmed approval — the sole condition for banking the payment. */
  approved: boolean
  /** True when the money's fate is undetermined and a human must resolve it. */
  needsAttention: boolean
  /** False when the local journal could not be written — surfaced as a warning. */
  journaled: boolean
  /** Correlation key; the caller must keep it to attach the invoice afterwards. */
  clientRef: string
}

/**
 * Run a card charge end to end.
 *
 * Never throws for a payment failure — a decline, a dead bridge and a silent terminal
 * are all normal outcomes that the UI has to render, not exceptions.
 */
export async function chargeCard(params: ChargeParams): Promise<ChargeOutcome> {
  const driver = params.driver ?? getTerminalDriver()
  const clientRef = newClientId()

  const req: TerminalRequest = {
    kind: params.kind ?? "purchase",
    amount: params.amount,
    currency: params.currency,
    clientRef,
    originalRrn: params.originalRrn,
    invoiceHint: params.invoiceHint,
  }

  // (1) Intent first. If this write is lost we still charge, but we say so out loud —
  // a charge with no journal entry is the one case we cannot reconstruct later.
  const { journaled } = await beginTxn(req, {
    driverId: driver.id,
    sessionId: params.sessionId,
    cashier: params.cashier,
  })

  const controller = new AbortController()
  const external = params.signal
  if (external) {
    if (external.aborted) controller.abort()
    else external.addEventListener("abort", () => controller.abort(), { once: true })
  }

  // (2) Ask the hardware.
  let result: TerminalResult
  try {
    result = await driver.transact(req, {
      signal: controller.signal,
      onProgress: params.onProgress,
    })
  } catch (e) {
    // A driver that throws has told us nothing about the terminal's state. That is
    // precisely "unknown" — treating a crashed driver as a clean failure is how a
    // customer gets charged twice.
    result = {
      outcome: "unknown",
      clientRef,
      message: e instanceof Error ? e.message : "خطأ غير متوقع في سائق الجهاز",
      at: new Date().toISOString(),
    }
  }

  // (3) Journal the verdict.
  let record = await recordVerdict(clientRef, result)

  // (4) Indeterminate → ask the terminal what it really did, once.
  if ((result.outcome === "unknown" || result.outcome === "timeout") && driver.lastTransaction) {
    const confirmed = await confirmViaLastTransaction(driver, clientRef, params.amount)
    if (confirmed) {
      result = confirmed
      record = await recordVerdict(clientRef, confirmed)
    }
  }

  return {
    result,
    record,
    approved: result.outcome === "approved",
    needsAttention: result.outcome === "unknown" || result.outcome === "timeout",
    journaled,
    clientRef,
  }
}

/**
 * Query the terminal's last transaction and accept it ONLY if it provably describes
 * ours. A driver that cannot echo our reference, or that reports a different amount,
 * proves nothing — we keep the ambiguity rather than paper over it.
 */
async function confirmViaLastTransaction(
  driver: TerminalDriver,
  clientRef: string,
  amount: number,
): Promise<TerminalResult | null> {
  let last: TerminalResult | null = null
  try {
    last = (await driver.lastTransaction?.(clientRef)) ?? null
  } catch {
    return null
  }
  if (!last) return null
  if (last.clientRef !== clientRef) return null
  const settled = last.approvedAmount ?? amount
  if (last.outcome === "approved" && Math.abs(settled - amount) > 0.005) return null
  return last
}

/**
 * Bind approved charges to the invoice they paid for. Called right after the sale
 * posts; until it runs, those charges stay "open" and the shift close will flag them.
 */
export async function attachInvoiceToCharges(
  clientRefs: string[],
  invoiceName: string,
): Promise<void> {
  for (const ref of clientRefs) {
    if (ref) await attachInvoice(ref, invoiceName)
  }
}

/**
 * The sale could not be posted after the card was already charged — the worst ordinary
 * case. Park every charge for human resolution (refund on the terminal, or re-post).
 */
export async function flagChargesOrphaned(
  clientRefs: string[],
  reason: string,
): Promise<void> {
  for (const ref of clientRefs) {
    if (ref) await markUnresolved(ref, reason)
  }
}

/**
 * Startup recovery. Anything still `in_flight` means we died mid-charge; demote it and
 * try to learn the real outcome from the terminal before bothering a person.
 *
 * Returns the records that are STILL unresolved after the attempt.
 */
export async function recoverPendingCharges(
  driver: TerminalDriver = getTerminalDriver(),
): Promise<TerminalRecord[]> {
  const stale = await sweepStaleInFlight()
  const stillOpen: TerminalRecord[] = []

  for (const rec of stale) {
    const confirmed = driver.lastTransaction
      ? await confirmViaLastTransaction(driver, rec.clientRef, rec.amount)
      : null
    if (confirmed) {
      const updated = await recordVerdict(rec.clientRef, confirmed)
      // A recovered APPROVAL is still open work: the money moved but no invoice exists.
      if (updated && updated.state !== "failed") stillOpen.push(updated)
      continue
    }
    stillOpen.push(rec)
  }
  return stillOpen
}
