'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Plus, Menu, X } from 'lucide-react'
import ThemeToggle from './theme-toggle'
import FavoritesLink from './favorites-link'
import AccountLink from './account-link'
import { BrandMark } from './brand-mark'

const BRAND = 'تمكين العقارية'

type NavItem = { label: string; href: string; match: (pathname: string, listingType: string | null) => boolean }

// Primary storefront navigation (RTL order). بيع/إيجارات are filtered search views;
// استثمار/إدارة عقارات/حراج عقارات are dedicated section pages.
const NAV: NavItem[] = [
  { label: 'الرئيسية', href: '/', match: (p) => p === '/' },
  { label: 'بيع', href: '/search?listing_type=Sale', match: (p, lt) => p === '/search' && lt === 'Sale' },
  { label: 'إيجارات', href: '/search?listing_type=Rent', match: (p, lt) => p === '/search' && lt === 'Rent' },
  { label: 'اطلب عقارك', href: '/request-property', match: (p) => p.startsWith('/request-property') },
  { label: 'استثمار', href: '/investment', match: (p) => p.startsWith('/investment') },
  { label: 'إدارة عقارات', href: '/property-management', match: (p) => p.startsWith('/property-management') },
  { label: 'إدارة العقود', href: '/contracts', match: (p) => p.startsWith('/contracts') },
  { label: 'حراج عقارات', href: '/auctions', match: (p) => p.startsWith('/auctions') },
]

export default function StoreNav() {
  const rawPathname = usePathname()
  // In marketplace mode the middleware rewrites `/x` → `/store/x`, so usePathname() can return the
  // `/store`-prefixed internal path. Normalize it back to the public path for active-state matching.
  const pathname = rawPathname.replace(/^\/store(?=\/|$)/, '') || '/'
  const searchParams = useSearchParams()
  const listingType = searchParams.get('listing_type')
  const [open, setOpen] = useState(false)

  // Close the mobile menu whenever the route or active purpose changes.
  useEffect(() => { setOpen(false) }, [pathname, listingType])

  return (
    <header className="aqar-header">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label={BRAND}>
          <BrandMark className="h-9 w-9 text-[var(--aqar-green)]" />
          <span className="aqar-brand">{BRAND}</span>
        </Link>

        {/* desktop primary nav (centered) */}
        <nav className="mx-auto hidden items-center gap-1 lg:flex">
          {NAV.map((it) => (
            <Link key={it.href} href={it.href} className={`aqar-nav-link${it.match(pathname, listingType) ? ' active' : ''}`}>
              {it.label}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex shrink-0 items-center gap-2 lg:ms-0">
          <FavoritesLink />
          <AccountLink />
          <ThemeToggle />
          <Link
            href="/post"
            className="hidden items-center gap-1.5 rounded-full bg-[var(--aqar-green)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--aqar-green-h)] sm:flex"
          >
            <Plus className="h-4 w-4" />أضف إعلانك
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="aqar-nav-burger lg:hidden"
            aria-label="القائمة"
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* mobile dropdown */}
      {open && (
        <nav className="aqar-nav-mobile lg:hidden">
          {NAV.map((it) => (
            <Link key={it.href} href={it.href} className={`aqar-nav-mobile-link${it.match(pathname, listingType) ? ' active' : ''}`}>
              {it.label}
            </Link>
          ))}
          <AccountLink mobile />
          <Link href="/post" className="aqar-nav-mobile-cta">
            <Plus className="h-4 w-4" />أضف إعلانك
          </Link>
        </nav>
      )}
    </header>
  )
}
