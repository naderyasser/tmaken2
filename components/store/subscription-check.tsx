'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BadgeCheck, Loader2, ShieldQuestion, TimerOff, Ban } from 'lucide-react'
import { realEstateApi } from '@/lib/real-estate-api'
import PhoneInput, { isValidIntlPhone } from '@/components/store/phone-input'
import { gregorianDate } from '@/lib/aqar-format'

type Result =
  | { kind: 'active'; tier?: string | null; member_type?: string | null; expires_on?: string | null }
  | { kind: 'expired'; expires_on?: string | null }
  | { kind: 'suspended' }
  | { kind: 'none' }

/** Homepage widget: enter a phone → membership/subscription status (paid broker tier groundwork). */
export default function SubscriptionCheck() {
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [result, setResult] = useState<Result | null>(null)

  const check = async () => {
    if (!isValidIntlPhone(phone)) { setErr('أدخل رقم جوال صحيح'); setResult(null); return }
    setErr(''); setBusy(true); setResult(null)
    try {
      const r = await realEstateApi.checkMembership(phone)
      if (!r.found) setResult({ kind: 'none' })
      else if (r.status === 'Active') setResult({ kind: 'active', tier: r.tier, member_type: r.member_type, expires_on: r.expires_on })
      else if (r.status === 'Expired') setResult({ kind: 'expired', expires_on: r.expires_on })
      else setResult({ kind: 'suspended' })
    } catch (e: any) {
      setErr(e?.message || 'تعذّر التحقق، حاول مرة أخرى')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="aqar-card p-5">
      <h2 className="mb-1 flex items-center gap-2 font-bold text-[var(--aqar-green-d)]">
        <ShieldQuestion className="h-5 w-5 text-[var(--aqar-green)]" />تحقق من حالة اشتراكك
      </h2>
      <p className="mb-3 text-sm leading-6 text-[var(--aqar-kohl)]/60">
        عضو معنا كوسيط أو مكتب؟ أدخل رقم جوالك للاطلاع على حالة عضويتك.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex-1"><PhoneInput value={phone} onChange={setPhone} ariaLabel="رقم الجوال للتحقق من الاشتراك" /></div>
        <button onClick={check} disabled={busy} className="aqar-btn sm:w-auto">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}تحقّق
        </button>
      </div>
      {err && <p className="mt-2 text-sm text-[var(--aqar-clay)]">{err}</p>}

      {result?.kind === 'active' && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-[var(--aqar-green)]/35 bg-[var(--aqar-green)]/8 p-3 text-sm">
          <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--aqar-green)]" />
          <div className="text-[var(--aqar-kohl)]/85">
            <b className="text-[var(--aqar-green-d)]">عضويتك فعّالة</b>
            {result.tier ? <> — باقة {result.tier}</> : null}
            {result.member_type ? <> ({result.member_type})</> : null}
            {result.expires_on ? <span className="block text-xs text-[var(--aqar-kohl)]/60">سارية حتى {gregorianDate(result.expires_on)}</span> : null}
          </div>
        </div>
      )}
      {result?.kind === 'expired' && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-[var(--aqar-gold)]/40 bg-[var(--aqar-gold)]/10 p-3 text-sm">
          <TimerOff className="mt-0.5 h-5 w-5 shrink-0 text-[var(--aqar-gold)]" />
          <div className="text-[var(--aqar-kohl)]/85">
            <b>انتهت عضويتك</b>{result.expires_on ? <> بتاريخ {gregorianDate(result.expires_on)}</> : null} —{' '}
            <a href="https://wa.me/966553275000?text=أرغب%20في%20تجديد%20عضويتي%20في%20تمكين%20العقارية" target="_blank" rel="noopener noreferrer" className="font-bold text-[var(--aqar-green)] hover:underline">جدّدها عبر واتساب</a>
          </div>
        </div>
      )}
      {result?.kind === 'suspended' && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-[var(--aqar-clay)]/35 bg-[var(--aqar-clay)]/8 p-3 text-sm">
          <Ban className="mt-0.5 h-5 w-5 shrink-0 text-[var(--aqar-clay)]" />
          <p className="text-[var(--aqar-kohl)]/85"><b>العضوية موقوفة مؤقتاً</b> — تواصل مع فريق الدعم لمعرفة التفاصيل.</p>
        </div>
      )}
      {result?.kind === 'none' && (
        <div className="mt-3 rounded-xl border border-[var(--aqar-sand-2)] bg-[var(--aqar-sand)]/60 p-3 text-sm text-[var(--aqar-kohl)]/75">
          لا يوجد اشتراك مسجّل بهذا الرقم —{' '}
          <Link href="/interest" className="font-bold text-[var(--aqar-green)] hover:underline">سجّل اهتمامك</Link>{' '}
          وسنوافيك عند إطلاق باقات العضوية للوسطاء والمكاتب.
        </div>
      )}
    </div>
  )
}
