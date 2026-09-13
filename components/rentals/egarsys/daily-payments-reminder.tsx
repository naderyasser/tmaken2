'use client'

// Once-a-day reminder popup, mirrored from egarsys's daily-payments-reminder.
// On app open it surfaces (1) tenants LATE to pay (overdue installments) and
// (2) tenants who need to pay SOON (due within 7 days), reusing the EXACT same
// figures the dashboard panel «المدفوعات القادمة والمتأخرة» shows — no recompute.
//
// Data source: getDashboardStats() from lib/rentals/dashboard-data (the mirror-
// backed installment engine). We read paymentSchedule.overdue / .upcoming and
// filter upcoming to a 7-day window. Pure display; zero writes.
//
// Gate: localStorage `rentals-native-daily-payments` = today's YYYY-MM-DD. If it
// already equals today, the component renders nothing (shown once per calendar
// day). Both-empty → mark seen + render nothing. Any fetch error → self-hide
// WITHOUT marking seen, so the next app open can retry.

import * as React from 'react'
import { AlertTriangle, Clock } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Button } from './ui/button'
import { useRentalsShell } from './store'
import { getDashboardStats } from '@/lib/rentals/dashboard-data'
import type { PaymentScheduleRow } from './types'
import { formatSAR, formatDate, installmentLabelAr, toArabicNumerals } from './format'
import { cn, localToday } from '@/lib/utils'

const SEEN_KEY = 'rentals-native-daily-payments'
const UPCOMING_WINDOW_DAYS = 7
const MAX_ROWS = 15
const DAY_MS = 864e5

function markSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, localToday())
  } catch {
    /* private mode / storage disabled — degrade to showing again next open */
  }
}

function seenToday(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === localToday()
  } catch {
    return false
  }
}

/** Mirror datetimes are naive "YYYY-MM-DD HH:MM:SS" — anchor to UTC (matches
 *  dashboard-data.toDate) so the 7-day window doesn't drift by timezone. */
function parseDue(v: string | null | undefined): Date | null {
  if (!v) return null
  const s = String(v).replace(' ', 'T')
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + 'Z')
  return isNaN(d.getTime()) ? null : d
}

function ReminderRow({ row, overdue }: { row: PaymentScheduleRow; overdue?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-2 rounded-lg px-3 py-2.5',
        overdue
          ? 'bg-red-50/70 dark:bg-red-950/20'
          : 'bg-amber-50/70 dark:bg-amber-950/15',
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        {overdue ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
        ) : (
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        )}
        <div className="min-w-0">
          <p
            className={cn(
              'truncate text-sm font-bold',
              overdue ? 'text-red-700 dark:text-red-300' : 'text-slate-700 dark:text-slate-200',
            )}
          >
            {row.tenantName || '—'}
          </p>
          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
            العقد {row.contractNumber} ·{' '}
            <span
              className={cn(
                'font-semibold',
                overdue && 'font-bold text-red-600 dark:text-red-400',
              )}
            >
              {installmentLabelAr(row.installmentNo)}
            </span>
          </p>
        </div>
      </div>
      <div className="shrink-0 text-left">
        <p
          className={cn(
            'whitespace-nowrap text-sm font-bold',
            overdue ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100',
          )}
        >
          {formatSAR(row.amount)}
        </p>
        <p
          className={cn(
            'whitespace-nowrap text-[11px] font-semibold',
            overdue ? 'text-red-500' : 'text-amber-600 dark:text-amber-500',
          )}
        >
          {formatDate(row.dueDate)}
        </p>
      </div>
    </div>
  )
}

function ReminderSection({
  emoji,
  title,
  rows,
  overdue,
}: {
  emoji: string
  title: string
  rows: PaymentScheduleRow[]
  overdue?: boolean
}) {
  const shown = rows.slice(0, MAX_ROWS)
  const extra = rows.length - shown.length
  return (
    <section className="px-2 py-2">
      <h3 className="mb-1.5 flex items-center gap-1.5 px-1 text-sm font-extrabold text-foreground">
        <span aria-hidden>{emoji}</span>
        {title} ({toArabicNumerals(rows.length)})
      </h3>
      <div className="flex flex-col gap-1.5">
        {shown.map((r, i) => (
          <ReminderRow key={`${overdue ? 'ov' : 'up'}-${r.contractNumber}-${r.installmentNo}-${i}`} row={r} overdue={overdue} />
        ))}
      </div>
      {extra > 0 && (
        <p className="px-1 pt-1.5 text-[11px] font-semibold text-muted-foreground">
          +{toArabicNumerals(extra)} غيرهم
        </p>
      )}
    </section>
  )
}

export default function DailyPaymentsReminder() {
  const { theme, mounted } = useRentalsShell()
  const isDark = theme === 'dark'
  const [open, setOpen] = React.useState(false)
  const [overdue, setOverdue] = React.useState<PaymentScheduleRow[]>([])
  const [upcoming, setUpcoming] = React.useState<PaymentScheduleRow[]>([])

  React.useEffect(() => {
    if (!mounted || seenToday()) return
    let cancelled = false
    getDashboardStats()
      .then((stats) => {
        if (cancelled) return
        const ov = stats?.paymentSchedule?.overdue ?? []
        const upAll = stats?.paymentSchedule?.upcoming ?? []
        const cutoff = Date.now() + UPCOMING_WINDOW_DAYS * DAY_MS
        const up = upAll.filter((r) => {
          const d = parseDue(r.dueDate)
          return d != null && d.getTime() <= cutoff
        })
        if (ov.length === 0 && up.length === 0) {
          markSeen() // nothing to nag about today — don't reopen
          return
        }
        setOverdue(ov)
        setUpcoming(up)
        setOpen(true)
      })
      .catch(() => {
        /* self-hide on any fetch error; leave the gate unset so the next open retries */
      })
    return () => {
      cancelled = true
    }
  }, [mounted])

  const dismiss = React.useCallback(() => {
    markSeen()
    setOpen(false)
  }, [])

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : dismiss())}>
      <DialogContent
        dir="rtl"
        // Portalled to <body> (outside `.egarsys-scope`) — re-attach the scope +
        // local dark class so egarsys green tokens and dark: utilities resolve.
        className={cn(
          'egarsys-scope',
          isDark && 'dark egarsys-dark',
          'w-[calc(100vw-1.5rem)] max-w-md gap-0 overflow-hidden p-0',
          'pb-[env(safe-area-inset-bottom)]',
        )}
      >
        <DialogHeader className="space-y-1 px-5 pb-3 pl-5 pr-10 pt-5 text-right sm:text-right">
          <DialogTitle className="flex items-center gap-2 text-lg font-extrabold">
            <span aria-hidden>🔔</span> تذكير اليوم
          </DialogTitle>
          <DialogDescription className="text-xs font-medium">
            {formatDate(localToday())}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto">
          {overdue.length > 0 && (
            <ReminderSection emoji="🔴" title="متأخرون عن السداد" rows={overdue} overdue />
          )}
          {upcoming.length > 0 && (
            <ReminderSection emoji="🟠" title="مستحقون خلال ٧ أيام" rows={upcoming} />
          )}
        </div>

        <DialogFooter className="border-t px-5 py-3">
          <Button onClick={dismiss} className="w-full sm:w-auto">
            تم
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
