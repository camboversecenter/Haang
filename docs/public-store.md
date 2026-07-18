# Public Store / QR Menu

The Public Store (`pages/PublicStore.tsx`) is the **customer-facing** storefront reached by scanning a shop or table QR code. It requires no staff login and loads its own data directly from Supabase.

**Access:** open to anyone (public). RLS allows customers to read the menu and insert their own orders, bookings, and messages.

## Entry & routing

- Reached at `#/s/{shopId}`, optionally with `?tableId=...` for a specific table.
- If the shop has **Public Store** disabled, customers see a "Store Currently Offline" screen.
- For a restaurant table where **self-ordering is off**, customers see a **"Table Closed — please ask a staff member to open this table"** screen with a refresh button. This mirrors the staff `allowOrdering` toggle on [Tables](./tables-and-bookings.md).

## Browsing the menu

- Header shows the shop logo/name, a "Table: {name}" badge (table context), a language toggle, and a customer sign-in chip.
- A 2-column product grid with images and prices, a search box, and category chips.
- **Sold Out** overlay when a tracked product is out of stock; a **"Hot"** flame badge on popular items (popularity computed from recent public sales).
- Tabs: **Menu / Bill / Payment / History** (Bill and Payment appear for restaurant+table; History when signed in).

## Ordering

### Restaurant (table-based, live order)
- Adding an item **immediately writes to the shared order** for that table (creating the sale if needed), with each item flagged `pending`.
- Item additions log an activity entry and **broadcast a realtime event** so staff see the update instantly.
- The **Bill** tab lists items, lets customers remove **pending** items (items already sent to the kitchen are locked), shows a live subtotal/VAT/total, and lets them link their name/phone to the order.

### Retail (cart-based)
- Items go into a local cart; **Place Order** collects name + phone (finds-or-creates a customer), then creates a sale marked `pending_verification` and directs the customer to the Payment tab to upload a receipt.

## Payment

- The **Payment** tab shows the shop's active payment methods; selecting one reveals its **QR code**, account name, and number.
- Customers can **upload a payment proof**; Gemini reads the amount and compares it to the order total ("AI Verified" vs "Amount Mismatch"), uploads the image, marks the order `pending_verification`, and notifies staff. See [ai-features.md](./ai-features.md).

## Calling staff

On a restaurant table menu, customers get three actions:
- **Call Staff** — sends an `alert_call` notification.
- **Bill** — sends an `alert_bill` request.
- **Chat** — opens a message thread.

These arrive on the staff [Tables](./tables-and-bookings.md) screen as CALL / BILL / MSG badges in realtime.

## Customer accounts & history

- Customers can **sign in with Google**; the app links their email to a customer record for this shop.
- The **History** tab lists their past orders; tapping one opens the receipt and (for unpaid orders) allows uploading a payment receipt.

## How orders reach staff

Public orders are written to the shared `sales` table (with `tableId` for restaurants or `customerId` for retail). Staff surfaces pick them up in realtime — the [Kitchen](./kitchen.md) board shows confirmed items, and the [Tables](./tables-and-bookings.md) screen shows each table's active order and alerts.

⚠️ **Current behavior:** the customer-side **chat view / activity log** is incomplete in this version — the chat message state is never populated and no chat modal is rendered, even though the Call/Bill alerts (which staff do receive) work.
