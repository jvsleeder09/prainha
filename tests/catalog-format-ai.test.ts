import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AI_LIMITS, validateRecommendRequest } from '../supabase/functions/_shared/ai-contract.ts'
import { DEMO_PRODUCTS } from '../src/data/demoCatalog.ts'
import { DEFAULT_FILTERS, activeFilterCount, filterProducts } from '../src/domain/catalog.ts'
import { formatPrice, normalizeText, parsePriceInput, slugify } from '../src/domain/format.ts'

const f = (patch: Partial<typeof DEFAULT_FILTERS>) => ({ ...DEFAULT_FILTERS, ...patch })

test('busca por ingrediente sem acento encontra o produto', () => {
  const r = filterProducts(DEMO_PRODUCTS, f({ query: 'abobora' }))
  assert.deepEqual(
    r.map((p) => p.id),
    ['demo-tilapia'],
  )
})

test('busca com vários termos exige todos', () => {
  assert.equal(filterProducts(DEMO_PRODUCTS, f({ query: 'frango curry' })).length, 1)
  assert.equal(filterProducts(DEMO_PRODUCTS, f({ query: 'frango tilapia' })).length, 0)
})

test('filtro por categoria, restrição e disponibilidade', () => {
  const r = filterProducts(DEMO_PRODUCTS, f({ categoryId: 'vegetarianas', restrictions: ['sem-lactose'] }))
  assert.deepEqual(
    r.map((p) => p.id),
    ['demo-bowl-vegano'],
  )
  assert.ok(!filterProducts(DEMO_PRODUCTS, f({ onlyAvailable: true })).some((p) => !p.available))
})

test('ordenação por preço', () => {
  const asc = filterProducts(DEMO_PRODUCTS, f({ sort: 'menor-preco' }))
  for (let i = 1; i < asc.length; i++) assert.ok(asc[i - 1].price <= asc[i].price)
  const desc = filterProducts(DEMO_PRODUCTS, f({ sort: 'maior-preco' }))
  assert.equal(desc[0].price, Math.max(...DEMO_PRODUCTS.map((p) => p.price)))
})

test('relevância coloca indisponíveis por último', () => {
  const r = filterProducts(DEMO_PRODUCTS, DEFAULT_FILTERS)
  assert.equal(r[r.length - 1].available, false)
})

test('contagem de filtros ativos', () => {
  assert.equal(activeFilterCount(DEFAULT_FILTERS), 0)
  assert.equal(activeFilterCount(f({ query: 'x', proteins: ['frango', 'peixe'], onlyAvailable: true })), 4)
})

test('formatação e leitura de preços', () => {
  assert.match(formatPrice(2490), /^R\$\s24,90$/)
  assert.equal(parsePriceInput('24,90'), 2490)
  assert.equal(parsePriceInput('R$ 1.234,50'), 123450)
  assert.equal(parsePriceInput('30'), 3000)
  assert.equal(parsePriceInput('abc'), null)
  assert.equal(parsePriceInput('-3'), null)
})

test('normalização e slug', () => {
  assert.equal(normalizeText('  Abóbora   Cabotiá '), 'abobora cabotia')
  assert.equal(slugify('Tilápia com purê!'), 'tilapia-com-pure')
})

test('contrato de IA: rejeita pedidos inválidos', () => {
  assert.equal(typeof validateRecommendRequest(null), 'string')
  assert.equal(typeof validateRecommendRequest({ message: 'oi', catalog: [{ id: 'a', name: 'A' }] }), 'string')
  assert.equal(typeof validateRecommendRequest({ message: 'quero algo', catalog: [] }), 'string')
  const big = Array.from({ length: AI_LIMITS.maxCatalogItems + 1 }, (_, i) => ({ id: `p${i}`, name: 'x' }))
  assert.equal(typeof validateRecommendRequest({ message: 'quero algo', catalog: big }), 'string')
})

test('contrato de IA: saneia e limita campos', () => {
  const r = validateRecommendRequest({
    message: 'x'.repeat(5000),
    preferences: { proteins: ['frango', 1], restrictions: ['sem-lactose'], avoidIngredients: ['cebola'], extra: 'x' },
    catalog: [{ id: 'a', name: 'A', priceCents: 2490, proteins: ['frango'], hacker: true }, { semId: true }],
  })
  assert.notEqual(typeof r, 'string')
  if (typeof r === 'string') return
  assert.equal(r.message.length, AI_LIMITS.maxMessageLength)
  assert.deepEqual(r.preferences, { proteins: ['frango'], interests: [] })
  // Restrições e ingredientes a evitar nunca seguem para o provedor de IA.
  assert.ok(!('restrictions' in r.preferences) && !('avoidIngredients' in r.preferences))
  assert.equal(r.catalog.length, 1)
  assert.ok(!('hacker' in r.catalog[0]))
})
