'use client'

import { accountApi } from './account-api'
import {
  readCollection, writeCollection, toSnapshot, FAVORITES_KEY, type ListingSnapshot,
} from './listing-collections'
import {
  readSavedSearches, writeSavedSearches, queryToQS, describeSearch, type SavedSearch,
} from './saved-searches'

// Reconciles the localStorage read-model (favorites + saved searches) with the server when
// a phone-account session exists. localStorage stays the source of truth for rendering; the
// server is eventually consistent. Never deletes on the initial merge (union — no data loss);
// deletions propagate only through ongoing mirroring. Compare stays local-only.

let running = false
let favSynced: Set<string> | null = null            // favorite names known-synced to server
let savedSynced: Map<string, { qs: string; alert: boolean }> | null = null // serverName → state

async function mergeFavorites() {
  const server = await accountApi.myFavorites().catch(() => [])
  const serverNames = new Set(server.map((r) => r.name))
  const local = readCollection(FAVORITES_KEY)
  const localNames = new Set(local.map((x) => x.name))

  // push local-only up (best effort)
  for (const snap of local) {
    if (!serverNames.has(snap.name)) {
      try { await accountApi.setFavorite(snap.name, true) } catch { /* retried by mirror */ }
    }
  }
  // union: keep local items, append server-only as fresh snapshots
  const union: ListingSnapshot[] = [...local]
  for (const row of server) {
    if (!localNames.has(row.name)) union.push(toSnapshot(row as any))
  }
  writeCollection(FAVORITES_KEY, union)
  favSynced = new Set(union.map((x) => x.name))
}

async function mirrorFavorites() {
  if (!favSynced) return
  const cur = new Set(readCollection(FAVORITES_KEY).map((x) => x.name))
  const synced = new Set(favSynced)
  for (const n of cur) {
    if (!synced.has(n)) {
      try { await accountApi.setFavorite(n, true); synced.add(n) } catch { /* keep for retry */ }
    }
  }
  for (const n of Array.from(synced)) {
    if (!cur.has(n)) {
      try { await accountApi.setFavorite(n, false); synced.delete(n) } catch { /* keep for retry */ }
    }
  }
  favSynced = synced
}

async function mergeSaved() {
  const serverRows = await accountApi.mySavedSearches().catch(() => [])
  const serverByQs = new Map<string, { name: string; row: any }>()
  const synced = new Map<string, { qs: string; alert: boolean }>()
  for (const r of serverRows) {
    let q: Record<string, string> = {}
    try { q = JSON.parse(r.query_json || '{}') } catch { /* */ }
    const qs = queryToQS(q)
    serverByQs.set(qs, { name: r.name, row: r })
    synced.set(r.name, { qs, alert: !!r.notify_on_match })
  }

  const local = readSavedSearches()
  const out: SavedSearch[] = []
  const seenQs = new Set<string>()

  // reconcile each local search
  for (const s of local) {
    const qs = queryToQS(s.query)
    seenQs.add(qs)
    const onServer = serverByQs.get(qs)
    if (onServer) {
      out.push({ ...s, id: onServer.name }) // adopt the server id so edits map 1:1
    } else {
      try {
        const res = await accountApi.saveSearch(JSON.stringify(s.query), s.label || describeSearch(s.query), s.alert)
        out.push({ ...s, id: res.name })
        synced.set(res.name, { qs, alert: s.alert })
      } catch {
        out.push(s) // stays local; retried by mirror
      }
    }
  }
  // append server-only searches
  for (const [qs, { name, row }] of serverByQs) {
    if (!seenQs.has(qs)) {
      let q: Record<string, string> = {}
      try { q = JSON.parse(row.query_json || '{}') } catch { /* */ }
      out.push({ id: name, query: q, label: row.title || describeSearch(q), alert: !!row.notify_on_match, created: Date.now() })
    }
  }
  writeSavedSearches(out)
  savedSynced = synced
}

async function mirrorSaved() {
  if (!savedSynced) return
  const cur = readSavedSearches()
  const synced = new Map(savedSynced)
  const byId = new Map(cur.map((s) => [s.id, s]))
  let changed = false
  const out: SavedSearch[] = []

  for (const s of cur) {
    const known = synced.get(s.id)
    if (!known) {
      // a new local search (id isn't a server name) → create it
      try {
        const res = await accountApi.saveSearch(JSON.stringify(s.query), s.label || describeSearch(s.query), s.alert)
        synced.set(res.name, { qs: queryToQS(s.query), alert: s.alert })
        out.push({ ...s, id: res.name }); changed = changed || res.name !== s.id
      } catch { out.push(s) }
    } else {
      if (known.alert !== s.alert) {
        try { await accountApi.updateSavedSearch(s.id, { alert: s.alert }); known.alert = s.alert } catch { /* retry */ }
      }
      out.push(s)
    }
  }
  // deletions: known server names no longer present locally
  for (const name of Array.from(synced.keys())) {
    if (!byId.has(name)) {
      try { await accountApi.deleteSavedSearch(name); synced.delete(name) } catch { /* retry */ }
    }
  }
  savedSynced = synced
  if (changed) writeSavedSearches(out) // rewrite only when a local id was replaced by a server id
}

/** Full merge — call on login / on mount with a live session. */
export async function syncOnLogin() {
  if (running) return
  running = true
  try {
    await mergeFavorites()
    await mergeSaved()
  } finally {
    running = false
  }
}

/** Ongoing mirror of local changes (favorites + saved searches) to the server. */
export async function mirror(kind: 'favorites' | 'saved' | 'all' = 'all') {
  if (running) return
  running = true
  try {
    if (kind === 'favorites' || kind === 'all') await mirrorFavorites()
    if (kind === 'saved' || kind === 'all') await mirrorSaved()
  } finally {
    running = false
  }
}

/** On logout: keep the device copy, forget the sync bookkeeping so a later login re-merges. */
export function resetSyncState() {
  favSynced = null
  savedSynced = null
}
