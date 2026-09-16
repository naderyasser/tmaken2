'use client'

import { useEffect } from 'react'
import { AUTO_PARAM } from '@/lib/public-access'

/**
 * Housekeeping for the login-free session bounce: the walkthrough endpoint sends
 * visitors back with `?_auto=1` (the middleware's loop guard). Once the page is
 * up that marker has done its job, so drop it from the address bar without a
 * navigation. Session renewal itself lives in LoginPage / lib/public-access.ts.
 */
export function WalkthroughSession() {
  useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has(AUTO_PARAM)) return
    url.searchParams.delete(AUTO_PARAM)
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  }, [])
  return null
}
