import type { SupabaseClient } from '@supabase/supabase-js'
import { inferTagCatalogFields } from '@/lib/tag-normalization'

/**
 * Registra etiquetas nuevas como pending si no existen en `tag_catalog`.
 * UPSERT con `ignoreDuplicates` en `slug`: no actualiza filas ya existentes
 * (tus ~17 bloques semilla verified permanecen intactos).
 *
 * Requiere en Supabase: `tag_catalog`, `tag_relation_user_pair`,
 * `tag_relations_stats.unique_users_count` (ver `20260429_brain_intel_schema.sql`).
 */
export async function ensureTagsInCatalog(supabase: SupabaseClient, tags: string[]) {
  const uniq = [...new Set((tags || []).map(t => String(t || '').trim().toLowerCase()).filter(Boolean))]
  if (uniq.length === 0) return

  const rows = uniq.map(slug => {
    const { display_name, category } = inferTagCatalogFields(slug)
    return {
      slug,
      display_name,
      category,
      status: 'pending' as const,
    }
  })

  try {
    const { error: bulkErr } = await supabase.from('tag_catalog').upsert(rows, {
      onConflict: 'slug',
      ignoreDuplicates: true,
    })

    if (bulkErr) {
      for (const row of rows) {
        await supabase.from('tag_catalog').upsert(row, {
          onConflict: 'slug',
          ignoreDuplicates: true,
        })
      }
    }
  } catch {
    /* no bloquea ingesta */
  }
}
