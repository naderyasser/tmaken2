'use client'

import { useCallback, useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// The event fires once, possibly before the screen that offers the button mounts.
let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    listeners.forEach((l) => l())
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    listeners.forEach((l) => l())
  })
}

/** Install state for the «/m» PWA: Android/desktop prompt, iOS manual hint. */
export function useInstall() {
  const [, force] = useState(0)
  const [standalone, setStandalone] = useState(false)
  const [ios, setIos] = useState(false)

  useEffect(() => {
    const rerender = () => force((n) => n + 1)
    listeners.add(rerender)
    setStandalone(
      window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true,
    )
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent))
    return () => {
      listeners.delete(rerender)
    }
  }, [])

  const install = useCallback(async () => {
    if (!deferred) return false
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    deferred = null
    force((n) => n + 1)
    return outcome === 'accepted'
  }, [])

  return { standalone, canPrompt: !!deferred, ios, install }
}
