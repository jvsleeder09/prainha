/**
 * Testes de ponta a ponta no navegador real (Chrome headless via CDP).
 *
 * Pré-requisitos:
 *   1. npm run build && npx vite preview --port 4173
 *   2. npm run test:e2e
 * Variáveis opcionais: BASE_URL (padrão http://localhost:4173) e CHROME_PATH.
 * Capturas de tela: SCREENSHOTS=1 grava em docs/screenshots/.
 */
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { Browser } from './cdp.ts'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173'
const CHROME =
  process.env.CHROME_PATH ??
  ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find(
    (p) => existsSync(p),
  ) ??
  'chrome'
const SHOTS = process.env.SCREENSHOTS === '1'
const TEST_PHONE = '5599999999999' // número fictício usado SOMENTE no teste

let b: Browser

const ls = (key: string) => b.eval<string | null>(`localStorage.getItem('prainha:v1:${key}')`)
const resetStorage = () => b.eval('localStorage.clear(); sessionStorage.clear(); true')

async function shot(name: string, fullPage = false) {
  if (!SHOTS) return
  mkdirSync('docs/screenshots', { recursive: true })
  if (fullPage) {
    // rola a página inteira para disparar as animações de entrada (GSAP) antes da captura
    await b.eval(`(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)) } return true })()`)
    await new Promise((r) => setTimeout(r, 900))
    await b.eval('window.scrollTo(0, 0); document.activeElement?.blur?.(); true')
    await new Promise((r) => setTimeout(r, 300))
  }
  writeFileSync(`docs/screenshots/${name}.png`, await b.screenshot(fullPage))
}

before(async () => {
  b = await Browser.launch(CHROME)
  await b.viewport(1366, 900)
})

after(async () => {
  await b?.close()
})

describe('rotas', () => {
  const routes: Array<[string, RegExp]> = [
    ['/', /Comida de casa/],
    ['/cardapio', /Nossas marmitas/],
    ['/cardapio/frango-grelhado-com-legumes', /Frango grelhado com legumes/],
    ['/preferencias', /Encontre a marmita certa/],
    ['/assistente', /Diga o que você quer comer/],
    ['/favoritos', /Suas marmitas favoritas/],
    ['/historico', /Suas recomendações anteriores/],
    ['/carrinho', /Seu pedido/],
    ['/admin', /Painel da Prainha/],
    ['/rota-que-nao-existe', /Essa página foi para a praia/],
    ['/cardapio/produto-inexistente', /Marmita não encontrada/],
  ]
  for (const [path, title] of routes) {
    test(`${path} renderiza o título esperado`, async () => {
      await b.goto(BASE + path)
      await b.waitUntil(`document.querySelector('h1, .empty h2')`)
      const text = await b.eval<string>(`(document.querySelector('main h1') ?? document.querySelector('.empty h2')).textContent`)
      assert.match(text.replace(/\s+/g, ' '), title)
      assert.equal(await b.eval<number>(`document.querySelectorAll('h1').length`) <= 1, true, 'no máximo um h1')
    })
  }
  test('navegação pelo menu sem recarregar a página', async () => {
    await b.goto(BASE + '/')
    await b.eval(`window.__marker = 1`)
    await b.click('.main-nav a[href="/cardapio"]')
    await b.waitUntil(`location.pathname === '/cardapio'`)
    assert.equal(await b.eval<number>('window.__marker'), 1, 'SPA: a janela não foi recarregada')
  })
  test('nenhum erro de JavaScript nas rotas', () => {
    assert.deepEqual(b.consoleErrors.filter((e) => !/api\/ai|Failed to load resource|502|500/.test(e)), [])
  })
})

describe('tema claro/escuro', () => {
  test('alterna e persiste no LocalStorage após recarregar', async () => {
    await b.goto(BASE + '/')
    await resetStorage()
    await b.reload()
    const initial = await b.eval<string>('document.documentElement.dataset.theme')
    await b.click('.header-actions .icon-btn:first-child')
    const toggled = await b.eval<string>('document.documentElement.dataset.theme')
    assert.notEqual(toggled, initial)
    assert.equal(await ls('theme'), JSON.stringify(toggled))
    await b.reload()
    assert.equal(await b.eval<string>('document.documentElement.dataset.theme'), toggled)
    await b.click('.header-actions .icon-btn:first-child')
    assert.equal(await b.eval<string>('document.documentElement.dataset.theme'), initial)
  })
})

describe('favoritos', () => {
  test('adiciona, persiste, lista e remove', async () => {
    await b.goto(BASE + '/cardapio')
    await resetStorage()
    await b.reload()
    await b.click('.product-card .fav-btn')
    assert.equal(await b.eval<string>(`document.querySelector('.product-card .fav-btn').getAttribute('aria-pressed')`), 'true')
    const favs = JSON.parse((await ls('favorites')) ?? '[]') as string[]
    assert.equal(favs.length, 1)
    await b.goto(BASE + '/favoritos')
    assert.equal(await b.eval<number>(`document.querySelectorAll('.product-card').length`), 1)
    if (SHOTS) await new Promise((r) => setTimeout(r, 1500)) // aguarda a animação de entrada do cartão
    await shot('favoritos')
    await b.click('.product-card .fav-btn')
    await b.waitUntil(`document.querySelector('.empty')`)
    assert.equal(await ls('favorites'), '[]')
  })
})

describe('preferências, recomendação e histórico', () => {
  test('recomenda sem lactose com frango, justifica e registra no histórico', async () => {
    await b.goto(BASE + '/preferencias')
    await resetStorage()
    await b.reload()
    await b.click('input[name="restricoes"][value="sem-lactose"]')
    await b.click('input[name="proteinas"][value="frango"]')
    await b.click('.prefs__form button[type="submit"]')
    await b.waitFor('.rec-item')
    const names = await b.eval<string[]>(`[...document.querySelectorAll('.rec-item .product-card__title')].map(e => e.textContent)`)
    assert.ok(names.length > 0)
    assert.ok(!names.includes('Strogonoff de frango'), 'strogonoff tem lactose e não pode aparecer')
    assert.equal(names[0], 'Frango grelhado com legumes')
    const reasons = await b.eval<string>(`document.querySelector('.rec-item .reasons').textContent`)
    assert.match(reasons, /frango/)
    const prefs = JSON.parse((await ls('preferences')) ?? '{}') as { restrictions: string[] }
    assert.deepEqual(prefs.restrictions, ['sem-lactose'])
    const hist = JSON.parse((await ls('history')) ?? '[]') as unknown[]
    assert.equal(hist.length, 1)
    await shot('preferencias-recomendacoes', true)

    await b.goto(BASE + '/historico')
    assert.equal(await b.eval<number>(`document.querySelectorAll('.history__item').length`), 1)
    await shot('historico')
    await b.click('.history__item .btn')
    await b.waitUntil(`location.pathname === '/preferencias'`)
    assert.equal(await b.eval<boolean>(`document.querySelector('input[value="sem-lactose"]').checked`), true)
  })
})

describe('carrinho e WhatsApp', () => {
  test('adiciona, altera quantidade, calcula total e remove', async () => {
    await b.goto(BASE + '/cardapio/frango-grelhado-com-legumes')
    await resetStorage()
    await b.reload()
    await b.click('.product-detail__buy .btn')
    assert.deepEqual(JSON.parse((await ls('cart')) ?? '[]'), [{ productId: 'demo-frango-legumes', quantity: 1 }])
    await b.goto(BASE + '/carrinho')
    await b.click('.cart-line .qty button[aria-label="Aumentar quantidade"]')
    await b.waitUntil(`document.querySelector('.receipt__total dd').textContent.includes('49,80')`)
    assert.equal(await b.eval<string>(`document.querySelector('.cart-count').textContent`), '2')
    await b.click('.cart-line > .icon-btn')
    await b.waitUntil(`document.querySelector('.empty')`)
    assert.equal(await ls('cart'), '[]')
  })

  test('sem número configurado mostra aviso e não gera link', async () => {
    await b.eval(`localStorage.setItem('prainha:v1:cart', JSON.stringify([{productId:'demo-tilapia',quantity:1}])); true`)
    await b.goto(BASE + '/carrinho')
    assert.equal(await b.eval<boolean>(`!!document.querySelector('.btn--whatsapp')`), false)
    assert.match(await b.eval<string>(`document.querySelector('.receipt').textContent`), /ainda não foi configurado/)
  })

  test('com número configurado gera link wa.me com a mensagem estruturada', async () => {
    await b.eval(
      `localStorage.setItem('prainha:v1:admin-business', JSON.stringify({whatsappNumber:'${TEST_PHONE}'})); localStorage.setItem('prainha:v1:cart', JSON.stringify([{productId:'demo-tilapia',quantity:2},{productId:'demo-bowl-vegano',quantity:1}])); true`,
    )
    await b.goto(BASE + '/carrinho')
    await b.type('#nome', 'Cliente Teste')
    await b.waitUntil(`document.querySelector('.btn--whatsapp').getAttribute('href')`)
    const href = await b.eval<string>(`document.querySelector('.btn--whatsapp').getAttribute('href')`)
    assert.ok(href.startsWith(`https://wa.me/${TEST_PHONE}?text=`))
    const text = decodeURIComponent(href.split('text=')[1])
    assert.match(text, /2x Tilápia com purê de abóbora/)
    assert.match(text, /1x Bowl de grão-de-bico e legumes/)
    assert.match(text, /Total dos produtos: R\$\s87,70/)
    assert.match(text, /Nome: Cliente Teste/)
    await shot('carrinho', true)
    await resetStorage()
  })
})

describe('robustez do LocalStorage', () => {
  test('dados corrompidos não quebram a aplicação e são redefinidos', async () => {
    await b.goto(BASE + '/')
    await b.eval(
      `localStorage.setItem('prainha:v1:cart','{quebrado'); localStorage.setItem('prainha:v1:favorites','"x"'); localStorage.setItem('prainha:v1:theme','"roxo"'); true`,
    )
    await b.goto(BASE + '/carrinho')
    await b.waitFor('.empty')
    await b.waitUntil(`document.querySelector('.toast')?.textContent.includes('inválidos')`)
    assert.equal(await ls('cart'), null)
    assert.equal(await ls('favorites'), null)
    await resetStorage()
  })
})

describe('assistente de IA', () => {
  test('sem backend/chave mostra indisponibilidade em vez de simular resposta', async () => {
    await b.goto(BASE + '/assistente')
    await b.waitUntil(`document.querySelector('.assistant__status .notice')`, 12000)
    const txt = await b.eval<string>(`document.querySelector('.assistant__status').textContent`)
    assert.match(txt, /Assistente indisponível/)
    assert.equal(await b.eval<boolean>(`document.querySelector('.assistant__form button[type=submit]').disabled`), true)
    await shot('assistente-indisponivel')
  })
})

describe('admin (modo local)', () => {
  test('cria produto, aparece no cardápio e altera disponibilidade', async () => {
    await b.goto(BASE + '/admin')
    await resetStorage()
    await b.reload()
    await b.waitFor('.admin .notice')
    assert.match(await b.eval<string>(`document.querySelector('.admin .notice').textContent`), /Modo local/)
    await b.eval(`[...document.querySelectorAll('.admin button')].find(x => x.textContent === 'Novo produto').click(); true`)
    await b.waitFor('.admin-form')
    await b.type('.admin-form input[id$="-name"]', 'Produto de teste E2E')
    await b.type('.admin-form input[id$="-price"]', '19,90')
    await b.eval(`[...document.querySelectorAll('.admin-form button')].find(x => x.textContent.includes('Salvar')).click(); true`)
    await b.waitUntil(`[...document.querySelectorAll('.admin td a')].some(a => a.textContent === 'Produto de teste E2E')`)
    await b.goto(BASE + '/cardapio?busca=teste')
    assert.match(await b.eval<string>(`document.querySelector('.product-card__title').textContent`), /Produto de teste E2E/)
    assert.match(await b.eval<string>(`document.querySelector('.product-card__footer .btn').textContent`), /Adicionar/)
    await b.goto(BASE + '/admin')
    await b.waitFor('.admin table')
    await shot('admin')
    // desmarca "Disponível" na linha do produto criado
    await b.eval(`[...document.querySelectorAll('.admin tr')].find(tr => tr.textContent.includes('Produto de teste E2E')).querySelector('.switch input').click(); true`)
    await b.waitUntil(`JSON.parse(localStorage.getItem('prainha:v1:admin-products')).find(p => p.name === 'Produto de teste E2E').available === false`)
    await b.goto(BASE + '/cardapio?busca=teste')
    assert.match(await b.eval<string>(`document.querySelector('.product-card__footer .btn').textContent`), /Esgotado/)
    await resetStorage()
  })
})

describe('responsividade e acessibilidade', () => {
  const paths = ['/', '/cardapio', '/cardapio/tilapia-com-pure-de-abobora', '/preferencias', '/carrinho', '/assistente', '/admin', '/historico', '/favoritos']
  for (const w of [360, 768, 1366]) {
    test(`sem rolagem horizontal em ${w}px`, async () => {
      await b.viewport(w, 900, w < 768)
      for (const p of paths) {
        await b.goto(BASE + p)
        const overflow = await b.eval<number>('document.documentElement.scrollWidth - document.documentElement.clientWidth')
        assert.ok(overflow <= 1, `${p} transborda ${overflow}px em ${w}px`)
      }
      await b.viewport(1366, 900)
    })
  }

  test('auditoria básica: lang, rótulos, nomes acessíveis e imagens', async () => {
    const problems: string[] = []
    for (const p of paths) {
      await b.goto(BASE + p)
      const r = await b.eval<string[]>(`(() => {
        const out = [];
        if (document.documentElement.lang !== 'pt-BR') out.push('lang');
        document.querySelectorAll('input:not([type=hidden]), select, textarea').forEach(el => {
          if (!(el.labels && el.labels.length) && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')) out.push('campo sem rótulo: ' + (el.id || el.name || el.type));
        });
        document.querySelectorAll('button, a[href]').forEach(el => {
          const name = (el.getAttribute('aria-label') || el.textContent || el.title || '').trim();
          if (!name) out.push('controle sem nome: ' + el.outerHTML.slice(0, 80));
        });
        document.querySelectorAll('svg[role=img]').forEach(el => { if (!el.getAttribute('aria-label')) out.push('svg sem aria-label') });
        if (!document.querySelector('main')) out.push('sem main');
        if (!document.querySelector('.skip-link')) out.push('sem skip link');
        return out })()`)
      problems.push(...r.map((x) => `${p}: ${x}`))
    }
    assert.deepEqual(problems, [])
  })

  test('navegação por teclado: o primeiro Tab foca o link "Pular para o conteúdo"', async () => {
    await b.goto(BASE + '/')
    await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    assert.equal(await b.eval<string>('document.activeElement.className'), 'skip-link')
  })
})

describe('hero 3D e movimento reduzido', () => {
  test('com prefers-reduced-motion usa a versão estática', async () => {
    await b.media([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    await b.goto(BASE + '/')
    await b.waitFor('.hero-fallback')
    assert.equal(await b.eval<boolean>(`!!document.querySelector('.hero canvas')`), false)
    assert.match(await b.eval<string>(`document.querySelector('.hero__visual-note').textContent`), /Movimento reduzido/)
    await b.media([])
  })

  test('sem preferência de movimento: tenta a cena 3D quando há WebGL', async () => {
    await b.goto(BASE + '/')
    const webgl = await b.eval<boolean>(`(() => { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')) })()`)
    if (!webgl) {
      await b.waitFor('.hero-fallback')
      return
    }
    await b.waitFor('.hero canvas', 15000)
    assert.ok(true)
  })

  test('capturas de tela da página inicial (claro, escuro e celular)', async () => {
    if (!SHOTS) return
    await b.goto(BASE + '/')
    await b.eval(`localStorage.setItem('prainha:v1:theme','"light"'); true`)
    await b.reload()
    await new Promise((r) => setTimeout(r, 3500))
    await shot('home-desktop-claro')
    await b.eval(`localStorage.setItem('prainha:v1:theme','"dark"'); true`)
    await b.reload()
    await new Promise((r) => setTimeout(r, 3500))
    await shot('home-desktop-escuro')
    await b.eval(`localStorage.setItem('prainha:v1:theme','"light"'); true`)
    await b.viewport(390, 844, true)
    await b.goto(BASE + '/')
    await new Promise((r) => setTimeout(r, 3000))
    await shot('home-celular')
    await b.goto(BASE + '/cardapio')
    await new Promise((r) => setTimeout(r, 1500))
    await shot('cardapio-celular')
    await b.viewport(1366, 900)
    await b.goto(BASE + '/cardapio')
    await new Promise((r) => setTimeout(r, 1500))
    await shot('cardapio-desktop')
    await b.goto(BASE + '/cardapio/tilapia-com-pure-de-abobora')
    await new Promise((r) => setTimeout(r, 800))
    await shot('produto-desktop', true)
    await b.goto(BASE + '/')
    await new Promise((r) => setTimeout(r, 3500))
    await shot('home-pagina-inteira-claro', true)
    await b.eval(`localStorage.removeItem('prainha:v1:theme'); true`)
  })
})

describe('desempenho (medição local)', () => {
  test('métricas de carregamento da página inicial (sem cache)', async () => {
    await b.send('Network.enable')
    await b.send('Network.setCacheDisabled', { cacheDisabled: true })
    await b.goto(BASE + '/')
    await new Promise((r) => setTimeout(r, 2500))
    const m = await b.eval<{ dcl: number; load: number; fcp: number; jsKB: number; requests: number }>(`(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const fcp = performance.getEntriesByName('first-contentful-paint')[0];
      const res = performance.getEntriesByType('resource');
      const js = res.filter(r => r.name.endsWith('.js')).reduce((s, r) => s + (r.encodedBodySize || 0), 0);
      return { dcl: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd), fcp: Math.round(fcp ? fcp.startTime : -1), jsKB: Math.round(js / 1024), requests: res.length };
    })()`)
    console.log('MÉTRICAS', JSON.stringify(m))
    assert.ok(m.fcp > 0)
  })
})
