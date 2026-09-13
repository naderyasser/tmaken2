'use client'

/**
 * usePersistedState — useState that mirrors to localStorage under `key`.
 * Used to remember per-section table prefs (search, sort, page size) and
 * filter selections across reloads. When `key` is falsy it behaves like a
 * plain useState (opt-out). SSR-safe: hydrates from storage in an effect, so
 * the server render and first client render both use `initial`.
 */

import * as React from 'react'

const canStore = () => typeof window !== 'undefined' && !!window.localStorage

export function usePersistedState<T>(
  key: string | false | null | undefined,
  initial: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = React.useState<T>(initial)

  // Hydrate once from storage (client only). Does NOT persist (raw setState).
  React.useEffect(() => {
    if (!key || !canStore()) return
    try {
      const raw = window.localStorage.getItem(key)
      if (raw != null) setState(JSON.parse(raw) as T)
    } catch {
      /* corrupt/unavailable storage — ignore */
    }
  }, [key])

  // Setter that persists every user-initiated change.
  const set = React.useCallback<React.Dispatch<React.SetStateAction<T>>>(
    (value) => {
      setState((prev) => {
        const next = typeof value === 'function' ? (value as (p: T) => T)(prev) : value
        if (key && canStore()) {
          try {
            window.localStorage.setItem(key, JSON.stringify(next))
          } catch {
            /* quota/unavailable — ignore */
          }
        }
        return next
      })
    },
    [key],
  )

  return [state, set]
}
