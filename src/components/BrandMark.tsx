/**
 * Marca gráfica provisória da Prainha (criada para o projeto; NÃO é o logotipo oficial).
 * Uma marmita vista de cima com um sol nascendo sobre a "maré" — praia + comida caseira.
 * Substitua pelo logotipo oficial quando ele for fornecido.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect x="4" y="12" width="56" height="44" rx="14" fill="#A51E25" />
      <rect x="9" y="17" width="46" height="34" rx="10" fill="#FFF3DF" />
      <circle cx="32" cy="34" r="11" fill="#F28B26" />
      <path d="M9 38c5 0 5-4 11.5-4S27 38 32 38s5-4 11.5-4S50 38 55 38v3a10 10 0 0 1-10 10H19A10 10 0 0 1 9 41Z" fill="#17677A" />
      <path d="M9 44c5 0 5-3 11.5-3S27 44 32 44s5-3 11.5-3S50 44 55 44" stroke="#FFF3DF" strokeWidth="2" fill="none" />
      <rect x="22" y="6" width="20" height="8" rx="4" fill="#6F2426" />
    </svg>
  )
}
