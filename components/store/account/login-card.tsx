'use client'

import { useState } from 'react'
import { Loader2, Phone, BadgeCheck, ShieldCheck } from 'lucide-react'
import PhoneInput, { isValidIntlPhone } from '@/components/store/phone-input'
import { accountApi } from '@/lib/account-api'

// Phone-OTP login card (2 steps: phone → code). On success calls onLoggedIn so the parent
// can flip to the dashboard. Mirrors the /post wizard's OTP conventions (.inp/aqar-btn).
export default function LoginCard({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState('')
  const [fullName, setFullName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const send = async () => {
    if (!isValidIntlPhone(phone)) { setErr('أدخل رقم جوال صحيح'); return }
    setBusy(true); setErr('')
    try { await accountApi.requestOtp(phone); setStep('code') }
    catch (e: any) { setErr(e?.message || 'تعذّر إرسال الرمز، حاول مرة أخرى') }
    finally { setBusy(false) }
  }

  const verify = async () => {
    if (!code.trim()) { setErr('أدخل رمز التحقق'); return }
    setBusy(true); setErr('')
    try {
      await accountApi.loginVerify(phone, code.trim(), fullName.trim() || undefined)
      onLoggedIn()
    } catch (e: any) {
      setErr(e?.message || 'رمز غير صحيح')
    } finally { setBusy(false) }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="aqar-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--aqar-green)]/10 text-[var(--aqar-green-d)]"><Phone className="h-5 w-5" /></span>
          <div>
            <h1 className="aqar-display text-xl text-[var(--aqar-green-d)]">تسجيل الدخول</h1>
            <p className="text-xs text-[var(--aqar-kohl)]/60">برقم جوالك — لحفظ مفضّلاتك وبحوثك ومتابعة طلباتك.</p>
          </div>
        </div>

        {err && <div className="mb-3 rounded-xl border border-[var(--aqar-clay)]/30 bg-[var(--aqar-clay)]/5 p-3 text-sm text-[var(--aqar-clay)]">{err}</div>}

        {step === 'phone' ? (
          <div className="space-y-3">
            <label className="block text-sm text-[var(--aqar-kohl)]/70">رقم الجوال</label>
            <PhoneInput value={phone} onChange={setPhone} ariaLabel="رقم الجوال لتسجيل الدخول" />
            <button onClick={send} disabled={busy} className="aqar-btn w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}إرسال رمز التحقق
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm text-[var(--aqar-kohl)]/70">رمز التحقق المرسل إلى جوالك</label>
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} dir="ltr" inputMode="numeric" maxLength={6} placeholder="••••" className="inp text-center text-lg tracking-[0.5em]" />
            <label className="block text-sm text-[var(--aqar-kohl)]/70">اسمك (اختياري)</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="الاسم" className="inp" />
            <button onClick={verify} disabled={busy} className="aqar-btn w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}تأكيد الدخول
            </button>
            <button onClick={() => { setStep('phone'); setCode(''); setErr('') }} className="w-full text-center text-xs font-medium text-[var(--aqar-kohl)]/50 hover:underline">تغيير الرقم</button>
          </div>
        )}
      </div>

      <p className="aqar-seal mt-4 flex items-start gap-2 p-3 text-xs leading-6 text-[var(--aqar-kohl)]/75">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--aqar-green)]" />
        نستخدم رقم جوالك للدخول الآمن فقط. مفضّلاتك وبحوثك المحفوظة تُزامَن مع حسابك لتظهر على كل أجهزتك.
      </p>

      <style jsx>{`:global(.aqar-store .inp){width:100%;min-height:48px;border:1px solid var(--aqar-sand-2);border-radius:0.75rem;padding:0.7rem 0.85rem;font-size:1rem;outline:none;background:var(--aqar-surface);color:var(--aqar-kohl)}:global(.aqar-store .inp:focus){border-color:var(--aqar-green)}`}</style>
    </div>
  )
}
