/**
 * Tamkeen Go — G1 geolocation helper.
 *
 * A thin promise wrapper around navigator.geolocation.getCurrentPosition using
 * the same options as hooks/use-gps-broadcaster.ts (enableHighAccuracy, 15s
 * timeout, 30s max age). Throws a typed, bilingual GeoError on failure so the
 * punch UI can render a clear message. Must be called from a user gesture —
 * the browser only prompts for permission in response to one.
 */

export type GeoErrorCode = 'unsupported' | 'denied' | 'unavailable' | 'timeout' | 'unknown'

export class GeoError extends Error {
  code: GeoErrorCode
  en: string
  ar: string
  constructor(code: GeoErrorCode, en: string, ar: string) {
    super(en)
    this.name = 'GeoError'
    this.code = code
    this.en = en
    this.ar = ar
  }
}

export interface GeoPosition {
  latitude: number
  longitude: number
  accuracy: number
}

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 30_000,
}

export function getCurrentPosition(): Promise<GeoPosition> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    return Promise.reject(
      new GeoError('unsupported', 'Location is not available on this device.', 'تحديد الموقع غير متاح على هذا الجهاز.'),
    )
  }

  return new Promise<GeoPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => {
        // GeolocationPositionError codes: 1 PERMISSION_DENIED, 2 POSITION_UNAVAILABLE, 3 TIMEOUT
        if (err.code === err.PERMISSION_DENIED) {
          reject(new GeoError('denied', 'Location permission was denied. Enable it to punch.', 'تم رفض إذن الموقع. فعّله للتسجيل.'))
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          reject(new GeoError('unavailable', 'Your location could not be determined.', 'تعذّر تحديد موقعك.'))
        } else if (err.code === err.TIMEOUT) {
          reject(new GeoError('timeout', 'Getting your location took too long. Try again.', 'استغرق تحديد موقعك وقتًا طويلًا. حاول مجددًا.'))
        } else {
          reject(new GeoError('unknown', err.message || 'Could not get your location.', 'تعذّر الحصول على موقعك.'))
        }
      },
      GEO_OPTIONS,
    )
  })
}
