'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, Loader2, Plane } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { frappeClient } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { translateEnum } from '@/lib/enums'
import { useToast } from '@/hooks/use-toast'

// ── date helpers (native; the project has no date lib for this) ──
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const weekStartOf = (d: Date) => addDays(d, -d.getDay()) // Sunday-start week

interface Cell { type: 'shift' | 'leave' | 'off'; shift?: string; start?: string | null; end?: string | null; leave_type?: string; half_day?: number }
interface Row { employee: string; employee_name: string; designation: string | null; cells: Record<string, Cell> }

const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : '')

export function ShiftCalendar() {
  const { t, isRTL, lang } = useI18n()
  const { toast } = useToast()
  const [weekStart, setWeekStart] = useState<Date>(() => weekStartOf(new Date()))
  const [days, setDays] = useState<string[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const from = ymd(weekStart)
    const to = ymd(addDays(weekStart, 6))
    try {
      const r = await frappeClient.call('base_meena.hr_management.calendar_api.get_shift_calendar', { from_date: from, to_date: to })
      setDays(r?.message?.days || [])
      setRows(r?.message?.employees || [])
    } catch {
      toast({ title: t('error'), description: t('cal.load_fail'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [weekStart, t, toast])

  useEffect(() => { load() }, [load])

  const dayHeaders = useMemo(() => days.map((d) => {
    const date = new Date(d + 'T00:00:00')
    return {
      key: d,
      name: date.toLocaleDateString(lang === 'ar' ? 'ar' : 'en', { weekday: 'short' }),
      num: date.getDate(),
      isToday: ymd(new Date()) === d,
    }
  }), [days, lang])

  const rangeLabel = days.length
    ? `${new Date(days[0] + 'T00:00:00').toLocaleDateString(lang === 'ar' ? 'ar' : 'en', { day: 'numeric', month: 'short' })} – ${new Date(days[days.length - 1] + 'T00:00:00').toLocaleDateString(lang === 'ar' ? 'ar' : 'en', { day: 'numeric', month: 'short' })}`
    : ''

  // Logical: in RTL the "previous" control points right.
  const PrevIcon = isRTL ? ChevronRight : ChevronLeft
  const NextIcon = isRTL ? ChevronLeft : ChevronRight

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto" dir={isRTL ? 'rtl' : 'ltr'}>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">{t('cal.title')}</CardTitle>
              <p className="text-sm text-muted-foreground">{rangeLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={() => setWeekStart((w) => addDays(w, -7))} aria-label={t('cal.prev')}><PrevIcon className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => setWeekStart(weekStartOf(new Date()))}>{t('cal.today')}</Button>
            <Button variant="outline" size="sm" onClick={() => setWeekStart((w) => addDays(w, 7))} aria-label={t('cal.next')}><NextIcon className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-16 text-center">{t('cal.no_employees')}</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[820px]">
                {/* header */}
                <div className="grid" style={{ gridTemplateColumns: 'minmax(150px,1.3fr) repeat(7, minmax(92px,1fr))' }}>
                  <div className="px-3 py-2 text-xs font-medium text-muted-foreground">{t('cal.employee')}</div>
                  {dayHeaders.map((h) => (
                    <div key={h.key} className={`px-2 py-2 text-center border-s border-border ${h.isToday ? 'bg-primary/5' : ''}`}>
                      <div className="text-xs font-medium text-foreground capitalize">{h.name}</div>
                      <div className={`text-xs ${h.isToday ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>{h.num}</div>
                    </div>
                  ))}
                </div>
                {/* rows */}
                {rows.map((r) => (
                  <div key={r.employee} className="grid border-t border-border" style={{ gridTemplateColumns: 'minmax(150px,1.3fr) repeat(7, minmax(92px,1fr))' }}>
                    <div className="px-3 py-2.5 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{r.employee_name}</p>
                      {r.designation && <p className="text-xs text-muted-foreground truncate">{translateEnum('designation', r.designation, lang === 'en' ? 'en' : 'ar')}</p>}
                    </div>
                    {days.map((d) => {
                      const c = r.cells[d]
                      return (
                        <div key={d} className="px-1.5 py-2 border-s border-border flex items-center justify-center">
                          {c?.type === 'shift' ? (
                            <div className="w-full rounded-md bg-primary/10 text-primary px-1.5 py-1 text-center">
                              <div className="text-[11px] font-semibold leading-tight">{hhmm(c.start)}</div>
                              <div className="text-[10px] text-primary/70 leading-tight">{hhmm(c.end)}</div>
                            </div>
                          ) : c?.type === 'leave' ? (
                            <div className="w-full rounded-md bg-amber-500/10 text-amber-700 px-1.5 py-1 text-center flex flex-col items-center gap-0.5" title={translateEnum('leaveType', c.leave_type, lang === 'en' ? 'en' : 'ar')}>
                              <Plane className="h-3 w-3" />
                              <span className="text-[10px] font-medium leading-tight truncate max-w-full">{translateEnum('leaveType', c.leave_type, lang === 'en' ? 'en' : 'ar')}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">·</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* legend */}
          <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-primary/20 border border-primary/30" /> {t('cal.shift')}</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-500/20 border border-amber-500/40" /> {t('cal.on_leave')}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
