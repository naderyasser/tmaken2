'use client'

/**
 * Renders a numeric value with its unit so the unit always FOLLOWS the value
 * in the reading direction — mixed bidi runs ("0.0 كم/س", "km/h 0.0") reorder
 * unpredictably when rendered as one string inside an RTL paragraph.
 */
export function ValueUnit({ value, unit, className }: { value: string | number; unit: string; className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-1 ${className || ''}`}>
      <bdi>{value}</bdi>
      <bdi className="opacity-80">{unit}</bdi>
    </span>
  )
}
