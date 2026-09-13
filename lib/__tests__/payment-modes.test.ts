import { isCardMode, isCashMode, paymentModeKind } from "@/lib/cashier/payment-modes"

describe("payment-modes — cash", () => {
  it.each(["Cash", "cash", "  CASH  ", "نقدي", "نقداً", "نقد", "كاش", "Cash Sale"])(
    "classifies %p as cash",
    (name) => {
      expect(isCashMode(name)).toBe(true)
      expect(paymentModeKind(name)).toBe("cash")
    },
  )

  it("does not treat a card mode as cash", () => {
    expect(isCashMode("شبكة")).toBe(false)
    expect(isCashMode("Credit Card")).toBe(false)
  })
})

describe("payment-modes — card", () => {
  // The Saudi naming that the previous inline heuristic missed entirely.
  it.each(["شبكة", "الشبكة", "مدى", "مدي", "بطاقة مدى", "صراف آلي", "صراف الي", "نقاط بيع"])(
    "classifies Arabic mode %p as card",
    (name) => {
      expect(isCardMode(name)).toBe(true)
      expect(paymentModeKind(name)).toBe("card")
    },
  )

  it.each([
    "Card", "Credit Card", "Debit Card", "VISA", "Mastercard", "MADA",
    "Network", "POS",
  ])("classifies English mode %p as card", (name) => {
    expect(isCardMode(name)).toBe(true)
  })

  // Substring matching on short tokens is how false positives get in.
  it.each(["Deposit", "Ramadan Offer", "Composite", "Purpose"])(
    "does NOT mistake %p for a card mode",
    (name) => {
      expect(isCardMode(name)).toBe(false)
    },
  )

  it("classifies non-card, non-cash modes as other", () => {
    for (const name of ["Bank Transfer", "تحويل بنكي", "شيك", "Cheque", "Apple Pay"]) {
      expect(paymentModeKind(name)).toBe("other")
    }
  })

  it("resolves an ambiguous name to cash, never to the terminal", () => {
    // Mis-routing a cash sale to a card terminal is the worse error of the two.
    expect(paymentModeKind("Cash on card machine")).toBe("cash")
    expect(isCardMode("Cash on card machine")).toBe(false)
  })
})

describe("payment-modes — degenerate input", () => {
  it.each(["", "   ", null as unknown as string, undefined as unknown as string])(
    "treats %p as unclassifiable rather than throwing",
    (name) => {
      expect(isCashMode(name)).toBe(false)
      expect(isCardMode(name)).toBe(false)
      expect(paymentModeKind(name)).toBe("other")
    },
  )
})
