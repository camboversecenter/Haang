# Security & Access Control

Haang's security model is server-enforced: **Supabase Row-Level Security (RLS)** provides multi-tenant isolation and per-role write control, and authentication is handled by Google OAuth (owners) plus shared-device PIN login (staff).

## 1. Row-Level Security (RLS)

Every table has RLS enabled. Data is scoped per shop, and writes are gated by role. See [user-roles.md](./user-roles.md) for the full permission matrix. Key design points:

- **Owner isolation** — the `is_shop_owner(shop_id)` helper grants a Supabase-authenticated owner full access only to their own shop.
- **Staff verification** — because staff share the owner's session on one device, the active role/ID travel as custom request headers (`x-staff-role`, `x-staff-id`) and are re-verified on **every write** by `verify_staff_permission()`. A spoofed role is rejected unless a real staff row with that role exists under the shop.
- **Secure PIN login** — `staff_login(phone, pin)` runs as a `SECURITY DEFINER` function so it can verify a PIN without exposing the whole staff table.
- **Public reads, guarded writes** — catalog tables (products, tables, settings, payment methods, discounts) are publicly readable for QR menu browsing, but writing is role-restricted.
- **Storage** — a public `Haang` bucket holds images/receipts; uploads are restricted to image types (`png/jpg/jpeg/webp`) and non-`private` folders.

The full schema and policies live in `supabase/rbac_policies.sql`.

## 2. Authentication

Two modes (see [user-roles.md](./user-roles.md) and [getting-started.md](./getting-started.md)):

- **Shop Owner** — Google OAuth. The literal `owner_id` of the shop; full access via RLS.
- **Staff** — shared-device login with the shop phone number + a 6-digit PIN, verified by the `staff_login` RPC. The active role/ID are attached to requests and checked by RLS on every write.

## 3. App-Level Access Gates

On each load, `App.tsx` walks a short sequence of gates before showing the main app:

1. **Not logged in** → Login (or the public Landing page for first-time visitors).
2. **Owner without a shop** → Shop Setup.
3. **Shared device, no active operator** (multi-role on) → Lock Screen (pick staff + PIN).
4. **Authorized** → Main app.

## Notes & considerations

- **Staff PINs are stored in plaintext** in the `staff` table so the `staff_login` RPC can verify them. For higher assurance, hash them and compare server-side in the RPC.
- **Payment account details** are readable publicly (they're shown on the QR menu for customers to pay) — don't store anything there that must stay private.
- Sensitive local data cached for **offline** use (the cached Supabase responses and the queued writes in `localStorage`) currently sits in plaintext on the device. If shared/stolen-device confidentiality becomes a requirement, encrypt the local offline store at rest.

> A client-side zero-knowledge encryption module (`zk-vault`) was previously integrated as a login gate but encrypted no data, so it was removed entirely — both the integration and the standalone library. If at-rest encryption of the offline store becomes a requirement later, it should be designed around that concrete purpose rather than reinstated as a login gate.
