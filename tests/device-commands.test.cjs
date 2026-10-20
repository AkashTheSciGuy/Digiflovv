'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createCommands, revision, validateCommand } = require('../scripts/device-commands.cjs');
const clock = 1800000000000;
function fixture() {
  return { id: 'NODE1', status: { connectivity: { connected: true } },
    params: { Pump: { Power: false }, Schedule: { Power: false }, Interval: { Power: false }, 'Moisture Control': { Power: false }, Settings: { Duration: 5, Hour: 7, Minute: 0, IntervalMinutes: 10 } },
    config: { devices: ['Pump', 'Schedule', 'Interval', 'Moisture Control', 'Settings'].map(name => ({ name, params: (name === 'Settings' ? ['Duration', 'Hour', 'Minute', 'IntervalMinutes'] : ['Power']).map(name => ({ name, properties: ['read', 'write'] })) })) }
  };
}
function request(node, overrides = {}) { return { requestId: 'request_1234567890', expectedRevision: revision(node), expiresAt: clock + 30000, target: 'Settings', values: { Minute: 1 }, ...overrides }; }
function setup(node, write) {
  let writes = 0;
  let reads = 0;
  const command = createCommands({ now: () => clock, invalidate: () => {}, readNodes: async () => { reads++; return { node_details: [node] }; }, writeNode: async (id, payload) => { writes++; if (write) return write(id, payload); for (const [target, values] of Object.entries(payload)) Object.assign(node.params[target], values); } });
  return { command, writes: () => writes, reads: () => reads };
}

test('settings command returns reported only after a matching cloud read', async () => {
  const node = fixture(), api = setup(node);
  const result = await api.command('user', 'NODE1', request(node));
  assert.equal(result.state, 'reported'); assert.equal(api.writes(), 1); assert.equal(api.reads(), 2);
  assert.equal(node.params.Settings.Minute, 1);
});
test('accepted write without convergence stays sent', async () => {
  const node = fixture(), api = setup(node, async () => {});
  assert.equal((await api.command('user', 'NODE1', request(node))).state, 'sent');
});
test('ambiguous transport failure is unconfirmed and duplicate is not resent', async () => {
  const node = fixture(), api = setup(node, async () => { throw new Error('SECRET'); });
  const body = request(node);
  assert.equal((await api.command('user', 'NODE1', body)).state, 'unconfirmed');
  assert.equal((await api.command('user', 'NODE1', body)).state, 'unconfirmed');
  assert.equal(api.writes(), 1);
});
test('already matching request does not restart pump timer or write', async () => {
  const node = fixture(), api = setup(node);
  const result = await api.command('user', 'NODE1', request(node, { target: 'Pump', values: { Power: false } }));
  assert.equal(result.state, 'already_reported'); assert.equal(api.writes(), 0);
});
test('offline, stale revisions and revoked cloud access fail before writing', async () => {
  for (const variation of ['offline', 'stale', 'revoked']) {
    const node = fixture(), body = request(node);
    if (variation === 'offline') node.status.connectivity.connected = false;
    if (variation === 'stale') node.params.Settings.Minute = 4;
    const api = setup(node);
    const result = await api.command('user', variation === 'revoked' ? 'NODE2' : 'NODE1', body);
    assert.ok([403, 409].includes(result.status)); assert.equal(api.writes(), 0);
  }
});
test('explicit manual stop bypasses stale revision', async () => {
  const node = fixture(), body = request(node, { target: 'Pump', values: { Power: false } });
  node.params.Pump.Power = true;
  const api = setup(node);
  assert.equal((await api.command('user', 'NODE1', body)).state, 'reported');
  assert.equal(node.params.Pump.Power, false);
});
test('active automation prevents settings changes and conflicting automation enables', async () => {
  const node = fixture(); node.params.Interval.Power = true;
  const api = setup(node);
  assert.equal((await api.command('user', 'NODE1', request(node))).status, 409);
  assert.equal((await api.command('user', 'NODE1', request(node, { requestId: 'another_1234567890', target: 'Schedule', values: { Power: true } }))).status, 409);
  assert.equal(api.writes(), 0);
});
test('manual pump remains independent of automation', async () => {
  const node = fixture(); node.params.Interval.Power = true;
  const api = setup(node);
  assert.equal((await api.command('user', 'NODE1', request(node, { target: 'Pump', values: { Power: true } }))).state, 'reported');
});
test('duplicate in-flight requests share one write; different requests conflict', async () => {
  const node = fixture(); let release; const gate = new Promise(resolve => { release = resolve; });
  const api = setup(node, () => gate), body = request(node);
  const first = api.command('user', 'NODE1', body);
  const duplicate = api.command('user', 'NODE1', body);
  assert.equal((await api.command('user', 'NODE1', { ...body, requestId: 'different_1234567890' })).status, 409);
  release();
  assert.deepEqual(await first, await duplicate); assert.equal(api.writes(), 1);
  assert.equal((await api.command('user', 'NODE1', { ...body, values: { Minute: 2 } })).status, 409);
});
test('validation rejects unknown operations, coercion, invalid ranges and overflow', () => {
  const body = request(fixture());
  for (const overrides of [{ target: 'OTA' }, { values: {} }, { values: { Minute: '1' } }, { values: { Hour: 24 } }, { values: { Minute: -1 } }, { values: { Duration: 71583 } }, { values: { IntervalMinutes: 0 } }, { values: { Name: 'rename' } }, { extra: true }, { target: 'Pump', values: { Power: 1 } }]) {
    assert.equal(validateCommand({ ...body, ...overrides }), null);
  }
  assert.ok(validateCommand({ ...body, values: { Duration: 71582, Hour: 23, Minute: 59, IntervalMinutes: 71582 } }));
});
test('moisture switch uses its exact RainMaker name and respects automation conflicts', async () => {
  const node = fixture(), api = setup(node);
  const on = request(node, { target: 'Moisture Control', values: { Power: true } });
  assert.equal((await api.command('user', 'NODE1', on)).state, 'reported');
  assert.equal(node.params['Moisture Control'].Power, true);
  assert.equal((await api.command('user', 'NODE1', request(node, { requestId: 'schedule_1234567890', target: 'Schedule', values: { Power: true } }))).status, 409);
  assert.equal((await api.command('user', 'NODE1', request(node, { requestId: 'moisture_off_123456', target: 'Moisture Control', values: { Power: false } }))).state, 'reported');
});
test('expired and future commands never read or write device', async () => {
  const node = fixture(), api = setup(node);
  for (const expiresAt of [clock - 1, clock + 30001]) assert.equal((await api.command('user', 'NODE1', request(node, { expiresAt }))).status, 400);
  assert.equal(api.reads(), 0); assert.equal(api.writes(), 0);
});
test('read failures return generic errors before any write', async () => {
  let writes = 0;
  const command = createCommands({ now: () => clock, invalidate: () => {}, readNodes: async () => { throw new Error('SECRET'); }, writeNode: async () => { writes++; } });
  const result = await command('user', 'NODE1', request(fixture()));
  assert.equal(result.status, 503); assert.ok(!JSON.stringify(result).includes('SECRET')); assert.equal(writes, 0);
});
test('device-declared read-only parameter cannot be written', async () => {
  const node = fixture(); node.config.devices.find(device => device.name === 'Settings').params[2].properties = ['read'];
  const api = setup(node);
  assert.equal((await api.command('user', 'NODE1', request(node))).status, 400); assert.equal(api.writes(), 0);
});
