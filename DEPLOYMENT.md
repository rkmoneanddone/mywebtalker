# MyWebTalker Firebase launch (payments disabled)

Firebase project: `zero2hello-5034e`. Functions region: `asia-south1`.

## Deploy

Run in PowerShell from the repository root after confirming the Firebase CLI is logged into the correct Google account:

```powershell
cd F:\projects\mywebtalker
git pull origin feature/saas-foundation
npm ci
npm run build
cd functions
npm ci
npm run build
npm test
cd ..
firebase use zero2hello-5034e
firebase deploy --project zero2hello-5034e --only firestore:rules,functions,hosting
```

If `firebase` is not installed: `npm install -g firebase-tools`, then `firebase login`. Firebase Hosting deploys the Vite `dist` folder and `/widget.js`. Set required `VITE_*` Firebase environment variables before the frontend build; never expose provider secrets through Vite variables.

## Payments

Checkout is **intentionally disabled**. Do not enable live payments by editing Firestore alone: the Razorpay and Dodo provider-specific checkout and signed-webhook adapters are not yet implemented or tested. The existing `privateConfig/payments` record supports `provider: "razorpay" | "dodo"`, `mode: "test" | "live"`, and `enabled: boolean`. Keep `enabled: false` until signed event verification, idempotent fulfilment, and refund/renewal handling are implemented.

The `publicConfig/branding` document controls the advertised one-time INR branding price; a purchase must never be granted by a browser write. The widget hides its footer only when the server-side billing record has `brandingEnabled: true` **and** an active, unexpired subscription. Otherwise it displays Powered by MyWebTalker.

## Verification

After deploying, check the hosted dashboard, Google sign-in, website verification, widget installation, lead form, chat replies, expiry, rate limits and knowledge uploads. In the browser network panel verify that `captureVisitorLead`, `publicWidgetChat`, and `publicWidgetConfig` return expected responses from the verified website origin. Do not consider production ready until live end-to-end tests pass.
