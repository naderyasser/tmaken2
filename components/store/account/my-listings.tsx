'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Plus } from 'lucide-react'
import { accountApi, type MyListing } from '@/lib/account-api'
import { formatPrice } from '@/lib/aqar-format'
import ListingImage from '@/components/store/listing-image'

const STATUS: Record<string, { label: string; cls: string }> = {
  Active: { label: 'منشور', cls: 'bg-[var(--aqar-green)]/12 text-[var(--aqar-green-d)]' },
  'Pending License': { label: 'قيد المراجعة', cls: 'bg-[var(--aqar-gold)]/15 text-[var(--aqar-gold)]' },
  Draft: { label: 'مسودة', cls: 'bg-[var(--aqar-sand-2)] text-[var(--aqar-kohl)]/60' },
  Rejected: { label: 'مرفوض', cls: 'bg-[var(--aqar-clay)]/12 text-[var(--aqar-clay)]' },
  Expired: { label: 'منتهٍ', cls: 'bg-[var(--aqar-sand-2)] text-[var(--aqar-kohl)]/60' },
  Sold: { label: 'مُباع', cls: 'bg-[var(--aqar-bronze)]/15 text-[var(--aqar-bronze)]' },
}

export default function MyListings() {
  const [items, setItems] = useState<MyListing[] | null>(null)

  useEffect(() => { accountApi.myListings().then(setItems).catch(() => setItems([])) }, [])

  if (items === null) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[var(--aqar-green)]" /></div>

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--aqar-sand-2)] p-10 text-center">
        <p className="text-[var(--aqar-kohl)]/60">لا توجد إعلانات بعد.</p>
        <Link href="/post" className="aqar-btn mt-4 inline-flex"><Plus className="h-4 w-4" />أضف إعلانك الأول</Link>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {items.map((l) => {
        const st = STATUS[l.status || 'Draft'] || STATUS.Draft
        const clickable = l.status === 'Active'
        const inner = (
          <>
            <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-[var(--aqar-sand-2)]">
              <ListingImage src={l.primary_image} alt={l.title || ''} iconClassName="h-5 w-5" showLabel={false} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="line-clamp-1 text-sm font-medium text-[var(--aqar-kohl)]">{l.title}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.label}</span>
              </div>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-[var(--aqar-green-d)]">{formatPrice(l.price || 0, 'ar', l.listing_type)}</p>
              {l.status === 'Rejected' && l.rejection_reason && (
                <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--aqar-clay)]">سبب الرفض: {l.rejection_reason}</p>
              )}
              {typeof l.views_count === 'number' && l.status === 'Active' && (
                <p className="mt-0.5 text-[11px] text-[var(--aqar-kohl)]/45">{l.views_count} مشاهدة</p>
              )}
            </div>
          </>
        )
        return clickable ? (
          <Link key={l.name} href={`/listing/${l.name}`} className="flex items-center gap-3 rounded-2xl border border-[var(--aqar-border)] bg-[var(--aqar-surface)] p-2 transition-colors hover:border-[var(--aqar-green)]">{inner}</Link>
        ) : (
          <div key={l.name} className="flex items-center gap-3 rounded-2xl border border-[var(--aqar-border)] bg-[var(--aqar-surface)] p-2">{inner}</div>
        )
      })}
    </div>
  )
}
