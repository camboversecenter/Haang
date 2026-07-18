# Customers (CRM)

The Customers screen (`pages/Customers.tsx`) is a lightweight CRM focused on the credit/debt tracking that Cambodian shops rely on ("buy now, pay later").

**Who can use it (UI):** Admin, Manager, Cashier. **Who can write (server/RLS):** Admin, Manager, Cashier, and the owner.

## Customer list

- Each row shows initials avatar, name, phone, email, and a "Linked" badge when an email is present (used for public-store account linking).
- **Search** matches name, phone, or email.
- **Debt** per customer: shown in red as `-{amount}` when `totalDebt > 0`, otherwise a green "0 ៛".
- A summary card at the top shows **total outstanding debt** across all customers.

## Add / edit a customer

- **Add** (+ button) or **Edit** (pencil) opens a modal with **Name** (required), **Phone**, and **Email** (for account linking).
- Customers can also be created inline during POS checkout, and are auto-created by phone from the public storefront.

## Debt / credit model

- Debt is stored per customer as a lifetime running balance (`totalDebt`).
- A **credit sale** in the POS (payment method `credit`, requires a selected customer) adds to that customer's debt.
- Repayments reduce it.

## Repaying debt

- A **Pay Debt** button appears on any customer with `totalDebt > 0`.
- The repay modal shows the current debt and takes an amount (in Riel); `repayDebt(customerId, amount)` records the payment.

⚠️ **Current behavior:** `repayDebt` is a stub in this version — the UI records a payment and toasts success, but the underlying balance update is not yet implemented. Treat debt figures as driven by credit sales until this is wired up.

## Purchase & payment history

- A **History** button opens a timeline of that customer's activity, built from sales that are either **credit purchases** (`paymentMethod === 'credit'`) or **repayments** (a line item flagged `debt-repay`).
- Entries are color-coded: **Payment Received** (green, `+`) vs **Credit Purchase** (red, `-`), with date/time and amount.
- Tapping an entry opens its full [receipt](./orders-and-receipts.md).
- The history footer repeats the total debt and offers a **Pay Debt** shortcut.

## Related
- Credit sales are created in the [POS](./pos.md).
- Public-store customers self-register and link accounts via Google — see [public-store.md](./public-store.md).
