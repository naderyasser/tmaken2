'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { UserPlus, Loader2, Check, X, Copy, LinkIcon, RefreshCw, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { frappeClient } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/hooks/use-toast'
import { formatDateShort } from '@/lib/format'

const STATUS_KEY: Record<string, string> = {
  Invited: 'onb.status_invited', Submitted: 'onb.status_submitted',
  'Under Review': 'onb.status_under_review', Approved: 'onb.status_approved', Rejected: 'onb.status_rejected',
}
const STATUS_BADGE: Record<string, string> = {
  Invited: 'bg-gray-100 text-gray-600',
  Submitted: 'bg-amber-50 text-amber-700',
  'Under Review': 'bg-blue-50 text-blue-700',
  Approved: 'bg-emerald-50 text-emerald-700',
  Rejected: 'bg-red-50 text-red-700',
}

interface Req {
  name: string; full_name: string; status: string; company: string
  proposed_branch: string | null; id_type: string | null; id_number: string | null
  phone: string | null; email: string | null; submitted_on: string | null
  created_employee: string | null
}

interface Detail {
  name: string; status: string; company_name: string; full_name: string
  id_type: string | null; id_number: string | null; dob: string | null; gender: string | null
  nationality: string | null; phone: string | null; email: string | null; address: string | null
  emergency_contact_name: string | null; emergency_contact_phone: string | null; photo: string | null
  proposed_designation: string | null; proposed_department: string | null; proposed_branch: string | null
  submitted_on: string | null; review_notes: string | null; created_employee: string | null
}

/** Read-only labelled value for the review dialog. */
function Field({ label, value, className, dir }: { label: string; value?: string | null; className?: string; dir?: 'ltr' | 'rtl' }) {
  return (
    <div className={className}>
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className="text-gray-800 break-words" dir={dir}>{value || '—'}</p>
    </div>
  )
}

export function OnboardingReview() {
  const { t, isRTL } = useI18n()
  const { toast } = useToast()
  const [reqs, setReqs] = useState<Req[]>([])
  const [companies, setCompanies] = useState<Array<{ name: string }>>([])
  const [branches, setBranches] = useState<Array<{ name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [form, setForm] = useState({ company: '', proposed_branch: '', full_name: '' })
  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await frappeClient.call('base_meena.hr_requests.onboarding.get_onboarding_requests', {})
      setReqs(r?.message?.requests || [])
    } catch {
      toast({ title: t('error'), description: t('onb.load_fail'), variant: 'destructive' })
    } finally { setLoading(false) }
  }, [t, toast])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    frappeClient.getList('Company', { fields: ['name'], limit_page_length: 0 } as any).then((c: any) => {
      const list = c || []
      setCompanies(list)
      setForm((p) => ({ ...p, company: list[0]?.name || '' }))
    }).catch(() => {})
    frappeClient.getList('Branch', { fields: ['name'], limit_page_length: 0 } as any).then((b: any) => setBranches(b || [])).catch(() => {})
  }, [])

  const createInvite = async () => {
    if (!form.company) { toast({ title: t('onb.need_company'), variant: 'destructive' }); return }
    setSubmitting(true); setInviteLink('')
    try {
      const r = await frappeClient.call('base_meena.hr_requests.onboarding.create_invite', {
        company: form.company,
        proposed_branch: form.proposed_branch || undefined,
        full_name: form.full_name || undefined,
      })
      const link = `${window.location.origin}${r?.message?.link || ''}`
      setInviteLink(link)
      toast({ title: t('onb.invite_created') })
      load()
    } catch (e: any) {
      toast({ title: t('error'), description: String(e?.message || e), variant: 'destructive' })
    } finally { setSubmitting(false) }
  }

  // ── ITEM 1: recover / resend a lost invite link (HR-only backend methods) ──
  const copyInviteLink = async (req: Req) => {
    try {
      const r = await frappeClient.call('base_meena.hr_requests.onboarding.get_invite_link', { request: req.name })
      const m = r?.message
      if (m?.expired) { toast({ title: t('onb.link_expired'), variant: 'destructive' }); return }
      await navigator.clipboard?.writeText(`${window.location.origin}${m?.link || ''}`)
      toast({ title: t('onb.copied') })
    } catch (e: any) {
      toast({ title: t('error'), description: String(e?.message || e), variant: 'destructive' })
    }
  }

  const regenerate = async (req: Req) => {
    setSubmitting(true)
    try {
      const r = await frappeClient.call('base_meena.hr_requests.onboarding.regenerate_invite', { request: req.name })
      await navigator.clipboard?.writeText(`${window.location.origin}${r?.message?.link || ''}`)
      toast({ title: t('onb.regenerated') })
      load()
    } catch (e: any) {
      toast({ title: t('error'), description: String(e?.message || e), variant: 'destructive' })
    } finally { setSubmitting(false) }
  }

  // ── ITEM 2: show the submitted data before the manager decides ─────────────
  const openDetail = async (req: Req) => {
    setDetailOpen(true); setDetail(null); setDetailLoading(true)
    try {
      const r = await frappeClient.call('base_meena.hr_requests.onboarding.get_onboarding_request', { request: req.name })
      setDetail(r?.message || null)
    } catch (e: any) {
      toast({ title: t('error'), description: t('onb.detail_fail'), variant: 'destructive' })
      setDetailOpen(false)
    } finally { setDetailLoading(false) }
  }

  const decideDetail = async (outcome: 'Approve' | 'Reject') => {
    if (!detail) return
    setSubmitting(true)
    try {
      await frappeClient.call('base_meena.hr_requests.onboarding.decide_onboarding', { request: detail.name, outcome })
      toast({ title: outcome === 'Approve' ? t('onb.approved') : t('onb.rejected') })
      setDetailOpen(false); load()
    } catch (e: any) {
      toast({ title: t('error'), description: String(e?.message || e), variant: 'destructive' })
    } finally { setSubmitting(false) }
  }

  const genderLabel = (g?: string | null) => (g === 'Male' ? t('onb.gender_male') : g === 'Female' ? t('onb.gender_female') : (g || ''))
  const idLabel = (v?: string | null) => (v === 'National ID' ? t('onb.id_national') : v === 'Iqama' ? t('onb.id_iqama') : (v || ''))

  const copyLink = () => { navigator.clipboard?.writeText(inviteLink); toast({ title: t('onb.copied') }) }

  return (
    <div className="p-6 md:p-8 max-w-[1000px] mx-auto" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <UserPlus className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('onb.title')}</h1>
            <p className="text-sm text-gray-500">{t('onb.subtitle')}</p>
          </div>
        </div>
        <Button onClick={() => { setInviteOpen(true); setInviteLink('') }} className="gap-1.5"><UserPlus className="h-4 w-4" /> {t('onb.create_invite')}</Button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-300" /></div>
        ) : reqs.length === 0 ? (
          <p className="text-sm text-gray-400 py-16 text-center">{t('onb.no_requests')}</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {reqs.map((r) => (
              <div key={r.name} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">{r.full_name || r.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_BADGE[r.status] || STATUS_BADGE.Invited}`}>{t(STATUS_KEY[r.status] || '') || r.status}</span>
                    {r.created_employee && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{r.created_employee}</span>}
                  </div>
                  <p className="text-[12px] text-gray-500 mt-1 truncate">
                    {r.company}{r.proposed_branch ? ` · ${r.proposed_branch}` : ''}{r.phone ? ` · ${r.phone}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {r.status === 'Invited' && (
                    <>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => copyInviteLink(r)}><Copy className="h-3.5 w-3.5" /> {t('onb.copy_link')}</Button>
                      <Button size="sm" variant="outline" className="gap-1" disabled={submitting} onClick={() => regenerate(r)}><RefreshCw className="h-3.5 w-3.5" /> {t('onb.resend')}</Button>
                    </>
                  )}
                  {(r.status === 'Submitted' || r.status === 'Under Review') && (
                    <Button size="sm" className="gap-1 bg-blue-600 hover:bg-blue-700" onClick={() => openDetail(r)}><Eye className="h-3.5 w-3.5" /> {t('onb.review_decide')}</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader><DialogTitle>{t('onb.create_invite')}</DialogTitle></DialogHeader>
          {inviteLink ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">{t('onb.link_ready')}</p>
              <div className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg bg-gray-50">
                <LinkIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className="text-[12px] text-gray-700 truncate flex-1">{inviteLink}</span>
                <button onClick={copyLink} className="text-blue-600 hover:text-blue-700"><Copy className="h-4 w-4" /></button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">{t('onb.company')} *</label>
                <select className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}>
                  {companies.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">{t('onb.branch')}</label>
                <select className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background" value={form.proposed_branch} onChange={(e) => setForm({ ...form, proposed_branch: e.target.value })}>
                  <option value="">—</option>
                  {branches.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">{t('onb.full_name')}</label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>{inviteLink ? t('onb.close') : t('onb.cancel')}</Button>
            {!inviteLink && <Button onClick={createInvite} disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('onb.create')}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'} className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('onb.submitted_data')}</DialogTitle></DialogHeader>
          {detailLoading || !detail ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-300" /></div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {detail.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={detail.photo} alt="" className="h-14 w-14 rounded-full object-cover border border-gray-200" />
                ) : null}
                <div className="min-w-0">
                  <p className="text-base font-semibold text-gray-900 truncate">{detail.full_name || detail.name}</p>
                  <p className="text-xs text-gray-500 truncate">{detail.company_name}{detail.proposed_branch ? ` · ${detail.proposed_branch}` : ''}</p>
                </div>
                <span className={`ms-auto flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full ${STATUS_BADGE[detail.status] || STATUS_BADGE.Invited}`}>{t(STATUS_KEY[detail.status] || '') || detail.status}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Field label={t('onb.f.id')} value={detail.id_type ? `${idLabel(detail.id_type)} · ${detail.id_number || ''}` : detail.id_number} className="col-span-2" />
                <Field label={t('onb.f.dob')} value={formatDateShort(detail.dob, { withHijri: true })} />
                <Field label={t('onb.f.gender')} value={genderLabel(detail.gender)} />
                <Field label={t('onb.f.nationality')} value={detail.nationality} />
                <Field label={t('onb.f.phone')} value={detail.phone} dir="ltr" />
                <Field label={t('onb.f.email')} value={detail.email} dir="ltr" className="col-span-2" />
                <Field label={t('onb.f.address')} value={detail.address} className="col-span-2" />
                <Field label={t('onb.f.emergency')} value={[detail.emergency_contact_name, detail.emergency_contact_phone].filter(Boolean).join(' · ')} className="col-span-2" />
                <Field label={t('onb.f.proposed_role')} value={[detail.proposed_designation, detail.proposed_department].filter(Boolean).join(' · ')} className="col-span-2" />
                <Field label={t('onb.f.submitted_on')} value={formatDateShort(detail.submitted_on, { withHijri: true })} className="col-span-2" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>{t('onb.close')}</Button>
            {detail && (detail.status === 'Submitted' || detail.status === 'Under Review') && (
              <>
                <Button variant="destructive" className="gap-1" disabled={submitting} onClick={() => decideDetail('Reject')}><X className="h-4 w-4" /> {t('onb.reject')}</Button>
                <Button className="gap-1 bg-emerald-600 hover:bg-emerald-700" disabled={submitting} onClick={() => decideDetail('Approve')}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {t('onb.approve')}</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
