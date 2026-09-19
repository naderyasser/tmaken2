'use client'

import { useEffect, useId, useState } from 'react'
import { AlertTriangle, Clock, Loader2, X } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { LocalizedDateInput } from '@/components/ui/localized-date-input'
import { EmptyState } from '@/components/hr/ui/empty-state'
import { formatDateTime, logStatusLabel, LOG_STATUSES, type DeviceLog } from './types'

/**
 * «سجل الجهاز» — a slide-over from the LEFT edge (same convention as
 * AdvancedSearchDrawer) showing base_meena.biometric_management.adms.get_device_logs
 * for one device, with status/date filters and inline hints for the two
 * classic failure modes: unmapped device IDs and a device clock running ahead.
 */
export function DeviceLogDrawer({
  open, onClose, serial, deviceName,
}: {
  open: boolean
  onClose: () => void
  serial: string
  deviceName?: string
}) {
  const { toast } = useToast()
  const titleId = useId()
  const [logs, setLogs] = useState<DeviceLog[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const resp = await frappeClient.call<{ logs: DeviceLog[] }>('base_meena.biometric_management.adms.get_device_logs', {
        device_serial: serial,
        status: status || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        page: 1,
        page_size: 200,
      })
      setLogs(resp.message?.logs ?? [])
    } catch (err: any) {
      toast({ title: 'تعذّر تحميل سجل الجهاز', description: err?.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open && serial) load() }, [open, serial, status, fromDate, toDate])

  if (!open) return null

  const hasFilters = !!(status || fromDate || toDate)

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed top-0 left-0 z-50 h-full w-[820px] max-w-[95vw] bg-white shadow-xl overflow-y-auto"
        dir="rtl"
      >
        <div className="flex items-center justify-between px-4 h-[70px] border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="min-w-0">
            <h3 id={titleId} className="text-[20px] font-bold text-[var(--apex-blue)]">سجل الجهاز</h3>
            <p className="text-[12.5px] text-slate-500 truncate">{deviceName ? `${deviceName} — ${serial}` : serial}</p>
          </div>
          <button type="button" onClick={onClose} className="text-[var(--apex-blue)] shrink-0" aria-label="اغلاق"><X className="h-6 w-6" /></button>
        </div>

        <div className="p-4 flex flex-wrap items-end gap-3 border-b border-slate-100">
          <div>
            <label className="block text-[12px] text-slate-600 mb-1">الحالة</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="تصفية حسب الحالة"
              className="h-9 rounded border border-[var(--apex-border)] bg-white px-2 text-[13px] text-slate-800 outline-none focus:border-[var(--apex-blue)]"
            >
              <option value="">الكل</option>
              {LOG_STATUSES.map((s) => <option key={s} value={s}>{logStatusLabel(s)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[12px] text-slate-600 mb-1">من تاريخ</label>
            <LocalizedDateInput value={fromDate} onChange={setFromDate} locale="ar" />
          </div>
          <div>
            <label className="block text-[12px] text-slate-600 mb-1">إلى تاريخ</label>
            <LocalizedDateInput value={toDate} onChange={setToDate} locale="ar" />
          </div>
          {hasFilters && (
            <button type="button" onClick={() => { setStatus(''); setFromDate(''); setToDate('') }} className="text-[12.5px] text-[var(--apex-blue)] hover:underline h-9">
              مسح الفلاتر
            </button>
          )}
        </div>

        {!loading && logs.length === 0 ? (
          <EmptyState title="لا سجلات مطابقة" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px] text-right">
              <thead>
                <tr className="bg-[var(--apex-thead)] text-[var(--apex-text)] h-10">
                  <th className="px-3 font-bold whitespace-nowrap">الوقت</th>
                  <th className="px-3 font-bold whitespace-nowrap">رقم البصمة على الجهاز</th>
                  <th className="px-3 font-bold whitespace-nowrap">الموظف</th>
                  <th className="px-3 font-bold whitespace-nowrap">الحالة</th>
                  <th className="px-3 font-bold">الرسالة</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="py-14 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[var(--apex-blue)]" /></td></tr>
                ) : logs.map((log) => {
                  const isNoEmployee = log.status === 'Skipped - No Employee'
                  const isClockAhead = /clock ahead/i.test(log.error_message || '')
                  return (
                    <tr key={log.name} className={`border-b border-slate-100 align-top ${isNoEmployee ? 'bg-amber-50' : isClockAhead ? 'bg-red-50' : ''}`}>
                      <td className="px-3 py-1.5 whitespace-nowrap">{formatDateTime(log.log_datetime)}</td>
                      <td className="px-3 py-1.5 font-mono whitespace-nowrap">{log.employee_device_id || '—'}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">{log.employee_name || '—'}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">{logStatusLabel(log.status)}</td>
                      <td className="px-3 py-1.5 text-slate-600">
                        {log.error_message || '—'}
                        {isNoEmployee && (
                          <div className="flex items-center gap-1 text-amber-700 mt-0.5">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            رقم بصمة غير مربوط بموظف — اربطه من تبويب البصمات غير المربوطة
                          </div>
                        )}
                        {isClockAhead && (
                          <div className="flex items-center gap-1 text-red-700 mt-0.5">
                            <Clock className="h-3 w-3 shrink-0" />
                            ساعة الجهاز متقدمة — اضبط الوقت على الجهاز
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </aside>
    </>
  )
}
