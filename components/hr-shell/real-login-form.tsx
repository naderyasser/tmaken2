'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { AlertCircle, Database, Eye, EyeOff, Globe, Loader2, Lock, User } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { callMethod } from '@/lib/api'

const SIGNUP_URL = 'https://base.meena.sa/request-site'
const REMEMBER_KEY = 'hr_remember_me'
const LANG_KEY = 'masar_login_lang'

type Lang = 'ar' | 'en'
const TXT = {
  ar: {
    title: 'تسجيل الدخول', db: 'اسم قاعدة البيانات', user: 'البريد الإلكتروني أو اسم المستخدم', pass: 'كلمة المرور',
    remember: 'تذكرني', forgot: 'هل نسيت كلمة المرور؟', sending: 'جارٍ الإرسال…', submit: 'تسجيل الدخول',
    signup: 'إنشاء حساب جديد', show: 'إظهار كلمة المرور', hide: 'إخفاء كلمة المرور',
    needUser: 'أدخل البريد الإلكتروني أو اسم المستخدم أولاً', notAllowed: 'لا يمكن إعادة تعيين كلمة مرور هذا الحساب',
    disabled: 'هذا الحساب معطّل', notFound: 'لا يوجد حساب بهذا البريد أو الاسم', sent: 'تم إرسال رابط إعادة التعيين إلى بريدك',
    sendFail: 'تعذّر إرسال رابط إعادة التعيين', other: 'English',
  },
  en: {
    title: 'Sign in', db: 'Database name', user: 'Email or username', pass: 'Password',
    remember: 'Remember me', forgot: 'Forgot your password?', sending: 'Sending…', submit: 'Sign in',
    signup: 'Create new account', show: 'Show password', hide: 'Hide password',
    needUser: 'Enter your email or username first', notAllowed: "This account's password can't be reset",
    disabled: 'This account is disabled', notFound: 'No account with this email or username', sent: 'A reset link was sent to your email',
    sendFail: "Couldn't send the reset link", other: 'العربية',
  },
} as const

/**
 * Masar Time sign-in, after the owner's mockup: the fingerprint-terminal
 * photo on the left, a dark charcoal panel on the right with the bronze logo,
 * bronze-outlined fields, a bronze button and «إنشاء حساب جديد». Arabic /
 * English switch (text + direction, remembered). Most visits never see it —
 * the walkthrough session opens automatically (lib/public-access.ts).
 */
export function RealLoginForm() {
  const { login, error, isLoading, isAuthenticated } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [lang, setLang] = useState<Lang>('ar')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [dbName, setDbName] = useState('')
  const [remember, setRemember] = useState(true)
  const [resetting, setResetting] = useState(false)
  // Only a sign-in made on this page moves on to the dashboard — an older
  // session must not skip the login screen (owner, 2026-10-05).
  const [submitted, setSubmitted] = useState(false)
  const t = TXT[lang]
  const dir = lang === 'ar' ? 'rtl' : 'ltr'

  useEffect(() => {
    setDbName(window.location.hostname.split('.')[0])
    try {
      const r = window.localStorage.getItem(REMEMBER_KEY); if (r !== null) setRemember(r === '1')
      const l = window.localStorage.getItem(LANG_KEY); if (l === 'en' || l === 'ar') setLang(l)
    } catch { /* storage unavailable */ }
  }, [])
  const switchLang = () => {
    const next: Lang = lang === 'ar' ? 'en' : 'ar'
    setLang(next)
    try { window.localStorage.setItem(LANG_KEY, next) } catch { /* ignore */ }
  }
  const toggleRemember = (checked: boolean) => {
    setRemember(checked)
    try { window.localStorage.setItem(REMEMBER_KEY, checked ? '1' : '0') } catch { /* ignore */ }
  }

  const handleForgotPassword = async () => {
    if (!username.trim()) { toast.error(t.needUser); return }
    setResetting(true)
    try {
      // reset_password answers failures with a plain string ("not allowed",
      // "disabled", "not found") and success with an empty message.
      const outcome = (await callMethod('frappe.core.doctype.user.user.reset_password', { user: username.trim() }))?.message
      if (outcome === 'not allowed') toast.error(t.notAllowed)
      else if (outcome === 'disabled') toast.error(t.disabled)
      else if (outcome === 'not found') toast.error(t.notFound)
      else toast.success(t.sent)
    } catch {
      toast.error(t.sendFail)
    } finally {
      setResetting(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated || !submitted) return
    const redirect = searchParams.get('redirect')
    router.replace(redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/hr')
  }, [isAuthenticated, submitted, router, searchParams])

  const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); setSubmitted(true); await login(username, password) }


  const field = 'h-12 w-full rounded-lg border border-[#2c9c9a]/70 bg-[#0d2328] ps-11 pe-4 text-[14.5px] text-white placeholder:text-white/40 outline-none transition focus:border-[#7fd1a8] focus:ring-2 focus:ring-[#6cc196]/25'
  const icon = 'pointer-events-none absolute start-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#6cc196]'

  return (
    <div className="relative flex min-h-screen bg-[#0f2a2f] font-[family-name:var(--font-arabic)] text-white" dir="ltr">
      {/* photo — left, like the mockup, whatever the language */}
      <div className="relative hidden w-[44%] shrink-0 overflow-hidden lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/branding/masar/login-photo.webp" alt="" className="absolute inset-0 h-full w-full object-cover object-[30%_center]" />
        <div aria-hidden className="absolute inset-y-0 right-0 w-40 bg-gradient-to-r from-transparent to-[#0f2a2f]" />
      </div>

      <div dir={dir} lang={lang} className="relative flex flex-1 items-center justify-center px-5 py-14">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_420px_at_50%_18%,rgba(108,193,150,.13),transparent_70%)]" />
        <button type="button" onClick={switchLang} data-testid="lang-switch"
          className="absolute end-5 top-5 z-10 inline-flex items-center gap-2 rounded-full border border-[#2c9c9a]/50 px-4 py-1.5 text-[13px] text-white/80 transition hover:border-[#7fd1a8] hover:text-white">
          <Globe className="h-4 w-4" aria-hidden />{t.other}
        </button>

        <div className="relative w-full max-w-[440px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/branding/masar/masar-logo-white.png" alt="masar TIME" className="mx-auto h-[86px] w-auto" />
          <h1 className="mb-6 mt-5 text-center text-[26px] font-bold text-white/95">{t.title}</h1>

          <form onSubmit={handleSubmit} data-testid="login-form"
            className="rounded-2xl border border-white/[.06] bg-[#163a41]/90 p-6 shadow-[0_30px_70px_-25px_rgba(0,0,0,.85)] sm:p-7">
            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2.5 text-[13px] text-red-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
              </div>
            )}
            <div className="space-y-3.5">
              <label className="relative block" title={t.db}>
                <span className="sr-only">{t.db}</span>
                <Database className={icon} />
                <input value={dbName} readOnly aria-readonly aria-label={t.db} className={`${field} cursor-default text-white/75`} dir="ltr" />
              </label>
              <label className="relative block">
                <span className="sr-only">{t.user}</span>
                <User className={icon} />
                <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required
                  placeholder={t.user} aria-label={t.user} className={field} name="username" />
              </label>
              <label className="relative block">
                <span className="sr-only">{t.pass}</span>
                <Lock className={icon} />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password" required placeholder={t.pass} aria-label={t.pass} className={`${field} pe-11`} name="password" />
                <button type="button" tabIndex={-1} onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? t.hide : t.show}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-white/45 hover:text-white">
                  {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                </button>
              </label>
            </div>

            <div className="mt-4 flex items-center justify-between text-[13px]">
              <label className="flex cursor-pointer items-center gap-2 text-white/80">
                <input type="checkbox" checked={remember} onChange={(e) => toggleRemember(e.target.checked)} className="h-4 w-4 cursor-pointer accent-[#6cc196]" />
                {t.remember}
              </label>
              <button type="button" onClick={handleForgotPassword} disabled={resetting} className="text-[#7fd1a8] hover:underline disabled:opacity-60">
                {resetting ? t.sending : t.forgot}
              </button>
            </div>

            <button type="submit" disabled={isLoading}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-[#36a6a3] to-[#24817f] text-[16px] font-bold text-white shadow-[0_10px_26px_-10px_rgba(44,156,154,.75)] transition hover:brightness-110 disabled:opacity-60">
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}{t.submit}
            </button>

            <a href={SIGNUP_URL} target="_blank" rel="noopener noreferrer" className="mt-4 block text-center text-[13.5px] text-white/70 hover:text-[#7fd1a8]">
              {t.signup}
            </a>
          </form>
          <p className="mt-6 text-center text-[11.5px] text-white/30">© {new Date().getFullYear()} Masar Time</p>
        </div>
      </div>
    </div>
  )
}
