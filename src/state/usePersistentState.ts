import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fullKey,
  getBrowserStorage,
  readStored,
  writeStored,
  type StorageErrorHandler,
  type StorageKey,
} from '../domain/storage.ts'

const storage = getBrowserStorage()

/** true quando o LocalStorage não está disponível (modo privado restrito, bloqueio etc.). */
export const storageUnavailable = storage === null

/**
 * Estado React sincronizado com o LocalStorage.
 * - Lê e valida uma única vez na montagem (dados inválidos voltam ao padrão).
 * - Grava a cada alteração.
 * - Sincroniza entre abas pelo evento `storage`.
 */
export function usePersistentState<T>(
  key: StorageKey,
  parse: (raw: unknown) => T | null,
  fallback: T,
  onError?: StorageErrorHandler,
): [T, (update: T | ((prev: T) => T)) => void] {
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  const [value, setValue] = useState<T>(() =>
    readStored(storage, key, parse, fallback, (kind, k, e) => {
      // "unavailable" já é exibido globalmente; aqui só reportamos dados corrompidos.
      if (kind !== 'unavailable') queueMicrotask(() => onErrorRef.current?.(kind, k, e))
    }),
  )

  const skipWrite = useRef(true)
  useEffect(() => {
    if (skipWrite.current) {
      skipWrite.current = false
      return
    }
    if (storage) writeStored(storage, key, value, onErrorRef.current)
  }, [key, value])

  useEffect(() => {
    if (!storage) return
    const onStorage = (e: StorageEvent) => {
      if (e.key !== fullKey(key)) return
      skipWrite.current = true
      setValue(readStored(storage, key, parse, fallback))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
    // parse/fallback são estáveis por contrato (definidos fora dos componentes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const update = useCallback((u: T | ((prev: T) => T)) => setValue(u), [])
  return [value, update]
}
