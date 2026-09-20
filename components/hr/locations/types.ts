/**
 * Shared types + constants for the «المواقع» (Apex M5, `hr/locations`) page.
 * Backed by `base_meena.api.hr_locations` — see that file for exact shapes.
 */

export interface LocationRow {
  name: string
  location_name: string
  parent_location?: string | null
  latitude?: number | null
  longitude?: number | null
  custom_radius_m?: number | null
  custom_status?: 'Active' | 'Inactive' | null
}

export interface LocationGroupOption {
  name: string
  location_name: string
}

export const LOCATION_STATUS_AR: Record<string, string> = { Active: 'نشط', Inactive: 'غير نشط' }

/** Riyadh — a sane default pin when a location has no coordinates yet. */
export const DEFAULT_LAT = 24.7136
export const DEFAULT_LNG = 46.6753
export const DEFAULT_RADIUS_M = 100
