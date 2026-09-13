# Cashier remaining-issues pass — change map (2026-06-10)

Each fix → its location. Core flows and the offline layer untouched (no business-logic
changes; backend additions are read-only aggregation + an admin maintenance endpoint).
Verification: cashier offline e2e 4/4 · i18n probe 2/2 · unit 32/32 · storefront 91.

## Issue 1 — Sub-page localization
- `app/(erp)/cashier/{history,close,returns}/page.tsx`: every visible string through
  `t("cashier.*")` (64 new AR+EN keys), root `dir={dir}`, locale-aware dates; status
  chips/return reasons/reconciliation labels mapped via keys. `reports/page.tsx`
  rebuilt bilingual (see Issue 2). Receipt preview keeps its intentional dual-language
  fiscal labels; two Arabic-only strays fixed.
- **Probe**: `e2e/cashier-i18n.spec.ts` — EN mode renders ZERO Arabic on all four routes
  (master data excluded) + `dir=ltr`; AR mode shows Arabic labels + `dir=rtl`. 2/2.

## Issue 2 — Reports depth
- Backend `pos_cashier_api.get_summary`: additive read-only aggregation — payment_
  breakdown, hourly, top_items, returns_count, avg_basket, optional `to_date` range.
- `app/(erp)/cashier/reports/page.tsx`: 6 KPI cards (＋avg basket, returns count),
  sales-by-hour bar, payment bar/pie + detail table, top products; period filter
  (session / today / custom range); **CSV export** (BOM for Excel-Arabic) + thermal
  print; **offline fallback** computes the same shape from the local invoices store
  with a "local data" badge. RTL-aware chart axes.

## Issue 3 — Receipt printing (blank-preview fix)
- Root cause: `window.print()` + CSS that hid every direct `<body>` child except
  `#receipt-print-root` — but the receipt sits INSIDE a Radix Sheet portal, so the
  portal (and receipt) was hidden → blank, landscape default.
- `lib/cashier/print.ts`: self-contained document rendered into a hidden **iframe**,
  printed from the iframe. `@page { size: 58mm|80mm auto; margin: 2mm }` → portrait by
  construction; RTL/LTR per language; header/VAT/lines/totals/payments/change/invoice
  id/ZATCA QR (data-URL via `qrcode`); HTML-escaped data. Roll width persisted.
- Wired into: receipt sheet (`receipt-preview.tsx`, incl. auto-print), X-report dialog
  (was popup+document.write), reports print. **Test Print** + width selector in the
  diagnostics panel. Hardware guide: `docs/CASHIER_GO_LIVE_CHECKLIST.md` §A (driver /
  RawBT / QZ-Tray paths).
- Tests: `__tests__/cashier-print.test.ts` (6 — non-empty DOM, portrait constraint,
  RTL/LTR, QR, escaping) + e2e asserts the print iframe is non-empty and
  portrait-constrained before the dialog.

## Issue 4 — Header/icon labels everywhere
- All four sub-pages render the shared labeled `SessionHeader`. Swept remaining
  unlabeled icon buttons: returns-page ± qty buttons → 40px + aria-labels.

## Issue 5 — Pre-handover data hygiene
- Backend `pos_cashier_api.purge_test_data(dry_run=1)` — `_require_manager`; fixed
  allow-list scope (POS-E2E-SERVICE, AQAR-FEATURED-AD items, TEST-Advertiser customer,
  invoices by the e2e fixture user or made purely of test items). Dry run returns the
  exact plan; armed run deletes ONLY those invoices and **disables** (reversible)
  items/customers. UI in the diagnostics panel: dry-run list → confirmation-guarded
  purge. Verified live: dry run listed 10 invoices/2 items/1 customer, changed nothing.

## Issue 6 — Stock clarity
- Verified: stock sync works; the configured cashier warehouse («Nader Yasser - Van» —
  likely the WRONG default; it's a sales-rep van) has 1 Bin and zero positive qty;
  only 3 Stock Entries exist site-wide. "Out of stock everywhere" is missing opening
  stock + warehouse config — merchant action items in the go-live checklist §C.
  UI side (dim + badge + hide-filter) shipped in the UX round; diagnostics now shows
  a **sellable items** count.

## Issue 7 — Real-network validation
- `docs/CASHIER_GO_LIVE_CHECKLIST.md` §B: physical Wi-Fi-off script — cold offline
  boot, scanning/selling offline, sequential queue growth, tab-kill recovery, real
  reconnect draining to `ACC-PSINV-*` ids with a server-side count check, flap test.
  (Automated suites cover the programmatic equivalents.)
