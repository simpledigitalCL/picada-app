export const FOOD_LIKES_CATALOG = [
  'picada', 'comida chilena', 'mariscos', 'carne', 'sushi', 'ramen', 'vegano', 'vegetariano',
  'keto', 'sin gluten', 'sin lactosa', 'cafetería', 'pastelería', 'pizza', 'hamburguesas',
  'tacos', 'poke', 'comida coreana', 'comida japonesa', 'comida peruana', 'fusión',
  'desayuno', 'brunch', 'postres', 'street food', 'alta cocina',
]

export const FOOD_DISLIKES_CATALOG = [
  'cilantro', 'ají', 'picante', 'cebolla', 'ajo', 'mariscos', 'hígado', 'lácteos',
  'gluten', 'maní', 'soya', 'huevo', 'aceitunas', 'pescado crudo',
]

export const DIETARY_RESTRICTIONS_CATALOG = [
  'sin gluten', 'sin lactosa', 'sin fructosa', 'sin azúcar', 'sin sal agregada',
  'bajo sodio', 'bajo carbohidrato', 'keto', 'vegano', 'vegetariano',
  'sin frutos secos', 'sin maní', 'sin soya', 'sin huevo', 'sin mariscos',
  'diabético', 'hipertensión', 'celiaquía',
]

export const RELIGION_CATALOG = [
  'ninguna', 'católica', 'cristiana', 'judía', 'musulmana', 'hindú', 'budista',
]

export const RELIGION_RESTRICTIONS: Record<string, string[]> = {
  judía: ['kosher', 'sin cerdo', 'sin mariscos'],
  musulmana: ['halal', 'sin cerdo', 'sin alcohol'],
  hindú: ['sin vacuno'],
  budista: ['vegetariano'],
  católica: [],
  cristiana: [],
  ninguna: [],
}

