# 2-Day Aggressive QA Sprint — Sales/Inventory Vertical

Scope: the sales admin dashboard (`/sales-reps?section=…`) + the rep PWA
(`/sales-rep/*`), backed by Frappe/ERPNext (`base_meena` + the erpnext fork).
This plan is written against the **real** modules and doctypes, not a template.

## Before you start — environment truths that WILL bite you

| Fact | Why it matters for testing |
|------|---------------------------|
| **qarawi** runs `allow_negative_stock = 1` site-wide | General stock can go negative; only the **van-scoped** guards stop van oversell. Test oversell on qarawi specifically — it's the weakest site. |
| **mandoob** had no global `lang` default (patched context needs `ar`) | SO/SI creation crashed in console/background contexts (`num2words`). Re-check any bulk/scripted document creation on mandoob. |
| The **demo rep** (`مندوب مينا التجريبي`) has **no login user** and **no assigned customers** | You cannot log into the PWA *as* the demo rep yet. Rep-side E2E needs a real rep account with `user_id` + customers. |
| Sales dates are **Gregorian, Western digits** (not Hijri `ar-SA`) | Date assertions: expect `dd/mm/yyyy` wrapped in an LRI…PDI isolate in RTL. |
| Wallet is a **shadow ledger** — no GL postings | Don't reconcile wallet balances against the accounting module; they're intentionally separate. |
| Stock only moves on **Delivery Note submit**, not SO or SI | "Order booked" ≠ "stock moved". Always verify the Bin, not just the order. |

Two sites, run every destructive case on **both** (mandoob = clean/strict,
qarawi = negative-stock/messy-data).

---

## DAY 1 — Core CRUD, Logic & Per-Module Correctness

Goal: every module creates/reads/updates/filters correctly in **ar and en**,
with validation firing. Single-user, no concurrency yet. Work top-to-bottom of
the nav; check off each module.

### Block 1 (morning) — People & Config
1. **Dashboard** (`?section=…` landing) — KPI "مناديب نشطون X/Y": confirm the
   count equals the Reps list length (they share `getSalesPersons`; the group
   "Sales Team" node must be excluded). Cross-check "زيارات اليوم" / "أوامر اليوم"
   against the Visits and Orders lists.
2. **Sales Reps** — create/edit; verify a rep with no linked Employee is scoped
   out under a company filter (known behavior). Van link (`inventory_warehouse`).
3. **Customers** — create with inline name validation (empty → red); classification
   badge (Potential/Active/Dead); filter by classification; CSV export.
4. **Customer Groups** — CRUD, tree parent integrity.

### Block 2 (midday) — Field Ops & Routes
5. **Today's Schedule / Field Visits** — check-in/out, visit_type translated
   labels, GPS capture optional (deny permission → still saves).
6. **Route Plans** — create a plan, add customers (checkbox affordance), reorder;
   **Route Maps** render pins; **Sales Rep Stops** — "Analyze" disabled until a
   rep is selected (hint shows).

### Block 3 (afternoon) — Operations & Insights (CRUD only; stress is Day 2)
7. **Inventory** — the New Inventory Record dialog for **all four** types:
   - Load: source picker excludes vans; van-destination chip shows; item auto-fills UOM/rate.
   - Unload / Transfer / Adjustment: correct source/target semantics per type.
8. **Inventory Requests** — rep creates a request (`/sales-rep/stock-requests`);
   admin sees it Pending (`?section=stock-requests`); accept full & partial.
9. **Delivery Notes / Payments / Wallets** — list, filter, open detail; wallet
   title matches the *live* linked rep (not a stale stored name).
10. **Reports** — default date range is chronological (from < to, 30-day window);
    Western digits; export.

**Day-1 exit criteria:** every module CRUD passes in ar + en; no console errors;
all validation messages appear and are translated.

---

## DAY 2 — Stress, Concurrency, Data Integrity & E2E

Goal: break it. Every case below has a **DB check** — the point is FE-vs-backend
state agreement, so never trust the toast alone; read the Bin / doctype.

### Block 1 (morning) — the money paths, end to end
- **Full rep sale E2E** (`/sales-rep/new-order` → `/invoice`): check-in → order →
  deliver → invoice → check-out. Verify **Bin decremented by exactly the order qty**,
  one SO + one DN + one SI, and the Customer Inventory Record advanced. Then repeat
  with an **over-stock order** and confirm it is **rejected at the DN**, the SO is
  rolled back (cancelled), the cart is preserved, and **the Bin is unchanged**.
- **Inventory Requests concurrency** — run the live layer of
  `inventory-requests-stress.spec.ts` (below). Exactly one accept wins.

### Block 2 (afternoon) — the destructive matrix
Run the module edge-cases in the next section. Budget the most time on
**Inventory Requests** and the **PWA invoice pipeline** — that's where the recent
catastrophic bugs lived.

### Block 3 — regression sweep
Re-run Day-1 CRUD on the site you *didn't* primarily use, plus `npm run test`
(jest) and the mocked Playwright layer. Log every FE-vs-DB mismatch as P1.

---

## Critical Edge Cases — High-Risk Modules

Legend: **[RACE]** concurrency · **[DUP]** double-submit · **[NEG]** negative/zero
· **[MISMATCH]** FE state ≠ backend.

### Inventory (Sales Rep Inventory)
- **[NEG]** qty = 0 / negative / `1e12` / non-numeric → rejected before submit; no doc created.
- **[MISMATCH]** Load with a source that never held the item → error names the
  **source** warehouse, not the van (the bug we fixed). Load from a source that
  *has* stock → Bin moves once.
- **[RACE]** Two Loads of the same item from the same source, near-simultaneous,
  totalling more than available → at most the available qty leaves; the second
  must fail the locked sufficiency check (submit twice fast from two tabs).
- **Transfer** must actually create a Stock Entry (old bug: silent no-op). Verify
  `stock_entry` is set and both Bins moved.
- **UOM**: load in a pack UOM → the Bin (stock UOM) decrements by qty×conversion,
  not raw qty.
- **Adjustment** into a never-stocked van → Bin auto-creates (upsert works).

### Inventory Requests (Stock Transfer Request) — CRUCIAL
- **[RACE]** N simultaneous **accepts** of one Pending request → exactly **one**
  Stock Entry, source deducted **once**. (Automated in the spec.)
- **[RACE]** accept vs reject at the same instant → one wins, the other gets
  "Only pending requests can be accepted/rejected"; status is never left half-set.
- **[NEG]** accepted_qty > requested, = 0, or negative → clamped/rejected; never a
  negative-qty Stock Entry.
- **[MISMATCH]** accept a request another admin already Completed → backend rejects,
  the dialog stays open with the reason, list refetch shows Completed.
- **[MISMATCH]** admin edits `from_warehouse` to an empty warehouse then accepts →
  insufficient-stock error, request stays Pending.
- Partial accept → status "Partially Accepted", only accepted qty moves.
- Batch/serial items: accept splits by (item, batch); wrong batch rejected.

### Payments
- **[DUP]** submit the same payment twice (double-click, or retry after a slow
  response) → one Payment Entry, not two; wallet/customer balance credited once.
- **[NEG]** amount = 0 / negative / more than outstanding → rejected or flagged
  as advance per policy; never a silent over-credit.
- **[MISMATCH]** payment succeeds backend-side but the response is lost (kill the
  network mid-request) → the UI must not show "failed" while the Payment Entry
  exists; on reload the payment is present exactly once.
- Currency/rounding: 2-dp SAR; no floating-point drift on the running balance.

### Route Planning
- **[NEG]** empty plan (no customers) → cannot submit; plan with a duplicate
  customer → deduped or flagged.
- **[MISMATCH]** two devices editing the same plan → last-write behavior is
  defined (Frappe `TimestampMismatchError` surfaces, not a silent overwrite).
- Reorder stops rapidly, then reload → persisted order matches the last saved state.
- A customer with no geo-coordinates → map degrades gracefully (no crash, no NaN pin).
- Analyze Stops with 0 stops / 1 stop → no divide-by-zero in averages.

---

## The Playwright Script

`e2e/inventory-requests-stress.spec.ts` (this folder) stress-tests Inventory
Requests in two layers:

1. **Mocked FE state machine** — single-flight accept (no double POST),
   insufficient-stock keeps the request Pending and shows the reason, and a
   state-mismatch surfaces the conflict. Currently marked `test.describe.fixme`:
   the auth gate is solved, but the admin dashboard also gates its first render
   on the module-visibility list, so these need one more mock (make the Sales
   module "allowed") before they render. Documented inline in the spec.
2. **Live backend concurrency** (opt-in): seeds a real Pending request, fires 6
   concurrent accepts, and asserts **exactly one** succeeds with a single Stock
   Entry — the only layer that actually proves the DB row lock. **This layer was
   run against both mandoob and qarawi on 2026-07-14: 1 winner / 5 rejected,
   source deducted exactly once, both self-cleaned.** (The equivalent barrier-
   synchronized harness for qarawi ran in bench console since it has no API key.)

```bash
# Layer 1 — deterministic, safe anywhere:
npx playwright test e2e/inventory-requests-stress.spec.ts

# Layer 2 — real race test against a site (admin session cookie required):
INV_LIVE=1 INV_BASE_URL=https://mandoob.base.meena.sa \
  INV_COOKIE="sid=<your admin sid from DevTools>" \
  npx playwright test e2e/inventory-requests-stress.spec.ts -g LIVE
```

Why a separate live layer: a Playwright test driving **mocked** APIs can prove the
UI never double-fires, but it has no database and no transaction, so it can never
prove two concurrent accepts don't both deduct stock. Only real parallel calls at
a real backend exercise the `FOR UPDATE` lock. Run Layer 2 against **qarawi** too
— that's the site where `allow_negative_stock=1` makes the guard the *only* thing
standing between you and phantom stock.
