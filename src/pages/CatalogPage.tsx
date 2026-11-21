import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ProductCard } from '../components/ProductCard.tsx'
import { SearchIcon } from '../components/icons.tsx'
import { EmptyState, Notice, PageHead } from '../components/ui.tsx'
import { DEFAULT_FILTERS, activeFilterCount, filterProducts, type CatalogFilters, type SortOption } from '../domain/catalog.ts'
import {
  ALL_INTERESTS,
  ALL_PROTEINS,
  ALL_RESTRICTIONS,
  INTEREST_OPTIONS,
  PROTEIN_OPTIONS,
  RESTRICTION_OPTIONS,
} from '../domain/options.ts'
import type { DietRestriction, Interest, Protein } from '../domain/types.ts'
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts'
import { useReveal } from '../hooks/useReveal.ts'
import { useCatalog } from '../state/hooks.ts'

const SORTS: Array<{ value: SortOption; label: string }> = [
  { value: 'relevancia', label: 'Relevância' },
  { value: 'menor-preco', label: 'Menor preço' },
  { value: 'maior-preco', label: 'Maior preço' },
  { value: 'nome', label: 'Nome (A–Z)' },
]

const list = <T extends string>(params: URLSearchParams, key: string, allowed: readonly T[]): T[] =>
  (params.get(key) ?? '')
    .split(',')
    .filter((v): v is T => allowed.includes(v as T))

/** Os filtros ficam na URL: o link pode ser compartilhado e o botão "voltar" funciona. */
function readFilters(params: URLSearchParams): CatalogFilters {
  const sort = params.get('ordem') as SortOption | null
  return {
    query: params.get('busca') ?? '',
    categoryId: params.get('categoria'),
    restrictions: list<DietRestriction>(params, 'restricoes', ALL_RESTRICTIONS),
    proteins: list<Protein>(params, 'proteinas', ALL_PROTEINS),
    tags: list<Interest>(params, 'interesses', ALL_INTERESTS),
    onlyAvailable: params.get('disponiveis') === '1',
    sort: SORTS.some((s) => s.value === sort) ? (sort as SortOption) : 'relevancia',
  }
}

function writeFilters(f: CatalogFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.query) p.set('busca', f.query)
  if (f.categoryId) p.set('categoria', f.categoryId)
  if (f.restrictions.length) p.set('restricoes', f.restrictions.join(','))
  if (f.proteins.length) p.set('proteinas', f.proteins.join(','))
  if (f.tags.length) p.set('interesses', f.tags.join(','))
  if (f.onlyAvailable) p.set('disponiveis', '1')
  if (f.sort !== 'relevancia') p.set('ordem', f.sort)
  return p
}

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]
}

export function CatalogPage() {
  useDocumentTitle('Cardápio')
  const { products, categories, usingDemoData, source } = useCatalog()
  const [params, setParams] = useSearchParams()
  const filters = readFilters(params)
  const update = (patch: Partial<CatalogFilters>) =>
    setParams(writeFilters({ ...filters, ...patch }), { replace: true, preventScrollReset: true })

  const results = useMemo(() => filterProducts(products, filters), [products, filters])
  const count = activeFilterCount(filters)
  // Em telas pequenas os filtros começam recolhidos para os produtos aparecerem logo.
  const [filtersOpen, setFiltersOpen] = useState(() => window.matchMedia('(min-width: 961px)').matches || count > 0)
  const ref = useRef<HTMLDivElement>(null)
  useReveal(ref, [results.length])
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name

  return (
    <div ref={ref}>
      <PageHead eyebrow="Cardápio" title="Nossas marmitas" crumbs={[{ to: '/', label: 'Início' }, { label: 'Cardápio' }]}>
        <p>Busque por nome ou ingrediente, filtre por categoria, restrição alimentar, proteína ou objetivo.</p>
      </PageHead>

      <div className="container catalog">
        <aside className="catalog__filters" aria-label="Filtros do cardápio">
          <details
            className="filters"
            open={filtersOpen}
            onToggle={(e) => setFiltersOpen((e.currentTarget as HTMLDetailsElement).open)}
          >
            <summary>
              Filtros {count > 0 && <span className="badge badge--petrol">{count}</span>}
            </summary>
            <form className="filters__form" role="search" onSubmit={(e) => e.preventDefault()}>
              <div className="field">
                <label htmlFor="busca">Buscar</label>
                <div className="input-icon">
                  <SearchIcon />
                  <input
                    id="busca"
                    className="input"
                    type="search"
                    placeholder="Ex.: frango, abóbora, lasanha"
                    value={filters.query}
                    onChange={(e) => update({ query: e.target.value })}
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="categoria">Categoria</label>
                <select
                  id="categoria"
                  className="select"
                  value={filters.categoryId ?? ''}
                  onChange={(e) => update({ categoryId: e.target.value || null })}
                >
                  <option value="">Todas</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <fieldset>
                <legend className="filters__legend">Restrições</legend>
                <div className="chip-group">
                  {RESTRICTION_OPTIONS.map((o) => (
                    <label key={o.value} className="chip" title={o.hint}>
                      <input
                        type="checkbox"
                        checked={filters.restrictions.includes(o.value)}
                        onChange={() => update({ restrictions: toggle(filters.restrictions, o.value) })}
                      />
                      <span>{o.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="filters__legend">Proteína</legend>
                <div className="chip-group">
                  {PROTEIN_OPTIONS.map((o) => (
                    <label key={o.value} className="chip">
                      <input
                        type="checkbox"
                        checked={filters.proteins.includes(o.value)}
                        onChange={() => update({ proteins: toggle(filters.proteins, o.value) })}
                      />
                      <span>{o.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="filters__legend">Características</legend>
                <div className="chip-group">
                  {INTEREST_OPTIONS.filter((o) => o.value !== 'economico').map((o) => (
                    <label key={o.value} className="chip">
                      <input
                        type="checkbox"
                        checked={filters.tags.includes(o.value)}
                        onChange={() => update({ tags: toggle(filters.tags, o.value) })}
                      />
                      <span>{o.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={filters.onlyAvailable}
                  onChange={(e) => update({ onlyAvailable: e.target.checked })}
                />
                Somente disponíveis
              </label>

              {count > 0 && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setParams(writeFilters(DEFAULT_FILTERS))}>
                  Limpar filtros
                </button>
              )}
            </form>
          </details>
        </aside>

        <section className="catalog__results" aria-labelledby="resultado-titulo">
          <div className="catalog__toolbar">
            <h2 id="resultado-titulo" className="catalog__count" aria-live="polite">
              {results.length} {results.length === 1 ? 'marmita encontrada' : 'marmitas encontradas'}
            </h2>
            <div className="field field--inline">
              <label htmlFor="ordem">Ordenar por</label>
              <select
                id="ordem"
                className="select"
                value={filters.sort}
                onChange={(e) => update({ sort: e.target.value as SortOption })}
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {source === 'supabase-loading' && <Notice icon="⏳">Carregando cardápio…</Notice>}
          {usingDemoData && (
            <Notice tone="demo" icon="ⓘ">
              Catálogo <strong>demonstrativo</strong>: nomes, preços e ingredientes são exemplos. Informações
              nutricionais ainda não foram cadastradas.
            </Notice>
          )}

          {results.length === 0 ? (
            <EmptyState
              title="Nenhuma marmita com esses filtros"
              action={
                <button type="button" className="btn" onClick={() => setParams(writeFilters(DEFAULT_FILTERS))}>
                  Limpar filtros
                </button>
              }
            >
              Tente remover algum filtro ou buscar por outro ingrediente.
            </EmptyState>
          ) : (
            <ul className="product-grid" role="list">
              {results.map((p) => (
                <li key={p.id}>
                  <ProductCard product={p} categoryName={categoryName(p.categoryId)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
