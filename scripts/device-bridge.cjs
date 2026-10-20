'use strict';
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs');
const path = require('node:path');
const execute = promisify(execFile);
const AUTH_URL = 'https://xqfgikcepbgcppfudpcm.supabase.co/auth/v1/user';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeNode(node, observedAt) {
  const online = node.status?.connectivity?.connected === true;
  const params = node.params || {};
  const power = name => online && typeof params[name]?.Power === 'boolean' ? params[name].Power : null;
  const integer = name => online && Number.isSafeInteger(params.Settings?.[name]) ? params.Settings[name] : null;
  return {
    id: node.id, name: String(node.config?.info?.name || 'Plant watering').slice(0, 120),
    online, observedAt, source: 'rainmaker-reported', writable: false,
    power: { pump: power('Pump'), schedule: power('Schedule'), interval: power('Interval') },
    settings: { duration: integer('Duration'), hour: integer('Hour'), minute: integer('Minute'), intervalMinutes: integer('IntervalMinutes') }
  };
}

function createDeviceBridge({ verifyUser, readNodes, links = {} }) {
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
  async function snapshot() {
    if (cached && Date.now() - cachedAt < 5000) return cached;
    if (!inFlight) inFlight = Promise.resolve().then(readNodes).then(result => {
      if (!Array.isArray(result?.node_details)) throw new Error('Invalid cloud response');
      cachedAt = Date.now();
      cached = { nodes: result.node_details, observedAt: new Date(cachedAt).toISOString() };
      return cached;
    }).finally(() => { inFlight = undefined; });
    return inFlight;
  }
  return async function handle(request, response) {
    const pathname = request.url.split('?')[0];
    const setupFiles = { '/integration-account.html': ['device-account.html', 'text/html; charset=utf-8'], '/integration-account.js': ['device-account.js', 'text/javascript; charset=utf-8'] };
    if (!['/api/devices', '/api/device-account'].includes(pathname) && !Object.hasOwn(setupFiles, pathname)) return false;
    function send(status, body) {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(JSON.stringify(body));
      return true;
    }
    if (request.method !== 'GET') { response.setHeader('Allow', 'GET'); return send(405, { error: 'Read-only integration' }); }
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
    if (!allowed?.size) return send(200, { devices: [], readOnly: true });
    try {
      const result = await snapshot();
      const seen = new Set();
      const devices = result.nodes.filter(node => {
        if (!allowed.has(node.id) || seen.has(node.id)) return false;
        seen.add(node.id);
        return true;
      }).map(node => sanitizeNode(node, result.observedAt));
      return send(200, { devices, readOnly: true });
    } catch { return send(503, { error: 'Device status unavailable' }); }
  };
}

function bridgeFromEnvironment(env = process.env) {
  if (!env.DIGIFLOVV_DEVICE_LINKS) return null;
  for (const key of ['DIGIFLOVV_RAINMAKER_PYTHON', 'RM_USER_CONFIG_DIR', 'DIGIFLOVV_SUPABASE_PUBLIC_KEY']) {
    if (!env[key]) throw new Error('Device bridge configuration incomplete');
  }
  const links = JSON.parse(fs.readFileSync(env.DIGIFLOVV_DEVICE_LINKS, 'utf8'));
  return createDeviceBridge({ links,
    verifyUser: async authorization => {
      const response = await fetch(AUTH_URL, { headers: { Authorization: authorization, apikey: env.DIGIFLOVV_SUPABASE_PUBLIC_KEY }, signal: AbortSignal.timeout(8000), redirect: 'error' });
      if ([401, 403].includes(response.status)) return null;
      if (!response.ok) throw new Error('Auth unavailable');
      return response.json();
    },
    readNodes: async () => {
      const { stdout } = await execute(env.DIGIFLOVV_RAINMAKER_PYTHON, [path.join(__dirname, 'rainmaker-read.py')], {
        timeout: 15000, maxBuffer: 1024 * 1024, windowsHide: true,
        env: { ...process.env, RM_USER_CONFIG_DIR: env.RM_USER_CONFIG_DIR, PYTHONIOENCODING: 'utf-8' }
      });
      return JSON.parse(stdout);
    }
  });
}
module.exports = { createDeviceBridge, bridgeFromEnvironment, sanitizeNode };
