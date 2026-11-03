# تمكين HR — read-only prod audit suite

Playwright suite auditing **App A** (admin back-office) and **App B** (employee
self-service `/me`) for functional health + the cross-cutting UX checks
(date-format consistency, localization leaks, icon-button labeling, money
formatting, RTL integrity, axe accessibility, empty-state quality).

**Hard read-only guarantee:** every browser context routes ALL requests through
a mutation blocker (`helpers/audit.ts`) — `PUT/DELETE/PATCH` and write-shaped
`POST`s (`save|submit|create|delete|approve|…`) are aborted and logged to
`report/mutations-blocked.ndjson`. Tests also never click Save/Submit.

## Auth (no credentials are ever typed)

The suite consumes a Playwright storage state at `e2e-audit/.auth/state.json`
holding an already-valid `sid` cookie. Build it one of two ways:

1. **Operator session mint (recommended)** — run on the server:

   ```bash
   su - frappeuser -c '/home/frappeuser/miniconda3/envs/frap/bin/bench --site qarawi console \
       < /home/frappeuser/mint_audit_session.py'
   node e2e-audit/build-state.mjs     # builds + validates .auth/state.json
   ```

   The mint script prefers a **fresh** Administrator session (only when
   `deny_multiple_sessions` is off, so it can never evict your browser
   session) and writes the sid to a 600-perm file without printing it.

2. **Manual browser copy** — log in normally in any browser, copy the `sid`
   cookie value into `e2e-audit/.auth/sid.txt`, then `node e2e-audit/build-state.mjs`.

If the state is missing/expired the run **stops before any test** with
`AUTH-STOP: …` (per the audit contract).

## Run

```bash
# from the repo root (base-meena-frontend)
npx playwright test -c e2e-audit/playwright.audit.config.ts          # everything
npx playwright test -c e2e-audit/playwright.audit.config.ts tests/a-admin
npx playwright test -c e2e-audit/playwright.audit.config.ts tests/b-employee

node e2e-audit/build-report.mjs      # → report/report.md + report.json
```

Env:

- `AUDIT_BASE_URL` — default `https://qarawi.base.meena.sa`
  (staging: `https://staging.base.meena.sa` — note it runs the older
  `feat/jisr-redesign` build against the canary site `test`).
- `AUDIT_HOST` — cookie domain for `build-state.mjs` (default qarawi).

## Outputs

- `report/findings.ndjson` — every check as `{app, screen, path, check, status, details}`
- `report/report.md` / `report.json` — aggregated matrix (fail/warn first)
- `report/playwright-results.json` — raw Playwright results
- `report/artifacts/**` — full-page screenshots for failures
- `report/mutations-blocked.ndjson` — anything the read-only guard stopped
