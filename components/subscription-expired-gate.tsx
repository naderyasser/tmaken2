'use client'

import { useEffect, useState } from 'react'

/**
 * Full-screen «انتهى الاشتراك» lock. The server (base_meena
 * hr_management/subscription_gate.py) answers every request of an expired HR
 * client with 402 + exc_type SubscriptionExpired; this watches every fetch for
 * that answer, and probes once on load so a page that makes no client call
 * (the login screen) still shows it.
 */
const PROBE = '/api/method/frappe.auth.get_logged_user'
let patched = false

function messageOf(data: any): string | null {
  if (data?.exc_type !== 'SubscriptionExpired') return null
  try {
    return JSON.parse(JSON.parse(data._server_messages)[0]).message
  } catch {
    return 'انتهى اشتراككم. للتجديد وإعادة تفعيل النظام تواصلوا مع مزوّد الخدمة.'
  }
}

export function SubscriptionExpiredGate() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const check = (res: Response) => {
      if (res.status !== 402) return
      res.clone().json().then((d) => { const m = messageOf(d); if (m) setMessage(m) }).catch(() => {})
    }
    if (!patched) {
      patched = true
      const original = window.fetch
      window.fetch = async (...args) => {
        const res = await original(...args)
        check(res)
        return res
      }
    }
    fetch(PROBE, { credentials: 'include', headers: { Accept: 'application/json' } }).catch(() => {})
  }, [])

  if (!message) return null
  const phone = message.match(/\+?\d[\d\s]{8,}\d/)?.[0]?.replace(/\D/g, '')

  return (
    <div dir="rtl" role="alertdialog" aria-modal="true" aria-labelledby="sub-expired-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 text-center shadow-xl">
        <h2 id="sub-expired-title" className="mb-3 text-xl font-bold text-gray-900">انتهى الاشتراك</h2>
        <p className="mb-5 leading-7 text-gray-700">
          {/* dates and phone numbers stay left-to-right inside the Arabic sentence */}
          {message.split(/(\+?\d[\d\s\-/]*\d)/).map((part, i) => (i % 2 ? <bdi key={i} dir="ltr">{part}</bdi> : part))}
        </p>
        {phone && (
          <a href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer"
            className="inline-block rounded-lg bg-[#1d4d56] px-5 py-2.5 font-semibold text-white">
            تواصل عبر واتساب
          </a>
        )}
      </div>
    </div>
  )
}
