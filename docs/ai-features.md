# AI Features

Haang embeds **Google Gemini** throughout the app to reduce manual data entry and give small-business owners insights they'd normally need an analyst for. Every AI call is proxied through **Supabase Edge Functions** (`gemini-api` and `gen-image`), so the `GEMINI_API_KEY` lives only in server-side secrets and never reaches the browser.

## Architecture

- Client code in `services/geminiService.ts` calls `supabase.functions.invoke('gemini-api', { body: { action, payload } })`.
- The Edge Function (`supabase/functions/gemini-api/index.ts`) switches on `action`, builds a prompt, calls Gemini, and returns the result.
- Text/vision actions use `gemini-3-flash-preview`; image generation uses `gemini-2.5-flash-image`.
- Image generation has a **robust fallback chain**: it tries a dedicated `gen-image` function first, then a nested `{action, payload}` shape, then the legacy `gemini-api` function — and normalizes several possible response shapes into base64.

## Capabilities

### 1. Business Insight (Dashboard)
- **Where:** Dashboard → "Ask AI".
- **What:** Acts as a business consultant for a Cambodian shop, returning a short summary plus 2 actionable tips, in the user's language.
- **Input:** a sales summary (revenue, top product, transaction count) and inventory summary (low-stock items).
- ⚠️ **Current behavior:** because full per-sale objects aren't held in memory on the Dashboard, the insight is generated from **aggregate figures** (fabricated placeholder sales derived from totals), not individual transactions.

### 2. Product Description Writer (Inventory)
- **Where:** Inventory → product form → "Auto Write".
- **What:** Generates a short, friendly, persuasive product description (max ~50 words) from the product name, in the selected language. Requires a name first.

### 3. Logo Generation (Shop Setup & Settings)
- **Where:** Shop Setup and Settings → Shop Profile → "Generate AI".
- **What:** Produces a modern, minimalist vector-style logo from the shop name; returned as a PNG file ready to upload.

### 4. Product Image Generation (Inventory)
- **Where:** Inventory → product form → "AI Gen".
- **What:** Generates professional product photography (clean white background, studio lighting) from the product name; returned as a PNG.

### 5. Barcode Lookup (Inventory)
- **Where:** Inventory → product form → barcode field → AI lookup, or auto-triggered after scanning a barcode on a **new** product.
- **What:** Uses Gemini **with Google Search grounding** to resolve a barcode into `{ name, description, category }`, translated into the shop's language. Disabled when editing an existing product.

### 6. Paper Order / Receipt OCR (Orders)
- **Where:** Orders → Add Order → "Scan Receipt".
- **What:** Photographs a handwritten order or paper receipt and extracts line items as `{ name, quantity, price }`. Rules: assumes qty 1 if missing, derives unit price from line totals, converts USD→KHR at 1:4000, ignores tax/subtotal lines. Results (capped at 50 items) populate the manual-order form for review.

### 7. Payment-Proof Verification (Public Store)
- **Where:** Public Store → Payment tab → upload payment proof.
- **What:** Reads a Cambodian bank-app screenshot (ABA, ACLEDA, KHQR) and extracts `{ amount, currency, transactionId }`. The app compares the detected amount to the order total (within a tolerance) to flag "AI Verified" vs "Amount Mismatch", then routes the order to staff for final verification (`pending_verification`).

### 8. Booking Assistant (Tables — restaurant)
- **Where:** Tables → Schedule view → AI Assistant.
- **What:** A restaurant-host assistant that answers availability/schedule questions using the current tables and bookings as context, in the user's language.

## Language handling

All AI actions accept a `language` parameter and are prompted to respond in that language (Khmer or English for most actions), keeping the assistant consistent with the shop's chosen UI language.

## Privacy & cost notes

- Only the minimal necessary data (summaries, a product name, or a single image) is sent per call.
- Because calls run server-side, the API key and quota are controlled centrally and can be rotated without shipping a new client build.
- The `gemini-api` function **verifies the caller** before spending any quota: the request must carry either a signed-in owner's session or a valid staff session token (`x-staff-token`). The project's anon key alone is not sufficient — it ships inside the public browser bundle, so accepting it would let anyone on the internet drain the AI budget.
