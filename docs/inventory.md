# Inventory

The Inventory screen (`pages/Inventory.tsx`) manages the product catalog: products, variants, categories, stock, barcodes, and QR menu links.

**Who can use it (UI):** Admin, Manager, Cashier. **Who can write (server/RLS):** Admin, Manager, and the owner. (A cashier can browse inventory but product writes are blocked by RLS.)

**Limit:** up to **200 products** per shop. The header shows a live `count / 200` counter and blocks adding beyond the limit.

## Products

Add and edit share one full-page modal. Product fields:

| Field | Notes |
|-------|-------|
| **Name** | Required |
| **Price** | In Riel (៛), step 100 |
| **Stock** | Number, or a simple In/Out toggle when tracking is off |
| **Track Stock** | Toggle (see below) |
| **Category** | Free-text with autocomplete; defaults to "General" |
| **Image** | Upload, camera capture, or AI-generated; compressed before upload |
| **Barcode** | Optional; scannable; supports AI lookup |
| **Description** | Optional; supports AI "Auto Write" |
| **Attributes / Variants** | Optional (see below) |

- **Search** matches name or barcode.
- Images are uploaded **only on Save** (a "pending save" hint shows meanwhile), compressed to max 1024px JPEG at 0.7 quality; replacing an image deletes the old one from storage.

⚠️ **Current behavior:** there is **no delete-product button** in the Inventory UI. Products can be edited but not removed from this screen.

## Variants & attributes

Only available when **"Product Variants"** is enabled in Settings.

- Define up to **2 attributes** (e.g. Size, Color), each with comma-separated options.
- **Generate Variants** produces every combination (cartesian product) — each variant has its own **price** and **stock**.
- When variants exist, the standalone price/stock fields are replaced by a per-variant table, and the product's total stock becomes the **sum of variant stocks**. "Regenerate" rebuilds combinations (resetting prices to base, stock to 0).

## Categories

- Categories are **derived** from products, not a separate table — a category exists as long as at least one product uses it. **"General"** always exists.
- Assign a category by picking an existing one or typing a new one in the product form.
- The **Category Manager** lets you:
  - **Rename** a category (updates every product using it).
  - **Delete** a category (reassigns its products to "General"). The default "General" category cannot be deleted.

## Stock tracking

- **Track Stock ON:** a numeric stock count. Card badges: red "Out of Stock" at `≤ 0`, orange "Low Stock" under 5, green with the count otherwise.
- **Track Stock OFF:** availability is modeled with a simple **In Stock / Out of Stock** toggle (In = 100, Out = 0). Card shows a blue "In Stock" (∞) or red "Out of Stock" badge.
- The **low-stock threshold is `< 5`**, used consistently across the card badges, the Dashboard alert, and AI insights.

Stock is automatically decremented on sales/checkout and restored when a completed sale is voided (see [orders-and-receipts.md](./orders-and-receipts.md)).

## Barcodes

- Scan with the camera or type into the barcode field.
- On a **new** product, a scan auto-triggers an **AI barcode lookup** that fills in name, description, and category (using Gemini with Google Search). Lookup is disabled when editing an existing product.

## AI in Inventory

- **Auto Write** — AI-generated product description from the name.
- **AI Gen** — AI-generated product image from the name.
- **Barcode lookup** — resolves a barcode to product details.

See [ai-features.md](./ai-features.md) for details.

## Public menu links & QR codes

- A **Public Link** banner in the header opens the shop's QR code for self-service ordering (`#/s/{shopId}`).
- Each product also has its **own QR** (`#/s/{shopId}?productId={id}`).
- QR codes can be **copied** as a link or **downloaded** as a 1000×1000 PNG.

See [public-store.md](./public-store.md) for the customer-facing side.

## Product activity / audit trail

- When editing a product, a **Details | Activity** tab switcher appears. The Activity tab is designed to show a timeline of product events (create, update, restock, sale, stock change, delete) with who performed each and when, and states that logs older than ~3 months are auto-deleted.

⚠️ **Current behavior:** the activity data functions are stubs in this version, so the Activity tab currently always shows the empty state. The `product_activities` table, types, and UI exist for when the logging is wired up.
