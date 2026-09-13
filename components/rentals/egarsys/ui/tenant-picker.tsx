'use client'

// Ported from egarsys src/components/ui/tenant-picker.tsx (mirrors the owner-picker
// adaptation): the ui import paths are rescoped to ./input · ./button · ./dialog and
// TenantPartyTypeLabels/TenantPartyTypeValue come from the scoped ../types. The scoped
// Input has NO `numericOnly` prop (that's an egarsys-only extension), so the component's
// `numericOnly` flag is translated to the native `inputMode="numeric"` here — same as the
// surrounding base_meena tenant/lessor inputs. Everything else is 1:1 with egarsys:
// a per-field suggestion input (filtered on name / nationalId / phone) + the fill dialog
// («تعبئة كل البيانات» / single-field / إلغاء).

import { useState } from 'react'
import { Input } from './input'
import { Button } from './button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from './dialog'
import { TenantPartyTypeLabels, type TenantPartyTypeValue } from '../types'

// The tenant fields an autocomplete input can sit on (also the single-field fill target).
export type TenantField = 'name' | 'nationalId' | 'phone'

// Null-safe view of a registered tenant — structurally compatible with the mirror-backed
// LinkableTenant (lib/rentals/tenants-data.ts); every extra required field it carries is
// simply ignored here.
export interface TenantData {
  id?: string
  name?: string | null
  partyType?: string | null
  nationalId?: string | null
  vatNumber?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  emergencyContact?: string | null
  companyName?: string | null
  crNumber?: string | null
  crDate?: string | null
  unifiedNumber?: string | null
  orgType?: string | null
  representativeName?: string | null
  representativeId?: string | null
  representativeMobile?: string | null
  representativeEmail?: string | null
}

export const TENANT_FIELD_LABELS: Record<TenantField, string> = {
  name: 'الاسم',
  nationalId: 'رقم الهوية',
  phone: 'الجوال',
}

// A single text input with registered-tenant suggestions. Unlike the owner picker the
// filter always matches name / nationalId / phone (whichever field the input sits on),
// so the same suggestion surfaces from any of the three inputs.
export function TenantAutocompleteInput({
  field,
  value,
  onChange,
  tenants,
  onPick,
  placeholder,
  dir,
  className,
  id,
  numericOnly,
  'aria-invalid': ariaInvalid,
}: {
  field: TenantField
  value: string
  onChange: (v: string) => void
  tenants: TenantData[]
  onPick: (tenant: TenantData, field: TenantField) => void
  placeholder?: string
  dir?: 'rtl' | 'ltr'
  className?: string
  id?: string
  numericOnly?: boolean
  'aria-invalid'?: boolean
}) {
  const [open, setOpen] = useState(false)

  const q = value.trim().toLowerCase()
  const matches = q
    ? tenants
        .filter(t =>
          [t.name, t.nationalId, t.phone].some(
            f => (f ?? '').toString().toLowerCase().includes(q)
          )
        )
        .slice(0, 6)
    : []

  return (
    <div className="relative">
      <Input
        id={id}
        inputMode={numericOnly ? 'numeric' : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        dir={dir}
        className={className}
        aria-invalid={ariaInvalid}
      />
      {open && matches.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-input rounded-md shadow-lg overflow-hidden max-h-64 overflow-y-auto">
          {matches.map(tenant => (
            <button
              key={tenant.id}
              type="button"
              className="w-full text-right px-3 py-2 text-sm hover:bg-accent transition-colors flex flex-col gap-0.5"
              onMouseDown={() => { setOpen(false); onPick(tenant, field) }}
            >
              <span className="font-medium">{tenant.name || '—'}</span>
              <span className="text-xs text-muted-foreground" dir="ltr">
                {[tenant.nationalId, tenant.phone].filter(Boolean).join(' · ') || '—'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// The popup shown after picking a tenant suggestion: preview of the record + fill choices.
export function TenantFillDialog({
  tenant,
  field,
  onFillAll,
  onFillField,
  onCancel,
}: {
  tenant: TenantData | null
  field: TenantField | null
  onFillAll: (tenant: TenantData) => void
  onFillField: (field: TenantField, value: string) => void
  onCancel: () => void
}) {
  // Only show rows that carry a value — a tenant record has many optional identity fields
  // and a wall of «—» dashes would just be noise.
  const rows: Array<{ label: string; value: string; ltr?: boolean }> = []
  if (tenant) {
    const partyLabel = tenant.partyType
      ? TenantPartyTypeLabels[tenant.partyType as TenantPartyTypeValue]?.ar
      : ''
    const push = (label: string, value?: string | null, ltr = false) => {
      if (value && value.toString().trim()) rows.push({ label, value: value.toString(), ltr })
    }
    push('الاسم', tenant.name || '—')
    push('صفة الطرف', partyLabel)
    push('رقم الهوية', tenant.nationalId, true)
    push('الجوال', tenant.phone, true)
    push('البريد الإلكتروني', tenant.email, true)
    push('اسم الجهة / الشركة', tenant.companyName)
    push('السجل التجاري', tenant.crNumber, true)
    push('الرقم الضريبي', tenant.vatNumber, true)
    push('الرقم الموحد', tenant.unifiedNumber, true)
    push('اسم الممثل', tenant.representativeName)
    push('جوال الممثل', tenant.representativeMobile, true)
  }

  return (
    <Dialog open={!!tenant} onOpenChange={(o) => { if (!o) onCancel() }}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle>تعبئة بيانات المستأجر</DialogTitle>
          <DialogDescription>
            اخترت المستأجر: <span className="font-semibold text-foreground">{tenant?.name || '—'}</span>
          </DialogDescription>
        </DialogHeader>

        {tenant && (
          <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5 text-sm">
            {rows.map((r, i) => (
              <div key={i} className="flex justify-between gap-3">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-medium text-left" dir={r.ltr ? 'ltr' : 'rtl'}>
                  {r.value || '—'}
                </span>
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            onClick={() => tenant && onFillAll(tenant)}
          >
            تعبئة كل البيانات
          </Button>
          {tenant && field && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => onFillField(field, (tenant[field] ?? '').toString())}
            >
              {TENANT_FIELD_LABELS[field]} فقط
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
