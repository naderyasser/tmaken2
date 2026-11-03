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
  // Apex-measured (getComputedStyle) values below are applied INLINE because
  // globals.css's `.theme-hr .apex-table th/td` rule (font-size:14px,
  // color:var(--apex-text)) outranks any Tailwind utility class here.
  const headerCellStyle = { fontSize: '16px', fontWeight: 700, color: 'rgb(0,0,0)' }
  const attendanceHeaderStyle = { fontSize: '16px', fontWeight: 700, color: 'rgb(0,128,0)' }
  const departureHeaderStyle = { fontSize: '16px', fontWeight: 700, color: 'rgb(255,0,0)' }
  const subHeaderRowStyle = { backgroundColor: 'rgb(220,220,220)' }
  const bodyRowStyle = { height: '61.5px' }
  const dayNameStyle = { color: 'rgb(41,96,182)' }
  const blackValueStyle = { color: 'rgb(0,0,0)' }
  const statusStyle = (isWorkDay: boolean) => ({ color: isWorkDay ? 'rgb(0,128,0)' : 'rgb(255,0,0)', fontWeight: 400 })

  if (kind === 'Open') {
    return (
      <ApexTableCard>
        <table className="apex-table w-full border-collapse">
          <thead>
            <tr className="bg-[var(--apex-thead)]">
              <th className={thNeutral} style={headerCellStyle}>اليوم</th>
              <th className={thNeutral} style={headerCellStyle}>ساعات العمل</th>
              <th className={thNeutral} style={headerCellStyle}>حالة اليوم</th>
              <th className={thNeutral} style={headerCellStyle}>اجراءات</th>
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
                <tr key={d.value} style={bodyRowStyle}>
                  <td className={td} style={dayNameStyle}>{d.label}</td>
                  <td className={tdNeutral} style={blackValueStyle}>{hours}</td>
                  <td className={td} style={statusStyle(isWorkDay)}>{isWorkDay ? 'عمل' : 'عطله'}</td>
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
            <th className={thNeutral} style={headerCellStyle} rowSpan={2}>اليوم</th>
            <th className={thNeutral} style={headerCellStyle} colSpan={2}>الوردية الاولي</th>
            <th className={thNeutral} style={headerCellStyle} colSpan={2}>الوردية الثانية</th>
            <th className={thNeutral} style={headerCellStyle} colSpan={2}>الوردية الثالثة</th>
            <th className={thNeutral} style={headerCellStyle} colSpan={2}>الوردية الرابعة</th>
            <th className={thNeutral} style={headerCellStyle} rowSpan={2}>إجمالي الساعات</th>
            <th className={thNeutral} style={headerCellStyle} rowSpan={2}>حالة اليوم</th>
            <th className={thNeutral} style={headerCellStyle} rowSpan={2}>اجراءات</th>
          </tr>
          <tr style={subHeaderRowStyle}>
            {[0, 1, 2, 3].map((i) => (
              <Fragment key={i}>
                <th className={th} style={attendanceHeaderStyle}>حضور</th>
                <th className={th} style={departureHeaderStyle}>إنصراف</th>
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
              <tr key={d.value} style={bodyRowStyle}>
                <td className={td} style={dayNameStyle}>{d.label}</td>
                {[0, 1, 2, 3].map((i) => {
                  const w = dayWindows[i]
                  return (
                    <Fragment key={i}>
                      <td className={tdNeutral} style={blackValueStyle}>{w?.check_in || '_'}</td>
                      <td className={tdNeutral} style={blackValueStyle}>{w?.check_out || '_'}</td>
                    </Fragment>
                  )
                })}
                <td className={tdNeutral} style={blackValueStyle}>{isWorkDay ? minutesToHHMM(totalMinutes) : '_'}</td>
                <td className={td} style={statusStyle(isWorkDay)}>{isWorkDay ? 'عمل' : 'عطله'}</td>
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
