import * as fs from 'fs'
import * as path from 'path'

/**
 * Auth gate — the task contract is "assume an authenticated Administrator
 * session; if not authenticated, STOP and report". We verify the storage
 * state BEFORE any test runs and abort the whole run with a clear message
 * if the session is missing/expired. No credentials are ever typed.
 */
export default async function globalSetup() {
  const stateFile = path.resolve(__dirname, '.auth/state.json')
  const baseURL = process.env.AUDIT_BASE_URL || 'https://qarawi.base.meena.sa'

  if (!fs.existsSync(stateFile)) {
    throw new Error(
      `AUTH-STOP: no storage state at e2e-audit/.auth/state.json.\n` +
        `Build it (no credentials typed) with:  node e2e-audit/build-state.mjs\n` +
        `— see e2e-audit/README.md for the session-provisioning options.`,
    )
  }

  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
  const sid = (state.cookies || []).find((c: any) => c.name === 'sid')?.value
  if (!sid) throw new Error('AUTH-STOP: storage state has no sid cookie.')

  const res = await fetch(`${baseURL}/api/method/frappe.auth.get_logged_user`, {
    headers: { Cookie: `sid=${sid}` },
  })
  let user = ''
  try {
    user = ((await res.json()) as any)?.message || ''
  } catch {
    /* fallthrough */
  }
  if (res.status !== 200 || !user || user === 'Guest') {
    throw new Error(
      `AUTH-STOP: storage state is not an authenticated session on ${baseURL} ` +
        `(HTTP ${res.status}, user="${user || 'Guest'}"). Rebuild it and retry.`,
    )
  }

  // Never print the sid — only the resolved identity.
  console.log(`[audit] authenticated as: ${user} @ ${baseURL}`)

  const meta = {
    baseURL,
    user,
    startedAt: new Date().toISOString(),
  }
  const reportDir = path.resolve(__dirname, 'report')
  fs.mkdirSync(reportDir, { recursive: true })
  fs.writeFileSync(path.join(reportDir, 'run-meta.json'), JSON.stringify(meta, null, 2))
  // Fresh findings log per run.
  fs.writeFileSync(path.join(reportDir, 'findings.ndjson'), '')
  fs.writeFileSync(path.join(reportDir, 'mutations-blocked.ndjson'), '')
}
