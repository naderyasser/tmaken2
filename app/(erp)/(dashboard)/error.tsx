'use client'

/**
 * Dashboard route-group error boundary (P8).
 *
 * Covers every (dashboard) route — HR (/hr, /shift-management, /employees, …) plus the
 * other verticals. Without it, any thrown client error rendered Next.js's raw black
 * "This page couldn't load" default (there was no boundary in this segment).
 *
 * Two behaviours:
 *  1. ChunkLoadError (a stale JS/CSS chunk after a rebuild — the #1 cause of the black
 *     page on lazy routes) → auto-recover with ONE full reload to fetch fresh assets,
 *     guarded by a short-lived sessionStorage timestamp so it can never loop. If it
 *     still fails after the reload, the friendly UI is shown instead.
 *  2. Any other error → a calm, retryable Arabic error page. Colours use theme tokens,
 *     so it renders in the cream `.theme-hr` identity on HR routes and each vertical's
 *     own palette elsewhere.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

// Matches the various engine spellings of a failed dynamic import / stale chunk.
const CHUNK_RX = /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|Loading CSS chunk/i
const RELOAD_KEY = 'hr-chunk-reload-ts'
const RELOAD_WINDOW_MS = 12000

function isChunkError(error?: { name?: string; message?: string }): boolean {
  if (!error) return false
  if (error.name === 'ChunkLoadError') return true
  return CHUNK_RX.test(`${error.name || ''} ${error.message || ''}`)
}

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()
  const [reloading, setReloading] = useState(false)

  useEffect(() => {
    // Surface for debugging; never shown to the user.
    console.error('Dashboard render error:', error)

    if (!isChunkError(error)) return

    // Stale chunk after a rebuild: reload ONCE to pull fresh assets. The timestamp guard
    // means a chunk error that survives the reload (genuine failure, not staleness) falls
    // through to the error UI instead of reloading forever.
    let last = 0
    try { last = Number(sessionStorage.getItem(RELOAD_KEY) || '0') } catch { /* storage blocked */ }
    const now = Date.now()
    if (!last || now - last > RELOAD_WINDOW_MS) {
      try { sessionStorage.setItem(RELOAD_KEY, String(now)) } catch { /* storage blocked */ }
      setReloading(true)
      window.location.reload()
    }
    // else: reloaded within the window and still failing → show the UI below (no loop).
  }, [error])

  if (reloading) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-9 h-9 border-[3px] border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">جارٍ تحديث الصفحة…</p>
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center bg-card border border-border rounded-2xl shadow-sm p-8">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
          <AlertTriangle className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">تعذّر تحميل الصفحة</h1>
        <p className="text-muted-foreground leading-7 mb-6">
          حدث خطأ غير متوقع أثناء عرض هذه الصفحة. يمكنك إعادة المحاولة، وإذا استمرت المشكلة
          فاحفظ رقم المرجع أدناه وتواصل مع الدعم.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="h-4 w-4" />
            إعادة المحاولة
          </button>
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-medium hover:bg-muted transition-colors"
          >
            <Home className="h-4 w-4" />
            العودة للرئيسية
          </button>
        </div>
        {error?.digest && (
          <p className="mt-5 text-[11px] text-muted-foreground/70">رقم المرجع: {error.digest}</p>
        )}
      </div>
    </div>
  )
}
