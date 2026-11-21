import type {
  AiErrorBody,
  AiErrorCode,
  AiHealthResponse,
  AiRecommendRequest,
  AiRecommendResponse,
} from '../../supabase/functions/_shared/ai-contract.ts'

/**
 * Cliente do backend de IA. O navegador NUNCA fala diretamente com o provedor de IA (Google Gemini):
 * ele chama o backend próprio (servidor local, Supabase Edge Function ou Cloudflare Worker), que guarda a chave.
 * O conteúdo enviado é montado por src/domain/aiPayload.ts (regras de privacidade).
 */

const ENDPOINT = (import.meta.env.VITE_AI_ENDPOINT ?? '/api/ai').replace(/\/+$/, '')

export class AiError extends Error {
  readonly code: AiErrorCode | 'network'
  constructor(code: AiErrorCode | 'network', message: string) {
    super(message)
    this.code = code
  }
}

async function call<T>(path: string, init: RequestInit, signal?: AbortSignal): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${ENDPOINT}${path}`, { ...init, signal, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new AiError('network', 'Não foi possível conectar ao backend do assistente.')
  }
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    throw new AiError('network', 'O backend do assistente não está em execução ou não respondeu corretamente.')
  }
  if (!res.ok) {
    const e = (data as AiErrorBody | null)?.error
    throw new AiError(e?.code ?? 'upstream_error', e?.message ?? `Erro ${res.status}`)
  }
  return data as T
}

export function checkAiHealth(signal?: AbortSignal): Promise<AiHealthResponse> {
  return call<AiHealthResponse>('/health', { method: 'GET' }, signal)
}

export function requestAiRecommendations(request: AiRecommendRequest, signal?: AbortSignal): Promise<AiRecommendResponse> {
  return call<AiRecommendResponse>('/recommend', { method: 'POST', body: JSON.stringify(request) }, signal)
}
