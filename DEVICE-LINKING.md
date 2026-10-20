# Customer device connections

## Customer flow

Open My devices → Connect a device. Enter the RainMaker Global account email used in the phone app, request the email sign-in code, and verify it. DigiFlovv lists compatible watering devices returned by that authenticated RainMaker account. Connect adds the chosen device to this dashboard; Disconnect removes it. Users cannot connect by supplying someone else's node ID.

Disconnect device removes only that user's website selection. The device stays paired in the phone app, and watering/schedules already running on its firmware continue. The dialog explains this before confirmation. Disconnect RainMaker clears all website selections and the saved credential, then attempts to revoke only the website's RainMaker session with logout_all=false. A provider failure does not prevent local website revocation. This feature sends no pump, mode, reset or provisioning commands.

Only one RainMaker account is saved per DigiFlovv user, with up to100 selected devices. Changing to another RainMaker account is rejected if it lacks currently connected devices; disconnect those selections explicitly first. Shared devices may be connected when RainMaker grants that account access. Google/federated-account compatibility must be confirmed against the user's actual device list rather than inferred from matching email alone.

## Verification and authorization

- Existing manually verified associations remain available only to their original Supabase UUID. A per-user persisted record overrides the seed mapping, including an empty selection or complete-disconnection tombstone. A redeployment does not recreate disconnected associations.
- Supabase getUser verifies every authenticated request. Discovery, association changes, reads and writes use only that verified user. Selected IDs are checked against fresh RainMaker discovery before connecting.
- The command path reads the current association on every request and checks its version again immediately before dispatching a provider write. A disconnect during preflight prevents the write. Commands already dispatched can still complete; disconnect is not a physical emergency stop.
- Provider-client caches and API caches are bounded to64 entries, keyed by user and association version. Device-command locks/idempotency remain in the existing strongly consistent command store, shared across users and function instances for a node.
- Only the production origin and the function's trusted immutable deployment URL are accepted. Bearer authentication, no-store responses, method restrictions, strict JSON fields and4KB limits apply to the new endpoints. No credential-bearing CORS allowance is added.

## RainMaker sign-in

Official Global API: POST https://api.rainmaker.espressif.com/v1/login2. Start uses user_name only; verification uses user_name, session and verification_code. No RainMaker password is collected. The provider session stays encrypted server-side; the browser sends only the code entered by the user. Access/refresh tokens never enter browser responses, frontend configuration, localStorage or logs.

Requests have bounded timeouts and disallow redirects. OTP sends are limited by both Supabase UUID and normalized recipient email:60-second cooldown and5 sends/hour. The local challenge expires after10 minutes (the provider may expire it sooner); verification is limited to5 attempts and serialized with atomic writes. Used codes cannot be replayed. A connection-version guard prevents an in-flight verification from restoring a disconnected account. Uncommitted provider credentials are revoked best-effort.

Primary specification: https://swaggerapis.rainmaker.espressif.com/versions/3.11.0/Rainmaker_Swagger.yaml, login2 and logout2 operations. No dedicated OAuth client, paid integration or password reset is required by this email-code path. Whether an individual Google-backed account accepts email-code sign-in still needs live acceptance.

## Storage and encryption

netlify/functions/device-api.mjs uses private Netlify Blobs store digiflovv-device-links with strong reads and conditional writes. Keys hash user IDs and email addresses. Account selections are identifiers, not credentials. RainMaker refresh credentials and pending provider sessions use AES-256-GCM with random12-byte IVs,16-byte authentication tags and Supabase UUID as authenticated associated data; copying ciphertext to another user fails authentication.

DIGIFLOVV_LINK_ENCRYPTION_KEY is32 random bytes encoded as base64, configured for production/deploy-preview. The owner-approved free-plan environment policy applies: Netlify administrators/builds/functions can read ordinary environment variables. The key is excluded from frontend builds and retained in the task's restricted private backup. Preserve that key while credentials exist. Lost/corrupt/missing keys fail closed; never silently fall back to seed access. Rotation requires re-encrypting saved private fields with the old/new key, or deliberately clearing affected website connections and having those users sign in again. Keep old-key recovery protected until rotation is verified.

Store names separate device links from command leases. Keep disconnection tombstones. Do not roll production back to a pre-linking backend that ignores these records, because its static seed fallback could restore old permissions. After any rollback, recheck revoked access before restoring normal operation. Expired OTP records and rate buckets can be removed by controlled maintenance after their logical windows expire; no current valid account or tombstone should be deleted during that cleanup.

## Endpoints

All except health require a verified Supabase Bearer session. POST bodies require exactly the documented fields and application/json.

| Method/path | Body/result |
| --- | --- |
| GET /api/device-links | connected, masked email, authorized device IDs/names and per-device connected flags |
| POST /api/rainmaker/login/start | {email}; generic sign-in-code message |
| POST /api/rainmaker/login/verify | {code}; confirms provider verification; device selection stays explicit |
| POST /api/device-links/connect | {id}; fresh account discovery must contain a compatible device |
| POST /api/device-links/disconnect | {id}; persists selection removal without device actuation |
| POST /api/rainmaker/disconnect | {}; persists full website revocation, then revokes that provider session best-effort |

Errors:400 invalid fields/code,401 missing/invalid website session,403 unauthorized device/origin,409 changed connection or expired/used code,413 oversized body,415 unsupported content type,429 sign-in throttled,503 unavailable provider/storage. Errors never include provider bodies or credential values.

## Tests and acceptance

New backend tests cover persisted legacy unlink/reconnect, arbitrary-ID rejection, per-user discovery, ciphertext isolation/AAD binding, OTP send/attempt limits, expiry/replay, recipient throttling, disconnect during verification and during command preflight, malformed bodies, provider endpoint/revocation restrictions, and revocation when the provider is unavailable. Existing watering/backend tests remain in place.

Mocked Chromium/Firefox/WebKit tests exercise connection/disconnection and reload, invalid/valid codes, whole-account removal, mobile overflow and accessibility. They send no real email and do not actuate hardware. Authentication regressions also run at desktop and mobile widths. Live email-code acceptance and hosted disconnect/reconnect acceptance are pending; update this section with observed results before claiming them verified.

## Live provider rejection — 2026-10-20
The current Google-backed account returned HTTP 400 / RainMaker code 101009 for username-only login2. The published API describes this flow as MFA-enabled login and confirmation on a registered phone number; generic Google-account email OTP is not established. The dialog now identifies this limitation rather than promising email delivery or recommending retries. Existing legacy device authorization remains intact. Customer Google onboarding is incomplete and requires a supported registered RainMaker authorization integration. No provider credentials, email address or response descriptions were logged.
