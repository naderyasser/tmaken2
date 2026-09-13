"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { SalesRepProvider, useSalesRep } from "@/contexts/SalesRepContext"
import { PWAInstallPrompt } from "@/components/pwa-install-prompt"
import { BottomNav } from "@/components/sales-rep/bottom-nav"
import { useGPSBroadcaster } from "@/hooks/use-gps-broadcaster"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Loader2, ShieldAlert } from "lucide-react"
import { CustodyAlertBanner } from "@/components/custody/custody-alert-banner"
import { useI18n } from "@/lib/i18n"

function usePWAServiceWorker() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sales-rep-sw.js", { scope: "/sales-rep" })
        .then((reg) => {
          console.log("[PWA] Service Worker registered, scope:", reg.scope)
        })
        .catch((err) => {
          console.warn("[PWA] Service Worker registration failed:", err)
        })
    }
  }, [])
}

function PWAMetaTags() {
  useEffect(() => {
    const addedElements: HTMLElement[] = []

    const upsertMeta = (name: string, content: string) => {
      let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null
      if (!meta) {
        meta = document.createElement("meta")
        meta.name = name
        document.head.appendChild(meta)
        addedElements.push(meta)
      }
      meta.content = content
    }

    const upsertLink = (rel: string, href: string, attrs?: Record<string, string>) => {
      let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null
      if (!link) {
        link = document.createElement("link")
        link.rel = rel
        document.head.appendChild(link)
        addedElements.push(link)
      }
      link.href = href
      if (attrs) Object.entries(attrs).forEach(([k, v]) => link!.setAttribute(k, v))
    }

    // Legacy defaults — every tenant gets these unless per-tenant branding
    // overrides them below (sales-flavor tenants only).
    upsertLink("manifest", "/sales-rep-manifest")
    upsertMeta("theme-color", "#2563EB")
    upsertMeta("apple-mobile-web-app-capable", "yes")
    upsertMeta("apple-mobile-web-app-status-bar-style", "black-translucent")
    upsertMeta("apple-mobile-web-app-title", "مندوب تمكين")
    upsertLink("apple-touch-icon", "/icons/sales-rep-192.svg")
    upsertMeta("msapplication-TileColor", "#2563EB")
    upsertMeta("msapplication-starturl", "/sales-rep")
    upsertMeta("mobile-web-app-capable", "yes")
    upsertMeta("application-name", "مندوب تمكين")

    // Tenant brand override (clients.json via /api/branding). Applied only for
    // tenant_type="sales" sites, so other tenants' PWA identity is untouched.
    let cancelled = false
    fetch("/sales-brand")
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => {
        if (cancelled || !b || b.tenantType !== "sales") return
        if (b.appName) {
          upsertMeta("apple-mobile-web-app-title", b.appName)
          upsertMeta("application-name", b.appName)
          document.title = b.appName
        }
        if (b.primaryColor) {
          upsertMeta("theme-color", b.primaryColor)
          upsertMeta("msapplication-TileColor", b.primaryColor)
        }
        if (b.icon192) {
          upsertLink("apple-touch-icon", b.icon192)
          upsertLink("icon", b.icon192, { type: "image/png" })
        } else if (b.logo) {
          upsertLink("icon", b.logo)
        }
      })
      .catch(() => { /* keep legacy brand */ })

    return () => {
      cancelled = true
      for (const el of addedElements) {
        el.remove()
      }
    }
  }, [])

  return null
}

/**
 * Per-tenant sales theme. Reads the named theme (clients.json `branding.theme`) via
 * /sales-brand for sales-flavor tenants and returns the scoped class (e.g. "theme-lazaa",
 * defined in app/globals.css). A localStorage snapshot is applied synchronously so repeat
 * visits paint the warm palette on first frame (no blue→cream flash). Non-themed tenants
 * (Mandoob included) get "" → the containers below render byte-identically to before.
 */
function useSalesTheme(): string {
  const [themeClass, setThemeClass] = useState('')
  useEffect(() => {
    try {
      const snap = localStorage.getItem('sales_theme') || ''
      if (snap) setThemeClass(`theme-${snap}`)
    } catch { /* */ }
    let cancelled = false
    fetch('/sales-brand')
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => {
        if (cancelled || !b) return
        const theme = b.tenantType === 'sales' && b.theme ? String(b.theme) : ''
        setThemeClass(theme ? `theme-${theme}` : '')
        try { localStorage.setItem('sales_theme', theme) } catch { /* */ }
      })
      .catch(() => { /* keep snapshot */ })
    return () => { cancelled = true }
  }, [])
  return themeClass
}

export default function SalesRepLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading, isSalesUser, isAdmin, moduleAccess } = useAuth()
  const { t, lang, dir } = useI18n()
  const themeClass = useSalesTheme()

  // Register service worker
  usePWAServiceWorker()

  if (authLoading) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center", themeClass && "bg-background", themeClass)} dir={dir} lang={lang}>
        <PWAMetaTags />
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-3" />
          <p className="text-muted-foreground">{t('sr.common.loading')}</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center p-6", themeClass && "bg-background", themeClass)} dir={dir} lang={lang}>
        <PWAMetaTags />
        <div className="text-center max-w-sm">
          <ShieldAlert className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">{t('sr.auth.login_required_title')}</h2>
          <p className="text-muted-foreground mb-6">{t('sr.auth.login_required_desc')}</p>
          <Link href="/login">
            <Button size="lg" className="w-full">{t('sr.auth.login')}</Button>
          </Link>
        </div>
      </div>
    )
  }

  // Allow admin, sales users, and any user with salesReps module access
  if (!isSalesUser && !isAdmin && !moduleAccess?.salesReps) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center p-6", themeClass && "bg-background", themeClass)} dir={dir} lang={lang}>
        <PWAMetaTags />
        <div className="text-center max-w-sm">
          <ShieldAlert className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">{t('sr.auth.unauthorized_title')}</h2>
          <p className="text-muted-foreground mb-6">{t('sr.auth.unauthorized_desc')}</p>
          <Link href="/">
            <Button variant="outline" size="lg" className="w-full bg-transparent">{t('sr.auth.back_home')}</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <SalesRepProvider>
      <PWAMetaTags />
      <GPSBroadcasterWrapper />
      <div className={cn("min-h-screen bg-background pb-20", themeClass)} dir="rtl" lang="ar">
        <CustodyAlertBanner />
        {children}
        <BottomNav />
        <PWAInstallPrompt />
      </div>
    </SalesRepProvider>
  )
}

/** Thin wrapper that lives inside SalesRepProvider so it can access the context */
function GPSBroadcasterWrapper() {
  return <GPSInner />
}

function GPSInner() {
  const { salesPerson } = useSalesRep()
  useGPSBroadcaster({ salesPerson: salesPerson?.name ?? null })
  return null
}
