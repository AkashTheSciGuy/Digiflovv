'use strict';
const assert = require('node:assert/strict');
const { chromium, firefox, webkit } = require('playwright');
const { createServer } = require('../scripts/serve.cjs');
const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'sample@example.com', app_metadata: {}, user_metadata: {} };
const access = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now()/1000) + 3600 })).toString('base64url') + '.fake';
const session = { access_token: access, refresh_token: 'fake', token_type: 'bearer', expires_at: Math.floor(Date.now()/1000) + 3600, expires_in: 3600, user };
const device = { id: 'NODE1', name: 'Plant Watering', online: true, observedAt: new Date().toISOString(), commandExpiresAt: Date.now() + 30000, capabilities: { moisture: true }, power: { pump: false, interval: false, schedule: false, moisture: false }, settings: { duration: 5, hour: 7, minute: 0, intervalMinutes: 10 } };
(async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
      const browser = await engine.launch();
      try {
        const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
        await context.addInitScript(value => localStorage.setItem('sb-xqfgikcepbgcppfudpcm-auth-token', JSON.stringify(value)), session);
        await context.route('https://xqfgikcepbgcppfudpcm.supabase.co/auth/v1/**', route => route.fulfill({ json: user }));
        let devices = [device, { ...device, id: 'NODE2', name: 'Balcony', power: { ...device.power, pump: true } }];
        let failure = false;
        await context.route(/\/api\/devices(?:\?.*)?$/, route => route.fulfill({ status: failure ? 503 : 200, json: failure ? { error: 'Unavailable' } : { devices } }));
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(base + '/dashboard.html');
        await page.locator('.live-device-list .device-card').nth(1).waitFor();
        assert.equal(await page.locator('.live-device-list .device-card').count(), 2);
        await page.getByRole('link', { name: 'Open Balcony', exact: true }).click();
        assert.equal(await page.locator('#heading-device').innerText(), 'Balcony');
        assert.equal(await page.locator('#device [data-activity]').innerText(), 'Pump reports ON');
        for (const toggle of await page.locator('[data-power]').all()) assert.equal(await toggle.isDisabled(), true);
        await page.locator('.device-controls a[href="#pump"]').click();
        assert.equal(await page.locator('#pump-power-label').innerText(), 'On');
        devices = devices.map(item => ({ ...item, online: false }));
        await page.evaluate(() => window.dispatchEvent(new Event('digiflovv:authenticated')));
        await page.waitForFunction(() => document.getElementById('pump-power-label').textContent === 'Unknown');
        assert.equal(await page.locator('#setting-duration').inputValue(), '');
        devices = [device];
        await page.evaluate(() => window.dispatchEvent(new Event('digiflovv:authenticated')));
        await page.waitForFunction(() => document.getElementById('pump-power-label').textContent === 'Off');
        failure = true;
        await page.evaluate(() => window.dispatchEvent(new Event('digiflovv:authenticated')));
        await page.waitForFunction(() => document.getElementById('pump-power-label').textContent === 'Unknown');
        failure = false;
        devices = [];
        await page.evaluate(() => window.dispatchEvent(new Event('digiflovv:authenticated')));
        await page.waitForFunction(() => location.hash === '#devices' && document.querySelectorAll('.device-card').length === 0);
        await page.evaluate(() => { location.hash = 'device'; });
        await page.waitForFunction(() => document.getElementById('heading-device').textContent === 'No linked device');
        assert.equal(await page.locator('#pump-power-label').innerText(), 'Unknown');
        devices = [{ ...device, writable: true, revision: 'a'.repeat(64) }];
        const commands = [];
        let releasePower;
        const powerGate = new Promise(resolve => { releasePower = resolve; });
        await context.route('**/api/devices/NODE1/commands', async route => {
          const body = route.request().postDataJSON();
          commands.push(body);
          assert.equal(body.expectedRevision, 'a'.repeat(64));
          assert.equal(body.expiresAt, device.commandExpiresAt);
          if (body.target === 'Settings') {
            devices[0].settings = { ...devices[0].settings, minute: body.values.Minute };
            await route.fulfill({ json: { state: 'reported', device: devices[0] } });
          } else if (body.target === 'Moisture Control') {
            devices[0].power = { ...devices[0].power, moisture: body.values.Power };
            await route.fulfill({ json: { state: 'reported', device: devices[0] } });
          } else { await powerGate; await route.fulfill({ json: { state: 'sent' } }); }
        });
        await page.evaluate(() => window.dispatchEvent(new Event('digiflovv:authenticated')));
        await page.locator('#device [data-power="pump"]').waitFor();
        await page.waitForFunction(() => !document.querySelector('#device [data-power="pump"]').disabled);
        await page.locator('.device-controls a[href="#settings"]').click();
        await page.locator('#setting-minute').fill('2');
        await page.evaluate(() => window.dispatchEvent(new Event('digiflovv:authenticated')));
        await page.waitForFunction(() => document.getElementById('setting-minute').value === '2');
        await page.locator('#device-settings button').click();
        await page.waitForFunction(() => document.getElementById('settings-result').textContent.includes('now reports'));
        assert.equal(commands.length, 1);
        assert.equal(commands[0].values.Minute, 2);
        await page.locator('#settings .dashboard-back').click();
        await page.locator('#device [data-power="pump"]').click();
        assert.equal(await page.locator('#device [data-power="pump"]').getAttribute('data-pending'), 'on');
        assert.equal(await page.locator('#device [data-power="pump"]').getAttribute('aria-checked'), 'false');
        releasePower();
        await page.waitForFunction(() => document.getElementById('device-command-status').textContent.includes('Command sent'));
        assert.equal(await page.locator('#device [data-power="pump"]').getAttribute('aria-checked'), 'false');
        assert.equal(commands.length, 2);
        assert.equal(commands[1].target, 'Pump');
        assert.equal(commands[1].values.Power, true);
        devices[0].power = { ...device.power, pump: true };
        await page.evaluate(() => window.dispatchEvent(new Event('digiflovv:authenticated')));
        await page.waitForFunction(() => document.querySelector('#device [data-power="pump"]').getAttribute('aria-checked') === 'true');
        assert.match(await page.locator('#device-command-status').innerText(), /now reports/);
        await page.locator('.device-controls a[href="#moisture"]').click();
        assert.equal(await page.locator('#heading-moisture').innerText(), 'Moisture Control');
        assert.equal(await page.locator('#moisture .power-field > div > span').innerText(), 'Power');
        assert.equal(await page.locator('#moisture-power-label').innerText(), 'Off');
        await page.locator('#moisture [data-power="moisture"]').click();
        await page.waitForFunction(() => document.getElementById('moisture-power-label').textContent === 'On');
        assert.equal(commands.at(-1).target, 'Moisture Control');
        assert.equal(commands.at(-1).values.Power, true);
        assert.deepEqual(errors, []);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        console.log(`${name}: devices, offline, unlink, settings drafts/save, and non-optimistic power commands passed (mocked APIs)`);
        await context.close();
      } finally { await browser.close(); }
    }
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
