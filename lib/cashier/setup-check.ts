/**
 * Pre-go-live setup detection — READ-ONLY. Flags the two known config blockers so the
 * diagnostics panel can guide the merchant; it never changes the warehouse or writes
 * stock. Pure + framework-free so the rules are unit-tested.
 */

export type SetupIssueCode = "van_warehouse" | "low_sellable" | "no_warehouse"

export interface SetupIssue {
  code: SetupIssueCode
  /** i18n key for the title (cashier.setup_<code>_title). */
  titleKey: string
  /** i18n key for the guidance body. */
  bodyKey: string
  severity: "warn" | "error"
}

export interface SetupInput {
  sellableCount: number
  catalogCount: number
  warehouse?: string | null
  /** Minimum sellable items before we warn (default 5). */
  threshold?: number
}

export interface SetupResult {
  ok: boolean
  issues: SetupIssue[]
}

/** Names that look like a mobile / sales-rep warehouse rather than a shop floor.
 *  Matched case-insensitively against the configured warehouse name (EN + AR). */
const VAN_HINTS = [
  "van", "vehicle", "car", "mobile", "rep", "sales rep", "sales-rep", "delivery",
  "مندوب", "سيارة", "عربة", "مركبة", "توصيل", "متنقل",
]

/** Detect a van/non-shop warehouse purely from its name. Exported for testing. */
export function looksLikeVanWarehouse(name?: string | null): boolean {
  if (!name) return false
  const n = name.toLowerCase()
  return VAN_HINTS.some(h => n.includes(h))
}

export function evaluateSetup(input: SetupInput): SetupResult {
  const threshold = input.threshold ?? 5
  const issues: SetupIssue[] = []

  if (!input.warehouse) {
    issues.push({
      code: "no_warehouse",
      titleKey: "cashier.setup_no_warehouse_title",
      bodyKey: "cashier.setup_no_warehouse_body",
      severity: "error",
    })
  } else if (looksLikeVanWarehouse(input.warehouse)) {
    issues.push({
      code: "van_warehouse",
      titleKey: "cashier.setup_van_title",
      bodyKey: "cashier.setup_van_body",
      severity: "error",
    })
  }

  // Only meaningful once a catalog is loaded; an empty catalog is a separate (offline)
  // condition the panel already surfaces.
  if (input.catalogCount > 0 && input.sellableCount < threshold) {
    issues.push({
      code: "low_sellable",
      titleKey: "cashier.setup_low_sellable_title",
      bodyKey: "cashier.setup_low_sellable_body",
      severity: "warn",
    })
  }

  return { ok: issues.length === 0, issues }
}
