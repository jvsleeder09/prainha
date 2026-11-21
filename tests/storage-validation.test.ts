import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEMO_PRODUCTS } from '../src/data/demoCatalog.ts'
import { createMemoryStorage, fullKey, readStored, writeStored, type StorageLike } from '../src/domain/storage.ts'
import {
  parseCart,
  parseHistory,
  parseIdList,
  parsePreferences,
  parseProduct,
  parseTheme,
} from '../src/domain/validation.ts'

test('grava e lê valores com prefixo versionado', () => {
  const s = createMemoryStorage()
  assert.equal(writeStored(s, 'theme', 'dark'), true)
  assert.equal(s.getItem('prainha:v1:theme'), '"dark"')
  assert.equal(readStored(s, 'theme', parseTheme, 'light'), 'dark')
})

test('JSON inválido volta ao padrão, é removido e reporta o erro', () => {
  const s = createMemoryStorage({ [fullKey('favorites')]: '{quebrado' })
  const errors: string[] = []
  const v = readStored(s, 'favorites', parseIdList, [], (kind) => errors.push(kind))
  assert.deepEqual(v, [])
  assert.deepEqual(errors, ['invalid-json'])
  assert.equal(s.getItem(fullKey('favorites')), null)
})

test('formato inesperado volta ao padrão', () => {
  const s = createMemoryStorage({ [fullKey('theme')]: '"roxo"' })
  const errors: string[] = []
  assert.equal(readStored(s, 'theme', parseTheme, 'light', (k) => errors.push(k)), 'light')
  assert.deepEqual(errors, ['invalid-shape'])
})

test('storage indisponível não quebra leitura nem escrita', () => {
  const errors: string[] = []
  assert.equal(readStored(null, 'cart', parseCart, [], (k) => errors.push(k)).length, 0)
  assert.equal(writeStored(null, 'cart', [], (k) => errors.push(k)), false)
  assert.deepEqual(errors, ['unavailable', 'unavailable'])
})

test('falha de escrita (cota excedida) é reportada', () => {
  const full: StorageLike = {
    getItem: () => null,
    setItem: () => {
      throw new Error('QuotaExceededError')
    },
    removeItem: () => {},
  }
  const errors: string[] = []
  assert.equal(writeStored(full, 'history', [], (k) => errors.push(k)), false)
  assert.deepEqual(errors, ['write-failed'])
})

test('carrinho: descarta itens inválidos, duplicados e normaliza quantidade', () => {
  const cart = parseCart([
    { productId: 'a', quantity: 2 },
    { productId: 'a', quantity: 5 },
    { productId: 'b', quantity: 500 },
    { productId: 'c', quantity: -1 },
    { productId: 3, quantity: 1 },
    'lixo',
  ])
  assert.deepEqual(cart, [
    { productId: 'a', quantity: 2 },
    { productId: 'b', quantity: 99 },
  ])
  assert.equal(parseCart({ not: 'array' }), null)
})

test('preferências: mantém apenas valores conhecidos', () => {
  const p = parsePreferences({
    restrictions: ['sem-lactose', 'inventada', 'sem-lactose'],
    proteins: ['frango', 42],
    interests: ['leve'],
    avoidIngredients: ['cebola', 7],
    maxPrice: -5,
  })
  assert.deepEqual(p, {
    restrictions: ['sem-lactose'],
    proteins: ['frango'],
    interests: ['leve'],
    avoidIngredients: ['cebola'],
    maxPrice: null,
  })
  assert.equal(parsePreferences(null), null)
})

test('histórico: descarta entradas malformadas', () => {
  const h = parseHistory([
    {
      id: '1',
      createdAt: '2026-11-20T10:00:00.000Z',
      source: 'preferencias',
      query: null,
      preferences: {},
      summary: 'ok',
      items: [{ productId: 'x', productName: 'X', reasons: ['r'] }, { bad: true }],
    },
    { id: '2', createdAt: 'x', source: 'hacker', preferences: {}, items: [] },
  ])
  assert.equal(h?.length, 1)
  assert.equal(h?.[0].items.length, 1)
})

test('produto: todos os produtos demonstrativos passam na validação sem alteração', () => {
  for (const p of DEMO_PRODUCTS) assert.deepEqual(parseProduct(JSON.parse(JSON.stringify(p))), p)
  assert.equal(parseProduct({ id: 'x' }), null)
})
