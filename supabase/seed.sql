-- ============================================================================
-- HAANG POS - DB SEED SCRIPT FOR LOGIN & TESTING
-- ============================================================================
-- 
-- DESCRIPTION:
-- This script seeds your database with a sample Cambodian business ("Angkor Cafe & Bakery")
-- including the necessary settings, tables, payment gateways, and staff roles.
-- It enables immediate testing of the Staff Login flow using the shop's phone number
-- and any of the pre-configured 4-digit PINs.
--
-- HOW TO USE:
-- 1. Copy the contents of this SQL file.
-- 2. Open your Supabase Dashboard -> SQL Editor.
-- 3. Paste and click "Run".
-- 4. In the app: select "Staff Login", type the Shop Phone "012345678", and enter a PIN below.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SEED DEFAULT SHOP
-- ----------------------------------------------------------------------------
INSERT INTO public.shops (id, name, type, logo_url, address, phone)
VALUES (
  'shop_angkor_cafe',
  'Angkor Cafe & Bakery',
  'restaurant',
  'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=500&auto=format&fit=crop&q=80',
  '#12, Street 240, Phnom Penh, Cambodia',
  '012345678'
) ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. SEED DEFAULT SHOP SETTINGS
-- ----------------------------------------------------------------------------
INSERT INTO public.settings (
  id, shop_id, currency, exchange_rate, tax_rate, 
  allow_self_ordering, enable_public_store, enable_booking, 
  enable_attributes, enable_multi_roles, default_language
)
VALUES (
  'set_angkor_cafe',
  'shop_angkor_cafe',
  'USD',
  4100.00,
  10.00,
  true,
  true,
  true,
  true,
  true,
  'km'
) ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. SEED STAFF ROLES (FOR LOGIN & COMPLIANCE TESTING)
-- ----------------------------------------------------------------------------
-- Use these credentials to test role-based constraints:
--   - Owner/Admin (Full Access)      -> PIN: 1234
--   - Cashier (Checkout, Invoicing)   -> PIN: 2580
--   - Waiter (Tables, Self-Ordering) -> PIN: 5678
--   - Chef/Kitchen (Ticket Statuses)   -> PIN: 9999
-- ----------------------------------------------------------------------------
INSERT INTO public.staff (id, shop_id, name, pin, role, avatar_url)
VALUES 
  (
    'staff_owner', 
    'shop_angkor_cafe', 
    'Sopheap (Owner/Admin)', 
    '1234', 
    'admin', 
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
  ),
  (
    'staff_cashier', 
    'shop_angkor_cafe', 
    'Dara (Cashier)', 
    '2580', 
    'cashier', 
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
  ),
  (
    'staff_waiter', 
    'shop_angkor_cafe', 
    'Bory (Waiter)', 
    '5678', 
    'waiter', 
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80'
  ),
  (
    'staff_kitchen', 
    'shop_angkor_cafe', 
    'Channy (Chef)', 
    '9999', 
    'kitchen', 
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80'
  )
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. SEED SAMPLE PRODUCTS (WITH RICH CAMBODIAN INSPIRED DATA)
-- ----------------------------------------------------------------------------
INSERT INTO public.products (id, shop_id, name, description, price, stock, track_stock, category, image_url, barcode)
VALUES
  (
    'prod_espresso', 
    'shop_angkor_cafe', 
    'Iced Latte (ឡាតេទឹកកក)', 
    'Rich premium espresso sweetened with creamy local palm honey syrup.', 
    2.50, 
    99, 
    true, 
    'Drinks', 
    'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=500&auto=format&fit=crop&q=80', 
    '8850123456789'
  ),
  (
    'prod_croissant', 
    'shop_angkor_cafe', 
    'Croissant (ខ្វាសង់)', 
    'Extra flaky golden-brown French butter pastry, baked fresh hourly.', 
    1.80, 
    30, 
    true, 
    'Bakery', 
    'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=500&auto=format&fit=crop&q=80', 
    '8850123456780'
  ),
  (
    'prod_amok', 
    'shop_angkor_cafe', 
    'Traditional Fish Amok (អាម៉ុកត្រី)', 
    'Steamed fish in yellow kroeung spice paste, organic coconut milk, and noni leaves.', 
    5.50, 
    20, 
    true, 
    'Food', 
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500&auto=format&fit=crop&q=80', 
    '8850123456781'
  ),
  (
    'prod_matcha', 
    'shop_angkor_cafe', 
    'Kyoto Iced Matcha (ម៉ាត់ឆា)', 
    'Finely grounded ceremonial Japanese matcha frothed over ice-cold fresh milk.', 
    2.80, 
    50, 
    true, 
    'Drinks', 
    'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=500&auto=format&fit=crop&q=80', 
    '8850123456782'
  )
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 5. SEED TABLES (RESTAURANT FUNCTIONALITY)
-- ----------------------------------------------------------------------------
INSERT INTO public.tables (id, shop_id, name, capacity, status, allow_ordering)
VALUES
  ('table_01', 'shop_angkor_cafe', 'Table 1', 4, 'available', true),
  ('table_02', 'shop_angkor_cafe', 'Table 2', 2, 'available', true),
  ('table_03', 'shop_angkor_cafe', 'VIP Private Room', 8, 'available', true)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 6. SEED PRE-INTEGRATED GATEWAYS & PAYMENT METHODS
-- ----------------------------------------------------------------------------
INSERT INTO public.payment_methods (id, shop_id, name, account_name, account_number, qr_code_url, active)
VALUES
  (
    'pm_aba', 
    'shop_angkor_cafe', 
    'ABA Pay (ស្កេនទូទាត់)', 
    'ANGKOR CAFE & BAKERY', 
    '000 111 222', 
    'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://khqr.aba.com.kh/pay/angkor_cafe', 
    true
  ),
  (
    'pm_cash', 
    'shop_angkor_cafe', 
    'Cash (សាច់ប្រាក់ ដុល្លារ/រៀល)', 
    NULL, 
    NULL, 
    NULL, 
    true
  )
ON CONFLICT (id) DO NOTHING;
