/**
 * Terminal driver registry — the single place the till resolves "which hardware".
 *
 * Callers ask for `getTerminalDriver()` and get whatever this install is configured
 * for. When the acquirer is chosen, a new driver file lands beside this one and gains
 * one `case` here; nothing else in the codebase changes.
 */

import { BridgeTerminalDriver } from "./bridge"
import { MockTerminalDriver } from "./mock"
import { loadTerminalConfig, type TerminalConfig } from "./config"
import type { TerminalDriver } from "./types"

export * from "./types"
export * from "./config"
export * from "./store"
export { MockTerminalDriver, getMockScenario, setMockScenario } from "./mock"
export type { MockScenario } from "./mock"
export { BridgeTerminalDriver } from "./bridge"
export type { TerminalBridgeConfig } from "./bridge"

export function createTerminalDriver(cfg: TerminalConfig): TerminalDriver {
  switch (cfg.driver) {
    case "bridge":
      return new BridgeTerminalDriver({
        url: cfg.bridgeUrl,
        token: cfg.bridgeToken,
      })
    case "mock":
    default:
      return new MockTerminalDriver()
  }
}

/** Convenience for UI code: driver built from the currently stored config. */
export function getTerminalDriver(): TerminalDriver {
  return createTerminalDriver(loadTerminalConfig())
}
