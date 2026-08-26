# Security & Access Control

Haang's security model is server-enforced: **Supabase Row-Level Security (RLS)** provides multi-tenant isolation and per-role access control, and authentication is handled by Google OAuth (owners) plus **server-minted staff session tokens** (staff).

## 1. Staff sessions (how staff identity works)

Staff never authenticate with client-asserted headers. Instead:

1. A PIN is verified **server-side** by a `SECURITY DEFINER` RPC — `staff_login(phone, pin)` (standalone staff device) or `staff_switch(staff_id, pin)` (shared-device lock screen). PINs are **bcrypt-hashed at rest** (`trg_hash_staff_pin`); plaintext never persists and the `pin` column is excluded from client SELECT privileges.
2. On success the server mints a row in `staff_sessions` and returns its `token` (7-day expiry). The client sends it on every request as the `x-staff-token` header.
3. RLS resolves the operator's **role and shop from the session row** (`get_staff_session()` → `verify_staff_permission()`). An active staff session takes **precedence over the owner's auth session**, so role limits apply even on the owner's shared device. Without any staff session, the authenticated shop owner retains full access (setup flows).
4. `owner_activate_staff(staff_id)` lets the authenticated owner activate a staff operator without a PIN (single-role auto-login). `staff_logout(token)` revokes a session; deleting a staff row cascades to its sessions.

There is **no default role**: a request with no valid token and no owner session is anonymous and only reaches the public policies/RPCs below.

## 2. Row-Level Security (RLS)

Every table has RLS enabled. Data is scoped per shop, and both reads and writes are gated by role. See [user-roles.md](./user-roles.md) for the matrix. Key points:

- **Owner isolation** — `is_shop_owner(shop_id)` grants a Supabase-authenticated owner access only to their own shop.
- **Staff verification** — `verify_staff_permission(shop_id, roles[])` checks the *session token's* shop and role on every read/write.
- **Kitchen constraint** — kitchen sessions can only update **active** orders, and a trigger (`trg_guard_kitchen_sales_update`) blocks them from changing money/linkage columns.
- **Scoped reads** — sales, customers, staff, bookings, and table messages are readable **only by shop members** (plus an authenticated Google customer's own records). Catalog tables (products, tables, settings, payment methods, discounts) remain publicly readable for QR menu browsing.
- **Public customer flows go through validated RPCs**, not open policies:
  - `get_receipt(sale_id)` — shareable receipt links (the unguessable id is the capability).
  - `get_table_order(shop_id, table_id)` — the open order for a physical table.
  - `public_append_order_item` / `public_remove_order_item` — QR self-ordering. These lock the order row (no lost updates), **re-price items from the catalog** (clients cannot set prices), only touch open orders, and only let customers remove still-pending items.
  - `public_attach_payment`, `public_link_customer`, `public_find_or_create_customer`, `public_get_order_customer` — payment proof + customer linkage without exposing the customers table.
- **Storage** — a public `Haang` bucket holds images/receipts. Uploads are restricted to image types (`png/jpg/jpeg/webp`) and non-`private` folders, and stay open to anonymous callers because QR-checkout customers upload their own payment proof. **Listing and deleting objects require an authenticated session** — an earlier policy allowed any anonymous caller to enumerate the bucket (exposing payment proofs) and to delete every file in it. ⚠️ Because the bucket is public, objects remain readable by anyone who knows the URL; move payment proofs to a private bucket with signed URLs before treating them as confidential financial records.

The full schema, policies, RPCs, and triggers live in `supabase/rbac_policies.sql` (re-runnable — run it in the SQL editor to upgrade an existing project; it hashes any legacy plaintext PINs on the spot).

## 3. Authentication modes

- **Shop Owner** — Google OAuth. The literal `owner_id` of the shop.
- **Staff (shared device)** — owner stays signed in; operators switch via the Lock Screen (PIN → `staff_switch` → token). Offline switching falls back to a local SHA-256 digest of previously-used PINs and mints the real token on reconnect.
- **Staff (standalone device)** — shop phone + 6-digit PIN via `staff_login`; the session persists locally and is re-validated with `validate_staff_session()` on startup.

## 4. App-Level Access Gates

On each load, `App.tsx` walks a short sequence of gates before showing the main app:

1. **Not logged in** → Login (or the public Landing page for first-time visitors).
2. **Owner without a shop** → Shop Setup.
3. **Shared device, no active operator** (multi-role on) → Lock Screen (pick staff + PIN).
4. **Authorized** → Main app.

## Notes & considerations

- **Payment account details** are readable publicly (they're shown on the QR menu for customers to pay) — don't store anything there that must stay private.
- Sensitive local data cached for **offline** use (the cached Supabase responses and the queued writes in `localStorage`) currently sits in plaintext on the device. If shared/stolen-device confidentiality becomes a requirement, encrypt the local offline store at rest.
- Staff session tokens expire after 7 days; expired sessions are pruned opportunistically on each mint.

> A client-side zero-knowledge encryption module (`zk-vault`) was previously integrated as a login gate but encrypted no data, so it was removed entirely — both the integration and the standalone library. If at-rest encryption of the offline store becomes a requirement later, it should be designed around that concrete purpose rather than reinstated as a login gate.
