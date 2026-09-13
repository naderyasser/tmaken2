'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import nextDynamic from 'next/dynamic'
import { realEstateApi, type AqarCategory, type GeoItem } from '@/lib/real-estate-api'
import { formatNumber } from '@/lib/aqar-format'
import PhoneInput, { isValidIntlPhone } from '@/components/store/phone-input'
import {
  Phone, ShieldCheck, Check, Loader2, BadgeCheck, MapPin, ImagePlus, Star, Trash2, MessageCircle, Calculator,
} from 'lucide-react'

const LocationPicker = nextDynamic(() => import('@/components/store/location-picker'), { ssr: false })

// Full facade option list — kept in lock-step with aqar_listing.json + the search filter.
const FACADES = ['شمالية', 'جنوبية', 'شرقية', 'غربية', 'شمالية شرقية', 'شمالية غربية', 'جنوبية شرقية', 'جنوبية غربية', 'ثلاث شوارع', 'أربع شوارع', 'واجهتين', 'ثلاث واجهات', 'أربع واجهات']
const FURNISHED = ['مفروش', 'مفروش جزئياً', 'غير مفروش']
const FLOORS = ['أرضي', 'أول', 'ثاني', 'ثالث', 'رابع', 'خامس فأعلى', 'ملحق سطح']
const PAYMENT_TERMS = ['كاش', 'على دفعتين', 'تقسيط', 'قابل للتفاوض']
// How the owner prefers to compensate the platform's marketing (values = backend Select options)
const MARKETING_FEES = ['عمولة ثابتة', 'نسبة من البيع']
// First step depends on the runtime phone-OTP flag (backend guest_post_config):
// OTP on → verify the phone; OTP off → just collect contact info (listing is then
// reviewed by the team before going live).
const stepsFor = (otp: boolean) => [otp ? 'تحقق الجوال' : 'بيانات التواصل', 'بيانات العقار', 'الموقع', 'الصور', 'الترخيص', 'تم']
const MAX_IMAGES = 10
const DRAFT_KEY = 'aqar_post_draft'        // localStorage: form fields only (never the OTP token)
const SUPPORT_WA = 'https://wa.me/966553275000?text=السلام%20عليكم،%20أحتاج%20مساعدة%20في%20نشر%20إعلان%20على%20تمكين%20العقارية'

const INITIAL_F = {
  advertiser_name: '', title: '', category: '', listing_type: 'Sale', price: '', payment_terms: '',
  marketing_fee_type: '', valuation_requested: 0,
  city: '', district: '', area_sqm: '', bedrooms: '', bathrooms: '', age_years: '', street_width: '',
  facade: '', furnished: '', floor_level: '', description: '', property_services: [] as string[],
  plan_number: '', plot_number: '', property_usages: '',
  rega_ad_license_number: '', rega_license_expiry: '', licensee_name: '', deed_number: '',
}

const fileToData = (file: File) => new Promise<string>((res, rej) => {
  const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file)
})

export default function PostAdPage() {
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [phone, setPhone] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  // null = flag still loading; false = OTP step disabled (contact-info step instead)
  const [otpEnabled, setOtpEnabled] = useState<boolean | null>(null)
  const [code, setCode] = useState('')
  const [token, setToken] = useState('')
  const [listing, setListing] = useState('')

  const [cats, setCats] = useState<AqarCategory[]>([])
  const [services, setServices] = useState<Array<{ name: string; service_name_ar: string }>>([])
  const [regions, setRegions] = useState<GeoItem[]>([])
  const [cities, setCities] = useState<GeoItem[]>([])
  const [districts, setDistricts] = useState<GeoItem[]>([])
  const [region, setRegion] = useState('')

  const [images, setImages] = useState<Array<{ name: string; image: string; webp_thumb?: string; is_primary: number }>>([])
  const [geo, setGeo] = useState<{ lat: number; lng: number; hide: number }>({ lat: 24.7136, lng: 46.6753, hide: 0 })
  const fileRef = useRef<HTMLInputElement>(null)

  const [f, setF] = useState<any>(INITIAL_F)
  const [hasDraft, setHasDraft] = useState(false)
  const [pubStatus, setPubStatus] = useState('')
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }))

  // ---- Auto-save draft (form fields only; never the token) so nothing is lost on interruption ----
  useEffect(() => {
    try { if (localStorage.getItem(DRAFT_KEY)) setHasDraft(true) } catch { /* */ }
  }, [])
  useEffect(() => {
    try {
      if (f.title || f.price || f.category || f.description) localStorage.setItem(DRAFT_KEY, JSON.stringify({ f, region }))
    } catch { /* */ }
  }, [f, region])
  const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY) } catch { /* */ } }
  const restoreDraft = () => {
    // merge over INITIAL_F so drafts saved before newer fields existed stay controlled inputs
    try { const s = localStorage.getItem(DRAFT_KEY); if (s) { const d = JSON.parse(s); if (d.f) setF({ ...INITIAL_F, ...d.f }); if (d.region) setRegion(d.region) } } catch { /* */ }
    setHasDraft(false)
  }
  const discardDraft = () => { clearDraft(); setHasDraft(false) }
  // "Add another" after publish — reuse the still-valid token, reset everything else.
  const resetFlow = () => {
    clearDraft(); setF(INITIAL_F); setRegion(''); setImages([]); setListing('')
    setGeo({ lat: 24.7136, lng: 46.6753, hide: 0 }); setErr(null); setStep(1)
  }

  useEffect(() => {
    realEstateApi.guestPostConfig().then((c) => setOtpEnabled(!!c?.phone_otp)).catch(() => setOtpEnabled(false))
    realEstateApi.listCategories().then((c) => setCats(c.filter((x) => !x.is_group))).catch(() => {})
    realEstateApi.listRegions().then(setRegions).catch(() => {})
    realEstateApi.listPropertyServices().then(setServices).catch(() => {})
  }, [])
  useEffect(() => { if (region) realEstateApi.listCities(region).then(setCities).catch(() => {}) }, [region])
  useEffect(() => { if (f.city) realEstateApi.listDistricts(f.city).then(setDistricts).catch(() => {}) }, [f.city])

  // center the map on the chosen district (fallback: city) centroid
  useEffect(() => {
    const d: any = districts.find((x) => x.name === f.district)
    const c: any = cities.find((x) => x.name === f.city)
    const pt = d || c
    if (pt?.latitude && pt?.longitude) setGeo((g) => ({ ...g, lat: pt.latitude, lng: pt.longitude }))
  }, [f.district, f.city, districts, cities])

  const sendOtp = async () => {
    if (!isValidIntlPhone(phone)) { setErr('أدخل رقم جوال صحيح'); return }
    setBusy(true); setErr(null)
    try { await realEstateApi.guestRequestOtp(phone); setOtpSent(true) }
    catch (e: any) { setErr(e?.message || 'خطأ') } finally { setBusy(false) }
  }
  const verifyOtp = async () => {
    setBusy(true); setErr(null)
    try { const r = await realEstateApi.guestVerifyOtp(phone, code); setToken(r.token); setStep(1) }
    catch (e: any) { setErr(e?.message || 'رمز غير صحيح') } finally { setBusy(false) }
  }
  // OTP off: the phone is contact info only — start the session and move on.
  const startSession = async () => {
    if (!isValidIntlPhone(phone)) { setErr('أدخل رقم جوال صحيح'); return }
    setBusy(true); setErr(null)
    try { const r = await realEstateApi.guestStartSession(phone, f.advertiser_name || undefined); setToken(r.token); setStep(1) }
    catch (e: any) { setErr(e?.message || 'تعذّر بدء الجلسة، حاول مرة أخرى') } finally { setBusy(false) }
  }

  const saveDraft = async (extra: Record<string, any> = {}) => {
    const payload = {
      title: f.title, category: f.category, listing_type: f.listing_type, price: Number(f.price) || 0,
      payment_terms: f.payment_terms, city: f.city, district: f.district || undefined,
      region: region || undefined, area_sqm: f.area_sqm, bedrooms: f.bedrooms, bathrooms: f.bathrooms,
      age_years: f.age_years, street_width: f.street_width, facade: f.facade,
      furnished: f.furnished, floor_level: f.floor_level, description: f.description,
      marketing_fee_type: f.marketing_fee_type, valuation_requested: f.valuation_requested ? 1 : 0,
      property_services: f.property_services, plan_number: f.plan_number, plot_number: f.plot_number,
      property_usages: f.property_usages, ...extra,
    }
    const r = await realEstateApi.guestSaveDraft(token, payload, f.advertiser_name || undefined)
    setListing(r.listing)
    return r.listing
  }

  const submitDetails = async () => {
    if (!f.title || !f.category || !f.price || !f.city) { setErr('أكمل الحقول المطلوبة (العنوان، القسم، السعر، المدينة)'); return }
    setBusy(true); setErr(null)
    try { await saveDraft(); setStep(2) }
    catch (e: any) { setErr(e?.message || 'تعذّر الحفظ') } finally { setBusy(false) }
  }
  const submitMap = async () => {
    setBusy(true); setErr(null)
    try { await saveDraft({ latitude: geo.lat, longitude: geo.lng, hide_exact_location: geo.hide }); setStep(3) }
    catch (e: any) { setErr(e?.message || 'تعذّر الحفظ') } finally { setBusy(false) }
  }

  const refreshImages = async (lst = listing) => { try { setImages(await realEstateApi.guestListImages(token, lst)) } catch { /* */ } }
  const onPick = async (files: FileList | null) => {
    if (!files?.length || !listing) return
    setBusy(true); setErr(null)
    try {
      for (let i = 0; i < files.length; i++) {
        if (images.length + i >= MAX_IMAGES) break
        const file = files[i]
        if (!/^image\//.test(file.type)) continue
        if (file.size > 5 * 1024 * 1024) { setErr('حجم الصورة يتجاوز 5 ميجابايت'); continue }
        const data = await fileToData(file)
        await realEstateApi.guestUploadImage(token, listing, file.name, data)
      }
      await refreshImages()
    } catch (e: any) { setErr(e?.message || 'تعذّر رفع الصورة') } finally { setBusy(false); if (fileRef.current) fileRef.current.value = '' }
  }
  const imgAction = async (image: string, action: 'delete' | 'primary') => {
    if (action === 'delete' && typeof window !== 'undefined' && !window.confirm('هل تريد حذف هذه الصورة؟')) return
    try { await realEstateApi.guestImageAction(token, listing, image, action); await refreshImages() }
    catch (e: any) { setErr(e?.message || 'تعذّر تنفيذ العملية') }
  }

  const publish = async () => {
    if (!f.rega_ad_license_number) { setErr('رقم الترخيص الإعلاني مطلوب'); return }
    setBusy(true); setErr(null)
    try {
      await saveDraft({
        rega_ad_license_number: f.rega_ad_license_number, rega_license_expiry: f.rega_license_expiry || undefined,
        licensee_name: f.licensee_name, deed_number: f.deed_number,
      })
      const pub = await realEstateApi.guestPublish(token, listing)
      setPubStatus(pub?.status || 'Active')
      clearDraft()
      setStep(5)
    } catch (e: any) { setErr(e?.message || 'تعذّر نشر الإعلان') } finally { setBusy(false) }
  }

  const toggleService = (name: string) =>
    set('property_services', f.property_services.includes(name) ? f.property_services.filter((s: string) => s !== name) : [...f.property_services, name])

  const steps = stepsFor(otpEnabled === true)

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="aqar-display mb-2 text-3xl text-[var(--aqar-green-d)]">أضف إعلانك</h1>
      <p className="mb-6 text-[var(--aqar-kohl)]/60">
        {otpEnabled
          ? 'انشر عقارك بإعلان موثّق: تحقّق الجوال ← البيانات ← الموقع ← الصور ← الترخيص.'
          : 'انشر عقارك في خطوات بسيطة: بيانات التواصل ← البيانات ← الموقع ← الصور ← الترخيص — ويراجع فريقنا الإعلان قبل نشره.'}
      </p>

      {/* stepper */}
      <div className="mb-6 flex items-center gap-1">
        {steps.map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-1">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i < step ? 'bg-[var(--aqar-green)] text-white' : i === step ? 'bg-[var(--aqar-green)]/15 text-[var(--aqar-green-d)] ring-2 ring-[var(--aqar-green)]' : 'bg-[var(--aqar-sand-2)] text-[var(--aqar-kohl)]/40'}`}>{i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}</div>
            <span className={`hidden text-xs sm:block ${i === step ? 'font-semibold text-[var(--aqar-green-d)]' : 'text-[var(--aqar-kohl)]/40'}`}>{s}</span>
            {i < steps.length - 1 && <div className="h-px flex-1 bg-[var(--aqar-sand-2)]" />}
          </div>
        ))}
      </div>

      {err && <div className="mb-4 rounded-xl border border-[var(--aqar-clay)]/30 bg-[var(--aqar-clay)]/5 p-3 text-sm text-[var(--aqar-clay)]">{err}</div>}

      {hasDraft && step < 5 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--aqar-green)]/30 bg-[var(--aqar-green)]/5 p-3 text-sm">
          <span className="flex-1 text-[var(--aqar-kohl)]/80">لديك مسودّة إعلان محفوظة — هل تريد استكمالها؟</span>
          <button onClick={restoreDraft} className="rounded-full bg-[var(--aqar-green)] px-4 py-2 text-sm font-bold text-white">استرجاع</button>
          <button onClick={discardDraft} className="rounded-full border border-[var(--aqar-sand-2)] px-4 py-2 text-sm text-[var(--aqar-kohl)]/70">تجاهل</button>
        </div>
      )}

      <div className="aqar-card p-5">
        {/* STEP 0 — flag loading */}
        {step === 0 && otpEnabled === null && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-[var(--aqar-kohl)]/60">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--aqar-green)]" />جارٍ التحميل…
          </div>
        )}

        {/* STEP 0 — phone OTP (only when the runtime flag is ON) */}
        {step === 0 && otpEnabled === true && (
          <div className="space-y-3">
            <label className="block text-sm text-[var(--aqar-kohl)]/70">رقم الجوال</label>
            <PhoneInput value={phone} onChange={setPhone} />
            {!otpSent ? (
              <button onClick={sendOtp} disabled={busy} className="aqar-btn w-full"><Phone className="h-4 w-4" />إرسال رمز التحقق</button>
            ) : (
              <>
                <label className="block text-sm text-[var(--aqar-kohl)]/70">رمز التحقق</label>
                <input value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" className="inp" />
                <button onClick={verifyOtp} disabled={busy} className="aqar-btn w-full">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}تأكيد</button>
              </>
            )}
          </div>
        )}

        {/* STEP 0 — contact info (OTP off): phone for contact only, no code sent */}
        {step === 0 && otpEnabled === false && (
          <div className="space-y-3">
            <label className="block text-sm text-[var(--aqar-kohl)]/70">رقم الجوال للتواصل</label>
            <PhoneInput value={phone} onChange={setPhone} />
            <label className="block text-sm text-[var(--aqar-kohl)]/70">اسمك (اختياري)</label>
            <input value={f.advertiser_name} onChange={(e) => set('advertiser_name', e.target.value)} placeholder="اسم المعلن" className="inp" />
            <p className="text-xs leading-6 text-[var(--aqar-kohl)]/60">
              نستخدم رقمك للتواصل معك بشأن الإعلان فقط، وسيراجع فريقنا الإعلان قبل نشره.
            </p>
            <button onClick={startSession} disabled={busy} className="aqar-btn w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}متابعة
            </button>
          </div>
        )}

        {/* STEP 1 — details */}
        {step === 1 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input className="inp" placeholder="اسم المعلن" value={f.advertiser_name} onChange={(e) => set('advertiser_name', e.target.value)} />
            <input className="inp" placeholder="عنوان الإعلان" value={f.title} onChange={(e) => set('title', e.target.value)} />
            <select className="inp" value={f.category} onChange={(e) => set('category', e.target.value)}><option value="">القسم</option>{cats.map((c) => <option key={c.name} value={c.name}>{c.category_name_ar}</option>)}</select>
            <select className="inp" value={f.listing_type} onChange={(e) => set('listing_type', e.target.value)}><option value="Sale">للبيع</option><option value="Rent">للإيجار</option><option value="Daily Rent">إيجار يومي</option></select>
            <input className="inp" dir="ltr" placeholder="السعر" type="number" value={f.price} onChange={(e) => set('price', e.target.value)} />
            <select className="inp" value={f.payment_terms} onChange={(e) => set('payment_terms', e.target.value)}><option value="">طريقة الدفع</option>{PAYMENT_TERMS.map((p) => <option key={p} value={p}>{p}</option>)}</select>
            <input className="inp" dir="ltr" placeholder="المساحة م²" type="number" value={f.area_sqm} onChange={(e) => set('area_sqm', e.target.value)} />
            {/* Live price-per-m² — recomputed as the user types price + area */}
            {Number(f.price) > 0 && Number(f.area_sqm) > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-[var(--aqar-gold)]/35 bg-[var(--aqar-gold)]/8 px-3 py-2.5 text-sm sm:col-span-2">
                <Calculator className="h-4 w-4 shrink-0 text-[var(--aqar-gold)]" />
                <span className="text-[var(--aqar-kohl)]/70">سعر المتر المربع (يُحسب تلقائيًا):</span>
                <b className="text-[var(--aqar-green-d)]" dir="ltr">{formatNumber(Math.round(Number(f.price) / Number(f.area_sqm)))} ريال/م²</b>
              </div>
            )}
            <input className="inp" dir="ltr" placeholder="عمر العقار (سنوات)" type="number" value={f.age_years} onChange={(e) => set('age_years', e.target.value)} />
            <input className="inp" dir="ltr" placeholder="غرف" type="number" value={f.bedrooms} onChange={(e) => set('bedrooms', e.target.value)} />
            <input className="inp" dir="ltr" placeholder="دورات مياه" type="number" value={f.bathrooms} onChange={(e) => set('bathrooms', e.target.value)} />
            <input className="inp" dir="ltr" placeholder="عرض الشارع (م)" type="number" value={f.street_width} onChange={(e) => set('street_width', e.target.value)} />
            <select className="inp" value={f.facade} onChange={(e) => set('facade', e.target.value)}><option value="">الواجهة</option>{FACADES.map((x) => <option key={x} value={x}>{x}</option>)}</select>
            <select className="inp" value={f.furnished} onChange={(e) => set('furnished', e.target.value)}><option value="">الفرش (اختياري)</option>{FURNISHED.map((x) => <option key={x} value={x}>{x}</option>)}</select>
            <select className="inp" value={f.floor_level} onChange={(e) => set('floor_level', e.target.value)}><option value="">الدور (اختياري)</option>{FLOORS.map((x) => <option key={x} value={x}>{x}</option>)}</select>
            <select className="inp" value={f.marketing_fee_type} onChange={(e) => set('marketing_fee_type', e.target.value)}><option value="">آلية أتعاب التسويق (اختياري)</option>{MARKETING_FEES.map((m) => <option key={m} value={m}>{m}</option>)}</select>
            <select className="inp" value={region} onChange={(e) => { setRegion(e.target.value); set('city', ''); set('district', '') }}><option value="">المنطقة</option>{regions.map((r) => <option key={r.name} value={r.name}>{(r as any).region_name_ar}</option>)}</select>
            <select className="inp" value={f.city} onChange={(e) => { set('city', e.target.value); set('district', '') }} disabled={!region}><option value="">المدينة</option>{cities.map((c) => <option key={c.name} value={c.name}>{(c as any).city_name_ar}</option>)}</select>
            <select className="inp" value={f.district} onChange={(e) => set('district', e.target.value)} disabled={!f.city}><option value="">الحي</option>{districts.map((d) => <option key={d.name} value={d.name}>{(d as any).district_name_ar}</option>)}</select>
            <textarea className="inp sm:col-span-2" placeholder="الوصف" value={f.description} onChange={(e) => set('description', e.target.value)} />
            {services.length > 0 && (
              <div className="sm:col-span-2">
                <p className="mb-2 text-sm text-[var(--aqar-kohl)]/70">خدمات العقار</p>
                <div className="flex flex-wrap gap-2">
                  {services.map((s) => {
                    const on = f.property_services.includes(s.name)
                    return <button key={s.name} type="button" onClick={() => toggleService(s.name)} className={`rounded-full border px-3 py-1 text-sm ${on ? 'border-[var(--aqar-green)] bg-[var(--aqar-green)]/10 text-[var(--aqar-green-d)]' : 'border-[var(--aqar-sand-2)] text-[var(--aqar-kohl)]/70'}`}>{s.service_name_ar}</button>
                  })}
                </div>
              </div>
            )}
            <button onClick={submitDetails} disabled={busy} className="aqar-btn sm:col-span-2">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}التالي: الموقع</button>
          </div>
        )}

        {/* STEP 2 — map */}
        {step === 2 && (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm text-[var(--aqar-kohl)]/70"><MapPin className="h-4 w-4 text-[var(--aqar-green)]" />حدّد موقع العقار — اسحب الدبوس أو انقر على الخريطة.</p>
            <LocationPicker lat={geo.lat} lng={geo.lng} onChange={(lat, lng) => setGeo((g) => ({ ...g, lat, lng }))} />
            <label className="flex items-center gap-2 text-sm text-[var(--aqar-kohl)]/80">
              <input type="checkbox" checked={!!geo.hide} onChange={(e) => setGeo((g) => ({ ...g, hide: e.target.checked ? 1 : 0 }))} />
              إخفاء الموقع الدقيق (عرض مركز الحي فقط)
            </label>
            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="aqar-btn aqar-btn-outline flex-1">رجوع</button>
              <button onClick={submitMap} disabled={busy} className="aqar-btn flex-1">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}التالي: الصور</button>
            </div>
          </div>
        )}

        {/* STEP 3 — photos */}
        {step === 3 && (
          <div className="space-y-3">
            <button onClick={() => fileRef.current?.click()} disabled={busy || images.length >= MAX_IMAGES} className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-[var(--aqar-green)]/50 bg-[var(--aqar-green)]/5 p-8 text-[var(--aqar-green-d)] hover:border-[var(--aqar-green)]">
              {busy ? <Loader2 className="h-8 w-8 animate-spin" /> : <ImagePlus className="h-8 w-8" />}
              <span className="text-base font-bold">أضف صور العقار</span>
              <span className="text-xs text-[var(--aqar-kohl)]/55">من الكاميرا أو المعرض — {images.length}/{MAX_IMAGES}</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onPick(e.target.files)} />
            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {images.map((im) => (
                  <div key={im.name} className="relative aspect-square overflow-hidden rounded-xl border border-[var(--aqar-sand-2)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={im.webp_thumb || im.image} alt="" className="h-full w-full object-cover" />
                    {im.is_primary ? <span className="absolute top-1 rounded-full bg-[var(--aqar-gold)] px-1.5 py-0.5 text-[9px] font-bold text-white" style={{ insetInlineStart: '0.25rem' }}>رئيسية</span> : null}
                    {/* always-visible (mobile has no hover): tap to remove / set primary */}
                    <button onClick={() => imgAction(im.name, 'delete')} aria-label="حذف الصورة" className="absolute top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white" style={{ insetInlineEnd: '0.25rem' }}><Trash2 className="h-4 w-4" /></button>
                    {!im.is_primary && <button onClick={() => imgAction(im.name, 'primary')} aria-label="تعيين رئيسية" className="absolute bottom-1 flex h-8 items-center gap-1 rounded-full bg-white/90 px-2 text-[11px] font-medium text-[var(--aqar-gold)]" style={{ insetInlineStart: '0.25rem' }}><Star className="h-3.5 w-3.5" />رئيسية</button>}
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-[var(--aqar-kohl)]/55">الصورة الأولى هي الرئيسية — اضغط «رئيسية» لتغييرها، أو 🗑 لحذف صورة.</p>
            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="aqar-btn aqar-btn-outline flex-1">رجوع</button>
              <button onClick={() => setStep(4)} className="aqar-btn flex-1">التالي: الترخيص</button>
            </div>
          </div>
        )}

        {/* STEP 4 — license (REGA) */}
        {step === 4 && (
          <div className="space-y-3">
            <div className="aqar-seal flex items-center gap-2 p-3 text-sm text-[var(--aqar-kohl)]/70"><ShieldCheck className="h-5 w-5 text-[var(--aqar-green)]" />أدخل رقم الترخيص الإعلاني الصادر من الهيئة العامة للعقار.</div>
            <input className="inp" dir="ltr" placeholder="رقم الترخيص الإعلاني" value={f.rega_ad_license_number} onChange={(e) => set('rega_ad_license_number', e.target.value)} />
            <input className="inp" dir="ltr" type="date" value={f.rega_license_expiry} onChange={(e) => set('rega_license_expiry', e.target.value)} />
            <input className="inp" placeholder="صاحب الترخيص" value={f.licensee_name} onChange={(e) => set('licensee_name', e.target.value)} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input className="inp" dir="ltr" placeholder="رقم الصك" value={f.deed_number} onChange={(e) => set('deed_number', e.target.value)} />
              <input className="inp" dir="ltr" placeholder="رقم المخطط" value={f.plan_number} onChange={(e) => set('plan_number', e.target.value)} />
              <input className="inp" dir="ltr" placeholder="رقم القطعة" value={f.plot_number} onChange={(e) => set('plot_number', e.target.value)} />
              <input className="inp" placeholder="استخدامات العقار" value={f.property_usages} onChange={(e) => set('property_usages', e.target.value)} />
            </div>
            {/* Optional valuation upsell — captured with the same submission */}
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--aqar-bronze)]/35 bg-[var(--aqar-bronze)]/8 p-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={!!f.valuation_requested}
                onChange={(e) => set('valuation_requested', e.target.checked ? 1 : 0)}
              />
              <span className="leading-6 text-[var(--aqar-kohl)]/85">
                <b className="text-[var(--aqar-green-d)]">أرغب في تقييم عقاري احترافي لعقاري</b>
                <span className="block text-xs text-[var(--aqar-kohl)]/60">خدمة اختيارية مدفوعة — يتواصل معك فريقنا لتحديد التفاصيل والمقابل المالي.</span>
              </span>
            </label>
            <div className="flex gap-2">
              <button onClick={() => setStep(3)} className="aqar-btn aqar-btn-outline flex-1">رجوع</button>
              <button onClick={publish} disabled={busy || !f.rega_ad_license_number} className="aqar-btn flex-1">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}{otpEnabled ? 'تحقّق وانشر' : 'إرسال للمراجعة'}</button>
            </div>
          </div>
        )}

        {/* STEP 5 — done (plain-words status, not a technical state) */}
        {step === 5 && listing && (() => {
          const pending = /pending|review/i.test(pubStatus)
          return (
            <div className="py-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--aqar-green)]/12 text-[var(--aqar-green)]"><Check className="h-8 w-8" /></div>
              <p className="aqar-display text-2xl text-[var(--aqar-green-d)]">{pending ? 'إعلانك تحت المراجعة' : 'إعلانك شغّال ✅'}</p>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-7 text-[var(--aqar-kohl)]/65">
                {pending ? 'استلمنا إعلانك وسنراجع بيانات الترخيص وننشره قريباً.' : 'إعلانك الآن منشور ويظهر للباحثين. يمكنك عرضه أو إضافة إعلان آخر.'}
              </p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
                {!pending && <Link href={`/listing/${listing}`} className="aqar-btn">عرض الإعلان</Link>}
                <button onClick={resetFlow} className="aqar-btn aqar-btn-outline">أضف إعلاناً آخر</button>
              </div>
              <a href={SUPPORT_WA} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--aqar-green)] hover:underline"><MessageCircle className="h-4 w-4" />تحتاج مساعدة؟ راسلنا على واتساب</a>
            </div>
          )
        })()}
      </div>

      {/* Assisted option — for anyone who can't finish alone */}
      {step < 5 && (
        <a href={SUPPORT_WA} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-[#1FA855]/30 bg-[#1FA855]/5 px-4 py-3 text-sm font-medium text-[var(--aqar-green-d)] hover:bg-[#1FA855]/10">
          <MessageCircle className="h-5 w-5 text-[#1FA855]" />تحتاج مساعدة في النشر؟ راسلنا على واتساب ونساعدك خطوة بخطوة
        </a>
      )}

      {/* What you'll need */}
      {step === 0 && (
        <div className="mt-6 aqar-card p-5">
          <h2 className="aqar-section-title mb-4 text-lg">ماذا ستحتاج للنشر؟</h2>
          <ul className="space-y-4 text-sm text-[var(--aqar-kohl)]/85">
            {(otpEnabled
              ? [[Phone, 'رقم جوال سعودي للتحقق عبر رسالة نصية (OTP).'], [BadgeCheck, 'توثيق الهوية عبر نفاذ.'], [ShieldCheck, 'رقم ترخيص إعلان عقاري صادر من منصة فال.']]
              : [[Phone, 'رقم جوال للتواصل معك بشأن الإعلان.'], [ShieldCheck, 'رقم ترخيص إعلان عقاري صادر من منصة فال.'], [BadgeCheck, 'يراجع فريقنا الإعلان ويتأكد من بياناته قبل نشره.']]
            ).map(([Icon, text]: any, i) => (
              <li key={i} className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--aqar-sand-2)]"><Icon className="h-4 w-4 text-[var(--aqar-green)]" /></span><span className="leading-7">{text}</span></li>
            ))}
          </ul>
          <p className="aqar-seal mt-5 flex items-start gap-2 p-3 text-xs leading-6 text-[var(--aqar-kohl)]/75"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--aqar-green)]" />وفقاً لنظام الهيئة العامة للعقار، لا يمكن نشر أي إعلان عقاري دون ترخيص إعلاني ساري المفعول.</p>
        </div>
      )}

      <style jsx>{`:global(.aqar-store .inp){width:100%;min-height:48px;border:1px solid var(--aqar-sand-2);border-radius:0.75rem;padding:0.7rem 0.85rem;font-size:1rem;outline:none;background:var(--aqar-surface);color:var(--aqar-kohl)}:global(.aqar-store .inp:focus){border-color:var(--aqar-green)}`}</style>
    </div>
  )
}
