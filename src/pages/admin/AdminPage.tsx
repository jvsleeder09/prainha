import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { DemoBadge, Notice, PageHead } from '../../components/ui.tsx'
import { formatDateTime, formatPrice, slugify } from '../../domain/format.ts'
import { isValidWhatsappNumber, sanitizePhone } from '../../domain/whatsapp.ts'
import type { BusinessInfo, Category, OrderStatus, Product } from '../../domain/types.ts'
import { parseCategories, parseProducts } from '../../domain/validation.ts'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.ts'
import { isSupabaseConfigured } from '../../services/supabase.ts'
import { useCatalog, useToast } from '../../state/hooks.ts'
import { emptyProduct } from './adminUtils.ts'
import { ProductForm } from './ProductForm.tsx'

type Tab = 'produtos' | 'categorias' | 'pedidos' | 'informacoes' | 'dados'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'produtos', label: 'Produtos' },
  { id: 'categorias', label: 'Categorias' },
  { id: 'pedidos', label: 'Pedidos' },
  { id: 'informacoes', label: 'Informações comerciais' },
  { id: 'dados', label: 'Dados' },
]

export function AdminPage() {
  useDocumentTitle('Área administrativa')
  const { session } = useCatalog()
  const [tab, setTab] = useState<Tab>('produtos')
  const needsLogin = isSupabaseConfigured && !session

  return (
    <>
      <PageHead
        eyebrow="Administração"
        title="Painel da Prainha"
        crumbs={[{ to: '/', label: 'Início' }, { label: 'Administração' }]}
      />
      <div className="container admin">
        <ModeBanner />
        {needsLogin ? (
          <LoginForm />
        ) : (
          <>
            <div className="tabs" role="tablist" aria-label="Seções do painel">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  id={`tab-${t.id}`}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  aria-controls={`panel-${t.id}`}
                  tabIndex={tab === t.id ? 0 : -1}
                  className="tab"
                  onClick={() => setTab(t.id)}
                  onKeyDown={(e) => {
                    const i = TABS.findIndex((x) => x.id === tab)
                    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                      const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]
                      setTab(next.id)
                      document.getElementById(`tab-${next.id}`)?.focus()
                    }
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tab-panel" tabIndex={0}>
              {tab === 'produtos' && <ProductsPanel />}
              {tab === 'categorias' && <CategoriesPanel />}
              {tab === 'pedidos' && <OrdersPanel />}
              {tab === 'informacoes' && <BusinessPanel />}
              {tab === 'dados' && <DataPanel />}
            </div>
          </>
        )}
      </div>
    </>
  )
}

function ModeBanner() {
  const { source, sourceError, session, signOut } = useCatalog()
  if (!isSupabaseConfigured) {
    return (
      <Notice tone="warning" icon="!" title="Modo local (sem servidor).">
        O Supabase ainda não está configurado. As alterações feitas aqui ficam salvas{' '}
        <strong>somente neste navegador</strong> (LocalStorage), sem autenticação, e não aparecem para outros
        visitantes. Use este modo para testes e para preparar o cadastro. Para ativar o modo com servidor, veja{' '}
        <code>docs/SUPABASE.md</code>.
      </Notice>
    )
  }
  return (
    <Notice tone={source === 'supabase-error' ? 'error' : 'info'} icon="ⓘ" title="Modo Supabase.">
      {source === 'supabase-error'
        ? `Falha ao carregar dados do Supabase: ${sourceError}. Exibindo catálogo local.`
        : 'Os dados são lidos e gravados no Supabase.'}{' '}
      {session && (
        <>
          Conectado como <strong>{session.email}</strong>.{' '}
          <button type="button" className="link-btn" onClick={() => void signOut()}>
            Sair
          </button>
        </>
      )}
    </Notice>
  )
}

function LoginForm() {
  const { signIn } = useCatalog()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await signIn(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no login.')
    } finally {
      setLoading(false)
    }
  }
  return (
    <form className="admin-login" onSubmit={submit}>
      <h2>Entrar</h2>
      <p className="muted">Acesso restrito a administradores cadastrados no Supabase.</p>
      <div className="field">
        <label htmlFor="adm-email">E-mail</label>
        <input id="adm-email" className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="adm-pass">Senha</label>
        <input
          id="adm-pass"
          className="input"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn" disabled={loading}>
        {loading ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}

/* ------------------------- Produtos ------------------------- */

function ProductsPanel() {
  const { products, categories, saveProduct, deleteProduct } = useCatalog()
  const { notify } = useToast()
  const [editing, setEditing] = useState<Product | null>(null)
  const [query, setQuery] = useState('')
  const list = products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))

  if (editing) {
    return (
      <ProductForm
        initial={editing}
        categories={categories}
        existing={products}
        onCancel={() => setEditing(null)}
        onSave={async (p) => {
          await saveProduct(p)
          notify('Produto salvo.', 'success')
          setEditing(null)
        }}
      />
    )
  }

  return (
    <section aria-labelledby="adm-prod">
      <div className="section-head">
        <h2 id="adm-prod">Produtos ({products.length})</h2>
        <div className="admin-toolbar">
          <label htmlFor="adm-busca" className="visually-hidden">
            Buscar produto
          </label>
          <input id="adm-busca" className="input" type="search" placeholder="Buscar…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button
            type="button"
            className="btn"
            disabled={categories.length === 0}
            onClick={() => setEditing(emptyProduct(categories[0]?.id ?? ''))}
          >
            Novo produto
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <caption className="visually-hidden">Produtos cadastrados</caption>
          <thead>
            <tr>
              <th scope="col">Produto</th>
              <th scope="col">Categoria</th>
              <th scope="col">Preço</th>
              <th scope="col">Disponível</th>
              <th scope="col">
                <span className="visually-hidden">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link to={`/cardapio/${p.slug}`}>{p.name}</Link> {p.demo && <DemoBadge />}
                </td>
                <td>{categories.find((c) => c.id === p.categoryId)?.name ?? '—'}</td>
                <td>{formatPrice(p.price)}</td>
                <td>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={p.available}
                      onChange={async (e) => {
                        try {
                          await saveProduct({ ...p, available: e.target.checked })
                        } catch (err) {
                          notify(err instanceof Error ? err.message : 'Falha ao salvar.', 'error')
                        }
                      }}
                    />
                    <span className="visually-hidden">Disponibilidade de {p.name}</span>
                    <span aria-hidden="true">{p.available ? 'Sim' : 'Não'}</span>
                  </label>
                </td>
                <td className="table__actions">
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(p)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={async () => {
                      if (!window.confirm(`Excluir “${p.name}”?`)) return
                      try {
                        await deleteProduct(p.id)
                        notify('Produto excluído.')
                      } catch (err) {
                        notify(err instanceof Error ? err.message : 'Falha ao excluir.', 'error')
                      }
                    }}
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/* ------------------------- Categorias ------------------------- */

function CategoriesPanel() {
  const { categories, products, saveCategory, deleteCategory } = useCatalog()
  const { notify } = useToast()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const add = async (e: FormEvent) => {
    e.preventDefault()
    const id = slugify(name)
    if (!id) return notify('Informe o nome da categoria.', 'warning')
    if (categories.some((c) => c.id === id)) return notify('Já existe uma categoria com esse nome.', 'warning')
    try {
      await saveCategory({ id, name: name.trim(), description: description.trim(), order: categories.length + 1 })
      setName('')
      setDescription('')
      notify('Categoria criada.', 'success')
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha ao salvar.', 'error')
    }
  }

  const move = async (c: Category, dir: -1 | 1) => {
    const idx = categories.findIndex((x) => x.id === c.id)
    const other = categories[idx + dir]
    if (!other) return
    await saveCategory({ ...c, order: other.order })
    await saveCategory({ ...other, order: c.order })
  }

  return (
    <section aria-labelledby="adm-cat" className="stack">
      <h2 id="adm-cat">Categorias</h2>
      <ul className="admin-list" role="list">
        {categories.map((c, i) => (
          <li key={c.id}>
            <CategoryRow
              category={c}
              count={products.filter((p) => p.categoryId === c.id).length}
              first={i === 0}
              last={i === categories.length - 1}
              onMove={(d) => void move(c, d)}
              onSave={async (updated) => {
                await saveCategory(updated)
                notify('Categoria atualizada.', 'success')
              }}
              onDelete={async () => {
                try {
                  await deleteCategory(c.id)
                  notify('Categoria excluída.')
                } catch (err) {
                  notify(err instanceof Error ? err.message : 'Falha ao excluir.', 'error')
                }
              }}
            />
          </li>
        ))}
      </ul>
      <form className="admin-inline-form" onSubmit={add}>
        <h3>Nova categoria</h3>
        <div className="field">
          <label htmlFor="cat-nome">Nome</label>
          <input id="cat-nome" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="cat-desc">Descrição</label>
          <input id="cat-desc" className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <button type="submit" className="btn">
          Adicionar
        </button>
      </form>
    </section>
  )
}

function CategoryRow({
  category,
  count,
  first,
  last,
  onMove,
  onSave,
  onDelete,
}: {
  category: Category
  count: number
  first: boolean
  last: boolean
  onMove: (d: -1 | 1) => void
  onSave: (c: Category) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(category.name)
  const [description, setDescription] = useState(category.description)
  if (editing) {
    return (
      <form
        className="admin-row admin-row--edit"
        onSubmit={async (e) => {
          e.preventDefault()
          await onSave({ ...category, name: name.trim() || category.name, description: description.trim() })
          setEditing(false)
        }}
      >
        <label className="visually-hidden" htmlFor={`cn-${category.id}`}>
          Nome
        </label>
        <input id={`cn-${category.id}`} className="input" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="visually-hidden" htmlFor={`cd-${category.id}`}>
          Descrição
        </label>
        <input id={`cd-${category.id}`} className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        <button type="submit" className="btn btn--sm">
          Salvar
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(false)}>
          Cancelar
        </button>
      </form>
    )
  }
  return (
    <div className="admin-row">
      <div>
        <strong>{category.name}</strong> <span className="muted">· {count} produto(s)</span>
        <p className="muted">{category.description}</p>
      </div>
      <div className="table__actions">
        <button type="button" className="btn btn--ghost btn--sm" disabled={first} onClick={() => onMove(-1)} aria-label={`Mover ${category.name} para cima`}>
          ↑
        </button>
        <button type="button" className="btn btn--ghost btn--sm" disabled={last} onClick={() => onMove(1)} aria-label={`Mover ${category.name} para baixo`}>
          ↓
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(true)}>
          Editar
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => window.confirm(`Excluir a categoria “${category.name}”?`) && void onDelete()}
        >
          Excluir
        </button>
      </div>
    </div>
  )
}

/* ------------------------- Pedidos ------------------------- */

const STATUS_LABEL: Record<OrderStatus, string> = {
  enviado: 'Enviado pelo WhatsApp',
  confirmado: 'Confirmado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

function OrdersPanel() {
  const { orders, setOrderStatus, refreshOrders } = useCatalog()
  const { notify } = useToast()
  return (
    <section aria-labelledby="adm-ped" className="stack">
      <div className="section-head">
        <h2 id="adm-ped">Pedidos ({orders.length})</h2>
        {isSupabaseConfigured && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => refreshOrders().catch((e: Error) => notify(e.message, 'error'))}>
            Atualizar
          </button>
        )}
      </div>
      {!isSupabaseConfigured && (
        <p className="muted">
          No modo local, aparecem apenas os pedidos enviados ao WhatsApp a partir <strong>deste navegador</strong>. Com o
          Supabase configurado, todos os pedidos registrados pelo site aparecem aqui.
        </p>
      )}
      {orders.length === 0 ? (
        <p>Nenhum pedido registrado.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <caption className="visually-hidden">Pedidos registrados</caption>
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Cliente</th>
                <th scope="col">Itens</th>
                <th scope="col">Total</th>
                <th scope="col">Situação</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <time dateTime={o.createdAt}>{formatDateTime(o.createdAt)}</time>
                  </td>
                  <td>
                    {o.customerName || '—'}
                    <br />
                    <small className="muted">{o.fulfillment === 'entrega' ? 'Entrega' : 'Retirada'}</small>
                  </td>
                  <td>
                    <ul className="plain-list">
                      {o.items.map((i) => (
                        <li key={i.productId}>
                          {i.quantity}x {i.name}
                        </li>
                      ))}
                    </ul>
                    {o.notes && <small className="muted">Obs.: {o.notes}</small>}
                  </td>
                  <td>{formatPrice(o.total)}</td>
                  <td>
                    <label className="visually-hidden" htmlFor={`st-${o.id}`}>
                      Situação do pedido
                    </label>
                    <select
                      id={`st-${o.id}`}
                      className="select select--sm"
                      value={o.status}
                      onChange={(e) =>
                        setOrderStatus(o.id, e.target.value as OrderStatus).catch((err: Error) => notify(err.message, 'error'))
                      }
                    >
                      {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/* ------------------------- Informações comerciais ------------------------- */

function BusinessPanel() {
  const { business, saveBusiness } = useCatalog()
  const { notify } = useToast()
  const [form, setForm] = useState<BusinessInfo>(business)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof BusinessInfo, v: string) => setForm({ ...form, [k]: v })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const phone = sanitizePhone(form.whatsappNumber)
    if (phone && !isValidWhatsappNumber(phone)) {
      setError('Número inválido. Use DDI + DDD + número, só dígitos. Ex.: 5561912345678.')
      return
    }
    setError(null)
    try {
      await saveBusiness({ ...form, whatsappNumber: phone })
      notify('Informações salvas.', 'success')
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha ao salvar.', 'error')
    }
  }

  const fields: Array<{ k: keyof BusinessInfo; label: string; hint?: string }> = [
    { k: 'storeName', label: 'Nome da loja' },
    { k: 'tagline', label: 'Slogan', hint: 'Use • para separar os valores (aparecem na faixa da página inicial).' },
    { k: 'whatsappNumber', label: 'WhatsApp para pedidos', hint: 'DDI + DDD + número. Ex.: 5561912345678.' },
    { k: 'deliveryInfo', label: 'Informações de entrega' },
    { k: 'openingHours', label: 'Horário de atendimento' },
    { k: 'address', label: 'Endereço' },
    { k: 'instagramUrl', label: 'Link do Instagram' },
  ]

  return (
    <form className="admin-form" onSubmit={submit} noValidate aria-labelledby="adm-info">
      <h2 id="adm-info">Informações comerciais</h2>
      <p className="muted">Campos vazios não são exibidos no site. Nada aqui foi preenchido com dados inventados.</p>
      <div className="admin-form__grid">
        {fields.map((f) => (
          <div className="field" key={f.k}>
            <label htmlFor={`bi-${f.k}`}>{f.label}</label>
            <input
              id={`bi-${f.k}`}
              className="input"
              value={form[f.k]}
              onChange={(e) => set(f.k, e.target.value)}
              inputMode={f.k === 'whatsappNumber' ? 'tel' : undefined}
              aria-invalid={f.k === 'whatsappNumber' && !!error}
              aria-describedby={f.hint ? `bi-${f.k}-hint` : undefined}
            />
            {f.hint && <small id={`bi-${f.k}-hint`}>{f.hint}</small>}
            {f.k === 'whatsappNumber' && error && (
              <small className="field__error" role="alert">
                {error}
              </small>
            )}
          </div>
        ))}
      </div>
      <div className="admin-form__actions">
        <button type="submit" className="btn">
          Salvar informações
        </button>
      </div>
    </form>
  )
}

/* ------------------------- Dados (importar/exportar) ------------------------- */

function DataPanel() {
  const { products, categories, resetLocalCatalog, importLocalCatalog } = useCatalog()
  const { notify } = useToast()

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), categories, products }, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `prainha-catalogo-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importJson = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as { products?: unknown; categories?: unknown }
      const p = parseProducts(data.products)
      const c = parseCategories(data.categories)
      if (!p || !c || c.length === 0) throw new Error('Arquivo sem produtos/categorias válidos.')
      const valid = p.filter((x) => c.some((cat) => cat.id === x.categoryId))
      importLocalCatalog(valid, c)
      notify(`Importados ${valid.length} produto(s) e ${c.length} categoria(s).`, 'success')
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Arquivo inválido.', 'error')
    }
  }

  return (
    <section aria-labelledby="adm-dados" className="stack">
      <h2 id="adm-dados">Dados do catálogo</h2>
      <p>
        Exporte o catálogo atual em JSON para backup ou para migrar ao Supabase. A importação substitui o catálogo local
        deste navegador.
      </p>
      <div className="admin-toolbar">
        <button type="button" className="btn btn--secondary" onClick={exportJson}>
          Exportar JSON
        </button>
        {!isSupabaseConfigured && (
          <>
            <label className="btn btn--ghost">
              Importar JSON
              <input
                type="file"
                accept="application/json,.json"
                className="visually-hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void importJson(f)
                  e.target.value = ''
                }}
              />
            </label>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                if (window.confirm('Restaurar o catálogo demonstrativo? As alterações locais serão perdidas.')) {
                  resetLocalCatalog()
                  notify('Catálogo demonstrativo restaurado.')
                }
              }}
            >
              Restaurar catálogo demonstrativo
            </button>
          </>
        )}
      </div>
    </section>
  )
}
