
/**
 * SUPABASE TABLE & RPC NAME CONSTANTS
 *
 * The database schema itself (tables, RLS policies, RPCs, triggers) lives in
 * `supabase/rbac_policies.sql` — run that file in the Supabase SQL editor.
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
  
  RPC_STAFF_LOGIN: 'staff_login',
  RPC_STAFF_SWITCH: 'staff_switch',
  RPC_OWNER_ACTIVATE_STAFF: 'owner_activate_staff',
  RPC_STAFF_LOGOUT: 'staff_logout',
  RPC_VALIDATE_STAFF_SESSION: 'validate_staff_session',
  RPC_GET_RECEIPT: 'get_receipt',
  RPC_GET_TABLE_ORDER: 'get_table_order',
  RPC_GET_PRODUCT_POPULARITY: 'get_product_popularity',
  RPC_PUBLIC_FIND_OR_CREATE_CUSTOMER: 'public_find_or_create_customer',
  RPC_PUBLIC_GET_ORDER_CUSTOMER: 'public_get_order_customer',
  RPC_PUBLIC_APPEND_ORDER_ITEM: 'public_append_order_item',
  RPC_PUBLIC_REMOVE_ORDER_ITEM: 'public_remove_order_item',
  RPC_PUBLIC_ATTACH_PAYMENT: 'public_attach_payment',
  RPC_PUBLIC_LINK_CUSTOMER: 'public_link_customer'
};

/*
 * The full database schema, RLS policies, staff-session RPCs, and triggers
 * live in a single canonical, re-runnable file:
 *
 *     supabase/rbac_policies.sql
 *
 * Run THAT file in the Supabase SQL editor to create or upgrade a project.
 * (An older copy of the SQL used to be embedded here; it drifted from the
 * real policies and described a destructive table reset — removed to keep a
 * single source of truth.)
 */
