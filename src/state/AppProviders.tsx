import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DEFAULT_BUSINESS_INFO } from '../config/business.ts'
import { DEMO_CATEGORIES, DEMO_PRODUCTS } from '../data/demoCatalog.ts'
import { addToCart, removeFromCart, setQuantity } from '../domain/cart.ts'
import { createId } from '../domain/format.ts'
import { EMPTY_PREFERENCES } from '../domain/options.ts'
import { STORAGE_KEYS, type StorageErrorHandler } from '../domain/storage.ts'
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
} from '../domain/types.ts'
import {
  parseBusinessInfo,
  parseCart,
  parseCategories,
  parseHistory,
  parseIdList,
  parseOrders,
  parsePreferences,
  parseProducts,
  parseTheme,
} from '../domain/validation.ts'
import * as supa from '../services/supabase.ts'
import {
  CatalogContext,
  ShopContext,
  ThemeContext,
  ToastContext,
  type CatalogContextValue,
  type CatalogSource,
  type ShopContextValue,
  type ToastTone,
} from './contexts.ts'
import { usePersistentState } from './usePersistentState.ts'
import { useToast } from './hooks.ts'

const MAX_HISTORY = 30

const systemTheme: Theme =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

const NO_ITEMS: never[] = []
const NO_BUSINESS: Partial<BusinessInfo> = {}

/* ----------------------------- Toasts ----------------------------- */

interface Toast {
  id: string
  message: string
  tone: ToastTone
}

function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const notify = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = createId('t')
    setToasts((t) => [...t.slice(-2), { id, message, tone }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])
  const value = useMemo(() => ({ notify }), [notify])
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" role="status" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <p key={t.id} className={`toast toast--${t.tone}`}>
            {t.message}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/** Avisa o usuário quando um dado salvo estava corrompido e foi redefinido. */
function useStorageErrorNotice(): StorageErrorHandler {
  const { notify } = useToast()
  return useCallback(
    (kind) => {
      if (kind === 'write-failed') notify('Não foi possível salvar no navegador (armazenamento cheio ou bloqueado).', 'warning')
      else if (kind === 'invalid-json' || kind === 'invalid-shape')
        notify('Alguns dados salvos estavam inválidos e foram redefinidos.', 'warning')
    },
    [notify],
  )
}

/* ----------------------------- Tema ----------------------------- */

function ThemeProvider({ children }: { children: ReactNode }) {
  const onError = useStorageErrorNotice()
  const [theme, setTheme] = usePersistentState<Theme>(STORAGE_KEYS.theme, parseTheme, systemTheme, onError)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.style.colorScheme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#1c1516' : '#FFF3DF')
  }, [theme])

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }),
    [theme, setTheme],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

/* ----------------------------- Loja (usuário) ----------------------------- */

function ShopProvider({ children }: { children: ReactNode }) {
  const onError = useStorageErrorNotice()
  const [preferences, setPreferences] = usePersistentState<Preferences>(
    STORAGE_KEYS.preferences,
    parsePreferences,
    EMPTY_PREFERENCES,
    onError,
  )
  const [favorites, setFavorites] = usePersistentState<string[]>(STORAGE_KEYS.favorites, parseIdList, NO_ITEMS, onError)
  const [history, setHistory] = usePersistentState<HistoryEntry[]>(STORAGE_KEYS.history, parseHistory, NO_ITEMS, onError)
  const [cart, setCart] = usePersistentState<CartItem[]>(STORAGE_KEYS.cart, parseCart, NO_ITEMS, onError)

  const value = useMemo<ShopContextValue>(
    () => ({
      preferences,
      setPreferences,
      favorites,
      isFavorite: (id) => favorites.includes(id),
      toggleFavorite: (id) => setFavorites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id])),
      history,
      addHistory: (entry) => {
        const full: HistoryEntry = { ...entry, id: createId('h'), createdAt: new Date().toISOString() }
        setHistory((h) => [full, ...h].slice(0, MAX_HISTORY))
        return full
      },
      removeHistory: (id) => setHistory((h) => h.filter((e) => e.id !== id)),
      clearHistory: () => setHistory([]),
      cart,
      addItem: (productId, quantity = 1) => setCart((c) => addToCart(c, productId, quantity)),
      setItemQuantity: (productId, quantity) => setCart((c) => setQuantity(c, productId, quantity)),
      removeItem: (productId) => setCart((c) => removeFromCart(c, productId)),
      clearCart: () => setCart([]),
    }),
    [preferences, setPreferences, favorites, setFavorites, history, setHistory, cart, setCart],
  )
  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>
}

/* ----------------------------- Catálogo / admin ----------------------------- */

function CatalogProvider({ children }: { children: ReactNode }) {
  const onError = useStorageErrorNotice()
  const [localProducts, setLocalProducts] = usePersistentState<Product[]>(
    STORAGE_KEYS.products,
    parseProducts,
    DEMO_PRODUCTS,
    onError,
  )
  const [localCategories, setLocalCategories] = usePersistentState<Category[]>(
    STORAGE_KEYS.categories,
    parseCategories,
    DEMO_CATEGORIES,
    onError,
  )
  const [localBusiness, setLocalBusiness] = usePersistentState<Partial<BusinessInfo>>(
    STORAGE_KEYS.business,
    parseBusinessInfo,
    NO_BUSINESS,
    onError,
  )
  const [localOrders, setLocalOrders] = usePersistentState<OrderRecord[]>(STORAGE_KEYS.orders, parseOrders, NO_ITEMS, onError)

  const [source, setSource] = useState<CatalogSource>(supa.isSupabaseConfigured ? 'supabase-loading' : 'local')
  const [sourceError, setSourceError] = useState<string | null>(null)
  const [remote, setRemote] = useState<{ products: Product[]; categories: Category[]; business: Partial<BusinessInfo> } | null>(
    null,
  )
  const [remoteOrders, setRemoteOrders] = useState<OrderRecord[]>([])
  const [session, setSession] = useState<supa.SupabaseSession | null>(() =>
    supa.isSupabaseConfigured ? supa.loadSession() : null,
  )
  const mounted = useRef(true)
  useEffect(() => () => void (mounted.current = false), [])

  const loadRemote = useCallback(async () => {
    if (!supa.isSupabaseConfigured) return
    try {
      const [catalog, business] = await Promise.all([supa.fetchCatalog(), supa.fetchBusinessInfo()])
      if (!mounted.current) return
      setRemote({ ...catalog, business })
      setSource('supabase')
      setSourceError(null)
    } catch (e) {
      if (!mounted.current) return
      setSource('supabase-error')
      setSourceError(e instanceof Error ? e.message : 'Falha ao carregar do Supabase')
    }
  }, [])

  useEffect(() => {
    if (!supa.isSupabaseConfigured) return
    let cancelled = false
    Promise.all([supa.fetchCatalog(), supa.fetchBusinessInfo()])
      .then(([catalog, business]) => {
        if (cancelled) return
        setRemote({ ...catalog, business })
        setSource('supabase')
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setSource('supabase-error')
        setSourceError(e instanceof Error ? e.message : 'Falha ao carregar do Supabase')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const useRemote = source === 'supabase' && remote !== null
  const products = useRemote ? remote.products : localProducts
  const categories = useRemote ? remote.categories : localCategories
  const businessPartial = useRemote ? remote.business : localBusiness

  const business = useMemo<BusinessInfo>(() => {
    const merged = { ...DEFAULT_BUSINESS_INFO, ...businessPartial }
    if (!merged.whatsappNumber) merged.whatsappNumber = DEFAULT_BUSINESS_INFO.whatsappNumber
    return merged
  }, [businessPartial])

  const requireSession = useCallback(() => {
    if (!session) throw new Error('Faça login como administrador para alterar dados no Supabase.')
    return session
  }, [session])

  const value = useMemo<CatalogContextValue>(() => {
    const remoteMode = supa.isSupabaseConfigured
    return {
      source,
      sourceError,
      products,
      categories: [...categories].sort((a, b) => a.order - b.order),
      business,
      orders: remoteMode ? remoteOrders : localOrders,
      usingDemoData: products.some((p) => p.demo),
      session,
      signIn: async (email, password) => {
        const s = await supa.signIn(email, password)
        setSession(s)
      },
      signOut: async () => {
        await supa.signOut(session)
        setSession(null)
      },
      saveProduct: async (p) => {
        if (remoteMode) {
          await supa.upsertProduct(requireSession(), p)
          await loadRemote()
        } else {
          setLocalProducts((list) => (list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? p : x)) : [...list, p]))
        }
      },
      deleteProduct: async (id) => {
        if (remoteMode) {
          await supa.deleteProduct(requireSession(), id)
          await loadRemote()
        } else {
          setLocalProducts((list) => list.filter((x) => x.id !== id))
        }
      },
      saveCategory: async (c) => {
        if (remoteMode) {
          await supa.upsertCategory(requireSession(), c)
          await loadRemote()
        } else {
          setLocalCategories((list) => (list.some((x) => x.id === c.id) ? list.map((x) => (x.id === c.id ? c : x)) : [...list, c]))
        }
      },
      deleteCategory: async (id) => {
        if (products.some((p) => p.categoryId === id)) {
          throw new Error('Existem produtos nesta categoria. Mova-os antes de excluir.')
        }
        if (remoteMode) {
          await supa.deleteCategory(requireSession(), id)
          await loadRemote()
        } else {
          setLocalCategories((list) => list.filter((x) => x.id !== id))
        }
      },
      saveBusiness: async (b) => {
        if (remoteMode) {
          await supa.saveBusinessInfo(requireSession(), b)
          await loadRemote()
        } else {
          setLocalBusiness(b)
        }
      },
      registerOrder: async (o) => {
        setLocalOrders((list) => [o, ...list].slice(0, 100))
        if (remoteMode) await supa.insertOrder(o)
      },
      setOrderStatus: async (id: string, status: OrderStatus) => {
        if (remoteMode) {
          await supa.updateOrderStatus(requireSession(), id, status)
          setRemoteOrders(await supa.fetchOrders(requireSession()))
        } else {
          setLocalOrders((list) => list.map((o) => (o.id === id ? { ...o, status } : o)))
        }
      },
      refreshOrders: async () => {
        if (remoteMode) setRemoteOrders(await supa.fetchOrders(requireSession()))
      },
      resetLocalCatalog: () => {
        setLocalProducts(DEMO_PRODUCTS)
        setLocalCategories(DEMO_CATEGORIES)
      },
      importLocalCatalog: (p, c) => {
        setLocalProducts(p)
        setLocalCategories(c)
      },
    }
  }, [
    source,
    sourceError,
    products,
    categories,
    business,
    remoteOrders,
    localOrders,
    session,
    requireSession,
    loadRemote,
    setLocalProducts,
    setLocalCategories,
    setLocalBusiness,
    setLocalOrders,
  ])

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ThemeProvider>
        <CatalogProvider>
          <ShopProvider>{children}</ShopProvider>
        </CatalogProvider>
      </ThemeProvider>
    </ToastProvider>
  )
}
