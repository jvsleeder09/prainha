import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ProductArt } from '../components/ProductArt.tsx'
import { ProductCard } from '../components/ProductCard.tsx'
import { DemoBadge, EmptyState, FavoriteButton, Notice, PageHead, QuantityStepper } from '../components/ui.tsx'
import { clampQuantity } from '../domain/cart.ts'
import { formatPrice } from '../domain/format.ts'
import { ALLERGEN_LABELS, INTEREST_LABELS, PROTEIN_LABELS } from '../domain/options.ts'
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts'
import { useCatalog, useShop, useToast } from '../state/hooks.ts'

export function ProductPage() {
  const { slug } = useParams()
  const { products, categories } = useCatalog()
  const { addItem } = useShop()
  const { notify } = useToast()
  const [qty, setQty] = useState(1)
  const product = products.find((p) => p.slug === slug)
  useDocumentTitle(product?.name ?? 'Produto não encontrado')

  if (!product) {
    return (
      <div className="container section">
        <EmptyState
          title="Marmita não encontrada"
          action={
            <Link to="/cardapio" className="btn">
              Voltar ao cardápio
            </Link>
          }
        >
          O produto pode ter sido removido ou o endereço está incorreto.
        </EmptyState>
      </div>
    )
  }

  const category = categories.find((c) => c.id === product.categoryId)
  const related = products
    .filter((p) => p.id !== product.id && p.available && p.categoryId === product.categoryId)
    .slice(0, 3)

  return (
    <>
      <PageHead
        title={product.name}
        crumbs={[
          { to: '/', label: 'Início' },
          { to: '/cardapio', label: 'Cardápio' },
          ...(category ? [{ to: `/cardapio?categoria=${category.id}`, label: category.name }] : []),
          { label: product.name },
        ]}
      />
      <article className="container product-detail" aria-labelledby="product-title">
        <h2 id="product-title" className="visually-hidden">
          Detalhes de {product.name}
        </h2>
        <figure className="product-detail__media">
          <ProductArt product={product} />
          <figcaption>Ilustração gerada a partir do cadastro — não é uma foto do produto.</figcaption>
        </figure>

        <div className="product-detail__info">
          <div className="product-detail__flags">
            {product.demo && <DemoBadge />}
            {category && <span className="badge">{category.name}</span>}
            {product.vegan ? (
              <span className="badge">Vegano</span>
            ) : product.vegetarian ? (
              <span className="badge">Vegetariano</span>
            ) : null}
            {!product.available && <span className="badge badge--off">Indisponível</span>}
          </div>
          <p className="product-detail__desc">{product.description}</p>
          <p className="product-detail__price price">
            {formatPrice(product.price)}
            {product.demo && <small className="muted"> (preço demonstrativo)</small>}
          </p>

          <div className="product-detail__buy">
            <QuantityStepper value={qty} onChange={(v) => setQty(clampQuantity(v))} label={`Quantidade de ${product.name}`} />
            <button
              type="button"
              className="btn"
              disabled={!product.available}
              onClick={() => {
                addItem(product.id, qty)
                notify(`${qty}x ${product.name} no carrinho.`, 'success')
                setQty(1)
              }}
            >
              {product.available ? 'Adicionar ao carrinho' : 'Indisponível'}
            </button>
            <FavoriteButton productId={product.id} productName={product.name} />
          </div>

          <dl className="spec-list">
            <div>
              <dt>Proteínas</dt>
              <dd>{product.proteins.map((p) => PROTEIN_LABELS[p]).join(', ') || '—'}</dd>
            </div>
            <div>
              <dt>Características</dt>
              <dd>{product.tags.map((t) => INTEREST_LABELS[t]).join(', ') || '—'}</dd>
            </div>
            <div>
              <dt>Ingredientes</dt>
              <dd>{product.ingredients.join(', ') || 'Não cadastrados'}</dd>
            </div>
            <div>
              <dt>Contém</dt>
              <dd>
                {product.contains.length > 0
                  ? product.contains.map((a) => ALLERGEN_LABELS[a]).join(', ')
                  : 'Nenhum alérgeno cadastrado'}
              </dd>
            </div>
            <div>
              <dt>Porção</dt>
              <dd>{product.weightGrams ? `${product.weightGrams} g` : 'Não informada'}</dd>
            </div>
          </dl>

          <section className="nutrition" aria-labelledby="nutri-title">
            <h3 id="nutri-title">Informação nutricional</h3>
            {product.nutrition ? (
              <table className="table">
                <caption className="visually-hidden">Valores por porção de {product.nutrition.portionGrams} g</caption>
                <tbody>
                  <tr>
                    <th scope="row">Porção</th>
                    <td>{product.nutrition.portionGrams} g</td>
                  </tr>
                  <tr>
                    <th scope="row">Valor energético</th>
                    <td>{product.nutrition.kcal} kcal</td>
                  </tr>
                  <tr>
                    <th scope="row">Proteínas</th>
                    <td>{product.nutrition.proteinGrams} g</td>
                  </tr>
                  <tr>
                    <th scope="row">Carboidratos</th>
                    <td>{product.nutrition.carbGrams} g</td>
                  </tr>
                  <tr>
                    <th scope="row">Gorduras totais</th>
                    <td>{product.nutrition.fatGrams} g</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <Notice icon="ⓘ">Ainda não cadastrada pela Prainha.</Notice>
            )}
          </section>

          <Notice tone="warning" icon="!">
            Informações de restrições e alérgenos seguem o cadastro do produto. Em caso de alergia, confirme com a loja
            antes de pedir.
          </Notice>
        </div>
      </article>

      {related.length > 0 && (
        <section className="container section" aria-labelledby="relacionados">
          <h2 id="relacionados">Da mesma categoria</h2>
          <ul className="product-grid" role="list">
            {related.map((p) => (
              <li key={p.id}>
                <ProductCard product={p} categoryName={category?.name} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
