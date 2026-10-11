# Firebase workspace deployment

Project: zero2hello-5034e
Branch: feature/saas-foundation

## Local steps

1. Pull the branch and run `npm install`.
2. Run `npm run build` and `npm audit`; address any failures before launch.
3. Authenticate the Firebase CLI: `firebase login`.
4. Deploy **only** Firestore rules: `firebase deploy --only firestore:rules --project zero2hello-5034e`.
5. Start Vite with `npm run dev` and test Google sign-in.
6. Save appearance, refresh and confirm values persist.
7. Register a public HTTPS website and confirm its status stays `pending`.
8. Check in the Firebase console that `customers/{uid}` has a server timestamp and only that user's documents are readable.

## Security and scope

- A customer document is created once per UID with a server timestamp; its creation time cannot be changed by the browser.
- The seven-day window is enforced by Firestore rules for **new website registrations**. This is not yet complete billing or AI-entitlement enforcement.
- Only the customer can read their account and website registrations. Clients cannot mark websites verified.
- Website verification must be implemented with a trusted backend fetching a unique HTML challenge; no verification is performed yet.
- Website registration currently has a client-side maximum of five; this is **not** a security-enforced server quota. Do not treat it as one.
- Domain normalization in the browser is convenience validation, not a safe crawler policy. A future crawler must validate DNS and redirects against SSRF.
- Pricing is still provisional frontend configuration; payment checkout, public widget SDK, AI answering, backend quotas, and database-driven pricing are not implemented.
- Do not enable broad Firestore read/write rules to work around permission errors.
- Do not commit local audit reports or build artifacts.
