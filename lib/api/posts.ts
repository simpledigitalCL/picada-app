'use client'

import { getAuthHeaders } from '@/lib/api/auth'

export type PostMedia = { url: string; kind: 'photo' | 'video' }

export type PostEditPayload = {
  content?: string | null
  rating?: number | null
  moods?: string[]
  /** Set completo de media tras la edición (reemplaza el actual). */
  mediaList?: PostMedia[]
}

export type PostEditResult = {
  id: string
  content?: string | null
  rating?: number | null
  moods?: string[]
  media?: PostMedia[]
  type?: string
}

/** Edita un post propio. Lanza Error con el código de la API si falla. */
export async function updatePost(id: string, payload: PostEditPayload): Promise<PostEditResult> {
  const authHeaders = await getAuthHeaders()
  const res = await fetch(`/api/posts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify(payload),
  })
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; value?: PostEditResult; error?: string }
  if (!res.ok || !data.ok) throw new Error(data.error || 'update_failed')
  return data.value ?? { id }
}

/** Elimina un post propio. Lanza Error con el código de la API si falla. */
export async function deletePost(id: string): Promise<void> {
  const authHeaders = await getAuthHeaders()
  const res = await fetch(`/api/posts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders,
  })
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
  if (!res.ok || !data.ok) throw new Error(data.error || 'delete_failed')
}

/**
 * IDs de posts locales (aún no en el servidor) empiezan con `local-`.
 * Para esos, editar/eliminar es solo sobre localStorage (no hay fila en la DB).
 */
export function isLocalPostId(id: string): boolean {
  return id.startsWith('local-')
}
