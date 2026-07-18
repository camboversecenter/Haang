# Haang Documentation

Detailed documentation for **Haang** (branded *Little Tony APP*) — a mobile-first Point-of-Sale and Inventory Management PWA for Cambodian small businesses, supporting both retail shops and restaurants.

> These docs describe the application **as implemented in the current codebase**. Where a feature's UI exists but its underlying logic is a stub or has a known discrepancy, it is called out in a **⚠️ Current behavior** note so operators and developers aren't surprised.

## Contents

### Getting Started & Access
- [Getting Started](./getting-started.md) — authentication modes, shop setup, login, offline/PWA.
- [User Roles & Access Control](./user-roles.md) — the five staff roles, permission matrix, RLS enforcement.
- [Security & Zero-Knowledge Vault](./security-and-vault.md) — RLS, client-side encryption, passkeys.

### Core Features
- [Point of Sale (POS)](./pos.md) — selling, cart, discounts, checkout, payment methods.
- [Inventory](./inventory.md) — products, variants, categories, stock, barcodes, QR menu links.
- [Orders & Receipts](./orders-and-receipts.md) — sales history, voiding, manual entry, AI receipt scan, printing.
- [Customers (CRM)](./customers.md) — customer profiles, debt/credit tracking, repayment.
- [Dashboard & Reports](./dashboard.md) — revenue/profit metrics, expenses, top sellers, AI insight.

### Restaurant & Storefront
- [Tables & Bookings](./tables-and-bookings.md) — table/room management, sessions, reservations, AI booking assistant.
- [Kitchen Display](./kitchen.md) — live kitchen ticket board and item-status flow.
- [Public Store / QR Menu](./public-store.md) — customer-facing self-ordering storefront.

### Configuration & AI
- [Settings](./settings.md) — shop profile, features, staff, discounts, payments, hardware/printer.
- [AI Features](./ai-features.md) — all Gemini-powered capabilities and how they're secured.

## Quick platform summary

| Aspect | Detail |
|--------|--------|
| Frontend | React + TypeScript, Vite, Tailwind CSS |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions) |
| AI | Google Gemini via Supabase Edge Functions |
| Deployment | Cloudflare Pages, installable PWA (offline-capable) |
| Languages | Khmer (default), English, Chinese, Japanese, Korean |
| Currency | Cambodian Riel (៛) — display is KHR-only; currency/exchange rate are stored per sale |
| Product limit | 200 products per shop |
| Staff PIN | 6 digits |
