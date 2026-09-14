'use client'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { FieldDef } from '@/lib/hr-modules'

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

/** A single labelled field editor used by both the list form and settings pages. */
export function FieldInput({
  field, value, onChange,
}: { field: FieldDef; value: any; onChange: (v: any) => void }) {
  if (field.type === 'checkbox') {
    return (
      <div className="flex items-center gap-2 h-9">
        <Checkbox checked={!!value} onCheckedChange={(v) => onChange(!!v)} id={`f-${field.field}`} />
        <Label htmlFor={`f-${field.field}`} className="text-[13px] text-slate-600">{field.label}</Label>
      </div>
    )
  }
  if (field.type === 'textarea') {
    return (
      <Textarea
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="rounded-sm border-slate-300 text-right"
      />
    )
  }
  if (field.type === 'select') {
    return (
      <Select value={value ?? ''} onValueChange={onChange}>
        <SelectTrigger className="rounded-sm border-slate-300 text-right">
          <SelectValue placeholder="اختر…" />
        </SelectTrigger>
        <SelectContent>
          {(field.options || []).map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }
  return (
    <Input
      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-sm border-slate-300 text-right"
    />
  )
}
