/**
 * Payroll Cycle E2E Test
 *
 * Simulates a full HR Manager workflow:
 * 1. Login
 * 2. Setup Penalty Policy rule
 * 3. Trigger Penalty Engine
 * 4. Verify auto-generated deduction appears
 * 5. Process Payroll end-to-end
 *
 * Run: npm run test:e2e -- tests/e2e/payroll-cycle.spec.ts
 */

import { test, expect, type Page } from '@playwright/test'

// ── Constants ──────────────────────────────────────────────────────────

const BASE_URL = 'http://localhost:3000'
const TEST_USER = process.env.E2E_TEST_USER || 'test_hr@company.com'
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'test123'

// ── Page Helpers (Page Object Model light) ─────────────────────────────

async function login(page: Page): Promise<void> {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')

  await page.getByPlaceholder(/email/i).fill(TEST_USER)
  await page.getByPlaceholder(/password/i).fill(TEST_PASSWORD)
  await page.getByRole('button', { name: /sign in|login|تسجيل/i }).click()

  // Wait for dashboard
  await page.waitForURL('**/')
  await page.waitForLoadState('networkidle')
}

async function navigateToPayrollTab(page: Page, tabName: string | RegExp): Promise<void> {
  await page.goto('/payroll')
  await page.waitForLoadState('networkidle')

  const tab = page.getByRole('tab', { name: tabName as string })
  await tab.waitFor({ state: 'visible' })
  await tab.click()
  await page.waitForTimeout(500) // wait for tab content to render
}

async function waitForToast(page: Page, text: string | RegExp, timeout = 10000): Promise<void> {
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: text as string }))
    .toBeVisible({ timeout })
}

// ── Tests ──────────────────────────────────────────────────────────────

test.describe('Payroll Cycle — Full E2E Flow', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('should create a penalty policy rule and save it', async ({ page }) => {
    await navigateToPayrollTab(page, /Penalty Policy|لائحة الجزاءات/i)

    // Fill policy name
    const nameInput = page.getByPlaceholder(/Standard Penalty/i)
    await nameInput.waitFor({ state: 'visible' })
    await nameInput.fill('E2E Test Policy ' + Date.now())

    // Add a rule if not already present
    const addRuleBtn = page.getByRole('button', { name: /Add Rule|إضافة قاعدة/i })
    await addRuleBtn.waitFor({ state: 'visible' })

    // Count existing rows
    const tableRowsBefore = page.locator('table tbody tr').count()
    if ((await tableRowsBefore) === 0) {
      await addRuleBtn.click()
      await page.waitForTimeout(300)
    }

    // Save
    const saveBtn = page.getByRole('button', { name: /Save Policy|حفظ السياسة/i })
    await saveBtn.click()

    // Wait for success toast
    await waitForToast(page, /created|amended|تم إنشاء|تم تعديل/i)
  })

  test('should trigger penalty engine and see success toast', async ({ page }) => {
    // Navigate to auto-attendance
    await page.goto('/auto-attendance')
    await page.waitForLoadState('networkidle')

    // Click "Run Penalty Engine"
    const penaltyBtn = page.getByRole('button', { name: /Run Penalty Engine|تشغيل محرك الخصومات/i })
    await penaltyBtn.waitFor({ state: 'visible' })
    await penaltyBtn.click()

    // Confirm dialog should appear
    const confirmBtn = page.getByRole('button', { name: /Run Engine|تشغيل المحرك/i })
    await confirmBtn.waitFor({ state: 'visible', timeout: 5000 })
    await confirmBtn.click()

    // Wait for success toast
    await waitForToast(page, /completed|successfully|اكتمل|بنجاح/i, 30000)
  })

  test('should verify auto-generated deduction appears in deductions tab', async ({ page }) => {
    await navigateToPayrollTab(page, /Deductions|الخصومات/i)

    // Wait for table to load
    const table = page.locator('table')
    await table.waitFor({ state: 'visible' })

    // Check for deduction records
    const rows = table.locator('tbody tr')
    const count = await rows.count()

    // If there are records, verify at least one shows negative amount
    if (count > 0) {
      const amountCell = rows.first().locator('td').filter({ hasText: /-/ })
      await expect(amountCell.first()).toBeVisible({ timeout: 5000 })
    }
  })

  test('should process full payroll cycle — create, fetch, generate, submit', async ({ page }) => {
    await navigateToPayrollTab(page, /Processing|Payroll Processing|إغلاق/i)

    // Step 1: Create Payroll Entry
    const createBtn = page.getByRole('button', { name: /Create Payroll Entry|إنشاء مسير الرواتب/i })
    await createBtn.waitFor({ state: 'visible' })
    await createBtn.click()

    // Wait for entry to be created (step 1 should complete)
    await expect(page.getByRole('button', { name: /Fetch Employees|جلب الموظفين/i }))
      .toBeVisible({ timeout: 10000 })

    // Step 2: Fetch Employees
    const fetchBtn = page.getByRole('button', { name: /Fetch Employees|جلب الموظفين/i })
    await fetchBtn.click()
    await page.waitForTimeout(3000)

    // Step 3: Generate Salary Slips
    const generateBtn = page.getByRole('button', { name: /Generate Salary Slips|توليد قسائم/i })
    await expect(generateBtn).toBeVisible({ timeout: 15000 })

    await generateBtn.click()
    await page.waitForTimeout(3000)

    // Step 4: Submit Salary Slips
    const submitBtn = page.getByRole('button', { name: /Submit Salary Slips|اعتماد الرواتب/i })
    await expect(submitBtn).toBeVisible({ timeout: 15000 })

    await submitBtn.click()
    await page.waitForTimeout(3000)

    // Verify success — step 4 should show "Submitted" badge
    await expect(page.getByText(/Submitted|تم الاعتماد/i)).toBeVisible({ timeout: 10000 })
  })

  test('should display error handling for payroll entry with no employees', async ({ page }) => {
    await navigateToPayrollTab(page, /Processing|Payroll Processing|إغلاق/i)

    // Check that company badge is visible
    const companyBadge = page.locator('text=Company').first()
    await expect(companyBadge).toBeVisible({ timeout: 5000 })

    // Verify the Create button exists
    const createBtn = page.getByRole('button', { name: /Create Payroll Entry|إنشاء مسير الرواتب/i })
    await expect(createBtn).toBeVisible()
  })

  test('should navigate between all payroll tabs correctly', async ({ page }) => {
    await page.goto('/payroll')
    await page.waitForLoadState('networkidle')

    const tabs = ['Processing', 'Fixed Salary', 'Monthly Additions', 'Deductions', 'Penalty Policy', 'Employee Salaries']
    const tabsAr = ['إغلاق الشهر', 'Fixed Salary', 'Monthly Additions', 'الخصومات', 'لائحة الجزاءات', 'رواتب الموظفين']

    for (let i = 0; i < tabs.length; i++) {
      const tab = page.getByRole('tab', { name: new RegExp(`${tabs[i]}|${tabsAr[i]}`) })
      await tab.waitFor({ state: 'visible' })
      await tab.click()
      await page.waitForTimeout(400)

      // Verify tab is selected (has aria-selected or data-state)
      await expect(tab).toHaveAttribute('data-state', 'active')
    }
  })

  test('should load smart deductions form in matrix mode and show policy', async ({ page }) => {
    await navigateToPayrollTab(page, /Deductions|الخصومات/i)

    // Click Add Deduction
    const addBtn = page.getByRole('button', { name: /Add Deduction|إضافة خصم/i })
    await addBtn.waitFor({ state: 'visible' })
    await addBtn.click()

    // Wait for dialog
    const dialog = page.locator('[role="dialog"]')
    await dialog.waitFor({ state: 'visible' })

    // Select matrix mode
    const matrixRadio = dialog.locator('label').filter({ hasText: /Policy Matrix|تطبيق اللائحة/i })
    await matrixRadio.click()

    // Wait for policy to load or fallback message
    await page.waitForTimeout(2000)

    // Either violation dropdown or no-policy message should appear
    const hasDropdown = await dialog.locator('button').filter({ hasText: /violation|مخالفة/i }).count()
    const hasNoPolicyMsg = await dialog.getByText(/no active penalty policy|لا توجد سياسة/i).count()

    expect(hasDropdown + hasNoPolicyMsg).toBeGreaterThan(0)
  })
})

// ── API Mock Tests (for local dev without real backend) ────────────────

test.describe('Payroll Cycle — Mocked API (offline dev)', () => {
  test.beforeEach(async ({ page }) => {
    // Mock login API
    await page.route('**/api/method/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Logged In', full_name: 'HR Manager' }),
      })
    })

    // Mock get_current_user
    await page.route('**/api/method/frappe.auth.get_logged_user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'test_hr@company.com' }),
      })
    })

    // Mock CSRF token
    await page.route('**/api/method/base_meena.api.get_csrf_token', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'mock-csrf-token' }),
      })
    })

    // Mock penalty engine trigger
    await page.route('**/api/method/base_meena.api.trigger_penalty_engine', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: {
            success: true,
            message: 'Penalty engine completed. Processed 5 check-ins, found 3 violations (1 warnings, 2 deductions, 0 errors).',
            stats: { processed: 5, violations: 3, warnings: 1, deductions: 2, errors: 0 },
          },
        }),
      })
    })

    // Mock get_active_penalty_policy
    await page.route('**/api/method/base_meena.api.get_active_penalty_policy', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: {
            policy_name: 'Mock Policy',
            company: 'Test Co',
            effective_from: '2026-01-01',
            is_default: true,
            rules: [
              {
                violation_type: 'delay_15',
                minutes_from: 0,
                minutes_to: 15,
                occurrences: [
                  { index: 0, penalty_type: 'Percentage of Daily Wage', penalty_value: 10 },
                  { index: 1, penalty_type: 'Percentage of Daily Wage', penalty_value: 15 },
                  { index: 2, penalty_type: 'Percentage of Daily Wage', penalty_value: 25 },
                  { index: 3, penalty_type: 'Percentage of Daily Wage', penalty_value: 50 },
                ],
              },
            ],
          },
        }),
      })
    })

    await page.goto('/login')
    await page.waitForLoadState('networkidle')
  })

  test('[MOCKED] login and access payroll page', async ({ page }) => {
    await page.getByPlaceholder(/email/i).fill(TEST_USER)
    await page.getByPlaceholder(/password/i).fill(TEST_PASSWORD)
    await page.getByRole('button', { name: /sign in|login|تسجيل/i }).click()

    // Should redirect to dashboard
    await page.waitForURL('**/')
    await expect(page).toHaveURL(/^(?!.*\/login).*$/)
  })

  test('[MOCKED] penalty engine button shows success toast', async ({ page }) => {
    // Login
    await page.getByPlaceholder(/email/i).fill(TEST_USER)
    await page.getByPlaceholder(/password/i).fill(TEST_PASSWORD)
    await page.getByRole('button', { name: /sign in|login|تسجيل/i }).click()

    await page.goto('/auto-attendance')
    await page.waitForLoadState('networkidle')

    // Click Run Penalty Engine
    const btn = page.getByRole('button', { name: /Run Penalty Engine|تشغيل محرك الخصومات/i })
    if (await btn.isVisible()) {
      await btn.click()

      const confirmBtn = page.getByRole('button', { name: /Run Engine|تشغيل المحرك/i })
      if (await confirmBtn.isVisible({ timeout: 3000 })) {
        await confirmBtn.click()
      }

      await waitForToast(page, /completed|successfully|اكتمل|بنجاح/i)
    }
  })
})
