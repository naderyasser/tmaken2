import { BadgeCheck } from 'lucide-react'

const TIP = 'إعلان موثّق برقم ترخيص من الهيئة العامة للعقار'

/** "موثّق" trust badge with an accessible tooltip (keyboard-focusable + SR-labelled).
 *  Render only when the listing has a license number. */
export default function VerifiedBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`group relative inline-flex ${className}`}>
      <span
        tabIndex={0}
        role="img"
        aria-label={`موثّق — ${TIP}`}
        className="inline-flex items-center gap-1 rounded-full bg-[var(--aqar-green)]/12 px-2 py-0.5 text-[11px] font-bold text-[var(--aqar-green-d)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--aqar-green)]"
      >
        <BadgeCheck className="h-3.5 w-3.5" />
        موثّق
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full z-30 mb-1 hidden w-max max-w-[220px] rounded-lg bg-[var(--aqar-kohl)] px-2.5 py-1.5 text-[11px] leading-5 text-[var(--aqar-surface)] shadow-lg group-hover:block group-focus-within:block"
        style={{ insetInlineStart: 0 }}
      >
        {TIP}
      </span>
    </span>
  )
}
