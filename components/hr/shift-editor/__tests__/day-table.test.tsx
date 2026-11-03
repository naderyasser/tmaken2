import { render, screen } from '@testing-library/react'
import { DayTable } from '@/components/hr/shift-editor/day-table'
import { emptyWindow, type DayWindow } from '@/components/hr/shift-editor/types'

function rowText(dayLabel: string) {
  return Array.from(screen.getByText(dayLabel).closest('tr')!.querySelectorAll('td')).map((td) => td.textContent)
}

describe('DayTable (Normal) — إجمالي الساعات', () => {
  it('shows "_" for a day with no ورديات, never "00:00"', () => {
    render(<DayTable kind="Normal" calendarType="Year" windows={[]} onEditDay={() => {}} />)
    expect(rowText('الجمعة')).toEqual(['الجمعة', '_', '_', '_', '_', '_', '_', '_', '_', '_', 'عطله', ''])
  })

  it('still sums real hours for a day that has ورديات', () => {
    const w: DayWindow = { ...emptyWindow('Year', 'Saturday', 1), check_in: '09:00', check_out: '17:00' }
    render(<DayTable kind="Normal" calendarType="Year" windows={[w]} onEditDay={() => {}} />)
    expect(rowText('السبت')).toEqual(['السبت', '09:00', '17:00', '_', '_', '_', '_', '_', '_', '08:00', 'عمل', ''])
  })
})
