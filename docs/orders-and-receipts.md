# Orders & Receipts

## Orders (`pages/Orders.tsx`)

The Orders screen is the sales history and order-management hub.

**Who can use it:** Admin, Manager, Cashier, Waiter. (Kitchen cannot.)

### Sales history list
- Each sale card shows a short id (`#` + last 6 chars), status badge, date/time, item count and names, total, and payment method.
- Tapping a sale opens its detail (a [ReceiptView](#receipts-receiptviewtsx) modal) and reflects it in the URL (`?orderId=`).
- **Load More** paginates older sales (hidden while a filter or search is active).

### Filters & statuses
Filter tabs: **All, Pending, Completed, Cancelled, Verifying (pending_verification), Debt.** Search matches sale id or item names.

Order status lifecycle observed across the app:
`pending` → `pending_verification` (payment proof uploaded) → `confirmed` (staff verifies) → `completed` (finished) / `cancelled`.

### Verifying orders (payment verification)
When an opened order is **pending_verification**, a panel shows the uploaded **payment proof** image with **Reject** and **Confirm & Complete** actions.
- **Reject** sets the order to `cancelled`.
- ⚠️ **Current behavior:** **Confirm** (`verifyOrder`) is a stub in this version — it shows a success toast and closes, but does not itself change the stored status.

### Voiding a completed sale (with inventory restore)
- The **Void** action appears only on completed orders and only for **Admin/Manager** (cashiers are blocked).
- Voiding (`cancelSale`) sets the status to `cancelled` and **restores stock** (adds quantities back, variant-aware) — important for accounting integrity, since sales are never hard-deleted.

### Manual order entry
Add Order → **Manual** tab: pick a date/time, add item rows (with product autocomplete filling name + price), up to **50 items**, choose cash or KHQR. Saving builds a completed sale and decrements stock. Rejects a zero total.

### AI receipt scanning
Add Order → **Scan** tab: photograph a paper/handwritten order; Gemini OCR extracts items into the manual form for review (capped at 50). See [ai-features.md](./ai-features.md).

### CSV export
An **Export CSV** button exists.

⚠️ **Current behavior:** `exportSalesData` is a stub in this version — it toasts success but does not yet produce a file.

---

## Receipts (`pages/ReceiptView.tsx`)

Renders a thermal-style receipt. It works in two modes:
- **From a sale object** — the POS success screen and the Orders detail view.
- **From a receipt id** — the public/shared view (`#/r/{saleId}`), which fetches the sale and shop details from Supabase.

### What's shown
- **Header:** shop logo, name, "Official Receipt", and a "Paid via {method}" badge.
- **Meta:** date and short id.
- **Items:** name, `qty × unit price` (with variant name), and line total.
- **Totals:** gross subtotal, discount line, VAT/tax (if any), and total, plus a note listing applied discount rules.

### Sharing
- Builds a shareable hash URL (`#/r/{saleId}`) with a QR code.
- The **Share** button uses the native share sheet where available, otherwise copies the link.

### Printing
- **Thermal Print** — connects a Bluetooth printer if needed, then prints via ESC/POS.
- **A4 Print** — uses the browser print dialog (the layout has print-optimized styles: grayscale logo, hidden buttons/QR, a "Powered by Little Tony APP" footer).

---

## Thermal printing (`services/printerService.ts`)

- Uses **Web Bluetooth** with standard thermal-printer service/characteristic UUIDs (Chrome on Android/desktop required).
- Sends **ESC/POS** commands; paper width is **32 characters (58mm)**.
- The printed receipt includes: centered shop name/phone/date/order id, left-aligned items with right-aligned line totals, a bold `Total … KHR` line, and a "Thank You! / Powered by Little Tony APP" footer. Data is written in small chunks with a 50ms delay to avoid overflowing cheap printers.

⚠️ **Notes:**
- The thermal receipt prints a single **Total** line (no tax/discount breakdown), whereas the on-screen receipt shows the full breakdown.
- Text is sent as UTF-8; Khmer text may not render on printers lacking that codepage.
- Configure/connect the printer in [Settings → Hardware](./settings.md).
