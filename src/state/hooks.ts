import { useContext } from 'react'
import { CatalogContext, ShopContext, ThemeContext, ToastContext } from './contexts.ts'

function required<T>(value: T | null, name: string): T {
  if (value === null) throw new Error(`${name} deve ser usado dentro de <AppProviders>.`)
  return value
}

export const useTheme = () => required(useContext(ThemeContext), 'useTheme')
export const useShop = () => required(useContext(ShopContext), 'useShop')
export const useCatalog = () => required(useContext(CatalogContext), 'useCatalog')
export const useToast = () => required(useContext(ToastContext), 'useToast')
