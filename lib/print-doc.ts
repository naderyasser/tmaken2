/**
 * A4 print helper for warehouse documents (سندات المخازن) — transfer notes,
 * material receipts, returns, purchase requests, reconciliation minutes and
 * stock reports. Renders a self-contained invoice-style HTML document into a
 * hidden iframe and calls print(), so it needs no popup permission and leaves
 * the app's DOM untouched.
 *
 * Every document printed through here carries the tenant's letterhead — logo,
 * name and tagline from clients.json via /sales-brand — unless the caller
 * overrides those fields explicitly. Callers do not have to remember to pass
 * the brand; the two that historically did (inventory) still can.
 */

import { loadBrand, printableLogo, type TenantBrand } from '@/hooks/use-brand'

export interface PrintColumn {
    key: string
    label: string
    align?: 'start' | 'center' | 'end'
    /** Force LTR rendering — required for part codes like 90311-T0015 which
     *  bidi would visually flip inside an RTL document. */
    ltr?: boolean
}

export interface PrintTotal {
    label: string
    value: string
    bold?: boolean
}

export interface PrintDocSpec {
    rtl?: boolean
    /** Header brand line — tenant display name (falls back to company). */
    brandName?: string
    /** Business-activity line rendered under the brand name. */
    brandTagline?: string | null
    logoUrl?: string | null
    /** Document type title, e.g. "إذن نقل مخزون". */
    title: string
    docNo?: string
    date?: string
    /** Label/value pairs rendered as a meta grid under the header. */
    meta?: Array<{ label: string; value: string }>
    columns: PrintColumn[]
    rows: Array<Record<string, unknown>>
    totals?: PrintTotal[]
    notes?: string
    /** Signature boxes at the bottom, e.g. ['أمين المستودع', 'المستلم']. */
    signatures?: string[]
    /** Accent color for headings/borders; defaults to the inventory orange. */
    accent?: string
}

function esc(v: unknown): string {
    if (v === null || v === undefined) return ''
    return String(v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function alignCss(a: PrintColumn['align'], rtl: boolean): string {
    if (a === 'center') return 'center'
    if (a === 'end') return rtl ? 'left' : 'right'
    return rtl ? 'right' : 'left'
}

export function printDoc(spec: PrintDocSpec): void {
    // Brand resolves from a per-page cache after the first fetch, so this is a
    // resolved promise in practice. The iframe print already ran from an async
    // onload callback, so nothing here moves it further from the user gesture.
    loadBrand().then((tenant) => renderAndPrint(spec, tenant))
}

function renderAndPrint(spec: PrintDocSpec, tenant: TenantBrand): void {
    const rtl = spec.rtl !== false
    // Explicit spec fields win; otherwise the tenant's own branding. The colour
    // falls back to the inventory orange the module always used.
    const accent = spec.accent || tenant.primaryColor || '#EA580C'
    const brand = spec.brandName || tenant.appName || ''
    const tagline = spec.brandTagline !== undefined ? spec.brandTagline : tenant.tagline
    const logoUrl = spec.logoUrl !== undefined ? spec.logoUrl : printableLogo(tenant)
    const now = new Date()
    const stamp = now.toLocaleString(rtl ? 'ar-SA-u-nu-latn' : 'en-GB')

    const metaHtml = (spec.meta || [])
        .filter((m) => m.value)
        .map(
            (m) => `<div class="meta-cell"><span class="meta-label">${esc(m.label)}</span><span class="meta-value">${esc(m.value)}</span></div>`
        )
        .join('')

    const headCells = spec.columns
        .map((c) => `<th style="text-align:${alignCss(c.align, rtl)}">${esc(c.label)}</th>`)
        .join('')

    const bodyRows = spec.rows
        .map((row, i) => {
            const cells = spec.columns
                .map((c) => `<td${c.ltr ? ' dir="ltr"' : ''} style="text-align:${alignCss(c.align, rtl)}${c.ltr ? ';font-family:ui-monospace,monospace' : ''}">${esc(row[c.key])}</td>`)
                .join('')
            return `<tr class="${i % 2 ? 'alt' : ''}">${cells}</tr>`
        })
        .join('')

    const totalsHtml = (spec.totals || [])
        .map(
            (t) => `<div class="total-row${t.bold ? ' total-bold' : ''}"><span>${esc(t.label)}</span><span>${esc(t.value)}</span></div>`
        )
        .join('')

    const signaturesHtml = (spec.signatures || [])
        .map((s) => `<div class="sig"><div class="sig-line"></div><p>${esc(s)}</p></div>`)
        .join('')

    const html = `<!DOCTYPE html>
<html dir="${rtl ? 'rtl' : 'ltr'}" lang="${rtl ? 'ar' : 'en'}">
<head>
<meta charset="utf-8">
<title>${esc(spec.title)}${spec.docNo ? ' - ' + esc(spec.docNo) : ''}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Tahoma, 'Noto Sans Arabic', Arial, sans-serif;
    color: #1f2937; font-size: 13px; line-height: 1.5; background: #fff;
  }
  .doc-header {
    display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 3px solid ${accent}; padding-bottom: 12px; margin-bottom: 14px;
  }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand img { height: 52px; width: auto; max-width: 170px; object-fit: contain; border-radius: 6px; }
  .brand-name { font-size: 18px; font-weight: 700; color: #111827; }
  .brand-tagline { font-size: 12px; color: #6b7280; margin-top: 2px; }
  .doc-id { text-align: ${rtl ? 'left' : 'right'}; }
  .doc-title { font-size: 20px; font-weight: 800; color: ${accent}; }
  .doc-no { font-size: 13px; color: #4b5563; margin-top: 2px; font-family: monospace; }
  .doc-date { font-size: 12px; color: #6b7280; margin-top: 2px; }
  .meta-grid {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px 16px;
    background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;
    padding: 10px 14px; margin-bottom: 14px;
  }
  .meta-cell { display: flex; gap: 6px; font-size: 12.5px; }
  .meta-label { color: #6b7280; white-space: nowrap; }
  .meta-label::after { content: ':'; }
  .meta-value { font-weight: 600; color: #111827; }
  table.items { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  table.items th {
    background: ${accent}; color: #fff; font-size: 12px; font-weight: 700;
    padding: 7px 10px; border: 1px solid ${accent};
  }
  table.items td { padding: 6px 10px; border: 1px solid #e5e7eb; font-size: 12.5px; }
  table.items tr.alt td { background: #f9fafb; }
  .totals { width: 46%; margin-${rtl ? 'right' : 'left'}: auto; margin-bottom: 14px; }
  .total-row {
    display: flex; justify-content: space-between; padding: 5px 10px;
    border-bottom: 1px solid #e5e7eb; font-size: 13px;
  }
  .total-bold { font-weight: 800; font-size: 14px; border-top: 2px solid ${accent}; border-bottom: none; color: ${accent}; }
  .notes { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 8px 12px; font-size: 12px; margin-bottom: 16px; }
  .notes-label { font-weight: 700; color: #92400e; }
  .sigs { display: flex; justify-content: space-around; gap: 20px; margin-top: 34px; }
  .sig { flex: 1; text-align: center; }
  .sig-line { border-bottom: 1.5px dotted #9ca3af; height: 34px; margin-bottom: 6px; }
  .sig p { font-size: 12px; color: #4b5563; font-weight: 600; }
  .doc-footer {
    margin-top: 26px; padding-top: 8px; border-top: 1px solid #e5e7eb;
    display: flex; justify-content: space-between; font-size: 10.5px; color: #9ca3af;
  }
  .empty { text-align: center; color: #9ca3af; padding: 18px; border: 1px dashed #e5e7eb; border-radius: 8px; margin-bottom: 14px; }
</style>
</head>
<body>
  <div class="doc-header">
    <div class="brand">
      ${logoUrl ? `<img src="${esc(logoUrl)}" alt="">` : ''}
      <div>
        <p class="brand-name">${esc(brand)}</p>
        ${tagline ? `<p class="brand-tagline">${esc(tagline)}</p>` : ''}
      </div>
    </div>
    <div class="doc-id">
      <p class="doc-title">${esc(spec.title)}</p>
      ${spec.docNo ? `<p class="doc-no">${esc(spec.docNo)}</p>` : ''}
      ${spec.date ? `<p class="doc-date">${esc(spec.date)}</p>` : ''}
    </div>
  </div>
  ${metaHtml ? `<div class="meta-grid">${metaHtml}</div>` : ''}
  ${
      spec.rows.length
          ? `<table class="items"><thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody></table>`
          : `<div class="empty">${rtl ? 'لا توجد بنود' : 'No items'}</div>`
  }
  ${totalsHtml ? `<div class="totals">${totalsHtml}</div>` : ''}
  ${spec.notes ? `<div class="notes"><span class="notes-label">${rtl ? 'ملاحظات: ' : 'Notes: '}</span>${esc(spec.notes)}</div>` : ''}
  ${signaturesHtml ? `<div class="sigs">${signaturesHtml}</div>` : ''}
  <div class="doc-footer">
    <span>${rtl ? 'تاريخ الطباعة' : 'Printed'}: ${esc(stamp)}</span>
    <span>${esc(brand)}</span>
  </div>
</body>
</html>`

    printHtml(html)
}

/** Render a complete HTML document in a hidden iframe and open the print
 *  dialog on it. Needs no popup permission and leaves the app's DOM untouched. */
export function printHtml(html: string): void {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)

    const cleanup = () => { try { iframe.remove() } catch { /* ignore */ } }
    iframe.onload = () => {
        try {
            const win = iframe.contentWindow
            if (!win) { cleanup(); return }
            win.focus()
            // Give the browser a beat to lay out fonts/images before printing.
            setTimeout(() => {
                try { win.print() } catch { /* ignore */ }
                // Keep the iframe alive while the (blocking) print dialog is open;
                // clean up on afterprint, with a long fallback for browsers that
                // never fire it inside iframes.
                try { win.addEventListener('afterprint', () => setTimeout(cleanup, 500)) } catch { /* ignore */ }
                setTimeout(cleanup, 120000)
            }, 250)
        } catch { cleanup() }
    }
    const doc = iframe.contentDocument
    if (!doc) { cleanup(); return }
    doc.open()
    doc.write(html)
    doc.close()
}
