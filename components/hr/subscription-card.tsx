'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock } from 'lucide-react'

import { frappeClient } from '@/lib/api-client'

interface Info {
  plan: string | null
  expires_on: string | null
  days_left: number | null
  employees_used: number
  employees_cap: number | null
}

function daysWord(n: number) {
  return n === 1 ? 'يوم' : n === 2 ? 'يومان' : n >= 3 && n <= 10 ? 'أيام' : 'يوم'
}

/**
 * First tile of «ملخص حضور اليوم»: days left on the subscription (site_config
 * keys, via hr_settings.get_subscription_info). Same look as the other tiles;
 * opens «معلومات الاشتراك». Hidden when the site has no subscription end date.
 */
export function SubscriptionTile() {
  const router = useRouter()
  const [info, setInfo] = useState<Info | null>(null)

  useEffect(() => {
    frappeClient
      .call<Info>('base_meena.api.hr_settings.get_subscription_info')
      .then((r: any) => setInfo(r?.message ?? null))
      .catch(() => setInfo(null))
  }, [])

  if (!info || info.days_left == null) return null
  const left = info.days_left
  const color = left < 0 ? '#c2410c' : left <= 7 ? '#ff0000' : left <= 30 ? '#d97706' : '#24817f'
  const title = [info.plan, info.expires_on && `ينتهي في ${info.expires_on}`, info.employees_cap && `الموظفين ${info.employees_used} / ${info.employees_cap}`]
    .filter(Boolean).join(' — ')

  return (
    <button type="button" onClick={() => router.push('/hr?module=subscription-info')} title={title} data-testid="card-subscription"
      className="flex h-[92px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-[5px] bg-white shadow-sm hover:shadow">
      <span className="relative inline-flex h-7 w-7 items-center justify-center rounded">
        <span className="absolute inset-0 rounded opacity-15" style={{ background: color }} />
        <CalendarClock className="relative h-[18px] w-[18px]" style={{ color }} aria-hidden />
      </span>
      <span className="text-[13px] text-slate-700">{left < 0 ? 'الاشتراك' : 'باقي على الاشتراك'}</span>
      <span className="text-[13px] font-bold" style={{ color }} data-testid="subscription-days">
        {left < 0 ? 'منتهي' : `${left} ${daysWord(left)}`}
      </span>
    </button>
  )
}
