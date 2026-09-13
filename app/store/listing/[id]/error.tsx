'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Home, RefreshCw } from 'lucide-react'
import { BrandMark } from '@/components/store/brand-mark'

/** Last-resort branded fallback so a listing page NEVER shows the raw
 *  "Application error: a client-side exception" screen, no matter how sparse
 *  or malformed the data. */
export default function ListingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // surfaced in the browser console for debugging; not shown to the user
    console.error('listing render error:', error)
  }, [error])

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <BrandMark className="h-16 w-16 text-[var(--aqar-green)]/30" />
      <h1 className="aqar-section-title mt-6 text-xl">تعذّر عرض هذا الإعلان</h1>
      <p className="mt-2 text-[var(--aqar-kohl)]/60">
        حدث خطأ غير متوقع أثناء عرض الإعلان. يمكنك المحاولة مجدداً أو تصفّح إعلانات أخرى.
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <button onClick={reset} className="aqar-btn"><RefreshCw className="h-4 w-4" />إعادة المحاولة</button>
        <Link href="/" className="aqar-btn aqar-btn-outline"><Home className="h-4 w-4" />الرئيسية</Link>
      </div>
    </div>
  )
}
