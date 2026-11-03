'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth-context'
import { realEstateApi, type AqarLeadDetail } from '@/lib/real-estate-api'
import { dualDate } from '@/lib/aqar-format'
import RequestDetail from '@/components/real-estate/request-detail'
import { LTOPIC_AR, LSTATUS_AR, LSTATUS_TONE, LINTENT_AR } from '../page'

const CHANNEL_AR: Record<string, string> = { WhatsApp: 'واتساب', Phone: 'اتصال', Email: 'بريد' }
const RE_WRITE = ['Real Estate Manager', 'Administrator', 'System Manager']

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { lang, isRTL } = useI18n()
  const { user } = useAuth()
  const L = lang as 'ar' | 'en'
  const canWrite = user?.roles?.some((r) => RE_WRITE.includes(r)) ?? false

  const [doc, setDoc] = useState<AqarLeadDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try { setDoc(await realEstateApi.getLead(id)) } catch { setDoc(null) } finally { setLoading(false) }
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [id])

  if (loading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100" />)}</div>
  if (!doc) return <div className="rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center text-gray-400">{isRTL ? 'الطلب غير موجود' : 'Not found'}</div>

  const fields = [
    { label: isRTL ? 'الموضوع' : 'Topic', value: LTOPIC_AR[doc.topic] || doc.topic },
    { label: isRTL ? 'الغرض' : 'Intent', value: LINTENT_AR[doc.intent || ''] || '—' },
    { label: isRTL ? 'مقدّم الطلب' : 'Name', value: doc.lead_name || '—' },
    { label: isRTL ? 'وسيلة التواصل' : 'Contact', value: <span dir="ltr">{doc.contact}</span> },
    { label: isRTL ? 'القناة المفضّلة' : 'Channel', value: CHANNEL_AR[doc.channel || ''] || '—' },
    { label: isRTL ? 'التاريخ' : 'Date', value: dualDate(doc.creation, L) },
    { label: isRTL ? 'الرسالة' : 'Message', value: doc.message || '—' },
  ]

  return (
    <RequestDetail
      title={isRTL ? 'طلب وارد' : 'Lead'}
      refId={doc.name}
      statusLabel={LSTATUS_AR[doc.status] || doc.status}
      statusTone={LSTATUS_TONE[doc.status] || 'bg-gray-100 text-gray-600'}
      onBack={() => router.push('/real-estate/leads')}
      fields={fields}
      attachmentLabel=""
      attachmentDownload=""
      steps={[{ value: 'New', label: LSTATUS_AR.New }, { value: 'Contacted', label: LSTATUS_AR.Contacted }, { value: 'Closed', label: LSTATUS_AR.Closed }]}
      currentStatus={doc.status}
      onSetStatus={async (status, notes) => { await realEstateApi.setLeadStatus(doc.name, status, notes); await load() }}
      teamNotes={doc.team_notes}
      onSaveNotes={async (notes) => { await realEstateApi.setLeadStatus(doc.name, doc.status, notes); await load() }}
      canWrite={canWrite}
      isRTL={isRTL}
      detailsHeading=""
      statusHeading={isRTL ? 'حالة الطلب' : 'Status'}
      teamNotesHeading={isRTL ? 'ملاحظات الفريق (داخلية)' : 'Team notes (internal)'}
      teamNotesPlaceholder={isRTL ? 'ملاحظات داخلية للفريق…' : 'Internal notes…'}
      saveLabel={isRTL ? 'حفظ الملاحظات' : 'Save notes'}
    />
  )
}
