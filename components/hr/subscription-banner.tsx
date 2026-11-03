'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, X } from 'lucide-react'

import { frappeClient } from '@/lib/api-client'

interface Info {
  expires_on: string | null
  days_left: number | null
  employees_used: number
  employees_cap: number | null
  support_whatsapp: string | null
}

// Same thresholds the owner asked for (2026-10-19): a week before the end,
// and within 5 seats of the package's employee limit.
const EXPIRY_WARN_DAYS = 7
const SEATS_WARN = 5
const FALLBACK_WHATSAPP = '+966 53 532 2228'

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function dismissedToday(key: string) {
  try { return localStorage.getItem(`sub-banner-${key}`) === today() } catch { return false }
}

function dismiss(key: string) {
  try { localStorage.setItem(`sub-banner-${key}`, today()) } catch {}
}

/**
 * Top-of-shell notices: the subscription ends within a week, and the active
 * employee count is near/over the package limit (asks the client to set
 * leavers to «ترك العمل» so the count is exact). Each can be hidden for the
 * day. The hard stops live on the server (subscription_gate / employee_cap).
 */
export function SubscriptionBanner() {
  const [info, setInfo] = useState<Info | null>(null)
  const [hidden, setHidden] = useState<Record<string, boolean>>({})

  useEffect(() => {
    frappeClient
      .call<Info>('base_meena.api.hr_settings.get_subscription_info')
      .then((r: any) => setInfo(r?.message ?? null))
      .catch(() => setInfo(null))
    setHidden({ expiry: dismissedToday('expiry'), seats: dismissedToday('seats') })
  }, [])

  if (!info) return null
  const whatsapp = `https://wa.me/${(info.support_whatsapp || FALLBACK_WHATSAPP).replace(/\D/g, '')}`
  const left = info.days_left
  const seats = info.employees_cap ? info.employees_cap - info.employees_used : null

  const notices: { key: string; text: React.ReactNode; action: React.ReactNode }[] = []
  if (left != null && left >= 0 && left <= EXPIRY_WARN_DAYS) {
    notices.push({
      key: 'expiry',
      text: left === 0
        ? 'اليوم آخر يوم في اشتراككم. بعده يتوقف النظام لحين التجديد — تواصلوا مع مزوّد الخدمة للتجديد.'
        : <>اشتراككم ينتهي خلال {left} {left === 1 ? 'يوم' : left === 2 ? 'يومين' : 'أيام'} (<bdi dir="ltr">{info.expires_on}</bdi>). بعده يتوقف النظام لحين التجديد — تواصلوا مع مزوّد الخدمة للتجديد.</>,
      action: <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="font-bold underline">تواصل للتجديد</a>,
    })
  }
  if (seats != null && seats <= SEATS_WARN) {
    notices.push({
      key: 'seats',
      text: seats < 0
        ? `عدد الموظفين النشطين (${info.employees_used}) أكثر من حد باقتكم (${info.employees_cap}). راجعوا قائمة الموظفين وغيّروا حالة من ترك العمل إلى «ترك العمل»، أو قوموا بترقية الباقة.`
        : seats === 0
          ? `وصلتم لحد باقتكم (${info.employees_cap} موظف نشط). لإضافة موظفين جدد قوموا بترقية الباقة، أو غيّروا حالة من ترك العمل إلى «ترك العمل».`
          : `متبقي ${seats} من حد باقتكم (${info.employees_used} موظف نشط من ${info.employees_cap}). راجعوا قائمة الموظفين وغيّروا حالة من ترك العمل إلى «ترك العمل» ليكون العدد دقيقاً.`,
      action: <Link href="/employees" className="font-bold underline">مراجعة الموظفين</Link>,
    })
  }

  const shown = notices.filter((n) => !hidden[n.key])
  if (!shown.length) return null

  return (
    <div className="shrink-0" data-testid="subscription-banner">
      {shown.map((n) => (
        <div key={n.key} role="status" data-testid={`subscription-banner-${n.key}`}
          className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-[13px] leading-6 text-amber-900">
          <AlertTriangle className="mt-1 h-4 w-4 shrink-0" aria-hidden />
          <p className="flex-1">{n.text} {n.action}</p>
          <button type="button" aria-label="إخفاء اليوم" className="mt-0.5 rounded p-1 hover:bg-amber-100"
            onClick={() => { dismiss(n.key); setHidden((h) => ({ ...h, [n.key]: true })) }}>
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  )
}
