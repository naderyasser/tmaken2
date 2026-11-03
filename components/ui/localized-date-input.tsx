'use client'

/**
 * LocalizedDateInput — drop-in replacement for native <input type="date">.
 *
 * Native date inputs render mm/dd/yyyy on en-US machines regardless of the app
 * locale. This component instead:
 *   - displays the chosen date as dd/mm/yyyy (Latin numerals, day-first),
 *   - flips alignment with the active locale (RTL for Arabic),
 *   - optionally shows the Hijri (Umm al-Qura) date alongside for KSA,
 *   - keeps the VALUE as an ISO "yyyy-MM-dd" string — identical to what the
 *     native input emitted, so backend payloads and onChange handlers are
 *     unchanged. It's a display swap, not a data-model change.
 */

import * as React from 'react'
import { format as formatISO, parse, isValid } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatDateShort, type AppLocale } from '@/lib/format'

export interface LocalizedDateInputProps {
  /** ISO date string, "yyyy-MM-dd". Empty string / undefined = no selection. */
  value?: string
  /** Receives the new ISO date string (or '' when cleared). */
  onChange: (iso: string) => void
  locale?: AppLocale
  /** Append the Hijri date alongside the Gregorian one in the trigger. */
  hijri?: boolean
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
  'aria-label'?: string
}

export function LocalizedDateInput({
  value,
  onChange,
  locale = 'ar',
  hijri = false,
  placeholder,
  disabled,
  className,
  id,
  'aria-label': ariaLabel,
}: LocalizedDateInputProps) {
  const [open, setOpen] = React.useState(false)
  const isRTL = locale === 'ar'

  const selected = React.useMemo(() => {
    if (!value) return undefined
    const d = parse(value, 'yyyy-MM-dd', new Date())
    return isValid(d) ? d : undefined
  }, [value])

  const display = value ? formatDateShort(value, { withHijri: hijri }) : ''

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          id={id}
          aria-label={ariaLabel}
          variant="outline"
          disabled={disabled}
          dir={isRTL ? 'rtl' : 'ltr'}
          className={cn(
            'w-full justify-start text-start font-normal',
            !display && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="me-2 h-4 w-4 shrink-0 opacity-70" />
          <span className="truncate">
            {display || placeholder || (isRTL ? 'اختر التاريخ' : 'Pick a date')}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" dir={isRTL ? 'rtl' : 'ltr'}>
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => {
            onChange(d ? formatISO(d, 'yyyy-MM-dd') : '')
            setOpen(false)
          }}
          dir={isRTL ? 'rtl' : 'ltr'}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
