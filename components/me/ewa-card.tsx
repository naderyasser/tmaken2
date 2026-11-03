'use client'

/**
 * راتبي المرن — Earned Wage Access employee card for /me.
 *
 * Shows the earned-so-far meter (available vs the earned cap), lets the employee
 * request an advance (طلب سلفة) against it, and lists their recent requests with a
 * cancel action on pending rows.
 *
 * Feature-flag-safe: if get_my_earned_balance returns {enabled:false} — or the probe
 * errors — the card renders nothing so it never disrupts the dashboard.
 */

import * as React from 'react'
import { useCallback, useEffect, useState } from 'react'
import {
  Wallet, Loader2, Plus, Ban, AlertCircle, CalendarClock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, dualDate, formatDateShort } from '@/lib/format'
import {
  ewaApi, type EwaBalanceEnabled, type EwaRequestRow, type EwaStatus,
} from '@/lib/ewa-api'

const STATUS_AR: Record<EwaStatus, string> = {
  Pending: 'قيد الاعتماد',
  Approved: 'مُعتمد',
  Rejected: 'مرفوض',
  Disbursed: 'مصروف',
  Cancelled: 'ملغى',
}

type Phase = 'loading' | 'off' | 'ready'

export function EwaCard() {
  const { isRTL } = useI18n()
  const tt = (en: string, ar: string) => (isRTL ? ar : en)
  const { toast } = useToast()

  const [phase, setPhase] = useState<Phase>('loading')
  const [bal, setBal] = useState<EwaBalanceEnabled | null>(null)
  const [rows, setRows] = useState<EwaRequestRow[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [cancelling, setCancelling] = useState('')

  const money = useCallback(
    (n: number | null | undefined) =>
      formatCurrency(n, { locale: isRTL ? 'ar' : 'en', currency: bal?.currency || 'SAR' }),
    [isRTL, bal?.currency],
  )

  const load = useCallback(async () => {
    try {
      const b = await ewaApi.getMyBalance()
      if (!b.enabled) {
        setPhase('off')
        return
      }
      setBal(b)
      setPhase('ready')
      try {
        setRows(await ewaApi.getMyRequests())
      } catch {
        setRows([])
      }
    } catch {
      setPhase('off')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const submit = useCallback(async () => {
    if (!bal) return
    const parsed = Number(amount)
    setSubmitting(true)
    try {
      const res = await ewaApi.requestEwa(parsed)
      toast({
        title: res.auto_approved ? tt('Advance approved', 'تم اعتماد السلفة') : tt('Request submitted', 'تم إرسال الطلب'),
        description: res.auto_approved
          ? tt('Your advance was auto-approved and will settle on payday.', 'تم اعتماد سلفتك تلقائيًا وستُسوّى مع الراتب.')
          : tt('Your request is pending approval.', 'طلبك قيد الاعتماد.'),
      })
      setDialogOpen(false)
      setAmount('')
      await load()
    } catch (e: any) {
      toast({ title: tt('Request failed', 'تعذّر الطلب'), description: String(e?.message || e), variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }, [amount, bal, isRTL, load, toast])

  const cancel = useCallback(async (name: string) => {
    setCancelling(name)
    try {
      await ewaApi.cancelEwa(name)
      toast({ title: tt('Request cancelled', 'تم إلغاء الطلب') })
      await load()
    } catch (e: any) {
      toast({ title: tt('Error', 'خطأ'), description: String(e?.message || e), variant: 'destructive' })
    } finally {
      setCancelling('')
    }
  }, [isRTL, load, toast])

  if (phase === 'loading') {
    return (
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" />{tt('Flexible salary', 'راتبي المرن')}</CardTitle></CardHeader>
        <CardContent className="pt-0 space-y-3">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-8 w-full rounded-lg" />
        </CardContent>
      </Card>
    )
  }
  if (phase !== 'ready' || !bal) return null

  const pct = bal.cap_amount > 0 ? Math.max(0, Math.min(100, (bal.available / bal.cap_amount) * 100)) : 0

  // Eligibility gate — the same rules the backend enforces, surfaced up-front.
  const blockedReason =
    !bal.tenure_ok
      ? tt('You have not met the minimum tenure yet.', 'لم تستوفِ بعد الحد الأدنى لمدة الخدمة.')
      : bal.in_blackout
        ? tt('Requests are closed close to payday.', 'الطلبات مغلقة قرب موعد الراتب.')
        : bal.requests_used >= bal.max_requests
          ? tt('You have reached this month’s request limit.', 'لقد بلغت الحد الشهري للطلبات.')
          : bal.available < bal.min_amount
            ? tt(`Your available balance is below the minimum of ${money(bal.min_amount)}.`, `رصيدك المتاح أقل من الحد الأدنى ${money(bal.min_amount)}.`)
            : ''
  const canRequest = !blockedReason

  const parsed = Number(amount)
  const amountError =
    amount === '' || !Number.isFinite(parsed)
      ? ''
      : parsed < bal.min_amount
        ? tt(`Minimum is ${money(bal.min_amount)}.`, `الحد الأدنى ${money(bal.min_amount)}.`)
        : parsed > bal.available
          ? tt(`Maximum is ${money(bal.available)}.`, `الحد الأقصى ${money(bal.available)}.`)
          : ''
  const canSubmit = !submitting && amount !== '' && Number.isFinite(parsed) && !amountError

  const Figure = ({ label, value }: { label: string; value: string }) => (
    <div className="rounded-lg border border-border bg-card p-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground mt-0.5 tabular-nums">{value}</p>
    </div>
  )

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            {tt('Flexible salary', 'راتبي المرن')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {/* Earned-so-far meter */}
          <div className="rounded-lg border border-border bg-accent/40 p-4">
            <p className="text-xs text-muted-foreground">{tt('Available balance', 'رصيدك المتاح')}</p>
            <p className="text-2xl font-bold text-primary mt-0.5 tabular-nums">{money(bal.available)}</p>
            <Progress value={pct} className="h-2 mt-3" />
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {tt(`of ${money(bal.cap_amount)} earned cap (${bal.cap_percent}%)`, `من سقف المستحق ${money(bal.cap_amount)} (${bal.cap_percent}%)`)}
            </p>
          </div>

          {/* Supporting figures */}
          <div className="grid grid-cols-2 gap-2">
            <Figure label={tt('Present days', 'أيام الحضور')} value={String(bal.present_days)} />
            <Figure label={tt('Daily rate', 'الأجر اليومي')} value={money(bal.daily_rate)} />
            <Figure label={tt('Earned so far', 'المستحق حتى الآن')} value={money(bal.gross_earned)} />
            <Figure label={tt('Outstanding', 'المسحوب')} value={money(bal.outstanding)} />
          </div>

          {/* Request advance */}
          <Button
            onClick={() => { setAmount(''); setDialogOpen(true) }}
            disabled={!canRequest}
            className="w-full h-11 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            {tt('Request advance', 'طلب سلفة')}
          </Button>
          {blockedReason && (
            <div className="flex items-start gap-2 rounded-lg bg-warning/15 text-warning p-2.5 text-xs">
              <AlertCircle className="h-4 w-4 mt-px shrink-0" />
              <span>{blockedReason}</span>
            </div>
          )}

          {/* My requests */}
          <div>
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5">
              <CalendarClock className="h-3.5 w-3.5" />
              {tt('My requests', 'طلباتي')}
            </p>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-1">{tt('No requests yet.', 'لا توجد طلبات بعد.')}</p>
            ) : (
              <div className="space-y-1.5">
                {rows.map((r) => (
                  <div key={r.name} className="rounded-lg border border-border p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold tabular-nums">{money(r.amount)}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <StatusBadge status={r.status} label={isRTL ? STATUS_AR[r.status] : r.status} />
                        {r.status === 'Pending' && (
                          <Button
                            size="sm" variant="outline"
                            className="h-7 gap-1 text-destructive border-destructive/30"
                            disabled={cancelling === r.name}
                            onClick={() => cancel(r.name)}
                          >
                            {cancelling === r.name ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                            {tt('Cancel', 'إلغاء')}
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">{dualDate(r.requested_on)}</p>
                    {r.status === 'Rejected' && r.reject_reason && (
                      <p className="text-[11px] text-destructive mt-0.5">{tt('Reason', 'السبب')}: {r.reject_reason}</p>
                    )}
                    {r.status === 'Disbursed' && r.payroll_date && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{tt('Settles on', 'التسوية في')} {formatDateShort(r.payroll_date, { withHijri: true })}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Request dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'} className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              {tt('Request advance', 'طلب سلفة')}
            </DialogTitle>
            <DialogDescription>
              {tt(`Between ${money(bal.min_amount)} and your available ${money(bal.available)}.`, `بين ${money(bal.min_amount)} ورصيدك المتاح ${money(bal.available)}.`)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Input
              type="number"
              inputMode="decimal"
              value={amount}
              min={bal.min_amount}
              max={bal.available}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={tt('Amount', 'المبلغ')}
              className="h-11 text-lg tabular-nums"
            />
            {amountError && (
              <p className="text-xs text-destructive">{amountError}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              {tt('Cancel', 'إلغاء')}
            </Button>
            <Button
              onClick={submit}
              disabled={!canSubmit}
              className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {tt('Submit request', 'إرسال الطلب')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
