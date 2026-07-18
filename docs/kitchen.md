# Kitchen Display

The Kitchen screen (`pages/Kitchen.tsx`) is a Kitchen Display System (KDS) — a full-screen, dark ticket board for the cooking staff. **It is restaurant-only.**

**Who can use it:** the **Kitchen** role (locked to this screen), plus Admin and Manager.

## What it shows

- A live board of **active order tickets**, oldest first (FIFO).
- A ticket appears when its order is `pending`, `pending_verification`, or `confirmed` **and** contains at least one item marked `confirmed` or `cooking`.
- Each ticket card shows the **table name**, a short order id, and **elapsed minutes** since the order was placed.
- Only kitchen-relevant items are listed per ticket; items that are still `pending` (not yet sent by front-of-house) or already `served` are excluded.
- When nothing is active, an "All orders completed!" empty state shows.

The board updates in **realtime** via a Supabase subscription to sales changes.

## Item status flow

Kitchen staff tap an item to advance it:

```
confirmed ("To Cook")  →  cooking ("Cooking")  →  served
```

- **To Cook** (confirmed) — yellow, sent by front-of-house, waiting to be started.
- **Cooking** — blue, with a pulsing flame badge.
- Once marked **served**, the item drops off the board.

A footer hint reads "Tap item to change status."

## Access notes

- Kitchen staff are **force-redirected** to this screen and cannot navigate to other tabs.
- Per RLS, the kitchen role can update **order status only** — it cannot modify items or pricing.

## Related
- Items reach the kitchen when staff confirm them on the [Tables](./tables-and-bookings.md) screen (or a customer orders and staff confirm).
- The customer-facing flow that creates these items is in [public-store.md](./public-store.md).
