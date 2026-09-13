# Accounting Module — Full-Discovery Audit

**Date:** 2026-04-16  
**Auditor:** GitHub Copilot (read-only discovery pass, no code edits)  
**Scope:** Everything under `lib/accounting-api.ts`, `lib/accounting-logic.ts`, `components/accounting/**`, `app/accounting/**`, `app/(dashboard)/accounting/**`, both test trees, plus the middleware that gates all routes.

---

## Executive Summary

The accounting module delivers a solid GnuCash-style register UI and a complete set of ERPNext API helpers. Core business logic (`accounting-logic.ts`) is well-tested and correct. However, three runtime bugs are serious enough to corrupt data or silently break features in production:

1. **`getAccountingPeriods` / `closePeriod` / `openPeriod` are completely broken.** `frappeClient.get()` returns a `{ data: T }` wrapper; all three functions access `doc?.closed_documents` on the wrapper instead of `doc.data?.closed_documents`. The child table is always `undefined`, so `closePeriod` and `openPeriod` send an empty array to Frappe — every period-closing write operation is a silent no-op. Confirmed by three TypeScript compile errors (`TS2339`).

2. **URL-space conflict between two route trees.** `app/accounting/*` and `app/(dashboard)/accounting/*` both resolve to the URL prefix `/accounting/*`. Next.js App Router route groups (`(dashboard)`) do not alter the URL path; having both trees present means some routes are silently overridden by whichever Next.js resolves first at build time.

3. **`today()` returns UTC date everywhere.** `new Date().toISOString().split('T')[0]` is UTC. In UTC+3 (Saudi Arabia), after 21:00 local time the function returns yesterday's date. This helper is used in 8 places across the API and two UI components, corrupting all default date fields in the late evening.

Additionally, four **HIGH** issues were confirmed by TypeScript type errors in `lib/accounting-api.ts` itself, a further **MEDIUM** double-filter bug silently swaps filter arrays in `getTotalReceivables`, and a systematic N+1 query pattern exists in `getVATSummary`.

All test suites pass (123 tests). `accounting-api.ts` achieves 92 % statement coverage but the five broken functions (`getCashFlowReport`, `getBankAccountSummaries`, `getAccountingPeriods`, `closePeriod`, `openPeriod`) are entirely uncovered. `accounting-logic.ts` achieves 100 % statement/line/function coverage.

**Recommended fix order:** 1 → 2 → 3 → 4 → 8 → 9 → the MEDIUM group.

---

## Module Map

| File | Lines | Role |
|---|---|---|
| `lib/accounting-api.ts` | 1 536 | Central API client — 48 async functions |
| `lib/accounting-logic.ts` | 108 | Pure business logic (JE balance, balance sheet equation) |
| `lib/__tests__/accounting-api.test.ts` | 1 166 | Primary test suite (107 tests) |
| `lib/__tests__/accounting-logic.test.ts` | 134 | Logic unit tests (9 tests) |
| `__tests__/accounting-logic.test.ts` | 63 | Duplicate logic test file (6 tests — overlaps above) |
| `components/accounting/accounting-layout-shell.tsx` | 253 | Shared sidebar + tab-switcher shell |
| `components/accounting/register-tab-bar.tsx` | 106 | Tab bar for open account registers |
| `components/accounting/account-register.tsx` | 608 | GnuCash-style account register |
| `components/accounting/inline-transaction-row.tsx` | 760 | Inline JE creation row inside the register |
| `app/accounting/layout.tsx` | 5 | Layout for bare `/accounting/*` route tree |
| `app/(dashboard)/accounting/layout.tsx` | 5 | Layout for `(dashboard)` route tree (same URLs) |
| `app/(dashboard)/accounting/page.tsx` | 866 | Accounting dashboard (KPIs, quick actions, recent JEs) |
| `app/accounting/journal-entries/page.tsx` | 341 | Journal entries list |
| `app/accounting/journal-entries/new/page.tsx` | 991 | New JE form |
| `app/accounting/chart-of-accounts/page.tsx` | 1 171 | Chart of accounts tree + inline editor |
| `app/(dashboard)/accounting/general-ledger/page.tsx` | 22 | GL page (server shell) |
| `app/(dashboard)/accounting/general-ledger/general-ledger-client.tsx` | 474 | GL list client component |
| `app/(dashboard)/accounting/trial-balance/page.tsx` | 482 | Trial balance |
| `app/(dashboard)/accounting/balance-sheet/page.tsx` | 559 | Balance sheet |
| `app/(dashboard)/accounting/pnl/page.tsx` | 552 | Profit & Loss |
| `app/(dashboard)/accounting/cash-flow/page.tsx` | 192 | Cash flow statement |
| `app/(dashboard)/accounting/ar-aging/page.tsx` | 195 | AR aging |
| `app/(dashboard)/accounting/ap-aging/page.tsx` | 161 | AP aging |
| `app/(dashboard)/accounting/vat/page.tsx` | 191 | VAT reconciliation |
| `app/(dashboard)/accounting/bank-reconciliation/page.tsx` | 174 | Bank reconciliation |
| `app/(dashboard)/accounting/period-closing/page.tsx` | 234 | Period closing |
| `middleware.ts` | (project-wide) | Cookie-based session guard; no role enforcement |

---

## Findings by Severity

### CRITICAL

---

#### CRIT-1 — `closePeriod` / `openPeriod` / `getAccountingPeriods`: `closed_documents` accessed on response wrapper, not document body

**Status: RESOLVED** — commit `d880054` (2026-04-16)  
Fix: access `doc.data?.closed_documents` at all three call sites. Six regression tests added (TDD red → green).

**Files:** `lib/accounting-api.ts` lines 1 469–1 498, 1 502–1 508, 1 512–1 518  
**tsc errors:** lines 1 488, 1 503, 1 513 (`TS2339: Property 'closed_documents' does not exist on type 'FrappeResponse<any>'`)

`frappeClient.get(doctype, name)` returns `FrappeResponse<T>` which is a `{ data: T }` wrapper. All three functions do:

```ts
const doc = await frappeClient.get('Accounting Period', periodName)
const closedDocs = (doc?.closed_documents ?? []).map(...)
```

`doc` here is `{ data: { ... } }`, not the document. `doc?.closed_documents` is always `undefined`, so `closedDocs` is always `[]`. `closePeriod` and `openPeriod` send `{ closed_documents: [] }` to Frappe — every call silently wipes or ignores the child table, making period closing a no-op. `getAccountingPeriods` returns every period with an empty `closed_documents` array.

**Correct access:** `doc.data?.closed_documents`

---

#### CRIT-2 — URL-space routing conflict: `app/accounting/*` vs `app/(dashboard)/accounting/*`

**Status: RESOLVED** — commit `644cbb7` (2026-04-16)  
Decision: `app/(dashboard)/accounting/` is canonical. Migrated `chart-of-accounts/`, `journal-entries/`, and `journal-entries/new/` pages into the `(dashboard)` tree. The bare `app/accounting/` tree (including empty `balance-sheet/`, `pnl/`, `trial-balance/` dirs) was deleted. Updated `__tests__/chart-of-accounts.test.tsx` import path. Build succeeds with all 14 `/accounting/*` routes from a single tree.

**Files:** `app/accounting/layout.tsx` lines 1–5, `app/(dashboard)/accounting/layout.tsx` lines 1–5; also `app/accounting/balance-sheet/`, `app/accounting/pnl/`, `app/accounting/trial-balance/` directories.

Next.js App Router route groups like `(dashboard)` are **not** part of the URL. Both route trees produce the same URL namespace (`/accounting`, `/accounting/journal-entries`, etc.). When two files resolve to the same URL, Next.js may throw a build-time conflict error or silently pick one winner. Stale pages in the bare `app/accounting/` tree (e.g. `balance-sheet`, `pnl`, `trial-balance`) shadow or conflict with their counterparts in `(dashboard)`.

The two layout files have different function names (`AccountingLayout` vs `DashboardAccountingLayout`) but identical bodies — they both wrap children in `<AccountingLayoutShell>`. This suggests the bare tree was an earlier draft that was never removed.

---

### HIGH

---

#### HIGH-1 — `today()` returns UTC date; affects all default date inputs in UTC+3

**Status: RESOLVED** — commit `be13fbb` (2026-04-16)

**Files:**  
- `lib/accounting-api.ts` line 67 (module-level `today()`)  
- `app/accounting/journal-entries/new/page.tsx` line 213 (local `today()` clone)  
- `components/accounting/account-register.tsx` line 225 (inline `new Date().toISOString().split('T')[0]`)  
- `components/accounting/inline-transaction-row.tsx` line 155 (useState initializer)

All four occurrences use `new Date().toISOString().split('T')[0]`. `toISOString()` is always UTC. In Saudi Arabia (UTC+3) after 21:00 local time, the function returns the previous calendar date. This means:

- New journal entries default to yesterday's date.
- `getTotalReceivables`, `getARAgingReport`, `getAPAgingReport`, and `getDashboard` pass yesterday's date as `report_date` / `to_date`.
- The opening-balance calculation in `AccountRegister` uses yesterday's date to seed the running balance column.

---

#### HIGH-2 — `InlineTransactionRow.handleSave`: typed `account` field missing on line objects passed to `createJournalEntry`

**Status: RESOLVED** — commit `be13fbb` (2026-04-16, co-committed with HIGH-1)

**File:** `components/accounting/inline-transaction-row.tsx` lines 393–428  
**tsc errors:** lines 429,28 and 429,41 (`TS2741: Property 'account' is missing in type 'Record<string, any>'`)

`currentLine` and `transferLine` are declared as `Record<string, any>`. They are then conditionally populated with `account`, `debit_in_account_currency`, etc. TypeScript reports that the required `account` field is missing at the call-site type. At runtime this works today because `account` is always written before the call, but the type hole means future refactors can break this silently.

---

#### HIGH-3 — `createPaymentEntry`: `party_type` typed as `string`, breaks union contract

**Status: RESOLVED** — commit `0738e91` (2026-04-16)

**File:** `lib/accounting-api.ts` line 885  
**tsc error:** `TS2345: Argument of type '{ ... party_type: string ... }' is not assignable to parameter of type 'Partial<PaymentEntry>'. Types of property 'party_type' are incompatible. Type 'string' is not assignable to type '"Employee" | "Customer" | "Supplier" | ...`

The `PaymentEntryData` input interface declares `party_type: string`, but `PaymentEntry` (used as the PUT body) declares `party_type` as a union literal. The mismatch is caught at compile time but not caught at runtime. Passing an invalid string (e.g. `"Partner"`) will fail in Frappe but give no TypeScript warning at the call-site.

---

#### HIGH-4 — `getAccounts`: `account_type` string-to-AccountType assignment error

**Status: RESOLVED** — commit `80e383c` (2026-04-16)

**File:** `lib/accounting-api.ts` line 464  
**tsc error:** `TS2322: Type 'string | undefined' is not assignable to type 'AccountType | undefined'`

The `Account` interface declares `account_type?: AccountType` where `AccountType` is a string union. The raw Frappe API returns strings; assigning them to the typed field fails the compiler check. Callers that branch on `account_type` values (e.g. `InlineTransactionRow`'s `STOCK_ACCOUNT_TYPES.has(accountType)`) receive an un-narrowed string at runtime, which is correct, but `ACCOUNT_TYPE_TO_PARTY` lookups in `new/page.tsx` would silently miss if Frappe ever returns a casing variant.

---

#### HIGH-5 — `getAccounts` filter tuple: 2-element tuple used where 4-element FrappeFilter is required

**Status: RESOLVED** — commit `85a795a` (2026-04-16)

**File:** `lib/accounting-api.ts` line 507  
**tsc error:** `TS2322: Type '[string, string]' is not assignable to type 'string | number | boolean'`

A filter is built as a 2-tuple `['Account', 'company']` instead of the required 4-tuple `['Account', 'field', 'operator', 'value']`. TypeScript flags it; at runtime Frappe silently ignores malformed filters, so the company filter may be dropped.

---

#### HIGH-6 — `getBankAccountSummaries`: type predicate and `.value` access broken

**Status: RESOLVED** — commit `e641ce7` (2026-04-16)

**File:** `lib/accounting-api.ts` lines 1 453–1 463  
**tsc errors:** lines 1 461, 1 462

The `.filter((r): r is PromiseFulfilledResult<BankStatement> => r.status === 'fulfilled')` predicate fails because `BankStatement.balance_as_per_books` is `number | undefined` (from the interface) but the predicate asserts it as `number`. Separately, `.map(r => r.value)` is called on the type `PromiseSettledResult<...>` after narrowing fails, so TypeScript cannot confirm `.value` exists. The function compiles under `tsc --noEmit` only because TypeScript allows the invalid predicate with a warning, not an error in all modes.

---

### MEDIUM

---

#### MED-1 — `getTotalReceivables`: double-filter clobbers company and docstatus filters

**Status: RESOLVED** — commit `28456b0`

---

#### MED-2 — `fiscalYearStart()`: hardcoded to Jan 1, ignores ERPNext fiscal year configuration

**Status: RESOLVED** — commit `a684539`

---

#### MED-3 — `getVATSummary`: N+1 GL queries — one `frappeClient.getList` call per VAT account

**Status: RESOLVED** — commit `c46b364`

---

#### MED-4 — `getGeneralLedgerReport`: account filter encoded as JSON array string

**Status: RESOLVED** — commit `ddac19f`

---

#### MED-5 — `getARAgingReport` / `getAPAgingReport`: return `any[]` cast as `AgingRow[]` with no runtime validation

**Status: RESOLVED** — commit `e594237`

---

#### MED-6 — Duplicate test file for `accounting-logic`

**Status: RESOLVED** — commit `8bb8895`

---

#### MED-7 — `PartyCombobox` in `new/page.tsx`: filters cast as `any`

**Status: RESOLVED** — commit `c0ba949`

---

### LOW

---

#### LOW-1 — `cancelJournalEntry`, `cancelSalesInvoice`, `cancelPaymentEntry` return `{} as T` type lies

**File:** `lib/accounting-api.ts` (cancel functions)

When `frappeClient.call` returns an empty or falsy response, these functions return `{} as JournalEntry` (or the corresponding type). Callers that destructure the returned value (e.g. `const { name } = await cancelJournalEntry(id)`) will get `undefined` for every field with no compile-time or runtime warning.

---

#### LOW-2 — `getMultipleBalances`: `debit`, `credit`, `currency` always return stub values

**File:** `lib/accounting-api.ts` (getMultipleBalances)

The returned objects always contain `{ debit: 0, credit: 0, currency: '' }`. These fields are declared on the `AccountBalance` interface but are never populated from the API. Any UI or logic that reads `.debit` or `.credit` from the result will silently get `0`.

---

#### LOW-3 — `createAccount`: always sends `is_group: 0` when caller omits the field

**File:** `lib/accounting-api.ts` (createAccount)

```ts
is_group: data.is_group ? 1 : 0
```

When `data.is_group` is `undefined`, this sends `is_group: 0` (ledger account). A caller intending to let Frappe use the default for group accounts cannot do so; they must explicitly pass `is_group: true`.

---

#### LOW-4 — `today()` and `fiscalYearStart()` duplicated in page component

**File:** `app/accounting/journal-entries/new/page.tsx` line 213

```ts
const today = () => new Date().toISOString().split('T')[0]
```

This is a module-local copy of the same function defined in `lib/accounting-api.ts`. It shares the same UTC bug (HIGH-1) and is not imported from the shared helper, so fixing `accounting-api.ts` would not fix this page.

---

#### LOW-5 — No upper-bound guard on `getGLEntries` page size

**File:** `lib/accounting-api.ts` (getGLEntries)

`limit_page_length` defaults to `500` but callers can pass any value. `AccountRegister` passes `2 000`. Frappe itself may cap responses at 500 items unless `limit_page_length` is explicitly set, but there is no maximum guard in the helper. A stale or incorrect value can cause partial register views with no warning.

---

### INFO

---

#### INFO-1 — No `AbortController` on any API call

**File:** `lib/accounting-api.ts` (all 48 functions)

None of the 48 functions accept or use an `AbortSignal`. Components that unmount mid-fetch (e.g. the dashboard navigating away while KPIs are loading) will attempt state updates on unmounted components. React 18 suppresses the warning but the fetch still completes, wasting bandwidth.

---

#### INFO-2 — No retry logic on any mutation

**File:** `lib/accounting-api.ts` (createJournalEntry, submitJournalEntry, createPaymentEntry, etc.)

All mutation helpers are fire-once. A transient Frappe 500 or network timeout will silently fail with no retry. For accounting operations (submit, cancel, period-close), this means the user sees an error toast and must manually retry, risking duplicate creation if they click twice.

---

#### INFO-3 — No idempotency keys on JE / Payment Entry creation

**File:** `lib/accounting-api.ts` (createJournalEntry, createPaymentEntry, createSalesInvoice)

Double submission (network retry or user double-click) will create duplicate documents in ERPNext. The UI disables the submit button during `saving` state, but network retries have no guard.

---

#### INFO-4 — Missing CRUD operations: no createSalesInvoice, no getPurchaseInvoice, no updateJournalEntry

**File:** `lib/accounting-api.ts`

The API surface is asymmetric. There is `getSalesInvoices` but no `createSalesInvoice`. There is `createJournalEntry` but no `updateJournalEntry`. There is no `getPurchaseInvoice` (single-document fetch). Dashboard pages that would benefit from these operations currently either navigate to ERPNext directly or are missing features.

---

#### INFO-5 — `submit*` helpers fetch the full document then re-POST it

**File:** `lib/accounting-api.ts` (submitJournalEntry, submitSalesInvoice, submitPaymentEntry)

Each submit helper calls `frappeClient.get(doctype, name)` to get the full document, then sends the entire document (including all child table rows) via `frappe.client.submit`. For journal entries with many lines this is a large payload. Frappe's submit API only requires the document name in most versions — the full-document approach is safe but wasteful.

---

#### INFO-6 — `AuthContext` not used in the accounting dashboard page

**File:** `app/(dashboard)/accounting/page.tsx` lines 6, 9

`useAuth` is imported but the dashboard page does not check authentication state or redirect on auth failure — it relies entirely on the middleware. This is correct (middleware handles auth), but the unused import adds dead code.

---

#### INFO-7 — `account_register.tsx`: `STOCK_ACCOUNT_TYPES` set re-created on every render

**File:** `components/accounting/account-register.tsx` lines 220–221

```ts
const STOCK_ACCOUNT_TYPES = new Set(['Stock', 'Stock Received But Not Billed', 'Stock Adjustment'])
```

This `Set` is created inside the component function body, so it is re-created on every render. It should be a module-level constant (as it is correctly done in `inline-transaction-row.tsx`).

---

#### INFO-8 — `middleware.ts`: no role-based enforcement for accounting routes

**File:** `middleware.ts`

The middleware validates session cookies (`sid`, `user_id`) and checks company existence but does not enforce any role. Any authenticated user can access `/accounting/*` regardless of ERPNext roles (e.g. "Accounts Manager", "Accounts User"). Role enforcement must be implemented either at the middleware level or inside each page.

---

## Test Suite Health

| Suite | Tests | Pass | Coverage (stmt) |
|---|---|---|---|
| `lib/__tests__/accounting-api.test.ts` | 107 | 107 ✓ | 92.3 % of `accounting-api.ts` |
| `lib/__tests__/accounting-logic.test.ts` | 9 | 9 ✓ | 100 % of `accounting-logic.ts` |
| `__tests__/accounting-logic.test.ts` | 6 | 6 ✓ | (duplicates above) |
| **Total** | **123** | **123 ✓** | — |

### Uncovered lines in `accounting-api.ts`

| Lines | Functions |
|---|---|
| 1 241–1 242 | `getDashboard` — YTD error-catch branch |
| 1 388–1 448 | `getCashFlowReport` — entire function |
| 1 453–1 463 | `getBankAccountSummaries` — entire function |
| 1 469–1 498 | `getAccountingPeriods` — entire function |
| 1 502–1 508 | `closePeriod` — entire function |
| 1 512–1 518 | `openPeriod` — entire function |

The five fully uncovered functions are precisely the ones with the most severe bugs (CRIT-1, HIGH-6). Adding tests for them would expose the `closed_documents` bug immediately.

### Uncovered branches in `accounting-logic.ts`

Lines 45, 79 — both are defensive `Number.isFinite` fallback branches in `toAmount` and `validateJournalEntryLines`. These represent the `Infinity` / `-Infinity` inputs which are not tested. No functional impact; trivial to cover.

---

## TypeScript Compile Errors (accounting module only)

Run via `npx tsc --noEmit` in `hr-management-system-ui/`:

| File | Line | Code | Description |
|---|---|---|---|
| `components/accounting/inline-transaction-row.tsx` | 429 | TS2741 | `account` required field missing on `Record<string, any>` line objects (×2) |
| `lib/accounting-api.ts` | 464 | TS2322 | `account_type: string` not assignable to `AccountType` |
| `lib/accounting-api.ts` | 507 | TS2322 | `[string, string]` filter tuple — missing doctype and value elements |
| `lib/accounting-api.ts` | 885 | TS2345 | `party_type: string` not assignable to `"Customer" \| "Supplier" \| ...` |
| `lib/accounting-api.ts` | 1 461 | TS2677 | Type predicate `PromiseFulfilledResult<BankStatement>` not assignable to settled result parameter |
| `lib/accounting-api.ts` | 1 462 | TS2339 | `.value` does not exist on `PromiseSettledResult` |
| `lib/accounting-api.ts` | 1 488 | TS2339 | `closed_documents` does not exist on `FrappeResponse<any>` |
| `lib/accounting-api.ts` | 1 503 | TS2339 | `closed_documents` does not exist on `FrappeResponse<any>` |
| `lib/accounting-api.ts` | 1 513 | TS2339 | `closed_documents` does not exist on `FrappeResponse<any>` |

(Other tsc errors in the workspace are outside the accounting module and are not listed here.)

---

## Remediation Order

| Priority | Finding | Effort |
|---|---|---|
| 1 | **CRIT-1** Fix `getAccountingPeriods` / `closePeriod` / `openPeriod` to access `doc.data?.closed_documents` | XS |
| 2 | **CRIT-2** Remove or merge the bare `app/accounting/*` route tree into `app/(dashboard)/accounting/*` | S |
| 3 | **HIGH-1** Replace `new Date().toISOString().split('T')[0]` with a timezone-aware helper in 4 files | XS |
| 4 | **HIGH-2** Declare `currentLine` / `transferLine` as typed objects, not `Record<string, any>` | XS |
| 5 | **HIGH-3 / HIGH-4 / HIGH-5** Fix accounting-api.ts compile errors at lines 464, 507, 885 | S |
| 6 | **HIGH-6** Fix `getBankAccountSummaries` type predicate and `.value` access | XS |
| 7 | **MED-1** Audit `getTotalReceivables` / `getTotalPayables` filter spread | S |
| 8 | **MED-2** Fetch actual fiscal year start from ERPNext `Fiscal Year` doctype | M |
| 9 | **MED-3** Replace N+1 VAT GL queries with a single `account in [...]` filter | S |
| 10 | **MED-4** Fix `getGeneralLedgerReport` account filter encoding (remove `JSON.stringify`) | XS |
| 11 | **MED-6** Remove duplicate `__tests__/accounting-logic.test.ts` | XS |
| 12 | **MED-7** Fix `PartyCombobox` filter tuple to include doctype name; remove `as any` | XS |
| 13 | **LOW-1–5** Polish items (cancel type lies, stubs, duplicate `today()`, `is_group`) | S |
| 14 | **INFO-1** Add `AbortController` support to high-frequency fetch calls | M |
| 15 | **INFO-7** Move `STOCK_ACCOUNT_TYPES` to module scope in `account-register.tsx` | XS |
| 16 | **INFO-8** Add role-based middleware check for `/accounting/*` routes | M |

**Effort key:** XS < 30 min · S < 2 h · M < 1 day

---

*This report was produced by a read-only discovery pass. No source files were modified.*
