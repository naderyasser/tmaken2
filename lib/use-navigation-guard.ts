'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface UseNavigationGuardOptions {
  /**
   * When true, the guard is active: browser back-button presses and in-app
   * navigation calls will be intercepted and a confirmation dialog opened.
   */
  isDirty: boolean
  /**
   * Called when the user confirms leaving via the browser back-button.
   * Typically the same action as the page's own "Cancel / Back" button.
   * Falls back to `window.history.back()` if not provided.
   */
  onBack?: () => void
}

/**
 * Guards an unsaved form against accidental navigation.
 *
 * Returns:
 *  - `guardOpen`         – whether the confirmation dialog should be open
 *  - `confirmNavigation` – call this when the user confirms "leave"
 *  - `cancelNavigation`  – call this when the user cancels (stays on page)
 *  - `guardedNavigate`   – wrap any in-app navigation action with this to
 *                          show the guard dialog when the form is dirty
 */
export function useNavigationGuard({ isDirty, onBack }: UseNavigationGuardOptions) {
  const [guardOpen, setGuardOpen] = useState(false)
  const pendingNavRef = useRef<(() => void) | null>(null)

  // ── Tab close / refresh ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // ── Browser back-button interception ──────────────────────────────────────
  useEffect(() => {
    if (!isDirty) return

    // Push a phantom entry so the back-press pops that instead of navigating away.
    window.history.pushState({ __navGuard: true }, '')

    const handler = () => {
      // Re-push the phantom so the URL stays the same while the dialog is open.
      window.history.pushState({ __navGuard: true }, '')
      pendingNavRef.current = onBack ?? (() => window.history.go(-2))
      setGuardOpen(true)
    }

    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [isDirty, onBack])

  // ── Confirm / cancel ───────────────────────────────────────────────────────
  const confirmNavigation = useCallback(() => {
    setGuardOpen(false)
    const nav = pendingNavRef.current
    pendingNavRef.current = null
    nav?.()
  }, [])

  const cancelNavigation = useCallback(() => {
    setGuardOpen(false)
    pendingNavRef.current = null
  }, [])

  /**
   * Wrap an in-app navigation action.
   * If the form is dirty, shows the guard dialog; otherwise navigates immediately.
   */
  const guardedNavigate = useCallback(
    (navigate: () => void) => {
      if (isDirty) {
        pendingNavRef.current = navigate
        setGuardOpen(true)
      } else {
        navigate()
      }
    },
    [isDirty],
  )

  return { guardOpen, confirmNavigation, cancelNavigation, guardedNavigate }
}
