# Tables & Bookings

The Tables screen (`pages/Tables.tsx`) manages the floor plan and reservations. It serves both **restaurant tables** and non-restaurant **"rooms"** (the finish action reads "Close Table/Room" for non-restaurants).

**Who can use it (UI):** Admin, Manager, Cashier, Waiter. **Who can write (server/RLS):** Admin, Manager, Waiter, and the owner.

Two top-level views: **Layout** and **Schedule** (the Schedule tab only appears when **Booking** is enabled in Settings).

## Layout view — tables & sessions

### Table management
- **Add a table** with a name and capacity (default 4).
- Each card shows name, "{capacity} Seats", and a status pill.
- A **filter bar** (All / Available / Occupied / Alert) narrows the grid; "Alert" surfaces tables with a pending call or bill request.

### Status
- Stored status is **available** or **occupied** (shown as FREE/BUSY), toggleable in the table detail modal.
- **"Reserved"** is a *derived* label, not a stored status — a table with an upcoming booking (within 24h) and no active order shows a yellow "Reserved: {time}" banner.

### Self-ordering & starting a session
- Each table has a **power toggle** for `allowOrdering`:
  - Turning it **on** confirms and **starts a new order session** for that table.
  - Turning it **off** disables customer self-ordering.
- This directly controls whether QR customers at that table can order (see [public-store.md](./public-store.md) — a customer at a closed table sees a "Table Closed" screen).

### Active orders
- A table's **active order** is its non-completed, non-cancelled sale.
- The card shows **elapsed time** (updated each minute), the **running total**, and — for restaurants — counts of **Pending** and **Cooking** items.
- Notification badges appear for **CALL** (call staff), **BILL** (request bill), **MSG** (chat), and **PAID?** (payment proof uploaded).

### Table detail modal
Opened via **Manage**:
- Shows the **payment proof** (with zoom) and, when a payment is reported (`pending_verification`), a **Verify** button that confirms items and marks the order `confirmed`.
- Lists each order item with quantity/variant and (restaurant) a **status badge**; items can be deleted or have their status changed.
- A **Confirm Pending Items** button pushes pending items to the kitchen.
- A **chat section** shows customer messages/alerts and lets staff reply; messages sync in **realtime** and can be cleared.
- A **Finish** button closes the session: for restaurants it warns if items are still pending or unserved, then completes the order and clears the table.

### Per-table QR
Each table has a **QR code** encoding `#/s/{shopId}?tableId={tableId}`, downloadable as a PNG — this is what diners scan to open the menu for their table.

## Schedule view — bookings

Only available when **Booking** is enabled.

- A custom **month calendar** with prev/next navigation; day cells show up to three bookings plus a "+N more".
- A **selected-day agenda** lists bookings by time with customer name, assigned table (restaurant), notes, guest count, and a tappable phone link.
- **Add Booking** collects customer name, phone, date/time, an optional table, guest count, and notes. Name and time are required.

## AI booking assistant

In the Schedule view, an **AI Assistant** answers availability/schedule questions using current tables and bookings as context. See [ai-features.md](./ai-features.md).

⚠️ **Note:** the detail modal's "Log" sub-tab is currently an empty placeholder.
