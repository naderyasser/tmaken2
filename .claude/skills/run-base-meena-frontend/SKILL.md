---
name: run-base-meena-frontend
description: Build, launch, screenshot, and drive the base-meena-frontend web app (تمكين العقارية real-estate storefront + admin dashboard — Next.js + Frappe API). Use when asked to run, start, screenshot, smoke-test, or verify the storefront or the real-estate dashboard.
---

# Run base-meena-frontend (تمكين العقارية storefront + dashboard)

A Next.js app that serves TWO surfaces from one build: the public **storefront**
(RTL Arabic marketplace) and the authenticated **real-estate admin dashboard**. It
talks to a Frappe backend (`base_meena` app on the `qarawi` site). The app is
**already running** in this container under systemd (`:3000`) + nginx vhosts.

Drive it with the committed **Playwright driver** — `.claude/skills/run-base-meena-frontend/driver.mjs`
— which screenshots the running app. Playwright is the project's own e2e dep, so no
extra tooling. Paths below are relative to `base-meena-frontend/`.

## Prerequisites
The app runs under process managers already:
```bash
systemctl is-active base-meena-frontend.service        # Next.js :3000  → "active"
sudo supervisorctl status frappe-dev-web               # Frappe API     → "RUNNING"
```
On a fresh machine, install the chromium the driver/e2e use (idempotent):
```bash
npx playwright install chromium
```

## Run — agent path (screenshot the storefront)
```bash
node .claude/skills/run-base-meena-frontend/driver.mjs
```
Smokes the storefront's key pages (`/`, `/search`, `/contracts`), checks a sentinel
string on each, and writes PNGs to `.claude/skills/run-base-meena-frontend/shots/`.
Prints `SMOKE: PASS`/`FAIL` and exits non-zero on failure. Screenshot one URL:
```bash
node .claude/skills/run-base-meena-frontend/driver.mjs http://localhost:8080/investment investment.png
```
Then **look** at the PNG in `shots/` — a real render shows the espresso/cream RTL UI
with listing cards; blank or an error page means the app isn't up (see Troubleshooting).

## Run — full user flows (Playwright e2e)
Guest storefront flows (no login) against the marketplace host:
```bash
STORE_URL=http://localhost:8080 npx playwright test e2e/real-estate-contracts.spec.ts --project=chromium
```
Teardown of test writes needs the purge token (reads it from site config, never echoed):
```bash
TEST_PURGE_TOKEN=$(python3 -c "import json;print(json.load(open('/home/frappeuser/frappe-dev/sites/qarawi/site_config.json'))['test_purge_token'])") \
  STORE_URL=http://localhost:8080 npx playwright test e2e/real-estate-reviews.spec.ts --project=chromium
```
Authenticated **dashboard** flow (in-dashboard contract detail + status update) lives in
`e2e/real-estate-admin-requests.spec.ts`; it needs a System Manager login and runs against
the dashboard host (gated — skips without creds):
```bash
DASH_URL=https://qarawi.base.meena.sa DASH_USER=<sysmgr-email> DASH_PWD=<pwd> \
  npx playwright test e2e/real-estate-admin-requests.spec.ts --project=chromium
```

## Drive the backend directly (no `bench` CLI here)
Poke the API/DB through the venv python (run from `sites/`):
```bash
cd /home/frappeuser/frappe-dev/sites && sudo -u frappeuser /home/frappeuser/frappe-dev/env/bin/python -c "
import frappe; frappe.init(site='qarawi', sites_path='.'); frappe.connect()
print('active listings:', frappe.db.count('Aqar Listing', {'status':'Active'}))"
```
Guest API endpoints are also reachable over the vhost:
```bash
curl -s "http://localhost:8080/api/method/base_meena.real_estate.aqar_public_api.list_categories" | head -c 200
```

## Run — human path
`npm run dev` opens a dev server and blocks; useless headless. To ship a change to the
running app: build, then **restart** (a build alone breaks the live server — see Gotchas):
```bash
npm run build
sudo systemctl restart base-meena-frontend.service     # reload :3000
sudo supervisorctl restart 'frappe-dev-web:*'          # reload Frappe Python (only if backend changed)
```

## Gotchas (battle scars)
- **Two hosts, and the dashboard is NOT on :8080.** The storefront host
  `http://localhost:8080` runs in "marketplace mode" — middleware rewrites every path to
  `/store/*`, so `/real-estate` 404s there. The dashboard lives on a non-marketplace host
  that also proxies `/api`: **`https://qarawi.base.meena.sa/real-estate`**. (`:3000` direct
  renders the dashboard page but has no `/api` proxy, so its data calls fail.)
- **`npm run build` breaks the live server until you restart.** Building overwrites `.next`
  while the running `next start` still references old chunk hashes → pages throw a
  client-side exception (ChunkLoadError). Always `systemctl restart base-meena-frontend.service`
  after a build. (Symptom seen as a Playwright "Application error: a client-side exception"
  snapshot.)
- **No `bench` command.** Use `sudo -u frappeuser /home/frappeuser/frappe-dev/env/bin/python`
  with `frappe.init(site='qarawi', sites_path='.')` + `frappe.connect()` from `sites/`. Install
  a new/changed DocType with `frappe.reload_doc('real_estate','doctype','<name>')` then
  `sudo supervisorctl restart 'frappe-dev-web:*'` to load new Python.
- **Dashboard defaults to English per session user.** The Arabic/RTL view appears after
  clicking the **"العربية"** toggle in the header (the admin e2e does this before asserting).
- **e2e write safety.** All lead/review/contract writes carry the `tamkeen-e2e.test` marker
  (→ `is_test=1`, exempt from throttle + admin email) and are deleted by token-gated
  `purge_test_*` endpoints in `afterAll`. Don't write real data; always purge.
- **Off-limits:** never touch `/root/egarsys` or its Postgres `:5432`, and never change nginx
  `:443` (wildcard-cert trap). Push via the frappeuser SSH key (`GIT_SSH_COMMAND` with
  `/home/frappeuser/.ssh/id_rsa`); no CI auto-deploy.

## Troubleshooting
- Driver prints `SMOKE: FAIL` / non-200 → app down: `sudo systemctl restart base-meena-frontend.service`
  (and `sudo supervisorctl restart 'frappe-dev-web:*'` if `/api` calls fail).
- Screenshot shows "Application error: a client-side exception" → stale `.next` after a build;
  restart `:3000` (see Gotchas).
- Dashboard URL 404 / redirects to storefront → you used `:8080`; use `https://qarawi.base.meena.sa/real-estate`.
- e2e teardown 403 → wrong/missing `TEST_PURGE_TOKEN` (must match `site_config.json` `test_purge_token`).
