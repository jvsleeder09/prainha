import { useRef } from 'react'
import { Link } from 'react-router'
import { ProductCard } from '../components/ProductCard.tsx'
import { EmptyState, PageHead } from '../components/ui.tsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts'
import { useReveal } from '../hooks/useReveal.ts'
import { useCatalog, useShop, useToast } from '../state/hooks.ts'

export function FavoritesPage() {
  useDocumentTitle('Favoritos')
  const { products, categories } = useCatalog()
  const { favorites, toggleFavorite, addItem } = useShop()
  const { notify } = useToast()
  const ref = useRef<HTMLDivElement>(null)
  const items = favorites.map((id) => products.find((p) => p.id === id)).filter((p) => p !== undefined)
  const missing = favorites.filter((id) => !products.some((p) => p.id === id))
  useReveal(ref, [items.length])
  const available = items.filter((p) => p.available)

  return (
    <div ref={ref}>
      <PageHead eyebrow="Favoritos" title="Suas marmitas favoritas" crumbs={[{ to: '/', label: 'Início' }, { label: 'Favoritos' }]}>
        <p>Toque no coração de qualquer marmita para guardá-la aqui. Seus favoritos ficam salvos neste navegador.</p>
      </PageHead>
      <div className="container">
        {items.length === 0 ? (
          <EmptyState
            title="Nenhum favorito ainda"
            action={
              <Link to="/cardapio" className="btn">
                Explorar o cardápio
              </Link>
            }
          >
            Quando encontrar uma marmita que combina com você, clique no coração para salvá-la.
          </EmptyState>
        ) : (
          <>
            <div className="section-head">
              <p aria-live="polite">
                {items.length} {items.length === 1 ? 'favorito' : 'favoritos'}
              </p>
              {available.length > 0 && (
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => {
                    available.forEach((p) => addItem(p.id))
                    notify(`${available.length} favorito(s) adicionados ao carrinho.`, 'success')
                  }}
                >
                  Adicionar todos ao carrinho
                </button>
              )}
            </div>
            <ul className="product-grid" role="list">
              {items.map((p) => (
                <li key={p.id}>
                  <ProductCard product={p} categoryName={categories.find((c) => c.id === p.categoryId)?.name} />
                </li>
              ))}
            </ul>
          </>
        )}
        {missing.length > 0 && (
          <p className="muted">
            {missing.length} favorito(s) não existem mais no cardápio.{' '}
            <button type="button" className="link-btn" onClick={() => missing.forEach((id) => toggleFavorite(id))}>
              Remover da lista
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
