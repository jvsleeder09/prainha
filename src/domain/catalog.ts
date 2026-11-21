import { normalizeText } from './format.ts'
import { restrictionViolation } from './recommendation.ts'
import type { DietRestriction, Interest, Product, Protein } from './types.ts'

export type SortOption = 'relevancia' | 'menor-preco' | 'maior-preco' | 'nome'

export interface CatalogFilters {
  query: string
  categoryId: string | null
  restrictions: DietRestriction[]
  proteins: Protein[]
  tags: Interest[]
  onlyAvailable: boolean
  sort: SortOption
}

export const DEFAULT_FILTERS: CatalogFilters = {
  query: '',
  categoryId: null,
  restrictions: [],
  proteins: [],
  tags: [],
  onlyAvailable: false,
  sort: 'relevancia',
}

/** Pontua a relevância textual da busca (nome pesa mais que ingredientes). */
function textScore(product: Product, terms: string[]): number {
  if (terms.length === 0) return 0
  const name = normalizeText(product.name)
  const desc = normalizeText(product.description)
  const ingredients = product.ingredients.map(normalizeText).join(' ')
  let score = 0
  for (const t of terms) {
    if (name.includes(t)) score += 3
    else if (ingredients.includes(t)) score += 2
    else if (desc.includes(t)) score += 1
    else return -1 // todos os termos precisam aparecer em algum campo
  }
  return score
}

export function filterProducts(products: Product[], f: CatalogFilters): Product[] {
  const terms = normalizeText(f.query).split(' ').filter((t) => t.length > 1)
  const scored: Array<{ p: Product; s: number }> = []
  for (const p of products) {
    if (f.onlyAvailable && !p.available) continue
    if (f.categoryId && p.categoryId !== f.categoryId) continue
    if (restrictionViolation(p, f.restrictions)) continue
    if (f.proteins.length > 0 && !p.proteins.some((x) => f.proteins.includes(x))) continue
    if (f.tags.length > 0 && !f.tags.every((t) => p.tags.includes(t))) continue
    const s = textScore(p, terms)
    if (s < 0) continue
    scored.push({ p, s })
  }
  const byName = (a: Product, b: Product) => a.name.localeCompare(b.name, 'pt-BR')
  scored.sort((a, b) => {
    switch (f.sort) {
      case 'menor-preco':
        return a.p.price - b.p.price
      case 'maior-preco':
        return b.p.price - a.p.price
      case 'nome':
        return byName(a.p, b.p)
      case 'relevancia':
        // disponíveis primeiro, depois relevância textual, destaques e nome
        return (
          Number(b.p.available) - Number(a.p.available) ||
          b.s - a.s ||
          Number(b.p.featured) - Number(a.p.featured) ||
          byName(a.p, b.p)
        )
    }
  })
  return scored.map((x) => x.p)
}

export function activeFilterCount(f: CatalogFilters): number {
  return (
    (f.query.trim() ? 1 : 0) +
    (f.categoryId ? 1 : 0) +
    f.restrictions.length +
    f.proteins.length +
    f.tags.length +
    (f.onlyAvailable ? 1 : 0)
  )
}
