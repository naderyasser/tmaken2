/**
 * Payment-terminal (POS / ECR) integration — the vendor-neutral contract.
 *
 * WHY THIS LAYER EXISTS
 * The till is a browser app, and a browser cannot open a raw TCP socket to a mada
 * terminal sitting on the shop LAN. Every acquirer (Geidea, neoleap, SurePay, …) also
 * speaks its own ECR dialect. So nothing in the UI or the sale path talks to hardware
 * directly: it talks to a `TerminalDriver`, and the driver is swapped per install.
 *
 * THE ONE RULE EVERYTHING ELSE FOLLOWS
 * The customer's card is debited by the TERMINAL, not by us. Therefore:
 *   - a sale is NEVER completed on an outcome we did not positively confirm, and
 *   - an outcome we could not read is NEVER thrown away — it becomes `"unknown"` and
 *     is parked for reconciliation (see ./store.ts).
 * Treating "unknown" as failure double-charges the customer on retry; treating it as
 * success hands out goods for free. It is its own state, and a human resolves it.
 */

/** What we're asking the terminal to do. */
export type TerminalTxnKind = "purchase" | "refund" | "void"

export interface TerminalRequest {
  kind: TerminalTxnKind
  /** Major units, as shown to the customer (100.5 = 100.50 SAR). Drivers convert. */
  amount: number
  /** ISO-4217, e.g. "SAR". */
  currency: string
  /**
   * Our correlation key — also the idempotency key. Drivers that support an ECR
   * reference field MUST send it, so `lastTransaction()` can prove whether a given
   * request reached the terminal after a crash.
   */
  clientRef: string
  /** Approval being reversed — required for refund/void. */
  originalRrn?: string
  /** Our invoice name, when one already exists (refunds/returns). Display only. */
  invoiceHint?: string
}

/**
 * `unknown` is the important one: the request was (or may have been) sent, and we did
 * not get a readable verdict. The money may or may not have moved.
 */
export type TerminalOutcome =
  | "approved"
  | "declined"
  | "cancelled"
  | "timeout"
  | "error"
  | "unknown"

/** A verdict is only safe to bank a sale on when it is exactly "approved". */
export function isApproved(r: Pick<TerminalResult, "outcome">): boolean {
  return r.outcome === "approved"
}

/** Outcomes that leave the money's fate genuinely undetermined. */
export function needsReconciliation(r: Pick<TerminalResult, "outcome">): boolean {
  return r.outcome === "unknown" || r.outcome === "timeout"
}

export interface TerminalResult {
  outcome: TerminalOutcome
  /**
   * What the terminal actually authorised. Usually equals the request, but partial
   * approval exists on some schemes — never assume it matches, always read it back.
   */
  approvedAmount?: number
  /** Retrieval Reference Number — the acquirer's handle for the txn. */
  rrn?: string
  /** Approval / authorisation code printed on the customer slip. */
  authCode?: string
  /** Already-masked PAN as the terminal returned it. We never receive or store a full PAN. */
  maskedPan?: string
  /** mada / VISA / mastercard / … */
  scheme?: string
  /** debit / credit */
  cardType?: string
  /** TID */
  terminalId?: string
  /** MID */
  merchantId?: string
  batchNo?: string
  /** System Trace Audit Number. */
  stan?: string
  /** Raw acquirer response code ("00" = approved on ISO-8583 acquirers). */
  responseCode?: string
  /** Human-readable text, as returned by the terminal (may be Arabic or English). */
  message?: string
  /** The terminal's own receipt block, when the ECR link returns one to print. */
  receiptText?: string
  /** Echo of the request's clientRef when the terminal supports the field. */
  clientRef?: string
  /** ISO timestamp of when WE recorded the verdict. */
  at: string
  /** Untouched driver payload, kept for support tickets. Never parsed by callers. */
  raw?: unknown
}

/** Coarse UI phases — what the cashier is told while the customer taps. */
export type TerminalPhase =
  | "connecting"
  | "sent"
  | "waiting_card"
  | "processing"
  | "done"

export interface TerminalProgress {
  phase: TerminalPhase
  /** Optional detail straight from the terminal ("PRESENT CARD", "PIN ENTERED", …). */
  message?: string
}

export interface TerminalContext {
  /** Cancel from the UI. Drivers MUST attempt a real ECR cancel, not just stop listening. */
  signal: AbortSignal
  onProgress?: (p: TerminalProgress) => void
}

export interface TerminalProbe {
  reachable: boolean
  /** Driver-specific detail for the diagnostics screen. */
  detail?: string
  terminalId?: string
}

/**
 * A driver adapts one transport (local bridge, WebSerial, acquirer cloud API, mock) to
 * the contract above. Implementations live beside this file; the till only ever sees
 * this interface.
 */
export interface TerminalDriver {
  /** Stable id stored in config, e.g. "mock" | "bridge". */
  readonly id: string
  /** Human label for settings/diagnostics. */
  readonly label: string

  /** Can we reach the terminal right now? Must not start a transaction. */
  probe(): Promise<TerminalProbe>

  /**
   * Run one transaction. Resolves with a verdict — including the bad ones. Rejecting
   * is reserved for programmer error; a terminal that fails is `outcome: "error"`, and
   * a terminal that goes silent is `outcome: "unknown"`.
   */
  transact(req: TerminalRequest, ctx: TerminalContext): Promise<TerminalResult>

  /**
   * Ask the terminal to re-state its last transaction — the crash-recovery path.
   * When `clientRef` is given, drivers that echo the ECR reference SHOULD only return
   * a match. Optional: not every acquirer exposes it, and the reconciliation screen
   * degrades to manual resolution when it's missing.
   */
  lastTransaction?(clientRef?: string): Promise<TerminalResult | null>

  /** Close the batch (end-of-day settlement), where the ECR link supports it. */
  settle?(): Promise<TerminalResult>
}
