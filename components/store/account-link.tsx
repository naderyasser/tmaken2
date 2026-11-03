'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User } from 'lucide-react'
import { accountApi, ACCOUNT_EVENT } from '@/lib/account-api'

// Storefront account entry — renders nothing until the accounts flag resolves on. On qarawi
// (flag off) this is invisible, so the storefront looks unchanged. Shows a filled state once
// a session exists.
export default function AccountLink({ mobile = false }: { mobile?: boolean }) {
  const [enabled, setEnabled] = useState(false)
  const [authed, setAuthed] = useState(false)
  const pathname = usePathname().replace(/^\/store(?=\/|$)/, '') || '/'
  const active = pathname.startsWith('/account')

  useEffect(() => {
    let alive = true
    accountApi.getConfig().then((c) => {
      if (!alive || !c.enabled) return
      setEnabled(true)
      accountApi.getMe().then((m) => alive && setAuthed(!!m.authenticated))
    })
    const onAccount = () => accountApi.getMe(true).then((m) => alive && setAuthed(!!m.authenticated))
    window.addEventListener(ACCOUNT_EVENT, onAccount)
    return () => { alive = false; window.removeEventListener(ACCOUNT_EVENT, onAccount) }
  }, [])

  if (!enabled) return null

  if (mobile) {
    return <Link href="/account" className={`aqar-nav-mobile-link${active ? ' active' : ''}`}>{authed ? 'حسابي' : 'تسجيل الدخول'}</Link>
  }
  return (
    <Link
      href="/account"
      aria-label={authed ? 'حسابي' : 'تسجيل الدخول'}
      title={authed ? 'حسابي' : 'تسجيل الدخول'}
      className={`flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors ${active || authed ? 'border-[var(--aqar-green)] bg-[var(--aqar-green)]/10 text-[var(--aqar-green-d)]' : 'border-[var(--aqar-sand-2)] text-[var(--aqar-kohl)]/70 hover:border-[var(--aqar-green)]/40'}`}
    >
      <User className="h-4 w-4" />
      <span className="hidden sm:inline">{authed ? 'حسابي' : 'دخول'}</span>
    </Link>
  )
}
