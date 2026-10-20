'use strict';
const { createHash } = require('node:crypto');
const validId = /^[a-zA-Z0-9_-]{1,128}$/;
const limits = { Duration: [1, 71582], Hour: [0, 23], Minute: [0, 59], IntervalMinutes: [1, 71582] };
function revision(node) {
  const values = ['Pump', 'Schedule', 'Interval', 'Moisture Control'].map(name => node.params?.[name]?.Power ?? null);
  values.push(...Object.keys(limits).map(name => node.params?.Settings?.[name] ?? null));
  return createHash('sha256').update(JSON.stringify([node.status?.connectivity?.connected === true, values])).digest('hex');
}
function validateCommand(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => !['requestId', 'expectedRevision', 'expiresAt', 'target', 'values'].includes(key)) ||
      typeof body.requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(body.requestId) ||
      typeof body.expectedRevision !== 'string' || !/^[a-f0-9]{64}$/.test(body.expectedRevision) || !Number.isSafeInteger(body.expiresAt) ||
      !body.values || typeof body.values !== 'object' || Array.isArray(body.values)) return null;
  const entries = Object.entries(body.values);
  if (body.target === 'Settings') {
    if (!entries.length || entries.some(([key, value]) => !Object.hasOwn(limits, key) || !Number.isInteger(value) || value < limits[key][0] || value > limits[key][1])) return null;
  } else if (['Pump', 'Schedule', 'Interval', 'Moisture Control'].includes(body.target)) {
    if (entries.length !== 1 || entries[0][0] !== 'Power' || typeof entries[0][1] !== 'boolean') return null;
  } else return null;
  return { ...body, values: Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b))) };
}
function createCommands({ readNodes, writeNode, invalidate, now = Date.now }) {
  const active = new Set();
  const requests = new Map();
  return async function command(userId, nodeId, input) {
    const body = validateCommand(input);
    if (!validId.test(nodeId) || !body) return { status: 400, error: 'Invalid device command' };
    const key = `${userId}:${body.requestId}`;
    const signature = JSON.stringify([nodeId, body.target, body.values, body.expectedRevision, body.expiresAt]);
    for (const [id, record] of requests) if (record.expires <= now()) requests.delete(id);
    if (requests.has(key)) {
      const previous = requests.get(key);
      return previous.signature === signature ? previous.result : { status: 409, error: 'Request ID already used' };
    }
    if (body.expiresAt <= now() || body.expiresAt > now() + 30000) return { status: 400, error: 'Command expired. Refresh and retry.' };
    if (active.has(nodeId)) return { status: 409, error: 'Another command is in progress. Refresh and retry.' };
    if (requests.size >= 512) return { status: 429, error: 'Too many commands. Try again shortly.' };
    active.add(nodeId);
    const result = (async () => {
      try {
        const snapshot = await readNodes();
        const node = snapshot?.node_details?.find(item => item.id === nodeId);
        if (!node) return { status: 403, error: 'Device access unavailable' };
        if (node.status?.connectivity?.connected !== true) return { status: 409, error: 'Device is offline' };
        const stop = body.target === 'Pump' && body.values.Power === false;
        if (!stop && body.expectedRevision !== revision(node)) return { status: 409, error: 'Device state changed. Review the latest state and retry.' };
        if (body.expiresAt <= now()) return { status: 400, error: 'Command expired. Refresh and retry.' };
        const params = node.params || {};
        const unsafeMode = name => node.config?.devices?.some(device => device.name === name) && params[name]?.Power !== false;
        if (body.target === 'Settings' && ['Pump', 'Schedule', 'Interval', 'Moisture Control'].some(unsafeMode)) {
          return { status: 409, error: 'Turn off the pump and automation modes before changing settings.' };
        }
        if (['Schedule', 'Interval', 'Moisture Control'].includes(body.target) && body.values.Power &&
            ['Schedule', 'Interval', 'Moisture Control'].some(name => name !== body.target && unsafeMode(name))) {
          return { status: 409, error: 'Turn off the other automation mode first.' };
        }
        const config = node.config?.devices?.find(device => device.name === body.target);
        if (!config || Object.keys(body.values).some(name => !config.params?.some(param => param.name === name && param.properties?.includes('write')))) {
          return { status: 400, error: 'Device does not support this command' };
        }
        const payload = Object.fromEntries(Object.entries(body.values).filter(([name, value]) => params[body.target]?.[name] !== value));
        if (!Object.keys(payload).length) return { status: 200, state: 'already_reported', requestId: body.requestId, reportedNode: node };
        try {
          await writeNode(nodeId, { [body.target]: payload });
          invalidate();
          const reported = await readNodes();
          const current = reported?.node_details?.find(item => item.id === nodeId);
          const matched = current?.status?.connectivity?.connected === true &&
            Object.entries(body.values).every(([name, value]) => current.params?.[body.target]?.[name] === value);
          return { status: 200, state: matched ? 'reported' : 'sent', requestId: body.requestId, reportedNode: current };
        } catch {
          // Never automatically retry: failure can happen after cloud acceptance.
          return { status: 200, state: 'unconfirmed', requestId: body.requestId };
        }
      } catch { return { status: 503, error: 'Device status unavailable. No command was sent.' }; }
      finally { invalidate(); active.delete(nodeId); }
    })();
    requests.set(key, { signature, result, expires: now() + 120000 });
    return result;
  };
}
module.exports = { createCommands, revision, validateCommand };
