'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { CalendarDays, Fingerprint, UserRound, WifiOff } from 'lucide-react'

const NAV = [
  { href: '/m', label: 'البصمة', icon: Fingerprint },
  { href: '/m/history', label: 'السجل', icon: CalendarDays },
  { href: '/m/profile', label: 'حسابي', icon: UserRound },
]

/**
 * Frame for every «/m» screen: phone-width column, bottom tab bar, offline
 * strip, service-worker registration. Colours are tamken3's Masar palette
 * (globals.css --masar-*), written as literals so this bundle doesn't need
 * the HR shell's theme class.
 */
export function MobileShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/m'
  const online = useOnline()
  const bare = pathname.startsWith('/m/login')

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/m-sw.js', { scope: '/m' }).catch(() => {})
  }, [])

  return (
    <div dir="rtl" lang="ar" className="min-h-[100dvh] bg-[#eef3f3] font-[family-name:var(--font-arabic)] text-[#16343a] antialiased">
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col bg-[#f3f6f6] shadow-[0_0_60px_-20px_rgba(15,42,47,.35)]">
        {!online && (
          <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-[#f0ae4f] px-4 py-1.5 text-[12.5px] font-semibold text-[#3b2a0c]">
            <WifiOff className="h-3.5 w-3.5" />
            لا يوجد اتصال بالإنترنت — البصمة تحتاج اتصالاً
          </div>
        )}
        <main className={bare ? 'flex flex-1 flex-col' : 'flex flex-1 flex-col pb-[calc(76px+env(safe-area-inset-bottom))]'}>
          {children}
        </main>
        {!bare && (
          <nav
            aria-label="التنقل"
            className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[480px] border-t border-[#dbe5e6] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
          >
            <ul className="grid grid-cols-3">
              {NAV.map(({ href, label, icon: Icon }) => {
                const active = href === '/m' ? pathname === '/m' : pathname.startsWith(href)
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex h-[64px] flex-col items-center justify-center gap-1 text-[12px] font-semibold transition-colors ${
                        active ? 'text-[#1d4d56]' : 'text-[#7b9396] hover:text-[#2f7480]'
                      }`}
                    >
                      <span className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${active ? 'bg-[#dcefe9]' : ''}`}>
                        <Icon className="h-[21px] w-[21px]" strokeWidth={active ? 2.3 : 1.9} />
                      </span>
                      {label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        )}
      </div>
    </div>
  )
}

function useOnline() {
  const [online, setOnline] = useState(true)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}
