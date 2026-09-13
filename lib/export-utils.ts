/**
 * Table export helpers — CSV (Excel-openable) and print-to-PDF.
 *
 * No external dependencies on purpose:
 *  - CSV is written with a UTF-8 BOM so Excel detects the encoding and renders
 *    Arabic correctly (the #1 gotcha with Arabic CSVs).
 *  - "PDF" is produced by opening a print window with a clean HTML table and
 *    calling window.print(); the browser renders Arabic/RTL natively, which the
 *    client-side PDF libraries (jsPDF) famously do not.
 *
 * Runs only in the browser (client components).
 */

import { getBrandSync } from '@/hooks/use-brand'
import { letterheadCss, letterheadHtml } from '@/lib/print-letterhead'

export interface ExportColumn<T> {
  header: string
  value: (row: T) => string | number | null | undefined
  /** 'end' right-aligns numbers in the print view. */
  align?: 'start' | 'end' | 'center'
}

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v)
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Download `rows` as a UTF-8 (BOM) CSV that opens cleanly in Excel. */
export function exportRowsToCsv<T>(filename: string, columns: ExportColumn<T>[], rows: T[]): void {
  const header = columns.map((c) => csvCell(c.header)).join(',')
  const body = rows.map((r) => columns.map((c) => csvCell(c.value(r))).join(',')).join('\n')
  const BOM = String.fromCharCode(0xfeff) // UTF-8 BOM so Excel renders Arabic
  const content = BOM + header + '\n' + body
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`)
}

export interface PrintOptions {
  title: string
  subtitle?: string
  isRTL?: boolean
}

const escapeHtml = (s: unknown): string =>
  String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))

/**
 * Script injected into the print window. It fits the table onto exactly one
 * page, whatever the row count, and picks the orientation that allows the
 * larger scale before doing so.
 *
 * It has to run inside that window because only there can it measure the real
 * page box: a probe sized in mm and read back in px gives the true px-per-mm
 * ratio, which moves with zoom and device pixel ratio and cannot be hardcoded.
 *
 * The fit iterates because width and height are not independent — shrinking to
 * fit the height leaves the table in a narrow strip unless the layout width is
 * widened by the same factor, and widening changes how text wraps, which
 * changes the height. It converges in a few rounds.
 */
const ONE_PAGE_FIT_SCRIPT = `
(function () {
  var M = 8, MIN = 0.15;
  var fit = document.getElementById('fit'), page = document.getElementById('page');
  var pageStyle = document.getElementById('pagestyle');

  function pxPerMm() {
    var probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:100mm;height:100mm;visibility:hidden';
    document.body.appendChild(probe);
    var r = probe.getBoundingClientRect().height / 100;
    probe.remove();
    return r > 0 ? r : 96 / 25.4;
  }
  var ratio = pxPerMm();

  function naturalHeight() {
    return Math.max(fit.scrollHeight, fit.getBoundingClientRect().height);
  }

  function fitTo(wMm, hMm) {
    var availW = (wMm - 2 * M) * ratio, availH = (hMm - 2 * M) * ratio;
    fit.style.transform = 'none';
    var s = 1;
    for (var i = 0; i < 4; i++) {
      fit.style.width = (availW / s) + 'px';
      var next = Math.min(1, availH / Math.max(1, naturalHeight()));
      if (Math.abs(next - s) < 0.01) { s = next; break; }
      s = next;
    }
    return { s: Math.max(MIN, Math.min(1, s)), availW: availW, availH: availH };
  }

  // Landscape only wins if it is meaningfully roomier, so ordinary reports
  // stay portrait rather than flipping over a rounding difference.
  var portrait = fitTo(210, 297), landscape = fitTo(297, 210);
  var useLandscape = landscape.s > portrait.s * 1.05;
  var w = useLandscape ? 297 : 210, h = useLandscape ? 210 : 297;
  pageStyle.textContent = '@page{size:A4 ' + (useLandscape ? 'landscape' : 'portrait') + ';margin:' + M + 'mm}';

  var r = fitTo(w, h);
  fit.style.width = (r.availW / r.s) + 'px';
  fit.style.transformOrigin = 'top ' + (document.documentElement.dir === 'rtl' ? 'right' : 'left');

  // The scaled height belongs on the WRAPPER, never on #fit itself. A height
  // set on the transformed element lives in that element's own unscaled
  // coordinate space, so clipping it to an already-scaled value cuts the
  // content twice and silently drops rows. Taking #fit out of flow instead
  // does not work either: its full unscaled box still drives pagination.
  // A wrapper clips the child's *visual* (post-transform) box, which is
  // exactly what we want.
  var unscaled = naturalHeight();
  fit.style.transform = 'scale(' + r.s + ')';
  page.style.height = Math.min(unscaled * r.s, r.availH) + 'px';
  page.style.overflow = 'hidden';

  setTimeout(function () { window.print(); }, 150);
})();
`

/**
 * Open a print window with a styled HTML table and trigger the print dialog —
 * the user can then "Save as PDF". Arabic + RTL render correctly because it is
 * native browser HTML, not a canvas-based PDF generator.
 *
 * The table is scaled to land on a single page no matter how many rows it has.
 */
export function printRows<T>(opts: PrintOptions, columns: ExportColumn<T>[], rows: T[]): void {
  const dir = opts.isRTL ? 'rtl' : 'ltr'
  const start = opts.isRTL ? 'right' : 'left'
  const end = opts.isRTL ? 'left' : 'right'
  const cellAlign = (a?: string) => (a === 'end' ? end : a === 'center' ? 'center' : start)

  const thead = columns
    .map((c) => `<th style="text-align:${cellAlign(c.align)}">${escapeHtml(c.header)}</th>`)
    .join('')
  const tbody = rows
    .map(
      (r) =>
        '<tr>' +
        columns.map((c) => `<td style="text-align:${cellAlign(c.align)}">${escapeHtml(c.value(r))}</td>`).join('') +
        '</tr>',
    )
    .join('')

  const html = `<!doctype html><html dir="${dir}" lang="${opts.isRTL ? 'ar' : 'en'}"><head><meta charset="utf-8">
<title>${escapeHtml(opts.title)}</title>
<style id="pagestyle">@page{size:A4 portrait;margin:8mm}</style>
<style>
  *{box-sizing:border-box}
  body{font-family:'IBM Plex Sans Arabic','Segoe UI',Tahoma,Arial,sans-serif;margin:0;color:#0f172a}
  #page{overflow:hidden}
  #fit{transform-origin:top ${start}}
  h1{font-size:18px;margin:0 0 4px}
  .sub{color:#64748b;font-size:12px;margin:0 0 16px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th,td{border:1px solid #e2e8f0;padding:6px 9px;white-space:nowrap}
  thead th{background:#0F5132;color:#fff;font-weight:600}
  tbody tr:nth-child(even){background:#f6faf7}
  /* Row-level page breaking would defeat the scale and reintroduce page 2. */
  #fit,#fit *,table,thead,tbody,tr{page-break-inside:avoid!important;break-inside:avoid!important}
  thead{display:table-header-group}
  ${letterheadCss()}
</style></head><body>
  <div id="page"><div id="fit">
    ${letterheadHtml(getBrandSync())}
    <h1>${escapeHtml(opts.title)}</h1>
    ${opts.subtitle ? `<p class="sub">${escapeHtml(opts.subtitle)}</p>` : ''}
    <table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>
  </div></div>
  <script>window.onload=function(){${ONE_PAGE_FIT_SCRIPT}}</script>
</body></html>`

  const w = window.open('', '_blank')
  if (!w) return
  w.document.open()
  w.document.write(html)
  w.document.close()
}
