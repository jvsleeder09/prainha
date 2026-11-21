import { createContext } from 'react'
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
import type { SupabaseSession } from '../services/supabase.ts'

export interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  setTheme: (t: Theme) => void
}

export interface ShopContextValue {
  preferences: Preferences
  setPreferences: (p: Preferences) => void
  favorites: string[]
  isFavorite: (id: string) => boolean
  toggleFavorite: (id: string) => void
  history: HistoryEntry[]
  addHistory: (entry: Omit<HistoryEntry, 'id' | 'createdAt'>) => HistoryEntry
  removeHistory: (id: string) => void
  clearHistory: () => void
  cart: CartItem[]
  addItem: (productId: string, quantity?: number) => void
  setItemQuantity: (productId: string, quantity: number) => void
  removeItem: (productId: string) => void
  clearCart: () => void
}

export type CatalogSource = 'local' | 'supabase' | 'supabase-loading' | 'supabase-error'

export interface CatalogContextValue {
  source: CatalogSource
  sourceError: string | null
  products: Product[]
  categories: Category[]
  business: BusinessInfo
  orders: OrderRecord[]
  usingDemoData: boolean
  session: SupabaseSession | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  saveProduct: (p: Product) => Promise<void>
  deleteProduct: (id: string) => Promise<void>
  saveCategory: (c: Category) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
  saveBusiness: (b: BusinessInfo) => Promise<void>
  registerOrder: (o: OrderRecord) => Promise<void>
  setOrderStatus: (id: string, status: OrderStatus) => Promise<void>
  refreshOrders: () => Promise<void>
  resetLocalCatalog: () => void
  importLocalCatalog: (products: Product[], categories: Category[]) => void
}

export type ToastTone = 'info' | 'success' | 'warning' | 'error'

export interface ToastContextValue {
  notify: (message: string, tone?: ToastTone) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
export const ShopContext = createContext<ShopContextValue | null>(null)
export const CatalogContext = createContext<CatalogContextValue | null>(null)
export const ToastContext = createContext<ToastContextValue | null>(null)
