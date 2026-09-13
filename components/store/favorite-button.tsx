'use client'

import { Heart } from 'lucide-react'
import { useFavorites, toSnapshot } from '@/lib/listing-collections'
import type { ListingSearchResult } from '@/lib/real-estate-api'

/** Heart toggle. `overlay` = round button for the card image corner; `inline` = labelled button. */
export default function FavoriteButton({
  listing,
  variant = 'overlay',
  className = '',
}: {
  listing: Partial<ListingSearchResult> & { name: string }
  variant?: 'overlay' | 'inline'
  className?: string
}) {
  const { has, toggle } = useFavorites()
  const saved = has(listing.name)
  const label = saved ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault() // cards wrap this in a <Link> — don't navigate
    e.stopPropagation()
    toggle(toSnapshot(listing))
  }

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={saved}
        aria-label={label}
        className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors ${saved ? 'border-[var(--aqar-clay)] bg-[var(--aqar-clay)]/8 text-[var(--aqar-clay)]' : 'border-[var(--aqar-sand-2)] text-[var(--aqar-kohl)]/75 hover:border-[var(--aqar-clay)]/40'} ${className}`}
      >
        <Heart className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />
        {saved ? 'في المفضلة' : 'أضف للمفضلة'}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={label}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-[var(--aqar-surface)]/90 shadow backdrop-blur transition-colors hover:bg-[var(--aqar-surface)] focus-visible:ring-2 focus-visible:ring-[var(--aqar-clay)] ${className}`}
    >
      <Heart className={`h-[18px] w-[18px] ${saved ? 'fill-[var(--aqar-clay)] text-[var(--aqar-clay)]' : 'text-[var(--aqar-kohl)]/55'}`} />
    </button>
  )
}
