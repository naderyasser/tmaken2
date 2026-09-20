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

const linkCache: Record<string, { value: string; label: string }[]> = {}

/** Apex-style select over another doctype's records (Employee, Leave Type …). */
function LinkSelect({ field, value, onChange }: { field: FieldDef; value: any; onChange: (v: any) => void }) {
  const key = `${field.link!.doctype}|${field.link!.titleField ?? ''}`
  const [opts, setOpts] = useState(linkCache[key] ?? [])
  useEffect(() => {
    if (linkCache[key]) { setOpts(linkCache[key]); return }
    const title = field.link!.titleField
    frappeClient.getList<any>(field.link!.doctype, {
      fields: title ? ['name', title] : ['name'], filters: field.link!.filters, order_by: `${title || 'name'} asc`, limit_page_length: 0,
    }).then((rows) => {
      linkCache[key] = rows.map((r) => ({ value: r.name, label: title && r[title] ? `${r[title]}${r[title] !== r.name ? ` (${r.name})` : ''}` : r.name }))
      setOpts(linkCache[key])
    }).catch(() => setOpts([]))
  }, [key, field.link])
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-10 rounded-sm border border-slate-300 bg-white px-3 text-[14px] text-right"
    >
      <option value="">اختر…</option>
      {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
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
        {error && <p className="text-[12px] text-red-500 mt-1">{error}</p>}
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
        {error && <p className="text-[12px] text-red-500 mt-1">{error}</p>}
      </>
    )
  }
  if (field.type === 'date') {
    return (
      <>
        <ApexDatePicker value={value ?? ''} onChange={onChange} />
        {error && <p className="text-[12px] text-red-500 mt-1">{error}</p>}
      </>
    )
  }
  if (field.type === 'time') {
    return (
      <>
        <ApexTimePicker value={value ?? ''} onChange={onChange} />
        {error && <p className="text-[12px] text-red-500 mt-1">{error}</p>}
      </>
    )
  }
  if (field.type === 'link' && field.link) {
    return (
      <>
        <LinkSelect field={field} value={value} onChange={onChange} />
        {error && <p className="text-[12px] text-red-500 mt-1">{error}</p>}
      </>
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
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error && <p className="text-[12px] text-red-500 mt-1">{error}</p>}
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
      {error && <p className="text-[12px] text-red-500 mt-1">{error}</p>}
    </>
  )
}
