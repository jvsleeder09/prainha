/**
 * Interface de provedor de IA (camada intercambiável).
 *
 * O núcleo (ai-core.ts) não conhece nenhum fornecedor: ele monta o pedido (instruções, texto e JSON Schema) e
 * recebe de volta o texto JSON gerado ou uma falha tipada. Para trocar de fornecedor no futuro, basta criar um
 * arquivo em providers/ que implemente `AiProvider` e registrá-lo em `createProvider` (ai-core.ts).
 *
 * Requisitos para qualquer provedor:
 *  - usar somente `fetch` e APIs web padrão (roda em Node 24, Deno/Supabase e Cloudflare Workers);
 *  - NÃO repetir chamadas automaticamente nem trocar de modelo sozinho (evita consumo de cota e cobranças);
 *  - nunca incluir a chave em URLs ou mensagens de erro.
 */

export type JsonSchema = Record<string, unknown>

export interface ProviderRequest {
  system: string
  user: string
  schema: JsonSchema
  maxOutputTokens: number
  timeoutMs: number
}

export type ProviderFailureKind =
  /** Chave ausente, inválida ou sem permissão. */
  | 'auth'
  /** Limite por minuto excedido (temporário). */
  | 'rate_limit'
  /** Cota diária esgotada. */
  | 'daily_quota'
  /** O provedor indicou cobrança/saldo (projeto com faturamento). O assistente é bloqueado. */
  | 'billing'
  /** Modelo inexistente ou indisponível para esta chave. */
  | 'model_unavailable'
  /** Pedido ou resposta bloqueados por política de segurança do provedor. */
  | 'blocked'
  /** Resposta cortada por limite de tokens. */
  | 'truncated'
  /** Requisição rejeitada pelo provedor (formato). */
  | 'bad_request'
  /** Erro do provedor (5xx), tempo esgotado ou falha de rede. */
  | 'unavailable'

export type ProviderResult =
  | { ok: true; text: string; model: string }
  | { ok: false; kind: ProviderFailureKind; status: number | null; retryAfterMs: number | null; detail: string }

export interface AiProvider {
  /** Identificador estável (ex.: "gemini"). */
  readonly id: string
  /** Nome legível para a interface (ex.: "Google Gemini (plano gratuito)"). */
  readonly label: string
  readonly model: string
  generateJson(req: ProviderRequest): Promise<ProviderResult>
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>
