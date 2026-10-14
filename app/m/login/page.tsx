'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Hash, Loader2, Lock } from 'lucide-react'

import { errorText, mcall } from '@/lib/m/api'

export default function MobileLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const params = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // one browser holds ONE session per site: signing in here ends an HR/admin
  // session in the same browser (that is how «HR access required» happens)
  const [deskSession, setDeskSession] = useState(false)
  useEffect(() => {
    const c = Object.fromEntries(document.cookie.split('; ').map((x) => x.split('=')))
    setDeskSession(c.system_user === 'yes' && !!c.user_id && c.user_id !== 'Guest')
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError('أدخل رقم الموظف وكلمة المرور')
      return
    }
    setBusy(true)
    setError('')
    try {
      await mcall('login', { username: username.trim(), password })
      const next = params.get('redirect') || '/m'
      // full navigation: the API client starts clean with the new session's CSRF token
      window.location.replace(next.startsWith('/m') ? next : '/m')
    } catch (err) {
      setError(errorText(err, 'تعذّر تسجيل الدخول، تحقق من الاتصال وحاول مرة أخرى'))
      setBusy(false)
    }
  }

  const field =
    'h-[52px] w-full rounded-xl border border-[#2c9c9a]/60 bg-[#0d2328] ps-11 pe-4 text-[16px] text-white placeholder:text-white/35 outline-none transition focus:border-[#7fd1a8] focus:ring-2 focus:ring-[#6cc196]/25'
  const icon = 'pointer-events-none absolute start-3.5 top-1/2 h-[19px] w-[19px] -translate-y-1/2 text-[#6cc196]'

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[#0f2a2f] px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(48px,env(safe-area-inset-top))] text-white">
      <FingerprintBackdrop />

      <div className="relative z-10 flex flex-1 flex-col">
        <img src="/branding/masar/masar-logo-white.png" alt="Masar Time" className="mx-auto mt-6 h-[64px] w-auto" />
        <p className="mt-3 text-center text-[14px] text-white/60">بصمة الحضور والانصراف من جوالك</p>

        <form onSubmit={submit} noValidate className="mt-auto rounded-2xl border border-white/[.07] bg-[#163a41]/90 p-5 shadow-[0_30px_70px_-25px_rgba(0,0,0,.85)] backdrop-blur">
          <h1 className="mb-5 text-[20px] font-bold">تسجيل الدخول</h1>

          {deskSession && (
            <p className="mb-4 rounded-lg border border-[#f0ae4f]/40 bg-[#f0ae4f]/10 px-3 py-2.5 text-[13px] leading-relaxed text-[#ffd59a]">
              أنت مسجّل الدخول حالياً بحساب إداري في هذا المتصفح. الدخول هنا سيُخرجك منه — للتجربة استخدم نافذة خاصة أو متصفحاً آخر.
            </p>
          )}

          <label className="mb-1.5 block text-[13px] text-white/70" htmlFor="m-user">رقم الموظف</label>
          <div className="relative mb-4">
            <Hash className={icon} />
            <input
              id="m-user"
              inputMode="numeric"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="مثال: 1024"
              className={`${field} tabular-nums`}
            />
          </div>

          <label className="mb-1.5 block text-[13px] text-white/70" htmlFor="m-pass">كلمة المرور</label>
          <div className="relative">
            <Lock className={icon} />
            <input
              id="m-pass"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${field} pe-12`}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              className="absolute end-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-white/55 hover:text-white"
            >
              {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
            </button>
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-lg border border-[#f0ae4f]/40 bg-[#f0ae4f]/10 px-3 py-2.5 text-[13.5px] text-[#ffd59a]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-5 flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#36a6a3] to-[#24817f] text-[16.5px] font-bold shadow-[0_10px_26px_-10px_rgba(44,156,154,.75)] transition active:scale-[.99] disabled:opacity-60"
          >
            {busy && <Loader2 className="h-5 w-5 animate-spin" />}
            دخول
          </button>

          <p className="mt-4 text-center text-[12.5px] leading-relaxed text-white/45">
            كلمة المرور يصدرها قسم الموارد البشرية من شاشة «تطبيق الجوال»
          </p>
        </form>

        <p className="mt-6 text-center text-[11.5px] text-white/30">© {new Date().getFullYear()} Masar Time</p>
      </div>
    </div>
  )
}

/** Concentric fingerprint ridges, decorative only. */
function FingerprintBackdrop() {
  return (
    <svg aria-hidden viewBox="0 0 400 400" className="pointer-events-none absolute -top-16 left-1/2 h-[520px] w-[520px] -translate-x-1/2 opacity-[.13]">
      <defs>
        <radialGradient id="fpg" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#7fd1a8" />
          <stop offset="100%" stopColor="#2c9c9a" stopOpacity="0" />
        </radialGradient>
      </defs>
      {Array.from({ length: 11 }).map((_, i) => (
        <path
          key={i}
          d={`M ${200 - (24 + i * 15)} ${215 + i * 3} a ${24 + i * 15} ${28 + i * 16} 0 1 1 ${2 * (24 + i * 15)} 0`}
          fill="none"
          stroke="url(#fpg)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={i % 3 === 1 ? '40 14' : undefined}
        />
      ))}
    </svg>
  )
}
