'use client'

// Scoped DatePicker for the ported egarsys invoices screen. egarsys's own
// src/components/ui/date-picker.tsx pulls a Hijri calendar + app-store calendarType;
// here (read-only report filters) we render a Gregorian popover calendar built on the
// platform's shadcn Popover + Calendar, keeping the SAME prop signature (value/onChange/
// placeholder/readOnly/variant/showDualDate/…) and emitting the same "YYYY-MM-DD" strings.
// The optional dual Hijri+Gregorian helper line uses the scoped ICU Umm al-Qura formatter.

import * as React from 'react'
import { CalendarIcon } from 'lucide-react'
import { Button } from './button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { formatDate, formatDateDualCompact } from '../format'

interface DatePickerProps {
  value: string
  onChange: (date: string) => void
  placeholder?: string
  disabled?: boolean
  readOnly?: boolean
  className?: string
  /** Visual variant for auto-calculated fields */
  variant?: 'default' | 'auto'
  /** Show dual Hijri+Gregorian date display below the input */
  showDualDate?: boolean
  /** Force the dual helper line to a specific calendar (accepted for API parity; unused) */
  dualDateCalendar?: 'gregorian' | 'hijri'
  /** Show Hijri/Gregorian calendar toggle (accepted for API parity; unused) */
  showCalendarToggle?: boolean
}

function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'اختر التاريخ',
  disabled = false,
  readOnly = false,
  className,
  variant = 'default',
  showDualDate = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selected = value ? new Date(value) : undefined
  const valid = !!selected && !isNaN(selected.getTime())

  return (
    <div className="space-y-1">
      <Popover open={open} onOpenChange={(o) => { if (!disabled && !readOnly) setOpen(o) }}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            dir="rtl"
            className={cn(
              'w-full justify-start text-right font-normal gap-2',
              !valid && 'text-muted-foreground',
              variant === 'auto' && 'bg-muted cursor-default',
              className,
            )}
          >
            <CalendarIcon className="h-4 w-4 shrink-0 opacity-60" />
            <span className="truncate">{valid ? formatDate(value) : placeholder}</span>
          </Button>
        </PopoverTrigger>
        {!readOnly && (
          <PopoverContent className="w-auto p-0" align="start" dir="rtl">
            <Calendar
              mode="single"
              selected={valid ? selected : undefined}
              defaultMonth={valid ? selected : undefined}
              onSelect={(d) => {
                onChange(d ? toISO(d) : '')
                setOpen(false)
              }}
              dir="rtl"
              initialFocus
            />
          </PopoverContent>
        )}
      </Popover>
      {showDualDate && valid && (
        <p className="text-[11px] text-muted-foreground px-1" dir="rtl">{formatDateDualCompact(value)}</p>
      )}
    </div>
  )
}
