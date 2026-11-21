/**
 * Provedor Google Gemini (API REST `generateContent`) usando apenas `fetch` — sem SDK.
 *
 * Política de custo R$ 0,00:
 *  - Só aceita modelos da lista FREE_TIER_MODELS (texto, "Free of charge" no plano gratuito, estáveis).
 *    Qualquer outro valor em AI_MODEL deixa o assistente desativado — não há troca automática de modelo.
 *  - Nenhuma repetição automática: um pedido do usuário = no máximo uma chamada.
 *  - A chave deve ser de um projeto do Google AI Studio SEM faturamento ativo. Se a API indicar cobrança
 *    (HTTP 402 ou mensagem de billing), o núcleo bloqueia o assistente.
 *
 * Fontes (consultadas em 21/11/2026): https://aistudio.google.com/docs/pricing ,
 * https://aistudio.google.com/docs/models/gemini-3.5-flash-lite.md , https://aistudio.google.com/docs/structured-output.md
 *
 * ATENÇÃO: este código foi verificado apenas com respostas simuladas (testes locais). A validação com uma chave
 * real ainda não foi feita — ver docs/TESTES.md, seção "Validação real".
 */
import type { AiProvider, FetchLike, ProviderFailureKind, ProviderRequest, ProviderResult } from '../ai-provider.ts'

export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

/** Modelo padrão: estável, gratuito, com saída estruturada (verificado na documentação em 21/11/2026). */
export const GEMINI_DEFAULT_MODEL = 'gemini-3.5-flash-lite'

/**
 * Modelos de texto estáveis marcados como "Free of charge" na página de preços em 21/11/2026.
 * Antes de acrescentar um modelo aqui, confirme na página de preços que ele tem plano gratuito.
 */
export const FREE_TIER_MODELS: readonly string[] = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.8-flash',
]

/**
 * Formato da saída estruturada no REST. A documentação mostra dois formatos:
 *  - "responseFormat" (exemplo REST atual): generationConfig.responseFormat.text { mimeType, schema }
 *  - "responseJsonSchema" (formato anterior): generationConfig.responseMimeType + responseJsonSchema
 * Padrão: "responseFormat". Se a validação real retornar erro 400 de campo desconhecido, use
 * GEMINI_STRUCTURED_OUTPUT=responseJsonSchema.
 */
export type GeminiStructuredOutput = 'responseFormat' | 'responseJsonSchema'

export interface GeminiOptions {
  apiKey: string
  model: string
  structuredOutput?: GeminiStructuredOutput
  /** Permite injetar um fetch simulado nos testes. */
  fetch?: FetchLike
}

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)

export function isFreeTierModel(model: string): boolean {
  return FREE_TIER_MODELS.includes(model)
}

/** Monta o corpo da requisição generateContent (exportado para testes). */
export function buildGeminiBody(req: ProviderRequest, structuredOutput: GeminiStructuredOutput): Rec {
  const generationConfig: Rec = {
    maxOutputTokens: req.maxOutputTokens,
    candidateCount: 1,
    // Pouco raciocínio: tarefa simples, resposta mais rápida e menor consumo da cota de tokens.
    thinkingConfig: { thinkingLevel: 'LOW' },
  }
  if (structuredOutput === 'responseJsonSchema') {
    generationConfig.responseMimeType = 'application/json'
    generationConfig.responseJsonSchema = req.schema
  } else {
    generationConfig.responseFormat = { text: { mimeType: 'APPLICATION_JSON', schema: req.schema } }
  }
  return {
    systemInstruction: { parts: [{ text: req.system }] },
    contents: [{ role: 'user', parts: [{ text: req.user }] }],
    generationConfig,
  }
}

/** Converte "31s" / "1.5s" (google.rpc.RetryInfo) em milissegundos. */
function parseDelay(v: unknown): number | null {
  if (typeof v !== 'string') return null
  const m = v.match(/^(\d+(?:\.\d+)?)s$/)
  return m ? Math.round(Number(m[1]) * 1000) : null
}

function retryAfter(res: Response, err: Rec): number | null {
  const details = Array.isArray(err.details) ? err.details : []
  for (const d of details) {
    if (isRec(d) && typeof d['@type'] === 'string' && d['@type'].endsWith('RetryInfo')) {
      const ms = parseDelay(d.retryDelay)
      if (ms !== null) return ms
    }
  }
  const header = Number(res.headers.get('retry-after'))
  return Number.isFinite(header) && header > 0 ? header * 1000 : null
}

/** Classifica uma resposta de erro HTTP do Gemini (exportado para testes). */
export function classifyGeminiError(status: number, err: Rec): ProviderFailureKind {
  const message = typeof err.message === 'string' ? err.message.toLowerCase() : ''
  const code = typeof err.code === 'string' ? err.code.toLowerCase() : ''
  const reasons = JSON.stringify(err.details ?? '').toLowerCase()
  // 402 = saldo pré-pago esgotado: só ocorre em projeto com faturamento. (Não usar a palavra "billing" da
  // mensagem: o erro 429 do plano gratuito costuma dizer "check your plan and billing details".)
  if (status === 402 || code === 'payment_required') return 'billing'
  if (status === 429) {
    return code === 'quota_exceeded' || /per ?day|perday|daily/.test(message + reasons) ? 'daily_quota' : 'rate_limit'
  }
  if (status === 401 || status === 403 || code === 'authentication' || /api[_ ]key/.test(message + reasons)) return 'auth'
  if (status === 404) return 'model_unavailable'
  if (status === 400) return 'bad_request'
  return 'unavailable'
}

const BLOCKED_FINISH = new Set(['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'IMAGE_SAFETY', 'LANGUAGE'])

const fail = (kind: ProviderFailureKind, status: number | null, detail: string, retryAfterMs: number | null = null): ProviderResult => ({
  ok: false,
  kind,
  status,
  retryAfterMs,
  detail,
})

export function createGeminiProvider(opts: GeminiOptions): AiProvider {
  const doFetch: FetchLike = opts.fetch ?? ((input, init) => fetch(input, init))
  const structuredOutput = opts.structuredOutput ?? 'responseFormat'
  const model = opts.model

  return {
    id: 'gemini',
    label: 'Google Gemini (plano gratuito)',
    model,
    async generateJson(req) {
      let res: Response
      try {
        res = await doFetch(`${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          // A chave vai no cabeçalho (nunca na URL, para não aparecer em logs).
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': opts.apiKey },
          body: JSON.stringify(buildGeminiBody(req, structuredOutput)),
          signal: AbortSignal.timeout(req.timeoutMs),
        })
      } catch (e) {
        const timeout = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')
        return fail('unavailable', null, timeout ? 'tempo esgotado' : 'falha de rede')
      }

      let data: unknown = null
      try {
        data = await res.json()
      } catch {
        data = null
      }

      if (!res.ok) {
        const err = isRec(data) && isRec(data.error) ? data.error : {}
        const kind = classifyGeminiError(res.status, err)
        const msg = typeof err.message === 'string' ? err.message.slice(0, 200) : ''
        return fail(kind, res.status, msg, kind === 'rate_limit' || kind === 'daily_quota' ? retryAfter(res, err) : null)
      }
      if (!isRec(data)) return fail('unavailable', res.status, 'resposta não JSON')

      const feedback = isRec(data.promptFeedback) ? data.promptFeedback : {}
      if (typeof feedback.blockReason === 'string' && feedback.blockReason !== 'BLOCK_REASON_UNSPECIFIED') {
        return fail('blocked', res.status, `pedido bloqueado: ${feedback.blockReason}`)
      }
      const candidate = Array.isArray(data.candidates) && isRec(data.candidates[0]) ? data.candidates[0] : null
      if (!candidate) return fail('unavailable', res.status, 'sem candidatos na resposta')

      const finish = typeof candidate.finishReason === 'string' ? candidate.finishReason : ''
      if (BLOCKED_FINISH.has(finish)) return fail('blocked', res.status, `resposta bloqueada: ${finish}`)
      if (finish === 'MAX_TOKENS') return fail('truncated', res.status, 'resposta cortada (MAX_TOKENS)')

      const content = isRec(candidate.content) ? candidate.content : {}
      const parts = Array.isArray(content.parts) ? content.parts : []
      const text = parts
        .filter((p): p is Rec => isRec(p) && typeof p.text === 'string' && p.thought !== true)
        .map((p) => p.text as string)
        .join('')

      return {
        ok: true,
        text,
        model: typeof data.modelVersion === 'string' && data.modelVersion ? data.modelVersion : model,
      }
    },
  }
}
