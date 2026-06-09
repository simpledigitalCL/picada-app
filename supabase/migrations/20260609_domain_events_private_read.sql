-- =============================================================================
-- Cierra la lectura pública de domain_events.
-- La policy "domain_events_public_read" (using true) exponía el historial de
-- actividad de todos los usuarios a cualquier cliente con la anon key.
-- Las vistas user_event_leaderboard / picada_event_ranking no se ven afectadas
-- (se ejecutan con privilegios del owner) y los API routes usan el service role.
-- Idempotente.
-- =============================================================================

drop policy if exists "domain_events_public_read" on public.domain_events;

drop policy if exists "domain_events_read_own" on public.domain_events;
create policy "domain_events_read_own"
on public.domain_events for select
to authenticated
using (auth.uid()::text = user_id);
