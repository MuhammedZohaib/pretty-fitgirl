/* Actual extension integration, using only a fresh isolated browser profile. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const extension = fs.existsSync(path.resolve(__dirname, '../pretty-fitgirl')) ? path.resolve(__dirname, '../pretty-fitgirl') : path.resolve(__dirname, '../modern-fitgirl');
(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json')));
  assert.notEqual(manifest.background?.service_worker, 'scripts/library-worker.js', 'Removed library worker still shipped');
  assert.equal(manifest.background?.service_worker, 'scripts/background.js', 'Background service worker configured');
  assert(!fs.existsSync(path.join(extension, 'library.html')), 'Removed library page still shipped');
  const context = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'pfg-qa-')), {
    executablePath: process.env.MFG_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true, viewport: { width: 1600, height: 1100 }, ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
  });
  try {
    const manager = await context.newPage(); await manager.goto('chrome://extensions/');
    const extensions = await manager.evaluate(() => new Promise(resolve => chrome.developerPrivate.getExtensionsInfo({}, resolve)));
    const installed = extensions.find(item => item.name === 'Pretty FitGirl' || item.name === 'Modern FitGirl');
    assert(installed, 'This browser did not load the unpacked extension');
    const source = name => fs.readFileSync(path.join(__dirname, `sources/${name}.html`), 'utf8')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<iframe\b[^>]*youtube[\s\S]*?<\/iframe>/gi, '');
    const fixtures = Object.fromEntries(['home', 'page2', 'detail', 'az', 'az-blud', 'az-drive', 'digests', 'digest', 'updates'].map(name => [name, source(name)]));
    await context.route('https://web.tolstoycomments.com/**', route => {
      const request = route.request();
      if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: source('comments-frame') });
      if (new URL(request.url()).pathname.endsWith('.css')) return route.fulfill({ contentType: 'text/css', body: fs.readFileSync(path.join(__dirname, 'sources/comments.css')) });
      return route.abort();
    });
    const fetches = new Map();
    await context.route('https://fitgirl-repacks.site/**', route => {
      const request = route.request(); const url = new URL(request.url());
      if (request.isNavigationRequest()) {
        const name = url.pathname.startsWith('/all-my-repacks-a-z') ? 'az' : url.pathname === '/cyberpunk-2077/' ? 'detail' : url.pathname.startsWith('/category/updates-digest') ? 'digests' : url.pathname.startsWith('/updates-digest-for-') ? 'digest' : url.pathname === '/updates-list/' ? 'updates' : url.pathname.startsWith('/page/') ? 'page2' : 'home';
        return route.fulfill({ contentType: 'text/html', body: fixtures[name] });
      }
      if (request.resourceType() === 'fetch') {
        fetches.set(url.pathname, (fetches.get(url.pathname) || 0) + 1);
        const name = ({ '/blud/': 'az-blud', '/drive-rally/': 'az-drive' })[url.pathname];
        return route.fulfill({ status: name ? 200 : 404, contentType: 'text/html', body: name ? fixtures[name] : '' });
      }
      if (request.resourceType() === 'stylesheet') return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
      if (request.resourceType() === 'image') return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.alloc(0) });
      return route.abort();
    });
    await context.route('https://**steamstatic.com/**', route => route.abort());
    await context.route('https://store.steampowered.com/**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ total: 1, items: [{ id: 1091500, name: 'Cyberpunk 2077', tiny_image: '' }] })
    }));
    await context.route('https://catalog.gog.com/**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ products: [] })
    }));
    await context.route('https://**youtube**/**', route => route.abort());
    await context.route('https://**imageban.ru/**', route => route.abort());
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('https://fitgirl-repacks.site/');
    await page.locator('.mfg-browse-sidebar').waitFor(); await page.locator('.mfg-promo-sidebar').waitFor();
    await page.waitForFunction(() => document.querySelector('.mfg-site-logo')?.naturalWidth === 225);
    const fonts = await page.evaluate(async () => {
      const faces = await Promise.all([document.fonts.load('500 16px "MFG Inter"'), document.fonts.load('600 16px "MFG Manrope"')]);
      return faces.every(group => group.length > 0 && group.every(face => face.status === 'loaded'));
    });
    assert(fonts, 'Bundled font pair did not load');
    assert(!(await page.locator('#primary-navigation').isVisible()), 'Duplicate navigation is still visible');
    assert.equal(await page.locator('.mfg-library-nav, .mfg-save, .mfg-detail-nav').count(), 0);
    const popup = await context.newPage(); await popup.goto(`chrome-extension://${installed.id}/popup.html`);
    assert.equal(await popup.locator('a[href="library.html"]').count(), 0);
    await popup.locator('#enabled').uncheck(); await page.locator('html:not(.mfg-on)').waitFor();
    assert.equal(await page.locator('.mfg-browse-sidebar, .mfg-promo-sidebar, .mfg-cover').count(), 0);
    await popup.locator('#enabled').check(); await page.locator('.mfg-browse-sidebar').waitFor();
    await popup.locator('#view').selectOption('list'); await page.reload();
    await page.locator('html[data-mfg-view="list"] .mfg-game').first().waitFor();
    await popup.locator('#view').selectOption('grid');
    await page.goto('https://fitgirl-repacks.site/page/2/');
    const next = page.locator('.paging-navigation a.next'); const nextURL = await next.getAttribute('href');
    await Promise.all([page.waitForURL(nextURL), next.click()]);
    await page.locator('.mfg-browse-sidebar').waitFor(); assert.equal(new URL(page.url()).pathname, '/page/3/');
    await page.goto('https://fitgirl-repacks.site/cyberpunk-2077/');
    await page.locator('.mfg-game-info').waitFor(); assert.equal(await page.locator('.mfg-detail-nav').count(), 0);
    assert((await page.locator('.mfg-game-info').innerText()).includes('REQUIRES Win10/11'));
    assert.equal(await page.locator('.mfg-comments:not([open])').count(), 1, 'Comments must start closed');
    const widgetURL = 'https://web.tolstoycomments.com/widget/index.html?x=6289&p=' + encodeURIComponent('https://fitgirl-repacks.site/cyberpunk-2077/');
    await page.locator('.mfg-comments .tolstoycomments-feed').first().evaluate((node, url) => {
      const frame = document.createElement('iframe'); frame.id = 'mfg-test-comments'; frame.src = url; frame.height = '550'; frame.style.width = '100%'; node.append(frame);
    }, widgetURL);
    const commentFrame = page.frameLocator('#mfg-test-comments');
    await commentFrame.locator('html.mfg-comments-on').waitFor({ state: 'attached' });
    await page.locator('.mfg-comments > summary').click();
    assert.equal(await commentFrame.locator('body').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(0, 0, 0)', 'Comments frame remains white');
    await page.locator('.mfg-comments > summary').click();
    await popup.locator('#enabled').uncheck();
    await commentFrame.locator('html:not(.mfg-comments-on)').waitFor({ state: 'attached' });
    await popup.locator('#enabled').check();
    await commentFrame.locator('html.mfg-comments-on').waitFor({ state: 'attached' });
    const directWidget = await context.newPage(); await directWidget.goto(widgetURL);
    assert.equal(await directWidget.locator('html.mfg-comments-on').count(), 0, 'Frame theme leaked into a standalone provider page'); await directWidget.close();
    await page.goto('https://fitgirl-repacks.site/category/updates-digest/');
    await page.locator('.mfg-digest-preview').first().waitFor();
    assert((await page.locator('.mfg-digest-preview').count()) > 1, 'Digest archive was not converted to summaries');
    await page.goto('https://fitgirl-repacks.site/updates-digest-for-october-22-2026/');
    await page.locator('.mfg-update-filter').waitFor();
    await page.locator('.mfg-update-filter input').fill('HumanitZ');
    assert.equal(await page.locator('.mfg-digest-page .su-spoiler:not([hidden])').count(), 1, 'Digest game filter failed');
    await page.goto('https://fitgirl-repacks.site/all-my-repacks-a-z/');
    await page.locator('.mfg-directory-card').first().waitFor();
    assert.equal(await page.locator('.mfg-directory-card').count(), 50);
    await page.locator('.mfg-directory-card').first().locator('.mfg-cover img').waitFor({ state: 'attached' });
    assert(fetches.size < 50, 'Directory eagerly fetched the entire page');
    const before = fetches.get('/blud/'); await page.reload();
    await page.locator('.mfg-directory-card').first().locator('.mfg-cover img').waitFor({ state: 'attached' });
    assert.equal(fetches.get('/blud/'), before, 'Artwork cache did not avoid a repeat fetch');
    const azNext = page.locator('.lcp_nextlink'); const azURL = await azNext.getAttribute('href');
    await Promise.all([page.waitForURL(azURL), azNext.click()]);
    assert.equal(new URL(page.url()).searchParams.get('lcp_page0'), '2');
    await page.locator('.mfg-directory-card').first().waitFor();
    await page.setViewportSize({ width: 390, height: 900 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Directory overflows narrow viewport');
    await page.locator('.mfg-browse-toggle').click();
    assert(await page.locator('.mfg-browse-sidebar').isVisible(), 'Mobile Browse did not open');
    await page.keyboard.press('Escape'); assert(!(await page.locator('.mfg-browse-sidebar').isVisible()), 'Escape did not close mobile Browse');
    assert.deepEqual(errors, [], 'Extension introduced a page error');
    console.log('PASS: real MV3 injection, fonts, two sidebars, single navigation, mobile Browse, collapsed/themed comments frame, frame scope, theme restoration, digest filtering, pagination, lazy artwork/cache, and narrow layout.');
  } finally { await context.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
