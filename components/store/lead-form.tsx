'use client'

import { useState, type FormEvent } from 'react'
import { Loader2, Check } from 'lucide-react'
import { realEstateApi } from '@/lib/real-estate-api'
import PhoneInput, { isValidIntlPhone } from '@/components/store/phone-input'

const INPUT =
  'w-full rounded-xl border border-[var(--aqar-sand-2)] bg-[var(--aqar-surface)] px-3 py-2.5 text-sm text-[var(--aqar-kohl)] outline-none focus:border-[var(--aqar-green)]'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// value stored on the lead ↔ label shown to the user (times mirror the team's actual reach hours)
const CONTACT_TIMES = [
  { value: '', label: 'وقت التواصل المفضّل (اختياري)' },
  { value: 'صباحاً', label: 'صباحاً (٧ص – ١٢م)' },
  { value: 'مساءً', label: 'مساءً (٤م – ١٠م)' },
  { value: 'أي وقت', label: 'أي وقت' },
]

export default function LeadForm({
  topic,
  compact = false,
  submitLabel = 'إرسال',
  intent,
  intents,
  showName,
  showMessage,
  requireName = false,
  nameLabel = 'الاسم',
  namePlaceholder = 'اسمك (اختياري)',
  messageLabel = 'رسالتك',
  messagePlaceholder = 'أخبرنا باحتياجك (اختياري)',
  successText = 'سنتواصل معك فور توفّر الخدمة. شكراً لاهتمامك.',
  showContactTime = true,
}: {
  topic: 'Auctions' | 'Property Management' | 'Investment' | 'Other'
  /** compact = a tight "notify me" (contact + channel only); full = name + message too. */
  compact?: boolean
  submitLabel?: string
  /** Fixed intent recorded on the lead (e.g. "Partner"). Ignored if `intents` is provided. */
  intent?: string
  /** Render an intent toggle; the selected value is recorded on the lead. */
  intents?: { value: string; label: string }[]
  showName?: boolean
  showMessage?: boolean
  requireName?: boolean
  nameLabel?: string
  namePlaceholder?: string
  messageLabel?: string
  messagePlaceholder?: string
  successText?: string
  showContactTime?: boolean
}) {
  const wantName = showName ?? !compact
  const wantMessage = showMessage ?? !compact
  const [leadName, setLeadName] = useState('')
  const [contact, setContact] = useState('')
  const [channel, setChannel] = useState('WhatsApp')
  const [contactTime, setContactTime] = useState('')
  const [message, setMessage] = useState('')
  const [picked, setPicked] = useState(intents?.[0]?.value || '')
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!contact.trim()) {
      setError('يرجى إدخال وسيلة تواصل')
      setState('error')
      return
    }
    if (channel === 'Email' ? !EMAIL_RE.test(contact.trim()) : !isValidIntlPhone(contact)) {
      setError(channel === 'Email' ? 'أدخل بريداً إلكترونياً صحيحاً' : 'أدخل رقم جوال صحيح')
      setState('error')
      return
    }
    if (requireName && !leadName.trim()) {
      setError('يرجى إدخال الاسم')
      setState('error')
      return
    }
    setState('loading')
    setError('')
    try {
      await realEstateApi.submitLead({
        topic,
        intent: intents ? picked : intent,
        lead_name: leadName.trim() || undefined,
        contact: contact.trim(),
        channel,
        contact_time: contactTime || undefined,
        message: message.trim() || undefined,
      })
      setState('done')
    } catch {
      setError('تعذّر الإرسال، يرجى المحاولة مرة أخرى')
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--aqar-green)]/40 bg-[var(--aqar-green)]/5 p-5 text-start">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--aqar-green)] text-white">
          <Check className="h-5 w-5" />
        </span>
        <div>
          <p className="font-semibold text-[var(--aqar-green-d)]">تم استلام طلبك</p>
          <p className="text-sm text-[var(--aqar-kohl)]/70">{successText}</p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 text-start">
      {intents && intents.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {intents.map((it) => (
            <button
              key={it.value}
              type="button"
              onClick={() => setPicked(it.value)}
              aria-pressed={picked === it.value}
              className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${picked === it.value
                ? 'border-[var(--aqar-green)] bg-[var(--aqar-green)]/10 text-[var(--aqar-green-d)]'
                : 'border-[var(--aqar-sand-2)] text-[var(--aqar-kohl)]/70 hover:border-[var(--aqar-green)]/40'}`}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}

      {wantName && (
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--aqar-kohl)]">{nameLabel}</label>
          <input className={INPUT} value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder={namePlaceholder} />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--aqar-kohl)]">وسيلة التواصل</label>
          {channel === 'Email' ? (
            <input
              className={INPUT}
              dir="ltr"
              type="email"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="البريد الإلكتروني"
              inputMode="email"
            />
          ) : (
            <PhoneInput value={contact} onChange={setContact} />
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--aqar-kohl)]">القناة المفضّلة</label>
          <select
            className={INPUT}
            value={channel}
            onChange={(e) => {
              const next = e.target.value
              // phone ↔ email hold different value shapes — clear so the input never shows a mismatched value
              if ((next === 'Email') !== (channel === 'Email')) setContact('')
              setChannel(next)
            }}
          >
            <option value="WhatsApp">واتساب</option>
            <option value="Phone">اتصال</option>
            <option value="Email">بريد إلكتروني</option>
          </select>
        </div>
      </div>

      {showContactTime && (
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--aqar-kohl)]">وقت التواصل المفضّل</label>
          <select className={INPUT} value={contactTime} onChange={(e) => setContactTime(e.target.value)}>
            {CONTACT_TIMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      )}

      {wantMessage && (
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--aqar-kohl)]">{messageLabel}</label>
          <textarea className={INPUT} rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={messagePlaceholder} />
        </div>
      )}

      {state === 'error' && <p className="text-sm text-[var(--aqar-clay)]">{error}</p>}

      <button type="submit" className="aqar-btn w-full sm:w-auto" disabled={state === 'loading'}>
        {state === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {submitLabel}
      </button>
    </form>
  )
}
