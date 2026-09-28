# DigiFlovv launch checklist

## Delivered in the first version

- Product landing page and responsive layout.
- Product introduction, features, benefits, setup overview, and specifications.
- Pricing section and purchase controls with a closed-order state.
- Native FAQs, company introduction, contact fallback, and policy availability notices.
- Central public configuration for external checkout, price, contact, and policy URLs.
- Local optimized lifestyle image with attribution.
- Page metadata, private-review indexing controls, sitemap, and regression checks.

## Information needed from DigiFlovv

- Final product name/model, logo, brand approval, and company background.
- Product photographs, package contents, and installation documentation.
- Dimensions, weight, materials, power supply, connectivity, app compatibility, watering capacity, and warranty.
- Price/currency, taxes, delivery areas, shipping cost, and delivery timelines.
- Approved external payment checkout destination (external checkout has been selected).
- Support email/phone and approved social accounts.
- Approved privacy, sales, refund, cancellation, and warranty terms.
- Production domain, hosting account, and analytics decision.

## Before enabling purchases

1. Replace pending product details and review every marketing claim.
2. Add real hardware imagery and confirm its usage rights.
3. Publish approved policies and configure their URLs.
4. Set final price, sales disclosures, checkout URL, and support email.
5. Test the payment provider sandbox: success, failure, cancellation, duplicate attempts, correct taxes/shipping, and confirmation delivery.
6. Verify actual keyboard and screen-reader interactions, mobile layouts, supported browsers, and performance on mobile networks.
7. Verify HTTPS, response security headers, checkout ownership, and production data handling.
8. Set `ordersOpen` to true only after all launch prerequisites pass.
9. Publish on the approved domain; update sitemap, canonical URL, search indexing, and verified product structured data.

## Later work

Add order management, contact submissions, analytics, customer accounts, or additional products only after those requirements and data-handling responsibilities are agreed. The current code intentionally does not introduce those systems.

## Second development step

Implemented purchase review dialog, persistent mobile Buy Now control, and `npm run check:launch` configuration diagnostics. Automated tests cover both purchase controls, correct payment destination, and closed-order behavior. Live integration awaits the approved payment link, price, disclosures, and policies.
