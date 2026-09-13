'use client'

// Ported 1:1 from egarsys src/components/ui/hijri-calendar.tsx — the Hijri
// (Umm al-Qura) month grid used inside the rentals DatePicker. Only the two
// imports are rescoped: Button → the scoped ./button, and the calendar math →
// the scoped ../engine/hijri (identical ICU engine). Behaviour is unchanged.

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './button'
import {
  gregorianToHijri,
  hijriToGregorian,
  hijriMonthLength,
  hijriMonthName,
  setHijriDate,
} from '../engine/hijri'

interface HijriCalendarProps {
  selected?: Date
  onSelect: (date: Date | undefined) => void
  /** Initial view date (Gregorian), defaults to selected or today */
  viewDate?: Date
}

const WEEKDAYS = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س']

export function HijriCalendar({ selected, onSelect, viewDate }: HijriCalendarProps) {
  const today = React.useMemo(() => new Date(), [])
  const [cursor, setCursor] = React.useState(viewDate || selected || today)

  const hijri = React.useMemo(() => {
    try { return gregorianToHijri(cursor) }
    catch { return { year: 0, month: 0, day: 0 } }
  }, [cursor])

  const selectedHijri = React.useMemo(() => {
    try { return selected ? gregorianToHijri(selected) : null }
    catch { return null }
  }, [selected])

  const todayHijri = React.useMemo(() => {
    try { return gregorianToHijri(today) }
    catch { return { year: 0, month: 0, day: 0 } }
  }, [today])

  const daysInMonth = React.useMemo(() => {
    try { return hijriMonthLength(hijri.year, hijri.month) }
    catch { return 29 }
  }, [hijri.year, hijri.month])

  // Find day 1 via moment-hijri (exact conversion), then iterate in Gregorian
  const { days, startOffset } = React.useMemo(() => {
    try {
      const firstDayG = hijriToGregorian(hijri.year, hijri.month, 1)
      if (!firstDayG) return { days: [], startOffset: 0 }

      const startOff = (firstDayG.getDay() + 1) % 7 // 0=Saturday (RTL week)
      const result: Array<{ day: number; gregorian: Date }> = []
      for (let d = 0; d < daysInMonth; d++) {
        result.push({ day: d + 1, gregorian: new Date(firstDayG.getTime() + d * 86400000) })
      }
      return { days: result, startOffset: startOff }
    } catch {
      return { days: [], startOffset: 0 }
    }
  }, [hijri.year, hijri.month, daysInMonth])

  // If hijri conversion failed entirely, show a fallback
  if (hijri.year === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        تعذر تحميل التقويم الهجري
      </div>
    )
  }

  const goToPrevMonth = () => {
    const prev = new Date(cursor)
    prev.setDate(prev.getDate() - daysInMonth - 5)
    setCursor(prev)
  }

  const goToNextMonth = () => {
    const next = new Date(cursor)
    next.setDate(next.getDate() + daysInMonth + 5)
    setCursor(next)
  }

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = parseInt(e.target.value, 10)
    if (isNaN(newYear)) return
    const g = setHijriDate(newYear, hijri.month, Math.min(hijri.day, hijriMonthLength(newYear, hijri.month)))
    if (g) setCursor(g)
  }

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = parseInt(e.target.value, 10)
    if (isNaN(newMonth)) return
    const g = setHijriDate(hijri.year, newMonth, Math.min(hijri.day, hijriMonthLength(hijri.year, newMonth)))
    if (g) setCursor(g)
  }

  const yearOptions = React.useMemo(() => {
    const years: number[] = []
    for (let y = 1400; y <= 1460; y++) years.push(y)
    return years
  }, [])

  return (
    <div className="p-2 select-none rtl" dir="rtl">
      {/* Month Navigation with Year/Month Dropdowns */}
      <div className="flex items-center justify-between mb-2 px-1 gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={goToPrevMonth}
          type="button"
        >
          <ChevronRight className="size-4" />
        </Button>

        <div className="flex items-center gap-1 flex-1 justify-center">
          {/* Month Dropdown */}
          <select
            value={hijri.month}
            onChange={handleMonthChange}
            className="text-sm font-medium bg-transparent border border-input rounded px-1.5 py-0.5 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {hijriMonthName(m)}
              </option>
            ))}
          </select>

          {/* Year Dropdown */}
          <select
            value={hijri.year}
            onChange={handleYearChange}
            className="text-sm font-medium bg-transparent border border-input rounded px-1.5 py-0.5 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y.toLocaleString('ar-SA', { useGrouping: false })}
              </option>
            ))}
          </select>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={goToNextMonth}
          type="button"
        >
          <ChevronLeft className="size-4" />
        </Button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="text-center text-xs text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day Grid */}
      <div className="grid grid-cols-7 gap-0">
        {days.length === 0 ? (
          <div className="col-span-7 py-6 text-center text-sm text-muted-foreground">
            تعذر عرض أيام الشهر الهجري
          </div>
        ) : (
          <>
            {/* Empty cells for start offset */}
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`empty-${i}`} className="size-8" />
            ))}

            {days.map(({ day, gregorian }) => {
              const isSelected =
                selectedHijri &&
                selectedHijri.year === hijri.year &&
                selectedHijri.month === hijri.month &&
                selectedHijri.day === day
              const isToday =
                todayHijri.year === hijri.year &&
                todayHijri.month === hijri.month &&
                todayHijri.day === day

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => onSelect(gregorian)}
                  className={`
                    size-8 text-sm rounded-md flex items-center justify-center
                    transition-colors hover:bg-accent hover:text-accent-foreground
                    ${isSelected ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}
                    ${isToday && !isSelected ? 'border border-primary text-primary' : ''}
                  `}
                >
                  {day.toLocaleString('ar-SA')}
                </button>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
