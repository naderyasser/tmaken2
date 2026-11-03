'use client'

/**
 * Tamkeen Go — G2 "Web Push + install app" opt-in card for /me.
 *
 * Self-contained: on mount it registers the SCOPED service worker
 * (/tamkeen-sw.js @ scope /me) and links the dynamic per-tenant manifest, so
 * dropping <PushOptin/> into the /me dashboard is all the integration needed.
 *
 * The card lets the employee:
 *   - Enable notifications: request Notification permission -> pushManager
 *     .subscribe({userVisibleOnly, applicationServerKey}) with the backend's
 *     VAPID key -> POST the subscription to save_subscription.
 *   - Install the app: uses the captured `beforeinstallprompt` event (Android/
 *     desktop Chrome); on iOS it shows the add-to-home-screen hint instead.
 *
 * Gracefully self-hides when Web Push is unsupported, and shows an iOS-specific
 * "install first" hint (iOS only delivers push to an installed PWA). Bilingual
 * (ar/en via useI18n), RTL-aware, token-colored, shared/ui components only.
 */

import * as React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, BellRing, BellOff, Download, Loader2, CheckCircle2, XCircle, Share } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { frappeClient } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'

const MOD = 'base_meena.mobile_attendance.webpush'
const SW_URL = '/tamkeen-sw.js'
const SW_SCOPE = '/me'
const MANIFEST_URL = '/tamkeen-go-manifest'
const THEME_COLOR = '#0E6E62'

const call = async (method: string, args?: any) => {
  const r = await frappeClient.call(method, args)
  return (r as any)?.message
}

/** Base64url VAPID public key -> Uint8Array for applicationServerKey. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    // iPadOS reports as Mac; disambiguate by touch.
    (/Macintosh/i.test(navigator.userAgent) && 'ontouchend' in document)
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
}

export function PushOptin() {
  const { isRTL } = useI18n()
  const tt = (en: string, ar: string) => (isRTL ? ar : en)

  const [supported, setSupported] = useState<boolean | null>(null)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [installEvt, setInstallEvt] = useState<any>(null)
  const [showIosHint, setShowIosHint] = useState(false)

  const regRef = useRef<ServiceWorkerRegistration | null>(null)
  const iosNeedsInstall = isIOS() && !isStandalone()

  // Inject the per-tenant manifest link + theme meta (once).
  useEffect(() => {
    if (typeof document === 'undefined') return
    const ensureLink = (rel: string, href: string) => {
      if (!document.querySelector(`link[rel="${rel}"][href="${href}"]`)) {
        const l = document.createElement('link')
        l.rel = rel
        l.href = href
        document.head.appendChild(l)
      }
    }
    const ensureMeta = (name: string, content: string) => {
      let m = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null
      if (!m) {
        m = document.createElement('meta')
        m.name = name
        document.head.appendChild(m)
      }
      m.content = content
    }
    ensureLink('manifest', MANIFEST_URL)
    ensureMeta('theme-color', THEME_COLOR)
    ensureMeta('apple-mobile-web-app-capable', 'yes')
    ensureMeta('apple-mobile-web-app-title', 'تمكين')
    ensureLink('apple-touch-icon', '/icons/tamkeen-go-192.svg')
  }, [])

  // Probe support, register the scoped SW, reflect existing subscription state.
  useEffect(() => {
    let cancelled = false
    const supportedNow =
      typeof navigator !== 'undefined' && 'serviceWorker' in navigator &&
      typeof window !== 'undefined' && 'PushManager' in window && 'Notification' in window

    if (!supportedNow) {
      setSupported(false)
      return
    }
    setSupported(true)
    setPermission(Notification.permission)
    ;(async () => {
      try {
        const reg = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE })
        if (cancelled) return
        regRef.current = reg
        const existing = await reg.pushManager.getSubscription()
        if (!cancelled && existing) setSubscribed(true)
      } catch {
        /* registration failure -> card still shows, enable will surface the error */
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Capture the install prompt (Android / desktop Chrome).
  useEffect(() => {
    const onBIP = (e: Event) => {
      e.preventDefault()
      setInstallEvt(e)
    }
    const onInstalled = () => setInstallEvt(null)
    window.addEventListener('beforeinstallprompt', onBIP)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const enable = useCallback(async () => {
    setError('')
    if (iosNeedsInstall) {
      setShowIosHint(true)
      return
    }
    setBusy(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') {
        setError(tt(
          'Notifications are blocked. Enable them in your browser settings to receive alerts.',
          'الإشعارات محظورة. فعّلها من إعدادات المتصفح لتصلك التنبيهات.',
        ))
        return
      }

      const reg = regRef.current || (await navigator.serviceWorker.ready)
      const res = await call(`${MOD}.get_vapid_public_key`)
      const publicKey: string = res?.public_key
      if (!publicKey) throw new Error(tt('Server did not return a push key.', 'لم يُرجع الخادم مفتاح الدفع.'))

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
      await call(`${MOD}.save_subscription`, { subscription: sub.toJSON() })
      setSubscribed(true)
    } catch (e: any) {
      setError(String(e?.message || e) || tt('Could not enable notifications.', 'تعذّر تفعيل الإشعارات.'))
    } finally {
      setBusy(false)
    }
  }, [iosNeedsInstall, isRTL]) // eslint-disable-line react-hooks/exhaustive-deps

  const disable = useCallback(async () => {
    setError('')
    setBusy(true)
    try {
      const reg = regRef.current || (await navigator.serviceWorker.ready)
      const existing = await reg.pushManager.getSubscription()
      if (existing) {
        const endpoint = existing.endpoint
        await existing.unsubscribe().catch(() => {})
        await call(`${MOD}.delete_subscription`, { endpoint }).catch(() => {})
      }
      setSubscribed(false)
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }, [])

  const doInstall = useCallback(async () => {
    if (!installEvt) return
    try {
      installEvt.prompt()
      const choice = await installEvt.userChoice
      if (choice?.outcome === 'accepted') setInstallEvt(null)
    } catch { /* prompt already consumed */ }
  }, [installEvt])

  // Self-hide when Web Push is entirely unsupported.
  if (supported === false) return null
  if (supported === null) return null // still probing; avoid a flash

  return (
    <Card dir={isRTL ? 'rtl' : 'ltr'}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BellRing className="h-4 w-4 text-primary" />
          {tt('Notifications & app', 'الإشعارات والتطبيق')}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <p className="text-sm text-muted-foreground">
          {tt(
            'Get instant alerts for approvals, requests and attendance — even when the tab is closed.',
            'استقبل تنبيهات فورية للاعتمادات والطلبات والحضور — حتى عند إغلاق التبويب.',
          )}
        </p>

        {/* Enable / status */}
        {subscribed ? (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-success/10 text-success p-3 text-sm">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {tt('Notifications are on for this device.', 'الإشعارات مفعّلة على هذا الجهاز.')}
            </span>
            <button onClick={disable} disabled={busy} className="shrink-0 underline text-xs">
              {tt('Turn off', 'إيقاف')}
            </button>
          </div>
        ) : permission === 'denied' ? (
          <div className="flex items-start gap-2 rounded-lg bg-warning/15 text-warning p-3 text-sm">
            <BellOff className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{tt(
              'Notifications are blocked in your browser. Allow them in site settings, then reload.',
              'الإشعارات محظورة في متصفحك. اسمح بها من إعدادات الموقع ثم أعد التحميل.',
            )}</span>
          </div>
        ) : (
          <Button onClick={enable} disabled={busy}
            className="w-full h-11 gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
            {tt('Enable notifications', 'تفعيل الإشعارات')}
          </Button>
        )}

        {/* iOS: must install as a PWA before push works */}
        {iosNeedsInstall && (showIosHint || !subscribed) && (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-accent/40 p-3 text-xs text-muted-foreground">
            <Share className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <span>{tt(
              'On iPhone/iPad: tap the Share button, then "Add to Home Screen", and open the app from there to receive notifications.',
              'على الآيفون/الآيباد: اضغط زر المشاركة ثم "إضافة إلى الشاشة الرئيسية"، وافتح التطبيق من هناك لاستقبال الإشعارات.',
            )}</span>
          </div>
        )}

        {/* Install affordance (Android / desktop Chrome) */}
        {installEvt && (
          <Button onClick={doInstall} variant="outline" className="w-full h-11 gap-2">
            <Download className="h-4 w-4" />
            {tt('Install app', 'تثبيت التطبيق')}
          </Button>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/10 text-destructive p-3 text-sm">
            <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
