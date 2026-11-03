'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Loader2, Sparkles } from 'lucide-react'
import { realEstateApi, type GeoItem } from '@/lib/real-estate-api'
import PhoneInput, { isValidIntlPhone } from '@/components/store/phone-input'

// Stakeholder segments (values = backend Select options, verbatim)
const STAKEHOLDERS = [
  'باحث عن عقار (للسكن أو الاستخدام الشخصي)',
  'مستثمر فرد',
  'مالك عقار',
  'وسيط عقاري (مستقل)',
  'مقيم عقاري (مستقل)',
  'مكتب عقاري',
  'شركة تطوير عقاري',
  'شركة تسويق عقاري',
  'شركة إدارة أملاك',
  'شركة مزادات عقارية',
  'شركة تقييم وتثمين عقاري',
  'الاستشارات والتحليلات العقارية',
  'مكتب هندسي / استشارات هندسية',
  'شركة مقاولات وبناء',
  'صناديق وشركات استثمار مالي وعقاري',
  'جهة تمويلية (بنك / شركة تمويل)',
  'شركات التقنية العقارية (المنصات والتطبيقات)',
  'مكتب محاماة وتوثيق عقاري',
  'أخرى',
]

// Segments where an organization / license makes sense → show the optional extras
const ORG_SEGMENTS = new Set(STAKEHOLDERS.filter((s) => /شركة|مكتب|صناديق|جهة|وسيط|مقيم/.test(s)))

export default function InterestForm() {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [stakeholder, setStakeholder] = useState('')
  const [organization, setOrganization] = useState('')
  const [fal, setFal] = useState('')
  const [region, setRegion] = useState('')
  const [city, setCity] = useState('')
  const [regions, setRegions] = useState<GeoItem[]>([])
  const [cities, setCities] = useState<GeoItem[]>([])
  const [areas, setAreas] = useState<Array<{ name: string; interest_name_ar: string }>>([])
  const [picked, setPicked] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [err, setErr] = useState('')
  const [refId, setRefId] = useState('')

  useEffect(() => {
    realEstateApi.listRegions().then(setRegions).catch(() => {})
    realEstateApi.listInterestAreas().then(setAreas).catch(() => setAreas([]))
  }, [])
  useEffect(() => {
    if (region) realEstateApi.listCities(region).then(setCities).catch(() => {})
  }, [region])

  const toggle = (name: string) =>
    setPicked((p) => (p.includes(name) ? p.filter((x) => x !== name) : [...p, name]))

  const submit = async () => {
    if (!fullName.trim()) return setErr('من فضلك أدخل اسمك الكامل.')
    if (!isValidIntlPhone(phone)) return setErr('أدخل رقم جوال صحيح.')
    if (!stakeholder) return setErr('يهمّنا التعرّف عليك — اختر صفتك من القائمة.')
    setErr(''); setState('loading')
    try {
      const r = await realEstateApi.submitInterest({
        full_name: fullName.trim(),
        phone,
        stakeholder_type: stakeholder,
        city: city || undefined,
        interests: picked,
        organization_name: organization.trim() || undefined,
        fal_license_number: fal.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      setRefId(r.name || '')
      setState('done')
    } catch (e: any) {
      setErr(e?.message || 'تعذّر التسجيل، حاول مرة أخرى.')
      setState('idle')
    }
  }

  if (state === 'done') {
    return (
      <div className="aqar-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--aqar-green)]/12 text-[var(--aqar-green)]"><Check className="h-8 w-8" /></div>
        <p className="aqar-display text-2xl text-[var(--aqar-green-d)]">تم تسجيل اهتمامك ✅</p>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-7 text-[var(--aqar-kohl)]/65">
          شكراً {fullName.split(' ')[0]} — سنتواصل معك بما يناسب اهتماماتك{refId ? <> (رقم التسجيل <b dir="ltr">{refId}</b>)</> : null}.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/search" className="aqar-btn">تصفّح العروض</Link>
          <Link href="/request-property" className="aqar-btn aqar-btn-outline">اطلب عقارك</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="aqar-card space-y-4 p-5">
      {err && <div className="rounded-xl border border-[var(--aqar-clay)]/30 bg-[var(--aqar-clay)]/5 p-3 text-sm text-[var(--aqar-clay)]">{err}</div>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">الاسم الكامل *</label><input className="inp" value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
        <div><label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">رقم الجوال *</label><PhoneInput value={phone} onChange={setPhone} /></div>
      </div>

      <div>
        <label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">يهمّنا التعرف عليك، هل أنت؟ *</label>
        <select className="inp" value={stakeholder} onChange={(e) => setStakeholder(e.target.value)}>
          <option value="">اختر صفتك</option>
          {STAKEHOLDERS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {ORG_SEGMENTS.has(stakeholder) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">اسم الجهة / المكتب (اختياري)</label><input className="inp" value={organization} onChange={(e) => setOrganization(e.target.value)} /></div>
          <div><label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">رخصة فال (اختياري)</label><input className="inp" dir="ltr" value={fal} onChange={(e) => setFal(e.target.value)} /></div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">المنطقة</label>
          <select className="inp" value={region} onChange={(e) => { setRegion(e.target.value); setCity('') }}>
            <option value="">كل المناطق</option>
            {regions.map((r: any) => <option key={r.name} value={r.name}>{r.region_name_ar}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">المدينة</label>
          <select className="inp" value={city} onChange={(e) => setCity(e.target.value)} disabled={!region}>
            <option value="">{region ? 'اختر المدينة' : 'اختر المنطقة أولاً'}</option>
            {cities.map((c: any) => <option key={c.name} value={c.name}>{c.city_name_ar}</option>)}
          </select>
        </div>
      </div>

      {areas.length > 0 && (
        <div>
          <label className="mb-2 block text-sm text-[var(--aqar-kohl)]/70">مجالات الاهتمام — اختر ما يناسبك</label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {areas.map((a) => {
              const on = picked.includes(a.name)
              return (
                <button
                  key={a.name}
                  type="button"
                  onClick={() => toggle(a.name)}
                  aria-pressed={on}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-start text-sm transition-colors ${on ? 'border-[var(--aqar-green)] bg-[var(--aqar-green)]/10 font-medium text-[var(--aqar-green-d)]' : 'border-[var(--aqar-sand-2)] text-[var(--aqar-kohl)]/75 hover:border-[var(--aqar-green)]/40'}`}
                >
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? 'border-[var(--aqar-green)] bg-[var(--aqar-green)] text-white' : 'border-[var(--aqar-sand-2)]'}`}>{on ? <Check className="h-3 w-3" /> : null}</span>
                  {a.interest_name_ar}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">أكتب هنا (اختياري)</label>
        <textarea className="inp" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="أخبرنا أكثر عن اهتمامك العقاري" />
      </div>

      <button onClick={submit} disabled={state === 'loading'} className="aqar-btn w-full">
        {state === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}تسجيل الاهتمام
      </button>

      <style jsx>{`:global(.aqar-store .inp){width:100%;min-height:48px;border:1px solid var(--aqar-sand-2);border-radius:0.75rem;padding:0.7rem 0.85rem;font-size:1rem;outline:none;background:var(--aqar-surface);color:var(--aqar-kohl)}:global(.aqar-store .inp:focus){border-color:var(--aqar-green)}`}</style>
    </div>
  )
}
