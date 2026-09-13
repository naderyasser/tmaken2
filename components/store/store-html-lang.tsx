'use client'

import { useEffect } from 'react'

/** Public storefront is Arabic-first: set <html lang="ar" dir="rtl"> (the shared ERP root
 * layout defaults to en/ltr). Improves SEO + screen-reader + browser-translate behaviour. */
export default function StoreHtmlLang() {
  useEffect(() => {
    document.documentElement.lang = 'ar'
    document.documentElement.dir = 'rtl'
  }, [])
  return null
}
