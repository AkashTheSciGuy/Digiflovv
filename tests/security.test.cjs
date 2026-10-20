const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../scripts/serve.cjs');
test('security headers, private paths, health and concurrent static requests', async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const health = await fetch(origin + '/api/health');
    assert.equal((await health.json()).mode, 'showcase');
    const home = await fetch(origin);
    assert.equal(home.headers.get('x-frame-options'), 'DENY');
    assert.match(home.headers.get('content-security-policy'), /object-src 'none'/);
    for (const url of ['/assets/plant-room.webp:secret', '/%00', '/.env', '/server/db.js', '/%2e%2e%5cpackage.json']) {
      assert.equal((await fetch(origin + url)).status, 404, url);
    }
    const started = performance.now();
    const statuses = await Promise.all(Array.from({length:100}, () => fetch(origin + '/styles.css').then(async r => { await r.arrayBuffer(); return r.status; })));
    assert.ok(statuses.every(status => status === 200));
    console.log(`100 concurrent local requests: ${Math.round(performance.now()-started)} ms`);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
