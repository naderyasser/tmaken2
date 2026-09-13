'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/hooks/use-toast'
import { realEstateApi } from '@/lib/real-estate-api'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, FlaskConical, Store } from 'lucide-react'

export function FlagsTab({ canEdit }: { canEdit: boolean }) {
  const { isRTL } = useI18n()
  const { toast } = useToast()
  const [flags, setFlags] = useState<Record<string, number> | null>(null)
  const [busy, setBusy] = useState(false)

  const load = async () => { try { setFlags(await realEstateApi.admin.getFlags()) } catch (e: any) { toast({ title: isRTL ? 'خطأ' : 'Error', description: e?.message, variant: 'destructive' }) } }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [])

  const setFlag = async (flag: string, value: boolean) => {
    setBusy(true)
    try { await realEstateApi.admin.setFlag(flag, value ? 1 : 0); setFlags((f) => ({ ...(f || {}), [flag]: value ? 1 : 0 })) }
    catch (e: any) { toast({ title: isRTL ? 'خطأ' : 'Error', description: e?.message, variant: 'destructive' }) }
    finally { setBusy(false) }
  }

  if (!flags) return <Skeleton className="h-40 rounded-2xl" />
  const otp = !!flags.otp_test_mode
  const enabled = !!flags.real_estate_enabled

  return (
    <div className="max-w-2xl space-y-4">
      {/* OTP test mode */}
      <div className={`rounded-2xl border-2 p-5 ${otp ? 'border-amber-200 bg-amber-50/40' : 'border-gray-100 bg-white'}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${otp ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}><FlaskConical className="h-5 w-5" /></span>
            <div>
              <p className="text-sm font-semibold text-gray-900">{isRTL ? 'وضع OTP التجريبي' : 'OTP Test Mode'}</p>
              <p className="mt-0.5 text-xs text-gray-500">{isRTL ? 'الرمز الثابت 123456 لأي رقم، بدون إرسال رسائل.' : 'Fixed code 123456 for any number, no SMS sent.'}</p>
            </div>
          </div>
          <Switch checked={otp} onCheckedChange={(v) => setFlag('otp_test_mode', v)} disabled={!canEdit || busy} />
        </div>
        {otp ? (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-100/60 p-2.5 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {isRTL ? 'وضع تطوير — لا تتركه مُفعّلاً في الإنتاج. أي شخص يستطيع التحقق بالرمز 123456.' : 'Development mode — do NOT leave on in production. Anyone can verify with 123456.'}
          </div>
        ) : (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-800">
            <Store className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {isRTL ? 'وضع الإنتاج — يتطلب مزوّد رسائل حقيقي. سيفشل الإرسال إن لم يُضبط.' : 'Production mode — a real SMS provider is required, or sending will fail.'}
          </div>
        )}
      </div>

      {/* Marketplace enabled */}
      <div className="rounded-2xl border-2 border-gray-100 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Store className="h-5 w-5" /></span>
            <div>
              <p className="text-sm font-semibold text-gray-900">{isRTL ? 'تفعيل متجر العقارات' : 'Real Estate Marketplace enabled'}</p>
              <p className="mt-0.5 text-xs text-gray-500">{isRTL ? 'إظهار الوحدة لهذا المستأجر.' : 'Show the module for this tenant.'}</p>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={(v) => setFlag('real_estate_enabled', v)} disabled={!canEdit || busy} />
        </div>
      </div>

      {!canEdit && <p className="text-xs text-gray-400">{isRTL ? 'العرض فقط — لا يمكن للمشرف تغيير الإعدادات.' : 'Read-only — moderators cannot change flags.'}</p>}
    </div>
  )
}
