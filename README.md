# Haang (ហាង) — Little Tony APP

**Haang** is a mobile-first **Point of Sale (POS) and Inventory Management** system built specifically for **Cambodian small businesses (SMEs)**. It supports both **retail shops** and **restaurants**, ships as an installable **offline-capable PWA**, is **Khmer-first and bilingual**, and uses **AI (Google Gemini)** to assist with everyday shop tasks.

> The project is currently branded **"Little Tony APP"**. *Haang* (ហាង) is the Khmer word for "shop/store".

---

## ✨ Key Features

### Sales & Operations
- **POS** — fast cart & checkout, barcode scanning, multi-currency (KHR/USD with exchange rate), and configurable discount rules.
- **Inventory** — products with variants & attributes (size, color, etc.), stock tracking, categories, and low-stock alerts.
- **Orders & Receipts** — sales history, CSV export, publicly shareable receipts, and **Bluetooth thermal printing** (58mm/80mm ESC/POS).
- **Customers (CRM)** — customer profiles with **debt / credit tracking** (buy-now-pay-later) and repayment history.
- **Dashboard** — sales, expense and profit analytics, VAT reporting, and top-selling insights.

### Restaurant Mode
- **Tables / Rooms** management with live status and table sessions.
- **Kitchen display** with per-item order status (pending → confirmed → cooking → served).
- **Bookings** and customer-to-staff table messaging (call waiter / request bill).

### Storefront & Payments
- **Public Store / QR Menu** — a shareable online storefront so customers can browse and order.
- **Payment methods** with KHQR / bank QR codes.
- **AI payment verification** — reads payment-proof screenshots (ABA, ACLEDA, KHQR) to auto-extract amounts.

### AI Assistance (Google Gemini)
- AI **business insights** and tips from live sales & inventory data.
- AI-generated **product descriptions**, **logos**, and **product images**.
- **Barcode lookup** (with search grounding) and **OCR import** of handwritten/paper orders.

> All AI calls are proxied through **Supabase Edge Functions**, so the Gemini API key never reaches the browser.

### Security & Access
- **Role-based access** for staff: `admin`, `manager`, `cashier`, `waiter`, `kitchen`, with **6-digit PIN** login and a shared-device lock screen.
- **Zero-Knowledge Vault** — client-side encryption using **WebAuthn passkeys (PRF extension)**, **PBKDF2 (600k iterations)** and **AES-GCM**. The backend stores only ciphertext; keys are derived entirely in the browser.

### Platform
- **Offline-first PWA** — installable, cached local storage, and network-status awareness so the app keeps working without internet.
- **Localization** — Khmer-first UI with English, and type-level support for `en`, `km`, `zh`, `ja`, `ko`.

---

## 🧱 Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React + TypeScript, Vite, Tailwind CSS |
| UI | `lucide-react` icons, `recharts` charts |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions) |
| AI | Google Gemini (via Supabase Edge Functions) |
| Hardware | Web Bluetooth (ESC/POS thermal printers), camera barcode scanning (`html5-qrcode`) |
| Deployment | Cloudflare Pages (`wrangler`), PWA (`vite-plugin-pwa`) |

---

## 📁 Project Structure

```
├── App.tsx              # Root app: routing, auth gates, vault gates, PWA logic
├── pages/               # Feature screens (POS, Inventory, Dashboard, Tables, Kitchen, ...)
├── components/          # Shared UI (LockScreen, BarcodeScanner, Logo, zk-vault/*)
├── store/               # StoreContext (app state + i18n) and UIContext
├── services/            # Supabase client, Gemini, storage, printer, schema
├── zk-vault/            # Zero-knowledge encryption (crypto, context, hooks)
├── supabase/            # Edge Functions, RBAC policies, seed SQL
└── types.ts             # Shared domain types (Shop, Product, Sale, Staff, ...)
```

---

## 🚀 Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables in `.env.local` (see `.env.example`):
   ```
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```
   The `GEMINI_API_KEY` is configured as a **Supabase Edge Function secret**, not in the client.
3. Run the app:
   ```bash
   npm run dev
   ```

### Build & Deploy
```bash
npm run build     # production build
npm run preview   # preview the build locally
npm run deploy    # deploy to Cloudflare Pages
```

---

*View the original AI Studio app: https://ai.studio/apps/drive/1kNN3PMJnNVQd1RItt_eRFqOVzj_pn_Uk*
