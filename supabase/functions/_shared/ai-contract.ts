/**
 * Contrato da API de IA da Prainha, compartilhado entre:
 *  - frontend (src/services/aiClient.ts e src/domain/aiPayload.ts);
 *  - servidor local de desenvolvimento (server/dev-server.ts);
 *  - Supabase Edge Function (supabase/functions/ai-assistant);
 *  - Cloudflare Worker (cloudflare/ai-worker.ts).
 *
 * Este arquivo não pode importar nada específico de Node, Deno, Workers ou navegador.
 */

export interface AiCatalogItem {
  id: string
  name: string
  description: string
  category: string
  priceCents: number
  proteins: string[]
  tags: string[]
  ingredients: string[]
  contains: string[]
  vegetarian: boolean
  vegan: boolean
  demo: boolean
}

/**
 * Preferências enviadas ao provedor de IA: SOMENTE gostos (proteínas e estilos).
 * Restrições alimentares, ingredientes a evitar e preço máximo NÃO são enviados: o navegador aplica esses
 * filtros localmente e manda apenas o catálogo já filtrado (ver src/domain/aiPayload.ts). Assim nenhuma
 * informação que possa indicar condição de saúde sai do aparelho do usuário.
 */
export interface AiPreferences {
  proteins: string[]
  interests: string[]
}

export interface AiRecommendRequest {
  message: string
  preferences: AiPreferences
  catalog: AiCatalogItem[]
}

export interface AiRecommendation {
  productId: string
  reason: string
}

export interface AiRecommendResponse {
  summary: string
  recommendations: AiRecommendation[]
  model: string
}

export type AiErrorCode =
  | 'not_configured'
  | 'invalid_request'
  | 'rate_limited'
  | 'upstream_error'
  | 'refused'
  | 'invalid_response'
  | 'quota_exceeded'
  | 'sensitive_content'

export interface AiErrorBody {
  error: { code: AiErrorCode; message: string }
}

export interface AiHealthResponse {
  configured: boolean
  /** Nome legível do provedor (ex.: "Google Gemini (plano gratuito)"), ou null se não configurado. */
  provider: string | null
  model: string | null
  /** Motivo legível quando `configured` é false. */
  reason?: string
  /** Momento (ISO) até o qual o assistente está pausado por limite de uso, se houver. */
  pausedUntil?: string | null
}

export const AI_LIMITS = {
  maxMessageLength: 600,
  maxCatalogItems: 80,
  maxStringLength: 300,
  maxListItems: 40,
  maxRecommendations: 4,
  maxBodyBytes: 64 * 1024,
} as const

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, max: number = AI_LIMITS.maxStringLength): string =>
  typeof v === 'string' ? v.slice(0, max) : ''
const strList = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.filter((s): s is string => typeof s === 'string').slice(0, AI_LIMITS.maxListItems).map((s) => s.slice(0, 80))
    : []

/**
 * Valida e saneia o corpo recebido. Retorna a requisição limpa ou uma mensagem de erro.
 * Nada do que vem do cliente é confiável: tamanhos são limitados e campos desconhecidos descartados.
 */
export function validateRecommendRequest(body: unknown): AiRecommendRequest | string {
  if (!isRec(body)) return 'Corpo da requisição inválido.'
  const message = str(body.message, AI_LIMITS.maxMessageLength).trim()
  if (message.length < 3) return 'Descreva o que você procura (mínimo de 3 caracteres).'
  if (!Array.isArray(body.catalog) || body.catalog.length === 0) return 'Catálogo ausente.'
  if (body.catalog.length > AI_LIMITS.maxCatalogItems) return 'Catálogo grande demais.'

  const catalog: AiCatalogItem[] = []
  for (const raw of body.catalog) {
    if (!isRec(raw) || typeof raw.id !== 'string' || typeof raw.name !== 'string') continue
    catalog.push({
      id: str(raw.id, 100),
      name: str(raw.name, 120),
      description: str(raw.description),
      category: str(raw.category, 80),
      priceCents: typeof raw.priceCents === 'number' && raw.priceCents >= 0 ? Math.round(raw.priceCents) : 0,
      proteins: strList(raw.proteins),
      tags: strList(raw.tags),
      ingredients: strList(raw.ingredients),
      contains: strList(raw.contains),
      vegetarian: raw.vegetarian === true,
      vegan: raw.vegan === true,
      demo: raw.demo !== false,
    })
  }
  if (catalog.length === 0) return 'Catálogo sem itens válidos.'

  // Campos de preferência não listados (restrições, ingredientes a evitar etc.) são descartados de propósito.
  const p = isRec(body.preferences) ? body.preferences : {}
  const preferences: AiPreferences = {
    proteins: strList(p.proteins),
    interests: strList(p.interests),
  }
  return { message, preferences, catalog }
}
