'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/hooks/use-toast'
import { realEstateApi } from '@/lib/real-estate-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Trash2, Save, Loader2, Wrench, Star, MapPin } from 'lucide-react'

export function MastersTab({ canEdit }: { canEdit: boolean }) {
  return (
    <div className="space-y-6">
      <ServicesSection canEdit={canEdit} />
      <PromotionsSection canEdit={canEdit} />
      <GeoSection canEdit={canEdit} />
    </div>
  )
}

function SectionShell({ icon: Icon, title, children }: any) {
  return (
    <div className="rounded-2xl border-2 border-gray-100 bg-white p-4">
      <div className="mb-3 flex items-center gap-2"><Icon className="h-4 w-4 text-emerald-700" /><p className="text-sm font-semibold text-gray-900">{title}</p></div>
      {children}
    </div>
  )
}

// ── Property services ────────────────────────────────────────────────────────
function ServicesSection({ canEdit }: { canEdit: boolean }) {
  const { isRTL } = useI18n(); const { toast } = useToast()
  const [rows, setRows] = useState<any[]>([]); const [loading, setLoading] = useState(true)
  const [ar, setAr] = useState(''); const [en, setEn] = useState(''); const [busy, setBusy] = useState(false)
  const load = async () => { setLoading(true); try { setRows(await realEstateApi.admin.listServices()) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])
  const add = async () => {
    if (!ar || !en) return
    setBusy(true)
    try { await realEstateApi.admin.saveService({ service_name_ar: ar, service_name_en: en }); setAr(''); setEn(''); load() }
    catch (e: any) { toast({ title: isRTL ? 'خطأ' : 'Error', description: e?.message, variant: 'destructive' }) } finally { setBusy(false) }
  }
  const del = async (name: string) => { try { await realEstateApi.admin.deleteService(name); load() } catch (e: any) { toast({ title: isRTL ? 'خطأ' : 'Error', description: e?.message, variant: 'destructive' }) } }
  return (
    <SectionShell icon={Wrench} title={isRTL ? 'خدمات العقار' : 'Property services'}>
      {canEdit && (
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <div className="flex-1"><label className="text-xs text-gray-500">{isRTL ? 'بالعربي' : 'Arabic'}</label><Input value={ar} onChange={(e) => setAr(e.target.value)} /></div>
          <div className="flex-1"><label className="text-xs text-gray-500">{isRTL ? 'بالإنجليزي' : 'English'}</label><Input dir="ltr" value={en} onChange={(e) => setEn(e.target.value)} /></div>
          <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={add} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}</Button>
        </div>
      )}
      {loading ? <Skeleton className="h-10" /> : (
        <div className="flex flex-wrap gap-2">
          {rows.map((s) => (
            <span key={s.name} className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-3 py-1 text-sm text-gray-700">
              {isRTL ? s.service_name_ar : s.service_name_en}
              {canEdit && <button onClick={() => del(s.name)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>}
            </span>
          ))}
        </div>
      )}
    </SectionShell>
  )
}

// ── Promotion packages ───────────────────────────────────────────────────────
function PromotionsSection({ canEdit }: { canEdit: boolean }) {
  const { isRTL } = useI18n(); const { toast } = useToast()
  const [rows, setRows] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false)
  const load = async () => { setLoading(true); try { setRows(await realEstateApi.admin.listPromotions()) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])
  const save = async (p: any) => {
    setBusy(true)
    try { await realEstateApi.admin.savePromotion({ name: p.name, package_name: p.package_name, package_name_ar: p.package_name_ar, duration_days: p.duration_days, price: p.price, is_active: p.is_active ? 1 : 0 }); toast({ title: isRTL ? 'تم الحفظ' : 'Saved' }); load() }
    catch (e: any) { toast({ title: isRTL ? 'خطأ' : 'Error', description: e?.message, variant: 'destructive' }) } finally { setBusy(false) }
  }
  const addNew = () => setRows([...rows, { _new: true, package_name: 'New', package_name_ar: 'باقة', duration_days: 7, price: 50, is_active: 1 }])
  const del = async (name: string) => { try { await realEstateApi.admin.deletePromotion(name); load() } catch (e: any) { toast({ title: isRTL ? 'خطأ' : 'Error', description: e?.message, variant: 'destructive' }) } }
  const upd = (i: number, k: string, v: any) => setRows(rows.map((r, idx) => idx === i ? { ...r, [k]: v } : r))
  return (
    <SectionShell icon={Star} title={isRTL ? 'باقات التمييز' : 'Promotion packages'}>
      {loading ? <Skeleton className="h-20" /> : (
        <div className="space-y-2">
          {rows.map((p, i) => (
            <div key={p.name || `new-${i}`} className="flex flex-wrap items-end gap-2 rounded-xl border border-gray-100 p-2">
              <div className="min-w-[120px] flex-1"><label className="text-[11px] text-gray-500">{isRTL ? 'الاسم (ع)' : 'Name AR'}</label><Input value={p.package_name_ar || ''} onChange={(e) => upd(i, 'package_name_ar', e.target.value)} disabled={!canEdit} /></div>
              <div className="min-w-[120px] flex-1"><label className="text-[11px] text-gray-500">{isRTL ? 'الاسم (EN)' : 'Name EN'}</label><Input dir="ltr" value={p.package_name || ''} onChange={(e) => upd(i, 'package_name', e.target.value)} disabled={!canEdit} /></div>
              <div className="w-20"><label className="text-[11px] text-gray-500">{isRTL ? 'أيام' : 'Days'}</label><Input type="number" dir="ltr" value={p.duration_days ?? ''} onChange={(e) => upd(i, 'duration_days', e.target.value)} disabled={!canEdit} /></div>
              <div className="w-24"><label className="text-[11px] text-gray-500">{isRTL ? 'السعر' : 'Price'}</label><Input type="number" dir="ltr" value={p.price ?? ''} onChange={(e) => upd(i, 'price', e.target.value)} disabled={!canEdit} /></div>
              <label className="flex items-center gap-1 pb-2 text-xs text-gray-600"><input type="checkbox" checked={!!p.is_active} onChange={(e) => upd(i, 'is_active', e.target.checked ? 1 : 0)} disabled={!canEdit} />{isRTL ? 'مُفعّل' : 'Active'}</label>
              {canEdit && (
                <div className="flex gap-1 pb-1">
                  <Button size="sm" className="h-8 bg-emerald-700 hover:bg-emerald-800" onClick={() => save(p)} disabled={busy}><Save className="h-3.5 w-3.5" /></Button>
                  {!p._new && <Button size="sm" variant="ghost" className="h-8 text-gray-400 hover:text-red-500" onClick={() => del(p.name)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                </div>
              )}
            </div>
          ))}
          {canEdit && <Button variant="outline" size="sm" onClick={addNew}><Plus className="me-1.5 h-4 w-4" />{isRTL ? 'باقة جديدة' : 'New package'}</Button>}
        </div>
      )}
    </SectionShell>
  )
}

// ── Geo (rename + add district) ──────────────────────────────────────────────
function GeoSection({ canEdit }: { canEdit: boolean }) {
  const { isRTL } = useI18n(); const { toast } = useToast()
  const [regions, setRegions] = useState<any[]>([]); const [region, setRegion] = useState('')
  const [cities, setCities] = useState<any[]>([]); const [city, setCity] = useState('')
  const [districts, setDistricts] = useState<any[]>([])
  const [newAr, setNewAr] = useState(''); const [newEn, setNewEn] = useState(''); const [busy, setBusy] = useState(false)

  useEffect(() => { realEstateApi.listRegions().then(setRegions).catch(() => {}) }, [])
  useEffect(() => { if (region) realEstateApi.listCities(region).then(setCities).catch(() => {}); setCity(''); setDistricts([]) }, [region])
  useEffect(() => { if (city) realEstateApi.listDistricts(city).then(setDistricts).catch(() => {}) }, [city])

  const rename = async (doctype: string, name: string, name_ar: string, name_en: string) => {
    try { await realEstateApi.admin.renameGeo(doctype, name, name_ar, name_en); toast({ title: isRTL ? 'تم' : 'Saved' }) }
    catch (e: any) { toast({ title: isRTL ? 'خطأ' : 'Error', description: e?.message, variant: 'destructive' }) }
  }
  const addDistrict = async () => {
    if (!city || !newAr || !newEn) return
    setBusy(true)
    try { await realEstateApi.admin.addDistrict({ city, district_name_ar: newAr, district_name_en: newEn }); setNewAr(''); setNewEn(''); realEstateApi.listDistricts(city).then(setDistricts) ; toast({ title: isRTL ? 'تمت الإضافة' : 'Added' }) }
    catch (e: any) { toast({ title: isRTL ? 'خطأ' : 'Error', description: e?.message, variant: 'destructive' }) } finally { setBusy(false) }
  }

  return (
    <SectionShell icon={MapPin} title={isRTL ? 'الجغرافيا (مناطق/مدن/أحياء)' : 'Geography (regions / cities / districts)'}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <select className="rounded-lg border border-gray-200 px-3 py-2 text-sm" value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="">{isRTL ? '— المنطقة —' : '— region —'}</option>
          {regions.map((r) => <option key={r.name} value={r.name}>{isRTL ? r.region_name_ar : r.region_name_en}</option>)}
        </select>
        <select className="rounded-lg border border-gray-200 px-3 py-2 text-sm" value={city} onChange={(e) => setCity(e.target.value)} disabled={!region}>
          <option value="">{isRTL ? '— المدينة —' : '— city —'}</option>
          {cities.map((c) => <option key={c.name} value={c.name}>{isRTL ? c.city_name_ar : c.city_name_en}</option>)}
        </select>
      </div>

      {city && (
        <div className="mt-4 space-y-3">
          <p className="text-xs font-medium text-gray-500">{isRTL ? `أحياء ${cities.find((c) => c.name === city)?.city_name_ar || ''}` : 'Districts'}</p>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {districts.map((d) => <GeoRow key={d.name} canEdit={canEdit} ar={d.district_name_ar} en={d.district_name_en} onSave={(a, e) => rename('Aqar District', d.name, a, e)} isRTL={isRTL} />)}
            {districts.length === 0 && <p className="text-xs text-gray-400">{isRTL ? 'لا أحياء' : 'No districts'}</p>}
          </div>
          {canEdit && (
            <div className="flex flex-wrap items-end gap-2 border-t border-gray-100 pt-3">
              <div className="flex-1"><label className="text-[11px] text-gray-500">{isRTL ? 'حي جديد (ع)' : 'New district AR'}</label><Input value={newAr} onChange={(e) => setNewAr(e.target.value)} /></div>
              <div className="flex-1"><label className="text-[11px] text-gray-500">EN</label><Input dir="ltr" value={newEn} onChange={(e) => setNewEn(e.target.value)} /></div>
              <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={addDistrict} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}</Button>
            </div>
          )}
        </div>
      )}
    </SectionShell>
  )
}

function GeoRow({ canEdit, ar, en, onSave, isRTL }: { canEdit: boolean; ar: string; en: string; onSave: (ar: string, en: string) => void; isRTL: boolean }) {
  const [a, setA] = useState(ar); const [e, setE] = useState(en)
  const dirty = a !== ar || e !== en
  return (
    <div className="flex items-center gap-2">
      <Input value={a} onChange={(ev) => setA(ev.target.value)} disabled={!canEdit} className="h-8 flex-1 text-sm" />
      <Input value={e} onChange={(ev) => setE(ev.target.value)} disabled={!canEdit} dir="ltr" className="h-8 flex-1 text-sm" />
      {canEdit && <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-emerald-700 disabled:opacity-30" disabled={!dirty} onClick={() => onSave(a, e)}><Save className="h-3.5 w-3.5" /></Button>}
    </div>
  )
}
