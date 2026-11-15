'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Car, Home, LayoutGrid, Receipt, ShoppingCart, Users, Clock, Package, X } from 'lucide-react'

/**
 * Masar Mini: the sections of the full system feel like one product with the Mini board
 * (owner 2026-11-15 «محسش ان انا اتنقلت… بلاقي نفسي في تمكين»). A small floating dock —
 * shown only on Mini sites — goes back to «لوحتي» and jumps between the Mini sections,
 * the vehicles included (one sign-in through the board's /go link on the same domain).
 * Floating on purpose: it never shifts the HR/sales layouts every other client shares.
 */
const BOARD = 'https://mini.msar-erp.com/app/board.html'
const ITEMS = [
  { href: BOARD, label: 'لوحتي', icon: Home, external: true },
  { href: '/employees', label: 'الموظفون', icon: Users },
  { href: '/attendance', label: 'الحضور', icon: Clock },
  { href: '/cashier', label: 'البيع', icon: ShoppingCart },
  { href: '/accounting/sales-invoices', label: 'الفواتير', icon: Receipt },
  { href: '/inventory', label: 'المخزون', icon: Package },
  { href: 'https://mini.msar-erp.com/tc/mini/api/one/go/track', label: 'السيارات', icon: Car, external: true },
]

export function MiniDock() {
  const pathname = usePathname() || ''
  const [open, setOpen] = useState(false)
  // inside the Mini board's frame the board's own sidebar is the navigation — no second dock
  const [embedded, setEmbedded] = useState(false)
  useEffect(() => setEmbedded(window.self !== window.top), [])
  useEffect(() => setOpen(false), [pathname])
  if (embedded) return null
  if (/^\/(login|m|company-select|update-password|setup-wizard)(\/|$)/.test(pathname)) return null
  return (
    <div dir="rtl" className="mini-dock fixed bottom-4 left-4 z-[60] flex flex-col items-start gap-2 print:hidden">
      {open && (
        <nav aria-label="أقسام مسار ميني" className="w-56 overflow-hidden rounded-2xl border border-[#cfe9e1] bg-white shadow-xl">
          <div className="flex items-center justify-between bg-[#062F2A] px-3 py-2 text-sm font-semibold text-white">
            <span>masar Mini</span>
            <button type="button" aria-label="إغلاق" onClick={() => setOpen(false)} className="rounded p-1 hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>
          <ul className="py-1">
            {ITEMS.map(({ href, label, icon: Icon, external }) => {
              const active = !external && pathname.startsWith(href)
              return (
                <li key={href}>
                  <a
                    href={href}
                    className={`flex min-h-11 items-center gap-3 px-3 text-sm ${active ? 'bg-[#e7f3f0] font-semibold text-[#0D685A]' : 'text-[#14201e] hover:bg-[#f2f7f5]'}`}
                  >
                    <Icon className="h-4 w-4 text-[#0D685A]" />
                    {label}
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>
      )}
      <div className="flex gap-2">
        <a
          href={BOARD}
          className="flex h-11 items-center gap-2 rounded-full bg-[#062F2A] px-4 text-sm font-semibold text-white shadow-lg hover:bg-[#0D685A]"
        >
          <Home className="h-4 w-4" />
          لوحتي
        </a>
        <button
          type="button"
          aria-expanded={open}
          aria-label="أقسام مسار ميني"
          onClick={() => setOpen((v) => !v)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0D685A] text-white shadow-lg hover:bg-[#062F2A]"
        >
          <LayoutGrid className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
