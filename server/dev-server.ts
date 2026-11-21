/**
 * Servidor local do backend de IA (desenvolvimento).
 *
 * Execução:  npm run server        (Node 24+, executa TypeScript nativamente; sem dependências)
 * Porta:     AI_SERVER_PORT (padrão 8787). O Vite encaminha /api -> este servidor (vite.config.ts).
 *
 * Variáveis (arquivo .env na raiz, NUNCA versionado — ver .env.example):
 *   GEMINI_API_KEY   chave do Google AI Studio (projeto SEM faturamento) — obrigatória para o assistente
 *   AI_MODEL         opcional; padrão gemini-3.5-flash-lite (somente modelos gratuitos)
 *   AI_DAILY_LIMIT   opcional; padrão 40 consultas por dia
 *
 * Rotas:
 *   GET  /api/ai/health      (não chama a IA)
 *   POST /api/ai/recommend
 *
 * Converte a requisição do Node em Request padrão e delega para a mesma camada usada pela Edge Function e
 * pelo Cloudflare Worker (supabase/functions/_shared/ai-http.ts).
 */
import { createServer, type IncomingMessage } from 'node:http'
import { existsSync } from 'node:fs'
import { AI_LIMITS } from '../supabase/functions/_shared/ai-contract.ts'
import { createAiHandler } from '../supabase/functions/_shared/ai-http.ts'

if (existsSync('.env')) process.loadEnvFile('.env')

const PORT = Number(process.env.AI_SERVER_PORT ?? 8787)
const IP_HEADER = 'x-prainha-client-ip'

const handler = createAiHandler(process.env, {
  stripPrefix: /^\/api\/ai/,
  clientKey: (req) => req.headers.get(IP_HEADER),
  log: (line) => console.log(line),
})

function readBody(req: IncomingMessage): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > AI_LIMITS.maxBodyBytes) {
        resolve(null)
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

const server = createServer(async (req, res) => {
  try {
    const method = req.method ?? 'GET'
    const headers = new Headers()
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === 'string' && k !== IP_HEADER) headers.set(k, v)
    }
    headers.set(IP_HEADER, req.socket.remoteAddress ?? 'local')

    let body: Buffer | null = null
    if (method !== 'GET' && method !== 'HEAD') {
      body = await readBody(req)
      if (body === null) {
        res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: { code: 'invalid_request', message: 'Requisição grande demais.' } }))
        return
      }
    }
    const request = new Request(`http://localhost${req.url ?? '/'}`, {
      method,
      headers,
      body: body ? new Uint8Array(body) : undefined,
    })
    const response = await handler(request)
    res.writeHead(response.status, Object.fromEntries(response.headers))
    res.end(Buffer.from(await response.arrayBuffer()))
  } catch (e) {
    console.error('[ai] erro inesperado', e instanceof Error ? e.message : e)
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: { code: 'upstream_error', message: 'Erro inesperado no backend.' } }))
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[ai] Backend de IA em http://127.0.0.1:${PORT}`)
  console.log(
    `[ai] GEMINI_API_KEY ${process.env.GEMINI_API_KEY ? 'configurada' : 'AUSENTE — o assistente responderá "não configurado"'}`,
  )
})
