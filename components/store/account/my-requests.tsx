'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Search, FileText } from 'lucide-react'
import { accountApi } from '@/lib/account-api'
import { formatNumber } from '@/lib/aqar-format'

const REQ_STATUS: Record<string, string> = { New: 'جديد', Contacted: 'تم التواصل', Closed: 'مغلق', Done: 'مكتمل' }
const CTYPE: Record<string, string> = { 'Residential Rent': 'إيجار سكني', 'Commercial Rent': 'إيجار تجاري', Sale: 'بيع', Brokerage: 'وساطة' }

function chip(status?: string) {
  return <span className="shrink-0 rounded-full bg-[var(--aqar-sand-2)] px-2 py-0.5 text-[10px] font-bold text-[var(--aqar-kohl)]/60">{REQ_STATUS[status || 'New'] || status}</span>
}

export default function MyRequests() {
  const [data, setData] = useState<{ buyer_requests: any[]; contract_requests: any[] } | null>(null)

  useEffect(() => { accountApi.myRequests().then(setData).catch(() => setData({ buyer_requests: [], contract_requests: [] })) }, [])

  if (data === null) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[var(--aqar-green)]" /></div>

  const empty = !data.buyer_requests.length && !data.contract_requests.length
  if (empty) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--aqar-sand-2)] p-10 text-center">
        <p className="text-[var(--aqar-kohl)]/60">لا توجد طلبات بعد.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link href="/request-property" className="aqar-btn"><Search className="h-4 w-4" />اطلب عقارك</Link>
          <Link href="/contracts" className="aqar-btn aqar-btn-outline"><FileText className="h-4 w-4" />طلب عقد</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {data.buyer_requests.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-[var(--aqar-green-d)]"><Search className="h-4 w-4" />طلبات العقار</h3>
          <div className="space-y-2">
            {data.buyer_requests.map((r) => (
              <div key={r.name} className="rounded-2xl border border-[var(--aqar-border)] bg-[var(--aqar-surface)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[var(--aqar-kohl)]">{r.requester_type === 'Broker' ? 'طلب كوسيط' : 'طلب عقار'} — {r.name}</p>
                  {chip(r.status)}
                </div>
                <p className="mt-1 text-xs text-[var(--aqar-kohl)]/60">
                  {[r.payment_method === 'Cash' ? 'كاش' : r.payment_method === 'Bank Financing' ? 'تمويل بنكي' : null,
                    (r.budget_min || r.budget_max) ? `الميزانية: ${formatNumber(r.budget_min || 0)}–${formatNumber(r.budget_max || 0)} ر.س` : null,
                    (r.area_min || r.area_max) ? `المساحة: ${r.area_min || 0}–${r.area_max || 0} م²` : null,
                  ].filter(Boolean).join(' · ')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.contract_requests.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-[var(--aqar-green-d)]"><FileText className="h-4 w-4" />طلبات العقود</h3>
          <div className="space-y-2">
            {data.contract_requests.map((r) => (
              <div key={r.name} className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--aqar-border)] bg-[var(--aqar-surface)] p-3">
                <p className="text-sm font-medium text-[var(--aqar-kohl)]">{CTYPE[r.contract_type] || r.contract_type} — {r.name}</p>
                {chip(r.status)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
