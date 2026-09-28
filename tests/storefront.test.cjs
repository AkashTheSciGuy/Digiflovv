const test = require('node:test');
const assert = require('node:assert/strict');
const { getCheckoutUrl, getSalesState } = require('../dist/app.js');

test('rejects missing, malformed, insecure and credential-bearing checkout addresses', () => {
  for (const value of [undefined, null, 42, '', '/checkout', 'javascript:alert(1)', 'http://example.com', 'data:text/html,hi', 'https://user:secret@example.com']) {
    assert.equal(getCheckoutUrl(value), null);
  }
});
test('allows secure checkout URLs with a payment reference', () => {
  assert.equal(getCheckoutUrl('https://example.com/pay?reference=abc'), 'https://example.com/pay?reference=abc');
});
test('orders fail closed unless pricing, disclosures, secure checkout and policies are configured', () => {
  const config = { ordersOpen: true, checkoutUrl: 'https://example.com/pay', displayPrice: 'Approved price', salesNote: 'Approved taxes and shipping disclosure', policyUrls: { privacy: 'https://example.com/privacy', terms: 'https://example.com/terms', returns: 'https://example.com/returns' } };
  assert.equal(getSalesState(config).ready, true);
  for (const key of Object.keys(config)) assert.equal(getSalesState({ ...config, [key]: undefined }).ready, false, key);
  assert.equal(getSalesState({ ...config, ordersOpen: 'true' }).ready, false);
  assert.equal(getSalesState({ ...config, displayPrice: ' ' }).ready, false);
  assert.equal(getSalesState({ ...config, policyUrls: { ...config.policyUrls, terms: 'javascript:alert(1)' } }).ready, false);
  assert.equal(getSalesState().ready, false);
});
test('URL validation remains bounded under repeated invalid input', () => {
  for (let i = 0; i < 10000; i++) assert.equal(getCheckoutUrl('javascript:alert(1)'), null);
});
