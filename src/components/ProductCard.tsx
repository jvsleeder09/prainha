import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { formatPrice } from '../domain/format.ts'
import { INTEREST_LABELS } from '../domain/options.ts'
import type { Product } from '../domain/types.ts'
import { useShop, useToast } from '../state/hooks.ts'
import { ProductArt } from './ProductArt.tsx'
import { DemoBadge, FavoriteButton } from './ui.tsx'

interface Props {
  product: Product
  categoryName?: string
  /** Conteúdo extra (ex.: justificativas da recomendação). */
  children?: ReactNode
  headingLevel?: 'h2' | 'h3'
}

export function ProductCard({ product, categoryName, children, headingLevel = 'h3' }: Props) {
  const { addItem } = useShop()
  const { notify } = useToast()
  const Heading = headingLevel

  return (
    <article className="product-card" aria-labelledby={`p-${product.id}`} data-reveal>
      <div className="product-card__flags">
        {product.demo && <DemoBadge />}
        {product.featured && <span className="badge badge--accent">Destaque</span>}
        {!product.available && <span className="badge badge--off">Indisponível</span>}
      </div>
      <div className="product-card__fav">
        <FavoriteButton productId={product.id} productName={product.name} />
      </div>
      <figure className="product-card__media">
        <ProductArt product={product} />
        <figcaption>Ilustração</figcaption>
      </figure>
      <div className="product-card__body">
        {categoryName && <span className="eyebrow">{categoryName}</span>}
        <Heading className="product-card__title" id={`p-${product.id}`}>
          <Link to={`/cardapio/${product.slug}`}>{product.name}</Link>
        </Heading>
        <p className="product-card__desc">{product.description}</p>
        {product.tags.length > 0 && (
          <ul className="tag-list" aria-label="Características">
            {product.tags.map((t) => (
              <li key={t}>{INTEREST_LABELS[t]}</li>
            ))}
            {product.vegan && <li>Vegano</li>}
            {!product.vegan && product.vegetarian && <li>Vegetariano</li>}
          </ul>
        )}
        {children}
        <div className="product-card__footer">
          <span className="price">
            <span className="visually-hidden">Preço{product.demo ? ' demonstrativo' : ''}: </span>
            {formatPrice(product.price)}
          </span>
          <button
            type="button"
            className="btn btn--sm"
            disabled={!product.available}
            onClick={() => {
              addItem(product.id)
              notify(`${product.name} adicionado ao carrinho.`, 'success')
            }}
          >
            {product.available ? 'Adicionar' : 'Esgotado'}
          </button>
        </div>
      </div>
    </article>
  )
}
