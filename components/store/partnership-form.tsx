'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Loader2, Landmark } from 'lucide-react'
import { realEstateApi, type GeoItem } from '@/lib/real-estate-api'
import PhoneInput, { isValidIntlPhone } from '@/components/store/phone-input'

// values = backend Select options, verbatim
const RELATIONS = ['أنا مالك الأرض', 'وكيل مالك الأرض', 'ممثّل ورثة', 'وكيل مفوّض']
const LAND_USES = ['سكني', 'سكني تجاري', 'تجاري', 'أخرى']
const CONTACT_TIMES = [
  { value: 'صباحاً', label: 'صباحاً (٧ص – ١٢م)' },
  { value: 'مساءً', label: 'مساءً (٤م – ١٠م)' },
  { value: 'أي وقت', label: 'أي وقت' },
]

export default function PartnershipForm() {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [relation, setRelation] = useState('')
  const [region, setRegion] = useState('')
  const [city, setCity] = useState('')
  const [district, setDistrict] = useState('')
  const [locationText, setLocationText] = useState('')
  const [landArea, setLandArea] = useState('')
  const [dimensions, setDimensions] = useState('')
  const [landUse, setLandUse] = useState('')
  const [hasValuation, setHasValuation] = useState('')
  const [contactTime, setContactTime] = useState('')
  const [notes, setNotes] = useState('')
  const [regions, setRegions] = useState<GeoItem[]>([])
  const [cities, setCities] = useState<GeoItem[]>([])
  const [districts, setDistricts] = useState<GeoItem[]>([])
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [err, setErr] = useState('')
  const [refId, setRefId] = useState('')

  useEffect(() => { realEstateApi.listRegions().then(setRegions).catch(() => {}) }, [])
  useEffect(() => { if (region) realEstateApi.listCities(region).then(setCities).catch(() => {}) }, [region])
  useEffect(() => { if (city) realEstateApi.listDistricts(city).then(setDistricts).catch(() => {}) }, [city])

  const submit = async () => {
    if (!fullName.trim()) return setErr('من فضلك أدخل اسمك الكامل.')
    if (!isValidIntlPhone(phone)) return setErr('أدخل رقم جوال صحيح.')
    if (!relation) return setErr('حدّد علاقتك بملكية الأرض.')
    if (!city) return setErr('اختر مدينة الأرض.')
    if (!(Number(landArea) > 0)) return setErr('أدخل مساحة الأرض.')
    setErr(''); setState('loading')
    try {
      const r = await realEstateApi.submitPartnershipLead({
        full_name: fullName.trim(),
        phone,
        ownership_relation: relation,
        city,
        district: district || undefined,
        location_text: locationText.trim() || undefined,
        land_area: Number(landArea) || undefined,
        dimensions: dimensions.trim() || undefined,
        land_use: landUse || undefined,
        has_valuation: hasValuation || undefined,
        contact_time: contactTime || undefined,
        notes: notes.trim() || undefined,
      })
      setRefId(r.name || '')
      setState('done')
    } catch (e: any) {
      setErr(e?.message || 'تعذّر إرسال الطلب، حاول مرة أخرى.')
      setState('idle')
    }
  }

  if (state === 'done') {
    return (
      <div className="aqar-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--aqar-green)]/12 text-[var(--aqar-green)]"><Check className="h-8 w-8" /></div>
        <p className="aqar-display text-2xl text-[var(--aqar-green-d)]">استلمنا طلبك ✅</p>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-7 text-[var(--aqar-kohl)]/65">
          فريق التحالفات يدرس بيانات أرضك ويتواصل معك{refId ? <> — رقم الطلب <b dir="ltr">{refId}</b></> : null}.
          إرسال الطلب لا يُعد موافقة نهائية على الشراكة.
        </p>
        <Link href="/" className="aqar-btn mt-5">العودة للرئيسية</Link>
      </div>
    )
  }

  return (
    <div className="aqar-card space-y-4 p-5">
      <p className="flex items-center gap-2 rounded-xl bg-[var(--aqar-sand-2)]/60 p-3 text-sm font-medium text-[var(--aqar-kohl)]/80">
        <Landmark className="h-4 w-4 shrink-0 text-[var(--aqar-green)]" />نموذج طلب تطوير أرض — حصري للملاك ووكلائهم
      </p>
      {err && <div className="rounded-xl border border-[var(--aqar-clay)]/30 bg-[var(--aqar-clay)]/5 p-3 text-sm text-[var(--aqar-clay)]">{err}</div>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">الاسم الكامل *</label><input className="inp" value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
        <div><label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">رقم التواصل *</label><PhoneInput value={phone} onChange={setPhone} /></div>
      </div>

      <div>
        <label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">ما علاقتك بملكية الأرض؟ *</label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {RELATIONS.map((r) => (
            <button key={r} type="button" onClick={() => setRelation(r)} aria-pressed={relation === r} className={`rounded-xl border px-3 py-2.5 text-sm font-medium ${relation === r ? 'border-[var(--aqar-green)] bg-[var(--aqar-green)]/10 text-[var(--aqar-green-d)]' : 'border-[var(--aqar-sand-2)] text-[var(--aqar-kohl)]/70 hover:border-[var(--aqar-green)]/40'}`}>{r}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">المنطقة *</label>
          <select className="inp" value={region} onChange={(e) => { setRegion(e.target.value); setCity(''); setDistrict('') }}>
            <option value="">اختر</option>
            {regions.map((r: any) => <option key={r.name} value={r.name}>{r.region_name_ar}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">المدينة *</label>
          <select className="inp" value={city} onChange={(e) => { setCity(e.target.value); setDistrict('') }} disabled={!region}>
            <option value="">اختر</option>
            {cities.map((c: any) => <option key={c.name} value={c.name}>{c.city_name_ar}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">الحي</label>
          <select className="inp" value={district} onChange={(e) => setDistrict(e.target.value)} disabled={!city}>
            <option value="">اختر</option>
            {districts.map((d: any) => <option key={d.name} value={d.name}>{d.district_name_ar}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">وصف موقع الأرض (اختياري)</label>
        <input className="inp" value={locationText} onChange={(e) => setLocationText(e.target.value)} placeholder="مثال: على طريق رئيسي، قرب مخرج 10…" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">مساحة الأرض (م²) *</label><input className="inp" dir="ltr" inputMode="numeric" value={landArea} onChange={(e) => setLandArea(e.target.value.replace(/[^\d.]/g, ''))} /></div>
        <div><label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">الأطوال (اختياري)</label><input className="inp" dir="ltr" value={dimensions} onChange={(e) => setDimensions(e.target.value)} placeholder="مثال: 25×40" /></div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">نوع استخدام الأرض</label>
          <select className="inp" value={landUse} onChange={(e) => setLandUse(e.target.value)}>
            <option value="">اختر</option>
            {LAND_USES.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">هل يوجد تقييم على الأرض؟</label>
          <div className="flex gap-2">
            {['نعم', 'لا'].map((v) => (
              <button key={v} type="button" onClick={() => setHasValuation(v)} aria-pressed={hasValuation === v} className={`min-h-[44px] flex-1 rounded-xl border px-4 text-sm font-semibold ${hasValuation === v ? 'border-[var(--aqar-green)] bg-[var(--aqar-green)]/10 text-[var(--aqar-green-d)]' : 'border-[var(--aqar-sand-2)] text-[var(--aqar-kohl)]/70'}`}>{v}</button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">وقت التواصل المفضّل</label>
        <select className="inp" value={contactTime} onChange={(e) => setContactTime(e.target.value)}>
          <option value="">أي وقت يناسبكم</option>
          {CONTACT_TIMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">ملاحظات (اختياري)</label>
        <textarea className="inp" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="أي معلومات إضافية عن الأرض أو تطلعاتك للشراكة" />
      </div>

      <button onClick={submit} disabled={state === 'loading'} className="aqar-btn w-full">
        {state === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Landmark className="h-4 w-4" />}إرسال الطلب
      </button>
      <p className="text-xs leading-5 text-[var(--aqar-kohl)]/55">نشكر ثقتكم — إرسال النموذج طلب مبدئي للدراسة ولا يُعد موافقة نهائية على الشراكة.</p>

      <style jsx>{`:global(.aqar-store .inp){width:100%;min-height:48px;border:1px solid var(--aqar-sand-2);border-radius:0.75rem;padding:0.7rem 0.85rem;font-size:1rem;outline:none;background:var(--aqar-surface);color:var(--aqar-kohl)}:global(.aqar-store .inp:focus){border-color:var(--aqar-green)}`}</style>
    </div>
  )
}
