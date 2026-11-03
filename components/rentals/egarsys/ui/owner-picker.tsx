'use client'

// Ported verbatim from egarsys src/components/ui/owner-picker.tsx (only the ui import
// paths are rescoped to ./input · ./button · ./dialog). Restores the contract form's
// owner autocomplete (lessor fields): a per-field suggestion input + a fill dialog.

import { useState } from 'react'
import { Input } from './input'
import { Button } from './button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from './dialog'

// The owner fields this picker understands
export type OwnerField = 'name' | 'nationalId' | 'phone' | 'email' | 'address' | 'vatNumber'

export interface OwnerData {
  id?: string
  name?: string | null
  nationalId?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  vatNumber?: string | null
}

export const OWNER_FIELD_LABELS: Record<OwnerField, string> = {
  name: 'الاسم',
  nationalId: 'رقم الهوية',
  phone: 'الجوال',
  email: 'البريد الإلكتروني',
  address: 'العنوان',
  vatNumber: 'الرقم الضريبي',
}

// A single text input with owner suggestions filtered by the given field.
export function OwnerAutocompleteInput({
  field,
  value,
  onChange,
  owners,
  onPick,
  placeholder,
  dir,
  className,
}: {
  field: OwnerField
  value: string
  onChange: (v: string) => void
  owners: OwnerData[]
  onPick: (owner: OwnerData, field: OwnerField) => void
  placeholder?: string
  dir?: 'rtl' | 'ltr'
  className?: string
}) {
  const [open, setOpen] = useState(false)

  const matches = value.trim()
    ? owners
        .filter(o => {
          const fv = (o[field] ?? '').toString().toLowerCase()
          return fv.includes(value.trim().toLowerCase())
        })
        .slice(0, 6)
    : []

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        dir={dir}
        className={className}
      />
      {open && matches.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-input rounded-md shadow-lg overflow-hidden max-h-64 overflow-y-auto">
          {matches.map(owner => (
            <button
              key={owner.id}
              type="button"
              className="w-full text-right px-3 py-2 text-sm hover:bg-accent transition-colors flex flex-col gap-0.5"
              onMouseDown={() => { setOpen(false); onPick(owner, field) }}
            >
              <span className="font-medium">{owner.name || '—'}</span>
              <span className="text-xs text-muted-foreground" dir="ltr">
                {[owner.nationalId, owner.phone].filter(Boolean).join(' · ') || '—'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// The popup shown after picking an owner suggestion: preview + 3 choices.
export function OwnerFillDialog({
  owner,
  field,
  onFillAll,
  onFieldOnly,
  onCancel,
}: {
  owner: OwnerData | null
  field: OwnerField | null
  onFillAll: (owner: OwnerData) => void
  onFieldOnly: (owner: OwnerData, field: OwnerField) => void
  onCancel: () => void
}) {
  const fields: OwnerField[] = ['name', 'nationalId', 'phone', 'email', 'address', 'vatNumber']

  return (
    <Dialog open={!!owner} onOpenChange={(o) => { if (!o) onCancel() }}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle>تعبئة بيانات المالك</DialogTitle>
          <DialogDescription>
            اخترت المالك: <span className="font-semibold text-foreground">{owner?.name || '—'}</span>
          </DialogDescription>
        </DialogHeader>

        {owner && (
          <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5 text-sm">
            {fields.map(f => (
              <div key={f} className="flex justify-between gap-3">
                <span className="text-muted-foreground">{OWNER_FIELD_LABELS[f]}</span>
                <span className="font-medium text-left" dir={f === 'nationalId' || f === 'phone' || f === 'email' ? 'ltr' : 'rtl'}>
                  {(owner[f] ?? '').toString() || '—'}
                </span>
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            onClick={() => owner && onFillAll(owner)}
          >
            تعبئة كل البيانات
          </Button>
          {owner && field && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => onFieldOnly(owner, field)}
            >
              {OWNER_FIELD_LABELS[field]} فقط
            </Button>
          )}
          <Button variant="ghost" className="w-full" onClick={onCancel}>
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
