'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { ShieldAlert, Plus, Loader2, Check, X, Gavel } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { frappeClient, type Employee } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { formatDateShort } from '@/lib/format'
import { useToast } from '@/hooks/use-toast'

const VIOLATION_TYPES: Array<{ value: string; labelKey: string }> = [
  { value: 'delay_15', labelKey: 'disc.vt_delay_15' },
  { value: 'delay_15_30', labelKey: 'disc.vt_delay_15_30' },
  { value: 'delay_30_60', labelKey: 'disc.vt_delay_30_60' },
  { value: 'delay_60_plus', labelKey: 'disc.vt_delay_60_plus' },
  { value: 'leave_early_15', labelKey: 'disc.vt_leave_early_15' },
  { value: 'leave_early_15_30', labelKey: 'disc.vt_leave_early_15_30' },
  { value: 'leave_early_30_60', labelKey: 'disc.vt_leave_early_30_60' },
  { value: 'absence_half', labelKey: 'disc.vt_absence_half' },
  { value: 'absence_full', labelKey: 'disc.vt_absence_full' },
]
// enum → translation key maps (single source; keeps badges bilingual)
const VT_KEY: Record<string, string> = Object.fromEntries(VIOLATION_TYPES.map((v) => [v.value, v.labelKey]))
const PEN_KEY: Record<string, string> = { Warning: 'disc.pen_warning', Deduction: 'disc.pen_deduction' }
const APPEAL_KEY: Record<string, string> = {
  None: 'disc.appeal_none', 'Under Appeal': 'disc.appeal_under',
  'Appeal Accepted': 'disc.appeal_accepted', 'Appeal Rejected': 'disc.appeal_rejected',
}

const APPEAL_BADGE: Record<string, string> = {
  None: 'bg-muted text-muted-foreground',
  'Under Appeal': 'bg-amber-50 text-amber-700',
  'Appeal Accepted': 'bg-emerald-50 text-emerald-700',
  'Appeal Rejected': 'bg-red-50 text-red-700',
}

interface Violation {
  name: string
  employee_name: string
  violation_type: string
  violation_label: string
  violation_date: string | null
  penalty_applied: string | null
  deduction_amount: number | null
  reason: string | null
  appeal_status: string
  appeal_justification: string | null
  docstatus: number
}

const todayStr = () => new Date().toISOString().split('T')[0]

export function DisciplinaryManagement() {
  const { t, isRTL } = useI18n()
  const { toast } = useToast()
  const [violations, setViolations] = useState<Violation[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [issueOpen, setIssueOpen] = useState(false)
  const [appealFor, setAppealFor] = useState<Violation | null>(null)
  const [justification, setJustification] = useState('')
  const [form, setForm] = useState({
    employee: '', violation_type: 'delay_15', violation_date: todayStr(),
    reason: '', penalty_applied: 'Warning', deduction_amount: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await frappeClient.call('base_meena.penalty_management.api.get_branch_violations', { days: 3650, limit: 200 })
      setViolations(res?.message?.violations || [])
    } catch {
      toast({ title: t('error'), description: t('disc.load_fail'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [t, toast])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    frappeClient.getEmployees({
      fields: ['name', 'employee_name'],
      filters: [['Employee', 'status', '=', 'Active']] as any,
      order_by: 'employee_name asc', limit_page_length: 0,
    }).then((l) => setEmployees(l || [])).catch(() => {})
  }, [])

  const issue = async () => {
    if (!form.employee || !form.reason.trim()) {
      toast({ title: t('disc.need_emp_reason'), variant: 'destructive' }); return
    }
    setSubmitting(true)
    try {
      await frappeClient.call('base_meena.penalty_management.api.create_violation', {
        employee: form.employee,
        violation_type: form.violation_type,
        violation_date: form.violation_date,
        reason: form.reason,
        penalty_applied: form.penalty_applied,
        deduction_amount: form.penalty_applied === 'Deduction' ? (form.deduction_amount || 0) : 0,
      })
      toast({ title: t('disc.issued') })
      setIssueOpen(false)
      setForm({ ...form, employee: '', reason: '', deduction_amount: '' })
      load()
    } catch (e: any) {
      toast({ title: t('error'), description: String(e?.message || e), variant: 'destructive' })
    } finally { setSubmitting(false) }
  }

  const doAppeal = async () => {
    if (!appealFor || !justification.trim()) {
      toast({ title: t('disc.need_justification'), variant: 'destructive' }); return
    }
    setSubmitting(true)
    try {
      await frappeClient.call('base_meena.penalty_management.api.submit_appeal', { violation: appealFor.name, justification })
      toast({ title: t('disc.appeal_recorded') })
      setAppealFor(null); setJustification(''); load()
    } catch (e: any) {
      toast({ title: t('error'), description: String(e?.message || e), variant: 'destructive' })
    } finally { setSubmitting(false) }
  }

  const decide = async (v: Violation, outcome: 'Accept' | 'Reject') => {
    setSubmitting(true)
    try {
      await frappeClient.call('base_meena.penalty_management.api.decide_appeal', { violation: v.name, outcome })
      toast({ title: outcome === 'Accept' ? t('disc.accepted') : t('disc.rejected') })
      load()
    } catch (e: any) {
      toast({ title: t('error'), description: String(e?.message || e), variant: 'destructive' })
    } finally { setSubmitting(false) }
  }

  const inputCls = 'w-full border border-input rounded-lg px-3 py-2 text-sm bg-background'

  return (
    <div className="p-6 md:p-8 max-w-[1100px] mx-auto" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-rose-500" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('disc.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('disc.subtitle')}</p>
          </div>
        </div>
        <Button onClick={() => setIssueOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> {t('disc.issue')}
        </Button>
      </div>

      <div className="bg-card border border-border/60 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" /></div>
        ) : violations.length === 0 ? (
          <p className="text-sm text-muted-foreground/70 py-16 text-center">{t('disc.no_violations')}</p>
        ) : (
          <div className="divide-y divide-border/50">
            {violations.map((v) => (
              <div key={v.name} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">{v.employee_name}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{(VT_KEY[v.violation_type] && t(VT_KEY[v.violation_type])) || v.violation_label}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${(v.penalty_applied || '') === 'Warning' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                      {v.penalty_applied ? t(PEN_KEY[v.penalty_applied] || '') || v.penalty_applied : ''}{v.penalty_applied === 'Deduction' && v.deduction_amount ? ` · ${v.deduction_amount}` : ''}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${APPEAL_BADGE[v.appeal_status] || APPEAL_BADGE.None}`}>{t(APPEAL_KEY[v.appeal_status] || '') || v.appeal_status}</span>
                    {v.docstatus === 2 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{t('disc.dropped')}</span>}
                  </div>
                  <p className="text-[12px] text-muted-foreground mt-1 truncate">{formatDateShort(v.violation_date)} · {v.reason}</p>
                  {v.appeal_justification && <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">↳ {v.appeal_justification}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {v.docstatus === 1 && v.appeal_status === 'None' && (
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => { setAppealFor(v); setJustification('') }}>
                      <Gavel className="h-3.5 w-3.5" /> {t('disc.record_appeal')}
                    </Button>
                  )}
                  {v.docstatus === 1 && v.appeal_status === 'Under Appeal' && (
                    <>
                      <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700" disabled={submitting} onClick={() => decide(v, 'Accept')}>
                        <Check className="h-3.5 w-3.5" /> {t('disc.accept')}
                      </Button>
                      <Button size="sm" variant="destructive" className="gap-1" disabled={submitting} onClick={() => decide(v, 'Reject')}>
                        <X className="h-3.5 w-3.5" /> {t('disc.reject')}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Issue violation dialog */}
      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader><DialogTitle>{t('disc.issue')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">{t('disc.employee')}</label>
              <select className={inputCls} value={form.employee} onChange={(e) => setForm({ ...form, employee: e.target.value })}>
                <option value="">—</option>
                {employees.map((e) => <option key={e.name} value={e.name}>{e.employee_name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">{t('disc.type')}</label>
                <select className={inputCls} value={form.violation_type} onChange={(e) => setForm({ ...form, violation_type: e.target.value })}>
                  {VIOLATION_TYPES.map((v) => <option key={v.value} value={v.value}>{t(v.labelKey)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('disc.date')}</label>
                <Input type="date" value={form.violation_date} onChange={(e) => setForm({ ...form, violation_date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">{t('disc.penalty')}</label>
                <select className={inputCls} value={form.penalty_applied} onChange={(e) => setForm({ ...form, penalty_applied: e.target.value })}>
                  <option value="Warning">{t('disc.warning')}</option>
                  <option value="Deduction">{t('disc.deduction')}</option>
                </select>
              </div>
              {form.penalty_applied === 'Deduction' && (
                <div>
                  <label className="text-xs text-muted-foreground">{t('disc.amount')}</label>
                  <Input type="number" value={form.deduction_amount} onChange={(e) => setForm({ ...form, deduction_amount: e.target.value })} />
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t('disc.reason')} *</label>
              <textarea className={inputCls} rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueOpen(false)}>{t('disc.cancel')}</Button>
            <Button onClick={issue} disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('disc.submit')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record appeal dialog */}
      <Dialog open={!!appealFor} onOpenChange={(o) => { if (!o) setAppealFor(null) }}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader><DialogTitle>{t('disc.record_appeal')}</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">{appealFor?.employee_name} · {appealFor?.violation_label}</p>
          <textarea className={inputCls} rows={3} placeholder={t('disc.justification')} value={justification} onChange={(e) => setJustification(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAppealFor(null)}>{t('disc.cancel')}</Button>
            <Button onClick={doAppeal} disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('disc.submit')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
