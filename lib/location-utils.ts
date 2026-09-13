/**
 * Location tracking utility functions
 * Calculations for distance, speed, duration, etc.
 */

export interface LocationPoint {
  latitude: number
  longitude: number
  log_datetime: string
  accuracy?: number
  address?: string
  name?: string
}

export interface TrackStats {
  totalPoints: number
  totalDistanceKm: number
  durationHours: number
  durationMinutes: number
  avgSpeedKmh: number
  firstTime: string
  lastTime: string
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Calculate total distance of a track
 */
export function calculateTotalDistance(locations: LocationPoint[]): number {
  let total = 0
  for (let i = 1; i < locations.length; i++) {
    total += calculateDistance(
      locations[i - 1].latitude,
      locations[i - 1].longitude,
      locations[i].latitude,
      locations[i].longitude
    )
  }
  return total
}

/**
 * Calculate full track statistics
 */
export function calculateTrackStats(locations: LocationPoint[]): TrackStats {
  if (locations.length === 0) {
    return {
      totalPoints: 0,
      totalDistanceKm: 0,
      durationHours: 0,
      durationMinutes: 0,
      avgSpeedKmh: 0,
      firstTime: "",
      lastTime: "",
    }
  }

  const totalDistanceKm = calculateTotalDistance(locations)

  const firstTime = new Date(locations[0].log_datetime)
  const lastTime = new Date(locations[locations.length - 1].log_datetime)
  const durationMs = lastTime.getTime() - firstTime.getTime()
  const durationHours = Math.floor(durationMs / 3600000)
  const durationMinutes = Math.floor((durationMs % 3600000) / 60000)
  const totalHours = durationMs / 3600000

  const avgSpeedKmh = totalHours > 0 ? totalDistanceKm / totalHours : 0

  return {
    totalPoints: locations.length,
    totalDistanceKm,
    durationHours,
    durationMinutes,
    avgSpeedKmh,
    firstTime: locations[0].log_datetime,
    lastTime: locations[locations.length - 1].log_datetime,
  }
}

/**
 * Format time in Arabic locale
 */
export function formatTimeAr(datetime: string): string {
  return new Date(datetime).toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

/**
 * Employee track colors for multi-employee view
 */
export const TRACK_COLORS = [
  "#ef4444", // red
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#6366f1", // indigo
  "#06b6d4", // cyan
]
