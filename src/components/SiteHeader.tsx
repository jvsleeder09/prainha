import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { summarizeCart } from '../domain/cart.ts'
import { useCatalog, useShop, useTheme } from '../state/hooks.ts'
import { BrandMark } from './BrandMark.tsx'
import { CartIcon, CloseIcon, MenuIcon, MoonIcon, SunIcon } from './icons.tsx'

const NAV = [
  { to: '/', label: 'Início', end: true },
  { to: '/cardapio', label: 'Cardápio' },
  { to: '/preferencias', label: 'Para você' },
  { to: '/assistente', label: 'Assistente IA' },
  { to: '/favoritos', label: 'Favoritos' },
  { to: '/historico', label: 'Histórico' },
]

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      className="icon-btn"
      onClick={toggleTheme}
      aria-label={dark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      title={dark ? 'Tema claro' : 'Tema escuro'}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()
  const { cart, favorites } = useShop()
  const { products } = useCatalog()
  const count = summarizeCart(cart, products).itemCount
  const [bump, setBump] = useState(false)
  const prevCount = useRef(count)

  // Fecha o menu ao trocar de rota.
  const [lastPath, setLastPath] = useState(location.pathname)
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname)
    setOpen(false)
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (count > prevCount.current) {
      setBump(true)
      const t = window.setTimeout(() => setBump(false), 400)
      prevCount.current = count
      return () => window.clearTimeout(t)
    }
    prevCount.current = count
  }, [count])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <header className="site-header" data-scrolled={scrolled}>
      <div className="container site-header__inner">
        <Link to="/" className="brand" aria-label="Prainha — página inicial">
          <BrandMark className="brand__mark" />
          <span>
            <span className="brand__name">Prainha</span>
            <span className="brand__sub">Marmitas congeladas</span>
          </span>
        </Link>

        <nav id="main-nav" className="main-nav" aria-label="Principal" data-open={open}>
          <ul>
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end}>
                  {item.label}
                  {item.to === '/favoritos' && favorites.length > 0 && (
                    <span className="visually-hidden"> ({favorites.length})</span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="header-actions">
          <ThemeToggle />
          <Link
            to="/carrinho"
            className="icon-btn cart-link"
            aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}
          >
            <CartIcon />
            {count > 0 && (
              <span className="cart-count" data-bump={bump} aria-hidden="true">
                {count}
              </span>
            )}
          </Link>
          <button
            type="button"
            className="icon-btn menu-toggle"
            aria-expanded={open}
            aria-controls="main-nav"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>
    </header>
  )
}
