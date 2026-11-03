'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Loader2, Megaphone } from 'lucide-react'
import { realEstateApi, type GeoItem } from '@/lib/real-estate-api'
import PhoneInput, { isValidIntlPhone } from '@/components/store/phone-input'

// values = backend Select options, verbatim
const PROJECT_TYPES = ['سكني', 'تجاري', 'سكني تجاري', 'مجمع سكني', 'برج', 'مخطط أراضٍ', 'أخرى']
const CONTACT_TIMES = [
  { value: 'صباحاً', label: 'صباحاً (٧ص – ١٢م)' },
  { value: 'مساءً', label: 'مساءً (٤م – ١٠م)' },
  { value: 'أي وقت', label: 'أي وقت' },
]

export default function MarketingForm() {
  const [applicant, setApplicant] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [region, setRegion] = useState('')
  const [city, setCity] = useState('')
  const [district, setDistrict] = useState('')
  const [projectType, setProjectType] = useState('')
  const [contactTime, setContactTime] = useState('')
  const [notes, setNotes] = useState('')
  const [regions, setRegions] = useState<GeoItem[]>([])
  const [cities, setCities] = useState<GeoItem[]>([])
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [err, setErr] = useState('')
  const [refId, setRefId] = useState('')

  useEffect(() => { realEstateApi.listRegions().then(setRegions).catch(() => {}) }, [])
  useEffect(() => { if (region) realEstateApi.listCities(region).then(setCities).catch(() => {}) }, [region])

  const submit = async () => {
    if (!applicant.trim()) return setErr('من فضلك أدخل اسم مقدّم الطلب.')
    if (!isValidIntlPhone(phone)) return setErr('أدخل رقم جوال صحيح.')
    if (!company.trim()) return setErr('من فضلك أدخل اسم الشركة / الجهة.')
    if (!projectType) return setErr('اختر نوع المشروع العقاري.')
    if (!contactTime) return setErr('اختر وقت التواصل المفضّل.')
    setErr(''); setState('loading')
    try {
      const r = await realEstateApi.submitMarketingRequest({
        applicant_name: applicant.trim(),
        phone,
        company_name: company.trim(),
        job_title: jobTitle.trim() || undefined,
        city: city || undefined,
        district: district.trim() || undefined,
        project_type: projectType,
        contact_time: contactTime,
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
        <p className="aqar-display text-2xl text-[var(--aqar-green-d)]">استلمنا طلب التسويق ✅</p>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-7 text-[var(--aqar-kohl)]/65">
          فريق التسويق يتواصل معك في الوقت الذي حدّدته{refId ? <> — رقم الطلب <b dir="ltr">{refId}</b></> : null}.
        </p>
        <Link href="/" className="aqar-btn mt-5">العودة للرئيسية</Link>
      </div>
    )
  }

  return (
    <div className="aqar-card space-y-4 p-5">
      {err && <div className="rounded-xl border border-[var(--aqar-clay)]/30 bg-[var(--aqar-clay)]/5 p-3 text-sm text-[var(--aqar-clay)]">{err}</div>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">اسم مقدّم الطلب *</label><input className="inp" value={applicant} onChange={(e) => setApplicant(e.target.value)} /></div>
        <div><label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">رقم التواصل *</label><PhoneInput value={phone} onChange={setPhone} /></div>
        <div><label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">اسم الشركة / الجهة *</label><input className="inp" value={company} onChange={(e) => setCompany(e.target.value)} /></div>
        <div><label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">المسمى الوظيفي (اختياري)</label><input className="inp" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} /></div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">منطقة المشروع</label>
          <select className="inp" value={region} onChange={(e) => { setRegion(e.target.value); setCity('') }}>
            <option value="">اختر</option>
            {regions.map((r: any) => <option key={r.name} value={r.name}>{r.region_name_ar}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">مدينة المشروع</label>
          <select className="inp" value={city} onChange={(e) => setCity(e.target.value)} disabled={!region}>
            <option value="">اختر</option>
            {cities.map((c: any) => <option key={c.name} value={c.name}>{c.city_name_ar}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">موقع المشروع — الحي</label>
          <input className="inp" value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="اسم الحي" />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">نوع المشروع العقاري *</label>
        <div className="flex flex-wrap gap-2">
          {PROJECT_TYPES.map((t) => (
            <button key={t} type="button" onClick={() => setProjectType(t)} aria-pressed={projectType === t} className={`rounded-full border px-4 py-2 text-sm font-medium ${projectType === t ? 'border-[var(--aqar-green)] bg-[var(--aqar-green)]/10 text-[var(--aqar-green-d)]' : 'border-[var(--aqar-sand-2)] text-[var(--aqar-kohl)]/70 hover:border-[var(--aqar-green)]/40'}`}>{t}</button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">وقت التواصل المفضّل *</label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {CONTACT_TIMES.map((t) => (
            <button key={t.value} type="button" onClick={() => setContactTime(t.value)} aria-pressed={contactTime === t.value} className={`min-h-[44px] rounded-xl border px-3 text-sm font-semibold ${contactTime === t.value ? 'border-[var(--aqar-green)] bg-[var(--aqar-green)]/10 text-[var(--aqar-green-d)]' : 'border-[var(--aqar-sand-2)] text-[var(--aqar-kohl)]/70'}`}>{t.label}</button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">نبذة عن المشروع (اختياري)</label>
        <textarea className="inp" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="عدد الوحدات، مرحلة المشروع، الجمهور المستهدف…" />
      </div>

      <button onClick={submit} disabled={state === 'loading'} className="aqar-btn w-full">
        {state === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}إرسال الطلب
      </button>

      <style jsx>{`:global(.aqar-store .inp){width:100%;min-height:48px;border:1px solid var(--aqar-sand-2);border-radius:0.75rem;padding:0.7rem 0.85rem;font-size:1rem;outline:none;background:var(--aqar-surface);color:var(--aqar-kohl)}:global(.aqar-store .inp:focus){border-color:var(--aqar-green)}`}</style>
    </div>
  )
}
