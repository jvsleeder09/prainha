/**
 * Cloudflare Worker do backend de IA (opção futura de implantação; NÃO implantado).
 *
 * Reaproveita a mesma camada HTTP (Request/Response padrão) usada pelo servidor local e pela Edge Function.
 * Rotas: GET /api/ai/health e POST /api/ai/recommend (o prefixo /api/ai é opcional).
 *
 * Segredos (no painel da Cloudflare ou `wrangler secret put GEMINI_API_KEY`; nunca no frontend):
 *   GEMINI_API_KEY, AI_MODEL, AI_DAILY_LIMIT, ALLOWED_ORIGIN — ver docs/SUPABASE.md, seção "Cloudflare Workers".
 *
 * Observação: o plano gratuito da Cloudflare Workers tem limites próprios; a implantação exige a CLI `wrangler`,
 * que NÃO foi instalada (precisa de autorização). Modelo de configuração: cloudflare/wrangler.toml.example.
 */
import { createAiHandler } from '../supabase/functions/_shared/ai-http.ts'

type WorkerEnv = Record<string, string | undefined>

let cached: { env: WorkerEnv; handler: (req: Request) => Promise<Response> } | null = null

export default {
  fetch(req: Request, env: WorkerEnv): Promise<Response> {
    // O objeto env é estável por instância; o handler (com seus limites em memória) é criado uma vez.
    if (!cached || cached.env !== env) {
      cached = {
        env,
        handler: createAiHandler(env, {
          allowedOrigin: env.ALLOWED_ORIGIN,
          stripPrefix: /^\/api\/ai/,
          clientKey: (r) => r.headers.get('cf-connecting-ip'),
          log: (line) => console.log(line),
        }),
      }
    }
    return cached.handler(req)
  },
}
