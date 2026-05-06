export type NutritionCategory =
  | 'keto'
  | 'fitness'
  | 'fastfood'
  | 'vegano'
  | 'vegetariano'
  | 'sin_gluten'
  | 'sin_lactosa'
  | 'premium'
  | 'cafe'
  | 'japones'

export type PlaceEnrichment = {
  nutrition_categories: NutritionCategory[]
  restrictions_supported: string[]
  cuisines: string[]
}

export function enrichPlaceText(input: string): PlaceEnrichment {
  const t = input.toLowerCase()
  const categories = new Set<NutritionCategory>()
  const restrictions = new Set<string>()
  const cuisines = new Set<string>()

  if (/keto|low carb|bajo carbo/i.test(t)) categories.add('keto')
  if (/fitness|prote[ií]na|protein|gym|fit/i.test(t)) categories.add('fitness')
  if (/burger|pizza|fast food|hot dog|completo|papas fritas/i.test(t)) categories.add('fastfood')
  if (/vegano|vegan/i.test(t)) {
    categories.add('vegano')
    restrictions.add('sin_productos_animales')
  }
  if (/vegetariano|vegetarian/i.test(t)) categories.add('vegetariano')
  if (/sin gluten|gluten free|celiaco|celíaco/i.test(t)) {
    categories.add('sin_gluten')
    restrictions.add('sin_gluten')
  }
  if (/sin lactosa|lactose free|lactosa/i.test(t)) {
    categories.add('sin_lactosa')
    restrictions.add('sin_lactosa')
  }
  if (/fine dining|premium|degustaci[oó]n|chef/i.test(t)) categories.add('premium')
  if (/caf[eé]|coffee|barista|espresso|brunch/i.test(t)) categories.add('cafe')
  if (/sushi|ramen|japon|japanese|izakaya/i.test(t)) {
    categories.add('japones')
    cuisines.add('japonesa')
  }
  if (/peru|ceviche/i.test(t)) cuisines.add('peruana')
  if (/italian|italiana|pasta|trattoria/i.test(t)) cuisines.add('italiana')
  if (/mexic|taco|burrito/i.test(t)) cuisines.add('mexicana')
  if (/chilena|picada|comida chilena/i.test(t)) cuisines.add('chilena')

  return {
    nutrition_categories: [...categories],
    restrictions_supported: [...restrictions],
    cuisines: [...cuisines],
  }
}

