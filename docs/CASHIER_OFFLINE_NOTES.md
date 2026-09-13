# Cashier offline-first hardening — change notes (2026-06-10)

Every change in this pass, with its location. Architecture respected throughout:
IndexedDB db **`cashier_pos`** (stores `catalog`, `customers`, `invoices`, `kv`, `queue`),
Service Worker + Cache API (now **`cashier-shell-v2`**), bilingual AR/EN with RTL/LTR.

## Offline guarantee

| Change | Where |
|---|---|
| **Full shell PRECACHE**: at SW install, fetch all 6 cashier routes, parse each HTML for its `/_next/static` assets (JS/CSS/`next/font` woff2), cache them + PWA icons/manifest. Cold offline open now works without a prior visit to each screen. Cache renamed `cashier-shell-v1` → `v2` (old cache auto-purged on activate). SW also answers a `cashier-shell-status` postMessage for diagnostics. | `public/cashier-sw.js` |
| **Never-blocking catalog reads**: the product grid renders the IndexedDB catalog cache *immediately* (browse, search, prices) and lets the network response replace it when it arrives (epoch-guarded so a slow cache read can't clobber a fast network result). Offline barcode auto-add unchanged. | `components/cashier/product-grid.tsx` (`loadItems`) |
| **Always-visible status**: the offline-reassurance banner and the "N transactions waiting to sync" banner moved from the checkout page into `SessionHeader`, so every cashier screen shows them. The status pill is a live 4-state badge (online / offline / pending(n) / needs-attention(n)). | `components/cashier/session-header.tsx`; removed from `app/(erp)/cashier/checkout/page.tsx` |
| **Per-item sync status**: queue items now carry `pending / syncing / synced / failed` (the transient `syncing` state is written to IndexedDB during an attempt; a crash mid-attempt is retried safely thanks to the idempotency key). Last successful sync time persists in `kv.last_sync_at`. | `lib/cashier/sync.ts` |

## Verification

| Change | Where |
|---|---|
| **e2e — full offline**: (a) `context.setOffline(true)` + reload → app boots from cache, grid renders from IndexedDB; (b)+(c) 3 sequential offline cash sales → queue increments exactly 1→2→3 with unique ids, LOCAL- receipts issued; (d) reconnect → queue drains in order, invoices reconcile to real `ACC-PSINV-*` server ids. Plus the existing: network-drop mid-sale (exact-once sync), reload-mid-payment restore, flap-storm no-duplicates. **4/4 passing.** | `e2e/cashier-offline.spec.ts` |
| **Unit tests** — payment math (overpay change, split cash+card, numpad no-lock rules) and queue logic (network-vs-server error classification, FIFO close blocking, id collision check). **26/26 passing.** | `__tests__/cashier-payment-math.test.ts`, `__tests__/cashier-sync-logic.test.ts` |
| **Diagnostics panel** (admin/store-manager only, Activity icon in the header): shell cached yes/no (live SW round-trip, routes cached x/6), catalog + customers cached counts, queued count, last successful sync, SW active/inactive, refresh button. | `components/cashier/diagnostics-dialog.tsx`; button wired in `session-header.tsx` |

## Fixes A–E

| # | Change | Where |
|---|---|---|
| A | All header icon-only buttons rebuilt data-driven with localized `aria-label` + `title` + Radix tooltips (shown on hover **and** keyboard focus; dark `bg-slate-900` tooltip = AA contrast). Language toggle + close-session also labeled. | `components/cashier/session-header.tsx` |
| B | Status pill opens the **sync-queue dialog**: per-item kind/amount/time/attempts/status badge/last error, manual **Sync now**, per-item retry, per-item delete (confirm-guarded), admin-only **Clear queue** (confirm-guarded) and **stale cleanup** (`cleanupStaleFailed`: failed ≥3 attempts and ≥7 days old). | `components/cashier/sync-queue-dialog.tsx`; helpers `clearQueue`/`cleanupStaleFailed`/`closeIsBlocked` in `lib/cashier/sync.ts` |
| C | Cash overpay + change: the amount prefill is **pristine** — the first keystroke replaces it (total 27.25, key "5","0" → 50, change 22.75 live); erasing no longer snaps back to the total (the prefill effect now runs only on mode switch). Split payment (cash+card) worked and is now covered by unit tests. Pure math extracted. | `lib/cashier/payment-math.ts`; `components/cashier/payment-panel.tsx` |
| D | Minus-to-zero (and trash) asks for confirmation; every removal shows an 8-second **Undo** bar that restores the exact line (qty + discount). | `components/cashier/cart.tsx` (+ `onRestore` prop passed from `checkout/page.tsx`) |
| E | Full i18n sweep of the main sale surface: header (incl. the previously hardcoded «جلسة»), banners, pill states, cart dialogs/undo, payment sheet, shortcut bar, toasts, queue + diagnostics dialogs — ~70 new `cashier.*` keys in both AR and EN. Currency formatting now follows the UI language (`setCashierLocale`: `ar-SA` ⇄ `en-US` digits). Verified by an automated probe: **zero Arabic leftovers in EN mode** on the checkout screen (item names / Mode-of-Payment names are DB master data, intentionally untranslated). | `lib/i18n.tsx`, `session-header.tsx`, `cart.tsx`, `payment-panel.tsx`, `checkout/page.tsx` |

## Known-partial / follow-ups

- Sub-pages (history, close, returns, reports) still contain their original Arabic-first copy — they predate this pass and were always Arabic-only; the main sale flow is now fully bilingual. Converting those four pages is mechanical follow-up work using the same `cashier.*` key pattern.
- Mode-of-Payment display names come from ERPNext master data (e.g. «بطاقة ائتمان») — translate them in the DB if bilingual method names are wanted.
- e2e fixtures (kept on qarawi): user `pos.e2e.cashier@test.local` (POS Cashier), non-stock item `POS-E2E-SERVICE` (barcode `9900112233445`). Suite skips when `E2E_CASHIER_PASSWORD` is unset.

## No-regression evidence

- Cashier offline e2e: 4/4 · unit: 26/26 · storefront suite: 91 passed (darkmode excluded as always-green elsewhere).
- Instant search / barcode / Hold-Resume / discounts / tax-after-discount / customer selection / persistence-after-reload all exercised by the suites above or unchanged code paths.
