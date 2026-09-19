'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useBrand } from '@/hooks/use-brand'

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
    useEffect(() => {
        setMounted(true)
        setDbName(window.location.hostname.split('.')[0])
    }, [])

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
        <div className="theme-hr min-h-screen flex items-center justify-center bg-[var(--apex-bg)] px-4" dir="rtl">
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
                            className="h-10 rounded border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-500"
                        />
                    </label>

                    <label className="flex flex-col gap-1.5">
                        <span className="text-[12.5px] font-bold text-slate-600">اسم المستخدم</span>
                        <input
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            autoComplete="username"
                            required
                            className="h-10 rounded border border-slate-300 px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--apex-blue-light)]/40 focus:border-[var(--apex-blue-light)]"
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
                                className="h-10 w-full rounded border border-slate-300 ps-3 pe-9 text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--apex-blue-light)]/40 focus:border-[var(--apex-blue-light)]"
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

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="h-10 rounded bg-[var(--apex-blue-light)] text-white text-[13.5px] font-bold flex items-center justify-center gap-2 hover:bg-[var(--apex-blue-light-hover)] transition-colors disabled:opacity-60"
                    >
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        تسجيل الدخول
                    </button>
                </form>
            </div>
        </div>
    )
}
