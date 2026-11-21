import { Link, useNavigate } from 'react-router'
import { HistoryIcon, SparkleIcon, TrashIcon } from '../components/icons.tsx'
import { EmptyState, PageHead } from '../components/ui.tsx'
import { formatDateTime, formatPrice } from '../domain/format.ts'
import { INTEREST_LABELS, PROTEIN_LABELS, RESTRICTION_LABELS, hasAnyPreference } from '../domain/options.ts'
import type { Preferences } from '../domain/types.ts'
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts'
import { useCatalog, useShop, useToast } from '../state/hooks.ts'

function describePrefs(p: Preferences): string {
  const parts = [
    ...p.restrictions.map((r) => RESTRICTION_LABELS[r]),
    ...p.proteins.map((x) => PROTEIN_LABELS[x]),
    ...p.interests.map((i) => INTEREST_LABELS[i]),
    ...(p.avoidIngredients.length ? [`evitar: ${p.avoidIngredients.join(', ')}`] : []),
    ...(p.maxPrice ? [`até ${formatPrice(p.maxPrice)}`] : []),
  ]
  return parts.join(' · ')
}

export function HistoryPage() {
  useDocumentTitle('Histórico de recomendações')
  const { history, removeHistory, clearHistory, setPreferences } = useShop()
  const { products } = useCatalog()
  const { notify } = useToast()
  const navigate = useNavigate()

  return (
    <>
      <PageHead
        eyebrow="Histórico"
        title="Suas recomendações anteriores"
        crumbs={[{ to: '/', label: 'Início' }, { label: 'Histórico' }]}
      >
        <p>Cada consulta por preferências ou ao assistente de IA é registrada aqui (até 30, salvas neste navegador).</p>
      </PageHead>
      <div className="container">
        {history.length === 0 ? (
          <EmptyState
            title="Nenhuma recomendação registrada"
            action={
              <Link to="/preferencias" className="btn">
                Fazer minha primeira consulta
              </Link>
            }
          >
            Escolha suas preferências ou pergunte ao assistente para começar seu histórico.
          </EmptyState>
        ) : (
          <>
            <div className="section-head">
              <p>{history.length} registro(s)</p>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  if (window.confirm('Apagar todo o histórico de recomendações?')) {
                    clearHistory()
                    notify('Histórico apagado.')
                  }
                }}
              >
                Limpar histórico
              </button>
            </div>
            <ol className="history" role="list">
              {history.map((h) => (
                <li key={h.id} className="history__item">
                  <article aria-labelledby={`h-${h.id}`}>
                    <header className="history__head">
                      <span className="history__icon" aria-hidden="true">
                        {h.source === 'assistente-ia' ? <SparkleIcon /> : <HistoryIcon />}
                      </span>
                      <div>
                        <h2 id={`h-${h.id}`} className="history__title">
                          {h.source === 'assistente-ia' ? 'Assistente de IA' : 'Por preferências'}
                        </h2>
                        <p className="muted history__meta">
                          <time dateTime={h.createdAt}>{formatDateTime(h.createdAt)}</time>
                        </p>
                      </div>
                      <button
                        type="button"
                        className="icon-btn history__remove"
                        aria-label="Remover este registro"
                        onClick={() => removeHistory(h.id)}
                      >
                        <TrashIcon />
                      </button>
                    </header>
                    {h.query && <blockquote className="history__query">“{h.query}”</blockquote>}
                    {hasAnyPreference(h.preferences) && (
                      <p className="history__prefs">
                        <strong>Preferências:</strong> {describePrefs(h.preferences)}
                      </p>
                    )}
                    {h.summary && <p>{h.summary}</p>}
                    {h.items.length > 0 && (
                      <ul className="history__products">
                        {h.items.map((it) => {
                          const p = products.find((x) => x.id === it.productId)
                          return (
                            <li key={it.productId}>
                              {p ? <Link to={`/cardapio/${p.slug}`}>{it.productName}</Link> : <span>{it.productName} (removido)</span>}
                              {it.reasons[0] && <span className="muted"> — {it.reasons[0]}</span>}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                    {h.source === 'preferencias' && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => {
                          setPreferences(h.preferences)
                          navigate('/preferencias')
                        }}
                      >
                        Reaplicar estas preferências
                      </button>
                    )}
                  </article>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </>
  )
}
