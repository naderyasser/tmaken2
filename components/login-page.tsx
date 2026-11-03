'use client'

import { useEffect, useState } from 'react'
import { Loader2, ShieldAlert } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { getCurrentUser } from '@/lib/api'
import { redirectToLogin } from '@/lib/public-access'

/** Kept for the /login route's server component signature. */
export interface LoginBranding {
    appName: string
    logo: string
    host: string
    theme?: string
}

/**
 * Fallback rendered by every guarded page's `if (!isAuthenticated) return
 * <LoginPage />` while a session-less visitor is bounced to the real sign-in
 * screen at /login (components/hr-shell/real-login-form.tsx). Login is
 * required everywhere in this build (walkthrough auto-login retired
 * 2026-09-16) — this component's only job is to redirect there.
 */
export function LoginPage(_props: { branding?: LoginBranding } = {}) {
    const { isAuthenticated, isLoading } = useAuth()

    useEffect(() => {
        if (isLoading || isAuthenticated) return
        redirectToLogin()
    }, [isAuthenticated, isLoading])

    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#f4f5f7] text-slate-600" dir="rtl">
            <Loader2 className="h-7 w-7 animate-spin text-[#2e71c8]" />
            <span className="text-[14px] font-bold">جارٍ التحويل لتسجيل الدخول…</span>
        </div>
    )
}

/**
 * In-page variant used by list screens when a data call came back 401/403.
 * Two different things hide behind that status: the session died (send the
 * visitor to sign in again), or the account genuinely lacks the doctype
 * permission (say so — redirecting would just bounce the page for nothing).
 */
export function SessionRenew({ label = 'جارٍ التحقق من الجلسة…' }: { label?: string }) {
    const [denied, setDenied] = useState(false)

    useEffect(() => {
        let cancelled = false
        getCurrentUser()
            .then((u) => {
                if (cancelled) return
                if (!u || u === 'Guest') redirectToLogin()
                else setDenied(true)
            })
            .catch(() => { if (!cancelled) redirectToLogin() })
        return () => { cancelled = true }
    }, [])

    if (denied) {
        return (
            <div className="flex flex-col items-center gap-2 rounded border border-amber-200 bg-amber-50 px-4 py-8 text-center" dir="rtl">
                <ShieldAlert className="h-6 w-6 text-amber-600" />
                <span className="text-[13px] font-bold text-amber-800">هذه الشاشة تحتاج صلاحية غير متاحة لحسابك</span>
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
