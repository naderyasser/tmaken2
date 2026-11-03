'use client'

/**
 * GOSI registration card for the employee detail page — shows the persisted GOSI status
 * (badge), contributor id and last-checked time, plus a single-employee "Check now"
 * action that calls the whitelisted backend method gosi_get_employee_status. The backend
 * is STUB-ONLY for now (no real GOSI network call); the card surfaces that with a "Stub
 * mode" hint. List views never call the API per row — only this explicit action does.
 *
 * Display-only state; dates Hijri-first via dualDate. Renders nothing while loading.
 */

import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { frappeClient } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/hooks/use-toast'
import { dualDate } from '@/lib/format'
import { GosiStatusBadge } from '@/components/employee/gosi-status-badge'

interface GosiData { status?: string; gosi_id?: string; last_synced?: string; sync_error?: string }

export function GosiStatusCard({ employeeId }: { employeeId: string }) {
  const { isRTL } = useI18n()
  const { toast } = useToast()
  const [data, setData] = useState<GosiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)

  const L = isRTL
    ? { title: 'التأمينات الاجتماعية (GOSI)', gosiId: 'رقم المشترك', synced: 'آخر تحقق', check: 'تحقق الآن', checking: 'جارٍ التحقق…', ok: 'تم تحديث حالة التأمينات', fail: 'تعذّر التحقق من التأمينات', notConfigured: 'لم تُضبط بيانات التأمينات بعد', dash: '—', stub: 'وضع تجريبي (بدون اتصال فعلي)' }
    : { title: 'GOSI Registration', gosiId: 'Contributor ID', synced: 'Last checked', check: 'Check now', checking: 'Checking…', ok: 'GOSI status updated', fail: 'GOSI check failed', notConfigured: 'GOSI not configured yet', dash: '—', stub: 'Stub mode (no live call)' }

  const load = useCallback(async () => {
    try {
      const rows = await frappeClient.getList<Record<string, unknown>>('Employee', {
        filters: [['name', '=', employeeId]],
        fields: ['custom_gosi_registration_status', 'custom_gosi_employee_id', 'custom_gosi_last_synced', 'custom_gosi_sync_error'],
        limit_page_length: 1,
      })
      const r = rows[0]
      if (r) setData({ status: r.custom_gosi_registration_status as string, gosi_id: r.custom_gosi_employee_id as string, last_synced: r.custom_gosi_last_synced as string, sync_error: r.custom_gosi_sync_error as string })
    } catch {
      /* hide details on error */
    } finally {
      setLoading(false)
    }
  }, [employeeId])

  useEffect(() => { load() }, [load])

  const check = async () => {
    setChecking(true)
    try {
      const resp = await frappeClient.call('base_meena.integrations.gosi.feature.gosi_get_employee_status', { employee: employeeId, force: 1 })
      const msg = (resp as { message?: { state?: string; message?: string } })?.message
      toast(
        msg?.state === 'not_configured'
          ? { title: L.title, description: msg.message || L.notConfigured }
          : { title: L.title, description: L.ok }
      )
      await load()
    } catch {
      toast({ title: L.title, description: L.fail, variant: 'destructive' })
    } finally {
      setChecking(false)
    }
  }

  if (loading) return null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-primary" />
          {L.title}
        </CardTitle>
        <GosiStatusBadge status={data?.status} showUnknown />
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between gap-2 border-b border-border/60 pb-1">
          <span className="text-muted-foreground">{L.gosiId}</span>
          <span className="font-medium" dir="ltr">{data?.gosi_id || L.dash}</span>
        </div>
        <div className="flex justify-between gap-2 border-b border-border/60 pb-1">
          <span className="text-muted-foreground">{L.synced}</span>
          <span className="font-medium">{data?.last_synced ? dualDate(data.last_synced) : L.dash}</span>
        </div>
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5 text-primary" />
            {L.stub}
          </span>
          <Button type="button" variant="outline" size="sm" className="gap-2 flex-shrink-0" disabled={checking} onClick={check}>
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {checking ? L.checking : L.check}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
