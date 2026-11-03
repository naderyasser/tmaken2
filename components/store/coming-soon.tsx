import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { BrandMark } from './brand-mark'

/** Branded "coming soon" section — same green/cream identity, RTL. */
export default function ComingSoon({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children?: ReactNode
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:py-20">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-[var(--aqar-green)]/10">
        <BrandMark className="h-11 w-11 text-[var(--aqar-green)]" />
      </div>
      <div className="mb-4 flex justify-center">
        <span className="aqar-chip border-[var(--aqar-green)]/40 text-[var(--aqar-green-d)]">قريباً</span>
      </div>
      <h1 className="aqar-display text-3xl text-[var(--aqar-green-d)] sm:text-4xl">{title}</h1>
      <p className="mx-auto mt-4 max-w-xl leading-8 text-[var(--aqar-kohl)]/70">{subtitle}</p>

      {children ? (
        <div className="mt-8 rounded-2xl border border-[var(--aqar-border)] bg-[var(--aqar-surface)] p-5 text-start shadow-sm sm:p-6">
          {children}
        </div>
      ) : null}

      <Link
        href="/search"
        className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--aqar-green)] hover:underline"
      >
        تصفّح العروض الحالية <ArrowLeft className="h-4 w-4" />
      </Link>
    </div>
  )
}
