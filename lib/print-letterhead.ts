/**
 * Tenant letterhead for browser-rendered print documents.
 *
 * The platform has several independent print engines — the A4 document printer
 * (lib/print-doc.ts), thermal receipts (lib/cashier/print.ts), the accounting
 * report printer, the cashier X-report, egarsys contracts. Each builds its own
 * HTML, so each used to print with no idea which tenant it belonged to. This is
 * the one snippet they all stamp at the top so every printed page carries the
 * tenant's logo and name, and so a future engine has something to reach for
 * instead of inventing a fourth header.
 *
 * Frappe's own print formats (/printview) are branded separately, through the
 * tenant's default Letter Head — see base_meena.branding.letterhead. Both read
 * the same clients.json brand, so the two paths stay consistent.
 */

import { printableLogo, type TenantBrand } from '@/hooks/use-brand'

const esc = (v: unknown) =>
    String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')

export interface LetterheadOptions {
    /** 'receipt' = narrow thermal roll (centred, small); 'page' = A4 (row layout). */
    layout?: 'page' | 'receipt'
    /** Override the accent used for the rule under the letterhead. */
    accent?: string
}

/** CSS for the letterhead; include once in the document <style>. */
export function letterheadCss(opts: LetterheadOptions = {}): string {
    if (opts.layout === 'receipt') {
        return `
  .bm-letterhead { text-align: center; margin-bottom: 4px; }
  .bm-letterhead img { max-width: 36mm; max-height: 16mm; height: auto; display: block; margin: 0 auto 2px; object-fit: contain; }
  .bm-letterhead .bm-name { font-weight: 800; font-size: 1.15em; }
  .bm-letterhead .bm-tag { font-size: .85em; color: #444; }`
    }
    const accent = opts.accent || '#111111'
    return `
  .bm-letterhead { display: flex; align-items: center; gap: 12px; padding-bottom: 8px; margin-bottom: 10px; border-bottom: 2px solid ${esc(accent)}; }
  .bm-letterhead img { height: 48px; width: auto; max-width: 160px; object-fit: contain; }
  .bm-letterhead .bm-name { font-size: 15px; font-weight: 700; color: #111; }
  .bm-letterhead .bm-tag { font-size: 11px; color: #666; }`
}

/**
 * The letterhead markup, or '' when the tenant has no branding at all — so an
 * unbranded tenant prints exactly what it printed before.
 */
export function letterheadHtml(brand: TenantBrand | null): string {
    const logo = printableLogo(brand)
    const name = brand?.appName || ''
    if (!logo && !name) return ''
    return `<div class="bm-letterhead">${logo ? `<img src="${esc(logo)}" alt="">` : ''}<div>${
        name ? `<div class="bm-name">${esc(name)}</div>` : ''
    }${brand?.tagline ? `<div class="bm-tag">${esc(brand.tagline)}</div>` : ''}</div></div>`
}

/**
 * Stamp the letterhead into a complete HTML document built by someone else.
 *
 * For engines that assemble their whole page as a string and hand it to a
 * printer (the egarsys rentals screens do this for contracts, statements and
 * ledgers). Inserts the CSS before </head> and the markup right after <body>;
 * if the document has no <head>, the style block rides inside the body instead
 * so the letterhead is still styled. A document that already carries a
 * letterhead, or a tenant with no branding, is returned untouched.
 */
export function injectLetterhead(html: string, brand: TenantBrand | null, opts: LetterheadOptions = {}): string {
    const markup = letterheadHtml(brand)
    if (!markup || html.includes('bm-letterhead')) return html

    const style = `<style>${letterheadCss(opts)}</style>`
    let out = html
    if (/<\/head>/i.test(out)) {
        out = out.replace(/<\/head>/i, `${style}</head>`)
        return out.replace(/<body[^>]*>/i, (m) => `${m}${markup}`)
    }
    // No <head>: keep everything together after <body> (or at the very top).
    return /<body[^>]*>/i.test(out)
        ? out.replace(/<body[^>]*>/i, (m) => `${m}${style}${markup}`)
        : `${style}${markup}${out}`
}
