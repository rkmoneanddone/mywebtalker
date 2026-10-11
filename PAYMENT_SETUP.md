# MyWebTalker payment setup (sandbox first)
Both gateways must start disabled. Never put API secrets or webhook signing secrets in Firestore or Vite variables.

## Firebase configuration
Document `privateConfig/payments`:
```json
{
  "gateways": {
    "razorpay": {
      "enabled": false,
      "mode": "test",
      "keyId": "",
      "products": {
        "INR": {"self": "", "managed": "", "pro": ""},
        "USD": {"self": "", "managed": "", "pro": ""}
      }
    },
    "dodo": {
      "enabled": false,
      "mode": "test",
      "products": {
        "INR": {"self": "", "managed": "", "pro": ""},
        "USD": {"self": "", "managed": "", "pro": ""}
      }
    }
  }
}
```
Product IDs must be recurring monthly subscription plans/products configured with the provider, matching the price/currency configured in `publicConfig/plans/entries/{id}`. Razorpay subscriptions may not support the selected USD settlement mode; do not enable a currency without verifying account capabilities.

## Secrets
```powershell
firebase functions:secrets:set RAZORPAY_KEY_SECRET --project zero2hello-5034e
firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET --project zero2hello-5034e
firebase functions:secrets:set DODO_API_KEY --project zero2hello-5034e
firebase functions:secrets:set DODO_WEBHOOK_SECRET --project zero2hello-5034e
```
Use the provider dashboard to configure webhooks pointing to:
- Razorpay: `https://paymentwebhook-ze67ls2zgq-el.a.run.app?provider=razorpay`
- Dodo: `https://paymentwebhook-ze67ls2zgq-el.a.run.app?provider=dodo`

Webhook endpoints must be configured with the corresponding signing secrets and appropriate subscription lifecycle events.

## Safety gates
- Zero enabled gateways: checkout unavailable.
- Both enabled: configuration error, no checkout.
- Exactly one enabled: its checkout adapter is selected.
- All payment prices must be validated against actual gateway product configuration. Editing Firebase prices alone does **not** change provider billing plans.
- Test signed webhooks, duplicate delivery, delayed renewal, cancelled subscription, failed payment, refund, currency and plan mismatch, and branding purchase separately before accepting live transactions.
- Branding purchase checkout is not yet implemented. Do not enable production checkout until it is.
