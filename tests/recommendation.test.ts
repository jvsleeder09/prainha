import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEMO_PRODUCTS } from '../src/data/demoCatalog.ts'
import { EMPTY_PREFERENCES } from '../src/domain/options.ts'
import { avoidedIngredient, economicoThreshold, recommend, restrictionViolation } from '../src/domain/recommendation.ts'
import type { Preferences, Product } from '../src/domain/types.ts'

const prefs = (p: Partial<Preferences>): Preferences => ({ ...EMPTY_PREFERENCES, ...p })
const byId = (id: string) => DEMO_PRODUCTS.find((p) => p.id === id) as Product

test('sem lactose exclui todos os produtos cadastrados com lactose', () => {
  const r = recommend(DEMO_PRODUCTS, prefs({ restrictions: ['sem-lactose'] }), 50)
  for (const rec of r.recommendations) {
    assert.ok(!byId(rec.productId).contains.includes('lactose'), `${rec.productId} contém lactose`)
  }
  assert.ok(r.excluded.some((x) => x.productId === 'demo-escondidinho'))
})

test('vegano retorna somente produtos veganos', () => {
  const r = recommend(DEMO_PRODUCTS, prefs({ restrictions: ['vegano'] }), 50)
  assert.ok(r.recommendations.length > 0)
  for (const rec of r.recommendations) assert.equal(byId(rec.productId).vegan, true)
})

test('vegetariano aceita vegetarianos e veganos, exclui carnes', () => {
  const r = recommend(DEMO_PRODUCTS, prefs({ restrictions: ['vegetariano'] }), 50)
  for (const rec of r.recommendations) {
    const p = byId(rec.productId)
    assert.ok(p.vegetarian || p.vegan)
  }
  assert.equal(restrictionViolation(byId('demo-frango-legumes'), ['vegetariano']), 'Não é vegetariano')
})

test('produtos indisponíveis nunca são recomendados', () => {
  const r = recommend(DEMO_PRODUCTS, EMPTY_PREFERENCES, 50)
  assert.ok(!r.recommendations.some((x) => x.productId === 'demo-camarao'))
  assert.deepEqual(r.excluded.find((x) => x.productId === 'demo-camarao')?.reason, 'Indisponível no momento')
})

test('proteína preferida aumenta a pontuação e gera justificativa', () => {
  const r = recommend(DEMO_PRODUCTS, prefs({ proteins: ['peixe'] }))
  const top = r.recommendations[0]
  assert.equal(top.productId, 'demo-tilapia')
  assert.ok(top.reasons.some((x) => x.kind === 'positive' && x.text.includes('peixe')))
})

test('interesses combinados ordenam pela soma dos pesos', () => {
  const r = recommend(DEMO_PRODUCTS, prefs({ proteins: ['frango'], interests: ['leve', 'proteico'] }))
  // frango (3) + leve (2) + proteico (2) + destaque (1) = 8
  assert.equal(r.recommendations[0].productId, 'demo-frango-legumes')
  assert.equal(r.recommendations[0].score, 8)
})

test('ingredientes a evitar ignoram acentos e maiúsculas', () => {
  assert.equal(avoidedIngredient(byId('demo-strogonoff'), ['CHAMPIGNON']), 'CHAMPIGNON')
  assert.equal(avoidedIngredient(byId('demo-tilapia'), ['abobora']), 'abobora')
  assert.equal(avoidedIngredient(byId('demo-tilapia'), ['x']), null) // termos curtos são ignorados
})

test('preço máximo exclui produtos mais caros com motivo', () => {
  const r = recommend(DEMO_PRODUCTS, prefs({ maxPrice: 2500 }), 50)
  for (const rec of r.recommendations) assert.ok(byId(rec.productId).price <= 2500)
  assert.ok(r.excluded.some((x) => x.reason.startsWith('Acima do seu limite')))
})

test('"econômico" favorece o terço mais barato do catálogo', () => {
  const available = DEMO_PRODUCTS.filter((p) => p.available)
  const limit = economicoThreshold(available)
  const r = recommend(DEMO_PRODUCTS, prefs({ interests: ['economico'] }))
  assert.ok(byId(r.recommendations[0].productId).price <= limit)
})

test('sem nenhum compatível retorna lista vazia', () => {
  const r = recommend(DEMO_PRODUCTS, prefs({ restrictions: ['vegano'], maxPrice: 100 }))
  assert.equal(r.recommendations.length, 0)
})

test('respeita o limite de resultados', () => {
  assert.equal(recommend(DEMO_PRODUCTS, EMPTY_PREFERENCES, 3).recommendations.length, 3)
})
