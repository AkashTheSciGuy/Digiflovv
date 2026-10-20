# DigiFlovv local product showcase

This release is a responsive product showcase and enquiry website. Payments, checkout and order creation are excluded. Sign-up and login use Supabase email/password authentication, with email confirmation and an example-device dashboard. Nothing is deployed by starting, building, or testing this project.

## Start in VS Code

Open `DigiFlovv.code-workspace`, then run:

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5500. `npm start` is equivalent. Save changes and refresh the browser. Stop with Ctrl+C. If that port is occupied, use `npm run dev -- --port 5501`. In PowerShell, use `npm.cmd` if the execution policy blocks `npm.ps1`.

Node.js 20 or newer is required. Python, database credentials, and payment credentials are not required. Runtime code uses Node built-ins; installed packages are development/testing tools.

VS Code's **Terminal > Run Task > DigiFlovv: Start website** runs the same command. Start the server before selecting the Edge debug configuration.

## Included features

- Product introduction, features, benefits, setup, specifications, FAQs and company introduction.
- Responsive navigation with a keyboard-operable mobile menu.
- Existing watering demo and use-case selector, explicitly labelled as simulations.
- Calendar-based next watering calculation, manual demo cycle, adjustable duration and weekday selection.
- Product photo gallery with image selection and optional demonstration video.
- Enquiry draft form with accessible validation and a copy option.
- Optional email-app handoff when a valid support address is configured.
- Reduced-motion support, accessible dialogs, and site-specific favicon.
- Static build with page metadata, Product structured data, optional canonical URL and sitemap.
- Local server with security headers, private-path protection and `/api/health`.

## Account pages

Open `/signup.html` to create an account and confirm your email, then `/login.html` to sign in. Supabase manages sessions; the dashboard shows example-device navigation. See [SUPABASE-SETUP.md](SUPABASE-SETUP.md) for redirects, email delivery, security boundaries and live acceptance steps.

## Update content

`dist/config.js` contains public configuration. Never put secrets in it.

- `supportEmail`: real support address; enables the email-app action.
- `product.name`: final product name.
- `product.specifications`: `dimensions`, `power`, `compatibility`, and `contents`.
- `product.images`: approved photos, for example:

```js
images: [
  {
    src: "assets/product-front.webp",
    alt: "DigiFlovv watering controller viewed from the front",
    label: "Front",
    caption: "DigiFlovv controller"
  }
]
```

Put image files inside `dist/assets/`. An empty image array hides the gallery; the existing houseplant photograph is lifestyle imagery, not product hardware.

- `product.video`: a local `assets/*.mp4` or `assets/*.webm` path, or an approved HTTPS media URL. Provide captions for videos with spoken information before publication.
- `policyUrls`: approved HTTPS policy links. Unconfigured links show availability notices, not invented legal text.
- `siteUrl`: approved HTTPS production origin, such as `https://your-domain.example`.

Static explanatory copy and FAQ answers live in `dist/index.html`. Update those along with configuration when final product facts become available. Existing payment utility code and regression tests remain dormant for a possible future release; there are no purchase controls in the rendered site.

## How enquiries work

The form prepares a draft locally in the current page. It does not send, store, upload, or email customer data. After validation, users can copy the draft. If `supportEmail` is configured, they can open their email application and send it themselves. A successful draft is never presented as a sent message.

Without JavaScript, form controls remain disabled to prevent accidental GET submissions containing personal information. Data is not persisted across reloads. Hosting can still process ordinary request logs.

## Tests

```sh
npm run check
npm test
npx playwright install chromium firefox webkit
npm run test:browser
npm run test:auth
npm audit
```

The browser download is needed once per computer. The development dependencies are pinned in the lockfile; `npm ci` installs the exact recorded versions.

- `check`: JavaScript syntax, HTML IDs, local assets, internal links, and absence of purchase controls.
- `test`: enquiry validation, media safety, schedule edge cases, retained checkout regressions, HTTP handling, security headers, and 100 concurrent local requests.
- `test:browser`: Chromium, Firefox, WebKit; 1440, 768, 390, and 320 pixel widths; automated WCAG accessibility checks, mobile menu, form states, FAQs, native dialogs, simulation, configured gallery/email handoff, and no-JavaScript fallback.
- `test:auth`: signup/login validation, example-device navigation, logout, confirmation callbacks and mocked API behavior across three browsers and three widths.
- Browser screenshots and structured results are saved in ignored `test-results/`.

These tests do not establish compatibility with every real device, assistive technology, or production network. No live messages or payments are sent by tests.

## Build

```sh
npm run build
```

Creates `release/`, a static copy of the site suitable for local review. It preserves `noindex` and disallows search crawling. It does not deploy.

After final product content, policies, domain and owner acceptance are complete:

```sh
npm run build -- --public
```

This requires a valid `siteUrl` and generates indexable metadata, canonical URL, robots.txt and sitemap. It does not check legal approval or deploy the output. `npm run check:launch` lists remaining content/configuration prerequisites; exit code 1 means required publication content is still missing.

## Project map

| Path | Purpose |
|---|---|
| `dist/` | Editable website source and public assets |
| `dist/features.js` | Enquiry, gallery, mobile navigation, next-schedule utility |
| `dist/app.js` | Existing demo, scenarios, policies and retained purchase utilities |
| `dist/motion.js` | Scroll reveals and motion preferences |
| `scripts/serve.cjs` | Local HTTP server |
| `server/server.js` | Compatibility entry point to the same local server |
| `server/db.js` | Unused earlier Neon scaffold; not imported by this release |
| `scripts/build.cjs` | Static release generation |
| `tests/` | Unit, integration, browser and accessibility checks |

## Security and operational limits

The local server binds only to `127.0.0.1`. It accepts GET/HEAD for public assets, denies private paths and Windows alternate data streams, and returns generic error responses. It sets CSP, anti-framing, MIME-sniffing and referrer headers. The Supabase SDK is bundled locally; account requests go directly to the configured Supabase project over HTTPS. No customer data tables are queried.

The server is a local development server, not a production reverse proxy. For a future public release, serve `release/` over HTTPS with appropriate hosting headers, caching, monitoring and backups. No database or admin credentials should be added merely to run this showcase.

## Image attribution

Lifestyle photo: Kate Darmody on Unsplash, https://unsplash.com/photos/a-living-room-filled-with-lots-of-plants-next-to-a-window-2YmEjjGIUOs. License: https://unsplash.com/license.

## Example-device dashboard

After login, open Living room plants, then choose Interval, Pump, Schedule or Settings. Each opens a placeholder section with a back link. These are navigation buttons only, as requested while app screenshots are pending. No real hardware status, device records, settings or watering commands are implemented. The home page live demo remains unchanged. Dashboard layout and navigation are in dist/dashboard.html, dist/dashboard.css and dist/dashboard.js.
