/**
 * Cloudflare Pages Function do assistente de IA (rotas /api/ai/*), publicada junto com o site no Cloudflare Pages.
 *
 * Mesmo domínio do frontend: o navegador chama /api/ai/health e /api/ai/recommend (padrão de src/services/aiClient.ts),
 * sem CORS e sem VITE_AI_ENDPOINT. Reaproveita a camada HTTP padrão (Request/Response) usada pelo servidor local.
 *
 * Segredo obrigatório (Pages > Settings > Variables and Secrets, tipo "Secret"/Encrypt): GEMINI_API_KEY.
 * Variáveis opcionais: AI_PROVIDER=gemini, AI_MODEL=gemini-3.5-flash-lite, AI_DAILY_LIMIT=40.
 *
 * Plano gratuito da Cloudflare: estas chamadas contam na cota diária de requisições de Workers (o site estático não).
 */
import { createAiHandler } from '../../../supabase/functions/_shared/ai-http.ts'

type Env = Record<string, string | undefined>

interface PagesContext {
  request: Request
  env: Env
}

let cached: { env: Env; handler: (req: Request) => Promise<Response> } | null = null

export function onRequest(context: PagesContext): Promise<Response> {
  if (!cached || cached.env !== context.env) {
    cached = {
      env: context.env,
      handler: createAiHandler(context.env, {
        // Só o próprio site (mesma origem) pode usar o backend pelo navegador.
        allowedOrigin: context.env.ALLOWED_ORIGIN || new URL(context.request.url).origin,
        stripPrefix: /^\/api\/ai/,
        clientKey: (r) => r.headers.get('cf-connecting-ip'),
        log: (line) => console.log(line),
      }),
    }
  }
  return cached.handler(context.request)
}
