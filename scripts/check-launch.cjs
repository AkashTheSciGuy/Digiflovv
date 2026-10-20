const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { validEmail, safeMedia } = require('../dist/features.js');
const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist/config.js'), 'utf8'), context, { timeout: 1000 });
const config = context.window.DIGIFLOVV_CONFIG;
const missing = [];
if (!validEmail(config.supportEmail)) missing.push('Publish a real support email to enable the email enquiry link.');
if (!config.siteUrl) missing.push('Set the approved production domain before public SEO generation.');
if (!config.product?.images?.some(image => safeMedia(image.src) && image.alt)) missing.push('Add approved product photography; gallery is currently hidden.');
for (const key of ['dimensions','power','compatibility','contents']) {
  if (!config.product?.specifications?.[key]?.trim()) missing.push(`Confirm product specification: ${key}.`);
}
if (!config.policyUrls?.privacy) missing.push('Supply the approved privacy policy URL.');
if (missing.length) {
  console.log('Local showcase works. Public-release content is pending:\n' + missing.map(item => '- ' + item).join('\n'));
  process.exitCode = 1;
} else {
  console.log('Showcase configuration is filled in. Review content accuracy and public-host configuration before launch.');
}
console.log('Payments are intentionally out of scope and are not required by this check.');
