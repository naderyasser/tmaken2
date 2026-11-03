'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { ShieldCheck, BadgeCheck, FileCheck, MapPin, Building2 } from 'lucide-react'
import { formatNumber } from '@/lib/aqar-format'
import { getGsap, prefersReducedMotion } from '@/lib/motion'
import RatingBadge from '@/components/store/rating-badge'

interface Office {
  name: string; advertiser_name: string; user_type?: string; city?: string | null
  is_phone_verified?: number; nafath_verified?: number; fal_license_number?: string | null
  listing_count: number; rating_avg?: number | null; review_count?: number
}
const TYPE_AR: Record<string, string> = { Individual: 'فرد', Broker: 'وسيط', Agency: 'منشأة' }

export default function OfficesGrid({ offices }: { offices: Office[] }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (prefersReducedMotion() || !ref.current) return
    let alive = true
    ;(async () => {
      const g = await getGsap()
      try { const st = await import('gsap/ScrollTrigger'); g.registerPlugin((st as any).ScrollTrigger || (st as any).default) } catch { /* */ }
      if (!alive || !ref.current) return
      const cards = ref.current.querySelectorAll('[data-office]')
      g.fromTo(cards, { y: 18, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.4, ease: 'power3.out', stagger: 0.05,
        scrollTrigger: { trigger: ref.current, start: 'top 85%', once: true },
      })
    })()
    return () => { alive = false }
  }, [])

  if (!offices.length) {
    return <div className="rounded-2xl border-2 border-dashed border-[var(--aqar-sand-2)] p-12 text-center text-[var(--aqar-kohl)]/50">لا توجد مكاتب بعد</div>
  }

  return (
    <div ref={ref} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {offices.map((o) => (
        <Link key={o.name} data-office href={`/advertiser/${o.name}`} className="aqar-card flex items-start gap-3 p-4 hover:border-[var(--aqar-green)]/40">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--aqar-green)]/10 text-lg font-bold text-[var(--aqar-green-d)]">
            {(o.advertiser_name || '؟').trim().charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 font-semibold text-[var(--aqar-kohl)]">{o.advertiser_name}</p>
            <p className="text-[11px] text-[var(--aqar-kohl)]/50">{TYPE_AR[o.user_type || ''] || 'معلن'}{o.city ? ` · ${o.city}` : ''}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {o.is_phone_verified ? <Badge icon={BadgeCheck} text="جوال" /> : null}
              {o.nafath_verified ? <Badge icon={ShieldCheck} text="نفاذ" /> : null}
              {o.fal_license_number ? <Badge icon={FileCheck} text="فال" /> : null}
              <RatingBadge ratingAvg={o.rating_avg} reviewCount={o.review_count} />
            </div>
          </div>
          <span className="flex shrink-0 flex-col items-center rounded-xl bg-[var(--aqar-sand-2)] px-2.5 py-1.5">
            <span className="text-base font-bold tabular-nums text-[var(--aqar-green-d)]">{formatNumber(o.listing_count, 'ar')}</span>
            <span className="flex items-center gap-0.5 text-[10px] text-[var(--aqar-kohl)]/50"><Building2 className="h-3 w-3" />إعلان</span>
          </span>
        </Link>
      ))}
    </div>
  )
}

function Badge({ icon: Icon, text }: { icon: typeof ShieldCheck; text: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--aqar-green)]/8 px-2 py-0.5 text-[10px] text-[var(--aqar-green-d)]">
      <Icon className="h-3 w-3" />{text}
    </span>
  )
}
