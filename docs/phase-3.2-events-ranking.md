# Fase 3.2 — Eventos y ranking backend

## Incluye

- Persistencia de eventos de dominio en `public.domain_events`.
- Índices para consultas por tipo, fecha, usuario y payload JSON.
- Vista `public.user_event_leaderboard` (score de usuarios).
- Vista `public.picada_event_ranking` (ranking de locales por comunidad).
- Endpoints:
  - `GET /api/leaderboard`
  - `GET /api/picada-ranking`
  - `POST /api/events` (ingesta)
  - `GET /api/events` (analytics básico)

## Ejecutar migración

Ejecuta en Supabase SQL Editor el archivo:

- `supabase/migrations/20260427_phase3_2_events_ranking.sql`

## Notas

- Si aún no existe la tabla en Supabase, `POST /api/events` seguirá respondiendo `ok: true` con `persisted: false` para no bloquear UX.
- `LeaderboardPanel` ya consume `/api/leaderboard` y cae a datos semilla/local como fallback.
