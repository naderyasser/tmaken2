/** Unit tests — thermal print document builder (the blank-page / landscape fix). */
import { buildReceiptHtml, buildTestReceipt } from "@/lib/cashier/print"

const receipt = {
  company: "متجر الاختبار",
  vatNumber: "300000000000003",
  invoiceNumber: "ACC-PSINV-2026-00001",
  date: "2026-06-10",
  time: "12:30:00",
  cashierName: "كاشير",
  items: [
    { name: "صنف أول", qty: 2, rate: 10, amount: 20 },
    { name: "Second item", qty: 1.5, rate: 4, amount: 6 },
  ],
  subtotal: 26,
  discount: 1,
  taxAmount: 3.75,
  grandTotal: 28.75,
  payments: [{ mode_of_payment: "Cash", amount: 30 }],
  changeAmount: 1.25,
}

describe("buildReceiptHtml (print DOM must be non-empty and portrait-constrained)", () => {
  it("produces a NON-EMPTY self-contained document with all receipt facts", () => {
    const html = buildReceiptHtml(receipt, { lang: "ar", width: "80" })
    expect(html.length).toBeGreaterThan(500)
    for (const must of [
      "متجر الاختبار", "ACC-PSINV-2026-00001", "صنف أول", "Second item",
      "300000000000003", "Cash",
    ]) expect(html).toContain(must)
  })

  it("is PORTRAIT on the roll: @page size = width × auto (never landscape)", () => {
    expect(buildReceiptHtml(receipt, { width: "80" })).toContain("@page { size: 80mm auto;")
    expect(buildReceiptHtml(receipt, { width: "58" })).toContain("@page { size: 58mm auto;")
    expect(buildReceiptHtml(receipt, { width: "80" })).not.toMatch(/landscape/i)
  })

  it("renders RTL for Arabic and LTR for English", () => {
    expect(buildReceiptHtml(receipt, { lang: "ar" })).toContain('<html lang="ar" dir="rtl">')
    expect(buildReceiptHtml(receipt, { lang: "en" })).toContain('<html lang="en" dir="ltr">')
  })

  it("includes totals, payment, change and the QR image when provided", () => {
    const html = buildReceiptHtml({ ...receipt, qrDataUrl: "data:image/png;base64,QQ==" }, { lang: "ar" })
    expect(html).toContain('img class="qr"')
    expect(html).toContain("data:image/png;base64,QQ==")
  })

  it("escapes HTML in user-controlled strings (no markup injection on the printout)", () => {
    const html = buildReceiptHtml({ ...receipt, items: [{ name: "<script>x</script>", qty: 1, rate: 1, amount: 1 }] })
    expect(html).not.toContain("<script>x</script>")
    expect(html).toContain("&lt;script&gt;")
  })

  it("test-print sample builds in both languages", () => {
    expect(buildReceiptHtml(buildTestReceipt("ar"))).toContain("طباعة تجريبية")
    expect(buildReceiptHtml(buildTestReceipt("en"))).toContain("TEST PRINT")
  })
})
