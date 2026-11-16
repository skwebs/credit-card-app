# TanStack Query integration

TanStack Query is introduced as the server-state cache for the Card Ledger API.

## Query client policy

- `staleTime`: 30 seconds by default.
- `gcTime`: 10 minutes.
- Window-focus and reconnect refetching are disabled. Returning to the app must not automatically trigger a full bootstrap request.
- Automatic mount refetching is disabled while cached data is fresh.
- Queries retry once; mutations do not retry automatically.

## Query keys

- `['session', 'status']`: authenticated session status.
- `['ledger', 'bootstrap']`: cards, bounded transaction list, dashboard, payments, statements and settings.
- `['ledger', 'transactions', 'cycle', cardId, startDate, endDate]`: full transaction list for a card billing cycle.

## Refresh and mutation rules

- Startup reads the existing IndexedDB bootstrap snapshot first, then fetches session status and bootstrap through the QueryClient.
- Bootstrap requests are deduplicated and cached for 30 seconds.
- Successful writes invalidate the `['ledger']` query namespace before the authoritative bootstrap refresh. This also invalidates cached billing-cycle transaction queries.
- The header Sync action explicitly invalidates the ledger namespace before refreshing.
- Logout clears the QueryClient cache to prevent one account's server data being reused by another session.
- The existing IndexedDB cache and transaction outbox remain authoritative for offline-first behavior. Visibility changes continue to deliver pending outbox operations only; they do not trigger a full bootstrap refresh.

## Dependency installation

Run `npm install` once after extracting this change so npm can update the lockfile with `@tanstack/react-query`. Then use `npm ci` for subsequent reproducible installs.

## Query key ownership and offline outbox integration

All query keys are defined in `src/query-keys.ts`. Use these exported keys for reads, invalidation and cache operations; avoid inline key arrays in feature code.

When one or more queued transaction operations are delivered successfully, the ledger query namespace is marked stale without immediately refetching. This keeps visibility-triggered outbox delivery from causing a surprise full bootstrap request. The next explicit load or manual Sync fetches authoritative server state. Logout clears the entire QueryClient cache before the unauthenticated state is rendered.
