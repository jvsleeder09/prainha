import { useRef } from 'react'
import { Link } from 'react-router'
import { ProductCard } from '../components/ProductCard.tsx'
import { ClockIcon, SnowIcon, SparkleIcon, WhatsappIcon } from '../components/icons.tsx'
import { Notice, Wave } from '../components/ui.tsx'
import { featuredProducts } from '../domain/recommendation.ts'
import { Hero } from '../features/hero/Hero.tsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts'
import { useReveal } from '../hooks/useReveal.ts'
import { useCatalog } from '../state/hooks.ts'

export function HomePage() {
  useDocumentTitle('')
  const { products, categories, business, usingDemoData } = useCatalog()
  const ref = useRef<HTMLDivElement>(null)
  const featured = featuredProducts(products, 4)
  useReveal(ref, [featured.length])
  const values = business.tagline.split('•').map((v) => v.trim()).filter(Boolean)

  return (
    <div ref={ref}>
      <Hero tagline={business.tagline} />

      {values.length > 0 && (
        <section className="values-strip" aria-label="O que a Prainha valoriza">
          <div className="values-strip__track">
            {[...values, ...values, ...values].map((v, i) => (
              <span key={i} aria-hidden={i >= values.length}>
                {v}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="section" aria-labelledby="como-funciona">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="eyebrow">Como funciona</p>
              <h2 id="como-funciona">Do freezer para a mesa, sem complicação</h2>
            </div>
            <p>Você monta o pedido aqui no site e combina entrega, pagamento e taxa diretamente com a Prainha.</p>
          </div>
          <ol className="steps" role="list">
            <li className="step" data-reveal>
              <span className="step__icon" aria-hidden="true">
                <SparkleIcon />
              </span>
              <h3>Descubra</h3>
              <p>Conte suas preferências e restrições. O site sugere marmitas compatíveis e explica o porquê.</p>
            </li>
            <li className="step" data-reveal>
              <span className="step__icon" aria-hidden="true">
                <SnowIcon />
              </span>
              <h3>Monte seu estoque</h3>
              <p>Adicione as marmitas ao carrinho, ajuste quantidades e revise o total antes de enviar.</p>
            </li>
            <li className="step" data-reveal>
              <span className="step__icon" aria-hidden="true">
                <WhatsappIcon />
              </span>
              <h3>Finalize no WhatsApp</h3>
              <p>Uma mensagem com itens, quantidades e valores é montada para você enviar à loja.</p>
            </li>
          </ol>
        </div>
      </section>

      <Wave />

      <section className="section" aria-labelledby="destaques">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="eyebrow">Destaques</p>
              <h2 id="destaques">Destaques do cardápio</h2>
            </div>
            <Link to="/cardapio" className="btn btn--ghost">
              Ver cardápio completo
            </Link>
          </div>
          {usingDemoData && (
            <Notice tone="demo" icon="ⓘ">
              Os produtos e preços exibidos são <strong>demonstrativos</strong>, criados para apresentar a plataforma. O
              cardápio real será cadastrado pela Prainha.
            </Notice>
          )}
          <ul className="product-grid home-featured" role="list">
            {featured.map((p) => (
              <li key={p.id}>
                <ProductCard product={p} categoryName={categories.find((c) => c.id === p.categoryId)?.name} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="categorias">
        <div className="container">
          <p className="eyebrow">Categorias</p>
          <h2 id="categorias">Escolha pelo seu jeito de comer</h2>
          <ul className="category-tiles" role="list">
            {categories.map((c, i) => (
              <li key={c.id} data-reveal>
                <Link to={`/cardapio?categoria=${c.id}`} className={`category-tile category-tile--${i % 4}`}>
                  <span className="category-tile__name">{c.name}</span>
                  <span className="category-tile__desc">{c.description}</span>
                  <span className="category-tile__count">
                    {products.filter((p) => p.categoryId === c.id && p.available).length} opções
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="descoberta">
        <div className="container">
          <div className="discover" data-reveal>
            <div>
              <p className="eyebrow">Diferencial</p>
              <h2 id="descoberta">Não sabe o que pedir? A gente ajuda.</h2>
              <p>
                Selecione restrições, proteínas e objetivos para ver recomendações justificadas com os dados de cada
                marmita. Ou descreva o que você quer em linguagem natural para o assistente com IA.
              </p>
              <div className="hero__actions">
                <Link to="/preferencias" className="btn btn--light">
                  Escolher preferências
                </Link>
                <Link to="/assistente" className="btn btn--secondary">
                  <SparkleIcon width={18} height={18} /> Falar com o assistente
                </Link>
              </div>
            </div>
            <div className="discover__card" aria-hidden="true">
              <p className="discover__bubble">“Quero algo leve, sem lactose, com frango.”</p>
              <p className="discover__bubble discover__bubble--reply">
                <ClockIcon width={16} height={16} /> Buscando no cardápio…
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
