'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Search, Loader2, UserCircle } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useAuthSafe } from '@/lib/auth-context'
import { frappeClient, type Employee } from '@/lib/api-client'
import { frappeImageUrl } from '@/lib/utils'
import { rankEmployees } from '@/lib/employee-search'
import { RAIL_SECTIONS } from './routes'

/**
 * ⌘K global search for the HR shell — token-styled rebuild of the legacy
 * Header search. Module list is sourced from RAIL_SECTIONS (one source with the
 * rail, so it never drifts), plus the HR-only debounced employee server search
 * ranked exact > starts-with > contains.
 */
export function GlobalSearch() {
  const { t, isRTL } = useI18n()
  const { isHRUser } = useAuthSafe()
  const [query, setQuery] = useState('')
  const [moduleResults, setModuleResults] = useState<{ title: string; href: string }[]>([])
  const [employeeResults, setEmployeeResults] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Module/page matches — instant local filter over the rail items.
  useEffect(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 1) { setModuleResults([]); setOpen(false); return }
    const seen = new Set<string>()
    const hits = RAIL_SECTIONS
      .flatMap((s) => s.items.map((i) => ({ title: t(i.labelKey), href: i.href })))
      .filter((m) => {
        if (seen.has(m.href) || !m.title.toLowerCase().includes(q)) return false
        seen.add(m.href)
        return true
      })
      .slice(0, 5)
    setModuleResults(hits)
    setOpen(true)
  }, [query, t])

  // Employee matches — HR-only, debounced ~300ms, ranked, top 8.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 1 || !isHRUser) { setEmployeeResults([]); setLoading(false); return }
    setLoading(true)
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const rows = await frappeClient.searchEmployees(q)
        if (!cancelled) setEmployeeResults(rankEmployees(rows, q).slice(0, 8))
      } catch {
        if (!cancelled) setEmployeeResults([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query, isHRUser])

  // Close on outside click
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // ⌘K / Ctrl+K focuses the input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const close = () => { setOpen(false); setQuery('') }

  return (
    <div className="w-full max-w-xl" ref={wrapRef}>
      <div className="relative flex items-center">
        <Search className="absolute start-3 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder={t('header.search')}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length >= 1 && setOpen(true)}
          dir={isRTL ? 'rtl' : 'ltr'}
          className="w-full h-9 ps-9 pe-10 rounded-lg bg-muted text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-ring text-sm transition-colors"
        />
        <kbd className="absolute end-3 hidden md:inline-flex h-5 items-center rounded border border-border bg-card px-1.5 text-[10px] font-medium text-muted-foreground">⌘K</kbd>

        {open && (loading || employeeResults.length > 0 || moduleResults.length > 0) && (
          <div className="absolute top-full mt-2 start-0 w-full bg-popover text-popover-foreground rounded-lg shadow-card-hover border border-border py-2 z-[100] max-h-96 overflow-y-auto">
            {(loading || employeeResults.length > 0) && (
              <>
                <div className="px-4 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('header.employees')}</div>
                {loading && employeeResults.length === 0 && (
                  <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />{t('header.searching')}
                  </div>
                )}
                {employeeResults.map((emp) => (
                  <Link key={emp.name} href={`/employee/${encodeURIComponent(emp.name)}`} onClick={close} className="block px-4 py-2 hover:bg-accent transition-colors">
                    <div className="flex items-center gap-3">
                      {emp.image ? (
                        <Image src={frappeImageUrl(emp.image)} alt="" width={32} height={32} className="h-8 w-8 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0"><UserCircle className="h-5 w-5 text-primary" /></div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{emp.employee_name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {emp.name}{emp.designation ? ` · ${emp.designation}` : ''}{emp.cell_number ? ` · ${emp.cell_number}` : ''}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
                {moduleResults.length > 0 && <div className="my-1 border-t border-border" />}
              </>
            )}
            {moduleResults.length > 0 && (
              <>
                <div className="px-4 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('header.modules')}</div>
                {moduleResults.map((m, i) => (
                  <Link key={i} href={m.href} onClick={close} className="block px-4 py-2.5 hover:bg-accent transition-colors">
                    <div className="flex items-center gap-3"><Search className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium text-foreground">{m.title}</span></div>
                  </Link>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
