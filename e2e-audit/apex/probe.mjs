import { chromium } from '@playwright/test'
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1512, height: 812 } })).newPage()
await page.goto('https://tamkeen-v2.base.meena.sa/hr?module=attendance-settings', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
const info = await page.evaluate(() => {
  const inp = document.querySelector('input[type=number]')
  const box = inp.parentElement
  const svgs = [...box.querySelectorAll('svg')].map(s => { const r = s.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height), getComputedStyle(s).color, getComputedStyle(s.parentElement).display] })
  const r = box.getBoundingClientRect()
  return { box: [Math.round(r.x), Math.round(r.width)], svgs, html: box.outerHTML.slice(0, 600) }
})
console.log(JSON.stringify(info, null, 1))
await browser.close()
