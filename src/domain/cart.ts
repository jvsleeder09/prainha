import type { CartItem, Cents, Product } from './types.ts'

export const MIN_QUANTITY = 1
export const MAX_QUANTITY = 99

export function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return MIN_QUANTITY
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, Math.trunc(quantity)))
}

export function addToCart(cart: CartItem[], productId: string, quantity = 1): CartItem[] {
  const existing = cart.find((i) => i.productId === productId)
  if (existing) {
    return cart.map((i) =>
      i.productId === productId ? { ...i, quantity: clampQuantity(i.quantity + quantity) } : i,
    )
  }
  return [...cart, { productId, quantity: clampQuantity(quantity) }]
}

export function setQuantity(cart: CartItem[], productId: string, quantity: number): CartItem[] {
  if (quantity <= 0) return removeFromCart(cart, productId)
  return cart.map((i) => (i.productId === productId ? { ...i, quantity: clampQuantity(quantity) } : i))
}

export function removeFromCart(cart: CartItem[], productId: string): CartItem[] {
  return cart.filter((i) => i.productId !== productId)
}

export interface CartLine {
  product: Product
  quantity: number
  lineTotal: Cents
}

export interface CartSummary {
  lines: CartLine[]
  /** Itens do carrinho cujo produto não existe mais ou está indisponível. */
  unavailable: CartItem[]
  itemCount: number
  subtotal: Cents
  total: Cents
}

/**
 * Calcula o resumo do carrinho a partir do catálogo atual.
 * Os preços vêm sempre do catálogo (nunca do LocalStorage), para refletir alterações do admin.
 * A taxa de entrega não é calculada: ela é combinada pelo WhatsApp.
 */
export function summarizeCart(cart: CartItem[], products: Product[]): CartSummary {
  const lines: CartLine[] = []
  const unavailable: CartItem[] = []
  for (const item of cart) {
    const product = products.find((p) => p.id === item.productId)
    if (!product || !product.available) {
      unavailable.push(item)
      continue
    }
    lines.push({ product, quantity: item.quantity, lineTotal: product.price * item.quantity })
  }
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0)
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0)
  return { lines, unavailable, itemCount, subtotal, total: subtotal }
}
