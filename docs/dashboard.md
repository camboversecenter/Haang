# Dashboard & Reports

The Dashboard (`pages/Dashboard.tsx`) gives owners and managers a financial overview, expense tracking, and AI-driven business advice.

**Who can use it:** Admin and Manager only.

## Metrics

A grid of cards, driven by `getDashboardMetrics(start, end)` over the selected date range:

| Metric | Meaning |
|--------|---------|
| **Total Income** | Revenue in the range, with a transaction count subtitle |
| **Total Expense** | Expenses in the range |
| **Net Profit** | Income − Expense (colored by positive/negative) |
| **Total VAT** | Tax collected |
| **Discount Given** | Total discounts applied |
| **Customer Credit** | Outstanding debt across all customers |

⚠️ **Note:** "Customer Credit" is a **lifetime, all-customer** debt total — it is **not** filtered by the selected date range.

## Date ranges

Three modes: **This Month**, **This Year**, and **Custom** (start/end date pickers, with the end date extended to the end of that day). Changing the range refetches metrics.

## Expense tracking

An **Add Expense** modal records shop costs:

- **Amount** (in Riel; must be > 0)
- **Category:** Restock 📦, Salary 👷, Rent 🏠, Utilities 💡, Other 📝
- **Date** (defaults to today)
- Optional **note**

Saving records the expense and optimistically updates the expense total. Expenses feed Net Profit.

**Access:** expenses are confidential — only Admin, Manager, and the owner can read or write them (enforced by RLS). Cashiers, waiters, kitchen, and customers have zero visibility.

## Top-selling products

A bar chart (Recharts) of the best sellers in the selected range, with an empty state when there's no data.

## Inventory alert

An orange banner appears when any tracked product is low on stock (`stock < 5`), showing the count — a prompt to restock.

## AI Business Insight

An **Ask AI** button generates a short consultant-style summary and tips from the shop's sales and inventory, in the user's language.

⚠️ **Current behavior:** the insight is generated from **aggregate figures** (revenue, transaction count, low-stock items), not individual sale records. See [ai-features.md](./ai-features.md).
