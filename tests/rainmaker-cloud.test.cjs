'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createRainMakerCloud } = require('../scripts/rainmaker-cloud.cjs');
const token = () => 'header.' + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.signature';
test('hosted cloud client refreshes once, uses fixed endpoints and reuses its token', async () => {
  let refreshes = 0;
  const calls = [];
  const cloud = createRainMakerCloud({ refreshToken: 'PRIVATE_REFRESH', fetcher: async (url, options) => {
    calls.push([url, options]);
    if (url.endsWith('/login2')) { refreshes++; return Response.json({ idtoken: 'identity-token-not-api-bearer', accesstoken: token() }); }
    return Response.json({ node_details: [] });
  } });
  await Promise.all([cloud.read(), cloud.read()]); await cloud.read();
  assert.equal(refreshes, 1); assert.ok(calls.every(([url]) => url.startsWith('https://api.rainmaker.espressif.com/v1/')));
  assert.ok(calls.every(([, options]) => options.redirect === 'error'));
  assert.ok(!JSON.stringify(await cloud.read()).includes('PRIVATE_REFRESH'));
});
test('hosted cloud writes exactly once and rejects ambiguous/rejected responses', async () => {
  let writes = 0;
  const cloud = createRainMakerCloud({ refreshToken: 'private', fetcher: async (url, options) => {
    if (url.endsWith('/login2')) return Response.json({ accesstoken: token() });
    writes++; assert.equal(options.method, 'PUT');
    return Response.json([{ node_id: 'NODE1', status: 'failure' }]);
  } });
  await assert.rejects(cloud.write('NODE1', { Pump: { Power: false } }), /not confirmed/); assert.equal(writes, 1);
});
test('cloud pagination rejects repeated cursors rather than looping', async () => {
  const cloud = createRainMakerCloud({ refreshToken: 'private', fetcher: async url => url.endsWith('/login2') ? Response.json({ accesstoken: token() }) : Response.json({ node_details: [], next_id: 'same' }) });
  await assert.rejects(cloud.read(), /pagination/);
});

test('cloud diagnostics exclude credentials, provider bodies and transport messages', async () => {
  for (const failure of ['http', 'timeout', 'transport']) {
    const events = [];
    let writes = 0;
    const cloud = createRainMakerCloud({ refreshToken: 'PRIVATE_REFRESH', onError: event => events.push(event), fetcher: async url => {
      if (url.endsWith('/login2')) return Response.json({ accesstoken: token() });
      writes++;
      if (failure === 'http') return Response.json({ secret: 'PRIVATE_PROVIDER_BODY' }, { status: 403 });
      throw Object.assign(new Error('PRIVATE_TRANSPORT_DETAILS'), { name: failure === 'timeout' ? 'TimeoutError' : 'Error' });
    } });
    await assert.rejects(cloud.write('NODE1', { Pump: { Power: false } }), /RainMaker unavailable/);
    assert.equal(writes, 1);
    assert.deepEqual(events, [{ service: 'RainMaker', operation: 'write', ...(failure === 'http' ? { status: 403 } : { failure }) }]);
    assert.ok(!JSON.stringify(events).includes('PRIVATE'));
  }
});
