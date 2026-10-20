const test = require('node:test');
const assert = require('node:assert/strict');
const { validEmail, validateEnquiry, enquiryText, safeMedia, nextSchedule } = require('../dist/features.js');
test('enquiry rejects invalid and oversized inputs without interpreting markup', () => {
  const good = { name: 'Test User', email: 'test@example.com', subject: 'Product question', message: 'Can you explain the installation?' };
  assert.deepEqual(validateEnquiry(good), {});
  assert.equal(Object.keys(validateEnquiry({})).length, 4);
  assert.ok(validateEnquiry({ ...good, message: 'x'.repeat(2001) }).message);
  assert.equal(validEmail('test@example.com\r\nBcc:other@example.com'), false);
  assert.match(enquiryText({ ...good, message: '<script>test</script>' }), /<script>test<\/script>/);
});
test('media URLs reject executable protocols, credentials and relative traversal', () => {
  for (const input of ['javascript:alert(1)', 'data:image/svg+xml,x', '../secret', 'assets/../secret.webp', 'https://u:p@example.com/a.jpg', null]) assert.equal(safeMedia(input), null);
  assert.equal(safeMedia('assets/product-front.webp'), 'assets/product-front.webp');
});
test('next watering follows the calendar, supports pause and rolls to next week', () => {
  const monday = new Date(2026, 9, 19, 9, 0, 0);
  assert.equal(nextSchedule(['Mon'], '08:00', monday).getDate(), 26);
  assert.equal(nextSchedule(['Tue','Thu'], '08:00', monday).getDate(), 20);
  assert.equal(nextSchedule([], '08:00', monday), null);
  assert.equal(nextSchedule(['Tue'], '24:00', monday), null);
  assert.equal(nextSchedule(['Mon'], '10:00', monday).getDate(), 19);
});
