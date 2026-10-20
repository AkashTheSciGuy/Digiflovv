# DigiFlovv Supabase authentication

The login and signup pages now use the official Supabase JavaScript client.
The old preview marker cannot open the dashboard. The dashboard remains empty.

## Configuration

Public project URL and publishable key are in `dist/auth-config.js`. These are intentionally browser-visible. Never put a secret key, service_role key, database password or SMTP password in website code.

Project: `https://xqfgikcepbgcppfudpcm.supabase.co`

In Supabase Authentication → URL Configuration:

- Local Site URL: `http://127.0.0.1:5500`
- Allowed local redirect: `http://127.0.0.1:5500/login.html`
- Allowed production redirect: `https://digiflovv.netlify.app/login.html`
- When publishing production, use `https://digiflovv.netlify.app` as Site URL; retain both explicit redirects.

The owner confirmed saving the local settings. Production redirect and SMTP configuration must be checked in the Supabase dashboard; the public key cannot inspect or modify administrative settings.

Email/password signups are enabled and confirmation is required, verified through the live public settings endpoint on October 20, 2026.

## Email delivery

Keep email confirmation enabled. Supabase's default email service only sends to project team addresses and has strict limits. Configure custom SMTP in Supabase for general customer signups. Keep SMTP credentials in Supabase, not this repository.

Use the default confirmation email link (`{{ .ConfirmationURL }}`) unless you deliberately implement a different template. Open confirmation in the same browser/device where signup started because this implementation uses PKCE. If a different device confirms the address, return to the original site and log in with the password.

## Behavior and security

- Signup sends email, password and name metadata directly over HTTPS to this Supabase project.
- A signup awaiting email confirmation stays on the form and tells the user to check their inbox.
- Password login verifies credentials with Supabase.
- Supabase manages persistent access/refresh tokens and refreshes sessions. Password fields are cleared after submissions; application code does not persist or log passwords.
- The dashboard asks Supabase for the current user before displaying its empty shell.
- Logout ends this browser's session; other devices are unaffected.
- Errors use safe messages, duplicate submissions are blocked, and controls remain disabled when JavaScript is unavailable.
- The static dashboard guard is not database authorization. Before adding any customer data, create appropriate Supabase RLS policies and test isolation between users. No customer tables or dashboard content were added.
- Local and Netlify security headers allow API connections to the configured project only. If changing projects, update `scripts/serve.cjs` and `dist/_headers` too.

## Development and delivery

`npm ci`, then `npm run dev`; open `http://127.0.0.1:5500/signup.html`.

`npm run build` bundles the pinned SDK locally and creates `release/`. Netlify can use build command `npm run build` and publish directory `release`. No deployment is performed by these commands. The default build retains noindex pending content approval.

## Verification

Run `npm run check`, `npm test`, `npm run test:auth`, `npm run test:browser`, and `npm audit`.

Authentication browser tests intercept Supabase requests with deterministic responses. They cover confirmation pending, confirmation code exchange, invalid credentials, login, dashboard guard, reload and logout across Chromium, Firefox and WebKit at desktop/mobile widths. They do not send emails or create real users.

To complete live acceptance, sign up with an inbox you control, open the confirmation link, log out, then log in again. Confirm the user appears in Supabase Authentication → Users. Actual inbox delivery and successful real-account login are pending this step.

References:
- https://supabase.com/docs/reference/javascript/auth-signup
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/auth/auth-smtp
