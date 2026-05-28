/**
 * Test flujo de login en producción con Playwright.
 * Uso: node scripts/test-auth.mjs [prod|local] [email] [password]
 *
 * Ejemplos:
 *   node scripts/test-auth.mjs prod user@example.com mypassword
 *   node scripts/test-auth.mjs local user@example.com mypassword
 */
import { chromium } from 'playwright'

const mode = process.argv[2] || 'prod'
const BASE = mode === 'local' ? 'http://localhost:3002' : 'https://picada-app.vercel.app'

const EMAIL = process.argv[3]
const PASSWORD = process.argv[4]

if (!EMAIL || !PASSWORD) {
  console.error('Uso: node scripts/test-auth.mjs [prod|local] <email> <password>')
  process.exit(1)
}

console.log(`=== Test Auth ===`)
console.log(`Base: ${BASE}\n`)

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
})

// Saltar onboarding y location gate
await context.addInitScript(() => {
  localStorage.setItem('picada.onboarding.done.v1', 'true')
  localStorage.setItem('picada.location.v1', 'Santiago')
  localStorage.setItem('picada.location.mode.v1', 'manual')
  localStorage.setItem('picada.geo.v1', JSON.stringify({ lat: -33.45, lng: -70.65, radiusKm: 5, label: 'Santiago' }))
})

const supabaseResponses = []
const consoleLogs = []
const page = await context.newPage()

page.on('console', msg => {
  if (msg.type() === 'error') consoleLogs.push(`[console.error] ${msg.text()}`)
})
page.on('response', async res => {
  const url = res.url()
  const status = res.status()
  if (url.includes('supabase') || url.includes('gotrue') || url.includes('/auth/')) {
    let body = ''
    try { body = await res.text() } catch {}
    supabaseResponses.push({ status, url: url.replace(/\?.*/, '').slice(-80), body: body.slice(0, 200) })
  }
  if (status >= 400) {
    supabaseResponses.push({ status, url: url.slice(0, 120), body: '' })
  }
})
page.on('requestfailed', req => {
  const url = req.url()
  if (url.includes('supabase') || url.includes('gotrue')) {
    supabaseResponses.push({ status: 'FAIL', url: url.slice(0, 100), body: req.failure()?.errorText || '' })
  }
})

// --- Paso 1: Cargar app ---
console.log('1. Cargando app...')
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 })
await page.screenshot({ path: '/tmp/auth-1-home.png' })

// --- Paso 2: Ir al tab Social ---
console.log('2. Click tab Social...')
await page.locator('button').filter({ hasText: 'Social' }).first().click()
await page.waitForTimeout(2000)
await page.screenshot({ path: '/tmp/auth-2-social.png' })

// --- Paso 3: Click "Iniciar sesión para participar" ---
console.log('3. Buscando botón "Iniciar sesión para participar"...')
const loginBanner = page.locator('button').filter({ hasText: /Iniciar sesión para participar/ }).first()
const bannerVisible = await loginBanner.isVisible({ timeout: 3000 }).catch(() => false)

if (bannerVisible) {
  console.log('   Botón encontrado, clickeando...')
  await loginBanner.click()
  await page.waitForTimeout(1000)
} else {
  console.log('   Botón no visible — disparando evento picada:require-auth manualmente')
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('picada:require-auth')))
  await page.waitForTimeout(1000)
}
await page.screenshot({ path: '/tmp/auth-3-dialog.png' })
console.log('   Screenshot: /tmp/auth-3-dialog.png')

// --- Paso 4: Verificar que hay formulario ---
const emailInput = page.locator('input[type="email"]').first()
const emailVisible = await emailInput.isVisible({ timeout: 5000 }).catch(() => false)

if (!emailVisible) {
  console.log('❌ Formulario de email no visible después de abrir el dialog')
  const allText = await page.locator('body').innerText().catch(() => '')
  console.log('Texto visible:', allText.slice(0, 400))
  await browser.close()
  process.exit(1)
}

// --- Paso 5: Rellenar y enviar ---
console.log('4. Rellenando email y contraseña...')
await emailInput.fill(EMAIL)
const pwInput = page.locator('input[type="password"]').first()
await pwInput.fill(PASSWORD)
await page.screenshot({ path: '/tmp/auth-4-filled.png' })
console.log('   Screenshot: /tmp/auth-4-filled.png')

console.log('5. Enviando (Enter)...')
const t0 = Date.now()
await pwInput.press('Enter')
await page.waitForTimeout(5000)
const elapsed = Date.now() - t0

await page.screenshot({ path: '/tmp/auth-5-result.png' })
console.log(`   Screenshot: /tmp/auth-5-result.png (${elapsed}ms)`)

// --- Paso 6: Verificar resultado ---
console.log('\n6. Resultado:')
const statusMsg = await page.locator('.text-destructive, p.text-xs.text-center').first().innerText().catch(() => '')
const bodyText = await page.locator('body').innerText().catch(() => '')
const isLoggedIn = bodyText.includes('Sesión activa') || bodyText.includes('Cerrar sesión') || bodyText.includes('¡Sesión iniciada!')
const hasError = bodyText.includes('incorrectos') || bodyText.includes('Correo o contraseña')

if (isLoggedIn) {
  console.log('✅ LOGIN EXITOSO')
} else if (hasError) {
  console.log('❌ ERROR DE CREDENCIALES:', statusMsg)
} else if (statusMsg) {
  console.log('⚠️  Mensaje:', statusMsg)
} else {
  console.log('?  Estado desconocido — sin mensaje claro')
  console.log('   Texto visible (400 chars):', bodyText.slice(0, 400))
}

// --- Paso 7: Requests a Supabase ---
console.log('\n7. Todos los requests con errores (400+):')
const allErrors = supabaseResponses.filter(r => r.status !== 200)
if (allErrors.length === 0) {
  console.log('   Sin errores')
} else {
  allErrors.forEach(r => console.log(`   [${r.status}] ${r.url}`))
}
console.log('\n   Auth token request:')
supabaseResponses.filter(r => String(r.url).includes('token') || String(r.url).includes('auth/v')).forEach(r => {
  console.log(`   [${r.status}] ${r.url}`)
})

if (consoleLogs.length > 0) {
  console.log('\n--- Errores de consola ---')
  consoleLogs.forEach(l => console.log(' ', l))
}

await browser.close()
console.log('\nDone.')
