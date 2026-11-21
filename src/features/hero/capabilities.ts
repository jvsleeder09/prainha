/**
 * Detecção de capacidades para decidir entre a cena 3D e a versão leve.
 */

export function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    if (!gl) return false
    // Libera o contexto de teste imediatamente.
    ;(gl as WebGLRenderingContext).getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

interface NavigatorHints {
  deviceMemory?: number
  hardwareConcurrency?: number
  connection?: { saveData?: boolean; effectiveType?: string }
}

/** Heurística de aparelho com menor desempenho ou economia de dados ativada. */
export function isLowPowerDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const n = navigator as Navigator & NavigatorHints
  if (n.connection?.saveData) return true
  if (n.connection?.effectiveType && /(^|-)2g$/.test(n.connection.effectiveType)) return true
  if (typeof n.deviceMemory === 'number' && n.deviceMemory <= 2) return true
  if (typeof n.hardwareConcurrency === 'number' && n.hardwareConcurrency <= 2) return true
  return false
}

export type HeroVisualReason = 'no-webgl' | 'reduced-motion' | 'low-power' | 'user-choice' | 'error'

export function decideHeroVisual(): { mode: '3d' | 'fallback'; reason: HeroVisualReason | null } {
  if (!supportsWebGL()) return { mode: 'fallback', reason: 'no-webgl' }
  if (prefersReducedMotion()) return { mode: 'fallback', reason: 'reduced-motion' }
  if (isLowPowerDevice()) return { mode: 'fallback', reason: 'low-power' }
  return { mode: '3d', reason: null }
}
