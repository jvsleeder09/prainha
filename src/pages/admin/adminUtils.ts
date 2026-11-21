import { createId } from '../../domain/format.ts'
import type { Product } from '../../domain/types.ts'

export function emptyProduct(categoryId: string): Product {
  return {
    id: createId('prod-'),
    slug: '',
    name: '',
    description: '',
    categoryId,
    price: 0,
    weightGrams: null,
    proteins: [],
    tags: [],
    ingredients: [],
    contains: [],
    vegetarian: false,
    vegan: false,
    nutrition: null,
    available: true,
    featured: false,
    demo: false,
    art: { main: '#E3A857', side: '#F5EFE2', garnish: '#4E8B3A' },
  }
}

