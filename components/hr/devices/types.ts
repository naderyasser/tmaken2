/**
 * Shared types + small helpers for the «الاجهزة» (fingerprint device management) page.
 * Backed by base_meena.biometric_management.adms — see that file for exact param/return shapes.
 */

import { fmtDateTime } from '@/lib/hr-format'

export interface BiometricDevice {
  name: string
  device_name?: string
  serial_number: string
  device_model?: string
  location?: string
  enabled: 0 | 1
  last_activity?: string
  last_push_ip?: string
  total_synced_records?: number
  last_sync_time?: string
  sync_errors?: number
  is_online: boolean
  seconds_since_activity?: number | null
  /** Where the server sends this device's punches: this company, another
   *  company, or nowhere yet (kept until the device is saved here). */
  route?: 'here' | 'other' | 'none'
  /** Punches the server is holding for an unlinked device. */
  unrouted_pending?: number
}

export interface DeviceLog {
  name: string
  device_serial: string
  device_name?: string
  log_datetime: string
  status: string
  employee_device_id?: string
  employee?: string
  employee_name?: string
  log_type?: string
  raw_punch_state?: string
  checkin_record?: string
  error_message?: string
}

export interface UnmappedDeviceId {
  employee_device_id: string
  device_serial: string
  punch_count: number
  last_seen: string
}

export interface UnmappedEmployee {
  name: string
  employee_name: string
  department?: string
  designation?: string
  branch?: string
}

export type DeviceStatusKey = 'online' | 'offline' | 'disabled' | 'never' | 'elsewhere' | 'unlinked'

/** Device serial is the doctype's docname — but always fall back to `name` just in case. */
export const deviceSerial = (d: BiometricDevice): string => d.serial_number || d.name

export function deviceStatus(d: BiometricDevice): { key: DeviceStatusKey; label: string; className: string } {
  if (!d.enabled) {
    return { key: 'disabled', label: 'معطّل', className: 'bg-red-50 text-[var(--apex-red)] border border-red-200' }
  }
  // A device whose punches go to another company (or nowhere) would otherwise
  // just read «لم يتصل بعد» while it is in fact talking to the server.
  if (d.route === 'other') {
    return { key: 'elsewhere', label: 'مربوط بمنشأة أخرى — تواصل مع الدعم لنقله', className: 'bg-amber-50 text-amber-700 border border-amber-200' }
  }
  if (d.route === 'none') {
    return {
      key: 'unlinked',
      label: d.unrouted_pending
        ? `يرسل بصمات (${d.unrouted_pending}) وغير مربوط — افتح الجهاز واضغط حفظ`
        : 'غير مربوط بالسيرفر — افتح الجهاز واضغط حفظ',
      className: 'bg-amber-50 text-amber-700 border border-amber-200',
    }
  }
  if (d.is_online) {
    return { key: 'online', label: 'متصل', className: 'bg-green-50 text-[var(--apex-green)] border border-[var(--apex-green)]/30' }
  }
  if (d.last_activity) {
    return {
      key: 'offline',
      label: `غير متصل — آخر ظهور: ${formatTimeAgo(d.seconds_since_activity)}`,
      className: 'bg-slate-100 text-slate-500 border border-slate-200',
    }
  }
  return { key: 'never', label: 'لم يتصل بعد', className: 'bg-amber-50 text-amber-700 border border-amber-200' }
}

export function formatTimeAgo(seconds?: number | null): string {
  if (seconds == null) return 'غير معروف'
  if (seconds < 60) return `منذ ${seconds} ثانية`
  if (seconds < 3600) return `منذ ${Math.floor(seconds / 60)} دقيقة`
  if (seconds < 86400) return `منذ ${Math.floor(seconds / 3600)} ساعة`
  return `منذ ${Math.floor(seconds / 86400)} يوم`
}

export function formatDateTime(dt?: string): string {
  if (!dt) return '—'
  try {
    const out = fmtDateTime(dt)
    return out || dt
  } catch {
    return dt
  }
}

export const LOG_STATUSES = ['Success', 'Failed', 'Skipped - No Employee', 'Skipped - Device Disabled']

const LOG_STATUS_AR: Record<string, string> = {
  Success: 'نجاح',
  Failed: 'فشل',
  'Skipped - No Employee': 'تم التجاوز — لا يوجد موظف',
  'Skipped - Device Disabled': 'تم التجاوز — الجهاز معطّل',
}
export const logStatusLabel = (s: string): string => LOG_STATUS_AR[s] || s
