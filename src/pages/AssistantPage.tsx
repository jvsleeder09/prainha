import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ProductCard } from '../components/ProductCard.tsx'
import { SparkleIcon } from '../components/icons.tsx'
import { Notice, PageHead } from '../components/ui.tsx'
import { EMPTY_PREFERENCES, hasAnyPreference } from '../domain/options.ts'
import { AiError, checkAiHealth, requestAiRecommendations } from '../services/aiClient.ts'
import { buildAiRequest, checkAiMessage } from '../domain/aiPayload.ts'
import type { AiRecommendResponse } from '../../supabase/functions/_shared/ai-contract.ts'
import { AI_LIMITS } from '../../supabase/functions/_shared/ai-contract.ts'
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts'
import { useCatalog, useShop } from '../state/hooks.ts'

type Status =
  | { kind: 'checking' }
  | { kind: 'ready'; provider: string | null; model: string | null; paused: boolean }
  | { kind: 'unavailable'; message: string }

const EXAMPLES = [
  'Quero algo leve com frango para o almoço',
  'Uma opção vegetariana bem temperada',
  'Algo bem caseiro até R$ 28',
  'Tenho vontade de comer algo apimentado',
]

export function AssistantPage() {
  useDocumentTitle('Assistente com IA')
  const { products, categories } = useCatalog()
  const { preferences, addHistory } = useShop()
  const [status, setStatus] = useState<Status>({ kind: 'checking' })
  const [message, setMessage] = useState('')
  const [usePrefs, setUsePrefs] = useState(hasAnyPreference(preferences))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<{ message: string; fallback: boolean } | null>(null)
  const [answer, setAnswer] = useState<(AiRecommendResponse & { query: string }) | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const resultRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    checkAiHealth(ctrl.signal)
      .then((h) =>
        setStatus(
          h.configured
            ? { kind: 'ready', provider: h.provider, model: h.model, paused: Boolean(h.pausedUntil && Date.parse(h.pausedUntil) > Date.now()) }
            : { kind: 'unavailable', message: `O assistente ainda não foi ativado. ${h.reason ?? ''}`.trim() },
        ),
      )
      .catch((e) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setStatus({
          kind: 'unavailable',
          message: e instanceof AiError ? e.message : 'O backend do assistente está indisponível.',
        })
      })
    return () => ctrl.abort()
  }, [])

  useEffect(() => () => abortRef.current?.abort(), [])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const query = message.trim()
    if (query.length < 3 || loading) return
    const prefs = usePrefs ? preferences : null
    // Privacidade: restrições são aplicadas aqui e o texto é verificado ANTES de qualquer envio.
    const payload = buildAiRequest(query, prefs, products, categories)
    if (!payload.ok) {
      setError({ message: payload.message, fallback: payload.code === 'invalid_request' })
      return
    }
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    setError(null)
    try {
      const res = await requestAiRecommendations(payload.request, ctrl.signal)
      // Validação no cliente: só exibe produtos que existem no catálogo atual.
      const valid = res.recommendations.filter((r) => products.some((p) => p.id === r.productId))
      const final = { ...res, recommendations: valid, query }
      setAnswer(final)
      addHistory({
        source: 'assistente-ia',
        query,
        preferences: usePrefs ? preferences : EMPTY_PREFERENCES,
        summary: res.summary,
        items: valid.map((r) => ({
          productId: r.productId,
          productName: products.find((p) => p.id === r.productId)?.name ?? r.productId,
          reasons: [r.reason],
        })),
      })
      requestAnimationFrame(() => resultRef.current?.focus())
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setError({
        message: e instanceof AiError ? e.message : 'Não foi possível obter uma resposta agora.',
        fallback: !(e instanceof AiError && e.code === 'sensitive_content'),
      })
      if (e instanceof AiError && e.code === 'not_configured') {
        setStatus({ kind: 'unavailable', message: e.message })
      }
    } finally {
      if (abortRef.current === ctrl) setLoading(false)
    }
  }

  const privacy = message.trim().length >= 3 ? checkAiMessage(message) : { ok: true as const }
  const disabled = status.kind !== 'ready' || loading || !privacy.ok
  const paused = status.kind === 'ready' && status.paused

  return (
    <>
      <PageHead
        eyebrow="Assistente com IA"
        title="Diga o que você quer comer"
        crumbs={[{ to: '/', label: 'Início' }, { label: 'Assistente IA' }]}
      >
        <p>
          Descreva em poucas palavras o que você procura. O assistente consulta o cardápio cadastrado e sugere até{' '}
          {AI_LIMITS.maxRecommendations} marmitas, explicando cada escolha.
        </p>
      </PageHead>

      <div className="container assistant">
        <div className="assistant__status" aria-live="polite">
          {status.kind === 'checking' && (
            <p className="status-pill">
              <span className="spinner spinner--sm" aria-hidden="true" /> Verificando o assistente…
            </p>
          )}
          {status.kind === 'ready' && (
            <p className="status-pill status-pill--ok">
              <span className="dot" aria-hidden="true" /> Assistente disponível
              {status.provider ? ` · ${status.provider}` : ''}
              {status.model ? ` · ${status.model}` : ''}
            </p>
          )}
          {paused && (
            <Notice tone="warning" icon="!" title="Limite de uso atingido.">
              O limite gratuito do assistente foi atingido e ele está pausado por enquanto. As{' '}
              <Link to="/preferencias">recomendações por preferências</Link> continuam funcionando.
            </Notice>
          )}
          {status.kind === 'unavailable' && (
            <Notice tone="warning" icon="!" title="Assistente indisponível.">
              {status.message} Enquanto isso, use as{' '}
              <Link to="/preferencias">recomendações por preferências</Link>, que funcionam sem IA.
            </Notice>
          )}
        </div>

        <Notice tone="info" icon="i" title="Privacidade.">
          Não informe nome, telefone, endereço ou informações de saúde: o assistente só precisa saber o que você quer
          comer. Seu pedido é enviado ao Google Gemini (plano gratuito), cujos termos permitem usar o texto para
          melhorar os serviços do Google. Restrições alimentares e ingredientes a evitar das suas{' '}
          <Link to="/preferencias">Preferências</Link> são aplicados aqui no seu aparelho e não são enviados.
        </Notice>

        <form className="assistant__form" onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="pedido">O que você procura?</label>
            <textarea
              id="pedido"
              className="textarea"
              maxLength={AI_LIMITS.maxMessageLength}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ex.: algo leve, sem lactose, com frango"
              aria-describedby="pedido-contagem pedido-privacidade"
              aria-invalid={!privacy.ok || undefined}
              disabled={status.kind === 'unavailable'}
            />
            <small id="pedido-contagem">
              {message.length}/{AI_LIMITS.maxMessageLength} caracteres
            </small>
            <p id="pedido-privacidade" className="field__error" aria-live="polite">
              {!privacy.ok ? privacy.message : ''}
            </p>
          </div>
          <div className="assistant__examples" role="group" aria-label="Exemplos de pedidos">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                className="chip-btn"
                onClick={() => setMessage(ex)}
                disabled={status.kind === 'unavailable'}
              >
                {ex}
              </button>
            ))}
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={usePrefs}
              onChange={(e) => setUsePrefs(e.target.checked)}
              disabled={!hasAnyPreference(preferences)}
            />
            Considerar minhas preferências salvas (filtradas no seu aparelho)
            {!hasAnyPreference(preferences) && <span className="muted"> (nenhuma salva)</span>}
          </label>
          <button type="submit" className="btn btn--secondary" disabled={disabled || message.trim().length < 3}>
            {loading ? (
              <>
                <span className="spinner spinner--sm spinner--light" aria-hidden="true" /> Consultando…
              </>
            ) : (
              <>
                <SparkleIcon width={18} height={18} /> Pedir sugestões
              </>
            )}
          </button>
          <p className="muted assistant__disclaimer">
            Respostas geradas por IA a partir do cadastro dos produtos. Podem conter imprecisões e não são orientação
            médica ou nutricional.
          </p>
        </form>

        {loading && (
          <div className="assistant__loading" role="status">
            <span className="spinner" aria-hidden="true" />
            <p>Consultando o cardápio…</p>
          </div>
        )}
        {error && (
          <Notice tone="error" icon="✕" title="Não foi possível responder.">
            {error.message}
            {error.fallback && (
              <>
                {' '}
                Enquanto isso, use as <Link to="/preferencias">recomendações por preferências</Link>, que funcionam sem IA.
              </>
            )}
          </Notice>
        )}

        {answer && !loading && (
          <section ref={resultRef} tabIndex={-1} className="assistant__answer" aria-labelledby="ai-answer">
            <h2 id="ai-answer">Sugestões para “{answer.query}”</h2>
            {answer.summary && <p className="assistant__summary">{answer.summary}</p>}
            {answer.recommendations.length === 0 ? (
              <p className="muted">Nenhuma marmita do cardápio atende a esse pedido.</p>
            ) : (
              <ul className="product-grid" role="list">
                {answer.recommendations.map((r) => {
                  const p = products.find((x) => x.id === r.productId)
                  if (!p) return null
                  return (
                    <li key={r.productId}>
                      <ProductCard product={p} categoryName={categories.find((c) => c.id === p.categoryId)?.name}>
                        <div className="rec-why rec-why--ai">
                          <strong>
                            <SparkleIcon width={14} height={14} /> Por que o assistente sugeriu
                          </strong>
                          <p>{r.reason}</p>
                        </div>
                      </ProductCard>
                    </li>
                  )
                })}
              </ul>
            )}
            <p className="muted">Modelo: {answer.model}. Consulta registrada no histórico.</p>
          </section>
        )}
      </div>
    </>
  )
}
