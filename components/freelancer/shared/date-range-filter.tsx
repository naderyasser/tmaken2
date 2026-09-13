'use client'

/**
 * DateRangeFilter — a reusable "between dates" filter used across the three
 * freelancer tables. Emits ISO yyyy-mm-dd strings (or '' when unset). Built on
 * the bilingual Hijri/Gregorian LocalizedDateInput. Rendered by DataTable when
 * a `dateFilter` prop is supplied.
 */

import { CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { LocalizedDateInput } from '@/components/ui/localized-date-input'
import { formatDateShort } from '@/lib/format'

export interface DateRange {
  from: string
  to: string
}

export function DateRangeFilter({
  value,
  onChange,
  isRTL,
  lang,
  label,
}: {
  value: DateRange
  onChange: (r: DateRange) => void
  isRTL?: boolean
  lang?: 'ar' | 'en'
  label?: string
}) {
  const tx = (en: string, ar: string) => (isRTL ? ar : en)
  const locale = lang || (isRTL ? 'ar' : 'en')
  const active = !!(value.from || value.to)
  const summary = active
    ? `${value.from ? formatDateShort(value.from) : '…'} – ${value.to ? formatDateShort(value.to) : '…'}`
    : label || tx('Date range', 'نطاق التاريخ')

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('h-9 gap-1.5', active && 'border-primary text-primary')}
          aria-label={tx('Filter by date range', 'تصفية حسب نطاق التاريخ')}
        >
          <CalendarDays className="h-4 w-4" />
          <span className="max-w-[170px] truncate text-xs">{summary}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="start" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">{tx('From', 'من')}</label>
          <LocalizedDateInput
            locale={locale}
            value={value.from}
            onChange={(iso) => onChange({ ...value, from: iso })}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">{tx('To', 'إلى')}</label>
          <LocalizedDateInput
            locale={locale}
            value={value.to}
            onChange={(iso) => onChange({ ...value, to: iso })}
          />
        </div>
        {active && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => onChange({ from: '', to: '' })}
          >
            {tx('Clear', 'مسح')}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}
