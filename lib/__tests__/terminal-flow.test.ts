/**
 * The card-charge safety rules.
 *
 * Every test here encodes a way a customer gets charged twice, or gets goods for free,
 * if the rule is broken. They are deliberately paranoid.
 */

// In-memory stand-in for the IndexedDB layer — jsdom has no indexedDB, and the real
// pos-db is fail-soft, so without this the journal would silently no-op and every
// assertion below would pass vacuously.
jest.mock("@/lib/cashier/pos-db", () => {
  const mem = new Map<string, Map<string, unknown>>()
  const store = (name: string) => {
    if (!mem.has(name)) mem.set(name, new Map())
    return mem.get(name)!
  }
  let counter = 0
  return {
    STORES: { kv: "kv", queue: "queue", catalog: "catalog", customers: "customers", invoices: "invoices", terminal: "terminal" },
    __reset: () => { mem.clear(); counter = 0 },
    newClientId: () => `ref-${++counter}`,
    idbGet: (s: string, k: string) => Promise.resolve(store(s).get(k) ?? null),
    idbPut: (s: string, v: any) => { store(s).set(v.clientRef, v); return Promise.resolve(true) },
    idbDelete: (s: string, k: string) => { store(s).delete(k); return Promise.resolve() },
    idbGetAll: (s: string) => Promise.resolve(Array.from(store(s).values())),
  }
})

import {
  attachInvoiceToCharges,
  chargeCard,
  flagChargesOrphaned,
  recoverPendingCharges,
} from "@/lib/cashier/terminal/flow"
import { getTxn, listOpenTxns } from "@/lib/cashier/terminal/store"
import type {
  TerminalContext,
  TerminalDriver,
  TerminalRequest,
  TerminalResult,
} from "@/lib/cashier/terminal/types"

const posDb = jest.requireMock("@/lib/cashier/pos-db") as { __reset: () => void }

const at = "2026-08-29T10:00:00.000Z"

/** A driver whose verdict the test dictates. */
function fakeDriver(
  verdict: Partial<TerminalResult> | ((req: TerminalRequest, ctx: TerminalContext) => Promise<TerminalResult>),
  extra: Partial<TerminalDriver> = {},
): TerminalDriver {
  return {
    id: "fake",
    label: "fake",
    probe: async () => ({ reachable: true }),
    transact: typeof verdict === "function"
      ? verdict
      : async (req) => ({ outcome: "approved", clientRef: req.clientRef, at, ...verdict } as TerminalResult),
    ...extra,
  }
}

const params = (driver: TerminalDriver) => ({
  amount: 100,
  currency: "SAR",
  mode: "شبكة",
  driver,
})

beforeEach(() => posDb.__reset())

describe("chargeCard — the verdict decides everything", () => {
  it("banks an approval and journals it as approved", async () => {
    const out = await chargeCard(params(fakeDriver({ outcome: "approved", approvedAmount: 100, rrn: "123456789012" })))

    expect(out.approved).toBe(true)
    expect(out.needsAttention).toBe(false)
    expect((await getTxn(out.clientRef))?.state).toBe("approved")
  })

  it("treats a decline as a clean failure — nothing is owed", async () => {
    const out = await chargeCard(params(fakeDriver({ outcome: "declined", responseCode: "51" })))

    expect(out.approved).toBe(false)
    expect(out.needsAttention).toBe(false)
    expect((await getTxn(out.clientRef))?.state).toBe("failed")
    expect(await listOpenTxns()).toHaveLength(0)
  })

  it("never banks a payment on anything other than an explicit approval", async () => {
    for (const outcome of ["declined", "cancelled", "timeout", "error", "unknown"] as const) {
      const out = await chargeCard(params(fakeDriver({ outcome })))
      expect(out.approved).toBe(false)
    }
  })

  it("turns a THROWN driver error into 'unknown', not a clean failure", async () => {
    // A driver that crashed knows nothing about the terminal's state. Calling that a
    // failure invites a retry — and a second charge on the customer's card.
    const out = await chargeCard(params(fakeDriver(async () => { throw new Error("socket exploded") })))

    expect(out.result.outcome).toBe("unknown")
    expect(out.approved).toBe(false)
    expect(out.needsAttention).toBe(true)
    expect((await getTxn(out.clientRef))?.state).toBe("unresolved")
  })

  it("leaves an indeterminate charge OPEN for a human", async () => {
    const out = await chargeCard(params(fakeDriver({ outcome: "unknown" })))

    const open = await listOpenTxns()
    expect(open).toHaveLength(1)
    expect(open[0].clientRef).toBe(out.clientRef)
    expect(open[0].state).toBe("unresolved")
  })
})

describe("chargeCard — ordering", () => {
  it("journals the intent BEFORE the terminal is asked for money", async () => {
    // If the browser dies inside transact(), this record is the only evidence a charge
    // was ever attempted.
    let seenDuringTransact: string | undefined
    const driver = fakeDriver(async (req) => {
      seenDuringTransact = (await getTxn(req.clientRef))?.state
      return { outcome: "approved", clientRef: req.clientRef, at }
    })

    await chargeCard(params(driver))

    expect(seenDuringTransact).toBe("in_flight")
  })

  it("reports when the journal could not be written", async () => {
    const idbPut = jest.spyOn(jest.requireMock("@/lib/cashier/pos-db"), "idbPut")
    idbPut.mockResolvedValueOnce(false)

    const out = await chargeCard(params(fakeDriver({ outcome: "approved" })))

    expect(out.journaled).toBe(false)
    idbPut.mockRestore()
  })
})

describe("chargeCard — recovery via lastTransaction", () => {
  const lastTxnDriver = (last: TerminalResult | null) =>
    fakeDriver({ outcome: "unknown" }, { lastTransaction: async () => last })

  it("recovers an approval the terminal can prove", async () => {
    // clientRef is filled in by the flow; the driver echoes whatever it was asked about.
    const driver = fakeDriver(
      { outcome: "unknown" },
      { lastTransaction: async (ref) => ({ outcome: "approved", approvedAmount: 100, clientRef: ref, rrn: "999", at }) },
    )

    const out = await chargeCard(params(driver))

    expect(out.approved).toBe(true)
    expect(out.result.rrn).toBe("999")
    expect((await getTxn(out.clientRef))?.state).toBe("approved")
  })

  it("REJECTS a last-transaction answer about a different charge", async () => {
    // The terminal's most recent txn may be the PREVIOUS customer's. Accepting it would
    // hand out goods against someone else's payment.
    const out = await chargeCard(params(lastTxnDriver(
      { outcome: "approved", approvedAmount: 100, clientRef: "somebody-elses-ref", at },
    )))

    expect(out.approved).toBe(false)
    expect(out.needsAttention).toBe(true)
    expect((await getTxn(out.clientRef))?.state).toBe("unresolved")
  })

  it("REJECTS an approval for a different amount", async () => {
    const driver = fakeDriver(
      { outcome: "unknown" },
      { lastTransaction: async (ref) => ({ outcome: "approved", approvedAmount: 40, clientRef: ref, at }) },
    )

    const out = await chargeCard(params(driver))

    expect(out.approved).toBe(false)
    expect((await getTxn(out.clientRef))?.state).toBe("unresolved")
  })

  it("stays unresolved when the driver cannot answer at all", async () => {
    const out = await chargeCard(params(lastTxnDriver(null)))

    expect(out.needsAttention).toBe(true)
    expect((await getTxn(out.clientRef))?.state).toBe("unresolved")
  })

  it("does not let a throwing lastTransaction break the charge result", async () => {
    const driver = fakeDriver(
      { outcome: "unknown" },
      { lastTransaction: async () => { throw new Error("bridge gone") } },
    )

    const out = await chargeCard(params(driver))

    expect(out.result.outcome).toBe("unknown")
    expect(out.needsAttention).toBe(true)
  })

  it("does NOT query lastTransaction for a clean decline", async () => {
    const lastTransaction = jest.fn()
    await chargeCard(params(fakeDriver({ outcome: "declined" }, { lastTransaction })))

    expect(lastTransaction).not.toHaveBeenCalled()
  })
})

describe("chargeCard — cancellation", () => {
  /**
   * Mirrors the driver contract: a driver must honour a signal that is ALREADY aborted
   * on entry, not merely subscribe for a future abort. The flow writes its journal entry
   * before calling transact(), so a cancel raised the instant the charge starts lands
   * during that await and the driver is handed a pre-aborted signal.
   */
  const cancellableDriver = () =>
    fakeDriver(async (req, ctx) => {
      if (ctx.signal.aborted) return { outcome: "cancelled", clientRef: req.clientRef, at }
      await new Promise<void>(resolve =>
        ctx.signal.addEventListener("abort", () => resolve(), { once: true }),
      )
      return { outcome: "cancelled", clientRef: req.clientRef, at }
    })

  it("propagates a cancel raised before the driver is even reached", async () => {
    const ac = new AbortController()
    const promise = chargeCard({ ...params(cancellableDriver()), signal: ac.signal })
    ac.abort()

    const out = await promise

    expect(out.result.outcome).toBe("cancelled")
    expect(out.approved).toBe(false)
    expect((await getTxn(out.clientRef))?.state).toBe("failed")
  })

  it("propagates a cancel raised while the customer is at the terminal", async () => {
    const ac = new AbortController()
    let reached = false
    const driver = fakeDriver(async (req, ctx) => {
      reached = true
      if (ctx.signal.aborted) return { outcome: "cancelled", clientRef: req.clientRef, at }
      await new Promise<void>(resolve =>
        ctx.signal.addEventListener("abort", () => resolve(), { once: true }),
      )
      return { outcome: "cancelled", clientRef: req.clientRef, at }
    })

    const promise = chargeCard({ ...params(driver), signal: ac.signal })
    // Let the journal write settle so the charge is genuinely in flight first.
    await new Promise(r => setTimeout(r, 0))
    expect(reached).toBe(true)
    ac.abort()

    expect((await promise).result.outcome).toBe("cancelled")
  })

  it("honours a signal that was already aborted before the call", async () => {
    const ac = new AbortController()
    ac.abort()

    const out = await chargeCard({ ...params(cancellableDriver()), signal: ac.signal })

    expect(out.result.outcome).toBe("cancelled")
  })
})

describe("closing the loop", () => {
  it("settles an approved charge once its invoice exists", async () => {
    const out = await chargeCard(params(fakeDriver({ outcome: "approved" })))

    await attachInvoiceToCharges([out.clientRef], "ACC-PSINV-2026-00042")

    const rec = await getTxn(out.clientRef)
    expect(rec?.state).toBe("settled")
    expect(rec?.invoice).toBe("ACC-PSINV-2026-00042")
    expect(await listOpenTxns()).toHaveLength(0)
  })

  it("keeps an approved-but-unattached charge visible as open work", async () => {
    // Money took, no invoice — the shift close has to be able to see this.
    const out = await chargeCard(params(fakeDriver({ outcome: "approved" })))

    const open = await listOpenTxns()
    expect(open.map(r => r.clientRef)).toContain(out.clientRef)
  })

  it("flags charges as orphaned when the sale could not be posted", async () => {
    const out = await chargeCard(params(fakeDriver({ outcome: "approved" })))

    await flagChargesOrphaned([out.clientRef], "فشل ترحيل الفاتورة")

    const rec = await getTxn(out.clientRef)
    expect(rec?.state).toBe("unresolved")
    expect(rec?.note).toBe("فشل ترحيل الفاتورة")
  })

  it("does not resurrect a failed charge when an invoice name is attached", async () => {
    const out = await chargeCard(params(fakeDriver({ outcome: "declined" })))

    await attachInvoiceToCharges([out.clientRef], "ACC-PSINV-2026-00043")

    expect((await getTxn(out.clientRef))?.state).toBe("failed")
  })
})

describe("startup recovery", () => {
  it("demotes a charge left in flight by a crash and surfaces it", async () => {
    // Simulate the crash: a driver whose promise never settles leaves in_flight behind.
    const stuck = fakeDriver(async (req) => {
      await new Promise(() => { /* never resolves — the tab dies here */ })
      return { outcome: "unknown", clientRef: req.clientRef, at }
    })
    void chargeCard(params(stuck))
    await Promise.resolve()
    await Promise.resolve()

    const stillOpen = await recoverPendingCharges(fakeDriver({ outcome: "unknown" }))

    expect(stillOpen).toHaveLength(1)
    expect(stillOpen[0].state).toBe("unresolved")
  })

  it("auto-closes a crashed charge the terminal can account for", async () => {
    const stuck = fakeDriver(async () => new Promise<TerminalResult>(() => { /* never */ }))
    void chargeCard(params(stuck))
    await Promise.resolve()
    await Promise.resolve()

    const recovering = fakeDriver(
      { outcome: "unknown" },
      { lastTransaction: async (ref) => ({ outcome: "declined", clientRef: ref, at }) },
    )
    const stillOpen = await recoverPendingCharges(recovering)

    // A recovered DECLINE is settled business — nothing for a human to chase.
    expect(stillOpen).toHaveLength(0)
  })
})
