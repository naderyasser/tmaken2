'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { BrandMark } from '@/components/store/brand-mark'
import { toArabicIndic } from '@/lib/aqar-format'

const ar = (i: number) => toArabicIndic(String(i)) // Arabic-Indic numeral for labels/alt

interface GalleryImage { image?: string; webp_thumb?: string; is_primary?: number }

/** Interactive listing gallery: arrows + thumbnails + dots + keyboard + swipe + wrap-around + lightbox.
 *  RTL-correct: «السابقة» sits at the inline-start (right) pointing right; «التالية» at the inline-end
 *  (left) pointing left; ArrowLeft = next, ArrowRight = prev. Consumes the existing images array only. */
export default function ListingGallery({ images, title }: { images?: GalleryImage[]; title: string }) {
  const imgs = images || []
  const n = imgs.length
  const primaryIdx = imgs.findIndex((i) => i.is_primary)
  const [idx, setIdx] = useState(primaryIdx > 0 ? primaryIdx : 0)
  const [lightbox, setLightbox] = useState(false)
  const touchX = useRef<number | null>(null)

  const go = (d: number) => setIdx((i) => (i + d + n) % n) // wrap-around
  const next = () => go(1)
  const prev = () => go(-1)

  const onKey = (e: React.KeyboardEvent) => {
    if (n < 2) return
    if (e.key === 'ArrowLeft') { e.preventDefault(); next() }      // RTL: left advances
    else if (e.key === 'ArrowRight') { e.preventDefault(); prev() }
  }
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.changedTouches[0].clientX }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null || n < 2) return
    const dx = e.changedTouches[0].clientX - touchX.current
    if (Math.abs(dx) > 40) { if (dx < 0) next(); else prev() } // swipe left → next
    touchX.current = null
  }

  // lightbox: lock scroll + global arrow/escape keys
  useEffect(() => {
    if (!lightbox) return
    const onDocKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(false)
      else if (n > 1 && e.key === 'ArrowLeft') next()
      else if (n > 1 && e.key === 'ArrowRight') prev()
    }
    document.addEventListener('keydown', onDocKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onDocKey); document.body.style.overflow = prevOverflow }
  }, [lightbox, n]) // eslint-disable-line react-hooks/exhaustive-deps

  // zero images → existing branded placeholder
  if (n === 0) {
    return (
      <div className="aqar-card overflow-hidden">
        <div className="flex h-64 items-center justify-center bg-[var(--aqar-sand-2)]" role="img" aria-label="لا توجد صورة لهذا العقار">
          <BrandMark className="h-14 w-14 text-[var(--aqar-kohl)]/15" />
        </div>
      </div>
    )
  }

  const full = (im: GalleryImage) => im.image || im.webp_thumb || ''
  const thumb = (im: GalleryImage) => im.webp_thumb || im.image || ''
  const multi = n > 1

  return (
    <div className="aqar-card overflow-hidden">
      {/* main image (focusable for keyboard; swipe on touch) */}
      <div
        tabIndex={0}
        onKeyDown={onKey}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        aria-roledescription="معرض صور"
        aria-label={`صور العقار${multi ? `، صورة ${idx + 1} من ${n}` : ''}`}
        className="relative outline-none focus-visible:ring-2 focus-visible:ring-[var(--aqar-green)]"
      >
        <button type="button" onClick={() => setLightbox(true)} aria-label="فتح الصورة بملء الشاشة" className="block w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={full(imgs[idx])} alt={title} className="h-80 w-full object-cover" />
        </button>

        {multi && (
          <>
            <button
              type="button" onClick={prev} aria-label="الصورة السابقة"
              className="absolute top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--aqar-surface)]/90 text-[var(--aqar-kohl)] shadow transition-colors hover:bg-[var(--aqar-surface)] focus-visible:ring-2 focus-visible:ring-[var(--aqar-green)]"
              style={{ insetInlineStart: '0.5rem' }}
            ><ChevronRight className="h-5 w-5" /></button>
            <button
              type="button" onClick={next} aria-label="الصورة التالية"
              className="absolute top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--aqar-surface)]/90 text-[var(--aqar-kohl)] shadow transition-colors hover:bg-[var(--aqar-surface)] focus-visible:ring-2 focus-visible:ring-[var(--aqar-green)]"
              style={{ insetInlineEnd: '0.5rem' }}
            ><ChevronLeft className="h-5 w-5" /></button>

            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[var(--aqar-kohl)]/45 px-2 py-1">
              {imgs.map((_, i) => (
                <button
                  key={i} type="button" onClick={() => setIdx(i)} aria-label={`عرض الصورة رقم ${ar(i + 1)}`} aria-current={i === idx}
                  className={`h-2 rounded-full transition-all ${i === idx ? 'w-5 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* thumbnail strip */}
      {multi && (
        <div className="flex gap-2 overflow-x-auto p-2">
          {imgs.map((im, i) => (
            <button
              key={i} type="button" onClick={() => setIdx(i)} aria-label={`عرض الصورة رقم ${ar(i + 1)}`} aria-current={i === idx}
              className={`shrink-0 overflow-hidden rounded-lg border-2 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--aqar-green)] ${i === idx ? 'border-[var(--aqar-green)]' : 'border-transparent hover:border-[var(--aqar-green)]/40'}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumb(im)} alt={`${title} - صورة ${ar(i + 1)}`} loading="lazy" className="h-16 w-20 object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* full-screen lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4" role="dialog" aria-modal="true" aria-label="معرض الصور بملء الشاشة" onClick={() => setLightbox(false)}>
          <button type="button" onClick={() => setLightbox(false)} aria-label="إغلاق المعرض" className="absolute top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25" style={{ insetInlineEnd: '1rem' }}><X className="h-5 w-5" /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={full(imgs[idx])} alt={multi ? `${title} - صورة ${ar(idx + 1)}` : title} className="max-h-[85vh] max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} />
          {multi && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); prev() }} aria-label="الصورة السابقة" className="absolute top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25" style={{ insetInlineStart: '1rem' }}><ChevronRight className="h-6 w-6" /></button>
              <button type="button" onClick={(e) => { e.stopPropagation(); next() }} aria-label="الصورة التالية" className="absolute top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25" style={{ insetInlineEnd: '1rem' }}><ChevronLeft className="h-6 w-6" /></button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-3 py-1 text-sm tabular-nums text-white">{idx + 1} / {n}</div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
