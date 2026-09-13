'use client'

import { useCallback, useEffect, useState } from 'react'

// localStorage-backed saved searches (no accounts). Each stores the URL-synced filter+sort query so
// re-opening applies the EXACT same /search state. `alert` records the user's "notify me" intent only —
// actual alert delivery (email/push) needs a backend endpoint that is NOT built here.
export interface SavedSearch {
  id: string
  query: Record<string, string>
  label: string
  alert: boolean
  created: number
}

const KEY = 'aqar_saved_searches'
const EVT = 'aqar:saved-searches'

const TYPE_AR: Record<string, string> = { Sale: 'للبيع', Rent: 'للإيجار', 'Daily Rent': 'إيجار يومي' }

export function queryToQS(q: Record<string, string>): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(q)) {
    if (v == null || v === '') continue
    if (k === 'sort' && v === 'newest') continue
    p.set(k, String(v))
  }
  return p.toString()
}

/** Plain-Arabic summary of a saved search (city is an internal id, so it's labelled generically). */
export function describeSearch(q: Record<string, string>): string {
  const parts: string[] = []
  if (q.keyword) parts.push(`«${q.keyword}»`)
  if (q.listing_type) parts.push(TYPE_AR[q.listing_type] || q.listing_type)
  if (q.city) parts.push('مدينة محددة')
  if (q.bedrooms_min) parts.push(`${q.bedrooms_min}+ غرف`)
  if (q.bathrooms_min) parts.push(`${q.bathrooms_min}+ دورات مياه`)
  if (q.price_min || q.price_max) parts.push(`السعر ${q.price_min || '٠'}–${q.price_max || '∞'}`)
  if (q.area_min || q.area_max) parts.push(`المساحة ${q.area_min || '٠'}–${q.area_max || '∞'} م²`)
  if (q.furnished) parts.push(q.furnished)
  if (q.age_max) parts.push(`أقل من ${q.age_max} سنوات`)
  if (q.floor_level) parts.push(`الدور ${q.floor_level}`)
  if (q.facade) parts.push(q.facade)
  if (q.services) parts.push(q.services.split(',').filter(Boolean).length + ' مرافق')
  return parts.join(' · ') || 'كل العقارات'
}

function read(): SavedSearch[] {
  if (typeof window === 'undefined') return []
  try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] }
}
function write(list: SavedSearch[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* */ }
  window.dispatchEvent(new CustomEvent(EVT))
}

export function useSavedSearches() {
  const [items, setItems] = useState<SavedSearch[]>([])
  useEffect(() => {
    const sync = () => setItems(read())
    sync()
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) sync() }
    window.addEventListener(EVT, sync)
    window.addEventListener('storage', onStorage)
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener('storage', onStorage) }
  }, [])

  // Returns 'saved' | 'exists' so the button can give feedback (no duplicates of the same query).
  const save = useCallback((query: Record<string, string>): 'saved' | 'exists' => {
    const qs = queryToQS(query)
    const cur = read()
    if (cur.some((s) => queryToQS(s.query) === qs)) return 'exists'
    const item: SavedSearch = { id: `${cur.length}-${Math.round(performance.now())}`, query, label: describeSearch(query), alert: false, created: Date.now() }
    write([item, ...cur])
    return 'saved'
  }, [])

  const remove = useCallback((id: string) => write(read().filter((s) => s.id !== id)), [])
  const toggleAlert = useCallback((id: string) => write(read().map((s) => (s.id === id ? { ...s, alert: !s.alert } : s))), [])

  return { items, count: items.length, save, remove, toggleAlert }
}

// Direct read/write for the account-sync island (reuses the exact serialization + the
// 'aqar:saved-searches' event).
export function readSavedSearches(): SavedSearch[] {
  return read()
}
export function writeSavedSearches(list: SavedSearch[]) {
  write(list)
}
