"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { X, Download, Share, Smartphone } from "lucide-react"
import { useI18n } from "@/lib/i18n"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function PWAInstallPrompt() {
  const { t } = useI18n()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIOSPrompt, setShowIOSPrompt] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Check if already installed (standalone mode)
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true
    setIsStandalone(standalone)

    if (standalone) return

    // Check if user previously dismissed (respect for 7 days)
    const dismissedAt = localStorage.getItem("pwa-install-dismissed")
    if (dismissedAt) {
      const daysSince = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24)
      if (daysSince < 7) {
        setDismissed(true)
        return
      }
    }

    // Android/Windows/Desktop Chrome — listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", handler)

    // iOS detection (Safari on iPhone/iPad)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    if (isIOS && isSafari) {
      setShowIOSPrompt(true)
    }

    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") {
      setDeferredPrompt(null)
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem("pwa-install-dismissed", Date.now().toString())
    setDeferredPrompt(null)
    setShowIOSPrompt(false)
  }

  // Don't show if already installed, dismissed, or no prompt available
  if (isStandalone || dismissed || (!deferredPrompt && !showIOSPrompt)) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up-in">
      <div className="mx-3 mb-3 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header strip */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Smartphone className="w-4 h-4" />
            <span className="text-sm font-bold">{t('sr.pwa.install_title')}</span>
          </div>
          <button
            onClick={handleDismiss}
            className="text-white/70 hover:text-white p-1 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          {/* Android/Windows/Desktop prompt */}
          {deferredPrompt && (
            <>
              <p className="text-sm text-slate-600 mb-3">
                {t('sr.pwa.install_desc').split('{appName}')[0]}
                <span className="font-bold text-slate-800">{t('sr.app.name')}</span>
                {t('sr.pwa.install_desc').split('{appName}')[1]}
              </p>
              <Button
                onClick={handleInstall}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-12 font-bold text-base"
              >
                <Download className="w-5 h-5 ml-2" />
                {t('sr.pwa.install_title')}
              </Button>
            </>
          )}

          {/* iOS Safari prompt */}
          {showIOSPrompt && !deferredPrompt && (
            <>
              <p className="text-sm text-slate-600 mb-3">
                {t('sr.pwa.ios_title').split('{appName}')[0]}
                <span className="font-bold text-slate-800">{t('sr.app.name')}</span>
                {t('sr.pwa.ios_title').split('{appName}')[1]}
              </p>
              <div className="space-y-2 text-sm text-slate-700">
                <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
                  <div className="bg-blue-100 rounded-lg p-2 flex-shrink-0">
                    <Share className="w-5 h-5 text-blue-600" />
                  </div>
                  <span>
                    {t('sr.pwa.ios_step1').split('{icon}')[0]}
                    <Share className="w-3.5 h-3.5 inline text-blue-600" />
                    {t('sr.pwa.ios_step1').split('{icon}')[1]}
                  </span>
                </div>
                <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
                  <div className="bg-blue-100 rounded-lg p-2 flex-shrink-0">
                    <Download className="w-5 h-5 text-blue-600" />
                  </div>
                  <span>{t('sr.pwa.ios_step2')}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
