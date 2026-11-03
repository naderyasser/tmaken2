'use client'

import { useState } from 'react'
import { Scale, Check } from 'lucide-react'
import { useCompare, toSnapshot, COMPARE_MAX } from '@/lib/listing-collections'
import type { ListingSearchResult } from '@/lib/real-estate-api'

/** "أضف للمقارنة" toggle. Enforces the COMPARE_MAX cap with a transient friendly message. */
export default function CompareButton({
  listing,
  className = '',
  iconOnly = false,
}: {
  listing: Partial<ListingSearchResult> & { name: string }
  className?: string
  iconOnly?: boolean
}) {
  const { has, toggle } = useCompare()
  const inCompare = has(listing.name)
  const [full, setFull] = useState(false)

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const r = toggle(toSnapshot(listing))
    if (r === 'full') {
      setFull(true)
      setTimeout(() => setFull(false), 2600)
    }
  }

  const label = inCompare ? 'إزالة من المقارنة' : 'أضف إلى المقارنة'

  return (
    <span className={`relative inline-flex ${className}`}>
      {iconOnly ? (
        // Secondary control: icon-only so WhatsApp/call stay the primary actions on the card.
        <button
          type="button"
          onClick={onClick}
          aria-pressed={inCompare}
          aria-label={label}
          title={label}
          className={`flex h-11 w-11 items-center justify-center rounded-xl border transition-colors focus-visible:ring-2 focus-visible:ring-[var(--aqar-green)] ${inCompare ? 'border-[var(--aqar-green)] bg-[var(--aqar-green)]/8 text-[var(--aqar-green-d)]' : 'border-[var(--aqar-sand-2)] text-[var(--aqar-kohl)]/55 hover:border-[var(--aqar-green)]/40'}`}
        >
          {inCompare ? <Check className="h-4 w-4" /> : <Scale className="h-4 w-4" />}
        </button>
      ) : (
        <button
          type="button"
          onClick={onClick}
          aria-pressed={inCompare}
          aria-label={label}
          className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors ${inCompare ? 'border-[var(--aqar-green)] bg-[var(--aqar-green)]/8 text-[var(--aqar-green-d)]' : 'border-[var(--aqar-sand-2)] text-[var(--aqar-kohl)]/70 hover:border-[var(--aqar-green)]/40'}`}
        >
          {inCompare ? <Check className="h-3.5 w-3.5" /> : <Scale className="h-3.5 w-3.5" />}
          {inCompare ? 'في المقارنة' : 'قارن'}
        </button>
      )}
      {full && (
        <span role="status" className="absolute bottom-full z-30 mb-1 w-max max-w-[200px] rounded-lg bg-[var(--aqar-clay)] px-2.5 py-1.5 text-[11px] leading-5 text-white shadow-lg" style={{ insetInlineStart: 0 }}>
          يمكن مقارنة {COMPARE_MAX} عقارات كحد أقصى
        </span>
      )}
    </span>
  )
}
