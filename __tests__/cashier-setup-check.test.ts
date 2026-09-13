/** Unit tests — pre-go-live setup detection (read-only config guidance). */
import { evaluateSetup, looksLikeVanWarehouse } from "@/lib/cashier/setup-check"

describe("looksLikeVanWarehouse", () => {
  it.each([
    "Nader Yasser - Van - القرعاوي 1",
    "Sales Rep Vehicle",
    "مستودع مندوب المبيعات",
    "Delivery Van 3",
    "عربة التوصيل",
  ])("flags %s as a non-shop warehouse", (w) => {
    expect(looksLikeVanWarehouse(w)).toBe(true)
  })

  it.each(["Main Store - QRW", "Shop Floor", "المتجر الرئيسي", "Warehouse - Riyadh"])(
    "accepts %s as a normal warehouse",
    (w) => expect(looksLikeVanWarehouse(w)).toBe(false),
  )

  it("handles empty/undefined", () => {
    expect(looksLikeVanWarehouse("")).toBe(false)
    expect(looksLikeVanWarehouse(undefined)).toBe(false)
  })
})

describe("evaluateSetup", () => {
  it("ok when a shop warehouse has plenty of sellable items", () => {
    const r = evaluateSetup({ warehouse: "Main Store", sellableCount: 40, catalogCount: 46 })
    expect(r.ok).toBe(true)
    expect(r.issues).toEqual([])
  })

  it("flags a van warehouse as an error", () => {
    const r = evaluateSetup({ warehouse: "QRW - Van", sellableCount: 40, catalogCount: 46 })
    expect(r.ok).toBe(false)
    expect(r.issues.map(i => i.code)).toContain("van_warehouse")
    expect(r.issues.find(i => i.code === "van_warehouse")?.severity).toBe("error")
  })

  it("flags low sellable count (the 2-of-46 case)", () => {
    const r = evaluateSetup({ warehouse: "Main Store", sellableCount: 2, catalogCount: 46 })
    expect(r.issues.map(i => i.code)).toEqual(["low_sellable"])
  })

  it("reports BOTH issues for a van warehouse with no stock", () => {
    const r = evaluateSetup({ warehouse: "Nader - Van", sellableCount: 2, catalogCount: 46 })
    expect(r.issues.map(i => i.code).sort()).toEqual(["low_sellable", "van_warehouse"])
  })

  it("flags a missing warehouse", () => {
    const r = evaluateSetup({ warehouse: "", sellableCount: 0, catalogCount: 46 })
    expect(r.issues.map(i => i.code)).toContain("no_warehouse")
  })

  it("does NOT warn on low sellable when the catalog hasn't loaded (offline)", () => {
    const r = evaluateSetup({ warehouse: "Main Store", sellableCount: 0, catalogCount: 0 })
    expect(r.issues.map(i => i.code)).not.toContain("low_sellable")
  })

  it("respects a custom threshold", () => {
    expect(evaluateSetup({ warehouse: "Main", sellableCount: 8, catalogCount: 46, threshold: 10 }).issues.map(i => i.code)).toContain("low_sellable")
    expect(evaluateSetup({ warehouse: "Main", sellableCount: 8, catalogCount: 46, threshold: 5 }).ok).toBe(true)
  })
})
