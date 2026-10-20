# Local RainMaker integration: stage 1

This stage adds **read-only, authenticated local API access**. It does not enable dashboard controls, upload firmware, provision devices, or deploy anything. Moisture Control is excluded at the owner's request.

## Verified live access

On October 20, 2026, Google browser sign-in through Espressif's CLI succeeded. A subsequent live cloud read reported Plant Watering online with Pump, Schedule and Interval off; Duration=5, Hour=7, Minute=0, IntervalMinutes=10. The cloud also advertised Moisture Control, which this integration deliberately excludes. Duration is minutes in the inspected source; the running binary has not been proven identical to that source.

## Start locally

Install the official `esp-rainmaker-cli` in a separate Python environment and sign in using `esp-rainmaker-cli login --profile global`. Keep `RM_USER_CONFIG_DIR` outside `dist/` and `release/`, protected to the current operating-system user. Existing session files prepared for this task already meet that condition.

Create a private JSON ownership file outside public directories. Start with `{}`. After the owner verifies their DigiFlovv login through the connection check page, configure an explicit mapping:

```json
{
  "SUPABASE-USER-UUID": ["RAINMAKER-NODE-ID"]
}
```

Use actual verified identifiers; placeholders will fail startup validation. Each Supabase UUID may have multiple node IDs. Restart the local server after changing links. Both the explicit mapping and access by the signed-in RainMaker account are required. A missing/revoked RainMaker association yields no device. No email matching or first-user auto-claiming occurs.

Run `scripts/start-device-preview.ps1` with `-RainMakerPython`, `-RainMakerSession`, and `-DeviceLinks` pointing to the isolated Python executable, private session directory and ownership JSON file. The default port is 5501. Node 20+ must be available. The script loads only the existing public Supabase key, without printing it.

Sign into DigiFlovv at the local origin, then open `/integration-account.html`. If authentication redirects to login, reopen the connection-check URL after signing in. This operator setup page shows only the caller's verified Supabase UUID and linked device connectivity. It is served from `scripts/`, only when the bridge is configured, and is excluded from the static release.

## API and security

Both endpoints accept GET only, require `Authorization: Bearer <Supabase access token>`, verify the caller against the fixed project's `/auth/v1/user`, disable response caching, and return no RainMaker credentials. No service-role key is required. Requests with foreign Origin or non-loopback Host headers are rejected. The server binds to 127.0.0.1.

- `GET /api/device-account`: caller's verified `userId` and whether an explicit mapping exists.
- `GET /api/devices`: only mapped devices still accessible to the RainMaker session. Returns `id`, `name`, `online`, `observedAt`, `source`, `writable:false`, `power`, `settings`. Offline and missing values are null. Observation time records the cloud read, not a firmware acknowledgment or telemetry timestamp.
- Errors: 401 missing/invalid login; 403 disallowed origin/host; 405 attempted write; 503 unavailable authentication or cloud. Error bodies omit upstream diagnostics.

The private helper reads cloud metadata through the official library. It is invoked without a shell, with a 15-second process timeout and bounded output. Reads share one in-flight request and cache a successful snapshot for at most five seconds. The helper suppresses library diagnostic output and sends no commands.

Without `DIGIFLOVV_DEVICE_LINKS`, the existing development server behaves as before. Invalid configured bridge settings fail startup rather than silently granting access. Keep session data, private ownership files and Python environments out of source control and static builds.

## Verification and limits

`node --test tests/device-bridge.test.cjs` tests missing/invalid authentication, per-user isolation, allowlisting, offline unknown state, credential stripping, cross-origin denial, cloud failure, 100 concurrent requests, invalid ownership and identity lookup. These use mocked account/cloud responses and do not establish hardware actuation or production account linking. Separate live reads have confirmed cloud access.

## Remaining stages

1. Bind the verified DigiFlovv user UUID to the verified RainMaker node and test authorized reads with a real Supabase session, plus a second unauthorized user.
2. Connect the existing dashboard to these reads with multi-device selection and stale/offline handling.
3. Add validated commands, idempotency, conflict handling and reconciliation against device reports. Firmware acknowledgment support must be tested; HTTP success is not confirmation that a relay changed. Review firmware validation/automation conflicts before writes.
4. Establish supported production RainMaker web authorization/client registration and encrypted backend credential storage. The official desktop CLI's hosted redirect/localhost flow is not a completed production account-linking flow.
5. Select/deploy a trusted backend and enforce persistent ownership/RLS as appropriate. Static Netlify hosting alone does not execute this local bridge. Public deployment requires separate user authorization.

No new cloud services, payments or public deployment are part of this stage.
