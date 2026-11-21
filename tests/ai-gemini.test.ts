/**
 * Testes LOCAIS do backend de IA (Gemini) com fetch SIMULADO.
 * Nenhum teste acessa a internet ou a API real. Passar aqui NÃO significa que a integração real foi validada
 * (ver docs/TESTES.md, seção "Validação real").
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAiService, pacificDay } from '../supabase/functions/_shared/ai-core.ts'
import { createAiHandler } from '../supabase/functions/_shared/ai-http.ts'
import { findHealthTerm, findPersonalData, redactPersonalData } from '../supabase/functions/_shared/ai-privacy.ts'
import { GEMINI_API_BASE, classifyGeminiError } from '../supabase/functions/_shared/providers/gemini.ts'
import type { FetchLike } from '../supabase/functions/_shared/ai-provider.ts'
import { buildAiRequest } from '../src/domain/aiPayload.ts'
import { DEMO_CATEGORIES, DEMO_PRODUCTS } from '../src/data/demoCatalog.ts'
import { EMPTY_PREFERENCES } from '../src/domain/options.ts'

const KEY = 'AIzaFAKE-chave-de-teste-0000000000'
const ENV = { GEMINI_API_KEY: KEY }

interface Call {
  url: string
  init: RequestInit
  body: Record<string, any>
}

function mockFetch(responses: Array<{ status: number; body: unknown; headers?: Record<string, string> }>) {
  const calls: Call[] = []
  const impl: FetchLike = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(String(init.body)) })
    const r = responses[Math.min(calls.length - 1, responses.length - 1)]
    return new Response(JSON.stringify(r.body), { status: r.status, headers: r.headers })
  }
  return { impl, calls }
}

const okBody = (obj: unknown) => ({
  candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] }, finishReason: 'STOP' }],
  modelVersion: 'gemini-3.5-flash-lite',
})

function payload(message = 'Quero algo leve com frango') {
  const r = buildAiRequest(message, null, DEMO_PRODUCTS, DEMO_CATEGORIES)
  assert.ok(r.ok)
  return r.request
}

test('sem chave: desativado, sem nenhuma chamada externa', async () => {
  const { impl, calls } = mockFetch([{ status: 200, body: {} }])
  const s = createAiService({}, { fetch: impl })
  const h = s.health().body
  assert.ok('configured' in h && h.configured === false && h.reason?.includes('GEMINI_API_KEY'))
  const r = await s.recommend(payload())
  assert.equal(r.status, 503)
  assert.equal(calls.length, 0)
})

test('modelo fora da lista gratuita é recusado (sem troca automática de modelo)', async () => {
  const { impl, calls } = mockFetch([{ status: 200, body: {} }])
  for (const model of ['gemini-4-carbon', 'gemini-3.1-pro-preview', 'claude-opus-5-5']) {
    const s = createAiService({ ...ENV, AI_MODEL: model }, { fetch: impl })
    const h = s.health().body
    assert.ok('configured' in h && !h.configured, model)
    assert.equal((await s.recommend(payload())).status, 503)
  }
  assert.equal(calls.length, 0)
})

test('health não chama a IA e informa provedor e modelo padrão', () => {
  const { impl, calls } = mockFetch([{ status: 200, body: {} }])
  const h = createAiService(ENV, { fetch: impl }).health().body
  assert.ok('configured' in h)
  assert.equal(h.configured, true)
  assert.equal(h.model, 'gemini-3.5-flash-lite')
  assert.match(String(h.provider), /Gemini/)
  assert.equal(calls.length, 0)
})

test('requisição: endpoint, chave só no cabeçalho, schema com enum do catálogo', async () => {
  const { impl, calls } = mockFetch([{ status: 200, body: okBody({ resumo: 'ok', recomendacoes: [] }) }])
  const req = payload()
  await createAiService(ENV, { fetch: impl }).recommend(req)
  assert.equal(calls.length, 1)
  const c = calls[0]
  assert.equal(c.url, `${GEMINI_API_BASE}/models/gemini-3.5-flash-lite:generateContent`)
  assert.ok(!c.url.includes(KEY), 'a chave não pode ir na URL')
  assert.equal((c.init.headers as Record<string, string>)['x-goog-api-key'], KEY)
  assert.ok(!JSON.stringify(c.body).includes(KEY))
  const schema = c.body.generationConfig.responseFormat.text.schema
  assert.equal(c.body.generationConfig.responseFormat.text.mimeType, 'APPLICATION_JSON')
  assert.deepEqual(schema.properties.recomendacoes.items.properties.produtoId.enum, req.catalog.map((p) => p.id))
  assert.match(c.body.systemInstruction.parts[0].text, /SOMENTE produtos presentes no catálogo/)
})

test('formato alternativo responseJsonSchema', async () => {
  const { impl, calls } = mockFetch([{ status: 200, body: okBody({ resumo: '', recomendacoes: [] }) }])
  await createAiService({ ...ENV, GEMINI_STRUCTURED_OUTPUT: 'responseJsonSchema' }, { fetch: impl }).recommend(payload())
  const g = calls[0].body.generationConfig
  assert.equal(g.responseMimeType, 'application/json')
  assert.ok(g.responseJsonSchema && !g.responseFormat)
})

test('resposta: descarta ids fora do catálogo e duplicados', async () => {
  const id = DEMO_PRODUCTS.find((p) => p.available)!.id
  const { impl } = mockFetch([
    {
      status: 200,
      body: okBody({
        resumo: 'Sugestões',
        recomendacoes: [
          { produtoId: id, justificativa: 'Tem frango.' },
          { produtoId: id, justificativa: 'Repetido.' },
          { produtoId: 'inventado', justificativa: 'Não existe.' },
        ],
      }),
    },
  ])
  const r = await createAiService(ENV, { fetch: impl }).recommend(payload())
  assert.equal(r.status, 200)
  assert.ok('recommendations' in r.body)
  assert.deepEqual(r.body.recommendations, [{ productId: id, reason: 'Tem frango.' }])
  assert.equal(r.body.model, 'gemini-3.5-flash-lite')
})

test('429 por minuto: pausa e não chama de novo até o prazo (respeita RetryInfo)', async () => {
  let t = Date.parse('2026-11-21T15:00:00Z')
  const { impl, calls } = mockFetch([
    {
      status: 429,
      body: {
        error: {
          code: 429,
          status: 'RESOURCE_EXHAUSTED',
          message: 'You exceeded your current quota, please check your plan and billing details.',
          details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '30s' }],
        },
      },
    },
    { status: 200, body: okBody({ resumo: 'voltou', recomendacoes: [] }) },
  ])
  const s = createAiService(ENV, { fetch: impl, now: () => t })
  const r1 = await s.recommend(payload())
  assert.equal(r1.status, 429)
  assert.ok('error' in r1.body && r1.body.error.code === 'rate_limited')
  const r2 = await s.recommend(payload())
  assert.equal(r2.status, 429)
  assert.equal(calls.length, 1, 'durante a pausa não há nova chamada')
  t += 31_000
  assert.equal((await s.recommend(payload())).status, 200)
  assert.equal(calls.length, 2)
})

test('cota diária esgotada: pausa até a meia-noite do Pacífico', async () => {
  const t = Date.parse('2026-11-21T15:00:00Z')
  const { impl } = mockFetch([{ status: 429, body: { error: { code: 'quota_exceeded', message: 'daily quota' } } }])
  const s = createAiService(ENV, { fetch: impl, now: () => t })
  const r = await s.recommend(payload())
  assert.ok('error' in r.body && r.body.error.code === 'quota_exceeded')
  const h = s.health().body
  assert.ok('pausedUntil' in h && h.pausedUntil)
  assert.equal(Date.parse(h.pausedUntil!) - t, pacificDay(t).msUntilReset)
})

test('402 (faturamento): bloqueia o assistente por completo', async () => {
  const { impl, calls } = mockFetch([{ status: 402, body: { error: { code: 'payment_required', message: 'Prepay depleted' } } }])
  const s = createAiService(ENV, { fetch: impl })
  assert.equal((await s.recommend(payload())).status, 503)
  const h = s.health().body
  assert.ok('configured' in h && h.configured === false)
  await s.recommend(payload())
  assert.equal(calls.length, 1)
})

test('classificação de erros', () => {
  assert.equal(classifyGeminiError(400, { message: 'API key not valid. Please pass a valid API key.' }), 'auth')
  assert.equal(classifyGeminiError(403, { message: 'Permission denied' }), 'auth')
  assert.equal(classifyGeminiError(404, { message: 'models/x is not found' }), 'model_unavailable')
  assert.equal(classifyGeminiError(400, { message: 'Invalid JSON payload received. Unknown name "responseFormat"' }), 'bad_request')
  assert.equal(classifyGeminiError(503, {}), 'unavailable')
  // Mensagem 429 do plano gratuito cita "billing", mas é limite — não cobrança.
  assert.equal(classifyGeminiError(429, { message: 'check your plan and billing details' }), 'rate_limit')
})

test('bloqueio de segurança, resposta cortada e falha de rede', async () => {
  const cases: Array<[unknown, number, string]> = [
    [{ promptFeedback: { blockReason: 'SAFETY' } }, 422, 'refused'],
    [{ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"res' }] } }] }, 502, 'invalid_response'],
    [{ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'não é json' }] } }] }, 502, 'invalid_response'],
  ]
  for (const [body, status, code] of cases) {
    const { impl } = mockFetch([{ status: 200, body }])
    const r = await createAiService(ENV, { fetch: impl }).recommend(payload())
    assert.equal(r.status, status)
    assert.ok('error' in r.body && r.body.error.code === code)
  }
  const failing: FetchLike = async () => {
    throw new TypeError('fetch failed')
  }
  const r = await createAiService(ENV, { fetch: failing }).recommend(payload())
  assert.equal(r.status, 502)
})

test('limite diário local (AI_DAILY_LIMIT)', async () => {
  const { impl, calls } = mockFetch([{ status: 200, body: okBody({ resumo: '', recomendacoes: [] }) }])
  const s = createAiService({ ...ENV, AI_DAILY_LIMIT: '2' }, { fetch: impl })
  assert.equal((await s.recommend(payload())).status, 200)
  assert.equal((await s.recommend(payload())).status, 200)
  const r = await s.recommend(payload())
  assert.ok('error' in r.body && r.body.error.code === 'quota_exceeded')
  assert.equal(calls.length, 2)
  const off = createAiService({ ...ENV, AI_DAILY_LIMIT: '0' }).health().body
  assert.ok('configured' in off && !off.configured)
})

test('privacidade: detecção de dados pessoais e de saúde', () => {
  assert.deepEqual(findPersonalData('meu zap é (61) 99999-1234'), ['telefone ou documento'])
  assert.ok(findPersonalData('email fulano@exemplo.com').includes('e-mail'))
  assert.ok(findPersonalData('entrega na QNM 12 conjunto B').includes('endereço'))
  assert.ok(findPersonalData('meu nome é Ana').includes('nome'))
  assert.deepEqual(findPersonalData('algo até R$ 28,90 com frango'), [])
  assert.deepEqual(findPersonalData('um conjunto de 3 marmitas'), [])
  assert.equal(findHealthTerm('Sou diabético'), 'diabetico')
  assert.ok(findHealthTerm('tenho alergia a camarão'))
  assert.ok(findHealthTerm('estou grávida'))
  assert.equal(findHealthTerm('algo sem lactose e vegetariano'), null)
  assert.equal(findHealthTerm('prato médio com frango'), null)
  assert.equal(redactPersonalData('ligue 61999991234 por favor').text, 'ligue [removido] por favor')
})

test('servidor: termo de saúde é recusado e dado pessoal mascarado antes do envio', async () => {
  const { impl, calls } = mockFetch([{ status: 200, body: okBody({ resumo: '', recomendacoes: [] }) }])
  const s = createAiService(ENV, { fetch: impl })
  const base = payload()
  const r = await s.recommend({ ...base, message: 'sou celíaco, o que posso comer?' })
  assert.ok('error' in r.body && r.body.error.code === 'sensitive_content')
  assert.equal(calls.length, 0)
  await s.recommend({ ...base, message: 'frango, meu email é a@b.com' })
  const sent = calls[0].body.contents[0].parts[0].text as string
  assert.ok(!sent.includes('a@b.com') && sent.includes('[removido]'))
})

test('navegador: restrições filtradas localmente e não enviadas', () => {
  const prefs = { ...EMPTY_PREFERENCES, restrictions: ['sem-lactose' as const], avoidIngredients: ['cebola'], proteins: ['frango' as const] }
  const r = buildAiRequest('algo gostoso', prefs, DEMO_PRODUCTS, DEMO_CATEGORIES)
  assert.ok(r.ok)
  const json = JSON.stringify(r.request)
  assert.ok(!json.includes('sem-lactose') && !json.includes('restrictions') && !json.includes('avoidIngredients'))
  assert.ok(r.request.catalog.every((p) => !p.contains.includes('lactose')))
  assert.ok(r.request.catalog.every((p) => !p.ingredients.some((i) => i.toLowerCase().includes('cebola'))))
  assert.ok(r.locallyExcluded > 0)
  assert.deepEqual(r.request.preferences, { proteins: ['frango'], interests: [] })
  // Indisponíveis nunca vão.
  assert.ok(r.request.catalog.every((p) => DEMO_PRODUCTS.find((d) => d.id === p.id)!.available))
  // Bloqueio antes do envio.
  const blocked = buildAiRequest('sou hipertenso, quero algo', null, DEMO_PRODUCTS, DEMO_CATEGORIES)
  assert.ok(!blocked.ok && blocked.code === 'sensitive_content')
  assert.ok(!buildAiRequest('me liga 61 99999-1234', null, DEMO_PRODUCTS, DEMO_CATEGORIES).ok)
})

test('camada HTTP (Request/Response padrão): rotas, CORS, tamanho e limite por minuto', async () => {
  const handler = createAiHandler({}, { stripPrefix: /^\/api\/ai/, allowedOrigin: 'https://x.dev', clientKey: () => 'ip1', perMinute: 2 })
  const h = await handler(new Request('http://l/api/ai/health'))
  assert.equal(h.status, 200)
  assert.equal(h.headers.get('access-control-allow-origin'), 'https://x.dev')
  assert.equal((await handler(new Request('http://l/api/ai/nada'))).status, 404)
  assert.equal((await handler(new Request('http://l/api/ai/recommend', { method: 'OPTIONS' }))).status, 204)
  const post = (body: string) => handler(new Request('http://l/api/ai/recommend', { method: 'POST', body }))
  assert.equal((await post('{x')).status, 400)
  assert.equal((await post('{}')).status, 503) // sem chave: não configurado
  assert.equal((await post('{}')).status, 429) // 3ª no mesmo minuto
  const big = createAiHandler({}, { stripPrefix: /^\/api\/ai/ })
  const r = await big(new Request('http://l/api/ai/recommend', { method: 'POST', body: 'x'.repeat(70 * 1024) }))
  assert.equal(r.status, 413)
})

test('Cloudflare Pages Function: rotas /api/ai/* e CORS restrito à mesma origem', async () => {
  const { onRequest } = await import('../functions/api/ai/[[path]].ts')
  const env = {}
  const h = await onRequest({ request: new Request('https://prainha.pages.dev/api/ai/health'), env })
  assert.equal(h.status, 200)
  assert.equal(h.headers.get('access-control-allow-origin'), 'https://prainha.pages.dev')
  const body = await h.json()
  assert.equal(body.configured, false)
  const r = await onRequest({
    request: new Request('https://prainha.pages.dev/api/ai/recommend', { method: 'POST', body: JSON.stringify(payload()) }),
    env,
  })
  assert.equal(r.status, 503) // sem GEMINI_API_KEY: não configurado, sem chamada externa
})
