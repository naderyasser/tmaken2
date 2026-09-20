'use client'

import { useState, type ReactNode } from 'react'
import { Search, Filter, ExternalLink, ChevronDown, Plus } from 'lucide-react'

/**
 * Apex list toolbar — a bare `ul` row (NOT inside the table card), 49px tall,
 * `display:inline-flex; flex-wrap:wrap; width:100%; direction:rtl`.
 *
 * DOM order = search (flex-grow) → filter → print → actions/delete → add.
 * In RTL that renders search at the RIGHT edge and «اضافة» at the FAR LEFT —
 * exactly mirrored from the pre-Apex tamken3 toolbar (T1/T2).
 */
export type ApexToolbarProps = {
  search?: { value: string; onChange: (v: string) => void; placeholder: string }
  onFilter?: () => void
  print?: { onPrint: () => void; onAdvancedPrint: () => void }
  actions?: { items: { label: string; onSelect: () => void; disabled?: boolean }[]; disabled?: boolean }
  deleteButton?: { onClick: () => void; disabled?: boolean }
  add?: { label: string; onClick?: () => void; href?: string }
  children?: ReactNode
}

export function ApexToolbar({ search, onFilter, print, actions, deleteButton, add, children }: ApexToolbarProps) {
  const [printOpen, setPrintOpen] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)

  return (
    <ul
      dir="rtl"
      className="list-none inline-flex flex-wrap items-center w-full"
      style={{ minHeight: 49 }}
    >
      {search && (
        <li className="px-[5px] flex-grow basis-[180px]">
          <div className="relative h-[37px]">
            <input
              type="text"
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              placeholder={search.placeholder}
              aria-label={search.placeholder}
              className="h-[37px] w-full rounded-[4px_5px_5px_4px] border border-[var(--apex-thead)] bg-white pl-9 pr-3 text-[14px] text-[var(--apex-text)] outline-none placeholder:text-slate-400 focus:border-[var(--apex-blue)]"
            />
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </li>
      )}

      {onFilter && (
        <li className="px-[5px]">
          <button
            type="button"
            onClick={onFilter}
            title="تصفية"
            aria-label="تصفية"
            className="flex h-[38px] w-[42px] items-center justify-center rounded-[4px] border border-[var(--apex-blue-light)] bg-white text-[var(--apex-blue)]"
          >
            <Filter className="h-4 w-4" />
          </button>
        </li>
      )}

      {print && (
        <li className="relative px-[5px]">
          <button
            type="button"
            onClick={() => setPrintOpen((v) => !v)}
            className="flex h-[38px] items-center gap-1.5 rounded-[4px] border border-[var(--apex-slate)] bg-transparent px-[15px] text-[16px] font-normal text-[var(--apex-slate)]"
          >
            <ChevronDown className="h-4 w-4" />
            <ExternalLink className="h-4 w-4" />
            الطباعة
          </button>
          {printOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setPrintOpen(false)} />
              <div className="absolute z-20 mt-1 w-36 rounded border border-slate-200 bg-white py-1 text-[14px] shadow-lg" style={{ insetInlineStart: 0 }}>
                <button type="button" className="block w-full px-3 py-1.5 text-right hover:bg-slate-50" onClick={() => { setPrintOpen(false); print.onPrint() }}>طباعة</button>
                <button type="button" className="block w-full px-3 py-1.5 text-right hover:bg-slate-50" onClick={() => { setPrintOpen(false); print.onAdvancedPrint() }}>طباعة متقدمة</button>
              </div>
            </>
          )}
        </li>
      )}

      {actions && (
        <li className="relative px-[5px]">
          <button
            type="button"
            disabled={actions.disabled}
            onClick={() => setActionsOpen((v) => !v)}
            className="flex h-[38px] items-center gap-1.5 rounded-[4px] border bg-transparent px-[15px] text-[16px] font-normal disabled:cursor-not-allowed"
            style={{
              borderColor: actions.disabled ? 'var(--apex-disabled)' : 'var(--apex-slate)',
              color: actions.disabled ? 'var(--apex-disabled)' : 'var(--apex-slate)',
            }}
          >
            <ChevronDown className="h-4 w-4" />
            الاجراءات
          </button>
          {actionsOpen && !actions.disabled && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setActionsOpen(false)} />
              <div className="absolute z-20 mt-1 w-40 rounded border border-slate-200 bg-white py-1 text-[14px] shadow-lg" style={{ insetInlineStart: 0 }}>
                {actions.items.map((it) => (
                  <button
                    key={it.label}
                    type="button"
                    disabled={it.disabled}
                    onClick={() => { setActionsOpen(false); it.onSelect() }}
                    className="block w-full px-3 py-1.5 text-right hover:bg-slate-50 disabled:opacity-40"
                  >
                    {it.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </li>
      )}

      {deleteButton && (
        <li className="px-[5px]">
          <button
            type="button"
            disabled={deleteButton.disabled}
            onClick={deleteButton.onClick}
            className="h-[38px] w-[60px] rounded-[4px] border bg-white text-[16px] disabled:cursor-not-allowed"
            style={{
              borderColor: deleteButton.disabled ? 'var(--apex-disabled)' : 'var(--apex-red)',
              color: deleteButton.disabled ? 'var(--apex-disabled)' : 'var(--apex-red)',
            }}
          >
            حذف
          </button>
        </li>
      )}

      {add && (
        <li className="px-[5px]">
          {add.href ? (
            <a
              href={add.href}
              className="inline-flex h-[38px] items-center gap-1.5 rounded-[4px] bg-[var(--apex-green)] px-[12px] text-[16px] text-white no-underline hover:bg-[var(--apex-green-dark)]"
            >
              {add.label}
              <Plus className="h-4 w-4" strokeWidth={3} />
            </a>
          ) : (
            <button
              type="button"
              onClick={add.onClick}
              className="inline-flex h-[38px] items-center gap-1.5 rounded-[4px] bg-[var(--apex-green)] px-[12px] text-[16px] text-white hover:bg-[var(--apex-green-dark)]"
            >
              {add.label}
              <Plus className="h-4 w-4" strokeWidth={3} />
            </button>
          )}
        </li>
      )}

      {children}
    </ul>
  )
}
