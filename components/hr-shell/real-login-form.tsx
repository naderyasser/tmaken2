'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2, AlertCircle, Home } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useBrand } from '@/hooks/use-brand'
import { callMethod } from '@/lib/api'

// Apex's own sign-up destination for a visitor with no account yet.
const SIGNUP_URL = 'https://base.meena.sa/request-site'
const REMEMBER_KEY = 'hr_remember_me'

/**
 * The one real login screen in this build. Every other page still opens the
 * walkthrough session automatically (see lib/public-access.ts) — this form
 * exists only so a visitor who has an actual account (e.g. the `admin`
 * account created for client handover) can sign in as themselves instead of
 * landing on the fixed walkthrough user. Styled after the Apex ERP reference
 * (login.erp-apex.com/login): database-name field + username + password.
 */
export function RealLoginForm() {
    const { login, error, isLoading, isAuthenticated } = useAuth()
    const brand = useBrand()
    const router = useRouter()
    const searchParams = useSearchParams()

    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [mounted, setMounted] = useState(false)
    // SSR-safe: the server render has no hostname, so this stays '' until mount
    // (matches the `mounted` gating already used for brand/auth bits below).
    const [dbName, setDbName] = useState('')
    // «تذكرني» — Frappe already issues a 30-day `sid` session on every login
    // regardless of this flag; it's persisted purely so the checkbox itself
    // remembers the visitor's choice across visits (no backend call reads it).
    const [remember, setRemember] = useState(true)
    const [resettingPassword, setResettingPassword] = useState(false)
    useEffect(() => {
        setMounted(true)
        setDbName(window.location.hostname.split('.')[0])
        try {
            const stored = window.localStorage.getItem(REMEMBER_KEY)
            if (stored !== null) setRemember(stored === '1')
        } catch { /* localStorage unavailable (private mode) — keep the default */ }
    }, [])

    const toggleRemember = (checked: boolean) => {
        setRemember(checked)
        try { window.localStorage.setItem(REMEMBER_KEY, checked ? '1' : '0') } catch { /* ignore */ }
    }

    const handleForgotPassword = async () => {
        if (!username.trim()) {
            toast.error('يرجى إدخال البريد الالكتروني او اسم المستخدم أولاً', { duration: 1000 })
            return
        }
        setResettingPassword(true)
        try {
            // Frappe's reset_password returns a plain string for every failure
            // case ("not allowed" for Administrator, "disabled", "not found")
            // and only msgprints on success (message comes back empty/null) —
            // checking just the HTTP status showed a false "sent" toast for
            // any of those three cases (found by an exhaustive audit, 2026-09-20).
            const result = await callMethod('frappe.core.doctype.user.user.reset_password', { user: username.trim() })
            const outcome = result?.message
            if (outcome === 'not allowed') {
                toast.error('لا يمكن إعادة تعيين كلمة مرور هذا الحساب', { duration: 1000 })
            } else if (outcome === 'disabled') {
                toast.error('هذا الحساب معطّل', { duration: 1000 })
            } else if (outcome === 'not found') {
                toast.error('لا يوجد حساب بهذا البريد او الاسم', { duration: 1000 })
            } else {
                toast.success('تم إرسال رابط إعادة التعيين إلى بريدك', { duration: 1000 })
            }
        } catch {
            toast.error('تعذّر إرسال رابط إعادة التعيين، تحقق من البريد او اسم المستخدم', { duration: 1000 })
        } finally {
            setResettingPassword(false)
        }
    }

    useEffect(() => {
        if (!isAuthenticated) return
        const redirect = searchParams.get('redirect')
        const target = redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/hr'
        router.replace(target)
    }, [isAuthenticated, router, searchParams])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        await login(username, password)
    }

    if (isAuthenticated) return null

    return (
        <div className="theme-hr min-h-screen flex flex-col bg-[var(--apex-bg)]" dir="rtl">
            {/* 5.27: top pills «الرئيسية» + «English» — Arabic-only build, so the
                English pill is present (Apex parity) but inert (no-op). */}
            <div className="flex items-center justify-end gap-2 px-6 py-4">
                <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 h-8 px-4 rounded-full border border-[var(--apex-border)] bg-white text-[12.5px] font-bold text-slate-600 hover:border-[var(--apex-blue-light)] hover:text-[var(--apex-blue-light)]"
                >
                    <Home className="h-3.5 w-3.5" aria-hidden />
                    الرئيسية
                </Link>
                <button
                    type="button"
                    title="English"
                    aria-disabled="true"
                    className="inline-flex items-center h-8 px-4 rounded-full border border-[var(--apex-border)] bg-white text-[12.5px] font-bold text-slate-400 cursor-default select-none"
                >
                    English
                </button>
            </div>

            {/* Two columns: neutral photo panel on the LEFT, form on the RIGHT. */}
            <div className="flex-1 flex flex-col lg:flex-row-reverse items-stretch">
                {/* Form column (right in RTL = first in a row-reverse flex) */}
                <div className="flex-1 flex items-center justify-center px-4 py-8">
                    <div className="w-full max-w-sm">
                        <div className="flex items-center justify-center gap-2 mb-6">
                            {mounted && brand.logo ? (
                                <span className="relative block h-10 w-[140px]">
                                    <Image src={brand.logo} alt="" fill sizes="140px" className="object-contain" unoptimized />
                                </span>
                            ) : (
                                <>
                                    <span className="font-serif italic font-bold text-[28px] leading-none tracking-wide text-[var(--apex-blue-deep)]">Apex</span>
                                    <span className="bg-[var(--apex-blue-deep)] text-white rounded px-1.5 py-[3px] text-[12px] font-extrabold not-italic leading-none">ERP</span>
                                </>
                            )}
                        </div>

                        <form
                            onSubmit={handleSubmit}
                            className="bg-white rounded-lg shadow-sm border border-black/5 p-6 flex flex-col gap-4"
                        >
                            <h1 className="text-[15px] font-bold text-slate-800 text-center mb-1">تسجيل الدخول</h1>

                            {error && (
                                <div className="flex items-start gap-2 bg-red-50 text-red-700 text-[12.5px] rounded px-3 py-2">
                                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <label className="flex flex-col gap-1.5">
                                <span className="text-[12.5px] font-bold text-slate-600">اسم قاعدة البيانات</span>
                                <input
                                    value={dbName}
                                    readOnly
                                    disabled
                                    placeholder="اسم الشركة"
                                    className="h-10 rounded border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-500 placeholder:text-slate-400"
                                />
                            </label>

                            <label className="flex flex-col gap-1.5">
                                <span className="text-[12.5px] font-bold text-slate-600">البريد الالكتروني او اسم المستخدم</span>
                                <input
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    autoComplete="username"
                                    required
                                    placeholder="البريد الالكتروني او اسم المستخدم"
                                    className="h-10 rounded border border-slate-300 px-3 text-[13px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--apex-blue-light)]/40 focus:border-[var(--apex-blue-light)]"
                                />
                            </label>

                            <label className="flex flex-col gap-1.5">
                                <span className="text-[12.5px] font-bold text-slate-600">كلمة المرور</span>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        autoComplete="current-password"
                                        required
                                        placeholder="كلمة المرور"
                                        className="h-10 w-full rounded border border-slate-300 ps-3 pe-9 text-[13px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--apex-blue-light)]/40 focus:border-[var(--apex-blue-light)]"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((s) => !s)}
                                        aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                                        className="absolute inset-y-0 end-2 flex items-center text-slate-400 hover:text-slate-600"
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </label>

                            <div className="flex items-center justify-between text-[12.5px]">
                                <label className="flex items-center gap-1.5 font-bold text-slate-600 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={remember}
                                        onChange={(e) => toggleRemember(e.target.checked)}
                                        className="h-3.5 w-3.5 accent-[var(--apex-blue-light)] cursor-pointer"
                                    />
                                    تذكرني
                                </label>
                                <button
                                    type="button"
                                    onClick={handleForgotPassword}
                                    disabled={resettingPassword}
                                    className="font-bold text-[var(--apex-blue-light)] hover:underline disabled:opacity-60"
                                >
                                    {resettingPassword ? 'جارٍ الإرسال…' : 'هل نسيت كلمة المرور'}
                                </button>
                            </div>

                            {/* 5.27: wide GREEN button (Apex's own submit colour on
                                this screen — distinct from the blue topbar/sidebar). */}
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="h-10 rounded bg-[var(--apex-green)] text-white text-[13.5px] font-bold flex items-center justify-center gap-2 hover:bg-[var(--apex-green-dark)] transition-colors disabled:opacity-60"
                            >
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                تسجيل الدخول
                            </button>
                        </form>

                        <p className="mt-4 text-center text-[12.5px] font-bold text-slate-500">
                            هل لديك حساب ؟{' '}
                            <a
                                href={SIGNUP_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[var(--apex-blue-light)] hover:underline"
                            >
                                إنشاء حساب
                            </a>
                        </p>
                    </div>
                </div>

                {/* Photo panel — LEFT. No stock people photo lives in public/ for
                    this build (only unrelated grocery/branding assets), so this is
                    the documented fallback: a plain --apex-bg panel with the logo,
                    never a mismatched or people-containing image. */}
                <div className="hidden lg:flex flex-1 items-center justify-center bg-[var(--apex-bg)] border-e border-black/5">
                    {mounted && brand.logo ? (
                        <span className="relative block h-24 w-[320px]">
                            <Image src={brand.logo} alt="" fill sizes="320px" className="object-contain" unoptimized />
                        </span>
                    ) : (
                        <div className="flex items-center gap-3">
                            <span className="font-serif italic font-bold text-[48px] leading-none tracking-wide text-[var(--apex-blue-deep)]">Apex</span>
                            <span className="bg-[var(--apex-blue-deep)] text-white rounded px-2.5 py-1 text-[18px] font-extrabold not-italic leading-none">ERP</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
