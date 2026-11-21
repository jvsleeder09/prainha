import type { BusinessInfo, Category, OrderRecord, OrderStatus, Product } from '../domain/types.ts'
import { parseBusinessInfo, parseOrders, parseProduct } from '../domain/validation.ts'

/**
 * Cliente mínimo do Supabase usando as APIs REST oficiais (PostgREST e GoTrue)
 * via fetch, sem dependência adicional.
 *
 * ESTADO: preparado, porém NÃO testado contra um projeto real, porque o Supabase
 * ainda não foi configurado. Só é ativado quando VITE_SUPABASE_URL e
 * VITE_SUPABASE_ANON_KEY estiverem definidas. Esquema e políticas: supabase/schema.sql.
 */

const URL_ = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '')
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export const isSupabaseConfigured = URL_.startsWith('https://') && ANON.length > 20

export interface SupabaseSession {
  accessToken: string
  email: string
  expiresAt: number
}

const SESSION_KEY = 'prainha:v1:supabase-session'

export class SupabaseError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('apikey', ANON)
  headers.set('Authorization', `Bearer ${init.token ?? ANON}`)
  if (init.body) headers.set('Content-Type', 'application/json')
  const res = await fetch(`${URL_}${path}`, { ...init, headers })
  if (!res.ok) {
    let message = `Erro ${res.status} no Supabase`
    try {
      const body = (await res.json()) as { message?: string; error_description?: string; msg?: string }
      message = body.message ?? body.error_description ?? body.msg ?? message
    } catch {
      /* corpo não-JSON */
    }
    throw new SupabaseError(message, res.status)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/* ---------- Autenticação (e-mail e senha) ---------- */

export function loadSession(): SupabaseSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as SupabaseSession
    if (typeof s.accessToken !== 'string' || typeof s.expiresAt !== 'number' || s.expiresAt < Date.now()) return null
    return s
  } catch {
    return null
  }
}

export async function signIn(email: string, password: string): Promise<SupabaseSession> {
  const data = await request<{ access_token: string; expires_in: number; user: { email: string } }>(
    '/auth/v1/token?grant_type=password',
    { method: 'POST', body: JSON.stringify({ email, password }) },
  )
  const session: SupabaseSession = {
    accessToken: data.access_token,
    email: data.user.email,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export async function signOut(session: SupabaseSession | null): Promise<void> {
  sessionStorage.removeItem(SESSION_KEY)
  if (session) {
    await request('/auth/v1/logout', { method: 'POST', token: session.accessToken }).catch(() => undefined)
  }
}

/* ---------- Mapeamento linhas <-> domínio ---------- */

interface ProductRow {
  id: string
  slug: string
  name: string
  description: string
  category_id: string
  price_cents: number
  weight_grams: number | null
  proteins: string[]
  tags: string[]
  ingredients: string[]
  contains: string[]
  vegetarian: boolean
  vegan: boolean
  nutrition: unknown
  available: boolean
  featured: boolean
  demo: boolean
  art: unknown
}

function rowToProduct(r: ProductRow): Product | null {
  return parseProduct({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    categoryId: r.category_id,
    price: r.price_cents,
    weightGrams: r.weight_grams,
    proteins: r.proteins,
    tags: r.tags,
    ingredients: r.ingredients,
    contains: r.contains,
    vegetarian: r.vegetarian,
    vegan: r.vegan,
    nutrition: r.nutrition,
    available: r.available,
    featured: r.featured,
    demo: r.demo,
    art: r.art,
  })
}

function productToRow(p: Product): ProductRow {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    category_id: p.categoryId,
    price_cents: p.price,
    weight_grams: p.weightGrams,
    proteins: p.proteins,
    tags: p.tags,
    ingredients: p.ingredients,
    contains: p.contains,
    vegetarian: p.vegetarian,
    vegan: p.vegan,
    nutrition: p.nutrition,
    available: p.available,
    featured: p.featured,
    demo: p.demo,
    art: p.art,
  }
}

/* ---------- Leitura pública ---------- */

export async function fetchCatalog(): Promise<{ products: Product[]; categories: Category[] }> {
  const [productRows, categoryRows] = await Promise.all([
    request<ProductRow[]>('/rest/v1/products?select=*&order=name'),
    request<Array<{ id: string; name: string; description: string; sort_order: number }>>(
      '/rest/v1/categories?select=*&order=sort_order',
    ),
  ])
  return {
    products: productRows.map(rowToProduct).filter((p): p is Product => p !== null),
    categories: categoryRows.map((c) => ({ id: c.id, name: c.name, description: c.description, order: c.sort_order })),
  }
}

export async function fetchBusinessInfo(): Promise<Partial<BusinessInfo>> {
  const rows = await request<Array<{ data: unknown }>>('/rest/v1/business_info?select=data&id=eq.1')
  return parseBusinessInfo(rows[0]?.data) ?? {}
}

/** Pedidos podem ser registrados pelo público (RLS: somente insert). */
export async function insertOrder(order: OrderRecord): Promise<void> {
  await request('/rest/v1/orders', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      id: order.id,
      created_at: order.createdAt,
      customer_name: order.customerName,
      notes: order.notes,
      fulfillment: order.fulfillment,
      items: order.items,
      total_cents: order.total,
      status: order.status,
    }),
  })
}

/* ---------- Escrita (requer usuário administrador autenticado) ---------- */

export async function upsertProduct(session: SupabaseSession, product: Product): Promise<void> {
  await request('/rest/v1/products', {
    method: 'POST',
    token: session.accessToken,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(productToRow(product)),
  })
}

export async function deleteProduct(session: SupabaseSession, id: string): Promise<void> {
  await request(`/rest/v1/products?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', token: session.accessToken })
}

export async function upsertCategory(session: SupabaseSession, c: Category): Promise<void> {
  await request('/rest/v1/categories', {
    method: 'POST',
    token: session.accessToken,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id: c.id, name: c.name, description: c.description, sort_order: c.order }),
  })
}

export async function deleteCategory(session: SupabaseSession, id: string): Promise<void> {
  await request(`/rest/v1/categories?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', token: session.accessToken })
}

export async function saveBusinessInfo(session: SupabaseSession, info: BusinessInfo): Promise<void> {
  await request('/rest/v1/business_info', {
    method: 'POST',
    token: session.accessToken,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id: 1, data: info }),
  })
}

export async function fetchOrders(session: SupabaseSession): Promise<OrderRecord[]> {
  const rows = await request<Array<Record<string, unknown>>>('/rest/v1/orders?select=*&order=created_at.desc', {
    token: session.accessToken,
  })
  return (
    parseOrders(
      rows.map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        customerName: r.customer_name,
        notes: r.notes,
        fulfillment: r.fulfillment,
        items: r.items,
        total: r.total_cents,
        status: r.status,
      })),
    ) ?? []
  )
}

export async function updateOrderStatus(session: SupabaseSession, id: string, status: OrderStatus): Promise<void> {
  await request(`/rest/v1/orders?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    token: session.accessToken,
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status }),
  })
}
