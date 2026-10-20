const test = require('node:test');
const assert = require('node:assert/strict');
const auth = require('../dist/auth-validation.js');
const sample = { name: 'Sample User', email: 'sample@example.com', password: 'Sample only 123', confirmPassword: 'Sample only 123' };
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
