'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bookmark, Trash2, Bell, BellOff, Search, ArrowLeft, Info } from 'lucide-react'
import { useSavedSearches, queryToQS } from '@/lib/saved-searches'

export default function SavedSearchesPage() {
  const { items, remove, toggleAlert } = useSavedSearches()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const anyAlert = items.some((s) => s.alert)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="aqar-display mb-1 flex items-center gap-2 text-2xl text-[var(--aqar-kohl)]">
        <Bookmark className="h-6 w-6 text-[var(--aqar-green)]" />عمليات البحث المحفوظة
      </h1>
      <p className="mb-6 text-sm text-[var(--aqar-kohl)]/55">افتح بحثك المحفوظ بنفس الفلاتر، أو فعّل التنبيه عند نزول عقار مطابق.</p>

      {!mounted ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-[var(--aqar-sand-2)]" />)}</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--aqar-sand-2)] p-12 text-center">
          <Bookmark className="mx-auto mb-3 h-10 w-10 text-[var(--aqar-kohl)]/20" />
          <p className="text-[var(--aqar-kohl)]/70">لا توجد عمليات بحث محفوظة بعد</p>
          <p className="mt-1 text-sm text-[var(--aqar-kohl)]/45">اضبط الفلاتر في صفحة البحث ثم اضغط «احفظ البحث».</p>
          <Link href="/search" className="aqar-btn mt-5 inline-flex items-center gap-2"><Search className="h-4 w-4" />ابدأ البحث</Link>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {items.map((s) => (
              <li key={s.id} className="aqar-card flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 font-medium text-[var(--aqar-kohl)]">{s.label}</p>
                  {s.alert && <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[var(--aqar-green-d)]"><Bell className="h-3 w-3" />التنبيه مُفعّل</p>}
                </div>
                <button
                  onClick={() => toggleAlert(s.id)}
                  aria-pressed={s.alert}
                  aria-label={s.alert ? 'إيقاف التنبيه' : 'تفعيل التنبيه عند نزول عقار مطابق'}
                  className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 text-xs font-medium ${s.alert ? 'border-[var(--aqar-green)] bg-[var(--aqar-green)]/8 text-[var(--aqar-green-d)]' : 'border-[var(--aqar-sand-2)] text-[var(--aqar-kohl)]/70'}`}
                >
                  {s.alert ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}نبّهني
                </button>
                <Link href={`/search${queryToQS(s.query) ? `?${queryToQS(s.query)}` : ''}`} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[var(--aqar-green)] px-3 text-xs font-bold text-white hover:bg-[var(--aqar-green-h)]">
                  <ArrowLeft className="h-4 w-4" />فتح
                </Link>
                <button onClick={() => remove(s.id)} aria-label="حذف البحث المحفوظ" className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--aqar-kohl)]/40 hover:text-[var(--aqar-clay)]"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>

          {anyAlert && (
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-[var(--aqar-sand-2)] p-3 text-xs leading-5 text-[var(--aqar-kohl)]/60">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--aqar-green)]" />
              خدمة إشعارات «نزول عقار مطابق» قيد الإعداد — تم حفظ رغبتك بالتنبيه، وسيبدأ الإرسال فور تفعيل الربط بالخادم.
            </p>
          )}
        </>
      )}
    </div>
  )
}
