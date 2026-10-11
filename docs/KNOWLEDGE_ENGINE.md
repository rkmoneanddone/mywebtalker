# Knowledge Engine — deployment checkpoint

This branch contains **new, unverified** modules. Do not describe them as production-ready until the build, tests, security checks and end-to-end flows succeed.

## Implemented in code

- TXT, MD and JSON extraction, with JSON syntax validation.
- DOCX text extraction via Mammoth.
- XLSX extraction via ExcelJS, preserving worksheet and populated row context.
- Bounded overlapping chunk generation and lexical retrieval.
- Private authenticated upload/list/delete/search Cloud Functions.
- Dashboard upload, knowledge list, delete, source search and private AI preview.
- Server-side AI API key via Firebase Secret Manager; quota reservation in Firestore transaction.
- Tests for 125-record TXT/JSON and 125-row multi-worksheet XLSX.

## Local verification

```powershell
cd F:\projects\mywebtalker
git pull origin feature/saas-foundation
npm install
npm run build
cd functions
npm install
npm run build
npm test
npm audit
```

Review all output before deploying. Backend packages include new third-party parsers; do not blindly run npm audit fix --force.

## AI configuration (only after testing and authorizing API spending)

```powershell
firebase functions:secrets:set OPENAI_API_KEY --project zero2hello-5034e
```

Do not paste API keys in chat or commit them to source. The AI endpoint makes billable requests when deployed and invoked.

## Outstanding before customer launch

1. HTML challenge creation and trusted verification of website ownership.
2. SSRF-safe website crawler with redirects, DNS and robots-policy validation.
3. Public widget SDK and strictly verified-domain, rate-limited visitor chat.
4. Managed vs self-hosted knowledge source adapters.
5. Durable per-site quotas, file-count quotas, document upload concurrency handling, and usage reconciliation/refunds after provider errors.
6. Admin screens, claim provisioning, dynamic frontend plan pricing and customer subscription screens.
7. Payment provider webhook signature verification, idempotency and billing lifecycle.
8. Security testing, observability, deletion/export/privacy workflows, and deployment smoke tests.
9. Performance optimization for large document sets: lexical retrieval currently scans up to 30 documents × 450 chunks and is not suitable for production scale.
10. Dependency audit remediation and review of supported Node runtime versions.

**Important:** The existing Firestore rule permits customer creation in the browser. The callable ensureCustomer also exists, but the client has not yet migrated to it. Rules enforce trial timestamps on browser-created records; do not relax them.

The current 5 MB upload and 450-chunk limit are deliberate guardrails. XLS (legacy binary Excel) is not supported. No claim is made that every possible Word/Excel feature is preserved.
