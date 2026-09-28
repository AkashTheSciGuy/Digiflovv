const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { getLaunchIssues, getSalesState } = require('../dist/app.js');

const ready = {
  ordersOpen: true, checkoutUrl: 'https://example.com/pay', displayPrice: 'Test price', salesNote: 'Test sales disclosure',
  policyUrls: { privacy: 'https://example.com/privacy', terms: 'https://example.com/terms', returns: 'https://example.com/returns' }
};
test('launch diagnostics match the storefront gate, including malformed configuration', () => {
  for (const config of [null, undefined, {}, ready, { ...ready, ordersOpen: false }]) {
    assert.equal(getLaunchIssues(config).length === 0, getSalesState(config).ready);
  }
  assert.equal(getLaunchIssues({}).length, 7);
});

// Exercise the browser wiring without a live payment provider or navigation.
function mount(config) {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      textContent: '', open: false, handlers: {},
      addEventListener(name, handler) { this.handlers[name] = handler; },
      showModal() { this.open = true; }
    });
    return elements.get(id);
  }
  const purchase = [element('purchase-button'), element('mobile-button')];
  const policies = ['privacy', 'terms', 'returns'].map(key => Object.assign(element(key), { dataset: { checkoutPolicy: key } }));
  const document = {
    getElementById: element,
    querySelectorAll: selector => selector === '[data-purchase]' ? purchase : selector === '[data-checkout-policy]' ? policies : []
  };
  const window = { DIGIFLOVV_CONFIG: config };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../dist/app.js'), 'utf8'), { window, document, URL });
  return { element, purchase, policies };
}
test('desktop and mobile purchases open review with exact configured destination and disclosures', () => {
  const { element, purchase, policies } = mount(ready);
  for (const button of purchase) {
    element('checkout-dialog').open = false;
    button.handlers.click();
    assert.equal(element('checkout-dialog').open, true);
    assert.equal(element('notice-dialog').open, false);
  }
  assert.equal(element('continue-checkout').href, ready.checkoutUrl);
  assert.equal(element('review-price').textContent, ready.displayPrice);
  assert.equal(element('review-sales-note').textContent, ready.salesNote);
  assert.equal(element('payment-destination').textContent, 'example.com');
  assert.equal(element('mobile-price').textContent, ready.displayPrice);
  for (const link of policies) assert.equal(link.href, ready.policyUrls[link.dataset.checkoutPolicy]);
});
test('incomplete setup cannot open checkout or create a payment link', () => {
  const { element, purchase } = mount({ ...ready, policyUrls: {} });
  purchase[0].handlers.click();
  assert.equal(element('notice-dialog').open, true);
  assert.equal(element('checkout-dialog').open, false);
  assert.equal(element('continue-checkout').href, undefined);
});
