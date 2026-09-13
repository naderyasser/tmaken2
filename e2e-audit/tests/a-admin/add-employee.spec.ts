import * as fs from 'fs'
import * as path from 'path'
import { test, expect } from '../../helpers/audit'
import { record } from '../../helpers/audit'

/**
 * APP A — /employee/new focused test. Fills required fields ONLY to drive the
 * tracker to 6/6, then CANCELS. Never clicks Save; the mutation blocker would
 * abort any Employee creation anyway, and we assert the app never even tried.
 */

const MUTATIONS = path.resolve(__dirname, '../../report/mutations-blocked.ndjson')
const SCREEN = 'نموذج إضافة موظف (/employee/new)'

test('A › Add-Employee form: section nav, 2/6→6/6 tracker, cancel without persisting', async ({ audit, page }) => {
  test.setTimeout(180_000)
  await audit.visit('/employee/new')
  await audit.scan({ app: 'A', screen: SCREEN, path: '/employee/new', axe: true })

  // ── Section nav scrolls to the right section ─────────────────────────────
  const companyNav = page.locator('aside, [class*="side"], nav').locator('text=بيانات الشركة').first()
  let sectionNavWorks = false
  if (await companyNav.isVisible().catch(() => false)) {
    await companyNav.click().catch(() => {})
    await page.waitForTimeout(800)
    const target = page.locator('#section-company')
    if (await target.count()) {
      const box = await target.boundingBox()
      sectionNavWorks = !!box && box.y >= -50 && box.y < 500
    }
  }
  record({
    app: 'A', screen: SCREEN, path: '/employee/new', check: 'section-nav-scroll',
    status: sectionNavWorks ? 'pass' : 'warn',
    details: sectionNavWorks ? 'clicking بيانات الشركة scrolled #section-company into view' : 'section nav click did not bring the section into view',
  })

  // Scrollspy: does the active highlight track scroll position?
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(700)
  const activeAfterScroll = await page
    .locator('aside [class*="bg-"], nav [aria-current], nav [class*="active"]')
    .filter({ hasText: /عقد العمل|إعدادات العمل|بيانات التواصل/ })
    .count()
    .catch(() => 0)
  record({
    app: 'A', screen: SCREEN, path: '/employee/new', check: 'section-nav-scrollspy',
    status: activeAfterScroll > 0 ? 'pass' : 'warn',
    details: activeAfterScroll > 0 ? 'active section highlight follows scroll' : 'no scrollspy — highlight does not follow scroll position',
  })
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(400)

  // ── Tracker: read initial N/6 ────────────────────────────────────────────
  const counter = page.locator('text=/^\\d\\/6$/').first()
  await expect(counter, 'required-fields counter visible').toBeVisible({ timeout: 10_000 })
  const initial = ((await counter.innerText()) || '').trim()

  const fill = async () => {
    // First name
    await page.locator('[data-field="first_name"] input').fill('اختبار تجريبي')
    // Gender (native select)
    await page.locator('[data-field="gender"] select').selectOption('Male')
    // DOB via LocalizedDateInput popover
    await page.locator('[data-field="date_of_birth"] button').first().click()
    const dayCell = page.locator('[role="dialog"] [role="gridcell"] button:not([disabled])', { hasText: /^15$/ }).first()
    if (await dayCell.isVisible().catch(() => false)) {
      await dayCell.click()
    } else {
      await page.locator('[role="dialog"] button:not([disabled])', { hasText: /^15$/ }).first().click().catch(() => {})
    }
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForTimeout(400)
    // User email
    await page.locator('[data-field="user_email"] input').fill('qa.probe.donotcreate@example.com')
    await page.waitForTimeout(400)
  }
  await fill()

  const finalCount = ((await counter.innerText().catch(() => '')) || '').trim()
  const reached6 = finalCount === '6/6'
  record({
    app: 'A', screen: SCREEN, path: '/employee/new', check: 'tracker-increments',
    status: reached6 ? 'pass' : 'warn',
    details: `tracker ${initial} → ${finalCount} after filling الاسم الأول/الجنس/تاريخ الميلاد/بريد المستخدم`,
  })

  // Progress bar turns green only at 6/6
  const greenBar = await page.locator('[class*="bg-emerald-500"]').first().isVisible().catch(() => false)
  record({
    app: 'A', screen: SCREEN, path: '/employee/new', check: 'tracker-bar-green-at-complete',
    status: reached6 && greenBar ? 'pass' : reached6 ? 'warn' : 'warn',
    details: reached6 ? (greenBar ? 'bar is emerald at 6/6' : 'reached 6/6 but bar not emerald') : 'did not reach 6/6 — bar state not evaluated',
  })

  // Tracker items clickable → jumps to field
  const emailItem = page.locator('button', { hasText: 'بريد المستخدم' }).first()
  let jumpWorks = false
  if (await emailItem.isVisible().catch(() => false)) {
    await page.evaluate(() => window.scrollTo(0, 0))
    await emailItem.click().catch(() => {})
    await page.waitForTimeout(900)
    const box = await page.locator('[data-field="user_email"]').boundingBox().catch(() => null)
    jumpWorks = !!box && box.y > -50 && box.y < 700
  }
  record({
    app: 'A', screen: SCREEN, path: '/employee/new', check: 'tracker-item-jump',
    status: jumpWorks ? 'pass' : 'warn',
    details: jumpWorks ? 'clicking a tracker item scrolls/focuses its field' : 'tracker items are not clickable jump links',
  })

  // Inline (on-blur) validation on a required field
  const first = page.locator('[data-field="first_name"] input')
  await first.fill('')
  await first.blur().catch(() => {})
  await page.waitForTimeout(600)
  const inlineError = await page
    .locator('[data-field="first_name"] p.text-red-500, [data-field="first_name"] [class*="text-red"]')
    .first()
    .isVisible()
    .catch(() => false)
  record({
    app: 'A', screen: SCREEN, path: '/employee/new', check: 'inline-validation-on-blur',
    status: inlineError ? 'pass' : 'warn',
    details: inlineError ? 'required field shows error on blur' : 'no on-blur validation — errors only appear on save attempt',
  })
  await first.fill('اختبار تجريبي') // restore

  // ── Cancel without persisting ────────────────────────────────────────────
  page.once('dialog', (d) => d.accept().catch(() => {}))
  await page.locator('button', { hasText: 'إلغاء' }).first().click()
  await page.waitForTimeout(800)
  // Custom unsaved-changes dialog fallback
  const leaveBtn = page.locator('[role="alertdialog"] button, [role="dialog"] button', { hasText: /مغادرة|تجاهل|تأكيد|نعم|خروج/ }).first()
  if (await leaveBtn.isVisible().catch(() => false)) await leaveBtn.click().catch(() => {})
  await page.waitForURL(/\/employees(\?|$)/, { timeout: 10_000 }).catch(() => {})
  const left = /\/employees(\?|$)/.test(page.url())
  record({
    app: 'A', screen: SCREEN, path: '/employee/new', check: 'cancel-flow',
    status: left ? 'pass' : 'warn',
    details: left ? 'إلغاء returned to /employees' : `after cancel, url=${page.url()}`,
  })

  // Assert the app never even attempted an Employee create (belt & braces —
  // the blocker would have aborted it, and the log records any attempt).
  const mutLog = fs.existsSync(MUTATIONS) ? fs.readFileSync(MUTATIONS, 'utf8') : ''
  const employeeCreates = mutLog
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((m) => /\/api\/resource\/Employee\/?$/.test(m.path) || /employee.*(create|insert)/i.test(m.path))
  record({
    app: 'A', screen: SCREEN, path: '/employee/new', check: 'nothing-persisted',
    status: employeeCreates.length === 0 ? 'pass' : 'fail',
    details: employeeCreates.length === 0 ? 'no Employee create was attempted (and blocker was armed)' : JSON.stringify(employeeCreates),
  })
  expect(employeeCreates, 'no Employee creation attempts').toEqual([])
})
