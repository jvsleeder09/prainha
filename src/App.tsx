import { Suspense, useEffect, useRef } from 'react'
import { Outlet, ScrollRestoration, useLocation } from 'react-router'
import { SiteFooter } from './components/SiteFooter.tsx'
import { SiteHeader } from './components/SiteHeader.tsx'
import { useCatalog } from './state/hooks.ts'
import { storageUnavailable } from './state/usePersistentState.ts'

function PageFallback() {
  return (
    <div className="container section page-loading" role="status">
      <span className="spinner" aria-hidden="true" /> Carregando…
    </div>
  )
}

/** Layout comum a todas as páginas: link de pular, avisos, cabeçalho, conteúdo e rodapé. */
export function App() {
  const { usingDemoData } = useCatalog()
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const first = useRef(true)

  // Ao trocar de rota, move o foco para o conteúdo principal (leitores de tela anunciam a nova página).
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    mainRef.current?.focus({ preventScroll: true })
  }, [location.pathname])

  return (
    <div className="app">
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      {usingDemoData && (
        <p className="demo-strip">Versão de demonstração · produtos, preços e ingredientes ilustrativos</p>
      )}
      {storageUnavailable && (
        <p className="demo-strip">
          Seu navegador está bloqueando o armazenamento local: favoritos, carrinho e preferências não serão salvos.
        </p>
      )}
      <SiteHeader />
      <main id="conteudo" ref={mainRef} tabIndex={-1}>
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <SiteFooter />
      <ScrollRestoration />
    </div>
  )
}
