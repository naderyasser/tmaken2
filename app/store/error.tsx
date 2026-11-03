'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Home, RefreshCw, MessageCircle } from 'lucide-react'
import { BrandMark } from '@/components/store/brand-mark'

const SUPPORT_WA = 'https://wa.me/966553275000?text=السلام%20عليكم،%20واجهتني%20مشكلة%20في%20تصفح%20تمكين%20العقارية'

/** Storefront-wide error boundary: a backend outage or unexpected render failure shows
 *  a friendly, retryable Arabic state — never a raw error screen and never a fake
 *  "no listings" empty marketplace (frappeServer throws instead of returning null). */
export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // surfaced in the browser console for debugging; not shown to the user
    console.error('store render error:', error)
  }, [error])

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <BrandMark className="h-16 w-16 text-[var(--aqar-green)]/30" />
      <h1 className="aqar-section-title mt-6 text-xl">تعذّر تحميل الصفحة</h1>
      <p className="mt-2 leading-7 text-[var(--aqar-kohl)]/60">
        حدث خلل مؤقت أثناء جلب البيانات. حاول مرة أخرى بعد لحظات، وإذا استمرت المشكلة راسلنا وسنساعدك.
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <button onClick={reset} className="aqar-btn"><RefreshCw className="h-4 w-4" />إعادة المحاولة</button>
        <Link href="/" className="aqar-btn aqar-btn-outline"><Home className="h-4 w-4" />الرئيسية</Link>
      </div>
      <a href={SUPPORT_WA} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--aqar-green)] hover:underline">
        <MessageCircle className="h-4 w-4" />تواصل معنا على واتساب
      </a>
    </div>
  )
}
