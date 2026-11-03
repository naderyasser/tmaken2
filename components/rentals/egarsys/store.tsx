'use client'

// Lightweight replacement for egarsys's zustand `aqari-store`, scoped to the
// ported rentals shell. Section-based navigation (like egarsys's page.tsx),
// plus the active company name (resolved from the tenant's own Frappe site) and
// a LOCAL dark-mode toggle (never touches <html> — see egarsys-theme.css).

import * as React from 'react'
import { frappeClient } from '@/lib/api-client'

export type PendingFocus = { section: string; contentType: string; key: string } | null

type Theme = 'light' | 'dark'
export type CalendarType = 'hijri' | 'gregorian'

interface ShellState {
  currentSection: string
  setCurrentSection: (s: string) => void
  pendingFocus: PendingFocus
  setPendingFocus: (f: PendingFocus) => void
  companyName: string | null
  companyLogo: string | null
  theme: Theme
  toggleTheme: () => void
  // Active calendar for the date pickers (هجري/ميلادي). Mirrors egarsys's
  // aqari-store calendarType — default 'hijri', persisted locally.
  calendarType: CalendarType
  setCalendarType: (t: CalendarType) => void
  mounted: boolean
}

const ShellContext = React.createContext<ShellState | null>(null)

const THEME_KEY = 'rentals-native-theme'
const CALENDAR_KEY = 'rentals-native-calendar'

export function RentalsShellProvider({
  children,
  initialSection,
  initialFocus,
}: {
  children: React.ReactNode
  // Deep-link seed (from the URL, resolved in app-shell): first-mount section +
  // the record to focus. Applied ONCE as the initial state, so a shared
  // `/rentals-native?section=…&type=…&key=…` opens straight to its target.
  initialSection?: string
  initialFocus?: PendingFocus
}) {
  const [currentSection, setCurrentSection] = React.useState(initialSection || 'dashboard')
  const [pendingFocus, setPendingFocus] = React.useState<PendingFocus>(initialFocus ?? null)
  const [companyName, setCompanyName] = React.useState<string | null>(null)
  const [companyLogo] = React.useState<string | null>(null)
  const [theme, setTheme] = React.useState<Theme>('light')
  const [calendarType, setCalendarTypeState] = React.useState<CalendarType>('hijri')
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
    try {
      const stored = localStorage.getItem(THEME_KEY) as Theme | null
      if (stored === 'dark' || stored === 'light') setTheme(stored)
      const cal = localStorage.getItem(CALENDAR_KEY) as CalendarType | null
      if (cal === 'hijri' || cal === 'gregorian') setCalendarTypeState(cal)
    } catch {
      /* noop */
    }
  }, [])

  // Resolve the tenant's company name from its own site (host-scoped). Best
  // effort — the header falls back to a neutral label if it can't be read.
  React.useEffect(() => {
    let cancelled = false
    frappeClient
      .getList<{ name: string; company_name?: string }>('Company', {
        fields: ['name', 'company_name'],
        limit_page_length: 1,
      })
      .then((rows) => {
        if (cancelled) return
        const c = rows?.[0]
        if (c) setCompanyName(c.company_name || c.name)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const toggleTheme = React.useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(THEME_KEY, next)
      } catch {
        /* noop */
      }
      return next
    })
  }, [])

  const setCalendarType = React.useCallback((t: CalendarType) => {
    setCalendarTypeState(t)
    try {
      localStorage.setItem(CALENDAR_KEY, t)
    } catch {
      /* noop */
    }
  }, [])

  const value = React.useMemo<ShellState>(
    () => ({
      currentSection,
      setCurrentSection,
      pendingFocus,
      setPendingFocus,
      companyName,
      companyLogo,
      theme,
      toggleTheme,
      calendarType,
      setCalendarType,
      mounted,
    }),
    [currentSection, pendingFocus, companyName, companyLogo, theme, toggleTheme, calendarType, setCalendarType, mounted],
  )

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>
}

export function useRentalsShell(): ShellState {
  const ctx = React.useContext(ShellContext)
  if (!ctx) throw new Error('useRentalsShell must be used within RentalsShellProvider')
  return ctx
}
