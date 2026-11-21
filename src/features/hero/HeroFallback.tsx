/**
 * Versão leve do visual do hero (SVG + CSS), usada quando:
 * - WebGL não está disponível;
 * - o usuário prefere movimento reduzido;
 * - o aparelho aparenta ter menor desempenho;
 * - enquanto a cena 3D ainda está carregando.
 */
export function HeroFallback() {
  return (
    <svg className="hero-fallback" viewBox="0 0 520 440" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="hf-sun" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#FFD79A" />
          <stop offset="1" stopColor="#F28B26" />
        </radialGradient>
      </defs>
      <circle className="hf-sun" cx="360" cy="120" r="78" fill="url(#hf-sun)" opacity="0.9" />
      {/* ingredientes em órbita */}
      <g className="hf-orbit">
        <g className="hf-item" style={{ ['--d' as string]: '0s' }}>
          <circle cx="92" cy="128" r="22" fill="#D7322B" />
          <path d="M84 106l8 8 8-8" stroke="#4E8B3A" strokeWidth="5" strokeLinecap="round" fill="none" />
        </g>
        <g className="hf-item" style={{ ['--d' as string]: '-1.2s' }}>
          <path d="M430 280l-60 20 6 12z" fill="#F28B26" />
          <path d="M430 280l14-12M430 280l16 2" stroke="#4E8B3A" strokeWidth="5" strokeLinecap="round" />
        </g>
        <g className="hf-item" style={{ ['--d' as string]: '-2.4s' }}>
          <ellipse cx="120" cy="330" rx="26" ry="11" fill="#5E9B4B" transform="rotate(-25 120 330)" />
        </g>
        <g className="hf-item" style={{ ['--d' as string]: '-3.1s' }}>
          <path d="M470 160l12 12-12 12-12-12z" fill="#BFE7F1" stroke="#17677A" strokeWidth="2" />
        </g>
        <g className="hf-item" style={{ ['--d' as string]: '-0.6s' }}>
          <circle cx="62" cy="240" r="9" fill="#3F7D3A" />
          <circle cx="74" cy="232" r="9" fill="#3F7D3A" />
          <circle cx="70" cy="246" r="9" fill="#3F7D3A" />
        </g>
      </g>
      {/* marmita isométrica */}
      <g className="hf-box">
        <path d="M120 250l140-70 140 70-140 70z" fill="#FFF3DF" stroke="#6F2426" strokeWidth="6" strokeLinejoin="round" />
        <path d="M120 250v52l140 70v-52z" fill="#A51E25" stroke="#6F2426" strokeWidth="6" strokeLinejoin="round" />
        <path d="M400 250v52l-140 70v-52z" fill="#8D1820" stroke="#6F2426" strokeWidth="6" strokeLinejoin="round" />
        <path d="M150 250l84-42 70 35-84 42z" fill="#F28B26" />
        <path d="M250 200l56-28 70 35-56 28z" fill="#FBF6EA" />
        <path d="M320 235l56-28-56 28z" fill="#4A2A22" />
        <path d="M262 270l58-29 56 28-58 29z" fill="#4A2A22" />
      </g>
      {/* tampa flutuante */}
      <g className="hf-lid">
        <path d="M112 168l148-74 148 74-148 74z" fill="#CFE9EF" fillOpacity="0.75" stroke="#17677A" strokeWidth="4" strokeLinejoin="round" />
        <path d="M232 168l28-14 28 14-28 14z" fill="#F28B26" />
      </g>
      {/* maré */}
      <path
        d="M0 410c40 0 40-14 80-14s40 14 80 14 40-14 80-14 40 14 80 14 40-14 80-14 40 14 80 14 40-14 80-14"
        fill="none"
        stroke="#17677A"
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  )
}
