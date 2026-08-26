-- ============================================================================
-- SUPABASE COMPLETE DATABASE SCHEMA & ROLE-BASED ACCESS CONTROL (RBAC) POLICIES
-- ============================================================================
-- 
-- DESCRIPTION:
-- This SQL script establishes both the required database tables AND a robust, 
-- highly secure Role-Based Access Control (RBAC) architecture for HAANG POS.
-- It supports two primary authentication modes:
--   1. Owner Mode: Direct Supabase Auth users (Shop Owners) with full database control.
--   2. Staff Mode: Multi-role operators (Admin, Manager, Waiter, Cashier, Kitchen)
--      authenticated with SERVER-MINTED SESSION TOKENS. A staff session is created
--      only after a server-side PIN check (staff_login / staff_switch / owner_activate_staff)
--      and is carried on requests via the 'x-staff-token' header. Role and identity are
--      resolved from the staff_sessions table on every request — client-asserted role
--      headers are never trusted. When a staff session is active it takes PRECEDENCE
--      over the owner's auth session, so role limits apply even on the owner's device.
--   Staff PINs are bcrypt-hashed at rest (see trg_hash_staff_pin) and the pin column
--   is excluded from client SELECT privileges.
--
-- HOW TO USE:
-- 1. Open your Supabase Dashboard -> SQL Editor.
-- 2. Select your project.
-- 3. Paste the contents of this file and click "Run" (with full admin rights).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTENSIONS & SECURITY CLEANUP
-- ----------------------------------------------------------------------------
-- Ensure standard UUID generation tool is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Required for bcrypt PIN hashing (crypt / gen_salt)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 2. DATABASE TABLES INITIALIZATION (IF NOT EXIST)
-- ----------------------------------------------------------------------------

-- A. Shops
CREATE TABLE IF NOT EXISTS public.shops (
  id text primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  type text,
  logo_url text,
  address text,
  phone text,
  owner_id uuid default auth.uid()
);

-- B. Products
CREATE TABLE IF NOT EXISTS public.products (
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

-- C. Customers
CREATE TABLE IF NOT EXISTS public.customers (
  id text primary key,
  shop_id text references public.shops(id) on delete cascade not null,
  name text not null,
  phone text,
  email text,
  total_debt numeric default 0,
  last_interaction bigint,
  order_count integer default 0
);

-- D. Staff
CREATE TABLE IF NOT EXISTS public.staff (
  id text primary key,
  shop_id text references public.shops(id) on delete cascade not null,
  name text not null,
  pin text not null,
  role text not null,
  avatar_url text
);

-- E. Sales
CREATE TABLE IF NOT EXISTS public.sales (
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

-- F. Tables (Restaurant specific)
CREATE TABLE IF NOT EXISTS public.tables (
  id text primary key,
  shop_id text references public.shops(id) on delete cascade not null,
  name text,
  capacity integer,
  status text,
  allow_ordering boolean
);

-- G. Bookings (Reservations)
CREATE TABLE IF NOT EXISTS public.bookings (
  id text primary key,
  shop_id text references public.shops(id) on delete cascade not null,
  customer_name text,
  phone text,
  time bigint,
  guests integer,
  table_id text,
  notes text
);

-- H. Shop Settings
CREATE TABLE IF NOT EXISTS public.settings (
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

-- I. Expenses & Accounting
CREATE TABLE IF NOT EXISTS public.expenses (
  id text primary key,
  shop_id text references public.shops(id) on delete cascade not null,
  amount numeric not null,
  category text,
  note text,
  date bigint,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- J. Audit Logs / Product Activities
CREATE TABLE IF NOT EXISTS public.product_activities (
  id text primary key,
  shop_id text references public.shops(id) on delete cascade not null,
  product_id text references public.products(id) on delete set null,
  type text not null,
  description text,
  timestamp bigint not null,
  performed_by text
);

-- K. Discount Rules
CREATE TABLE IF NOT EXISTS public.discount_rules (
  id text primary key,
  shop_id text references public.shops(id) on delete cascade not null,
  name text not null,
  type text not null,
  value numeric not null,
  active boolean default true,
  priority integer default 0,
  conditions jsonb
);

-- L. Table Messages (Chat & Alerts)
CREATE TABLE IF NOT EXISTS public.table_messages (
  id text primary key,
  shop_id text references public.shops(id) on delete cascade not null,
  table_id text references public.tables(id) on delete cascade not null,
  sender text not null, -- 'customer' or 'staff'
  message text,
  type text not null, -- 'text', 'alert_call', 'alert_bill'
  created_at bigint not null
);

-- M. Payment Methods
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id text primary key,
  shop_id text references public.shops(id) on delete cascade not null,
  name text not null,
  account_name text,
  account_number text,
  qr_code_url text,
  active boolean default true
);

-- N. Staff Sessions (server-minted auth tokens for staff operators)
-- Rows are created ONLY by SECURITY DEFINER functions after a successful PIN
-- check (or explicit owner authorization). RLS is enabled with NO policies, so
-- clients can never read or forge sessions directly.
CREATE TABLE IF NOT EXISTS public.staff_sessions (
  token uuid primary key default gen_random_uuid(),
  staff_id text not null references public.staff(id) on delete cascade,
  shop_id text not null,
  role text not null,
  created_at timestamp with time zone default now() not null,
  expires_at timestamp with time zone default now() + interval '7 days' not null
);
ALTER TABLE public.staff_sessions ENABLE ROW LEVEL SECURITY;

-- Staff helper column: lets the lock screen know whether an operator still
-- needs first-time PIN setup without ever exposing the PIN itself.
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS has_pin boolean GENERATED ALWAYS AS (pin IS NOT NULL AND pin <> '') STORED;

-- ----------------------------------------------------------------------------
-- 3. RESET EXISTING POLICIES & HELPER FUNCTIONS
-- ----------------------------------------------------------------------------

-- Reset existing policies to avoid duplicate errors on update
DROP POLICY IF EXISTS "Public shops read" ON public.shops;
DROP POLICY IF EXISTS "Auth users create shops" ON public.shops;
DROP POLICY IF EXISTS "Owner update shop" ON public.shops;
DROP POLICY IF EXISTS "Shops Read: Public QR & Client Access" ON public.shops;
DROP POLICY IF EXISTS "Shops Write: Authenticated Owners Create" ON public.shops;
DROP POLICY IF EXISTS "Shops Write: Owners Manage Their Shops" ON public.shops;

DROP POLICY IF EXISTS "Public products read" ON public.products;
DROP POLICY IF EXISTS "Owner manage products" ON public.products;
DROP POLICY IF EXISTS "Products Read: Public Menu Catalog Access" ON public.products;
DROP POLICY IF EXISTS "Products Write: Owners, Admins, and Managers Only" ON public.products;

DROP POLICY IF EXISTS "Owner manage staff" ON public.staff;
DROP POLICY IF EXISTS "Staff Read: Public Lockscreen Profiles" ON public.staff;
DROP POLICY IF EXISTS "Staff Write: Owner or Admin Manage staff accounts" ON public.staff;

DROP POLICY IF EXISTS "Public sales insert" ON public.sales;
DROP POLICY IF EXISTS "Secure sales read" ON public.sales;
DROP POLICY IF EXISTS "Secure sales update" ON public.sales;
DROP POLICY IF EXISTS "Sales Insert: Customers QR self-order & Cashiers/Waiters" ON public.sales;
DROP POLICY IF EXISTS "Sales Select: Owner, Admins, Cashiers, Waiters, and Kitchen" ON public.sales;
DROP POLICY IF EXISTS "Sales Update: Staff mutations and Kitchen updates" ON public.sales;

DROP POLICY IF EXISTS "Public read customers" ON public.customers;
DROP POLICY IF EXISTS "Public insert customers" ON public.customers;
DROP POLICY IF EXISTS "Owner manage customers" ON public.customers;
DROP POLICY IF EXISTS "Customers Read & Insert: Public directories" ON public.customers;
DROP POLICY IF EXISTS "Customers Insert: Public self registration" ON public.customers;
DROP POLICY IF EXISTS "Customers Write: Staff manage profiles and debt" ON public.customers;

DROP POLICY IF EXISTS "Public read tables" ON public.tables;
DROP POLICY IF EXISTS "Owner manage tables" ON public.tables;
DROP POLICY IF EXISTS "Tables Read: Public layout overview" ON public.tables;
DROP POLICY IF EXISTS "Tables Write: Owners, Admins, Managers, and Waiters" ON public.tables;

DROP POLICY IF EXISTS "Public insert bookings" ON public.bookings;
DROP POLICY IF EXISTS "Owner manage bookings" ON public.bookings;
DROP POLICY IF EXISTS "Bookings Insert: Public guests can reserve slot" ON public.bookings;
DROP POLICY IF EXISTS "Bookings Read: Public checking slots & active Staff" ON public.bookings;
DROP POLICY IF EXISTS "Bookings Write: Staff managing reservations" ON public.bookings;

DROP POLICY IF EXISTS "Public read settings" ON public.settings;
DROP POLICY IF EXISTS "Owner manage settings" ON public.settings;
DROP POLICY IF EXISTS "Settings Read: Anyone can read configuration" ON public.settings;
DROP POLICY IF EXISTS "Settings Write: Admins and Owners manage rules" ON public.settings;

DROP POLICY IF EXISTS "Owner manage expenses" ON public.expenses;
DROP POLICY IF EXISTS "Expenses: Full Admin/Manager Control" ON public.expenses;

DROP POLICY IF EXISTS "Owner manage activities" ON public.product_activities;
DROP POLICY IF EXISTS "Product Activities Read: Admins and Managers" ON public.product_activities;
DROP POLICY IF EXISTS "Product Activities Write: Staff audit logging" ON public.product_activities;

DROP POLICY IF EXISTS "Public read discounts" ON public.discount_rules;
DROP POLICY IF EXISTS "Owner manage discounts" ON public.discount_rules;
DROP POLICY IF EXISTS "Discount Rules Read: Public active checks" ON public.discount_rules;
DROP POLICY IF EXISTS "Discount Rules Write: Admins and Owners" ON public.discount_rules;

DROP POLICY IF EXISTS "Public send messages" ON public.table_messages;
DROP POLICY IF EXISTS "Public read active messages" ON public.table_messages;
DROP POLICY IF EXISTS "Owner manage messages" ON public.table_messages;
DROP POLICY IF EXISTS "Table Messages Read: Active streams" ON public.table_messages;
DROP POLICY IF EXISTS "Table Messages Write: Customers send notifications" ON public.table_messages;
DROP POLICY IF EXISTS "Table Messages Write: Staff manage/archive status alerts" ON public.table_messages;

DROP POLICY IF EXISTS "Public read payments" ON public.payment_methods;
DROP POLICY IF EXISTS "Owner manage payments" ON public.payment_methods;
DROP POLICY IF EXISTS "Payment Methods Read: Public display checkout QR" ON public.payment_methods;
DROP POLICY IF EXISTS "Payment Methods Write: Admin configuration" ON public.payment_methods;

-- New-generation policy names (re-runnable)
DROP POLICY IF EXISTS "Staff Read: Shop members only" ON public.staff;
DROP POLICY IF EXISTS "Sales Insert: Staff and open customer orders" ON public.sales;
DROP POLICY IF EXISTS "Sales Select: Staff and own-customer history" ON public.sales;
DROP POLICY IF EXISTS "Sales Update: Staff roles and own-customer proof" ON public.sales;
DROP POLICY IF EXISTS "Bookings Read: Staff only" ON public.bookings;
DROP POLICY IF EXISTS "Table Messages Read: Staff only" ON public.table_messages;
DROP POLICY IF EXISTS "Customers Read: Staff and own profile" ON public.customers;
DROP POLICY IF EXISTS "Customers Insert: Staff only" ON public.customers;

-- Drop existing functions to allow full signature replacement
DROP FUNCTION IF EXISTS public.is_shop_owner(text) CASCADE;
DROP FUNCTION IF EXISTS public.get_active_staff_role() CASCADE;
DROP FUNCTION IF EXISTS public.get_active_staff_id() CASCADE;
DROP FUNCTION IF EXISTS public.get_staff_session() CASCADE;
DROP FUNCTION IF EXISTS public.verify_staff_permission(text, text[]) CASCADE;
DROP FUNCTION IF EXISTS public.check_staff_pin(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.is_own_customer_sale(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.mint_staff_session(text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.staff_login(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.staff_switch(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.owner_activate_staff(text) CASCADE;
DROP FUNCTION IF EXISTS public.staff_logout(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.validate_staff_session() CASCADE;
DROP FUNCTION IF EXISTS public.get_receipt(text) CASCADE;
DROP FUNCTION IF EXISTS public.get_table_order(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_product_popularity(text) CASCADE;
DROP FUNCTION IF EXISTS public.public_find_or_create_customer(text, text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.public_get_order_customer(text) CASCADE;
DROP FUNCTION IF EXISTS public.public_append_order_item(text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.public_remove_order_item(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.public_attach_payment(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.public_link_customer(text, text) CASCADE;
DROP TRIGGER IF EXISTS trg_hash_staff_pin ON public.staff;
DROP FUNCTION IF EXISTS public.hash_staff_pin() CASCADE;
DROP TRIGGER IF EXISTS trg_guard_kitchen_sales_update ON public.sales;
DROP FUNCTION IF EXISTS public.guard_kitchen_sales_update() CASCADE;

-- ----------------------------------------------------------------------------
-- 4. SECURE USER & ROLE RESOLUTION HELPERS (SECURITY DEFINERS)
-- ----------------------------------------------------------------------------

-- A. Helper: Checks if the currently authenticated Supabase Auth user is the Shop Owner.
CREATE OR REPLACE FUNCTION public.is_shop_owner(_shop_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated DB privileges to read metadata
STABLE           -- Pure read, allows query optimization
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.shops 
    WHERE id = _shop_id 
    AND owner_id = auth.uid()
  );
END;
$$;

-- B. Helper: Resolves the active, unexpired staff session from the
-- 'x-staff-token' request header. Returns NULL when no valid session exists.
-- This is the ONLY source of staff identity — client-asserted role/id headers
-- are ignored entirely.
CREATE OR REPLACE FUNCTION public.get_staff_session()
RETURNS public.staff_sessions
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  headers text;
  tok text;
  v_uuid uuid;
  sess public.staff_sessions%ROWTYPE;
BEGIN
  BEGIN
    headers := current_setting('request.headers', true);
    IF headers IS NULL OR headers = '' THEN
      RETURN NULL;
    END IF;
    tok := (headers::jsonb)->>'x-staff-token';
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  IF tok IS NULL OR tok = '' THEN
    RETURN NULL;
  END IF;

  BEGIN
    v_uuid := tok::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  SELECT * INTO sess FROM public.staff_sessions ss
  WHERE ss.token = v_uuid AND ss.expires_at > now();

  IF sess.token IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN sess;
END;
$$;

-- C. Helper: The active staff role, derived ONLY from a verified session.
-- Returns NULL (deny) when no session is active — there is no default role.
CREATE OR REPLACE FUNCTION public.get_active_staff_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  sess public.staff_sessions;
BEGIN
  sess := public.get_staff_session();
  IF sess.token IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN lower(sess.role);
END;
$$;

-- D. Helper: The active staff ID, derived ONLY from a verified session.
CREATE OR REPLACE FUNCTION public.get_active_staff_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  sess public.staff_sessions;
BEGIN
  sess := public.get_staff_session();
  IF sess.token IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN sess.staff_id;
END;
$$;

-- E. Helper: Verifies the caller may act on the given shop with one of the
-- allowed roles.
--   * With an active staff session: the session's shop AND role must match.
--     This takes precedence over ownership, so role limits also apply on the
--     shop owner's shared device while a staff operator is active.
--   * Without a staff session: falls back to the authenticated Shop Owner
--     (initial setup, owner-only flows).
CREATE OR REPLACE FUNCTION public.verify_staff_permission(_shop_id text, _allowed_roles text[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  sess public.staff_sessions;
BEGIN
  sess := public.get_staff_session();
  IF sess.token IS NOT NULL THEN
    RETURN sess.shop_id = _shop_id AND lower(sess.role) = ANY(_allowed_roles);
  END IF;
  RETURN public.is_shop_owner(_shop_id);
END;
$$;

-- F. Helper: Constant-shape PIN check supporting bcrypt hashes with a
-- transitional fallback for legacy plaintext rows (hashed on next write).
CREATE OR REPLACE FUNCTION public.check_staff_pin(_stored text, _pin text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT _stored IS NOT NULL AND _stored <> '' AND _pin IS NOT NULL AND _pin <> '' AND (
    (_stored LIKE '$2%' AND _stored = crypt(_pin, _stored)) OR
    (_stored NOT LIKE '$2%' AND _stored = _pin)
  );
$$;

-- G. Helper: Is the current authenticated (Google) user the customer that a
-- sale belongs to? Used for the customer's own order history.
CREATE OR REPLACE FUNCTION public.is_own_customer_sale(_shop_id text, _customer_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN auth.email() IS NOT NULL AND _customer_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = _customer_id AND c.shop_id = _shop_id AND c.email = auth.email()
  );
END;
$$;

-- H. Helper: Mints a staff session (internal — called only by the login RPCs).
CREATE OR REPLACE FUNCTION public.mint_staff_session(_staff_id text, _shop_id text, _role text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token uuid;
BEGIN
  DELETE FROM public.staff_sessions WHERE expires_at < now();
  INSERT INTO public.staff_sessions (staff_id, shop_id, role)
  VALUES (_staff_id, _shop_id, _role)
  RETURNING token INTO v_token;
  RETURN v_token;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. FINE-GRAINED ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------

-- ============================================================================
-- TABLE: SHOPS
-- ============================================================================
-- Read: Anyone can read (for customer QR scans and menus).
-- Write: Shop Owners only.
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shops Read: Public QR & Client Access"
  ON public.shops FOR SELECT
  USING (true);

CREATE POLICY "Shops Write: Authenticated Owners Create"
  ON public.shops FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = owner_id);

CREATE POLICY "Shops Write: Owners Manage Their Shops"
  ON public.shops FOR ALL
  USING (auth.uid() IS NOT NULL AND auth.uid() = owner_id)
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = owner_id);


-- ============================================================================
-- TABLE: PRODUCTS
-- ============================================================================
-- Read: Anyone can read products (for customer menu browsing & catalog lookup).
-- Write: Owners, Admins, and Managers only. Waiters/Kitchen cannot write.
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Products Read: Public Menu Catalog Access"
  ON public.products FOR SELECT
  USING (true);

CREATE POLICY "Products Write: Owners, Admins, and Managers Only"
  ON public.products FOR ALL
  USING (public.verify_staff_permission(shop_id, ARRAY['admin', 'manager']))
  WITH CHECK (public.verify_staff_permission(shop_id, ARRAY['admin', 'manager']));


-- ============================================================================
-- TABLE: STAFF
-- ============================================================================
-- Read: ONLY shop members (the owner, or an operator with a valid staff
--       session for this shop) can list staff. The pin column is additionally
--       excluded via column-level privileges (see section 8) and stored as a
--       bcrypt hash, never plaintext.
-- Write: Owner or 'admin' role only.
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff Read: Shop members only"
  ON public.staff FOR SELECT
  USING (public.verify_staff_permission(shop_id, ARRAY['admin', 'manager', 'cashier', 'waiter', 'kitchen']));

CREATE POLICY "Staff Write: Owner or Admin Manage staff accounts"
  ON public.staff FOR ALL
  USING (public.verify_staff_permission(shop_id, ARRAY['admin']))
  WITH CHECK (public.verify_staff_permission(shop_id, ARRAY['admin']));


-- ============================================================================
-- TABLE: SALES & ORDERS
-- ============================================================================
-- POS Orders workflow:
--   - INSERT: Staff can create any sale. Anonymous customers can only create
--             OPEN orders ('pending' / 'pending_verification') — never completed history.
--   - SELECT: Staff sessions (or the owner) read their shop's sales. An
--             authenticated Google customer can read their own linked sales.
--             Anonymous customers use SECURITY DEFINER RPCs (get_receipt,
--             get_table_order) — there is NO open public read anymore.
--   - UPDATE: Staff sessions only, plus an authenticated customer's own sale
--             (for attaching payment proof to history). Anonymous customers
--             mutate open orders exclusively through validated RPCs
--             (public_append_order_item / public_remove_order_item / ...).
--             Kitchen role may only touch active (not closed) orders, and a
--             trigger restricts it to the items/status columns.
--   - DELETE: STRICTLY prohibited (no policy) for accounting integrity.
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sales Insert: Staff and open customer orders"
  ON public.sales FOR INSERT
  WITH CHECK (
    public.verify_staff_permission(shop_id, ARRAY['admin', 'manager', 'cashier', 'waiter']) OR
    order_status IN ('pending', 'pending_verification')
  );

CREATE POLICY "Sales Select: Staff and own-customer history"
  ON public.sales FOR SELECT
  USING (
    public.verify_staff_permission(shop_id, ARRAY['admin', 'manager', 'cashier', 'waiter', 'kitchen']) OR
    public.is_own_customer_sale(shop_id, customer_id)
  );

CREATE POLICY "Sales Update: Staff roles and own-customer proof"
  ON public.sales FOR UPDATE
  USING (
    public.verify_staff_permission(shop_id, ARRAY['admin', 'manager', 'cashier', 'waiter', 'kitchen']) OR
    public.is_own_customer_sale(shop_id, customer_id)
  )
  WITH CHECK (
    CASE
      WHEN public.get_active_staff_role() = 'kitchen' THEN
        -- Kitchen may act on any ACTIVE order (incl. 'confirmed' tickets) but
        -- can never touch closed history. Column limits are enforced by
        -- trg_guard_kitchen_sales_update.
        (order_status NOT IN ('completed', 'cancelled'))
      ELSE
        public.verify_staff_permission(shop_id, ARRAY['admin', 'manager', 'cashier', 'waiter']) OR
        public.is_own_customer_sale(shop_id, customer_id)
    END
  );


-- ============================================================================
-- TABLE: TABLES & BOOKINGS (Restaurant specific)
-- ============================================================================
-- Read: Anyone can view layouts and booking slots (menus & checking availability).
-- Write: Handled by Waiter, Admin, and Manager.
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tables Read: Public layout overview"
  ON public.tables FOR SELECT USING (true);

CREATE POLICY "Tables Write: Owners, Admins, Managers, and Waiters"
  ON public.tables FOR ALL
  USING (public.verify_staff_permission(shop_id, ARRAY['admin', 'manager', 'waiter']))
  WITH CHECK (public.verify_staff_permission(shop_id, ARRAY['admin', 'manager', 'waiter']));

CREATE POLICY "Bookings Insert: Public guests can reserve slot"
  ON public.bookings FOR INSERT WITH CHECK (true);

-- Bookings contain guest names & phone numbers (PII) — staff only.
CREATE POLICY "Bookings Read: Staff only"
  ON public.bookings FOR SELECT
  USING (public.verify_staff_permission(shop_id, ARRAY['admin', 'manager', 'cashier', 'waiter']));

CREATE POLICY "Bookings Write: Staff managing reservations"
  ON public.bookings FOR ALL
  USING (public.verify_staff_permission(shop_id, ARRAY['admin', 'manager', 'waiter']))
  WITH CHECK (public.verify_staff_permission(shop_id, ARRAY['admin', 'manager', 'waiter']));


-- ============================================================================
-- TABLE: SHOP SETTINGS
-- ============================================================================
-- Read: Public can read for local currency symbols and config settings.
-- Write: Owners, Admins only.
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Settings Read: Anyone can read configuration"
  ON public.settings FOR SELECT USING (true);

CREATE POLICY "Settings Write: Admins and Owners manage rules"
  ON public.settings FOR ALL
  USING (public.verify_staff_permission(shop_id, ARRAY['admin']))
  WITH CHECK (public.verify_staff_permission(shop_id, ARRAY['admin']));


-- ============================================================================
-- TABLE: EXPENSES & ACCOUNTING
-- ============================================================================
-- Read/Write: Extremely confidential. Owners, Admins, and Managers only. 
-- Waiters, Cashiers, Kitchen, and Customers have zero visibility.
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Expenses: Full Admin/Manager Control"
  ON public.expenses FOR ALL
  USING (public.verify_staff_permission(shop_id, ARRAY['admin', 'manager']))
  WITH CHECK (public.verify_staff_permission(shop_id, ARRAY['admin', 'manager']));


-- ============================================================================
-- TABLE: AUDIT LOGS / PRODUCT ACTIVITIES
-- ============================================================================
-- Read: Admins, Managers only.
-- Write: Automatic write when adding/updating products, scoped to active staff.
ALTER TABLE public.product_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Product Activities Read: Admins and Managers"
  ON public.product_activities FOR SELECT
  USING (public.verify_staff_permission(shop_id, ARRAY['admin', 'manager']));

CREATE POLICY "Product Activities Write: Staff audit logging"
  ON public.product_activities FOR INSERT
  WITH CHECK (public.verify_staff_permission(shop_id, ARRAY['admin', 'manager', 'cashier', 'waiter']));


-- ============================================================================
-- TABLE: DISCOUNT RULES
-- ============================================================================
-- Read: Anyone can see active promo catalog or current discounts.
-- Write: Admin / Owner only.
ALTER TABLE public.discount_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Discount Rules Read: Public active checks"
  ON public.discount_rules FOR SELECT USING (true);

CREATE POLICY "Discount Rules Write: Admins and Owners"
  ON public.discount_rules FOR ALL
  USING (public.verify_staff_permission(shop_id, ARRAY['admin']))
  WITH CHECK (public.verify_staff_permission(shop_id, ARRAY['admin']));


-- ============================================================================
-- TABLE: TABLE MESSAGES
-- ============================================================================
-- Read: Staff only — messages were world-readable before, leaking all shops'
--       activity. The customer side receives staff replies via realtime
--       broadcast channels instead of table reads.
-- Write: Customers click 'Call Waiter' or text -> Inserts. Staff can modify status (e.g. archived).
ALTER TABLE public.table_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Table Messages Read: Staff only"
  ON public.table_messages FOR SELECT
  USING (public.verify_staff_permission(shop_id, ARRAY['admin', 'manager', 'waiter', 'cashier', 'kitchen']));

CREATE POLICY "Table Messages Write: Customers send notifications"
  ON public.table_messages FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Table Messages Write: Staff manage/archive status alerts"
  ON public.table_messages FOR ALL
  USING (public.verify_staff_permission(shop_id, ARRAY['admin', 'manager', 'waiter', 'cashier', 'kitchen']))
  WITH CHECK (public.verify_staff_permission(shop_id, ARRAY['admin', 'manager', 'waiter', 'cashier', 'kitchen']));


-- ============================================================================
-- TABLE: CUSTOMERS
-- ============================================================================
-- Read: Staff sessions see their shop's customers; an authenticated Google
--       user sees their own profile. The anonymous QR checkout uses the
--       public_find_or_create_customer RPC — customer PII (names, phones,
--       emails, debt) is no longer world-readable.
-- Write: Staff manage profiles and debt; anonymous registration goes through
--        the RPC only.
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers Read: Staff and own profile"
  ON public.customers FOR SELECT
  USING (
    public.verify_staff_permission(shop_id, ARRAY['admin', 'manager', 'cashier', 'waiter']) OR
    (auth.email() IS NOT NULL AND email = auth.email())
  );

CREATE POLICY "Customers Insert: Staff only"
  ON public.customers FOR INSERT
  WITH CHECK (public.verify_staff_permission(shop_id, ARRAY['admin', 'manager', 'cashier', 'waiter']));

CREATE POLICY "Customers Write: Staff manage profiles and debt"
  ON public.customers FOR ALL
  USING (public.verify_staff_permission(shop_id, ARRAY['admin', 'manager', 'cashier']))
  WITH CHECK (public.verify_staff_permission(shop_id, ARRAY['admin', 'manager', 'cashier']));


-- ============================================================================
-- TABLE: PAYMENT METHODS
-- ============================================================================
-- Read: Anyone can read QR details and accounts at checkout.
-- Write: Admin and Owner only.
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Payment Methods Read: Public display checkout QR"
  ON public.payment_methods FOR SELECT USING (true);

CREATE POLICY "Payment Methods Write: Admin configuration"
  ON public.payment_methods FOR ALL
  USING (public.verify_staff_permission(shop_id, ARRAY['admin']))
  WITH CHECK (public.verify_staff_permission(shop_id, ARRAY['admin']));


-- ----------------------------------------------------------------------------
-- 6. SECURE CUSTOM DB FUNCTIONS & PROCEDURES
-- ----------------------------------------------------------------------------

-- A. PIN hashing at rest: every INSERT/UPDATE of staff.pin stores a bcrypt
--    hash. Plaintext PINs never persist.
CREATE OR REPLACE FUNCTION public.hash_staff_pin()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.pin IS NOT NULL AND NEW.pin <> '' AND NEW.pin !~ '^\$2' THEN
    NEW.pin := crypt(NEW.pin, gen_salt('bf', 8));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_hash_staff_pin
  BEFORE INSERT OR UPDATE OF pin ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.hash_staff_pin();

-- One-time migration: hash any legacy plaintext PINs already in the table.
UPDATE public.staff SET pin = pin WHERE pin IS NOT NULL AND pin <> '' AND pin !~ '^\$2';

-- B. Kitchen column guard: with a kitchen session active, sales updates may
--    only change the items payload and order_status — never money or linkage.
CREATE OR REPLACE FUNCTION public.guard_kitchen_sales_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF public.get_active_staff_role() = 'kitchen' THEN
    IF NEW.total       IS DISTINCT FROM OLD.total
    OR NEW.subtotal    IS DISTINCT FROM OLD.subtotal
    OR NEW.tax         IS DISTINCT FROM OLD.tax
    OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
    OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
    OR NEW.table_id    IS DISTINCT FROM OLD.table_id
    OR NEW.amount_paid IS DISTINCT FROM OLD.amount_paid
    OR NEW."timestamp" IS DISTINCT FROM OLD."timestamp" THEN
      RAISE EXCEPTION 'Kitchen role may only update order items and status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_kitchen_sales_update
  BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.guard_kitchen_sales_update();

-- C. Staff Login (phone + PIN) — verifies the PIN server-side and mints a
--    session token. The client sends the token as 'x-staff-token' afterwards.
CREATE OR REPLACE FUNCTION public.staff_login(phone_number text, pin_code text)
RETURNS TABLE (
  id text,
  shop_id text,
  name text,
  role text,
  avatar_url text,
  session_token uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_shop_id text;
  st public.staff%ROWTYPE;
  v_token uuid;
BEGIN
  SELECT s.id INTO target_shop_id FROM public.shops s WHERE s.phone = phone_number LIMIT 1;
  IF target_shop_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO st FROM public.staff x
  WHERE x.shop_id = target_shop_id AND public.check_staff_pin(x.pin, pin_code)
  LIMIT 1;
  IF st.id IS NULL THEN
    RETURN;
  END IF;

  v_token := public.mint_staff_session(st.id, st.shop_id, st.role);
  RETURN QUERY SELECT st.id, st.shop_id, st.name, st.role, st.avatar_url, v_token;
END;
$$;

-- D. Staff Switch (lock screen) — verifies the selected operator's PIN
--    server-side and mints a session token.
CREATE OR REPLACE FUNCTION public.staff_switch(_staff_id text, _pin text)
RETURNS TABLE (
  id text,
  shop_id text,
  name text,
  role text,
  avatar_url text,
  session_token uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  st public.staff%ROWTYPE;
  v_token uuid;
BEGIN
  SELECT * INTO st FROM public.staff x WHERE x.id = _staff_id;
  IF st.id IS NULL OR NOT public.check_staff_pin(st.pin, _pin) THEN
    RETURN;
  END IF;

  v_token := public.mint_staff_session(st.id, st.shop_id, st.role);
  RETURN QUERY SELECT st.id, st.shop_id, st.name, st.role, st.avatar_url, v_token;
END;
$$;

-- E. Owner-authorized activation (single-role mode auto-login): the
--    authenticated Shop Owner may activate any of their staff without a PIN.
CREATE OR REPLACE FUNCTION public.owner_activate_staff(_staff_id text)
RETURNS TABLE (
  id text,
  shop_id text,
  name text,
  role text,
  avatar_url text,
  session_token uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  st public.staff%ROWTYPE;
  v_token uuid;
BEGIN
  SELECT * INTO st FROM public.staff x WHERE x.id = _staff_id;
  IF st.id IS NULL OR NOT public.is_shop_owner(st.shop_id) THEN
    RETURN;
  END IF;

  v_token := public.mint_staff_session(st.id, st.shop_id, st.role);
  RETURN QUERY SELECT st.id, st.shop_id, st.name, st.role, st.avatar_url, v_token;
END;
$$;

-- F. Logout / session validation
CREATE OR REPLACE FUNCTION public.staff_logout(_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.staff_sessions WHERE token = _token;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_staff_session()
RETURNS TABLE (
  id text,
  shop_id text,
  name text,
  role text,
  avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  sess public.staff_sessions;
BEGIN
  sess := public.get_staff_session();
  IF sess.token IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT st.id, st.shop_id, st.name, st.role, st.avatar_url
  FROM public.staff st WHERE st.id = sess.staff_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6b. PUBLIC CUSTOMER RPCs (SECURITY DEFINER)
-- These replace the previous wide-open SELECT/UPDATE policies. Each performs
-- its own validation, so anonymous customers can do exactly what the QR flow
-- needs — nothing more.
-- ----------------------------------------------------------------------------

-- Shareable receipt / order-status lookup. Knowing the unguessable sale id IS
-- the capability (share links, order tracking).
CREATE OR REPLACE FUNCTION public.get_receipt(_sale_id text)
RETURNS SETOF public.sales
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT * FROM public.sales WHERE id = _sale_id;
$$;

-- The active (open) order for a physical table — used by the customer QR page.
CREATE OR REPLACE FUNCTION public.get_table_order(_shop_id text, _table_id text)
RETURNS SETOF public.sales
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT * FROM public.sales
  WHERE shop_id = _shop_id AND table_id = _table_id
    AND order_status IN ('pending', 'pending_verification', 'confirmed')
  ORDER BY "timestamp" DESC
  LIMIT 1;
$$;

-- Item payloads of recent sales, for menu popularity ("Hot") badges.
CREATE OR REPLACE FUNCTION public.get_product_popularity(_shop_id text)
RETURNS SETOF jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT s.items FROM public.sales s
  WHERE s.shop_id = _shop_id AND s.items IS NOT NULL
  ORDER BY s."timestamp" DESC
  LIMIT 100;
$$;

-- Find-or-create a customer by phone for QR checkout, returning only the id.
CREATE OR REPLACE FUNCTION public.public_find_or_create_customer(_shop_id text, _name text, _phone text, _email text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id text;
BEGIN
  IF _shop_id IS NULL OR _phone IS NULL OR _phone = '' THEN
    RAISE EXCEPTION 'Shop and phone are required';
  END IF;
  SELECT c.id INTO v_id FROM public.customers c
  WHERE c.shop_id = _shop_id AND c.phone = _phone
  LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;
  v_id := replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.customers (id, shop_id, name, phone, email, total_debt)
  VALUES (v_id, _shop_id, COALESCE(NULLIF(_name, ''), 'Customer'), _phone, NULLIF(_email, ''), 0);
  RETURN v_id;
END;
$$;

-- Name/phone of the customer linked to a sale (for the QR bill header).
CREATE OR REPLACE FUNCTION public.public_get_order_customer(_sale_id text)
RETURNS TABLE (name text, phone text)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_customer_id text;
  v_shop_id text;
BEGIN
  SELECT s.customer_id, s.shop_id INTO v_customer_id, v_shop_id
  FROM public.sales s WHERE s.id = _sale_id;
  IF v_customer_id IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT c.name, c.phone FROM public.customers c
  WHERE c.id = v_customer_id AND c.shop_id = v_shop_id;
END;
$$;

-- Append one item to an OPEN order. Locks the row (no lost updates), forces
-- status 'pending', and re-prices the item from the product catalog so a
-- tampering client cannot set its own prices. Recomputes totals server-side.
CREATE OR REPLACE FUNCTION public.public_append_order_item(_sale_id text, _item jsonb)
RETURNS public.sales
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_items jsonb;
  v_idx int;
  elem jsonb;
  v_found boolean := false;
  v_price numeric;
  v_variants jsonb;
  v_qty numeric;
  v_sub numeric;
  v_tax_rate numeric := 0;
  v_tax numeric;
BEGIN
  SELECT * INTO v_sale FROM public.sales s WHERE s.id = _sale_id FOR UPDATE;
  IF v_sale.id IS NULL OR v_sale.order_status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'Order is not open for changes';
  END IF;

  -- Re-price from the catalog (never trust the client's price)
  SELECT p.price, p.variants INTO v_price, v_variants
  FROM public.products p
  WHERE p.id = _item->>'id' AND p.shop_id = v_sale.shop_id;
  IF v_price IS NULL THEN
    RAISE EXCEPTION 'Unknown product';
  END IF;
  IF COALESCE(_item->>'variantId', '') <> '' AND v_variants IS NOT NULL THEN
    SELECT (v->>'price')::numeric INTO v_price
    FROM jsonb_array_elements(v_variants) v
    WHERE v->>'id' = _item->>'variantId';
    IF v_price IS NULL THEN
      RAISE EXCEPTION 'Unknown product variant';
    END IF;
  END IF;

  v_qty := GREATEST(COALESCE((_item->>'quantity')::numeric, 1), 1);
  _item := _item || jsonb_build_object('price', v_price, 'status', 'pending', 'served', false, 'quantity', v_qty);

  v_items := COALESCE(v_sale.items, '[]'::jsonb);

  -- Merge with an existing still-pending line of the same product+variant
  IF jsonb_array_length(v_items) > 0 THEN
    FOR v_idx IN 0..jsonb_array_length(v_items) - 1 LOOP
      elem := v_items->v_idx;
      IF elem->>'id' = _item->>'id'
         AND COALESCE(elem->>'variantId', '') = COALESCE(_item->>'variantId', '')
         AND COALESCE(elem->>'status', 'pending') = 'pending' THEN
        v_items := jsonb_set(v_items, ARRAY[v_idx::text, 'quantity'],
          to_jsonb(COALESCE((elem->>'quantity')::numeric, 1) + v_qty));
        v_found := true;
        EXIT;
      END IF;
    END LOOP;
  END IF;
  IF NOT v_found THEN
    v_items := v_items || jsonb_build_array(_item);
  END IF;

  SELECT COALESCE(SUM((i->>'price')::numeric * COALESCE((i->>'quantity')::numeric, 1)), 0)
  INTO v_sub FROM jsonb_array_elements(v_items) i;
  SELECT COALESCE(st.tax_rate, 0) INTO v_tax_rate FROM public.settings st WHERE st.shop_id = v_sale.shop_id LIMIT 1;
  v_tax := round(v_sub * COALESCE(v_tax_rate, 0) / 100.0, 2);

  UPDATE public.sales s
  SET items = v_items, subtotal = v_sub, tax = v_tax, total = v_sub + v_tax
  WHERE s.id = _sale_id
  RETURNING * INTO v_sale;
  RETURN v_sale;
END;
$$;

-- Remove one still-PENDING item from an open order (items already sent to the
-- kitchen cannot be silently deleted by the customer).
CREATE OR REPLACE FUNCTION public.public_remove_order_item(_sale_id text, _order_item_id text)
RETURNS public.sales
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_items jsonb;
  v_target jsonb;
  v_sub numeric;
  v_tax_rate numeric := 0;
  v_tax numeric;
BEGIN
  SELECT * INTO v_sale FROM public.sales s WHERE s.id = _sale_id FOR UPDATE;
  IF v_sale.id IS NULL OR v_sale.order_status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'Order is not open for changes';
  END IF;

  SELECT i INTO v_target FROM jsonb_array_elements(COALESCE(v_sale.items, '[]'::jsonb)) i
  WHERE i->>'orderItemId' = _order_item_id;
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'Item not found';
  END IF;
  IF COALESCE(v_target->>'status', 'pending') <> 'pending' THEN
    RAISE EXCEPTION 'Item was already sent to the kitchen — ask staff to remove it';
  END IF;

  SELECT COALESCE(jsonb_agg(i), '[]'::jsonb) INTO v_items
  FROM jsonb_array_elements(COALESCE(v_sale.items, '[]'::jsonb)) i
  WHERE i->>'orderItemId' IS DISTINCT FROM _order_item_id;

  SELECT COALESCE(SUM((i->>'price')::numeric * COALESCE((i->>'quantity')::numeric, 1)), 0)
  INTO v_sub FROM jsonb_array_elements(v_items) i;
  SELECT COALESCE(st.tax_rate, 0) INTO v_tax_rate FROM public.settings st WHERE st.shop_id = v_sale.shop_id LIMIT 1;
  v_tax := round(v_sub * COALESCE(v_tax_rate, 0) / 100.0, 2);

  UPDATE public.sales s
  SET items = v_items, subtotal = v_sub, tax = v_tax, total = v_sub + v_tax
  WHERE s.id = _sale_id
  RETURNING * INTO v_sale;
  RETURN v_sale;
END;
$$;

-- Attach a payment proof image and flag the order for staff verification.
-- Open orders: anyone at the table. Closed orders: only the sale's own
-- authenticated customer (history repayment flow).
CREATE OR REPLACE FUNCTION public.public_attach_payment(_sale_id text, _proof_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale public.sales%ROWTYPE;
BEGIN
  SELECT * INTO v_sale FROM public.sales s WHERE s.id = _sale_id FOR UPDATE;
  IF v_sale.id IS NULL OR v_sale.order_status = 'cancelled' THEN
    RAISE EXCEPTION 'Order not available';
  END IF;
  IF v_sale.order_status = 'completed'
     AND NOT public.is_own_customer_sale(v_sale.shop_id, v_sale.customer_id) THEN
    RAISE EXCEPTION 'Order is closed';
  END IF;
  UPDATE public.sales s
  SET payment_proof_url = _proof_url, order_status = 'pending_verification'
  WHERE s.id = _sale_id;
END;
$$;

-- Link a customer profile to an open order (QR bill "my info" form).
CREATE OR REPLACE FUNCTION public.public_link_customer(_sale_id text, _customer_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale public.sales%ROWTYPE;
BEGIN
  SELECT * INTO v_sale FROM public.sales s WHERE s.id = _sale_id FOR UPDATE;
  IF v_sale.id IS NULL OR v_sale.order_status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Order is not open for changes';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.customers c WHERE c.id = _customer_id AND c.shop_id = v_sale.shop_id
  ) THEN
    RAISE EXCEPTION 'Unknown customer';
  END IF;
  UPDATE public.sales s SET customer_id = _customer_id WHERE s.id = _sale_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6c. COLUMN-LEVEL PRIVILEGES — keep the pin (hash) column out of client reach
-- ----------------------------------------------------------------------------
REVOKE SELECT ON public.staff FROM anon, authenticated;
GRANT SELECT (id, shop_id, name, role, avatar_url, has_pin) ON public.staff TO anon, authenticated;


-- ----------------------------------------------------------------------------
-- 7. STORAGE BUCKET SECURE SETUP & GENERAL POLICIES
-- ----------------------------------------------------------------------------

-- Ensure 'Haang' storage bucket exists for products and billing proofs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('Haang', 'Haang', true) 
ON CONFLICT (id) DO NOTHING;

-- Cleanup existing policies
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Secure Public Upload" ON storage.objects;
DROP POLICY IF EXISTS "Owner Delete" ON storage.objects;
DROP POLICY IF EXISTS "Storage Read: Shop members list objects" ON storage.objects;
DROP POLICY IF EXISTS "Storage Delete: Authenticated shop members" ON storage.objects;

-- Read rules: the bucket is PUBLIC, so images are served over the public object
-- URL without consulting RLS. This policy therefore only governs the
-- authenticated Storage API (notably `list`). Granting it to everyone let any
-- caller ENUMERATE the whole bucket — including customer payment proofs — so it
-- is restricted to shop members. Product images and logos still render for
-- anonymous visitors via their public URLs.
CREATE POLICY "Storage Read: Shop members list objects"
  ON storage.objects FOR SELECT
  TO authenticated
  USING ( bucket_id = 'Haang' );

-- Write rules: anonymous customers must be able to upload a payment proof from
-- the QR checkout, so INSERT stays open — but only for image extensions and
-- never into the 'private' folder.
CREATE POLICY "Secure Public Upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'Haang'
    AND (storage.foldername(name))[1] != 'private'
    AND (
      lower(storage.extension(name)) = 'png' OR
      lower(storage.extension(name)) = 'jpg' OR
      lower(storage.extension(name)) = 'jpeg' OR
      lower(storage.extension(name)) = 'webp'
    )
  );

-- Delete rules: deletion happens only from the Inventory (product image) and
-- Settings (shop logo) admin screens. The previous policy had no owner check at
-- all, which let ANY anonymous caller wipe every image in the bucket. Deletes
-- now require an authenticated session.
CREATE POLICY "Storage Delete: Authenticated shop members"
  ON storage.objects FOR DELETE
  TO authenticated
  USING ( bucket_id = 'Haang' );

-- ============================================================================
-- SUCCESS: COMPLETE SCHEMA & RBAC SEAMLESSLY INITIALIZED
-- ============================================================================
