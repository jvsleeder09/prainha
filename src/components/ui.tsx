import { useId, type ReactNode } from 'react'
import { Link } from 'react-router'
import { MAX_QUANTITY, MIN_QUANTITY } from '../domain/cart.ts'
import { useShop, useToast } from '../state/hooks.ts'
import { HeartIcon } from './icons.tsx'

/* Pequenos componentes de interface reutilizáveis. */

export function DemoBadge() {
  return (
    <span className="badge badge--demo" title="Produto demonstrativo: não é um item real da Prainha">
      Exemplo
    </span>
  )
}

export function Notice({
  tone = 'info',
  icon,
  title,
  children,
}: {
  tone?: 'info' | 'warning' | 'error' | 'demo'
  icon?: string
  title?: string
  children: ReactNode
}) {
  return (
    <div className={`notice notice--${tone}`} role={tone === 'error' ? 'alert' : undefined}>
      {icon && (
        <span className="notice__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <div>
        {title && <strong>{title} </strong>}
        {children}
      </div>
    </div>
  )
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <svg viewBox="0 0 120 80" aria-hidden="true">
        <rect x="6" y="14" width="108" height="60" rx="16" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.35" />
        <rect x="16" y="24" width="48" height="40" rx="10" fill="currentColor" opacity="0.12" />
        <rect x="70" y="24" width="34" height="18" rx="8" fill="currentColor" opacity="0.12" />
        <rect x="70" y="46" width="34" height="18" rx="8" fill="currentColor" opacity="0.12" />
        <rect x="40" y="4" width="40" height="10" rx="5" fill="currentColor" opacity="0.25" />
      </svg>
      <h2 className="h3">{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}

export function FavoriteButton({ productId, productName }: { productId: string; productName: string }) {
  const { isFavorite, toggleFavorite } = useShop()
  const { notify } = useToast()
  const active = isFavorite(productId)
  return (
    <button
      type="button"
      className="icon-btn fav-btn"
      aria-pressed={active}
      aria-label={active ? `Remover ${productName} dos favoritos` : `Adicionar ${productName} aos favoritos`}
      title={active ? 'Remover dos favoritos' : 'Favoritar'}
      onClick={() => {
        toggleFavorite(productId)
        notify(active ? 'Removido dos favoritos.' : 'Adicionado aos favoritos!', active ? 'info' : 'success')
      }}
    >
      <HeartIcon fill={active ? 'currentColor' : 'none'} />
    </button>
  )
}

export function QuantityStepper({
  value,
  onChange,
  label,
}: {
  value: number
  onChange: (v: number) => void
  label: string
}) {
  const id = useId()
  return (
    <div className="qty" role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= MIN_QUANTITY}
        aria-label="Diminuir quantidade"
      >
        −
      </button>
      <label htmlFor={id} className="visually-hidden">
        Quantidade
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={MIN_QUANTITY}
        max={MAX_QUANTITY}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n) && n >= MIN_QUANTITY) onChange(n)
        }}
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= MAX_QUANTITY}
        aria-label="Aumentar quantidade"
      >
        +
      </button>
    </div>
  )
}

export function PageHead({
  eyebrow,
  title,
  children,
  crumbs,
}: {
  eyebrow?: string
  title: string
  children?: ReactNode
  crumbs?: Array<{ to?: string; label: string }>
}) {
  return (
    <header className="page-head">
      <div className="container">
        {crumbs && (
          <nav className="breadcrumb" aria-label="Você está em">
            <ol>
              {crumbs.map((c, i) => (
                <li key={i}>
                  {c.to ? (
                    <Link to={c.to}>{c.label}</Link>
                  ) : (
                    <span aria-current="page">{c.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {children}
      </div>
    </header>
  )
}

export function Wave() {
  return (
    <svg className="wave" viewBox="0 0 1200 28" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M0 14c50 0 50-10 100-10s50 10 100 10 50-10 100-10 50 10 100 10 50-10 100-10 50 10 100 10 50-10 100-10 50 10 100 10 50-10 100-10 50 10 100 10 50-10 100-10 50 10 100 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      />
    </svg>
  )
}
