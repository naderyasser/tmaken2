'use client'

/**
 * Tenant feature flags (the Owner Delight pack) — the client half of the gate.
 *
 * The backend already refuses a disabled feature, but it refuses by *throwing*:
 * every flagged endpoint answers a disabled tenant with 417 ValidationError. So a
 * dashboard that renders its flagged sections unconditionally fires one failed
 * request per section on every single load — seven of them on qarawi, where the
 * whole pack is off. Nothing breaks visually (each section swallows its error),
 * but the console fills with red and the tenant pays for seven round-trips that
 * can only ever fail.
 *
 * Ask once, up front, and render only what the tenant actually has.
 *
 * Backend: `base_meena.api.feature_flags.get_enabled_features` → { key: bool }
 * for every known key, so a missing key means OFF rather than "unknown".
 */

import { useEffect, useState } from 'react'
import frappeClient from '@/lib/api-client'

export type FeatureFlags = Record<string, boolean>

/** Shared across every caller so N sections cost one request, not N. */
let inflight: Promise<FeatureFlags> | null = null

export function loadFeatureFlags(): Promise<FeatureFlags> {
  if (!inflight) {
    inflight = frappeClient
      .call('base_meena.api.feature_flags.get_enabled_features')
      // A backend without the endpoint (older tenant) means the pack was never
      // installed there — treat that as "everything off", same as the server does.
      .then((r) => (r?.message || {}) as FeatureFlags)
      .catch(() => ({} as FeatureFlags))
  }
  return inflight
}

/** Forget the cached map — call after toggling a flag so the UI re-reads it. */
export function resetFeatureFlags(): void {
  inflight = null
}

/**
 * `loaded` matters: until the map arrives every flag reads false, and a section
 * gated on `flags.x` alone would flash in and out. Gate on `loaded && flags.x`.
 */
export function useFeatureFlags(): { flags: FeatureFlags; loaded: boolean } {
  const [flags, setFlags] = useState<FeatureFlags>({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    loadFeatureFlags().then((f) => {
      if (!alive) return
      setFlags(f)
      setLoaded(true)
    })
    return () => { alive = false }
  }, [])

  return { flags, loaded }
}
