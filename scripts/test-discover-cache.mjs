/**
 * Test si el snapshot diario del discover se guarda y se lee correctamente.
 * Llama al endpoint dos veces con la misma ubicación y compara tiempos.
 *
 * Uso:
 *   node scripts/test-discover-cache.mjs [prod|local] [location]
 *
 * Ejemplos:
 *   node scripts/test-discover-cache.mjs prod "Rancagua"
 *   node scripts/test-discover-cache.mjs local "Santiago"
 */

const mode = process.argv[2] || 'prod'
const location = process.argv[3] || 'Rancagua'

const BASE = mode === 'local'
  ? 'http://localhost:3002'
  : 'https://picada-app.vercel.app'

async function callDiscover(label) {
  const url = `${BASE}/api/restaurants/discover?location=${encodeURIComponent(location)}`
  console.log(`\n[${label}] GET ${url}`)
  const t0 = Date.now()
  let resp, json
  try {
    resp = await fetch(url, { headers: { 'Accept': 'application/json' } })
    json = await resp.json()
  } catch (e) {
    console.error(`  ERROR: ${e.message}`)
    return null
  }
  const elapsed = Date.now() - t0
  const d = json?.diagnostics || {}
  console.log(`  Tiempo:    ${elapsed}ms`)
  console.log(`  Source:    ${json?.source || '?'}`)
  console.log(`  Items:     ${json?.items?.length ?? 0}`)
  console.log(`  CacheHit:  ${d.cacheHit ?? false}`)
  console.log(`  Snapshot:  ${d.snapshot ?? 'none'}`)
  if (d.timings) {
    console.log(`  Timings:   ${JSON.stringify(d.timings)}`)
  }
  if (d.count !== undefined) {
    console.log(`  Diagnostics: count=${d.count} dbCount=${d.dbCount} newToday=${d.newToday} detailsRemaining=${d.detailsRemaining}`)
  }
  if (d.notice) console.log(`  Notice:    ${d.notice}`)
  return { elapsed, source: json?.source, cacheHit: d.cacheHit }
}

console.log(`=== Test discover cache ===`)
console.log(`Base: ${BASE}`)
console.log(`Location: "${location}"`)

const r1 = await callDiscover('Request 1')
if (!r1) process.exit(1)

if (r1.cacheHit) {
  console.log('\n✅ Request 1 ya era cache hit — el snapshot ya existía de antes.')
  console.log('   Para un test limpio, borra la fila daily::rancagua::* en place_discovery_cache')
} else {
  console.log(`\n→ Request 1 fue slow path (${r1.elapsed}ms). Esperando 2s y haciendo request 2...`)
  await new Promise(r => setTimeout(r, 2000))
  const r2 = await callDiscover('Request 2')
  if (!r2) process.exit(1)
  console.log('\n=== Resultado ===')
  if (r2.cacheHit) {
    console.log(`✅ CACHE FUNCIONA: ${r1.elapsed}ms → ${r2.elapsed}ms (snapshot hit)`)
  } else {
    console.log(`❌ CACHE NO FUNCIONA: Request 2 fue ${r2.elapsed}ms sin cache hit`)
    console.log('   Posibles causas:')
    console.log('   1. El snapshot write falló silenciosamente')
    console.log('   2. La clave del snapshot no coincide entre escritura y lectura')
    console.log('   3. SUPABASE_SERVICE_ROLE_KEY no está configurada en Vercel env vars')
  }
}
