'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarClock } from 'lucide-react'

import { frappeClient } from '@/lib/api-client'

interface Info {
  plan: string | null
  expires_on: string | null
  started_on: string | null
  days_left: number | null
  employees_used: number
  employees_cap: number | null
}

/**
 * Dashboard card next to «ملخص حضور اليوم»: days left on the subscription, the
 * package and employees used vs. the package cap. Reads the same site_config
 * keys as «معلومات الاشتراك» (hr_settings.get_subscription_info); renders
 * nothing when the site has no subscription or the user can't read it.
 */
export function SubscriptionCard() {
  const [info, setInfo] = useState<Info | null>(null)

  useEffect(() => {
    frappeClient
      .call<Info>('base_meena.api.hr_settings.get_subscription_info')
      .then((r: any) => setInfo(r?.message ?? null))
      .catch(() => setInfo(null))
  }, [])

  if (!info || info.days_left == null) return null

  const left = info.days_left
  const total = info.started_on && info.expires_on
    ? Math.max(1, Math.round((Date.parse(info.expires_on) - Date.parse(info.started_on)) / 86400000))
    : Math.max(left, 1)
  const ratio = Math.min(1, Math.max(0, left / total))
  const tone = left < 0 ? '#c2410c' : left <= 7 ? '#dc2626' : left <= 30 ? '#d97706' : '#24817f'
  const r = 58
  const c = 2 * Math.PI * r
  const cap = info.employees_cap || 0
  const used = info.employees_used || 0

  return (
    <Link href="/hr?module=subscription-info" data-testid="subscription-card"
      className="flex w-full shrink-0 flex-col items-center justify-center gap-3 rounded bg-white p-5 shadow-sm hover:shadow xl:w-[310px]">
      <div className="relative h-36 w-36">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx="70" cy="70" r={r} fill="none" stroke="#e8eef0" strokeWidth="10" />
          <circle cx="70" cy="70" r={r} fill="none" stroke={tone} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - ratio)} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {left < 0 ? (
            <span className="text-[15px] font-bold" style={{ color: tone }}>الاشتراك منتهي</span>
          ) : (
            <>
              <span className="text-[12px] text-slate-600">باقي على الاشتراك</span>
              <span className="text-[30px] font-bold leading-tight tabular-nums" style={{ color: tone }} data-testid="subscription-days">{left}</span>
              <span className="text-[13px] text-slate-600">{left === 1 ? 'يوم' : left === 2 ? 'يومان' : left <= 10 ? 'أيام' : 'يوم'}</span>
            </>
          )}
        </div>
      </div>
      <div className="w-full space-y-1.5 text-center text-[12.5px] text-slate-600">
        {info.plan && <p className="truncate font-bold text-slate-800" title={info.plan}>{info.plan}</p>}
        {info.expires_on && (
          <p className="flex items-center justify-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" />ينتهي في <span className="tabular-nums">{info.expires_on}</span></p>
        )}
        {cap > 0 && (
          <div className="pt-1">
            <div className="mb-1 flex justify-between text-[12px]"><span>الموظفين</span><span className="tabular-nums">{used} / {cap}</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#e8eef0]">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, (used / cap) * 100)}%`, background: used > cap ? '#dc2626' : '#24817f' }} />
            </div>
          </div>
        )}
      </div>
    </Link>
  )
}
