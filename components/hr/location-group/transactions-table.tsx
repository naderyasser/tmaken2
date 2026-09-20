'use client'

import { MapPin } from 'lucide-react'
import { fmtDate, fmtDateTime, fmtTime } from '@/lib/hr-format'
import { EmptyState } from '@/components/hr/ui/empty-state'
import { TableSkeleton } from '@/components/hr/ui/table-skeleton'
import { statusBadgeClass, type TransactionRow, type TransactionTab } from './types'

/** Column set differs by tab — leaves/permissions carry a real approval
 *  workflow (see hr_location_groups.list_group_transactions), punches only
 *  carry a source/location. Same Apex table chrome (thead bg, row height,
 *  checkbox column) as `generic-list-page.tsx`. */
export function TransactionsTable({
  tab, rows, loading, selected, onToggleOne, onToggleAll, onApprove, onReject, onShowMap,
}: {
  tab: TransactionTab
  rows: TransactionRow[]
  loading: boolean
  selected: Set<string>
  onToggleOne: (name: string) => void
  onToggleAll: () => void
  onApprove: (row: TransactionRow) => void
  onReject: (row: TransactionRow) => void
  onShowMap: (row: TransactionRow) => void
}) {
  const approvable = tab !== 'punches'
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.name))
  const colCount = approvable ? 8 : 6

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px] text-right">
        <thead>
          <tr className="bg-[var(--apex-thead)] text-[var(--apex-text)] border-y border-slate-300 h-11">
            {approvable && (
              <th className="px-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={onToggleAll}
                  className="h-4 w-4 accent-[var(--apex-blue-light)] cursor-pointer align-middle"
                  aria-label="تحديد الكل"
                />
              </th>
            )}
            <th className="px-3 font-bold whitespace-nowrap">الموظف</th>
            <th className="px-3 font-bold whitespace-nowrap">الفرع</th>
            {tab === 'leaves' && <th className="px-3 font-bold whitespace-nowrap">نوع الإجازة</th>}
            {tab === 'permissions' && <th className="px-3 font-bold whitespace-nowrap">نوع الاذن</th>}
            {tab === 'punches' && <th className="px-3 font-bold whitespace-nowrap">النوع</th>}
            <th className="px-3 font-bold whitespace-nowrap">
              {tab === 'leaves' ? 'من — إلى' : tab === 'permissions' ? 'التاريخ / الوقت' : 'الوقت'}
            </th>
            <th className="px-3 font-bold whitespace-nowrap">الحالة</th>
            {tab !== 'punches' && <th className="px-3 font-bold">السبب</th>}
            {tab === 'punches' && <th className="px-3 font-bold whitespace-nowrap">الموقع</th>}
            {approvable && <th className="px-3 font-bold w-32 text-center whitespace-nowrap">الاجراءات</th>}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={colCount} className="p-0"><TableSkeleton rows={6} cols={colCount} /></td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={colCount} className="py-10">
              <EmptyState title="لا توجد حركات" description="لا توجد حركات مطابقة للفترة والفلاتر المحددة." />
            </td></tr>
          ) : (
            rows.map((row) => (
              <tr key={`${row.doctype}-${row.name}`} className="border-b border-slate-100 hover:bg-slate-50/70 h-[52px] align-top">
                {approvable && (
                  <td className="px-3 pt-3.5 text-center">
                    <input
                      type="checkbox"
                      checked={selected.has(row.name)}
                      onChange={() => onToggleOne(row.name)}
                      className="h-4 w-4 accent-[var(--apex-blue-light)] cursor-pointer align-middle"
                      aria-label={`تحديد ${row.employee_name || row.employee}`}
                    />
                  </td>
                )}
                <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{row.employee_name || row.employee}</td>
                <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{row.branch || '—'}</td>
                <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{row.type || '—'}</td>
                <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap tabular-nums">
                  {tab === 'leaves' && `${fmtDate(row.date)} — ${row.date_to ? fmtDate(row.date_to) : fmtDate(row.date)}`}
                  {tab === 'permissions' && (
                    <>
                      {fmtDate(row.date)}
                      {row.from_time && <span className="text-slate-500"> ({fmtTime(row.from_time)}–{fmtTime(row.to_time)})</span>}
                    </>
                  )}
                  {tab === 'punches' && fmtDateTime(row.date)}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${statusBadgeClass(tab, row.status)}`}>
                    {row.status_label}
                  </span>
                </td>
                {tab !== 'punches' && (
                  <td className="px-3 py-2.5 text-slate-600 max-w-[240px]">
                    <span className="line-clamp-2">{row.reason || '—'}</span>
                  </td>
                )}
                {tab === 'punches' && (
                  <td className="px-3 py-2.5">
                    {row.latitude != null && row.longitude != null ? (
                      <button
                        type="button"
                        onClick={() => onShowMap(row)}
                        className="inline-flex items-center gap-1 text-[var(--apex-blue)] hover:underline"
                      >
                        <MapPin className="h-3.5 w-3.5" />عرض
                      </button>
                    ) : '—'}
                  </td>
                )}
                {approvable && (
                  <td className="px-3 py-2.5">
                    {row.docstatus === 1 && row.status !== 'Open' && row.status !== 'Pending' ? (
                      <span className="text-slate-400 text-[12px]">—</span>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => onApprove(row)}
                          className="text-[var(--apex-green)] hover:underline text-[12.5px] font-bold"
                        >
                          اعتماد
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => onReject(row)}
                          className="text-[var(--apex-red)] hover:underline text-[12.5px] font-bold"
                        >
                          رفض
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
