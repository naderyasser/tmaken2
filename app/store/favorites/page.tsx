'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Heart, Search } from 'lucide-react'
import StoreListingCard from '@/components/store/listing-card'
import { useFavorites } from '@/lib/listing-collections'

export default function FavoritesPage() {
  const { items } = useFavorites()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="aqar-display mb-1 flex items-center gap-2 text-2xl text-[var(--aqar-kohl)]">
        <Heart className="h-6 w-6 text-[var(--aqar-clay)]" />المفضلة
      </h1>
      <p className="mb-6 text-sm text-[var(--aqar-kohl)]/55">العقارات التي حفظتها على هذا الجهاز.</p>

      {!mounted ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{[...Array(4)].map((_, i) => <div key={i} className="h-72 animate-pulse rounded-2xl bg-[var(--aqar-sand-2)]" />)}</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--aqar-sand-2)] p-12 text-center">
          <Heart className="mx-auto mb-3 h-10 w-10 text-[var(--aqar-kohl)]/20" />
          <p className="text-[var(--aqar-kohl)]/70">لا توجد عقارات محفوظة بعد</p>
          <p className="mt-1 text-sm text-[var(--aqar-kohl)]/45">اضغط على القلب في أي إعلان لحفظه هنا.</p>
          <Link href="/search" className="aqar-btn mt-5 inline-flex items-center gap-2"><Search className="h-4 w-4" />تصفّح العقارات</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((l) => <StoreListingCard key={l.name} l={l as any} />)}
        </div>
      )}
    </div>
  )
}
