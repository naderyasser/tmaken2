import { Star } from 'lucide-react'

// Read-only star display with fractional fill. RTL-safe: the gold layer is anchored to the
// inline-start (right edge in RTL) so ratings fill from the start, like the rest of the UI.
export default function StarRating({ value, size = 16 }: { value: number; size?: number }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100))
  const stars = [0, 1, 2, 3, 4]
  return (
    <span
      className="relative inline-flex shrink-0 align-middle"
      style={{ width: size * 5, height: size }}
      role="img"
      aria-label={`${value.toFixed(1)} من 5`}
    >
      <span className="absolute inset-0 flex" aria-hidden>
        {stars.map((i) => (
          <Star key={i} style={{ width: size, height: size }} className="shrink-0 text-[var(--aqar-border)]" fill="currentColor" strokeWidth={0} />
        ))}
      </span>
      <span className="absolute top-0 bottom-0 flex overflow-hidden" style={{ insetInlineStart: 0, width: `${pct}%` }} aria-hidden>
        {stars.map((i) => (
          <Star key={i} style={{ width: size, height: size }} className="shrink-0 text-[var(--aqar-gold)]" fill="currentColor" strokeWidth={0} />
        ))}
      </span>
    </span>
  )
}
