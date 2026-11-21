/**
 * Verificação do assistente de IA.
 *
 *   npm run ai:check              -> confere a configuração do .env SEM acessar a internet (nenhuma chamada à IA)
 *   npm run ai:check -- --live    -> VALIDAÇÃO REAL: faz UMA consulta ao Gemini com o catálogo demonstrativo
 *
 * A consulta real usa a cota gratuita (não gera cobrança se a chave for de um projeto SEM faturamento).
 * Execute-a apenas quando quiser validar a integração; o resultado deve ser registrado em docs/TESTES.md.
 */
import { existsSync } from 'node:fs'
import { createAiService } from '../supabase/functions/_shared/ai-core.ts'
import { DEMO_CATEGORIES, DEMO_PRODUCTS } from '../src/data/demoCatalog.ts'
import { buildAiRequest } from '../src/domain/aiPayload.ts'

if (existsSync('.env')) process.loadEnvFile('.env')

const live = process.argv.includes('--live')
const service = createAiService(process.env)
const health = service.health().body

console.log('Configuração:', JSON.stringify(health, null, 2))
if (!('configured' in health) || !health.configured) {
  console.log('\nAssistente NÃO configurado. Veja docs/SUPABASE.md, seção "Assistente de IA".')
  process.exit(1)
}
if (!live) {
  console.log('\nConfiguração OK (verificação local, sem chamada à IA).')
  console.log('Para a validação real (1 consulta gratuita): npm run ai:check -- --live')
  process.exit(0)
}

const payload = buildAiRequest('Quero algo leve com frango para o almoço', null, DEMO_PRODUCTS, DEMO_CATEGORIES)
if (!payload.ok) throw new Error(payload.message)

console.log('\nValidação real: enviando 1 consulta ao provedor…')
const started = Date.now()
const result = await service.recommend(payload.request)
console.log(`HTTP ${result.status} em ${Date.now() - started} ms`)
if (result.logDetail) console.log('Detalhe:', result.logDetail)
console.log(JSON.stringify(result.body, null, 2))
// exitCode em vez de process.exit(): deixa a conexão HTTP fechar sozinha (process.exit imediato após fetch
// provoca uma falha interna do libuv no Windows).
process.exitCode = result.status === 200 ? 0 : 1
