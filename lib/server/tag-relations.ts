import type { SupabaseClient } from '@supabase/supabase-js'
import { ensureTagsInCatalog } from '@/lib/server/tag-catalog'

/**
 * Dimensiones lógicas para relation_type (`local_to_food`, `local_to_attr`, etc.).
 * Slugs persistentes siguen prefijos: local_, food_, attr_, ambience_, service_ (+ legado).
 */
type TagDimension = 'local' | 'food' | 'attr' | 'ambience' | 'service' | 'other'

const FOOD_LEGACY_PREFIXES = [
  'comida_',
  'tipo_plato_',
  'sabor_y_aroma_',
  'textura_sensacion_',
  'ingredientes_destacados_',
  'presentacion_',
  'dieta_rest_',
]

/** Legado antes de ambience_ unificado */
const AMBIENCE_LEGACY_PREFIXES = ['ambiente_', 'servicio_', 'espacio_', 'ocasion_', 'calidad_']

function getTagDimension(tag: string): TagDimension {
  const t = tag.toLowerCase()
  if (t.startsWith('local_')) return 'local'
  if (t.startsWith('food_')) return 'food'
  if (t.startsWith('attr_')) return 'attr'
  if (t.startsWith('ambience_')) return 'ambience'
  if (t.startsWith('service_')) return 'service'

  if (FOOD_LEGACY_PREFIXES.some(p => t.startsWith(p))) return 'food'
  if (t.startsWith('vestimenta_') || t.startsWith('dress_code_') || t.startsWith('dress_')) return 'attr'
  if (AMBIENCE_LEGACY_PREFIXES.some(p => t.startsWith(p))) return 'ambience'
  return 'other'
}

function relationType(source: TagDimension, target: TagDimension): string {
  return `${source}_to_${target}`
}

function buildPairRows(tags: string[]) {
  const clean = [...new Set((tags || []).map(x => String(x || '').trim().toLowerCase()).filter(Boolean))]
  const rows: Array<{ source_tag: string; target_tag: string; relation_type: string }> = []
  const seen = new Set<string>()

  for (const source of clean) {
    const sourceDim = getTagDimension(source)
    if (sourceDim === 'other') continue
    for (const target of clean) {
      if (source === target) continue
      const targetDim = getTagDimension(target)
      if (targetDim === 'other') continue
      if (sourceDim === targetDim) continue
      const rel = relationType(sourceDim, targetDim)
      const key = `${source}|${target}|${rel}`
      if (seen.has(key)) continue
      seen.add(key)
      rows.push({ source_tag: source, target_tag: target, relation_type: rel })
    }
  }
  return rows
}

function isDuplicateKeyError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const code = String((err as { code?: string }).code || '')
  const msg = String((err as { message?: string }).message || '')
  return code === '23505' || /duplicate key|unique constraint/i.test(msg)
}

/**
 * Persiste co-ocurrencias y anti-fraude por usuario.
 *
 * Flujo por cada par (source, target, relation_type) distinto en el post:
 * 1. `tag_relation_user_pair`: insert; si ya existía (mismo user + par) → duplicado 23505.
 * 2. `tag_relations_stats`: siempre +1 en `co_occurrence_count`.
 *    `unique_users_count` +1 solo si el insert en (1) fue exitoso (usuario nuevo para ese par).
 */
export async function ingestTagRelationStats(supabase: SupabaseClient, tags: string[], userId: string) {
  const uid = String(userId || '').trim().toLowerCase() || 'anon'
  await ensureTagsInCatalog(supabase, tags)

  const rows = buildPairRows(tags)
  if (rows.length === 0) return

  for (const row of rows) {
    const { error: pairErr } = await supabase.from('tag_relation_user_pair').insert({
      source_tag: row.source_tag,
      target_tag: row.target_tag,
      relation_type: row.relation_type,
      user_id: uid,
    })

    const duplicateSameUserAgain = Boolean(pairErr && isDuplicateKeyError(pairErr))

    if (pairErr && !duplicateSameUserAgain) {
      continue
    }

    const { data: existing } = await supabase
      .from('tag_relations_stats')
      .select('co_occurrence_count, unique_users_count')
      .eq('source_tag', row.source_tag)
      .eq('target_tag', row.target_tag)
      .eq('relation_type', row.relation_type)
      .maybeSingle()

    const nextCo = Number(existing?.co_occurrence_count ?? 0) + 1
    const addUniqueContributor = Boolean(!pairErr)
    const nextUq = Number(existing?.unique_users_count ?? 0) + (addUniqueContributor ? 1 : 0)

    await supabase.from('tag_relations_stats').upsert(
      {
        source_tag: row.source_tag,
        target_tag: row.target_tag,
        relation_type: row.relation_type,
        co_occurrence_count: nextCo,
        unique_users_count: nextUq,
        last_updated: new Date().toISOString(),
      },
      { onConflict: 'source_tag,target_tag,relation_type' },
    )
  }
}
