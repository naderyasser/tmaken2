'use client'

import React, { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle2, AlertTriangle, UploadCloud } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'

// Self-contained bilingual labels (this public page is outside the app's I18nProvider).
const L = {
  ar: {
    title: 'استكمال بيانات التوظيف', sub: 'يرجى تعبئة بياناتك بدقة',
    company: 'الشركة', full_name: 'الاسم الكامل', id_type: 'نوع الهوية',
    national_id: 'هوية وطنية', iqama: 'إقامة', id_number: 'رقم الهوية',
    dob: 'تاريخ الميلاد', gender: 'الجنس', male: 'ذكر', female: 'أنثى',
    phone: 'رقم الجوال', email: 'البريد الإلكتروني', nationality: 'الجنسية',
    address: 'العنوان', emg_name: 'اسم جهة الطوارئ', emg_phone: 'هاتف الطوارئ',
    photo: 'الصورة الشخصية (اختياري)', submit: 'إرسال', required: 'حقل مطلوب',
    invalid: 'هذا الرابط غير صالح أو منتهي الصلاحية.',
    done_title: 'تم استلام بياناتك', done_sub: 'سيقوم فريق الموارد البشرية بمراجعتها قريبًا.',
    sending: 'جارٍ الإرسال…', loading: 'جارٍ التحميل…', need: 'يرجى تعبئة الحقول المطلوبة',
  },
  en: {
    title: 'Complete your onboarding', sub: 'Please fill in your details accurately',
    company: 'Company', full_name: 'Full name', id_type: 'ID type',
    national_id: 'National ID', iqama: 'Iqama', id_number: 'ID number',
    dob: 'Date of birth', gender: 'Gender', male: 'Male', female: 'Female',
    phone: 'Mobile number', email: 'Email', nationality: 'Nationality',
    address: 'Address', emg_name: 'Emergency contact name', emg_phone: 'Emergency contact phone',
    photo: 'Photo (optional)', submit: 'Submit', required: 'Required',
    invalid: 'This link is invalid or has expired.',
    done_title: 'Your details were received', done_sub: 'HR will review them shortly.',
    sending: 'Sending…', loading: 'Loading…', need: 'Please fill the required fields',
  },
}

function OnboardingForm() {
  const params = useSearchParams()
  const token = params.get('token') || ''
  const [lang, setLang] = useState<'ar' | 'en'>('ar')
  const t = L[lang]
  const isRTL = lang === 'ar'

  const [state, setState] = useState<'loading' | 'form' | 'invalid' | 'done'>('loading')
  const [company, setCompany] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [photoData, setPhotoData] = useState<string | null>(null)
  const [f, setF] = useState({
    full_name: '', id_type: 'Iqama', id_number: '', dob: '', gender: 'Male',
    phone: '', email: '', nationality: '', address: '',
    emergency_contact_name: '', emergency_contact_phone: '',
  })

  useEffect(() => {
    if (!token) { setState('invalid'); return }
    frappeClient.call('base_meena.hr_requests.onboarding.get_onboarding_form', { token })
      .then((r) => {
        const ctx = r?.message
        if (!ctx) { setState('invalid'); return }
        setCompany(ctx.company || '')
        setF((prev) => ({ ...prev, full_name: ctx.full_name || '' }))
        setState('form')
      })
      .catch(() => setState('invalid'))
  }, [token])

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setError('Photo must be under 2 MB'); return }
    const reader = new FileReader()
    reader.onload = () => setPhotoData(reader.result as string)
    reader.readAsDataURL(file)
  }

  const submit = async () => {
    if (!f.full_name || !f.id_number || !f.dob || !f.phone) { setError(t.need); return }
    setSending(true); setError('')
    try {
      await frappeClient.call('base_meena.hr_requests.onboarding.submit_onboarding', {
        token, ...f, photo_data: photoData || undefined,
      })
      setState('done')
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally { setSending(false) }
  }

  const field = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40'
  const label = 'text-xs font-medium text-gray-600 mb-1 block'

  return (
    <main dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gradient-to-b from-blue-50/50 to-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="flex justify-end mb-2">
          <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className="text-xs text-blue-600 hover:underline">
            {lang === 'ar' ? 'English' : 'العربية'}
          </button>
        </div>

        {state === 'loading' && (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center"><Loader2 className="h-6 w-6 animate-spin text-gray-300 mx-auto" /><p className="text-sm text-gray-400 mt-2">{t.loading}</p></div>
        )}

        {state === 'invalid' && (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
            <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
            <p className="text-sm text-gray-600">{t.invalid}</p>
          </div>
        )}

        {state === 'done' && (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
            <h1 className="text-lg font-bold text-gray-900">{t.done_title}</h1>
            <p className="text-sm text-gray-500 mt-1">{t.done_sub}</p>
          </div>
        )}

        {state === 'form' && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h1 className="text-xl font-bold text-gray-900">{t.title}</h1>
            <p className="text-sm text-gray-500 mb-1">{t.sub}</p>
            {company && <p className="text-xs text-blue-600 mb-4">{t.company}: {company}</p>}

            <div className="space-y-3">
              <div><label className={label}>{t.full_name} *</label><input className={field} value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={label}>{t.id_type}</label>
                  <select className={field} value={f.id_type} onChange={(e) => setF({ ...f, id_type: e.target.value })}>
                    <option value="National ID">{t.national_id}</option>
                    <option value="Iqama">{t.iqama}</option>
                  </select>
                </div>
                <div><label className={label}>{t.id_number} *</label><input className={field} value={f.id_number} onChange={(e) => setF({ ...f, id_number: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={label}>{t.dob} *</label><input type="date" className={field} value={f.dob} onChange={(e) => setF({ ...f, dob: e.target.value })} /></div>
                <div><label className={label}>{t.gender}</label>
                  <select className={field} value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}>
                    <option value="Male">{t.male}</option>
                    <option value="Female">{t.female}</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={label}>{t.phone} *</label><input className={field} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
                <div><label className={label}>{t.email}</label><input type="email" className={field} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={label}>{t.nationality}</label><input className={field} value={f.nationality} onChange={(e) => setF({ ...f, nationality: e.target.value })} /></div>
                <div><label className={label}>{t.address}</label><input className={field} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={label}>{t.emg_name}</label><input className={field} value={f.emergency_contact_name} onChange={(e) => setF({ ...f, emergency_contact_name: e.target.value })} /></div>
                <div><label className={label}>{t.emg_phone}</label><input className={field} value={f.emergency_contact_phone} onChange={(e) => setF({ ...f, emergency_contact_phone: e.target.value })} /></div>
              </div>
              <div>
                <label className={label}>{t.photo}</label>
                <label className="flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-500 cursor-pointer hover:border-blue-400">
                  <UploadCloud className="h-4 w-4" /> {photoData ? '✓' : t.photo}
                  <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
                </label>
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}
              <button onClick={submit} disabled={sending} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60">
                {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> {t.sending}</> : t.submit}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<main className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-gray-300" /></main>}>
      <OnboardingForm />
    </Suspense>
  )
}
