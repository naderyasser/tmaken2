'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'

export type DrawerOptionSource = 'branches' | 'departments' | 'designations' | 'shifts' | 'leave_types' | 'permission_types' | 'projects' | 'groups'
export interface DrawerFilter {
  /** row field the filter applies to (client-side equality), or 'date' for a from/to pair over `field` */
  field: string
  label: string
  source?: DrawerOptionSource
  options?: string[]
  date?: boolean
  /** Apex checkbox list: «البحث باسم …» box, «الكل», one checkbox per option */
  multi?: boolean
  searchPlaceholder?: string
}
export type DrawerValues = Record<string, string>

/** multi filters keep their picks in the same string map, joined by this */
const SEP = '\u001f'
export const drawerMulti = (v?: string) => (v ? v.split(SEP) : [])

let cache: Record<string, string[]> | null = null

/**
 * Apex «بحث متقدم» — a slide-over from the LEFT edge with one accordion per
 * filter (الفروع · الإدارة · الاقسام · الوظائف · الدوام · التاريخ …) and a [بحث].
 */
export function AdvancedSearchDrawer({ open, onClose, filters, values, onApply }: {
  open: boolean; onClose: () => void; filters: DrawerFilter[]; values: DrawerValues; onApply: (v: DrawerValues) => void
}) {
  const [local, setLocal] = useState<DrawerValues>(values)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [opts, setOpts] = useState<Record<string, string[]>>(cache ?? {})
  const [query, setQuery] = useState<Record<string, string>>({})

  useEffect(() => { setLocal(values) }, [values, open])
  useEffect(() => {
    if (cache || !open) return
    frappeClient.call<any>('base_meena.api.hr_reports.get_filter_options')
      .then((r: any) => { cache = r?.message ?? {}; setOpts(cache!) })
      .catch(() => {})
  }, [open])

  if (!open) return null
  const items = (f: DrawerFilter) => f.options ?? (f.source ? opts[f.source] ?? [] : [])

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <aside className="fixed top-0 left-0 z-50 h-full w-[245px] bg-white shadow-xl overflow-y-auto" dir="rtl">
        <div className="flex items-center justify-between px-4 h-[80px]">
          <h3 className="text-[26px] font-bold text-[var(--apex-blue)]">بحث متقدم</h3>
          <button type="button" onClick={onClose} className="text-[var(--apex-blue)]" aria-label="اغلاق"><X className="h-6 w-6" /></button>
        </div>
        <div className="px-4 pb-6 space-y-0">
          <div className="border border-slate-200 rounded">
            {filters.map((f) => {
              const isOpen = !!expanded[f.field]
              return (
                <div key={f.field} className="border-b border-slate-200 last:border-0">
                  <button type="button" onClick={() => setExpanded((e) => ({ ...e, [f.field]: !isOpen }))}
                    className="w-full h-[48px] px-3 flex items-center justify-between text-[15px] text-[var(--apex-blue)]">
                    <span>{f.label}{local[f.field] || local[`${f.field}_from`] ? ' •' : ''}</span>
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-3">
                      {f.multi ? (() => {
                        const all = items(f)
                        const picked = drawerMulti(local[f.field])
                        const setPicked = (v: string[]) => setLocal((l) => ({ ...l, [f.field]: v.join(SEP) }))
                        const q = (query[f.field] ?? '').trim()
                        return (
                          <div className="space-y-2">
                            <input value={query[f.field] ?? ''} onChange={(e) => setQuery((x) => ({ ...x, [f.field]: e.target.value }))}
                              placeholder={f.searchPlaceholder ?? `البحث باسم ${f.label}`} className="w-full h-9 rounded border border-slate-300 px-2 text-[13px]" />
                            <label className="flex items-center gap-2 text-[14px] cursor-pointer">
                              <input type="checkbox" className="h-4 w-4 accent-[var(--apex-blue)]"
                                checked={all.length > 0 && picked.length === all.length}
                                onChange={(e) => setPicked(e.target.checked ? [...all] : [])} />
                              الكل
                            </label>
                            <div className="max-h-56 overflow-y-auto space-y-1.5">
                              {all.filter((o) => !q || o.includes(q)).map((o) => (
                                <label key={o} className="flex items-center gap-2 text-[14px] cursor-pointer">
                                  <input type="checkbox" className="h-4 w-4 accent-[var(--apex-blue)]" checked={picked.includes(o)}
                                    onChange={(e) => setPicked(e.target.checked ? [...picked, o] : picked.filter((x) => x !== o))} />
                                  {o}
                                </label>
                              ))}
                            </div>
                          </div>
                        )
                      })() : f.date ? (
                        <div className="space-y-2">
                          <input type="date" value={local[`${f.field}_from`] ?? ''} onChange={(e) => setLocal((l) => ({ ...l, [`${f.field}_from`]: e.target.value }))} className="w-full h-9 rounded border border-slate-300 px-2 text-[13px]" />
                          <input type="date" value={local[`${f.field}_to`] ?? ''} onChange={(e) => setLocal((l) => ({ ...l, [`${f.field}_to`]: e.target.value }))} className="w-full h-9 rounded border border-slate-300 px-2 text-[13px]" />
                        </div>
                      ) : (
                        <select value={local[f.field] ?? ''} onChange={(e) => setLocal((l) => ({ ...l, [f.field]: e.target.value }))} className="w-full h-9 rounded border border-slate-300 px-2 text-[13px] bg-white">
                          <option value="">الكل</option>
                          {items(f).map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="pt-4 flex gap-2">
            <button type="button" onClick={() => { onApply(local); onClose() }} className="h-[42px] px-6 rounded bg-[var(--apex-green)] text-white text-[15px] hover:bg-[var(--apex-green-dark)]">بحث</button>
            <button type="button" onClick={() => { setLocal({}); onApply({}) }} className="h-[42px] px-4 rounded border border-slate-300 text-slate-600 text-[14px]">مسح</button>
          </div>
        </div>
      </aside>
    </>
  )
}

/** Apply drawer values to rows (equality; date range on `<field>_from/_to`). */
export function applyDrawer<T extends Record<string, any>>(rows: T[], filters: DrawerFilter[], values: DrawerValues): T[] {
  return rows.filter((r) => filters.every((f) => {
    if (f.date) {
      const v = String(r[f.field] ?? '').slice(0, 10)
      const from = values[`${f.field}_from`], to = values[`${f.field}_to`]
      if (from && v < from) return false
      if (to && v > to) return false
      return true
    }
    const want = values[f.field]
    if (f.multi) return !want || drawerMulti(want).includes(String(r[f.field] ?? ''))
    return !want || String(r[f.field] ?? '') === want
  }))
}
