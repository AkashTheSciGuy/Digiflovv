'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createRainMakerWorker } = require('../scripts/rainmaker-worker.cjs');
async function withWorker(run, timeoutMs = 1500) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'digiflovv-worker-'));
  const script = path.join(directory, 'worker.cjs');
  await fs.writeFile(script, `
    const readline = require('node:readline');
    let calls = 0;
    readline.createInterface({input:process.stdin}).on('line', line => {
      const request = JSON.parse(line);
      calls++;
      if (request.data?.nodeId === 'EXIT') process.exit(1);
      if (request.data?.nodeId === 'HANG') return;
      if (request.data?.nodeId === 'BAD') { process.stdout.write('invalid\\n'); return; }
      if (request.data?.nodeId === 'NULL') { process.stdout.write('null\\n'); return; }
      if (request.data?.nodeId === 'BIG') { process.stdout.write('x'.repeat(1100000)); return; }
      console.log(JSON.stringify({id:request.id,ok:true,data:request.op==='read'?{calls,pid:process.pid}:{accepted:true}}));
    });
  `);
  const worker = createRainMakerWorker({ python: process.execPath, prefixArgs: [], script, env: process.env, timeoutMs });
  try { await run(worker); }
  finally { worker.close(); await fs.rm(directory, { recursive: true, force: true }); }
}
test('worker reuses one process and correlates concurrent requests', async () => {
  await withWorker(async worker => {
    const results = await Promise.all(Array.from({length: 4}, () => worker.read()));
    assert.deepEqual(results.map(value => value.calls), [1, 2, 3, 4]);
    assert.equal(new Set(results.map(value => value.pid)).size, 1);
    assert.deepEqual(await worker.write('NODE1', { Pump: { Power: false } }), { accepted: true });
  });
});
test('worker failure is not replayed and a later explicit read can recover', async () => {
  await withWorker(async worker => {
    const previous = await worker.read();
    await assert.rejects(worker.write('EXIT', {}), /unavailable/);
    const next = await worker.read();
    assert.equal(next.calls, 1);
    assert.notEqual(next.pid, previous.pid);
  });
});
test('worker timeout rejects an ambiguous write without retrying', async () => {
  await withWorker(async worker => {
    await assert.rejects(worker.write('HANG', {}), /unavailable/);
    assert.equal((await worker.read()).calls, 1);
  });
});
test('invalid or oversized worker output is rejected with generic errors', async () => {
  for (const behavior of ['BAD', 'NULL', 'BIG']) await withWorker(async worker => {
    await assert.rejects(worker.write(behavior, {}), /unavailable/);
  });
});
test('closing a worker prevents further requests', async () => {
  await withWorker(async worker => {
    await worker.read(); worker.close();
    await assert.rejects(worker.read(), /unavailable/);
  });
});
