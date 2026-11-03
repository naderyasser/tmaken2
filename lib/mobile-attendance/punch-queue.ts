/**
 * Tamkeen Go — G1 offline punch queue (slim, single-purpose).
 *
 * FORKED from lib/cashier/{pos-db,sync}.ts (own IndexedDB db `tamkeen_punch`,
 * own store `queue`) — the live cashier files are intentionally NOT imported or
 * modified. Same primitives (fail-soft IDB, FIFO replay, backoff, Web-Locks
 * single-flight, online/visibility triggers), stripped to the one action this
 * feature needs: a verified punch POST.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DESIGN NOTE — why this is a RETRY BUFFER, not a fully-offline capture store:
 *
 * A WebAuthn assertion is bound to a ONE-TIME, ~120s-TTL server challenge. A
 * punch captured while fully offline and replayed minutes later WILL FAIL the
 * server verification (expired / already-consumed challenge). So the primary UX
 * path is SYNCHRONOUS: get challenge → assert → punch immediately while online.
 *
 * This queue exists ONLY to absorb a *transient* connectivity blip during the
 * punch POST itself — the assertion is already done and the challenge is still
 * fresh for the first few seconds. We retry with short backoff strictly INSIDE
 * the challenge window (RETRY_WINDOW_MS), and once that window closes we PARK
 * the punch as `failed` with a clear "please punch again" message rather than
 * pretending a stale assertion will ever succeed.
 *
 * TODO (post-G1): true fully-offline capture needs a challenge-less flow or a
 * server-issued long-lived nonce (device-bound, replay-guarded server-side).
 * That is out of scope for G1 and deliberately NOT faked here.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { frappeClient } from '@/lib/api-client'

const MOD = 'base_meena.mobile_attendance'
const DB_NAME = 'tamkeen_punch'
const DB_VERSION = 1
const STORE = 'queue'

// Short backoff — every retry must fit comfortably inside the ~120s challenge TTL.
const BACKOFF_MS = [1_000, 3_000, 8_000, 20_000]
// Stop retrying a few seconds before the server's 120s TTL so we never waste a
// round-trip on a challenge that is certainly dead.
const RETRY_WINDOW_MS = 110_000

// ── types ─────────────────────────────────────────────────────────────────────

export interface PunchPayload {
  credential_id: string
  client_data_json: string
  authenticator_data: string
  signature: string
  latitude: number
  longitude: number
  log_type?: string
  device_label?: string
}

export type PunchStatus = 'pending' | 'syncing' | 'failed'

export interface QueuedPunch extends PunchPayload {
  id: string // client UUID — doubles as client_ref (server idempotency key)
  createdAt: string // ISO
  status: PunchStatus
  attempts: number
  lastError?: string
}

export interface PunchResult {
  ok: boolean
  checkin: string
  log_type: string
  time: string
  biometric_verified: boolean | number
  idempotent_replay?: boolean
}

export interface PunchQueueSnapshot {
  pending: number
  failed: number
  syncing: boolean
  lastError: string | null
  items: QueuedPunch[]
}

// ── IndexedDB (fail-soft) ───────────────────────────────────────────────────────

let dbPromise: Promise<IDBDatabase | null> | null = null

export function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) {
          const q = db.createObjectStore(STORE, { keyPath: 'id' })
          q.createIndex('status', 'status')
          q.createIndex('createdAt', 'createdAt')
        }
      }
      req.onsuccess = () => {
        const db = req.result
        db.onversionchange = () => {
          try { db.close() } catch { /* */ }
          dbPromise = null
        }
        resolve(db)
      }
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  const db = await openDb()
  if (!db) return null
  try {
    return await reqToPromise(fn(db.transaction(STORE, mode).objectStore(STORE)))
  } catch {
    return null
  }
}

async function idbPut(value: QueuedPunch): Promise<void> {
  await withStore('readwrite', (s) => s.put(value))
}

async function idbDelete(id: string): Promise<void> {
  await withStore('readwrite', (s) => s.delete(id))
}

async function idbGetAll(): Promise<QueuedPunch[]> {
  const r = await withStore<QueuedPunch[]>('readonly', (s) => s.getAll() as IDBRequest<QueuedPunch[]>)
  return r ?? []
}

/** UUID v4 — stable client_ref / idempotency key. */
export function newPunchId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  } catch { /* */ }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

// ── network-vs-server split (mirrors cashier/sync.ts) ────────────────────────────

/** Network-level failure (offline, DNS, abort, gateway dead) — retryable.
 *  Anything else is a SERVER verdict (validation / expired challenge) — parked. */
export function isNetworkError(e: unknown): boolean {
  if (!e) return false
  const name = (e as Error).name || ''
  if (name === 'AbortError' || name === 'TimeoutError') return true
  const msg = String((e as Error).message || e).toLowerCase()
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network error') ||
    msg.includes('load failed') ||
    msg.includes('fetch failed') ||
    msg.includes('err_internet') ||
    msg.includes('err_network') ||
    msg.includes('502') || msg.includes('503') || msg.includes('504') ||
    msg.includes('bad gateway') || msg.includes('gateway time')
  )
}

// ── pub/sub so the UI can reflect queue length + last error ──────────────────────

type Listener = () => void
const listeners = new Set<Listener>()
let syncing = false
let timer: ReturnType<typeof setTimeout> | null = null

function notify() {
  for (const l of [...listeners]) {
    try { l() } catch { /* */ }
  }
}

export function subscribePunchQueue(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export async function getPunchQueueSnapshot(): Promise<PunchQueueSnapshot> {
  const all = (await idbGetAll()).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const lastFailed = [...all].reverse().find((p) => p.status === 'failed')
  return {
    pending: all.filter((p) => p.status !== 'failed').length,
    failed: all.filter((p) => p.status === 'failed').length,
    syncing,
    lastError: lastFailed?.lastError ?? null,
    items: all,
  }
}

// ── the raw POST ─────────────────────────────────────────────────────────────

async function callPunch(p: QueuedPunch | (PunchPayload & { id: string })): Promise<PunchResult> {
  const r = await frappeClient.call<PunchResult>(`${MOD}.punch_api.punch`, {
    credential_id: p.credential_id,
    client_data_json: p.client_data_json,
    authenticator_data: p.authenticator_data,
    signature: p.signature,
    latitude: p.latitude,
    longitude: p.longitude,
    client_ref: p.id,
    log_type: p.log_type,
    device_label: p.device_label,
  })
  return (r as any)?.message as PunchResult
}

/**
 * Synchronous happy path: punch immediately while online, reusing `clientRef`
 * as the idempotency key. Throws on any error — the caller inspects
 * isNetworkError() to decide whether to enqueuePunch(payload, clientRef).
 */
export function punchDirect(payload: PunchPayload, clientRef: string): Promise<PunchResult> {
  return callPunch({ ...payload, id: clientRef })
}

/** Discard a parked (failed) punch permanently — user chose to re-punch instead. */
export async function discardPunch(id: string): Promise<void> {
  await idbDelete(id)
  notify()
}

// ── queue operations ─────────────────────────────────────────────────────────

/**
 * Buffer a punch whose synchronous POST hit a NETWORK error. The assertion is
 * already captured; kickSync retries it inside the challenge window.
 */
export async function enqueuePunch(payload: PunchPayload, id: string = newPunchId()): Promise<QueuedPunch> {
  const punch: QueuedPunch = {
    ...payload,
    id,
    createdAt: new Date().toISOString(),
    status: 'pending',
    attempts: 0,
  }
  await idbPut(punch)
  notify()
  void kickSync('enqueue')
  return punch
}

function scheduleRetry(attempts: number) {
  if (timer) clearTimeout(timer)
  const delay = BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)]
  timer = setTimeout(() => { void kickSync('backoff') }, delay)
}

export async function processQueueOnce(): Promise<void> {
  const all = (await idbGetAll()).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const open = all.filter((p) => p.status !== 'failed')
  if (open.length === 0) return

  for (const p of open) {
    const age = Date.now() - Date.parse(p.createdAt)

    // Challenge window already closed — the assertion is dead. Park immediately
    // and prompt a re-punch (see DESIGN NOTE).
    if (age >= RETRY_WINDOW_MS) {
      p.status = 'failed'
      p.lastError = 'CHALLENGE_EXPIRED'
      await idbPut(p)
      notify()
      continue
    }

    p.attempts += 1
    p.status = 'syncing'
    await idbPut(p)
    notify()

    try {
      await callPunch(p)
      // success — the checkin is recorded; drop it from the queue.
      await idbDelete(p.id)
      notify()
      continue
    } catch (e) {
      if (isNetworkError(e)) {
        // still offline: keep pending and retry with backoff — but only while the
        // challenge is plausibly still valid AND we have attempts left.
        if (age < RETRY_WINDOW_MS && p.attempts < BACKOFF_MS.length) {
          p.status = 'pending'
          p.lastError = String((e as Error).message || e)
          await idbPut(p)
          notify()
          scheduleRetry(p.attempts)
          return
        }
        // retries exhausted inside the window — park it.
        p.status = 'failed'
        p.lastError = 'CHALLENGE_EXPIRED'
        await idbPut(p)
        notify()
        continue
      }
      // SERVER verdict (outside radius, expired/consumed challenge, no passkey…)
      // — a replay will not fix it; park with the server's message.
      p.status = 'failed'
      p.lastError = String((e as Error).message || e)
      await idbPut(p)
      notify()
      continue
    }
  }
}

/** Trigger a sync pass. Single-flight across tabs via Web Locks (in-tab flag fallback). */
export async function kickSync(_reason = 'manual'): Promise<void> {
  if (typeof window === 'undefined') return
  if (syncing) return
  const run = async () => {
    syncing = true
    notify()
    try { await processQueueOnce() } finally {
      syncing = false
      notify()
    }
  }
  try {
    const locks = (navigator as any).locks
    if (locks?.request) {
      await locks.request('tamkeen-punch-sync', { ifAvailable: true }, async (lock: unknown) => {
        if (lock) await run()
      })
      return
    }
  } catch { /* lock API unavailable — fall through */ }
  await run()
}

/** Wire global triggers once per tab: reconnect, tab visible, initial load. */
let triggersInstalled = false
export function installPunchSyncTriggers(): void {
  if (triggersInstalled || typeof window === 'undefined') return
  triggersInstalled = true
  window.addEventListener('online', () => { void kickSync('online') })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void kickSync('visible')
  })
  void kickSync('boot')
}
