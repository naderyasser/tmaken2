'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

/** Storefront dark-mode toggle. Toggles `dark` on the store root (`.aqar-store`) — the
 *  class the dark tokens are scoped to and the one Tailwind's `class` darkMode strategy
 *  matches — and persists to the `aqar-theme` cookie (+ legacy localStorage), which the
 *  no-FOUC inline script in the store layout applies before first paint.
 *  Label/icon reflect the ACTUAL applied theme. */
export default function ThemeToggle() {
  const [dark, setDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setDark(!!document.querySelector('.aqar-store')?.classList.contains('dark'))
    setMounted(true)
  }, [])

  const toggle = () => {
    const root = document.querySelector('.aqar-store')
    if (!root) return
    const next = !root.classList.contains('dark')
    root.classList.toggle('dark', next)
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
    const value = next ? 'dark' : 'light'
    document.cookie = `aqar-theme=${value}; path=/; max-age=31536000; SameSite=Lax`
    try { localStorage.setItem('aqar_theme', value) } catch { /* private mode */ }
    setDark(next)
  }

  return (
    <button
      onClick={toggle}
      aria-pressed={dark}
      aria-label={dark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
      title={dark ? 'الوضع الفاتح' : 'الوضع الداكن'}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--aqar-border)] text-[var(--aqar-kohl)]/70 transition-colors hover:text-[var(--aqar-green)] hover:border-[var(--aqar-green)]"
    >
      {/* avoid icon flash before we know the theme */}
      {mounted && (dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />)}
    </button>
  )
}
