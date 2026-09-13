'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import { realEstateApi, type AqarContractRow } from '@/lib/real-estate-api'
import { dualDate } from '@/lib/aqar-format'
import { FileText } from 'lucide-react'
import RequestTable, { type Column } from '@/components/real-estate/request-table'

export const CTYPE_AR: Record<string, string> = {
  'Residential Rent': 'إيجار سكني', 'Commercial Rent': 'إيجار تجاري', Sale: 'بيع', Brokerage: 'وساطة / تسويق',
}
export const CSTATUS_AR: Record<string, string> = { New: 'جديد', Contacted: 'تم التواصل', Done: 'مكتمل' }
export const CSTATUS_TONE: Record<string, string> = {
  New: 'bg-amber-100 text-amber-800', Contacted: 'bg-blue-100 text-blue-800', Done: 'bg-emerald-100 text-emerald-800',
}
const CHANNEL_AR: Record<string, string> = { WhatsApp: 'واتساب', Phone: 'اتصال' }

export default function ContractsListPage() {
  const { lang, isRTL } = useI18n()
  const router = useRouter()
  const params = useSearchParams()
  const L = lang as 'ar' | 'en'
  const [status, setStatus] = useState(params.get('status') || '')
  const [rows, setRows] = useState<AqarContractRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = async (s: string) => {
    setLoading(true)
    try { setRows(await realEstateApi.listContractRequests(s || undefined)) } catch { setRows([]) } finally { setLoading(false) }
  }
  useEffect(() => { load(status) /* eslint-disable-next-line */ }, [status])

  const columns: Column<AqarContractRow>[] = [
    { key: 'name', label: isRTL ? 'رقم الطلب' : 'Ref', render: (r) => <span className="font-semibold text-emerald-700">{r.name}</span> },
    { key: 'contract_type', label: isRTL ? 'نوع العقد' : 'Type', render: (r) => CTYPE_AR[r.contract_type] || r.contract_type },
    { key: 'applicant_name', label: isRTL ? 'مقدّم الطلب' : 'Applicant' },
    { key: 'applicant_phone', label: isRTL ? 'الجوال' : 'Phone', render: (r) => <span dir="ltr" className="tabular-nums">{r.applicant_phone || '—'}</span> },
    { key: 'preferred_channel', label: isRTL ? 'قناة التواصل' : 'Channel', render: (r) => CHANNEL_AR[r.preferred_channel || ''] || '—' },
    { key: 'status', label: isRTL ? 'الحالة' : 'Status', render: (r) => <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CSTATUS_TONE[r.status]}`}>{CSTATUS_AR[r.status] || r.status}</span> },
    { key: 'creation', label: isRTL ? 'التاريخ' : 'Date', render: (r) => <span className="text-xs text-gray-400">{dualDate(r.creation, L)}</span> },
  ]
  const statusOptions = [
    { value: '', label: isRTL ? 'الكل' : 'All' },
    { value: 'New', label: CSTATUS_AR.New }, { value: 'Contacted', label: CSTATUS_AR.Contacted }, { value: 'Done', label: CSTATUS_AR.Done },
  ]

  return (
    <RequestTable
      title={isRTL ? 'طلبات العقود' : 'Contract requests'}
      icon={FileText}
      columns={columns}
      rows={rows}
      loading={loading}
      statusOptions={statusOptions}
      activeStatus={status}
      onStatusChange={setStatus}
      onRowClick={(name) => router.push(`/real-estate/contracts/${name}`)}
      emptyLabel={isRTL ? 'لا توجد طلبات عقود' : 'No contract requests'}
    />
  )
}
