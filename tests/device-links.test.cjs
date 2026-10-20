'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { createAccountLinks } = require('../scripts/account-links.cjs');
const { createLinkedDeviceApi } = require('../scripts/linked-device-api.cjs');
const { createRainMakerLogin } = require('../scripts/rainmaker-login.cjs');
const { revision } = require('../scripts/device-commands.cjs');
const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
const origin = 'https://digiflovv.netlify.app';
function storage() {
  const entries = new Map(); let sequence = 0;
  return { entries,
    async getWithMetadata(key) { return structuredClone(entries.get(key) || null); },
    async setJSON(key, data, condition = {}) {
      const old = entries.get(key);
      if ((condition.onlyIfNew && old) || (condition.onlyIfMatch && old?.etag !== condition.onlyIfMatch)) return { modified: false };
      const etag = String(++sequence); entries.set(key, { data: structuredClone(data), etag }); return { modified: true, etag };
    }
  };
}
function node(id) {
  return { id, secret: 'PRIVATE_PROVIDER_BODY', status: { connectivity: { connected: true } },
    config: { info: { name: 'Plant ' + id }, devices: [{ name: 'Pump', params: [{ name: 'Power', properties: ['read', 'write'] }] }] }, params: { Pump: { Power: false } } };
}
function setup() {
  const store = storage(), a = node('A'), b = node('B'); let time = 1800000000000, writes = 0, sends = 0;
  const provider = current => ({ read: async () => ({ node_details: [structuredClone(current)] }), write: async (_id, payload) => { writes++; Object.assign(current.params.Pump, payload.Pump); } });
  const legacyCloud = provider(a), personalCloud = provider(b);
  const login = { start: async () => { sends++; return 'PRIVATE_PROVIDER_SESSION'; }, verify: async (_email, _session, code) => { if (code !== '123456') throw Error(); return 'PRIVATE_REFRESH_TOKEN'; }, revoke: async () => {} };
  const options = { store, encryptionKey: randomBytes(32).toString('base64'), seeds: { [alice]: ['A'] }, legacyCloud, cloudFactory: () => personalCloud, login, now: () => time };
  const accounts = createAccountLinks(options);
  const apiOptions = { accounts, store, allowedOrigins: new Set([origin]), verifyUser: async bearer => ({ id: bearer.endsWith('b'.repeat(24)) ? bob : alice }) };
  return { accounts, options, apiOptions, store, a, b, login, personalCloud, tick: ms => { time += ms; }, writes: () => writes, sends: () => sends };
}
function request(user, path, body, headers = {}) {
  return new Request(origin + path, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: 'Bearer ' + (user === bob ? 'b' : 'a').repeat(24), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function personal(s, user = bob) { await s.accounts.start(user, 'owner@example.com'); await s.accounts.verify(user, '123456'); }

test('legacy disconnect persists across instances and cannot be reclaimed by another user', async () => {
  const s = setup();
  assert.deepEqual((await s.accounts.status(alice)).devices.map(x => [x.id, x.connected]), [['A', true]]);
  await s.accounts.changeDevice(alice, 'A', false);
  const next = createAccountLinks(s.options);
  assert.deepEqual((await next.status(alice)).devices.map(x => [x.id, x.connected]), [['A', false]]);
  await assert.rejects(next.changeDevice(bob, 'A', true), /cannot access/);
  await next.changeDevice(alice, 'A', true);
  assert.equal((await next.read(alice)).account.selected[0], 'A');
});

test('email-code linking encrypts provider tokens and sessions and isolates discovery', async () => {
  const s = setup(); await personal(s);
  const status = await s.accounts.status(bob);
  assert.deepEqual(status.devices.map(x => [x.id, x.connected]), [['B', false]]);
  assert.ok(!JSON.stringify(status).includes('PRIVATE'));
  assert.ok(!JSON.stringify([...s.store.entries]).includes('PRIVATE'));
  assert.ok(!JSON.stringify([...s.store.entries]).includes('owner@example.com'));
  await assert.rejects(s.accounts.changeDevice(bob, 'A', true), /cannot access/);
  await s.accounts.changeDevice(bob, 'B', true);
  assert.deepEqual((await s.accounts.read(bob)).account.selected, ['B']);
  assert.deepEqual((await s.accounts.status(alice)).devices.map(x => x.id), ['A']);
});

test('whole-account disconnect removes access even when provider revocation fails', async () => {
  const s = setup(); await personal(s); await s.accounts.changeDevice(bob, 'B', true);
  s.login.revoke = async () => { throw Error('PRIVATE'); };
  const message = await s.accounts.disconnectAccount(bob);
  assert.ok(!JSON.stringify(message).includes('PRIVATE'));
  assert.equal((await createAccountLinks(s.options).read(bob)).account.kind, 'none');
  await s.accounts.disconnectAccount(alice);
  assert.deepEqual((await createAccountLinks(s.options).status(alice)).devices, []);
});

test('sign-in cooldown and attempt limits survive new instances; expired codes fail closed', async () => {
  const s = setup(); await s.accounts.start(bob, 'owner@example.com');
  await assert.rejects(createAccountLinks(s.options).start(bob, 'other@example.com'), /wait/);
  for (let i = 0; i < 5; i++) await assert.rejects(s.accounts.verify(bob, '000000'), /could not be verified/);
  await assert.rejects(s.accounts.verify(bob, '123456'), /new sign-in code/);
  s.tick(60001); await s.accounts.start(bob, 'owner@example.com'); s.tick(600001);
  await assert.rejects(s.accounts.verify(bob, '123456'), /new sign-in code/);
  assert.equal((await s.accounts.read(bob)).account.kind, 'none');
});

test('recipient cooldown also prevents sends by a second website account', async () => {
  const s = setup(); await s.accounts.start(alice, 'owner@example.com');
  await assert.rejects(s.accounts.start(bob, 'owner@example.com'), /wait/);
  assert.equal(s.sends(), 1);
});

test('verified codes are consumed and cannot be replayed', async () => {
  const s = setup(); await personal(s);
  await assert.rejects(s.accounts.verify(bob, '123456'), /new sign-in code/);
});

test('disconnect during verification cannot restore revoked access', async () => {
  const s = setup(); let release;
  const gate = new Promise(resolve => { release = resolve; });
  s.login.verify = async () => { await gate; return 'PRIVATE_REFRESH_TOKEN'; };
  await s.accounts.start(bob, 'owner@example.com');
  const verifying = s.accounts.verify(bob, '123456');
  await new Promise(resolve => setImmediate(resolve));
  await s.accounts.disconnectAccount(bob); release();
  await assert.rejects(verifying, /Connection changed/);
  assert.equal((await s.accounts.read(bob)).account.kind, 'none');
});

test('another RainMaker account cannot silently replace current device access', async () => {
  const s = setup(); await s.accounts.start(alice, 'different@example.com');
  await assert.rejects(s.accounts.verify(alice, '123456'), /does not contain/);
  assert.deepEqual((await s.accounts.read(alice)).account.selected, ['A']);
});

test('encrypted credentials are bound to website user; corrupted records never fall back', async () => {
  const s = setup(); await personal(s);
  const personalRecord = [...s.store.entries].find(([key]) => key.startsWith('account-'));
  const aliceRecord = await s.accounts.read(alice);
  await s.accounts.changeDevice(alice, 'A', false);
  const aliceKey = [...s.store.entries].find(([key, value]) => key.startsWith('account-') && value.data.kind === 'legacy')[0];
  const swapped = structuredClone(personalRecord[1]); swapped.data.selected = [];
  s.store.entries.set(aliceKey, swapped);
  await assert.rejects(s.accounts.status(alice));
  assert.equal(aliceRecord.account.selected[0], 'A');
});

test('linked HTTP API protects routes, strips provider data and revokes commands immediately', async () => {
  const s = setup(), api = createLinkedDeviceApi(s.apiOptions);
  assert.equal((await api(new Request(origin + '/api/device-links'))).status, 401);
  assert.equal((await api(request(alice, '/api/device-links', undefined, { Origin: 'https://evil.example' }))).status, 403);
  assert.equal((await api(request(bob, '/api/device-links/connect', { id: 'A' }))).status, 403);
  await personal(s); await s.accounts.changeDevice(bob, 'B', true);
  const listed = await (await api(request(bob, '/api/devices'))).json();
  assert.deepEqual(listed.devices.map(d => d.id), ['B']); assert.ok(!JSON.stringify(listed).includes('PRIVATE'));
  await api(request(bob, '/api/device-links/disconnect', { id: 'B' }));
  const body = { requestId: 'link_command_1234567890', expectedRevision: revision(s.b), expiresAt: Date.now() + 30000, target: 'Pump', values: { Power: true } };
  assert.equal((await api(request(bob, '/api/devices/B/commands', body))).status, 403);
  assert.equal(s.writes(), 0);
  assert.deepEqual((await (await createLinkedDeviceApi(s.apiOptions)(request(bob, '/api/devices'))).json()).devices, []);
});

test('disconnect during command preflight prevents provider write', async () => {
  const s = setup(); await personal(s); await s.accounts.changeDevice(bob, 'B', true);
  let release; const gate = new Promise(resolve => { release = resolve; });
  s.personalCloud.read = async () => { await gate; return { node_details: [structuredClone(s.b)] }; };
  const api = createLinkedDeviceApi(s.apiOptions);
  const pending = api(request(bob, '/api/devices/B/commands', { requestId: 'pending_link_123456789', expectedRevision: revision(s.b), expiresAt: Date.now() + 30000, target: 'Pump', values: { Power: true } }));
  await new Promise(resolve => setImmediate(resolve));
  await s.accounts.changeDevice(bob, 'B', false); release();
  await pending; assert.equal(s.writes(), 0);
});

test('connection body validation rejects oversized JSON, extra fields and invalid codes', async () => {
  const s = setup(), api = createLinkedDeviceApi(s.apiOptions);
  assert.equal((await api(request(bob, '/api/rainmaker/login/start', { email: 'x'.repeat(5000) }))).status, 413);
  assert.equal((await api(request(bob, '/api/device-links/connect', { id: 'A', owner: alice }))).status, 400);
  assert.equal((await api(request(bob, '/api/rainmaker/login/verify', { code: 123456 }))).status, 400);
  assert.equal((await api(request(bob, '/api/rainmaker/login/start', { email: 'invalid' }))).status, 400);
});

test('password-free provider login uses fixed TLS endpoints and revokes only its own session', async () => {
  const calls = [];
  const provider = createRainMakerLogin({ fetcher: async (url, options) => {
    calls.push([url, options]);
    if (JSON.parse(options.body).user_name && !JSON.parse(options.body).verification_code) return Response.json({ status: 'success', session: 'PRIVATE_SESSION_123' });
    return Response.json({ status: 'success', refreshtoken: 'r'.repeat(128), accesstoken: 'access' });
  } });
  const session = await provider.start('owner@example.com');
  await provider.verify('owner@example.com', session, '123456'); await provider.revoke('r'.repeat(128));
  assert.ok(calls.every(([url, options]) => url.startsWith('https://api.rainmaker.espressif.com/v1/') && options.redirect === 'error'));
  assert.ok(calls.at(-1)[0].endsWith('logout_all=false'));
  assert.ok(!JSON.stringify(calls).includes('password'));
});

test('login rejection diagnostics contain only operation, HTTP status and numeric code', async () => {
  const events = [];
  const login = createRainMakerLogin({ onError: event => events.push(event), fetcher: async () => Response.json({ error_code: 101009, description: 'PRIVATE_EMAIL_AND_PROVIDER_DETAILS' }, { status: 400 }) });
  await assert.rejects(login.start('private@example.com'), /unavailable/);
  assert.deepEqual(events, [{ service: 'RainMakerLogin', operation: 'start', status: 400, code: '101009' }]);
  assert.ok(!JSON.stringify(events).includes('PRIVATE'));
  assert.ok(!JSON.stringify(events).includes('private@example.com'));
});
