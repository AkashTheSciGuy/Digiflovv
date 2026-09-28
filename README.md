# DigiFlovv product website

First development version based on the supplied DigiFlovv Documentation. A responsive, static product website for the automated plant watering system. This version is a private review site, not a launched storefront.

## Run locally

### Open in Visual Studio Code

Open `DigiFlovv.code-workspace` in VS Code. All website source, images, animations, tests, and documentation are included in this project folder.

1. Choose **Terminal > Run Task > DigiFlovv: Start website**.
2. Open **http://127.0.0.1:5500** in your browser. Refresh after editing a file.
3. Optionally select **DigiFlovv: Debug in Edge** in Run and Debug and press F5 after the server starts.
4. Choose **Terminal > Run Task > DigiFlovv: Run tests** to run the test suite.
5. Use **Terminal > Terminate Task** to stop the local server.

Node.js 20 or newer with npm must be installed and available in your terminal. No extra npm dependencies, Python installation, or extensions are required. The VS Code tasks use npm from PATH. Edge debugging requires Microsoft Edge.

### Start from the terminal

Run these commands from the DigiFlovv project folder:

```sh
npm run dev
```

Then open http://127.0.0.1:5500. `npm start` and `npm run start` also start the same local website. `npm run` lists available commands; it does not start a server by itself. Run `npm test` for all tests. Save files and refresh the browser to see changes; automatic live reload is not included.

If port 5500 is occupied, stop the previous server with Ctrl+C or use `npm run dev -- --port 5501`. If PowerShell blocks npm.ps1, use `npm.cmd run dev` without changing the system execution policy. If npm is not recognized, install Node.js with npm and restart VS Code. The original parent workspace also has forwarding npm scripts for convenience.

This server is for local development and binds only to this computer. Production hosting continues to serve the static `dist/` folder.

## Structure

- `dist/index.html`: semantic, server-readable product content, features, benefits, setup, specifications, pricing, FAQs, contact, and legal notices.
- `dist/styles.css`: responsive botanical design, focus visibility, and reduced-motion handling.
- `dist/config.js`: public sales and contact configuration; no secrets belong in this file.
- `dist/app.js`: purchase readiness gate, native accessible dialogs, policy links, and optional email contact.
- `dist/motion.js`: scroll reveals, animation cleanup, and reduced-motion preference handling. Hover, photo, FAQ, dialog, and ripple animations are defined in `dist/styles.css`.
- `dist/assets/plant-room.webp`: optimized lifestyle photography, not a representation of the product hardware.
- `scripts/serve.cjs`: dependency-free local HTTP server with path restrictions and clear startup errors.
- `tests/`: checkout validation and HTTP integration tests.
- `package.json`: npm development, start, and test commands.

Content remains available without JavaScript. Buying and notice dialogs require JavaScript; a no-script notice is included beside the purchase button. Native FAQ disclosures need no JavaScript.

## Purchase integration

The initial architecture supports external hosted checkout, consistent with Option A in the brief. External payment checkout was selected for this release. No order API, payment processing, customer database, login, or message submission endpoint exists in this version.

Configure an approved HTTPS checkout URL, final display price, sales disclosure, and HTTPS links to the three approved policies in `dist/config.js`. Only set `ordersOpen: true` after the launch checklist is satisfied. Missing values or insecure URLs leave ordering closed. The destination service must compute authoritative totals, process payment, collect shipping information, send confirmations, and manage order status. Do not trust display prices or client-side configuration as payment authorization. Keep all secrets in the checkout provider’s secure environment.

The sales note should clearly explain taxes, shipping, delivery availability, and where the final total is shown. A valid `supportEmail` replaces the contact fallback with an email link. The default contact section routes to FAQs and does not pretend to submit messages.

## Security and privacy

There are no runtime packages, third-party scripts, analytics, cookies, browser storage, customer data collection, or card fields in application code. Hosting can still process request logs. Configured content is inserted with `textContent`; URL protocols and embedded credentials are validated. The native dialog handles focus and Escape dismissal. Hosting should enforce HTTPS and security headers. Policy notices are availability notices, not approved legal documents.

Do not store credentials in source, assets, or `config.js`. A static site cannot enforce payment state or verify successful checkout; those responsibilities belong to the payment provider or a future backend. Domain-specific CSP, HSTS, cache headers, and provider integration tests must be verified on the final production host.

## Content and release requirements

See `LAUNCH-CHECKLIST.md`. No product price, device specification, shipping promise, warranty, sensor capability, certification, testimonial, or performance percentage has been invented. Expandability is omitted because the brief describes it as a possible future design rather than a confirmed capability. Setup copy is an overview, not a hardware installation manual.

Private review pages intentionally use `noindex, nofollow` and robots exclusions. Before public launch, approve the content, switch indexing on, regenerate the sitemap with the final domain, and add Product structured data only with verified product and offer details.

## Media attribution

Lifestyle photograph by Kate Darmody: https://unsplash.com/photos/a-living-room-filled-with-lots-of-plants-next-to-a-window-2YmEjjGIUOs. Downloaded as optimized WebP. Unsplash license: https://unsplash.com/license. This image does not depict DigiFlovv hardware. Replace or supplement it with approved product photography before launch.

## Validation status

Automated unit, repeated-input, syntax, HTML structure, local-reference, and HTTP checks are performed for the first version. This is not a penetration-test certification or a browser/device compatibility sign-off. Browser interaction, device, screen-reader, provider sandbox payment, and live-host header checks remain release tasks.

## Purchase review flow

Once checkout configuration is complete, desktop and mobile Buy Now controls open an accessible purchase review dialog. It displays the configured product price, sales disclosures, policy links, and destination hostname. Only selecting Continue to payment navigates to the provider. No customer details or payment information are collected by this step. Closing the dialog leaves the customer on the website.

Run `npm run check:launch` to list missing checkout settings. Exit code 1 means setup is incomplete, not that the website is broken. Exit code 0 verifies configuration presence and URL shape only; it does not certify policy content, payment provider ownership, product availability, or successful payment processing.

Use `dist/config.js` for the approved payment URL, display price, sales note, and policy URLs. Keep `ordersOpen: false` until provider sandbox tests and the launch checklist are complete. Payment completion, shipping collection, authoritative totals, receipts, and refunds belong to the external provider. This site never treats a redirect or URL query as payment confirmation.

Automated checkout tests cover desktop/mobile review controls, destination and price rendering, incomplete configuration, and setup diagnostics. Actual provider sandbox payment and browser/device testing remain pending.
