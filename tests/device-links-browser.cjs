'use strict';
const assert = require('node:assert/strict');
const { chromium, firefox, webkit } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const { createServer } = require('../scripts/serve.cjs');
const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'sample@example.com', app_metadata: {}, user_metadata: {} };
const token = 'header.' + Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.fake';
const session = { access_token: token, refresh_token: 'fake', token_type: 'bearer', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, user };
const device = { id: 'NODE1', name: 'Plant Watering', online: true, writable: true, revision: 'a'.repeat(64), observedAt: new Date().toISOString(), commandExpiresAt: Date.now() + 30000, capabilities: { moisture: true }, power: { pump: false, interval: false, schedule: false, moisture: false }, settings: { duration: 1, intervalMinutes: 1, hour: 7, minute: 0 } };
(async () => {
  const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
      const browser = await engine.launch();
      try {
        const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
        await context.addInitScript(value => localStorage.setItem('sb-xqfgikcepbgcppfudpcm-auth-token', JSON.stringify(value)), session);
        await context.route('https://xqfgikcepbgcppfudpcm.supabase.co/auth/v1/**', route => route.fulfill({ json: user }));
        let connected = true, account = true, sends = 0, verifies = 0, commands = 0;
        await context.route('**/api/**', async route => {
          const req = route.request(), path = new URL(req.url()).pathname;
          let body; if (req.method() === 'POST') body = req.postDataJSON();
          if (path === '/api/devices') return route.fulfill({ json: { devices: connected ? [device] : [], readOnly: false } });
          if (path === '/api/device-links') return route.fulfill({ json: { connected: account, devices: account ? [{ id: 'NODE1', name: 'Plant Watering', connected }] : [] } });
          if (path === '/api/device-links/disconnect') { assert.equal(body.id, 'NODE1'); connected = false; }
          else if (path === '/api/device-links/connect') { assert.equal(body.id, 'NODE1'); connected = true; }
          else if (path === '/api/rainmaker/login/start') { assert.equal(body.email, 'sample@example.com'); sends++; }
          else if (path === '/api/rainmaker/login/verify') {
            verifies++;
            if (body.code !== '123456') return route.fulfill({ status: 400, json: { error: 'The code could not be verified.' } });
            account = true;
          } else if (path === '/api/rainmaker/disconnect') { connected = false; account = false; }
          else { commands++; return route.fulfill({ status: 404, json: { error: 'Unexpected device command' } }); }
          return route.fulfill({ json: { message: 'Connection updated.' } });
        });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(base + '/dashboard.html');
        await page.getByRole('link', { name: 'Open Plant Watering', exact: true }).waitFor();
        await page.getByRole('link', { name: 'Open Plant Watering', exact: true }).click();
        await page.getByRole('button', { name: 'Disconnect device', exact: true }).click();
        await page.locator('#link-disconnect-confirmation').waitFor({ state: 'visible' });
        assert.match(await page.locator('#link-confirm-description').innerText(), /continue/);
        await page.locator('#link-disconnect-confirm').click();
        await page.waitForFunction(() => document.querySelectorAll('.live-device-list .device-card').length === 0);
        await page.locator('[data-close-links]').click();
        await page.reload();
        await page.getByRole('button', { name: 'Connect a device', exact: true }).click();
        await page.getByRole('button', { name: 'Connect Plant Watering', exact: true }).click();
        await page.getByRole('button', { name: 'Disconnect Plant Watering', exact: true }).waitFor();
        await page.locator('#rainmaker-email').fill('sample@example.com');
        await page.getByRole('button', { name: 'Send sign-in code', exact: true }).click();
        await page.locator('#rainmaker-code').waitFor({ state: 'visible' });
        await page.locator('#rainmaker-code').fill('000000');
        await page.getByRole('button', { name: 'Verify RainMaker', exact: true }).click();
        await page.waitForFunction(() => document.getElementById('device-links-status').textContent.includes('could not be verified'));
        assert.equal(await page.locator('#rainmaker-code').inputValue(), '');
        await page.locator('#rainmaker-code').fill('123456');
        await page.getByRole('button', { name: 'Verify RainMaker', exact: true }).click();
        await page.locator('#rainmaker-code-form').waitFor({ state: 'hidden' });
        assert.equal(sends, 1); assert.equal(verifies, 2); assert.equal(commands, 0);
        assert.equal(await page.locator('#rainmaker-code').inputValue(), '');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        const accessibility = await new AxeBuilder({ page }).include('#device-links-dialog').analyze();
        assert.deepEqual(accessibility.violations.map(v => ({ id: v.id, impact: v.impact })), []);
        await page.getByRole('button', { name: 'Disconnect RainMaker', exact: true }).click();
        await page.locator('#link-disconnect-confirm').click();
        await page.waitForFunction(() => document.getElementById('rainmaker-connection-label').textContent === 'Connect your RainMaker account');
        assert.equal(connected, false); assert.equal(account, false); assert.deepEqual(errors, []);
        console.log(`${name}: connect, disconnect/reload, code errors/success, account removal, mobile layout and accessibility passed (mock APIs; no emails or watering).`);
        await context.close();
      } finally { await browser.close(); }
    }
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
