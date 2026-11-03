'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Scale, X } from 'lucide-react'
import { useCompare } from '@/lib/listing-collections'

/** Sticky bar (site-wide) listing the selected compare items + a «قارن» CTA. Hidden when empty. */
export default function CompareBar() {
  const { items, remove, clear } = useCompare()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted || items.length === 0) return null

  return (
    <div
      className="fixed bottom-20 left-1/2 z-[70] flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-2 rounded-2xl border border-[var(--aqar-border)] bg-[var(--aqar-surface)] p-2 pe-3 shadow-xl sm:bottom-5"
      role="region"
      aria-label="شريط المقارنة"
    >
      <div className="flex items-center gap-1.5">
        {items.map((l) => (
          <span key={l.name} className="relative flex h-10 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--aqar-sand-2)]">
            {l.primary_image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={l.primary_image} alt={l.title || ''} className="h-full w-full object-cover" />
            ) : <Scale className="h-4 w-4 text-[var(--aqar-kohl)]/30" />}
            <button
              onClick={() => remove(l.name)}
              aria-label={`إزالة ${l.title || ''} من المقارنة`}
              className="absolute inset-0 flex items-center justify-center bg-black/0 text-transparent hover:bg-black/40 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </span>
        ))}
      </div>
      <Link href="/compare" className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[var(--aqar-green)] px-4 text-sm font-bold text-white hover:bg-[var(--aqar-green-h)]">
        <Scale className="h-4 w-4" />قارن ({items.length})
      </Link>
      <button onClick={clear} aria-label="مسح المقارنة" className="text-[var(--aqar-kohl)]/40 hover:text-[var(--aqar-kohl)]"><X className="h-4 w-4" /></button>
    </div>
  )
}
