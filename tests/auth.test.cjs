const test = require('node:test');
const assert = require('node:assert/strict');
const auth = require('../dist/auth-preview.js');
const sample = { name: 'Sample User', email: 'sample@example.com', password: 'Sample only 123', confirmPassword: 'Sample only 123' };
function storage() {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key,value), removeItem: key => values.delete(key) };
}

test('signup validates name, email, password length and confirmation', () => {
  assert.deepEqual(auth.validateCredentials('signup', sample), {});
  assert.deepEqual(auth.validateCredentials('signup', { ...sample, email: ' sample@example.com ' }), {});
  assert.equal(Object.keys(auth.validateCredentials('signup', {})).length, 4);
  assert.ok(auth.validateCredentials('signup', { ...sample, name: ' ' }).name);
  assert.ok(auth.validateCredentials('signup', { ...sample, email: 'x@example.com\r\nBcc:y@example.com' }).email);
  assert.ok(auth.validateCredentials('signup', { ...sample, password: 'short' }).password);
  assert.ok(auth.validateCredentials('signup', { ...sample, password: 'x'.repeat(129) }).password);
  assert.ok(auth.validateCredentials('signup', { ...sample, confirmPassword: 'different' }).confirmPassword);
  assert.throws(() => auth.validateCredentials('other', sample), /Unsupported/);
});
test('login requires credentials without enforcing new-account password rules', () => {
  assert.deepEqual(auth.validateCredentials('login', { email: sample.email, password: 'short' }), {});
  assert.ok(auth.validateCredentials('login', { email: sample.email, password: '' }).password);
  assert.ok(auth.validateCredentials('login', { email: 'missing-domain', password: 'x' }).email);
});
test('preview stores only a time-limited marker and logout removes only that marker', () => {
  const store = storage();
  store.setItem('unrelated', 'keep');
  const start = 1000000;
  auth.beginPreview(store, start);
  const value = JSON.parse(store.getItem(auth.SESSION_KEY));
  assert.deepEqual(Object.keys(value).sort(), ['expiresAt','mode','version']);
  assert.equal(auth.readPreview(store, start + 1).mode, 'preview');
  assert.equal(auth.readPreview(store, start + auth.DURATION_MS), null);
  auth.beginPreview(store, start);
  auth.endPreview(store);
  assert.equal(store.getItem(auth.SESSION_KEY), null);
  assert.equal(store.getItem('unrelated'), 'keep');
});
test('invalid, expired, overly long or inaccessible preview markers fail closed', () => {
  const store = storage();
  for (const value of ['bad json','null','{}',JSON.stringify({mode:'real',version:1,expiresAt:1100}),JSON.stringify({mode:'preview',version:1,expiresAt:100000000})]) {
    store.setItem(auth.SESSION_KEY, value);
    assert.equal(auth.readPreview(store, 1000), null);
  }
  const unavailable = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(auth.readPreview(unavailable), null);
  assert.throws(() => auth.beginPreview(unavailable));
  assert.throws(() => auth.beginPreview({setItem(){},getItem(){return null;}}), /could not be saved/);
});
