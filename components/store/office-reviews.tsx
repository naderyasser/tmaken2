'use client'

import { useState } from 'react'
import { Star, Flag, Loader2 } from 'lucide-react'
import { realEstateApi, type OfficeReviews as OfficeReviewsData, type AqarReview } from '@/lib/real-estate-api'
import StarRating from './star-rating'

function fmtDate(s: string) {
  try {
    return new Date(s.replace(' ', 'T')).toLocaleDateString('ar', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return ''
  }
}

export default function OfficeReviews({ office, initial, canWrite = false }: { office: string; initial: OfficeReviewsData; canWrite?: boolean }) {
  const reviews: AqarReview[] = initial?.reviews || []
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [reported, setReported] = useState<Record<string, boolean>>({})

  const submit = async () => {
    setError('')
    if (rating < 1) {
      setError('اختر عدد النجوم أولاً.')
      return
    }
    setSending(true)
    try {
      await realEstateApi.submitReview(office, rating, body.trim())
      setDone(true)
      setRating(0)
      setBody('')
    } catch (e: any) {
      const m = String(e?.message || '')
      if (!m || /permission|not permitted|403|417|login|sign in|الدخول/i.test(m)) {
        setError('لإضافة تقييم يجب تسجيل الدخول أولاً.')
      } else {
        setError(m)
      }
    } finally {
      setSending(false)
    }
  }

  const report = async (name: string) => {
    if (typeof window !== 'undefined' && !window.confirm('هل تريد الإبلاغ عن هذا التقييم؟')) return
    try {
      await realEstateApi.reportReview(name)
      setReported((r) => ({ ...r, [name]: true }))
    } catch {
      /* non-blocking */
    }
  }

  const avg = initial?.rating_avg || 0
  const count = initial?.review_count || 0

  return (
    <section className="mt-10">
      <h2 className="aqar-display mb-4 text-xl text-[var(--aqar-kohl)]">تقييمات العملاء</h2>

      {/* Summary */}
      <div className="aqar-card flex flex-wrap items-center gap-5 p-5">
        <div className="text-center">
          <div className="aqar-display text-4xl leading-none text-[var(--aqar-bronze-d)]">{count ? avg.toFixed(1) : '—'}</div>
          <div className="mt-1"><StarRating value={avg} size={18} /></div>
          <div className="mt-1 text-xs text-[var(--aqar-kohl)]/55">{count} تقييم</div>
        </div>
        <p className="flex-1 text-sm text-[var(--aqar-kohl)]/65">
          {count
            ? 'تقييمات موثّقة من عملاء سابقين لهذا المكتب. كل تقييم يُراجَع قبل نشره.'
            : 'لا توجد تقييمات بعد. كن أول من يشارك تجربته مع هذا المكتب.'}
        </p>
      </div>

      {/* Add-review form — gated behind ENABLE_BUYER_LOGIN (off → read-only reviews, no login prompt) */}
      {canWrite ? (
      <div className="aqar-card mt-4 p-5">
        <h3 className="mb-3 font-semibold text-[var(--aqar-kohl)]">أضف تقييمك</h3>
        {done ? (
          <div className="rounded-xl bg-[var(--aqar-sand)] p-4 text-center text-sm font-medium text-[var(--aqar-kohl)]">
            تم استلام تقييمك ✅ سيظهر بعد المراجعة.
            <button onClick={() => setDone(false)} className="mt-2 block w-full text-xs text-[var(--aqar-green)] underline">إضافة تقييم آخر</button>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center gap-1" dir="rtl" role="radiogroup" aria-label="التقييم بالنجوم">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  aria-label={`${n} نجوم`}
                  aria-checked={rating === n}
                  role="radio"
                  className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-[var(--aqar-sand)]"
                >
                  <Star
                    className={`h-7 w-7 ${(hover || rating) >= n ? 'text-[var(--aqar-gold)]' : 'text-[var(--aqar-border)]'}`}
                    fill="currentColor"
                    strokeWidth={0}
                  />
                </button>
              ))}
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="اكتب تجربتك مع هذا المكتب (اختياري)…"
              className="inp w-full"
              style={{ minHeight: 88 }}
            />
            {error ? <p className="mt-2 text-sm text-[var(--aqar-clay)]">{error}</p> : null}
            <button
              onClick={submit}
              disabled={sending}
              className="aqar-btn mt-3 inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              نشر التقييم
            </button>
          </>
        )}
      </div>
      ) : null}

      {/* List */}
      {reviews.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {reviews.map((r) => (
            <li key={r.name} className="aqar-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <StarRating value={r.rating} size={15} />
                  <div className="mt-1 text-sm font-medium text-[var(--aqar-kohl)]">{r.author_name || 'عميل'}</div>
                </div>
                <span className="shrink-0 text-xs text-[var(--aqar-kohl)]/45">{fmtDate(r.creation)}</span>
              </div>
              {r.body ? <p className="mt-2 text-sm leading-7 text-[var(--aqar-kohl)]/80">{r.body}</p> : null}
              <button
                onClick={() => report(r.name)}
                disabled={reported[r.name]}
                className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--aqar-kohl)]/45 hover:text-[var(--aqar-clay)] disabled:opacity-60"
              >
                <Flag className="h-3 w-3" />
                {reported[r.name] ? 'تم الإبلاغ' : 'إبلاغ'}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
