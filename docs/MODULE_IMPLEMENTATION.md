# MyWebTalker modular implementation map

## Identity and administrator

- Customer Google sign-in: Firebase Auth. A Firebase CLI login is a separate deployment identity.
- Intended administrator email: moneybasicswithrohit@gmail.com. **Email alone is not an admin credential**; grant a Firebase Auth `admin: true` custom claim only after confirming the UID and ownership through a trusted administrative process. Never hardcode an admin password or use frontend email checks as authorization.
- Backend `ensureCustomer` creates one customer per UID, atomically. Existing frontend currently also has a Firestore-rules-restricted create path. Migrate to callable initialization before closing client create permissions.

## Module contracts

| Module | Current implementation | Required before launch |
| --- | --- | --- |
| Identity | Google sign-in, tenant Firestore rules, callable ensureCustomer | App Check rollout and account lifecycle |
| Appearance | Firestore persistence and live preview | Widget reads only published settings |
| Websites | Pending registrations | HTML challenge generation and SSRF-safe remote verification |
| Knowledge | Requirements documented | DOCX/XLSX/TXT/MD/JSON/FAQ processing; permitted website crawling; self-hosted and managed modes |
| Widget | Preview only | Public embed loader, verified domain enforcement, live chat |
| AI | Not connected | Server-side provider adapter, grounded retrieval, safety limits, cost caps |
| Usage | Entitlement evaluator and tests | Atomic monthly usage reservation and abuse/rate controls |
| Pricing | Server callable plan catalogue and admin update | Frontend plan integration and admin pricing screen |
| Billing | Explicitly disabled checkout and webhook | Provider adapter, verified signature, idempotent event log, refund/cancellation/renewal handlers |
| Branding | Server entitlement field | Verified upgrade billing and widget footer enforcement |
| Analytics | Not connected | Batched minimal retention, leads consent and exports |

## Subscription state machine

1. New account receives an immutable 7-day trial timestamp.
2. Trial access is computed from server time, not a client-side flag.
3. Expired trial blocks billable services; it does not erase customer configuration.
4. A verified payment provider webhook, after signature verification, activates the paid period and plan.
5. At renewal, only a verified paid event extends `periodEnd`.
6. Failed payment sets `past_due`; cancellation prevents future renewal, with any remaining paid period handled by provider policy.
7. Quotas must be reserved atomically before each AI call. The current pure entitlement engine is **not** a quota reservation mechanism.

## Operational steps

```powershell
cd F:\projects\mywebtalker
git pull origin feature/saas-foundation
npm install
npm run build
cd functions
npm install
npm run build
npm test
cd ..
firebase deploy --only firestore:rules --project zero2hello-5034e
# Deploy Functions ONLY after successful builds, security review and billing design validation:
# firebase deploy --only functions --project zero2hello-5034e
```

**Do not deploy the payment webhook expecting it to accept payments**. It intentionally returns 503 until a gateway is configured.

No cloud deployment, end-to-end integration testing, or security penetration testing is claimed by these commits.
