import { chromium } from '@playwright/test'
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1456, height: 836 }, locale: 'ar' })).newPage()
await page.goto('https://tamkeen-v2.base.meena.sa/hr', { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(1500)
const r = await page.evaluate(() => {
  const search = document.querySelector('input[placeholder="ابحث"]')
  const header = document.querySelector('header')
  const main = document.querySelector('main')
  const aside = search ? search.closest('aside') : null
  const g = (el) => el ? el.getBoundingClientRect() : null
  return {
    header: g(header) && { y: g(header).y, h: g(header).height, w: g(header).width },
    aside: g(aside) && { x: g(aside).x, y: g(aside).y, w: g(aside).width, h: g(aside).height },
    search: g(search) && { x: g(search).x, y: g(search).y, w: g(search).width, h: g(search).height },
    main: g(main) && { x: g(main).x, y: g(main).y, w: g(main).width },
  }
})
console.log(JSON.stringify(r, null, 1))
await browser.close()
