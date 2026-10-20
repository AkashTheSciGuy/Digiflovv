'use strict';
const { createHash, randomBytes, randomUUID, createCipheriv, createDecipheriv } = require('node:crypto');
const NODE = /^[a-zA-Z0-9_-]{1,128}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hash = text => createHash('sha256').update(text).digest('hex');
class LinkError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function createAccountLinks({ store, encryptionKey, seeds, legacyCloud, cloudFactory, login, now = Date.now }) {
  const key = Buffer.from(encryptionKey || '', 'base64');
  if (key.length !== 32) throw new Error('Link encryption unavailable');
  for (const [user, ids] of Object.entries(seeds)) {
    if (!UUID.test(user) || !Array.isArray(ids) || ids.length > 100 || ids.some(id => typeof id !== 'string' || !NODE.test(id))) throw new Error('Invalid ownership configuration');
  }
  const clients = new Map();
  const seal = (user, value) => {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(user));
    const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
  };
  const open = (user, box) => {
    if (!box || typeof box.data !== 'string' || box.data.length > 30000) throw new Error('Invalid private record');
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(box.iv, 'base64'));
    decipher.setAAD(Buffer.from(user)); decipher.setAuthTag(Buffer.from(box.tag, 'base64'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(box.data, 'base64')), decipher.final()]).toString('utf8'));
  };
  const accountKey = user => 'account-' + hash(user);
  async function load(key) { return store.getWithMetadata(key, { type: 'json', consistency: 'strong' }); }
  async function save(key, data, previous) {
    const result = await store.setJSON(key, data, previous ? { onlyIfMatch: previous.etag } : { onlyIfNew: true });
    if (!result.modified) throw new LinkError(409, 'Connection changed. Refresh and try again.');
  }
  async function read(user) {
    if (!UUID.test(user)) throw new Error('Invalid user');
    const stored = await load(accountKey(user));
    const account = stored?.data || { schema: 1, kind: seeds[user]?.length ? 'legacy' : 'none', version: 'seed-' + hash(JSON.stringify(seeds[user] || [])), selected: [...(seeds[user] || [])] };
    if (account.schema !== 1 || !['legacy', 'personal', 'none'].includes(account.kind) || typeof account.version !== 'string' ||
        !Array.isArray(account.selected) || account.selected.length > 100 || account.selected.some(id => typeof id !== 'string' || !NODE.test(id))) throw new Error('Invalid private record');
    if (account.kind === 'legacy' && account.selected.some(id => !seeds[user]?.includes(id))) throw new Error('Invalid private record');
    if (account.kind === 'none' && account.selected.length) throw new Error('Invalid private record');
    return { account, stored };
  }
  function cloud(user, account) {
    if (account.kind === 'legacy') {
      if (!legacyCloud) throw new Error('Legacy connection unavailable');
      return legacyCloud;
    }
    if (account.kind !== 'personal') return null;
    const cacheKey = user + ':' + account.version;
    if (!clients.has(cacheKey)) {
      if (clients.size >= 64) clients.delete(clients.keys().next().value);
      clients.set(cacheKey, cloudFactory(open(user, account.credentials).refreshToken));
    }
    return clients.get(cacheKey);
  }
  async function nodes(user, account) {
    const provider = cloud(user, account);
    if (!provider) return [];
    const result = await provider.read();
    if (!Array.isArray(result.node_details)) throw new Error('Device discovery unavailable');
    const seen = new Set();
    return result.node_details.filter(node => {
      if (!NODE.test(node.id || '') || seen.has(node.id) || !node.config?.devices?.some(device => device.name === 'Pump')) return false;
      if (account.kind === 'legacy' && !seeds[user]?.includes(node.id)) return false;
      seen.add(node.id); return true;
    }).slice(0, 100);
  }
  async function status(user) {
    const { account } = await read(user);
    const available = await nodes(user, account);
    const email = account.kind === 'personal' ? open(user, account.credentials).email : null;
    return { connected: account.kind !== 'none', email: email ? email.replace(/^(.).*(@.*)$/, '$1…$2') : null,
      devices: available.map(node => ({ id: node.id, name: String(node.config?.info?.name || 'Plant watering').slice(0, 120), connected: account.selected.includes(node.id) })) };
  }
  async function changeDevice(user, id, connect) {
    if (typeof id !== 'string' || !NODE.test(id)) throw new LinkError(400, 'Choose a valid device.');
    const { account, stored } = await read(user);
    if (connect && !(await nodes(user, account)).some(node => node.id === id)) throw new LinkError(403, 'This RainMaker account cannot access that device.');
    if (connect && account.selected.includes(id)) return;
    if (!connect && !account.selected.includes(id)) return;
    const selected = new Set(account.selected);
    if (connect) selected.add(id); else selected.delete(id);
    if (selected.size > 100) throw new LinkError(400, 'Device limit reached.');
    await save(accountKey(user), { ...account, selected: [...selected], version: randomUUID() }, stored);
  }
  async function rate(key) {
    const previous = await load(key);
    const data = previous?.data || {};
    const fresh = !data.windowStart || now() - data.windowStart >= 3600000;
    if (data.nextSend > now() || (!fresh && data.sends >= 5)) throw new LinkError(429, 'Please wait before requesting another code.');
    await save(key, { windowStart: fresh ? now() : data.windowStart, sends: fresh ? 1 : data.sends + 1, nextSend: now() + 60000 }, previous);
  }
  async function start(user, inputEmail) {
    const email = typeof inputEmail === 'string' ? inputEmail.trim().toLowerCase() : '';
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new LinkError(400, 'Enter your RainMaker account email.');
    await rate('login-user-' + hash(user)); await rate('login-email-' + hash(email));
    const { account } = await read(user), authKey = 'login-' + hash(user), previous = await load(authKey);
    const attempt = { id: randomUUID(), accountVersion: account.version, expires: now() + 600000, tries: 0, state: 'sending' };
    await save(authKey, attempt, previous);
    let session;
    try { session = await login.start(email); }
    catch { throw new LinkError(503, 'RainMaker rejected code-based sign-in. Google sign-in accounts need a supported RainMaker sign-in integration; retrying this form will not resolve that. Your existing device connection is unchanged.'); }
    const current = await load(authKey);
    if (current?.data.id !== attempt.id || current.data.state !== 'sending') throw new LinkError(409, 'Sign-in changed. Request a new code.');
    await save(authKey, { ...attempt, state: 'ready', private: seal(user, { email, session }) }, current);
    return { message: 'Check your email for the RainMaker sign-in code.' };
  }
  async function verify(user, code) {
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw new LinkError(400, 'Enter the six-digit code.');
    const authKey = 'login-' + hash(user), previous = await load(authKey), attempt = previous?.data;
    if (!attempt || attempt.expires <= now() || attempt.tries >= 5 || attempt.state !== 'ready') throw new LinkError(409, 'Request a new sign-in code.');
    const { account, stored } = await read(user);
    if (account.version !== attempt.accountVersion) throw new LinkError(409, 'Your connection changed. Request a new code.');
    await save(authKey, { ...attempt, tries: attempt.tries + 1, state: 'verifying' }, previous);
    const secret = open(user, attempt.private);
    let refreshToken;
    try { refreshToken = await login.verify(secret.email, secret.session, code); }
    catch {
      const current = await load(authKey);
      if (current?.data.id === attempt.id && current.data.state === 'verifying') await save(authKey, { ...current.data, state: 'ready' }, current);
      throw new LinkError(400, 'The code could not be verified. Check it or request a new code.');
    }
    const candidate = { schema: 1, kind: 'personal', version: randomUUID(), selected: [], credentials: seal(user, { refreshToken, email: secret.email }) };
    try {
      const available = await nodes(user, candidate);
      if (account.selected.some(id => !available.some(node => node.id === id))) throw new LinkError(409, 'This RainMaker account does not contain your connected devices. Your current connection is unchanged.');
      candidate.selected = [...account.selected];
      await save(accountKey(user), candidate, stored);
    } catch (error) {
      clients.delete(user + ':' + candidate.version);
      try { await login.revoke(refreshToken); } catch { /* Local access was never granted. */ }
      throw error instanceof LinkError ? error : new LinkError(503, 'RainMaker device discovery is unavailable. Your current connection is unchanged.');
    }
    const current = await load(authKey);
    if (current?.data.id === attempt.id) {
      try { await save(authKey, { id: attempt.id, state: 'used', expires: now() }, current); }
      catch { /* The changed account version independently blocks code replay. */ }
    }
    return { message: 'RainMaker verified. Choose the devices to connect.' };
  }
  async function disconnectAccount(user) {
    const { account, stored } = await read(user);
    // Persist revocation first. A provider outage must not keep dashboard access alive.
    await save(accountKey(user), { schema: 1, kind: 'none', version: randomUUID(), selected: [] }, stored);
    clients.clear();
    if (account.kind === 'personal') {
      try { await login.revoke(open(user, account.credentials).refreshToken); }
      catch { return { message: 'Website access removed. RainMaker session revocation could not be confirmed.' }; }
    }
    return { message: 'RainMaker disconnected from this website.' };
  }
  async function assertAccess(user, id, version) {
    const { account } = await read(user);
    if (account.version !== version || !account.selected.includes(id)) throw new LinkError(403, 'Device access was disconnected.');
  }
  return { read, cloud, nodes, status, start, verify, changeDevice, disconnectAccount, assertAccess };
}
module.exports = { createAccountLinks, LinkError };
