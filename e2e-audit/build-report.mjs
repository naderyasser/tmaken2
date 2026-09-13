// Post-process the audit run into report/report.json + report/report.md.
//   node e2e-audit/build-report.mjs
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const here = path.dirname(fileURLToPath(import.meta.url))
const rep = (f) => path.join(here, 'report', f)

const findings = fs
  .readFileSync(rep('findings.ndjson'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l))

const meta = fs.existsSync(rep('run-meta.json')) ? JSON.parse(fs.readFileSync(rep('run-meta.json'), 'utf8')) : {}
const mutations = fs.existsSync(rep('mutations-blocked.ndjson'))
  ? fs.readFileSync(rep('mutations-blocked.ndjson'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  : []

// Map test → failure screenshots from the playwright JSON reporter.
const shots = {}
try {
  const pw = JSON.parse(fs.readFileSync(rep('playwright-results.json'), 'utf8'))
  const walk = (suite) => {
    for (const s of suite.suites || []) walk(s)
    for (const spec of suite.specs || []) {
      for (const t of spec.tests || []) {
        for (const r of t.results || []) {
          const atts = (r.attachments || []).filter((a) => a.contentType === 'image/png' && a.path)
          if (atts.length) shots[spec.title] = atts.map((a) => path.relative(here, a.path))
        }
      }
    }
  }
  for (const s of pw.suites || []) walk(s)
} catch {}

const order = { fail: 0, warn: 1, pass: 2 }
findings.sort((a, b) => a.app.localeCompare(b.app) || a.screen.localeCompare(b.screen) || order[a.status] - order[b.status])

const counts = { pass: 0, warn: 0, fail: 0 }
const byCheck = {}
for (const f of findings) {
  counts[f.status]++
  byCheck[f.check] = byCheck[f.check] || { pass: 0, warn: 0, fail: 0 }
  byCheck[f.check][f.status]++
}

const screens = [...new Set(findings.map((f) => `${f.app}|${f.screen}`))]

const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ')
let md = `# تمكين HR — Test & UX Audit Report\n\n`
md += `- **Target:** ${meta.baseURL || '?'} — authenticated as \`${meta.user || '?'}\`\n`
md += `- **Run:** ${meta.startedAt || '?'} · **Screens audited:** ${screens.length} · **Checks:** ${findings.length}\n`
md += `- **Totals:** ✅ pass ${counts.pass} · ⚠️ warn ${counts.warn} · ❌ fail ${counts.fail}\n`
md += `- **Blocked mutation attempts (read-only guard):** ${mutations.length}\n\n`

md += `## Results by check\n\n| Check | pass | warn | fail |\n|---|---:|---:|---:|\n`
for (const [c, v] of Object.entries(byCheck).sort((a, b) => b[1].fail - a[1].fail || b[1].warn - a[1].warn)) {
  md += `| ${c} | ${v.pass} | ${v.warn} | ${v.fail} |\n`
}

for (const app of ['A', 'B']) {
  md += `\n## App ${app} — ${app === 'A' ? 'Admin Dashboard / HR back-office' : 'HRMS Employee app (/me)'}\n\n`
  md += `| Screen | Check | Status | Details |\n|---|---|---|---|\n`
  for (const f of findings.filter((x) => x.app === app && x.status !== 'pass')) {
    const icon = f.status === 'fail' ? '❌' : '⚠️'
    md += `| ${esc(f.screen)} | ${esc(f.check)} | ${icon} ${f.status} | ${esc(f.details).slice(0, 220)} |\n`
  }
  const passOnly = findings.filter((x) => x.app === app && x.status === 'pass').length
  md += `\n*…plus ${passOnly} passing checks (see report.json).*\n`
}

if (Object.keys(shots).length) {
  md += `\n## Failure screenshots\n\n`
  for (const [t, ps] of Object.entries(shots)) md += `- **${esc(t)}** → ${ps.join(' , ')}\n`
}
if (mutations.length) {
  md += `\n## Mutation attempts blocked by the read-only guard\n\n`
  for (const m of mutations.slice(0, 20)) md += `- \`${m.method}\` ${esc(m.path)} (test: ${esc(m.label)})\n`
}

fs.writeFileSync(rep('report.json'), JSON.stringify({ meta, counts, byCheck, findings, mutationsBlocked: mutations, screenshots: shots }, null, 2))
fs.writeFileSync(rep('report.md'), md)
console.log(`report written: e2e-audit/report/report.md (+ report.json) — screens=${screens.length} pass=${counts.pass} warn=${counts.warn} fail=${counts.fail}`)
