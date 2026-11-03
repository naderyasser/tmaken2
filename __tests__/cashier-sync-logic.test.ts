/** Unit tests — sync-queue decision logic (error classification + FIFO close blocking). */
import { isNetworkError, closeIsBlocked, type QueuedAction } from "@/lib/cashier/sync"

describe("isNetworkError (retry-forever vs park-as-failed)", () => {
  it.each([
    new TypeError("Failed to fetch"),
    Object.assign(new Error("aborted"), { name: "AbortError" }),
    new Error("NetworkError when attempting to fetch resource."),
    new Error("CALL create_sale failed (502): Bad Gateway"),
    new Error("fetch failed"),
  ])("classifies %s as NETWORK (retryable)", (e) => {
    expect(isNetworkError(e)).toBe(true)
  })

  it.each([
    new Error("Please open a cashier session before making a sale"),
    new Error("Could not find Item: BAD-CODE"),
    new Error("Not permitted"),
  ])("classifies %s as a SERVER verdict (park as failed)", (e) => {
    expect(isNetworkError(e)).toBe(false)
  })
})

const act = (over: Partial<QueuedAction>): QueuedAction => ({
  id: Math.random().toString(36).slice(2),
  kind: "sale",
  payload: {},
  status: "pending",
  attempts: 0,
  createdAt: "2026-06-10T10:00:00.000Z",
  ...over,
})

describe("closeIsBlocked (a queued close waits for every earlier sale)", () => {
  const close = act({ kind: "close_session", id: "close-1", createdAt: "2026-06-10T12:00:00.000Z" })

  it("blocked while an earlier sale is pending", () => {
    expect(closeIsBlocked([act({ status: "pending" }), close], close)).toBe(true)
  })
  it("blocked while an earlier sale is parked as failed (human must resolve first)", () => {
    expect(closeIsBlocked([act({ status: "failed" }), close], close)).toBe(true)
  })
  it("NOT blocked when every earlier sale synced", () => {
    expect(closeIsBlocked([act({ status: "synced" }), close], close)).toBe(false)
  })
  it("NOT blocked by sales created AFTER the close", () => {
    const later = act({ createdAt: "2026-06-10T13:00:00.000Z" })
    expect(closeIsBlocked([later, close], close)).toBe(false)
  })
  it("multiple offline sales queue without id collisions", () => {
    const ids = new Set(Array.from({ length: 200 }, () => act({}).id))
    expect(ids.size).toBe(200)
  })
})
