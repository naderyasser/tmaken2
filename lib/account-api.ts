'use client'

import { frappeClient } from './api-client'
import type { ListingSearchResult } from './real-estate-api'

// Storefront accounts client (phone-OTP → Frappe session). All endpoints live in the
// backend module base_meena.real_estate.aqar_account_api. Everything no-ops gracefully
// while the feature flag is off (account_config().enabled === false).

const ACCOUNT = 'base_meena.real_estate.aqar_account_api'
const ACCOUNT_EVT = 'aqar:account' // dispatched on login/logout so the sync island reacts

function unwrap<T>(resp: any): T {
  return (resp?.message ?? resp?.data) as T
}

export interface AccountMe {
  authenticated: boolean
  user?: string
  full_name?: string
  phone?: string
  advertiser?: string | null
  advertiser_name?: string | null
  is_phone_verified?: boolean
}

export interface MyListing extends Partial<ListingSearchResult> {
  name: string
  status?: string
  rejection_reason?: string
  published_at?: string
}

export interface SavedSearchRow {
  name: string
  title?: string
  notify_on_match?: 0 | 1
  is_active?: 0 | 1
  query_json?: string
  creation?: string
}

// Module-level memoized promises (config + identity are stable within a page load).
let configPromise: Promise<{ enabled: boolean }> | null = null
let mePromise: Promise<AccountMe> | null = null

export const accountApi = {
  getConfig(): Promise<{ enabled: boolean }> {
    if (!configPromise) {
      configPromise = frappeClient
        .call(`${ACCOUNT}.account_config`)
        .then((r) => unwrap<{ enabled: boolean }>(r))
        .catch(() => ({ enabled: false }))
    }
    return configPromise
  },

  getMe(force = false): Promise<AccountMe> {
    if (force) mePromise = null
    if (!mePromise) {
      mePromise = frappeClient
        .call(`${ACCOUNT}.account_me`)
        .then((r) => unwrap<AccountMe>(r))
        .catch(() => ({ authenticated: false }))
    }
    return mePromise
  },

  async requestOtp(phone: string): Promise<{ sent: boolean; ttl?: number }> {
    return unwrap(await frappeClient.call(`${ACCOUNT}.account_request_otp`, { phone }))
  },

  async loginVerify(phone: string, code: string, full_name?: string): Promise<AccountMe & { ok: boolean; is_new?: boolean }> {
    const res = unwrap<any>(await frappeClient.call(`${ACCOUNT}.account_verify_otp`, { phone, code, full_name }))
    // Prime the new session's CSRF token so the first authed write doesn't 417-retry.
    try { await frappeClient.fetchCsrfToken() } catch { /* */ }
    mePromise = null // identity changed
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(ACCOUNT_EVT))
    return { authenticated: true, ...res }
  },

  async logout(): Promise<void> {
    try { await frappeClient.logout() } catch { /* */ }
    mePromise = null
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(ACCOUNT_EVT))
  },

  async overview(): Promise<any> {
    return unwrap(await frappeClient.call(`${ACCOUNT}.account_overview`))
  },
  async myListings(status?: string): Promise<MyListing[]> {
    return unwrap<MyListing[]>(await frappeClient.call(`${ACCOUNT}.my_listings`, { status })) || []
  },
  async myRequests(): Promise<{ buyer_requests: any[]; contract_requests: any[] }> {
    return unwrap(await frappeClient.call(`${ACCOUNT}.my_requests`)) || { buyer_requests: [], contract_requests: [] }
  },
  async myFavorites(): Promise<ListingSearchResult[]> {
    return unwrap<ListingSearchResult[]>(await frappeClient.call(`${ACCOUNT}.my_favorites`)) || []
  },
  async setFavorite(listing: string, on: boolean): Promise<{ favorited: boolean }> {
    return unwrap(await frappeClient.call(`${ACCOUNT}.set_favorite`, { listing, on: on ? 1 : 0 }))
  },
  async mySavedSearches(): Promise<SavedSearchRow[]> {
    return unwrap<SavedSearchRow[]>(await frappeClient.call(`${ACCOUNT}.my_saved_searches`)) || []
  },
  async saveSearch(query_json: string, title?: string, alert = true): Promise<{ name: string; existing: boolean }> {
    return unwrap(await frappeClient.call(`${ACCOUNT}.save_search`, { query_json, title, alert: alert ? 1 : 0 }))
  },
  async updateSavedSearch(name: string, opts: { alert?: boolean; title?: string }): Promise<{ name: string; notify_on_match: number }> {
    return unwrap(await frappeClient.call(`${ACCOUNT}.update_saved_search`, {
      name,
      alert: opts.alert === undefined ? undefined : opts.alert ? 1 : 0,
      title: opts.title,
    }))
  },
  async deleteSavedSearch(name: string): Promise<{ deleted: boolean }> {
    return unwrap(await frappeClient.call(`${ACCOUNT}.delete_saved_search`, { name }))
  },
}

export const ACCOUNT_EVENT = ACCOUNT_EVT
