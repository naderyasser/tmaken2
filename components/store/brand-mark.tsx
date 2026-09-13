/** تمكين العقارية — property-pin mark (house + open door in negative space).
 *  Single path, fill via currentColor so CSS/tokens control light/dark. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="currentColor" aria-hidden className={className}>
      <path
        fillRule="evenodd"
        d="M50 4 C68 4 82 18 82 36 C82 54 64 62 50 94 C36 62 18 54 18 36 C18 18 32 4 50 4 Z M50 18 L68 34 L68 56 L56 56 L56 42 L44 42 L44 56 L32 56 L32 34 Z"
      />
    </svg>
  )
}
