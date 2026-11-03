/**
 * In-app Offline Self-Test — proves the offline→online round-trip end to end on the
 * actual device, WITHOUT leaving data behind:
 *   1. app shell cached (6/6)
 *   2. enqueue a sale into the queue store (works offline)
 *   3. it syncs to a real ACC-PSINV-* id   (reconnect here if offline)
 *   4. the local queue drains back to baseline
 *   5. the test invoice is cleaned up (server-side, prefix-guarded)
 *
 * It does NOT replace the physical airplane-mode checklist — that's the authoritative
 * manual gate (docs/CASHIER_GO_LIVE_CHECKLIST.md). The sale it pushes is real but is
 * tagged `selftest-…` and removed by selftest_cleanup, which can only ever touch
 * self-test invoices.
 */

import { idbGet, idbGetAll, newClientId, STORES } from "@/lib/cashier/pos-db"
import { enqueueAction, getSyncSnapshot, kickSync } from "@/lib/cashier/sync"
import { cashierApi } from "@/lib/cashier-api"
import type { CatalogItem } from "@/lib/cashier-api"

export type StepStatus = "pending" | "running" | "waiting" | "pass" | "fail"
export interface SelfTestStep {
  key: "shell" | "enqueue" | "sync" | "drain" | "cleanup"
  status: StepStatus
  /** optional i18n detail key or raw text */
  detail?: string
}

const SHELL_ROUTE_TARGET = 6
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function shellCached(): Promise<number> {
  if (!("serviceWorker" in navigator)) return 0
  const reg = await navigator.serviceWorker.getRegistration("/cashier")
  const sw = reg?.active
  if (!sw) return 0
  return new Promise<number>((resolve) => {
    const to = setTimeout(() => resolve(0), 3000)
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type !== "cashier-shell-status") return
      clearTimeout(to)
      navigator.serviceWorker.removeEventListener("message", onMsg)
      resolve((e.data.routesCached || []).length)
    }
    navigator.serviceWorker.addEventListener("message", onMsg)
    sw.postMessage({ type: "cashier-shell-status" })
  })
}

async function firstSellableItem(): Promise<CatalogItem | null> {
  const all = await idbGetAll<CatalogItem>(STORES.catalog)
  return all.find(i => !(i.actual_qty != null && i.actual_qty <= 0)) ?? all[0] ?? null
}

/** Run the self-test, reporting progress via onUpdate after each change. */
export async function runOfflineSelfTest(
  onUpdate: (steps: SelfTestStep[]) => void,
): Promise<SelfTestStep[]> {
  const steps: SelfTestStep[] = [
    { key: "shell", status: "pending" },
    { key: "enqueue", status: "pending" },
    { key: "sync", status: "pending" },
    { key: "drain", status: "pending" },
    { key: "cleanup", status: "pending" },
  ]
  const set = (i: number, status: StepStatus, detail?: string) => {
    steps[i] = { ...steps[i], status, detail }
    onUpdate([...steps])
  }

  // 1) shell
  set(0, "running")
  const cached = await shellCached()
  set(0, cached >= SHELL_ROUTE_TARGET ? "pass" : "fail", `${cached}/${SHELL_ROUTE_TARGET}`)
  if (cached < SHELL_ROUTE_TARGET) return steps // shell missing → can't boot offline; stop

  // 2) enqueue a tagged sale
  set(1, "running")
  const item = await firstSellableItem()
  if (!item) { set(1, "fail", "cashier.selftest_no_item"); return steps }
  const id = `selftest-${newClientId()}`
  const rate = Number(item.rate) || 1
  await enqueueAction("sale", {
    items: [{ item_code: item.item_code, item_name: item.item_name, qty: 1, rate, amount: rate, discount_percentage: 0 }],
    customer: "Walk-In Customer",
    payments: null,
    discount_amount: 0,
  }, id)
  const inQueue = (await getSyncSnapshot()).items.some(a => a.id === id)
  set(1, inQueue ? "pass" : "fail")
  if (!inQueue) return steps

  // 3) sync → real ACC-PSINV id (waits through a reconnect)
  set(2, navigator.onLine ? "running" : "waiting", navigator.onLine ? undefined : "cashier.selftest_reconnect")
  let serverName: string | null = null
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    set(2, navigator.onLine ? "running" : "waiting", navigator.onLine ? undefined : "cashier.selftest_reconnect")
    void kickSync("selftest")
    const rec = await idbGet<{ server_name?: string | null }>(STORES.invoices, id)
    if (rec?.server_name) { serverName = rec.server_name; break }
    await sleep(1500)
  }
  if (!serverName || !/^ACC-PSINV-/.test(serverName)) {
    set(2, "fail", serverName || "cashier.selftest_timeout")
    return steps
  }
  set(2, "pass", serverName)

  // 4) queue drained
  set(3, "running")
  let drained = false
  const drainDeadline = Date.now() + 15_000
  while (Date.now() < drainDeadline) {
    if (!(await getSyncSnapshot()).items.some(a => a.id === id)) { drained = true; break }
    await sleep(1000)
  }
  set(3, drained ? "pass" : "fail")

  // 5) cleanup (prefix-guarded; never touches real sales)
  set(4, "running")
  try {
    const r = await cashierApi.selftestCleanup()
    set(4, "pass", `${r.removed}`)
  } catch (e) {
    set(4, "fail", e instanceof Error ? e.message : "cleanup failed")
  }
  return steps
}
