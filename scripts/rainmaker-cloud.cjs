'use strict';
const BASE = 'https://api.rainmaker.espressif.com/v1/';
function createRainMakerCloud({ refreshToken, fetcher = fetch, now = Date.now, onError = () => {} }) {
  let token;
  let expires = 0;
  let refreshing;
  async function authenticate() {
    if (token && expires > now() + 60000) return token;
    if (!refreshing) refreshing = (async () => {
      const response = await fetcher(BASE + 'login2', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshtoken: refreshToken }), redirect: 'error', signal: AbortSignal.timeout(7000)
      });
      if (!response.ok) { onError({ service: 'RainMaker', operation: 'authenticate', status: response.status }); throw new Error('RainMaker authentication unavailable'); }
      const data = await response.json();
      if (typeof data.accesstoken !== 'string' || data.accesstoken.split('.').length !== 3) throw new Error('RainMaker authentication unavailable');
      const payload = JSON.parse(Buffer.from(data.accesstoken.split('.')[1], 'base64url').toString('utf8'));
      if (!Number.isFinite(payload.exp) || payload.exp * 1000 <= now()) throw new Error('RainMaker authentication unavailable');
      // The token came directly from the fixed, TLS-verified RainMaker endpoint.
      token = data.accesstoken; expires = payload.exp * 1000;
      return token;
    })().finally(() => { refreshing = undefined; });
    return refreshing;
  }
  async function request(path, options = {}) {
    const authorization = await authenticate();
    let response;
    try { response = await fetcher(BASE + path, {
      ...options, headers: { Authorization: authorization, 'Content-Type': 'application/json' },
      redirect: 'error', signal: AbortSignal.timeout(7000)
    });
    } catch (error) { onError({ service: 'RainMaker', operation: options.method === 'PUT' ? 'write' : 'read', failure: error?.name === 'TimeoutError' ? 'timeout' : 'transport' }); throw new Error('RainMaker unavailable'); }
    if (response.status === 401) { token = undefined; expires = 0; }
    if (!response.ok) { onError({ service: 'RainMaker', operation: options.method === 'PUT' ? 'write' : 'read', status: response.status }); throw new Error('RainMaker unavailable'); }
    return response.json();
  }
  return {
    async read() {
      const nodes = [], seen = new Set(); let cursor;
      for (let page = 0; page < 100; page++) {
        const query = new URLSearchParams({ node_details: 'true' });
        if (cursor) query.set('start_id', cursor);
        const result = await request('user/nodes?' + query);
        if (!Array.isArray(result.node_details)) throw new Error('Invalid cloud response');
        nodes.push(...result.node_details);
        if (!result.next_id) return { node_details: nodes };
        if (typeof result.next_id !== 'string' || seen.has(result.next_id)) throw new Error('Invalid pagination');
        cursor = result.next_id; seen.add(cursor);
      }
      throw new Error('Pagination limit exceeded');
    },
    async write(nodeId, payload) {
      const result = await request('user/nodes/params', { method: 'PUT', body: JSON.stringify([{ node_id: nodeId, payload }]) });
      const accepted = Array.isArray(result)
        ? result.length === 1 && result[0].node_id === nodeId && result[0].status === 'success'
        : result?.status === 'success';
      if (!accepted) { onError({ service: 'RainMaker', operation: 'write', failure: 'response-not-confirmed' }); throw new Error('Write not confirmed'); }
    }
  };
}
module.exports = { createRainMakerCloud };
