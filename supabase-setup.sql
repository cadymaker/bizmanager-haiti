-- ============================================================
-- BizManager Haiti — Konfigirasyon baz done Supabase
-- ============================================================
-- Fichye sa a rasanble tout kòmand SQL ki nesesè pou pwojè a.
-- Li fèt pou kouri nan Supabase → SQL Editor.
--
-- ENPÒTAN: Fichye sa a kouvri sèlman sa nou te ajoute nan faz
-- barcode / kès / stock. Tab debaz yo (businesses, products,
-- invoices, payments, clients, expenses, business_users) te
-- kreye anvan — yo PA nan fichye sa a.
--
-- Tout kòmand yo "idempotent" (ou ka kouri yo plizyè fwa san
-- kraze anyen).
-- ============================================================


-- ============================================================
-- 1) HELPER RLS — biznis itilizatè a fè pati
-- ============================================================
-- SECURITY DEFINER pou evite rekursyon RLS sou business_users.
-- Tout règ RLS anba yo sèvi ak fonksyon sa a.

create or replace function public.current_user_business_ids()
returns setof uuid
language sql
security definer
set search_path = public
as $$
  select business_id from public.business_users where user_id = auth.uid()
$$;


-- ============================================================
-- 2) BARCODE — kolòn barcode sou pwodwi yo
-- ============================================================

alter table public.products
  add column if not exists barcode text;

create index if not exists idx_products_barcode
  on public.products(business_id, barcode);


-- ============================================================
-- 3) SESYON KÈS — ouvèti, fèmti, Rapò Z
-- ============================================================

create table if not exists public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  opened_by uuid not null,
  closed_by uuid,
  status text not null default 'OPEN' check (status in ('OPEN','CLOSED')),
  opening_amount numeric not null default 0,   -- Fon de kès (montan ouvèti)
  cash_out numeric not null default 0,         -- Sòti espès pandan jounen an
  counted_amount numeric,                      -- Kòb kesye konte reyèlman (fèmti)
  total_cash_sales numeric,                    -- Snapshot: total vant cash (fèmti)
  expected_amount numeric,                     -- Snapshot: montan atann (fèmti)
  ecart numeric,                               -- Snapshot: diferans (fèmti)
  currency text not null default 'HTG',
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

-- Youn sèl kès OPEN pa biznis alafwa
create unique index if not exists idx_one_open_session_per_business
  on public.cash_sessions(business_id)
  where status = 'OPEN';

-- Lyen ant vant yo ak sesyon an
alter table public.invoices add column if not exists session_id uuid references public.cash_sessions(id);
alter table public.payments add column if not exists session_id uuid references public.cash_sessions(id);
create index if not exists idx_invoices_session on public.invoices(session_id);
create index if not exists idx_payments_session on public.payments(session_id);

-- RLS
alter table public.cash_sessions enable row level security;

drop policy if exists cash_sessions_select on public.cash_sessions;
create policy cash_sessions_select on public.cash_sessions
  for select using (business_id in (select public.current_user_business_ids()));

drop policy if exists cash_sessions_insert on public.cash_sessions;
create policy cash_sessions_insert on public.cash_sessions
  for insert with check (business_id in (select public.current_user_business_ids()));

drop policy if exists cash_sessions_update on public.cash_sessions;
create policy cash_sessions_update on public.cash_sessions
  for update using (business_id in (select public.current_user_business_ids()));


-- ============================================================
-- 4) AKSÈ MANM BIZNIS — pou kesye ka fè vant
-- ============================================================
-- Règ sa yo bay TOUT manm biznis lan (mèt ak kesye) aksè.
-- Yo AJOUTE sou règ ki egziste deja — nan RLS, règ "permissive"
-- konbine ak OSWA, kidonk sa pa retire okenn aksè.

-- PRODUCTS: li ak modifye stock
drop policy if exists products_select_members on public.products;
create policy products_select_members on public.products
  for select using (business_id in (select public.current_user_business_ids()));

drop policy if exists products_update_members on public.products;
create policy products_update_members on public.products
  for update using (business_id in (select public.current_user_business_ids()));

-- INVOICES: li ak kreye
drop policy if exists invoices_select_members on public.invoices;
create policy invoices_select_members on public.invoices
  for select using (business_id in (select public.current_user_business_ids()));

drop policy if exists invoices_insert_members on public.invoices;
create policy invoices_insert_members on public.invoices
  for insert with check (business_id in (select public.current_user_business_ids()));

-- PAYMENTS: li ak kreye
drop policy if exists payments_select_members on public.payments;
create policy payments_select_members on public.payments
  for select using (business_id in (select public.current_user_business_ids()));

drop policy if exists payments_insert_members on public.payments;
create policy payments_insert_members on public.payments
  for insert with check (business_id in (select public.current_user_business_ids()));


-- ============================================================
-- 5) AJISTEMAN STOCK — pèt, gate, ekspire
-- ============================================================

create table if not exists public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  product_name text not null,             -- kopi non an (si pwodwi a efase pita)
  quantity integer not null,              -- kantite retire (toujou pozitif)
  reason text not null check (reason in ('lost','damaged','expired','other')),
  note text,
  unit_cost numeric not null default 0,   -- pri acha nan moman an
  total_cost numeric not null default 0,  -- kantite x pri acha = valè pèt la
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_stock_adj_business on public.stock_adjustments(business_id, created_at desc);
create index if not exists idx_stock_adj_product on public.stock_adjustments(product_id);

-- RLS
alter table public.stock_adjustments enable row level security;

drop policy if exists stock_adj_select on public.stock_adjustments;
create policy stock_adj_select on public.stock_adjustments
  for select using (business_id in (select public.current_user_business_ids()));

drop policy if exists stock_adj_insert on public.stock_adjustments;
create policy stock_adj_insert on public.stock_adjustments
  for insert with check (business_id in (select public.current_user_business_ids()));


-- ============================================================
-- FEN
-- ============================================================