# Statement export filters and related-transactions proposal

## Implemented in this change: export filters

The statement exporter supports four period modes:

1. **Custom date range** — retains the existing export workflow and its current transaction filters.
2. **Calendar month** — exports transactions whose transaction date falls inside the selected calendar month.
3. **Last days / months** — exports a rolling date window ending today (Asia/Kolkata). Day counts include today; month ranges use the same day-of-month where possible and clamp to the final day of shorter months.
4. **Billing cycle and card** — selects a card and a current or historical billing cycle. Transactions are selected by `settlement_date`, not transaction date.

The same exporter is available from the All Transactions page and each card's detail page. The card page locks the card selection to the current card and defaults to the billing cycle currently displayed. Existing Excel, CSV, PDF download, and Print formats remain available. Current method, UPI app, search, and category filters are retained where applicable.

## Proposal only: related-transactions navigation (not implemented)

Add clickable values in Transaction Details for:

- UPI application
- Transaction date
- Settlement date
- Payment method
- Credit card

Each link should navigate to a dedicated Related Transactions page, rather than opening a modal. The page should show a clear heading and the matching transaction list, total amount, count, and normal transaction actions.

### Suggested route and query contract

Use one reusable route such as `/transactions/related/:dimension/:value` or an equivalent typed query-state route. Prefer stable identifiers for entities:

- UPI app: `upi_app_id`
- Credit card: `card_id`
- Payment method: `payment_method`
- Transaction date: date-only `YYYY-MM-DD`
- Settlement date: date-only `YYYY-MM-DD`

The date dimensions must remain distinct: transaction date filters `txn_at`'s calendar date; settlement date filters the date-only `settlement_date` column. Avoid converting date-only values through JavaScript `Date` or UTC timestamps.

The page should preserve the selected dimension in its title and provide a clear way back to Transaction Details. Reuse the existing transaction list row, query/cache strategy, filters, and export workflow. Add API query parameters only if existing filters cannot express the selected dimension; do not overload `from`/`to` because those currently represent transaction dates.

This is a proposal only. No Transaction Details links, related-transactions route, or API changes are included in this implementation.
