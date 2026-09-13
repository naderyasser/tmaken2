'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import { frappeClient } from '@/lib/api-client'
import {
  realEstateApi, type AqarAdvertiser, type AqarCategory, type GeoItem,
} from '@/lib/real-estate-api'
import { dualDate } from '@/lib/aqar-format'
import {
  ChevronLeft, ChevronRight, Check, Upload, ShieldCheck, BadgeCheck, Loader2, X,
} from 'lucide-react'

const FACADES = ['شمالية', 'جنوبية', 'شرقية', 'غربية', 'شمالية شرقية', 'شمالية غربية', 'جنوبية شرقية', 'جنوبية غربية', 'ثلاث شوارع', 'أربع شوارع']

async function uploadFile(file: File): Promise<string> {
  let csrf = ''
  try {
    const r = await fetch('/api/method/base_meena.api.get_csrf_token', { credentials: 'include' })
    const j = await r.json(); csrf = j?.message?.csrf_token || j?.message || ''
  } catch { /* ignore */ }
  const fd = new FormData()
  fd.append('file', file)
  fd.append('is_private', '0')
  const res = await fetch('/api/method/upload_file', {
    method: 'POST', credentials: 'include',
    headers: csrf ? { 'X-Frappe-CSRF-Token': csrf } : {}, body: fd,
  })
  const data = await res.json().catch(() => ({}))
  const url = data?.message?.file_url
  if (!url) throw new Error(data?._server_messages || 'upload failed')
  return url
}

export default function NewListingWizard() {
  const { t, lang, isRTL } = useI18n()
  const router = useRouter()
  const L = lang as 'ar' | 'en'
  const Next = isRTL ? ChevronLeft : ChevronRight
  const Prev = isRTL ? ChevronRight : ChevronLeft

  const STEPS = ['re.stepDetails', 're.stepLicenseInfo', 're.stepLocation', 're.stepImages', 're.stepLicense', 're.stepReview']
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [draftName, setDraftName] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [advertisers, setAdvertisers] = useState<AqarAdvertiser[]>([])
  const [categories, setCategories] = useState<AqarCategory[]>([])
  const [regions, setRegions] = useState<GeoItem[]>([])
  const [cities, setCities] = useState<GeoItem[]>([])
  const [districts, setDistricts] = useState<GeoItem[]>([])
  const [services, setServices] = useState<{ name: string; ar: string }[]>([])
  const [uploaded, setUploaded] = useState<string[]>([])
  const [otpSent, setOtpSent] = useState(false)
  const [otpCode, setOtpCode] = useState('')

  const [f, setF] = useState<any>({
    advertiser: '', title: '', category: '', listing_type: 'Sale', price: '', payment_terms: '',
    area_sqm: '', bedrooms: '', bathrooms: '', age_years: '', street_width: '', facade: '', description: '',
    plan_number: '', plot_number: '', property_services: [] as string[], property_usages: '',
    guarantees_and_duration: '', other_obligations: '', disputes: '', location_description_per_deed: '', licensee_name: '',
    region: '', city: '', district: '', address_text: '', latitude: '', longitude: '', hide_exact_location: false,
    rega_ad_license_number: '', rega_license_expiry: '', fal_license_number: '', deed_number: '',
  })
  // inline advertiser quick-create
  const [newAdv, setNewAdv] = useState({ advertiser_name: '', phone: '', national_id: '', user_type: 'Individual' })

  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }))

  useEffect(() => {
    realEstateApi.getAdvertisers().then(setAdvertisers).catch(() => {})
    realEstateApi.listCategories().then((c) => setCategories(c.filter((x) => !x.is_group))).catch(() => {})
    realEstateApi.listRegions().then(setRegions).catch(() => {})
    frappeClient.getList<any>('Aqar Property Service', { fields: ['name', 'service_name_ar'], limit_page_length: 50 })
      .then((rows) => setServices(rows.map((r) => ({ name: r.name, ar: r.service_name_ar })))).catch(() => {})
  }, [])

  useEffect(() => { if (f.region) realEstateApi.listCities(f.region).then(setCities).catch(() => {}) }, [f.region])
  useEffect(() => { if (f.city) realEstateApi.listDistricts(f.city).then(setDistricts).catch(() => {}) }, [f.city])

  const selectedAdv = advertisers.find((a) => a.name === f.advertiser)

  const buildPayload = () => ({
    title: f.title, advertiser: f.advertiser, category: f.category, listing_type: f.listing_type,
    price: Number(f.price) || 0, payment_terms: f.payment_terms, area_sqm: Number(f.area_sqm) || undefined,
    bedrooms: Number(f.bedrooms) || undefined, bathrooms: Number(f.bathrooms) || undefined,
    age_years: Number(f.age_years) || undefined, street_width: Number(f.street_width) || undefined,
    facade: f.facade || undefined, description: f.description,
    plan_number: f.plan_number, plot_number: f.plot_number,
    property_services: (f.property_services || []).map((s: string) => ({ service: s })),
    property_usages: f.property_usages, guarantees_and_duration: f.guarantees_and_duration,
    other_obligations: f.other_obligations, disputes: f.disputes,
    location_description_per_deed: f.location_description_per_deed, licensee_name: f.licensee_name,
    region: f.region || undefined, city: f.city, district: f.district || undefined,
    address_text: f.address_text, latitude: Number(f.latitude) || undefined, longitude: Number(f.longitude) || undefined,
    hide_exact_location: f.hide_exact_location ? 1 : 0,
    rega_ad_license_number: f.rega_ad_license_number, rega_license_expiry: f.rega_license_expiry || undefined,
    fal_license_number: f.fal_license_number, deed_number: f.deed_number,
  })

  const ensureDraft = async (): Promise<string> => {
    const payload = buildPayload()
    if (draftName) { await realEstateApi.updateListing(draftName, payload); return draftName }
    const created = await realEstateApi.createListing(payload as any)
    setDraftName(created.name!)
    return created.name!
  }

  const createAdvertiserInline = async () => {
    setBusy(true); setErr(null)
    try {
      const adv = await realEstateApi.createAdvertiser(newAdv as any)
      setAdvertisers((p) => [adv, ...p]); set('advertiser', adv.name)
      setNewAdv({ advertiser_name: '', phone: '', national_id: '', user_type: 'Individual' })
    } catch (e: any) { setErr(e?.message || t('re.error')) } finally { setBusy(false) }
  }

  const sendOtp = async () => {
    if (!selectedAdv?.phone) return
    setBusy(true); setErr(null)
    try { await realEstateApi.requestOtp(selectedAdv.phone); setOtpSent(true) }
    catch (e: any) { setErr(e?.message || t('re.error')) } finally { setBusy(false) }
  }
  const confirmOtp = async () => {
    if (!selectedAdv) return
    setBusy(true); setErr(null)
    try {
      const r = await realEstateApi.verifyOtp(selectedAdv.phone!, otpCode, selectedAdv.name)
      if (r.verified) { setAdvertisers((p) => p.map((a) => a.name === selectedAdv.name ? { ...a, is_phone_verified: 1 } : a)); setOtpSent(false); setOtpCode('') }
      else setErr(isRTL ? 'رمز غير صحيح' : 'Invalid code')
    } catch (e: any) { setErr(e?.message || t('re.error')) } finally { setBusy(false) }
  }
  const verifyNafath = async () => {
    if (!selectedAdv) return
    setBusy(true); setErr(null)
    try {
      const init = await realEstateApi.nafathInitiate(selectedAdv.national_id || '0000000000')
      const st = await realEstateApi.nafathStatus(init.trans_id, selectedAdv.name)
      if (st.status === 'COMPLETED') setAdvertisers((p) => p.map((a) => a.name === selectedAdv.name ? { ...a, nafath_verified: 1 } : a))
    } catch (e: any) { setErr(e?.message || t('re.error')) } finally { setBusy(false) }
  }

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true); setErr(null)
    try {
      const listing = await ensureDraft()
      for (let i = 0; i < files.length; i++) {
        const url = await uploadFile(files[i])
        await realEstateApi.addListingImage(listing, url, uploaded.length === 0 && i === 0 ? 1 : 0)
        setUploaded((p) => [...p, url])
      }
    } catch (e: any) { setErr(e?.message || t('re.error')) } finally { setBusy(false) }
  }

  const verifyLicense = async () => {
    setBusy(true); setErr(null)
    try { const listing = await ensureDraft(); await realEstateApi.verifyLicense(listing) }
    catch (e: any) { setErr(e?.message || t('re.error')) } finally { setBusy(false) }
  }

  const publish = async () => {
    setBusy(true); setErr(null)
    try {
      const listing = await ensureDraft()
      await realEstateApi.publishListing(listing)
      router.push(`/real-estate/listings/${listing}`)
    } catch (e: any) { setErr(e?.message || t('re.error')) } finally { setBusy(false) }
  }

  const next = async () => {
    setErr(null)
    // validate minimal per step
    if (step === 0 && (!f.advertiser || !f.title || !f.category || !f.price)) { setErr(isRTL ? 'أكمل الحقول المطلوبة' : 'Complete required fields'); return }
    if (step === 2) {
      if (!f.city) { setErr(isRTL ? 'اختر المدينة' : 'Select a city'); return }
      setBusy(true)
      try { await ensureDraft() } catch (e: any) { setErr(e?.message || t('re.error')); setBusy(false); return }
      setBusy(false)
    }
    if (step === 3 && draftName) { try { await realEstateApi.updateListing(draftName, buildPayload()) } catch { /* keep */ } }
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }
  const back = () => setStep((s) => Math.max(s - 1, 0))

  const catLabel = (c: AqarCategory) => (L === 'ar' ? c.category_name_ar : c.category_name_en)
  const geoLabel = (g: GeoItem, kind: 'region' | 'city' | 'district') =>
    L === 'ar' ? (g as any)[`${kind}_name_ar`] : (g as any)[`${kind}_name_en`]

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">{t('re.newListing')}</h1>

      {/* Stepper */}
      <div className="flex items-center gap-1 overflow-x-auto">
        {STEPS.map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-1">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i < step ? 'bg-emerald-700 text-white' : i === step ? 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={`hidden whitespace-nowrap text-xs sm:block ${i === step ? 'font-semibold text-emerald-800' : 'text-gray-400'}`}>{t(s)}</span>
            {i < STEPS.length - 1 && <div className="h-px flex-1 bg-gray-200" />}
          </div>
        ))}
      </div>

      {err && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      <div className="rounded-2xl border-2 border-gray-100 bg-white p-5">
        {step === 0 && (
          <div className="space-y-4">
            {/* advertiser */}
            <Field label={t('re.advertiser')} req>
              <select value={f.advertiser} onChange={(e) => set('advertiser', e.target.value)} className="inp">
                <option value="">—</option>
                {advertisers.map((a) => <option key={a.name} value={a.name}>{a.advertiser_name} ({a.phone})</option>)}
              </select>
            </Field>
            <details className="rounded-xl bg-gray-50 p-3 text-sm">
              <summary className="cursor-pointer font-medium text-gray-600">{isRTL ? '+ معلن جديد' : '+ New advertiser'}</summary>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input placeholder={t('re.advertiser')} className="inp" value={newAdv.advertiser_name} onChange={(e) => setNewAdv({ ...newAdv, advertiser_name: e.target.value })} />
                <input placeholder="+9665…" dir="ltr" className="inp" value={newAdv.phone} onChange={(e) => setNewAdv({ ...newAdv, phone: e.target.value })} />
                <input placeholder={isRTL ? 'رقم الهوية' : 'National ID'} dir="ltr" className="inp" value={newAdv.national_id} onChange={(e) => setNewAdv({ ...newAdv, national_id: e.target.value })} />
                <select className="inp" value={newAdv.user_type} onChange={(e) => setNewAdv({ ...newAdv, user_type: e.target.value })}>
                  <option value="Individual">{isRTL ? 'فرد' : 'Individual'}</option>
                  <option value="Broker">{isRTL ? 'وسيط' : 'Broker'}</option>
                  <option value="Agency">{isRTL ? 'مكتب' : 'Agency'}</option>
                </select>
                <button onClick={createAdvertiserInline} disabled={busy || !newAdv.advertiser_name || !newAdv.phone} className="btn-emerald sm:col-span-2">{t('re.save')}</button>
              </div>
            </details>

            <Field label={t('re.title_f')} req><input className="inp" value={f.title} onChange={(e) => set('title', e.target.value)} /></Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t('re.category')} req>
                <select className="inp" value={f.category} onChange={(e) => set('category', e.target.value)}>
                  <option value="">—</option>{categories.map((c) => <option key={c.name} value={c.name}>{catLabel(c)}</option>)}
                </select>
              </Field>
              <Field label={t('re.listingType')} req>
                <select className="inp" value={f.listing_type} onChange={(e) => set('listing_type', e.target.value)}>
                  <option value="Sale">{t('re.typeSale')}</option><option value="Rent">{t('re.typeRent')}</option><option value="Daily Rent">{t('re.typeDailyRent')}</option>
                </select>
              </Field>
              <Field label={t('re.price')} req><input type="number" dir="ltr" className="inp" value={f.price} onChange={(e) => set('price', e.target.value)} /></Field>
              <Field label={t('re.paymentTerms')}><input className="inp" placeholder="على دفعتين" value={f.payment_terms} onChange={(e) => set('payment_terms', e.target.value)} /></Field>
              <Field label={t('re.area')}><input type="number" dir="ltr" className="inp" value={f.area_sqm} onChange={(e) => set('area_sqm', e.target.value)} /></Field>
              <Field label={t('re.bedrooms')}><input type="number" dir="ltr" className="inp" value={f.bedrooms} onChange={(e) => set('bedrooms', e.target.value)} /></Field>
              <Field label={t('re.bathrooms')}><input type="number" dir="ltr" className="inp" value={f.bathrooms} onChange={(e) => set('bathrooms', e.target.value)} /></Field>
              <Field label={t('re.age')}><input type="number" dir="ltr" className="inp" value={f.age_years} onChange={(e) => set('age_years', e.target.value)} /></Field>
              <Field label={t('re.streetWidth')}><input type="number" dir="ltr" className="inp" value={f.street_width} onChange={(e) => set('street_width', e.target.value)} /></Field>
              <Field label={t('re.facade')}>
                <select className="inp" value={f.facade} onChange={(e) => set('facade', e.target.value)}>
                  <option value="">—</option>{FACADES.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </Field>
            </div>
            <Field label={t('re.description')}><textarea className="inp min-h-24" value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('re.planNumber')}><input className="inp" value={f.plan_number} onChange={(e) => set('plan_number', e.target.value)} /></Field>
            <Field label={t('re.plotNumber')}><input className="inp" value={f.plot_number} onChange={(e) => set('plot_number', e.target.value)} /></Field>
            <div className="sm:col-span-2">
              <p className="mb-1 text-xs text-gray-500">{t('re.propertyServices')}</p>
              <div className="flex flex-wrap gap-2">
                {services.map((s) => {
                  const on = f.property_services.includes(s.name)
                  return (
                    <button key={s.name} type="button"
                      onClick={() => set('property_services', on ? f.property_services.filter((x: string) => x !== s.name) : [...f.property_services, s.name])}
                      className={`rounded-full px-3 py-1 text-sm ${on ? 'bg-emerald-700 text-white' : 'bg-gray-100 text-gray-600'}`}>{s.ar}</button>
                  )
                })}
              </div>
            </div>
            <Field label={t('re.propertyUsages')}><input className="inp" value={f.property_usages} onChange={(e) => set('property_usages', e.target.value)} /></Field>
            <Field label={t('re.guarantees')}><input className="inp" value={f.guarantees_and_duration} onChange={(e) => set('guarantees_and_duration', e.target.value)} /></Field>
            <Field label={t('re.otherObligations')}><input className="inp" value={f.other_obligations} onChange={(e) => set('other_obligations', e.target.value)} /></Field>
            <Field label={t('re.disputes')}><input className="inp" value={f.disputes} onChange={(e) => set('disputes', e.target.value)} /></Field>
            <Field label={t('re.licenseeName')}><input className="inp" value={f.licensee_name} onChange={(e) => set('licensee_name', e.target.value)} /></Field>
            <div className="sm:col-span-2"><Field label={t('re.locationPerDeed')}><textarea className="inp" value={f.location_description_per_deed} onChange={(e) => set('location_description_per_deed', e.target.value)} /></Field></div>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('re.region')}>
              <select className="inp" value={f.region} onChange={(e) => { set('region', e.target.value); set('city', ''); set('district', '') }}>
                <option value="">—</option>{regions.map((r) => <option key={r.name} value={r.name}>{geoLabel(r, 'region')}</option>)}
              </select>
            </Field>
            <Field label={t('re.city')} req>
              <select className="inp" value={f.city} onChange={(e) => { set('city', e.target.value); set('district', '') }} disabled={!f.region}>
                <option value="">—</option>{cities.map((c) => <option key={c.name} value={c.name}>{geoLabel(c, 'city')}</option>)}
              </select>
            </Field>
            <Field label={t('re.district')}>
              <select className="inp" value={f.district} onChange={(e) => set('district', e.target.value)} disabled={!f.city}>
                <option value="">—</option>{districts.map((d) => <option key={d.name} value={d.name}>{geoLabel(d, 'district')}</option>)}
              </select>
            </Field>
            <Field label={t('re.address')}><input className="inp" value={f.address_text} onChange={(e) => set('address_text', e.target.value)} /></Field>
            <Field label="Latitude"><input type="number" dir="ltr" className="inp" value={f.latitude} onChange={(e) => set('latitude', e.target.value)} /></Field>
            <Field label="Longitude"><input type="number" dir="ltr" className="inp" value={f.longitude} onChange={(e) => set('longitude', e.target.value)} /></Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={f.hide_exact_location} onChange={(e) => set('hide_exact_location', e.target.checked)} />
              {t('re.hideExactLocation')}
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <button onClick={() => fileRef.current?.click()} disabled={busy} className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 p-8 text-gray-500 hover:border-emerald-300">
              {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
              {t('re.stepImages')}
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onUpload(e.target.files)} />
            <div className="grid grid-cols-3 gap-2">
              {uploaded.map((u, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={u} alt="" className="h-24 w-full rounded-xl object-cover" />
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            {/* advertiser verification gates */}
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="mb-2 text-sm font-semibold text-gray-600">{selectedAdv?.advertiser_name}</p>
              <div className="flex flex-wrap items-center gap-2">
                {selectedAdv?.is_phone_verified ? <span className="vb"><BadgeCheck className="h-3.5 w-3.5" />{t('re.phoneVerified')}</span> : (
                  otpSent ? (
                    <span className="flex items-center gap-1"><input className="inp w-28" placeholder="OTP" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} /><button onClick={confirmOtp} disabled={busy} className="btn-emerald">{t('re.verified')}</button></span>
                  ) : <button onClick={sendOtp} disabled={busy} className="btn-outline">{t('re.phoneVerified')}</button>
                )}
                {selectedAdv?.nafath_verified ? <span className="vb"><BadgeCheck className="h-3.5 w-3.5" />{t('re.nafathVerified')}</span> : <button onClick={verifyNafath} disabled={busy} className="btn-outline">{t('re.nafathVerified')}</button>}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t('re.licenseNumber')} req><input className="inp" dir="ltr" value={f.rega_ad_license_number} onChange={(e) => set('rega_ad_license_number', e.target.value)} /></Field>
              <Field label={t('re.licenseExpiry')} req><input type="date" dir="ltr" className="inp" value={f.rega_license_expiry} onChange={(e) => set('rega_license_expiry', e.target.value)} /></Field>
              <Field label={t('re.falLicense')}><input className="inp" dir="ltr" value={f.fal_license_number} onChange={(e) => set('fal_license_number', e.target.value)} /></Field>
              <Field label={t('re.deedNumber')}><input className="inp" dir="ltr" value={f.deed_number} onChange={(e) => set('deed_number', e.target.value)} /></Field>
            </div>
            <button onClick={verifyLicense} disabled={busy || !f.rega_ad_license_number} className="btn-amber w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}{t('re.verify')}
            </button>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-3 text-sm">
            <Row k={t('re.title_f')} v={f.title} />
            <Row k={t('re.price')} v={f.price} />
            <Row k={t('re.city')} v={f.city} />
            <Row k={t('re.licenseNumber')} v={f.rega_ad_license_number} />
            <Row k={t('re.licenseExpiry')} v={f.rega_license_expiry ? dualDate(f.rega_license_expiry, L) : '—'} />
            <Row k={t('re.stepImages')} v={String(uploaded.length)} />
            <button onClick={publish} disabled={busy} className="btn-emerald mt-3 w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}{t('re.publish')}
            </button>
          </div>
        )}
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between">
        <button onClick={back} disabled={step === 0 || busy} className="inline-flex items-center gap-1 rounded-xl px-4 py-2 text-sm text-gray-600 disabled:opacity-40">
          <Prev className="h-4 w-4" />{t('re.back')}
        </button>
        {step < STEPS.length - 1 && (
          <button onClick={next} disabled={busy} className="inline-flex items-center gap-1 rounded-xl bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{t('re.next')}<Next className="h-4 w-4" /></>}
          </button>
        )}
      </div>

      <style jsx>{`
        :global(.inp) { width: 100%; border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; }
        :global(.inp:focus) { border-color: #34d399; }
        :global(.btn-emerald) { display:inline-flex; align-items:center; justify-content:center; gap:0.5rem; background:#047857; color:#fff; border-radius:0.75rem; padding:0.5rem 1rem; font-size:0.875rem; font-weight:600; }
        :global(.btn-amber) { display:inline-flex; align-items:center; justify-content:center; gap:0.5rem; background:#d97706; color:#fff; border-radius:0.75rem; padding:0.5rem 1rem; font-size:0.875rem; font-weight:600; }
        :global(.btn-outline) { border:1px solid #e5e7eb; border-radius:0.75rem; padding:0.4rem 0.9rem; font-size:0.8rem; }
        :global(.vb) { display:inline-flex; align-items:center; gap:0.25rem; background:#ecfdf5; color:#047857; border-radius:9999px; padding:0.15rem 0.6rem; font-size:0.75rem; font-weight:500; }
      `}</style>
    </div>
  )
}

function Field({ label, req, children }: { label: string; req?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-gray-500">{label}{req && <span className="text-red-500"> *</span>}</span>
      {children}
    </label>
  )
}

function Row({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 py-2">
      <span className="text-gray-400">{k}</span>
      <span className="font-medium text-gray-800">{v || '—'}</span>
    </div>
  )
}
