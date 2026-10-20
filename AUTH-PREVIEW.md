# Sign-up and login frontend

## Current scope

The account pages are a frontend preview. They validate sample input and open an empty dashboard. They do not authenticate credentials, create users, send email, reset passwords, or connect to Supabase. Every account form explicitly explains this.

- `signup.html`: name, email, password, confirmation, validation and password visibility controls.
- `login.html`: email, password, validation and password visibility control.
- `dashboard.html`: blank main area with only the site header and logout control.

The website header links to sign up and login. Both account forms link to each other and the main website.

## Try it

Start with `npm run dev`, then open:

- http://127.0.0.1:5500/signup.html
- http://127.0.0.1:5500/login.html

Use sample details. Sign-up passwords must contain 8–128 characters and match the confirmation. Login requires a nonempty password; credentials are not checked against any user record in this preview.

After successful form validation, the browser stores only a marker with mode, version and expiry in sessionStorage. It expires after 30 minutes. It contains no password, email, name, token or user identifier. No password is saved or sent. Logout removes the marker; reload preserves it until expiry within that browser tab.

The dashboard redirects to login when the preview marker is absent, corrupt, blocked or expired. This is a convenience for demonstrating navigation, **not a security boundary**. It must never protect private data. The dashboard intentionally contains no features or user data.

With JavaScript disabled, account form controls stay disabled and the blank dashboard stays hidden. Storage errors are shown on the form without pretending login succeeded. Query-string redirects are not accepted.

## Files and testing

- `dist/auth-preview.js`: validation helpers and demo marker lifecycle; receives no passwords or user profile data.
- `dist/auth.js`: form interaction, show/hide password, navigation, preview guard and logout.
- `dist/auth.css`: responsive account-page styling.
- `tests/auth.test.cjs`: validation and marker boundary tests; included by `npm test`.
- `tests/auth-browser.cjs`: browser flow and accessibility tests; run with `npm run test:auth`.

Run `npm run check`, `npm test`, `npm run test:auth`, and `npm run test:browser` before changing the integration. `npm run build` includes all account pages while retaining their noindex metadata.

## Supabase next

Replace the preview marker with Supabase Auth when the project is configured. Keep form validation as a usability aid; Supabase must enforce actual account and session rules.

The integration needs sign-up/sign-in handling, email verification state, real errors for invalid credentials, session renewal and sign-out. Email confirmation and password recovery need approved redirect URLs and configured mail delivery. A client-side page guard alone is never authorization: protect future dashboard data with authenticated server checks and database row-level security.

Do not place a service-role key in browser code. No Supabase keys or live auth configuration have been added in this step. No dashboard features should be introduced until the user requests them.
