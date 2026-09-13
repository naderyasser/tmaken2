'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ListingSearchResult } from '@/lib/real-estate-api'

// localStorage-backed user collections (favorites + compare) — no accounts/auth.
// A single window event keeps every mounted component (cards, header badge, pages, compare bar)
// in sync the instant a collection changes, and the native 'storage' event syncs across tabs.

export interface ListingSnapshot {
  name: string
  title?: string
  price?: number
  listing_type?: string
  city_name_ar?: string
  district_name_ar?: string
  city?: string
  district?: string
  primary_image?: string | null
  rega_ad_license_number?: string
  area_sqm?: number
  bedrooms?: number
  creation?: string
  views_count?: number
}

export const FAVORITES_KEY = 'aqar_favorites'
export const COMPARE_KEY = 'aqar_compare'
export const COMPARE_MAX = 3
const EVT = 'aqar:collections'

/** Keep only the fields the favorites/compare views render — small + offline-friendly. */
export function toSnapshot(l: Partial<ListingSearchResult> & { name: string }): ListingSnapshot {
  return {
    name: l.name,
    title: l.title,
    price: l.price,
    listing_type: l.listing_type,
    city_name_ar: l.city_name_ar,
    district_name_ar: l.district_name_ar,
    city: l.city,
    district: l.district,
    primary_image: l.primary_image ?? null,
    rega_ad_license_number: l.rega_ad_license_number,
    area_sqm: l.area_sqm,
    bedrooms: l.bedrooms,
    creation: l.creation,
    views_count: l.views_count,
  }
}

function read(key: string): ListingSnapshot[] {
  if (typeof window === 'undefined') return []
  try {
    const v = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function write(key: string, items: ListingSnapshot[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items))
  } catch {
    /* quota / private mode — ignore */
  }
  window.dispatchEvent(new CustomEvent(EVT, { detail: { key } }))
}

/** Generic reactive collection hook. `max` (compare) caps additions. */
function useCollection(key: string, max?: number) {
  const [items, setItems] = useState<ListingSnapshot[]>([])

  useEffect(() => {
    const sync = () => setItems(read(key))
    sync()
    const onCustom = (e: Event) => {
      if ((e as CustomEvent).detail?.key === key) sync()
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) sync()
    }
    window.addEventListener(EVT, onCustom)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(EVT, onCustom)
      window.removeEventListener('storage', onStorage)
    }
  }, [key])

  const has = useCallback((name: string) => items.some((x) => x.name === name), [items])

  // Returns the resulting state so callers can give feedback (esp. compare's 'full').
  const toggle = useCallback(
    (snap: ListingSnapshot): 'added' | 'removed' | 'full' => {
      const cur = read(key)
      if (cur.some((x) => x.name === snap.name)) {
        write(key, cur.filter((x) => x.name !== snap.name))
        return 'removed'
      }
      if (max && cur.length >= max) return 'full'
      write(key, [...cur, snap])
      return 'added'
    },
    [key, max],
  )

  const remove = useCallback((name: string) => {
    write(key, read(key).filter((x) => x.name !== name))
  }, [key])

  const clear = useCallback(() => write(key, []), [key])

  return { items, count: items.length, has, toggle, remove, clear }
}

export function useFavorites() {
  return useCollection(FAVORITES_KEY)
}
export function useCompare() {
  return useCollection(COMPARE_KEY, COMPARE_MAX)
}

// Direct read/write for the account-sync island (reuses the exact serialization + the
// 'aqar:collections' event, so writing here refreshes every mounted component).
export function readCollection(key: string): ListingSnapshot[] {
  return read(key)
}
export function writeCollection(key: string, items: ListingSnapshot[]) {
  write(key, items)
}
