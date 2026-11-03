'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth-context'
import { realEstateApi, type AqarContractDetail } from '@/lib/real-estate-api'
import { dualDate } from '@/lib/aqar-format'
import RequestDetail from '@/components/real-estate/request-detail'
import { CTYPE_AR, CSTATUS_AR, CSTATUS_TONE } from '../page'

const CHANNEL_AR: Record<string, string> = { WhatsApp: 'واتساب', Phone: 'اتصال' }
const RE_WRITE = ['Real Estate Manager', 'Administrator', 'System Manager']

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { lang, isRTL } = useI18n()
  const { user } = useAuth()
  const L = lang as 'ar' | 'en'
  const canWrite = user?.roles?.some((r) => RE_WRITE.includes(r)) ?? false

  const [doc, setDoc] = useState<AqarContractDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try { setDoc(await realEstateApi.getContractRequest(id)) } catch { setDoc(null) } finally { setLoading(false) }
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [id])

  if (loading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100" />)}</div>
  if (!doc) return <div className="rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center text-gray-400">{isRTL ? 'الطلب غير موجود' : 'Not found'}</div>

  const fields = [
    { label: isRTL ? 'نوع العقد' : 'Type', value: CTYPE_AR[doc.contract_type] || doc.contract_type },
    { label: isRTL ? 'مقدّم الطلب' : 'Applicant', value: doc.applicant_name },
    { label: isRTL ? 'الجوال' : 'Phone', value: <span dir="ltr">{doc.applicant_phone}</span> },
    { label: isRTL ? 'قناة التواصل' : 'Channel', value: CHANNEL_AR[doc.preferred_channel || ''] || '—' },
    { label: isRTL ? 'التاريخ' : 'Date', value: dualDate(doc.creation, L) },
    { label: isRTL ? 'ملاحظات مقدّم الطلب' : 'Applicant notes', value: doc.notes || '—' },
    ...(doc.terms ? [{ label: isRTL ? 'الشروط' : 'Terms', value: doc.terms }] : []),
    ...(doc.linked_listing ? [{ label: isRTL ? 'عقار مرتبط' : 'Linked listing', value: <Link href={`/real-estate/listings/${doc.linked_listing}`} className="text-emerald-700 hover:underline">{doc.linked_listing}</Link> }] : []),
  ]

  return (
    <RequestDetail
      title={isRTL ? 'طلب عقد' : 'Contract request'}
      refId={doc.name}
      statusLabel={CSTATUS_AR[doc.status] || doc.status}
      statusTone={CSTATUS_TONE[doc.status] || 'bg-gray-100 text-gray-600'}
      onBack={() => router.push('/real-estate/contracts')}
      fields={fields}
      detailsText={doc.details}
      attachment={doc.attachment}
      attachmentLabel={isRTL ? 'مرفق' : 'Attachment'}
      attachmentDownload={isRTL ? 'تنزيل المرفق' : 'Download attachment'}
      steps={[{ value: 'New', label: CSTATUS_AR.New }, { value: 'Contacted', label: CSTATUS_AR.Contacted }, { value: 'Done', label: CSTATUS_AR.Done }]}
      currentStatus={doc.status}
      onSetStatus={async (status, notes) => { await realEstateApi.setContractStatus(doc.name, status, notes); await load() }}
      teamNotes={doc.team_notes}
      onSaveNotes={async (notes) => { await realEstateApi.setContractStatus(doc.name, doc.status, notes); await load() }}
      canWrite={canWrite}
      isRTL={isRTL}
      detailsHeading={isRTL ? 'تفاصيل العقد' : 'Contract details'}
      statusHeading={isRTL ? 'حالة الطلب' : 'Status'}
      teamNotesHeading={isRTL ? 'ملاحظات الفريق (داخلية)' : 'Team notes (internal)'}
      teamNotesPlaceholder={isRTL ? 'ملاحظات داخلية للفريق…' : 'Internal notes…'}
      saveLabel={isRTL ? 'حفظ الملاحظات' : 'Save notes'}
    />
  )
}
