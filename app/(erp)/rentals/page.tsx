'use client'

// Meena Rentals (egarsys) launcher. The dashboard `rentals` card points here. On
// mount it asks the backend to mint a short-lived SSO token
// (base_meena.aqar_bridge.api.get_sso_launch_url) and redirects the browser to the
// tenant's egarsys instance (<slug>.meena-alaqariya.com/api/sso/consume) already
// logged in — no second sign-in. This page never sees the token beyond the redirect.

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'
import { frappeClient } from '@/lib/api-client'
import { KeyRound, Loader2, AlertTriangle, ArrowRight, ArrowLeft } from 'lucide-react'

type Phase = 'loading' | 'redirecting' | 'error'

export default function RentalsLauncher() {
  const { isAuthenticated, isLoading, moduleAccess } = useAuth()
  const { isRTL } = useI18n()
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState<string>('')
  const started = useRef(false)

  useEffect(() => {
    if (isLoading || started.current) return
    if (!isAuthenticated) { router.replace('/'); return }
    if (!moduleAccess.rentals) {
      setPhase('error')
      setError(isRTL ? 'ليس لديك صلاحية الوصول إلى إدارة الإيجارات.' : 'You do not have access to Rentals.')
      return
    }
    started.current = true
    let cancelled = false
    ;(async () => {
      try {
        const res = await frappeClient.call<{ url: string }>('base_meena.aqar_bridge.api.get_sso_launch_url')
        const url = (res as any)?.message?.url as string | undefined
        if (!url) throw new Error('no_url')
        if (cancelled) return
        setPhase('redirecting')
        window.location.href = url
      } catch (e: any) {
        if (cancelled) return
        const msg = String(e?.message || '')
        setPhase('error')
        setError(
          /not provisioned|لم يتم/i.test(msg)
            ? (isRTL ? 'لم يتم تجهيز إدارة الإيجارات لهذه النسخة بعد. تواصل مع مشغّل المنصة.' : 'Rentals is not set up for this tenant yet. Contact the platform operator.')
            : (isRTL ? 'تعذّر فتح إدارة الإيجارات. حاول مرة أخرى.' : 'Could not open Rentals. Please try again.')
        )
      }
    })()
    return () => { cancelled = true }
  }, [isLoading, isAuthenticated, moduleAccess.rentals, isRTL, router])

  const Back = isRTL ? ArrowRight : ArrowLeft

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white shadow-sm p-8 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-600 to-orange-800 text-white">
          <KeyRound className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold text-amber-900 mb-2">
          {isRTL ? 'إدارة الإيجارات — مينا' : 'Rentals — Meena'}
        </h1>

        {phase !== 'error' ? (
          <>
            <p className="text-slate-600 mb-6">
              {phase === 'redirecting'
                ? (isRTL ? 'جارٍ تحويلك إلى تطبيق الإيجارات…' : 'Redirecting you to the rentals app…')
                : (isRTL ? 'جارٍ فتح إدارة الإيجارات وتسجيل دخولك…' : 'Opening Rentals and signing you in…')}
            </p>
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-amber-600" />
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <p className="text-slate-700 mb-6">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Back className="h-4 w-4" />
              {isRTL ? 'العودة للرئيسية' : 'Back to home'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
