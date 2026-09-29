'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Apex mat-select[multiple] filter (الفروع / الإدارة / القسم): a «الكل»
 * checkbox on top, one checkbox per option; the field reads «الكل» when every
 * option is ticked, else the picked names. Empty selection = no filter.
 */
export function MultiSelect({ value, onChange, label, items }: {
  value: string[]
  onChange: (v: string[]) => void
  label: string
  items: string[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const all = items.length > 0 && value.length === items.length
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])
  const text = all ? 'الكل' : value.join('، ')

  return (
    <div ref={ref} className="relative">
      {value.length > 0 && <span className="absolute -top-5 right-1 text-[13px] text-slate-700">{label}</span>}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'w-full h-[42px] rounded border border-[var(--apex-border)] bg-white px-3 text-[14px] text-right truncate pl-8',
          value.length ? 'text-slate-800' : 'text-slate-400',
        )}
      >
        {text || label}
      </button>
      <ChevronDown className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
      {open && (
        <div role="listbox" aria-multiselectable className="absolute z-30 mt-1 w-full max-h-64 overflow-auto rounded border border-[var(--apex-border)] bg-white shadow-lg py-1">
          <label className="flex items-center gap-2 px-3 py-2 text-[14px] hover:bg-slate-50 cursor-pointer border-b border-slate-100">
            <input type="checkbox" checked={all} onChange={() => onChange(all ? [] : [...items])} className="accent-[var(--apex-blue)]" />
            الكل
          </label>
          {items.map((o) => (
            <label key={o} className="flex items-center gap-2 px-3 py-2 text-[14px] hover:bg-slate-50 cursor-pointer">
              <input type="checkbox" checked={value.includes(o)} onChange={() => toggle(o)} className="accent-[var(--apex-blue)]" />
              {o}
            </label>
          ))}
          {items.length === 0 && <div className="px-3 py-2 text-[13px] text-slate-400">لا توجد بيانات</div>}
        </div>
      )}
    </div>
  )
}
