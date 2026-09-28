const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../scripts/serve.cjs');

test('serves website assets and rejects private files and unsupported requests', async () => {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const asset of ['/', '/styles.css', '/app.js', '/motion.js', '/assets/plant-room.webp']) {
      const result = await fetch(origin + asset);
      assert.equal(result.status, 200, asset);
      assert.equal(result.headers.get('x-content-type-options'), 'nosniff');
      assert.ok((await result.arrayBuffer()).byteLength > 0);
    }
    for (const asset of ['/.openai/hosting.json', '/package.json', '/%2e%2e%5cREADME.md', '/missing']) {
      assert.equal((await fetch(origin + asset)).status, 404, asset);
    }
    assert.equal((await fetch(origin + '/%ZZ')).status, 400);
    assert.equal((await fetch(origin, { method: 'POST' })).status, 405);
    const head = await fetch(origin, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
