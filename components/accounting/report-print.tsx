'use client'

// Shared «طباعة» for the accounting report pages. The flow is deliberate: the button
// opens a FULLSCREEN preview of the exact printable document first, and printing only
// happens from inside the preview (house rule: never blind window.print()).
// The document is a self-contained HTML string rendered into an <iframe srcDoc> — app
// CSS, portals and stacking contexts cannot leak into it, and printing the iframe
// window prints exactly what is previewed (window.print() on the app itself prints
// blank/garbage from inside portals — same lesson as the cashier receipt).
// Overlay sizing is inline styles on purpose (new-file utility classes can be missing
// from a stale built CSS).

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Printer, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { useBrand, printableLogo, type TenantBrand } from '@/hooks/use-brand'

export type PrintCell =
    | string
    | number
    | {
        text: string
        indent?: number
        bold?: boolean
        align?: 'start' | 'end'
    }

export interface PrintColumn {
    label: string
    align?: 'start' | 'end'
}

export interface PrintSection {
    heading?: string
    columns: PrintColumn[]
    rows: PrintCell[][]
    footer?: PrintCell[]
}

export interface PrintSummaryLine {
    label: string
    value: string
    strong?: boolean
}

export interface ReportPrintProps {
    title: string
    subtitle?: string
    /** context lines under the title: company, period, filters… */
    meta?: string[]
    sections: PrintSection[]
    /** totals block rendered after the tables (net income, VAT payable…) */
    summary?: PrintSummaryLine[]
    orientation?: 'portrait' | 'landscape'
    disabled?: boolean
    className?: string
    /** Paginated pages pass this so printing covers EVERYTHING, not just the visible
     *  page: awaited on click (spinner on the button), and whatever it returns
     *  overrides the static props. On failure the preview falls back to the visible
     *  rows rather than blocking the print. */
    loadSections?: () => Promise<Partial<Pick<ReportPrintProps, 'sections' | 'summary' | 'meta'>>>
}

/** Fetch every page of a Frappe list for printing: 500-row chunks until a short
 *  chunk, hard-capped at `cap` rows as a runaway guard. */
export async function fetchAllPages<T>(
    fetchPage: (limit_start: number, limit_page_length: number) => Promise<T[]>,
    cap = 5000,
): Promise<T[]> {
    const all: T[] = []
    const CHUNK = 500
    for (let start = 0; start < cap; start += CHUNK) {
        const chunk = await fetchPage(start, CHUNK)
        all.push(...chunk)
        if (chunk.length < CHUNK) break
    }
    return all
}

const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function cellHtml(cell: PrintCell, col: PrintColumn | undefined, tag: 'td' | 'th' = 'td'): string {
    const c = typeof cell === 'object' && cell !== null ? cell : { text: String(cell) }
    const align = c.align ?? col?.align ?? 'start'
    const pad = c.indent ? `padding-inline-start:${8 + c.indent * 14}px;` : ''
    const bold = c.bold ? 'font-weight:700;' : ''
    // end-aligned cells are numbers — keep digit runs LTR and monospaced
    const body = align === 'end'
        ? `<span class="num">${esc(c.text)}</span>`
        : esc(c.text)
    return `<${tag} style="text-align:${align};${pad}${bold}">${body}</${tag}>`
}

function buildHtml(p: ReportPrintProps, lang: 'ar' | 'en', brand: TenantBrand | null = null): string {
    const logo = printableLogo(brand)
    const brandName = brand?.appName || ''
    const accent = brand?.primaryColor || '#0f172a'
    const dir = lang === 'ar' ? 'rtl' : 'ltr'
    const printedAt = new Date().toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-GB')
    const orientation = p.orientation ?? 'portrait'

    const sectionsHtml = p.sections.map(s => {
        const head = `<thead><tr>${s.columns.map(c => cellHtml(c.label, c, 'th')).join('')}</tr></thead>`
        const body = `<tbody>${s.rows.map(r =>
            `<tr>${r.map((cell, i) => cellHtml(cell, s.columns[i])).join('')}</tr>`
        ).join('')}</tbody>`
        const foot = s.footer
            ? `<tfoot><tr>${s.footer.map((cell, i) => cellHtml(cell, s.columns[i])).join('')}</tr></tfoot>`
            : ''
        return `${s.heading ? `<h2 class="sec">${esc(s.heading)}</h2>` : ''}<table>${head}${body}${foot}</table>`
    }).join('')

    const summaryHtml = p.summary?.length
        ? `<div class="summary">${p.summary.map(l =>
            `<div class="line${l.strong ? ' strong' : ''}"><span>${esc(l.label)}</span><span class="num">${esc(l.value)}</span></div>`
        ).join('')}</div>`
        : ''

    return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8">
<title>${esc(p.title)}</title>
<style>
  @page { size: A4 ${orientation}; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, system-ui, sans-serif; color: #0f172a; margin: 0; padding: 24px; background: #fff; }
  @media print { body { padding: 0; } }
  .hdr { border-bottom: 2px solid ${accent}; padding-bottom: 10px; margin-bottom: 14px; }
  .letterhead { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
  .letterhead img { height: 48px; width: auto; max-width: 160px; object-fit: contain; }
  .letterhead .name { font-size: 15px; font-weight: 700; color: #0f172a; }
  .letterhead .tag { font-size: 11px; color: #64748b; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  .sub { color: #475569; font-size: 12px; margin: 0; }
  .meta { color: #475569; font-size: 11px; margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px 18px; }
  h2.sec { font-size: 14px; margin: 18px 0 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 8px; }
  thead { display: table-header-group; }
  th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 5px 7px; font-size: 10.5px; color: #334155; }
  td { border: 1px solid #e2e8f0; padding: 4px 7px; vertical-align: top; }
  tr { break-inside: avoid; }
  tfoot td { background: #f8fafc; font-weight: 700; border-top: 2px solid #94a3b8; }
  .num { direction: ltr; unicode-bidi: isolate; font-family: ui-monospace, Consolas, monospace; white-space: nowrap; }
  .summary { margin-top: 14px; margin-inline-start: auto; max-width: 430px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; break-inside: avoid; }
  .summary .line { display: flex; justify-content: space-between; gap: 24px; padding: 3px 0; font-size: 12px; }
  .summary .strong { font-weight: 700; border-top: 1px solid #cbd5e1; margin-top: 4px; padding-top: 7px; font-size: 13px; }
  .foot { margin-top: 18px; color: #94a3b8; font-size: 10px; display: flex; justify-content: space-between; gap: 16px; }
</style></head><body>
<div class="hdr">
  ${(logo || brandName) ? `<div class="letterhead">${logo ? `<img src="${esc(logo)}" alt="">` : ''}<div><div class="name">${esc(brandName)}</div>${brand?.tagline ? `<div class="tag">${esc(brand.tagline)}</div>` : ''}</div></div>` : ''}
  <h1>${esc(p.title)}</h1>
  ${p.subtitle ? `<p class="sub">${esc(p.subtitle)}</p>` : ''}
  ${p.meta?.length ? `<div class="meta">${p.meta.map(m => `<span>${esc(m)}</span>`).join('')}</div>` : ''}
</div>
${sectionsHtml}
${summaryHtml}
<div class="foot"><span>${lang === 'ar' ? 'تاريخ الطباعة' : 'Printed at'}: ${esc(printedAt)}</span><span>Meena ERP</span></div>
</body></html>`
}

export function ReportPrintButton(props: ReportPrintProps) {
    const brand = useBrand()
    const { lang } = useI18n()
    const locale: 'ar' | 'en' = lang === 'ar' ? 'ar' : 'en'
    const [open, setOpen] = useState(false)
    const [busy, setBusy] = useState(false)
    const [html, setHtml] = useState('')
    const iframeRef = useRef<HTMLIFrameElement>(null)

    const openPreview = async () => {
        let data: ReportPrintProps = props
        if (props.loadSections) {
            setBusy(true)
            try {
                data = { ...props, ...(await props.loadSections()) }
            } catch {
                // fall back to the currently visible rows
            } finally {
                setBusy(false)
            }
        }
        setHtml(buildHtml(data, locale, brand))
        setOpen(true)
    }

    const doPrint = () => {
        const win = iframeRef.current?.contentWindow
        if (!win) return
        win.focus()
        win.print()
    }

    const overlay = open && typeof document !== 'undefined'
        ? createPortal(
            <div
                dir={locale === 'ar' ? 'rtl' : 'ltr'}
                style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.8)', display: 'flex', flexDirection: 'column' }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: '#0f172a', color: '#fff', flexShrink: 0 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {locale === 'ar' ? 'معاينة قبل الطباعة' : 'Print preview'} — {props.title}
                    </span>
                    <Button size="sm" onClick={doPrint} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                        <Printer className="h-4 w-4 me-2" />
                        {locale === 'ar' ? 'طباعة' : 'Print'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setOpen(false)} className="bg-transparent text-white border-slate-500 hover:bg-slate-800 hover:text-white">
                        <X className="h-4 w-4 me-2" />
                        {locale === 'ar' ? 'إغلاق' : 'Close'}
                    </Button>
                </div>
                <iframe
                    ref={iframeRef}
                    title={props.title}
                    srcDoc={html}
                    style={{ flex: 1, width: '100%', border: 0, background: '#fff' }}
                />
            </div>,
            document.body
        )
        : null

    return (
        <>
            <Button
                variant="outline"
                size="sm"
                disabled={props.disabled || busy}
                onClick={openPreview}
                className={props.className}
            >
                {busy
                    ? <Loader2 className="h-4 w-4 me-1 animate-spin" />
                    : <Printer className="h-4 w-4 me-1" />}
                {locale === 'ar' ? 'طباعة' : 'Print'}
            </Button>
            {overlay}
        </>
    )
}
