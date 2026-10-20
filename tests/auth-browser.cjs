const assert = require('node:assert/strict');
const { chromium, firefox, webkit } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const { createServer } = require('../scripts/serve.cjs');
const service = 'https://xqfgikcepbgcppfudpcm.supabase.co';
const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'sample@example.com', email_confirmed_at: new Date().toISOString(), app_metadata: {}, user_metadata: {} };
const token = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url') + '.test-signature';
const session = { access_token: token, refresh_token: 'test-refresh-only', token_type: 'bearer', expires_in: 3600, user };
async function fill(page, signup) {
  if (signup) await page.locator('#auth-name').fill('Sample User');
  await page.locator('#auth-email').fill(user.email);
  await page.locator('#auth-password').fill('Sample-only-123');
  if (signup) await page.locator('#auth-confirmPassword').fill('Sample-only-123');
}
(async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let scenarios = 0;
  try {
    for (const [engine, launcher] of Object.entries({ chromium, firefox, webkit })) {
      const browser = await launcher.launch();
      try {
        for (const width of [1440, 390, 320]) {
          const context = await browser.newContext({ viewport: { width, height: 1000 } });
          let failure = false;
          let signups = 0;
          await context.route(service + '/auth/v1/**', async route => {
            const url = new URL(route.request().url());
            let body = {}, status = 200;
            if (url.pathname.endsWith('/signup')) {
              signups++;
              const input = route.request().postDataJSON();
              assert.equal(input.email, user.email);
              assert.equal(input.data.full_name, 'Sample User');
              assert.equal(url.searchParams.get('redirect_to'), base + '/login.html');
              body = user;
            } else if (url.pathname.endsWith('/token')) {
              if (failure) { status = 400; body = { code: 'invalid_credentials', msg: 'Invalid login credentials' }; }
              else body = session;
            } else if (url.pathname.endsWith('/user')) body = user;
            else if (url.pathname.endsWith('/logout')) status = 204;
            await route.fulfill({ status, contentType: 'application/json', body: status === 204 ? '' : JSON.stringify(body) });
          });
          const page = await context.newPage();
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          await page.goto(base + '/dashboard.html');
          await page.waitForURL('**/login.html');
          await page.goto(base + '/signup.html');
          await page.locator('#auth-submit').click();
          assert.match(await page.locator('#auth-status').innerText(), /highlighted/);
          await fill(page, true);
          await page.locator('#auth-submit').click();
          await page.waitForFunction(() => document.getElementById('auth-status').textContent.includes('Check your inbox'));
          assert.equal(signups, 1);
          assert.equal(await page.locator('#auth-password').inputValue(), '');
          assert.ok(page.url().endsWith('/signup.html'));
          assert.equal((await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa']).analyze()).violations.length, 0);
          await page.goto(base + '/login.html');
          failure = true;
          await fill(page, false);
          await page.locator('#auth-submit').click();
          await page.waitForFunction(() => document.getElementById('auth-status').textContent.includes('Unable to log in'));
          assert.equal(await page.locator('#auth-password').inputValue(), '');
          failure = false;
          await fill(page, false);
          await page.locator('#auth-submit').click();
          await page.waitForURL('**/dashboard.html');
          await page.locator('#dashboard-shell').waitFor({ state: 'visible' });
          assert.ok(await page.locator('[data-dashboard-view=devices]').isVisible());
          await page.locator('.device-card').click();
          await page.locator('[data-dashboard-view=device]').waitFor({ state: 'visible' });
          await page.locator('#status-preview').selectOption('watering');
          assert.equal(await page.locator('#device [data-activity]').innerText(), 'Watering now');
          await page.locator('#status-preview').selectOption('offline');
          assert.equal(await page.locator('#device [data-connection]').innerText(), 'Offline');
          assert.equal(await page.locator('#device [data-activity]').innerText(), 'Watering status unknown');
          assert.equal(await page.locator('#devices [data-connection]').innerText(), 'Offline');
          await page.locator('#status-preview').selectOption('idle');
          assert.equal(await page.locator('#device [data-activity]').innerText(), 'Not watering');
          for (const control of ['interval', 'pump', 'schedule', 'settings']) {
            await page.locator(`.device-control[href="#${control}"]`).click();
            await page.locator(`[data-dashboard-view="${control}"]`).waitFor({ state: 'visible' });
            assert.equal(await page.locator(`[data-dashboard-view="${control}"] h1`).innerText(), control[0].toUpperCase()+control.slice(1));
            if (control !== 'settings') {
              const toggle = page.locator(`[data-power="${control}"]`);
              assert.equal(await toggle.getAttribute('aria-checked'), 'false');
              await toggle.click();
              assert.equal(await toggle.getAttribute('aria-checked'), 'true');
              if (control === 'pump') assert.equal(await page.locator('#devices [data-activity]').innerText(), 'Watering now');
              await toggle.click();
              assert.equal(await toggle.getAttribute('aria-checked'), 'false');
            } else {
              await page.locator('#setting-hour').fill('25');
              assert.equal(await page.locator('#setting-hour').evaluate(el => el.checkValidity()), false);
              await page.locator('#setting-hour').fill('9');
              await page.locator('#setting-duration').fill('12');
              await page.locator('#device-settings button').click();
              assert.match(await page.locator('#settings-result').innerText(), /Duration 12, time 09:00/);
            }
            assert.equal((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze()).violations.length, 0);
            await page.screenshot({path: `test-results/control-${control}-${engine}-${width}.png`, fullPage:true});
            await page.locator(`[data-dashboard-view="${control}"] .dashboard-back`).click();
          }
          assert.equal((await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa']).analyze()).violations.length, 0);
          await page.screenshot({path: `test-results/dashboard-${engine}-${width}.png`, fullPage:true});
          await page.locator('[data-dashboard-view=device] .dashboard-back').click();
          await page.reload();
          await page.locator('#dashboard-shell').waitFor({ state: 'visible' });
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1));
          assert.ok(!(await page.evaluate(() => JSON.stringify(localStorage))).includes('Sample-only-123'));
          await page.locator('#sign-out').click();
          await page.waitForURL('**/login.html');
          await page.goto(base + '/dashboard.html');
          await page.waitForURL('**/login.html');
          await page.goto(base + '/signup.html');
          await fill(page, true);
          await page.locator('#auth-submit').click();
          await page.waitForFunction(() => document.getElementById('auth-status').textContent.includes('Check your inbox'));
          await page.goto(base + '/login.html?code=mock-confirmation');
          await page.waitForURL('**/dashboard.html');
          await page.locator('#dashboard-shell').waitFor({ state: 'visible' });
          assert.ok(await page.locator('[data-dashboard-view=devices]').isVisible());
          assert.deepEqual(errors, []);
          await context.close();
          scenarios++;
          console.log(`${engine} ${width}: confirmation pending, invalid credentials, login, device navigation, reload, logout passed`);
        }
      } finally { await browser.close(); }
    }
    console.log(`${scenarios} Supabase mocked API browser scenarios passed. No real accounts or emails created.`);
  } finally { await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
