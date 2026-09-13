'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Check, Loader2, Search, UserRound, Handshake, ShieldCheck, MessageCircle,
} from 'lucide-react'
import { realEstateApi, type AqarCategory, type GeoItem } from '@/lib/real-estate-api'
import { formatNumber } from '@/lib/aqar-format'
import PhoneInput, { isValidIntlPhone } from '@/components/store/phone-input'
import DistrictMultiSelect from '@/components/store/district-multi-select'

const SUPPORT_WA = 'https://wa.me/966553275000?text=السلام%20عليكم،%20أرغب%20في%20طلب%20عقار%20عبر%20تمكين%20العقارية'
const STEPS = ['من أنت؟', 'بياناتك', 'تفاصيل الطلب', 'تم']

type Persona = '' | 'Seeker' | 'Broker'

export default function RequestPropertyForm() {
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [refId, setRefId] = useState('')

  const [persona, setPersona] = useState<Persona>('')
  const [contractConfirmed, setContractConfirmed] = useState(false)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [fal, setFal] = useState('')
  const [contractNo, setContractNo] = useState('')

  const [cats, setCats] = useState<AqarCategory[]>([])
  const [regions, setRegions] = useState<GeoItem[]>([])
  const [cities, setCities] = useState<GeoItem[]>([])
  const [region, setRegion] = useState('')
  const [city, setCity] = useState('')
  const [category, setCategory] = useState('')
  const [districts, setDistricts] = useState<string[]>([])
  const [areaMin, setAreaMin] = useState('')
  const [areaMax, setAreaMax] = useState('')
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')
  const [payment, setPayment] = useState<'' | 'Cash' | 'Bank Financing'>('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    realEstateApi.listCategories().then((c) => setCats(c.filter((x) => !x.is_group))).catch(() => {})
    realEstateApi.listRegions().then(setRegions).catch(() => {})
  }, [])
  useEffect(() => {
    if (region) realEstateApi.listCities(region).then(setCities).catch(() => {})
  }, [region])

  const pickPersona = (p: Persona) => { setPersona(p); setErr(''); if (p === 'Seeker') setStep(1) }

  const next1 = () => {
    if (!fullName.trim()) return setErr('من فضلك أدخل اسمك الكامل.')
    if (!isValidIntlPhone(phone)) return setErr('أدخل رقم جوال صحيح.')
    if (persona === 'Broker' && !fal.trim()) return setErr('رقم رخصة فال مطلوب للوسيط العقاري.')
    setErr(''); setStep(2)
  }

  const submit = async () => {
    if (!city) return setErr('اختر المدينة.')
    if (!category) return setErr('اختر نوع العقار المطلوب.')
    if (!payment) return setErr('اختر طريقة الشراء.')
    setBusy(true); setErr('')
    try {
      const r = await realEstateApi.submitBuyerRequest({
        requester_type: persona as 'Seeker' | 'Broker',
        full_name: fullName.trim(),
        phone,
        city,
        category,
        districts,
        area_min: Number(areaMin) || undefined,
        area_max: Number(areaMax) || undefined,
        budget_min: Number(budgetMin) || undefined,
        budget_max: Number(budgetMax) || undefined,
        payment_method: payment,
        notes: notes.trim() || undefined,
        fal_license_number: persona === 'Broker' ? fal.trim() : undefined,
        brokerage_contract_number: persona === 'Broker' ? contractNo.trim() || undefined : undefined,
        has_brokerage_contract: persona === 'Broker' ? 1 : 0,
      })
      setRefId(r.name || '')
      setStep(3)
    } catch (e: any) {
      setErr(e?.message || 'تعذّر إرسال الطلب، حاول مرة أخرى.')
    } finally {
      setBusy(false)
    }
  }

  const num = (v: string, set: (s: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => set(e.target.value.replace(/[^\d.]/g, ''))

  return (
    <div>
      {/* stepper */}
      <div className="mb-6 flex items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-1">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i < step ? 'bg-[var(--aqar-green)] text-white' : i === step ? 'bg-[var(--aqar-green)]/15 text-[var(--aqar-green-d)] ring-2 ring-[var(--aqar-green)]' : 'bg-[var(--aqar-sand-2)] text-[var(--aqar-kohl)]/40'}`}>{i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}</div>
            <span className={`hidden text-xs sm:block ${i === step ? 'font-semibold text-[var(--aqar-green-d)]' : 'text-[var(--aqar-kohl)]/40'}`}>{s}</span>
            {i < STEPS.length - 1 && <div className="h-px flex-1 bg-[var(--aqar-sand-2)]" />}
          </div>
        ))}
      </div>

      {err && <div className="mb-4 rounded-xl border border-[var(--aqar-clay)]/30 bg-[var(--aqar-clay)]/5 p-3 text-sm text-[var(--aqar-clay)]">{err}</div>}

      <div className="aqar-card p-5">
        {/* STEP 0 — persona */}
        {step === 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-[var(--aqar-kohl)]/75">حدّد صفتك حتى نخدمك بالشكل الصحيح:</p>
            <button onClick={() => pickPersona('Seeker')} className={`flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-start hover:border-[var(--aqar-green)] hover:bg-[var(--aqar-green)]/5 ${persona === 'Seeker' ? 'border-[var(--aqar-green)] bg-[var(--aqar-green)]/5' : 'border-[var(--aqar-sand-2)]'}`}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--aqar-green)]/10 text-[var(--aqar-green-d)]"><UserRound className="h-5 w-5" /></span>
              <span>
                <span className="block font-bold text-[var(--aqar-kohl)]">باحث عن عقار</span>
                <span className="mt-0.5 block text-xs leading-5 text-[var(--aqar-kohl)]/55">أبحث عن عقار لنفسي (النموذج مخصّص للمشتري)</span>
              </span>
            </button>
            <button onClick={() => pickPersona('Broker')} className={`flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-start hover:border-[var(--aqar-green)] hover:bg-[var(--aqar-green)]/5 ${persona === 'Broker' ? 'border-[var(--aqar-green)] bg-[var(--aqar-green)]/5' : 'border-[var(--aqar-sand-2)]'}`}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--aqar-gold)]/15 text-[var(--aqar-gold)]"><Handshake className="h-5 w-5" /></span>
              <span>
                <span className="block font-bold text-[var(--aqar-kohl)]">وسيط عقاري مرخّص</span>
                <span className="mt-0.5 block text-xs leading-5 text-[var(--aqar-kohl)]/55">أطلب عقاراً لصالح عميلي — تتطلب الخدمة وجود عقد وساطة ساري المفعول مع المشتري</span>
              </span>
            </button>

            {persona === 'Broker' && (
              <div className="space-y-3 rounded-xl border border-[var(--aqar-gold)]/35 bg-[var(--aqar-gold)]/8 p-4">
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <input type="checkbox" className="mt-1" checked={contractConfirmed} onChange={(e) => setContractConfirmed(e.target.checked)} />
                  <span className="leading-6 text-[var(--aqar-kohl)]/85">أُقرّ بوجود <b>عقد وساطة ساري المفعول</b> مع المشتري، وأتحمّل مسؤولية صحة هذا الإقرار.</span>
                </label>
                <button onClick={() => { if (!contractConfirmed) { setErr('يجب تأكيد وجود عقد وساطة مع المشتري للمتابعة.'); return } setErr(''); setStep(1) }} className="aqar-btn w-full">متابعة</button>
              </div>
            )}
          </div>
        )}

        {/* STEP 1 — contact + broker credentials */}
        {step === 1 && (
          <div className="space-y-4">
            <div><label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">الاسم الكامل *</label><input className="inp" value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
            <div><label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">رقم التواصل *</label><PhoneInput value={phone} onChange={setPhone} /></div>
            {persona === 'Broker' && (
              <>
                <div><label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">رخصة فال للوساطة والتسويق العقاري *</label><input className="inp" dir="ltr" value={fal} onChange={(e) => setFal(e.target.value)} /></div>
                <div><label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">رقم عقد الوساطة (اختياري)</label><input className="inp" dir="ltr" value={contractNo} onChange={(e) => setContractNo(e.target.value)} /></div>
              </>
            )}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setStep(0)} className="aqar-btn aqar-btn-outline">رجوع</button>
              <button onClick={next1} className="aqar-btn flex-1">التالي: تفاصيل الطلب</button>
            </div>
          </div>
        )}

        {/* STEP 2 — property requirements */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">نوع العقار المطلوب *</label>
                <select className="inp" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">اختر النوع</option>
                  {cats.map((c) => <option key={c.name} value={c.name}>{c.category_name_ar}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">المنطقة *</label>
                <select className="inp" value={region} onChange={(e) => { setRegion(e.target.value); setCity(''); setDistricts([]) }}>
                  <option value="">اختر المنطقة</option>
                  {regions.map((r: any) => <option key={r.name} value={r.name}>{r.region_name_ar}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">المدينة *</label>
                <select className="inp" value={city} onChange={(e) => { setCity(e.target.value); setDistricts([]) }} disabled={!region}>
                  <option value="">اختر المدينة</option>
                  {cities.map((c: any) => <option key={c.name} value={c.name}>{c.city_name_ar}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">الأحياء المفضلة</label>
              <DistrictMultiSelect city={city} value={districts} onChange={setDistricts} />
            </div>

            <div>
              <label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">المساحة المطلوبة (م²)</label>
              <div className="grid grid-cols-2 gap-3">
                <input className="inp" dir="ltr" inputMode="numeric" placeholder="من" value={areaMin} onChange={num(areaMin, setAreaMin)} />
                <input className="inp" dir="ltr" inputMode="numeric" placeholder="إلى" value={areaMax} onChange={num(areaMax, setAreaMax)} />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">الميزانية الإجمالية (ريال)</label>
              <div className="grid grid-cols-2 gap-3">
                <input className="inp" dir="ltr" inputMode="numeric" placeholder="من" value={budgetMin} onChange={num(budgetMin, setBudgetMin)} />
                <input className="inp" dir="ltr" inputMode="numeric" placeholder="إلى" value={budgetMax} onChange={num(budgetMax, setBudgetMax)} />
              </div>
              {(Number(budgetMin) > 0 || Number(budgetMax) > 0) && (
                <p className="mt-1 text-xs text-[var(--aqar-kohl)]/55" dir="rtl">
                  {Number(budgetMin) > 0 && <>من {formatNumber(Number(budgetMin))} </>}
                  {Number(budgetMax) > 0 && <>إلى {formatNumber(Number(budgetMax))} </>}ريال — السعر غير شامل ضريبة التصرفات العقارية والسعي
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">طريقة الشراء *</label>
              <div className="flex gap-2">
                {([['Cash', 'كاش'], ['Bank Financing', 'تمويل بنكي']] as const).map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setPayment(v)} className={`min-h-[44px] flex-1 rounded-xl border px-4 text-sm font-semibold ${payment === v ? 'border-[var(--aqar-green)] bg-[var(--aqar-green)]/10 text-[var(--aqar-green-d)]' : 'border-[var(--aqar-sand-2)] text-[var(--aqar-kohl)]/70'}`}>{l}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">ملاحظات إضافية</label>
              <textarea className="inp" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="أي تفاصيل تساعدنا نلقى طلبك بدقة (اختياري)" />
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setStep(1)} className="aqar-btn aqar-btn-outline">رجوع</button>
              <button onClick={submit} disabled={busy} className="aqar-btn flex-1">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}إرسال الطلب</button>
            </div>
          </div>
        )}

        {/* STEP 3 — done */}
        {step === 3 && (
          <div className="py-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--aqar-green)]/12 text-[var(--aqar-green)]"><Check className="h-8 w-8" /></div>
            <p className="aqar-display text-2xl text-[var(--aqar-green-d)]">استلمنا طلبك ✅</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-7 text-[var(--aqar-kohl)]/65">
              فريقنا يبحث لك عن العقار المناسب ويتواصل معك فور توفّر عروض تطابق طلبك{refId ? <> — رقم طلبك <b dir="ltr">{refId}</b></> : null}.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link href="/search" className="aqar-btn">تصفّح العروض الحالية</Link>
              <Link href="/interest" className="aqar-btn aqar-btn-outline">سجّل اهتمامك أيضاً</Link>
            </div>
            <a href={SUPPORT_WA} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--aqar-green)] hover:underline"><MessageCircle className="h-4 w-4" />تحتاج مساعدة؟ راسلنا على واتساب</a>
          </div>
        )}
      </div>

      {step < 3 && (
        <p className="aqar-seal mt-4 flex items-start gap-2 p-3 text-xs leading-6 text-[var(--aqar-kohl)]/75">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--aqar-green)]" />
          بياناتك تُستخدم فقط لتلبية طلبك العقاري ولا تُشارك مع أي طرف خارج فريق تمكين العقارية ووسطائها المرخّصين.
        </p>
      )}

      <style jsx>{`:global(.aqar-store .inp){width:100%;min-height:48px;border:1px solid var(--aqar-sand-2);border-radius:0.75rem;padding:0.7rem 0.85rem;font-size:1rem;outline:none;background:var(--aqar-surface);color:var(--aqar-kohl)}:global(.aqar-store .inp:focus){border-color:var(--aqar-green)}`}</style>
    </div>
  )
}
