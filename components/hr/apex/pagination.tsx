'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

export type ApexPaginationProps = {
  page: number
  pageCount: number
  pageSize: number
  pageSizeOptions?: number[]
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

const DEFAULT_SIZES = [5, 10, 25, 50, 100]

/** Reference-style page buttons: right «عدد الصفوف», centered « « ‹ 1 2 3 › » » (first/last like Apex),
 *  left «اذهب إلى صفحة» — square 43×35 buttons, active page navy `--apex-navy`. */
export function ApexPagination({
  page, pageCount, pageSize, pageSizeOptions = DEFAULT_SIZES, total, onPageChange, onPageSizeChange,
}: ApexPaginationProps) {
  const [goto, setGoto] = useState('')

  const numbers = useMemo(() => {
    const out: (number | '…')[] = []
    const from = Math.max(1, page - 2)
    const to = Math.min(pageCount, from + 4)
    if (from > 1) { out.push(1); if (from > 2) out.push('…') }
    for (let i = from; i <= to; i++) out.push(i)
    if (to < pageCount) { if (to < pageCount - 1) out.push('…'); out.push(pageCount) }
    return out
  }, [page, pageCount])

  const submitGoto = () => {
    const n = parseInt(goto, 10)
    if (!Number.isNaN(n) && n >= 1 && n <= pageCount) onPageChange(n)
    setGoto('')
  }

  const btnBase = 'flex items-center justify-center text-[14px]'

  return (
    <div dir="rtl" className="flex flex-col items-center justify-between gap-3 px-3 py-3 lg:flex-row" aria-label={`إجمالي ${total}`}>
      <div className="flex items-center gap-2">
        <span className="text-slate-700">عدد الصفوف</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          aria-label="عدد الصفوف"
          className="h-9 rounded border border-slate-300 bg-white px-2 text-[14px]"
        >
          {pageSizeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      <div className="flex items-center">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          aria-label="الصفحة الأولى"
          className={`${btnBase} text-slate-500 disabled:opacity-40`}
          style={{ width: 43, height: 35, borderRadius: 0 }}
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label="الصفحة السابقة"
          className={`${btnBase} text-slate-500 disabled:opacity-40`}
          style={{ width: 43, height: 35, borderRadius: 0 }}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        {numbers.map((n, i) => n === '…' ? (
          <span key={`e${i}`} className={`${btnBase} text-slate-400`} style={{ width: 43, height: 35 }}>…</span>
        ) : (
          <button
            key={n}
            type="button"
            onClick={() => onPageChange(n)}
            className={btnBase}
            style={{
              width: 43, height: 35, borderRadius: 0,
              background: n === page ? 'var(--apex-navy)' : 'transparent',
              color: n === page ? '#fff' : 'var(--apex-blue)',
            }}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
          disabled={page >= pageCount}
          aria-label="الصفحة التالية"
          className={`${btnBase} text-slate-500 disabled:opacity-40`}
          style={{ width: 43, height: 35, borderRadius: 0 }}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(pageCount)}
          disabled={page >= pageCount}
          aria-label="الصفحة الأخيرة"
          className={`${btnBase} text-slate-500 disabled:opacity-40`}
          style={{ width: 43, height: 35, borderRadius: 0 }}
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-slate-600">اذهب إلى صفحة</span>
        <input
          type="text"
          inputMode="numeric"
          value={goto}
          onChange={(e) => setGoto(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submitGoto() }}
          aria-label="رقم الصفحة"
          className="h-[32px] w-[48px] rounded-[4px] border px-1 text-center"
          style={{ borderColor: 'var(--apex-slate)' }}
        />
        <button type="button" onClick={submitGoto} className="text-[14px] text-[var(--apex-blue-light)] hover:underline">اذهب</button>
      </div>
    </div>
  )
}
