'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, CreditCard, CalendarDays, Users, HardDrive, BadgeCheck } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'

interface SubscriptionInfo {
  plan?: string
  status?: string
  start_date?: string
  end_date?: string
  seats?: number | string
  used_seats?: number | string
  storage?: string
}

/**
 * «معلومات الاشتراك» — read-only subscription summary. Reads the tenant's
 * subscription endpoint (base_meena) and falls back to placeholders when the
 * backend doesn't expose it.
 */
export function SubscriptionInfoPage() {
  const [info, setInfo] = useState<SubscriptionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setOffline(false)
    try {
      const res = await frappeClient.call<SubscriptionInfo>('base_meena.api.get_subscription_info')
      setInfo((res as any)?.message || (res as any)?.data || null)
    } catch (e) {
      console.error('Failed to load subscription info:', e)
      setInfo(null)
      setOffline(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const cards = [
    { key: 'plan', label: 'الخطة', icon: BadgeCheck, value: info?.plan, fallback: '—' },
    { key: 'status', label: 'الحالة', icon: CreditCard, value: info?.status, fallback: '—' },
    { key: 'start_date', label: 'تاريخ البدء', icon: CalendarDays, value: info?.start_date, fallback: '—' },
    { key: 'end_date', label: 'تاريخ الانتهاء', icon: CalendarDays, value: info?.end_date, fallback: '—' },
    {
      key: 'seats',
      label: 'المستخدمون',
      icon: Users,
      value: info?.seats !== undefined ? `${info?.used_seats ?? 0} / ${info?.seats}` : undefined,
      fallback: '—',
    },
    { key: 'storage', label: 'المساحة', icon: HardDrive, value: info?.storage, fallback: '—' },
  ]

  return (
    <div dir="rtl" className="space-y-4 p-6 font-[family-name:var(--font-arabic)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">معلومات الاشتراك</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">تفاصيل الاشتراك والاستخدام</p>
        </div>
        <button
          onClick={load}
          title="تحديث"
          className="text-[#195a9e] hover:bg-blue-50 rounded p-2 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-md shadow-sm border border-slate-200/60 py-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#195a9e] mx-auto" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c) => {
            const Icon = c.icon
            return (
              <div key={c.key} className="bg-white rounded-md shadow-sm border border-slate-200/60 p-5 flex items-center gap-4">
                <div className="h-11 w-11 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-[#195a9e]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] text-slate-500 mb-0.5">{c.label}</p>
                  <p className="text-[15px] font-bold text-slate-800 truncate">
                    {c.value != null && c.value !== '' ? c.value : c.fallback}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {offline && !loading && (
        <p className="text-[12.5px] text-amber-700 bg-amber-50 border border-amber-200 rounded-sm px-3 py-2">
          تعذّر جلب بيانات الاشتراك من الخادم. سيتم عرض البيانات عند استعادة الاتصال.
        </p>
      )}
    </div>
  )
}
