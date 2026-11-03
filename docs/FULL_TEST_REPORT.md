# Real Estate Marketplace — Full Test Report (Phases 1–4)

**Site:** qarawi · **Date:** 2026-06-06 · **Build:** `npm run build` ✓ (80 routes) · `bench migrate` ✓ clean
**Storefront:** http://69.164.249.142:8080 (marketplace mode) · **ERP:** base.meena.sa → /real-estate

**Headline:** Backend suite **51/51 PASS** · Storefront E2E **5/5 PASS** · Regression **clean** · Performance **<0.5s TTFB** · Data integrity **clean** · **3 bugs found & fixed** (1 high-severity security).

---

## 1. Backend API tests — `base_meena.real_estate.test_suite.run_all` → **51 PASS / 0 FAIL**

| Group | Coverage | Status |
|---|---|---|
| Listing CRUD + compliance | draft create (region auto-fetch), publish gate (phone→Nafath→license), verify_license, content-lock on Active, activate-without-license blocked, reject-always-allowed, **audit written on every mutation**, **auto-expiry job** | ✅ 11/11 |
| OTP / Nafath | allows 5/hr, **blocks 6th (rate-limit)**, verify accepts valid / rejects bad code | ✅ 4/4 |
| Social | add_comment, **hidden comment excluded from public read**, favorite toggle + state, follow toggle, report create/resolve, property-request CRUD + matches | ✅ 10/10 |
| Chat | start_thread (idempotent), send+get messages, my_threads | ✅ 4/4 |
| Promotions / payments | list_promotions, checkout (Pending) → confirm → Paid, **listing featured**, **Sales Invoice w/ 15% VAT** (tax=7.5 on 50), **scheduler unfeatures** past featured_until | ✅ 6/6 |
| Compliance | expiry-monitor structure, **complaint ticket + business-day SLA**, workflow transition, audit viewer, **REGA export complete JSON** | ✅ 5/5 |
| Public search / detail | results, **keyset pagination (no overlap)**, filtered (city+type), region counts, **hide_exact_location → district center**, address withheld, **rega_ad_data + QR exposed**, **draft not public** | ✅ 8/8 |
| Notifications | follower + property-request-match fire on publish | ✅ 1/1 |
| Auth enforcement (HTTP) | guest endpoint 200; **auth-only endpoint blocks guest 403** | ✅ 2/2 |

## 2. E2E (Playwright, chromium)

| Spec | Journey | Status |
|---|---|---|
| `real-estate-storefront.spec.ts` | home (RTL, photo-led cards, region chips) | ✅ PASS |
| | listing detail (REGA block, QR svg, JSON-LD, advertiser) | ✅ PASS |
| | search with filters | ✅ PASS |
| | city landing page | ✅ PASS |
| | post-ad wizard reachable (OTP step) | ✅ PASS |
| `real-estate-erp.spec.ts` | Module-Hub card → dashboard KPIs (mocked) | ⚠️ `fixme` — see known issues |

Storefront E2E runs **real, against :8080, guest, no mocks** → 5/5. ERP-mocked render harness needs a fuller auth-bootstrap mock (tracked); ERP real behaviour is covered by §1 + the manual plan.

## 3. Regression — existing modules unaffected

| Check | Result |
|---|---|
| ERP routes resolve (hr, cashier, accounting, purchases, inventory, sales-reps, tasks) | ✅ all 307 (exist) |
| Core module APIs registered (financial, purchase, hrms leave) | ✅ all 403 (exist + gated, not 404) |
| `npm run build` | ✅ 80 routes compiled |
| `bench --site qarawi migrate` | ✅ clean |

## 4. RTL / i18n sweep

| Check | Result |
|---|---|
| i18n keys used vs defined (115 `re.*` keys) | ✅ after fix — `re.status` was missing (now added EN+AR) |
| Storefront content `dir="rtl"` | ✅ wrapper + `<html lang="ar" dir="rtl">` (after fix) |
| No raw `re.*` key leaking into UI | ✅ none |
| Phone numbers `dir="ltr"` inside RTL | ✅ present |
| Hijri + Gregorian dual dates | ✅ (license expiry) |
| Numerals: Western + tabular-nums for stats/prices | ✅ (Arabic-Indic reserved for Hijri/prose) |

## 5. Data integrity (demo seed)

| Step | Result |
|---|---|
| Seed | 6 advertisers, 24 listings (22 active), 71 images, full interactions |
| KPIs / region counts / compliance monitor reflect seed | ✅ (revenue 150, open_reports 1, monitor expired=1 / expiring_7=1) |
| `delete_demo_data` | ✅ removes ALL demo docs (advertisers/listings/requests/images → 0) |
| Zero orphans (images/comments/payments) | ✅ 0 |
| Real (non-demo) data untouched | ✅ unchanged |

## 6. Performance (storefront)

| Page | TTFB | Weight | Notes |
|---|---|---|---|
| `/` (home) | 0.047s | 110 KB | ISR cached |
| `/search` | 0.370s | 166 KB | SSR + filters |
| `/CITY-3` (city) | 0.494s | 74 KB | ISR |
| `/listing/[id]` | 0.149s | 50 KB | ISR |

All **well under 2s**. Hot search query `EXPLAIN` → `type=ref, key=aqar_listing_scm` (uses the composite index, 7 rows — **no table scan**). All filter/sort columns indexed (status, city, category, price, area_sqm, rega_license_expiry, modified). `slow_query_log` is OFF system-wide; no unindexed real-estate query observed.

---

## Bugs found AND fixed during this run

| # | Bug | Severity | Fix |
|---|---|---|---|
| 1 | **OTP rate-limit never fired.** `get_value` caches the missing counter key as `None` in the request-local cache, so the subsequent `set_value` was never observed → unlimited OTP sends (abuse/cost risk). | **HIGH** (security) | `providers/otp.py` now uses redis-native `incr`/`expire` (bypasses local cache), like the view-counter. Test added (`OTP rate-limit on 6th`). |
| 2 | **Missing i18n key `re.status`** — rendered the raw key as the Promotions table header. | LOW (cosmetic) | Added `re.status` EN+AR. i18n audit added to the suite. |
| 3 | **Storefront `<html>` was `lang="en" dir="ltr"`** (inherited from the shared ERP root layout) — suboptimal for SEO/screen-readers on the public Arabic site. | LOW (SEO/a11y) | `components/store/store-html-lang.tsx` sets `<html lang="ar" dir="rtl">` on the storefront. |

(Plus test-harness fixes — robust cleanup, follow-test isolation, strict-mode locators — not app bugs.)

## Known issues / remaining

| Issue | Severity | Note |
|---|---|---|
| ERP-mocked E2E (`real-estate-erp.spec.ts`) doesn't pass | LOW | Marked `fixme`; needs a fuller AuthContext bootstrap mock. Real ERP integration covered by the 51-test backend suite + manual plan. |
| Guest post-ad full E2E (OTP code entry) not automated | LOW | Can't read the OTP from the UI in-browser; covered by backend `guest_*` endpoints + manual RE-30…40. |
| Moyasar / REGA / OTP / Nafath are stubs | By design | Swappable provider interfaces; flagged since Phase 1. |
| 2 of 24 demo listings skipped on some city-name mismatches | INFO | Resolved (مكة→مكة المكرمة, المدينة→المدينة المنورة); all 24 now seed. |

## How to run
```
# backend
bench --site qarawi execute base_meena.real_estate.test_suite.run_all
# e2e (storefront)
STORE_URL=http://localhost:8080 npx playwright test e2e/real-estate-storefront.spec.ts --project=chromium
# demo data
bench --site qarawi execute base_meena.real_estate.demo_seed.seed_demo_data
bench --site qarawi execute base_meena.real_estate.demo_seed.delete_demo_data
```

---

## Integration: Storefront ↔ ERP

**Date:** 2026-06-06 · **Site:** qarawi · **Storefront:** http://localhost:8080 (= https://aqar.meena-alaqariya.com) · **ERP:** qarawi.base.meena.sa
**Headline:** **17/17 PASS** — every storefront action reflects in the ERP and every ERP action reflects on the storefront. Public API reflects **immediately**; cached pages reflect **within their ISR window** (measured).

How it's tested: the **guest/public path runs over real HTTP** against the live storefront `/api` (the same endpoints the storefront calls); **authenticated storefront actions** (comment/report/request/chat need a logged-in user) and **ERP manager actions** run through the real whitelisted methods; the ERP side is verified through the same methods/queries the dashboard & pages consume (`get_dashboard`, `list_reports`, `get_my_threads`, …). The headline guest **/post journey is also driven through the real browser UI** with Playwright.

### Storefront → ERP

| # | Test | Status | Notes |
|---|---|---|---|
| 1a | Guest posts ad via /post (test-mode OTP 123456 → details → license → publish) → listing **Active** in ERP | ✅ PASS | created over HTTP; status `Active` in ERP |
| 1b | Dashboard KPI **إعلانات نشطة** increments | ✅ PASS | active 22 → 23 |
| 1c | New advertiser appears in **المعلنون** | ✅ PASS | advertisers 6 → 7 |
| 1d | New listing appears on cached **home** (storefront→ERP, ISR) | ✅ PASS | **appeared in 5s** (home ISR=60s) |
| 2 | Guest writes a comment → ERP moderation queue + visible publicly | ✅ PASS | `get_comments` includes it; `is_hidden=0` |
| 3 | Guest submits a report → ERP reports queue + KPI **بلاغات مفتوحة** | ✅ PASS | in `list_reports`; open_reports 1 → 2 |
| 4 | Guest creates a property request → ERP property-requests | ✅ PASS | request doc present |
| 5 | Guest starts a chat → thread + message in ERP messages | ✅ PASS | thread + 1 message present |

### ERP → Storefront

| # | Test | Status | Notes |
|---|---|---|---|
| 6 | Manager hides a comment → excluded from public comments | ✅ PASS | gone from `get_comments` **immediately** (comments are client-fetched → no ISR) |
| 7a | Manager force-unpublishes/expires → public API removes listing | ✅ PASS | `get_listing` → **404 immediately**, excluded from search |
| 7b | Listing detail page returns 404 | ✅ PASS | `/listing/{id}` → 404 immediately (route is dynamic SSR, no ISR) |
| 7c | Cached **home** drops it within the ISR window | ✅ PASS | present before, **removed in 60s** (= home ISR window) |
| 8 | Manager features a listing (promotion) → **مميّز** badge on storefront card | ✅ PASS | `is_featured` in search API **immediately**; مميّز in SSR `/search` HTML (search ISR=30s) |
| 9 | Manager edits via re-license flow → new content public + audit log | ✅ PASS | new title public after republish; audit entries written (incl. `Published`) |
| 10a | Counts coherence: KPI **إعلانات نشطة** == DB Active count | ✅ PASS | 23 == 23 |
| 10b | Region chip counts sum == Active-with-region count | ✅ PASS | 23 == 23 |
| 10c | Public search returns only Active listings | ✅ PASS | 23/23 rows Active |

### Timing / ISR
- **Public API: immediate** for every ERP→storefront change (verified inline right after each action).
- **Cached pages reflect within their `revalidate` window** — measured: home **appears in 5s**, **removed in 60s** (window = 60s); city = 120s, search = 30s, listing detail = dynamic (immediate). No change exceeded its ISR window → **no ISR bug**.
- Comments are fetched client-side (not part of an ISR page) → moderation changes show immediately on reload.

### Bugs found & fixed
None — all 17 checks passed. (One test-harness fix during authoring: the bench process holds a REPEATABLE-READ snapshot, so it must `commit()` to observe rows committed by the separate web-worker transaction before asserting cross-side counts — a test artifact, not a product bug.)

### How to run
```
# API-level integration (storefront guest/public over HTTP + ERP via methods)
bench --site qarawi execute base_meena.real_estate.integration_test.run_all
# UI journey (guest /post wizard through the real browser)
STORE_URL=http://localhost:8080 npx playwright test e2e/real-estate-integration.spec.ts --project=chromium
bench --site qarawi execute base_meena.real_estate.integration_test.cleanup_pw   # remove the UI-created ad
```
Self-isolating (`INTG-` / `INTG-PW` markers) and self-cleaning; demo baseline (24 listings / 22 active / 6 advertisers) is left untouched.

---

## Dark Mode (storefront) — Phase 5 / Checkpoint 4

**Scope:** public storefront only (`.aqar-store`). The ERP `/real-estate` module is intentionally excluded (231 hardcoded Tailwind utilities + global `--primary-color` ⇒ not achievable purely via scoped tokens). Other ERP modules and the tenant theming system are untouched. **Headline: Playwright 5/5 PASS.**

Implementation: CSS variables only — a `.aqar-store.dark { … }` token block (warm-dark palette: page `#151816`, surface `#1D211E`, elevated `#232824`, text `#ECEAE4`, primary green `#2E9B72`, gold `#D4AF5F`) overrides the same 10 tokens, so no per-component color rewrites. Sadu signature inverts (warm-sand pattern on deep-green band); cards get a 1px light hairline so photos glow; Leaflet tiles get a dark CSS filter (markers keep color); the REGA QR stays light/scannable (not inverted). Theme is chosen by a header moon/sun toggle persisted to the **`aqar-theme` cookie** (not localStorage); a blocking inline script applies the class before first paint (cookie → else `prefers-color-scheme`), so **no FOUC** and **pages stay static/ISR** (we never call `cookies()` server-side, so `/store` remains `○ Static`).

| Test | Status | Notes |
|---|---|---|
| Dark cookie → home/search/post/detail render dark | ✅ PASS | `.aqar-store` has `.dark`, page bg = `rgb(21,24,22)` (#151816) |
| Light cookie → renders light | ✅ PASS | bg = `rgb(250,247,242)` (#FAF7F2) |
| Toggle flips theme + persists across reload | ✅ PASS | cookie `aqar-theme=dark` written; survives reload |
| No-FOUC (theme applied before paint) | ✅ PASS | class present at `waitUntil:'commit'` (pre-hydration) |
| prefers-color-scheme: dark, no cookie | ✅ PASS | OS dark preference auto-applies |
| QR stays high-contrast/scannable in dark | ✅ PASS | QR panel light; `fgColor #134231`/`bgColor #fff` unchanged |

**Regression / isolation**
| Check | Result |
|---|---|
| `npm run build` | ✅ 0 errors; `/store` still `○ Static` (ISR preserved) |
| Storefront `:8080` + `https://aqar.meena-alaqariya.com` | ✅ 200, no-FOUC script present, valid cert |
| ERP `base.meena.sa`/`qarawi` login | ✅ 200; `/app` 301 |
| ERP markup has no `.aqar-store` root | ✅ dark tokens cannot leak into the ERP |
| egarsys (`meena-alaqariya.com`) cert + app + pid | ✅ valid / 200 / alive — untouched |

How to run:
```
STORE_URL=http://localhost:8080 npx playwright test e2e/real-estate-darkmode.spec.ts --project=chromium
```

---

## Admin / Phase 5 (command center + dashboard + dark mode + brand)

**Headline:** Admin API suite **14/14 PASS** · Storefront/SEO Playwright **5/5 PASS** · dark-mode **5/5** · brand wired · soft-404 fixed. All against the live setup; self-cleaning; demo baseline (24 listings / 6 advertisers) untouched.

### Admin API E2E — `base_meena.real_estate.admin_test.run_all` → **14/14**
Each does the real admin action, verifies the **storefront effect over live HTTP** (`:8080`, the public API the wizard/storefront consume), and asserts an Aqar Audit Log row.

| # | Test | Status |
|---|---|---|
| 1a | Category create → appears in public taxonomy (wizard + storefront) + audit | ✅ |
| 1b | Disable hides from storefront; enable restores | ✅ |
| 2 | Safe-delete blocked while listings exist → reassign → delete | ✅ |
| 3a/3b | Ban → advertiser's listing vanishes from storefront → unban restores it | ✅ |
| 3c | Ban/unban + per-listing auto-unpublish all audited | ✅ |
| 4a | Force-feature → `مميّز` in storefront search | ✅ |
| 4b | Transfer listing → advertiser changed + audit | ✅ |
| 4c | Admin re-license edit → new title public + audit | ✅ |
| 4d | Force-unpublish → gone from storefront | ✅ |
| 5 | Promotion package create + edit (price/duration) + audit | ✅ |
| 6 | Role grant → revoke (Real Estate roles) + audit | ✅ |
| 7 | Property service + add-district (→ storefront `list_districts`) + module flag + audit | ✅ |
| 8 | **Auth**: every mutation rejected for Moderator + Guest (method **and** HTTP) | ✅ |

### Storefront / SEO — `e2e/real-estate-admin.spec.ts` (Playwright) → **5/5**
| Test | Status | Notes |
|---|---|---|
| Unknown city path → real **404** with branded Arabic page | ✅ | was a soft-404 (200) — now `notFound()` + `app/store/not-found.tsx` |
| Unknown listing → 404 | ✅ | |
| Unknown city/district → 404 | ✅ | |
| Real city path still returns 200 | ✅ | regression guard |
| Storefront renders categories + listing cards (taxonomy pipeline) | ✅ | browser-level |

Why this split: the admin **actions** are manager-gated; driving the React settings UI in-browser needs the full ERP auth bootstrap (same constraint as the existing `real-estate-erp.spec.ts` fixme). So the admin scenarios are verified **end-to-end** by `admin_test.py` (real action + live storefront HTTP effect + auth + audit), and Playwright covers the genuinely browser/SEO-level behavior (404 + render).

### Dashboard (Stage B) & review fixes
Backend `get_dashboard_extras` verified live (recent w/ thumbs, 30-day trend, category/city breakdown, expiring w/ days-left, merged activity). Review fixes applied & confirmed: monochrome palm-green category bars with full Arabic names; all status/activity values localized via `re.*` keys (no raw English in the Arabic UI); 30-day chart switched from area→bars so the recent spike is visible.

### Dark mode (Stage D) — `e2e/real-estate-darkmode.spec.ts` → **5/5**
Dark/light render, toggle persistence (cookie), no-FOUC, prefers-color-scheme; QR stays scannable. (See "Dark Mode (storefront)" above.)

### How to run
```
bench --site qarawi execute base_meena.real_estate.admin_test.run_all
STORE_URL=http://localhost:8080 npx playwright test e2e/real-estate-admin.spec.ts e2e/real-estate-darkmode.spec.ts --project=chromium
```

---

## Smart Search (Arabic) + dashboard chart fix

**Headline:** backend smart-search **12/12 PASS** · Playwright autocomplete **4/4 PASS** · chart fixed (recent spike visible, full category names).

### Arabic normalization + suggest — `search_test.run_all` → 12/12
- `normalize_ar`: ة→ه, ى→ي, أ/إ/آ→ا, strip tashkeel+tatweel, strip leading ال. Mirror `lib/arabic.ts` for highlight.
- `name_normalized` (indexed) added to City/District/Category; backfilled **4581/4581 cities, 3732/3732 districts** + categories.
- `suggest(بريده)` → بريدة; grouped {cities,districts,categories} max 8; counts; 60s cache; strip-al (الملقا→ملقا); short query empty.
- `search_listings` normalized: **جدة == جده** (5 == 5).

### Autocomplete — `e2e/real-estate-search.spec.ts` → 4/4
بريده suggests بريدة under مدن; ↓+Enter selects→navigates; plain Enter→full `/search?keyword`; works in dark theme. Debounced 250ms, RTL grouped dropdown, matched span highlighted palm-green, keyboard nav, skeleton.

### Dashboard chart fix
30-day chart: removed negative left margin + kept the time axis LTR (today = rightmost bar, never clipped) + `interval="preserveStartEnd"` (last label = today) → the recent spike is clearly visible. Category chart YAxis widened to 132 → full Arabic names (no truncation). Verified via preview screenshot.

---

## Guest wizard parity + listing-page crash hardening (P0/P1)

**P0 — listing page never hard-crashes:** root cause was a sparse guest listing (AQAR-00917: no images, 0/0 coords). The detail page + client components already guard it (gallery→branded placeholder, map skipped when lat/lng 0/0, QR null-guarded); added `app/store/listing/[id]/error.tsx` (branded Arabic) as the last-resort boundary. AQAR-00917 renders cleanly (200, no console errors). Audit: exactly 1 image-less Active listing (AQAR-00917) — valid, renders, no repair needed.

**P1 — guest wizard ≡ ERP wizard.** New flow: OTP → **details** (category, type, price, payment terms, area, rooms, baths, age, street width, facade, description, property-service chips) → **map** (Leaflet draggable pin centered on the district + `hide_exact_location` toggle) → **multi-photo** (≤10, type/size validated, previews grid, delete, pick-primary; webp thumbs auto) → **license** (REGA number/expiry/licensee/deed/plan/plot/usages) → publish. Backend: `guest_save_draft`/`guest_upload_image` (secured by OTP-token ownership + per-token rate-limit + 10-cap + 5MB/type checks, public File + Aqar Listing Image)/`guest_image_action`/`guest_list_images`/`guest_publish`/`list_property_services`.

### Playwright — `e2e/real-estate-guest-wizard.spec.ts` → 2/2
| Test | Status | Notes |
|---|---|---|
| Guest wizard happy path (details→map→2 photos→license→publish) → listing renders gallery + Leaflet map, **0 console errors** | ✅ | full browser E2E |
| Sparse listing (AQAR-00917, no images/coords) renders without crashing | ✅ | 200, `.aqar-store` visible, 0 pageerrors |

Backend guest flow also verified end-to-end over HTTP (draft → 3 images → publish → Active with images/facade/services/coords). Self-cleaning test data; demo baseline untouched.

### How to run
```
STORE_URL=http://localhost:8080 npx playwright test e2e/real-estate-guest-wizard.spec.ts --project=chromium
```

---

## Map-first search — Stage 1 (flagship)

**Headline:** split map+list `/store/search` with clustered price-pins, two-way hover sync, search-as-you-move, restrained GSAP motion (reduced-motion safe). Playwright **4/4 PASS**.

Backend: `search_listings` now returns a privacy-safe `pin_lat/pin_lng/pin_obscured` per result (exact when present + not hidden, else district→city centroid); new `search_in_bounds(sw,ne,…filters)` (bbox prefilter on the effective coord, ≤120) powers move-to-search. Verified: 23 pins in a Saudi bbox, 7 in a Riyadh bbox.

Frontend: `components/store/price-pin-map.tsx` (react-leaflet + `leaflet.markercluster` driven via `useMap`; price-chip divIcons, gold for featured, count-bubble clusters, stagger-in), `map-search.tsx` island (list⇄map hover sync, click-pin → slide-up compact card, `البحث عند تحريك الخريطة` toggle, animated result count, mobile الخريطة pill), `lib/motion.ts` (lazy gsap + `prefersReducedMotion` gate). gsap/cluster ship as lazy chunks (not in the shared bundle). Dark mode: pins/clusters token-themed; tiles use the existing dark filter.

| Test (`e2e/real-estate-map-search.spec.ts`) | Status |
|---|---|
| Pins/clusters + results list render, no console errors | ✅ |
| Hover a result card → highlights (sync) | ✅ |
| Search-as-you-move → `search_in_bounds` re-query on map move | ✅ |
| Reduced-motion run → pins render, page stable | ✅ |

---

## Quick wins — Stage 2

**Headline:** WhatsApp server-redirect CTA, mortgage calculator (sale listings), offices directory. Playwright **3/3 PASS**.

- **WhatsApp** (`wa_redirect` + `whatsapp-button.tsx`): green CTA on the listing detail + map compact card → `/api/.../wa_redirect?listing=` which records a click (`wa_clicks` field via redis hash + 30-min flush) and **302-redirects to wa.me** with a prefilled Arabic message (title + link). The advertiser phone stays **server-side** (never in page HTML). Subtle GSAP hover.
- **Mortgage calculator** (`mortgage-calc.tsx`): collapsible **احسب التمويل** on Sale listings — down-payment %, years, APR sliders (Saudi defaults), GSAP count-tween monthly payment, Arabic tabular numerals, clearly labeled **تقديري**. Pure client-side.
- **Offices directory** (`/store/offices` + `list_offices`): advertiser-offices with ≥1 active listing, derived city, verification badges, listing count, ranked; ScrollTrigger stagger reveal (reduced-motion safe). Linked from footer + home.

| Test (`e2e/real-estate-quickwins.spec.ts`) | Status |
|---|---|
| WhatsApp button → 302 → wa.me; phone absent from HTML | ✅ |
| Mortgage calculator computes + reacts to slider | ✅ |
| Offices directory renders cards | ✅ |

---

## Navigation + real-time search filters + section pages

**Headline:** 6-item primary nav (active state + mobile hamburger), a client-owned **real-time, stacking, URL-synced** filter bar (searchable city combobox, property-type, purpose, price, near-me), and three new section pages (investment, auctions, property-management). Playwright **8/8 PASS**. Backend lead capture verified writing `Aqar Lead` rows.

- **Primary nav** (`store-nav.tsx`): الرئيسية / بيع / إيجارات / استثمار / إدارة عقارات / حراج عقارات. Active state via `usePathname()`+`useSearchParams()` (path normalized for the marketplace `/store` rewrite); desktop inline + mobile hamburger; keeps logo, theme toggle, "أضف إعلانك" CTA. Suspense-wrapped in the store layout.
- **Search filter bar** (`search-filters.tsx` + `city-combobox.tsx`, lifted into `map-search.tsx`): city combobox sourced from **cities-with-listings only** (+counts, no dead-ends), property-type, purpose (Sale/Rent/Daily), price min/max, near-me geolocation, sort. Filters **stack** and update the **list AND map** live; state synced to the URL via `history.replaceState` (shareable, no remount). City pick / near-me recenter the map (`price-pin-map` `flyTo`); near-me keeps current filters (uses bounds search, not `nearby_listings`).
- **Section pages**: استثمار + حراج (branded coming-soon; حراج captures notify-me demand), إدارة عقارات (service landing + lead form). Backed by `submit_lead` (per-IP throttled, insert-only) → `Aqar Lead`. City list backed by `list_cities_with_listings`.

| Test (`e2e/real-estate-nav-filters.spec.ts`) | Status |
|---|---|
| Primary nav renders the six items | ✅ |
| Active state reflects the purpose query (بيع/إيجارات) | ✅ |
| Mobile hamburger opens the menu | ✅ |
| City combobox lists cities-with-listings + re-queries on pick | ✅ |
| Price filter narrows the query (stacking, debounced) | ✅ |
| Near-me uses geolocation then bounds-searches | ✅ |
| Section pages render on-brand (investment/property-management) | ✅ |
| Auctions notify-me lead form submits → `Aqar Lead` row | ✅ |
