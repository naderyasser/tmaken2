'use client'

/**
 * F11 — Self-service home (/me). Employee widgets (greeting, quick actions,
 * approvals inbox, my-requests, leave balance, payslip, announcements, doc-expiry)
 * + manager/HR extras (team attendance, team requests, occasions, new hires,
 * probation). One round-trip each: get_my_dashboard / get_team_dashboard.
 * All money/leave figures are DISPLAY-ONLY (calc-disabled banner). Token-only, RTL.
 */
import * as React from 'react'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import {
  CalendarPlus, Clock3, FileText, Plus, Check, X, Loader2, Megaphone, Wallet,
  CalendarClock, PartyPopper, UserPlus2, ShieldCheck, Inbox, AlertTriangle, Send,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader, KpiTile } from '@/components/shared'
import { StatusBadge } from '@/components/ui/status-badge'
import { frappeClient } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { translateEnum } from '@/lib/enums'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/hooks/use-toast'
import { formatDateShort } from '@/lib/format'
import { NewRequestModal } from '@/components/requests/new-request-modal'
import { AttendanceCard } from '@/components/me/attendance-card'
import { EwaCard } from '@/components/me/ewa-card'
import { EwaApprovalsCard } from '@/components/me/ewa-approvals-card'
import { PushOptin } from '@/components/me/push-optin'
import FinancialWellness from '@/components/me/financial-wellness'

const call = async (method: string, args?: any) => {
  const r = await frappeClient.call(method, args)
  return (r as any)?.message
}

const SEV_TONE: Record<string, string> = {
  expired: 'bg-destructive/10 text-destructive',
  critical: 'bg-destructive/10 text-destructive',
  warning: 'bg-warning/15 text-warning',
}

export function MeDashboard() {
  const { isRTL } = useI18n()
  const tx = (en: string, ar: string) => (isRTL ? ar : en)
  const { user, isHRUser, isManager, scopeLevel } = useAuth()
  const { toast } = useToast()

  const [me, setMe] = useState<any>(null)
  const [team, setTeam] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string>('')
  const [newReq, setNewReq] = useState(false)
  const [newReqType, setNewReqType] = useState<string | undefined>(undefined)
  const openRequest = (typeKey?: string) => { setNewReqType(typeKey); setNewReq(true) }

  const showTeam = isManager || isHRUser

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const m = await call('base_meena.api.my_dashboard.get_my_dashboard')
      setMe(m || {})
      if (showTeam) {
        try { setTeam(await call('base_meena.api.my_dashboard.get_team_dashboard')) } catch { setTeam(null) }
      }
    } catch {
      toast({ title: tx('Failed to load', 'تعذّر التحميل'), variant: 'destructive' })
    } finally { setLoading(false) }
  }, [showTeam]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const act = async (flow: string, action: 'approve' | 'reject') => {
    setActing(flow + action)
    try {
      await call(`base_meena.hr_requests.approvals_api.${action}_step`, { flow, comment: '' })
      toast({ title: action === 'approve' ? tx('Approved', 'تم الاعتماد') : tx('Rejected', 'تم الرفض') })
      load()
    } catch (e: any) {
      toast({ title: tx('Error', 'خطأ'), description: String(e?.message || e), variant: 'destructive' })
    } finally { setActing('') }
  }

  const markRead = (name: string) => { call('base_meena.api.announcements_api.mark_announcement_read', { name }).catch(() => {}) }

  if (loading) {
    // Layout-mirroring shimmer skeleton (animate-pulse → smooth sheen via the
    // motion layer) — reads as the page arriving, not a spinner freeze.
    return (
      <div className="p-6 md:p-8 max-w-[1180px] mx-auto space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="flex items-center justify-between">
          <div className="space-y-2"><div className="h-7 w-56 rounded-lg bg-muted animate-pulse" /><div className="h-4 w-72 rounded bg-muted animate-pulse" /></div>
          <div className="h-9 w-28 rounded-lg bg-muted animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />)}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-44 rounded-lg bg-muted animate-pulse" />)}
        </div>
      </div>
    )
  }

  const p = me?.profile || {}
  const pending = me?.pending_approvals || { count: 0, top5: [] }
  const leave = me?.leave_balances || []
  const anns = [...(me?.announcements || [])].sort((a: any, b: any) => (b.is_important ? 1 : 0) - (a.is_important ? 1 : 0))
  const docExp = me?.doc_expiry || []
  const payslip = me?.latest_payslip

  const Section = ({ title, icon: Icon, children, action }: any) => (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">{Icon && <Icon className="h-4 w-4 text-primary" />}{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  )

  return (
    <div className="p-6 md:p-8 max-w-[1180px] mx-auto space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <PageHeader
        title={`${tx('Good day', 'يومك سعيد')}${p.employee_name ? '، ' + p.employee_name : (user?.full_name ? '، ' + user.full_name : '')} 👋`}
        description={tx('Here is what needs your attention today.', 'إليك ما يحتاج انتباهك اليوم.')}
        actions={<Button onClick={() => openRequest()} className="gap-1.5"><Plus className="h-4 w-4" />{tx('New request', 'طلب جديد')}</Button>}
      />

      {/* Quick actions */}
      <div className="hr-stagger grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          [tx('Leave', 'إجازة'), CalendarPlus, 'leave'],
          [tx('Permission', 'استئذان'), Clock3, 'permission'],
          [tx('Overtime', 'عمل إضافي'), CalendarClock, 'overtime'],
          [tx('Other request', 'طلب آخر'), FileText, undefined],
        ].map(([label, Icon, typeKey]: any, i) => (
          <button key={i} onClick={() => openRequest(typeKey)}
            className="hr-lift flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 text-sm font-medium text-foreground shadow-card hover:shadow-card-hover hover:border-primary/30">
            <span className="p-2 rounded-lg bg-accent text-primary"><Icon className="h-5 w-5" /></span>
            {label}
          </button>
        ))}
      </div>

      {/* KPI row */}
      <div className="hr-stagger grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile label={tx('Pending approvals', 'اعتمادات معلّقة')} value={pending.count ?? 0} icon={Inbox} tone={pending.count ? 'warning' : 'default'} />
        <KpiTile label={tx('My requests', 'طلباتي')} value={(me?.my_requests || []).length} icon={Send} />
        <KpiTile label={tx('Leave types', 'أرصدة الإجازات')} value={leave.length} icon={CalendarPlus} tone="success" />
        <KpiTile label={tx('Doc alerts', 'تنبيهات المستندات')} value={docExp.length} icon={AlertTriangle} tone={docExp.length ? 'danger' : 'default'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tamkeen Go — verified passkey mobile punch (self-hides if feature off) */}
        <AttendanceCard />

        {/* Tamkeen Go G2 — install app + enable push (self-hides if unsupported) */}
        <PushOptin />

        {/* راتبي المرن — Earned Wage Access (self-hides if feature off) */}
        <EwaCard />

        {/* Financial Wellness — read-only insight layer over the EWA balance */}
        <FinancialWellness />

        {/* Approvals inbox */}
        <Section title={tx('Approvals inbox', 'صندوق الاعتمادات')} icon={Inbox}
          action={<Link href="/requests" className="text-xs font-medium text-primary hover:underline">{tx('View all', 'عرض الكل')}</Link>}>
          {(pending.top5 || []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{tx('Nothing awaiting your approval.', 'لا يوجد ما ينتظر اعتمادك.')}</p>
          ) : (
            <div className="space-y-2">
              {pending.top5.map((r: any) => (
                <div key={r.flow} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{isRTL ? r.label_ar || r.label : r.label} · {r.employee_name}</p>
                    <p className="text-xs text-muted-foreground">{tx('Step', 'الخطوة')} #{r.current_step}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" className="h-8 gap-1 text-success border-success/30" disabled={!!acting} onClick={() => act(r.flow, 'approve')}>
                      {acting === r.flow + 'approve' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 gap-1 text-destructive border-destructive/30" disabled={!!acting} onClick={() => act(r.flow, 'reject')}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* My requests feed */}
        <Section title={tx('My requests', 'طلباتي')} icon={FileText}
          action={<Link href="/requests" className="text-xs font-medium text-primary hover:underline">{tx('View all', 'عرض الكل')}</Link>}>
          {(me?.my_requests || []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{tx('You have no requests yet.', 'لا توجد لديك طلبات بعد.')}</p>
          ) : (
            <div className="space-y-2">
              {(me.my_requests || []).slice(0, 6).map((r: any) => (
                <div key={r.flow} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5">
                  <span className="text-sm truncate">{isRTL ? r.label_ar || r.label : r.label}</span>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Leave balance */}
        <Section title={tx('Leave balances', 'أرصدة الإجازات')} icon={CalendarPlus}>
          <p className="text-[11px] text-muted-foreground mb-2">{tx('Display only — accrual & deduction calculations disabled pending HR sign-off.', 'عرض فقط — حسابات الاستحقاق والخصم معطّلة حتى اعتماد الموارد البشرية.')}</p>
          {leave.length === 0 ? <p className="text-sm text-muted-foreground py-2">{tx('No allocations.', 'لا توجد أرصدة.')}</p> : (
            <div className="space-y-1.5">
              {leave.map((b: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{translateEnum('leaveType', b.leave_type, isRTL ? 'ar' : 'en')}</span>
                  <span className="tabular-nums font-medium">{b.balance ?? b.allocated ?? 0} <span className="text-muted-foreground text-xs">/ {b.allocated ?? 0}</span></span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Payslip */}
        <Section title={tx('Latest payslip', 'أحدث قسيمة راتب')} icon={Wallet}>
          {!payslip ? <p className="text-sm text-muted-foreground py-2">{tx('No payslip available.', 'لا توجد قسيمة متاحة.')}</p> : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{payslip.period || payslip.name}</p>
                <p className="text-xs text-muted-foreground">{tx('Net pay', 'الصافي')}: <span className="tabular-nums">{payslip.net_pay ?? '—'}</span></p>
              </div>
              {payslip.name && (
                <a href={`/printview?doctype=Salary%20Slip&name=${encodeURIComponent(payslip.name)}&format=Standard&no_letterhead=0`} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm">{tx('Download', 'تحميل')}</Button>
                </a>
              )}
            </div>
          )}
        </Section>

        {/* Announcements */}
        <Section title={tx('Announcements', 'الإعلانات')} icon={Megaphone}>
          {anns.length === 0 ? <p className="text-sm text-muted-foreground py-2">{tx('No announcements.', 'لا توجد إعلانات.')}</p> : (
            <div className="space-y-2">
              {anns.slice(0, 5).map((a: any) => (
                <div key={a.name} className="rounded-lg border border-border p-2.5" onMouseEnter={() => !a.is_read && markRead(a.name)}>
                  <div className="flex items-center gap-2">
                    {a.is_important ? <Badge className="bg-destructive/10 text-destructive border-0">{tx('Important', 'مهم')}</Badge> : null}
                    <span className="text-sm font-medium truncate">{a.title}</span>
                  </div>
                  {a.publish_from && <p className="text-xs text-muted-foreground mt-0.5">{formatDateShort(a.publish_from)}</p>}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Doc expiry */}
        <Section title={tx('Document alerts', 'تنبيهات المستندات')} icon={AlertTriangle}>
          {docExp.length === 0 ? <p className="text-sm text-muted-foreground py-2">{tx('No expiring documents.', 'لا توجد مستندات قاربت على الانتهاء.')}</p> : (
            <div className="space-y-1.5">
              {docExp.map((d: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className={`px-2 py-0.5 rounded text-xs ${SEV_TONE[d.severity] || 'bg-muted text-muted-foreground'}`}>{d.doc_type}</span>
                  <span className="text-muted-foreground text-xs">{d.expiry_date ? formatDateShort(d.expiry_date) : ''} · {d.days_left}{tx('d', 'ي')}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* Manager / HR extras */}
      {showTeam && team && (
        <>
          <div className="flex items-center gap-2 pt-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">{tx('Team overview', 'نظرة على الفريق')}</h2>
            <span className="text-xs text-muted-foreground">({team.team_count} {tx('members', 'عضو')})</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* راتبي المرن — pending EWA approvals (self-hides if none / not an approver) */}
            <EwaApprovalsCard />

            <Section title={tx('Team attendance', 'حضور الفريق')} icon={CalendarClock}>
              <div className="grid grid-cols-2 gap-3">
                {['today', 'yesterday'].map((k) => (
                  <div key={k} className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground mb-1">{k === 'today' ? tx('Today', 'اليوم') : tx('Yesterday', 'أمس')}</p>
                    <p className="text-sm tabular-nums">{tx('Present', 'حاضر')}: {team.team_attendance?.[k]?.present ?? 0} · {tx('Absent', 'غائب')}: {team.team_attendance?.[k]?.absent ?? 0}</p>
                  </div>
                ))}
              </div>
            </Section>
            <Section title={tx('Team requests', 'طلبات الفريق')} icon={Inbox}>
              {(team.team_requests || []).length === 0 ? <p className="text-sm text-muted-foreground py-2">{tx('None.', 'لا يوجد.')}</p> : (
                <div className="space-y-1.5">
                  {(team.team_requests || []).slice(0, 5).map((r: any) => (
                    <div key={r.flow} className="flex items-center justify-between text-sm"><span className="truncate">{(isRTL ? r.label_ar || r.label : r.label)} · {r.employee_name}</span><StatusBadge status={r.status} /></div>
                  ))}
                </div>
              )}
            </Section>
            <Section title={tx('Occasions', 'المناسبات')} icon={PartyPopper}>
              {(team.occasions || []).length === 0 ? <p className="text-sm text-muted-foreground py-2">{tx('None this month.', 'لا مناسبات هذا الشهر.')}</p> : (
                <div className="space-y-1.5">
                  {(team.occasions || []).slice(0, 6).map((o: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm"><span className="truncate">{o.employee_name} — {isRTL ? (o.type_ar || o.type) : o.type}</span><span className="text-xs text-muted-foreground">{o.date ? formatDateShort(o.date) : ''}</span></div>
                  ))}
                </div>
              )}
            </Section>
            <Section title={tx('New hires & probation', 'التعيينات الجديدة والتجربة')} icon={UserPlus2}>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground mb-1">{tx('New hires', 'تعيينات جديدة')}</p>{(team.new_hires || []).slice(0, 4).map((e: any, i: number) => <p key={i} className="truncate">{e.employee_name}</p>)}{(team.new_hires || []).length === 0 && <p className="text-muted-foreground">—</p>}</div>
                <div><p className="text-xs text-muted-foreground mb-1">{tx('On probation', 'تحت التجربة')}</p>{(team.probation || []).slice(0, 4).map((e: any, i: number) => <p key={i} className="truncate">{e.employee_name}</p>)}{(team.probation || []).length === 0 && <p className="text-muted-foreground">—</p>}</div>
              </div>
            </Section>
          </div>
        </>
      )}

      <NewRequestModal open={newReq} onOpenChange={(o) => { setNewReq(o); if (!o) setNewReqType(undefined) }} onCreated={load} initialTypeKey={newReqType} />

      {/* مساعد تمكين — floating Copilot (self-hides unless the tenant enabled it) */}
    </div>
  )
}
