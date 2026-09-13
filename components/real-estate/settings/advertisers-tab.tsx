'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/hooks/use-toast'
import { realEstateApi } from '@/lib/real-estate-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  Search, ShieldCheck, ShieldX, Ban, RotateCcw, Trash2, Phone, BadgeCheck, FileCheck,
  Loader2, UserCog, UserPlus, UserMinus,
} from 'lucide-react'

const RE_ROLES = ['Real Estate Manager', 'Real Estate Moderator', 'Real Estate User']

export function AdvertisersTab({ canEdit }: { canEdit: boolean }) {
  const { isRTL } = useI18n()
  const { toast } = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [edit, setEdit] = useState<any | null>(null)
  const [reasonFor, setReasonFor] = useState<{ adv: any; action: 'suspend' | 'ban' | 'delete' } | null>(null)
  const [reason, setReason] = useState('')
  const [contentHandling, setContentHandling] = useState<'archive' | 'remove'>('archive')

  const load = async () => {
    setLoading(true)
    try { setRows(await realEstateApi.admin.listAdvertisers({ search, limit: 100 })) }
    catch (e: any) { toast({ title: isRTL ? 'خطأ' : 'Error', description: e?.message, variant: 'destructive' }) }
    finally { setLoading(false) }
  }
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) /* eslint-disable-next-line */ }, [search])

  const wrap = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true)
    try { await fn(); toast({ title: ok }); load() }
    catch (e: any) { toast({ title: isRTL ? 'خطأ' : 'Error', description: e?.message, variant: 'destructive' }) }
    finally { setBusy(false) }
  }

  const toggleVerify = (adv: any, field: string, cur: number) =>
    wrap(() => realEstateApi.admin.setVerification(adv.name, field, cur ? 0 : 1), isRTL ? 'تم التحديث' : 'Updated')

  const runReasoned = async () => {
    if (!reasonFor) return
    const { adv, action } = reasonFor
    await wrap(async () => {
      if (action === 'suspend') return realEstateApi.admin.suspendAdvertiser(adv.name, reason)
      if (action === 'ban') return realEstateApi.admin.banAdvertiser(adv.name, reason)
      if (action === 'delete') return realEstateApi.admin.deleteAdvertiser(adv.name, contentHandling)
    }, isRTL ? 'تم' : 'Done')
    setReasonFor(null); setReason(''); setContentHandling('archive')
  }

  const saveEdit = () => wrap(async () => {
    await realEstateApi.admin.updateAdvertiser({
      name: edit.name, advertiser_name: edit.advertiser_name, user_type: edit.user_type,
      national_id: edit.national_id, fal_license_number: edit.fal_license_number,
    })
    setEdit(null)
  }, isRTL ? 'تم الحفظ' : 'Saved')

  const STATUS_TONE: Record<string, string> = {
    Active: 'bg-emerald-100 text-emerald-800', Suspended: 'bg-amber-100 text-amber-800', Banned: 'bg-red-100 text-red-800',
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 ${isRTL ? 'right-3' : 'left-3'}`} />
        <Input placeholder={isRTL ? 'بحث بالاسم أو الجوال…' : 'Search name or phone…'} value={search} onChange={(e) => setSearch(e.target.value)} className={isRTL ? 'pr-9' : 'pl-9'} />
      </div>

      {loading ? <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div> : rows.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center text-gray-400">{isRTL ? 'لا يوجد معلنون' : 'No advertisers'}</div>
      ) : (
        <div className="space-y-2">
          {rows.map((a) => (
            <div key={a.name} className="rounded-xl border-2 border-gray-100 bg-white p-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-gray-900">{a.advertiser_name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[a.status] || 'bg-gray-100 text-gray-600'}`}>{a.status}</span>
                  </div>
                  <p className="truncate text-[11px] text-gray-400" dir="ltr">{a.phone} · {a.listing_count} {isRTL ? 'إعلان' : 'ads'}</p>
                </div>
                {/* verification chips (click to toggle) */}
                {([['is_phone_verified', Phone, isRTL ? 'جوال' : 'Phone'], ['nafath_verified', BadgeCheck, 'نفاذ'], ['fal_verified', FileCheck, 'فال']] as const).map(([f, Icon, lbl]) => (
                  <button key={f} disabled={!canEdit || busy} onClick={() => toggleVerify(a, f, a[f])}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${a[f] ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'} ${canEdit ? 'hover:ring-1' : ''}`}>
                    <Icon className="h-3 w-3" />{lbl}
                  </button>
                ))}
                {canEdit && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-emerald-700" title={isRTL ? 'تعديل' : 'Edit'} onClick={() => setEdit({ ...a })}><UserCog className="h-3.5 w-3.5" /></Button>
                    {a.status !== 'Banned' ? (
                      <>
                        {a.status !== 'Suspended' && <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-amber-500" title={isRTL ? 'إيقاف' : 'Suspend'} onClick={() => { setReasonFor({ adv: a, action: 'suspend' }); setReason('') }}><ShieldX className="h-3.5 w-3.5" /></Button>}
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" title={isRTL ? 'حظر' : 'Ban'} onClick={() => { setReasonFor({ adv: a, action: 'ban' }); setReason('') }}><Ban className="h-3.5 w-3.5" /></Button>
                      </>
                    ) : (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-emerald-600" title={isRTL ? 'رفع الحظر' : 'Unban'} onClick={() => wrap(() => realEstateApi.admin.unbanAdvertiser(a.name), isRTL ? 'تم رفع الحظر' : 'Unbanned')}><RotateCcw className="h-3.5 w-3.5" /></Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-red-600" title={isRTL ? 'حذف' : 'Delete'} onClick={() => { setReasonFor({ adv: a, action: 'delete' }); setReason('') }}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                )}
              </div>
              {a.status_reason && <p className="mt-1.5 text-[11px] text-gray-400">{isRTL ? 'السبب: ' : 'Reason: '}{a.status_reason}</p>}
            </div>
          ))}
        </div>
      )}

      {canEdit && <RolesPanel />}

      {/* Edit profile dialog */}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'} className="max-w-md">
          <DialogHeader><DialogTitle>{isRTL ? 'تعديل المعلن' : 'Edit Advertiser'}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div><label className="text-xs text-gray-500">{isRTL ? 'الاسم' : 'Name'}</label><Input value={edit.advertiser_name || ''} onChange={(e) => setEdit({ ...edit, advertiser_name: e.target.value })} /></div>
              <div><label className="text-xs text-gray-500">{isRTL ? 'النوع' : 'Type'}</label>
                <select className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={edit.user_type || 'Individual'} onChange={(e) => setEdit({ ...edit, user_type: e.target.value })}>
                  <option value="Individual">{isRTL ? 'فرد' : 'Individual'}</option><option value="Broker">{isRTL ? 'وسيط' : 'Broker'}</option><option value="Agency">{isRTL ? 'منشأة' : 'Agency'}</option>
                </select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500">{isRTL ? 'الهوية' : 'National ID'}</label><Input value={edit.national_id || ''} onChange={(e) => setEdit({ ...edit, national_id: e.target.value })} dir="ltr" /></div>
                <div><label className="text-xs text-gray-500">{isRTL ? 'رقم فال' : 'FAL No.'}</label><Input value={edit.fal_license_number || ''} onChange={(e) => setEdit({ ...edit, fal_license_number: e.target.value })} dir="ltr" /></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)} disabled={busy}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={saveEdit} disabled={busy}>{busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}{isRTL ? 'حفظ' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reason dialog (suspend / ban / delete) */}
      <Dialog open={!!reasonFor} onOpenChange={(o) => !o && setReasonFor(null)}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'} className="max-w-md">
          <DialogHeader><DialogTitle>
            {reasonFor?.action === 'suspend' ? (isRTL ? 'إيقاف المعلن' : 'Suspend advertiser')
              : reasonFor?.action === 'ban' ? (isRTL ? 'حظر المعلن' : 'Ban advertiser')
                : (isRTL ? 'حذف المعلن' : 'Delete advertiser')}
          </DialogTitle></DialogHeader>
          {reasonFor?.action === 'ban' && <p className="text-xs text-red-600">{isRTL ? 'سيتم إلغاء نشر جميع إعلاناته النشطة فوراً.' : 'All their active listings will be unpublished immediately.'}</p>}
          {reasonFor?.action === 'delete' ? (
            <div className="space-y-2">
              <label className="text-xs text-gray-500">{isRTL ? 'معالجة المحتوى' : 'Content handling'}</label>
              <select className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={contentHandling} onChange={(e) => setContentHandling(e.target.value as any)}>
                <option value="archive">{isRTL ? 'أرشفة الإعلانات (إخفاء)' : 'Archive listings (unpublish)'}</option>
                <option value="remove">{isRTL ? 'حذف الإعلانات نهائياً' : 'Remove listings permanently'}</option>
              </select>
            </div>
          ) : (
            <Input placeholder={isRTL ? 'السبب (يُسجّل)' : 'Reason (audited)'} value={reason} onChange={(e) => setReason(e.target.value)} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonFor(null)} disabled={busy}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={runReasoned} disabled={busy}>{busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}{isRTL ? 'تأكيد' : 'Confirm'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Roles panel (grant/revoke the 3 RE roles) ───────────────────────────────
function RolesPanel() {
  const { isRTL } = useI18n()
  const { toast } = useToast()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState(RE_ROLES[0])
  const [busy, setBusy] = useState(false)

  const load = async () => { setLoading(true); try { setUsers(await realEstateApi.admin.listReUsers()) } catch { /* */ } finally { setLoading(false) } }
  useEffect(() => { load() }, [])

  const grant = async () => {
    if (!email.trim()) return
    setBusy(true)
    try { await realEstateApi.admin.grantRole(email.trim(), role); toast({ title: isRTL ? 'تم منح الصلاحية' : 'Role granted' }); setEmail(''); load() }
    catch (e: any) { toast({ title: isRTL ? 'خطأ' : 'Error', description: e?.message, variant: 'destructive' }) }
    finally { setBusy(false) }
  }
  const revoke = async (em: string, rl: string) => {
    try { await realEstateApi.admin.revokeRole(em, rl); toast({ title: isRTL ? 'تم السحب' : 'Revoked' }); load() }
    catch (e: any) { toast({ title: isRTL ? 'خطأ' : 'Error', description: e?.message, variant: 'destructive' }) }
  }

  const roleLabel = (r: string) => isRTL ? ({ 'Real Estate Manager': 'مدير', 'Real Estate Moderator': 'مشرف', 'Real Estate User': 'مستخدم' } as any)[r] || r : r

  return (
    <div className="mt-6 rounded-2xl border-2 border-gray-100 bg-white p-4">
      <div className="mb-3 flex items-center gap-2"><UserCog className="h-4 w-4 text-emerald-700" /><p className="text-sm font-semibold text-gray-900">{isRTL ? 'صلاحيات فريق العقارات' : 'Real-estate team roles'}</p></div>
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div className="flex-1"><label className="text-xs text-gray-500">{isRTL ? 'بريد المستخدم' : 'User email'}</label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" placeholder="user@example.com" /></div>
        <select className="rounded-lg border border-gray-200 px-3 py-2 text-sm" value={role} onChange={(e) => setRole(e.target.value)}>
          {RE_ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
        </select>
        <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={grant} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}<span className="ms-1.5">{isRTL ? 'منح' : 'Grant'}</span></Button>
      </div>
      {loading ? <Skeleton className="h-10" /> : users.length === 0 ? <p className="text-xs text-gray-400">{isRTL ? 'لا يوجد مستخدمون بصلاحيات عقارية' : 'No users with real-estate roles'}</p> : (
        <div className="divide-y divide-gray-100">
          {users.map((u) => (
            <div key={u.email} className="flex items-center justify-between py-2">
              <div className="min-w-0"><p className="truncate text-sm text-gray-900">{u.full_name || u.email}</p><p className="truncate text-[11px] text-gray-400" dir="ltr">{u.email}</p></div>
              <div className="flex flex-wrap items-center gap-1">
                {(u.roles || []).map((r: string) => (
                  <span key={r} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">
                    {roleLabel(r)}
                    <button onClick={() => revoke(u.email, r)} className="text-emerald-700/60 hover:text-red-500"><UserMinus className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
