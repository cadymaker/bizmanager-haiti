-- ============================================================
-- BizManager Haiti — Konfigirasyon baz done Supabase
-- ============================================================
-- Fichye sa a rasanble tout kòmand SQL nou ajoute nan pwojè a.
-- Li fèt pou kouri nan Supabase → SQL Editor.
--
-- ENPÒTAN: Fichye sa a kouvri sa nou ajoute nan faz barcode /
-- kès / stock / promo / rapò. Tab debaz yo (businesses, products,
-- invoices, payments, clients, expenses, investments,
-- business_users, payment_requests) te kreye anvan — estrikti
-- debaz yo PA nan fichye sa a, sèlman kolòn nou ajoute yo.
--
-- Tout kòmand yo "idempotent" (ou ka kouri yo plizyè fwa san
-- kraze anyen), eksepte seksyon 9 (vi a) ki fè yon drop/create.
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
-- 2) BARCODE ak ALÈT STOCK — kolòn sou pwodwi yo
-- ============================================================

alter table public.products
  add column if not exists barcode text;

-- Seuil alèt stock pa pwodwi (si null, app la itilize 5)
alter table public.products
  add column if not exists low_stock_threshold integer;

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

alter table public.stock_adjustments enable row level security;

drop policy if exists stock_adj_select on public.stock_adjustments;
create policy stock_adj_select on public.stock_adjustments
  for select using (business_id in (select public.current_user_business_ids()));

drop policy if exists stock_adj_insert on public.stock_adjustments;
create policy stock_adj_insert on public.stock_adjustments
  for insert with check (business_id in (select public.current_user_business_ids()));


-- ============================================================
-- 6) REZON EFASMAN KONT
-- ============================================================
-- PA gen FK espre — li dwe siviv efasman biznis la (cascade).
-- RLS aktive SAN okenn règ: sèlman service role (sèvè a) ka li/ekri.

create table if not exists public.deletion_feedback (
  id uuid primary key default gen_random_uuid(),
  business_id uuid,
  business_name text,
  owner_name text,
  email text,
  phone text,
  niche text,
  license_status text,
  reason text not null,
  note text,
  account_created_at timestamptz,
  deleted_at timestamptz not null default now()
);

create index if not exists idx_deletion_feedback_date
  on public.deletion_feedback(deleted_at desc);

alter table public.deletion_feedback enable row level security;


-- ============================================================
-- 7) PWOMOSYON ak RABÈ
-- ============================================================

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  code text not null,                    -- kòd la (egz. NWEL2026)
  label text,                            -- deskripsyon kout
  discount_type text not null check (discount_type in ('percent','fixed')),
  discount_value numeric not null check (discount_value > 0),
  min_amount numeric,                    -- minimòm acha (opsyonèl)
  starts_at date,                        -- dat kòmansman (opsyonèl)
  ends_at date,                          -- dat fen (opsyonèl)
  is_active boolean not null default true,
  times_used integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- Yon sèl kòd pa biznis (san diferans miniskil/majiskil)
create unique index if not exists idx_promo_code_per_business
  on public.promotions(business_id, upper(code));

create index if not exists idx_promo_business on public.promotions(business_id, is_active);

-- Kolòn rabè sou fakti yo
alter table public.invoices add column if not exists discount_type text;
alter table public.invoices add column if not exists discount_value numeric not null default 0;
alter table public.invoices add column if not exists discount_amount numeric not null default 0;
alter table public.invoices add column if not exists promo_code text;

-- RLS
alter table public.promotions enable row level security;

drop policy if exists promotions_select on public.promotions;
create policy promotions_select on public.promotions
  for select using (business_id in (select public.current_user_business_ids()));

drop policy if exists promotions_insert on public.promotions;
create policy promotions_insert on public.promotions
  for insert with check (business_id in (select public.current_user_business_ids()));

drop policy if exists promotions_update on public.promotions;
create policy promotions_update on public.promotions
  for update using (business_id in (select public.current_user_business_ids()));

drop policy if exists promotions_delete on public.promotions;
create policy promotions_delete on public.promotions
  for delete using (business_id in (select public.current_user_business_ids()));

-- Migrasyon: kopi ansyen rabè yo (nan metadata) nan nouvo kolòn nan
update public.invoices
set discount_amount = (metadata->>'discount')::numeric
where discount_amount = 0
  and metadata->>'discount' is not null
  and (metadata->>'discount')::numeric > 0;


-- ============================================================
-- 8) KALITE ENVESTISMAN — acha machandiz vs kapital
-- ============================================================
-- Acha machandiz konte kòm kou lè pwodwi a vann (li pa yon depans).
-- Kapital se ekipman/mèb ki rete nan biznis la.

alter table public.investments
  add column if not exists type text not null default 'merchandise'
  check (type in ('merchandise','capital'));

create index if not exists idx_investments_type
  on public.investments(business_id, type);


-- ============================================================
-- 9) VI dashboard_metrics
-- ============================================================
-- Benefis nèt = Vant − Kou pwodwi vann − Depans − Pèt nan stock
-- (Menm fòmil ak paj Rapò a. Envestisman PA antre nan kalkil la.)
--
-- NÒT: nou fè drop/create paske create-or-replace pa ka ajoute
-- kolòn nan mitan yon vi ki egziste.

drop view if exists public.dashboard_metrics;

create view public.dashboard_metrics as
select
  b.id as business_id,
  b.business_name,
  b.license_status,
  b.trial_start_date,
  b.license_expiry_date,

  -- Vant total (total_amount gen rabè ladan deja)
  coalesce((
    select sum(i.total_amount) from invoices i
    where i.business_id = b.id
      and i.status = any (array['sent','partial','paid'])
  ), 0) as total_sales,

  -- Kach reyèlman resevwa
  coalesce((
    select sum(i.amount_paid) from invoices i
    where i.business_id = b.id
  ), 0) as total_cash_received,

  -- Envestisman total (enfòmasyon)
  coalesce((
    select sum(iv.amount) from investments iv
    where iv.business_id = b.id
  ), 0) as total_investments,

  -- Acha machandiz (stòk pou revann)
  coalesce((
    select sum(iv.amount) from investments iv
    where iv.business_id = b.id and coalesce(iv.type, 'merchandise') = 'merchandise'
  ), 0) as total_merchandise,

  -- Kapital (ekipman, mèb)
  coalesce((
    select sum(iv.amount) from investments iv
    where iv.business_id = b.id and iv.type = 'capital'
  ), 0) as total_capital,

  -- Depans operasyonèl
  coalesce((
    select sum(e.amount) from expenses e
    where e.business_id = b.id
  ), 0) as total_expenses,

  -- Valè stock nan pri vant
  coalesce((
    select sum(p.sale_price * p.quantity) from products p
    where p.business_id = b.id
  ), 0) as total_stock_value,

  -- Valè stock nan pri acha
  coalesce((
    select sum(p.purchase_price * p.quantity) from products p
    where p.business_id = b.id
  ), 0) as total_stock_cost,

  -- Kou pwodwi vann yo: pri acha aktyèl x kantite vann
  coalesce((
    select sum(
      coalesce((
        select pr.purchase_price from products pr
        where pr.id = (it->>'product_id')::uuid
      ), 0) * coalesce((it->>'quantity')::numeric, 0)
    )
    from invoices i
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(i.metadata->'items') = 'array'
        then i.metadata->'items'
        else '[]'::jsonb
      end
    ) as it
    where i.business_id = b.id
      and i.status = any (array['sent','partial','paid'])
      and it->>'product_id' is not null
  ), 0) as total_cogs,

  -- Pèt nan stock (valorize nan pri acha)
  coalesce((
    select sum(sa.total_cost) from stock_adjustments sa
    where sa.business_id = b.id
  ), 0) as total_stock_loss,

  -- Total rabè bay kliyan yo
  coalesce((
    select sum(
      case
        when i.discount_amount > 0 then i.discount_amount
        else coalesce((i.metadata->>'discount')::numeric, 0)
      end
    )
    from invoices i
    where i.business_id = b.id
      and i.status = any (array['sent','partial','paid'])
  ), 0) as total_discount,

  -- ===== BENEFIS NÈT =====
  coalesce((
    select sum(i.total_amount) from invoices i
    where i.business_id = b.id
      and i.status = any (array['sent','partial','paid'])
  ), 0)
  - coalesce((
    select sum(
      coalesce((
        select pr.purchase_price from products pr
        where pr.id = (it->>'product_id')::uuid
      ), 0) * coalesce((it->>'quantity')::numeric, 0)
    )
    from invoices i
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(i.metadata->'items') = 'array'
        then i.metadata->'items'
        else '[]'::jsonb
      end
    ) as it
    where i.business_id = b.id
      and i.status = any (array['sent','partial','paid'])
      and it->>'product_id' is not null
  ), 0)
  - coalesce((
    select sum(e.amount) from expenses e
    where e.business_id = b.id
  ), 0)
  - coalesce((
    select sum(sa.total_cost) from stock_adjustments sa
    where sa.business_id = b.id
  ), 0) as net_profit,

  -- Dèt kliyan
  coalesce((
    select sum(i.balance_due) from invoices i
    where i.business_id = b.id
      and i.status = any (array['sent','partial'])
  ), 0) as total_receivables

from businesses b;


-- ============================================================
-- FEN
-- ============================================================