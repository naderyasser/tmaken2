/**
 * Thermal receipt printing — dedicated print pipeline for the till.
 *
 * WHY: the old approach called window.print() on the app page with CSS that hid
 * "everything except #receipt-print-root". The receipt lives inside a Radix Sheet
 * PORTAL (a direct <body> child that is NOT the receipt root), so the rule hid the
 * portal — and the preview printed a BLANK page, in landscape, with app chrome rules
 * fighting the roll width.
 *
 * FIX: render a fully self-contained HTML document (inline styles only) into a hidden
 * IFRAME and print THE IFRAME. Nothing from the app can leak in or hide it; portrait is
 * guaranteed by `@page { size: <roll-width> auto }`; RTL is set on the document itself.
 *
 * Real hardware: any thermal printer exposed as a system printer (USB/driver, RawBT on
 * Android, or QZ-Tray/ESC-POS bridges) receives this exactly like a normal print job —
 * see docs/CASHIER_PRINTING.md for the validation checklist.
 */

import { fmtCurrency } from "@/lib/cashier-utils"
import type { PaymentEntry } from "@/lib/cashier-api"

export type RollWidth = "58" | "80"

const WIDTH_KEY = "cashier_paper_width"

export function getRollWidth(): RollWidth {
  try { return (localStorage.getItem(WIDTH_KEY) as RollWidth) === "58" ? "58" : "80" } catch { return "80" }
}
export function setRollWidth(w: RollWidth): void {
  try { localStorage.setItem(WIDTH_KEY, w) } catch { /* */ }
}

export interface PrintLine {
  name: string
  qty: number
  rate: number
  amount: number
}

export interface PrintReceipt {
  title?: string            // e.g. "إيصال" / "RETURN NOTE"
  /** Tenant logo printed above the company name. Omit for an unbranded receipt. */
  logoUrl?: string | null
  company: string
  companyAddress?: string
  vatNumber?: string
  invoiceNumber: string
  date: string
  time: string
  cashierName?: string
  customer?: string
  items: PrintLine[]
  subtotal: number
  discount?: number
  taxAmount?: number
  grandTotal: number
  payments?: PaymentEntry[]
  changeAmount?: number
  qrDataUrl?: string         // ZATCA QR as a data: URL (optional)
  footerNote?: string
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/** Build the self-contained printable document. Portrait is enforced by @page size
 *  (roll width × auto height); margins kept tiny for thermal rollers. */
export function buildReceiptHtml(
  r: PrintReceipt,
  opts: { lang?: "ar" | "en"; width?: RollWidth } = {},
): string {
  const lang = opts.lang ?? "ar"
  const dir = lang === "ar" ? "rtl" : "ltr"
  const width = opts.width ?? getRollWidth()
  const mm = width === "58" ? 58 : 80
  const L = lang === "ar"
    ? { item: "الصنف", qty: "كمية", price: "سعر", total: "الإجمالي", subtotal: "المجموع الفرعي", discount: "الخصم", vat: "الضريبة", paid: "المدفوع", change: "الباقي", cashier: "الكاشير", customer: "العميل", invoice: "فاتورة", vatno: "الرقم الضريبي", thanks: "شكراً لزيارتكم" }
    : { item: "Item", qty: "Qty", price: "Price", total: "TOTAL", subtotal: "Subtotal", discount: "Discount", vat: "VAT", paid: "Paid", change: "Change", cashier: "Cashier", customer: "Customer", invoice: "Invoice", vatno: "VAT No.", thanks: "Thank you" }

  const rows = r.items.map(it => `
      <tr>
        <td class="nm">${esc(it.name)}</td>
        <td class="n">${esc(it.qty)}</td>
        <td class="n">${esc(fmtCurrency(it.rate))}</td>
        <td class="n">${esc(fmtCurrency(it.amount))}</td>
      </tr>`).join("")

  // A card line prints its approval underneath: the customer's copy has to carry the
  // reference, and it is what a dispute is settled with.
  const payRef = (p: PaymentEntry) => {
    const ref = p.reference
    if (!ref) return ""
    const bits = [
      ref.rrn ? `RRN ${ref.rrn}` : "",
      ref.authCode ? `AUTH ${ref.authCode}` : "",
      ref.maskedPan ? `${ref.scheme ?? ""} ${ref.maskedPan}`.trim() : "",
    ].filter(Boolean)
    if (bits.length === 0) return ""
    return `
      <div class="row payref" dir="ltr"><span>${esc(bits.join("  "))}</span></div>`
  }

  const pays = (r.payments ?? []).map(p => `
      <div class="row"><span>${esc(p.mode_of_payment)}</span><span>${esc(fmtCurrency(p.amount))}</span></div>${payRef(p)}`).join("")

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8">
<title>${esc(r.invoiceNumber)}</title>
<style>
  /* PORTRAIT on a thermal roll: page width = roll width, height grows with content. */
  @page { size: ${mm}mm auto; margin: 2mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    width: ${mm - 4}mm;
    font-family: "Tahoma", "Segoe UI", system-ui, sans-serif; /* solid Arabic glyphs on thermal drivers */
    font-size: ${width === "58" ? "9.5px" : "11px"};
    color: #000;
    direction: ${dir};
  }
  .c { text-align: center; }
  .b { font-weight: 700; }
  .xl { font-size: 1.25em; }
  .muted { color: #000; opacity: .85; }
  hr { border: 0; border-top: 1px dashed #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 1px 2px; vertical-align: top; }
  th { border-bottom: 1px solid #000; text-align: start; font-size: .92em; }
  td.n, th.n { text-align: end; white-space: nowrap; }
  td.nm { word-break: break-word; }
  .row { display: flex; justify-content: space-between; gap: 4px; }
  /* must follow .row: same specificity, so source order decides the override */
  .payref { justify-content: flex-start; font-size: 9px; color: #444; }
  .total { font-size: 1.3em; font-weight: 800; border-top: 1px solid #000; padding-top: 3px; margin-top: 3px; }
  img.qr { width: ${width === "58" ? "26mm" : "30mm"}; height: auto; margin: 4px auto; display: block; }
  /* Tenant logo: capped so a 58mm roll keeps room for the name; thermal heads
     print it as dithered greyscale, which is fine for a mark this size. */
  img.logo { max-width: ${width === "58" ? "30mm" : "40mm"}; max-height: 16mm; height: auto; margin: 0 auto 2px; display: block; object-fit: contain; }
</style>
</head>
<body>
  ${r.logoUrl ? `<img class="logo" src="${esc(r.logoUrl)}" alt="">` : ""}
  <div class="c b xl">${esc(r.company)}</div>
  ${r.companyAddress ? `<div class="c muted">${esc(r.companyAddress)}</div>` : ""}
  ${r.vatNumber ? `<div class="c muted">${L.vatno}: <span dir="ltr">${esc(r.vatNumber)}</span></div>` : ""}
  ${r.title ? `<div class="c b">${esc(r.title)}</div>` : ""}
  <hr>
  <div class="row"><span>${L.invoice}</span><span class="b" dir="ltr">${esc(r.invoiceNumber)}</span></div>
  <div class="row"><span dir="ltr">${esc(r.date)} ${esc(r.time)}</span><span>${r.cashierName ? `${L.cashier}: ${esc(r.cashierName)}` : ""}</span></div>
  ${r.customer ? `<div class="row"><span>${L.customer}</span><span>${esc(r.customer)}</span></div>` : ""}
  <hr>
  <table>
    <thead><tr><th>${L.item}</th><th class="n">${L.qty}</th><th class="n">${L.price}</th><th class="n">${L.total}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <hr>
  <div class="row"><span>${L.subtotal}</span><span>${esc(fmtCurrency(r.subtotal))}</span></div>
  ${r.discount ? `<div class="row"><span>${L.discount}</span><span>-${esc(fmtCurrency(r.discount))}</span></div>` : ""}
  ${r.taxAmount ? `<div class="row"><span>${L.vat}</span><span>${esc(fmtCurrency(r.taxAmount))}</span></div>` : ""}
  <div class="row total"><span>${L.total}</span><span>${esc(fmtCurrency(r.grandTotal))}</span></div>
  ${pays ? `<hr><div class="b">${L.paid}</div>${pays}` : ""}
  ${r.changeAmount ? `<div class="row b"><span>${L.change}</span><span>${esc(fmtCurrency(r.changeAmount))}</span></div>` : ""}
  ${r.qrDataUrl ? `<img class="qr" src="${r.qrDataUrl}" alt="ZATCA QR">` : ""}
  <hr>
  <div class="c">${esc(r.footerNote ?? L.thanks)}</div>
</body>
</html>`
}

/** Print a self-contained HTML document via a hidden iframe (the fix for the blank
 *  preview). The iframe is kept in the DOM briefly after printing so tests can assert
 *  its content; returns true when the print call was dispatched. */
export function printHtml(html: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const frame = document.createElement("iframe")
      frame.setAttribute("data-cashier-print", "1")
      // hidden but RENDERABLE (display:none iframes print blank in some engines)
      frame.style.cssText = "position:fixed;inset-inline-end:0;bottom:0;width:1px;height:1px;opacity:0.01;border:0;pointer-events:none;"
      document.body.appendChild(frame)
      const doc = frame.contentDocument
      if (!doc) { frame.remove(); resolve(false); return }
      doc.open(); doc.write(html); doc.close()
      const fire = () => {
        try {
          frame.contentWindow?.focus()
          frame.contentWindow?.print()
          resolve(true)
        } catch { resolve(false) }
        // leave it long enough for the dialog to grab the content + tests to inspect
        setTimeout(() => frame.remove(), 4000)
      }
      // wait for layout (and any QR <img>) before printing
      if (doc.readyState === "complete") setTimeout(fire, 120)
      else frame.onload = () => setTimeout(fire, 120)
    } catch {
      resolve(false)
    }
  })
}

/** Sample receipt for the diagnostics "Test Print" — validates the full path on the
 *  customer's actual roller without making a sale. */
export function buildTestReceipt(lang: "ar" | "en"): PrintReceipt {
  return {
    company: lang === "ar" ? "طباعة تجريبية — كاشير تمكين" : "TEST PRINT — Tamkeen POS",
    invoiceNumber: "TEST-0000",
    date: new Date().toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US"),
    time: new Date().toLocaleTimeString(lang === "ar" ? "ar-SA" : "en-US"),
    cashierName: "—",
    items: [
      { name: lang === "ar" ? "صنف تجريبي ١" : "Sample item 1", qty: 1, rate: 10, amount: 10 },
      { name: lang === "ar" ? "صنف تجريبي ٢ باسم طويل جداً لاختبار الالتفاف" : "Sample item 2 with a very long name to test wrapping", qty: 2.5, rate: 4, amount: 10 },
    ],
    subtotal: 20,
    taxAmount: 3,
    grandTotal: 23,
    payments: [{ mode_of_payment: lang === "ar" ? "نقدي" : "Cash", amount: 25 }],
    changeAmount: 2,
    footerNote: lang === "ar" ? "إذا طُبع هذا الإيصال كاملاً وبالاتجاه الصحيح فالطابعة جاهزة ✓" : "If this printed fully and correctly, the printer is ready ✓",
  }
}
