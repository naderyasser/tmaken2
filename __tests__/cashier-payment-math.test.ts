/** Unit tests — till payment math (change due, overpay, split payment, numpad rules). */
import { paymentState, upsertEntry, settleEntry, removeEntry, annotateEntry, isSettled, applyNumpadKeystroke } from "@/lib/cashier/payment-math"

describe("paymentState", () => {
  it("exact payment completes with no change", () => {
    const s = paymentState([{ mode_of_payment: "Cash", amount: 100 }], 100)
    expect(s).toEqual({ totalPaid: 100, remaining: 0, change: 0, isComplete: true })
  })

  it("overpay (cash > total) yields live change due and never blocks", () => {
    const s = paymentState([{ mode_of_payment: "Cash", amount: 50 }], 27.25)
    expect(s.isComplete).toBe(true)
    expect(s.change).toBe(22.75)
    expect(s.remaining).toBe(0)
  })

  it("partial payment reports remaining, not complete", () => {
    const s = paymentState([{ mode_of_payment: "Card", amount: 30 }], 70)
    expect(s).toMatchObject({ totalPaid: 30, remaining: 40, change: 0, isComplete: false })
  })

  it("split payment (cash + card) on one invoice completes", () => {
    const entries = [
      { mode_of_payment: "Cash", amount: 40 },
      { mode_of_payment: "Card", amount: 30 },
    ]
    const s = paymentState(entries, 70)
    expect(s.isComplete).toBe(true)
    expect(s.change).toBe(0)
  })

  it("split with cash overpay computes change across the mix", () => {
    const s = paymentState(
      [{ mode_of_payment: "Card", amount: 50 }, { mode_of_payment: "Cash", amount: 30 }],
      70,
    )
    expect(s.change).toBe(10)
    expect(s.isComplete).toBe(true)
  })

  it("is robust to floating point (0.1+0.2 style totals)", () => {
    const s = paymentState([{ mode_of_payment: "Cash", amount: 0.3 }], 0.1 + 0.2)
    expect(s.isComplete).toBe(true)
    expect(s.change).toBe(0)
  })
})

describe("upsertEntry", () => {
  it("adds a new mode", () => {
    expect(upsertEntry([], "Cash", 10)).toEqual([{ mode_of_payment: "Cash", amount: 10 }])
  })
  it("replaces an existing mode instead of duplicating", () => {
    const out = upsertEntry([{ mode_of_payment: "Cash", amount: 10 }], "Cash", 25)
    expect(out).toEqual([{ mode_of_payment: "Cash", amount: 25 }])
  })
  it("removes the mode when amount is zero", () => {
    const out = upsertEntry(
      [{ mode_of_payment: "Cash", amount: 10 }, { mode_of_payment: "Card", amount: 5 }],
      "Cash", 0,
    )
    expect(out).toEqual([{ mode_of_payment: "Card", amount: 5 }])
  })
})

describe("applyNumpadKeystroke (no lock-to-total)", () => {
  it("first digit REPLACES the prefilled total (overpay in one gesture)", () => {
    // prefill 27.25, cashier keys "5" → value becomes 5, not 27.255
    expect(applyNumpadKeystroke("27.25", "27.255", true)).toEqual({ value: "5", pristine: false })
  })
  it("backspace on the prefill clears to 0 (and must NOT snap back)", () => {
    expect(applyNumpadKeystroke("27.25", "27.2", true)).toEqual({ value: "0", pristine: false })
  })
  it("after the first edit, keystrokes append normally", () => {
    expect(applyNumpadKeystroke("5", "50", false)).toEqual({ value: "50", pristine: false })
  })
  it("decimal point as the first key starts a fraction", () => {
    expect(applyNumpadKeystroke("27.25", "27.25.", true)).toEqual({ value: "0.", pristine: false })
  })
})

describe("terminal-settled entries", () => {
  const approval = { rrn: "123456789012", authCode: "004521", scheme: "mada" }

  it("marks an entry with a terminal approval as settled", () => {
    const [entry] = settleEntry([], "شبكة", approval, 100)
    expect(isSettled(entry)).toBe(true)
    expect(isSettled({ mode_of_payment: "Cash", amount: 100 })).toBe(false)
    expect(isSettled(undefined)).toBe(false)
  })

  it("takes the amount from the APPROVAL, not from what was requested", () => {
    // Partial approvals are real. The invoice has to follow the money.
    const out = settleEntry([], "شبكة", { ...approval, approvedAmount: 60 }, 60)
    expect(out).toEqual([{
      mode_of_payment: "شبكة",
      amount: 60,
      reference: { ...approval, approvedAmount: 60, settled: true },
    }])
  })

  it("stamps the settled flag even if the caller forgot it", () => {
    const [entry] = settleEntry([], "شبكة", approval, 100)
    expect(entry.reference?.settled).toBe(true)
  })

  it("refuses to let a keystroke change an already-charged amount", () => {
    // The card has been debited for 100. Typing 5 must not post a 5 SAR invoice.
    const settled = settleEntry([], "شبكة", approval, 100)
    expect(upsertEntry(settled, "شبكة", 5)).toEqual(settled)
    expect(upsertEntry(settled, "شبكة", 0)).toEqual(settled)
  })

  it("still allows editing a different, unsettled mode on the same sale", () => {
    const mixed = upsertEntry(settleEntry([], "شبكة", approval, 60), "Cash", 40)
    const edited = upsertEntry(mixed, "Cash", 45)

    expect(edited.find(e => e.mode_of_payment === "Cash")?.amount).toBe(45)
    expect(edited.find(e => e.mode_of_payment === "شبكة")?.amount).toBe(60)
  })

  it("removes a settled entry only through the explicit path", () => {
    const settled = settleEntry([], "شبكة", approval, 100)
    expect(removeEntry(settled, "شبكة")).toEqual([])
  })

  it("replaces a previous approval rather than stacking two on one mode", () => {
    const first = settleEntry([], "شبكة", approval, 100)
    const second = settleEntry(first, "شبكة", { ...approval, rrn: "999" }, 100)

    expect(second).toHaveLength(1)
    expect(second[0].reference?.rrn).toBe("999")
  })

  it("drops the line when an approval settles for nothing", () => {
    expect(settleEntry([], "شبكة", approval, 0)).toEqual([])
  })

  it("counts a settled entry toward the total like any other payment", () => {
    const entries = upsertEntry(settleEntry([], "شبكة", approval, 60), "Cash", 40)
    expect(paymentState(entries, 100)).toEqual({
      totalPaid: 100, remaining: 0, change: 0, isComplete: true,
    })
  })
})

describe("annotateEntry — a typed reference is a note, not a lock", () => {
  const cardEntry = [{ mode_of_payment: "شبكة", amount: 100 }]

  it("attaches the typed reference and marks it manual", () => {
    const out = annotateEntry(cardEntry, "شبكة", " 445566 ")
    expect(out[0].reference).toEqual({ rrn: "445566", manual: true })
  })

  it("leaves the amount editable — nothing here proves money moved", () => {
    const annotated = annotateEntry(cardEntry, "شبكة", "445566")
    expect(isSettled(annotated[0])).toBe(false)
    expect(upsertEntry(annotated, "شبكة", 80)[0].amount).toBe(80)
  })

  it("clears the reference when the field is emptied", () => {
    const annotated = annotateEntry(cardEntry, "شبكة", "445566")
    expect(annotateEntry(annotated, "شبكة", "  ")[0]).toEqual({ mode_of_payment: "شبكة", amount: 100 })
  })

  it("refuses to overwrite a real terminal approval", () => {
    // Typing in the note field must never mask what the terminal actually returned.
    const settled = settleEntry([], "شبكة", { rrn: "123456789012", authCode: "004521" }, 100)
    expect(annotateEntry(settled, "شبكة", "999")).toEqual(settled)
  })

  it("ignores modes that are not on the invoice", () => {
    expect(annotateEntry(cardEntry, "Cash", "999")).toEqual(cardEntry)
  })
})
