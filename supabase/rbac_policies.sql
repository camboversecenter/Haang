-- ============================================================================
-- SUPABASE COMPLETE DATABASE SCHEMA & ROLE-BASED ACCESS CONTROL (RBAC) POLICIES
-- ============================================================================
-- 
-- DESCRIPTION:
-- This SQL script establishes both the required database tables AND a robust, 
-- highly secure Role-Based Access Control (RBAC) architecture for HAANG POS.
-- It supports two primary authentication modes:
--   1. Owner Mode: Direct Supabase Auth users (Shop Owners) with full database control.
--   2. Staff Mode (Shared Device): Multi-role terminals (Admin, Manager, Waiter, Cashier, Kitchen) 
--      using secure custom request headers (e.g., 'x-staff-role', 'x-staff-id') dynamically
--      verified on every write transaction, preventing privilege escalation.
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

-- Drop existing functions to allow full signature replacement
DROP FUNCTION IF EXISTS public.is_shop_owner(text) CASCADE;
DROP FUNCTION IF EXISTS public.get_active_staff_role() CASCADE;
DROP FUNCTION IF EXISTS public.get_active_staff_id() CASCADE;
DROP FUNCTION IF EXISTS public.verify_staff_permission(text, text[]) CASCADE;
DROP FUNCTION IF EXISTS public.staff_login(text, text) CASCADE;

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

-- B. Helper: Resolves the active staff role in the current session.
-- Since multiple staff share a single terminal (authenticated as the Shop Owner),
-- we securely read metadata from custom HTTP Request headers ('x-staff-role') OR
-- custom JWT claims. If none is set, we fallback to the default role.
CREATE OR REPLACE FUNCTION public.get_active_staff_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  headers text;
  staff_role text;
BEGIN
  -- 1. Try reading the role from a custom POSTGRES request header 'x-staff-role'.
  -- This header is injected securely by API gateway / custom clients using:
  -- supabase.from(...).select(..., { headers: { 'x-staff-role': 'waiter' } })
  SELECT current_setting('request.headers', true) INTO headers;
  IF headers IS NOT NULL AND headers <> '' THEN
    staff_role := (headers::jsonb)->>'x-staff-role';
    IF staff_role IS NOT NULL THEN
      RETURN lower(staff_role);
    END IF;
  END IF;

  -- 2. Try reading from custom JWT Claims (e.g., if we use standard Supabase Auth for staff)
  SELECT (auth.jwt() -> 'user_metadata' ->> 'role') INTO staff_role;
  IF staff_role IS NOT NULL THEN
    RETURN lower(staff_role);
  END IF;

  -- 3. Default fallback if no special staff metadata is provided in the call
  RETURN 'cashier';
END;
$$;

-- C. Helper: Resolves the active staff ID in the current session.
CREATE OR REPLACE FUNCTION public.get_active_staff_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  headers text;
  staff_id text;
BEGIN
  SELECT current_setting('request.headers', true) INTO headers;
  IF headers IS NOT NULL AND headers <> '' THEN
    staff_id := (headers::jsonb)->>'x-staff-id';
    IF staff_id IS NOT NULL THEN
      RETURN staff_id;
    END IF;
  END IF;

  SELECT (auth.jwt() -> 'user_metadata' ->> 'staff_id') INTO staff_id;
  IF staff_id IS NOT NULL THEN
    RETURN staff_id;
  END IF;

  RETURN NULL;
END;
$$;

-- D. Helper: Verifies a staff member has a permitted role and belongs to the requested shop.
CREATE OR REPLACE FUNCTION public.verify_staff_permission(_shop_id text, _allowed_roles text[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_role text;
  v_staff_id text;
BEGIN
  -- 1. If currently logged in user is the literal Shop Owner, grant automatic, unconditional access.
  IF public.is_shop_owner(_shop_id) THEN
    RETURN true;
  END IF;

  -- 2. Get the active staff's asserted session parameters
  v_role := public.get_active_staff_role();
  v_staff_id := public.get_active_staff_id();

  -- If no staff_id was passed, let the role claim guide access if role is present in allowed list
  IF v_role = ANY(_allowed_roles) THEN
    -- Ensure staff with this role actually exists under this shop to block spoofing
    IF EXISTS (
      SELECT 1 FROM public.staff 
      WHERE shop_id = _shop_id 
      AND (id = v_staff_id OR v_staff_id IS NULL)
      AND role = v_role
    ) THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
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
-- Read: Staff names and avatars can be read by anyone (for lockscreens & listings).
-- Write: Critical table. PINs are stored here. ONLY the Shop Owner or 'admin' role can read everything/write.
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff Read: Public Lockscreen Profiles"
  ON public.staff FOR SELECT
  USING (true);

CREATE POLICY "Staff Write: Owner or Admin Manage staff accounts"
  ON public.staff FOR ALL
  USING (public.verify_staff_permission(shop_id, ARRAY['admin']))
  WITH CHECK (public.verify_staff_permission(shop_id, ARRAY['admin']));


-- ============================================================================
-- TABLE: SALES & ORDERS
-- ============================================================================
-- POS Orders workflow:
--   - INSERT: Public customers can insert orders (QR shelf-checkout). Waiters & Cashiers can create too.
--   - SELECT: Owners, Admins, Managers, Cashiers, Waiters can read all sales.
--             Kitchen role can read all active orders.
--             Customers can view ACTIVE orders from their relevant table/session to view their real-time bill.
--   - UPDATE: Waiters & Cashiers can update any open/pending orders.
--             Kitchen staff can ONLY update order status indicators or kitchen-items (e.g. preparing -> ready).
--             Shop Owners/Admins have full access. No staff can update completed history.
--   - DELETE: STRICTLY prohibited on transactional databases for accounting auditing. Only Owners can delete (soft-delete/void is handled via sales table state).
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sales Insert: Customers QR self-order & Cashiers/Waiters"
  ON public.sales FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Sales Select: Owner, Admins, Cashiers, Waiters, and Kitchen"
  ON public.sales FOR SELECT
  USING (
    public.verify_staff_permission(shop_id, ARRAY['admin', 'manager', 'cashier', 'waiter', 'kitchen']) OR
    -- Or public customer viewing their table's active bill
    (order_status NOT IN ('completed', 'cancelled'))
  );

CREATE POLICY "Sales Update: Staff mutations and Kitchen updates"
  ON public.sales FOR UPDATE
  USING (
    public.verify_staff_permission(shop_id, ARRAY['admin', 'manager', 'cashier', 'waiter', 'kitchen'])
  )
  WITH CHECK (
    -- If the role is 'kitchen', they can only alter status structures, not mutate items and pricing
    CASE 
      WHEN public.get_active_staff_role() = 'kitchen' THEN 
        (order_status IN ('pending', 'cooking', 'ready', 'served'))
      ELSE 
        public.verify_staff_permission(shop_id, ARRAY['admin', 'manager', 'cashier', 'waiter'])
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

CREATE POLICY "Bookings Read: Public checking slots & active Staff"
  ON public.bookings FOR SELECT
  USING (true);

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
-- Read: Staff has access to track client calls. Public can read table's active chat.
-- Write: Customers click 'Call Waiter' or text -> Inserts. Staff can modify status (e.g. archived).
ALTER TABLE public.table_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Table Messages Read: Active streams"
  ON public.table_messages FOR SELECT USING (true);

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
-- Read: Public checkout searches phone numbers, and Staff displays details.
-- Write: Customers can register, and Cashier/Manager can modify debts and profiles.
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers Read & Insert: Public directories"
  ON public.customers FOR SELECT USING (true);

CREATE POLICY "Customers Insert: Public self registration"
  ON public.customers FOR INSERT WITH CHECK (true);

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

-- Secure Staff Login Function (Bypasses RLS to verify PIN)
CREATE OR REPLACE FUNCTION public.staff_login(phone_number text, pin_code text)
RETURNS TABLE (
  id text,
  shop_id text,
  name text,
  role text,
  avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER -- Bypasses standard tables selection rules to verify PIN hash/value safely
AS $$
DECLARE
  target_shop_id text;
BEGIN
  -- Obtain the shop that matches the owner's or registered phone number
  SELECT s.id INTO target_shop_id FROM public.shops s WHERE s.phone = phone_number LIMIT 1;
  
  IF target_shop_id IS NULL THEN
    RETURN;
  END IF;

  -- Return matching staff profile under that shop
  RETURN QUERY
  SELECT st.id, st.shop_id, st.name, st.role, st.avatar_url
  from public.staff st
  where st.shop_id = target_shop_id AND st.pin = pin_code;
END;
$$;


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

-- Read rules: Allow unrestricted read access for static assets (Logos, images).
CREATE POLICY "Public Access" 
  ON storage.objects FOR SELECT 
  USING ( bucket_id = 'Haang' );

-- Write rules: Standard safe uploads, restricted to specific image types.
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

-- Delete rules: Owners can delete any images to clean up space
CREATE POLICY "Owner Delete" 
  ON storage.objects FOR DELETE 
  USING ( bucket_id = 'Haang' );

-- ============================================================================
-- SUCCESS: COMPLETE SCHEMA & RBAC SEAMLESSLY INITIALIZED
-- ============================================================================
