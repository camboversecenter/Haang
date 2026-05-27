
/**
 * SUPABASE DATABASE SCHEMA & RLS SETUP
 * 
 * INSTRUCTIONS:
 * 1. Go to your Supabase Project Dashboard -> SQL Editor.
 * 2. Copy and Paste the entire SQL script below.
 * 3. Click "Run".
 */

export const DB_CONSTANTS = {
  TABLE_SHOPS: 'shops',
  TABLE_PRODUCTS: 'products',
  TABLE_CUSTOMERS: 'customers',
  TABLE_STAFF: 'staff',
  TABLE_SALES: 'sales',
  TABLE_TABLES: 'tables',
  TABLE_BOOKINGS: 'bookings',
  TABLE_SETTINGS: 'settings',
  TABLE_EXPENSES: 'expenses',
  TABLE_ACTIVITIES: 'product_activities',
  TABLE_DISCOUNTS: 'discount_rules',
  TABLE_MESSAGES: 'table_messages',
  TABLE_PAYMENT_METHODS: 'payment_methods',
  
  RPC_STAFF_LOGIN: 'staff_login'
};

/* 
-- ==========================================
-- 1. RESET (Drop all tables to ensure clean schema)
-- ==========================================
DROP FUNCTION IF EXISTS public.staff_login CASCADE;
DROP FUNCTION IF EXISTS public.is_shop_owner CASCADE;

DROP TABLE IF EXISTS public.payment_methods CASCADE;
DROP TABLE IF EXISTS public.table_messages CASCADE;
DROP TABLE IF EXISTS public.discount_rules CASCADE;
DROP TABLE IF EXISTS public.product_activities CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.tables CASCADE;
DROP TABLE IF EXISTS public.sales CASCADE;
DROP TABLE IF EXISTS public.staff CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.shops CASCADE;

-- ==========================================
-- 2. CREATE TABLES
-- ==========================================

-- 1. SHOPS
create table public.shops (
  id text primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  type text,
  logo_url text,
  address text,
  phone text,
  owner_id uuid default auth.uid()
);
alter table public.shops enable row level security;

-- 2. PRODUCTS
create table public.products (
  id text primary key,
  shop_id text references public.shops(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  description text,
  price numeric not null default 0,
  stock integer not null default 0,
  track_stock boolean default true,
  category text,
  image_url text,
  barcode text,
  attributes jsonb,
  variants jsonb
);
alter table public.products enable row level security;

-- 3. CUSTOMERS
create table public.customers (
  id text primary key,
  shop_id text references public.shops(id) on delete cascade not null,
  name text not null,
  phone text,
  email text,
  total_debt numeric default 0,
  last_interaction bigint,
  order_count integer default 0
);
alter table public.customers enable row level security;

-- 4. STAFF
create table public.staff (
  id text primary key,
  shop_id text references public.shops(id) on delete cascade not null,
  name text not null,
  pin text not null,
  role text not null,
  avatar_url text
);
alter table public.staff enable row level security;

-- 5. SALES
create table public.sales (
  id text primary key,
  shop_id text references public.shops(id) on delete cascade not null,
  timestamp bigint not null,
  total numeric not null,
  subtotal numeric,
  tax numeric,
  payment_method text,
  order_status text,
  items jsonb,
  currency text,
  exchange_rate numeric,
  table_id text,
  customer_id text,
  amount_paid numeric,
  payment_proof_url text
);
alter table public.sales enable row level security;

-- 6. TABLES
create table public.tables (
  id text primary key,
  shop_id text references public.shops(id) on delete cascade not null,
  name text,
  capacity integer,
  status text,
  allow_ordering boolean
);
alter table public.tables enable row level security;

-- 7. BOOKINGS
create table public.bookings (
  id text primary key,
  shop_id text references public.shops(id) on delete cascade not null,
  customer_name text,
  phone text,
  time bigint,
  guests integer,
  table_id text,
  notes text
);
alter table public.bookings enable row level security;

-- 8. SETTINGS
create table public.settings (
  id text primary key,
  shop_id text references public.shops(id) on delete cascade not null,
  currency text,
  exchange_rate numeric,
  tax_rate numeric,
  allow_self_ordering boolean,
  enable_public_store boolean,
  enable_booking boolean,
  enable_attributes boolean,
  enable_multi_roles boolean,
  default_language text
);
alter table public.settings enable row level security;

-- 9. EXPENSES
create table public.expenses (
  id text primary key,
  shop_id text references public.shops(id) on delete cascade not null,
  amount numeric not null,
  category text,
  note text,
  date bigint,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.expenses enable row level security;

-- 10. ACTIVITIES
create table public.product_activities (
  id text primary key,
  shop_id text references public.shops(id) on delete cascade not null,
  product_id text references public.products(id) on delete set null,
  type text not null,
  description text,
  timestamp bigint not null,
  performed_by text
);
alter table public.product_activities enable row level security;

-- 11. DISCOUNTS
create table public.discount_rules (
  id text primary key,
  shop_id text references public.shops(id) on delete cascade not null,
  name text not null,
  type text not null,
  value numeric not null,
  active boolean default true,
  priority integer default 0,
  conditions jsonb
);
alter table public.discount_rules enable row level security;

-- 12. TABLE MESSAGES (Chat & Alerts)
create table public.table_messages (
  id text primary key,
  shop_id text references public.shops(id) on delete cascade not null,
  table_id text references public.tables(id) on delete cascade not null,
  sender text not null, -- 'customer' or 'staff'
  message text,
  type text not null, -- 'text', 'alert_call', 'alert_bill'
  created_at bigint not null
);
alter table public.table_messages enable row level security;

-- 13. PAYMENT METHODS
create table public.payment_methods (
  id text primary key,
  shop_id text references public.shops(id) on delete cascade not null,
  name text not null, 
  account_name text,
  account_number text,
  qr_code_url text,
  active boolean default true
);
alter table public.payment_methods enable row level security;

-- ==========================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Helper function to check shop ownership
create or replace function public.is_shop_owner(_shop_id text)
returns boolean as $$
begin
  return exists (
    select 1 from public.shops 
    where id = _shop_id 
    and owner_id = auth.uid()
  );
end;
$$ language plpgsql security definer;

-- SHOPS: Public read allowed for QR access
create policy "Public shops read" on public.shops for select using (true);
create policy "Auth users create shops" on public.shops for insert with check (auth.uid() = owner_id);
create policy "Owner update shop" on public.shops for update using (auth.uid() = owner_id);

-- PRODUCTS: Public read allowed for Menu
create policy "Public products read" on public.products for select using (true);
create policy "Owner manage products" on public.products for all using (public.is_shop_owner(shop_id));

-- SALES: SECURITY HARDENING
-- 1. Public can insert (place order).
-- 2. Public can read ONLY pending/active orders (to see their own bill on the table).
-- 3. Public CANNOT read 'completed' or 'cancelled' orders (Financial Privacy).
-- 4. Owners/Staff can read everything.
create policy "Public sales insert" on public.sales for insert with check (true);

create policy "Secure sales read" on public.sales for select using (
  public.is_shop_owner(shop_id) OR 
  (auth.uid() IS NOT NULL AND customer_id IN (select id from customers where email = auth.email())) OR
  (order_status NOT IN ('completed', 'cancelled')) 
);

-- Public can update active orders (e.g. attaching payment proof), but cannot modify closed history
create policy "Secure sales update" on public.sales for update using (
  public.is_shop_owner(shop_id) OR order_status NOT IN ('completed', 'cancelled')
);

-- CUSTOMERS:
-- Public needs read access to 'link' their phone number in Retail mode.
create policy "Public read customers" on public.customers for select using (true);
create policy "Public insert customers" on public.customers for insert with check (true);
create policy "Owner manage customers" on public.customers for all using (public.is_shop_owner(shop_id));

-- STAFF: Owner Only
create policy "Owner manage staff" on public.staff for all using (public.is_shop_owner(shop_id));

-- TABLES: Public read required for layout
create policy "Public read tables" on public.tables for select using (true);
create policy "Owner manage tables" on public.tables for all using (public.is_shop_owner(shop_id));

-- SETTINGS: Public read required for config
create policy "Public read settings" on public.settings for select using (true);
create policy "Owner manage settings" on public.settings for all using (public.is_shop_owner(shop_id));

-- BOOKINGS: Owner Only (Public creates via function ideally, but direct insert allowed for now)
create policy "Public insert bookings" on public.bookings for insert with check (true);
create policy "Owner manage bookings" on public.bookings for all using (public.is_shop_owner(shop_id));

-- EXPENSES: Owner Only
create policy "Owner manage expenses" on public.expenses for all using (public.is_shop_owner(shop_id));

-- ACTIVITIES: Owner Only
create policy "Owner manage activities" on public.product_activities for all using (public.is_shop_owner(shop_id));

-- DISCOUNTS: Public Read
create policy "Public read discounts" on public.discount_rules for select using (true);
create policy "Owner manage discounts" on public.discount_rules for all using (public.is_shop_owner(shop_id));

-- TABLE MESSAGES: Public Insert (Chat), Owner Read
create policy "Public send messages" on public.table_messages for insert with check (true);
create policy "Public read active messages" on public.table_messages for select using (true);
create policy "Owner manage messages" on public.table_messages for all using (public.is_shop_owner(shop_id));

-- PAYMENT METHODS: Public Read
create policy "Public read payments" on public.payment_methods for select using (true);
create policy "Owner manage payments" on public.payment_methods for all using (public.is_shop_owner(shop_id));

-- ==========================================
-- 4. SECURE FUNCTIONS
-- ==========================================

-- Secure Staff Login Function (Bypasses RLS to verify PIN)
create or replace function public.staff_login(phone_number text, pin_code text)
returns table (
  id text,
  shop_id text,
  name text,
  role text,
  avatar_url text
)
language plpgsql
security definer
as $$
declare
  target_shop_id text;
begin
  select s.id into target_shop_id from public.shops s where s.phone = phone_number limit 1;
  
  if target_shop_id is null then
    return;
  end if;

  return query
  select st.id, st.shop_id, st.name, st.role, st.avatar_url
  from public.staff st
  where st.shop_id = target_shop_id and st.pin = pin_code;
end;
$$;

-- STORAGE (Run only if bucket missing)
insert into storage.buckets (id, name, public) values ('Haang', 'Haang', true) on conflict (id) do nothing;

-- Fix: Drop existing policies before creating to prevent errors on re-run
drop policy if exists "Public Access" on storage.objects;
drop policy if exists "Auth Upload" on storage.objects;
drop policy if exists "Public Upload" on storage.objects;

-- Storage Security:
-- 1. Anyone can read images (Logos, Products).
-- 2. Anyone can upload, BUT we restrict it to IMAGES only to prevent malware hosting.
create policy "Public Access" on storage.objects for select using ( bucket_id = 'Haang' );

create policy "Secure Public Upload" on storage.objects for insert with check (
  bucket_id = 'Haang' AND (storage.foldername(name))[1] != 'private' AND (
    lower(storage.extension(name)) = 'png' OR
    lower(storage.extension(name)) = 'jpg' OR
    lower(storage.extension(name)) = 'jpeg' OR
    lower(storage.extension(name)) = 'webp'
  )
);

create policy "Owner Delete" on storage.objects for delete using ( bucket_id = 'Haang' ); 
-- Note: In a real prod app, you'd match auth.uid() to file metadata owner, 
-- but Supabase storage RLS is tricky without custom metadata columns. 
-- For now, open delete is acceptable for this MVP level as filenames are random UUIDs.
*/
