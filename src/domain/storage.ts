/**
 * Acesso seguro ao LocalStorage.
 *
 * - Todas as chaves usam o prefixo versionado `prainha:v1:`.
 * - JSON inválido, dados com formato inesperado e indisponibilidade do storage
 *   (modo privado, cota excedida, bloqueio do navegador) nunca quebram a aplicação:
 *   o valor padrão é usado e o problema é reportado pelo callback `onError`.
 * - Recebe a implementação de Storage por parâmetro para ser testável sem navegador.
 */

export const STORAGE_PREFIX = 'prainha:v1:'

export const STORAGE_KEYS = {
  theme: 'theme',
  preferences: 'preferences',
  favorites: 'favorites',
  history: 'history',
  cart: 'cart',
  products: 'admin-products',
  categories: 'admin-categories',
  business: 'admin-business',
  orders: 'orders',
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type StorageErrorKind = 'unavailable' | 'invalid-json' | 'invalid-shape' | 'write-failed'

export type StorageErrorHandler = (kind: StorageErrorKind, key: string, error?: unknown) => void

export function fullKey(key: StorageKey): string {
  return STORAGE_PREFIX + key
}

/** Retorna o localStorage do navegador, ou null se não estiver acessível. */
export function getBrowserStorage(): StorageLike | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    const probe = `${STORAGE_PREFIX}__probe__`
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return window.localStorage
  } catch {
    return null
  }
}

export function readStored<T>(
  storage: StorageLike | null,
  key: StorageKey,
  parse: (raw: unknown) => T | null,
  fallback: T,
  onError?: StorageErrorHandler,
): T {
  if (!storage) {
    onError?.('unavailable', key)
    return fallback
  }
  let text: string | null
  try {
    text = storage.getItem(fullKey(key))
  } catch (error) {
    onError?.('unavailable', key, error)
    return fallback
  }
  if (text === null) return fallback
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (error) {
    onError?.('invalid-json', key, error)
    safeRemove(storage, key)
    return fallback
  }
  const parsed = parse(raw)
  if (parsed === null) {
    onError?.('invalid-shape', key)
    safeRemove(storage, key)
    return fallback
  }
  return parsed
}

export function writeStored(
  storage: StorageLike | null,
  key: StorageKey,
  value: unknown,
  onError?: StorageErrorHandler,
): boolean {
  if (!storage) {
    onError?.('unavailable', key)
    return false
  }
  try {
    storage.setItem(fullKey(key), JSON.stringify(value))
    return true
  } catch (error) {
    onError?.('write-failed', key, error)
    return false
  }
}

export function safeRemove(storage: StorageLike | null, key: StorageKey): void {
  try {
    storage?.removeItem(fullKey(key))
  } catch {
    /* ignorado: nada a fazer se o storage recusar a remoção */
  }
}

/** Implementação em memória, usada nos testes e como reserva. */
export function createMemoryStorage(initial: Record<string, string> = {}): StorageLike {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  }
}
