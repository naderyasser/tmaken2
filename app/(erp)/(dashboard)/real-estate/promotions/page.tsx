'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import { frappeClient } from '@/lib/api-client'
import { realEstateApi, type AqarPromotion } from '@/lib/real-estate-api'
import { formatPrice } from '@/lib/aqar-format'
import { Star, Receipt, FileText } from 'lucide-react'

const PAY_TONE: Record<string, string> = {
  Paid: 'bg-emerald-100 text-emerald-800', Pending: 'bg-amber-100 text-amber-800',
  Failed: 'bg-red-100 text-red-700', Refunded: 'bg-gray-100 text-gray-600',
}

export default function PromotionsPage() {
  const { t, lang } = useI18n()
  const router = useRouter()
  const L = lang as 'ar' | 'en'
  const [packages, setPackages] = useState<AqarPromotion[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const [pk, pay] = await Promise.all([
          realEstateApi.listPromotions(),
          frappeClient.getList<any>('Aqar Payment', {
            fields: ['name', 'listing', 'promotion', 'amount', 'status', 'paid_at', 'sales_invoice', 'creation'],
            order_by: 'creation desc', limit_page_length: 50,
          }).catch(() => []),
        ])
        setPackages(pk); setPayments(pay)
      } finally { setLoading(false) }
    })()
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('re.promotions')}</h1>

      {/* Packages */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(loading ? [] : packages).map((p) => (
          <div key={p.name} className="rounded-2xl border-2 border-emerald-100 bg-white p-5 text-center">
            <Star className="mx-auto mb-2 h-7 w-7 text-amber-500" />
            <p className="font-bold text-gray-900">{L === 'ar' ? (p.package_name_ar || p.package_name) : p.package_name}</p>
            <p className="mt-1 text-sm text-gray-500">{p.duration_days} {t('re.days')}</p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">{formatPrice(p.price, L)}</p>
          </div>
        ))}
        {loading && [...Array(3)].map((_, i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-gray-100" />)}
      </div>

      {/* Payments */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 font-bold text-gray-900"><Receipt className="h-5 w-5 text-emerald-700" />{t('re.payments')}</h2>
        {payments.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center text-gray-400">—</div>
        ) : (
          <div className="overflow-hidden rounded-2xl border-2 border-gray-100 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr><th className="p-3 text-start">{t('re.listings')}</th><th className="p-3 text-start">{t('re.package')}</th><th className="p-3 text-start">{t('re.price')}</th><th className="p-3 text-start">{t('re.status')}</th><th className="p-3 text-start">{t('re.invoice')}</th></tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.name} className="border-t border-gray-50">
                    <td className="p-3"><button onClick={() => router.push(`/real-estate/listings/${p.listing}`)} className="text-emerald-700 hover:underline">{p.listing}</button></td>
                    <td className="p-3 text-gray-700">{p.promotion}</td>
                    <td className="p-3 font-medium text-gray-800">{formatPrice(p.amount, L)}</td>
                    <td className="p-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PAY_TONE[p.status] || ''}`}>{p.status}</span></td>
                    <td className="p-3">{p.sales_invoice ? <span className="inline-flex items-center gap-1 text-xs text-gray-600"><FileText className="h-3.5 w-3.5" />{p.sales_invoice}</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
