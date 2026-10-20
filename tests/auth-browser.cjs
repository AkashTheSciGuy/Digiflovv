const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const playwright = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const { createServer } = require('../scripts/serve.cjs');
const { SESSION_KEY } = require('../dist/auth-preview.js');
const password = 'Sample-only-123';

async function fillForm(page, signup) {
  if (signup) await page.locator('#auth-name').fill('Sample User');
  await page.locator('#auth-email').fill('sample@example.com');
  await page.locator('#auth-password').fill(password);
  if (signup) await page.locator('#auth-confirmPassword').fill(password);
}

(async () => {
  const server = createServer();
  await new Promise((resolve,reject) => { server.once('error',reject); server.listen(0,'127.0.0.1',resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const folder = path.join(__dirname,'../test-results');
  fs.mkdirSync(folder,{recursive:true});
  const results = [];
  try {
    for (const engine of ['chromium','firefox','webkit']) {
      const browser = await playwright[engine].launch({headless:true});
      try {
        for (const width of [1440,768,390,320]) {
          const context = await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
          const page = await context.newPage();
          const errors = [];
          const requests = [];
          page.on('pageerror', error => errors.push(error.message));
          page.on('request', request => requests.push({url:request.url(),body:request.postData()}));
          await page.goto(base+'/dashboard.html');
          await page.waitForURL('**/login.html');
          for (const mode of ['signup','login']) {
            await page.goto(base+`/${mode}.html`);
            await page.waitForFunction(() => !document.getElementById('auth-fields').disabled);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${engine} ${width} ${mode} overflow`);
            const violations = (await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations;
            assert.deepEqual(violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})), []);
            await page.screenshot({path:path.join(folder,`auth-${mode}-${engine}-${width}.png`),fullPage:true});
            await page.locator('#auth-submit').click();
            assert.match(await page.locator('#auth-status').textContent(), /correct the highlighted fields/);
            await fillForm(page,mode==='signup');
            await page.locator('[data-password-toggle="auth-password"]').click();
            assert.equal(await page.locator('#auth-password').getAttribute('type'),'text');
            await page.locator('[data-password-toggle="auth-password"]').click();
            assert.equal(await page.locator('#auth-password').getAttribute('type'),'password');
            if (mode==='signup') {
              await page.locator('#auth-confirmPassword').fill('different');
              await page.locator('#auth-submit').click();
              assert.match(await page.locator('#error-confirmPassword').textContent(), /do not match/);
              await page.locator('#auth-confirmPassword').fill(password);
            }
            await page.locator('#auth-submit').click();
            await page.waitForURL('**/dashboard.html');
            await page.locator('#dashboard-shell').waitFor({state:'visible'});
            assert.equal(await page.locator('#main').innerHTML(),'');
            const stored = await page.evaluate(() => ({session:{...sessionStorage},local:{...localStorage}}));
            assert.deepEqual(stored.local,{});
            assert.equal(Object.keys(stored.session).length,1);
            assert.ok(!JSON.stringify(stored).includes(password));
            assert.ok(!JSON.stringify(stored).includes('sample@example.com'));
            await page.reload();
            await page.locator('#sign-out').waitFor({state:'visible'});
            await page.locator('#sign-out').click();
            await page.waitForURL('**/login.html');
            assert.equal(await page.evaluate(key => sessionStorage.getItem(key),SESSION_KEY),null);
            await page.goto(base+'/dashboard.html');
            await page.waitForURL('**/login.html');
          }
          assert.deepEqual(errors,[]);
          assert.ok(requests.every(request => !request.body && !request.url.includes(password) && !request.url.includes('sample%40')));
          await context.close();
          results.push({engine,width,flow:'signup, login, blank dashboard, reload, logout, accessibility',status:'passed'});
        }
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(base+'/login.html?next=https://example.com');
        await page.evaluate(key => sessionStorage.setItem(key,JSON.stringify({mode:'preview',version:1,expiresAt:Date.now()-1000})),SESSION_KEY);
        await page.goto(base+'/dashboard.html');
        await page.waitForURL('**/login.html');
        await page.evaluate(key => sessionStorage.setItem(key,'invalid json'),SESSION_KEY);
        await page.goto(base+'/dashboard.html');
        await page.waitForURL('**/login.html');
        await page.goto(base+'/login.html?next=https://example.com');
        await fillForm(page,false);
        await page.locator('#auth-submit').click();
        await page.waitForURL('**/dashboard.html');
        assert.ok(page.url().startsWith(base));
        await context.close();

        const denied = await browser.newContext();
        await denied.addInitScript(() => Object.defineProperty(window,'sessionStorage',{get(){throw new Error('Blocked storage');}}));
        const deniedPage = await denied.newPage();
        await deniedPage.goto(base+'/signup.html');
        await fillForm(deniedPage,true);
        await deniedPage.locator('#auth-submit').click();
        assert.match(await deniedPage.locator('#auth-status').textContent(), /blocked the preview session/);
        assert.equal(await deniedPage.locator('#auth-password').inputValue(),'');
        assert.equal(await deniedPage.locator('#auth-submit').isEnabled(),true);
        await denied.close();

        const noJs = await browser.newContext({javaScriptEnabled:false});
        const noJsPage = await noJs.newPage();
        await noJsPage.goto(base+'/signup.html');
        assert.equal(await noJsPage.locator('#auth-password').isDisabled(),true);
        await noJsPage.goto(base+'/dashboard.html');
        assert.equal(await noJsPage.locator('#dashboard-shell').isVisible(),false);
        await noJs.close();
        results.push({engine,flow:'expired/corrupt storage, fixed redirects, blocked storage, no JavaScript',status:'passed'});
      } finally { await browser.close(); }
    }
    fs.writeFileSync(path.join(folder,'auth-browser.json'),JSON.stringify(results,null,2));
    console.log(JSON.stringify(results,null,2));
  } finally { server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1;});
