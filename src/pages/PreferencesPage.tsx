import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ProductCard } from '../components/ProductCard.tsx'
import { EmptyState, Notice, PageHead } from '../components/ui.tsx'
import { formatPrice, parsePriceInput } from '../domain/format.ts'
import { EMPTY_PREFERENCES, INTEREST_OPTIONS, PROTEIN_OPTIONS, RESTRICTION_OPTIONS, hasAnyPreference } from '../domain/options.ts'
import { recommend } from '../domain/recommendation.ts'
import type { Preferences, RecommendationResult } from '../domain/types.ts'
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts'
import { useReveal } from '../hooks/useReveal.ts'
import { useCatalog, useShop, useToast } from '../state/hooks.ts'

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]
}

export function PreferencesPage() {
  useDocumentTitle('Recomendações para você')
  const { products, categories } = useCatalog()
  const { preferences, setPreferences, addHistory } = useShop()
  const { notify } = useToast()
  const [draft, setDraft] = useState<Preferences>(preferences)
  const [avoidText, setAvoidText] = useState(preferences.avoidIngredients.join(', '))
  const [priceText, setPriceText] = useState(preferences.maxPrice ? (preferences.maxPrice / 100).toFixed(2).replace('.', ',') : '')
  const [priceError, setPriceError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState<Preferences | null>(hasAnyPreference(preferences) ? preferences : null)
  const resultsRef = useRef<HTMLElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)

  const result: RecommendationResult | null = useMemo(
    () => (submitted ? recommend(products, submitted) : null),
    [products, submitted],
  )
  useReveal(pageRef, [result])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    let maxPrice: number | null = null
    if (priceText.trim()) {
      maxPrice = parsePriceInput(priceText)
      if (maxPrice === null || maxPrice <= 0) {
        setPriceError('Informe um valor válido, por exemplo 30,00.')
        return
      }
    }
    setPriceError(null)
    const prefs: Preferences = {
      ...draft,
      avoidIngredients: avoidText
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length >= 2)
        .slice(0, 20),
      maxPrice,
    }
    setPreferences(prefs)
    setSubmitted(prefs)
    const r = recommend(products, prefs)
    addHistory({
      source: 'preferencias',
      query: null,
      preferences: prefs,
      summary:
        r.recommendations.length > 0
          ? `${r.recommendations.length} marmita(s) compatível(is); ${r.excluded.length} excluída(s) pelos filtros.`
          : 'Nenhuma marmita compatível com as preferências.',
      items: r.recommendations.map((rec) => ({
        productId: rec.productId,
        productName: products.find((p) => p.id === rec.productId)?.name ?? rec.productId,
        reasons: rec.reasons.map((x) => x.text),
      })),
    })
    notify('Preferências salvas e recomendações atualizadas.', 'success')
    requestAnimationFrame(() => resultsRef.current?.focus())
  }

  const onReset = () => {
    setDraft(EMPTY_PREFERENCES)
    setAvoidText('')
    setPriceText('')
    setPreferences(EMPTY_PREFERENCES)
    setSubmitted(null)
    notify('Preferências limpas.')
  }

  return (
    <div ref={pageRef}>
      <PageHead
        eyebrow="Para você"
        title="Encontre a marmita certa"
        crumbs={[{ to: '/', label: 'Início' }, { label: 'Para você' }]}
      >
        <p>
          Marque suas restrições, proteínas preferidas e objetivos. As recomendações usam apenas os dados cadastrados de
          cada produto e mostram o motivo de cada sugestão.
        </p>
      </PageHead>

      <div className="container prefs">
        <form className="prefs__form" onSubmit={onSubmit} aria-describedby="prefs-disclaimer">
          <fieldset className="prefs__group">
            <legend>Restrições alimentares</legend>
            <p className="muted">Produtos que não atendem são retirados das sugestões.</p>
            <div className="chip-group">
              {RESTRICTION_OPTIONS.map((o) => (
                <label key={o.value} className="chip" title={o.hint}>
                  <input
                    type="checkbox"
                    name="restricoes"
                    value={o.value}
                    checked={draft.restrictions.includes(o.value)}
                    onChange={() => setDraft((d) => ({ ...d, restrictions: toggle(d.restrictions, o.value) }))}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="prefs__group">
            <legend>Proteínas que você prefere</legend>
            <div className="chip-group">
              {PROTEIN_OPTIONS.map((o) => (
                <label key={o.value} className="chip">
                  <input
                    type="checkbox"
                    name="proteinas"
                    value={o.value}
                    checked={draft.proteins.includes(o.value)}
                    onChange={() => setDraft((d) => ({ ...d, proteins: toggle(d.proteins, o.value) }))}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="prefs__group">
            <legend>Interesses</legend>
            <div className="chip-group">
              {INTEREST_OPTIONS.map((o) => (
                <label key={o.value} className="chip" title={o.hint}>
                  <input
                    type="checkbox"
                    name="interesses"
                    value={o.value}
                    checked={draft.interests.includes(o.value)}
                    onChange={() => setDraft((d) => ({ ...d, interests: toggle(d.interests, o.value) }))}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="prefs__row">
            <div className="field">
              <label htmlFor="evitar">Ingredientes que você quer evitar</label>
              <input
                id="evitar"
                className="input"
                value={avoidText}
                onChange={(e) => setAvoidText(e.target.value)}
                placeholder="Ex.: cebola, champignon"
                aria-describedby="evitar-dica"
              />
              <small id="evitar-dica">Separe por vírgulas.</small>
            </div>
            <div className="field">
              <label htmlFor="preco-max">Preço máximo por marmita (R$)</label>
              <input
                id="preco-max"
                className="input"
                inputMode="decimal"
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
                placeholder="Sem limite"
                aria-invalid={priceError ? true : undefined}
                aria-describedby={priceError ? 'preco-erro' : undefined}
              />
              {priceError && (
                <small id="preco-erro" className="field__error">
                  {priceError}
                </small>
              )}
            </div>
          </div>

          <p id="prefs-disclaimer" className="prefs__disclaimer">
            As sugestões não são orientação médica ou nutricional. Em caso de alergias ou dietas específicas, consulte um
            profissional e confirme os ingredientes com a loja.
          </p>

          <div className="prefs__actions">
            <button type="submit" className="btn">
              Salvar e ver recomendações
            </button>
            <button type="button" className="btn btn--ghost" onClick={onReset}>
              Limpar
            </button>
          </div>
        </form>

        <section ref={resultsRef} tabIndex={-1} className="prefs__results" aria-labelledby="recs-title">
          <h2 id="recs-title">Recomendações</h2>
          {!result ? (
            <EmptyState title="Escolha suas preferências">
              Marque ao menos uma opção ao lado e clique em “Salvar e ver recomendações”.
            </EmptyState>
          ) : result.recommendations.length === 0 ? (
            <EmptyState
              title="Nenhuma marmita compatível"
              action={
                <Link to="/assistente" className="btn btn--secondary">
                  Perguntar ao assistente
                </Link>
              }
            >
              Nenhum produto cadastrado atende a todos os filtros. Tente flexibilizar alguma restrição ou o preço máximo.
            </EmptyState>
          ) : (
            <>
              <p className="muted" aria-live="polite">
                {result.recommendations.length} sugestão(ões), em ordem de compatibilidade
                {submitted?.maxPrice ? `, até ${formatPrice(submitted.maxPrice)}` : ''}.
              </p>
              <ol className="product-grid product-grid--recs" role="list">
                {result.recommendations.map((rec, i) => {
                  const p = products.find((x) => x.id === rec.productId)
                  if (!p) return null
                  return (
                    <li key={rec.productId} className="rec-item">
                      <span className="rec-item__rank" aria-label={`Posição ${i + 1}`}>
                        {i + 1}
                      </span>
                      <ProductCard product={p} categoryName={categories.find((c) => c.id === p.categoryId)?.name}>
                        <div className="rec-why">
                          <strong>Por que recomendamos</strong>
                          <ul className="reasons">
                            {rec.reasons.map((r, j) => (
                              <li key={j} data-kind={r.kind}>
                                {r.text}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </ProductCard>
                    </li>
                  )
                })}
              </ol>
            </>
          )}
          {result && result.excluded.length > 0 && (
            <details className="excluded">
              <summary>Ver {result.excluded.length} produto(s) fora das sugestões e o motivo</summary>
              <ul>
                {result.excluded.map((x) => (
                  <li key={x.productId}>
                    <strong>{products.find((p) => p.id === x.productId)?.name ?? x.productId}</strong> — {x.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {result && (
            <Notice icon="ⓘ">
              Cada consulta fica registrada no seu <Link to="/historico">histórico de recomendações</Link>.
            </Notice>
          )}
        </section>
      </div>
    </div>
  )
}
