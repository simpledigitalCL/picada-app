'use client'

import { getSupabaseBrowserClient } from '@/lib/supabase'
import { loadPreferences, savePreferences, type FoodPreference } from '@/lib/feed/personalization'

const ANON_ID_KEY = 'picada.user.id.v1'
const ANON_ID_PATTERN = /^user-[a-z0-9-]{2,40}$/i

type PreferencesRow = {
  likes: string[] | null
  dislikes: string[] | null
  restrictions: string[] | null
  religion: string | null
}

function toUpsertPayload(userId: string, prefs: FoodPreference) {
  return {
    user_id: userId,
    likes: prefs.likes,
    dislikes: prefs.dislikes,
    restrictions: prefs.restrictions,
    religion: prefs.religion || null,
    updated_at: new Date().toISOString(),
  }
}

/**
 * Sube las preferencias a user_preferences si hay sesión activa.
 * Fire-and-forget: el localStorage ya quedó escrito por savePreferences.
 */
export function syncPreferencesToServer(prefs: FoodPreference): void {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return
  void supabase.auth
    .getSession()
    .then(({ data }) => {
      const userId = data.session?.user?.id
      if (!userId) return
      return supabase
        .from('user_preferences')
        .upsert(toUpsertPayload(userId, prefs), { onConflict: 'user_id' })
    })
    .then(undefined, () => undefined)
}

let lastReconciledUserId: string | null = null

/**
 * Reconcilia preferencias al iniciar sesión:
 * - Si el servidor tiene fila, gana el servidor (puede venir de otro dispositivo)
 *   y se pisa el localStorage sin re-subir.
 * - Si no hay fila, es el primer login: sube lo acumulado en el período anónimo.
 */
export async function reconcilePreferencesOnLogin(userId: string): Promise<void> {
  if (!userId || lastReconciledUserId === userId) return
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return
  lastReconciledUserId = userId

  const { data, error } = await supabase
    .from('user_preferences')
    .select('likes, dislikes, restrictions, religion')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    lastReconciledUserId = null
    return
  }

  if (data) {
    const row = data as PreferencesRow
    savePreferences(
      {
        likes: row.likes || [],
        dislikes: row.dislikes || [],
        restrictions: row.restrictions || [],
        religion: row.religion || 'ninguna',
      },
      { syncRemote: false },
    )
    return
  }

  const local = loadPreferences()
  await supabase
    .from('user_preferences')
    .upsert(toUpsertPayload(userId, local), { onConflict: 'user_id' })
    .then(undefined, () => undefined)
}

/**
 * Registra el vínculo id anónimo (localStorage) ↔ auth UUID en identity_links.
 * Debe llamarse ANTES de ensureProfileForSession, que sobreescribe
 * picada.user.id.v1 con el UUID real. Lee el localStorage de forma síncrona;
 * el insert es fire-and-forget. No-op si el id guardado ya es un UUID.
 */
export function linkAnonIdentity(userId: string): void {
  if (typeof window === 'undefined' || !userId) return
  const anonId = (window.localStorage.getItem(ANON_ID_KEY) || '').trim()
  if (!ANON_ID_PATTERN.test(anonId) || anonId === 'user-anon') return
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return
  void supabase
    .from('identity_links')
    .upsert(
      { anon_id: anonId, user_id: userId },
      { onConflict: 'anon_id,user_id', ignoreDuplicates: true },
    )
    .then(undefined, () => undefined)
}
