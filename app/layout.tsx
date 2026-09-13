import React from "react"
import type { Metadata } from 'next'
import { Inter, IBM_Plex_Sans_Arabic, Noto_Nastaliq_Urdu, Amiri } from 'next/font/google'

import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const ibmPlexArabic = IBM_Plex_Sans_Arabic({ subsets: ['arabic'], variable: '--font-arabic', weight: ['400', '500', '600', '700'] })
// Urdu (sales vertical language option). Nastaliq is the correct script style for
// Urdu; applied only under html[lang="ur"] (globals.css) with a taller line-height.
const notoNastaliqUrdu = Noto_Nastaliq_Urdu({ subsets: ['arabic'], variable: '--font-urdu', weight: ['400', '500', '600', '700'] })
// Amiri — classic Naskh calligraphic face for لذعة (Laz'ah) headings. Exposed as a CSS
// var ONLY; nothing applies it except `.theme-lazaa h1/h2/h3` (globals.css), so every
// other tenant's typography is untouched.
const amiriNaskh = Amiri({ subsets: ['arabic'], variable: '--font-naskh', weight: ['400', '700'] })

export const metadata: Metadata = {
  title: 'تمكين - Human Resources Management',
  description: 'Modern HR management system powered by Frappe HRMS',
}

// Root layout = html/body/fonts only. The heavy client Providers (i18n dictionary +
// frappeClient) and the Radix Toaster live in app/(erp)/layout.tsx so they ship to the
// back-office routes but NOT to the public storefront (app/store/**).
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // lang/dir here are the Arabic-first SSR DEFAULT (matches the Arabic-only public
  // store and avoids a hydration flip for the common case). They are NOT static:
  // I18nProvider (lib/i18n.tsx) reactively rewrites document.documentElement.lang
  // and .dir to follow the active UI locale — ar→rtl, en→ltr — flipping the whole
  // layout, not just text alignment. suppressHydrationWarning permits that rewrite.
  // (See i18n-html-lang-dir.test.tsx for the locked behavior.)
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${inter.variable} ${ibmPlexArabic.variable} ${notoNastaliqUrdu.variable} ${amiriNaskh.variable}`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
