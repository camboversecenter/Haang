# AGENTS.md

Guidance for AI coding agents (and new developers) working in the **Haang** repository. Read this before making changes.

## What Haang is

**Haang** (ហាង, "shop") — branded **Little Tony APP** — is a mobile-first **Point-of-Sale (POS) and Inventory Management** Progressive Web App for **Cambodian SMEs**, supporting both **retail** and **restaurant** businesses. It is Khmer-first, offline-capable, and uses Google Gemini for AI assistance.

- **License:** Apache-2.0 (see `LICENSE`, `NOTICE`, `TRADEMARK.md`). Community-driven; revenue is support/donations/grants/training, not software sales.
- **Incubated by:** CamboVerse Center, National University of Management (NUM).
- **Full docs:** see the [`docs/`](./docs/) folder — start at `docs/README.md`.

## Tech stack

- **Frontend:** React + TypeScript, Vite, Tailwind CSS (via CDN in `index.html`).
- **UI:** `lucide-react` icons, `recharts` charts, `react-qr-code`, `html5-qrcode` (barcode scanning).
- **Backend:** Supabase — Postgres, Auth (Google OAuth), Storage, Edge Functions.
- **AI:** Google Gemini, called **only** through Supabase Edge Functions (`gemini-api`, `gen-image`).
- **Hardware:** Web Bluetooth (ESC/POS thermal printers).
- **Deploy:** Cloudflare Pages (`wrangler`), installable PWA (`vite-plugin-pwa`).

## Commands

```bash
npm install          # install dependencies
npm run dev          # local dev server (Vite)
npm run build        # production build
npm run preview      # preview the production build
npm run deploy       # deploy to Cloudflare Pages (wrangler)
```

There is currently **no test suite, linter, or formatter** configured. Verify changes by running `npm run dev` / `npm run build` and exercising the affected screen.

## Environment

- Client env (`.env.local`, see `.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- **`GEMINI_API_KEY` is a Supabase Edge Function secret — never put it in client code or `.env` shipped to the browser.**
- Database schema + RLS live in `supabase/rbac_policies.sql` (run in the Supabase SQL editor). Additional SQL in `supabase_updates.sql` and `supabase/seed.sql`.

## Project structure

```
App.tsx              # Root: routing (hash-based), auth gates, PWA logic, nav
index.tsx            # React entry
types.ts             # Shared domain types (Shop, Product, Sale, Staff, ...)
pages/               # Feature screens (see docs/ for each)
components/          # Shared UI (LockScreen, BarcodeScanner, Logo)
store/
  StoreContext.tsx   # Central app state + business logic + i18n (large, key file)
  UIContext.tsx      # Toasts/confirm dialogs
services/
  supabaseClient.ts  # Supabase client + staff header injection
  supabaseSchema.ts  # DB_CONSTANTS (table names)
  geminiService.ts   # All AI calls (via Edge Functions)
  storageService.ts  # Image compression + Supabase Storage upload/delete
  printerService.ts  # Bluetooth ESC/POS printing
  syncQueue.ts       # Durable offline write queue (replays on reconnect)
supabase/            # Edge Functions + RBAC/RLS SQL
docs/                # Detailed feature & role documentation
```

## Architecture notes

- **State hub:** `store/StoreContext.tsx` holds nearly all app state and business logic (products, cart, sales, customers, staff, tables, discounts, etc.) and the i18n dictionary (`TRANSLATIONS`) with `t(key)`. Most features call `useStore()`. UI helpers (`showToast`, `showConfirm`) come from `useUI()`.
- **Data mapping:** the DB uses `snake_case`; the app uses `camelCase`. Mapping happens manually in `StoreContext` (e.g. `image_url` ↔ `imageUrl`, `track_stock` ↔ `trackStock`). Keep this in sync when adding fields.
- **Routing** is hash-based in `App.tsx`: `#/s/{shopId}` (public store), `#/r/{saleId}` (public receipt), plus legacy `?mode=` params. There is no router library.
- **Roles & access:** two auth modes (Google **owner**, or **staff** via shop phone + 6-digit PIN). Five roles: `admin, manager, cashier, waiter, kitchen`. Staff identity is a **server-minted session token** (`x-staff-token` header, set via `setSupabaseStaffToken`) created only after a server-side PIN check; Postgres RLS resolves role/shop from `staff_sessions` on every request and an active staff session outranks the owner session. PINs are bcrypt-hashed at rest. See `docs/user-roles.md`, `docs/security.md`, and `supabase/rbac_policies.sql`.
- **Security:** server-enforced via Supabase RLS (see `supabase/rbac_policies.sql` and `docs/security.md`). A client-side zero-knowledge vault was previously integrated as a login gate but encrypted no data, so it was removed entirely (both the integration and the standalone library).
- **Offline:** the app is offline-capable (see `docs/getting-started.md`). Reads are served from the service-worker cache; writes go through `services/syncQueue.ts` (`dbWrite`), which queues to localStorage when offline and replays FIFO on reconnect. Prefer `dbWrite` over raw `supabase.from().insert/update/delete` for new mutations.
- **AI:** never call Gemini directly from the client. Add new AI capabilities as an `action` in `supabase/functions/gemini-api/index.ts` and a wrapper in `services/geminiService.ts`.
- **i18n:** the app supports `en, km, zh, ja, ko` and is **Khmer-first**. Add new UI strings to every language block in `TRANSLATIONS` (`store/StoreContext.tsx`) and use `t('key')` — don't hardcode display text.
- **Currency:** display is **Cambodian Riel (៛)** via `formatPrice`. Currency/exchange rate are stored per sale but display formatting is KHR-only.

## Conventions

- **TypeScript + React function components + hooks.** Match the surrounding style (the codebase favors inline Tailwind classes and fairly large single-file screens).
- **Tailwind:** custom theme tokens are defined inline in `index.html` (`brand`, `accent`, `khmer` colors; `font-display` for Khmer display font). Reuse them.
- **New DB-backed features:** add the table + RLS policy in `supabase/rbac_policies.sql`, a constant in `services/supabaseSchema.ts`, types in `types.ts`, and state/actions in `StoreContext.tsx`.
- **Commit messages:** Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`). Contributions use **DCO sign-off** (`git commit -s`) — see `CONTRIBUTING.md`.
- **Product limit:** 200 products/shop (`MAX_PRODUCTS_LIMIT`). Staff PINs are 6 digits.

## Known gaps / gotchas (don't be surprised)

These are real in the current code (documented with ⚠️ notes in `docs/`):

- **Product activity log is a stub:** `getProductActivities`/`fetchMoreActivities`/`hasMoreActivities` return empty data, so the Inventory Activity tab always shows its empty state. (The other former stubs — `verifyOrder`, `exportSalesData`, `repayDebt`, `findOrCreateCustomer` — are now implemented.)
- **No delete-product button** exists in the Inventory UI.
- **Realtime for standalone staff logins:** staff authenticated via phone+PIN (no Supabase auth session) receive live updates via broadcast only; `postgres_changes` events don't reach them because Realtime authorizes with the socket's JWT, not the staff token. Owner-session devices get both.
- **Schema upgrades:** after pulling changes to `supabase/rbac_policies.sql`, re-run that file in the Supabase SQL editor (it is idempotent and migrates data, e.g. hashing legacy plaintext PINs).

If you fix any of these, update the corresponding ⚠️ note in `docs/`.

## Safety & scope for agents

- **Never commit secrets.** `GEMINI_API_KEY` stays server-side; don't hardcode Supabase service-role keys.
- **Don't weaken RLS** without explicit instruction — it is the security backbone.
- **Keep the brand reserved:** code is Apache-2.0, but the "Haang"/"Little Tony" name and logo are trademarks (`TRADEMARK.md`). Don't add conflicting branding.
- When adding UI text, keep it translatable and Khmer-first.
- Prefer small, focused changes; update `docs/` when behavior changes.
