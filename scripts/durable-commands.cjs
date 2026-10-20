'use strict';
const { createHash, randomUUID } = require('node:crypto');
const { validateCommand } = require('./device-commands.cjs');
const hash = value => createHash('sha256').update(value).digest('hex');
function createDurableCommands({ store, execute, now = Date.now }) {
  return async (userId, nodeId, input) => {
    const body = validateCommand(input);
    if (!body) return { status: 400, error: 'Invalid device command' };
    const key = 'node-' + hash(nodeId);
    const requestKey = hash(userId + ':' + body.requestId);
    const fingerprint = hash(JSON.stringify([nodeId, body.target, body.values, body.expectedRevision, body.expiresAt]));
    const holder = randomUUID();
    let claimed;
    for (let attempt = 0; attempt < 3; attempt++) {
      const previous = await store.getWithMetadata(key, { type: 'json', consistency: 'strong' });
      const document = previous?.data || { leaseUntil: 0, holder: null, requests: {} };
      const existing = document.requests[requestKey];
      if (existing && existing.retainUntil > now()) {
        if (existing.fingerprint !== fingerprint) return { status: 409, error: 'Request ID already used' };
        return existing.result || { status: 409, error: 'Command is in progress or unconfirmed. Check the reported state.' };
      }
      if (body.expiresAt <= now() || body.expiresAt > now() + 30000) return { status: 400, error: 'Command expired. Refresh and retry.' };
      if (document.leaseUntil > now()) return { status: 409, error: 'Another command is in progress. Refresh and retry.' };
      document.requests = Object.fromEntries(Object.entries(document.requests).filter(([, value]) => value.retainUntil > now()));
      if (Object.keys(document.requests).length >= 128) return { status: 429, error: 'Too many commands. Try again shortly.' };
      document.requests[requestKey] = { fingerprint, retainUntil: now() + 120000, result: null };
      document.holder = holder;
      document.leaseUntil = now() + 90000;
      const result = await store.setJSON(key, document, previous ? { onlyIfMatch: previous.etag } : { onlyIfNew: true });
      if (result.modified) { claimed = true; break; }
    }
    if (!claimed) return { status: 409, error: 'Another command is in progress. Refresh and retry.' };
    let result;
    try { result = await execute(userId, nodeId, body); }
    catch { result = { status: 503, error: 'Command delivery is unconfirmed. Check the reported state before retrying.' }; }
    const current = await store.getWithMetadata(key, { type: 'json', consistency: 'strong' });
    if (!current || current.data.holder !== holder) return { status: 503, error: 'Command delivery is unconfirmed. Check the reported state.' };
    current.data.requests[requestKey].result = result;
    current.data.holder = null; current.data.leaseUntil = 0;
    const saved = await store.setJSON(key, current.data, { onlyIfMatch: current.etag });
    if (!saved.modified) return { status: 503, error: 'Command delivery is unconfirmed. Check the reported state.' };
    return result;
  };
}
module.exports = { createDurableCommands };
