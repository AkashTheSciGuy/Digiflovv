# DigiFlovv hosted RainMaker deployment

## Deployment architecture

Netlify serves release/ and the netlify/functions/device-api.mjs function at /api/*. The function uses the shared command validator and state sanitizer, verifies each Supabase session server-side, enforces an explicit private user-to-node mapping, and talks directly to the fixed Global RainMaker HTTPS API. No local computer or Python worker is required by the hosted API.

RainMaker access tokens are refreshed from the backend-only refresh credential and cached in function memory until shortly before expiry. The provider API uses the access token, not its identity token. No provider credentials enter the frontend or API responses.

Netlify Blobs stores per-node command leases and idempotency results with strong consistency and atomic conditional writes. This prevents separate function instances from processing overlapping node commands. Active leases expire after 90 seconds, request results are retained for at least 120 seconds and old records are pruned on subsequent commands. Ambiguous/interrupted writes are not automatically replayed. This does not provide atomic ordering against changes made independently in the RainMaker mobile app; firmware/protocol guarantees remain separate.

## Private function configuration

The owner explicitly approved the free-plan configuration: ordinary site environment variables in production and deploy-preview contexts. Netlify site administrators and build processes can read these values. They are excluded from frontend files; the build scripts copy static sources and do not interpolate environment variables. Function-only scopes and the special secret flag were rejected by this account plan. No upgrade or payment was made. Variables:

- DIGIFLOVV_RAINMAKER_REFRESH_TOKEN
- DIGIFLOVV_DEVICE_LINKS_JSON
- DIGIFLOVV_SUPABASE_PUBLIC_KEY (public authentication key)

The mapping initially grants only the owner-confirmed Supabase UUID access to its verified node. Other authenticated users receive an empty device list; explicit unauthorized node commands are denied. New customers use the password-free RainMaker email-code flow in DEVICE-LINKING.md. The original mapping is now a migration seed only; persisted per-user selections and revocation tombstones override it.

Do not put these variables in netlify.toml, dist/, release/, logs or chat. Never add a Supabase service-role key just to operate this integration. The current backend does not require one. After changing hosted variables, deploy again. To remove a user's hosted device access, update the private mapping and redeploy. If RainMaker authorization expires/revokes, renew the trusted account session and replace the private site environment credential through Netlify's secure settings.

## Build and deploy

Node 22.12 or newer is required by the Netlify storage SDK. netlify.toml sets the hosted build runtime to Node 22, builds with npm run build, publishes release/, and bundles the function from netlify/functions.

Run npm run check, npm test, npm run test:auth, node tests/dashboard-live-browser.cjs and npm run build. The hosted client and distributed command tests are included in npm test. The runtime dependency audit reported zero vulnerabilities during preparation.

Use the official Netlify CLI to link the existing project, build a deploy-preview, then publish production after verifying the preview. The current Windows environment returns EISDIR when readlink is called on a regular non-symlink file; the isolated deployment tool's @vercel/nft compatibility handling was adjusted to treat that as not-a-symlink. This is a local packaging workaround, not application code or a security-policy change.

The site's existing Netlify preview access protection stays enabled. A preview viewer may need to sign into Netlify before the DigiFlovv login. Do not disable that protection merely to automate a test.

## Prepared deployment

Site: digiflovv.netlify.app
Site ID: 32b942bc-8f0a-433d-a526-eb863d82b44b
Published deploy ID: 6ad786be60d3addaad1df343
Draft: https://6ad786be60d3addaad1df343--digiflovv.netlify.app

A rollback reference to the previously published deployment is saved in this task's private local deployment records. The tested preview was published to production using restoreSiteDeploy after the separate production CLI build failed with Forbidden. Public production checks passed: health JSON 200, anonymous devices JSON 401, foreign Origin 403, dashboard/assets 200, private file path 404. Authenticated production acceptance passed: owner sees linked device online, all four power reports OFF, and Moisture Control card present. Live Settings Minute 0 → 1 → 0 returned matching RainMaker reports for both writes, verifying hosted authentication, ownership, durable storage and cloud delivery. Supervised production Pump ON/OFF passed: both requested states received matching RainMaker reports; owner confirmed physical start/stop and phone app OFF. Final report: Pump, Schedule, Interval and Moisture Control all OFF; Minute restored to0. All 52 tests and static checks passed.

## Acceptance checks

- Confirm public pages and dashboard assets load over HTTPS.
- Confirm /api/health reaches the hosted function.
- Anonymous /api/devices must return the application's JSON 401, not a static page or platform sign-in HTML.
- Owner signs into DigiFlovv and sees the linked device and current reported values.
- Verify the hosted settings path with all modes off, then restore its original value.
- Test Pump ON/OFF only with the owner present and ready to observe it; verify both the phone app and physical pump finish OFF.
- Keep moisture firmware behavior separate: the website mirrors the switch, but the previously inspected moisture controller remains unfinished.
- After publishing, repeat the production-origin checks; draft success alone is not production acceptance.

No plan upgrade, paid purchase, firmware upload was made during this deployment. One owner-supervised Pump ON/OFF test was completed. Runtime origin checks use Netlify trusted context.site.id and context.deploy.id for the immutable preview address, alongside the explicit production origin.





2026-10-20 timing repair: firmware flashed and original Arduino source updated. Duration1/Interval1 measured physical cycles ON60003ms/OFF60002ms/ON60003ms, ownerconfirmed. Final priority-stop review patch passed device selftests and OFF-only checks.53 website/backend tests pass; static check and releasedcredentialscan pass. Current deployment6ad786be60d3addaad1df343 includes visible interval-rest explanation and sanitized provider-error logging. Live health200, anonymous device401, ownerdashboardonline—allfourcontrolsOFF. ADCmoisturecontrol isstilldeferred; see firmware/README.md for exact testscope and limitations.


Customer device-linking update: production6ad786be60d3addaad1df343. Additional ordinary server environment variable DIGIFLOVV_LINK_ENCRYPTION_KEY protects per-user providercredentials/OTP sessions in private strong-consistency NetlifyBlobs store digiflovv-device-links. No keys/tokens in25publishedfiles. Existingownerdevice remainedlisted afterdeployment; livehealth200, anonymouslinks/devices401, foreignOrigin403.66backendtests and15mockbrowser scenarios pass (9auth,3existingdevice,3newlinking). Liveemail-code/provideraccount match and device disconnect/reconnect acceptance pending. See DEVICE-LINKING.md before credential rotation or rollback; preserve disconnect tombstones and avoid rollback to the old static-only backend.
