# Architecture and security contract

## Components

- **Web dashboard:** React/Vite, Firebase Google Auth.
- **API:** TypeScript Cloud Run or Firebase Functions; signed-in customer admin routes, separate public visitor routes.
- **Operational data:** Firestore stores organizations, bots, allowed_domains, paid_entitlements, trials, plans, usage counters, verification challenges, aggregated analytics.
- **Managed knowledge:** normalized chunks + embeddings / index only. Uploaded originals reside in isolated temporary storage and must be deleted in a `finally` block and by lifecycle expiry backup. Never expose originals as public URLs.
- **Self hosted:** derived knowledge hosted by customer, with short-lived verified cache. Never persist their permanent knowledge in our managed dataset.
- **Widget:** async JavaScript script that injects a sandboxed iframe. Avoid direct document script injection and namespace conflicts.
- **AI:** model/provider adapter with cost ceilings, context limits, retrieval citations, prompt-injection controls and fallback behavior.
- **Payments:** modular provider adapters, signed webhook verification, idempotency and server-confirmed entitlements.

## Core collections

`platform/config` holds providers (non-secret identifiers), plans and localized INR/USD price book with effective dates.
`organizations/{orgId}` stores members and current subscription, immutable trial eligibility and server timestamps.
`bots/{botId}` stores owner, verified domain, public widget config, knowledge version, quotas.
`domainChallenges/{id}` stores salted hash of verification token, expiry, status, verified-at.
`usage/{period_orgId}` stores bounded counters, aggregation checkpoints and version.
`billingEvents/{provider_event_id}` stores idempotency state and reconciliation.

## Security requirements

1. **Never trust clients** for price, currency, trial, domain, subscription or AI quota.
2. **All tenant resource queries** use server-side organization membership and scoped resource IDs. Firestore rules deny browser reads to secrets, usage and billing.
3. **Verify domain** using an unpredictable HTML file challenge served over HTTPS and checked server-side; validate redirects and reject private, loopback, link-local and cloud metadata addresses.
4. **Robots rules:** Respect crawling restrictions and offer customer-provided exports if scanning is disallowed.
5. **File processing:** Enforce file extension and MIME, parsers with size, rows and execution-time limits, virus scanning where suitable. Preserve all allowed rows/worksheets within clear product limits and visibly report ingestion truncation/errors.
6. **Knowledge security:** segregate tenants at query/index/cache layers; treat extracted website and docs content as untrusted data, not system instructions.
7. **Abuse/financial controls:** per-visitor rate limits, per-bot quotas, token metering and monthly budget caps, atomic reservations or transactions to prevent concurrent overruns.
8. **Trial:** server-generated seven-day duration, account-level eligibility, never inferred from client clock. Have explicit post-expiry read-only/upgrade behavior.
9. **Payments:** accept provider-verified webhooks, not payment redirect success screens, as proof of purchase. Review refunds/chargebacks and downgrades.
10. **Logs:** redact PII and auth tokens; secrets live in secrets manager, not Firestore web config, public JS or Git.
11. **Performance:** cache public config and knowledge by version, aggregate analytics in batches, avoid persisting full conversations by default.
12. **Code quality:** descriptive comment above each nontrivial function, lint, typecheck, unit/integration/E2E suites. Deploy only after passing checks.

## Provisional pricing

`self` INR 299 / USD 5, `managed` INR 699 / USD 11, `pro` INR 1499 / USD 22. Branding INR 499 / USD 7. USD subscription amounts and branding billing period await business approval. This provisional frontend price table is **not** a billing source of truth.
