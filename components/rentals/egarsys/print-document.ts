import { getBrandSync } from '@/hooks/use-brand'
import { injectLetterhead } from '@/lib/print-letterhead'

// Ported subset of egarsys src/lib/print-document.ts — only `printHtmlContent`,
// the helper the read-only report screens use to print a CLIENT-built HTML string
// via a hidden same-origin `<iframe srcdoc>` (no new tab → PWA-safe, no server
// round-trip → can't leak cross-tenant data). Verbatim behavior apart from the
// tenant letterhead stamped at entry (see lib/print-letterhead.ts).

/**
 * Print an HTML string built CLIENT-SIDE via a hidden same-origin `<iframe srcdoc>`
 * — no new tab (PWA-safe) and no server round-trip. Use when the document content
 * is already available on the client (e.g. the property statement, whose data was
 * fetched authenticated), so printing can't leak data and needs no print route.
 */
export function printHtmlContent(html: string): void {
  html = injectLetterhead(html, getBrandSync())
  try {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    Object.assign(iframe.style, {
      position: 'fixed',
      right: '0',
      bottom: '0',
      width: '0',
      height: '0',
      border: '0',
      opacity: '0',
    } as CSSStyleDeclaration)

    let removed = false
    const cleanup = () => {
      if (removed) return
      removed = true
      setTimeout(() => {
        try { iframe.parentNode?.removeChild(iframe) } catch { /* noop */ }
      }, 1500)
    }

    iframe.onload = () => {
      // Let the Arabic webfont settle before printing.
      setTimeout(() => {
        try {
          const win = iframe.contentWindow
          if (!win) throw new Error('no iframe contentWindow')
          win.onafterprint = cleanup
          win.focus()
          win.print()
          // afterprint is unreliable on some mobile browsers.
          setTimeout(cleanup, 60000)
        } catch {
          cleanup()
        }
      }, 400)
    }

    document.body.appendChild(iframe)
    iframe.srcdoc = html
  } catch {
    /* printing is best-effort — swallow */
  }
}
