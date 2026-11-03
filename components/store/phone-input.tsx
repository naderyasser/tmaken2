'use client'

import { useId } from 'react'

/**
 * Multi-country phone input for the storefront (SA + GCC + EG + JO — the same list the
 * backend's _normalize_intake_phone validates). Emits the full E.164 value (+9665XXXXXXXX)
 * through onChange; renders as one bordered field: country selector + national number.
 */

export type PhoneCountry = {
  iso: string
  dial: string
  flag: string
  label: string
  placeholder: string
  /** validation for the national part (after the dial code) */
  pattern: RegExp
  maxLen: number
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: 'SA', dial: '966', flag: '🇸🇦', label: 'السعودية', placeholder: '5XXXXXXXX', pattern: /^5\d{8}$/, maxLen: 9 },
  { iso: 'AE', dial: '971', flag: '🇦🇪', label: 'الإمارات', placeholder: '5XXXXXXXX', pattern: /^5\d{8}$/, maxLen: 9 },
  { iso: 'BH', dial: '973', flag: '🇧🇭', label: 'البحرين', placeholder: '3XXXXXXX', pattern: /^[369]\d{7}$/, maxLen: 8 },
  { iso: 'KW', dial: '965', flag: '🇰🇼', label: 'الكويت', placeholder: '5XXXXXXX', pattern: /^[569]\d{7}$/, maxLen: 8 },
  { iso: 'OM', dial: '968', flag: '🇴🇲', label: 'عُمان', placeholder: '9XXXXXXX', pattern: /^[79]\d{7}$/, maxLen: 8 },
  { iso: 'QA', dial: '974', flag: '🇶🇦', label: 'قطر', placeholder: '5XXXXXXX', pattern: /^[3567]\d{7}$/, maxLen: 8 },
  { iso: 'EG', dial: '20', flag: '🇪🇬', label: 'مصر', placeholder: '1XXXXXXXXX', pattern: /^1\d{9}$/, maxLen: 10 },
  { iso: 'JO', dial: '962', flag: '🇯🇴', label: 'الأردن', placeholder: '7XXXXXXXX', pattern: /^7\d{8}$/, maxLen: 9 },
]

/** Split an E.164-ish value into (country, national). Falls back to SA for bare/local input. */
function splitValue(value: string): { country: PhoneCountry; national: string } {
  const v = (value || '').replace(/[\s\-()]/g, '')
  const digits = v.startsWith('+') ? v.slice(1) : v.startsWith('00') ? v.slice(2) : ''
  if (digits) {
    // dial codes here never prefix each other, so first match wins
    const c = PHONE_COUNTRIES.find((x) => digits.startsWith(x.dial))
    if (c) return { country: c, national: digits.slice(c.dial.length) }
  }
  // bare local input (e.g. a legacy draft "05XXXXXXXX") — treat as Saudi, drop the 0
  const bare = v.replace(/\D/g, '').replace(/^0/, '')
  return { country: PHONE_COUNTRIES[0], national: bare }
}

/** True when the value is a complete, valid number for one of the offered countries. */
export function isValidIntlPhone(value: string): boolean {
  const v = (value || '').replace(/[\s\-()]/g, '')
  if (!v.startsWith('+')) return false
  const digits = v.slice(1)
  const c = PHONE_COUNTRIES.find((x) => digits.startsWith(x.dial))
  return !!c && c.pattern.test(digits.slice(c.dial.length))
}

export default function PhoneInput({
  value,
  onChange,
  placeholder,
  ariaLabel = 'رقم الجوال',
  autoComplete = 'tel',
}: {
  /** E.164 value ('' when empty) */
  value: string
  onChange: (v: string) => void
  placeholder?: string
  ariaLabel?: string
  autoComplete?: string
}) {
  const id = useId()
  const { country, national } = splitValue(value)

  const emit = (dial: string, nat: string) => {
    onChange(nat ? `+${dial}${nat}` : '')
  }

  const onNational = (raw: string) => {
    let nat = raw.replace(/\D/g, '')
    // pasted full international number → re-split instead of mangling
    if (/^(\+|00)/.test(raw.trim())) {
      const s = splitValue(raw.trim())
      emit(s.country.dial, s.national.slice(0, s.country.maxLen))
      return
    }
    if (nat.startsWith('0')) nat = nat.replace(/^0+/, '')
    emit(country.dial, nat.slice(0, country.maxLen))
  }

  return (
    <div
      dir="ltr"
      className="flex w-full items-stretch overflow-hidden rounded-xl border border-[var(--aqar-sand-2)] bg-[var(--aqar-surface)] focus-within:border-[var(--aqar-green)]"
    >
      <select
        aria-label="رمز الدولة"
        value={country.iso}
        onChange={(e) => {
          const c = PHONE_COUNTRIES.find((x) => x.iso === e.target.value) || PHONE_COUNTRIES[0]
          emit(c.dial, national.slice(0, c.maxLen))
        }}
        className="shrink-0 cursor-pointer border-e border-[var(--aqar-sand-2)] bg-[var(--aqar-sand)] px-2 py-3 text-sm text-[var(--aqar-kohl)] outline-none"
      >
        {PHONE_COUNTRIES.map((c) => (
          <option key={c.iso} value={c.iso}>
            {c.flag} +{c.dial}
          </option>
        ))}
      </select>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete={autoComplete}
        aria-label={ariaLabel}
        value={national}
        onChange={(e) => onNational(e.target.value)}
        placeholder={placeholder || country.placeholder}
        className="min-h-[46px] w-full bg-transparent px-3 py-2.5 text-base text-[var(--aqar-kohl)] outline-none placeholder:text-[var(--aqar-kohl)]/35"
      />
    </div>
  )
}
