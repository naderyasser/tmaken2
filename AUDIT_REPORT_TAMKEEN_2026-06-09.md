# Project Audit — تمكين العقارية (Performance, Security, UX)

**Date:** 2026-06-09 · **Scope:** Marketplace storefront (`app/store/**`, `components/store/**`, `lib/real-estate-api.ts`, `lib/frappe-server.ts`, `middleware.ts`, `next.config.mjs`) + backend (`apps/base_meena/base_meena/real_estate/`) + live build at `http://localhost:8080` (nginx → next-server :3000, paths rewritten under `/store`).
**Mode:** Assessment only — no code was modified. Lighthouse 12.x run against the production build via headless Chromium (Playwright `chromium-1208`); live behavior probed with Playwright at 360/390/768/1280px.

> **Measurement caveat:** Lighthouse "mobile" applies 4× CPU throttling and ran on the production server while it served other workloads, so absolute mobile ms values (especially TBT on `/listing`) are inflated; treat them as relative signal. Desktop runs are stable. TTFB was excellent in every run (22–172 ms), so all slowness is client-side JS/asset weight.

---

## 1) Performance

### Core Web Vitals / Lighthouse per route

| Route | Device | Perf | LCP | CLS | TBT | FCP | TTFB | Requests | Page weight |
|---|---|---|---|---|---|---|---|---|---|
| `/` (home) | Mobile | **44** | 6.4 s | 0 | 5,340 ms | 1.8 s | 75 ms | 82 | 1,123 KB |
| `/` (home) | Desktop | **58** | 1.5 s | 0.004 | 1,730 ms | 0.5 s | 172 ms | 115 | 1,213 KB |
| `/search` | Mobile | **26** | 13.6 s | **0.127** | 15,880 ms | 3.2 s | 171 ms | 81 | 1,432 KB |
| `/search` | Desktop | **48** | 3.0 s | 0.005 | 1,540 ms | 0.5 s | 43 ms | 141 | 1,847 KB |
| `/listing/[name]` | Mobile | **33** | 8.1 s | 0.005 | 29,240 ms\* | 2.3 s | 122 ms | 62 | 1,043 KB |
| `/listing/[name]` | Desktop | **95** | 1.1 s | 0 | 130 ms | 0.5 s | 61 ms | 93 | 1,226 KB |
| `/post` | Mobile | **44** | 7.8 s | 0.016 | 3,230 ms | 1.7 s | 22 ms | 51 | 841 KB |
| `/post` | Desktop | **90** | 1.0 s | 0.054 | 240 ms | 0.4 s | 50 ms | 84 | 934 KB |

\* Anomalous vs. desktop (130 ms) — server was under concurrent load; re-measure on idle hardware. Directionally the route is still JS-heavy on mobile.

Other Lighthouse categories: Best Practices 96–100, SEO 100 everywhere. Accessibility 96–100 (see §3).

**CLS culprit on `/search` mobile (0.127):** the results list container `div.order-2.max-h-[calc(100vh-180px)]…` shifts when listings hydrate in — reserve min-height or render results server-side first.

### Per-route JS (production build, measured from served HTML; excludes the `noModule` polyfill chunk)

| Route | Initial chunks | Raw | Gzip |
|---|---|---|---|
| `/` | 14 | 721 KB | 205 KB |
| `/search` | 14 | 749 KB | 213 KB (+ ~66 KB gz deferred map stack on mount) |
| `/listing/[name]` | 15 | 744 KB | 214 KB |
| `/post` | 14 | 749 KB | 212 KB (+ deferred Leaflet picker) |

Largest shared chunks: react-dom framework 219 KB raw / 68.5 KB gz; **`Providers` chunk 155 KB raw / 40 KB gz containing the full bilingual ERP i18n dictionary (`lib/i18n.tsx`, 184,651 B source) + `frappeClient` (2,444-line `lib/api-client.ts`) + auth context — none of it needed by the Arabic-only storefront**; Next runtime 108 KB; Radix Toast 38 KB (store uses no toasts). Deferred map stack: leaflet 148.5 KB + markercluster 37 KB + react-leaflet glue ~15 KB + GSAP 70.7 KB + Flip 43.4 KB.

### Findings

| # | Issue | Severity | Evidence | Recommendation |
|---|---|---|---|---|
| P1 | Full ERP i18n dictionary + frappeClient + auth context (~40 KB gz) shipped on every store page via root-layout `Providers` | **Critical** | `app/providers.tsx`; `app/layout.tsx:24`; chunk `80b93802ba519841.js` | Scope `Providers` to the ERP route group; lazy/namespace-split i18n |
| P2 | 422.7 KB of fonts preloaded per page across 4 families/10 woff2; **Amiri = 208 KB used only for the wordmark calligraphy**; Inter + IBM Plex Sans Arabic (~187 KB) come from the root layout but store CSS uses Tajawal/Amiri | **High** | `app/layout.tsx:9-10`; `app/store/layout.tsx:22-23`; 10 `rel=preload` font tags in served HTML | Subset Amiri with `next/font`'s `text:` option (or SVG wordmark); move Inter/IBM Plex into the ERP layout. `font-display: swap` is already correct (FOUT, no FOIT) |
| P3 | `images.unoptimized: true` and zero `next/image` in the store → no resizing/AVIF/srcset; gallery serves user-upload **originals** as the LCP image with no size cap; `/post` uploads raw base64 with no client-side resize | **High** | `next.config.mjs:8-10`; `listing-gallery.tsx:65,83`; `post/page.tsx:29-31` | Serve backend-generated medium WebP renditions with `srcset/sizes` in the gallery (a `webp_thumb` pipeline already exists, ~7.5 KB thumbs); resize before upload |
| P4 | `/files/*` listing images served with **no `Cache-Control`** (ETag only) → every repeat view revalidates each image | **High** | `curl -I /files/IMG-00000982-thumb.webp` | nginx: `add_header Cache-Control "public, max-age=2592000"` for `/files/` |
| P5 | No AbortController / request-id guard on search + map-bounds fetches → stale responses can overwrite fresh results during pan/type bursts | **High** | `map-search.tsx:57-69,140-148` | Abort previous request or ignore out-of-order responses |
| P6 | All card images `loading="lazy"` unconditionally, including above-the-fold LCP candidates; no `fetchpriority="high"` anywhere | Medium | `listing-image.tsx:42` (live DOM check confirms `loading=lazy` + no width/height attrs) | Eager + `fetchpriority="high"` for first-row cards and gallery main image |
| P7 | Marker layer fully rebuilt (`clearLayers()` + re-add + GSAP stagger) on every pan/search; clustering itself is correctly enabled (`chunkedLoading`, radius 48) | Medium | `price-pin-map.tsx:81-128` | Diff markers by `name`; animate only on first mount |
| P8 | `/post` is a single 364-line client page fetching categories/services/regions **after hydration** (waterfall on the conversion page) | Medium | `app/store/post/page.tsx:1,44-48` | RSC shell that server-fetches taxonomy (already cached 3600 s server-side) |
| P9 | No `loading.tsx` anywhere under `app/store/`; listing page blocks on similar-listings fetch (no Suspense streaming) | Medium | `find app/store -name loading.tsx` → none; `listing/[id]/page.tsx:41-44` | Add route skeletons; `<Suspense>` for below-fold sections |
| P10 | OSM public tile server with deprecated `{s}.tile.openstreetmap.org` pattern — usage policy disallows heavy commercial production traffic (12 tiles on load, ~2 per pan thanks to caching) | Medium | `price-pin-map.tsx:159`; `location-picker.tsx` | Move to a commercial/self-hosted tile provider before traffic scales |
| P11 | Build artifacts: three identical 388 KB recharts chunks (ERP routes, not store); 9.6 MB total chunk dir; gzip-only (no brotli precompression); 157.8 KB raw global Tailwind CSS includes the whole ERP | Low/Medium | `.next/static/chunks/`; curl with `Accept-Encoding: br` returns gzip | Investigate Turbopack vendor chunking; enable `brotli_static` |
| P12 | Radix `<Toaster/>` (12 KB gz) on all store pages; store uses no toasts via it | Low | `app/layout.tsx:25` | Move into ERP layout |
| P13 | Every favorite/compare button re-parses localStorage on each collections event (~100 buttons on /search) | Low | `lib/listing-collections.ts:72-90` | Single context, one parse per event |

**Verified as already good (claims in the brief that did NOT reproduce):**
- `get_csrf_token` is fetched **once** and cached with in-flight dedup (`lib/api-client.ts:205-252`); 5 rapid map pans produced 1 csrf call total (live-verified).
- `moveend → search_in_bounds` **is debounced 400 ms** with an initial-fit gate (`price-pin-map.tsx:54-63,114`); filters 350 ms, autocomplete 250 ms.
- No RSC-prefetch 503s under rapid navigation (live-probed across 6 quick navigations — zero responses ≥ 400).
- CLS from images is controlled by fixed-height containers (`h-44`, `h-80`, `h-20 w-24`) even though `<img>` tags lack width/height attributes — measured CLS ≈ 0 on home/listing.
- All Leaflet components are correctly code-split via `next/dynamic` `ssr:false`; zero leaflet bytes in initial HTML of any route; GSAP lazy via `lib/motion.ts`.
- ISR/data-fetch discipline is clean: `next.revalidate` 30–120 s per page, `Promise.all` (no server waterfalls), static chunks `immutable, max-age=31536000`, HTML `s-maxage=60, stale-while-revalidate`.

### Top 10 performance wins (impact ÷ effort)

1. Scope `Providers` + `Toaster` to the ERP layout — ~52 KB gz less JS on every store route (P1, P12).
2. Font diet: subset Amiri to wordmark glyphs, move Inter/IBM Plex out of root layout — up to ~395 KB less preload bandwidth before LCP (P2).
3. One-line nginx `Cache-Control` for `/files/` (P4).
4. AbortController/request-id guard in map-search — fixes user-visible stale results (P5).
5. Eager + `fetchpriority=high` first-row card images and gallery hero (P6) — direct LCP win.
6. Medium-size WebP gallery renditions with `srcset` (+ client-side resize before upload) (P3).
7. Reserve min-height for the `/search` results column — kills the 0.127 mobile CLS.
8. `loading.tsx` skeletons + Suspense for similar-listings (P9).
9. Server-fetch taxonomy for `/post` (P8).
10. Marker diffing instead of clear-and-rebuild (P7).

---

## 2) Security

| # | Issue | Severity | Evidence | Remediation | Side |
|---|---|---|---|---|---|
| S1 | **Fixed OTP `123456` effectively ON in production.** `is_test_mode()` returns `True` when the setting is missing/None and `seed.py` sets it to `1`; no real SMS provider is wired. Anyone can "verify" any phone, claim/create an `Aqar Advertiser` for it, and publish listings as that person | **Critical — go-live blocker** | `providers/otp.py:17,20-31,89-92`; `seed.py:171-172`; `aqar_public_api.py:411-430` | Default test mode OFF, fail closed if no SMS provider configured; wire real provider before delivery | Backend |
| S2 | **No rate-limit on OTP *verification*** — request side is capped (5/hr/phone) but verify has no attempt counter; real-mode code is only 4 digits (10⁴ space, 10-min TTL) → brute-forceable | **High** | `providers/otp.py:16,106-115` | Per-phone verify lockout (~5 attempts); ≥6-digit codes | Backend |
| S3 | Dependency CVEs: `npm audit` full tree 8 vulns (4 high); prod-only 4 (3 high). Notable: **next** (request smuggling in rewrites; next/image cache DoS), **lodash** (`_.template` injection/prototype pollution), minimatch/picomatch ReDoS, postcss, ws | **High** | `npm audit` in repo root | Bump Next.js + lodash first, then `npm audit fix` with testing | Frontend |
| S4 | `Access-Control-Allow-Origin: *` **with** `Allow-Credentials: true` on `/api/*` — invalid combo today (browsers reject it) but one config change away from exploitable | **High** | `next.config.mjs` `/api/:path*` headers block | Drop `Allow-Credentials` or use an explicit origin allow-list | Frontend |
| S5 | OTP response discloses `{"test_mode": true}` to guests — advertises the S1 bypass | Medium | `providers/otp.py:103`; `aqar_public_api.py:404-407` | Never return test_mode to clients | Backend |
| S6 | OTP request limit is per-phone only — no per-IP cap → SMS-bombing/cost abuse once real SMS is wired | Medium | `providers/otp.py:38-39,82-87` | Add per-IP throttle | Backend |
| S7 | CSP is **Report-Only** with `unsafe-inline` + `unsafe-eval` → no actual XSS backstop | Medium | `next.config.mjs` (`cspReportOnly`) | Enforce CSP; replace inline theme script with nonce/hash; drop `unsafe-eval` | Frontend |
| S8 | REGA/Nafath compliance providers are **stubs that always pass** — license/deed numbers are client-supplied and trusted; "موثّق" badges are not backed by real verification | Medium (trust/compliance) | `aqar_public_api.py:449-475,627-643` | Wire real REGA/Nafath or hide verified badges until then | Backend |
| S9 | Admin area gated by `NEXT_PUBLIC_ADMIN_PIN` checked in-browser (sessionStorage). Currently NOT in the bundle (env unset at build) but the design leaks the secret whenever set | Medium | `components/admin/admin-pin-gate.tsx:46-53` | Server-side role check; never gate with `NEXT_PUBLIC_*` | Both |
| S10 | `qarawi` site config carries `allow_tests: True` + `test_purge_token`; `purge_test_*` endpoints are gated (System Manager or server-side token, only delete `is_test=1` rows) but should not ship on a client production site | Medium | `sites/qarawi/site_config.json` (values redacted); `aqar_public_api.py:961-990` | Remove test flags/token from the production site config | Backend/Ops |
| S11 | `X-Forwarded-Host` reflected into the WhatsApp prefill message in `wa_redirect` (302 target itself is server-side `wa.me/<digits>` — **not** an open redirect) | Low | `aqar_public_api.py:674-678` | Use configured canonical host | Backend |
| S12 | Login `redirect` param built from path; consuming login page should validate it's a same-origin relative path (`/`, not `//`) — needs verification | Low | `middleware.ts` (`loginUrl.searchParams.set('redirect', pathname)`) | Validate before navigating | Frontend |
| S13 | `typescript.ignoreBuildErrors: true` ships type-unchecked code | Low | `next.config.mjs:4` | Remove and fix errors | Frontend |

**Verified-safe (no findings):**
- **CSRF:** token fetched once, cached, sent as `X-Frappe-CSRF-Token`; cookie `SameSite=Lax`; never logged. Guest mutations are gated by the OTP session token (Frappe applies CSRF to session users). ✔
- **IDOR/authz:** all guest mutation endpoints (`guest_save_draft:521-524`, `guest_upload_image:558-560`, `guest_image_action:593-595`, `guest_publish:619-623`) check token→advertiser ownership; all other `aqar_*` endpoints require a session (no `allow_guest`). ✔
- **PII:** search/detail responses do **not** include advertiser phone or national ID — phone is only released via user-initiated `wa_redirect`/`call_redirect` 302s; leads/contracts are write-only for guests, validated, HTML-escaped in admin emails, throttled 10/hr/IP. ✔
- **XSS:** only 4 `dangerouslySetInnerHTML` uses, all developer-controlled (no-FOUC script, JSON-LD via `JSON.stringify`, chart styles); user descriptions are tag-stripped and React-escaped (`listing/[id]/page.tsx:68,127`). ✔
- **Secrets:** `.next/static/chunks` scanned — no keys/tokens inlined; `.env.production` holds only public app name/version. ✔
- **External links:** `target="_blank"` links carry `rel="noopener noreferrer"`; wa/call redirects are not open redirects. ✔
- **Headers:** live `:8080` responses include `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: geolocation=(self)` (header-level, verified by curl). **HSTS is present on the production 443 vhost** (`/etc/nginx/sites-available/aqar-meena-alaqariya.conf`: max-age 63072000, includeSubDomains, preload). ✔

**Narrative.** The serious risk is concentrated in the guest OTP flow: with test mode effectively on, **phone ownership is not verified at all** (S1) — disable before delivery; and even in real mode the 4-digit unthrottled verify (S2) must be fixed at the same time. S8 compounds the trust story: "verified" badges currently mean nothing. Frontend posture is otherwise solid — React escaping intact, no secrets in the bundle, PII kept server-side, ownership checks correct — with the remaining work being hygiene: the CORS header combo, enforcing CSP, and the Next/lodash CVE bumps.

---

## 3) UX & Accessibility

Lighthouse accessibility: **96 (home), 100 (search), 96 (listing), 96 (post)** — residual flags are color-contrast (every route) and one decorative SVG alt on listing. Live probes: no horizontal overflow at 360/390/768 on any key route; global focus ring works (2 px solid outline survives Tab on real elements); gallery is a full carousel (8 imgs, prev/next + thumbnails + lightbox — the "single image, no navigation" claim in the brief is outdated).

| # | Issue | Severity | Evidence | Recommendation |
|---|---|---|---|---|
| U1 | **Dark mode visually broken.** Toggle sets `data-theme="dark"` but Tailwind is configured for `darkMode: ['class']` → every `dark:` class is dead; live toggle produced zero change (body stayed `rgb(255,255,255)`). Additionally `--aqar-green-d` stays near-black in the dark palette while **55 components use it as text color** → ~1.2:1 contrast on dark surfaces | **Critical** | `tailwind.config.ts:4` vs `theme-toggle.tsx:20-22`; `store.css:43`; usages e.g. `listing-contact.tsx:58`, `map-search.tsx:189,248,278`, `post/page.tsx:177`; live probe screenshot `/tmp/audit/dark-home.png` | `darkMode: ['class', '[data-theme="dark"]']` + dark override for the green-d token (pattern already exists at `store.css:152,312`) — or remove the toggle for delivery |
| U2 | **Failed API calls masquerade as empty marketplace / 404.** `frappe-server.ts` catches and returns `null`; listing page calls `notFound()` on null; only `/listing` has `error.tsx`, no `loading.tsx` exists | **High** | `lib/frappe-server.ts:23-32`; `listing/[id]/page.tsx:38` | Distinguish error from empty (throw → `error.tsx` with retry); add skeletons |
| U3 | **Muted-text contrast fails WCAG 1.4.3 across the store**: 102 occurrences of `text-[var(--aqar-kohl)]/40–/60` compute to 2.5–4.1:1 at 11–14 px (locations, dates, empty-state hints). A compliant `--aqar-muted` token (6.3:1) exists but is barely used | **High** | `listing-card.tsx:44,59`, `post/page.tsx:178`, `listing/[id]/page.tsx:104,168,183`, `map-search.tsx:188,216` | Replace /40–/60 opacities with `--aqar-muted` |
| U4 | CTA contrast failures: white on WhatsApp green `#1FA855` = 3.09:1 (and 1.98:1 on `#25D366` variant); white on gold "مميّز" badge `#B8923E` = 2.9:1; clay error text `#C26B45` on white = 3.8:1 | **High** | `listing-contact.tsx:25,47`; `whatsapp-button.tsx:27`; `store.css:272`; `lead-form.tsx:172` | Darken greens/clay; dark text on gold badge (dark mode already does this) |
| U5 | **/post form a11y**: 15 placeholder-only fields, no `<label htmlFor>`, no `aria-invalid`/`aria-describedby`, submit-only pooled validation, error banner without `role="alert"`, stepper purely visual (no `aria-current`, labels hidden on mobile) | **High** | `post/page.tsx:223-238,191,124,181-189`; same pattern `contracts/page.tsx:281-330` | Real labels, per-field errors with aria association, `role="alert"`, focus first invalid field, `aria-current="step"` |
| U6 | Lightbox lacks focus trap/restore (has `role=dialog`+Esc); mobile full-screen map (`fixed inset-0 z-50`) has no role, no Esc, no focus handling | Medium | `listing-gallery.tsx:127-139`; `map-search.tsx:260-268` | Standard dialog focus management |
| U7 | No skip link past the sticky header | Medium | `app/store/layout.tsx:65-92` | `<a href="#main" class="sr-only focus:not-sr-only">تخطي إلى المحتوى</a>` |
| U8 | `FavoriteButton` (button) nested **inside** the card `<Link>` — invalid HTML, confusing SR/keyboard order | Medium | `listing-card.tsx:21-36`; `map-search.tsx:236-243` | Position as sibling (contact/compare buttons already do this) |
| U9 | Async results not announced: result count / "تحديث…" lacks `aria-live`; autocomplete & city combobox lack `aria-controls`/`aria-activedescendant`/`role=option` | Medium | `map-search.tsx:188-191`; `search-autocomplete.tsx:124-133`; `city-combobox.tsx:74-83` | `aria-live="polite"` + proper listbox semantics |
| U10 | `/post` step 2 location is map-only (pin drag) — no keyboard/manual alternative (WCAG 2.1.1) | Medium | `location-picker.tsx:23-35`; `post/page.tsx:255-267` | Expose "استخدم مركز الحي" as explicit choice / arrow-key nudging |
| U11 | Touch targets < 44 px: theme toggle / favorites link / favorite overlay 36 px, gallery dots 8 px, map selected-card close X ~16 px **and unlabeled**; live count: 59 sub-40px targets on `/search` @390 | Medium | `theme-toggle.tsx:32`; `favorite-button.tsx:47`; `listing-gallery.tsx:103`; `map-search.tsx:283`; live probe | Bump to 44 px hit areas; add `aria-label="إغلاق"` |
| U12 | Microcopy register mixing: Egyptian "هنتواصل معك" next to Saudi colloquial and MSA; "اضغط Enter للبحث" (meaningless on touch); brand alternates "تمكين العقارية"/"تمكين عقار"; advisor contact is a personal gmail.com | Medium | `contracts/page.tsx:347`; `map-search.tsx:215,224`; `search-autocomplete.tsx:148`; `listing/[id]/page.tsx:24,29` vs `[city]/page.tsx:19` | One register (Saudi-friendly MSA), one brand string, branded email |
| U13 | Review textarea unstyled on `/advertiser/[id]` (`.inp` class defined only in other pages' styled-jsx) | Medium | `office-reviews.tsx:121` vs `post/page.tsx:361` | Move `.inp` to `store.css` |
| U14 | Light-mode focus ring `#B8923E` ≈ 2.9:1 — marginally below the 3:1 non-text minimum (dark mode passes) | Low | `store.css:72-75` | Darken to `--aqar-bronze-d` or add white offset |
| U15 | Digit-system inconsistencies (Arabic-Indic hero price & gallery labels vs Latin elsewhere); lightbox counter "1 / 5" vs Arabic-Indic aria-labels | Low | `lib/aqar-format.ts:22-28,52-54`; `listing-gallery.tsx:102,136` | Document the rule; align gallery counter |
| U16 | Phone/OTP inputs lack `type="tel"` / `inputMode="numeric"` / `autocomplete="one-time-code"`; mortgage monthly figure unformatted | Low | `post/page.tsx:206,213`; `mortgage-calc.tsx:55-57` | Add attributes; `formatNumber` |
| U17 | Compare table: label column not sticky during horizontal scroll on mobile | Low | `compare/page.tsx:84-86` | Sticky `th[scope=row]` |
| U18 | Filter changes use `replaceState` → back button exits `/search` instead of stepping back through filters | Low | `map-search.tsx:61` | `pushState` for discrete filter commits |

**What's genuinely strong (worth telling the client):** RTL is near-flawless (logical properties throughout, RTL-correct chevrons/keyboard arrows, `dir="ltr"`-wrapped phone numbers); one `h1` per page with proper landmarks; global `:focus-visible` ring that outranks all `outline-none` utilities (live-verified); every empty state (favorites/compare/saved-searches/search ×2/offices) exists with helpful Arabic copy and CTAs; `aqar-btn` enforces 44 px min-height and contact CTAs are 48 px; `prefers-reduced-motion` respected; `/post` has localStorage draft auto-save/restore, preserved back/forward state, a WhatsApp help escape hatch per step; filters fully restore from URL (SSR); the gallery is a complete carousel with Arabic aria-labels; toasts use `role="status"`.

---

## Top-Priority Action List (ordered by client-delivery risk)

1. **[Security/Critical — Backend]** Disable the `123456` OTP bypass: default `otp_test_mode` OFF, fail closed without a configured SMS provider, stop returning `test_mode` to clients (S1, S5). *Without this, anyone can publish listings as any phone number.*
2. **[Security/High — Backend]** Add OTP verify-attempt lockout + ≥6-digit codes, and per-IP request throttle (S2, S6) — ship together with #1.
3. **[UX/Critical — Frontend]** Fix or remove dark mode: Tailwind `darkMode` selector mismatch + dark-token text contrast (U1). It currently does nothing visually and would ship broken.
4. **[Security/High — Frontend]** Bump Next.js + lodash (and the rest of `npm audit`); remove the `ACAO:* + credentials` header combo (S3, S4).
5. **[UX/High — Frontend]** Stop rendering backend failures as "no listings"/404 — add `error.tsx` + `loading.tsx` and rethrow in `frappe-server.ts` (U2). A flaky backend on demo day currently looks like an empty product.
6. **[Trust/Medium — Backend/Product]** Decide on REGA/Nafath: wire real verification or hide "موثّق" badges before delivery (S8); remove `allow_tests`/`test_purge_token` from the production site config (S10).
7. **[Perf/Critical — Frontend]** Scope `Providers`/`Toaster` to the ERP layout and put fonts on a diet (P1, P2, P12) — the two biggest levers for the 26–44 mobile scores.
8. **[UX/High — Frontend]** Contrast pass: kohl-opacity body text → `--aqar-muted`, darken WhatsApp/clay/gold (U3, U4) — also lifts Lighthouse a11y to ~100.
9. **[Perf/High — Frontend+Ops]** `Cache-Control` for `/files/` (one nginx line), AbortController in map-search, eager-load first-row images, gallery `srcset` renditions, reserve results-column height to kill the /search CLS (P3–P6).
10. **[UX/High — Frontend]** `/post` form accessibility & validation clarity (labels, per-field errors, `role="alert"`, stepper semantics) — the legally-sensitive, low-literacy-audience flow (U5).
11. **[Security/Medium — Frontend]** Enforce CSP (nonce the theme script, drop `unsafe-eval`); validate the login `redirect` param (S7, S12).
12. **[UX/Medium — Frontend]** Polish batch: skip link, dialog focus management, unlabeled close button, 44 px touch targets, microcopy unification (U6–U12).

*Items 1, 2, 3, 5 and the OTP-related parts of 6 are the true delivery blockers; everything else is strongly recommended but shippable-after.*
