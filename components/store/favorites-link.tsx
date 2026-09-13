'use client'

import Link from 'next/link'
import { Heart } from 'lucide-react'
import { useFavorites } from '@/lib/listing-collections'

/** Header entry point for المفضلة with a live count badge. */
export default function FavoritesLink() {
  const { count } = useFavorites()
  return (
    <Link
      href="/favorites"
      aria-label={count > 0 ? `المفضلة، ${count} عقار محفوظ` : 'المفضلة'}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-[var(--aqar-sand-2)]"
    >
      <Heart className="h-5 w-5 text-[var(--aqar-kohl)]/70" />
      {count > 0 && (
        <span
          className="absolute -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--aqar-clay)] px-1 text-[10px] font-bold leading-none text-white"
          style={{ insetInlineStart: 0 }}
          aria-hidden
        >
          {count}
        </span>
      )}
    </Link>
  )
}
