'use client'

import { useEffect, useState } from 'react'
import { Loader2, ShieldAlert } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { getCurrentUser } from '@/lib/api'
import { renewWalkthroughSession, walkthroughEnabled } from '@/lib/public-access'

/** Kept for the (now redirect-only) /login route's server component signature. */
export interface LoginBranding {
    appName: string
    logo: string
    host: string
    theme?: string
}

/**
 * There is no login form in this build. Every place that used to render the
 * credentials screen when a visitor had no session now renders this instead:
 * it opens the walkthrough session (real Frappe cookies for the fixed account)
 * and comes straight back to the same URL. See lib/public-access.ts.
 */
export function LoginPage(_props: { branding?: LoginBranding } = {}) {
    const { isAuthenticated, isLoading } = useAuth()
    const [disabled, setDisabled] = useState(false)

    useEffect(() => {
        if (isLoading || isAuthenticated) return
        let cancelled = false
        walkthroughEnabled().then((ok) => {
            if (cancelled) return
            if (ok) renewWalkthroughSession()
            else setDisabled(true)
        })
        return () => { cancelled = true }
    }, [isAuthenticated, isLoading])

    if (disabled) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#f4f5f7] px-6 text-center" dir="rtl">
                <ShieldAlert className="h-8 w-8 text-amber-600" />
                <span className="text-[15px] font-bold text-slate-800">الدخول التلقائي غير مفعّل على هذا الموقع</span>
                <span className="max-w-md text-[13px] text-slate-500">
                    يحتاج الموقع إلى حساب العرض ومفتاح <code dir="ltr">walkthrough_autologin_user</code> في إعدادات الموقع (site_config).
                </span>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#f4f5f7] text-slate-600" dir="rtl">
            <Loader2 className="h-7 w-7 animate-spin text-[#2e71c8]" />
            <span className="text-[14px] font-bold">جارٍ فتح الجلسة…</span>
        </div>
    )
}

/**
 * In-page variant used by list screens when a data call came back 401/403.
 * Two different things hide behind that status: the session died (renew it),
 * or the account genuinely lacks the doctype permission (say so — renewing
 * would just bounce the page for nothing).
 */
export function SessionRenew({ label = 'جارٍ تجديد الجلسة…' }: { label?: string }) {
    const [denied, setDenied] = useState(false)

    useEffect(() => {
        let cancelled = false
        getCurrentUser()
            .then((u) => {
                if (cancelled) return
                if (!u || u === 'Guest') renewWalkthroughSession()
                else setDenied(true)
            })
            .catch(() => { if (!cancelled) renewWalkthroughSession() })
        return () => { cancelled = true }
    }, [])

    if (denied) {
        return (
            <div className="flex flex-col items-center gap-2 rounded border border-amber-200 bg-amber-50 px-4 py-8 text-center" dir="rtl">
                <ShieldAlert className="h-6 w-6 text-amber-600" />
                <span className="text-[13px] font-bold text-amber-800">هذه الشاشة تحتاج صلاحية غير متاحة لحساب العرض</span>
            </div>
        )
    }
    return (
        <div className="flex flex-col items-center gap-2 rounded border bg-white px-4 py-12 text-center text-slate-600" dir="rtl">
            <Loader2 className="h-6 w-6 animate-spin text-[#2e71c8]" />
            <span className="text-[13px] font-bold">{label}</span>
        </div>
    )
}
