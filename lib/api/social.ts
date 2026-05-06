export type VotePicadaPayload = {
  picadaId: string
  voteType: 'up' | 'down'
}

export type SyncLocalStatePayload = {
  votes: Record<string, number>
  userVotes: Record<string, boolean>
  visitLater: string[]
}

/**
 * Contrato remoto preparado para backend.
 * Por ahora se mantiene como no-op exitoso para no bloquear UX.
 */
export async function votePicadaRemote(_payload: VotePicadaPayload): Promise<{ ok: true }> {
  return { ok: true }
}

/**
 * Sincroniza estado local con backend cuando exista endpoint.
 * Actualmente no-op exitoso.
 */
export async function syncLocalState(_payload: SyncLocalStatePayload): Promise<{ ok: true }> {
  return { ok: true }
}

