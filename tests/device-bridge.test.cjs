'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createDeviceBridge, sanitizeNode } = require('../scripts/device-bridge.cjs');
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const headers = { Authorization: `Bearer ${'x'.repeat(24)}` };
const node = { id: 'NODE1', status: { connectivity: { connected: true } }, params: { Pump: { Power: true }, Settings: { Duration: 5 } }, secret: 'NEVER_RETURN_THIS' };

async function withBridge(options, run) {
  const handler = createDeviceBridge(options);
  const server = http.createServer(async (request, response) => {
    if (!await handler(request, response)) { response.writeHead(404); response.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}

test('device bridge rejects missing auth, invalid sessions and write methods', async () => {
  let calls = 0;
  await withBridge({ verifyUser: async () => null, readNodes: async () => { calls++; }, links: {} }, async base => {
    assert.equal((await fetch(base + '/api/devices')).status, 401);
    assert.equal((await fetch(base + '/api/devices', { headers })).status, 401);
    assert.equal((await fetch(base + '/api/devices', { headers, method: 'POST' })).status, 405);
    assert.equal(calls, 0);
  });
});

test('explicit ownership filters other devices and strips credentials', async () => {
  await withBridge({ verifyUser: async () => ({ id: owner }), readNodes: async () => ({ node_details: [node, { ...node, id: 'OTHER' }] }), links: { [owner]: ['NODE1'] } }, async base => {
    const response = await fetch(base + '/api/devices', { headers });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(body.devices.map(device => device.id), ['NODE1']);
    assert.equal(body.devices[0].power.pump, true);
    assert.equal(body.devices[0].writable, false);
    assert.equal(JSON.stringify(body).includes('NEVER_RETURN_THIS'), false);
    assert.equal(JSON.stringify(body).includes('Moisture'), false);
  });
});

test('another authenticated user receives no devices and cannot choose a node by query', async () => {
  let calls = 0;
  await withBridge({ verifyUser: async () => ({ id: other }), readNodes: async () => { calls++; }, links: { [owner]: ['NODE1'] } }, async base => {
    const body = await (await fetch(base + '/api/devices?nodeid=NODE1', { headers })).json();
    assert.deepEqual(body.devices, []);
    assert.equal(calls, 0);
  });
});

test('offline and malformed parameter values remain unknown', () => {
  const offline = sanitizeNode({ ...node, status: {} }, 'now');
  assert.deepEqual(offline.power, { pump: null, schedule: null, interval: null, moisture: null });
  assert.equal(offline.settings.duration, null);
  assert.equal(sanitizeNode({ ...node, params: { Pump: { Power: 'true' } } }, 'now').power.pump, null);
});

test('cross-origin requests are denied before account verification', async () => {
  let calls = 0;
  await withBridge({ verifyUser: async () => { calls++; }, readNodes: async () => {}, links: {} }, async base => {
    assert.equal((await fetch(base + '/api/devices', { headers: { ...headers, Origin: 'https://untrusted.example' } })).status, 403);
    assert.equal(calls, 0);
  });
});

test('cloud failure returns generic errors and never stale online state', async () => {
  await withBridge({ verifyUser: async () => ({ id: owner }), readNodes: async () => { throw new Error('SECRET'); }, links: { [owner]: ['NODE1'] } }, async base => {
    const response = await fetch(base + '/api/devices', { headers });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'Device status unavailable' });
  });
});

test('100 concurrent requests share one cloud read', async () => {
  let reads = 0;
  await withBridge({ verifyUser: async () => ({ id: owner }), readNodes: async () => { reads++; return { node_details: [node] }; }, links: { [owner]: ['NODE1'] } }, async base => {
    const responses = await Promise.all(Array.from({ length: 100 }, () => fetch(base + '/api/devices', { headers })));
    assert.ok(responses.every(response => response.status === 200));
    assert.equal(reads, 1);
  });
});

test('invalid ownership configuration fails closed', () => {
  assert.throws(() => createDeviceBridge({ links: { bad: ['NODE1'] } }), /Invalid device ownership/);
  assert.throws(() => createDeviceBridge({ links: { [owner]: ['../secret'] } }), /Invalid device ownership/);
});

test('account lookup reveals only the verified caller identity', async () => {
  await withBridge({ verifyUser: async () => ({ id: owner, email: 'private@example.com' }), readNodes: async () => {}, links: {} }, async base => {
    assert.deepEqual(await (await fetch(base + '/api/device-account', { headers })).json(), { userId: owner, linked: false });
  });
});

test('command HTTP route enforces ownership, JSON size, expiry and duplicate protection', async () => {
  const { revision } = require('../scripts/device-commands.cjs');
  const live = { id: 'NODE1', status: { connectivity: { connected: true } }, params: { Settings: { Minute: 0 } }, config: { devices: [{ name: 'Settings', params: [{ name: 'Minute', properties: ['write'] }] }] } };
  let writes = 0;
  await withBridge({
    verifyUser: async auth => ({ id: auth.endsWith('y'.repeat(24)) ? other : owner }),
    readNodes: async () => ({ node_details: [live] }),
    writeNode: async (id, payload) => { writes++; live.params.Settings.Minute = payload.Settings.Minute; },
    links: { [owner]: ['NODE1'] }
  }, async base => {
    const url = base + '/api/devices/NODE1/commands';
    const commandHeaders = { ...headers, 'Content-Type': 'application/json' };
    const body = { requestId: 'http_request_123456789', expectedRevision: revision(live), expiresAt: Date.now() + 30000, target: 'Settings', values: { Minute: 1 } };
    const post = (value, customHeaders = commandHeaders) => fetch(url, { method: 'POST', headers: customHeaders, body: typeof value === 'string' ? value : JSON.stringify(value) });
    assert.equal((await post(body, { ...commandHeaders, Authorization: `Bearer ${'y'.repeat(24)}` })).status, 403);
    assert.equal((await post(body, { ...commandHeaders, Origin: 'https://untrusted.example' })).status, 403);
    assert.equal((await post(body, headers)).status, 415);
    assert.equal((await post('{bad json')).status, 400);
    assert.equal((await post({ ...body, expiresAt: 1 })).status, 400);
    assert.equal((await post('x'.repeat(5000))).status, 413);
    assert.equal(writes, 0);
    assert.equal((await (await post(body)).json()).state, 'reported');
    assert.equal((await (await post(body)).json()).state, 'reported');
    assert.equal(writes, 1);
  });
});
