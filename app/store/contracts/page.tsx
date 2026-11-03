'use client'

import { useEffect, useState } from 'react'
import { realEstateApi } from '@/lib/real-estate-api'
import { hijriDate, gregorianDate } from '@/lib/aqar-format'
import PhoneInput, { isValidIntlPhone } from '@/components/store/phone-input'
import { Check, Loader2, MessageCircle, FileText, Home, Building2, Tag, Handshake, Paperclip, X } from 'lucide-react'

const SUPPORT_WA = 'https://wa.me/966553275000?text=السلام%20عليكم،%20أحتاج%20مساعدة%20في%20طلب%20إعداد%20عقد'
const DRAFT_KEY = 'aqar_contract_draft'
const STEPS = ['نوع العقد', 'مقدّم الطلب', 'تفاصيل العقد', 'تم']

type CType = 'Residential Rent' | 'Commercial Rent' | 'Sale' | 'Brokerage'
const TYPES: { id: CType; label: string; hint: string; icon: any }[] = [
  { id: 'Residential Rent', label: 'إيجار سكني', hint: 'أفراد — معفى من الضريبة', icon: Home },
  { id: 'Commercial Rent', label: 'إيجار تجاري', hint: 'المستأجر منشأة — ضريبة 15%', icon: Building2 },
  { id: 'Sale', label: 'بيع', hint: 'نقل ملكية عقار', icon: Tag },
  { id: 'Brokerage', label: 'وساطة / تسويق', hint: 'تفويض وسيط عقاري', icon: Handshake },
]

type Field = { key: string; label: string; t?: 'text' | 'num' | 'date' | 'select' | 'textarea' | 'phone'; opts?: string[] }
type Section = { title: string; fields: Field[] }

const FIELDSETS: Record<CType, Section[]> = {
  'Residential Rent': [
    { title: 'المؤجر (المالك)', fields: [
      { key: 'rl_name', label: 'الاسم' }, { key: 'rl_nat', label: 'الجنسية' }, { key: 'rl_id', label: 'رقم الهوية' },
      { key: 'rl_phone', label: 'الجوال', t: 'phone' }, { key: 'rl_iban', label: 'الآيبان (IBAN)' },
      { key: 'rl_agent', label: 'الوكيل (إن وجد)' }, { key: 'rl_agency', label: 'رقم الوكالة' },
      { key: 'rl_addr', label: 'العنوان الوطني', t: 'textarea' },
    ] },
    { title: 'المستأجر', fields: [
      { key: 'rt_name', label: 'الاسم' }, { key: 'rt_nat', label: 'الجنسية' }, { key: 'rt_id', label: 'رقم الهوية' },
      { key: 'rt_phone', label: 'الجوال', t: 'phone' }, { key: 'rt_addr', label: 'العنوان الوطني', t: 'textarea' },
    ] },
    { title: 'العقار', fields: [
      { key: 'rp_type', label: 'نوع العقار' }, { key: 'rp_addr', label: 'العنوان' }, { key: 'rp_meter', label: 'رقم عداد الكهرباء' },
    ] },
    { title: 'بيانات العقد', fields: [
      { key: 'rc_start', label: 'تاريخ البداية', t: 'date' }, { key: 'rc_end', label: 'تاريخ النهاية', t: 'date' },
      { key: 'rc_rent', label: 'قيمة الإيجار', t: 'num' }, { key: 'rc_period', label: 'نوع الإيجار', t: 'select', opts: ['سنوي', 'شهري'] },
      { key: 'rc_payments', label: 'عدد الدفعات', t: 'num' }, { key: 'rc_schedule', label: 'طريقة ومواعيد السداد' },
      { key: 'rc_deposit', label: 'قيمة التأمين / الضمان', t: 'num' }, { key: 'rc_deposit_terms', label: 'شروط استرداد التأمين', t: 'textarea' },
      { key: 'rc_ejar', label: 'رقم عقد إيجار (منصة إيجار)' },
    ] },
  ],
  'Commercial Rent': [
    { title: 'المؤجر (فرد / منشأة)', fields: [
      { key: 'cl_name', label: 'الاسم / المنشأة' }, { key: 'cl_id', label: 'رقم الهوية / السجل' }, { key: 'cl_phone', label: 'الجوال', t: 'phone' },
      { key: 'cl_vat', label: 'الرقم الضريبي' }, { key: 'cl_iban', label: 'الآيبان (IBAN)' }, { key: 'cl_addr', label: 'العنوان الوطني', t: 'textarea' },
    ] },
    { title: 'المستأجر (منشأة)', fields: [
      { key: 'ct_company', label: 'اسم المنشأة' }, { key: 'ct_cr', label: 'السجل التجاري' }, { key: 'ct_unified', label: 'الرقم الموحّد' },
      { key: 'ct_vat', label: 'الرقم الضريبي' }, { key: 'ct_rep_name', label: 'الممثل — الاسم' }, { key: 'ct_rep_id', label: 'الممثل — الهوية' },
      { key: 'ct_rep_phone', label: 'الممثل — الجوال', t: 'phone' }, { key: 'ct_addr', label: 'العنوان الوطني', t: 'textarea' },
    ] },
    { title: 'العقار', fields: [
      { key: 'cp_type', label: 'نوع العقار' }, { key: 'cp_addr', label: 'العنوان' }, { key: 'cp_meter', label: 'رقم عداد الكهرباء' },
    ] },
    { title: 'بيانات العقد', fields: [
      { key: 'cc_start', label: 'تاريخ البداية', t: 'date' }, { key: 'cc_end', label: 'تاريخ النهاية', t: 'date' },
      { key: 'cc_rent', label: 'قيمة الإيجار السنوي', t: 'num' }, { key: 'cc_payments', label: 'عدد الدفعات', t: 'num' },
      { key: 'cc_vat_pct', label: 'نسبة الضريبة %', t: 'num' }, { key: 'cc_deposit', label: 'قيمة التأمين / الضمان', t: 'num' },
      { key: 'cc_ejar', label: 'رقم عقد إيجار (منصة إيجار)' },
    ] },
  ],
  'Sale': [
    { title: 'البائع', fields: [
      { key: 's_seller_name', label: 'الاسم' }, { key: 's_seller_id', label: 'رقم الهوية' }, { key: 's_seller_phone', label: 'الجوال', t: 'phone' },
      { key: 's_seller_iban', label: 'الآيبان (IBAN)' }, { key: 's_seller_agent', label: 'الوكيل (إن وجد)' }, { key: 's_seller_agency', label: 'رقم الوكالة' },
    ] },
    { title: 'المشتري', fields: [
      { key: 's_buyer_name', label: 'الاسم' }, { key: 's_buyer_id', label: 'رقم الهوية' }, { key: 's_buyer_phone', label: 'الجوال', t: 'phone' },
    ] },
    { title: 'العقار', fields: [
      { key: 's_location', label: 'الموقع (مدينة / حي / المخطط)' }, { key: 's_plot', label: 'رقم القطعة' },
      { key: 's_deed_no', label: 'رقم الصك' }, { key: 's_deed_date', label: 'تاريخ الصك', t: 'date' },
      { key: 's_area', label: 'المساحة (م²)', t: 'num' }, { key: 's_type', label: 'نوع العقار', t: 'select', opts: ['سكني', 'تجاري', 'زراعي'] },
      { key: 's_bounds', label: 'الحدود الأربعة', t: 'textarea' }, { key: 's_mortgaged', label: 'حالة الرهن (مرهون؟)', t: 'select', opts: ['لا', 'نعم'] },
    ] },
    { title: 'المالية', fields: [
      { key: 's_price', label: 'سعر البيع (ر.س)', t: 'num' }, { key: 's_pay_method', label: 'طريقة الدفع', t: 'select', opts: ['نقد', 'تحويل', 'أقساط', 'تمويل'] },
      { key: 's_due', label: 'تاريخ الاستحقاق', t: 'date' }, { key: 's_tax_ref', label: 'الرقم المرجعي لضريبة التصرفات (إن وجد)' },
    ] },
  ],
  'Brokerage': [
    { title: 'الوسيط', fields: [
      { key: 'b_broker_name', label: 'الاسم / المنشأة' }, { key: 'b_broker_phone', label: 'الجوال', t: 'phone' },
    ] },
    { title: 'العميل المستفيد', fields: [
      { key: 'b_client_name', label: 'الاسم' }, { key: 'b_client_phone', label: 'الجوال', t: 'phone' },
      { key: 'b_client_agent', label: 'الوكيل (إن وجد)' }, { key: 'b_client_agency', label: 'رقم الوكالة' },
    ] },
    { title: 'العقار محل التعاقد', fields: [
      { key: 'b_prop_type', label: 'نوع العقار' }, { key: 'b_prop_addr', label: 'العنوان' },
    ] },
    { title: 'التفويض', fields: [
      { key: 'b_commission', label: 'نسبة أو مبلغ العمولة (مرجعيًا 2.5%)' }, { key: 'b_start', label: 'بداية مدة العقد', t: 'date' },
      { key: 'b_end', label: 'نهاية مدة العقد', t: 'date' }, { key: 'b_auth', label: 'نوع التفويض', t: 'select', opts: ['حصري', 'غير حصري'] },
      { key: 'b_deal', label: 'نوع الصفقة', t: 'select', opts: ['بيع', 'إيجار'] },
    ] },
  ],
}

const fileToData = (file: File) => new Promise<string>((res, rej) => {
  const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file)
})

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [cal, setCal] = useState<'g' | 'h'>('g')
  return (
    <div>
      <label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">{label}</label>
      <input type="date" dir="ltr" className="inp" value={value} onChange={(e) => onChange(e.target.value)} />
      {value ? (
        <p className="mt-1 flex items-center gap-2 text-xs text-[var(--aqar-kohl)]/55">
          <button type="button" onClick={() => setCal((c) => (c === 'g' ? 'h' : 'g'))} className="rounded-full border border-[var(--aqar-sand-2)] px-2 py-0.5 font-medium text-[var(--aqar-green-d)]">
            {cal === 'g' ? 'عرض هجري' : 'عرض ميلادي'}
          </button>
          <span>{cal === 'g' ? `${gregorianDate(value)} م` : `${hijriDate(value)} هـ`}</span>
        </p>
      ) : null}
    </div>
  )
}

export default function ContractsPage() {
  const [type, setType] = useState<CType | ''>('')
  const [step, setStep] = useState(0)
  const [shared, setShared] = useState({ applicant_name: '', applicant_phone: '', preferred_channel: '', notes: '', terms: '' })
  const [fv, setFv] = useState<Record<string, string>>({})
  const [linked, setLinked] = useState('')
  const [file, setFile] = useState<{ name: string; data: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)
  const [refId, setRefId] = useState('')
  const [hasDraft, setHasDraft] = useState(false)

  // Restore-draft detection
  useEffect(() => {
    try { if (localStorage.getItem(DRAFT_KEY)) setHasDraft(true) } catch { /* */ }
  }, [])
  // Auto-save draft (fields only; never the attachment payload)
  useEffect(() => {
    try {
      if (type || shared.applicant_name || shared.applicant_phone) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ type, shared, fv, linked }))
      }
    } catch { /* */ }
  }, [type, shared, fv, linked])

  const restoreDraft = () => {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}')
      if (d.type) setType(d.type)
      if (d.shared) setShared(d.shared)
      if (d.fv) setFv(d.fv)
      if (d.linked) setLinked(d.linked)
      if (d.type) setStep(1)
      setHasDraft(false)
    } catch { /* */ }
  }
  const discardDraft = () => { try { localStorage.removeItem(DRAFT_KEY) } catch { /* */ }; setHasDraft(false) }

  const set = (k: keyof typeof shared, v: string) => setShared((s) => ({ ...s, [k]: v }))
  const setField = (k: string, v: string) => setFv((f) => ({ ...f, [k]: v }))

  const pickType = (t: CType) => { setType(t); setStep(1); setErr('') }

  const next1 = () => {
    if (!shared.applicant_name.trim()) return setErr('من فضلك أدخل اسمك.')
    if (!isValidIntlPhone(shared.applicant_phone)) return setErr('من فضلك أدخل رقم جوال صحيح.')
    if (!shared.preferred_channel) return setErr('اختر طريقة التواصل المفضّلة.')
    setErr(''); setStep(2)
  }

  const onFile = async (f: File | null) => {
    if (!f) return setFile(null)
    try { setFile({ name: f.name, data: await fileToData(f) }) } catch { /* */ }
  }

  const submit = async () => {
    if (!shared.notes.trim()) return setErr('من فضلك اكتب ملاحظاتك / تفاصيل طلبك.')
    setBusy(true); setErr('')
    // Build the type-specific details, keyed by "section — label" for the team to read.
    const details: Record<string, string> = {}
    for (const sec of FIELDSETS[type as CType] || []) {
      for (const f of sec.fields) {
        const v = (fv[f.key] || '').trim()
        if (v) details[`${sec.title} — ${f.label}`] = v
      }
    }
    try {
      const r = await realEstateApi.submitContractRequest({
        contract_type: type as string,
        applicant_name: shared.applicant_name.trim(),
        applicant_phone: shared.applicant_phone.trim(),
        preferred_channel: shared.preferred_channel,
        notes: shared.notes.trim(),
        terms: shared.terms.trim() || undefined,
        linked_listing: linked || undefined,
        details: Object.keys(details).length ? JSON.stringify(details) : undefined,
        attachment: file?.data,
        attachment_filename: file?.name,
      })
      setRefId(r.name || '')
      setDone(true)
      try { localStorage.removeItem(DRAFT_KEY) } catch { /* */ }
      setStep(3)
    } catch (e: any) {
      setErr(e?.message || 'تعذّر إرسال الطلب، حاول مرة أخرى.')
    } finally {
      setBusy(false)
    }
  }

  const renderField = (f: Field) => {
    if (f.t === 'date') return <DateField key={f.key} label={f.label} value={fv[f.key] || ''} onChange={(v) => setField(f.key, v)} />
    if (f.t === 'phone') {
      return (
        <div key={f.key}>
          <label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">{f.label}</label>
          <PhoneInput value={fv[f.key] || ''} onChange={(v) => setField(f.key, v)} />
        </div>
      )
    }
    return (
      <div key={f.key}>
        <label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">{f.label}</label>
        {f.t === 'textarea' ? (
          <textarea className="inp" rows={2} value={fv[f.key] || ''} onChange={(e) => setField(f.key, e.target.value)} />
        ) : f.t === 'select' ? (
          <select className="inp" value={fv[f.key] || ''} onChange={(e) => setField(f.key, e.target.value)}>
            <option value="">—</option>
            {(f.opts || []).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input className="inp" inputMode={f.t === 'num' ? 'numeric' : undefined} value={fv[f.key] || ''} onChange={(e) => setField(f.key, e.target.value)} />
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="aqar-display mb-2 flex items-center gap-2 text-3xl text-[var(--aqar-green-d)]"><FileText className="h-7 w-7" />إدارة العقود</h1>
      <p className="mb-1 text-[var(--aqar-kohl)]/70">املأ اللي عندك، وفريقنا يكمّل الباقي معاك.</p>
      <p className="mb-6 text-sm text-[var(--aqar-kohl)]/50">نستقبل طلبك ونتواصل معك لإعداد العقد رسميًا (إيجار عبر منصة إيجار، البيع عبر ناجز/كاتب العدل، الوساطة عبر الهيئة العامة للعقار).</p>

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

      {hasDraft && step < 3 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--aqar-green)]/30 bg-[var(--aqar-green)]/5 p-3 text-sm">
          <span className="flex-1 text-[var(--aqar-kohl)]/80">لديك طلب محفوظ — هل تريد استكماله؟</span>
          <button onClick={restoreDraft} className="rounded-full bg-[var(--aqar-green)] px-4 py-2 text-sm font-bold text-white">استرجاع</button>
          <button onClick={discardDraft} className="rounded-full border border-[var(--aqar-sand-2)] px-4 py-2 text-sm text-[var(--aqar-kohl)]/70">تجاهل</button>
        </div>
      )}

      <div className="aqar-card p-5">
        {/* STEP 0 — type selector */}
        {step === 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {TYPES.map((t) => (
              <button key={t.id} onClick={() => pickType(t.id)} className="flex min-h-[88px] items-start gap-3 rounded-2xl border-2 border-[var(--aqar-sand-2)] p-4 text-start hover:border-[var(--aqar-green)] hover:bg-[var(--aqar-green)]/5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--aqar-green)]/10 text-[var(--aqar-green-d)]"><t.icon className="h-5 w-5" /></span>
                <span><span className="block font-bold text-[var(--aqar-kohl)]">{t.label}</span><span className="mt-0.5 block text-xs text-[var(--aqar-kohl)]/55">{t.hint}</span></span>
              </button>
            ))}
          </div>
        )}

        {/* STEP 1 — applicant essentials (shared) */}
        {step === 1 && (
          <div className="space-y-4">
            <div><label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">الاسم *</label><input className="inp" value={shared.applicant_name} onChange={(e) => set('applicant_name', e.target.value)} /></div>
            <div><label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">الجوال *</label><PhoneInput value={shared.applicant_phone} onChange={(v) => set('applicant_phone', v)} /></div>
            <div>
              <label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">طريقة التواصل المفضّلة *</label>
              <div className="flex gap-2">
                {[['WhatsApp', 'واتساب'], ['Phone', 'اتصال']].map(([v, l]) => (
                  <button key={v} type="button" onClick={() => set('preferred_channel', v)} className={`min-h-[44px] flex-1 rounded-xl border px-4 text-sm font-semibold ${shared.preferred_channel === v ? 'border-[var(--aqar-green)] bg-[var(--aqar-green)]/10 text-[var(--aqar-green-d)]' : 'border-[var(--aqar-sand-2)] text-[var(--aqar-kohl)]/70'}`}>{l}</button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setStep(0)} className="aqar-btn aqar-btn-outline">رجوع</button>
              <button onClick={next1} className="aqar-btn flex-1">التالي</button>
            </div>
          </div>
        )}

        {/* STEP 2 — type-specific details + optional links + notes */}
        {step === 2 && type && (
          <div className="space-y-6">
            {FIELDSETS[type].map((sec) => (
              <div key={sec.title}>
                <h3 className="mb-3 border-b border-[var(--aqar-sand-2)] pb-1 font-bold text-[var(--aqar-green-d)]">{sec.title}</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {sec.fields.map((f) => (
                    <div key={f.key} className={f.t === 'textarea' ? 'sm:col-span-2' : ''}>{renderField(f)}</div>
                  ))}
                </div>
              </div>
            ))}

            <div>
              <h3 className="mb-3 border-b border-[var(--aqar-sand-2)] pb-1 font-bold text-[var(--aqar-green-d)]">معلومات إضافية</h3>
              <div className="space-y-3">
                <div><label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">ربط بعقار مسجّل (اختياري)</label><input className="inp" placeholder="رقم الإعلان إن وجد (مثل AQAR-00123)" value={linked} onChange={(e) => setLinked(e.target.value)} /></div>
                <div>
                  <label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">إرفاق ملف (اختياري — PDF أو صورة)</label>
                  {file ? (
                    <div className="flex items-center gap-2 rounded-xl border border-[var(--aqar-sand-2)] p-2 text-sm"><Paperclip className="h-4 w-4 text-[var(--aqar-green)]" /><span className="flex-1 truncate">{file.name}</span><button onClick={() => setFile(null)} className="text-[var(--aqar-kohl)]/50"><X className="h-4 w-4" /></button></div>
                  ) : (
                    <label className="flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--aqar-sand-2)] text-sm text-[var(--aqar-kohl)]/60 hover:border-[var(--aqar-green)]"><Paperclip className="h-4 w-4" />اختر ملفًا<input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] || null)} /></label>
                  )}
                </div>
                <div><label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">ملاحظات *</label><textarea className="inp" rows={3} value={shared.notes} onChange={(e) => set('notes', e.target.value)} placeholder="اكتب أي تفاصيل أو طلبات خاصة…" /></div>
                <div><label className="mb-1 block text-sm text-[var(--aqar-kohl)]/70">الشروط (اختياري)</label><textarea className="inp" rows={2} value={shared.terms} onChange={(e) => set('terms', e.target.value)} /></div>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="aqar-btn aqar-btn-outline">رجوع</button>
              <button onClick={submit} disabled={busy} className="aqar-btn flex-1 inline-flex items-center justify-center gap-2 disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}إرسال الطلب</button>
            </div>
          </div>
        )}

        {/* STEP 3 — success */}
        {step === 3 && done && (
          <div className="py-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--aqar-green)]/12 text-[var(--aqar-green)]"><Check className="h-8 w-8" /></div>
            <p className="aqar-display text-2xl text-[var(--aqar-green-d)]">تم استلام طلبك، هنتواصل معك قريبًا</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-7 text-[var(--aqar-kohl)]/65">فريقنا سيراجع طلبك ويتواصل معك لإكمال إعداد العقد رسميًا.{refId ? ` رقم الطلب: ${refId}` : ''}</p>
            <a href={SUPPORT_WA} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#1FA855] px-5 py-2.5 text-sm font-semibold text-white"><MessageCircle className="h-4 w-4" />تواصل عبر واتساب</a>
          </div>
        )}
      </div>

      {/* Assisted option */}
      {step < 3 && (
        <a href={SUPPORT_WA} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-[#1FA855]/30 bg-[#1FA855]/5 px-4 py-3 text-sm font-medium text-[var(--aqar-green-d)] hover:bg-[#1FA855]/10">
          <MessageCircle className="h-5 w-5 text-[#1FA855]" />تحتاج مساعدة؟ راسلنا على واتساب ونكمّل الطلب معك
        </a>
      )}

      <style jsx>{`:global(.aqar-store .inp){width:100%;min-height:48px;border:1px solid var(--aqar-sand-2);border-radius:0.75rem;padding:0.7rem 0.85rem;font-size:1rem;outline:none;background:var(--aqar-surface);color:var(--aqar-kohl)}:global(.aqar-store .inp:focus){border-color:var(--aqar-green)}`}</style>
    </div>
  )
}
