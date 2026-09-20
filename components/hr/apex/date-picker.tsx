'use client'

import { useEffect, useState } from 'react'
import { Calendar as CalendarIcon, Clock } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { fmtDate } from '@/lib/hr-format'

function isoToDdMmYyyy(iso: string): string {
  return iso ? fmtDate(iso) : ''
}

/** `dd/mm/yyyy` (Latin digits only) → `YYYY-MM-DD`, or `null` if unparsable/invalid. */
function ddMmYyyyToIso(text: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim())
  if (!m) return null
  const day = Number(m[1]), month = Number(m[2]), year = Number(m[3])
  const d = new Date(year, month - 1, day)
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseIsoLocal(iso: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return undefined
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

export type ApexDatePickerProps = {
  /** `YYYY-MM-DD` or `''`. */
  value: string
  onChange: (v: string) => void
  label?: string
  required?: boolean
  placeholder?: string
  disabled?: boolean
}

/**
 * Apex date field — text shows `dd/mm/yyyy` (Latin digits), a round 35px
 * calendar-icon button opens the shadcn `Calendar` in a `Popover`; typing
 * `dd/mm/yyyy` directly also parses and commits.
 */
export function ApexDatePicker({ value, onChange, label, required, placeholder, disabled }: ApexDatePickerProps) {
  const [text, setText] = useState(() => isoToDdMmYyyy(value))
  const [open, setOpen] = useState(false)

  useEffect(() => { setText(isoToDdMmYyyy(value)) }, [value])

  const commit = (raw: string) => {
    if (!raw.trim()) { onChange(''); return }
    const iso = ddMmYyyyToIso(raw)
    if (iso) onChange(iso)
    else setText(isoToDdMmYyyy(value)) // invalid — revert to the last valid value
  }

  return (
    <div>
      {label && (
        <span className="mb-1 block text-[13px] text-slate-700">
          {label}{required && <span className="text-red-500"> *</span>}
        </span>
      )}
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          dir="ltr"
          value={text}
          disabled={disabled}
          placeholder={placeholder || 'dd/mm/yyyy'}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit((e.target as HTMLInputElement).value) }}
          className="h-[42px] flex-1 rounded border border-[var(--apex-border)] bg-white px-3 text-left text-[14px] text-slate-800 outline-none focus:border-[var(--apex-blue)] disabled:bg-slate-50 disabled:text-slate-400"
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-label="اختر تاريخ"
              className="flex h-[35px] w-[35px] shrink-0 items-center justify-center rounded-full border border-[var(--apex-border)] bg-white text-[var(--apex-blue)] disabled:opacity-50"
            >
              <CalendarIcon className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="theme-hr w-auto p-0">
            <Calendar
              mode="single"
              selected={parseIsoLocal(value)}
              onSelect={(d) => {
                if (!d) return
                const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                onChange(iso)
                setText(isoToDdMmYyyy(iso))
                setOpen(false)
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}

export type ApexTimePickerProps = {
  /** `HH:mm` or `''`. */
  value: string
  onChange: (v: string) => void
  label?: string
  required?: boolean
  placeholder?: string
  disabled?: boolean
}

/** Apex time field — same shape as `ApexDatePicker`: an `HH:mm` text input a
 *  round 35px clock button next to it opens the native time picker (a full
 *  custom dropdown isn't worth building for a control the browser already
 *  renders natively and accessibly). */
export function ApexTimePicker({ value, onChange, label, required, placeholder, disabled }: ApexTimePickerProps) {
  const [text, setText] = useState(value || '')

  useEffect(() => { setText(value || '') }, [value])

  const commit = (raw: string) => {
    if (!raw.trim()) { onChange(''); return }
    const m = /^(\d{1,2}):(\d{2})$/.exec(raw.trim())
    if (m) onChange(`${m[1].padStart(2, '0')}:${m[2]}`)
    else setText(value || '')
  }

  return (
    <div>
      {label && (
        <span className="mb-1 block text-[13px] text-slate-700">
          {label}{required && <span className="text-red-500"> *</span>}
        </span>
      )}
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          dir="ltr"
          value={text}
          disabled={disabled}
          placeholder={placeholder || 'HH:mm'}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit((e.target as HTMLInputElement).value) }}
          className="h-[42px] flex-1 rounded border border-[var(--apex-border)] bg-white px-3 text-left text-[14px] text-slate-800 outline-none focus:border-[var(--apex-blue)] disabled:bg-slate-50 disabled:text-slate-400"
        />
        <div className="relative h-[35px] w-[35px] shrink-0">
          <div className="pointer-events-none flex h-[35px] w-[35px] items-center justify-center rounded-full border border-[var(--apex-border)] bg-white text-[var(--apex-blue)]">
            <Clock className="h-4 w-4" />
          </div>
          <input
            type="time"
            value={value || ''}
            disabled={disabled}
            onChange={(e) => { onChange(e.target.value); setText(e.target.value) }}
            aria-label="اختر وقت"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          />
        </div>
      </div>
    </div>
  )
}
