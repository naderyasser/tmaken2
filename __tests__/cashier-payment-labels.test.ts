/** Unit tests — payment-method display-name localization (UI layer; no record renaming). */
import { paymentMethodLabel } from "@/lib/cashier/payment-labels"

describe("paymentMethodLabel", () => {
  it("localizes an English-stored method to Arabic and English", () => {
    expect(paymentMethodLabel("Credit Card", "ar")).toBe("بطاقة ائتمان")
    expect(paymentMethodLabel("Credit Card", "en")).toBe("Credit card")
  })

  it("localizes an Arabic-stored method to English (and keeps Arabic)", () => {
    expect(paymentMethodLabel("بطاقة ائتمان", "en")).toBe("Credit card")
    expect(paymentMethodLabel("بطاقة ائتمان", "ar")).toBe("بطاقة ائتمان")
  })

  it("handles cash in both directions and both stored forms", () => {
    expect(paymentMethodLabel("Cash", "ar")).toBe("نقدي")
    expect(paymentMethodLabel("نقد", "en")).toBe("Cash")
  })

  it("is case-insensitive", () => {
    expect(paymentMethodLabel("MADA", "ar")).toBe("مدى")
    expect(paymentMethodLabel("bank transfer", "en")).toBe("Bank transfer")
  })

  it("falls back to the stored name for unknown/custom methods (no data loss)", () => {
    expect(paymentMethodLabel("Loyalty Points", "ar")).toBe("Loyalty Points")
    expect(paymentMethodLabel("قسيمة هدية", "en")).toBe("قسيمة هدية")
  })

  it("handles empty/undefined", () => {
    expect(paymentMethodLabel("", "en")).toBe("")
    expect(paymentMethodLabel(undefined, "ar")).toBe("")
  })
})
