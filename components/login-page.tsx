'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'
import { Loader2, Lock, Mail, AlertCircle, Eye, EyeOff, Globe } from 'lucide-react'
import Image from 'next/image'

export interface LoginBranding {
    appName: string
    logo: string
    host: string
    // Optional scoped theme (clients.json branding.theme, e.g. "lazaa"). Applies
    // `.theme-<theme>` to the login root so a themed tenant's entry screen is on-brand.
    // Absent → "" → default (blue) login, so every existing tenant is unchanged.
    theme?: string
}

export function LoginPage({ branding }: { branding?: LoginBranding }) {
    // ─── All logic preserved exactly as-is ───────────────────────────────────
    const { login, error, isLoading, isAuthenticated, isAdmin } = useAuth()
    const { t, lang, setLang, isRTL } = useI18n()
    const router = useRouter()
    const [email, setEmail] = useState('administrator')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [isDemoLoggingIn, setIsDemoLoggingIn] = useState(false)

    // Per-host branding resolved server-side (clients.json); fall back to defaults.
    const brandName = branding?.appName || 'تمكين'
    const brandLogo = branding?.logo || '/logo.jpeg'
    const brandHost = branding?.host || ''
    const themeClass = branding?.theme ? `theme-${branding.theme}` : ''

    // The platform control plane is served on base.meena.sa. Operator landing logic
    // is host-scoped: it only applies here, so a System Manager on a tenant host
    // (the company's own admin) is NEVER treated as the platform operator.
    const isControlPlaneHost =
        (brandHost || (typeof window !== 'undefined' ? window.location.hostname : '')) === 'base.meena.sa'

    // ── Demo auto-login ──────────────────────────────────────────────────────
    // Sites whose hostname matches demo-*.base.meena.sa are public showcase
    // environments. On load we silently POST to the demo_login endpoint so
    // visitors never see a login form. The endpoint is a no-op (403) on every
    // client site that has not set `demo_autologin` in site_config, so this
    // branch is fully inert on production tenants.
    const isDemoHost =
        typeof window !== 'undefined' &&
        /^demo-[^.]+\.base\.meena\.sa$/i.test(window.location.hostname)

    // Already-authenticated redirect (moved here from the now-server login route).
    useEffect(() => {
        if (!isLoading && isAuthenticated) {
            const explicit = sessionStorage.getItem('postLoginRedirect')
            sessionStorage.removeItem('postLoginRedirect')
            // Honor the middleware's `?redirect=<path>` (set when a logged-out user hits a
            // protected URL — e.g. a shared /rentals-native deep link). Without this the
            // recipient always landed on '/' after logging in, losing the target. Accept
            // only same-origin absolute paths (guard against open-redirect), and ignore a
            // bare '/' so it doesn't shadow the control-plane operator landing below.
            let redirectParam: string | null = null
            // `redirect-to` is Frappe's own param name. Paths that nginx proxies to
            // Frappe (e.g. /invoice-converter) never pass through Next middleware, so
            // their "Login" button is the only thing carrying the target — and it uses
            // Frappe's spelling. Without this a System Manager always landed on
            // /admin?section=domain-settings instead of the page they came from.
            let isFrappePath = false
            try {
                const qs = new URLSearchParams(window.location.search)
                redirectParam = qs.get('redirect')
                if (!redirectParam) {
                    redirectParam = qs.get('redirect-to')
                    isFrappePath = !!redirectParam
                }
            } catch { /* window unavailable — ignore */ }
            const safeRedirect =
                redirectParam &&
                redirectParam.startsWith('/') &&
                !redirectParam.startsWith('//') &&
                !redirectParam.startsWith('/\\') &&
                redirectParam !== '/'
                    ? redirectParam
                    : null
            let target = explicit || safeRedirect || '/'
            // Platform operator (System Manager on the control-plane host) lands on the
            // Domains & Sites / company-creation panel. An explicit redirect (the nader ->
            // /hr case) or a ?redirect= deep link always wins. isAdmin is set atomically
            // with the user, so it is reliable the moment isAuthenticated flips true.
            if (!explicit && !safeRedirect && isControlPlaneHost && isAdmin) {
                target = '/admin?section=domain-settings'
            }
            // A Frappe-served path is not a Next route — client-side routing would 404.
            // Hard-navigate so nginx can hand it to Frappe.
            if (isFrappePath && target === safeRedirect) {
                window.location.assign(target)
                return
            }
            router.replace(target)
        }
    }, [isAuthenticated, isLoading, isAdmin, isControlPlaneHost, router])

    // ── Demo auto-login effect ───────────────────────────────────────────────
    // On demo hosts, silently POST to the demo_login endpoint. On success we
    // hard-reload to '/' so the new session cookie is picked up cleanly by the
    // Next.js auth context. On failure (endpoint refused / network error) the
    // normal login form is shown as a fallback.
    useEffect(() => {
        if (!isDemoHost || isAuthenticated || isLoading) return
        setIsDemoLoggingIn(true)
        fetch('/api/method/base_meena.demo.autologin.demo_login', {
            method: 'POST',
            credentials: 'include',
            headers: { 'X-Frappe-CSRF-Token': 'fetch', 'Content-Type': 'application/json' },
            body: '{}',
        })
            .then(() => {
                // Whether the endpoint returned 200/302 or even 403, try reloading.
                // If the session was created, the auth context will pick it up;
                // if not, the login form will be shown on the next render.
                window.location.replace('/')
            })
            .catch(() => setIsDemoLoggingIn(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDemoHost])
    // ────────────────────────────────────────────────────────────────────────

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        // A developer convenience used to live here: one named account plus its
        // password, compiled into the public bundle, which sent that user to /hr
        // after login. The password no longer works, but shipping a System
        // Manager's account name and a password guess to every visitor is not
        // something to leave in a production build.
        sessionStorage.removeItem('postLoginRedirect')
        await login(email, password)
    }
    // ─────────────────────────────────────────────────────────────────────────

    // While auth state resolves, or if already authenticated (about to redirect),
    // avoid flashing the login form.
    if (isAuthenticated) {
        return null
    }

    // Demo sites show a branded spinner while the auto-login is in flight.
    if (isDemoLoggingIn) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <Image src="/logo.jpeg" alt="Tamkeen" width={56} height={56} priority className="rounded-2xl mx-auto mb-4 shadow-lg" />
                    <div className="w-8 h-8 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm text-gray-400">جاري تسجيل الدخول التلقائي…</p>
                    <p className="text-xs text-gray-300 mt-1">Signing in automatically…</p>
                </div>
            </div>
        )
    }


    return (
        /*
         * Design upgrade: Split-screen layout instead of a centered floating card.
         * Left panel = immersive branded blue gradient (hidden on mobile).
         * Right panel = clean white form area with generous breathing room.
         * On mobile everything collapses to a single centered column.
         */
        <div className={`min-h-screen flex ${themeClass}`} dir={isRTL ? 'rtl' : 'ltr'}>

            {/* ── Left Branding Panel ─────────────────────────────────────────── */}
            <aside className="hidden md:flex md:w-5/12 lg:w-[45%] relative flex-col items-center justify-center p-10 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 overflow-hidden select-none">

                {/* Decorative circles */}
                <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
                <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-white/5" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 rounded-full bg-blue-500/20 blur-3xl" />

                {/* Centered logo */}
                <div className="relative z-10 flex flex-col items-center gap-5">
                    <Image
                        src={brandLogo}
                        alt={brandName}
                        width={80}
                        height={80}
                        className="rounded-2xl shadow-2xl"
                        unoptimized
                    />
                    <span className="text-white font-bold text-2xl tracking-tight">{brandName}</span>
                </div>
            </aside>

            {/* ── Right Form Panel ────────────────────────────────────────────── */}
            {/* Design: Soft slate background, white card, vertically centered form */}
            <div className="flex-1 flex flex-col bg-slate-50/80 min-h-screen">

                {/* Language toggle — top corner, stays out of the form flow */}
                <div className={`flex ${isRTL ? 'justify-start' : 'justify-end'} p-5`}>
                    <button
                        onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-gray-200 hover:border-gray-300 text-sm text-gray-500 hover:text-gray-800 transition-all duration-200 shadow-sm hover:shadow"
                    >
                        <Globe className="h-4 w-4" />
                        {t('lang.switch')}
                    </button>
                </div>

                {/* Vertically-centered form region */}
                <div className="flex-1 flex items-center justify-center px-6 pb-12">
                    <div className="w-full max-w-sm">

                        {/* ── Mobile-only logo (hidden on md+ where left panel shows) */}
                        <div className="md:hidden text-center mb-8 animate-in fade-in duration-300">
                            <Image
                                src={brandLogo}
                                alt={brandName}
                                width={64}
                                height={64}
                                className="rounded-2xl shadow-lg mx-auto mb-4"
                                unoptimized
                            />
                            <h1 className="text-xl font-bold text-gray-900">{brandName}</h1>
                        </div>

                        {/* ── Desktop heading */}
                        <div className="hidden md:block mb-7">
                            <h1 className="text-2xl font-bold text-gray-900">{t('login.submit')}</h1>
                        </div>

                        {/* ── Form card ────────────────────────────────────────── */}
                        {/*
                         * Design: White card with a single subtle shadow instead of heavy
                         * elevation. Border gives clear edges without harsh contrast.
                         */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7 animate-in fade-in slide-in-from-bottom-3 duration-300">
                            <form onSubmit={handleSubmit} className="space-y-5">

                                {/* Error banner — fade in when error appears */}
                                {error && (
                                    <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm animate-in fade-in duration-200">
                                        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                        <span>{error}</span>
                                    </div>
                                )}

                                {/* Email field */}
                                <div className="space-y-1.5">
                                    <label className={`block text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : ''}`}>
                                        {t('login.email_label')}
                                    </label>
                                    {/*
                                     * Improvement: wrap in `group` so the icon color
                                     * transitions to blue when the input is focused —
                                     * a subtle but polished touch.
                                     */}
                                    <div className="relative group">
                                        <Mail className={`absolute ${isRTL ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors duration-200`} />
                                        <input
                                            type="text"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder={t('login.email_placeholder')}
                                            className={`w-full h-11 ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:bg-white transition-all duration-200 text-sm`}
                                            dir={isRTL ? 'rtl' : 'ltr'}
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Password field */}
                                <div className="space-y-1.5">
                                    <label className={`block text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : ''}`}>
                                        {t('login.password_label')}
                                    </label>
                                    <div className="relative group">
                                        <Lock className={`absolute ${isRTL ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors duration-200`} />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder={t('login.password_placeholder')}
                                            className={`w-full h-11 ${isRTL ? 'pr-10 pl-11' : 'pl-10 pr-11'} rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:bg-white transition-all duration-200 text-sm`}
                                            dir={isRTL ? 'rtl' : 'ltr'}
                                            required
                                        />
                                        {/* Improvement: toggle button gets a subtle hover region */}
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className={`absolute ${isRTL ? 'left-3.5' : 'right-3.5'} top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-150`}
                                        >
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/*
                                 * Submit button improvements:
                                 * - `active:scale-[0.99]` — micro press feedback
                                 * - `font-semibold` (was `font-medium`) — more authoritative CTA
                                 * - `hover:shadow-md` — subtle lift on hover
                                 */}
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full h-11 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2.5 shadow-sm shadow-blue-600/20 hover:shadow-md hover:shadow-blue-600/25 mt-1"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            {t('login.loading')}
                                        </>
                                    ) : (
                                        t('login.submit')
                                    )}
                                </button>
                            </form>
                        </div>

                        {/* Footer */}
                        <p className="text-center text-xs text-gray-400 mt-5">
                            {t('app.powered_by')}{brandHost ? ` · ${brandHost}` : ''}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
