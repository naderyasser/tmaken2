import { test, expect } from '../../helpers/audit'
import { record } from '../../helpers/audit'

/**
 * APP B — HRMS Employee self-service app rooted at /me.
 *  - /me surface: greeting header, quick actions, stat cards, panels.
 *  - Each quick action: open its dialog, verify it renders form fields and a
 *    submit control, then CLOSE WITHOUT SUBMITTING.
 *  - Crawl in-app links found on /me (bounded) and audit each.
 *  - /profile regression: must never show the old "no employee record" error.
 */

test('B › رئيسيتي (/me) — surface, panels, quick-action dialogs', async ({ audit, page }) => {
  test.setTimeout(180_000)
  await audit.visit('/me')
  const { hard } = await audit.scan({ app: 'B', screen: 'رئيسيتي (/me)', path: '/me', axe: true })

  // Expected panels (Administrator has no Employee record — absence is recorded, not failed)
  for (const panel of ['طلباتي', 'صندوق الاعتمادات', 'أرصدة الإجازات', 'تنبيهات المستندات', 'الإعلانات']) {
    const present = await page.locator(`text=${panel}`).first().isVisible().catch(() => false)
    record({
      app: 'B', screen: 'رئيسيتي (/me)', path: '/me', check: 'panel-present',
      status: present ? 'pass' : 'warn',
      details: `${panel}: ${present ? 'rendered' : 'not visible (user has no Employee record — verify with a real employee account)'}`,
    })
  }

  // Quick actions — open ONE representative tile + the header "طلب جديد",
  // verify the request dialog renders, then close. NEVER click submit.
  for (const trigger of ['إجازة', 'طلب جديد']) {
    const btn = page.locator('button', { hasText: trigger }).first()
    if (!(await btn.isVisible().catch(() => false))) {
      record({ app: 'B', screen: 'رئيسيتي (/me)', path: '/me', check: 'quick-action', status: 'warn', details: `${trigger}: trigger not visible` })
      continue
    }
    await btn.click().catch(() => {})
    await page.waitForTimeout(900)
    const dialog = page.locator('[role="dialog"]').last()
    const open = await dialog.isVisible().catch(() => false)
    let fields = 0
    let hasSubmit = false
    if (open) {
      fields = await dialog.locator('input:visible, select:visible, textarea:visible, [role="combobox"]:visible').count().catch(() => 0)
      hasSubmit = await dialog.locator('button', { hasText: /إرسال|تقديم|حفظ/ }).first().isVisible().catch(() => false)
      // Close WITHOUT submitting: prefer إلغاء, fall back to X / Escape.
      const cancel = dialog.locator('button', { hasText: /إلغاء|إغلاق/ }).first()
      if (await cancel.isVisible().catch(() => false)) await cancel.click().catch(() => {})
      else await page.keyboard.press('Escape').catch(() => {})
      await page.waitForTimeout(500)
    }
    record({
      app: 'B', screen: 'رئيسيتي (/me)', path: '/me', check: 'quick-action-dialog',
      status: open && fields > 0 ? 'pass' : 'warn',
      details: `${trigger}: dialog=${open}, form fields=${fields}, submit control present=${hasSubmit} (closed without submitting)`,
    })
  }

  expect(hard.map((f) => `${f.check}: ${f.details}`), 'hard failures on /me').toEqual([])
})

test('B › crawl: employee-app sub-pages reachable from /me', async ({ audit, page }) => {
  test.setTimeout(240_000)
  await audit.visit('/me')
  const hrefs: string[] = await page.evaluate(() => {
    const seen = new Set<string>()
    document.querySelectorAll('main a[href], [class*="max-w"] a[href]').forEach((a) => {
      const h = a.getAttribute('href') || ''
      if (h.startsWith('/') && !h.startsWith('//')) seen.add(h.split('#')[0])
    })
    return Array.from(seen)
  })
  const skip = /^\/(hr(\?|\/|$)|employees|payroll|attendance|biometric|branches|org-chart|team$|hr-managers|employee-report|printview|app\b)/
  const targets = hrefs.filter((h) => h !== '/me' && !skip.test(h)).slice(0, 8)
  record({
    app: 'B', screen: 'رئيسيتي (/me)', path: '/me', check: 'crawl-scope',
    status: 'pass',
    details: `discovered ${hrefs.length} links; auditing: ${targets.join(' , ') || '(none beyond /me)'}`,
  })
  for (const t of targets) {
    await audit.resetNetLog()
    await audit.visit(t)
    await audit.scan({ app: 'B', screen: `فرعية: ${t}`, path: t, axe: true })
    await audit.walkTabs({ app: 'B', screen: `فرعية: ${t}`, path: t })
  }
})

test('B › /profile — must not dead-end for a non-employee account', async ({ audit, page }) => {
  await audit.visit('/profile')
  const { hard } = await audit.scan({ app: 'B', screen: 'ملفي الشخصي (/profile)', path: '/profile', axe: true })
  const deadEnd = await page.locator('text=لم يتم العثور على سجل موظف').first().isVisible().catch(() => false)
  record({
    app: 'B', screen: 'ملفي الشخصي (/profile)', path: '/profile', check: 'profile-dead-end-regression',
    status: deadEnd ? 'fail' : 'pass',
    details: deadEnd ? 'old error screen is back — regression of the M2 fix' : 'renders account view / profile (no error screen)',
  })
  expect(deadEnd, 'no "no employee record" dead-end').toBe(false)
  expect(hard.map((f) => `${f.check}: ${f.details}`), 'hard failures on /profile').toEqual([])
})

test('B › مركز الطلبات (/requests)', async ({ audit }) => {
  await audit.visit('/requests')
  const { hard } = await audit.scan({ app: 'B', screen: 'مركز الطلبات (/requests)', path: '/requests', axe: true })
  await audit.walkTabs({ app: 'B', screen: 'مركز الطلبات (/requests)', path: '/requests' })
  expect(hard.map((f) => `${f.check}: ${f.details}`), 'hard failures on /requests').toEqual([])
})
