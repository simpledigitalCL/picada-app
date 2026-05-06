import puppeteer from 'puppeteer'
import { writeFileSync } from 'fs'

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
})

const page = await browser.newPage()
await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 2 })

console.log('Navigating to design-lab...')
await page.goto('http://localhost:3002/design-lab', {
  waitUntil: 'domcontentloaded',
  timeout: 30000,
})

// Wait for Framer Motion animations to settle
await new Promise(r => setTimeout(r, 2500))

// Get full page height
const pageHeight = await page.evaluate(() => document.body.scrollHeight)
console.log('Page height:', pageHeight)

// Full-page screenshot — captures everything
const fullShot = await page.screenshot({
  type: 'jpeg',
  quality: 88,
  fullPage: true,
})
writeFileSync('public/design-lab-preview-full.jpg', fullShot)
console.log('Full screenshot saved.')

// Section shots: viewport-sized slices
const sections = [
  { name: 'top', y: 0 },
  { name: 'mid', y: Math.floor(pageHeight * 0.35) },
  { name: 'bot', y: Math.floor(pageHeight * 0.7) },
]

for (const s of sections) {
  await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), s.y)
  await new Promise(r => setTimeout(r, 600))
  const shot = await page.screenshot({ type: 'jpeg', quality: 88 })
  writeFileSync(`public/design-lab-preview-${s.name}.jpg`, shot)
  console.log(`${s.name} screenshot saved (scrollY=${s.y}).`)
}

await browser.close()
console.log('Done. Files in /public/')
