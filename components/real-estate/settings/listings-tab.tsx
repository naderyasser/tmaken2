'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/hooks/use-toast'
import { realEstateApi, type AqarListing } from '@/lib/real-estate-api'
import { formatPrice } from '@/lib/aqar-format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Search, Star, StarOff, EyeOff, ArrowLeftRight, FileEdit, Loader2 } from 'lucide-react'

export function ListingsTab({ canEdit }: { canEdit: boolean }) {
  const { isRTL, lang } = useI18n()
  const { toast } = useToast()
  const [rows, setRows] = useState<AqarListing[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [transfer, setTransfer] = useState<AqarListing | null>(null)
  const [advs, setAdvs] = useState<any[]>([])
  const [toAdv, setToAdv] = useState('')
  const [relicense, setRelicense] = useState<any | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      setRows(await realEstateApi.getListings({
        filters: search ? [['Aqar Listing', 'title', 'like', `%${search}%`]] : undefined,
        limit_page_length: 60,
      }))
    } catch (e: any) { toast({ title: isRTL ? 'خطأ' : 'Error', description: e?.message, variant: 'destructive' }) }
    finally { setLoading(false) }
  }
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) /* eslint-disable-next-line */ }, [search])

  const wrap = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true)
    try { await fn(); toast({ title: ok }); load() }
    catch (e: any) { toast({ title: isRTL ? 'خطأ' : 'Error', description: e?.message, variant: 'destructive' }) }
    finally { setBusy(false) }
  }

  const openTransfer = async (l: AqarListing) => {
    setTransfer(l); setToAdv('')
    if (!advs.length) { try { setAdvs(await realEstateApi.admin.listAdvertisers({ limit: 200 })) } catch { /* */ } }
  }
  const doTransfer = () => wrap(async () => { await realEstateApi.admin.transferListing(transfer!.name!, toAdv); setTransfer(null) }, isRTL ? 'تم النقل' : 'Transferred')
  const doRelicense = () => wrap(async () => {
    await realEstateApi.admin.relicenseEdit(relicense.name, { title: relicense.title, price: Number(relicense.price) || 0, description: relicense.description })
    setRelicense(null)
  }, isRTL ? 'تمت إعادة الترخيص والنشر' : 'Re-licensed & published')

  const TONE: Record<string, string> = {
    Active: 'bg-emerald-100 text-emerald-800', Draft: 'bg-gray-100 text-gray-600', Expired: 'bg-orange-100 text-orange-800',
    Rejected: 'bg-red-100 text-red-800', Sold: 'bg-blue-100 text-blue-800', 'Pending License': 'bg-amber-100 text-amber-800',
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 ${isRTL ? 'right-3' : 'left-3'}`} />
        <Input placeholder={isRTL ? 'بحث في الإعلانات…' : 'Search listings…'} value={search} onChange={(e) => setSearch(e.target.value)} className={isRTL ? 'pr-9' : 'pl-9'} />
      </div>

      {loading ? <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div> : rows.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center text-gray-400">{isRTL ? 'لا توجد إعلانات' : 'No listings'}</div>
      ) : (
        <div className="space-y-2">
          {rows.map((l) => (
            <div key={l.name} className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-gray-100 bg-white p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-gray-900">{l.title}</p>
                  {l.is_featured ? <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> : null}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TONE[l.status || 'Draft'] || 'bg-gray-100'}`}>{l.status}</span>
                </div>
                <p className="truncate text-[11px] text-gray-400">{formatPrice(l.price, lang as any)} · {l.advertiser}</p>
              </div>
              {canEdit && (
                <div className="flex items-center gap-1">
                  {l.status === 'Active' && <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-orange-500" title={isRTL ? 'إلغاء النشر' : 'Unpublish'} onClick={() => wrap(() => realEstateApi.admin.forceUnpublish(l.name!), isRTL ? 'تم إلغاء النشر' : 'Unpublished')}><EyeOff className="h-3.5 w-3.5" /></Button>}
                  {l.is_featured
                    ? <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400" title={isRTL ? 'إلغاء التمييز' : 'Unfeature'} onClick={() => wrap(() => realEstateApi.admin.forceUnfeature(l.name!), isRTL ? 'تم' : 'Done')}><StarOff className="h-3.5 w-3.5" /></Button>
                    : <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-amber-500" title={isRTL ? 'تمييز' : 'Feature'} onClick={() => wrap(() => realEstateApi.admin.forceFeature(l.name!, 7), isRTL ? 'تم التمييز' : 'Featured')}><Star className="h-3.5 w-3.5" /></Button>}
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-500" title={isRTL ? 'نقل لمعلن' : 'Transfer'} onClick={() => openTransfer(l)}><ArrowLeftRight className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-emerald-600" title={isRTL ? 'تعديل وإعادة ترخيص' : 'Re-license edit'} onClick={() => setRelicense({ ...l })}><FileEdit className="h-3.5 w-3.5" /></Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Transfer */}
      <Dialog open={!!transfer} onOpenChange={(o) => !o && setTransfer(null)}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'} className="max-w-md">
          <DialogHeader><DialogTitle>{isRTL ? 'نقل الإعلان لمعلن آخر' : 'Transfer listing'}</DialogTitle></DialogHeader>
          <select className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={toAdv} onChange={(e) => setToAdv(e.target.value)}>
            <option value="">{isRTL ? '— اختر المعلن —' : '— choose advertiser —'}</option>
            {advs.map((a) => <option key={a.name} value={a.name}>{a.advertiser_name} · {a.phone}</option>)}
          </select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransfer(null)} disabled={busy}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={doTransfer} disabled={busy || !toAdv}>{busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}{isRTL ? 'نقل' : 'Transfer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Re-license edit */}
      <Dialog open={!!relicense} onOpenChange={(o) => !o && setRelicense(null)}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'} className="max-w-md">
          <DialogHeader><DialogTitle>{isRTL ? 'تعديل عبر إعادة الترخيص' : 'Edit via re-license'}</DialogTitle></DialogHeader>
          <p className="text-xs text-gray-500">{isRTL ? 'سيُعاد التحقق من الترخيص ويُعاد نشر الإعلان.' : 'The license is re-verified and the ad is re-published.'}</p>
          {relicense && (
            <div className="space-y-3">
              <div><label className="text-xs text-gray-500">{isRTL ? 'العنوان' : 'Title'}</label><Input value={relicense.title || ''} onChange={(e) => setRelicense({ ...relicense, title: e.target.value })} /></div>
              <div><label className="text-xs text-gray-500">{isRTL ? 'السعر' : 'Price'}</label><Input type="number" dir="ltr" value={relicense.price ?? ''} onChange={(e) => setRelicense({ ...relicense, price: e.target.value })} /></div>
              <div><label className="text-xs text-gray-500">{isRTL ? 'الوصف' : 'Description'}</label><textarea className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" rows={3} value={relicense.description || ''} onChange={(e) => setRelicense({ ...relicense, description: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRelicense(null)} disabled={busy}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={doRelicense} disabled={busy}>{busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}{isRTL ? 'حفظ وإعادة النشر' : 'Save & republish'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
