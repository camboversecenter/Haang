# Settings

The Settings screen (`pages/Settings.tsx`) is where admins configure the shop. It has five tabs: **General, Staff, Discounts, Payments, Hardware.**

**Who can use it (UI):** Admin and Manager. **Server enforcement (RLS):** several sections are **admin-/owner-only** for writes — see the note in each section and [user-roles.md](./user-roles.md).

## General tab

### Shop Profile
- **Logo** — upload or **Generate with AI** (needs a shop name).
- **Shop name**, **business type** (Retail / Restaurant), **address**, **phone**.

### Features (toggles)
- **Public Store / QR Menu** (`enablePublicStore`)
- **Table Booking** (`enableBooking`)
- **Product Variants / Attributes** (`enableAttributes`)
- **Multi-Role Staff** (`enableMultiRoles`)

### VAT / Tax
- A single **tax rate (%)** used for VAT calculations.

### Language
- Default language: English, Khmer, Chinese, Japanese, or Korean. Applied immediately and saved to the shop.

⚠️ **Note:** there is no currency / exchange-rate field in Settings; amounts are handled in Riel (៛).

**Access:** shop settings are **admin-/owner-only** at the database level. A manager can open this tab but core settings writes are restricted to admins.

## Staff tab

- Lists staff with avatar, name, role badge, and a masked PIN.
- **Add / edit** staff: name, **6-digit PIN**, and role (**Cashier, Waiter, Manager, Admin, Kitchen**).
- Delete is available for non-admin staff (with confirmation).
- Includes a "How Staff Login Works" info box and a sign-out button.

**Access:** staff accounts are **admin-/owner-only** (they contain PINs). See [user-roles.md](./user-roles.md) for the full role model.

## Discounts tab

Create and manage **discount rules** used automatically at checkout:

- **Type:** Percentage or Fixed amount, with a value.
- **Condition types:** Simple (all items), Bulk (minimum quantity), Category, Time (happy hour start/end), Weekly (days of week), Period (date range), Loyalty (returning customers).
- Rules can be listed and deleted.

**Access:** discount rules are **admin-/owner-only** for writes. How they apply is described in [pos.md](./pos.md).

## Payments tab

Configure the **payment methods** shown at checkout and on the public storefront:

- Bank/provider name, account name, account number, and an uploaded **QR code image**.
- Each method has an **Active/Inactive** toggle.

**Access:** payment methods are **admin-/owner-only** for writes.

## Hardware tab

### Printer
- Shows Bluetooth ESC/POS printer connection status and a **Connect** button.
- Supports 58mm/80mm thermal printers. See printing details in [orders-and-receipts.md](./orders-and-receipts.md).

## Summary: what managers vs admins can actually change

Managers see the Settings tabs in the UI, but the database restricts **Staff, core Settings, Discounts, and Payment Methods** to **admins and the owner**. Managers can still manage products, expenses, customers, tables, and bookings. This split is intentional — see the "Manager vs. Admin" note in [user-roles.md](./user-roles.md).
