'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

/** Digits only, capped at 4 (HHMM) — what survives filtering a keystroke. */
export function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 4)
}

/** While typing: digits only, ':' auto-inserted once a 3rd digit exists —
 *  not at exactly 2, or Backspace could never delete past it (it would just
 *  put the ':' right back). Matches Apex's handleTimeInput. */
export function formatTypingValue(raw: string): string {
  const digits = digitsOnly(raw)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}:${digits.slice(2)}`
}

/**
 * On blur: no digits typed -> '' (empty, shown as «_»); otherwise group
 * whatever digits were typed into 'HH:MM' — 1 digit H -> 0H:00, 2 digits HH
 * -> HH:00, 3 digits HMM -> 0H:MM, 4 digits HHMM -> HH:MM. Doesn't clamp
 * out-of-range results — isValidHHMM flags those instead of "fixing" them.
 */
export function normalizeTimeInput(raw: string): string {
  const digits = digitsOnly(raw)
  if (!digits) return ''
  if (digits.length === 1) return `0${digits}:00`
  if (digits.length === 2) return `${digits}:00`
  if (digits.length === 3) return `0${digits[0]}:${digits.slice(1)}`
  return `${digits.slice(0, 2)}:${digits.slice(2)}`
}

/** Strict 00:00–23:59, Latin digits, exactly 'HH:MM'. */
export function isValidHHMM(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

/** Empty is allowed wherever a time is optional — only a non-empty,
 *  out-of-range/malformed value is invalid. */
export function isValidTimeOrEmpty(value: string): boolean {
  return value === '' || isValidHHMM(value)
}

/** Minutes since midnight -> 'HH:MM' (may exceed 24h for an
 *  already-resolved cross-midnight total — see shift-editor/types.ts). */
export function minutesToHHMM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** 'H(H…):MM' -> minutes, or null if not that shape. */
export function hhmmToMinutes(value: string): number | null {
  const m = /^(\d{1,3}):(\d{2})$/.exec(value)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

const BASE_CLASS = 'h-10 w-24 rounded border bg-white text-center text-[16px] text-slate-800 outline-none focus:border-[var(--apex-blue)] disabled:bg-slate-100 disabled:text-slate-400'

export interface TimeInput24Props {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  ariaLabel?: string
  className?: string
}

/**
 * Apex 24h time box (plain text + digit mask — never `type="time"`, which is
 * what brings in the native clock icon and a locale-dependent AM/PM). Commits
 * a normalised 'HH:MM' on blur; an out-of-range result is left as typed and
 * flagged with a red border + aria-invalid (rules.ts's V2 blocks saving it).
 */
export function TimeInput24({ value, onChange, disabled, ariaLabel, className }: TimeInput24Props) {
  const [draft, setDraft] = useState<string | null>(null)
  const displayValue = draft !== null ? draft : (value === '' ? '_' : value)
  const invalid = draft === null && value !== '' && !isValidHHMM(value)

  return (
    <input
      type="text"
      inputMode="numeric"
      dir="ltr"
      maxLength={5}
      aria-label={ariaLabel}
      aria-invalid={invalid}
      disabled={disabled}
      value={displayValue}
      onFocus={() => setDraft(value)}
      onChange={(e) => setDraft(formatTypingValue(e.target.value))}
      onBlur={() => {
        const normalized = normalizeTimeInput(draft ?? '')
        setDraft(null)
        if (normalized !== value) onChange(normalized)
      }}
      className={cn(BASE_CLASS, invalid ? 'border-red-500' : 'border-[var(--apex-border)]', className)}
    />
  )
}

export interface DurationInputProps {
  value: number | ''
  onChange: (value: number | '') => void
  disabled?: boolean
  ariaLabel?: string
  className?: string
}

/** The same 24h box, edited as HH:MM but holding a plain minute count —
 *  grace periods (D5) and open-shift required hours (D8) both store minutes.
 *  An out-of-range blur (e.g. 00:75) must not be silently re-read into some
 *  other minute count — it stays on screen as typed, red, until fixed, and
 *  is reported upward as NaN so rules.ts can block saving with V2. */
export function DurationInput({ value, onChange, ...rest }: DurationInputProps) {
  const [invalidText, setInvalidText] = useState<string | null>(null)
  const displayValue = invalidText !== null ? invalidText : (value === '' ? '' : minutesToHHMM(Number(value)))
  return (
    <TimeInput24
      value={displayValue}
      onChange={(hhmm) => {
        if (hhmm !== '' && !isValidHHMM(hhmm)) { setInvalidText(hhmm); onChange(NaN); return }
        setInvalidText(null)
        onChange(hhmm === '' ? '' : (hhmmToMinutes(hhmm) ?? ''))
      }}
      {...rest}
    />
  )
}
