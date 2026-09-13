'use client'

import { useState } from 'react'
import { BrandMark } from '@/components/store/brand-mark'

/** Unified listing thumbnail. Shows the property image, or a clean branded placeholder when the
 *  image is missing (no data) OR the file path is broken (onError). Always carries descriptive
 *  alt/aria text so no card ever renders an empty/broken icon. */
export default function ListingImage({
  src,
  alt,
  iconClassName = 'h-10 w-10',
  showLabel = true,
}: {
  src?: string | null
  alt: string
  iconClassName?: string
  showLabel?: boolean
}) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label="لا توجد صورة لهذا العقار"
        className="flex h-full w-full flex-col items-center justify-center gap-1 bg-[var(--aqar-sand-2)] text-[var(--aqar-kohl)]/25"
      >
        <BrandMark className={iconClassName} />
        {showLabel ? <span className="text-[10px] font-medium">لا توجد صورة</span> : null}
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className="h-full w-full object-cover"
      loading="lazy"
    />
  )
}
