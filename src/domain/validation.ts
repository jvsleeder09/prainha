import { ALL_ALLERGENS, ALL_INTERESTS, ALL_PROTEINS, ALL_RESTRICTIONS } from './options.ts'
import { clampQuantity } from './cart.ts'
import type {
  BusinessInfo,
  CartItem,
  Category,
  HistoryEntry,
  OrderRecord,
  OrderStatus,
  Preferences,
  Product,
  Theme,
} from './types.ts'

/**
 * Validadores para dados vindos do LocalStorage (ou de importações JSON).
 * Cada função recebe `unknown` e devolve um valor seguro ou null.
 * Dados parcialmente corrompidos são "saneados": itens inválidos são descartados.
 */

type Rec = Record<string, unknown>

const isRecord = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const isString = (v: unknown): v is string => typeof v === 'string'
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)

function stringArray(v: unknown, max = 50): string[] {
  if (!Array.isArray(v)) return []
  return v.filter(isString).map((s) => s.slice(0, 80)).slice(0, max)
}

function enumArray<T extends string>(v: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(v)) return []
  const set = new Set<T>()
  for (const item of v) if (allowed.includes(item as T)) set.add(item as T)
  return [...set]
}

export function parseTheme(v: unknown): Theme | null {
  return v === 'light' || v === 'dark' ? v : null
}

export function parsePreferences(v: unknown): Preferences | null {
  if (!isRecord(v)) return null
  const maxPrice = isInt(v.maxPrice) && v.maxPrice > 0 ? v.maxPrice : null
  return {
    restrictions: enumArray(v.restrictions, ALL_RESTRICTIONS),
    proteins: enumArray(v.proteins, ALL_PROTEINS),
    interests: enumArray(v.interests, ALL_INTERESTS),
    avoidIngredients: stringArray(v.avoidIngredients, 20),
    maxPrice,
  }
}

export function parseIdList(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null
  return [...new Set(v.filter(isString).filter((s) => s.length > 0 && s.length <= 100))]
}

export function parseCart(v: unknown): CartItem[] | null {
  if (!Array.isArray(v)) return null
  const seen = new Set<string>()
  const items: CartItem[] = []
  for (const raw of v) {
    if (!isRecord(raw) || !isString(raw.productId) || typeof raw.quantity !== 'number') continue
    if (seen.has(raw.productId) || raw.quantity <= 0) continue
    seen.add(raw.productId)
    items.push({ productId: raw.productId, quantity: clampQuantity(raw.quantity) })
  }
  return items
}

export function parseHistory(v: unknown): HistoryEntry[] | null {
  if (!Array.isArray(v)) return null
  const entries: HistoryEntry[] = []
  for (const raw of v) {
    if (!isRecord(raw) || !isString(raw.id) || !isString(raw.createdAt)) continue
    if (raw.source !== 'preferencias' && raw.source !== 'assistente-ia') continue
    const prefs = parsePreferences(raw.preferences)
    if (!prefs || !Array.isArray(raw.items)) continue
    const items = raw.items
      .filter(isRecord)
      .filter((i) => isString(i.productId) && isString(i.productName))
      .map((i) => ({
        productId: i.productId as string,
        productName: i.productName as string,
        reasons: stringArray(i.reasons, 10),
      }))
    entries.push({
      id: raw.id,
      createdAt: raw.createdAt,
      source: raw.source,
      query: isString(raw.query) ? raw.query : null,
      preferences: prefs,
      summary: isString(raw.summary) ? raw.summary : '',
      items,
    })
  }
  return entries
}

export function parseCategory(v: unknown): Category | null {
  if (!isRecord(v) || !isString(v.id) || !isString(v.name)) return null
  return {
    id: v.id,
    name: v.name,
    description: isString(v.description) ? v.description : '',
    order: isInt(v.order) ? v.order : 0,
  }
}

export function parseCategories(v: unknown): Category[] | null {
  if (!Array.isArray(v)) return null
  return v.map(parseCategory).filter((c): c is Category => c !== null)
}

const HEX = /^#[0-9a-fA-F]{6}$/

export function parseProduct(v: unknown): Product | null {
  if (!isRecord(v)) return null
  if (!isString(v.id) || !isString(v.slug) || !isString(v.name) || !isString(v.categoryId)) return null
  if (!isInt(v.price) || v.price < 0) return null
  const art = isRecord(v.art) ? v.art : {}
  const nutrition = isRecord(v.nutrition) &&
    [v.nutrition.portionGrams, v.nutrition.kcal, v.nutrition.proteinGrams, v.nutrition.carbGrams, v.nutrition.fatGrams].every(
      (n) => typeof n === 'number' && n >= 0,
    )
    ? {
        portionGrams: v.nutrition.portionGrams as number,
        kcal: v.nutrition.kcal as number,
        proteinGrams: v.nutrition.proteinGrams as number,
        carbGrams: v.nutrition.carbGrams as number,
        fatGrams: v.nutrition.fatGrams as number,
      }
    : null
  return {
    id: v.id,
    slug: v.slug,
    name: v.name,
    description: isString(v.description) ? v.description : '',
    categoryId: v.categoryId,
    price: v.price,
    weightGrams: isInt(v.weightGrams) && v.weightGrams > 0 ? v.weightGrams : null,
    proteins: enumArray(v.proteins, ALL_PROTEINS),
    tags: enumArray(v.tags, ALL_INTERESTS),
    ingredients: stringArray(v.ingredients, 40),
    contains: enumArray(v.contains, ALL_ALLERGENS),
    vegetarian: v.vegetarian === true,
    vegan: v.vegan === true,
    nutrition,
    available: v.available !== false,
    featured: v.featured === true,
    demo: v.demo !== false,
    art: {
      main: isString(art.main) && HEX.test(art.main) ? art.main : '#A51E25',
      side: isString(art.side) && HEX.test(art.side) ? art.side : '#FFF3DF',
      garnish: isString(art.garnish) && HEX.test(art.garnish) ? art.garnish : '#4E8B3A',
    },
  }
}

export function parseProducts(v: unknown): Product[] | null {
  if (!Array.isArray(v)) return null
  return v.map(parseProduct).filter((p): p is Product => p !== null)
}

export function parseBusinessInfo(v: unknown): Partial<BusinessInfo> | null {
  if (!isRecord(v)) return null
  const out: Partial<BusinessInfo> = {}
  const keys: Array<keyof BusinessInfo> = [
    'storeName',
    'tagline',
    'whatsappNumber',
    'deliveryInfo',
    'openingHours',
    'address',
    'instagramUrl',
  ]
  for (const k of keys) if (isString(v[k])) out[k] = (v[k] as string).slice(0, 300)
  return out
}

const STATUSES: OrderStatus[] = ['enviado', 'confirmado', 'entregue', 'cancelado']

export function parseOrders(v: unknown): OrderRecord[] | null {
  if (!Array.isArray(v)) return null
  const out: OrderRecord[] = []
  for (const raw of v) {
    if (!isRecord(raw) || !isString(raw.id) || !isString(raw.createdAt) || !isInt(raw.total)) continue
    if (!Array.isArray(raw.items)) continue
    out.push({
      id: raw.id,
      createdAt: raw.createdAt,
      customerName: isString(raw.customerName) ? raw.customerName : '',
      notes: isString(raw.notes) ? raw.notes : '',
      fulfillment: raw.fulfillment === 'retirada' ? 'retirada' : 'entrega',
      items: raw.items
        .filter(isRecord)
        .filter((i) => isString(i.productId) && isString(i.name) && isInt(i.quantity) && isInt(i.unitPrice))
        .map((i) => ({
          productId: i.productId as string,
          name: i.name as string,
          quantity: i.quantity as number,
          unitPrice: i.unitPrice as number,
        })),
      total: raw.total,
      status: STATUSES.includes(raw.status as OrderStatus) ? (raw.status as OrderStatus) : 'enviado',
    })
  }
  return out
}
