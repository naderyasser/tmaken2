"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Map, Plus, ClipboardList, User, Route, Wallet, ArrowLeftRight, Percent } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"
import { useHiddenRepFeatures } from "@/lib/sales-rep-features"

const NAV_ITEMS = [
  { href: "/sales-rep", icon: Home, labelKey: "sr.nav.home", exact: true },
  { href: "/sales-rep/route-plan", icon: Route, labelKey: "sr.nav.route" },
  { href: "/sales-rep/my-map", icon: Map, labelKey: "sr.nav.map" },
  { href: "/sales-rep/new-order", icon: Plus, labelKey: "sr.nav.new_order", accent: true },
  { href: "/sales-rep/order-history", icon: ClipboardList, labelKey: "sr.nav.orders" },
  { href: "/sales-rep/wallet", icon: Wallet, labelKey: "sr.nav.wallet", feature: "wallet" },
  { href: "/sales-rep/commission", icon: Percent, labelKey: "sr.nav.commission", feature: "commission" },
  { href: "/sales-rep/stock-requests", icon: ArrowLeftRight, labelKey: "sr.nav.stock" },
  { href: "/sales-rep/profile", icon: User, labelKey: "sr.nav.profile" },
]

// Pages where the bottom nav should be hidden (full-screen flows)
const HIDDEN_ON = ["/sales-rep/invoice"]

export function BottomNav() {
  const pathname = usePathname()
  const { t } = useI18n()
  const hidden = useHiddenRepFeatures()

  if (!pathname || HIDDEN_ON.some((p) => pathname.startsWith(p))) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 pb-[env(safe-area-inset-bottom)]">
      {/* Scrollable row — supports 8+ items without squishing */}
      <div
        className="flex items-center h-16 overflow-x-auto px-2 gap-0.5"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {NAV_ITEMS.filter((item) => !(item as { feature?: string }).feature || !hidden.has((item as { feature?: string }).feature!)).map((item) => {
          const Icon = item.icon
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/")

          if (item.accent) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center flex-shrink-0 min-w-[60px] -mt-4"
              >
                <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-[10px] font-bold text-blue-600 mt-0.5">
                  {t(item.labelKey)}
                </span>
              </Link>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-shrink-0 min-w-[56px] py-1 transition-colors",
                isActive ? "text-blue-600" : "text-slate-400"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive && "stroke-[2.5]")} />
              <span
                className={cn(
                  "text-[10px]",
                  isActive ? "font-bold" : "font-medium"
                )}
              >
                {t(item.labelKey)}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
