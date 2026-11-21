import type { Product } from '../domain/types.ts'

/** Hash simples e determinístico para variar a decoração de cada ilustração. */
function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

/**
 * Ilustração vetorial gerada a partir das cores cadastradas do produto.
 * É uma ARTE ILUSTRATIVA (não é foto do produto real), e por isso é sempre
 * acompanhada da legenda "Ilustração" quando usada como imagem principal.
 */
export function ProductArt({ product, title }: { product: Pick<Product, 'id' | 'art' | 'name'>; title?: string }) {
  const h = hash(product.id)
  const { main, side, garnish } = product.art
  const dots = Array.from({ length: 7 }, (_, i) => {
    const n = (h >> (i * 3)) & 0xff
    return { cx: 132 + ((n * 7) % 52), cy: 60 + ((n * 13) % 50), r: 3 + (n % 4) }
  })
  const leaves = Array.from({ length: 4 }, (_, i) => {
    const n = (h >> (i * 5)) & 0xff
    return { x: 136 + ((n * 5) % 44), y: 118 + ((n * 11) % 28), rot: (n * 17) % 180 }
  })
  const label = title ?? `Ilustração da marmita ${product.name}`
  return (
    <svg viewBox="0 0 240 170" role="img" aria-label={label}>
      {/* sombra */}
      <ellipse cx="120" cy="160" rx="96" ry="8" fill="currentColor" opacity="0.08" />
      {/* embalagem */}
      <rect x="14" y="20" width="212" height="134" rx="26" fill="#6F2426" />
      <rect x="20" y="24" width="200" height="124" rx="22" fill="#FFFDF8" />
      {/* compartimentos */}
      <rect x="30" y="34" width="94" height="104" rx="16" fill={main} />
      <rect x="130" y="34" width="80" height="58" rx="14" fill={side} />
      <rect x="130" y="98" width="80" height="40" rx="14" fill={garnish} />
      {/* textura do compartimento principal */}
      <path
        d={`M40 ${60 + (h % 10)}c12-8 26 8 38 0s22 6 36-2`}
        stroke="#fff"
        strokeOpacity="0.35"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={`M40 ${96 + (h % 8)}c14-6 24 6 36 0s20 4 38-4`}
        stroke="#000"
        strokeOpacity="0.12"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
      {/* grãos/acompanhamento */}
      {dots.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill="#000" opacity="0.12" />
      ))}
      {/* folhas/legumes */}
      {leaves.map((l, i) => (
        <ellipse
          key={i}
          cx={l.x}
          cy={l.y}
          rx="9"
          ry="4.5"
          fill="#fff"
          opacity="0.28"
          transform={`rotate(${l.rot} ${l.x} ${l.y})`}
        />
      ))}
      {/* cristais de gelo: congelado */}
      <g stroke="#17677A" strokeWidth="2" strokeLinecap="round" opacity="0.55">
        <path d="M206 30v14M199 37h14M201 32l10 10M211 32l-10 10" />
      </g>
    </svg>
  )
}
