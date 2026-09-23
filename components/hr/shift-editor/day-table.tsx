'use client'

import { Fragment } from 'react'
import { Pencil } from 'lucide-react'
import { ApexTableCard } from '@/components/hr/apex/table-card'
import { minutesToHHMM } from '@/components/hr/apex/time-input'
import { DAYS, dayTotalMinutes, windowsForDay, type CalendarType, type DayWindow, type ShiftKind } from './types'

/**
 * Apex's read-only day table: 7 rows Saturday→Friday. «دوام عادي» shows one
 * حضور(green)/إنصراف(red) pair per وردية — the OFFICIAL check_in/check_out,
 * never the device-open start_in/end_out (that was the bug this batch
 * fixes). «دوام مفتوح» shows a single «ساعات العمل» column instead. The
 * pencil per row opens the day dialog (G10) — this component owns no edit
 * state itself.
 */
export function DayTable({
  kind, calendarType, windows, onEditDay,
}: {
  kind: ShiftKind
  calendarType: CalendarType
  windows: DayWindow[]
  onEditDay: (day: string) => void
}) {
  const th = 'px-3 py-2 text-[13px] font-bold whitespace-nowrap border-b border-slate-200'
  const td = 'px-3 py-1.5 text-[13px] text-center whitespace-nowrap border-b border-slate-100'
  const thNeutral = `${th} text-[var(--apex-text)]`
  const tdNeutral = `${td} text-[var(--apex-text)]`
  const statusStyle = (isWorkDay: boolean) => ({ color: isWorkDay ? 'var(--apex-green)' : 'var(--apex-red)' })

  if (kind === 'Open') {
    return (
      <ApexTableCard>
        <table className="apex-table w-full border-collapse">
          <thead>
            <tr className="bg-[var(--apex-thead)]">
              <th className={thNeutral}>اليوم</th>
              <th className={thNeutral}>ساعات العمل</th>
              <th className={thNeutral}>حالة اليوم</th>
              <th className={thNeutral}>اجراءات</th>
            </tr>
          </thead>
          <tbody>
            {DAYS.map((d) => {
              const row = windowsForDay(windows, calendarType, d.value)[0]
              const isWorkDay = !!row
              const hours = row && row.required_minutes !== '' && row.required_minutes != null
                ? minutesToHHMM(Number(row.required_minutes))
                : '_'
              return (
                <tr key={d.value}>
                  <td className={td} style={{ color: '#0056b3' }}>{d.label}</td>
                  <td className={tdNeutral}>{hours}</td>
                  <td className={`${td} font-bold`} style={statusStyle(isWorkDay)}>{isWorkDay ? 'عمل' : 'عطله'}</td>
                  <td className={tdNeutral}>
                    <button type="button" onClick={() => onEditDay(d.value)} aria-label={`تعديل ${d.label}`} className="text-[var(--apex-link)] hover:opacity-70">
                      <Pencil className="h-4 w-4 mx-auto" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </ApexTableCard>
    )
  }

  return (
    <ApexTableCard>
      <table className="apex-table w-full border-collapse">
        <thead>
          <tr className="bg-[var(--apex-thead)]">
            <th className={thNeutral} rowSpan={2}>اليوم</th>
            <th className={thNeutral} colSpan={2}>الوردية الاولي</th>
            <th className={thNeutral} colSpan={2}>الوردية الثانية</th>
            <th className={thNeutral} colSpan={2}>الوردية الثالثة</th>
            <th className={thNeutral} colSpan={2}>الوردية الرابعة</th>
            <th className={thNeutral} rowSpan={2}>إجمالي الساعات</th>
            <th className={thNeutral} rowSpan={2}>حالة اليوم</th>
            <th className={thNeutral} rowSpan={2}>اجراءات</th>
          </tr>
          <tr className="bg-[var(--apex-thead)]">
            {[0, 1, 2, 3].map((i) => (
              <Fragment key={i}>
                <th className={th} style={{ color: 'var(--apex-green)' }}>حضور</th>
                <th className={th} style={{ color: 'var(--apex-red)' }}>إنصراف</th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAYS.map((d) => {
            const dayWindows = windowsForDay(windows, calendarType, d.value)
            const totalMinutes = dayTotalMinutes(dayWindows)
            const isWorkDay = dayWindows.length > 0
            return (
              <tr key={d.value}>
                <td className={td} style={{ color: '#0056b3' }}>{d.label}</td>
                {[0, 1, 2, 3].map((i) => {
                  const w = dayWindows[i]
                  return (
                    <Fragment key={i}>
                      <td className={tdNeutral}>{w?.check_in || '_'}</td>
                      <td className={tdNeutral}>{w?.check_out || '_'}</td>
                    </Fragment>
                  )
                })}
                <td className={tdNeutral}>{isWorkDay ? minutesToHHMM(totalMinutes) : '_'}</td>
                <td className={`${td} font-bold`} style={statusStyle(isWorkDay)}>{isWorkDay ? 'عمل' : 'عطله'}</td>
                <td className={tdNeutral}>
                  <button type="button" onClick={() => onEditDay(d.value)} aria-label={`تعديل ${d.label}`} className="text-[var(--apex-link)] hover:opacity-70">
                    <Pencil className="h-4 w-4 mx-auto" />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </ApexTableCard>
  )
}
