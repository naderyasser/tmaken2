'use client'

/**
 * Monthly punch sheet — the per-day In/Out grid an HR officer reviews at month
 * end, and the screen that replaces a hand-maintained external subscription.
 *
 * Two presentations of the same data by width, rather than one squeezed table:
 * a phone gets one card per day (a squeezed grid wraps every timestamp onto
 * four lines and turns a month into an unreadable column), a wider screen gets
 * the full grid with a column per work period.
 *
 * Employees are collapsed by default and expanded one at a time — a branch
 * month is thousands of cells, and rendering all of it is what makes the page
 * feel heavy on a phone.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  RefreshCw, Download, FileText, ChevronDown, ChevronUp, AlertTriangle,
  Loader2, CalendarDays,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { useI18n } from '@/lib/i18n'
import {
  getPunchSheet, punchSheetPdfUrl, punchSheetXlsxUrl,
  type PunchSheet as Sheet, type PunchSheetDay, type PunchSheetEmployee,
} from '@/lib/punch-api'

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** 0 renders as an em dash: blank noise is what makes the real numbers visible. */
function mins(value: number): string {
  return value ? String(value) : '—'
}

function DayCard({ day, periodCount, t }: {
  day: PunchSheetDay; periodCount: number; t: (k: string) => string
}) {
  return (
    <div className={`rounded-md border p-3 ${day.attended ? '' : 'bg-muted/40'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium text-sm">
          {day.day_name} <span className="text-muted-foreground" dir="ltr">{day.date}</span>
        </div>
        {day.total_late_minutes > 0 && (
          <Badge variant="destructive">{day.total_late_minutes} {t('psh.min')}</Badge>
        )}
      </div>
      {day.attended ? (
        <div className="mt-2 space-y-1">
          {day.periods.slice(0, periodCount).map((p, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('psh.period')} {i + 1}</span>
              <span dir="ltr" className="font-mono">
                {p.in ?? '—'} → {p.out ?? '—'}
              </span>
              <span className={p.late_minutes ? 'text-red-600' : 'text-muted-foreground'}>
                {mins(p.late_minutes)}
              </span>
            </div>
          ))}
          {day.overtime_minutes > 0 && (
            <div className="text-xs text-amber-700">
              OT: {day.overtime_minutes} {t('psh.min')}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-2 text-sm text-muted-foreground">{t('psh.noPunches')}</div>
      )}
    </div>
  )
}

function EmployeeBlock({ entry, sheet, month, t }: {
  entry: PunchSheetEmployee; sheet: Sheet; month: string; t: (k: string) => string
}) {
  const [open, setOpen] = useState(false)
  const periods = sheet.periods

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            className="flex items-center gap-2 text-start min-w-0"
          >
            {open ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
            <div className="min-w-0">
              <CardTitle className="text-base truncate">
                {entry.employee_name || entry.employee}
              </CardTitle>
              <div className="text-xs text-muted-foreground truncate" dir="ltr">
                {[entry.national_id, entry.branch].filter(Boolean).join(' · ') || entry.employee}
              </div>
            </div>
          </button>
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <a href={punchSheetPdfUrl(month, entry.employee)} target="_blank" rel="noreferrer">
              <FileText className="w-4 h-4 me-2" />
              PDF
            </a>
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          <div className="rounded-md border p-2">
            <div className="text-xs text-muted-foreground">{t('psh.attendedDays')}</div>
            <div className="text-lg font-bold">{entry.totals.attended_days}</div>
          </div>
          <div className="rounded-md border p-2">
            <div className="text-xs text-muted-foreground">{t('psh.totalLate')}</div>
            <div className="text-lg font-bold text-red-600">{entry.totals.total_late_minutes}</div>
          </div>
          <div className="rounded-md border p-2">
            <div className="text-xs text-muted-foreground">OT</div>
            <div className="text-lg font-bold text-amber-600">{entry.totals.overtime_minutes}</div>
          </div>
          <div className="rounded-md border p-2">
            <div className="text-xs text-muted-foreground">{t('psh.incompleteDays')}</div>
            <div className="text-lg font-bold">{entry.totals.incomplete_days}</div>
          </div>
        </div>
      </CardHeader>

      {open && (
        <CardContent>
          {/* Phone: one card per day */}
          <div className="space-y-2 md:hidden">
            {entry.days.map(day => (
              <DayCard key={day.date} day={day} periodCount={periods.length} t={t} />
            ))}
          </div>

          {/* Wider: the full grid, scrolling inside its own box */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-start font-medium py-2 px-2">{t('psh.date')}</th>
                  <th className="text-start font-medium py-2 px-2">{t('psh.day')}</th>
                  {periods.map((p, i) => (
                    <React.Fragment key={i}>
                      <th className="text-center font-medium py-2 px-2">{t('psh.in')} {i + 1}</th>
                      <th className="text-center font-medium py-2 px-2">{t('psh.out')} {i + 1}</th>
                      <th className="text-center font-medium py-2 px-2">{t('psh.late')} {i + 1}</th>
                    </React.Fragment>
                  ))}
                  <th className="text-center font-medium py-2 px-2">{t('psh.earlyExit')}</th>
                  <th className="text-center font-medium py-2 px-2">OT</th>
                  <th className="text-center font-medium py-2 px-2">{t('psh.totalLate')}</th>
                </tr>
              </thead>
              <tbody>
                {entry.days.map(day => (
                  <tr
                    key={day.date}
                    className={`border-b last:border-0 ${day.attended ? '' : 'bg-muted/40'}`}
                  >
                    <td className="py-2 px-2" dir="ltr">{day.date}</td>
                    <td className="py-2 px-2">{day.day_name}</td>
                    {periods.map((_p, i) => {
                      const slot = day.periods[i]
                      return (
                        <React.Fragment key={i}>
                          <td className="py-2 px-2 text-center font-mono" dir="ltr">{slot?.in ?? '—'}</td>
                          <td className="py-2 px-2 text-center font-mono" dir="ltr">{slot?.out ?? '—'}</td>
                          <td className={`py-2 px-2 text-center ${slot?.late_minutes ? 'text-red-600 font-medium' : ''}`}>
                            {mins(slot?.late_minutes ?? 0)}
                          </td>
                        </React.Fragment>
                      )
                    })}
                    <td className="py-2 px-2 text-center">{mins(day.early_minutes)}</td>
                    <td className={`py-2 px-2 text-center ${day.overtime_minutes ? 'text-amber-700' : ''}`}>
                      {mins(day.overtime_minutes)}
                    </td>
                    <td className={`py-2 px-2 text-center font-medium ${day.total_late_minutes ? 'text-red-600' : ''}`}>
                      {mins(day.total_late_minutes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

export function PunchSheet({ refreshKey = 0, jumpToMonth }: {
  refreshKey?: number
  /** Month an import just landed in — the sheet follows it. */
  jumpToMonth?: string
}) {
  const { t } = useI18n()
  const { toast } = useToast()
  const [month, setMonth] = useState(currentMonth())
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [loading, setLoading] = useState(true)

  // A file is almost always a PAST month, so after an import the sheet would
  // otherwise sit on the current month showing nothing — which reads as "the
  // import did not work" rather than "you are looking at the wrong month".
  useEffect(() => {
    if (jumpToMonth) setMonth(jumpToMonth)
  }, [jumpToMonth])

  const load = useCallback(async (targetMonth: string) => {
    setLoading(true)
    try {
      setSheet(await getPunchSheet(targetMonth))
    } catch (err: any) {
      toast({ title: t('psh.loadFailed'), description: err?.message, variant: 'destructive' })
      setSheet(null)
    } finally {
      setLoading(false)
    }
  }, [t, toast])

  useEffect(() => { load(month) }, [load, month, refreshKey])

  const withData = useMemo(
    () => (sheet?.employees ?? []).filter(e => e.totals.punches > 0),
    [sheet],
  )

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{t('psh.title')}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t('psh.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="w-[9.5rem]"
          />
          <Button variant="outline" size="sm" onClick={() => load(month)} disabled={loading}>
            <RefreshCw className={`w-4 h-4 me-2 ${loading ? 'animate-spin' : ''}`} />
            {t('psh.refresh')}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={punchSheetXlsxUrl(month)} target="_blank" rel="noreferrer">
              <Download className="w-4 h-4 me-2" />
              Excel
            </a>
          </Button>
        </div>
      </div>

      {sheet && (
        <Alert variant={sheet.rules.ot_confirmed ? 'default' : 'destructive'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <span dir="ltr" className="font-mono">
              {sheet.periods.map(p => `${p.start}-${p.end}`).join('  ·  ')}
            </span>
            <span className="mx-2">·</span>
            {t('psh.grace')}: {sheet.rules.grace_minutes} {t('psh.min')}
            {!sheet.rules.ot_confirmed && (
              <div className="mt-1 text-sm">{t('psh.otUnconfirmed')}</div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : withData.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-50" />
            {t('psh.noData')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {withData.map(entry => (
            <EmployeeBlock
              key={entry.employee}
              entry={entry}
              sheet={sheet!}
              month={month}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  )
}
