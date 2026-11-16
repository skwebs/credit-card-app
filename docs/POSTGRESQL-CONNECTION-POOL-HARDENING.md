# PostgreSQL connection-pool hardening

## Changes

- Reuses one small `pg.Pool` per warm API instance; Neon pooled `DATABASE_URL` remains the cross-instance pooling layer.
- Caps each function-instance pool at three connections and configures idle timeout, connection timeout, TCP keep-alive, and connection lifetime rotation.
- Enables certificate verification for non-local database connections.
- Logs idle pool socket errors with safe diagnostic fields.
- Retries transient connection failures once for plain `SELECT` statements only.
- Never automatically retries INSERT, UPDATE, DELETE, or transaction operations, because a lost response can occur after a write commits.
- Returns HTTP 503 with `Retry-After: 3` for recognized database connectivity failures instead of misreporting them as authentication failures or generic server errors.

## Deployment requirements

1. Keep `DATABASE_URL` set to the Neon pooled connection string in local server environment and Vercel project environment variables.
2. Keep the direct Neon connection string for migration/admin tasks only, if required.
3. Do not expose either connection string in frontend variables or commit it to Git.
4. Redeploy the API after changing server-side environment variables.

## Configuration rationale

| Setting | Value | Reason |
|---|---:|---|
| `max` | 3 | Small per-instance pool; Neon pooler handles aggregate client fan-out |
| `min` | 0 | Avoid idle warm connections that are not needed |
| `idleTimeoutMillis` | 30,000 | Avoid rapid reconnect churn |
| `connectionTimeoutMillis` | 10,000 | Bound connection acquisition wait |
| `keepAlive` | true | Enable TCP keep-alive |
| `keepAliveInitialDelayMillis` | 10,000 | Start keep-alive probes after initial idle period |
| `maxLifetimeSeconds` | 300 | Rotate long-lived client connections periodically |

These are conservative starting values. Review Neon connection metrics and Vercel concurrency before increasing pool size.

## Verification

Run:

```sh
npm ci
npm run typecheck
npm run build
npm run lint
```

Then verify login/session refresh, dashboard, transactions, statement reads, payments, and receipt operations under normal connectivity. Simulate a temporary database outage and confirm the API returns `503 DATABASE_UNAVAILABLE`; confirm write endpoints are not automatically replayed.
