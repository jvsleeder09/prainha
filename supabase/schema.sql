-- =====================================================================
-- Prainha — esquema do banco (Supabase / PostgreSQL)
-- ESTADO: preparado, NÃO aplicado (o projeto Supabase ainda não existe).
-- Como aplicar: Supabase Studio > SQL Editor > colar e executar.
-- =====================================================================

-- Administradores: usuários do Supabase Auth autorizados a editar o catálogo.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

create table if not exists public.categories (
  id text primary key,
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  sort_order integer not null default 0
);

create table if not exists public.products (
  id text primary key,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null check (char_length(name) between 3 and 120),
  description text not null default '',
  category_id text not null references public.categories (id) on update cascade,
  price_cents integer not null check (price_cents > 0),
  weight_grams integer check (weight_grams is null or weight_grams > 0),
  proteins text[] not null default '{}',
  tags text[] not null default '{}',
  ingredients text[] not null default '{}',
  contains text[] not null default '{}',
  vegetarian boolean not null default false,
  vegan boolean not null default false,
  nutrition jsonb,
  available boolean not null default true,
  featured boolean not null default false,
  demo boolean not null default false,
  art jsonb not null default '{"main":"#E3A857","side":"#F5EFE2","garnish":"#4E8B3A"}',
  updated_at timestamptz not null default now()
);

-- Linha única com as informações comerciais (id = 1).
create table if not exists public.business_info (
  id smallint primary key default 1 check (id = 1),
  data jsonb not null default '{}'
);

create table if not exists public.orders (
  id text primary key,
  created_at timestamptz not null default now(),
  customer_name text not null default '' check (char_length(customer_name) <= 120),
  notes text not null default '' check (char_length(notes) <= 1000),
  fulfillment text not null check (fulfillment in ('entrega', 'retirada')),
  items jsonb not null,
  total_cents integer not null check (total_cents >= 0),
  status text not null default 'enviado' check (status in ('enviado', 'confirmado', 'entregue', 'cancelado'))
);

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.admin_users enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.business_info enable row level security;
alter table public.orders enable row level security;

-- Leitura pública do cardápio e das informações comerciais
create policy "categorias: leitura pública" on public.categories for select using (true);
create policy "produtos: leitura pública" on public.products for select using (true);
create policy "info: leitura pública" on public.business_info for select using (true);

-- Escrita apenas por administradores
create policy "categorias: admin escreve" on public.categories for all using (public.is_admin()) with check (public.is_admin());
create policy "produtos: admin escreve" on public.products for all using (public.is_admin()) with check (public.is_admin());
create policy "info: admin escreve" on public.business_info for all using (public.is_admin()) with check (public.is_admin());

-- Pedidos: qualquer visitante pode REGISTRAR (insert) um pedido novo; só admin lê e altera.
create policy "pedidos: público registra" on public.orders for insert with check (status = 'enviado');
create policy "pedidos: admin lê" on public.orders for select using (public.is_admin());
create policy "pedidos: admin altera" on public.orders for update using (public.is_admin()) with check (public.is_admin());

-- Administradores só podem ver o próprio registro.
create policy "admins: vê a si mesmo" on public.admin_users for select using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Depois de criar o usuário em Authentication > Users, torne-o administrador:
--   insert into public.admin_users (user_id) values ('<UUID-do-usuário>');
-- ---------------------------------------------------------------------
