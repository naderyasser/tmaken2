'use client'

/**
 * PUBLIC (no-login) QR letter-verification page.
 *
 * Reachable at /letter-verify/<token> without a session — whitelisted in
 * middleware `publicPaths`. Opened by scanning the QR code stamped on HR
 * letter PDFs. Self-contained like /proposal/[token]: no I18nProvider, no
 * shared components — the card shows BOTH Arabic and English labels together
 * (RTL-first), so no locale toggle is needed.
 *
 * Backend (guest-accessible):
 *   GET /api/method/base_meena.hr_requests.letter_api.verify_letter?token=...
 *     200 → { message: { valid: true, letter_type, letter_type_ar,
 *                        employee_name, company, issued_on } }
 *     404 / 403 / 429 → invalid, revoked, or throttled.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, ShieldCheck, XCircle } from 'lucide-react'

// ───────────────────────── types (client-safe payload) ─────────────────────────

interface VerifiedLetter {
  valid: boolean
  letter_type?: string
  letter_type_ar?: string
  employee_name?: string
  company?: string
  issued_on?: string
}

// ───────────────────────── helpers ─────────────────────────

/** Frappe wraps whitelisted return values in { message: ... }. */
function unwrap<T>(json: unknown): T {
  if (json && typeof json === 'object' && 'message' in (json as Record<string, unknown>)) {
    return (json as { message: T }).message
  }
  return json as T
}

function formatDate(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  // Dual Hijri + Gregorian, Latin numerals — matches the app convention.
  const hijri = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
  const greg = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
  return `${greg} · ${hijri} هـ`
}

// ───────────────────────── page ─────────────────────────

export default function LetterVerifyPage() {
  const params = useParams<{ token: string }>()
  const token = Array.isArray(params?.token) ? params.token[0] : params?.token

  const [loading, setLoading] = useState(true)
  const [letter, setLetter] = useState<VerifiedLetter | null>(null)

  const verify = useCallback(async () => {
    if (!token) {
      setLetter(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `/api/method/base_meena.hr_requests.letter_api.verify_letter?token=${encodeURIComponent(token)}`,
        { credentials: 'include', headers: { Accept: 'application/json' } },
      )
      if (!res.ok) {
        setLetter(null)
        return
      }
      const json = await res.json()
      const data = unwrap<VerifiedLetter | null>(json)
      setLetter(data && typeof data === 'object' && data.valid ? data : null)
    } catch {
      setLetter(null)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    verify()
  }, [verify])

  // ───────── loading ─────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F9F8]">
        <div className="flex flex-col items-center gap-3 text-[#0E6E62]">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm text-gray-500">جارٍ التحقق… · Verifying…</p>
        </div>
      </div>
    )
  }

  // ───────── invalid / revoked / throttled ─────────
  if (!letter) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-[#F7F9F8] px-4 py-10"
        style={{ fontFamily: 'var(--font-arabic), var(--font-inter), system-ui' }}
      >
        <div dir="rtl" className="w-full max-w-md overflow-hidden rounded-2xl border border-red-100 bg-white text-center shadow-sm">
          <div className="h-1.5 w-full bg-red-300" aria-hidden />
          <div className="p-8">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
              <XCircle className="h-9 w-9 text-red-500" />
            </span>
            <h1 className="mt-5 text-xl font-bold text-gray-800">تعذّر التحقق من هذا الخطاب</h1>
            <p className="mt-1 text-sm text-gray-500">This letter could not be verified</p>
            <p className="mt-5 rounded-lg bg-gray-50 px-4 py-3 text-xs leading-relaxed text-gray-500">
              الرابط غير صالح أو منتهي الصلاحية. للتأكد من صحة الخطاب يرجى التواصل مع الجهة المصدِرة له.
              <br />
              The link is invalid or has expired. To confirm this letter, please contact the issuing company.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ───────── verified ─────────
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-[#F7F9F8] px-4 py-10"
      style={{ fontFamily: 'var(--font-arabic), var(--font-inter), system-ui' }}
    >
      <div dir="rtl" className="w-full max-w-md overflow-hidden rounded-2xl border border-[#0E6E62]/15 bg-white shadow-sm">
        <div className="h-1.5 w-full bg-gradient-to-l from-[#0E6E62] to-[#14877a]" aria-hidden />
        <div className="p-8">
          {/* header */}
          <div className="text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#0E6E62]/10">
              <ShieldCheck className="h-9 w-9 text-[#0E6E62]" />
            </span>
            <h1 className="mt-5 text-xl font-bold text-gray-800">خطاب موثّق</h1>
            <p className="mt-1 text-sm font-medium text-[#0E6E62]">Verified letter</p>
          </div>

          {/* details */}
          <dl className="mt-7 divide-y divide-gray-100 border-y border-gray-100">
            <DetailRow ar="الشركة" en="Company" value={letter.company} />
            <DetailRow
              ar="نوع الخطاب"
              en="Letter type"
              value={letter.letter_type_ar || letter.letter_type}
              sub={letter.letter_type_ar ? letter.letter_type : undefined}
            />
            <DetailRow ar="الموظف" en="Employee name" value={letter.employee_name} />
            <DetailRow ar="تاريخ الإصدار" en="Issued on" value={formatDate(letter.issued_on)} />
          </dl>

          {/* small print */}
          <p className="mt-6 text-center text-[11px] leading-relaxed text-gray-400">
            تم إصدار هذا الخطاب عبر نظام تمكين للموارد البشرية
            <br />
            Issued via the Tamkeen HR system
          </p>
        </div>
      </div>
    </div>
  )
}

// ───────────────────────── small presentational helpers ─────────────────────────

function DetailRow({
  ar,
  en,
  value,
  sub,
}: {
  ar: string
  en: string
  value?: string | null
  sub?: string | null
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5">
      <dt className="shrink-0">
        <span className="block text-sm font-medium text-gray-600">{ar}</span>
        <span className="block text-[11px] text-gray-400">{en}</span>
      </dt>
      <dd className="min-w-0 text-end">
        <span className="block break-words text-sm font-semibold text-gray-800">{value || '—'}</span>
        {sub && <span className="block text-[11px] text-gray-400">{sub}</span>}
      </dd>
    </div>
  )
}
