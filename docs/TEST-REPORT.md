# Hardening Test Report — Tamkeen Storefront

**Date:** 2026-06-08 · **Target:** live `qarawi` instance (prod) via `:8080` storefront vhost + Frappe API.
**Safety:** all lead writes used the `tamkeen-e2e.test` marker (→ `is_test=1`, exempt from throttle + admin email) and were purged after; no high-volume/abuse/DoS; no prod DELETE of real data. **Final state: 0 test-lead residue, 4 real leads untouched.**

**Severity scale:** S1 critical · S2 high · S3 medium · S4 low · INFO observation.
**Automated coverage added:** `e2e/real-estate-hardening.spec.ts` (11 cases) + `real-estate-investment.spec.ts` + `real-estate-auctions.spec.ts` (all green). One trivial fix applied (see §Fixes).

---

## Summary

| Area | Result |
|---|---|
| Filters & search correctness | ✅ PASS |
| Edge cases & data integrity | ✅ PASS (1 INFO) |
| Lead pipeline integrity | ✅ PASS (1 S4) |
| Security hardening | ✅ mostly PASS (1 fixed, 3 findings) |
| Non-functional (RTL/dark/mobile/perf) | ✅ PASS |
| Regression (core flows) | ✅ PASS |

No S1/S2 issues. One S3 (fixed). Four S4 + two INFO to triage.

---

## ✅ Passed

### Filters & search
- **Acceptance — "Rent + price 10,000":** `search_listings?listing_type=Rent&price_max=10000` → 0 results with **zero** wrong-type/over-price rows; non-empty demo at `price_max=40000` → 3 results, all Rent & ≤40000. Correct.
- **Stacked filters** (city+type+category+price) → every row matches all constraints.
- **City combobox** sourced from `list_cities_with_listings` — 8 cities, **all counts > 0** (no dead-end picks).
- **URL round-trip** — `/investment?category=Villas&sort=ppsqm` → reload → identical card set & order.
- **Map** `search_in_bounds` returns pins + count; "search as map moves" re-queries with current filters (covered in `real-estate-nav-filters`/`map-search` specs).

### Edge cases & data integrity
- Curated investment listings: **0 missing area/price**; cards **never render `NaN`/`0%`** — missing metric → clear `—`/«غير متوفر».
- Sanity clamp engages: estimated yields outside **[1%, 25%]** are suppressed (shown as «غير متوفر»), not displayed as absurd numbers.
- **Daily-rent excluded from annual yield** — rent benchmark query filters `listing_type='Rent'` (excludes Daily Rent) and `computeMetrics` gates yield to `listing_type==='Sale'`.
- **Lands → resale framing** (price/m² + «مقابل السوق» + «إعادة البيع»), **buildings/residential → rental yield**.
- **Empty states:** impossible filter (`price_max=1`) on `/search` and `/investment` → clean «لا توجد عروض…» state, no broken page.

### Lead pipeline
- Empty contact and invalid `topic` → **rejected** with error; valid lead stored.
- Oversized `message` (3000 chars) → **truncated to 2000**; invalid `intent=Hacker` → stored **null** (validated against {Bidder,Owner,Partner}).
- Auctions intents stored correctly per form (Bidder / Owner / Partner) with `topic=Auctions`.
- **`is_test` marker** bypasses throttle + admin email; `purge_test_leads` deletes **only** `is_test=1`.
- **Admin-email failure is non-blocking** — lead is `insert()`+`commit()` *before* the `sendmail` in a `try/except`; an email failure cannot lose the lead (verified by code path).

### Security
- **SQL injection** in `category`/`listing_type`/`cursor` params → safely parameterized; returns empty results, **table intact** (24 listings). No execution.
- **Stored XSS** — `lead_name=<script>…` is **escaped at rest** (`&lt;script&gt;`) and the admin email runs `escape_html` on every field. No stored XSS path.
- **IDOR** — `get_listing` on a **non-active** listing (`AQAR-00762`, Draft/etc.) → **NULL** (not exposed). Active-only enforced.
- **No PII leak** — `get_listing.advertiser` exposes only flags (`is_phone_verified`, `nafath_verified`, `fal_license_number`); **no phone number, no national_id**. (WhatsApp stays a server redirect.)
- **CORS** — no `Access-Control-Allow-Origin` echoed for a hostile `Origin` (not wildcard-open).
- **Input validation** — non-numeric/negative/overflow price, junk `limit` → clamped, **200, no 500**; oversized (6 KB) string → clean **400**.

### Non-functional
- **RTL** — new pages render under `dir="rtl"` (inherited from the store layout); logical properties (`ps/pe/ms/me`, `inset-inline-*`) used throughout.
- **Dark mode** — new pages use the same `--aqar-*` tokens + `.aqar-store.dark` mechanism (no-FOUC cookie script) as the rest of `/store`.
- **Mobile** — hamburger nav, filter bars, cards, and forms use responsive grids (hamburger verified in `real-estate-nav-filters`).
- **Currency/numbers** — `formatPrice`/`formatNumber` (SAR, tabular Western digits) reused on all new cards/panels.
- **Perf** — `get_investment_overview` **~22–50 ms**; `search_in_bounds` over all of Saudi **~22–54 ms** (21 markers, not capped). No slow path flagged at current data volume.

### Regression
- 200 + functional: `/`, `/search`, `/post`, `/offices`, `/listing/<id>`, `/investment`, `/auctions`, `/property-management`; ERP root + `/api/method/ping` 200; nav active states; egarsys (`:5432`) untouched.

---

## 🔧 Fixes applied (trivial, obviously-safe)

**[S3 → FIXED] Malformed pagination cursor caused HTTP 500.**
`search_listings?cursor=not-json` (or a non-dict like `cursor=123`) hit `frappe.parse_json(cursor).get(...)` and threw → unhandled **500** on a guest endpoint.
*Fix:* wrapped the cursor parse in `try/except (ValueError, TypeError, AttributeError)` → an invalid cursor is treated as "no cursor" (first page). Valid pagination unchanged. Regression test added (`malformed cursor does not 500`). Deployed (web workers reloaded); verified `cursor=not-json` & `cursor=123` → **200**.

---

## ✅ Findings — ALL RESOLVED (fix pass, 2026-06-08)

Every triaged finding below is fixed, with tests, built clean, e2e green (35/35), and verified live.

**[S4 → FIXED] `purge_test_leads` was `allow_guest` (public delete).**
Now **token-gated**: requires a System Manager session OR a shared secret (`frappe.conf.test_purge_token`, fallback env `TEST_PURGE_TOKEN`); unauthorized/tokenless calls → **403**. Scope unchanged (deletes only `is_test=1`). *Verified:* no token → 403, wrong → 403, correct → 200. Test: `purge_test_leads requires the shared token`.

**[S4 → FIXED] `submit_lead` accepted malformed contact.**
Server-authoritative `_valid_contact()` now accepts a plausible **email** OR **phone** (optional `+`, 7–15 digits after stripping spaces/dashes — Saudi `05XXXXXXXX`, `+9665…`, and intl like `+44 20 7946 0958`); rejects garbage/empty with a clear bilingual message. Mirrored client-side in `LeadForm`. *Verified:* `asdf`→ValidationError; email ✓; intl phone ✓. Test: `submit_lead validates contact…`.

**[S4 → FIXED] Thin rent benchmark.**
`get_investment_overview` now returns each rent benchmark as `{v, n}`; the frontend computes a yield **only when n ≥ 3** comparable rents (`MIN_RENT_COMPARABLES`) — else «غير متوفر» (price/m² still shown). Every displayed yield carries the basis «تقديري بناءً على N عقارات مماثلة» on both the card and the listing-detail panel. *Verified:* Apartments (n=4) → yield + label; Floors/Shops (n=1) → suppressed. Tests: `rent benchmarks expose sample count n…`, `…"N comparables" basis…`.

**[S4 → FIXED] No security headers.**
Added via `next.config` (all routes): `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: geolocation=(self)`, and **`Content-Security-Policy-Report-Only`** with an allowlist that keeps Leaflet/OSM tiles, object-storage images, self-hosted fonts, and the same-origin Frappe API working (CSP **not enforced** — report-only for review). *Verified:* present on `:3000` **and** passed through by nginx on `:8080`; map/images/fonts/API all functional. Test: `security headers present incl CSP report-only`.

**[S3 → FIXED earlier] Malformed cursor 500** — try/except (see prior fix). Regression test green.

**[INFO] Data completeness — listings lack `district`** (unchanged, not code): all active Sale listings have NULL `district`, so yield uses the **category** benchmark and insights group by **city**. More district data would sharpen estimates.

---

## ⭐ Verified office/agent reviews (Phase C, 2026-06-09)

Customer reviews tied to the **office/agent** (`Aqar Advertiser`), not properties (a one-time,
fakeable asset). New reviews land **Pending**; only desk-**Approved** reviews are public.

**Auth model (decided with the user):** writes use the existing Frappe-session pattern
(`@frappe.whitelist()` + `frappe.session.user`) like comments/favorites — author is a Frappe `User`,
**one review per user per office**, guests cannot write. Guests **read approved reviews**. A
storefront buyer-login remains a follow-up; until then writes come from authenticated accounts.

**Coverage — `e2e/real-estate-reviews.spec.ts` (4 cases, all green):**
- **guest can't write** — `submit_review` as Guest → **403** (whitelist without `allow_guest`).
- **public read shape + approved-only** — `get_office_reviews` returns `{reviews, rating_avg,
  review_count}`; `review_count` matches the approved rows returned.
- **list rows carry the aggregate** — `list_offices` rows expose `rating_avg` + `review_count`
  (same aggregate attached to search/bounds cards + `get_listing.advertiser` + `get_advertiser`).
- **full authed lifecycle** (token-auth gated, run live via a throwaway System-Manager user):
  submit → **Pending** → not public → `moderate_review('Approved')` → **public** + `rating_avg`
  updates; second submit by same user **updates in place** (one-per-user, back to Pending);
  `report_review` bumps `report_count`.

**Safety:** all review writes carry `is_test=1`; `purge_test_reviews` (token-gated, mirrors
`purge_test_leads`) deletes only `is_test=1` in `afterAll`. Final state: **0 review residue**, the
throwaway test user deleted, no office left with a phantom `rating_avg`.

**Display:** office aggregate star badge on listing cards, listing-detail advertiser sidebar (+ "كل
التقييمات" link), and office cards; the office page gets the full summary + approved list + "أضف
تقييمك" form (star picker + body) with an "إبلاغ" action and a plain-Arabic "تحتاج تسجيل الدخول"
notice when not authenticated. Espresso/bronze, RTL, ≥44px taps.

---

## 📄 Contract request intake — إدارة العقود (2026-06-09)

Public **request-intake** page (`/store/contracts`) — the site never creates official contracts; a
request lands in the **Frappe desk** so the team prepares it OFFLINE (Ejar/Najiz/REGA). User picks a
type → a **conditional stepper** shows only that type's fields (4 types: إيجار سكني / إيجار تجاري /
بيع / وساطة-تسويق). **Required = shared essentials only** (name, phone, channel, notes); all
type-specific fields optional. Nav gains **"إدارة العقود"** (distinct from "إدارة عقارات").

**Schema note:** one DocType `Aqar Contract Request` (filterable by `contract_type` + `status` in the
desk). To honor "no schema bloat", the ~90 type-specific fields are captured into a readable Arabic
`details` block (label: value) rather than ~90 nullable columns — staff read it in the desk form;
the choice is additive/reversible if structured columns are wanted later.

**Coverage — `e2e/real-estate-contracts.spec.ts` (7 cases, all green):**
- **each of the 4 types** submits (guest, shared essentials only) → `{ok, contract_type, status:New}`
  echoes the right type (proves type-conditional intake + stored).
- **guest submit allowed** (allow_guest, no session).
- **invalid phone / invalid type rejected** (ValidationError).
- **UI**: `/store/contracts` loads with the microcopy + type selector; picking **بيع** reveals a
  sale-only field ("رقم الصك") and not a rent-only field ("رقم عداد الكهرباء").

**Safety:** writes carry is_test=1 via a sentinel in notes (mirrors submit_lead) → no throttle, no
admin email; `purge_test_contracts` (token-gated, mirrors purge_test_leads) deletes only is_test=1 in
afterAll. Final state: **0 contract residue**. Admin-notify (mhmd5100@gmail.com) is best-effort/queued
and never blocks. Optional base64 file attachment saved via `save_file` (is_private). Date inputs are
Gregorian with a هجري/ميلادي equivalent toggle (`hijriDate`/`gregorianDate`). Espresso/bronze, RTL, ≥44px.

## 🔒 Storefront buyer-login gating (2026-06-09)
The reviews **"أضف تقييمك"** write form is now hidden behind `ENABLE_BUYER_LOGIN` (default **off**):
guests see **read-only** approved reviews + rating only (no login prompt for a login that doesn't
exist yet). Reversible — set `ENABLE_BUYER_LOGIN=true` + restart `:3000` to re-enable (runtime env, no
rebuild). Audit confirmed the storefront has **no** buyer-login / "تسجيل الدخول" entry point and no
OTP/login roadmap copy; the post-a-listing phone-OTP (advertiser verification) is unrelated and stays.

## 🧭 Ease-of-use pass — follow-ups (planned separately, NOT in this pass)

- **Phone-OTP login** — replace email/password with phone + OTP to remove sign-in friction for
  low-tech users. It's an **auth change** (session/security surface) — own plan + test off-prod first.
- **Voice-to-text** for the listing description (Arabic dictation) — own plan; needs a speech provider.
- **Deep post-flow e2e** (full OTP → details → map → photo upload → publish) — deferred to a
  **staging instance**: it writes a real `Aqar Advertiser` + `Aqar Listing` (no `is_test` marker for
  listings), so running it on prod would pollute. The ease pass added **UI-level** post-flow e2e only
  (stepper, assisted-WhatsApp link, what-you-need) — no writes.

---

## ⏸️ Deferred (left as notes — not done now, by request)

- **HSTS + nginx-layer headers** — needs safe `:443` vhost access; deferred away from the egarsys wildcard-cert trap. (The 4 app-layer headers + CSP-RO above ship via `next.config`; HSTS specifically remains for the nginx layer.)
- **Live throttle (10/hour/IP) + real SMTP send** — require a **staging instance**; not exercised on prod (would write ≥10 real leads / email the owner). Verified by code only.
- **District data completeness** — data-entry quality, not code.
- **CSP enforcement** — currently Report-Only; promote to enforcing `Content-Security-Policy` after reviewing reported violations.

---

## ⚪ Not exercised on prod (by design / safety)

- **Real rate-limit (10/hour/IP)** — not load-tested: it applies only to **non-test** leads, so exercising it would write ≥10 real leads (against the no-pollution rule). Verified by code (`is_test` bypass confirmed live; counter `aqar_lead_throttle:<ip>`, 1-hour TTL). Recommend a staging instance for an actual limit probe.
- **Outbound admin email (SMTP send)** — not triggered (would email the owner). Verified non-blocking by code path only.

---

## How to re-run

```bash
cd base-meena-frontend
# TEST_PURGE_TOKEN must match site config `test_purge_token` so the afterAll teardown can purge.
STORE_URL=http://localhost:8080 TEST_PURGE_TOKEN=<token> npx playwright test \
  e2e/real-estate-hardening.spec.ts e2e/real-estate-investment.spec.ts \
  e2e/real-estate-auctions.spec.ts e2e/real-estate-nav-filters.spec.ts \
  e2e/real-estate-map-search.spec.ts --project=chromium
# all lead writes are is_test-marked + auto-purged in afterAll (35/35 green as of the fix pass)
```
