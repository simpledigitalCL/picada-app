# Picada App — Gastronomic Map

Aplicación móvil/web de descubrimiento gastronómico con mapa interactivo, reseñas sociales, gamificación y recomendaciones por IA. Pensada para el mercado chileno ("picadas"), con soporte para Android vía Capacitor.

---

## Tabla de contenidos

1. [Stack tecnológico](#stack-tecnológico)
2. [Arquitectura general](#arquitectura-general)
3. [Estructura de carpetas](#estructura-de-carpetas)
4. [Módulos principales](#módulos-principales)
5. [Base de datos — Supabase](#base-de-datos--supabase)
6. [API Routes (Next.js)](#api-routes-nextjs)
7. [Gamificación](#gamificación)
8. [Inteligencia artificial](#inteligencia-artificial)
9. [App móvil — Capacitor (Android)](#app-móvil--capacitor-android)
10. [Variables de entorno](#variables-de-entorno)
11. [Instalación y desarrollo local](#instalación-y-desarrollo-local)
12. [Scripts disponibles](#scripts-disponibles)
13. [Convenciones y decisiones de diseño](#convenciones-y-decisiones-de-diseño)
14. [Estado actual y trabajo pendiente](#estado-actual-y-trabajo-pendiente)

---

## Stack tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Framework web | Next.js (App Router) | 15.2.6 |
| Lenguaje | TypeScript | ^5 |
| UI base | React | ^19 |
| Estilos | Tailwind CSS v4 | ^4.1.9 |
| Componentes | Radix UI + shadcn/ui | varios |
| Animaciones | Framer Motion | ^12 |
| Base de datos | Supabase (PostgreSQL) | ^2.104.1 |
| IA / LLM | Anthropic Claude (API) | @google/generative-ai también incluido |
| Mapa | Leaflet + react-leaflet | ^1.9.4 |
| Formularios | React Hook Form + Zod | ^7 / 3.25 |
| Estado global | Zustand | ^5 |
| Carrusel / Swiper | Swiper, Embla | ^12 / 8.5 |
| Gráficas | Recharts | 2.15.4 |
| Editor canvas | Fabric.js | ^7 |
| App móvil | Capacitor (Android) | ^8.3.1 |
| Servidor dev | Next.js (puerto 3002) | — |

---

## Arquitectura general

```
Browser / Android WebView
        │
        ▼
  Next.js (App Router)
  ├── /app/page.tsx          ← SPA raíz con BottomNav y vistas por tab
  ├── /app/api/**            ← API Routes server-side
  └── /app/public-profile/** ← Página pública de perfil de usuario
        │
        ▼
  Supabase (PostgreSQL + Auth + Storage)
        │
  Google Maps Places API   ← búsqueda y geocoding
  Anthropic Claude API     ← scanner, auto-tags, recomendaciones
```

La app es una **SPA con navegación por tabs** (no por URL). El enrutamiento visual lo maneja el estado de React en `page.tsx`, no Next.js Router. Esto permite que funcione como PWA y dentro del WebView de Capacitor sin historial de navegación complejo.

---

## Estructura de carpetas

```
gastronomic-map-app/
├── app/
│   ├── api/                 ← API Routes de Next.js (server-side)
│   │   ├── admin/           ← Endpoints de administración
│   │   ├── affinity/        ← Afinidad usuario-lugar
│   │   ├── events/          ← Eventos de dominio
│   │   ├── internal/        ← Endpoints internos (no expuestos públicamente)
│   │   ├── leaderboard/     ← Ranking de usuarios
│   │   ├── locations/       ← Geocoding y reverse geocoding
│   │   ├── menu-items/      ← Ítems de menú de locales
│   │   ├── picada-ranking/  ← Ranking especial tipo "picada"
│   │   ├── places/          ← CRUD y búsqueda de locales
│   │   ├── posts/           ← Publicaciones (reseñas, fotos, videos)
│   │   ├── recommendations/ ← Motor de recomendaciones
│   │   ├── reels/           ← Feed tipo reels (videos cortos)
│   │   ├── restaurants/     ← Consulta de restaurantes (proxy Google Maps)
│   │   ├── reviews/         ← Reseñas de locales
│   │   ├── scanner/         ← Análisis de platos por IA (foto → info nutricional + tags)
│   │   ├── social/          ← Acciones sociales (likes, follows)
│   │   ├── social-feed/     ← Feed social de comunidad
│   │   ├── suggestions/     ← Sugerencias de locales
│   │   ├── upload/          ← Upload de archivos a Supabase Storage
│   │   └── user-picadas/    ← Picadas personales del usuario
│   ├── design-lab/          ← Sandbox visual de componentes (dev only)
│   ├── public-profile/      ← Perfil público accesible por URL
│   ├── globals.css          ← Estilos globales (Tailwind base)
│   ├── layout.tsx           ← Layout raíz con ThemeProvider
│   └── page.tsx             ← Entrada principal (SPA orquestadora)
│
├── components/
│   ├── ui/                  ← Componentes shadcn/ui (Button, Dialog, Sheet, etc.)
│   ├── gamification/        ← Toasts y modales de logros/XP
│   ├── post-form/           ← Formulario multi-step de publicación
│   ├── bottom-nav.tsx       ← Navegación inferior (5 tabs)
│   ├── map-view.tsx         ← Vista de mapa con Leaflet
│   ├── reels-feed.tsx       ← Feed de cards de locales tipo explore
│   ├── reels-view.tsx       ← Vista de videos cortos (tipo TikTok)
│   ├── hot-picada-view.tsx  ← Listado de "hot picadas" filtradas
│   ├── profile-view.tsx     ← Perfil de usuario con historial
│   ├── restaurant-detail.tsx← Drawer de detalle de local
│   ├── scan-view.tsx        ← Scanner de plato con cámara + IA
│   ├── post-form.tsx        ← Shell del formulario de post
│   ├── advanced-search-modal.tsx ← Búsqueda avanzada con filtros
│   ├── auth-quick-register.tsx   ← Login/registro rápido (email magic link)
│   ├── onboarding-modal.tsx ← Modal de bienvenida primer uso
│   ├── xp-notification.tsx  ← Notificaciones flotantes de XP y badges
│   ├── discovery-toast.tsx  ← Toast de "primer descubrimiento"
│   ├── reward-modal.tsx     ← Modal de recompensa
│   └── ...                  ← otros componentes de UI
│
├── lib/
│   ├── stores/              ← Zustand stores (app-store, etc.)
│   ├── hooks/               ← Custom React hooks
│   ├── api/                 ← Clientes de API (server-side helpers)
│   ├── auth/                ← Sync de perfil post-login
│   ├── inference/           ← Llamadas a Claude para inferencia
│   ├── server/              ← Helpers exclusivos de servidor
│   ├── utils/               ← Utilidades varias
│   ├── validation/          ← Esquemas Zod compartidos
│   ├── supabase.ts          ← Cliente Supabase (browser)
│   ├── supabase-server.ts   ← Cliente Supabase (server/admin)
│   ├── gamification.ts      ← Lógica de XP, niveles, streaks (client)
│   ├── gamification-events.ts ← Listeners de eventos de gamificación
│   ├── achievement-engine.ts ← Motor de logros (achievements)
│   ├── restaurants.ts       ← Tipo Restaurant y queries de locales
│   ├── location.ts          ← Gestión de ubicación actual (localStorage)
│   ├── identity.ts          ← Identidad anónima (pre-login)
│   ├── ranking.ts           ← Cálculo de ranking de locales
│   ├── place-match.ts       ← Score de match lugar-usuario
│   ├── reels-personalization.ts ← Algoritmo de personalización de feed
│   ├── food-catalog.ts      ← Catálogo de categorías de comida
│   └── ...                  ← otros módulos de lógica de negocio
│
├── supabase/
│   ├── schema.sql           ← Schema completo (idempotente, ejecutar en Supabase SQL Editor)
│   └── migrations/          ← Migraciones incrementales por fecha
│
├── types/
│   └── canvas-confetti.d.ts ← Type declaration para canvas-confetti
│
├── public/                  ← Assets estáticos
├── android/                 ← Proyecto Android generado por Capacitor
├── docs/                    ← Documentación interna del proyecto
├── capacitor.config.ts      ← Configuración de Capacitor (appId: com.picada.app)
├── next.config.mjs          ← Config Next.js (images unoptimized para Capacitor)
├── components.json          ← Config shadcn/ui
├── .env.example             ← Plantilla de variables de entorno
└── package.json
```

---

## Módulos principales

### `app/page.tsx` — SPA Orquestadora

Es el archivo más importante del proyecto. Controla:

- **Navegación por tabs**: `explore`, `reels`, `picada`, `map`, `profile`
- **Estado global UI**: modal de onboarding, gate de ubicación, detalle de restaurante (Sheet)
- **Auth**: escucha `supabase.auth.onAuthStateChange` y sincroniza perfil
- **Gamificación**: inicializa el motor de logros y eventos al montar
- **PostForm**: abre el formulario de publicación como Sheet desde cualquier tab
- **Scanner**: abre la vista de escaneo de platos desde el FAB
- **Ubicación**: modo `auto` (geolocalización) o `manual` (búsqueda de texto)

### `components/bottom-nav.tsx`

Navegación inferior con 5 tabs. Iconos de Lucide. El tab activo se resalta con color naranja (`orange-500`).

### `components/map-view.tsx`

Mapa Leaflet con markers de locales cercanos a la ubicación actual. Soporte para clusters. Al tocar un marker se abre el Sheet de detalle.

### `components/reels-feed.tsx`

Feed de cards de descubrimiento (tipo "explore" de Instagram). Cards con foto, nombre, categoría, tags y score de match. Scroll vertical infinito.

### `components/reels-view.tsx`

Feed vertical de videos cortos tipo TikTok. Videos de platos/locales, con like, comentario y compartir.

### `components/restaurant-detail.tsx`

Sheet (drawer inferior) con toda la información de un local: fotos, menú, reseñas, tags, mapa embed, acciones (reseñar, foto, guardar).

### `components/scan-view.tsx`

Scanner de platos con la cámara del dispositivo. Envía la imagen al endpoint `/api/scanner` que usa Claude para:
- Identificar el plato
- Estimar información nutricional
- Sugerir tags gastronómicos

### `components/post-form/`

Formulario multi-step para crear:
- **Reseña** (texto + rating + tags de mood, venue, comida)
- **Foto** (upload a Supabase Storage + caption)
- **Video** (reel corto)
- **Nueva Picada** (proponer un local nuevo)

---

## Base de datos — Supabase

### Cómo aplicar el schema

1. Ir al **SQL Editor** del proyecto Supabase
2. Ejecutar `supabase/schema.sql` (es idempotente — usa `IF NOT EXISTS`)
3. Ejecutar las migraciones en orden desde `supabase/migrations/`

### Tablas principales

| Tabla | Descripción |
|---|---|
| `profiles` | Perfil de usuario (username, bio, avatar, XP, nivel) |
| `user_preferences` | Preferencias gastronómicas (likes, restricciones, experiencias) |
| `user_visits` | Historial de visitas a locales |
| `user_favorites` | Colecciones guardadas |
| `user_reviews` | Reseñas escritas por usuario |
| `places` | Catálogo global de locales (enriquecido desde Google/OSM/usuarios) |
| `posts` | Publicaciones (reseñas, fotos, videos) |
| `place_tags` | Tags asociados a locales (auto-tags + manuales) |
| `user_tag_affinity` | Afinidad usuario-tag para personalización |
| `achievements` | Definición de logros disponibles |
| `user_achievements` | Logros desbloqueados por usuario |
| `gamification_events` | Eventos de XP server-side |
| `tag_catalog` | Catálogo normalizado de tags gastronómicos |

### Extensiones PostgreSQL requeridas

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- búsqueda difusa por nombre
```

### Row Level Security (RLS)

Todas las tablas tienen RLS activado. Las políticas permiten:
- Lectura pública de `places` y `posts`
- Escritura solo para el usuario autenticado (`auth.uid() = user_id`)
- Endpoints de admin protegidos con `SUPABASE_SERVICE_ROLE_KEY`

---

## API Routes (Next.js)

Todas las rutas están en `app/api/`. Se comunican con Supabase usando el cliente admin (`SUPABASE_SERVICE_ROLE_KEY`) para bypassear RLS cuando es necesario.

### Rutas principales

| Ruta | Método | Descripción |
|---|---|---|
| `/api/restaurants` | GET | Busca locales por texto/ubicación (proxy Google Maps Places) |
| `/api/places` | GET/POST | CRUD de locales en DB propia |
| `/api/places/[id]` | GET/PATCH | Detalle y actualización de local |
| `/api/reviews` | GET/POST | Reseñas de locales |
| `/api/posts` | GET/POST | Publicaciones del feed |
| `/api/scanner` | POST | Análisis de imagen de plato con Claude AI |
| `/api/reels` | GET | Feed de videos personalizado |
| `/api/recommendations` | GET | Recomendaciones de locales para el usuario |
| `/api/leaderboard` | GET | Ranking de usuarios por XP |
| `/api/picada-ranking` | GET | Ranking de "picadas" por zona |
| `/api/locations/reverse` | GET | Reverse geocoding (lat/lng → nombre de zona) |
| `/api/social` | POST | Acciones sociales (like, follow) |
| `/api/social-feed` | GET | Feed de actividad de la comunidad |
| `/api/upload` | POST | Upload de archivos a Supabase Storage |
| `/api/events` | POST | Registro de eventos de dominio (gamificación) |
| `/api/affinity` | GET | Score de afinidad usuario-lugar |
| `/api/menu-items` | GET | Ítems de menú de un local |
| `/api/suggestions` | POST | Sugerir nuevo local |
| `/api/user-picadas` | GET | Picadas marcadas por el usuario |

---

## Gamificación

Sistema completo de gamificación orientado a aumentar el engagement:

### XP y Niveles

| Nivel | Nombre | XP requerido |
|---|---|---|
| 1 | Explorador | 0 |
| 2 | Picador | 500 |
| 3 | Crítico | 2000 |
| 4 | Leyenda | 5000 |

### Acciones que dan XP

- Escribir reseña: +50 XP
- Subir foto: +20 XP
- Subir video: +30 XP
- Primer voto en un local: +100 XP (bonificación "primer descubridor")
- Check-in en local: +10 XP
- Like recibido: +5 XP
- Racha diaria mantenida: +25 XP/día

### Streaks

Se trackea la racha de días consecutivos activos. Si no hay actividad en 24h se muestra un banner de advertencia ("Tu racha está en riesgo").

### Logros (Achievements)

Motor de logros en `lib/achievement-engine.ts`. Ejemplos:
- "Primero en descubrir" — primer voto en un local
- "Midnight snack" — abrir la app entre las 00:00 y 04:00
- "Explorador de zona" — visitar 5 comunas distintas
- "Crítico de élite" — 50 reseñas escritas

Los logros se notifican con un toast animado (`components/gamification/AchievementToast`).

---

## Inteligencia artificial

### Scanner de platos (`/api/scanner`)

- Recibe imagen base64 desde la cámara
- Llama a **Claude (Anthropic)** con vision
- Retorna: nombre del plato, descripción, estimación nutricional (kcal, proteínas, carbos, grasas), tags gastronómicos sugeridos

### Auto-tagging de locales (`lib/place-auto-tagging.ts`)

- Analiza el nombre, categoría, reseñas y ubicación de un local
- Genera tags automáticos (tipo de cocina, ambiente, experiencia)
- Se ejecuta en background al registrar un local nuevo

### Recomendaciones personalizadas

- Combina: afinidad de tags del usuario (`user_tag_affinity`), historial de visitas, mood actual y ubicación
- Motor en `lib/reels-personalization.ts` y `/api/recommendations`

### Match Score (`lib/place-match.ts`)

Score numérico 0-100 que indica qué tan bien encaja un local con el perfil del usuario. Se muestra en las cards del feed.

---

## App móvil — Capacitor (Android)

El proyecto usa **Capacitor 8** para generar el APK de Android a partir del build de Next.js.

### App ID

```
com.picada.app
```

### Flujo de build para Android

```bash
# 1. Build de Next.js
npm run build

# 2. Copiar assets al proyecto Android
npm run cap:copy

# 3. Sincronizar plugins y dependencias nativas
npm run cap:sync

# 4. Abrir Android Studio
npm run cap:open:android
```

### Build para emulador (apunta a servidor local)

```bash
npm run android:sync:emulator
# Usa http://10.0.2.2:3002 (IP del host desde el emulador Android)
```

### Build para producción (apunta a dominio real)

```bash
npm run android:sync:prod
# Editar CAP_SERVER_URL en el script o pasar como env var
```

### Notas importantes

- `next.config.mjs` tiene `images.unoptimized: true` — requerido para que las imágenes funcionen dentro del WebView de Capacitor
- El puerto del servidor dev es **3002** (no el 3000 por defecto)
- La carpeta `android/` es el proyecto Android Studio generado; no editar manualmente archivos de esta carpeta salvo configuración nativa específica

---

## Variables de entorno

Copiar `.env.example` a `.env.local` y completar:

```bash
cp .env.example .env.local
```

| Variable | Obligatoria | Descripción |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sí | Anon key (pública, va al browser) |
| `SUPABASE_URL` | Sí | URL del proyecto Supabase (server-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | Service role key (privada, NUNCA exponer) |
| `GOOGLE_MAPS_API_KEY` | Sí | API key de Google Maps Platform |
| `ANTHROPIC_API_KEY` | Sí | API key de Anthropic (Claude) |

### Google Maps — APIs requeridas

Activar en Google Cloud Console:
- Places API (New)
- Geocoding API
- Maps JavaScript API (si se usa embed)

---

## Instalación y desarrollo local

### Prerequisitos

- Node.js >= 20
- npm >= 10 (o pnpm)
- Cuenta Supabase con proyecto creado
- API Keys de Google Maps y Anthropic

### Pasos

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con los valores reales

# 3. Aplicar schema en Supabase
# → Ir al SQL Editor de Supabase
# → Ejecutar supabase/schema.sql
# → Ejecutar cada archivo de supabase/migrations/ en orden cronológico

# 4. Iniciar servidor de desarrollo
npm run dev
# Disponible en http://localhost:3002
```

---

## Scripts disponibles

```bash
npm run dev              # Servidor de desarrollo (puerto 3002)
npm run build            # Build de producción Next.js
npm run start            # Servidor de producción
npm run lint             # ESLint
npm run cap:copy         # Copiar build al proyecto Android
npm run cap:sync         # Sincronizar Capacitor (plugins + assets)
npm run cap:open:android # Abrir Android Studio
npm run android:sync:emulator  # Sync apuntando al emulador local
npm run android:sync:prod      # Sync apuntando a dominio de producción
```

---

## Convenciones y decisiones de diseño

### Colores de marca

- Primario: `orange-500` (#f97316) — botones, tabs activos, acciones principales
- Fondo: variable `--background` (soporta dark mode vía `next-themes`)

### Patrones de código

- **Componentes**: nombrados en PascalCase, un componente por archivo
- **Lib modules**: funciones puras exportadas, sin clases
- **API Routes**: un archivo `route.ts` por endpoint, con `export async function GET/POST`
- **Supabase client**: 
  - `lib/supabase.ts` → cliente browser (anon key)
  - `lib/supabase-server.ts` → cliente server/admin (service role key)
- **Zustand store**: único store principal en `lib/stores/app-store.ts`
- **Zod validation**: schemas en `lib/validation/`, usados tanto en frontend como en API Routes
- **Sanitización**: todo HTML de usuario pasa por `isomorphic-dompurify` antes de renderizar

### Sistema de Tags

Los tags son el corazón del sistema de personalización. Conectan a los usuarios con los locales a través de sus preferencias reales de consumo.

#### Tipos de tags

| Tipo | Ejemplos | Origen |
|---|---|---|
| **Comida** | `pizza`, `sushi`, `vegano`, `sin_gluten` | Manual (usuario) + IA |
| **Ambiente/Venue** | `romantico`, `familiar`, `terraza`, `pet_friendly` | Manual (usuario) + IA |
| **Mood** | `chill`, `para_grupos`, `noche`, `almuerzo_rapido` | Manual (usuario) |
| **Clasificación** | `picada`, `restoran`, `cafe`, `bar` | IA + categoría de Google Maps |
| **Experiencia** | `buen_servicio`, `precio_calidad`, `instagram_worthy` | Manual (usuario) |

#### Flujo de vida de un tag

```
1. ORIGEN
   ├── Usuario al escribir reseña → elige tags de mood, venue y comida
   ├── IA al registrar un local → place-auto-tagging.ts llama a Claude
   └── Google Maps → categoría del local se convierte en tags iniciales

2. NORMALIZACIÓN (lib/tag-normalization.ts)
   └── Unifica variantes: "sin gluten" = "sin_gluten" = "gluten free"
       "veggie" = "vegetariano", etc.

3. ALMACENAMIENTO
   ├── tag_catalog → catálogo maestro (slug, nombre, categoría, conteo de uso)
   ├── place_tags  → tags asociados a cada local (con peso/score)
   └── user_tag_affinity → score de afinidad usuario↔tag (se acumula)

4. ACTUALIZACIÓN DE AFINIDAD
   └── Cada vez que el usuario interactúa (reseña, like, visita, búsqueda):
       → /api/affinity/track suma puntos al score del tag correspondiente
       → user_tag_affinity se actualiza en Supabase

5. USO EN PERSONALIZACIÓN
   ├── Match Score (lib/place-match.ts)
   │     → compara tags del local vs afinidad del usuario → score 0-100
   ├── Feed de recomendaciones (/api/recommendations)
   │     → ordena locales por match score + distancia + popularidad
   └── Reels Feed (lib/reels-personalization.ts)
         → mezcla locales nuevos con locales de alta afinidad
```

#### Catálogo de tags (`tag_catalog`)

Cada tag en el catálogo tiene:
- `slug`: identificador único normalizado (ej. `sin_gluten`)
- `label`: nombre legible (ej. "Sin Gluten")
- `category`: tipo de tag (`food`, `venue`, `mood`, `classification`)
- `use_count`: cuántos locales lo tienen — sirve para ordenar el autocomplete
- `aliases`: variantes que se normalizan a este slug

#### Score de afinidad (`user_tag_affinity`)

```
score = Σ (peso_accion × frecuencia)

Pesos por acción:
  reseña con tag     → +3
  like a post con tag → +1
  visita a local con tag → +2
  búsqueda con tag   → +1
  tag en preferencias de perfil → +5 (inicial)
```

El score se decae suavemente con el tiempo para reflejar gustos actuales (no solo histórico). Se recalcula en cada llamada a `/api/affinity`.

#### Auto-tagging por IA (`lib/place-auto-tagging.ts`)

Al registrar un local nuevo (desde Google Maps o sugerido por usuario):
1. Se recopila: nombre del local, categoría de Google, dirección, primeras reseñas
2. Se envía a Claude con un prompt estructurado
3. Claude retorna un JSON con tags sugeridos por categoría
4. Los tags pasan por normalización y se insertan en `place_tags` con `source = 'ai'`
5. Los tags de usuario tienen `source = 'user'` y mayor peso en el match score

#### Feedback de tags (usuarios contribuyen)

Los usuarios pueden confirmar o rechazar tags de un local desde la vista de detalle:
- Confirmar → `tag_feedback` con `vote = 1` → aumenta el peso del tag en ese local
- Rechazar → `tag_feedback` con `vote = -1` → reduce el peso
- Endpoint: `/api/places/tag-feedback`

Esto permite que la comunidad corrija errores del auto-tagging de IA.

### Identidad anónima

Antes del login, el usuario tiene una identidad anónima (`lib/identity.ts`) almacenada en localStorage. Permite trackear afiniades e historial pre-registro, que se migran al perfil real al hacer login.

---

## Estado actual y trabajo pendiente

### Funcionalidades implementadas

- [x] Mapa interactivo con locales (Leaflet)
- [x] Feed de descubrimiento (Reels Feed)
- [x] Feed de videos cortos (Reels View)
- [x] Vista "Hot Picadas" con filtros
- [x] Detalle de local con reseñas, fotos y tags
- [x] Sistema de reseñas multi-tag (mood, venue, comida)
- [x] Scanner de platos con IA (Claude vision)
- [x] Gamificación: XP, niveles, streaks, logros, leaderboard
- [x] Auth con Supabase (magic link email)
- [x] Perfil de usuario con historial y colecciones
- [x] Feed social de comunidad
- [x] Búsqueda avanzada con filtros de zona, categoría, precio
- [x] Recomendaciones personalizadas por afinidad de tags
- [x] Auto-tagging de locales por IA
- [x] Match score local-usuario
- [x] Onboarding de primer uso
- [x] Soporte dark mode
- [x] App Android via Capacitor (build configurado)
- [x] Upload de imágenes y videos a Supabase Storage

### Trabajo pendiente / Known issues

- [ ] Push notifications nativas en Android (Capacitor Push Plugin pendiente)
- [ ] Sistema de comentarios en posts (UI parcial, API pendiente)
- [ ] Moderación de contenido (actualmente sin filtros automáticos)
- [ ] Caché offline para el mapa (Service Worker)
- [ ] Tests unitarios e integración (sin cobertura actual)
- [ ] CI/CD pipeline (sin configurar)
- [ ] Rate limiting en API Routes (sin implementar)
- [ ] La carpeta `feedie/` contiene un fork/prototipo alternativo del proyecto — no está integrada en el build principal
- [ ] Mejoras en la UX y reparación de gamificación ya implementada
- [ ] Fix de formularios y corroboración de tags
- [ ] Mejora en flujo de Foodie (Red Social)

---

## Estructura de la DB — Diagrama simplificado

```
auth.users
    │
    ├── profiles (1:1)
    ├── user_preferences (1:1)
    ├── user_visits (1:N)
    ├── user_favorites (1:N)
    ├── user_reviews (1:N)
    ├── user_achievements (1:N)
    └── user_tag_affinity (1:N)

places
    ├── posts (N:1)
    ├── place_tags (N:1)
    └── user_reviews → places (N:1)

tag_catalog
    ├── place_tags (N:1)
    └── user_tag_affinity (N:1)
```

---

> Proyecto desarrollado para el mercado chileno. Lenguaje de la UI: español (Chile).  
> Stack elegido para máxima velocidad de desarrollo con tipado fuerte end-to-end (TypeScript + Zod + Supabase types).
