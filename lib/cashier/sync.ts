/**
 * Cashier offline sync engine — durable FIFO action queue with idempotent replay.
 *
 * Guarantees:
 * - Actions (sales, session close) queue durably in IndexedDB and replay IN ORDER.
 * - Every action carries a client UUID the backend enforces uniquely (pos_client_ref),
 *   so a replay after a connection flap can NEVER create a duplicate invoice or close
 *   the wrong session — re-sending is always safe.
 * - Single-flight: the Web Locks API ensures only one tab syncs at a time (module-level
 *   flag as fallback), so multiple open tabs don't double-process the queue.
 * - Failure policy: NETWORK errors keep the action `pending` and retry with backoff
 *   (the retry itself is the connectivity probe). SERVER validation errors park the
 *   action as `failed` for a human (it will not block later sales — but it DOES block
 *   a queued session close, which must never run while earlier sales are unresolved).
 */

import { cashierApi, type POSInvoice } from "@/lib/cashier-api"
import { idbGet, idbGetAll, idbPut, idbDelete, newClientId, STORES } from "@/lib/cashier/pos-db"

export type QueuedActionKind = "sale" | "close_session"
export type QueuedActionStatus = "pending" | "syncing" | "synced" | "failed"

export interface QueuedAction {
  id: string                 // client UUID — doubles as the server idempotency key
  kind: QueuedActionKind
  payload: Record<string, any>
  status: QueuedActionStatus
  attempts: number
  lastError?: string
  createdAt: string          // ISO — becomes offline_created_at for sales
  syncedAt?: string
  result?: { invoiceName?: string; sessionName?: string }
}

export interface SyncSnapshot {
  pending: number
  failed: number
  syncing: boolean
  lastSyncedAt: string | null
  items: QueuedAction[]
}

// Backoff schedule per attempt (caps at the last entry)
const BACKOFF_MS = [1_000, 5_000, 30_000, 120_000, 300_000]

/** Network-level failure (offline, DNS, abort, gateway dead) — retryable forever.
 *  Anything else from the API layer is a SERVER verdict (validation etc.) — parked. */
export function isNetworkError(e: unknown): boolean {
  if (!e) return false
  const name = (e as Error).name || ""
  if (name === "AbortError" || name === "TimeoutError") return true
  const msg = String((e as Error).message || e).toLowerCase()
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network error") ||
    msg.includes("load failed") ||          // safari
    msg.includes("fetch failed") ||
    msg.includes("err_internet") ||
    msg.includes("err_network") ||
    msg.includes("502") || msg.includes("503") || msg.includes("504") ||
    msg.includes("bad gateway") || msg.includes("gateway time")
  )
}

// ── tiny pub/sub so React (and any tab UI) can render queue state ───────────
type Listener = () => void
const listeners = new Set<Listener>()
let syncing = false
let timer: ReturnType<typeof setTimeout> | null = null
let lastSyncedAt: string | null = null
const LAST_SYNC_KEY = "last_sync_at"

export async function getLastSyncedAt(): Promise<string | null> {
  if (lastSyncedAt) return lastSyncedAt
  return (await idbGet<string>(STORES.kv, LAST_SYNC_KEY)) ?? null
}

function notify() {
  for (const l of [...listeners]) {
    try { l() } catch { /* */ }
  }
}

export function subscribeSync(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export async function getSyncSnapshot(): Promise<SyncSnapshot> {
  const all = (await idbGetAll<QueuedAction>(STORES.queue)).sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt),
  )
  const open = all.filter(a => a.status !== "synced")
  return {
    pending: open.filter(a => a.status !== "failed").length, // pending + mid-sync
    failed: open.filter(a => a.status === "failed").length,
    syncing,
    lastSyncedAt: lastSyncedAt ?? (await getLastSyncedAt()),
    items: open,
  }
}

// ── queue operations ─────────────────────────────────────────────────────────

export async function enqueueAction(
  kind: QueuedActionKind,
  payload: Record<string, any>,
  id: string = newClientId(),
): Promise<QueuedAction> {
  const action: QueuedAction = {
    id, kind, payload,
    status: "pending",
    attempts: 0,
    createdAt: new Date().toISOString(),
  }
  await idbPut(STORES.queue, action)
  notify()
  void kickSync("enqueue")
  return action
}

/** Re-arm a parked (failed) action for another attempt. */
export async function retryAction(id: string): Promise<void> {
  const all = await idbGetAll<QueuedAction>(STORES.queue)
  const a = all.find(x => x.id === id)
  if (a && a.status === "failed") {
    a.status = "pending"
    a.lastError = undefined
    await idbPut(STORES.queue, a)
    notify()
    void kickSync("retry")
  }
}

/** Discard a parked action permanently (manager decision — e.g. an invalid offline
 *  sale that the server will never accept). */
export async function discardAction(id: string): Promise<void> {
  await idbDelete(STORES.queue, id)
  notify()
}

/** One-time migration of the legacy localStorage queue into IndexedDB. */
export async function migrateLegacyQueue(): Promise<void> {
  try {
    const raw = localStorage.getItem("cashier_offline_queue")
    if (!raw) return
    const legacy = JSON.parse(raw) as Array<{
      id: string; items: any[]; customer: string
      payments: Array<{ mode_of_payment: string; amount: number }>
      discount_amount: number; createdAt: string; synced: boolean
    }>
    const existing = new Set((await idbGetAll<QueuedAction>(STORES.queue)).map(a => a.id))
    for (const tx of legacy) {
      if (tx.synced || existing.has(tx.id)) continue
      await idbPut(STORES.queue, {
        id: tx.id, kind: "sale",
        payload: {
          items: tx.items, customer: tx.customer,
          payments: tx.payments, discount_amount: tx.discount_amount,
        },
        status: "pending", attempts: 0,
        createdAt: tx.createdAt || new Date().toISOString(),
      } satisfies QueuedAction)
    }
    localStorage.removeItem("cashier_offline_queue")
    notify()
  } catch { /* legacy data unreadable — leave it */ }
}

/** Remove FAILED items that are clearly stale (parked for ≥7 days after ≥3 attempts) —
 *  the admin "cleanup" action. Returns how many were removed. */
export async function cleanupStaleFailed(maxAgeDays = 7, minAttempts = 3): Promise<number> {
  const cutoff = Date.now() - maxAgeDays * 86_400_000
  const all = await idbGetAll<QueuedAction>(STORES.queue)
  let removed = 0
  for (const a of all) {
    if (a.status === "failed" && a.attempts >= minAttempts && Date.parse(a.createdAt) < cutoff) {
      await idbDelete(STORES.queue, a.id)
      removed++
    }
  }
  if (removed) notify()
  return removed
}

/** Admin-only: wipe every unsynced action (guarded by a confirm dialog in the UI). */
export async function clearQueue(): Promise<number> {
  const all = await idbGetAll<QueuedAction>(STORES.queue)
  let removed = 0
  for (const a of all) {
    if (a.status !== "synced") {
      await idbDelete(STORES.queue, a.id)
      removed++
    }
  }
  if (removed) notify()
  return removed
}

/** A queued session close may only sync after every EARLIER queued sale has synced —
 *  pure so the rule is unit-testable. */
export function closeIsBlocked(open: QueuedAction[], close: QueuedAction): boolean {
  return open.some(x =>
    x.id !== close.id && x.kind === "sale" && x.createdAt <= close.createdAt && x.status !== "synced")
}

// ── the sync loop ────────────────────────────────────────────────────────────

function scheduleRetry(attempts: number) {
  if (timer) clearTimeout(timer)
  const delay = BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)]
  timer = setTimeout(() => { void kickSync("backoff") }, delay)
}

async function executeAction(a: QueuedAction): Promise<{ ok: boolean; park?: boolean; error?: string }> {
  try {
    if (a.kind === "sale") {
      const res = await cashierApi.createSale({
        items: a.payload.items,
        customer: a.payload.customer || undefined,
        payments: a.payload.payments,
        discount_amount: a.payload.discount_amount || 0,
        idempotency_key: a.id,
        offline_created_at: a.createdAt.replace("T", " ").slice(0, 19),
      })
      a.result = { invoiceName: res.invoice?.name ? String(res.invoice.name) : undefined }
      // reconcile the provisional local invoice with the real server number
      if (a.result.invoiceName) {
        await idbPut(STORES.invoices, {
          local_id: a.id,
          server_name: a.result.invoiceName,
          createdAt: a.createdAt,
          invoice: res.invoice,
          queued: false,
        })
      }
      return { ok: true }
    }
    if (a.kind === "close_session") {
      const res = await cashierApi.closeSession(a.payload.closing_amounts || {}, a.payload.session)
      a.result = { sessionName: res.session?.name }
      return { ok: true }
    }
    return { ok: false, park: true, error: `unknown action kind ${a.kind}` }
  } catch (e) {
    if (isNetworkError(e)) return { ok: false, park: false, error: String((e as Error).message || e) }
    return { ok: false, park: true, error: String((e as Error).message || e) }
  }
}

async function processQueueOnce(): Promise<void> {
  const all = (await idbGetAll<QueuedAction>(STORES.queue)).sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt),
  )
  const open = all.filter(x => x.status !== "synced")
  if (open.length === 0) return

  for (const a of open) {
    if (a.status === "failed") continue // parked — needs human retry/discard
    // 'syncing' here means a previous run crashed mid-attempt — safe to retry
    // (the idempotency key makes the replay exact-once either way).

    // A queued close must NEVER run while earlier sales are unresolved: the server
    // computes expected cash from synced invoices at close time.
    if (a.kind === "close_session" && closeIsBlocked(open, a)) return

    a.attempts += 1
    a.status = "syncing"
    await idbPut(STORES.queue, a)
    notify()
    const r = await executeAction(a)
    if (r.ok) {
      a.status = "synced"
      a.syncedAt = new Date().toISOString()
      a.lastError = undefined
      lastSyncedAt = a.syncedAt
      await idbPut(STORES.queue, a)
      void idbPut(STORES.kv, a.syncedAt, LAST_SYNC_KEY)
      notify()
      continue
    }
    if (r.park) {
      a.status = "failed"
      a.lastError = r.error
      await idbPut(STORES.queue, a)
      notify()
      continue // later sales may still be valid — keep going
    }
    // network failure: back to pending, stop the loop, retry with backoff
    a.status = "pending"
    a.lastError = r.error
    await idbPut(STORES.queue, a)
    notify()
    scheduleRetry(a.attempts)
    return
  }
  // everything processed — clean synced actions older than 24h to keep the store small
  const dayAgo = Date.now() - 86_400_000
  for (const a of all) {
    if (a.status === "synced" && a.syncedAt && Date.parse(a.syncedAt) < dayAgo) {
      await idbDelete(STORES.queue, a.id)
    }
  }
}

/** Trigger a sync pass. Single-flight across tabs via Web Locks (in-tab flag fallback). */
export async function kickSync(_reason = "manual"): Promise<void> {
  if (typeof window === "undefined") return
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
      await locks.request("cashier-sync", { ifAvailable: true }, async (lock: unknown) => {
        if (lock) await run()
      })
      return
    }
  } catch { /* lock API unavailable — fall through */ }
  await run()
}

/** Wire global triggers once per tab: reconnect, tab visible, initial load. */
let triggersInstalled = false
export function installSyncTriggers(): void {
  if (triggersInstalled || typeof window === "undefined") return
  triggersInstalled = true
  window.addEventListener("online", () => { void kickSync("online") })
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void kickSync("visible")
  })
  void migrateLegacyQueue().then(() => kickSync("boot"))
}
