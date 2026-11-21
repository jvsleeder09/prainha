import { Component, Suspense, lazy, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { gsap } from 'gsap'
import { ArrowIcon, SparkleIcon } from '../../components/icons.tsx'
import { useParallax } from '../../hooks/useReveal.ts'
import { decideHeroVisual, supportsWebGL, type HeroVisualReason } from './capabilities.ts'
import { HeroFallback } from './HeroFallback.tsx'

const HeroScene = lazy(() => import('./HeroScene.tsx'))

/** Se a cena 3D falhar (ex.: perda de contexto WebGL), mostra a versão leve. */
class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onError()
  }
  render() {
    return this.state.failed ? <HeroFallback /> : this.props.children
  }
}

const REASON_TEXT: Record<HeroVisualReason, string> = {
  'no-webgl': 'Seu navegador não oferece WebGL; exibindo a versão ilustrada.',
  'reduced-motion': 'Movimento reduzido ativado no sistema; exibindo a versão estática.',
  'low-power': 'Versão leve ativada para economizar bateria e dados.',
  'user-choice': 'Versão leve selecionada.',
  error: 'Não foi possível iniciar o 3D; exibindo a versão ilustrada.',
}

export function Hero({ tagline }: { tagline: string }) {
  const root = useRef<HTMLElement>(null)
  // Aplicação 100% cliente (SPA): as APIs do navegador já existem na primeira renderização.
  const [visual, setVisual] = useState<{ mode: '3d' | 'fallback'; reason: HeroVisualReason | null }>(decideHeroVisual)
  const [canUse3d] = useState(supportsWebGL)
  const [ready3d, setReady3d] = useState(false)
  const [inView, setInView] = useState(true)

  // Adia o download do 3D até o navegador ficar ocioso, para não competir com o conteúdo principal.
  useEffect(() => {
    if (visual.mode !== '3d') return
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    if (w.requestIdleCallback && w.cancelIdleCallback) {
      const id = w.requestIdleCallback(() => setReady3d(true), { timeout: 1500 })
      return () => w.cancelIdleCallback?.(id)
    }
    const id = window.setTimeout(() => setReady3d(true), 600)
    return () => window.clearTimeout(id)
  }, [visual])

  // Pausa a renderização quando o hero sai da tela.
  useEffect(() => {
    const el = root.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.05 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Entrada do texto com GSAP.
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const tl = gsap.timeline({ defaults: { ease: 'power4.out' } })
      tl.from(el.querySelectorAll('.hero__line > span'), { yPercent: 110, duration: 1, stagger: 0.12 })
        .from(el.querySelectorAll('[data-hero-fade]'), { autoAlpha: 0, y: 18, duration: 0.7, stagger: 0.1 }, '-=0.5')
        .from(el.querySelector('.hero__visual'), { autoAlpha: 0, scale: 0.92, duration: 1.1 }, 0.1)
    })
    return () => mm.revert()
  }, [])

  useParallax(root)

  const show3d = visual.mode === '3d' && ready3d

  return (
    <section ref={root} className="hero" aria-labelledby="hero-title">
      <div className="hero__deco" aria-hidden="true">
        <span className="hero__sun" data-parallax="90" />
        <span className="hero__wave hero__wave--1" data-parallax="40" />
        <span className="hero__wave hero__wave--2" data-parallax="20" />
      </div>
      <div className="container hero__grid">
        <div className="hero__copy">
          <p className="eyebrow" data-hero-fade>
            Marmitas congeladas prontas para o dia a dia
          </p>
          <h1 id="hero-title" className="hero__title">
            <span className="hero__line">
              <span>Comida de casa,</span>
            </span>
            <span className="hero__line">
              <span>
                no ritmo da <em>sua</em>
              </span>
            </span>
            <span className="hero__line">
              <span>semana.</span>
            </span>
          </h1>
          <p className="hero__lead" data-hero-fade>
            {tagline}. Escolha suas preferências, receba sugestões explicadas e finalize o pedido pelo WhatsApp.
          </p>
          <div className="hero__actions" data-hero-fade>
            <Link to="/cardapio" className="btn">
              Ver cardápio <ArrowIcon width={18} height={18} />
            </Link>
            <Link to="/preferencias" className="btn btn--light">
              <SparkleIcon width={18} height={18} /> Descobrir minha marmita
            </Link>
          </div>
        </div>

        <div className="hero__visual">
          <div className="hero__stage">
            {show3d ? (
              <SceneBoundary onError={() => setVisual({ mode: 'fallback', reason: 'error' })}>
                <Suspense fallback={<HeroFallback />}>
                  <HeroScene active={inView} />
                </Suspense>
              </SceneBoundary>
            ) : (
              <HeroFallback />
            )}
            <span className="visually-hidden">
              Ilustração: uma marmita aberta com a tampa flutuando e ingredientes girando ao redor.
            </span>
          </div>
          <p className="hero__visual-note" data-hero-fade>
            {visual.mode === 'fallback' && visual.reason ? REASON_TEXT[visual.reason] + ' ' : ''}
            {canUse3d && visual.reason !== 'error' && (
              <button
                type="button"
                className="link-btn"
                onClick={() =>
                  setVisual(
                    visual.mode === '3d' ? { mode: 'fallback', reason: 'user-choice' } : { mode: '3d', reason: null },
                  )
                }
              >
                {visual.mode === '3d' ? 'Usar versão leve' : 'Ver em 3D'}
              </button>
            )}
          </p>
        </div>
      </div>
    </section>
  )
}
