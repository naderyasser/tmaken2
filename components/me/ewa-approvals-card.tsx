'use client'

/**
 * راتبي المرن — Earned Wage Access approvals card for /me (manager / HR).
 *
 * Lists pending EWA requests the caller may act on. Each row: Approve (اعتماد) →
 * approve_ewa, or Reject (رفض) with an optional reason → reject_ewa.
 *
 * Self-gating: get_ewa_pending_approvals returns [] for non-approvers (or when
 * there is nothing pending), in which case the card renders nothing.
 */

import * as React from 'react'
import { useCallback, useEffect, useState } from 'react'
import {
  Wallet, Loader2, Check, X, Building2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, dualDate } from '@/lib/format'
import { ewaApi, type EwaPendingApproval } from '@/lib/ewa-api'

export function EwaApprovalsCard() {
  const { isRTL } = useI18n()
  const tt = (en: string, ar: string) => (isRTL ? ar : en)
  const { toast } = useToast()

  const [ready, setReady] = useState(false)
  const [rows, setRows] = useState<EwaPendingApproval[]>([])
  const [acting, setActing] = useState('')
  const [rejectName, setRejectName] = useState('')
  const [reason, setReason] = useState('')

  const money = (n: number | null | undefined) => formatCurrency(n, { locale: isRTL ? 'ar' : 'en' })

  const load = useCallback(async () => {
    try {
      setRows(await ewaApi.getPendingApprovals())
    } catch {
      setRows([])
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const approve = useCallback(async (name: string) => {
    setActing(name)
    try {
      await ewaApi.approveEwa(name)
      toast({ title: tt('Approved', 'تم الاعتماد') })
      await load()
    } catch (e: any) {
      toast({ title: tt('Error', 'خطأ'), description: String(e?.message || e), variant: 'destructive' })
    } finally {
      setActing('')
    }
  }, [isRTL, load, toast])

  const submitReject = useCallback(async () => {
    if (!rejectName) return
    const name = rejectName
    setActing(name)
    try {
      await ewaApi.rejectEwa(name, reason.trim() || undefined)
      toast({ title: tt('Rejected', 'تم الرفض') })
      setRejectName('')
      setReason('')
      await load()
    } catch (e: any) {
      toast({ title: tt('Error', 'خطأ'), description: String(e?.message || e), variant: 'destructive' })
    } finally {
      setActing('')
    }
  }, [rejectName, reason, isRTL, load, toast])

  // Self-hide until we know there is something to approve.
  if (!ready || rows.length === 0) return null

  return (
    <>
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            {tt('EWA approvals', 'اعتمادات راتبي المرن')}
          </CardTitle>
          <Badge variant="outline" className="text-[11px]">{rows.length}</Badge>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {rows.map((r) => (
            <div key={r.name} className="rounded-lg border border-border p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.employee_name || r.employee}</p>
                  {r.branch && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Building2 className="h-3 w-3 shrink-0" />{r.branch}
                    </p>
                  )}
                </div>
                <span className="text-sm font-semibold tabular-nums shrink-0">{money(r.amount)}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {dualDate(r.requested_on)}
                {' · '}
                {tt('Earned', 'المستحق')}: <span className="tabular-nums">{money(r.earned_balance_snapshot)}</span>
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                <Button
                  size="sm" variant="outline"
                  className="h-8 gap-1 text-success border-success/30"
                  disabled={acting === r.name}
                  onClick={() => approve(r.name)}
                >
                  {acting === r.name ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  {tt('Approve', 'اعتماد')}
                </Button>
                <Button
                  size="sm" variant="outline"
                  className="h-8 gap-1 text-destructive border-destructive/30"
                  disabled={acting === r.name}
                  onClick={() => { setReason(''); setRejectName(r.name) }}
                >
                  <X className="h-3.5 w-3.5" />
                  {tt('Reject', 'رفض')}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Reject reason dialog */}
      <Dialog open={!!rejectName} onOpenChange={(o) => { if (!o) setRejectName('') }}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'} className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tt('Reject request', 'رفض الطلب')}</DialogTitle>
            <DialogDescription>{tt('Add an optional reason for the employee.', 'أضف سببًا اختياريًا للموظف.')}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={tt('Reason (optional)', 'السبب (اختياري)')}
            className="min-h-[90px]"
          />
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setRejectName('')} disabled={!!acting}>
              {tt('Cancel', 'إلغاء')}
            </Button>
            <Button variant="destructive" className="gap-1.5" onClick={submitReject} disabled={!!acting}>
              {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              {tt('Reject', 'رفض')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
