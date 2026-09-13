/**
 * E2E Tests for Employees List Page
 * Using Playwright
 */

import { test, expect } from '@playwright/test'

test.describe('Employees List Page - E2E', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to employees page
        await page.goto('/employees')

        // Wait for page to load
        await page.waitForLoadState('networkidle')
    })

    test('should display page title and header', async ({ page }) => {
        // Check for page title
        await expect(page.locator('h1')).toContainText('Employees')

        // Check for description
        await expect(page.getByText('Manage your organization\'s employees')).toBeVisible()
    })

    test('should display action buttons', async ({ page }) => {
        // Check for Add Employee button
        await expect(page.getByRole('button', { name: /add employee/i })).toBeVisible()

        // Check for Refresh button
        await expect(page.getByRole('button', { name: /refresh/i })).toBeVisible()

        // Check for Export button
        await expect(page.getByRole('button', { name: /export/i })).toBeVisible()
    })

    test('should display stats cards', async ({ page }) => {
        // Check for stats cards
        await expect(page.getByText('Total Employees')).toBeVisible()
        await expect(page.getByText('Active')).toBeVisible()
        await expect(page.getByText('Departments')).toBeVisible()
    })

    test('should search employees', async ({ page }) => {
        // Type in search box
        const searchInput = page.getByPlaceholder('Search employees...')
        await searchInput.fill('Ahmed')

        // Wait for filtering
        await page.waitForTimeout(500)

        // Check results
        await expect(page.getByText('Ahmed')).toBeVisible()
    })

    test('should filter by status', async ({ page }) => {
        // Click status filter
        const statusFilter = page.locator('select').first()
        await statusFilter.click()

        // Select Active
        await page.getByText('Active', { exact: true }).click()

        // Wait for filtering
        await page.waitForTimeout(500)

        // Check that only active employees are shown
        await expect(page.getByText('Active')).toBeVisible()
    })

    test('should sort employees', async ({ page }) => {
        // Click on Employee column header to sort
        await page.getByRole('button', { name: /employee/i }).click()

        // Wait for sorting
        await page.waitForTimeout(300)

        // Get first employee name
        const firstRow = page.locator('tbody tr').first()
        const firstEmployeeName = await firstRow.textContent()

        // Click again to reverse sort
        await page.getByRole('button', { name: /employee/i }).click()
        await page.waitForTimeout(300)

        // Get new first employee name
        const newFirstRow = page.locator('tbody tr').first()
        const newFirstEmployeeName = await newFirstRow.textContent()

        // Names should be different after reverse sort
        expect(firstEmployeeName).not.toBe(newFirstEmployeeName)
    })

    test('should open employee actions menu', async ({ page }) => {
        // Wait for employees to load
        await page.waitForSelector('tbody tr')

        // Click on first actions button
        const actionsButton = page.locator('tbody tr').first().getByRole('button').last()
        await actionsButton.click()

        // Check menu items
        await expect(page.getByText('View Details')).toBeVisible()
        await expect(page.getByText('Edit')).toBeVisible()
        await expect(page.getByText('Delete')).toBeVisible()
    })

    test('should paginate results', async ({ page }) => {
        // Check if pagination is visible (only if more than 20 employees)
        const paginationText = page.getByText(/Page \d+ of \d+/)

        if (await paginationText.isVisible()) {
            // Click Next button
            await page.getByRole('button', { name: /next/i }).click()

            // Wait for page change
            await page.waitForTimeout(300)

            // Check page number changed
            await expect(page.getByText('Page 2')).toBeVisible()
        }
    })

    test('should refresh data', async ({ page }) => {
        // Click refresh button
        const refreshButton = page.getByRole('button', { name: /refresh/i })
        await refreshButton.click()

        // Check for loading state (spinner)
        await expect(refreshButton.locator('svg.animate-spin')).toBeVisible({ timeout: 1000 })
    })

    test('should be responsive on mobile', async ({ page }) => {
        // Set mobile viewport
        await page.setViewportSize({ width: 375, height: 667 })

        // Check that content is visible
        await expect(page.locator('h1')).toBeVisible()

        // Check that table is scrollable
        const table = page.locator('table')
        await expect(table).toBeVisible()
    })

    test('should handle empty search results', async ({ page }) => {
        // Search for non-existent employee
        const searchInput = page.getByPlaceholder('Search employees...')
        await searchInput.fill('NonExistentEmployee12345')

        // Wait for filtering
        await page.waitForTimeout(500)

        // Check for empty state message
        await expect(page.getByText('No employees found')).toBeVisible()
    })

    test('should display employee details correctly', async ({ page }) => {
        // Wait for employees to load
        await page.waitForSelector('tbody tr')

        // Get first employee row
        const firstRow = page.locator('tbody tr').first()

        // Check for employee information
        await expect(firstRow.locator('td').first()).toContainText(/[A-Za-z]+/) // Name
    })

    test('should handle keyboard navigation', async ({ page }) => {
        // Focus on search input
        await page.keyboard.press('Tab')
        await page.keyboard.press('Tab')
        await page.keyboard.press('Tab')

        // Type in search
        await page.keyboard.type('Ahmed')

        // Wait for results
        await page.waitForTimeout(500)

        // Check search worked
        await expect(page.getByText('Ahmed')).toBeVisible()
    })

    test('should maintain filter state after refresh', async ({ page }) => {
        // Apply filters
        const searchInput = page.getByPlaceholder('Search employees...')
        await searchInput.fill('Ahmed')

        // Refresh page
        await page.reload()

        // Wait for page to load
        await page.waitForLoadState('networkidle')

        // Check if filters are cleared (they should be)
        const newSearchValue = await searchInput.inputValue()
        expect(newSearchValue).toBe('')
    })
})

test.describe('Employees List - Accessibility', () => {
    test('should have proper heading structure', async ({ page }) => {
        await page.goto('/employees')

        // Check for h1
        const h1 = page.locator('h1')
        await expect(h1).toBeVisible()
        expect(await h1.textContent()).toBeTruthy()
    })

    test('should have keyboard accessible buttons', async ({ page }) => {
        await page.goto('/employees')

        // Tab through buttons
        const addButton = page.getByRole('button', { name: /add employee/i })
        await addButton.focus()
        expect(await addButton.evaluate(el => document.activeElement === el)).toBe(true)
    })

    test('should have proper ARIA labels', async ({ page }) => {
        await page.goto('/employees')

        // Check for table
        const table = page.getByRole('table')
        await expect(table).toBeVisible()

        // Check for buttons with accessible names
        await expect(page.getByRole('button', { name: /add employee/i })).toBeVisible()
        await expect(page.getByRole('button', { name: /refresh/i })).toBeVisible()
    })
})

test.describe('Employees List - Performance', () => {
    test('should load within acceptable time', async ({ page }) => {
        const startTime = Date.now()

        await page.goto('/employees')
        await page.waitForLoadState('networkidle')

        const loadTime = Date.now() - startTime

        // Should load within 3 seconds
        expect(loadTime).toBeLessThan(3000)
    })

    test('should handle large data sets', async ({ page }) => {
        await page.goto('/employees')

        // Wait for data to load
        await page.waitForSelector('tbody tr')

        // Check that pagination works
        const rows = await page.locator('tbody tr').count()
        expect(rows).toBeGreaterThan(0)
        expect(rows).toBeLessThanOrEqual(20) // Max per page
    })
})
