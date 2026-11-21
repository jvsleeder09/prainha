/**
 * Tipos centrais do domínio da Prainha.
 * Este arquivo não depende de React nem do Vite, para poder ser usado
 * nos testes (node --test) e no backend de IA.
 */

/** Valores monetários são sempre armazenados em centavos (inteiros). */
export type Cents = number

export type Allergen = 'lactose' | 'gluten' | 'ovo' | 'frutos-do-mar' | 'amendoim' | 'soja'

export type Protein = 'frango' | 'carne-bovina' | 'carne-suina' | 'peixe' | 'ovo' | 'vegetal'

export type Interest =
  | 'leve'
  | 'proteico'
  | 'low-carb'
  | 'caseiro'
  | 'apimentado'
  | 'economico'

export type DietRestriction = 'sem-lactose' | 'sem-gluten' | 'vegetariano' | 'vegano' | 'sem-frutos-do-mar'

export interface Category {
  id: string
  name: string
  description: string
  /** Ordem de exibição (menor primeiro). */
  order: number
}

export interface NutritionInfo {
  portionGrams: number
  kcal: number
  proteinGrams: number
  carbGrams: number
  fatGrams: number
}

/** Paleta usada pela ilustração SVG gerada para cada produto. */
export interface ProductArt {
  /** Cor do compartimento principal (proteína). */
  main: string
  /** Cor do acompanhamento. */
  side: string
  /** Cor da guarnição/salada. */
  garnish: string
}

export interface Product {
  id: string
  slug: string
  name: string
  description: string
  categoryId: string
  price: Cents
  /** Peso da porção em gramas, quando cadastrado. */
  weightGrams: number | null
  proteins: Protein[]
  tags: Interest[]
  /** Ingredientes cadastrados (texto livre, em minúsculas). */
  ingredients: string[]
  /** Alérgenos/componentes que o produto CONTÉM, segundo o cadastro. */
  contains: Allergen[]
  vegetarian: boolean
  vegan: boolean
  nutrition: NutritionInfo | null
  available: boolean
  featured: boolean
  /** true quando o produto é um exemplo demonstrativo, não um item real. */
  demo: boolean
  art: ProductArt
}

export interface Preferences {
  restrictions: DietRestriction[]
  proteins: Protein[]
  interests: Interest[]
  /** Ingredientes que o usuário quer evitar (texto livre normalizado). */
  avoidIngredients: string[]
  /** Preço máximo por marmita, em centavos. null = sem limite. */
  maxPrice: Cents | null
}

export interface RecommendationReason {
  kind: 'positive' | 'neutral' | 'warning'
  text: string
}

export interface Recommendation {
  productId: string
  score: number
  reasons: RecommendationReason[]
}

export interface ExcludedProduct {
  productId: string
  reason: string
}

export interface RecommendationResult {
  recommendations: Recommendation[]
  excluded: ExcludedProduct[]
}

export type HistorySource = 'preferencias' | 'assistente-ia'

export interface HistoryEntry {
  id: string
  createdAt: string
  source: HistorySource
  /** Pergunta enviada à IA, quando a origem for o assistente. */
  query: string | null
  preferences: Preferences
  /** Resumo textual (da IA ou gerado localmente). */
  summary: string
  items: Array<{ productId: string; productName: string; reasons: string[] }>
}

export interface CartItem {
  productId: string
  quantity: number
}

export type Theme = 'light' | 'dark'

export interface BusinessInfo {
  storeName: string
  tagline: string
  /** Número de WhatsApp apenas com dígitos, incluindo DDI (ex.: 5561...). Vazio = não configurado. */
  whatsappNumber: string
  deliveryInfo: string
  openingHours: string
  address: string
  instagramUrl: string
}

export type OrderStatus = 'enviado' | 'confirmado' | 'entregue' | 'cancelado'

export interface OrderRecord {
  id: string
  createdAt: string
  customerName: string
  notes: string
  fulfillment: 'entrega' | 'retirada'
  items: Array<{ productId: string; name: string; quantity: number; unitPrice: Cents }>
  total: Cents
  status: OrderStatus
}
