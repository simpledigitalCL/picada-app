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
15. [Roadmap B2B — Funcionalidades por desarrollar](#roadmap-b2b--funcionalidades-por-desarrollar)

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

Los tags son el corazón del sistema de personalización. Conectan a los usuarios con los locales a través de sus preferencias reales de consumo. El sistema funciona en tres capas: clasificación, motor de sugerencias y pipeline de ejecución — **sin IA generativa**, basado enteramente en pesos, frecuencias y afinidad del usuario.

#### Tipos de tags

| Tipo | Ejemplos | Origen |
|---|---|---|
| **Comida** | `pizza`, `sushi`, `vegano`, `sin_gluten` | Usuario + curación |
| **Ambiente/Venue** | `romantico`, `familiar`, `terraza`, `pet_friendly` | Usuario + curación |
| **Mood** | `chill`, `para_grupos`, `noche`, `almuerzo_rapido` | Usuario |
| **Clasificación** | `picada`, `restoran`, `cafe`, `bar` | Mapeo desde categorías de Google Maps |
| **Experiencia** | `buen_servicio`, `precio_calidad`, `instagram_worthy` | Usuario |

---

#### Capa 1 — Clasificación (`local_slug`)

Cuando se selecciona un local de Google Maps (o de la DB interna), el sistema recibe las **categorías crudas** del lugar (ej: `['cafe', 'bakery', 'establishment']`) y las convierte en un `local_slug` normalizado que actúa como ID de clase para el motor de tags.

**Algoritmo de mapeo (`lib/place-category-filter.ts`):**

```
1. Priorización
   → Se recorre un diccionario de keywords de ALTA PRIORIDAD
   → Si se encuentra "bar", se detiene ahí aunque también diga "restaurant"
   → Evita clasificaciones ambiguas

2. Normalización por sinónimos
   → Si no hay coincidencia exacta, busca en un segundo nivel de sinónimos
   → "coffee_shop" → "cafe", "pizzeria" → "pizzeria", etc.

3. Resultado
   → local_slug: string normalizado (ej: "local_cafe", "local_pizzeria", "local_bar")
   → Este slug es la clave de entrada al motor de sugerencias
```

---

#### Capa 2 — Motor de Sugerencias (Grafo de Afinidad)

Para un `local_slug` dado, el sistema calcula la relevancia de cada tag posible combinando tres señales:

```
Score de Relevancia = Tags de Curación + Frecuencia de Uso + Afinidad del Usuario

│
├── Tags de Curación (peso fijo)
│     → Tags "obligatorios" definidos manualmente para cada categoría
│     → Ej: "Café de Especialidad" siempre aparece para local_cafe
│     → Garantiza que locales nuevos ya tienen tags base correctos
│
├── Frecuencia de Uso (popularidad reciente)
│     → Tags que otros usuarios han usado más para ese tipo de local
│     → Ventana: últimos 30 días
│     → Almacenado en: tag_relations_stats (conteo por local_slug + tag)
│
└── Afinidad del Usuario (personalización)
      → Si el usuario suele marcar tags "Vegano", su peso sube en la lista
      → Basado en: user_tag_affinity (score acumulado por interacciones)
      → El mismo tag puede aparecer en posición 3 para un usuario y 8 para otro
```

La consulta que combina estas tres señales se ejecuta en Supabase como RPC (`/api/suggestions?source=local_slug`), devolviendo los tags ya ordenados por score.

---

#### Capa 3 — Pipeline de Ejecución

El algoritmo se dispara en este orden al abrir el formulario de publicación:

```
Paso A — Detección (frontend)
  → Al seleccionar el lugar, se ejecuta derivedLocalSlug()
  → Input: categorías crudas de Google Maps
  → Output: local_slug normalizado

Paso B — Carga silenciosa
  → Mientras el usuario pasa del Paso 0 al Paso 1 del Wizard de post
  → Se dispara fetch a /api/suggestions?source={local_slug}
  → El usuario no espera: los tags cargan en segundo plano

Paso C — Filtrado de exclusión
  → Antes de renderizar, se filtran los tags que el usuario ya seleccionó
  → Evita duplicados en la lista de sugerencias

Paso D — Renderizado dinámico
  → Tags ordenados por Score de Relevancia descendente
  → El usuario ve primero los más relevantes para su perfil y ese tipo de local
```

---

#### Acumulación de afinidad (`user_tag_affinity`)

Cada interacción del usuario actualiza su perfil de afinidad:

```
Acción                        → Delta de afinidad
──────────────────────────────────────────────────
Elegir tag en reseña          → +3
Visitar local con ese tag     → +2
Like a post con ese tag       → +1
Buscar con ese tag            → +1
Tag en preferencias de perfil → +5 (inicial, al configurar cuenta)
```

El score acumulado se usa como entrada en la Capa 2 para personalizar el orden de sugerencias. Se actualiza vía `/api/affinity/track` y se almacena en `user_tag_affinity`.

---

#### Feedback comunitario de tags

Los usuarios pueden confirmar o rechazar tags de un local desde la vista de detalle:
- Confirmar → `tag_feedback` con `vote = 1` → aumenta el peso del tag en ese local
- Rechazar → `tag_feedback` con `vote = -1` → reduce el peso
- Endpoint: `/api/places/tag-feedback`

Esto permite que la comunidad corrija errores de clasificación sin intervención manual.

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

---

## Roadmap B2B — Funcionalidades por desarrollar

Esta sección documenta las funcionalidades del modelo de negocio que **aún no están implementadas** en el código actual. El programador debe leerla como la hoja de ruta del producto: qué viene después, cómo se conecta con lo ya construido y qué nuevas tablas/endpoints se necesitan.

---

### 1. SaaS para Locales (B2B) — Módulo de Suscripciones

El modelo de ingresos principal. Los locales pagan una suscripción mensual para acceder a estadísticas, herramientas de marketing y visibilidad premium dentro de la app.

#### Planes definidos

| Plan | Precio/mes | Funcionalidades clave |
|---|---|---|
| **Básico** | Gratis | Perfil básico, máx. 5 fotos, sin estadísticas |
| **Local Verificado** | CLP $19.990 | Badge oficial, estadísticas de visitas, respuesta a reseñas, 1 oferta/mes |
| **Local Pro** | CLP $39.990 | Todo lo anterior + campañas a Inspectores, API de menú pública, exportación de datos |
| **Cadena / Franquicia** | CLP $89.990 | Multi-sucursal, dashboard centralizado, informe mensual de tendencias |

#### Qué hay que construir

```
Nuevas tablas en Supabase:
  local_subscriptions   → plan_id, local_id, status, billing_cycle, next_billing_at
  local_subscription_plans → id, name, price_clp, features_json, limits_json

Nuevos endpoints:
  /api/billing/subscribe       → crear/actualizar suscripción (integrar con Transbank o Stripe)
  /api/billing/webhook         → recibir eventos de pago (renovación, fallo, cancelación)
  /api/local/dashboard         → estadísticas del local: visitas, conversiones, alcance

Nuevo panel en la app:
  /app/local-dashboard/        → vista exclusiva para dueños de locales suscritos
    ├── métricas de visitas generadas por la app
    ├── historial de reseñas recibidas con gestión de respuesta
    ├── gestión de ofertas activas para Inspectores
    └── exportación de datos en CSV/PDF
```

**Nota técnica:** El campo `plan_id` del local determina qué funcionalidades se habilitan en la API. Implementar como middleware de autorización que verifica el plan antes de responder endpoints premium.

---

### 2. Motor de Comisiones por Conversión (Performance)

Modelo de pago por resultado: los locales pagan **8% de comisión** sobre menús de prueba canjeados a través de la app. Si no hay canje exitoso, no hay cobro.

#### Flujo del canje

```
1. Local publica oferta ("Menú de prueba gratis para Inspectores nivel 3+")
   → tabla: local_offers (id, local_id, description, discount_type, min_inspector_level, quota, expires_at)

2. Usuario Inspector ve la oferta y la reserva
   → tabla: offer_reservations (id, offer_id, user_id, qr_code_token, reserved_at, status)

3. En el local, el usuario presenta el QR
   → endpoint: POST /api/offers/redeem { token }
   → validar: token válido, usuario tiene nivel requerido, cupo disponible
   → marcar como canjeado

4. Canje confirmado → registrar comisión
   → tabla: commissions (id, offer_id, local_id, amount_clp, rate, status, created_at)
   → cobro agrupado mensual al local

5. Dar XP al usuario por el canje
   → emitir evento de dominio → motor de gamificación
```

**Estado actual:** La tabla `local_offers` y el sistema de QR no están implementados. La gamificación está lista para recibir el evento del canje.

---

### 3. Algoritmo de Tendencias — Motor Viral

El motor que detecta qué locales están emergiendo **antes que nadie**, basado en 7 señales en tiempo real. Es uno de los diferenciadores clave del producto.

#### Las 7 señales y sus pesos

| Señal | Peso | Descripción técnica |
|---|---|---|
| Velocidad de escaneos | 25% | Aceleración en fotos subidas en ventana de 48h (derivada del conteo) |
| Tasa de compartición | 20% | `comparticiones / visitas_app` por local en los últimos 7 días |
| Verificación comunitaria | 20% | Nº de usuarios distintos que validaron el mismo plato |
| Conversión de contenido | 15% | Clics desde RRSS hacia el perfil del local en la app |
| Rating de precisión | 10% | Coincidencia entre macros estimados y datos confirmados por el local |
| Frecuencia de retorno | 5% | % de usuarios que visitan el mismo local más de 1 vez en 30 días |
| Diversidad de perfiles | 5% | Distintos tipos de dieta (tags) presentes entre los visitantes |

#### Qué hay que construir

```
Nueva tabla:
  trend_scores (id, local_id, score_total, signals_json, badge_active, calculated_at)
  → calculada periódicamente (cron job cada 6h)
  → signals_json almacena el detalle de cada señal para auditoría

Nuevo endpoint:
  GET /api/picada-ranking/trending   → top 20 locales por trend_score en una zona
  → ya existe /api/picada-ranking, extender con este modo

Job periódico (Edge Function o cron en Supabase):
  → recalcula trend_scores cada 6 horas
  → activa/desactiva el badge "Local Emergente" en el mapa

Efecto en UI:
  → badge especial en el mapa para locales con badge_active = true
  → sección "Emergiendo ahora" en el feed de inicio
```

**Nota importante:** El algoritmo tiene un efecto flywheel intencional: aparecer como emergente aumenta el tráfico, que aumenta el score, que mantiene el badge. Diseñado para favorecer orgánicamente a locales de calidad sobre los que pagan publicidad.

---

### 4. Content Engine — Herramientas de Contenido Viral

Motor que convierte la actividad de los usuarios en activos para redes sociales. Es la funcionalidad que cierra el loop entre la app y el contenido viral en TikTok/Instagram.

#### Componentes a desarrollar

**a) Data-overlay automático**
- Al escanear un plato y obtener los macros, generar una tarjeta visual (imagen PNG) con los datos superpuestos, lista para compartir en Stories/Reels
- Tecnología sugerida: Fabric.js (ya instalado) o Satori (generación de imágenes en Edge Functions)
- Endpoint: `POST /api/content/generate-overlay { scan_id }` → devuelve URL de imagen generada en Supabase Storage

**b) Picada Wrapped (anual)**
- Resumen estilo Spotify: "Este año visitaste 47 locales, consumiste X calorías, tu picada favorita fue..."
- Datos disponibles en: `user_visits`, `user_reviews`, `escaneos`
- Endpoint: `GET /api/content/wrapped?year=2025&user_id=...`
- Genera una secuencia de slides (imágenes o animación) exportable

**c) Media Kit para locales**
- Badge descargable "Local Verificado en Picada.App" con datos reales
- Incluye: nº de visitas generadas por la app, rating de la comunidad, mes de verificación
- Disponible solo para plan Local Verificado o superior
- Endpoint: `GET /api/local/media-kit { local_id }` → PDF o imagen PNG

**d) Tracking de conversiones desde RRSS**
- URL con parámetros UTM generada para cada influencer/post: `picada.app/local/{id}?ref={usuario_id}`
- Al abrir, registra en `content_conversions (id, local_id, referrer_user_id, source_platform, clicked_at)`
- El influencer puede ver en su perfil cuántas visitas físicas generó su contenido

---

### 5. Dashboard Influencer-Local (Colaboración)

Panel que conecta a Inspectores/influencers con locales para campañas medibles.

#### Flujo de colaboración

```
Local (plan Pro) crea una campaña:
  → "Busco Inspectores nivel 2+ para probar nuestro nuevo menú de verano"
  → define: cupo, nivel mínimo requerido, beneficio, fecha límite

Inspector postula / acepta:
  → notificación push al Inspector que califica
  → acepta → reserva QR (ver módulo de comisiones)

Local valida la visita:
  → escanea QR del Inspector en caja
  → sistema registra: visita confirmada, foto del plato requerida

Post-visita:
  → Inspector sube contenido (foto/video) etiquetando el local
  → el link de la publicación se adjunta a la campaña
  → local ve en su dashboard: cuántos posts generó, alcance estimado, conversiones

Inspector ve en su perfil:
  → campañas participadas, visitas generadas, comisión acumulada (si aplica nivel Gurú)
```

**Nuevas tablas requeridas:**
```sql
campaigns         (id, local_id, title, min_level, quota, benefit, status, expires_at)
campaign_joins    (id, campaign_id, user_id, status, qr_token, joined_at, visited_at)
campaign_content  (id, campaign_join_id, content_url, platform, reach_estimated)
```

---

### 6. Módulo de Datos e Inteligencia de Mercado (Enterprise)

Venta de reportes de tendencias anonimizados a supermercados, marcas de alimentos, fondos de inversión y municipios.

#### Ejemplos de reportes

- "Los platos de pollo aumentaron 34% en locales de Providencia en los últimos 90 días"
- "El tag 'keto' creció 2,3x en búsquedas durante enero en RM"
- "Top 10 comunas con mayor densidad de locales veganos verificados"

#### Qué hay que construir

```
Capa de anonimización:
  → nunca exponer user_id ni datos individuales
  → agregar por local_slug + zona geográfica + período de tiempo
  → umbral mínimo: solo publicar datos con N ≥ 30 registros (protección de privacidad)

Endpoint interno de generación de reportes:
  POST /api/enterprise/reports/generate
  → input: tipo de reporte, zona, período, categoría
  → output: JSON con datos agregados + PDF renderizado

Panel de administración (ya existe /app/api/admin/):
  → gestionar clientes enterprise, emitir reportes, registrar pagos
  → acceso restringido por SUPABASE_SERVICE_ROLE_KEY + rol admin en profiles

Precio por reporte: desde CLP $2.500.000
```

---

### 7. Seed Data — Script de Carga Inicial de Locales

Para resolver el problema del "mapa vacío al lanzar", se necesita un script que pre-cargue locales desde Google Maps antes del lanzamiento público.

#### Plan técnico

```
Script: scripts/seed-places.py  (pendiente de crear)

Fuentes de datos:
  1. Google Maps Places API (New) — búsqueda por zona + categoría
  2. Foursquare Places API (tier gratuito) — enriquecer con teléfono, precio estimado
  3. Curación manual — 200 "picadas destacadas" con datos verificados a mano

Ciudades objetivo al lanzamiento:
  → Santiago RM (prioridad), Valparaíso, Concepción, Temuco, Rancagua, Antofagasta

Volumen objetivo: 5.000 locales pre-cargados antes del lanzamiento público

Proceso:
  1. Buscar por zona geográfica + categoría (restaurant, cafe, bar, picada, etc.)
  2. Mapear categorías de Google → local_slug (Capa 1 del sistema de tags)
  3. Insertar en tabla places con source = 'seed'
  4. Disparar auto-tagging por el sistema de puntuación (no IA)
  5. Marcar como verified = false hasta validación comunitaria

Consideraciones éticas:
  → respetar rate limits de las APIs
  → no scraping directo de HTML, solo APIs oficiales
  → datos solo de acceso público (nombre, dirección, categoría, horarios)
```

---

### 8. Push Notifications — Firebase Cloud Messaging

Alertas en tiempo real para aumentar el retention y el engagement.

#### Notificaciones prioritarias a implementar

| Trigger | Mensaje | Prioridad |
|---|---|---|
| Menú ejecutivo activo en local favorito | "🍽 La Picada de Doña Rosa tiene menú activo ahora (11:30–15:00)" | Alta |
| Inspector sube de nivel | "🏆 Subiste a Inspector nivel 3 — ya puedes acceder a menús de prueba" | Alta |
| Local emergente cerca | "🔥 Nuevo local emergente a 3 cuadras de tu zona habitual" | Media |
| Racha en riesgo | "⚡ Tu racha de 12 días está en riesgo — explora algo hoy" | Media |
| Campaña disponible para el nivel del usuario | "🎁 3 locales nuevos buscan Inspectores de tu nivel esta semana" | Media |
| Like recibido en reseña | "+5 XP — alguien encontró útil tu reseña en El Rincón del Profe" | Baja |

**Stack:** Firebase Cloud Messaging (FCM) para Android, APNs para iOS cuando se migre a Flutter. El token del dispositivo se almacena en `profiles.fcm_token`.

---

### 9. Migración a Flutter (iOS + Android nativo)

El estado actual usa **Next.js + Capacitor** para Android. El plan de negocio contempla migrar a **Flutter** para tener un producto nativo en iOS y Android con mejor rendimiento.

#### Decisión arquitectónica pendiente

```
Opción A — Mantener Next.js + Capacitor (corto plazo)
  Pros: todo el código actual sirve, iOS via Capacitor también
  Contras: rendimiento inferior al nativo, limitaciones de WebView

Opción B — Migrar a Flutter (mediano plazo)
  Pros: rendimiento nativo, mejor UX en mobile, acceso completo a APIs del SO
  Contras: reescribir toda la UI (components/ → widgets Flutter)
  El backend (Supabase + API Routes) no cambia

Recomendación: mantener Next.js para el MVP y primeros 6 meses.
Evaluar migración a Flutter al iniciar Año 2 si el presupuesto y el equipo lo permiten.
```

**Módulos que NO cambian en la migración:**
- Toda la lógica de `lib/` (se puede portar a Dart o consumir via API)
- Las API Routes de Next.js (el backend sigue siendo el mismo)
- El schema de Supabase

**Módulos que sí hay que reescribir:**
- Todo `components/` → widgets Flutter
- `app/page.tsx` y navegación → Navigator 2.0 / GoRouter en Flutter

---

### Resumen de prioridades para el programador

```
FASE 1 — MVP B2B (meses 1-3)
  ✦ Panel de suscripciones para locales (tabla local_subscriptions + UI básica)
  ✦ Sistema de ofertas + QR de canje (tablas local_offers + offer_reservations)
  ✦ Push notifications con FCM (token en profiles + endpoint de envío)

FASE 2 — Motor de crecimiento (meses 3-6)
  ✦ Algoritmo de tendencias (trend_scores + cron job)
  ✦ Data-overlay automático para compartir macros en RRSS
  ✦ Dashboard de conversiones para influencers

FASE 3 — Escala B2B (meses 6-12)
  ✦ Dashboard completo para locales (estadísticas, campañas, media kit)
  ✦ Script de seed data para nuevas ciudades
  ✦ Módulo de reportes enterprise (anonimizados, con capa de privacidad)
  ✦ Evaluar migración Flutter según métricas de UX
```
