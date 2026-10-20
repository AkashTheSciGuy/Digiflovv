'use strict';
const { createHostedApi } = require('./hosted-device-api.cjs');
const { LinkError } = require('./account-links.cjs');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const routes = new Map([
  ['/api/device-links', 'GET'], ['/api/device-links/connect', 'POST'], ['/api/device-links/disconnect', 'POST'],
  ['/api/rainmaker/login/start', 'POST'], ['/api/rainmaker/login/verify', 'POST'], ['/api/rainmaker/disconnect', 'POST']
]);
async function jsonBody(request, keys) {
  if (request.headers.get('content-type') !== 'application/json') throw new LinkError(415, 'JSON required');
  if (Number(request.headers.get('content-length')) > 4096) throw new LinkError(413, 'Request too large');
  const reader = request.body?.getReader();
  if (!reader) throw new LinkError(400, 'Invalid request');
  let bytes = 0; const chunks = [];
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    bytes += value.length;
    if (bytes > 4096) { await reader.cancel(); throw new LinkError(413, 'Request too large'); }
    chunks.push(value);
  }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new LinkError(400, 'Invalid request'); }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== keys.length || keys.some(key => !Object.hasOwn(body, key))) throw new LinkError(400, 'Invalid request');
  return body;
}
function createLinkedDeviceApi({ accounts, verifyUser, store, allowedOrigins }) {
  const apis = new Map();
  const send = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers
  } });
  return async request => {
    try {
      const url = new URL(request.url);
      if (!allowedOrigins.has(url.origin) || (request.headers.get('origin') && request.headers.get('origin') !== url.origin)) return send(403, { error: 'Request denied' });
      if (url.pathname === '/api/health' && request.method === 'GET') return send(200, { ok: true, service: 'digiflovv', mode: 'rainmaker' });
      const legacyRoute = /^\/api\/devices\/([a-zA-Z0-9_-]{1,128})\/commands$/.test(url.pathname) || ['/api/devices', '/api/device-account'].includes(url.pathname);
      if (!routes.has(url.pathname) && !legacyRoute) return send(404, { error: 'Not found' });
      const method = routes.get(url.pathname);
      if (method && request.method !== method) return send(405, { error: 'Method unavailable' }, { Allow: method });
      const authorization = request.headers.get('authorization');
      if (!authorization || !/^Bearer [A-Za-z0-9._~-]{20,8192}$/.test(authorization)) return send(401, { error: 'Sign in required' });
      let user;
      try { user = await verifyUser(authorization); }
      catch { return send(503, { error: 'Account verification unavailable' }); }
      if (!UUID.test(user?.id || '')) return send(401, { error: 'Sign in required' });
      const id = user.id;
      if (routes.has(url.pathname)) {
        if (url.pathname === '/api/device-links') return send(200, await accounts.status(id));
        if (url.pathname === '/api/device-links/connect' || url.pathname === '/api/device-links/disconnect') {
          const body = await jsonBody(request, ['id']);
          await accounts.changeDevice(id, body.id, url.pathname.endsWith('/connect'));
          apis.clear();
          return send(200, { message: url.pathname.endsWith('/connect') ? 'Device connected.' : 'Device disconnected from this website.' });
        }
        if (url.pathname === '/api/rainmaker/login/start') {
          const body = await jsonBody(request, ['email']); return send(200, await accounts.start(id, body.email));
        }
        if (url.pathname === '/api/rainmaker/login/verify') {
          const body = await jsonBody(request, ['code']); const result = await accounts.verify(id, body.code); apis.clear(); return send(200, result);
        }
        await jsonBody(request, []);
        const result = await accounts.disconnectAccount(id); apis.clear(); return send(200, result);
      }
      const { account } = await accounts.read(id);
      const key = id + ':' + account.version;
      if (!apis.has(key)) {
        const provider = accounts.cloud(id, account);
        const cloud = {
          read: () => provider ? provider.read() : Promise.resolve({ node_details: [] }),
          write: async (node, payload) => {
            await accounts.assertAccess(id, node, account.version);
            if (!provider) throw new Error('Device access unavailable');
            return provider.write(node, payload);
          }
        };
        if (apis.size >= 64) apis.delete(apis.keys().next().value);
        apis.set(key, createHostedApi({ links: { [id]: account.selected }, cloud, store, allowedOrigins, verifyUser: async () => ({ id }) }));
      }
      return await apis.get(key)(request);
    } catch (error) {
      return send(error instanceof LinkError ? error.status : 503, { error: error instanceof LinkError ? error.message : 'Device connection is unavailable. Please try later.' });
    }
  };
}
module.exports = { createLinkedDeviceApi };
