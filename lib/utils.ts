import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns today's date as an ISO string (YYYY-MM-DD) using the **local**
 * calendar date, not UTC. Avoids the classic toISOString() bug where after
 * 21:00 in UTC+3 the returned date is already "yesterday" in UTC.
 */
export function localToday(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Resolves a Frappe relative file URL (e.g. "/files/photo.jpg" or
 * "/private/files/x.jpg") to a directly-openable URL.
 *
 * The frontend and Frappe backend share the same origin, so we link DIRECTLY to the
 * file: the browser sends the session cookie and Frappe serves /files/ and
 * /private/files/ (images inline) after its own permission check. We deliberately do
 * NOT use the /api/frappe Next.js proxy here — in production nginx routes /api/* to
 * Frappe, so /api/frappe never reaches Next.js and 404s.
 */
export function frappeImageUrl(path: string | null | undefined): string {
  if (!path) return ''
  // Already a data URI (e.g. from FileReader preview) — return as-is
  if (path.startsWith('data:')) return path
  // Full URL pointing somewhere else — return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  // Unwrap any legacy /api/frappe proxy URL back to the real file_url
  if (path.startsWith('/api/frappe')) {
    const m = decodeURIComponent(path).match(/file_url=([^&]+)/)
    return m ? decodeURIComponent(m[1]) : path
  }
  // Relative Frappe file path — open it directly on the same origin.
  return path.startsWith('/') ? path : `/${path}`
}
