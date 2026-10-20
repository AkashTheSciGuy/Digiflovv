'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createRainMakerWorker } = require('./rainmaker-worker.cjs');
const { createCommands } = require('./device-commands.cjs');
const { sanitizeNode } = require('./device-state.cjs');
const AUTH_URL = 'https://xqfgikcepbgcppfudpcm.supabase.co/auth/v1/user';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function createDeviceBridge({ verifyUser, readNodes, writeNode, links = {} }) {
  // Copy and validate the explicit operator-managed ownership mapping at startup.
  const ownership = new Map();
  for (const [userId, nodeIds] of Object.entries(links)) {
    if (!uuid.test(userId) || !Array.isArray(nodeIds) || nodeIds.length > 100 ||
        nodeIds.some(id => typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(id))) {
      throw new Error('Invalid device ownership configuration');
    }
    ownership.set(userId, new Set(nodeIds));
  }
  let inFlight;
  let cached;
  let cachedAt = 0;
  let cacheEpoch = 0;
  const invalidate = () => { cacheEpoch++; cached = undefined; cachedAt = 0; };
  const commands = writeNode ? createCommands({ readNodes, writeNode, invalidate }) : null;
  async function snapshot(fresh = false) {
    if (!fresh && cached && Date.now() - cachedAt < 5000) return cached;
    const epoch = cacheEpoch;
    if (!inFlight) inFlight = Promise.resolve().then(readNodes).then(result => {
      if (!Array.isArray(result?.node_details)) throw new Error('Invalid cloud response');
      const snapshot = { nodes: result.node_details, observedAt: new Date().toISOString() };
      if (epoch === cacheEpoch) { cachedAt = Date.now(); cached = snapshot; }
      return snapshot;
    }).finally(() => { inFlight = undefined; });
    return inFlight;
  }
  return async function handle(request, response) {
    const pathname = request.url.split('?')[0];
    const commandRoute = /^\/api\/devices\/([a-zA-Z0-9_-]{1,128})\/commands$/.exec(pathname);
    const setupFiles = { '/integration-account.html': ['device-account.html', 'text/html; charset=utf-8'], '/integration-account.js': ['device-account.js', 'text/javascript; charset=utf-8'] };
    if (!commandRoute && !['/api/devices', '/api/device-account'].includes(pathname) && !Object.hasOwn(setupFiles, pathname)) return false;
    function send(status, body) {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(JSON.stringify(body));
      return true;
    }
    const method = commandRoute ? 'POST' : 'GET';
    if (request.method !== method) { response.setHeader('Allow', method); return send(405, { error: 'Method unavailable' }); }
    if (!/^(127\.0\.0\.1|localhost):[0-9]{1,5}$/.test(request.headers.host || '')) return send(403, { error: 'Request denied' });
    // Same-origin requests only. No CORS permissions or cookie authentication.
    const origin = request.headers.origin;
    if (origin && origin !== `http://${request.headers.host}`) return send(403, { error: 'Request denied' });
    if (Object.hasOwn(setupFiles, pathname)) {
      try {
        const [file, type] = setupFiles[pathname];
        const content = fs.readFileSync(path.join(__dirname, file));
        response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        response.end(content);
        return true;
      } catch { return send(503, { error: 'Setup page unavailable' }); }
    }
    const authorization = request.headers.authorization;
    if (typeof authorization !== 'string' || !/^Bearer [A-Za-z0-9._~-]{20,8192}$/.test(authorization)) return send(401, { error: 'Sign in required' });
    let user;
    try { user = await verifyUser(authorization); }
    catch { return send(503, { error: 'Account verification unavailable' }); }
    if (!user || !uuid.test(user.id || '')) return send(401, { error: 'Sign in required' });
    if (pathname === '/api/device-account') return send(200, { userId: user.id, linked: ownership.has(user.id) });
    const allowed = ownership.get(user.id);
    if (commandRoute) {
      if (!allowed?.has(commandRoute[1])) return send(403, { error: 'Device access unavailable' });
      if (!commands) return send(405, { error: 'Commands are disabled' });
      if (request.headers['content-type'] !== 'application/json') return send(415, { error: 'JSON required' });
      let body;
      try {
        const chunks = [];
        let length = 0;
        request.setTimeout(5000, () => request.destroy());
        for await (const chunk of request) {
          length += chunk.length;
          if (length > 4096) return send(413, { error: 'Command too large' });
          chunks.push(chunk);
        }
        request.setTimeout(0);
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch { return send(400, { error: 'Invalid command body' }); }
      const result = await commands(user.id, commandRoute[1], body);
      const { status, reportedNode, ...data } = result;
      if (reportedNode) data.device = sanitizeNode(reportedNode, new Date().toISOString(), true);
      return send(status, data);
    }
    if (!allowed?.size) return send(200, { devices: [], readOnly: !commands });
    try {
      const result = await snapshot(new URL(request.url, 'http://localhost').searchParams.get('fresh') === '1');
      const seen = new Set();
      const devices = result.nodes.filter(node => {
        if (!allowed.has(node.id) || seen.has(node.id)) return false;
        seen.add(node.id);
        return true;
      }).map(node => sanitizeNode(node, result.observedAt, !!commands));
      return send(200, { devices, readOnly: !commands });
    } catch { return send(503, { error: 'Device status unavailable' }); }
  };
}

function bridgeFromEnvironment(env = process.env) {
  if (!env.DIGIFLOVV_DEVICE_LINKS) return null;
  for (const key of ['DIGIFLOVV_RAINMAKER_PYTHON', 'RM_USER_CONFIG_DIR', 'DIGIFLOVV_SUPABASE_PUBLIC_KEY']) {
    if (!env[key]) throw new Error('Device bridge configuration incomplete');
  }
  const links = JSON.parse(fs.readFileSync(env.DIGIFLOVV_DEVICE_LINKS, 'utf8'));
  const worker = createRainMakerWorker({ python: env.DIGIFLOVV_RAINMAKER_PYTHON, script: path.join(__dirname, 'rainmaker-worker.py'),
    env: { ...process.env, RM_USER_CONFIG_DIR: env.RM_USER_CONFIG_DIR, PYTHONIOENCODING: 'utf-8' } });
  const bridge = createDeviceBridge({ links,
    verifyUser: async authorization => {
      const response = await fetch(AUTH_URL, { headers: { Authorization: authorization, apikey: env.DIGIFLOVV_SUPABASE_PUBLIC_KEY }, signal: AbortSignal.timeout(8000), redirect: 'error' });
      if ([401, 403].includes(response.status)) return null;
      if (!response.ok) throw new Error('Auth unavailable');
      return response.json();
    },
    readNodes: worker.read,
    writeNode: env.DIGIFLOVV_DEVICE_WRITES === '1' ? async (nodeId, payload) => {
      const result = await worker.write(nodeId, payload);
      if (result.accepted !== true) throw new Error('Write unconfirmed');
    } : undefined
  });
  bridge.close = worker.close;
  return bridge;
}
module.exports = { createDeviceBridge, bridgeFromEnvironment, sanitizeNode };
