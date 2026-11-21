import { formatPrice, normalizeText } from './format.ts'
import { INTEREST_LABELS, PROTEIN_LABELS } from './options.ts'
import type {
  Allergen,
  DietRestriction,
  ExcludedProduct,
  Preferences,
  Product,
  Recommendation,
  RecommendationReason,
  RecommendationResult,
} from './types.ts'

/**
 * Motor de recomendação da Prainha.
 *
 * Funciona em duas etapas, sempre com base apenas nos dados cadastrados:
 * 1. Filtros obrigatórios (restrições, ingredientes a evitar, preço máximo,
 *    disponibilidade). Produtos reprovados são listados em `excluded` com o motivo.
 * 2. Pontuação dos produtos restantes por afinidade (proteínas e interesses).
 *    Cada ponto ganho gera uma justificativa legível.
 */

export const SCORE_WEIGHTS = {
  protein: 3,
  interest: 2,
  featured: 1,
  economicoBonus: 2,
} as const

const RESTRICTION_TO_ALLERGEN: Partial<Record<DietRestriction, Allergen>> = {
  'sem-lactose': 'lactose',
  'sem-gluten': 'gluten',
  'sem-frutos-do-mar': 'frutos-do-mar',
}

/** Verifica as restrições alimentares. Retorna o motivo da exclusão ou null. */
export function restrictionViolation(product: Product, restrictions: DietRestriction[]): string | null {
  for (const r of restrictions) {
    const allergen = RESTRICTION_TO_ALLERGEN[r]
    if (allergen && product.contains.includes(allergen)) {
      return `Cadastrado com ${allergen === 'frutos-do-mar' ? 'frutos do mar' : allergen}`
    }
    if (r === 'vegetariano' && !product.vegetarian && !product.vegan) {
      return 'Não é vegetariano'
    }
    if (r === 'vegano' && !product.vegan) {
      return 'Não é vegano'
    }
  }
  return null
}

/** Retorna o primeiro ingrediente a evitar presente no produto, ou null. */
export function avoidedIngredient(product: Product, avoid: string[]): string | null {
  if (avoid.length === 0) return null
  const haystack = product.ingredients.map(normalizeText)
  for (const raw of avoid) {
    const term = normalizeText(raw)
    if (term.length < 2) continue
    if (haystack.some((ing) => ing.includes(term))) return raw
  }
  return null
}

/** Limite de preço que define um produto como "econômico": o terço mais barato do catálogo. */
export function economicoThreshold(products: Product[]): number {
  const prices = products.map((p) => p.price).sort((a, b) => a - b)
  if (prices.length === 0) return 0
  return prices[Math.max(0, Math.ceil(prices.length / 3) - 1)]
}

export function recommend(products: Product[], prefs: Preferences, limit = 6): RecommendationResult {
  const excluded: ExcludedProduct[] = []
  const candidates: Product[] = []

  for (const product of products) {
    if (!product.available) {
      excluded.push({ productId: product.id, reason: 'Indisponível no momento' })
      continue
    }
    const violation = restrictionViolation(product, prefs.restrictions)
    if (violation) {
      excluded.push({ productId: product.id, reason: violation })
      continue
    }
    const avoided = avoidedIngredient(product, prefs.avoidIngredients)
    if (avoided) {
      excluded.push({ productId: product.id, reason: `Contém "${avoided}", que você quer evitar` })
      continue
    }
    if (prefs.maxPrice !== null && product.price > prefs.maxPrice) {
      excluded.push({ productId: product.id, reason: `Acima do seu limite de ${formatPrice(prefs.maxPrice)}` })
      continue
    }
    candidates.push(product)
  }

  const cheapLimit = economicoThreshold(products.filter((p) => p.available))
  const recommendations: Recommendation[] = candidates.map((product) => scoreProduct(product, prefs, cheapLimit))

  recommendations.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const pa = products.find((p) => p.id === a.productId)
    const pb = products.find((p) => p.id === b.productId)
    return (pa?.price ?? 0) - (pb?.price ?? 0)
  })

  return { recommendations: recommendations.slice(0, limit), excluded }
}

function scoreProduct(product: Product, prefs: Preferences, cheapLimit: number): Recommendation {
  const reasons: RecommendationReason[] = []
  let score = 0

  const matchedProteins = product.proteins.filter((p) => prefs.proteins.includes(p))
  if (matchedProteins.length > 0) {
    score += matchedProteins.length * SCORE_WEIGHTS.protein
    reasons.push({
      kind: 'positive',
      text: `Tem ${matchedProteins.map((p) => PROTEIN_LABELS[p].toLowerCase()).join(' e ')}, que você prefere`,
    })
  }

  for (const interest of prefs.interests) {
    if (interest === 'economico') {
      if (product.price <= cheapLimit) {
        score += SCORE_WEIGHTS.economicoBonus
        reasons.push({ kind: 'positive', text: `Está entre as opções mais em conta (${formatPrice(product.price)})` })
      }
      continue
    }
    if (product.tags.includes(interest)) {
      score += SCORE_WEIGHTS.interest
      reasons.push({ kind: 'positive', text: `Marcado como “${INTEREST_LABELS[interest]}”` })
    }
  }

  if (product.featured) {
    score += SCORE_WEIGHTS.featured
    reasons.push({ kind: 'neutral', text: 'Destaque do cardápio' })
  }

  for (const r of prefs.restrictions) {
    reasons.push({ kind: 'neutral', text: `Atende ao filtro “${restrictionLabel(r)}” segundo o cadastro` })
  }

  if (product.nutrition === null && prefs.interests.some((i) => i === 'leve' || i === 'proteico' || i === 'low-carb')) {
    reasons.push({ kind: 'warning', text: 'Informação nutricional ainda não cadastrada' })
  }

  if (reasons.length === 0) {
    reasons.push({ kind: 'neutral', text: 'Compatível com seus filtros' })
  }

  return { productId: product.id, score, reasons }
}

function restrictionLabel(r: DietRestriction): string {
  switch (r) {
    case 'sem-lactose':
      return 'sem lactose'
    case 'sem-gluten':
      return 'sem glúten'
    case 'vegetariano':
      return 'vegetariano'
    case 'vegano':
      return 'vegano'
    case 'sem-frutos-do-mar':
      return 'sem frutos do mar'
  }
}

/** Produtos recomendados sem preferências: destaques disponíveis. */
export function featuredProducts(products: Product[], limit = 4): Product[] {
  return products.filter((p) => p.available && p.featured).slice(0, limit)
}
