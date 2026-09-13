// Build Playwright storage state from a session id file — WITHOUT ever
// printing the sid. The sid file is produced server-side by the operator
// (see README: bench console < /home/frappeuser/mint_audit_session.py),
// so no credentials are typed anywhere.
//
//   node e2e-audit/build-state.mjs
//
// Env: AUDIT_HOST (default qarawi.base.meena.sa)
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const here = path.dirname(fileURLToPath(import.meta.url))
const host = process.env.AUDIT_HOST || 'qarawi.base.meena.sa'
const sidFile = path.join(here, '.auth/sid.txt')
const stateFile = path.join(here, '.auth/state.json')

if (!fs.existsSync(sidFile)) {
  console.error(`NO-SID: ${sidFile} not found. Run the mint script first (see README).`)
  process.exit(2)
}
const sid = fs.readFileSync(sidFile, 'utf8').trim()
if (!sid) {
  console.error('NO-SID: sid file is empty.')
  process.exit(2)
}

const state = {
  cookies: [
    {
      name: 'sid',
      value: sid,
      domain: host,
      path: '/',
      expires: Math.floor(Date.now() / 1000) + 7 * 86400,
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ],
  origins: [],
}
fs.mkdirSync(path.dirname(stateFile), { recursive: true })
fs.writeFileSync(stateFile, JSON.stringify(state))
fs.chmodSync(stateFile, 0o600)

const res = await fetch(`https://${host}/api/method/frappe.auth.get_logged_user`, {
  headers: { Cookie: `sid=${sid}` },
})
let user = ''
try {
  user = (await res.json())?.message || ''
} catch {}
console.log(`AUTH-CHECK http=${res.status} user=${user || 'Guest'}`)
process.exit(res.status === 200 && user && user !== 'Guest' ? 0 : 1)
