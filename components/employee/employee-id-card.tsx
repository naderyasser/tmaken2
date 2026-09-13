'use client'

/**
 * Read-only "National ID / Iqama" card for the employee detail page — shows the ID type,
 * number and expiry (Hijri-first via dualDate) plus an expired/expiring badge. Fetches
 * the Employee fields client-side (the detail page's main data comes from an hrms API we
 * don't touch). Renders nothing if there is no ID data / on error.
 */

import { useEffect, useState } from 'react'
import { CreditCard } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { frappeClient } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { dualDate } from '@/lib/format'
import { IdExpiryBadge } from '@/components/employee/id-expiry-badge'

interface IdData { id_type?: string; id_number?: string; issue?: string; expiry?: string }

export function EmployeeIdCard({ employeeId }: { employeeId: string }) {
  const { isRTL } = useI18n()
  const [data, setData] = useState<IdData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const rows = await frappeClient.getList<Record<string, unknown>>('Employee', {
          filters: [['name', '=', employeeId]],
          fields: ['custom_id_type', 'custom_national_id', 'custom_id_issue_date', 'custom_id_expiry_date'],
          limit_page_length: 1,
        })
        if (cancelled) return
        const r = rows[0]
        if (r) setData({ id_type: r.custom_id_type as string, id_number: r.custom_national_id as string, issue: r.custom_id_issue_date as string, expiry: r.custom_id_expiry_date as string })
      } catch {
        /* hide on error */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [employeeId])

  if (loading || !data || (!data.id_number && !data.issue && !data.expiry)) return null

  const L = isRTL
    ? { title: 'الهوية / الإقامة', type: 'النوع', number: 'الرقم', issue: 'تاريخ الإصدار', expiry: 'تاريخ الانتهاء', nid: 'هوية وطنية', iqama: 'إقامة', dash: '—' }
    : { title: 'National ID / Iqama', type: 'Type', number: 'Number', issue: 'Issued', expiry: 'Expiry', nid: 'National ID', iqama: 'Iqama', dash: '—' }
  const typeLabel = data.id_type === 'Iqama' ? L.iqama : data.id_type === 'National ID' ? L.nid : (data.id_type || L.dash)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4 text-primary" />
          {L.title}
        </CardTitle>
        <IdExpiryBadge date={data.expiry} showValid />
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between gap-2 border-b border-border/60 pb-1">
          <span className="text-muted-foreground">{L.type}</span><span className="font-medium">{typeLabel}</span>
        </div>
        <div className="flex justify-between gap-2 border-b border-border/60 pb-1">
          <span className="text-muted-foreground">{L.number}</span><span className="font-medium" dir="ltr">{data.id_number || L.dash}</span>
        </div>
        <div className="flex justify-between gap-2 border-b border-border/60 pb-1">
          <span className="text-muted-foreground">{L.issue}</span>
          <span className="font-medium">{data.issue ? dualDate(data.issue) : L.dash}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">{L.expiry}</span>
          <span className="font-medium">{data.expiry ? dualDate(data.expiry) : L.dash}</span>
        </div>
      </CardContent>
    </Card>
  )
}
