# Point of Sale (POS)

The POS screen (`pages/POS.tsx`) is the main selling interface. It's a two-pane layout: a searchable, filterable product grid on the left and a cart/checkout panel on the right (a floating bottom bar on mobile).

**Who can use it:** Admin, Manager, Cashier, Waiter. (Kitchen role cannot.)

## Product grid

- Products render as cards showing image (or a placeholder), name, category, and price.
- **Category pills** are derived dynamically from the products, with an "All" default. Uncategorized products fall under "General".
- **Search** matches product **name or barcode** (case-insensitive) and combines with the active category filter.
- **Stock badges:** low-stock (orange) when stock `< 5`, out-of-stock (red) when `≤ 0`. Variant products show a "from" price and a layers indicator.

## Adding items to the cart

- Clicking a product with **no variants** adds it directly; clicking one **with variants** opens a variant selector (each variant shows its options, price, and stock).
- Out-of-stock products/variants are blocked (unless the product has stock tracking turned off).
- Adding the same product+variant again **increments quantity**. The cart's minus button at quantity 1 removes the line.

## Barcode scanning

Two ways to scan:
1. **Camera scanner** overlay — looks up an exact barcode match and adds the product, staying open for continuous scanning (with a 1.5s debounce against duplicate reads).
2. **Search box / hardware wedge** — pressing Enter on an exact barcode match adds it and clears the search.

Misses show a "Product not found" toast.

## Discounts

Per cart line, the app computes the **best applicable discount** from the shop's active discount rules. A rule can be conditioned on:
- Date range, time-of-day (happy hour), and days of the week
- Minimum quantity (bulk)
- Specific products or categories
- Returning-customer (loyalty) — requires a selected customer

Rules are either **percentage** or **fixed amount**; the single best (lowest) price wins. Total savings appear as "You saved" in the cart and checkout.

## Tax / VAT

The POS displays `Tax = subtotal × (taxRate / 100)` using the shop's configured VAT rate, and a running total of subtotal + tax.

## Currency

Each sale stores the shop's `currency` and `exchangeRate`. Prices are formatted as **Cambodian Riel (៛)** with no decimals.

⚠️ **Current behavior:** display formatting is always KHR regardless of the configured currency; the stored exchange rate is retained on the sale record but not applied to on-screen formatting.

## Customers & credit (debt) sales

- A **customer selector** (in both the sidebar and checkout) lets you pick an existing customer or add a new one inline (name + phone). Frequent customers get a VIP badge.
- **Credit ("Pay later") sales require a selected customer.** The sale is tagged with the customer ID and the `credit` payment method, adding to that customer's debt (see [customers.md](./customers.md)).

## Checkout

The checkout modal offers four payment methods:

| Method | Notes |
|--------|-------|
| **Cash** | Standard immediate payment |
| **KHQR** | Scan-to-pay QR |
| **DiTy Card** | Gift / member card |
| **Credit** | Pay later — requires a customer |

On confirm, `checkout(method, customerId?)`:
1. Builds a completed sale with the cart items.
2. **Decrements stock** for each tracked product (variant-aware; product stock becomes the sum of variant stocks).
3. Persists stock changes and the sale to Supabase.
4. Clears the cart and shows a **receipt success screen** (an inline [ReceiptView](./orders-and-receipts.md)) with a "Start new" button.

⚠️ **Current behavior:** the persisted sale records `tax: 0` and a total based on **undiscounted** item prices, so the stored/receipt total can differ from the VAT- and discount-adjusted figures shown during checkout. Treat this as a known gap between the POS display and the saved record.

## Related
- Configure discounts and payment methods in [Settings](./settings.md).
- Review completed sales in [Orders & Receipts](./orders-and-receipts.md).
