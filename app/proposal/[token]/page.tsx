'use client'

/**
 * PUBLIC (no-login) Sales Proposal page.
 *
 * Reachable at /proposal/<token> without a session. Whitelisted in middleware
 * `publicPaths`. Self-contained: no I18nProvider, no shared components — text via
 * inline isRTL/Arabic-English ternaries driven by the proposal's `language` field.
 *
 * Backend (guest-accessible):
 *   GET  /api/method/base_meena.sales_proposal.api.get_public_proposal?token=...
 *   POST /api/method/base_meena.sales_proposal.api.accept_proposal
 *   POST /api/method/base_meena.sales_proposal.api.reject_proposal
 *
 * Provider revenue is intentionally NOT part of the client-safe payload.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Download,
  PenLine,
  TrendingDown,
  Clock,
  Wallet,
  X,
  Eraser,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

// ───────────────────────── types (client-safe payload) ─────────────────────────

interface ProposalItem {
  item_name: string
  description?: string
  qty: number
  rate: number
  amount: number
}

interface ProjectionRow {
  period_label: string
  client_savings: number
}

interface PublicProposal {
  title: string
  party_display_name: string
  company: string
  currency: string
  transaction_date: string
  valid_till: string
  language: 'ar' | 'en'
  status: string
  executive_summary?: string
  scope_of_work?: string
  items: ProposalItem[]
  total: number
  additional_discount: number
  vat_rate: number
  vat_amount: number
  grand_total: number
  contract_terms?: string
  requires_signature: boolean
  is_signed: boolean
  accepted_on?: string | null
  client_current_cost?: number
  proposed_cost?: number
  roi_duration_months?: number
  estimated_savings?: number
  savings_percentage?: number
  payback_period_months?: number
  projection_rows?: ProjectionRow[]
  // Optional — only present if backend exposes a guest-safe PDF.
  pdf_path?: string
}

// ───────────────────────── helpers ─────────────────────────

function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null
  const cookies = document.cookie.split(';').map((c) => c.trim())
  const csrfCookie =
    cookies.find((c) => c.startsWith('csrftoken=')) ||
    cookies.find((c) => c.startsWith('csrf_token='))
  return csrfCookie ? decodeURIComponent(csrfCookie.split('=')[1]) : null
}

/** Frappe wraps whitelisted return values in { message: ... }. */
function unwrap<T>(json: unknown): T {
  if (json && typeof json === 'object' && 'message' in (json as Record<string, unknown>)) {
    return (json as { message: T }).message
  }
  return json as T
}

function formatMoney(value: number | null | undefined, currency: string, locale: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return ''
  const n = new Intl.NumberFormat(locale === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
  return `${n} ${currency || 'SAR'}`
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return ''
  return new Intl.NumberFormat('en-US').format(value)
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

// ───────────────────────── signature pad ─────────────────────────

interface SignaturePadHandle {
  toDataURL: () => string
  isEmpty: () => boolean
  clear: () => void
}

function SignaturePad({
  ar,
  onChange,
  clearLabel,
  hint,
}: {
  ar: boolean
  onChange: () => void
  clearLabel: string
  hint: string
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const hasInk = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)

  // Expose imperative handle through the DOM element (read by parent via ref).
  const setupCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas
    if (!canvas) return
    // Scale for crisp lines on HiDPI.
    const ratio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * ratio
    canvas.height = rect.height * ratio
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(ratio, ratio)
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = '#0E6E62'
    }
  }, [])

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    drawing.current = true
    last.current = pos(e)
    canvasRef.current?.setPointerCapture(e.pointerId)
  }

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx || !last.current) return
    const p = pos(e)
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
    if (!hasInk.current) {
      hasInk.current = true
      onChange()
    }
  }

  const end = () => {
    drawing.current = false
    last.current = null
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    hasInk.current = false
    onChange()
  }

  // Attach a tiny handle so the parent can read the data URL / emptiness.
  useEffect(() => {
    const el = canvasRef.current as (HTMLCanvasElement & { __pad?: SignaturePadHandle }) | null
    if (!el) return
    el.__pad = {
      toDataURL: () => (hasInk.current ? el.toDataURL('image/png') : ''),
      isEmpty: () => !hasInk.current,
      clear,
    }
  })

  return (
    <div>
      <div className="relative rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
        <canvas
          ref={setupCanvas}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="h-40 w-full touch-none rounded-lg"
          data-signature-pad="1"
        />
        <button
          type="button"
          onClick={clear}
          className="absolute bottom-2 inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-xs text-gray-600 shadow-sm hover:bg-white"
          style={ar ? { left: 8 } : { right: 8 }}
        >
          <Eraser className="h-3.5 w-3.5" />
          {clearLabel}
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-400">{hint}</p>
    </div>
  )
}

// ───────────────────────── page ─────────────────────────

export default function PublicProposalPage() {
  const params = useParams<{ token: string }>()
  const token = Array.isArray(params?.token) ? params.token[0] : params?.token

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [proposal, setProposal] = useState<PublicProposal | null>(null)

  // sign / decline flow
  const [signOpen, setSignOpen] = useState(false)
  const [declineOpen, setDeclineOpen] = useState(false)
  const [signerName, setSignerName] = useState('')
  const [declineReason, setDeclineReason] = useState('')
  const [hasSignature, setHasSignature] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [actionResult, setActionResult] = useState<'accepted' | 'declined' | null>(null)
  const signatureBoxRef = useRef<HTMLDivElement | null>(null)

  const ar = (proposal?.language || 'ar') === 'ar'
  const dir = ar ? 'rtl' : 'ltr'
  const locale = ar ? 'ar' : 'en'
  const currency = proposal?.currency || 'SAR'
  const t = (a: string, e: string) => (ar ? a : e)

  const fetchProposal = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/method/base_meena.sales_proposal.api.get_public_proposal?token=${encodeURIComponent(token)}`,
        { credentials: 'include', headers: { Accept: 'application/json' } },
      )
      if (res.status === 404 || res.status === 410 || res.status === 403) {
        setProposal(null)
        setError('not_found')
        return
      }
      if (!res.ok) {
        setError('generic')
        return
      }
      const json = await res.json()
      const data = unwrap<PublicProposal | null>(json)
      if (!data || typeof data !== 'object' || !('title' in data)) {
        setProposal(null)
        setError('not_found')
        return
      }
      setProposal(data)
    } catch {
      setError('generic')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchProposal()
  }, [fetchProposal])

  const readSignature = (): string => {
    const canvas = signatureBoxRef.current?.querySelector<HTMLCanvasElement>(
      'canvas[data-signature-pad]',
    ) as (HTMLCanvasElement & { __pad?: SignaturePadHandle }) | null
    return canvas?.__pad?.toDataURL() ?? ''
  }

  const submitAccept = async () => {
    setSubmitError(null)
    if (!signerName.trim()) {
      setSubmitError(t('يرجى إدخال الاسم الكامل.', 'Please enter your full name.'))
      return
    }
    const signatureData = readSignature()
    if (!signatureData) {
      setSubmitError(t('يرجى التوقيع في المربع المخصص.', 'Please sign in the box above.'))
      return
    }
    setSubmitting(true)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      const csrf = getCsrfToken()
      if (csrf) headers['X-Frappe-CSRF-Token'] = csrf
      const res = await fetch('/api/method/base_meena.sales_proposal.api.accept_proposal', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ token, signed_by_name: signerName.trim(), signature_data: signatureData }),
      })
      if (!res.ok) {
        let detail = ''
        try {
          detail = await res.text()
        } catch {
          /* ignore */
        }
        throw new Error(detail || `HTTP ${res.status}`)
      }
      setActionResult('accepted')
      setSignOpen(false)
    } catch {
      setSubmitError(t('تعذّر إرسال الموافقة، يرجى المحاولة مرة أخرى.', 'Could not submit your acceptance. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  const submitDecline = async () => {
    setSubmitError(null)
    setSubmitting(true)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      const csrf = getCsrfToken()
      if (csrf) headers['X-Frappe-CSRF-Token'] = csrf
      const res = await fetch('/api/method/base_meena.sales_proposal.api.reject_proposal', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ token, reason: declineReason.trim() }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setActionResult('declined')
      setDeclineOpen(false)
    } catch {
      setSubmitError(t('تعذّر إرسال الرد، يرجى المحاولة مرة أخرى.', 'Could not submit your response. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  const chartData = useMemo(
    () =>
      (proposal?.projection_rows || []).map((r) => ({
        name: r.period_label,
        savings: r.client_savings,
      })),
    [proposal?.projection_rows],
  )

  // ───────── loading ─────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBF8F2]">
        <div className="flex flex-col items-center gap-3 text-[#0E6E62]">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm text-gray-500">جارٍ التحميل… · Loading…</p>
        </div>
      </div>
    )
  }

  // ───────── not found / error ─────────
  if (error || !proposal) {
    const notFound = error === 'not_found'
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBF8F2] px-4">
        <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="mt-4 text-lg font-semibold text-gray-800">
            {notFound ? 'هذا العرض غير متاح' : 'حدث خطأ'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {notFound ? 'This proposal is unavailable' : 'Something went wrong'}
          </p>
          <p className="mt-4 text-sm text-gray-600">
            {notFound
              ? 'الرابط غير صالح أو منتهي الصلاحية. · This link is invalid or has expired.'
              : 'تعذّر تحميل العرض. · Could not load the proposal.'}
          </p>
          {!notFound && (
            <button
              onClick={fetchProposal}
              className="mt-5 rounded-lg bg-[#0E6E62] px-4 py-2 text-sm font-medium text-white hover:bg-[#0b5a50]"
            >
              إعادة المحاولة · Retry
            </button>
          )}
        </div>
      </div>
    )
  }

  // ───────── confirmation after action ─────────
  if (actionResult) {
    const accepted = actionResult === 'accepted'
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBF8F2] px-4" dir={dir}>
        <div className="w-full max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
          {accepted ? (
            <CheckCircle2 className="mx-auto h-12 w-12 text-[#0E6E62]" />
          ) : (
            <X className="mx-auto h-12 w-12 text-gray-400" />
          )}
          <h1 className="mt-4 text-xl font-semibold text-gray-800">
            {accepted
              ? t('تم قبول العرض', 'Proposal accepted')
              : t('تم رفض العرض', 'Proposal declined')}
          </h1>
          <p className="mt-3 text-sm text-gray-600">
            {accepted
              ? t(
                  'شكرًا لك. سيتواصل معك فريقنا قريبًا لإتمام الخطوات التالية.',
                  'Thank you. Our team will reach out shortly to complete the next steps.',
                )
              : t(
                  'تم تسجيل ردك. شكرًا لوقتك.',
                  'Your response has been recorded. Thank you for your time.',
                )}
          </p>
        </div>
      </div>
    )
  }

  const alreadyAccepted = proposal.is_signed || !!proposal.accepted_on || proposal.status === 'Accepted'
  const isExpired = !alreadyAccepted && (proposal.status === 'Expired' || (!!proposal.valid_till && new Date(proposal.valid_till) < new Date(new Date().toDateString())))
  const showSignBlock = proposal.requires_signature && !alreadyAccepted && !isExpired

  // ───────── main document ─────────
  return (
    <div dir={dir} className="min-h-screen bg-[#FBF8F2] py-6 sm:py-10" style={{ fontFamily: 'var(--font-arabic), var(--font-inter), system-ui' }}>
      <div className="mx-auto w-full max-w-3xl px-4">
        {/* ── header ── */}
        <header className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#0E6E62] to-[#0b5a50] p-6 text-white shadow-lg sm:p-8">
          <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/70">
            <span>{t('عرض سعر', 'Proposal')}</span>
            <span>{formatDate(proposal.transaction_date)}</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{proposal.title}</h1>
          <div className="mt-4 flex flex-col gap-1 text-sm text-white/90">
            <span>
              <span className="text-white/60">{t('مُقدَّم من', 'From')}: </span>
              {proposal.company}
            </span>
            <span>
              <span className="text-white/60">{t('مُقدَّم إلى', 'To')}: </span>
              {proposal.party_display_name}
            </span>
          </div>
          {proposal.valid_till && (
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs">
              <Clock className="h-3.5 w-3.5" />
              {t('صالح حتى', 'Valid until')}: {formatDate(proposal.valid_till)}
            </div>
          )}
        </header>

        {/* ── not-a-tax-invoice note ── */}
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-700">
          {t('عرض سعر — هذا المستند ليس فاتورة ضريبية', 'Quotation — this document is not a tax invoice')}
        </div>

        {/* ── expired banner ── */}
        {isExpired && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-800">
            <Clock className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm font-medium">{t('انتهت صلاحية هذا العرض', 'This proposal has expired')}</p>
          </div>
        )}

        {/* ── accepted banner ── */}
        {alreadyAccepted && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm font-medium">
              {t('تم اعتماد هذا العرض', 'This proposal has been accepted')}
              {proposal.accepted_on ? ` — ${formatDate(proposal.accepted_on)}` : ''}
            </p>
          </div>
        )}

        {/* ── PDF download (only if guest-safe pdf is provided) ── */}
        {proposal.pdf_path && (
          <div className="mt-4 flex justify-end">
            <a
              href={proposal.pdf_path}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-[#0E6E62] bg-white px-4 py-2 text-sm font-medium text-[#0E6E62] shadow-sm hover:bg-[#0E6E62]/5"
            >
              <Download className="h-4 w-4" />
              {t('تنزيل PDF', 'Download PDF')}
            </a>
          </div>
        )}

        {/* ── executive summary ── */}
        {proposal.executive_summary && (
          <Section title={t('الملخص التنفيذي', 'Executive Summary')}>
            <RichHtml html={proposal.executive_summary} />
          </Section>
        )}

        {/* ── scope of work ── */}
        {proposal.scope_of_work && (
          <Section title={t('نطاق العمل', 'Scope of Work')}>
            <RichHtml html={proposal.scope_of_work} />
          </Section>
        )}

        {/* ── savings / ROI highlight ── */}
        {(proposal.estimated_savings || proposal.savings_percentage || proposal.payback_period_months) && (
          <Section title={t('العائد على الاستثمار والتوفير', 'Savings & ROI')}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Highlight
                icon={<Wallet className="h-5 w-5" />}
                label={t('التوفير المقدَّر', 'Estimated savings')}
                value={formatMoney(proposal.estimated_savings, currency, locale)}
              />
              <Highlight
                icon={<TrendingDown className="h-5 w-5" />}
                label={t('نسبة التوفير', 'Savings rate')}
                value={
                  proposal.savings_percentage != null
                    ? `${formatNumber(Math.round(proposal.savings_percentage))}%`
                    : ''
                }
              />
              <Highlight
                icon={<Clock className="h-5 w-5" />}
                label={t('فترة الاسترداد', 'Payback period')}
                value={
                  proposal.payback_period_months != null
                    ? `${formatNumber(proposal.payback_period_months)} ${t('شهر', 'months')}`
                    : ''
                }
              />
            </div>

            {chartData.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-sm font-medium text-gray-600">
                  {t('التوفير المتوقع عبر الزمن', 'Projected savings over time')}
                </p>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        tickFormatter={(v) => formatNumber(v as number)}
                        width={56}
                        orientation={ar ? 'right' : 'left'}
                      />
                      <Tooltip
                        formatter={(v) => formatMoney(v as number, currency, locale)}
                        labelStyle={{ direction: dir }}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Bar dataKey="savings" fill="#0E6E62" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </Section>
        )}

        {/* ── offer items table ── */}
        <Section title={t('بنود العرض', 'Offer Details')}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-start text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pe-3 text-start font-medium">{t('البند', 'Item')}</th>
                  <th className="py-2 px-3 text-center font-medium">{t('الكمية', 'Qty')}</th>
                  <th className="py-2 px-3 text-end font-medium">{t('السعر', 'Rate')}</th>
                  <th className="py-2 ps-3 text-end font-medium">{t('الإجمالي', 'Amount')}</th>
                </tr>
              </thead>
              <tbody>
                {proposal.items?.map((it, i) => (
                  <tr key={i} className="border-b border-gray-100 align-top">
                    <td className="py-3 pe-3">
                      <div className="font-medium text-gray-800">{it.item_name}</div>
                      {it.description && (
                        <div className="mt-0.5 text-xs text-gray-500">{it.description}</div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center text-gray-700">{formatNumber(it.qty)}</td>
                    <td className="py-3 px-3 text-end text-gray-700">
                      {formatMoney(it.rate, currency, locale)}
                    </td>
                    <td className="py-3 ps-3 text-end font-medium text-gray-800">
                      {formatMoney(it.amount, currency, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* totals */}
          <div className="mt-4 flex justify-end">
            <dl className="w-full max-w-xs space-y-2 text-sm">
              <Row label={t('الإجمالي الفرعي', 'Subtotal')} value={formatMoney(proposal.total, currency, locale)} />
              {!!proposal.additional_discount && (
                <Row
                  label={t('خصم إضافي', 'Additional discount')}
                  value={`- ${formatMoney(proposal.additional_discount, currency, locale)}`}
                />
              )}
              <Row
                label={`${t('ضريبة القيمة المضافة', 'VAT')} (${formatNumber(proposal.vat_rate ?? 15)}%)`}
                value={formatMoney(proposal.vat_amount, currency, locale)}
              />
              <div className="flex items-center justify-between border-t border-gray-200 pt-2 text-base font-bold text-[#0E6E62]">
                <dt>{t('الإجمالي النهائي', 'Grand total')}</dt>
                <dd>{formatMoney(proposal.grand_total, currency, locale)}</dd>
              </div>
            </dl>
          </div>
        </Section>

        {/* ── contract terms ── */}
        {proposal.contract_terms && (
          <Section title={t('الشروط والأحكام', 'Terms & Conditions')}>
            <RichHtml html={proposal.contract_terms} className="text-xs text-gray-600" />
          </Section>
        )}

        {/* ── sign / decline ── */}
        {showSignBlock && (
          <div className="mt-6 rounded-2xl border-2 border-[#0E6E62]/30 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800">
              {t('الموافقة والتوقيع', 'Accept & Sign')}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {t(
                'بالموافقة، فإنك تؤكد قبولك لشروط هذا العرض.',
                'By accepting, you confirm your agreement to the terms of this proposal.',
              )}
            </p>

            {!signOpen && !declineOpen && (
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => {
                    setSignOpen(true)
                    setDeclineOpen(false)
                    setSubmitError(null)
                  }}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0E6E62] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0b5a50]"
                >
                  <PenLine className="h-4 w-4" />
                  {t('قبول وتوقيع', 'Accept & Sign')}
                </button>
                <button
                  onClick={() => {
                    setDeclineOpen(true)
                    setSignOpen(false)
                    setSubmitError(null)
                  }}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  <X className="h-4 w-4" />
                  {t('رفض', 'Decline')}
                </button>
              </div>
            )}

            {/* accept form */}
            {signOpen && (
              <div className="mt-5 space-y-4" ref={signatureBoxRef}>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t('الاسم الكامل', 'Full name')}
                  </label>
                  <input
                    type="text"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder={t('اكتب اسمك الكامل', 'Type your full name')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-[#0E6E62] focus:outline-none focus:ring-1 focus:ring-[#0E6E62]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t('التوقيع', 'Signature')}
                  </label>
                  <SignaturePad
                    ar={ar}
                    onChange={() => setHasSignature(!!readSignature())}
                    clearLabel={t('مسح', 'Clear')}
                    hint={t('وقّع باستخدام الماوس أو إصبعك.', 'Sign using your mouse or finger.')}
                  />
                </div>

                {submitError && (
                  <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{submitError}</p>
                )}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={submitAccept}
                    disabled={submitting}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0E6E62] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0b5a50] disabled:opacity-60"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    {t('تأكيد القبول', 'Confirm acceptance')}
                  </button>
                  <button
                    onClick={() => {
                      setSignOpen(false)
                      setSubmitError(null)
                    }}
                    disabled={submitting}
                    className="rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    {t('إلغاء', 'Cancel')}
                  </button>
                </div>
                {/* hasSignature kept in sync to allow future enable/disable logic */}
                <input type="hidden" value={hasSignature ? '1' : '0'} readOnly />
              </div>
            )}

            {/* decline form */}
            {declineOpen && (
              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t('سبب الرفض (اختياري)', 'Reason (optional)')}
                  </label>
                  <textarea
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    rows={3}
                    placeholder={t('أخبرنا لماذا…', 'Let us know why…')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-[#0E6E62] focus:outline-none focus:ring-1 focus:ring-[#0E6E62]"
                  />
                </div>
                {submitError && (
                  <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{submitError}</p>
                )}
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={submitDecline}
                    disabled={submitting}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-gray-700 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                    {t('تأكيد الرفض', 'Confirm decline')}
                  </button>
                  <button
                    onClick={() => {
                      setDeclineOpen(false)
                      setSubmitError(null)
                    }}
                    disabled={submitting}
                    className="rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    {t('إلغاء', 'Cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── footer ── */}
        <footer className="mt-8 pb-4 text-center text-xs text-gray-400">
          {proposal.company} · {formatDate(proposal.transaction_date)}
        </footer>
      </div>
    </div>
  )
}

// ───────────────────────── small presentational helpers ─────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold text-gray-800">{title}</h2>
      {children}
    </section>
  )
}

function RichHtml({ html, className }: { html: string; className?: string }) {
  // Backend returns sanitized HTML for these fields. Render in a prose-ish wrapper.
  return (
    <div
      className={
        className ??
        'prose prose-sm max-w-none text-sm leading-relaxed text-gray-700 [&_a]:text-[#0E6E62] [&_li]:my-0.5 [&_ol]:ps-5 [&_ol]:list-decimal [&_p]:my-2 [&_ul]:ps-5 [&_ul]:list-disc'
      }
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function Highlight({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl bg-[#0E6E62]/5 p-4">
      <div className="flex items-center gap-2 text-[#0E6E62]">{icon}</div>
      <div className="mt-2 text-xs text-gray-500">{label}</div>
      <div className="mt-0.5 text-lg font-bold text-gray-800">{value || '—'}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-gray-600">
      <dt>{label}</dt>
      <dd className="font-medium text-gray-800">{value}</dd>
    </div>
  )
}
