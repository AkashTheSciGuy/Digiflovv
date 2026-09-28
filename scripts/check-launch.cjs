const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { getLaunchIssues } = require('../dist/app.js');
const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist/config.js'), 'utf8'), context, { timeout: 1000 });
const issues = getLaunchIssues(context.window.DIGIFLOVV_CONFIG);
if (issues.length) {
  console.log('Checkout setup is incomplete:\n' + issues.map(issue => '- ' + issue).join('\n'));
  process.exitCode = 1;
} else {
  console.log('Checkout configuration is complete. Verify provider ownership, final totals, policies and payment outcomes in the provider sandbox before opening sales.');
}
