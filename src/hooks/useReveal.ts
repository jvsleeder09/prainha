import { useLayoutEffect, type RefObject } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * Revela com GSAP os elementos [data-reveal] dentro do container à medida que entram na tela.
 * Só anima quando o usuário NÃO pediu movimento reduzido; caso contrário, nada é ocultado.
 */
export function useReveal(container: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useLayoutEffect(() => {
    const root = container.current
    if (!root) return
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const targets = root.querySelectorAll<HTMLElement>('[data-reveal]:not([data-revealed])')
      if (targets.length === 0) return
      gsap.set(targets, { autoAlpha: 0, y: 28 })
      ScrollTrigger.batch(targets, {
        start: 'top 92%',
        once: true,
        onEnter: (batch) => {
          batch.forEach((el) => el.setAttribute('data-revealed', ''))
          gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.08, overwrite: true })
        },
      })
    })
    return () => mm.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

/** Parallax moderado: desloca levemente [data-parallax] conforme a rolagem. */
export function useParallax(container: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const root = container.current
    if (!root) return
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      root.querySelectorAll<HTMLElement>('[data-parallax]').forEach((el) => {
        const amount = Number(el.dataset.parallax) || 60
        gsap.to(el, {
          y: amount,
          ease: 'none',
          scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: 0.6 },
        })
      })
    })
    return () => mm.revert()
  }, [container])
}
