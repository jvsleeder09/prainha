/**
 * Supabase Edge Function: ai-assistant (Deno).
 *
 * Rotas (relativas a /functions/v1/ai-assistant):
 *   GET  /health     -> { configured, provider, model, ... }   (não chama a IA)
 *   POST /recommend  -> AiRecommendResponse | AiErrorBody
 *
 * Segredos (configurar com `supabase secrets set`; nunca no frontend):
 *   GEMINI_API_KEY      obrigatório — chave de um projeto do Google AI Studio SEM faturamento
 *   AI_MODEL            opcional; padrão gemini-3.5-flash-lite (somente modelos gratuitos permitidos)
 *   AI_DAILY_LIMIT      opcional; padrão 40 consultas/dia por instância
 *   ALLOWED_ORIGIN      opcional; origem do site para CORS (ex.: https://prainha.com.br)
 *
 * Sem dependências: usa apenas fetch e APIs web padrão.
 * ESTADO: preparada, não implantada (o projeto Supabase ainda não existe). Ver docs/SUPABASE.md.
 */
import { createAiHandler } from '../_shared/ai-http.ts'

declare const Deno: {
  env: { toObject(): Record<string, string> }
  serve(handler: (req: Request) => Response | Promise<Response>): void
}

const env = Deno.env.toObject()

const handler = createAiHandler(env, {
  allowedOrigin: env.ALLOWED_ORIGIN,
  stripPrefix: /^.*\/ai-assistant/,
  clientKey: (req) => req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
  log: (line) => console.log(line),
})

Deno.serve(handler)
