'use strict';
const { createCommands } = require('./device-commands.cjs');
const { sanitizeNode } = require('./device-state.cjs');
const { createDurableCommands } = require('./durable-commands.cjs');
const { createRainMakerCloud } = require('./rainmaker-cloud.cjs');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NODE = /^[a-zA-Z0-9_-]{1,128}$/;
function createHostedApi({ links, verifyUser, cloud, store, allowedOrigins, now = Date.now }) {
  const ownership = new Map();
  for (const [user, nodes] of Object.entries(links)) {
    if (!UUID.test(user) || !Array.isArray(nodes) || nodes.length > 100 || nodes.some(node => typeof node !== 'string' || !NODE.test(node))) throw new Error('Invalid ownership configuration');
    ownership.set(user, new Set(nodes));
  }
  let cache, cachedAt = 0, reading;
  const invalidate = () => { cache = undefined; cachedAt = 0; };
  const execute = createCommands({ readNodes: cloud.read, writeNode: cloud.write, invalidate, now });
  const commands = createDurableCommands({ store, now, execute: async (...args) => {
    const { reportedNode, ...result } = await execute(...args);
    if (reportedNode) result.device = sanitizeNode(reportedNode, new Date(now()).toISOString(), true);
    return result;
  } });
  return async function handler(request) {
    const url = new URL(request.url);
    const route = /^\/api\/devices\/([a-zA-Z0-9_-]{1,128})\/commands$/.exec(url.pathname);
    const send = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: {
      'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers
    } });
    if (!allowedOrigins.has(url.origin)) return send(403, { error: 'Request denied' });
    if (request.headers.get('origin') && request.headers.get('origin') !== url.origin) return send(403, { error: 'Request denied' });
    if (url.pathname === '/api/health' && request.method === 'GET') return send(200, { ok: true, service: 'digiflovv', mode: 'rainmaker' });
    if (!route && !['/api/devices', '/api/device-account'].includes(url.pathname)) return send(404, { error: 'Not found' });
    const method = route ? 'POST' : 'GET';
    if (request.method !== method) return send(405, { error: 'Method unavailable' }, { Allow: method });
    const authorization = request.headers.get('authorization');
    if (!authorization || !/^Bearer [A-Za-z0-9._~-]{20,8192}$/.test(authorization)) return send(401, { error: 'Sign in required' });
    let user;
    try { user = await verifyUser(authorization); }
    catch { return send(503, { error: 'Account verification unavailable' }); }
    if (!UUID.test(user?.id || '')) return send(401, { error: 'Sign in required' });
    const allowed = ownership.get(user.id);
    if (url.pathname === '/api/device-account') return send(200, { userId: user.id, linked: !!allowed?.size });
    if (route) {
      if (!allowed?.has(route[1])) return send(403, { error: 'Device access unavailable' });
      if (request.headers.get('content-type') !== 'application/json') return send(415, { error: 'JSON required' });
      if (Number(request.headers.get('content-length')) > 4096) return send(413, { error: 'Command too large' });
      let body;
      try {
        const reader = request.body?.getReader();
        if (!reader) return send(400, { error: 'Invalid command body' });
        const chunks = []; let size = 0;
        while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 4096) { await reader.cancel(); return send(413, { error: 'Command too large' }); } chunks.push(value); }
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch { return send(400, { error: 'Invalid command body' }); }
      try { const { status, ...result } = await commands(user.id, route[1], body); return send(status, result); }
      catch { return send(503, { error: 'Command delivery is unconfirmed. Check the reported state before retrying.' }); }
    }
    if (!allowed?.size) return send(200, { devices: [], readOnly: false });
    try {
      if (!cache || now() - cachedAt >= 3000 || url.searchParams.get('fresh') === '1') {
        if (!reading) reading = cloud.read().then(result => { cache = result; cachedAt = now(); return result; }).finally(() => { reading = undefined; });
        await reading;
      }
      if (!Array.isArray(cache?.node_details)) throw new Error('Invalid response');
      const seen = new Set();
      const devices = cache.node_details.filter(node => {
        if (!allowed.has(node.id) || seen.has(node.id)) return false; seen.add(node.id); return true;
      }).map(node => sanitizeNode(node, new Date(cachedAt).toISOString(), true));
      return send(200, { devices, readOnly: false });
    } catch { invalidate(); return send(503, { error: 'Device status unavailable' }); }
  };
}

function hostedApiFromEnvironment(env, store, linkStore = store) {
  for (const key of ['DIGIFLOVV_LINK_ENCRYPTION_KEY', 'DIGIFLOVV_SUPABASE_PUBLIC_KEY']) if (!env[key]) throw new Error('Hosted backend unavailable');
  const { createAccountLinks } = require('./account-links.cjs');
  const { createRainMakerLogin } = require('./rainmaker-login.cjs');
  const { createLinkedDeviceApi } = require('./linked-device-api.cjs');
  const cloudFactory = refreshToken => createRainMakerCloud({ refreshToken, onError: event => console.error(JSON.stringify(event)) });
  const accounts = createAccountLinks({ store: linkStore, encryptionKey: env.DIGIFLOVV_LINK_ENCRYPTION_KEY,
    seeds: JSON.parse(env.DIGIFLOVV_DEVICE_LINKS_JSON || '{}'), cloudFactory, login: createRainMakerLogin({ onError: event => console.error(JSON.stringify(event)) }),
    legacyCloud: env.DIGIFLOVV_RAINMAKER_REFRESH_TOKEN ? cloudFactory(env.DIGIFLOVV_RAINMAKER_REFRESH_TOKEN) : null });
  const allowedOrigins = new Set(['https://digiflovv.netlify.app']);
  for (const key of ['DEPLOY_URL', 'DEPLOY_PRIME_URL']) {
    if (env[key]) { const url = new URL(env[key]); if (url.protocol === 'https:' && /^[a-f0-9]{24}--digiflovv\.netlify\.app$/.test(url.hostname)) allowedOrigins.add(url.origin); }
  }
  return createLinkedDeviceApi({ accounts, store, allowedOrigins,
    verifyUser: async authorization => {
      const response = await fetch('https://xqfgikcepbgcppfudpcm.supabase.co/auth/v1/user', {
        headers: { Authorization: authorization, apikey: env.DIGIFLOVV_SUPABASE_PUBLIC_KEY }, redirect: 'error', signal: AbortSignal.timeout(7000)
      });
      if ([401, 403].includes(response.status)) return null;
      if (!response.ok) throw new Error('Account verification unavailable');
      return response.json();
    }
  });
}
module.exports = { createHostedApi, hostedApiFromEnvironment };

