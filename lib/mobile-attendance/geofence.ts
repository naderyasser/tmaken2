/**
 * Punch geofence — client for `base_meena.mobile_attendance.geofence`.
 *
 * The server is the only authority: `Employee Checkin.validate` rejects an
 * out-of-radius punch no matter what this file says. Everything here exists so the
 * employee learns the rule BEFORE the ceremony instead of after it — knowing you are
 * 3 km away is worth more than a passkey prompt followed by a rejection.
 *
 * Distances use the same haversine the server enforces with, so the metres shown here
 * and the metres in a server rejection cannot disagree.
 *
 * Feature-flag-safe: on a tenant without `site_config.punch_geofence` (and on a 404
 * from an older backend) `getMyGeofence` resolves to `{ feature_enabled: false }` and
 * every caller renders nothing.
 */

import { frappeClient } from '@/lib/api-client'

const MOD = 'base_meena.mobile_attendance.geofence'

export interface PunchGeofence {
  feature_enabled: boolean
  enabled: boolean
  /** true when the server will let this employee through regardless (HR Manager) */
  exempt?: boolean
  source?: 'branch' | 'shift_location'
  label?: string
  latitude?: number
  longitude?: number
  radius_m?: number
  geolocation_required?: boolean
  reason?: 'not_configured'
}

export interface BranchGeofence {
  branch: string
  company: string
  enabled: boolean
  latitude: number | null
  longitude: number | null
  radius_m: number
  employee_count: number
}

export interface GeofenceCoverage {
  feature_enabled: boolean
  total?: number
  covered?: { employee: string; employee_name: string; label: string; radius_m: number }[]
  uncovered?: {
    employee: string
    employee_name: string
    reason: 'no_branch' | 'branch_not_configured' | 'exempt_hr_manager'
  }[]
}

const OFF: PunchGeofence = { feature_enabled: false, enabled: false }

/** Metres between two WGS-84 points (haversine — mirrors hrms' server-side formula). */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const p1 = toRad(lat1)
  const p2 = toRad(lat2)
  const dp = toRad(lat2 - lat1)
  const dl = toRad(lon2 - lon1)
  const a =
    Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** "٨٥ م" / "1.4 km" — a distance a human reads at a glance. */
export function formatDistance(m: number, isRTL: boolean): string {
  if (m < 1000) return isRTL ? `${Math.round(m)} م` : `${Math.round(m)} m`
  return isRTL ? `${(m / 1000).toFixed(1)} كم` : `${(m / 1000).toFixed(1)} km`
}

/**
 * Is this position allowed to punch? `null` fence / disabled / exempt => yes.
 * Mirrors the server: `distance > radius` rejects, so equality is inside.
 */
export function isInsideFence(
  fence: PunchGeofence | null,
  pos: { latitude: number; longitude: number } | null,
): { applies: boolean; inside: boolean; distance: number | null } {
  if (!fence?.enabled || fence.exempt || fence.latitude == null || fence.longitude == null) {
    return { applies: false, inside: true, distance: null }
  }
  if (!pos) return { applies: true, inside: false, distance: null }
  const distance = distanceMeters(fence.latitude, fence.longitude, pos.latitude, pos.longitude)
  return { applies: true, inside: distance <= (fence.radius_m ?? 0), distance }
}

/** Thrown when the punch is stopped locally — carries the numbers for the message. */
export class OutsideGeofenceError extends Error {
  distance: number
  radius: number
  label: string
  en: string
  ar: string
  constructor(distance: number, radius: number, label: string) {
    const en = `You are ${Math.round(distance)} m from ${label}. You must be within ${radius} m to punch.`
    super(en)
    this.name = 'OutsideGeofenceError'
    this.distance = distance
    this.radius = radius
    this.label = label
    this.en = en
    this.ar = `أنت على بُعد ${Math.round(distance)} م من ${label}. يجب أن تكون داخل ${radius} م لتسجيل الحضور.`
  }
}

export async function getMyGeofence(pos?: { latitude: number; longitude: number }): Promise<PunchGeofence> {
  try {
    const r = await frappeClient.call(`${MOD}.get_my_punch_geofence`, pos ? {
      latitude: pos.latitude,
      longitude: pos.longitude,
    } : {})
    return ((r as any)?.message as PunchGeofence) || OFF
  } catch {
    // endpoint missing (older backend) or no linked employee — stay inert
    return OFF
  }
}

export async function getBranchGeofences(company?: string): Promise<{
  feature_enabled: boolean
  default_radius_m?: number
  geolocation_tracking?: boolean
  branches: BranchGeofence[]
}> {
  try {
    const r = await frappeClient.call(`${MOD}.get_branch_geofences`, company ? { company } : {})
    return ((r as any)?.message as any) || { feature_enabled: false, branches: [] }
  } catch {
    return { feature_enabled: false, branches: [] }
  }
}

export async function saveBranchGeofence(args: {
  branch: string
  latitude?: number | null
  longitude?: number | null
  radius_m?: number
  enabled: boolean
}): Promise<BranchGeofence> {
  const r = await frappeClient.call(`${MOD}.save_branch_geofence`, {
    branch: args.branch,
    latitude: args.latitude ?? null,
    longitude: args.longitude ?? null,
    radius_m: args.radius_m ?? null,
    enabled: args.enabled ? 1 : 0,
  })
  return (r as any)?.message as BranchGeofence
}

export async function getGeofenceCoverage(): Promise<GeofenceCoverage> {
  try {
    const r = await frappeClient.call(`${MOD}.get_geofence_coverage`)
    return ((r as any)?.message as GeofenceCoverage) || { feature_enabled: false }
  } catch {
    return { feature_enabled: false }
  }
}

/**
 * Pull coordinates out of whatever the user pasted: a Google Maps URL
 * (`/@26.35,43.95,17z`, `!3d26.35!4d43.95`, `?q=26.35,43.95`) or a bare
 * "lat, lng" pair. Returns null when nothing usable is found.
 *
 * A maps.app.goo.gl SHORT link carries no coordinates — it has to be opened first —
 * so callers must tell the user to open it and paste the full URL.
 */
export function parseCoordinates(input: string): { latitude: number; longitude: number } | null {
  const s = (input || '').trim()
  if (!s) return null

  const valid = (lat: number, lon: number) =>
    Number.isFinite(lat) && Number.isFinite(lon) &&
    Math.abs(lat) <= 90 && Math.abs(lon) <= 180 &&
    // 0,0 is in the Atlantic — always a parse artefact here, never a real office.
    !(lat === 0 && lon === 0)
      ? { latitude: lat, longitude: lon }
      : null

  // The place pin: !3d<lat>!4d<lng> — more precise than the @ viewport centre.
  const pin = s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
  if (pin) {
    const hit = valid(parseFloat(pin[1]), parseFloat(pin[2]))
    if (hit) return hit
  }

  // Viewport centre: /@<lat>,<lng>,<zoom>z
  const at = s.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
  if (at) {
    const hit = valid(parseFloat(at[1]), parseFloat(at[2]))
    if (hit) return hit
  }

  // ?q=<lat>,<lng> / &query=<lat>,<lng>
  const q = s.match(/[?&](?:q|query|ll|center|destination)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
  if (q) {
    const hit = valid(parseFloat(q[1]), parseFloat(q[2]))
    if (hit) return hit
  }

  // Bare "lat, lng"
  const bare = s.match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/)
  if (bare) {
    const hit = valid(parseFloat(bare[1]), parseFloat(bare[2]))
    if (hit) return hit
  }

  return null
}

/** True for a shortened Google Maps link, which never contains coordinates. */
export function isShortMapsLink(input: string): boolean {
  return /(?:maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(input || '')
}
