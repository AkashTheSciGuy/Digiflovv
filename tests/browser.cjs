const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createServer } = require('../scripts/serve.cjs');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const AxeBuilder = require('@axe-core/playwright').default;

(async () => {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const results = [];
  fs.mkdirSync(path.join(__dirname, '../test-results'), { recursive: true });
  try {
    for (const engine of ['chromium','firefox','webkit']) {
      const browser = await playwright[engine].launch({ headless: true });
      try {
        for (const viewport of [{width:1440,height:1000},{width:768,height:1024},{width:390,height:844},{width:320,height:720}]) {
          const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
          const page = await context.newPage();
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          await page.goto(base);
          await page.waitForFunction(() => document.documentElement.classList.contains('menu-ready'));
          assert.equal(await page.locator('[data-purchase]').count(), 0);
          assert.equal(await page.locator('#gallery').isVisible(), false);
          const accessibility = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
          assert.deepEqual(accessibility.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})), [], 'Accessibility violations');
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${engine} ${viewport.width} overflows`);
          if (viewport.width < 761) {
            await page.locator('#menu-toggle').click();
            await page.locator('#main-navigation a[href="#contact"]').click();
            assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'), 'false');
          }
          await page.locator('#enquiry-form button[type="submit"]').click();
          assert.equal(await page.locator('#enquiry-name').getAttribute('aria-invalid'), 'true');
          await page.locator('#enquiry-name').fill('Test User');
          await page.locator('#enquiry-email').fill('test@example.com');
          await page.locator('#enquiry-subject').fill('Installation question');
          await page.locator('#enquiry-message').fill('Could you explain the setup for my plants?');
          await page.locator('#enquiry-form button[type="submit"]').click();
          assert.match(await page.locator('#enquiry-status').textContent(), /Nothing has been sent/);
          assert.match(await page.locator('#enquiry-draft').inputValue(), /Installation question/);
          await page.locator('#enquiry-message').fill('Edited message for this product question.');
          assert.equal(await page.locator('#enquiry-preview').isVisible(), false);
          await page.locator('.faq-list summary').first().click();
          assert.equal(await page.locator('.faq-list details').first().getAttribute('open'), '');
          await page.locator('[data-policy="privacy"]').click();
          assert.equal(await page.locator('#notice-dialog').isVisible(), true);
          await page.locator('#notice-dialog .button').click();
          assert.equal(await page.locator('#notice-dialog').isVisible(), false);
          await page.locator('[data-use-case="daily"]').click();
          await page.locator('#apply-use-case').click();
          assert.equal(await page.locator('#demo-duration').inputValue(), '15');
          await page.locator('#demo-water-now').click();
          await page.waitForFunction(() => !document.getElementById('demo-water-now').disabled);
          assert.match(await page.locator('#demo-reservoir').textContent(), /75%/);
          assert.deepEqual(errors, []);
          await page.evaluate(() => window.scrollTo(0,0));
          await page.screenshot({ path: path.join(__dirname, `../test-results/${engine}-${viewport.width}.png`), fullPage: true });
          results.push({ engine, width: viewport.width, status: 'passed' });
          await context.close();
        }
        // Exercise configured media and contact without sending messages or making external requests.
        const context = await browser.newContext();
        await context.route('**/config.js', route => route.fulfill({
          contentType: 'text/javascript',
          body: `window.DIGIFLOVV_CONFIG={supportEmail:'support@example.com',product:{images:[{src:'assets/plant-room.webp',alt:'Test photo one'},{src:'assets/plant-room.webp',alt:'Test photo two'}]}};`
        }));
        const page = await context.newPage();
        await page.goto(base);
        await page.locator('#gallery-controls button').nth(1).click();
        assert.equal(await page.locator('#gallery-image').getAttribute('alt'), 'Test photo two');
        await page.locator('#enquiry-name').fill('Test User');
        await page.locator('#enquiry-email').fill('test@example.com');
        await page.locator('#enquiry-subject').fill('Product question');
        await page.locator('#enquiry-message').fill('<script>alert("test")</script> Please explain installation.');
        await page.locator('#enquiry-form button[type="submit"]').click();
        const href = await page.locator('#send-enquiry').getAttribute('href');
        assert.ok(href.startsWith('mailto:support%40example.com?'));
        assert.ok(href.includes('%3Cscript%3E'));
        await context.close();
        results.push({ engine, flow: 'configured gallery and email draft', status: 'passed' });
        const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: {width:390,height:844} });
        const noJsPage = await noJs.newPage(); await noJsPage.goto(base);
        assert.equal(await noJsPage.locator('#enquiry-name').isDisabled(), true);
        assert.equal(await noJsPage.locator('#main-navigation').isVisible(), true);
        await noJs.close();
        results.push({engine,flow:'safe no-JavaScript fallback',status:'passed'});
      } finally { await browser.close(); }
    }
    console.log(JSON.stringify(results, null, 2));
    fs.writeFileSync(path.join(__dirname, '../test-results/browser.json'), JSON.stringify(results,null,2));
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
