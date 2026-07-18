# User Roles & Access Control

Haang supports two distinct **authentication modes** and a **five-role permission model**. Access is enforced in two layers: the client UI (which tabs/actions are visible) and the Supabase **Row-Level Security (RLS)** policies (what the database actually allows). This document describes both.

---

## Authentication Modes

### 1. Shop Owner (Supabase Auth)
- Signs in with **Google** (OAuth) or **Demo Mode**.
- Is the literal `owner_id` of the shop record.
- Has **full, unconditional access** to every table and feature — RLS grants owners automatic access via the `is_shop_owner()` check, bypassing all role restrictions.
- Owns the shop's setup, settings, and the **Zero-Knowledge Vault** (see [security-and-vault.md](./security-and-vault.md)).

### 2. Staff (Shared-Device / PIN)
- Used on shared terminals where several employees operate one device that is authenticated as the owner.
- A staff member logs in with the **shop phone number + a 6-digit PIN** (`staff_login` DB function), or switches on the lock screen.
- The active staff member's role and ID are attached to every database request as secure custom headers (`x-staff-role`, `x-staff-id`), which the RLS helper functions (`get_active_staff_role()`, `verify_staff_permission()`) verify on **every write** to prevent privilege escalation.
- Multi-role mode is toggled by the **"Multi-Staff / Roles"** setting (`enableMultiRoles`). When off, the app auto-logs-in as the admin/first staff member for a single-operator experience.

> **Default admin:** A new shop can create an admin with **PIN `123456`** from the lock screen. PINs are **6 digits**.

---

## The Five Staff Roles

| Role | Khmer | Purpose |
|------|-------|---------|
| **Admin** | Admin (សិទ្ធិពេញ) | Full access — the digital equivalent of the owner for daily operations. |
| **Manager** | អ្នកគ្រប់គ្រង | Operations & oversight; most features except the most sensitive owner/admin-only config. |
| **Cashier** | អ្នកគិតលុយ | Front-of-house selling, checkout, and customer/debt handling. |
| **Waiter** | អ្នករត់តុ | Restaurant floor: tables, orders, and taking sales. |
| **Kitchen** | ចុងភៅ | Kitchen display only — advances food preparation status. |

---

## What Each Role Can Access (Client UI)

The navigation bar (`App.tsx`) shows tabs based on role:

| Tab | Admin | Manager | Cashier | Waiter | Kitchen |
|-----|:-----:|:-------:|:-------:|:------:|:-------:|
| **POS** (sell) | ✅ | ✅ | ✅ | ✅ | — |
| **Inventory** | ✅ | ✅ | ✅ | — | — |
| **Tables / Rooms** | ✅ | ✅ | ✅ | ✅ | — |
| **Kitchen** * | ✅ | ✅ | — | — | ✅ |
| **Orders** | ✅ | ✅ | ✅ | ✅ | — |
| **Customers** | ✅ | ✅ | ✅ | — | — |
| **Dashboard** | ✅ | ✅ | — | — | — |
| **Settings** | ✅ | ✅ | — | — | — |

\* The **Kitchen** tab only appears for restaurant-type shops. Staff with the `kitchen` role are automatically force-redirected to the Kitchen screen and cannot navigate away.

---

## What Each Role Can Write (Server / RLS Enforcement)

The database is the source of truth. Even if the UI shows an action, RLS blocks unauthorized writes. **Reads are public** for most catalog/menu tables (so QR customers can browse); **writes** are restricted as follows:

| Data | Owner | Admin | Manager | Cashier | Waiter | Kitchen |
|------|:-----:|:-----:|:-------:|:-------:|:------:|:-------:|
| **Products / Inventory** | ✅ | ✅ | ✅ | — | — | — |
| **Staff accounts (PINs)** | ✅ | ✅ | — | — | — | — |
| **Sales — create** | ✅ | ✅ | ✅ | ✅ | ✅ | (public too) |
| **Sales — update** | ✅ | ✅ | ✅ | ✅ | ✅ | status only |
| **Tables & Bookings** | ✅ | ✅ | ✅ | — | ✅ | — |
| **Shop Settings** | ✅ | ✅ | — | — | — | — |
| **Expenses / Accounting** | ✅ | ✅ | ✅ | — | — | — |
| **Discount Rules** | ✅ | ✅ | — | — | — | — |
| **Payment Methods** | ✅ | ✅ | — | — | — | — |
| **Customers & Debt** | ✅ | ✅ | ✅ | ✅ | — | — |
| **Product Activity log — read** | ✅ | ✅ | ✅ | — | — | — |
| **Table Messages (call waiter/bill)** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Important nuance: Manager vs. Admin
In the **client UI**, managers are treated like admins (they see the Dashboard and Settings tabs). But the **database is stricter** — several tables are **admin-only** for writes:
- **Staff accounts**, **Shop Settings**, **Discount Rules**, and **Payment Methods** can only be modified by an **admin or the owner**.
- A manager who opens Settings can therefore edit things like products and expenses, but attempts to change staff, core settings, discounts, or payment methods will be rejected by RLS.

### Kitchen role restriction
Kitchen staff can update a sale's **order status** (`pending`, `cooking`, `ready`, `served`) but **cannot** modify items or pricing — this is enforced by a conditional check in the sales `UPDATE` policy.

### Deletes
Sales are **never hard-deleted** by staff (accounting integrity). Cancelling/voiding is a **state change** (`orderStatus = 'cancelled'`) that restores inventory. Only owners have broad delete rights.

---

## Public / Customer Access (No Login)

Customers who scan a shop's QR code reach the **Public Store** without authenticating. RLS allows them to:
- **Read** shops, products, tables, settings, payment methods, and discount rules (to browse the menu and see prices/QRs).
- **Insert** sales (self-ordering), customer records (self-registration), bookings (reservations), and table messages (call waiter / request bill).
- **Read** only their own table's **active** (non-completed) orders to see a live bill.

See [public-store.md](./public-store.md) for the customer-facing flow.
