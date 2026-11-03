'use client'

/**
 * ApprovalDrawer (F1) — side panel for a single request/approval flow: header,
 * status, the multi-step approval timeline (the audit trail), the target summary,
 * and Approve / Reject / Cancel actions when permitted. Token-only, RTL-safe.
 */
import * as React from 'react'
import { useEffect, useState } from 'react'
import { Check, X, Clock, MinusCircle, Loader2, FileDown } from 'lucide-react'
import { DetailDrawer } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from '@/components/ui/status-badge'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/hooks/use-toast'
import { dualDate } from '@/lib/format'
import { requestsApi, type FlowDetail, type FlowStep } from '@/lib/requests-api'

function stepIcon(status: string) {
  if (status === 'Approved') return <Check className="h-3.5 w-3.5" />
  if (status === 'Rejected') return <X className="h-3.5 w-3.5" />
  if (status === 'Skipped') return <MinusCircle className="h-3.5 w-3.5" />
  return <Clock className="h-3.5 w-3.5" />
}

export function ApprovalDrawer({
  flow,
  open,
  onOpenChange,
  onActed,
}: {
  flow: string | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onActed?: () => void
}) {
  const { isRTL } = useI18n()
  const tt = (en: string, ar: string) => (isRTL ? ar : en)
  const { user } = useAuth()
  const { toast } = useToast()

  const [detail, setDetail] = useState<FlowDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [comment, setComment] = useState('')

  const load = React.useCallback(async () => {
    if (!flow) return
    setLoading(true)
    try {
      setDetail(await requestsApi.detail(flow))
    } catch {
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [flow])

  useEffect(() => {
    if (open && flow) { setComment(''); setRejecting(false); load() }
  }, [open, flow, load])

  // ── Shape normalization (once, for the whole drawer) ──
  // The backend returns the flow summary FLAT ({...summary, steps, target_summary})
  // where `flow` is the flow DOCNAME (a string). The legacy FlowDetail assumption
  // nested it under `flow`; tolerate both by normalizing here and reading `f`/`target`
  // everywhere below. `steps` is top-level in both shapes.
  const f: Record<string, any> = React.useMemo(() => {
    const d = detail as any
    return (d && typeof d.flow === 'object' && d.flow !== null ? d.flow : d) ?? {}
  }, [detail])
  const target: Record<string, any> = React.useMemo(() => {
    const d = detail as any
    return d?.target ?? d?.target_summary ?? {}
  }, [detail])
  const steps: FlowStep[] = detail?.steps || []
  const status = f.status as string | undefined
  const isPending = status === 'Pending'
  // The step currently awaiting action, and whether it's mine.
  const currentStep = steps.find((s) => s.status === 'Pending')
  const iAmApprover =
    !!currentStep &&
    (currentStep.approver_user === user?.email || currentStep.approver_type === 'Role')
  const iAmRequester = f.requested_by === user?.email || f.employee_user === user?.email

  // ── QR-verified HR letters: PDF download ──
  // `reference_name` is the Letter Request doc name (the flow's target, not the flow).
  const letterName = f.reference_name as string | undefined
  // The letter's own status ('Approved' → 'Issued') lives on the target summary;
  // fall back to the flow status ('Completed' once fully approved) if it's absent.
  const letterStatus = String(target.status || f.status || '')
  const canDownloadLetter =
    f.request_type === 'letter' && !!letterName && ['Approved', 'Issued', 'Completed'].includes(letterStatus)

  const downloadLetter = () => {
    if (!letterName) return
    window.open(
      `/api/method/base_meena.hr_requests.letter_api.download_letter_pdf?letter=${encodeURIComponent(letterName)}`,
      '_blank',
    )
  }

  const act = async (kind: 'approve' | 'reject' | 'cancel') => {
    if (!flow) return
    if (kind === 'reject' && !comment.trim()) {
      toast({ title: tt('Reason required', 'السبب مطلوب'), description: tt('Please add a reason to reject.', 'يرجى إضافة سبب الرفض.'), variant: 'destructive' })
      return
    }
    setBusy(true)
    try {
      if (kind === 'approve') await requestsApi.approve(flow, comment.trim() || undefined)
      else if (kind === 'reject') await requestsApi.reject(flow, comment.trim())
      else await requestsApi.cancel(flow)
      toast({ title: tt('Done', 'تم'), description: tt('The request was updated.', 'تم تحديث الطلب.') })
      await load()
      onActed?.()
      if (kind !== 'approve') onOpenChange(false)
    } catch (e: any) {
      toast({ title: tt('Action failed', 'فشل الإجراء'), description: e?.message || tt('Please try again.', 'يرجى المحاولة مرة أخرى.'), variant: 'destructive' })
    } finally {
      setBusy(false)
      setRejecting(false)
    }
  }

  const footer =
    isPending || canDownloadLetter ? (
      <div className="flex w-full flex-wrap items-center gap-2">
        {canDownloadLetter && (
          <Button size="sm" onClick={downloadLetter}>
            <FileDown className="me-1.5 h-4 w-4" />
            {tt('Download letter (PDF)', 'تحميل الخطاب (PDF)')}
          </Button>
        )}
        {isPending && iAmRequester && (
          <Button variant="ghost" size="sm" onClick={() => act('cancel')} disabled={busy} className="text-muted-foreground">
            {tt('Cancel request', 'إلغاء الطلب')}
          </Button>
        )}
        <div className="flex-1" />
        {isPending && iAmApprover && (
          <>
            <Button variant="outline" size="sm" onClick={() => setRejecting((v) => !v)} disabled={busy} className="text-destructive">
              <X className="me-1.5 h-4 w-4" />
              {tt('Reject', 'رفض')}
            </Button>
            <Button size="sm" onClick={() => act('approve')} disabled={busy}>
              {busy ? <Loader2 className="me-1.5 h-4 w-4 animate-spin" /> : <Check className="me-1.5 h-4 w-4" />}
              {tt('Approve', 'اعتماد')}
            </Button>
          </>
        )}
      </div>
    ) : undefined

  return (
    <DetailDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={(f.employee_name || f.employee || tt('Request', 'طلب')) as string}
      description={((isRTL ? f.label_ar : f.label) || f.label || f.request_type_label || f.request_type || '') as string}
      headerExtra={<div><StatusBadge status={status} /></div>}
      footer={footer}
      size="md"
    >
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : !detail ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{tt('Could not load this request.', 'تعذر تحميل الطلب.')}</p>
      ) : (
        <div className="space-y-6">
          {/* Reject comment box */}
          {rejecting && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="mb-2 text-sm font-medium text-destructive">{tt('Reason for rejection', 'سبب الرفض')}</p>
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder={tt('Add a reason…', 'أضف سبباً…')} />
              <div className="mt-2 flex justify-end">
                <Button variant="destructive" size="sm" onClick={() => act('reject')} disabled={busy}>
                  {busy ? <Loader2 className="me-1.5 h-4 w-4 animate-spin" /> : null}
                  {tt('Confirm reject', 'تأكيد الرفض')}
                </Button>
              </div>
            </div>
          )}

          {/* Target summary (normalized: flat `target_summary` or legacy `target`) */}
          {Object.keys(target).length > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {Object.entries(target).map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="truncate font-medium text-foreground">{String(v ?? '—')}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Approval timeline */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">{tt('Approval chain', 'سلسلة الاعتماد')}</h4>
            <ol className="relative space-y-4 ps-6">
              <span className="absolute inset-y-1 start-[9px] w-px bg-border" aria-hidden />
              {steps.map((s, i) => {
                const tone =
                  s.status === 'Approved' ? 'bg-success text-success-foreground'
                  : s.status === 'Rejected' ? 'bg-destructive text-destructive-foreground'
                  : s.status === 'Pending' ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
                return (
                  <li key={i} className="relative">
                    <span className={`absolute -start-6 flex h-[18px] w-[18px] items-center justify-center rounded-full ${tone}`}>
                      {stepIcon(s.status)}
                    </span>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {s.approver_user || s.approver_role || s.approver_type}
                      </span>
                      <StatusBadge status={s.status} className="text-[11px]" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {s.approver_type}
                      {s.acted_on ? ` · ${dualDate(s.acted_on)}` : ''}
                    </p>
                    {s.comment && <p className="mt-1 rounded bg-muted/50 px-2 py-1 text-xs text-foreground">{s.comment}</p>}
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      )}
    </DetailDrawer>
  )
}
