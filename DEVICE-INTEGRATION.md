# DigiFlovv RainMaker local integration

## Current scope and verified behavior

The local website connects the existing Supabase login to explicitly authorized RainMaker nodes. Users can view reported status/settings, operate Pump/Schedule/Interval/Moisture Control, and save Settings. Multiple mapped nodes appear as separate selectable cards. Device renaming, OTA controls, and factory reset controls are excluded from the website. Moisture Control mirrors the existing firmware switch; its sensor logic is unchanged. Existing firmware and mobile app remain unchanged.

Live acceptance on October 20, 2026:
- Google RainMaker sign-in succeeded through the official CLI; the account has primary access to Plant Watering.
- The owner changed Minute from 0 to 1 in the phone app and confirmed the website updated and showed Online.
- A website settings submission changed Minute from 1 to 2. A separate authenticated RainMaker read confirmed Minute=2 and Pump/Schedule/Interval=false.
- A website submission restored Minute=0. A separate cloud read and the owner confirmed it.
- A supervised website Pump ON/OFF test produced matching cloud reports. The owner confirmed the physical pump started and stopped and the phone app showed OFF. The final cloud read reported Pump=false and Minute=0.

Schedule/Interval timing and the automatic duration cutoff have not been physically tested in this integration session. Cloud reports are not a sensor measurement of relay operation.

## Architecture and trust boundary

Browser -> loopback Node server -> server-side Supabase token verification -> explicit per-user node allowlist -> trusted RainMaker Python adapters -> RainMaker cloud -> existing ESP firmware.

The website keeps its existing Supabase session. RainMaker tokens never enter frontend files, API responses, browser storage, or source control. No Supabase service-role key is needed locally. The official CLI session is in a separate private directory restricted to the current Windows user. Production credentials will require encrypted server-side storage and a separately verified supported authorization flow.

The local bridge is optional. Without its configuration, the server and static deployment preserve the original offline placeholder. The local setup page is served from scripts only when the bridge is configured; it is excluded from the static release. The existing Netlify site has not been deployed or modified.

## Start and link locally

Use Node 20+ and an isolated Python environment containing official esp-rainmaker-cli. Set RM_USER_CONFIG_DIR to a private directory outside dist/release and sign in with esp-rainmaker-cli login --profile global. Do not commit the environment, session files or ownership file.

Create a private JSON mapping from verified Supabase user UUIDs to authorized RainMaker node IDs. An empty object grants no device access. Confirm the UUID through the local integration-account.html setup page before adding a link. The owner of this task has completed this process; the private mapping is already configured. No automatic first-user claiming or email matching occurs.

Run scripts/start-device-preview.ps1 with:
- RainMakerPython: absolute path to the isolated Python executable.
- RainMakerSession: absolute path to the private RainMaker session directory.
- DeviceLinks: absolute path to the private ownership JSON.
- Port: optional, defaults to 5501.
- EnableCommands: optional switch; without it, API and dashboard are read-only.

Sign into http://127.0.0.1:5501/login.html, then open dashboard.html. The server binds only to 127.0.0.1. Restart after changing ownership mappings; they are validated and loaded at startup. Clearing/revoking the RainMaker association also removes access on the next fresh cloud read. Public auth configuration is loaded from the existing auth-config.js without printing it.

## APIs

All API routes require a Bearer Supabase access token, verified against the fixed project's /auth/v1/user endpoint. Foreign Origin and non-loopback Host headers are rejected. No CORS permissions or cookie authentication are used. Responses disable caching; upstream diagnostics and credentials are omitted.

GET /api/device-account returns only the verified caller's userId and linked flag.

GET /api/devices returns devices still accessible in both the explicit local mapping and the RainMaker account. Each contains id, name, online, observedAt, source, writable, revision, commandExpiresAt, power and settings. Offline/missing parameter values are null. observedAt records the cloud-read time, not a firmware acknowledgment. The dashboard polls every five seconds while visible, or every second while awaiting a report. Successful reads are cached for up to five seconds and concurrent reads share a request. Cloud failures clear displayed state rather than retaining an old Online/On label.

POST /api/devices/{nodeId}/commands accepts application/json only, with at most 4096 bytes:

```json
{
  "requestId": "unique-request-identifier",
  "expectedRevision": "revision-from-the-device-read",
  "expiresAt": 1800000000000,
  "target": "Settings",
  "values": { "Minute": 1 }
}
```

requestId is 16-80 letters, digits, hyphens or underscores. expectedRevision is the 64-character revision returned by the latest device read. expiresAt must be the returned commandExpiresAt (server-issued 30-second deadline), avoiding reliance on browser clock accuracy. This example timestamp is illustrative and is not a usable command.

Allowed targets and values:
- Pump, Schedule, Interval, Moisture Control: exactly one Power boolean.
- Settings: one or more of Duration, Hour, Minute, IntervalMinutes, integer values only.
- Hour: 0-23; Minute: 0-59.
- Duration and IntervalMinutes: 1-71582 minutes. The upper bound prevents overflow of the inspected firmware's 32-bit millisecond multiplication. It is a technical bound, not a recommended watering duration.

The backend verifies device-declared writable parameters, fresh cloud access/online state, expected revision and expiry before sending. Settings writes require the pump and all configured automation modes to report OFF. Enabling Schedule/Interval requires other configured automation modes to be OFF, including Moisture Control. It rejects conflicts instead of silently disabling another mode. Manual Pump remains independent. An explicit Pump OFF may bypass a revision conflict.

Only one command is processed per node at once; concurrent distinct commands receive 409 rather than being queued for later actuation. Repeated request IDs with the same content reuse the original result for 120 seconds. Reusing a key with different content receives 409. The local in-memory request cache is capped at 512 records and is lost on server restart. Unchanged values are not resent, preventing an already-ON request from restarting the firmware's duration timer. Failed/ambiguous writes are never automatically retried.

Command response states:
- already_reported: requested values matched the fresh preflight report; no write sent.
- reported: values matched a fresh cloud report after the write.
- sent: cloud accepted the command, but a matching report was not yet seen.
- unconfirmed: transport or read-back failed after a write attempt; delivery is uncertain.

The UI retains reported switch values while sending and reconciles later reports. It does not turn a switch ON just because a command was sent. A matching cloud report does not establish an exact command-correlated firmware acknowledgment. App changes can race the backend's read/write steps; RainMaker parameter writes do not provide an atomic compare-and-set in this implementation.

Errors: 400 malformed/unsupported/expired command; 401 invalid login; 403 unauthorized device/origin/host; 405 unavailable method or disabled commands; 409 offline/state/automation/concurrent-command conflict; 413 oversized body; 415 non-JSON; 429 request-cache capacity; 503 account/cloud read unavailable. Error responses omit secrets.

## Verification

- npm run check: syntax, content references and static checks.
- npm test: 37 unit/integration tests, including ownership isolation, malformed requests, expiry, deduplication, ambiguous delivery, offline/stale state, automation conflicts, read-only parameters and concurrent requests.
- npm run test:auth: nine mocked Supabase browser scenarios across Chromium, Firefox and WebKit and three widths.
- node tests/dashboard-live-browser.cjs: three-browser mocked API tests covering multiple devices, offline/failure/unlink, dirty settings preservation, saves, and delayed/non-optimistic power reports.
- npm run build: static release generation; does not deploy or include the trusted local server/session.

Mocked tests do not prove physical behavior. The separate live acceptance results above describe exactly what was observed.

## Remaining production work

The public Netlify site is static. Its browser code cannot use this computer's loopback bridge or CLI credentials. Production requires a hosted trusted backend, persistent authorization, encrypted RainMaker credential storage/rotation, durable command tracking, per-user linking and real second-user acceptance. Establish supported RainMaker web-client registration/account linking; the official desktop CLI's Espressif redirect/localhost callback is not a production website authorization flow.

The firmware's existing app-side automation conflicts, missing moisture controller and physical-reset behavior have not been changed. Global mutual exclusion and strong command acknowledgment/order guarantees require firmware/protocol work and hardware acceptance; backend checks cannot enforce them against simultaneous phone-app changes.

Public deployment requires the owner's separate authorization. No paid service or production cloud changes were introduced.

## Latency and Moisture Control update — October 20, 2026

Moisture Control is now included on the device card grid and its own Name/Power page, using the exact RainMaker target Moisture Control. GET responses include power.moisture and capabilities.moisture. Devices without that capability hide its card and keep its switch disabled. Moisture enable commands use the same ownership, validation, expiry, deduplication and automation-conflict checks as other modes. Existing firmware sensor logic remains unchanged and has not been repaired or validated by this UI update.

The backend now runs one private persistent Python worker and reuses a certificate-verified requests.Session HTTP connection. It refreshes credentials through the official RainMaker configuration library. It bounds worker requests/output, times out failures, and recovers on a later explicit request without automatically retrying writes. The worker shuts down with the local server. The standalone read adapter is retained for independent diagnostics; live requests use the persistent worker.

Command read-back is sanitized and returned in the command response, avoiding a redundant frontend cloud read. Ambiguous/unconfirmed requests poll fresh reports every second; idle polling is five seconds. Buttons show an immediate amber pending position and Turning on/off label while aria-checked still reflects the last confirmed report. No firmware change, direct LAN control or cloud-latency guarantee is implied.

Three old standalone read timings were 681/707/1209 ms. Persistent-worker timings were 1163 ms cold and 308/784/337 ms warm. These are read timings in one network sample, not physical actuation measurements. A real website Minute=1 command and restore to 0 succeeded through the new worker. Pump/Schedule/Interval/Moisture Control ended OFF. No pump or moisture ON command was issued in this update.

Verification now includes 43 unit/integration tests, worker lifecycle/failure tests, moisture/pending-state tests in Chromium/Firefox/WebKit, and the existing nine authentication browser scenarios. The Netlify site remains unchanged.
