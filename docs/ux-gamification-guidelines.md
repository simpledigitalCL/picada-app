# UX + Gamificación (estándar actual)

Este documento define las reglas visuales y de comportamiento para mantener consistencia entre `Home`, `Detalle`, `PostForm` y `Perfil`.

## Reglas de puntos (XP)

- Votar etiqueta: `+1 XP`
- Reseña: `+5 XP`
- Solo foto: `+10 XP`
- Foto + reseña: `+15 XP`
- Nueva picada: `+15 XP`

Fuente única: `lib/engagement-standards.ts`.

## Reglas de formularios

- Selector de local compartido: usar `components/place-selector.tsx`.
- El selector debe incluir fallback “Buscar fuera de mi localidad”.
- Si existe `contextRestaurant`, el selector debe venir preseleccionado.

## Reglas de publicación

- Reseña con foto debe otorgar `+15 XP`.
- Foto sin texto debe mostrarse en pestaña `Fotos`.
- Foto con texto debe mostrarse en `Fotos` y `Reseñas`.

## Reglas de detalle de local

- CTA de reseña y foto usan labels basados en `getXpLabel()`.
- Votación de etiquetas usa `XP_RULES.tagVote`.
- Quick rating usa `XP_RULES.review`.

## Checklist rápido antes de merge

- `npm run build` exitoso.
- Sin errores de lint en archivos editados.
- Botones con texto/aria coherente (reseña/foto/compartir/guardar).

