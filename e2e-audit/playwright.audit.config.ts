import { defineConfig } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'

/**
 * تمكين HR — READ-ONLY prod audit suite (App A admin + App B employee).
 *
 * Separate from the repo's local-dev e2e config on purpose:
 *  - No webServer — targets a deployed environment (default: prod qarawi;
 *    override with AUDIT_BASE_URL, e.g. https://staging.base.meena.sa).
 *  - Auth via storage state ONLY (never types credentials). Build it with
 *    `node e2e-audit/build-state.mjs` — see e2e-audit/README.md.
 *  - Every context gets a network-layer MUTATION BLOCKER (helpers/audit.ts):
 *    write-shaped API calls are aborted + logged, so the suite is hard-
 *    guaranteed non-destructive even if a click goes wrong.
 *
 * Run from the repo root:
 *   npx playwright test -c e2e-audit/playwright.audit.config.ts
 */

const BASE_URL = process.env.AUDIT_BASE_URL || 'https://qarawi.base.meena.sa'
const STATE = path.resolve(__dirname, '.auth/state.json')

export default defineConfig({
  testDir: path.resolve(__dirname, 'tests'),
  outputDir: path.resolve(__dirname, 'report/artifacts'),
  globalSetup: path.resolve(__dirname, 'global-setup.ts'),

  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 3,
  timeout: 120_000,
  globalTimeout: 20 * 60_000,

  reporter: [
    ['list'],
    ['json', { outputFile: path.resolve(__dirname, 'report/playwright-results.json') }],
  ],

  use: {
    baseURL: BASE_URL,
    ...(fs.existsSync(STATE) ? { storageState: STATE } : {}),
    locale: 'ar',
    timezoneId: 'Asia/Riyadh',
    // Allows running under root (server-side execution) — no sandbox available.
    launchOptions: { chromiumSandbox: false },
    viewport: { width: 1440, height: 900 },
    screenshot: { mode: 'only-on-failure', fullPage: true },
    video: 'off',
    trace: 'off',
    // Prod is behind TLS with real certs; keep strict.
    ignoreHTTPSErrors: false,
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
  },

  projects: [
    { name: 'chromium' },
  ],
})
