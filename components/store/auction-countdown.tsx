'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

/** Sample live countdown (client-only to avoid SSR time mismatch). Decorative — part of the
 *  "نموذج" auction-card preview; there is no live auction engine. */
export default function AuctionCountdown({ hours = 52 }: { hours?: number }) {
  const [t, setT] = useState<{ target: number; now: number } | null>(null)

  useEffect(() => {
    const target = Date.now() + hours * 3600 * 1000
    setT({ target, now: Date.now() })
    const id = setInterval(() => setT((p) => (p ? { ...p, now: Date.now() } : p)), 1000)
    return () => clearInterval(id)
  }, [hours])

  const pad = (n: number) => String(n).padStart(2, '0')
  let label = '—ي —:—:—'
  if (t) {
    let s = Math.max(0, Math.floor((t.target - t.now) / 1000))
    const d = Math.floor(s / 86400); s -= d * 86400
    const h = Math.floor(s / 3600); s -= h * 3600
    const m = Math.floor(s / 60); const sec = s - m * 60
    label = `${d}ي ${pad(h)}:${pad(m)}:${pad(sec)}`
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--aqar-espresso-fill)] px-2.5 py-1 text-xs font-bold text-white">
      <Clock className="h-3.5 w-3.5" />
      <span className="tabular-nums" dir="ltr">{label}</span>
    </span>
  )
}
