# Prainha — Marmitas congeladas

Plataforma web da **Prainha** (marmitas congeladas, [@prainhanortemarmitas](https://www.instagram.com/prainhanortemarmitas/)):
catálogo com busca e filtros, preferências alimentares, recomendações justificadas, favoritos, histórico, tema
claro/escuro, carrinho com finalização pelo WhatsApp, assistente com IA (backend seguro) e painel administrativo.

> **Catálogo demonstrativo.** Os produtos, preços e ingredientes atuais são exemplos criados para demonstrar a
> plataforma (selo “Exemplo”). O cardápio real deve ser cadastrado pela Prainha no painel `/admin` ou no Supabase.

## Tecnologias

React 19 · Vite 8 · TypeScript 7 · React Router 8 · Three.js + React Three Fiber + Drei · GSAP · CSS3 (sem framework)
· LocalStorage · Supabase (planejado) · Google Gemini API (**plano gratuito**) via backend próprio, com `fetch`.

## Como executar

Requer **Node.js 24+**.

```bash
npm install
npm run dev          # http://localhost:5173
```

Para o assistente de IA (opcional):

```bash
cp .env.example .env               # preencha GEMINI_API_KEY (chave GRATUITA, projeto SEM faturamento)
npm run ai:check                   # confere a configuração, sem chamar a IA
npm run server                     # backend em http://127.0.0.1:8787 (o Vite encaminha /api)
```

O backend de IA não tem dependências (usa `fetch`). Orçamento do projeto: **R$ 0,00**. Só são aceitos modelos do
plano gratuito, e o site continua funcionando normalmente sem o assistente.

## Hospedagem (gratuita)

Preparada para o **Cloudflare Pages**: o site estático vem de `dist/`, e o backend de IA é uma Pages Function em
`functions/api/ai/[[path]].ts`, no mesmo domínio. A chave fica como *Secret* do projeto. **Ainda não publicado.**

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Checagem de tipos + build de produção (`dist/`) |
| `npm run preview` | Serve o build localmente |
| `npm run lint` | Oxlint |
| `npm test` | Testes unitários (executor nativo `node --test`) |
| `npm run test:e2e` | Testes no navegador (Chrome headless); requer `npm run preview -- --port 4173` em execução |
| `npm run server` | Backend local de IA |
| `npm run ai:check` | Confere a configuração da IA (sem rede); `-- --live` faz 1 consulta real gratuita |
| `npm run typecheck:server` | Checagem de tipos do backend (Node, Supabase Edge Function e Cloudflare Worker) |

## Rotas

| Rota | Página |
|---|---|
| `/` | Landing page com hero 3D |
| `/cardapio` | Catálogo: busca, filtros (na URL) e ordenação |
| `/cardapio/:slug` | Detalhes do produto |
| `/preferencias` | Preferências alimentares + recomendações justificadas |
| `/assistente` | Assistente com IA |
| `/favoritos` | Favoritos |
| `/historico` | Histórico de recomendações |
| `/carrinho` | Carrinho e envio pelo WhatsApp |
| `/admin` | Painel administrativo (modo local ou Supabase) |
