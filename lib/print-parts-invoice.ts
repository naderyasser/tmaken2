/**
 * Faithful reproduction of the client's «فاتورة قطع غيار / Parts Invoice»
 * export (the 17-column landscape sheet their supplier system emits).
 *
 * Deliberately unbranded: no logo, no accent colour, no signature boxes — the
 * client approved the plain black-and-white sheet as-is, so this does NOT go
 * through printDoc()'s branded A4 letterhead template.
 *
 * The layout is denormalised exactly like the source: the six document-level
 * fields and the two document totals repeat on every line.
 */

import { printHtml } from './print-doc'

export interface PartsInvoiceLine {
    partNumber: string
    partName: string
    /** Issued Quantity — printed with 3 decimals, as the source does. */
    qty: string | number
    caseNumber: string
    unitPrice: string | number
    /** Dealer discount percentage off the unit price (the source runs 56–70%). */
    discountPct: string | number
}

export interface PartsInvoiceSpec {
    date: string
    soldToParty: string
    shipToParty: string
    salesOrderNumber: string
    invoiceNumber: string
    customerOrderNumber: string
    vatPercent: string | number
    lines: PartsInvoiceLine[]
}

const HEADERS = [
    'Date',
    'Sold to Party',
    'Ship to Party',
    'Sales Order Number',
    'Invoice Number',
    'Customer Order Number',
    'Total Net Price without VAT',
    'Total Net Price with VAT',
    'Part Number',
    'Part Name',
    'Issued Quantity',
    'Case Number',
    'Unit Price',
    'Discount %',
    'Net Price without VAT',
    'VAT %',
    'Net Price with VAT',
]

function esc(v: unknown): string {
    if (v === null || v === undefined) return ''
    return String(v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

const hasArabic = (s: string) => /[؀-ۿ]/.test(s)

// ── exact decimal arithmetic ────────────────────────────────────────────────
// The supplier's figures are computed in decimal, and six of the 89 lines in
// their reference invoice land on an exact .xx5 tie. Binary floats round those
// ties unpredictably (Math.round(3629.745 * 100) / 100 gives 3629.75, the
// supplier prints 3629.74), and a single wrong line desyncs the document
// totals, so everything below works on scaled BigInts instead.

// tsconfig targets ES6, so BigInt literals (0n) can't be used here; these are
// the constants the arithmetic below needs.
const B_ZERO = BigInt(0)
const B_ONE = BigInt(1)
const B_TWO = BigInt(2)
const B_1E4 = BigInt(10000)
const B_1E7 = BigInt(10000000)

/** "12.5" at 2dp → 1250n. Truncates beyond `dp`; non-numeric input → 0n. */
function scaled(v: string | number, dp: number): bigint {
    const str = String(v ?? '').trim()
    if (!/^-?\d*\.?\d*$/.test(str) || str === '' || str === '.' || str === '-') return B_ZERO
    const neg = str.startsWith('-')
    const [i, f = ''] = (neg ? str.slice(1) : str).split('.')
    const frac = (f + '0'.repeat(dp)).slice(0, dp)
    const out = BigInt((i || '0') + frac)
    return neg ? -out : out
}

/** num/den as an integer. Exact .5 ties resolve per `tie` — matched against the
 *  supplier's sheet: line nets round DOWN on a tie, VAT rounds UP. */
function divRound(num: bigint, den: bigint, tie: 'up' | 'down'): bigint {
    const q = num / den
    const twice = (num % den) * B_TWO
    if (twice > den) return q + B_ONE
    if (twice < den) return q
    return tie === 'up' ? q + B_ONE : q
}

/** Scaled BigInt → fixed-point string. The sheet uses no thousands separators
 *  (68457.96, never 68,457.96). */
function fmtScaled(v: bigint, dp: number): string {
    const neg = v < B_ZERO
    const digits = (neg ? -v : v).toString().padStart(dp + 1, '0')
    const out = dp ? `${digits.slice(0, -dp)}.${digits.slice(-dp)}` : digits
    return neg ? '-' + out : out
}

/** Net = qty x unit price x (1 - discount%), in cents. */
function netCents(l: PartsInvoiceLine): bigint {
    const q = scaled(l.qty, 3)
    const p = scaled(l.unitPrice, 2)
    let d = scaled(l.discountPct, 2)
    if (d < B_ZERO) d = B_ZERO
    if (d > B_1E4) d = B_1E4
    // q/1e3 * p/1e2 * (1e4-d)/1e4, expressed in cents → divide by 1e7.
    return divRound(q * p * (B_1E4 - d), B_1E7, 'down')
}

export function buildPartsInvoiceHtml(spec: PartsInvoiceSpec): string {
    const vat = scaled(spec.vatPercent, 2)
    const nets = spec.lines.map(netCents)
    const grosses = nets.map((n) => divRound(n * (B_1E4 + vat), B_1E4, 'up'))
    const totalNet = nets.reduce((t, n) => t + n, B_ZERO)
    const totalGross = grosses.reduce((t, n) => t + n, B_ZERO)

    const headCells = HEADERS.map((h) => `<th>${esc(h)}</th>`).join('')

    const bodyRows = spec.lines
        .map((l, i) => {
            const cells = [
                esc(spec.date),
                esc(spec.soldToParty),
                esc(spec.shipToParty),
                esc(spec.salesOrderNumber),
                esc(spec.invoiceNumber),
                esc(spec.customerOrderNumber),
                fmtScaled(totalNet, 2),
                fmtScaled(totalGross, 2),
                esc(l.partNumber),
                // Arabic part names must read RTL inside this otherwise-LTR sheet.
                `<span${hasArabic(l.partName || '') ? ' dir="rtl"' : ''}>${esc(l.partName)}</span>`,
                fmtScaled(scaled(l.qty, 3), 3),
                esc(l.caseNumber),
                fmtScaled(scaled(l.unitPrice, 2), 2),
                fmtScaled(scaled(l.discountPct, 2), 2),
                fmtScaled(nets[i], 2),
                fmtScaled(vat, 2),
                fmtScaled(grosses[i], 2),
            ]
            return '<tr>' + cells.map((c) => `<td>${c}</td>`).join('') + '</tr>'
        })
        .join('')

    return `<!DOCTYPE html>
<html dir="ltr" lang="en">
<head>
<meta charset="utf-8">
<title>${esc(spec.invoiceNumber || 'Parts Invoice')}</title>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Calibri, Arial, 'Noto Sans Arabic', sans-serif;
    color: #000; background: #fff; padding: 10mm 6mm;
  }
  .titles { text-align: center; margin-bottom: 14px; }
  .titles p { font-size: 13px; font-weight: 700; }
  table { border-collapse: collapse; width: 100%; }
  th, td {
    border: 1px solid #000; padding: 1px 3px; font-size: 7.2px;
    line-height: 1.35; text-align: left; white-space: nowrap;
  }
  th { font-weight: 700; vertical-align: bottom; }
  td span[dir="rtl"] { display: inline-block; }
  /* Repeat the column headers when the sheet spills onto further pages. */
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
</style>
</head>
<body>
  <div class="titles">
    <p>فاتورة قطع غيار</p>
    <p>Parts Invoice</p>
  </div>
  <table>
    <thead><tr>${headCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body>
</html>`
}

export function printPartsInvoice(spec: PartsInvoiceSpec): void {
    printHtml(buildPartsInvoiceHtml(spec))
}
