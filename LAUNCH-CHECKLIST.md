# DigiFlovv showcase completion and publication checklist

## Current agreed scope

Local product showcase and enquiries. The owner explicitly excluded payments on October 20, 2026. Checkout, payment verification, orders, customer databases, refunds and payment notifications are therefore outside this release. The database/payment phases in the documents are conditional on handling sales directly.

Account pages now use Supabase authentication. Verify production redirect URLs, custom SMTP and real inbox signup/login before public account launch. The dashboard remains empty. See SUPABASE-SETUP.md.

## Implemented

- Product sections, responsive layout, mobile navigation and enquiries.
- Preserved interactive simulation and use-case selector; visible simulation disclaimer.
- Correct next scheduled day calculation and reduced-motion behavior.
- Configurable approved photo gallery, image captions and optional video.
- Configurable product name and specification values.
- Enquiry validation, local draft preview/copy, and optional email-app handoff.
- No-JavaScript safety for personal information.
- Policy notices and configurable links.
- Consistent npm/VS Code startup and backend compatibility entry point.
- Metadata, favicon, local static build, optional public canonical/sitemap and structured product data.
- Automated syntax, unit, HTTP, security, concurrency, browser and accessibility tests.

## Content that only DigiFlovv can supply

- Approved product photographs and optional captioned demonstration video.
- Final model, dimensions, weight, power, connectivity, app compatibility, capacity, package contents and warranty.
- Final company/background copy and approved logo if the text wordmark is insufficient.
- Support email and optional approved business/social contact information.
- Approved privacy and applicable website terms.
- Approved production domain, if a public release is later requested.

These values remain pending. The site does not invent them. The gallery remains hidden without photos; enquiry drafts can be copied but cannot open a support email without an address.

## Before public publication

1. Complete the content above and update FAQ answers.
2. Run `npm run check:launch` and review all warnings.
3. Run `npm run check`, `npm test`, `npm run test:browser`, `npm run test:auth` and `npm audit`.
4. Manually review the final content, videos/captions, keyboard flow and real target devices.
5. Obtain owner acceptance of product claims and policies.
6. Configure `siteUrl`, then run `npm run build -- --public`.
7. Deploy only when explicitly requested; configure HTTPS, caching, logs and backups on the selected host.

No publication, outgoing message, payment or external database operation is performed by this development work.
