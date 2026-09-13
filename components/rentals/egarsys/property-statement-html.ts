import { formatSAR, formatDate, formatHijri, installmentLabelAr } from './format'

// Ported 1:1 from egarsys src/lib/property-statement-html.ts. Only the format
// import path changed (@/lib/format → ./format). Pure (no DB, no DOM) builders
// for the printable كشف حساب / جرد / سجل حركات documents + the view types the
// section, dialogs and printer share.

export interface StatementView {
  property: {
    id: string
    internalId: number
    deedNumber: string | null
    shopNumber: string | null
    title: string
    titleAr: string | null
    propertyType: string
    status: string
    address: string
    city: string
    district: string | null
    unitsCount: number
    owner: { id: string; name: string | null; phone?: string | null } | null
  }
  timeline: Array<{
    contractId: string
    contractNumber: string
    internalId: number
    ejarContractNumber: string | null
    tenantName: string | null
    startDate: string
    endDate: string
    status: string
    statusLabelAr: string
    isDeparted: boolean
    invoiced: number
    collected: number
    dueToDate: number
    outstanding: number
    overdueTotal: number
  }>
  overdueUninvoiced: Array<{
    contractId: string
    contractNumber: string
    tenantName: string | null
    installmentNo: number
    dueDateAD: string
    dueDateAH: string
    amount: number
  }>
  debtTotal: number
  summary: {
    totalRentsContracted: number
    totalInvoiced: number
    totalCollected: number
    totalCollectedBase: number
    totalCollectedVat: number
    totalVat: number
    totalExpenses: number
    expenseByCategory: Array<{ category: string; amount: number }>
    creditNotesTotal: number
  }
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Normalise a Date or ISO string to "YYYY-MM-DD" (what format.ts expects).
function ymd(d: string | Date): string {
  const dt = d instanceof Date ? d : new Date(d)
  if (isNaN(dt.getTime())) return typeof d === 'string' ? d : ''
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

function dual(d: string | Date): string {
  const iso = ymd(d)
  const g = formatDate(iso)
  const h = formatHijri(iso) // already carries the " هـ" suffix; '—' when empty
  return h && h !== '—' ? `${g} · ${h}` : g
}

export interface InventoryRowView {
  id: string
  internalId: number
  deedNumber: string | null
  shopNumber: string | null
  title: string
  city: string
  currentTenant: string | null
  contractsCount: number
  debtTotal: number
  invoiced: number
  collected: number
}
export interface InventoryTotalsView {
  properties: number
  contracts: number
  activeContracts?: number
  debtTotal: number
  invoiced: number
  collected: number
}

// ---- سجل حركات العقار (ledger) ----
export interface LedgerEntryView {
  date: string
  type: 'contract' | 'invoice' | 'credit_note' | 'payment' | 'expense'
  label: string
  amount: number
  vat?: number
  cancelled?: boolean
  refs: {
    contractNumber?: string
    invoiceNumber?: string
    installmentNo?: number
    tenantName?: string | null
    category?: string | null
    supplierName?: string | null
    voucherNumber?: string | null
  }
}
export interface LedgerView {
  property: {
    id: string
    internalId: number
    deedNumber: string | null
    shopNumber: string | null
    title: string
    city: string
    owner: { id: string; name: string | null } | null
  }
  entries: LedgerEntryView[]
  summary: {
    totalInvoiced: number
    totalVat: number
    totalCollected: number
    totalExpenses: number
    creditNotesTotal: number
    cancelledCount: number
    net: number
  }
}

export const LEDGER_TYPE_LABELS: Record<LedgerEntryView['type'], string> = {
  contract: 'عقد',
  invoice: 'فاتورة',
  credit_note: 'إشعار دائن',
  payment: 'سداد',
  expense: 'مصروف',
}

function ledgerRef(e: LedgerEntryView): string {
  return e.refs.invoiceNumber || e.refs.voucherNumber || e.refs.contractNumber || '—'
}

// ---- كشف حساب العقد بالرقم الآلي (contract-reference statement) ----
export interface ContractReferenceView {
  referenceNo: number
  current: { contractId: string; contractNumber: string; tenantName: string | null; status: string; statusLabelAr: string }
  property: { id: string; internalId: number; title: string } | null
  succession: Array<{
    contractId: string
    contractNumber: string
    ejarContractNumber: string | null
    tenantName: string | null
    startDate: string
    endDate: string
    status: string
    statusLabelAr: string
    isDeparted: boolean
    isRenewal: boolean
    invoiced: number
    collected: number
    dueToDate: number
    outstanding: number
    overdueTotal: number
    schedule: InstallmentView[]
    nextDueNo: number | null
  }>
  overdueUninvoiced: Array<{
    contractId: string
    contractNumber: string
    tenantName: string | null
    installmentNo: number
    dueDateAD: string
    dueDateAH: string
    amount: number
  }>
  debtTotal: number
  entries: LedgerEntryView[]
  summary: {
    totalInvoiced: number
    totalVat: number
    totalCollected: number
    totalCollectedBase: number
    totalCollectedVat: number
    totalExpenses: number
    creditNotesTotal: number
    cancelledCount: number
    contractedRent: number
  }
}

export type InstallmentStateView = 'paid' | 'invoiced' | 'invoiced_overdue' | 'settled' | 'overdue' | 'next' | 'upcoming'
export interface InstallmentView {
  installmentNo: number
  dueDateAD: string
  dueDateAH: string
  rentValue: number
  vat: number
  amount: number
  state: InstallmentStateView
  /** ISO تاريخ السداد for installments settled via an explicit paid-previously record
   *  («مدفوع مسبقاً» logged with its historical date). null for every other row. */
  paidPreviouslyDate?: string | null
}

/**
 * Arabic label for each installment state (client-confirmed strict wording 2026-07-10).
 * `upcoming` is deliberately EMPTY — future installments stay blank until their turn.
 */
export const INSTALLMENT_STATE_LABELS: Record<InstallmentStateView, string> = {
  paid: 'مدفوع بفاتورة',
  invoiced: 'مفوترة — بانتظار السداد',
  invoiced_overdue: 'مفوترة ولم تُسدد',
  settled: 'مدفوع مسبقاً',
  overdue: 'متأخرة ولم تُسدد',
  next: 'القسط القادم',
  upcoming: '',
}

export interface ReferenceJardRowView {
  referenceNo: number
  generations: number
  currentTenant: string | null
  currentContractNumber: string
  currentStatus: string
  property: { id: string; internalId: number; title: string } | null
  debtTotal: number
  collected: number
}

/** Printable جرد بالعقود — official tabular summary of all reference chains. */
export function buildReferenceJardHtml(opts: {
  rows: ReferenceJardRowView[]
  totals: { references: number; generations: number; debtTotal: number; collected: number }
  companyName?: string | null
  dateLabel: string
}): string {
  const { rows, totals, companyName, dateLabel } = opts
  const body = rows.length
    ? rows
        .map(
          (r) => `<tr${r.debtTotal > 0 ? ' class="owing"' : ''}>
      <td dir="ltr">${r.referenceNo}</td>
      <td>${esc(r.currentTenant || '—')}</td>
      <td dir="ltr">${esc(r.currentContractNumber)}</td>
      <td>${esc(r.property?.title || '—')}</td>
      <td dir="ltr">${r.generations}</td>
      <td class="${r.debtTotal > 0 ? 'red' : 'green'}">${r.debtTotal > 0 ? formatSAR(r.debtTotal) : '✓'}</td>
      <td>${r.collected > 0 ? formatSAR(r.collected) : '—'}</td>
    </tr>`,
        )
        .join('')
    : `<tr><td colspan="7" class="empty">لا توجد عقود</td></tr>`

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>جرد بالعقود${companyName ? ' — ' + esc(companyName) : ''}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "IBM Plex Sans Arabic","Segoe UI",Tahoma,Arial,sans-serif; color:#0f172a; margin:0; padding:24px; font-size:12px; }
  h1 { font-size:18px; margin:0 0 2px; }
  .muted { color:#64748b; font-size:11px; }
  table { width:100%; border-collapse:collapse; font-size:11px; margin-top:12px; }
  th,td { border:1px solid #e2e8f0; padding:6px 8px; text-align:right; }
  thead th { background:#f1f5f9; font-weight:700; }
  tr.owing { background:#fef2f2; }
  .red { color:#b91c1c; font-weight:700; }
  .green { color:#15803d; }
  .empty { text-align:center; color:#94a3b8; }
  tfoot td { background:#f8fafc; font-weight:800; }
  @media print { body { padding:0; } tr { page-break-inside:avoid; } }
</style>
</head>
<body>
  <h1>جرد بالعقود${companyName ? ' — ' + esc(companyName) : ''}</h1>
  <div class="muted">كشف بالأرقام الداخلية الثابتة: المستأجر الحالي، رقم المنصة، الأجيال، المديونيات — ${esc(dateLabel)}</div>
  <table>
    <thead><tr><th>الرقم الداخلي</th><th>المستأجر الحالي</th><th>رقم المنصة الحالي</th><th>العقار</th><th>الأجيال</th><th>المديونيات</th><th>المحصّل</th></tr></thead>
    <tbody>${body}</tbody>
    <tfoot><tr><td colspan="4">الإجمالي — ${totals.references} رقم / ${totals.generations} عقد</td><td></td><td class="${totals.debtTotal > 0 ? 'red' : 'green'}">${formatSAR(totals.debtTotal)}</td><td>${formatSAR(totals.collected)}</td></tr></tfoot>
  </table>
</body>
</html>`
}

/** Printable كشف حساب العقد — official statement for one contract reference number. */
export function buildContractReferenceHtml(r: ContractReferenceView, dateLabel: string): string {
  const successionRows = r.succession
    .map((t) => {
      const owes = t.outstanding > 0.005
      return `<tr${t.isDeparted && owes ? ' class="owing"' : ''}>
      <td>${esc(t.tenantName || '—')}</td>
      <td dir="ltr">${esc(t.ejarContractNumber || t.contractNumber)}</td>
      <td>${dual(t.startDate)}</td>
      <td>${dual(t.endDate)}</td>
      <td>${esc(t.statusLabelAr)}${t.isRenewal ? ' (تجديد)' : ''}</td>
      <td class="${owes ? 'red' : ''}">${formatSAR(t.outstanding)}</td>
    </tr>`
    })
    .join('')

  const overdueRows = r.overdueUninvoiced.length
    ? r.overdueUninvoiced
        .map(
          (o) => `<tr class="red"><td>${esc(o.tenantName || '—')}</td><td dir="ltr">${esc(o.contractNumber)}</td><td>${installmentLabelAr(o.installmentNo)}</td><td>${esc(o.dueDateAD)} · ${esc(o.dueDateAH)} هـ</td><td>${formatSAR(o.amount)}</td></tr>`,
        )
        .join('')
    : `<tr><td colspan="5" class="empty">لا توجد مستحقات متأخرة</td></tr>`

  // Per-generation installment schedule (4-tier). Only the dedicated overdue table
  // above drives the debt figure; this grid is the full picture for transparency.
  const scheduleSections = r.succession
    .filter((t) => t.schedule && t.schedule.length)
    .map((t) => {
      const rows = t.schedule
        .map((it) => {
          const isNext = it.state === 'next'
          const isRed = it.state === 'overdue' || it.state === 'invoiced_overdue'
          const stClass = isNext ? 'orange' : isRed ? 'red' : it.state === 'paid' ? 'green' : it.state === 'upcoming' ? '' : 'muted'
          const rowClass = isNext ? ' class="orangebg"' : isRed ? ' class="redbg"' : it.state === 'paid' ? ' class="greenbg"' : ''
          return `<tr${rowClass}><td>القسط ${it.installmentNo}${isNext ? ' ★' : ''}</td><td>${esc(it.dueDateAD)} · ${esc(it.dueDateAH)} هـ</td><td>${formatSAR(it.amount)}</td><td class="${stClass}">${INSTALLMENT_STATE_LABELS[it.state]}</td></tr>`
        })
        .join('')
      return `<h3>أقساط العقد <span dir="ltr">${esc(t.ejarContractNumber || t.contractNumber)}</span> — ${esc(t.tenantName || '—')}</h3>
  <table class="sched">
    <thead><tr><th>القسط</th><th>تاريخ الاستحقاق</th><th>المبلغ</th><th>الحالة</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
    })
    .join('')

  const ledgerRows = r.entries.length
    ? r.entries
        .map((e) => {
          const sign = e.amount > 0 ? '+' : e.amount < 0 ? '−' : ''
          const cls = e.cancelled ? '' : e.amount > 0 ? 'green' : e.amount < 0 ? 'red' : ''
          return `<tr${e.cancelled ? ' class="void"' : ''}><td>${dual(e.date)}</td><td>${LEDGER_TYPE_LABELS[e.type]}${e.cancelled ? ' (ملغاة)' : ''}</td><td>${esc(e.label)}</td><td class="${cls}" dir="ltr">${e.type === 'contract' ? '—' : `${sign}${formatSAR(Math.abs(e.amount))}`}</td><td dir="ltr">${esc(e.refs.invoiceNumber || e.refs.voucherNumber || e.refs.contractNumber || '—')}</td></tr>`
        })
        .join('')
    : `<tr><td colspan="5" class="empty">لا توجد حركات</td></tr>`

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>كشف حساب العقد — الرقم الآلي ${r.referenceNo}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "IBM Plex Sans Arabic","Segoe UI",Tahoma,Arial,sans-serif; color:#0f172a; margin:0; padding:24px; font-size:12px; }
  h1 { font-size:18px; margin:0 0 2px; }
  h2 { font-size:14px; margin:16px 0 6px; border-bottom:2px solid #e2e8f0; padding-bottom:4px; }
  .muted { color:#64748b; font-size:11px; }
  table { width:100%; border-collapse:collapse; font-size:11px; }
  th,td { border:1px solid #e2e8f0; padding:6px 8px; text-align:right; }
  thead th { background:#f1f5f9; font-weight:700; }
  tr.owing { background:#fef2f2; }
  .red { color:#b91c1c; font-weight:700; }
  .green { color:#15803d; font-weight:700; }
  h3 { font-size:12px; margin:14px 0 4px; color:#334155; }
  table.sched { margin-bottom:8px; }
  .blue { color:#1d4ed8; font-weight:700; }
  .orange { color:#c2410c; font-weight:700; }
  tr.greenbg td { background:#f0fdf4; }
  tr.orangebg td { background:#fff7ed; }
  tr.redbg td { background:#fef2f2; }
  tr.void td { color:#94a3b8; text-decoration:line-through; }
  .empty { text-align:center; color:#94a3b8; }
  .debt { text-align:center; border-radius:10px; padding:10px; margin:12px 0; border:2px solid ${r.debtTotal > 0 ? '#fca5a5; background:#fef2f2' : '#86efac; background:#f0fdf4'}; }
  .debt .val { font-size:20px; font-weight:800; color:${r.debtTotal > 0 ? '#b91c1c' : '#15803d'}; }
  .grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin:10px 0; }
  .tile { border:1px solid #e2e8f0; border-radius:8px; padding:8px 10px; }
  .tile .l { color:#64748b; font-size:10px; }
  .tile .v { font-weight:700; font-size:13px; margin-top:2px; }
  @media print { body { padding:0; } h2 { page-break-after:avoid; } tr { page-break-inside:avoid; } }
</style>
</head>
<body>
  <h1>كشف حساب العقد — الرقم الآلي ${r.referenceNo}</h1>
  <div class="muted">العقد الحالي: ${esc(r.current.contractNumber)} — ${esc(r.current.tenantName || '—')} (${esc(r.current.statusLabelAr)})${r.property ? ` • العقار: ${esc(r.property.title)} (#${r.property.internalId})` : ''} — ${esc(dateLabel)}</div>

  <div class="grid">
    <div class="tile"><div class="l">إجمالي المفوتر (سارية)</div><div class="v">${formatSAR(r.summary.totalInvoiced)}</div></div>
    <div class="tile"><div class="l">المحصّل (الأساس + الضريبة)</div><div class="v">${formatSAR(r.summary.totalCollected)}</div><div class="l">${formatSAR(r.summary.totalCollectedBase)} أساس + ${formatSAR(r.summary.totalCollectedVat)} ضريبة</div></div>
    <div class="tile"><div class="l">الضريبة</div><div class="v">${formatSAR(r.summary.totalVat)}</div></div>
    <div class="tile"><div class="l">إشعارات دائنة · تُعرض منفصلة</div><div class="v">${formatSAR(r.summary.creditNotesTotal)}</div></div>
  </div>

  <h2>تسلسل المستأجرين على هذا الرقم</h2>
  <table>
    <thead><tr><th>المستأجر</th><th>رقم العقد / إيجار</th><th>من</th><th>إلى</th><th>الحالة</th><th>الرصيد المتبقّي</th></tr></thead>
    <tbody>${successionRows}</tbody>
  </table>

  <h2>أقساط كل عقد — الحالة الحالية</h2>
  <div class="muted">★ = القسط القادم · <span class="orange">برتقالي = القسط القادم (تُصدَر عليه الفاتورة)</span> · <span class="green">أخضر = مدفوع بفاتورة</span> · <span class="red">أحمر = لم يُسدد (متأخر أو مفوتر دون سداد)</span> · مدفوع مسبقاً = سُدِّد سابقًا دون فاتورة · الأقساط المستقبلية تُترك فارغة حتى يحين دورها</div>
  ${scheduleSections || '<div class="empty">لا توجد أقساط</div>'}

  <h2 class="red">المستحقات المتأخرة (غير مُصدَّر لها فواتير)</h2>
  <table>
    <thead><tr><th>المستأجر</th><th>رقم العقد</th><th>القسط</th><th>تاريخ الاستحقاق</th><th>المبلغ</th></tr></thead>
    <tbody>${overdueRows}</tbody>
  </table>

  <div class="debt"><div class="muted">إجمالي المديونيات على هذا الرقم — مستحقات فات موعدها ولم تُفوَّتر (ليست قيمة العقد الكاملة)</div><div class="val">${formatSAR(r.debtTotal)}</div><div class="muted">يُحتسب لحظيًا — ينخفض تلقائيًا عند إصدار فاتورة لأي قسط متأخر</div></div>

  <h2>سجل الحركات الزمني</h2>
  <table>
    <thead><tr><th>التاريخ</th><th>نوع الحركة</th><th>البيان</th><th>المبلغ</th><th>المرجع</th></tr></thead>
    <tbody>${ledgerRows}</tbody>
  </table>
</body>
</html>`
}

/** Printable سجل حركات — official chronological statement for one property. */
export function buildLedgerHtml(l: LedgerView, dateLabel: string): string {
  const p = l.property
  const rows = l.entries.length
    ? l.entries
        .map((e) => {
          const amt = e.type === 'contract' ? '—' : formatSAR(Math.abs(e.amount))
          const sign = e.amount > 0 ? '+' : e.amount < 0 ? '−' : ''
          const cls = e.cancelled ? 'cancelled' : e.amount > 0 ? 'green' : e.amount < 0 ? 'red' : ''
          return `<tr${e.cancelled ? ' class="void"' : ''}>
      <td>${dual(e.date)}</td>
      <td>${LEDGER_TYPE_LABELS[e.type]}${e.cancelled ? ' (ملغاة)' : ''}</td>
      <td>${esc(e.label)}</td>
      <td class="${cls}" dir="ltr">${e.type === 'contract' ? '—' : `${sign}${amt}`}</td>
      <td dir="ltr">${esc(ledgerRef(e))}</td>
    </tr>`
        })
        .join('')
    : `<tr><td colspan="5" class="empty">لا توجد حركات على هذا العقار</td></tr>`

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>سجل حركات العقار — ${esc(p.title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "IBM Plex Sans Arabic","Segoe UI",Tahoma,Arial,sans-serif; color:#0f172a; margin:0; padding:24px; font-size:12px; }
  h1 { font-size:18px; margin:0 0 2px; }
  .muted { color:#64748b; font-size:11px; }
  .serials { font-family:monospace; color:#334155; margin-top:4px; }
  .grid { display:grid; grid-template-columns:repeat(5,1fr); gap:8px; margin:12px 0; }
  .tile { border:1px solid #e2e8f0; border-radius:8px; padding:8px 10px; }
  .tile .l { color:#64748b; font-size:10px; }
  .tile .v { font-weight:700; font-size:13px; margin-top:2px; }
  table { width:100%; border-collapse:collapse; font-size:11px; }
  th,td { border:1px solid #e2e8f0; padding:6px 8px; text-align:right; }
  thead th { background:#f1f5f9; font-weight:700; }
  .green { color:#15803d; font-weight:700; }
  .red { color:#b91c1c; font-weight:700; }
  tr.void td { color:#94a3b8; text-decoration:line-through; }
  .empty { text-align:center; color:#94a3b8; }
  @media print { body { padding:0; } tr { page-break-inside:avoid; } }
</style>
</head>
<body>
  <h1>سجل حركات العقار — ${esc(p.title)}</h1>
  <div class="serials">الرقم الآلي: ${p.internalId || '—'}${p.deedNumber ? ` • رقم الصك: ${esc(p.deedNumber)}` : ''}${p.city ? ` • ${esc(p.city)}` : ''}</div>
  <div class="muted">كشف حركات زمني موحّد — ${esc(dateLabel)}</div>
  <div class="grid">
    <div class="tile"><div class="l">الإيرادات المفوترة</div><div class="v">${formatSAR(l.summary.totalInvoiced)}</div></div>
    <div class="tile"><div class="l">المحصّل</div><div class="v">${formatSAR(l.summary.totalCollected)}</div></div>
    <div class="tile"><div class="l">المصروفات</div><div class="v">${formatSAR(l.summary.totalExpenses)}</div></div>
    <div class="tile"><div class="l">الضريبة</div><div class="v">${formatSAR(l.summary.totalVat)}</div></div>
    <div class="tile"><div class="l">الصافي (المفوتر − المصروفات)</div><div class="v">${formatSAR(l.summary.net)}</div></div>
  </div>
  ${l.summary.creditNotesTotal > 0 ? `<div class="muted">إشعارات دائنة (تُعرض منفصلة، غير مخصومة من الإيرادات): ${formatSAR(l.summary.creditNotesTotal)}</div>` : ''}
  <table>
    <thead><tr><th>التاريخ</th><th>نوع الحركة</th><th>البيان</th><th>المبلغ</th><th>المرجع</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`
}

/** Printable جرد (inventory) sheet — official tabular summary of all properties. */
export function buildInventoryHtml(opts: {
  rows: InventoryRowView[]
  totals: InventoryTotalsView
  companyName?: string | null
  dateLabel: string
}): string {
  const { rows, totals, companyName, dateLabel } = opts
  // An all-empty column is dead weight — mirror the on-screen rule and drop
  // رقم الصك from the printed sheet until at least one deed number exists.
  const hasDeed = rows.some((r) => r.deedNumber)
  const cols = hasDeed ? 7 : 6
  const body = rows.length
    ? rows
        .map(
          (r) => `<tr${r.debtTotal > 0 ? ' class="owing"' : ''}>
      <td dir="ltr">${r.internalId || '—'}</td>
      ${hasDeed ? `<td dir="ltr">${esc(r.deedNumber || '—')}</td>` : ''}
      <td>${esc(r.title)}</td>
      <td>${esc(r.currentTenant || 'شاغر')}</td>
      <td dir="ltr">${r.contractsCount}</td>
      <td class="${r.debtTotal > 0 ? 'red' : 'green'}">${r.debtTotal > 0 ? formatSAR(r.debtTotal) : '✓'}</td>
      <td>${r.collected > 0 ? formatSAR(r.collected) : '—'}</td>
    </tr>`,
        )
        .join('')
    : `<tr><td colspan="${cols}" class="empty">لا توجد عقارات مسجلة</td></tr>`

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>جرد العقارات${companyName ? ' — ' + esc(companyName) : ''}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "IBM Plex Sans Arabic","Segoe UI",Tahoma,Arial,sans-serif; color:#0f172a; margin:0; padding:24px; font-size:12px; }
  h1 { font-size:18px; margin:0 0 2px; }
  .muted { color:#64748b; font-size:11px; }
  table { width:100%; border-collapse:collapse; font-size:11px; margin-top:12px; }
  th,td { border:1px solid #e2e8f0; padding:6px 8px; text-align:right; }
  thead th { background:#f1f5f9; font-weight:700; }
  tr.owing { background:#fef2f2; }
  .red { color:#b91c1c; font-weight:700; }
  .green { color:#15803d; }
  .empty { text-align:center; color:#94a3b8; }
  tfoot td { background:#f8fafc; font-weight:800; }
  @media print { body { padding:0; } tr { page-break-inside:avoid; } }
</style>
</head>
<body>
  <h1>جرد العقارات${companyName ? ' — ' + esc(companyName) : ''}</h1>
  <div class="muted">كشف إجمالي بالمديونيات والمحصّل لكل عقار — ${esc(dateLabel)}</div>
  <table>
    <thead><tr><th>الرقم الآلي</th>${hasDeed ? '<th>رقم الصك</th>' : ''}<th>اسم العقار</th><th>المستأجر الحالي</th><th>عدد العقود</th><th>المديونيات</th><th>المحصّل</th></tr></thead>
    <tbody>${body}</tbody>
    <tfoot><tr><td colspan="${hasDeed ? 4 : 3}">الإجمالي — ${totals.properties} عقار / ${totals.contracts} عقد</td><td></td><td class="${totals.debtTotal > 0 ? 'red' : 'green'}">${formatSAR(totals.debtTotal)}</td><td>${formatSAR(totals.collected)}</td></tr></tfoot>
  </table>
</body>
</html>`
}

export function buildStatementHtml(s: StatementView): string {
  const p = s.property
  const serials = [
    `الرقم التسلسلي: ${p.internalId || '—'}`,
    p.deedNumber ? `رقم الصك: ${esc(p.deedNumber)}` : null,
    p.shopNumber ? `رقم المحل: ${esc(p.shopNumber)}` : null,
  ]
    .filter(Boolean)
    .join(' &nbsp;•&nbsp; ')

  const timelineRows = s.timeline.length
    ? s.timeline
        .map((t) => {
          const owes = t.outstanding > 0.005
          const cls = t.isDeparted && owes ? ' class="owing"' : ''
          return `<tr${cls}>
        <td>${esc(t.tenantName || '—')}</td>
        <td dir="ltr">${esc(t.ejarContractNumber || t.contractNumber)}</td>
        <td>${dual(t.startDate)}</td>
        <td>${dual(t.endDate)}</td>
        <td>${esc(t.statusLabelAr)}</td>
        <td class="${owes ? 'red' : ''}">${formatSAR(t.outstanding)}${t.isDeparted && owes ? ' <span class="note">(غادر مدينًا)</span>' : ''}</td>
      </tr>`
        })
        .join('')
    : `<tr><td colspan="6" class="empty">لا توجد عقود على هذا العقار</td></tr>`

  const overdueRows = s.overdueUninvoiced.length
    ? s.overdueUninvoiced
        .map(
          (r) => `<tr class="red">
        <td>${esc(r.tenantName || '—')}</td>
        <td dir="ltr">${esc(r.contractNumber)}</td>
        <td>القسط ${r.installmentNo}</td>
        <td>${esc(r.dueDateAD)} · ${esc(r.dueDateAH)} هـ</td>
        <td>${formatSAR(r.amount)}</td>
      </tr>`,
        )
        .join('')
    : `<tr><td colspan="5" class="empty">لا توجد مستحقات متأخرة</td></tr>`

  const expenseBreakdown = s.summary.expenseByCategory.length
    ? `<div class="cats">${s.summary.expenseByCategory
        .map((c) => `<span>${esc(c.category)}: <b>${formatSAR(c.amount)}</b></span>`)
        .join('')}</div>`
    : ''

  const debtClass = s.debtTotal > 0 ? 'debt red-box' : 'debt green-box'

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>كشف حساب عقار — ${esc(p.titleAr || p.title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "IBM Plex Sans Arabic","Segoe UI",Tahoma,Arial,sans-serif; color:#0f172a; margin:0; padding:24px; font-size:12px; }
  h1 { font-size:18px; margin:0 0 2px; }
  h2 { font-size:14px; margin:18px 0 6px; border-bottom:2px solid #e2e8f0; padding-bottom:4px; }
  .muted { color:#64748b; font-size:11px; }
  .head { border:1px solid #e2e8f0; border-radius:10px; padding:12px 14px; background:#f8fafc; }
  .serials { margin-top:4px; font-family:monospace; color:#334155; }
  table { width:100%; border-collapse:collapse; font-size:11px; margin-top:2px; }
  th,td { border:1px solid #e2e8f0; padding:6px 8px; text-align:right; }
  thead th { background:#f1f5f9; font-weight:700; }
  .red { color:#b91c1c; }
  tr.red td { color:#b91c1c; }
  tr.owing { background:#fef2f2; }
  .note { font-size:9px; font-weight:400; }
  .empty { text-align:center; color:#94a3b8; }
  .debt { text-align:center; border-radius:10px; padding:12px; margin:14px 0; border:2px solid; }
  .red-box { border-color:#fca5a5; background:#fef2f2; }
  .green-box { border-color:#86efac; background:#f0fdf4; }
  .debt .val { font-size:22px; font-weight:800; margin:2px 0; }
  .red-box .val { color:#b91c1c; }
  .green-box .val { color:#15803d; }
  .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
  .tile { border:1px solid #e2e8f0; border-radius:8px; padding:8px 10px; }
  .tile .l { color:#64748b; font-size:10px; }
  .tile .v { font-weight:700; font-size:13px; margin-top:2px; }
  .cats { margin-top:8px; display:flex; flex-wrap:wrap; gap:4px 16px; font-size:11px; }
  .overdue thead th { background:#fee2e2; color:#991b1b; }
  @media print { body { padding:0; } h2 { page-break-after:avoid; } tr { page-break-inside:avoid; } }
</style>
</head>
<body>
  <div class="head">
    <h1>كشف حساب عقار — ${esc(p.titleAr || p.title)}</h1>
    <div class="serials">${serials}</div>
    <div class="muted">${esc([p.address, p.district, p.city].filter(Boolean).join('، ') || '—')}${p.owner?.name ? ` — المالك: ${esc(p.owner.name)}` : ''} — الوحدات: ${p.unitsCount}</div>
  </div>

  <h2>تسلسل المستأجرين</h2>
  <table>
    <thead><tr><th>المستأجر</th><th>رقم العقد</th><th>من</th><th>إلى</th><th>الحالة</th><th>الرصيد المتبقّي</th></tr></thead>
    <tbody>${timelineRows}</tbody>
  </table>

  <h2 class="red">المستحقات المتأخرة (غير مُصدَّر لها فواتير)</h2>
  <table class="overdue">
    <thead><tr><th>المستأجر</th><th>رقم العقد</th><th>القسط</th><th>تاريخ الاستحقاق</th><th>المبلغ</th></tr></thead>
    <tbody>${overdueRows}</tbody>
  </table>

  <div class="${debtClass}">
    <div class="muted">إجمالي المديونيات (مستحقات متأخرة غير مُصدَّر لها فواتير)</div>
    <div class="val">${formatSAR(s.debtTotal)}</div>
    <div class="muted">يُحتسب لحظيًا — ينخفض تلقائيًا عند إصدار فاتورة لأي قسط متأخر</div>
  </div>

  <h2>الملّخص المالي</h2>
  <div class="grid">
    <div class="tile"><div class="l">إجمالي الإيجارات المتعاقد عليها</div><div class="v">${formatSAR(s.summary.totalRentsContracted)}</div></div>
    <div class="tile"><div class="l">إجمالي المُصدَّر (فواتير سارية)</div><div class="v">${formatSAR(s.summary.totalInvoiced)}</div></div>
    <div class="tile"><div class="l">إجمالي المُحصَّل (الأساس + الضريبة)</div><div class="v">${formatSAR(s.summary.totalCollected)}</div><div class="l">${formatSAR(s.summary.totalCollectedBase)} أساس + ${formatSAR(s.summary.totalCollectedVat)} ضريبة</div></div>
    <div class="tile"><div class="l">إجمالي الضريبة</div><div class="v">${formatSAR(s.summary.totalVat)}</div></div>
    <div class="tile"><div class="l">إجمالي مصروفات العقار</div><div class="v">${formatSAR(s.summary.totalExpenses)}</div></div>
    <div class="tile"><div class="l">إشعارات دائنة / مردودات · تُعرض منفصلة</div><div class="v">${formatSAR(s.summary.creditNotesTotal)}</div></div>
  </div>
  ${expenseBreakdown}
</body>
</html>`
}
