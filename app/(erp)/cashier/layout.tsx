"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { CashierProvider } from "@/contexts/CashierContext"
import "./cashier-theme.css"
import { Loader2, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TerminalRecovery } from "@/components/cashier/terminal-recovery"

function CashierPWAMeta() {
  useEffect(() => {
    const addMeta = (name: string, content: string) => {
      if (!document.querySelector(`meta[name="${name}"]`)) {
        const meta = document.createElement("meta")
        meta.name = name
        meta.content = content
        document.head.appendChild(meta)
      }
    }
    const addLink = (rel: string, href: string, attrs?: Record<string, string>) => {
      const selector = attrs
        ? `link[rel="${rel}"][${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join("][")}]`
        : `link[rel="${rel}"][href="${href}"]`
      if (!document.querySelector(selector)) {
        const link = document.createElement("link")
        link.rel = rel
        link.href = href
        if (attrs) Object.entries(attrs).forEach(([k, v]) => link.setAttribute(k, v))
        document.head.appendChild(link)
      }
    }

    // Offline boot: the cashier SW caches the app shell + immutable chunks so a
    // browser relaunch with no network still loads the till (state lives in IndexedDB).
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/cashier-sw.js", { scope: "/cashier" }).catch(() => { /* */ })
    }

    addLink("manifest", "/cashier-manifest.json")
    addMeta("theme-color", "#059669")
    addMeta("apple-mobile-web-app-capable", "yes")
    addMeta("apple-mobile-web-app-status-bar-style", "black-translucent")
    addMeta("apple-mobile-web-app-title", "مبيعات تمكين")
    addLink("apple-touch-icon", "/icons/cashier-192.svg")
    addMeta("mobile-web-app-capable", "yes")
    addMeta("application-name", "مبيعات تمكين")
  }, [])
  return null
}

/** (12) Dark / high-contrast theme scope. Per-user preference (cashier_theme:<email>)
 *  applied as .cashier-dark on this wrapper — see cashier-theme.css. The header toggle
 *  dispatches `cashier:theme` so the class flips without prop-drilling. */
function CashierThemeScope({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const key = `cashier_theme:${user?.email || "anon"}`
    try { setDark(localStorage.getItem(key) === "dark") } catch { /* */ }
    const onToggle = () => {
      setDark(prev => {
        const next = !prev
        try { localStorage.setItem(key, next ? "dark" : "light") } catch { /* */ }
        return next
      })
    }
    window.addEventListener("cashier:theme", onToggle)
    return () => window.removeEventListener("cashier:theme", onToggle)
  }, [user?.email])
  return <div className={dark ? "cashier-dark" : undefined}>{children}</div>
}

export default function CashierLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, isCashier, isAdmin, moduleAccess } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-3" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <ShieldAlert className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Login Required</h2>
          <p className="text-muted-foreground mb-6">Please log in to access Sales.</p>
          <Link href="/login">
            <Button size="lg" className="w-full">Login</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!isAdmin && !isCashier && !moduleAccess?.cashier) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <ShieldAlert className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-6">
            You don&apos;t have permission to access the Sales module.
          </p>
          <Link href="/">
            <Button variant="outline" size="lg" className="w-full bg-transparent">
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <CashierProvider>
      <CashierPWAMeta />
      <CashierThemeScope>
        <div className="min-h-screen bg-gray-50">
          {/* Card charges with no invoice behind them — visible on every till screen
              until a person accounts for each one. Renders nothing when there are none. */}
          <TerminalRecovery />
          {children}
        </div>
      </CashierThemeScope>
    </CashierProvider>
  )
}
