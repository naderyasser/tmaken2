'use client'

/**
 * Per-tenant sales-rep (المناديب) feature flags.
 *
 * The rep PWA hides certain features per tenant (e.g. a sales-only مناديب client
 * with no cash collection / wallet). The set of HIDDEN feature keys comes from the
 * tenant's site_config (`sales_rep_hidden_features`), surfaced by the /sales-brand
 * route. Unset/empty = show everything, so existing tenants are unaffected.
 *
 * Known feature keys: "wallet", "payments", "samples".
 */

import { useEffect, useState } from 'react'

// Module-level cache so repeated navigations don't re-fetch (and don't re-flicker).
let cache: Promise<Set<string>> | null = null

function loadHiddenFeatures(): Promise<Set<string>> {
  if (cache) return cache
  cache = fetch('/sales-brand')
    .then((r) => (r.ok ? r.json() : null))
    .then((b) => new Set<string>(Array.isArray(b?.hiddenFeatures) ? b.hiddenFeatures : []))
    .catch(() => new Set<string>())
  return cache
}

/** Reactive set of hidden rep-app feature keys for the current tenant. */
export function useHiddenRepFeatures(): Set<string> {
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  useEffect(() => {
    let mounted = true
    loadHiddenFeatures().then((s) => { if (mounted) setHidden(s) })
    return () => { mounted = false }
  }, [])
  return hidden
}
