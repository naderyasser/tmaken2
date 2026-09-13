'use client'

/**
 * Client demo kiosk — the UI half of /client-demo.
 *
 * A same-origin shell around the real Tamkeen HRMS app (served by Frappe at
 * /hrms). The session is guaranteed server-side before this renders, so the
 * iframe never shows a login form. This component only:
 *   - reloads the embedded app every 60s (the client never refreshes manually)
 *   - hides the account/profile menu and any Log Out control, and blocks
 *     navigation to profile/settings so the client cannot get lost.
 */

import { useEffect, useRef } from 'react'

const REFRESH_MS = 60_000

// Account / settings entry points rendered by the HRMS app (BaseLayout header
// avatar → /hrms/profile, and any settings link). Hidden via injected CSS so
// they never paint, even before the MutationObserver runs.
const HIDE_SELECTORS = [
  'a[href$="/hrms/profile"]',
  'a[href$="/profile"]',
  'a[href*="/hrms/profile"]',
  'a[href*="/settings"]',
  'a[href*="/app-settings"]',
]

// The "Log Out" control on the profile page (English + Arabic).
const HIDE_TEXT = /^(log ?out|sign ?out|logout|تسجيل الخروج|تسجيل خروج|الخروج)$/i
// Navigation we refuse to follow even if a control slips through.
const BLOCKED_HREF = /\/(hrms\/)?profile|\/settings|app-settings|logout/i

// The HRMS header date is hardcoded to the `en` locale in BaseLayout.vue, which
// leaves "Sun, Sep 13" sitting in an otherwise-Arabic header. Rewrite just that
// one node to the Arabic locale (scoped to the header so real data dates are
// untouched).
const EN_SHORT_DATE = /^[A-Za-z]{3}, [A-Za-z]{3} \d{1,2}$/
const AR_DATE_OPTS: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }

function forceArabicDirection(doc: Document) {
  const html = doc.documentElement
  if (html.getAttribute('lang') !== 'ar') html.setAttribute('lang', 'ar')
  if (html.getAttribute('dir') !== 'rtl') html.setAttribute('dir', 'rtl')
  doc.body?.setAttribute('dir', 'rtl')
}

function localizeHeaderDate(doc: Document) {
  const header = doc.querySelector('.app-gradient-header')
  if (!header) return
  for (const el of header.querySelectorAll('p, span')) {
    const text = (el.textContent || '').trim()
    if (el.children.length === 0 && EN_SHORT_DATE.test(text)) {
      try {
        el.textContent = new Date().toLocaleDateString('ar', AR_DATE_OPTS)
      } catch {
        /* locale unsupported — leave as-is */
      }
    }
  }
}

export default function ClientDemoKiosk() {
  const frameRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return

    let observer: MutationObserver | null = null
    let styleEl: HTMLStyleElement | null = null

    const stripClutter = () => {
      const doc = frame.contentDocument
      if (!doc) return

      // 0. Guarantee Arabic + RTL regardless of what the app resolved.
      forceArabicDirection(doc)
      localizeHeaderDate(doc)

      // 1. Inject the hiding stylesheet once per document.
      if (!doc.getElementById('cd-kiosk-style')) {
        styleEl = doc.createElement('style')
        styleEl.id = 'cd-kiosk-style'
        styleEl.textContent = `${HIDE_SELECTORS.join(',')}{display:none !important;visibility:hidden !important;}`
        ;(doc.head || doc.documentElement)?.appendChild(styleEl)
      }

      // 2. Sweep any logout/account control that CSS selectors can't name
      //    (localised labels, dynamically mounted menus).
      for (const el of doc.querySelectorAll('button, a, [role="button"], [role="menuitem"]')) {
        const text = (el.textContent || '').trim()
        const href = el.getAttribute('href') || ''
        if (HIDE_TEXT.test(text) || BLOCKED_HREF.test(href)) {
          ;(el as HTMLElement).style.setProperty('display', 'none', 'important')
        }
      }
    }

    const blockNavigation = (event: Event) => {
      const target = event.target as HTMLElement | null
      const anchor = target?.closest?.('a')
      const text = (target?.textContent || '').trim()
      const href = anchor?.getAttribute('href') || ''
      if (HIDE_TEXT.test(text) || BLOCKED_HREF.test(href)) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    const onLoad = () => {
      stripClutter()
      const doc = frame.contentDocument
      if (!doc) return
      observer?.disconnect()
      observer = new MutationObserver(stripClutter)
      observer.observe(doc.documentElement, { childList: true, subtree: true })
      doc.removeEventListener('click', blockNavigation, true)
      doc.addEventListener('click', blockNavigation, true)
    }

    frame.addEventListener('load', onLoad)
    if (frame.contentDocument?.readyState === 'complete') onLoad()

    // Keep the screen fresh without the client ever touching the browser.
    const timer = window.setInterval(() => {
      try {
        frame.contentWindow?.location.reload()
      } catch {
        /* iframe not ready yet — next tick */
      }
    }, REFRESH_MS)

    return () => {
      window.clearInterval(timer)
      observer?.disconnect()
      frame.removeEventListener('load', onLoad)
      frame.contentDocument?.removeEventListener('click', blockNavigation, true)
    }
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        margin: 0,
        background: '#ffffff',
        overflow: 'hidden',
      }}
    >
      <iframe
        ref={frameRef}
        src="/hrms"
        title="HRMS demo"
        style={{ border: 0, width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  )
}
