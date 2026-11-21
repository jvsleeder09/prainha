/**
 * Camada HTTP do backend de IA com APIs web padrão (Request/Response).
 * A mesma função atende o servidor local (Node), a Supabase Edge Function (Deno) e o Cloudflare Worker.
 *
 * Rotas (o prefixo é removido por `stripPrefix`):
 *   GET  /health     -> AiHealthResponse   (não chama o provedor de IA; não consome cota)
 *   POST /recommend  -> AiRecommendResponse | AiErrorBody
 */
import { AI_LIMITS } from './ai-contract.ts'
import { createAiService, type AiEnv, type AiServiceOptions } from './ai-core.ts'

export interface AiHttpOptions extends AiServiceOptions {
  /** Origem permitida para CORS (ex.: https://prainha.com.br). Padrão "*". */
  allowedOrigin?: string
  /** Remove o prefixo da rota (ex.: /^.*\/ai-assistant/ ou /^\/api\/ai/). */
  stripPrefix?: RegExp
  /** Identifica o cliente para o limite por minuto (ex.: IP). Sem função, o limite não é aplicado. */
  clientKey?: (req: Request) => string | null
  /** Máximo de consultas por cliente por minuto. Padrão 10. */
  perMinute?: number
  log?: (line: string) => void
}

export function createAiHandler(env: AiEnv, opts: AiHttpOptions = {}): (req: Request) => Promise<Response> {
  const service = createAiService(env, opts)
  const now = opts.now ?? Date.now
  const perMinute = opts.perMinute ?? 10
  const hits = new Map<string, number[]>()
  const log = opts.log ?? (() => {})

  const cors = {
    'Access-Control-Allow-Origin': opts.allowedOrigin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    Vary: 'Origin',
  }
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  const fail = (status: number, code: string, message: string) => json(status, { error: { code, message } })

  function limited(key: string): boolean {
    const t = now()
    const recent = (hits.get(key) ?? []).filter((x) => t - x < 60_000)
    recent.push(t)
    hits.set(key, recent)
    if (hits.size > 5000) hits.clear() // evita crescimento ilimitado em instâncias de longa duração
    return recent.length > perMinute
  }

  return async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    const path = new URL(req.url).pathname.replace(opts.stripPrefix ?? /^$/, '') || '/'

    if (req.method === 'GET' && path === '/health') {
      const r = service.health()
      return json(r.status, r.body)
    }

    if (req.method === 'POST' && path === '/recommend') {
      const key = opts.clientKey?.(req)
      if (key && limited(key)) {
        return fail(429, 'rate_limited', `Limite de ${perMinute} consultas por minuto atingido. Aguarde um pouco.`)
      }
      const declared = Number(req.headers.get('content-length') ?? 0)
      if (declared > AI_LIMITS.maxBodyBytes) return fail(413, 'invalid_request', 'Requisição grande demais.')
      const text = await req.text()
      if (new TextEncoder().encode(text).length > AI_LIMITS.maxBodyBytes) {
        return fail(413, 'invalid_request', 'Requisição grande demais.')
      }
      let body: unknown
      try {
        body = JSON.parse(text)
      } catch {
        return fail(400, 'invalid_request', 'JSON inválido.')
      }
      const r = await service.recommend(body)
      log(`[ai] ${new Date(now()).toISOString()} recommend -> ${r.status}${r.logDetail ? ` · ${r.logDetail}` : ''}`)
      return json(r.status, r.body)
    }

    return fail(404, 'invalid_request', 'Rota não encontrada.')
  }
}
