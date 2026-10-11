# MyWebTalker widget installation

1. Sign in, register your HTTPS website and complete DNS TXT ownership verification.
2. Generate an installation ID in the dashboard.
3. Deploy the Firebase Function `publicWidgetChat` and configure the `OPENAI_API_KEY` secret.
4. Publish the installation only after verifying the production endpoint and quotas.
5. Add the following script to the verified website:

```html
<script async src="https://YOUR-WIDGET-HOST/widget.js"
  data-installation-id="w_YOUR_SERVER_ISSUED_40_HEX_CHARACTERS"
  data-api-url="https://YOUR_DEPLOYED_PUBLIC_WIDGET_CHAT_FUNCTION_URL"></script>
```

The installation ID is public and is not an authentication credential. Server-side domain verification, billing checks, per-IP and per-installation throttling, and tenant isolation remain mandatory.

## Production verification

- Build frontend and backend and run backend tests.
- Verify preflight OPTIONS and POST from the registered origin; reject unrelated origins.
- Verify unpublished/revoked installations cannot chat.
- Verify one customer's documents cannot be retrieved by another customer's installation.
- Verify trial expiry, monthly quotas and high concurrency before accepting paying users.
- Confirm OpenAI usage/cost budgets and provider failure handling.
- Load test on a staging project; a successful build does not prove thousand-user concurrency.
- Configure payment provider and verify signed webhooks before enabling checkout.

## Operational caveats

The current retrieval reads up to 30 documents and 100 chunks per document per request. This is bounded, but costly at scale. Production optimization should use a precomputed or indexed retrieval layer. Quota units are reserved before provider calls and are not refunded after provider failure, to prevent unmetered retry loops. Rate limits use Firestore transactional counters; highly concurrent requests may contend. No paid AI requests are made merely by deploying the widget; requests incur charges when visitors ask questions.
