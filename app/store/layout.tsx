import type { ReactNode } from 'react'
import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Amiri, Tajawal } from 'next/font/google'
import { ShieldCheck, MapPin, MessageCircle, Phone } from 'lucide-react'
import StoreHtmlLang from '@/components/store/store-html-lang'
import StoreNav from '@/components/store/store-nav'
import CompareBar from '@/components/store/compare-bar'
import AccountSync from '@/components/store/account-sync'
import { BrandMark } from '@/components/store/brand-mark'
import { SocialLinks } from '@/components/store/social-icons'
import { store } from '@/lib/frappe-server'
import './store.css'

const SITE_URL = process.env.NEXT_PUBLIC_STORE_URL ?? ''
const BRAND = 'تمكين العقارية'

// Pre-paint theme (no FOUC) WITHOUT making the page dynamic: a blocking inline script —
// rendered as the FIRST CHILD of the store root — adds `dark` to that root before the
// subtree paints. Source of truth: cookie `aqar-theme` (survives across devices/tools and
// is what the e2e suite asserts), falling back to the legacy localStorage key, then the
// OS prefers-color-scheme. Pages stay static/ISR (no server-side cookie reads).
const NO_FOUC = `(function(){try{var r=document.currentScript.parentElement;var m=document.cookie.match(/(?:^|;\\s*)aqar-theme=(dark|light)/);var t=m?m[1]:null;if(!t){try{t=localStorage.getItem('aqar_theme')}catch(e){}}var dark=t?t==='dark':(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(dark)r.classList.add('dark');document.documentElement.setAttribute('data-theme',dark?'dark':'light');}catch(e){}})();`

// Display = modern geometric Saudi (hero + big headlines). Calligraphy = wordmark only.
const tajawal = Tajawal({ subsets: ['arabic'], weight: ['400', '500', '700'], variable: '--font-display' })
// Amiri is used ONLY for the calligraphic wordmark «تمكين العقارية» (one bold string),
// so subset it to exactly those glyphs at weight 700. This drops it from ~208 KB
// (two full Arabic weights) to a few KB — the wordmark still renders identically.
const amiri = Amiri({
  weight: '700',
  subsets: ['arabic'],
  text: 'تمكين العقارية',
  display: 'swap',
  variable: '--font-calligraphy',
})

const DESCRIPTION = 'سوق عقاري سعودي موثّق وفق نظام الهيئة العامة للعقار. شقق، فلل، أراضي، عمائر، استراحات ومزارع للبيع والإيجار.'

export const metadata: Metadata = {
  ...(SITE_URL ? { metadataBase: new URL(SITE_URL) } : {}),
  title: 'تمكين العقارية — سوق العقارات',
  description: DESCRIPTION,
  manifest: '/brand/site.webmanifest',
  icons: {
    icon: [
      { url: '/brand/favicon.ico', sizes: 'any' },
      { url: '/brand/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/brand/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/brand/apple-touch-icon.png', sizes: '180x180' }],
  },
  openGraph: {
    type: 'website',
    locale: 'ar_SA',
    siteName: 'تمكين العقارية',
    title: 'تمكين العقارية — سوق العقارات',
    description: DESCRIPTION,
    images: [{ url: '/brand/og-image.png', width: 1200, height: 630, alt: 'تمكين العقارية' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'تمكين العقارية — سوق العقارات',
    description: DESCRIPTION,
    images: ['/brand/og-image.png'],
  },
}

// Site-wide Organization JSON-LD (logo points at the brand app icon).
const ORG_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: BRAND,
  ...(SITE_URL ? { url: SITE_URL, logo: `${SITE_URL}/brand/icon-512.png` } : {}),
}

// footer link clusters — quick links, services, legal
const FOOTER_QUICK = [
  { href: '/', label: 'الرئيسية' },
  { href: '/search', label: 'بحث' },
  { href: '/offices', label: 'المكاتب' },
  { href: '/post', label: 'أضف إعلانك' },
  { href: '/request-property', label: 'اطلب عقارك' },
  { href: '/interest', label: 'سجّل اهتمامك' },
]
const FOOTER_SERVICES = [
  { href: '/investment', label: 'الاستثمار العقاري' },
  { href: '/property-management', label: 'إدارة الأملاك' },
  { href: '/contracts', label: 'إدارة العقود' },
  { href: '/auctions', label: 'حراج العقارات' },
  { href: '/marketing', label: 'التسويق العقاري' },
  { href: '/partnership', label: 'تحالفات عقارية' },
]
const FOOTER_LEGAL = [
  { href: '/about', label: 'من نحن' },
  { href: '/privacy', label: 'سياسة الخصوصية' },
  { href: '/terms', label: 'الشروط والأحكام' },
  { href: '/contact', label: 'اتصل بنا' },
]

// fallback when the backend is unreachable at render time (matches backend defaults)
const DEFAULT_CHANNELS: Record<string, string> = {
  phone: '+966553275000',
  whatsapp: 'https://wa.me/966553275000',
}

export default async function StoreLayout({ children }: { children: ReactNode }) {
  const channels = (await store.contactChannels().catch(() => null)) || DEFAULT_CHANNELS
  return (
    <div
      className={`aqar-store ${tajawal.variable} ${amiri.variable}`}
      dir="rtl"
      suppressHydrationWarning
    >
      {/* No-FOUC: runs before the subtree paints (cookie, else prefers-color-scheme) */}
      <script dangerouslySetInnerHTML={{ __html: NO_FOUC }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSONLD) }} />
      <StoreHtmlLang />
      {/* Sadu accent strip */}
      <div className="aqar-sadu" aria-hidden />

      <Suspense fallback={
        <header className="aqar-header">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
            <span className="flex items-center gap-2.5">
              <BrandMark className="h-9 w-9 text-[var(--aqar-green)]" />
              <span className="aqar-brand">{BRAND}</span>
            </span>
          </div>
        </header>
      }>
        <StoreNav />
      </Suspense>

      <main className="aqar-main">{children}</main>

      <footer className="aqar-footer">
        <div className="mx-auto max-w-6xl px-4 py-10 text-sm">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* brand + description + direct contact */}
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2">
                <BrandMark className="h-7 w-7 text-white" />
                <p className="aqar-brand text-lg">{BRAND}</p>
              </div>
              <p className="mt-2 max-w-xs text-xs leading-6 text-white/65">
                سوق عقاري سعودي موثّق وفق نظام الهيئة العامة للعقار — بيع، إيجار، استثمار،
                مزادات، وإدارة أملاك، مع طلبات عقارية يبحث عنها فريقنا نيابة عنك.
              </p>
              {channels.phone && (
                <a href={`tel:${channels.phone}`} className="mt-3 inline-flex items-center gap-1.5 font-bold text-white hover:underline" dir="ltr">
                  <Phone className="h-4 w-4" />{channels.phone.replace('+966', '0')}
                </a>
              )}
              <SocialLinks channels={channels} className="mt-3" />
            </div>

            <nav aria-label="روابط سريعة">
              <p className="mb-3 font-bold text-white">روابط سريعة</p>
              <ul className="space-y-2 text-white/75">
                {FOOTER_QUICK.map((l) => (
                  <li key={l.href}><Link href={l.href} className="hover:text-white">{l.label}</Link></li>
                ))}
              </ul>
            </nav>

            <nav aria-label="خدماتنا">
              <p className="mb-3 font-bold text-white">خدماتنا</p>
              <ul className="space-y-2 text-white/75">
                {FOOTER_SERVICES.map((l) => (
                  <li key={l.href}><Link href={l.href} className="hover:text-white">{l.label}</Link></li>
                ))}
              </ul>
            </nav>

            <nav aria-label="روابط قانونية">
              <p className="mb-3 font-bold text-white">المنصة</p>
              <ul className="space-y-2 text-white/75">
                {FOOTER_LEGAL.map((l) => (
                  <li key={l.href}><Link href={l.href} className="hover:text-white">{l.label}</Link></li>
                ))}
              </ul>
              <p className="mt-4 flex items-start gap-1.5 text-xs leading-5 text-white/55">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />جميع الإعلانات موثّقة وفق نظام الهيئة العامة للعقار
              </p>
            </nav>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4 text-xs text-white/50">
            <p className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />الرياض، المملكة العربية السعودية
            </p>
            <p>© {new Date().getFullYear()} {BRAND} — جميع الحقوق محفوظة</p>
          </div>
        </div>
      </footer>

      {/* Persistent help — opens WhatsApp support. Bottom-end so it clears the search map pill. */}
      <a
        href="https://wa.me/966553275000?text=السلام%20عليكم،%20أحتاج%20مساعدة%20في%20منصة%20تمكين%20العقارية"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="محتاج مساعدة؟ تواصل عبر واتساب"
        className="fixed bottom-5 z-40 flex min-h-[48px] items-center gap-2 rounded-full bg-[#1FA855] px-4 text-sm font-bold text-white shadow-lg hover:bg-[#1a9249]"
        style={{ insetInlineEnd: '1rem' }}
      >
        <MessageCircle className="h-5 w-5" />محتاج مساعدة؟
      </a>

      {/* Sticky compare bar (localStorage-backed; hidden when empty) */}
      <CompareBar />

      {/* Cross-device favorites + saved-search sync — inert until the accounts flag is on */}
      <AccountSync />
    </div>
  )
}
