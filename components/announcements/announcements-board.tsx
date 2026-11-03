'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Megaphone, Loader2, Plus, Pin, Trash2, Bell, CalendarDays, Info, Paperclip, Star, Eye, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { frappeClient, frappeApiUrl } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/lib/auth-context'

interface Ann {
  name: string; title: string; category: string; body: string
  pinned: number; attachment: string | null; publish_from: string | null; owner: string
  is_important?: number
  attachments?: Array<{ file: string; title?: string }>
  is_read?: number
  seen_count?: number
}

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  Notice: <Info className="h-4 w-4" />,
  Update: <Bell className="h-4 w-4" />,
  Event: <CalendarDays className="h-4 w-4" />,
}
const CATEGORY_KEY: Record<string, string> = { Notice: 'ann.cat_notice', Update: 'ann.cat_update', Event: 'ann.cat_event' }
const CATEGORY_TONE: Record<string, string> = {
  Notice: 'bg-primary/10 text-primary',
  Update: 'bg-emerald-500/10 text-emerald-700',
  Event: 'bg-amber-500/10 text-amber-700',
}

const today = () => new Date().toISOString().split('T')[0]

export function AnnouncementsBoard() {
  const { t, isRTL } = useI18n()
  const { toast } = useToast()
  const { isHRManager } = useAuth()
  const [items, setItems] = useState<Ann[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [open, setOpen] = useState(false)
  const [companies, setCompanies] = useState<Array<{ name: string }>>([])
  const [branches, setBranches] = useState<Array<{ name: string }>>([])
  const [form, setForm] = useState({
    title: '', category: 'Notice', company: '', body: '',
    audience: 'All', audience_branch: '', publish_from: today(), publish_to: '',
    pinned: 0, is_published: 1, is_important: 0,
  })
  const [attachments, setAttachments] = useState<Array<{ file: string; title: string }>>([])
  const [uploading, setUploading] = useState(false)
  const [readers, setReaders] = useState<Record<string, any[]>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await frappeClient.call('base_meena.api.announcements.get_announcements', { limit: 30 })
      setItems(r?.message?.announcements || [])
    } catch {
      toast({ title: t('error'), description: t('ann.load_fail'), variant: 'destructive' })
    } finally { setLoading(false) }
  }, [t, toast])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!isHRManager) return
    frappeClient.getList('Company', { fields: ['name'], limit_page_length: 0 } as any).then((c: any) => {
      setCompanies(c || []); setForm((p) => ({ ...p, company: c?.[0]?.name || '' }))
    }).catch(() => {})
    frappeClient.getList('Branch', { fields: ['name'], limit_page_length: 0 } as any).then((b: any) => setBranches(b || [])).catch(() => {})
  }, [isHRManager])

  const create = async () => {
    if (!form.title.trim() || !form.body.trim() || !form.company) {
      toast({ title: t('ann.need_fields'), variant: 'destructive' }); return
    }
    setSubmitting(true)
    try {
      await frappeClient.call('base_meena.api.announcements_api.save_announcement', {
        payload: {
          title: form.title, category: form.category, company: form.company, body: form.body,
          audience: form.audience, audience_branch: form.audience === 'Branch' ? form.audience_branch : undefined,
          publish_from: form.publish_from, publish_to: form.publish_to || undefined,
          pinned: form.pinned, is_published: form.is_published, is_important: form.is_important,
          attachments,
        },
      })
      toast({ title: t('ann.posted') })
      setOpen(false)
      setForm((p) => ({ ...p, title: '', body: '', is_important: 0 }))
      setAttachments([])
      load()
    } catch (e: any) {
      toast({ title: t('error'), description: String(e?.message || e), variant: 'destructive' })
    } finally { setSubmitting(false) }
  }

  const remove = async (a: Ann) => {
    setSubmitting(true)
    try {
      await frappeClient.delete('Announcement', a.name)
      toast({ title: t('ann.deleted') }); load()
    } catch (e: any) {
      toast({ title: t('error'), description: String(e?.message || e), variant: 'destructive' })
    } finally { setSubmitting(false) }
  }

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const csrf = document.cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith('csrftoken=') || c.startsWith('csrf_token='))
      const token = csrf ? decodeURIComponent(csrf.split('=')[1]) : ''
      const out: Array<{ file: string; title: string }> = []
      for (const f of Array.from(files)) {
        const fd = new FormData(); fd.append('file', f); fd.append('is_private', '0'); fd.append('folder', 'Home')
        const res = await fetch(frappeApiUrl('/api/method/upload_file'), { method: 'POST', credentials: 'include', headers: token ? { 'X-Frappe-CSRF-Token': token } : {}, body: fd })
        const data = await res.json().catch(() => ({}))
        const url = data?.message?.file_url
        if (url) out.push({ file: url, title: f.name })
      }
      setAttachments((p) => [...p, ...out])
    } catch { toast({ title: t('error'), description: isRTL ? 'فشل رفع المرفقات' : 'Attachment upload failed', variant: 'destructive' }) }
    finally { setUploading(false) }
  }

  const markRead = (a: Ann) => { if (!a.is_read) frappeClient.call('base_meena.api.announcements_api.mark_announcement_read', { name: a.name }).catch(() => {}) }

  const loadReaders = async (a: Ann) => {
    if (readers[a.name]) return
    try {
      const r = await frappeClient.call('base_meena.api.announcements_api.get_announcement_readers', { name: a.name })
      setReaders((p) => ({ ...p, [a.name]: ((r as any)?.message || []) }))
    } catch { setReaders((p) => ({ ...p, [a.name]: [] })) }
  }

  const inputCls = 'w-full border border-input rounded-lg px-3 py-2 text-sm bg-background'
  const sorted = [...items].sort((a, b) => ((b.is_important ? 1 : 0) - (a.is_important ? 1 : 0)) || ((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)))

  return (
    <div className="p-6 md:p-8 max-w-[860px] mx-auto" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('ann.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('ann.subtitle')}</p>
          </div>
        </div>
        {isHRManager && <Button aria-label="إضافة" title="إضافة" onClick={() => setOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> {t('ann.new')}</Button>}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">{t('ann.empty')}</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {sorted.map((a) => (
            <Card key={a.name} className={a.is_important ? 'border-destructive/30' : a.pinned ? 'border-primary/30' : ''} onMouseEnter={() => markRead(a)}>
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3">
                <div className="flex items-start gap-3 min-w-0">
                  <span className={`mt-0.5 p-2 rounded-lg ${CATEGORY_TONE[a.category] || CATEGORY_TONE.Notice}`}>{CATEGORY_ICON[a.category] || CATEGORY_ICON.Notice}</span>
                  <div className="min-w-0">
                    <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                      {a.is_important ? <Badge className="bg-destructive/10 text-destructive border-0 gap-1"><Star className="h-3 w-3" />{isRTL ? 'مهم' : 'Important'}</Badge> : null}
                      {a.pinned ? <Pin className="h-3.5 w-3.5 text-primary" /> : null}
                      {a.title}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{t(CATEGORY_KEY[a.category] || '') || a.category} · {a.publish_from}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isHRManager && (
                    <Popover onOpenChange={(o) => o && loadReaders(a)}>
                      <PopoverTrigger asChild>
                        <button className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1" aria-label="seen by">
                          <Eye className="h-3.5 w-3.5" />{a.seen_count ?? 0}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-56">
                        <p className="text-xs font-semibold mb-1">{isRTL ? 'شوهد بواسطة' : 'Seen by'}</p>
                        {(readers[a.name] || []).length === 0 ? <p className="text-xs text-muted-foreground">{isRTL ? 'لا أحد بعد' : 'No one yet'}</p> :
                          <ul className="text-xs space-y-0.5 max-h-40 overflow-y-auto">{(readers[a.name] || []).map((r: any, i: number) => <li key={i} className="truncate">{r.employee_name || r.user}</li>)}</ul>}
                      </PopoverContent>
                    </Popover>
                  )}
                  {isHRManager && (
                    <button onClick={() => remove(a)} disabled={submitting} className="text-muted-foreground hover:text-destructive transition-colors" aria-label={t('ann.delete')}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{a.body}</div>
                <div className="flex flex-wrap gap-3 mt-2">
                  {(a.attachments || []).map((att, i) => (
                    <a key={i} href={att.file} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1"><Paperclip className="h-3 w-3" />{att.title || (isRTL ? 'مرفق' : 'Attachment')}</a>
                  ))}
                  {a.attachment && <a href={a.attachment} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1"><Paperclip className="h-3 w-3" />{t('ann.attachment')}</a>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog (HR Manager only) */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader><DialogTitle>{t('ann.new')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-xs text-muted-foreground">{t('ann.f_title')} *</label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">{t('ann.f_category')}</label>
                <select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="Notice">{t('ann.cat_notice')}</option>
                  <option value="Update">{t('ann.cat_update')}</option>
                  <option value="Event">{t('ann.cat_event')}</option>
                </select>
              </div>
              <div><label className="text-xs text-muted-foreground">{t('ann.f_company')} *</label>
                <select className={inputCls} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}>
                  {companies.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">{t('ann.f_audience')}</label>
                <select className={inputCls} value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
                  <option value="All">{t('ann.aud_all')}</option>
                  <option value="Branch">{t('ann.aud_branch')}</option>
                </select>
              </div>
              {form.audience === 'Branch' && (
                <div><label className="text-xs text-muted-foreground">{t('ann.f_branch')}</label>
                  <select className={inputCls} value={form.audience_branch} onChange={(e) => setForm({ ...form, audience_branch: e.target.value })}>
                    <option value="">—</option>
                    {branches.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">{t('ann.f_from')}</label><Input type="date" value={form.publish_from} onChange={(e) => setForm({ ...form, publish_from: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">{t('ann.f_to')}</label><Input type="date" value={form.publish_to} onChange={(e) => setForm({ ...form, publish_to: e.target.value })} /></div>
            </div>
            <div><label className="text-xs text-muted-foreground">{t('ann.f_body')} *</label><textarea className={inputCls} rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={!!form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked ? 1 : 0 })} /> {t('ann.pin')}</label>
              <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={!!form.is_important} onChange={(e) => setForm({ ...form, is_important: e.target.checked ? 1 : 0 })} /> {isRTL ? 'مهم' : 'Important'}</label>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{isRTL ? 'المرفقات' : 'Attachments'}</label>
              <div className="flex flex-wrap gap-2 mt-1 items-center">
                {attachments.map((att, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-xs bg-muted rounded px-2 py-1"><Paperclip className="h-3 w-3" />{att.title}<button type="button" onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button></span>
                ))}
                <label className="inline-flex items-center gap-1 text-xs text-primary cursor-pointer hover:underline">
                  {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}{isRTL ? 'إضافة ملف' : 'Add file'}
                  <input type="file" multiple className="hidden" onChange={(e) => uploadFiles(e.target.files)} />
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t('ann.cancel')}</Button>
            <Button onClick={create} disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('ann.post')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
