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

## Example-device dashboard — October 20, 2026

Scope narrowed by owner to device list and four buttons pending screenshots. Interval, Pump, Schedule and Settings open placeholder views; no inner controls or hardware integration added. Static checks and build passed. All 9 auth/browser scenarios passed with device navigation and back links, across three engines and desktop/mobile widths. Device-page accessibility checks passed; mobile screenshot visually reviewed. No deployment performed.

## RainMaker integration acceptance — October 20, 2026

37 unit/integration tests pass. Existing nine mocked authentication browser scenarios pass. Additional three-browser mocked dashboard scenarios pass for device selection, stale/offline state, settings drafts/saves and non-optimistic commands. Static checks and local build pass.

Separate live checks: owner confirmed a phone Minute change reached the website; website changed Minute to 2 and restored 0, independently verified through RainMaker; a supervised website Pump ON/OFF test produced matching reports, and owner confirmed physical start/stop plus phone OFF. Pump ended OFF, Minute=0. No firmware upload or public deployment occurred. Schedule/interval timing and automatic duration cutoff were not physically tested during this session. See DEVICE-INTEGRATION.md for limitations.

### Moisture and latency update

Added Moisture Control card/detail and validated commands. Replaced per-request Python launches with a persistent, certificate-verified HTTP worker. Read-back returns with the command response; pending reports poll freshly at one-second intervals, idle reports at five seconds. Immediate amber pending feedback preserves reported aria-checked state. 43 unit/integration tests cover the worker lifecycle, timeouts, malformed output, moisture conflicts, ownership and prior behavior. Browser tests cover moisture navigation/commands and immediate pending versus confirmed state. Real settings change/restore succeeded without starting the pump. Warm read samples: 308/784/337 ms versus earlier standalone 681/707/1209 ms; no physical latency claim is made.

## 2026-10-20 watering interval repair
53 automated web/backend tests pass. Device C++ controller selftests pass (100000 simulatedticks, boundary/ownership/mode/input/rollover cases). Seven cloudfirmware controls checks passed before final stopqueue review. Physical two-cycle test:60003ms ON,60002ms OFF,60003ms ON, userconfirmed. Finalqueuefix flashed; controller selftestsPASS and read-only/OFF-only cloudcheckallmodesOFF. Firmware settingsremainDuration1,IntervalMinutes1,Hour7,Minute0. No ADC sensor behavior, destructivefactory reset or OTAreflash testwasperformed. Furthermode-enablecheckblockedbyautomaticreviewtoavoidmorewatering; notcounted aspassed. Detailed evidence: firmware/README.md; tasklocal interval-proof-result.json and filteredUSB timinglog.


## Device-linking feature
66backend/unit tests pass, including13new linking/login/security cases. New Chromium/Firefox/WebKit mobile management flow and accessibility tests passed with mocked provider/APIs; no emails or watering occurred. Existing3devicebrowser and9authenticationbrowser scenarios also passed. Productionhealth200, unauthenticated linking/device APIs401, foreignorigin403; the originalownerdevice remainedlisted. LiveOTP/accountmatch and disconnect/reconnect still require useracceptance. Servercredential/key scan of25releasefiles passed.

