/**
 * Apex-style printed list/report for the HR (tamken) screens — the same look
 * as the server PDFs (hr_print), which match Apex's own printouts: company
 * name + VAT + CR in both corners, underlined centred title, period line, and
 * a black-bordered table with grey header/group rows.
 *
 * One document builder feeds every output of «طباعة» / «طباعة متقدمة» →
 * طباعة/PDF (browser print → "Save as PDF"), Word (.doc) and Excel (.xls):
 * all three open the same HTML, so what is exported is what is printed.
 */

import { frappeClient } from '@/lib/api-client'
import { printHtml } from '@/lib/print-doc'

export interface ApexPrintColumn { key: string; label: string; align?: 'start' | 'center' | 'end'; ltr?: boolean }
export interface ApexPrintGroup { title?: string; rows: Record<string, unknown>[] }
export interface ApexPrintSpec {
  title: string
  /** e.g. «من 01/09/2026 إلى 28/09/2026» */
  subtitle?: string
  columns: ApexPrintColumn[]
  /** flat rows, or grouped rows (a titled band per group, e.g. per employee/day) */
  rows?: Record<string, unknown>[]
  groups?: ApexPrintGroup[]
  lang?: 'ar' | 'en'
  /** Company docname — defaults to the user's default company */
  company?: string | null
}

type Letterhead = { name_ar: string; name_en: string; vat: string; cr: string }
const letterheadCache = new Map<string, Letterhead>()

/** base_meena.api.hr_print.letterhead — the exact header the server PDFs use. */
async function loadLetterhead(company?: string | null): Promise<Letterhead> {
  const key = company || ''
  if (letterheadCache.has(key)) return letterheadCache.get(key)!
  let lh: Letterhead = { name_ar: '', name_en: '', vat: '', cr: '' }
  try {
    const r: any = await frappeClient.call('base_meena.api.hr_print.letterhead', company ? { company } : {})
    lh = { ...lh, ...(r?.message || {}) }
  } catch { /* print without a letterhead rather than not at all */ }
  letterheadCache.set(key, lh)
  return lh
}

function esc(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function buildApexPrintHtml(spec: ApexPrintSpec): Promise<string> {
  const rtl = spec.lang !== 'en'
  const lh = await loadLetterhead(spec.company)
  const groups: ApexPrintGroup[] = spec.groups ?? [{ rows: spec.rows ?? [] }]
  const cols = spec.columns.length
  const thead = `<tr>${spec.columns.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr>`
  const body = groups.map((g) => {
    const band = g.title ? `<tr class="grp-row"><td colspan="${cols}">${esc(g.title)}</td></tr>` : ''
    return band + g.rows.map((r) => `<tr>${spec.columns.map((c) => `<td${c.ltr ? ' dir="ltr"' : ''}>${esc(r[c.key])}</td>`).join('')}</tr>`).join('')
  }).join('') || `<tr><td colspan="${cols}">${rtl ? 'لا توجد بيانات' : 'No data'}</td></tr>`
  const landscape = cols > 7

  // Same stylesheet as the server PDFs (base_meena/templates/hr_print/_style.html),
  // which was matched to Apex's own printouts: serif face, black 1.5px grid,
  // #d9d9d9 header/group rows, name + VAT + CR in both corners, underlined title.
  return `<!doctype html><html dir="${rtl ? 'rtl' : 'ltr'}" lang="${rtl ? 'ar' : 'en'}"><head><meta charset="utf-8"><title>${esc(spec.title)}</title>
<style>
  @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 8mm; }
  * { box-sizing: border-box; }
  body { font-family: 'FreeSerif', 'Times New Roman', 'Noto Naskh Arabic', serif; direction: ${rtl ? 'rtl' : 'ltr'}; color: #1e293b; font-size: 11px; margin: 0; }
  .lh { margin-bottom: 8px; padding-bottom: 6px; }
  .lh-row { display: table; table-layout: fixed; width: 100%; }
  .lh-side { display: table-cell; width: 50%; font-size: 11px; line-height: 1.6; vertical-align: top; }
  .lh-left { text-align: left; }
  .lh-name { font-weight: 700; font-size: 15px; margin-bottom: 2px; }
  .lh-title { text-align: center; font-weight: 700; text-decoration: underline; font-size: 16px; margin: 10px 0 6px; }
  .lh-filters { text-align: ${rtl ? 'right' : 'left'}; font-size: 11px; margin-bottom: 10px; }
  table.rpt { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  table.rpt th, table.rpt td { border: 1.5px solid #000; padding: 3px 4px; text-align: center; }
  table.rpt thead th { background: #d9d9d9; font-weight: 700; }
  table.rpt thead { display: table-header-group; }
  table.rpt tr { page-break-inside: avoid; }
  tr.grp-row td { background: #d9d9d9; font-weight: 700; padding: 5px 4px; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style></head><body>
  <div class="lh">
    <div class="lh-row">
      <div class="lh-side">
        <div class="lh-name">${esc(lh.name_ar)}</div>
        ${lh.vat ? `<div>رقم التسجيل الضريبي: ${esc(lh.vat)}</div>` : ''}
        ${lh.cr ? `<div>رقم السجل التجاري: ${esc(lh.cr)}</div>` : ''}
      </div>
      <div class="lh-side lh-left" dir="ltr">
        <div class="lh-name">${esc(lh.name_en)}</div>
        ${lh.vat ? `<div>VAT Number : ${esc(lh.vat)}</div>` : ''}
        ${lh.cr ? `<div>Commercial : ${esc(lh.cr)}</div>` : ''}
      </div>
    </div>
    <div class="lh-title">${esc(spec.title)}</div>
    ${spec.subtitle ? `<div class="lh-filters">${esc(spec.subtitle)}</div>` : ''}
  </div>
  <table class="rpt"><thead>${thead}</thead><tbody>${body}</tbody></table>
</body></html>`
}

export async function apexPrint(spec: ApexPrintSpec): Promise<void> {
  printHtml(await buildApexPrintHtml(spec))
}

function download(html: string, filename: string, type: string) {
  const blob = new Blob(['﻿' + html], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

export type ApexExportFormat = 'pdf' | 'image' | 'excel' | 'word'

/** «تصدير» → PDF/Image go through the print dialog (Save as PDF / picture),
 *  Excel/Word download the same document as .xls / .doc. */
export async function apexExport(spec: ApexPrintSpec, format: ApexExportFormat): Promise<void> {
  const html = await buildApexPrintHtml(spec)
  if (format === 'word') download(html, `${spec.title}.doc`, 'application/msword')
  else if (format === 'excel') download(html, `${spec.title}.xls`, 'application/vnd.ms-excel')
  else printHtml(html)
}
