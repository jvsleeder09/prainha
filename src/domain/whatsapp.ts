import type { CartSummary } from './cart.ts'
import { formatPrice } from './format.ts'

export interface CheckoutDetails {
  customerName: string
  fulfillment: 'entrega' | 'retirada'
  address: string
  notes: string
}

/** Mantém apenas dígitos. */
export function sanitizePhone(raw: string): string {
  return raw.replace(/\D/g, '')
}

/**
 * Valida um número de WhatsApp no formato internacional sem símbolos.
 * Para o Brasil: 55 + DDD (2 dígitos) + número (8 ou 9 dígitos) = 12 ou 13 dígitos.
 * Outros países: entre 10 e 15 dígitos (limite do padrão E.164).
 */
export function isValidWhatsappNumber(raw: string): boolean {
  const digits = sanitizePhone(raw)
  if (digits.startsWith('55')) return digits.length === 12 || digits.length === 13
  return digits.length >= 10 && digits.length <= 15
}

export function buildOrderMessage(summary: CartSummary, details: CheckoutDetails, storeName: string): string {
  const lines: string[] = []
  lines.push(`Olá, ${storeName}! Gostaria de fazer um pedido:`)
  lines.push('')
  for (const line of summary.lines) {
    lines.push(
      `• ${line.quantity}x ${line.product.name} — ${formatPrice(line.product.price)} cada = ${formatPrice(line.lineTotal)}`,
    )
  }
  lines.push('')
  lines.push(`Itens: ${summary.itemCount}`)
  lines.push(`Subtotal: ${formatPrice(summary.subtotal)}`)
  lines.push(`Total dos produtos: ${formatPrice(summary.total)}`)
  lines.push('(Taxa de entrega a combinar)')
  lines.push('')
  const name = details.customerName.trim()
  if (name) lines.push(`Nome: ${name}`)
  lines.push(`Forma de recebimento: ${details.fulfillment === 'entrega' ? 'Entrega' : 'Retirada'}`)
  const address = details.address.trim()
  if (details.fulfillment === 'entrega' && address) lines.push(`Endereço: ${address}`)
  const notes = details.notes.trim()
  if (notes) lines.push(`Observações: ${notes}`)
  if (summary.lines.some((l) => l.product.demo)) {
    lines.push('')
    lines.push('Obs.: pedido gerado a partir do catálogo demonstrativo do site.')
  }
  return lines.join('\n')
}

export function buildWhatsappUrl(phone: string, message: string): string {
  return `https://wa.me/${sanitizePhone(phone)}?text=${encodeURIComponent(message)}`
}
