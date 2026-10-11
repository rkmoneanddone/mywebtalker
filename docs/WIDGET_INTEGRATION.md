# Embeddable widget — integration preview

The initial `public/widget.js` is a safe, non-interactive chat shell. It does **not** yet send AI requests.

After the frontend is hosted at `https://YOUR-WIDGET-HOST`, a website owner may add:

```html
<script async src="https://YOUR-WIDGET-HOST/widget.js" data-site-id="YOUR_VERIFIED_WEBSITE_ID"></script>
```

The script creates one fixed-position launcher and a Shadow DOM chat panel. The current version intentionally displays a setup message.

## Requirements before enabling visitor AI

- Authenticate widget installation using a server-issued public installation identifier, not a user-controlled Firestore path.
- Validate the registered verified domain server-side. Origin/Referer checks alone are not authentication and can be forged by non-browser clients.
- Enforce per-site and per-IP abuse controls, quotas, input limits and billing checks before model calls.
- Bind every retrieval query to the verified tenant; never accept arbitrary customer IDs from the public endpoint.
- Protect the crawler from SSRF, redirects to private addresses, DNS rebinding, oversized responses and unbounded page counts.
- Add emulator tests for tenant isolation and rate limiting; do not activate public AI before these pass.

No payment provider or paid AI request is required to test the shell.
