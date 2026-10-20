# DigiFlovv verification report

Date: October 20, 2026
Project: F:\Projects\Digiflovv
Scope: Local product showcase and enquiries. Payments excluded by the owner.

## Results

- JavaScript syntax, HTML IDs, internal links, local assets and text-encoding checks: passed.
- Unit/integration/security tests: 12 passed, 0 failed. This includes retained dormant checkout utility regressions; checkout is absent from the current UI.
- Browser scenarios: 18 passed across Chromium, Firefox and WebKit.
- Responsive widths: 1440, 768, 390 and 320 pixels; no horizontal overflow in those checks.
- Automated WCAG A/AA accessibility checks on the initial pages: no reported violations after contrast repairs.
- Functional browser checks: mobile menu, form errors and draft preview, invalidation after edits, FAQ, native policy dialog close, use-case selector, manual demo cycle, configured gallery, email draft URL, and no-JavaScript fallback.
- Security checks: private files and path traversal rejected, alternate data streams rejected, unsupported HTTP methods rejected, security headers present, untrusted text rendered as text, no outgoing message or payment during tests.
- Load smoke test: 100 concurrent local stylesheet requests all returned HTTP 200; final run completed in approximately 306 ms. This is a local development smoke test, not an internet production benchmark.
- npm audit: 0 known vulnerabilities in installed dependencies at the time of testing.
- Local static build: passed. Public build correctly refuses to run without an approved production domain.
- Local health endpoint: HTTP 200, mode showcase.
- Corrected desktop/mobile screenshots visually reviewed; encoding defect and demo contrast issues repaired.

## Limits and remaining content

Browser engines were tested on Windows using emulated viewport sizes, not physical iPhones/Android devices or every screen reader. Video playback with real product footage remains untested because no footage was supplied. No payment tests apply to the revised scope. No penetration-test certification or public-host validation is claimed.

Approved product photos/specifications, support email, public domain and approved privacy/website policies remain owner-supplied content. Product gallery stays hidden until configured. Enquiries prepare local drafts; no submission backend or automatic email delivery is implied. The support email action appears only when a valid address is supplied.

Run npm run check, npm test, npm run test:browser and npm run check:launch to reproduce checks. See README.md for browser installation and build instructions. Nothing was publicly deployed.

## Account page update — October 20, 2026

- All-page static checks and local build: passed.
- Unit/integration suite: 16 passed, 0 failed.
- Account browser suite: 15 scenarios passed across Chromium, Firefox and WebKit, including four viewport widths, automated accessibility, signup/login validation, empty dashboard, reload/logout, expiry, corrupt/blocked storage, fixed redirects and disabled JavaScript.
- Existing storefront browser suite: all 18 scenarios passed again after navigation changes.
- Desktop and mobile signup screenshots visually reviewed.
- Accounts remain a clearly labelled preview. No credential verification, account persistence, Supabase integration or dashboard features are claimed. Passwords are not stored or sent.

Reproduce account checks with `npm run test:auth`. See AUTH-PREVIEW.md for the next integration phase.

## Supabase integration update — October 20, 2026

This update supersedes the account-preview results above.

- Official Supabase client bundled locally; signup, confirmation callback, password login, verified-user dashboard guard and local logout implemented.
- Live public settings endpoint accepted the supplied key: signup enabled, email provider enabled, email confirmation required.
- All-page static checks and release build passed.
- Unit/integration tests: 14 passed, 0 failed (two obsolete preview-marker tests removed).
- Authentication browser tests: 9 scenarios passed across Chromium, Firefox and WebKit at 1440, 390 and 320 pixels. Supabase API responses are mocked; tests include confirmation pending, PKCE code exchange, invalid password, login, blank dashboard, reload, logout, responsive layout and signup accessibility.
- Dependency audit: zero reported vulnerabilities.
- Local server restarted and its Supabase connection policy verified.
- No real user was created, no confirmation email was sent by tests, and no Netlify deployment was performed. Real inbox delivery and live-account acceptance remain pending. Production redirect and custom SMTP settings require dashboard confirmation.
- Storefront regression after Supabase integration: all 18 browser scenarios passed.
