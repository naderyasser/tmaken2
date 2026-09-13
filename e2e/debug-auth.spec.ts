import { test } from '@playwright/test'

test('debug auth and page load', async ({ page }) => {
    const apiRequests: string[] = []

    page.on('console', msg => {
        const text = msg.text()
        if (!text.includes('React DevTools') && !text.includes('[HMR]')) {
            console.log(`[PAGE ${msg.type().toUpperCase()}]`, text.substring(0, 300))
        }
    })
    page.on('pageerror', err => console.log('[PAGE ERROR]', err.message))
    page.on('request', req => {
        const url = req.url()
        if (url.includes('/api/')) apiRequests.push(url.replace('http://localhost:3000', ''))
    })

    // Catch-alls FIRST
    await page.route(/\/api\/resource\//, r => {
        console.log('[RES CATCH-ALL]', r.request().url().replace('http://localhost:3000', '').substring(0, 80))
        return r.fulfill({ status: 200, json: { data: [] } })
    })
    await page.route(/\/api\/method\//, r => r.fulfill({ status: 200, json: { message: null } }))
    await page.route(/\/api\/frappe/, r => {
        console.log('[FRAPPE CATCH-ALL]', r.request().url().substring(22, 100))
        return r.fulfill({ status: 200, json: { message: null } })
    })

    // Specific LAST (higher priority)
    await page.route(/base_meena\.api\.get_csrf_token/, r =>
        r.fulfill({ status: 200, json: { message: { csrf_token: 'test-123' } } })
    )
    await page.route(/\/api\/frappe\?.*get_logged_user/, r => {
        console.log('[AUTH MOCK] get_logged_user')
        return r.fulfill({ status: 200, json: { message: 'salesrep@test.com' } })
    })
    await page.route(/\/api\/frappe\?.*get_roles/, r => {
        console.log('[AUTH MOCK] get_roles')
        return r.fulfill({ status: 200, json: { message: ['Sales User', 'System Manager'] } })
    })
    await page.route(/\/api\/frappe\?.*User%2F/, r => {
        console.log('[AUTH MOCK] getUserInfo (User%2F)')
        return r.fulfill({ status: 200, json: { data: { full_name: 'Ahmed', user_image: null } } })
    })
    await page.route(/\/api\/frappe\?.*\/User\//, r => {
        console.log('[AUTH MOCK] getUserInfo (/User/)')
        return r.fulfill({ status: 200, json: { data: { full_name: 'Ahmed', user_image: null } } })
    })
    await page.route(/\/api\/resource\/Sales%20Person\/SP-001/, r => {
        console.log('[SP MOCK] Sales Person detail SP-001')
        return r.fulfill({ status: 200, json: { data: { name: 'SP-001', sales_person_name: 'Ahmed', is_group: 0, enabled: 1, employee: 'EMP-001' } } })
    })
    await page.route(/\/api\/resource\/Sales%20Person/, r => {
        console.log('[SP MOCK] Sales Person list')
        return r.fulfill({ status: 200, json: { data: [{ name: 'SP-001', sales_person_name: 'Ahmed', enabled: 1, employee: 'EMP-001' }] } })
    })
    await page.route(/\/api\/resource\/Employee/, r => {
        console.log('[EMP MOCK] Employee list')
        return r.fulfill({ status: 200, json: { data: [{ name: 'EMP-001', employee_name: 'Ahmed Sales', company: 'Test' }] } })
    })
    await page.route(/\/api\/resource\/Customer/, r =>
        r.fulfill({ status: 200, json: { data: [] } })
    )

    await page.goto('/sales-rep/samples')
    await page.waitForTimeout(8000)

    console.log('\n=== ALL API REQUESTS ===')
    apiRequests.forEach(r => console.log(' ', r.substring(0, 120)))

    const text = await page.evaluate(() => document.body.innerText.substring(0, 300))
    console.log('\n=== PAGE TEXT ===', text)
})

