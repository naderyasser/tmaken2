'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { UnmappedEmployee } from './types'

/** Lightweight searchable employee picker — no external deps, matches the Apex field look. */
export function EmployeeCombobox({
  options, value, onChange, placeholder = 'اختر موظف',
}: {
  options: UnmappedEmployee[]
  value?: string
  onChange: (employeeName: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const selected = useMemo(() => options.find((o) => o.name === value), [options, value])
  const filtered = useMemo(() => {
    const nq = q.trim().toLowerCase()
    if (!nq) return options.slice(0, 100)
    return options
      .filter((o) => o.employee_name?.toLowerCase().includes(nq) || o.name.toLowerCase().includes(nq))
      .slice(0, 100)
  }, [options, q])

  return (
    <div ref={ref} className="relative">
      <input
        value={open ? q : (selected?.employee_name || '')}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => { setQ(''); setOpen(true) }}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        className="w-full h-9 rounded border border-[var(--apex-border)] bg-white pr-3 pl-7 text-[13px] text-slate-800 outline-none focus:border-[var(--apex-blue)] placeholder:text-slate-400"
      />
      <ChevronDown className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
      {open && (
        <div className="absolute z-30 mt-1 max-h-56 w-full min-w-[220px] overflow-auto rounded border border-slate-200 bg-white shadow-lg py-1 text-[13px]" dir="rtl">
          {filtered.length ? filtered.map((o) => (
            <button
              key={o.name}
              type="button"
              onClick={() => { onChange(o.name); setQ(''); setOpen(false) }}
              className={`block w-full text-right px-3 py-1.5 hover:bg-slate-50 ${o.name === value ? 'bg-slate-50 font-bold' : ''}`}
            >
              {o.employee_name} <span className="text-slate-400">({o.name})</span>
            </button>
          )) : <p className="px-3 py-3 text-center text-slate-400">لا نتائج</p>}
        </div>
      )}
    </div>
  )
}
