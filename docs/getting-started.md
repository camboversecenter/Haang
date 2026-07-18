# Getting Started

This guide covers how users get into Haang: authentication, first-time shop setup, staff login, and how the app behaves offline.

## Authentication modes

Haang has two ways to sign in (see [user-roles.md](./user-roles.md) for full detail):

1. **Shop Owner** — signs in with **Google** (OAuth). The owner has full control of the shop.
2. **Staff** — logs in on a shared device with the **shop phone number + a 6-digit PIN**.

The login screen (`pages/Login.tsx`) has two tabs — **Owner** and **Staff** — plus links to the User Manual and Community License, and a "Free Forever" notice.

⚠️ **Current behavior:** the Login staff-PIN field is capped at 4 characters, while staff PINs are created as 6 digits in Settings and the default admin PIN is `123456`. This is a known inconsistency in the source.

## First-time shop setup

After an owner signs in for the first time, `pages/ShopSetup.tsx` walks them through creating a shop:

1. **Logo** — upload an image or **generate one with AI** (requires a shop name first).
2. **Shop name** (required).
3. **Business type** — **Retail** or **Restaurant**. This choice drives which features appear (e.g. Kitchen and table item-status flows are restaurant-only).
4. **Enable Multi-Roles** — toggle for staff roles. When enabled, shop creation announces a **default admin PIN of `123456`**.

On submit, any logo file is uploaded to Supabase storage and `createShop(name, type, logoUrl, enableMultiRoles)` is called.

## The access sequence

On each load, the app (`App.tsx`) checks a sequence of gates before showing the main screens:

1. Not logged in → **Login**.
2. Owner without a shop → **Shop Setup**.
3. Vault not yet created → **Vault Setup** (create PIN, optionally register a passkey).
4. Vault locked → **Vault Unlock** (PIN or passkey).
5. Shared device with no active operator (multi-role on) → **Lock Screen** (pick staff + PIN).
6. Authorized → **Main app**.

See [security-and-vault.md](./security-and-vault.md) for the vault steps.

## Single-operator vs multi-role

- **Multi-role OFF:** the app auto-logs-in as the admin/first staff member — a frictionless single-operator experience. The role/lock-screen UI is hidden.
- **Multi-role ON:** staff select who they are on a lock screen and enter their PIN. Each role sees a different set of tabs, and the kitchen role is locked to the Kitchen screen.

## Language

Haang is **Khmer-first** but supports **English, Chinese, Japanese, and Korean**. The language can be switched anytime from the top bar or sidebar, and a shop's **default language** is saved in Settings and applied on load (including on the public storefront).

## Offline & PWA

Haang is an installable **Progressive Web App**:

- An **install banner** appears on supported browsers ("Install Little Tony APP"); installing enables quick-launch and offline operation.
- The app **tracks connectivity** and shows an **Offline Mode** banner when the network drops, continuing to run against cached local data.
- Images are **compressed client-side** (resized to max 1024px, JPEG quality 0.7) before upload to save bandwidth — important for Cambodian mobile networks.

## Deployment

- Build with `npm run build`; preview with `npm run preview`.
- Deploy to **Cloudflare Pages** with `npm run deploy`.
- Requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (client) and a `GEMINI_API_KEY` configured as a **Supabase Edge Function secret** (never in the client).
- The database schema and RLS policies are installed by running `supabase/rbac_policies.sql` in the Supabase SQL editor.
