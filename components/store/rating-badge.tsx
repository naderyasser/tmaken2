import { Star } from 'lucide-react'

// Compact "★ 4.3 · 128 تقييم" pill. Renders nothing when the office has no approved reviews,
// so cards/listings stay clean until real reviews exist.
export default function RatingBadge({
  ratingAvg,
  reviewCount,
  size = 'sm',
}: {
  ratingAvg?: number | null
  reviewCount?: number
  size?: 'sm' | 'md'
}) {
  if (!reviewCount || !ratingAvg) return null
  const star = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5'
  const text = size === 'md' ? 'text-sm' : 'text-xs'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-[rgba(176,141,87,0.14)] px-2 py-0.5 font-semibold text-[var(--aqar-bronze-d)] ${text}`}>
      <Star className={`${star} text-[var(--aqar-gold)]`} fill="currentColor" strokeWidth={0} />
      {ratingAvg.toFixed(1)}
      <span className="font-normal text-[var(--aqar-kohl)]/55">· {reviewCount} تقييم</span>
    </span>
  )
}
