/**
 * Tamken3 mobile check-in app («/m») — typed calls to
 * base_meena.mobile_attendance.tamken_app (the tamken3 rules: تطبيق الجوال,
 * طريقة الحضور, مجموعة المواقع → المواقع).
 */
import { frappeClient } from '@/lib/api-client'

const MOD = 'base_meena.mobile_attendance.tamken_app'

export async function mcall<T = any>(method: string, args?: Record<string, any>): Promise<T> {
  const r = await frappeClient.call<T>(`${MOD}.${method}`, args)
  return (r as any)?.message as T
}

export interface AppLocation {
  name: string
  label: string
  label_en?: string | null
  latitude: number
  longitude: number
  radius_m: number
}

export interface Punch {
  name: string
  time: string
  log_type: 'IN' | 'OUT'
  source: 'device' | 'app' | 'manual'
}

export interface HomeData {
  employee: {
    name: string
    employee_name: string
    number: string
    designation?: string | null
    department?: string | null
    branch?: string | null
    company?: string | null
    image?: string | null
  }
  punch_enabled: boolean
  locations: AppLocation[]
  passkeys: number
  require_passkey: boolean
  today: Punch[]
  next_log_type: 'IN' | 'OUT'
  shift: { name: string | null; start: string | null; end: string | null } | null
  tracking: TrackingState
  server_time: string
}

/** «تتبع الموقع» between check-in and check-out (HR switches it on, the employee agrees). */
export interface TrackingState {
  tracking_enabled: boolean
  tracking_consent: boolean
  tracking_interval: number // minutes
  active: boolean // enabled + consent + an open IN
  since: string | null
}

export interface PunchResult {
  ok: boolean
  checkin: string
  log_type: 'IN' | 'OUT'
  time: string
  location?: string
  distance_m?: number
  idempotent_replay?: boolean
}

export interface HistoryData {
  month: string
  days: { date: string; punches: Punch[] }[]
}

/** True when the failure means "no (valid) session" rather than a business rule. */
export function isSessionError(e: unknown): boolean {
  const status = (e as { status?: number } | null)?.status
  const msg = e instanceof Error ? e.message : String(e ?? '')
  if (/not whitelisted|login to access|سجّل الدخول/i.test(msg)) return true
  return status === 401
}

export function errorText(e: unknown, fallback = 'حدث خطأ غير متوقع، حاول مرة أخرى'): string {
  const anyE = e as { ar?: string; message?: string } | null
  if (anyE?.ar) return anyE.ar
  const msg = anyE?.message || ''
  if (!msg || /HTTP \d{3}|failed \(|fetch|network/i.test(msg)) return fallback
  return msg
}

// ── geometry (display only — the server re-checks every punch) ───────────────

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dp = toRad(lat2 - lat1)
  const dl = toRad(lon2 - lon1)
  const a = Math.sin(dp / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dl / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(a))
}

export interface FenceState {
  inside: boolean
  nearest: (AppLocation & { distance_m: number }) | null
}

export function evaluateFence(locations: AppLocation[], lat: number, lon: number): FenceState {
  let nearest: FenceState['nearest'] = null
  for (const l of locations) {
    const d = Math.round(haversine(l.latitude, l.longitude, lat, lon))
    if (!nearest || d - l.radius_m < nearest.distance_m - nearest.radius_m) nearest = { ...l, distance_m: d }
  }
  return { inside: !!nearest && nearest.distance_m <= nearest.radius_m, nearest }
}

export function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} كم`
  return `${m} م`
}

// ── time formatting (Latin digits, like the rest of tamken3) ─────────────────

const pad = (n: number) => String(n).padStart(2, '0')

/** "2026-10-14 08:02:11.123" → Date (server time is Riyadh wall-clock). */
export function parseServerTime(s: string): Date {
  const [d, t = '00:00:00'] = s.split(' ')
  const [y, mo, da] = d.split('-').map(Number)
  const [h, mi, se] = t.split(':').map((x) => Number(x.split('.')[0]))
  return new Date(y, mo - 1, da, h, mi, se || 0)
}

export function hhmm(s: string | Date): string {
  const d = typeof s === 'string' ? parseServerTime(s) : s
  const h = d.getHours()
  const suffix = h < 12 ? 'ص' : 'م'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${pad(h12)}:${pad(d.getMinutes())} ${suffix}`
}

export const AR_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
export const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

export function longDate(d: Date): string {
  return `${AR_DAYS[d.getDay()]}، ${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** Worked span between the first IN and the last OUT after it (or now). */
export function workedMinutes(punches: Punch[], now: Date): number {
  const firstIn = punches.find((p) => p.log_type === 'IN')
  if (!firstIn) return 0
  const start = parseServerTime(firstIn.time)
  const last = punches[punches.length - 1]
  const end = last.log_type === 'OUT' ? parseServerTime(last.time) : now
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
}

export function duration(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h ? `${h} س ${pad(m)} د` : `${m} د`
}

export function newClientRef(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
