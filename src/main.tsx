import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from 'react-router'
import { App } from './App.tsx'
import { CartPage } from './pages/CartPage.tsx'
import { CatalogPage } from './pages/CatalogPage.tsx'
import { FavoritesPage } from './pages/FavoritesPage.tsx'
import { HistoryPage } from './pages/HistoryPage.tsx'
import { HomePage } from './pages/HomePage.tsx'
import { AdminPage, AssistantPage } from './pages/lazyPages.tsx'
import { NotFoundPage } from './pages/NotFoundPage.tsx'
import { PreferencesPage } from './pages/PreferencesPage.tsx'
import { ProductPage } from './pages/ProductPage.tsx'
import { AppProviders } from './state/AppProviders.tsx'
import './index.css'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'cardapio', element: <CatalogPage /> },
      { path: 'cardapio/:slug', element: <ProductPage /> },
      { path: 'preferencias', element: <PreferencesPage /> },
      { path: 'assistente', element: <AssistantPage /> },
      { path: 'favoritos', element: <FavoritesPage /> },
      { path: 'historico', element: <HistoryPage /> },
      { path: 'carrinho', element: <CartPage /> },
      { path: 'admin', element: <AdminPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
)
