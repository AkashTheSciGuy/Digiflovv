'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHostedApi } = require('../scripts/hosted-device-api.cjs');
const { createDurableCommands } = require('../scripts/durable-commands.cjs');
const { revision } = require('../scripts/device-commands.cjs');
const owner = 'f25cb43e-6ac7-4291-a13c-f1449c84e4c2';
const other = '22222222-2222-4222-8222-222222222222';
const origin = 'https://digiflovv.netlify.app';
const auth = { Authorization: 'Bearer ' + 'x'.repeat(24) };
function storage() {
  const entries = new Map(); let counter = 0;
  return {
    async getWithMetadata(key) { return structuredClone(entries.get(key) || null); },
    async setJSON(key, data, condition = {}) {
      const old = entries.get(key);
      if ((condition.onlyIfNew && old) || (condition.onlyIfMatch && old?.etag !== condition.onlyIfMatch)) return { modified: false };
      const etag = String(++counter); entries.set(key, { data: structuredClone(data), etag }); return { modified: true, etag };
    }
  };
}
function node() {
  return { id: 'NODE1', status: { connectivity: { connected: true } }, secret: 'DO_NOT_EXPOSE',
    params: { Pump: { Power: false }, Settings: { Minute: 0 } }, config: { info: { name: 'Plant Watering' }, devices: [{ name: 'Pump', params: [{ name: 'Power', properties: ['write'] }] }, { name: 'Settings', params: [{ name: 'Minute', properties: ['write'] }] }] } };
}
function input(n) { return { requestId: 'hosted_request_1234567', expectedRevision: revision(n), expiresAt: Date.now() + 30000, target: 'Settings', values: { Minute: 1 } }; }
function request(path, body, customHeaders = {}) { return new Request(origin + path, { method: body === undefined ? 'GET' : 'POST', headers: { ...auth, ...customHeaders, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) }); }
function setup() {
  const current = node(); let writes = 0, reads = 0;
  const store = storage();
  const config = { links: { [owner]: ['NODE1'] }, allowedOrigins: new Set([origin]), store,
    verifyUser: async authorization => ({ id: authorization.endsWith('y'.repeat(24)) ? other : owner }),
    cloud: { read: async () => { reads++; return { node_details: [structuredClone(current)] }; }, write: async (id, payload) => { writes++; Object.assign(current.params.Settings, payload.Settings); } } };
  return { api: createHostedApi(config), config, current, writes: () => writes, reads: () => reads };
}
test('hosted endpoint denies anonymous, foreign origin and unauthorized device access', async () => {
  const s = setup();
  assert.equal((await s.api(new Request(origin + '/api/devices'))).status, 401);
  assert.equal((await s.api(request('/api/devices', undefined, { Origin: 'https://untrusted.example' }))).status, 403);
  const result = await s.api(request('/api/devices/NODE1/commands', input(s.current), { Authorization: 'Bearer ' + 'y'.repeat(24) }));
  assert.equal(result.status, 403); assert.equal(s.writes(), 0); assert.equal(s.reads(), 0);
});
test('hosted read and write responses strip credentials and return matching reports', async () => {
  const s = setup();
  const response = await s.api(request('/api/devices'));
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.ok(!(await response.text()).includes('DO_NOT_EXPOSE'));
  const body = await (await s.api(request('/api/devices/NODE1/commands', input(s.current)))).json();
  assert.equal(body.state, 'reported'); assert.equal(body.device.settings.minute, 1);
  assert.ok(!JSON.stringify(body).includes('DO_NOT_EXPOSE')); assert.equal(s.writes(), 1);
});
test('durable request deduplication survives a new function instance', async () => {
  const s = setup(), body = input(s.current);
  const first = await (await s.api(request('/api/devices/NODE1/commands', body))).json();
  const secondInstance = createHostedApi(s.config);
  assert.deepEqual(await (await secondInstance(request('/api/devices/NODE1/commands', body))).json(), first);
  assert.equal(s.writes(), 1);
  assert.equal((await secondInstance(request('/api/devices/NODE1/commands', { ...body, values: { Minute: 2 } }))).status, 409);
});
test('atomic lease prevents overlapping commands from separate function instances', async () => {
  const store = storage(); let release; const gate = new Promise(resolve => { release = resolve; }); let executes = 0;
  const options = { store, execute: async () => { executes++; await gate; return { status: 200, state: 'sent' }; } };
  const firstInstance = createDurableCommands(options), secondInstance = createDurableCommands(options);
  const n = node(), body = input(n);
  const first = firstInstance(owner, n.id, body);
  await new Promise(resolve => setImmediate(resolve));
  const second = await secondInstance(owner, n.id, { ...body, requestId: 'second_request_1234567' });
  assert.equal(second.status, 409); assert.equal(executes, 1);
  release(); assert.equal((await first).state, 'sent');
});
test('interrupted durable request is never automatically replayed', async () => {
  let time = 1800000000000; const store = storage(); let executes = 0;
  const durable = createDurableCommands({ store, now: () => time, execute: async () => { executes++; throw new Error('SECRET'); } });
  const n = node(), body = { ...input(n), expiresAt: time + 30000 };
  const first = await durable(owner, n.id, body);
  assert.equal(first.status, 503); assert.ok(!JSON.stringify(first).includes('SECRET'));
  time += 1000;
  assert.deepEqual(await createDurableCommands({ store, now: () => time, execute: async () => { executes++; } })(owner, n.id, body), first);
  assert.equal(executes, 1);
});
test('hosted API fails closed on storage outage and rejects oversized bodies', async () => {
  const s = setup(); s.config.store.getWithMetadata = async () => { throw new Error('SECRET'); };
  const api = createHostedApi(s.config);
  const response = await api(request('/api/devices/NODE1/commands', input(s.current)));
  assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('SECRET')); assert.equal(s.writes(), 0);
  assert.equal((await api(request('/api/devices/NODE1/commands', { value: 'x'.repeat(5000) }))).status, 413);
});
