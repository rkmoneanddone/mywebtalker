# MyWebTalker

Universal plug-and-play AI chatbot SaaS. **Current state: landing page and appearance preview foundation only.** No live payment, trial enrollment, chatbot AI or website ingestion is claimed.

## Start locally

```bash
npm install
cp .env.example .env
npm run dev
npm run build
npm test
```

Add Firebase web app credentials to `.env` to enable actual Google sign-in. Authentication is never simulated.

## Approved product rules

- Seven-day free trial, created and enforced **server-side**, once per eligible customer/account. Do not reset on logout, new bot creation or browser changes.
- India prices (proposed): Self-hosted ₹299/month, Managed ₹699/month, Managed Pro ₹1499/month. International USD reference values currently illustrative ($5/$11/$22), **must move to a database-controlled price book before taking money**.
- Branding removal/replacement: ₹499 / $7. Billing recurrence not decided; do not charge until configured.
- Source documents are processed and deleted; persist only cleaned structured knowledge and indexes. Supported sources: website, DOCX, XLSX, TXT, MD, JSON. No PDF, CSV, OCR or images.
- Domain verification only by HTTPS-hosted HTML file. Domain verification is not authorization to circumvent robots policies.
- Website widget placement: top-right, bottom-right or bottom-center. Custom icon, colours, business name and chatbot name.
- Firebase Auth + Firestore, minimal reads/writes, content-hash updates, bounded AI spend and server-authenticated payment webhooks.
- AI model/provider and payment processor selected by server-side configuration; never send provider secrets to the browser.
- All paid entitlements, plan prices, usage quotas and trial periods are validated on the backend.
- Code functions must have descriptive comments explaining purpose and security-sensitive behavior.

## Implementation status

- [x] Responsive landing page
- [x] INR/USD visual pricing toggle
- [x] Seven-day trial messaging
- [x] Google sign-in integration scaffold
- [x] Interactive theme/name/placement preview
- [ ] Deploy Firebase Auth and secure API
- [ ] Database-backed localized price book
- [ ] Server-authoritative seven-day trial and plan entitlement engine
- [ ] Payment provider adapter, checkout, webhook validation, refunds
- [ ] Domain ownership HTML-file challenge generation and validation
- [ ] Website crawling respecting access restrictions, SSRF protection
- [ ] DOCX/XLSX/TXT/MD/JSON extraction and source-file deletion
- [ ] Cached/semantic knowledge retrieval
- [ ] Actual embeddable widget and chat API
- [ ] Lead capture, usage monitoring and quotas
- [ ] Domain restrictions, abuse prevention, multitenant security tests
- [ ] End-to-end tests, staging deployment and production verification

Do not take real payments or publish this as production-ready until those items are complete.
