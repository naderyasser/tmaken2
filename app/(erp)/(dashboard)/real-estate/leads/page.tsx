'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import { realEstateApi, type AqarLeadRow } from '@/lib/real-estate-api'
import { dualDate } from '@/lib/aqar-format'
import { Inbox } from 'lucide-react'
import RequestTable, { type Column } from '@/components/real-estate/request-table'

export const LTOPIC_AR: Record<string, string> = {
  Auctions: 'حراج عقارات', 'Property Management': 'إدارة أملاك', Investment: 'استثمار', Other: 'أخرى',
}
export const LSTATUS_AR: Record<string, string> = { New: 'جديد', Contacted: 'تم التواصل', Closed: 'مغلق' }
export const LSTATUS_TONE: Record<string, string> = {
  New: 'bg-amber-100 text-amber-800', Contacted: 'bg-blue-100 text-blue-800', Closed: 'bg-gray-100 text-gray-600',
}
export const LINTENT_AR: Record<string, string> = { Bidder: 'مزايد', Owner: 'مالك', Partner: 'شريك' }

export default function LeadsListPage() {
  const { lang, isRTL } = useI18n()
  const router = useRouter()
  const params = useSearchParams()
  const L = lang as 'ar' | 'en'
  const [status, setStatus] = useState(params.get('status') || '')
  const [rows, setRows] = useState<AqarLeadRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = async (s: string) => {
    setLoading(true)
    try { setRows(await realEstateApi.listLeads(s || undefined)) } catch { setRows([]) } finally { setLoading(false) }
  }
  useEffect(() => { load(status) /* eslint-disable-next-line */ }, [status])

  const columns: Column<AqarLeadRow>[] = [
    { key: 'topic', label: isRTL ? 'الموضوع' : 'Topic', render: (r) => <span className="font-semibold text-emerald-700">{LTOPIC_AR[r.topic] || r.topic}</span> },
    { key: 'lead_name', label: isRTL ? 'مقدّم الطلب' : 'Name', render: (r) => r.lead_name || '—' },
    { key: 'contact', label: isRTL ? 'وسيلة التواصل' : 'Contact', render: (r) => <span dir="ltr" className="tabular-nums">{r.contact || '—'}</span> },
    { key: 'intent', label: isRTL ? 'الغرض' : 'Intent', render: (r) => LINTENT_AR[r.intent || ''] || '—' },
    { key: 'status', label: isRTL ? 'الحالة' : 'Status', render: (r) => <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${LSTATUS_TONE[r.status]}`}>{LSTATUS_AR[r.status] || r.status}</span> },
    { key: 'creation', label: isRTL ? 'التاريخ' : 'Date', render: (r) => <span className="text-xs text-gray-400">{dualDate(r.creation, L)}</span> },
  ]
  const statusOptions = [
    { value: '', label: isRTL ? 'الكل' : 'All' },
    { value: 'New', label: LSTATUS_AR.New }, { value: 'Contacted', label: LSTATUS_AR.Contacted }, { value: 'Closed', label: LSTATUS_AR.Closed },
  ]

  return (
    <RequestTable
      title={isRTL ? 'الطلبات الواردة' : 'Incoming leads'}
      icon={Inbox}
      columns={columns}
      rows={rows}
      loading={loading}
      statusOptions={statusOptions}
      activeStatus={status}
      onStatusChange={setStatus}
      onRowClick={(name) => router.push(`/real-estate/leads/${name}`)}
      emptyLabel={isRTL ? 'لا توجد طلبات واردة' : 'No leads'}
    />
  )
}
