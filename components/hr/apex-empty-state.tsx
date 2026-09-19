/** Apex list empty state — magnifier illustration + «لا يوجد نتائج للبحث ابحث مرة اخري».
 *  `action` is optional and additive (e.g. an «اضافة» button) — omitting it
 *  renders byte-identical to before. The svg keeps its exact 300x300 look at
 *  sm+ (unchanged desktop); below that it's capped at 220px so it doesn't
 *  overflow narrow screens. */
export function ApexEmptyState({
  text = 'لا يوجد نتائج للبحث ابحث مرة اخري',
  action,
}: { text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-8 py-6 text-center">
      <svg
        viewBox="0 0 300 300"
        fill="none"
        aria-hidden="true"
        className="h-[220px] w-[220px] sm:h-[300px] sm:w-[300px]"
      >
        <g stroke="#3a4a63" strokeWidth="9" strokeLinecap="round">
          <line x1="60" y1="70" x2="78" y2="86" />
          <line x1="150" y1="40" x2="150" y2="62" />
          <line x1="240" y1="70" x2="222" y2="86" />
          <line x1="42" y1="150" x2="64" y2="150" />
          <line x1="258" y1="150" x2="236" y2="150" />
          <line x1="60" y1="230" x2="78" y2="214" />
        </g>
        <circle cx="150" cy="150" r="64" fill="#fff" stroke="#3a4a63" strokeWidth="11" />
        <circle cx="150" cy="150" r="42" fill="#fff" stroke="#bfe0f2" strokeWidth="11" />
        <path d="M120 128 A36 36 0 0 1 150 114" stroke="#bfe0f2" strokeWidth="9" strokeLinecap="round" fill="none" />
        <path d="M196 196 L252 252" stroke="#3a4a63" strokeWidth="22" strokeLinecap="round" />
        <path d="M100 30 l8 -18 l8 18 l18 8 l-18 8 l-8 18 l-8 -18 l-18 -8 z" fill="#d6ecc6" />
        <path d="M212 262 l7 -15 l7 15 l15 7 l-15 7 l-7 15 l-7 -15 l-15 -7 z" fill="#d6ecc6" />
      </svg>
      <p className="text-[22px] font-bold text-slate-800">{text}</p>
      {action && <div>{action}</div>}
    </div>
  )
}

/** Apex "empty box" illustration (تفعيل دوام رمضان). */
export function BoxIllustration() {
  return (
    <svg width="200" height="190" viewBox="0 0 200 190" fill="none" aria-hidden="true">
      <path d="M20 30 h160 v150 h-160 z" fill="#3a4a63" />
      <path d="M32 42 h136 v126 h-136 z" fill="#fff" />
      <path d="M40 50 h120 v110 h-120 z" fill="#3a4a63" />
      <rect x="76" y="30" width="48" height="40" fill="#4a7ad9" />
      <rect x="20" y="30" width="160" height="14" fill="#3a4a63" />
      <circle cx="160" cy="160" r="26" fill="#3a4a63" />
      <rect x="147" y="156" width="26" height="8" rx="2" fill="#4caf50" />
      <rect x="156" y="147" width="8" height="26" rx="2" fill="#4caf50" />
    </svg>
  )
}
