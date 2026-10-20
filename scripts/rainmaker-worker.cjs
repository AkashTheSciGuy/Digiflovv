'use strict';
const { spawn } = require('node:child_process');

function createRainMakerWorker({ python, script, env, timeoutMs = 15000, prefixArgs = ['-u'] }) {
  let child;
  let buffer = '';
  let sequence = 0;
  let closed = false;
  const pending = new Map();
  function reset(process) {
    if (process !== child) return;
    child = undefined;
    buffer = '';
    process.kill();
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error('RainMaker unavailable')); }
    pending.clear();
  }
  function start() {
    const process = spawn(python, [...prefixArgs, script], { env, windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
    child = process;
    process.on('error', () => reset(process));
    process.on('exit', () => reset(process));
    process.stdin.on('error', () => reset(process));
    process.stdout.setEncoding('utf8');
    process.stdout.on('data', chunk => {
      if (process !== child) return;
      buffer += chunk;
      if (Buffer.byteLength(buffer) > 1024 * 1024) { reset(process); return; }
      let end;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
        let message;
        try { message = JSON.parse(line); }
        catch { reset(process); return; }
        if (!message || typeof message !== 'object' || !Number.isSafeInteger(message.id) || typeof message.ok !== 'boolean') { reset(process); return; }
        const entry = pending.get(message.id);
        if (!entry) { reset(process); return; }
        pending.delete(message.id); clearTimeout(entry.timer);
        if (message.ok === true) entry.resolve(message.data);
        else entry.reject(new Error('RainMaker unavailable'));
      }
    });
  }
  function request(op, data) {
    if (closed || pending.size >= 16) return Promise.reject(new Error('RainMaker unavailable'));
    if (!child) start();
    const process = child;
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reset(process), timeoutMs);
      pending.set(id, { resolve, reject, timer });
      // No retries: an interrupted write may already have reached the device.
      process.stdin.write(JSON.stringify({ id, op, data }) + '\n');
    });
  }
  return {
    read: () => request('read'),
    write: (nodeId, payload) => request('write', { nodeId, payload }),
    close: () => { closed = true; if (child) reset(child); }
  };
}
module.exports = { createRainMakerWorker };
