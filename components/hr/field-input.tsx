'use client'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useEffect, useState } from 'react'
import { frappeClient } from '@/lib/api-client'
import type { FieldDef } from '@/lib/hr-modules'
import { ApexDatePicker, ApexTimePicker } from '@/components/hr/apex/date-picker'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { ChevronDown } from 'lucide-react'

const linkCache: Record<string, { value: string; label: string }[]> = {}

/** Apex-style autocomplete over another doctype's records (Employee, Leave
 *  Type …): type to filter by name or code, pick from the list (Apex
 *  mat-autocomplete). Only a picked record is ever committed. */
const linkPending: Record<string, Promise<{ value: string; label: string }[]>> = {}
const linkKey = (field: FieldDef) => `${field.link!.doctype}|${field.link!.titleField ?? ''}`

/** One fetch per link list for the session, shared by every picker. */
function loadLinkOptions(field: FieldDef) {
  const key = linkKey(field)
  if (linkCache[key]) return Promise.resolve(linkCache[key])
  if (!linkPending[key]) {
    const title = field.link!.titleField
    const labelMap = field.link!.labelMap
    linkPending[key] = frappeClient.getList<any>(field.link!.doctype, {
      fields: title ? ['name', title] : ['name'], filters: field.link!.filters, order_by: `${title || 'name'} asc`, limit_page_length: 0,
    }).then((rows) => {
      linkCache[key] = rows.map((r) => ({
        value: r.name,
        label: labelMap ? (title && r[title]) || labelMap(r.name) : title && r[title] ? `${r[title]}${r[title] !== r.name ? ` (${r.name})` : ''}` : r.name,
      }))
      return linkCache[key]
    }).finally(() => { delete linkPending[key] })
  }
  return linkPending[key]
}

/** Warm the pickers' lists while the page is idle, so «إضافة» opens with them ready. */
export function prefetchLinkOptions(fields: FieldDef[]) {
  for (const f of fields) if (f.type === 'link' && f.link) loadLinkOptions(f).catch(() => {})
}

function LinkSelect({ field, value, onChange }: { field: FieldDef; value: any; onChange: (v: any) => void }) {
  const key = linkKey(field)
  const [opts, setOpts] = useState(linkCache[key] ?? [])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  useEffect(() => {
    let live = true
    loadLinkOptions(field).then((o) => { if (live) setOpts(o) }).catch(() => { if (live) setOpts([]) })
    return () => { live = false }
  }, [key, field])
  const selected = opts.find((o) => o.value === value)
  const q = query.trim().toLowerCase()
  const shown = (q ? opts.filter((o) => o.label.toLowerCase().includes(q) || String(o.value).toLowerCase().includes(q)) : opts).slice(0, 100)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative">
          <input
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-label={field.label}
            value={open ? query : selected?.label ?? ''}
            placeholder={selected ? selected.label : 'اكتب للبحث…'}
            onFocus={() => { setQuery(''); setOpen(true) }}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && shown[0]) { e.preventDefault(); onChange(shown[0].value); setOpen(false) }
              if (e.key === 'Escape') setOpen(false)
            }}
            className="w-full h-10 rounded-sm border border-slate-300 bg-white ps-3 pe-8 text-[14px] text-right outline-none focus:border-[var(--apex-blue)]"
          />
          <ChevronDown className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="theme-hr w-[var(--radix-popover-trigger-width)] p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => { if ((e.target as HTMLElement)?.getAttribute?.('role') === 'combobox') e.preventDefault() }}
      >
        <ul role="listbox" dir="rtl" className="max-h-60 overflow-y-auto text-[14px]">
          {shown.length === 0 && <li className="px-3 py-2 text-slate-400">لا توجد نتائج</li>}
          {shown.map((o) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(o.value); setOpen(false) }}
              className={`cursor-pointer rounded px-3 py-2 hover:bg-slate-100 ${o.value === value ? 'bg-slate-100 font-bold' : ''}`}
            >
              {o.label}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

export function toFormValue(f: FieldDef, value: any): any {
  if (value === undefined || value === null) {
    return f.type === 'checkbox' ? false : ''
  }
  return value
}

export function toPayload(fields: FieldDef[], form: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const f of fields) {
    const raw = form[f.field]
    if (f.type === 'checkbox') out[f.field] = !!raw
    else if (f.type === 'number') out[f.field] = raw === '' || raw === undefined ? 0 : Number(raw)
    else if (raw !== undefined && raw !== null && raw !== '') out[f.field] = raw
  }
  return out
}

/** A single labelled field editor used by both the list form and settings pages.
 *  `error`, when set, renders a small red line under the control (in addition
 *  to any toast) — used for inline required-field validation. Everything else
 *  is unchanged from before: same markup, same classes, same look. */
export function FieldInput({
  field, value, onChange, error,
}: { field: FieldDef; value: any; onChange: (v: any) => void; error?: string }) {
  if (field.type === 'checkbox') {
    return (
      <div>
        <div className="flex items-center gap-2 h-9">
          <Checkbox checked={!!value} onCheckedChange={(v) => onChange(!!v)} id={`f-${field.field}`} aria-invalid={!!error || undefined} />
          <Label htmlFor={`f-${field.field}`} className="text-[13px] text-slate-600">{field.label}</Label>
        </div>
        {error && <p className="text-[12px] text-red-500 mt-1 leading-[18px]">{error}</p>}
      </div>
    )
  }
  if (field.type === 'textarea') {
    return (
      <>
        <Textarea
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          aria-invalid={!!error || undefined}
          className="rounded-sm border-slate-300 text-right"
        />
        {error && <p className="text-[12px] text-red-500 mt-1 leading-[18px]">{error}</p>}
      </>
    )
  }
  if (field.type === 'date') {
    return (
      <>
        <ApexDatePicker value={value ?? ''} onChange={onChange} />
        {error && <p className="text-[12px] text-red-500 mt-1 leading-[18px]">{error}</p>}
      </>
    )
  }
  if (field.type === 'time') {
    return (
      <>
        <ApexTimePicker value={value ?? ''} onChange={onChange} />
        {error && <p className="text-[12px] text-red-500 mt-1 leading-[18px]">{error}</p>}
      </>
    )
  }
  if (field.type === 'link' && field.link) {
    return (
      <>
        <LinkSelect field={field} value={value} onChange={onChange} />
        {error && <p className="text-[12px] text-red-500 mt-1 leading-[18px]">{error}</p>}
      </>
    )
  }
  if (field.type === 'select' && field.radio) {
    return (
      <div role="radiogroup" aria-label={field.label} className="flex h-[38px] items-center gap-6">
        {(field.options || []).map((o) => (
          <label key={o} className="inline-flex cursor-pointer items-center gap-2 text-[14px] text-slate-700">
            <input type="radio" name={`radio-${field.field}`} checked={value === o} onChange={() => onChange(o)}
              className="h-4 w-4 accent-[var(--apex-green)]" />
            {field.optionLabels?.[o] ?? o}
          </label>
        ))}
      </div>
    )
  }
  if (field.type === 'select') {
    return (
      <>
        <Select value={value ?? ''} onValueChange={onChange}>
          <SelectTrigger aria-invalid={!!error || undefined} className="rounded-sm border-slate-300 text-right">
            <SelectValue placeholder="اختر…" />
          </SelectTrigger>
          <SelectContent>
            {(field.options || []).map((o) => (
              <SelectItem key={o} value={o}>{field.optionLabels?.[o] ?? o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error && <p className="text-[12px] text-red-500 mt-1 leading-[18px]">{error}</p>}
      </>
    )
  }
  return (
    <>
      <Input
        type={field.type === 'number' ? 'number' : 'text'}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error || undefined}
        className="rounded-sm border-slate-300 text-right"
      />
      {error && <p className="text-[12px] text-red-500 mt-1 leading-[18px]">{error}</p>}
    </>
  )
}
