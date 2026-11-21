import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEMO_PRODUCTS } from '../src/data/demoCatalog.ts'
import { addToCart, clampQuantity, removeFromCart, setQuantity, summarizeCart } from '../src/domain/cart.ts'
import { buildOrderMessage, buildWhatsappUrl, isValidWhatsappNumber, sanitizePhone } from '../src/domain/whatsapp.ts'
import type { CartItem } from '../src/domain/types.ts'

test('adicionar o mesmo produto soma a quantidade', () => {
  let cart: CartItem[] = []
  cart = addToCart(cart, 'demo-frango-legumes')
  cart = addToCart(cart, 'demo-frango-legumes', 2)
  assert.deepEqual(cart, [{ productId: 'demo-frango-legumes', quantity: 3 }])
})

test('quantidade fica entre 1 e 99', () => {
  assert.equal(clampQuantity(0), 1)
  assert.equal(clampQuantity(150), 99)
  assert.equal(clampQuantity(2.7), 2)
  assert.equal(clampQuantity(Number.NaN), 1)
  assert.equal(addToCart([{ productId: 'a', quantity: 98 }], 'a', 5)[0].quantity, 99)
})

test('alterar para zero remove o item; remover funciona', () => {
  const cart: CartItem[] = [
    { productId: 'a', quantity: 2 },
    { productId: 'b', quantity: 1 },
  ]
  assert.deepEqual(setQuantity(cart, 'a', 0), [{ productId: 'b', quantity: 1 }])
  assert.deepEqual(setQuantity(cart, 'a', 5)[0], { productId: 'a', quantity: 5 })
  assert.deepEqual(removeFromCart(cart, 'b'), [{ productId: 'a', quantity: 2 }])
})

test('subtotal e total usam os preços do catálogo e ignoram indisponíveis', () => {
  const cart: CartItem[] = [
    { productId: 'demo-frango-legumes', quantity: 2 }, // 2490
    { productId: 'demo-tilapia', quantity: 1 }, // 3190
    { productId: 'demo-camarao', quantity: 1 }, // indisponível
    { productId: 'nao-existe', quantity: 1 },
  ]
  const s = summarizeCart(cart, DEMO_PRODUCTS)
  assert.equal(s.subtotal, 2 * 2490 + 3190)
  assert.equal(s.total, s.subtotal)
  assert.equal(s.itemCount, 3)
  assert.equal(s.unavailable.length, 2)
})

test('mensagem do WhatsApp lista itens, quantidades e valores', () => {
  const s = summarizeCart([{ productId: 'demo-frango-legumes', quantity: 2 }], DEMO_PRODUCTS)
  const msg = buildOrderMessage(s, { customerName: 'Ana', fulfillment: 'entrega', address: 'Rua 1', notes: 'Sem pressa' }, 'Prainha')
  assert.match(msg, /Olá, Prainha!/)
  assert.match(msg, /2x Frango grelhado com legumes/)
  assert.match(msg, /R\$\s24,90 cada = R\$\s49,80/)
  assert.match(msg, /Total dos produtos: R\$\s49,80/)
  assert.match(msg, /Nome: Ana/)
  assert.match(msg, /Endereço: Rua 1/)
  assert.match(msg, /Observações: Sem pressa/)
  assert.match(msg, /catálogo demonstrativo/)
})

test('retirada não inclui endereço', () => {
  const s = summarizeCart([{ productId: 'demo-tilapia', quantity: 1 }], DEMO_PRODUCTS)
  const msg = buildOrderMessage(s, { customerName: 'B', fulfillment: 'retirada', address: 'Rua X', notes: '' }, 'Prainha')
  assert.doesNotMatch(msg, /Endereço/)
  assert.match(msg, /Retirada/)
})

test('validação e montagem do link do WhatsApp', () => {
  assert.equal(sanitizePhone('+55 (61) 9 1234-5678'), '5561912345678')
  assert.equal(isValidWhatsappNumber('5561912345678'), true)
  assert.equal(isValidWhatsappNumber('556112345678'), true)
  assert.equal(isValidWhatsappNumber('55611234'), false)
  assert.equal(isValidWhatsappNumber(''), false)
  const url = buildWhatsappUrl('+55 61 91234-5678', 'Olá & tchau')
  assert.equal(url, 'https://wa.me/5561912345678?text=Ol%C3%A1%20%26%20tchau')
})
