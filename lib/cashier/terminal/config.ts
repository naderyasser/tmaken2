/**
 * Per-till terminal configuration.
 *
 * Deliberately stored in localStorage, NOT in Cashier Settings: the terminal is
 * physically cabled to ONE till. Two registers in the same branch share a tenant, a
 * company and a price list, but they have different TIDs and different bridge ports.
 * Tenant-level config would force every register onto the same terminal.
 */

import { isCardMode } from "@/lib/cashier/payment-modes"

export type TerminalDriverId = "mock" | "bridge"

export interface TerminalConfig {
  /** Master switch. Off = the till behaves exactly as it did before this feature. */
  enabled: boolean
  driver: TerminalDriverId
  /** Bridge agent endpoint — "ws://127.0.0.1:8899/ecr" by default. */
  bridgeUrl: string
  bridgeToken?: string
  /**
   * The client's actual ask: selecting a card method pushes the amount to the terminal
   * immediately, with no keying and no extra button press.
   */
  autoSend: boolean
  /**
   * Let the cashier key an approval reference by hand and continue when the terminal
   * or the bridge is down. Keeps the shop selling during an outage; every such payment
   * is flagged as manually entered so it can be audited.
   */
  allowManualFallback: boolean
  /**
   * Mode-of-Payment names to force ONTO the terminal beyond the built-in heuristic —
   * e.g. "Apple Pay", "STC Pay", or a tenant's custom naming. Exact match, case- and
   * whitespace-insensitive.
   */
  extraCardModes: string[]
  /** Mode-of-Payment names to keep OFF the terminal even though they look card-like. */
  excludedModes: string[]
}

const KEY = "cashier_terminal_config"

export const DEFAULT_TERMINAL_CONFIG: TerminalConfig = {
  enabled: false,
  driver: "mock",
  bridgeUrl: "ws://127.0.0.1:8899/ecr",
  autoSend: true,
  allowManualFallback: true,
  extraCardModes: [],
  excludedModes: [],
}

export function loadTerminalConfig(): TerminalConfig {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_TERMINAL_CONFIG }
    const parsed = JSON.parse(raw) as Partial<TerminalConfig>
    return {
      ...DEFAULT_TERMINAL_CONFIG,
      ...parsed,
      // Never trust persisted arrays to still be arrays (hand-edited storage, old shapes).
      extraCardModes: Array.isArray(parsed.extraCardModes) ? parsed.extraCardModes : [],
      excludedModes: Array.isArray(parsed.excludedModes) ? parsed.excludedModes : [],
    }
  } catch {
    return { ...DEFAULT_TERMINAL_CONFIG }
  }
}

export function saveTerminalConfig(cfg: TerminalConfig): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(cfg))
  } catch {
    /* storage unavailable — config stays at defaults for this session */
  }
}

const norm = (s: string) => String(s ?? "").trim().toLowerCase()

/**
 * Does this Mode of Payment go to the terminal?
 * Explicit exclusion beats explicit inclusion beats the heuristic — so a tenant can
 * always override us in either direction without a code change.
 */
export function routesToTerminal(mode: string, cfg: TerminalConfig): boolean {
  if (!cfg.enabled) return false
  const n = norm(mode)
  if (!n) return false
  if (cfg.excludedModes.some(m => norm(m) === n)) return false
  if (cfg.extraCardModes.some(m => norm(m) === n)) return true
  return isCardMode(mode)
}
