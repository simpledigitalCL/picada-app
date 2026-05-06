export type Category = 'keto' | 'fitness' | 'vegano' | 'picada' | 'premium' | 'cafe' | 'japones'

export const CATEGORY_META: Record<Category | 'all', { label: string; emoji: string; color: string }> = {
  all:     { label: 'Todos',    emoji: '🍽️', color: 'bg-foreground text-background' },
  picada:  { label: 'Picada',   emoji: '🥩', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
  vegano:  { label: 'Vegano',   emoji: '🌱', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  fitness: { label: 'Fitness',  emoji: '💪', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  keto:    { label: 'Keto',     emoji: '🥑', color: 'bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300' },
  premium: { label: 'Premium',  emoji: '⭐', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
  cafe:    { label: 'Café',     emoji: '☕', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  japones: { label: 'Japonés',  emoji: '🍣', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
}

export interface StarPlate {
  name: string
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export interface Restaurant {
  id: string
  name: string
  category: Category
  description: string
  address: string
  comuna: string
  lat: number
  lng: number
  rating: number
  reviewCount: number
  distance: string
  priceRange: 1 | 2 | 3
  tags: string[]
  imageUrl: string
  starPlate: StarPlate
  openNow: boolean
  mapsUrl?: string
  phone?: string
  website?: string
  whatsapp?: string
  instagram?: string
  tiktok?: string
  /** Extractos de reseñas externas (Google/OSM) para fallback de UI. */
  reviewsText?: string[]
  /** Fotos externas disponibles para hero/tabs cuando no hay comunidad local. */
  gallery?: string[]
  /** Google/OSM con poca foto o sin extractos de reseña: bonus ×2 XP al aportar */
  coverageSparse?: boolean
  /** Clasificación inicial IA (prioridad comunidad después) — corresponde a `places.tagging_meta` */
  automatedSeedTags?: Array<{ slug: string; confidence_score: number; is_automated?: boolean }>
  /** Para feedback comunitario contra `places` (sin prefijo ext-) */
  placeExternalId?: string
}

export const RESTAURANTS: Restaurant[] = [
  {
    id: '1',
    name: 'La Piojera',
    category: 'picada',
    description: 'Fundada en 1896, la picada más icónica de Chile. Hogar del legendario Terremoto y la mejor chicha de Santiago. Un lugar que no puede faltar en ninguna lista.',
    address: 'Aillavilú 1030',
    comuna: 'Santiago Centro',
    lat: -33.4372,
    lng: -70.6506,
    rating: 4.8,
    reviewCount: 2341,
    distance: '1.2 km',
    priceRange: 1,
    tags: ['Porción grande', 'Sin TACC', 'Música en vivo', 'Ícono nacional'],
    imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
    starPlate: { name: 'Terremoto', kcal: 380, protein: 2, carbs: 52, fat: 4 },
    openNow: true,
  },
  {
    id: '2',
    name: 'El Huerto',
    category: 'vegano',
    description: 'Pioneros plant-based en Chile desde 1978. Cocina consciente, deliciosa y nutritiva en el corazón de Providencia. El referente de la gastronomía verde.',
    address: 'Orrego Luco 054',
    comuna: 'Providencia',
    lat: -33.4285,
    lng: -70.6098,
    rating: 4.9,
    reviewCount: 1820,
    distance: '2.1 km',
    priceRange: 2,
    tags: ['Vegano', 'Sin Gluten', 'Pet Friendly', 'Terraza'],
    imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
    starPlate: { name: 'Bowl Proteico', kcal: 420, protein: 24, carbs: 48, fat: 14 },
    openNow: true,
  },
  {
    id: '3',
    name: 'Poke House',
    category: 'fitness',
    description: 'Pokes frescos y macro-friendly. El favorito post-entreno de Vitacura. Personalizables, rápidos y nutritivos. 100% adaptable a tu plan.',
    address: 'Av. Vitacura 3442',
    comuna: 'Vitacura',
    lat: -33.3985,
    lng: -70.5910,
    rating: 4.7,
    reviewCount: 980,
    distance: '4.3 km',
    priceRange: 2,
    tags: ['Keto', 'Alto Proteína', 'Sin Gluten', 'Para llevar'],
    imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
    starPlate: { name: 'Poke Salmón', kcal: 480, protein: 36, carbs: 42, fat: 18 },
    openNow: true,
  },
  {
    id: '4',
    name: 'La Fuente Alemana',
    category: 'picada',
    description: 'El lomito más famoso de Chile desde 1958. Leyenda absoluta del centro de Santiago. Porciones generosas y sabor inconfundible.',
    address: 'Av. Lib. Bernardo O\'Higgins 58',
    comuna: 'Santiago Centro',
    lat: -33.4413,
    lng: -70.6503,
    rating: 4.7,
    reviewCount: 3120,
    distance: '1.4 km',
    priceRange: 1,
    tags: ['Ícono nacional', 'Porciones grandes', 'Rápido'],
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80',
    starPlate: { name: 'Lomito Completo', kcal: 720, protein: 38, carbs: 58, fat: 32 },
    openNow: true,
  },
  {
    id: '5',
    name: 'Café Quínoa',
    category: 'cafe',
    description: 'Café de especialidad y repostería plant-based en Barrio Italia. El rincón perfecto para trabajar, tener una reunión o una cita especial.',
    address: 'Av. Italia 1280',
    comuna: 'Barrio Italia',
    lat: -33.4360,
    lng: -70.6350,
    rating: 4.8,
    reviewCount: 640,
    distance: '2.8 km',
    priceRange: 2,
    tags: ['Vegano', 'WiFi', 'Para trabajar', 'Terraza', 'Ideal para citas'],
    imageUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80',
    starPlate: { name: 'Flat White + Croissant', kcal: 290, protein: 8, carbs: 38, fat: 11 },
    openNow: true,
  },
  {
    id: '6',
    name: 'Suchi Life',
    category: 'japones',
    description: 'Sushi premium con opciones sin gluten y sin lactosa. Ambiente íntimo ideal para citas. Ingredientes frescos de primera calidad.',
    address: 'Av. El Bosque Norte 220',
    comuna: 'Las Condes',
    lat: -33.4150,
    lng: -70.6000,
    rating: 4.6,
    reviewCount: 720,
    distance: '5.1 km',
    priceRange: 3,
    tags: ['Sin Gluten', 'Sin Lactosa', 'Ideal para cita', 'Reserva recomendada'],
    imageUrl: 'https://images.unsplash.com/photo-1562802378-063ec186a863?w=800&q=80',
    starPlate: { name: 'Roll Celiaco', kcal: 320, protein: 18, carbs: 45, fat: 9 },
    openNow: false,
  },
  {
    id: '7',
    name: 'Boragó',
    category: 'premium',
    description: 'Cocina chilena contemporánea al más alto nivel. Uno de los mejores restaurantes de Latinoamérica. Una experiencia gastronómica única e irrepetible.',
    address: 'Av. Nueva Costanera 3467',
    comuna: 'Vitacura',
    lat: -33.4021,
    lng: -70.5876,
    rating: 4.9,
    reviewCount: 1240,
    distance: '5.8 km',
    priceRange: 3,
    tags: ['Fine Dining', 'Cocina chilena', 'Reserva requerida', 'Premiado'],
    imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
    starPlate: { name: 'Menú Degustación', kcal: 850, protein: 45, carbs: 70, fat: 38 },
    openNow: true,
  },
  {
    id: '8',
    name: 'KetoBurger',
    category: 'keto',
    description: 'Hamburguesas sin pan, bowls y ensaladas keto. Sin carbohidratos innecesarios. Alto en proteína, bajo en carbs, máximo sabor garantizado.',
    address: 'Av. Apoquindo 4501',
    comuna: 'Las Condes',
    lat: -33.4180,
    lng: -70.5990,
    rating: 4.5,
    reviewCount: 450,
    distance: '4.8 km',
    priceRange: 2,
    tags: ['Keto', 'Sin Gluten', 'Alto Proteína', 'Para llevar'],
    imageUrl: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=800&q=80',
    starPlate: { name: 'Keto Burger Bowl', kcal: 520, protein: 42, carbs: 8, fat: 36 },
    openNow: true,
  },
]

export function filterRestaurants(
  restaurants: Restaurant[],
  category: string,
  query: string,
  locationQuery = '',
): Restaurant[] {
  const stopWords = new Set(['de', 'la', 'el', 'los', 'las', 'del', 'y', 'en', 'region', 'región', 'city'])
  return restaurants.filter(r => {
    const matchCat = !category || r.category === category
    const q = query.toLowerCase()
    const lq = locationQuery.toLowerCase().trim()
    const locationText = `${r.comuna} ${r.address} ${r.description} ${r.tags.join(' ')}`.toLowerCase()
    const locationTokens = lq
      .split(/[,\s/()-]+/)
      .map(s => s.trim())
      .filter(s => s.length >= 3 && !stopWords.has(s))
    const matchLocation = !lq || locationTokens.length === 0 || locationTokens.some(tok => locationText.includes(tok))
    const matchQ = !q ||
      r.name.toLowerCase().includes(q) ||
      r.comuna.toLowerCase().includes(q) ||
      r.tags.some(t => t.toLowerCase().includes(q)) ||
      r.address.toLowerCase().includes(q)
    return matchCat && matchQ && matchLocation
  })
}

export function priceLabel(n: 1 | 2 | 3) {
  return ['$', '$$', '$$$'][n - 1]
}
