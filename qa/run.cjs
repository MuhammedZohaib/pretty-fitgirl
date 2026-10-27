/* Isolated developer rendering of captured original markup. Never executes third-party scripts. */
const fs = require('./fixture-fs.cjs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const extension = path.join(root, 'pretty-fitgirl');
const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json')));
const output = path.join(__dirname, 'output');
fs.mkdirSync(output, { recursive: true });
const css = manifest.content_scripts[0].css.map(file => fs.readFileSync(path.join(extension, file), 'utf8')).join('\n');
const enhancement = manifest.content_scripts[0].js.map(file => fs.readFileSync(path.join(extension, file), 'utf8')).join('\n');
const pages = { home: '/', category: '/tag/open-world/page/14/', search: '/?s=cyberpunk', detail: '/cyberpunk-2077/', page2: '/page/2/', popular: '/popular-repacks/', monthly: '/pop-repacks/', yearly: '/popular-repacks-of-the-year/', az: '/all-my-repacks-a-z/', digests: '/category/updates-digest/', digest: '/updates-digest-for-october-22-2026/', updates: '/updates-list/' };
const report = { mode: 'Isolated captured DOM, native theme CSS, third-party scripts/network disabled; storage API simulated.', cases: [], failures: [] };
const check = (condition, message) => { if (!condition) report.failures.push(message); };

(async () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://fitgirl-repacks.site/*']);
  for (const file of [...manifest.content_scripts[0].css, ...manifest.content_scripts[0].js, 'popup.html', 'popup.css', 'scripts/popup.js']) assert(fs.existsSync(path.join(extension, file)), file);
  const browser = await chromium.launch(require('./browser-options.cjs'));
  try {
    for (const [name, pathname] of Object.entries(pages)) {
      const popular = ['popular', 'monthly', 'yearly'].includes(name);
      const directory = name === 'az';
      const updatesPage = ['digests', 'digest', 'updates'].includes(name);
      const original = fs.readFileSync(path.join(__dirname, 'sources', `${name}.html`), 'utf8');
      const html = original.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '');
      const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => {
        const request = route.request();
        const bundled = new URL(request.url()).pathname.match(/^\/__mfg\/(assets\/(?:logo\.png|fonts\/[a-z-]+\.woff2))$/);
        if (bundled) return route.fulfill({ contentType: bundled[1].endsWith('.woff2') ? 'font/woff2' : 'image/png', body: fs.readFileSync(path.join(extension, bundled[1])) });
        if (request.resourceType() === 'fetch') {
          const fixture = ({ '/blud/': 'az-blud', '/drive-rally/': 'az-drive' })[new URL(request.url()).pathname];
          if (fixture) return route.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.join(__dirname, 'sources', fixture + '.html')) });
        }
        if (request.isNavigationRequest() && request.frame() === page.mainFrame()) return route.fulfill({ contentType: 'text/html', body: html });
        const asset = path.join(__dirname, 'sources/assets', crypto.createHash('sha256').update(request.url()).digest('hex'));
        if (fs.existsSync(asset)) return route.fulfill({ contentType: request.resourceType() === 'stylesheet' ? 'text/css' : 'image/jpeg', body: fs.readFileSync(asset) });
        if (request.url().includes('/themes/twentyfourteen/style.css')) return route.fulfill({ contentType: 'text/css', body: fs.readFileSync(path.join(__dirname, 'sources/theme.css'), 'utf8') });
        const cached = path.join(__dirname, 'sources/images', Buffer.from(request.url()).toString('base64url'));
        if (fs.existsSync(cached)) return route.fulfill({ contentType: 'image/jpeg', body: fs.readFileSync(cached) });
        // Deterministic stand-in artwork keeps image-success and failure-isolation checks
        // meaningful without a machine-local image cache or live CDN requests.
        if (request.resourceType() === 'image') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="360"><rect width="240" height="360" fill="#34473d"/><text x="120" y="180" text-anchor="middle" fill="white">Test artwork</text></svg>' });
        if (request.resourceType() === 'stylesheet') return route.fulfill({ contentType: 'text/css', body: '' });
        return route.abort();
      });
      await page.goto(`https://fitgirl-repacks.site${pathname}`, { waitUntil: 'load' });
      const before = await page.locator('#page').evaluate(node => ({ html: node.outerHTML, links: [...node.querySelectorAll('a')], text: node.textContent }));
      // Store original node identities inside the page (not serialized Playwright objects).
      await page.evaluate(() => { window.originalNodes = [...document.querySelectorAll('#page a, #page form, #page input')].map(node => ({ node, href: node.getAttribute('href'), action: node.getAttribute('action') })); });
      if (name === 'home') await page.screenshot({ path: path.join(output, 'home-before.png') });
      await page.addStyleTag({ content: css });
      await page.evaluate(() => {
        const listeners = [];
        const data = {};
        window.chrome = { runtime: { sendMessage: (msg, cb) => { if (typeof cb === 'function') cb({}); }, getURL: path => new URL(`/__mfg/${path}`, location.origin).href }, storage: { local: {
          get: (key, callback) => { const result = key === null ? { ...data } : { [key]: data[key] }; callback?.(result); return Promise.resolve(result); },
          set: (value, callback) => {
            Object.assign(data, value);
            if (value.modernFitGirl) window.savedPreferences = value;
            callback?.();
            listeners.forEach(listener => listener(Object.fromEntries(Object.entries(value).map(([key, newValue]) => [key, { newValue }])), 'local'));
          },
          remove: (key, callback) => { delete data[key]; callback?.(); listeners.forEach(listener => listener({ [key]: {} }, 'local')); }
        }, onChanged: { addListener: listener => listeners.push(listener) } } };
        window.changePreferences = value => listeners.forEach(listener => listener({ modernFitGirl: { newValue: value } }, 'local'));
      });
      await page.addScriptTag({ content: enhancement });
      await page.evaluate(() => document.fonts.ready);
      const preserved = await page.evaluate(() => window.originalNodes.every(({ node, href, action }) => node.isConnected && node.getAttribute('href') === href && node.getAttribute('action') === action));
      check(preserved, `${name}: original link/form node removed or modified`);
      const articleCount = await page.locator('#content > article').count();
      check(await page.locator(name === 'detail' ? '.mfg-detail-hero' : name === 'digests' ? '.mfg-digest-archive' : updatesPage ? '.mfg-update-filter' : directory ? '.mfg-directory .lcp_catlist' : popular ? '.mfg-popular-tools' : '.mfg-toolbar').count() === 1, `${name}: expected page enhancements did not run`);
      if (name !== 'detail' && !popular && !directory && !updatesPage) check(await page.locator('.mfg-card').count() > 0, `${name}: native listing articles were not enhanced`);
      check(await page.locator('.mfg-game details.mfg-post-content').count() === 0, `${name}: game cards still expand inline`);
      const gameCards = page.locator('.mfg-game');
      check(await gameCards.count() === await page.locator('.mfg-game > .mfg-cover').count(), `${name}: game cover frame missing`);
      check(await gameCards.count() === await page.locator('.mfg-game .mfg-repack-link').count(), `${name}: game card has no source-page action`);
      if (name === 'home') {
        check(await page.locator('.mfg-game').first().locator('.mfg-card-facts').innerText().then(text => text.includes('49.5 GB') && text.includes('140.3 GB')), 'Card sizes do not match original Cyberpunk metadata');
      }
      if (name === 'detail') {
        check(await page.locator('.mfg-game-info').count() === 1, 'Game overview was not structured');
        check((await page.locator('.mfg-game-info').innerText()).includes('REQUIRES Win10/11'), 'Author requirement was lost in the overview');
      }
      check(await page.locator('#content > .mfg-announcement').count() === 0, `${name}: announcement still interrupts game grid`);
      check(await page.locator('.mfg-browse-sidebar').count() === 1 && await page.locator('.mfg-promo-sidebar').count() === 1, `${name}: two sidebars were not created`);
      check(await page.locator('.mfg-save, .mfg-library-nav, .mfg-detail-nav').count() === 0, `${name}: removed library or game navigation remains`);
      if (await page.locator('.mfg-comments').count()) {
        check(await page.locator('.mfg-comments:not([open])').count() === 1, `${name}: comments do not start collapsed`);
        await page.locator('.mfg-comments > summary').click();
        check(await page.locator('.mfg-comments[open]').count() === 1, `${name}: comments cannot be opened`);
        await page.locator('.mfg-comments > summary').click();
      }
      if (updatesPage && name !== 'digests') {
        const input = page.locator('.mfg-update-filter input');
        await input.fill('zzzz-no-update-match');
        check(await page.locator('.mfg-digest-page .su-spoiler:not([hidden])').count() === 0, `${name}: update filter failed`);
        await input.fill('');
        check(await page.locator('.mfg-digest-page .su-spoiler:not([hidden])').count() > 0, `${name}: update filter did not reset`);
      }
      if (directory) {
        check(await page.locator('.mfg-directory-card').count() === 50, 'A-Z links did not become cards');
        check(await page.locator('.lcp_paginator a.lcp_nextlink').count() === 1, 'Original A-Z next-page link is missing');
      }
      const widths = [390, 640, 960, 1280, 1440, 1600, 1920, 2560];
      for (const width of widths) {
        await page.setViewportSize({ width, height: 1100 });
        const metrics = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth - innerWidth,
          columns: getComputedStyle(document.querySelector('#content')).gridTemplateColumns,
          popularColumns: document.querySelector('#content.mfg-popular .widgets-grid-layout') ? getComputedStyle(document.querySelector('#content.mfg-popular .widgets-grid-layout')).gridTemplateColumns : '',
          offenders: [...document.querySelectorAll('#page *')].filter(el => {
            const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
            return r.width && r.right > innerWidth + 2 && s.position !== 'absolute' && s.position !== 'fixed';
          }).slice(0, 8).map(el => `${el.tagName}.${el.className}`)
        }));
        const pageButtons = await page.locator('.pagination > .page-numbers, .lcp_paginator > li > a, .lcp_paginator > .lcp_currentpage, .lcp_paginator > span').evaluateAll(nodes => nodes.map(node => { const rect = node.getBoundingClientRect(); return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }; }));
        check(pageButtons.every((a, i) => a.width >= 32 && a.height >= 32 && pageButtons.slice(i + 1).every(b => Math.min(a.right, b.right) - Math.max(a.x, b.x) <= 1 || Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) <= 1)), `${name}@${width}: pagination buttons overlap or have undersized targets`);
        check(!(await page.locator('#primary-navigation').isVisible()), name + '@' + width + ': duplicated top navigation is visible');
        if (width <= 960) {
          check(!(await page.locator('.mfg-browse-sidebar').isVisible()), name + '@' + width + ': narrow Browse should start closed');
          await page.locator('.mfg-browse-toggle').click();
          check(await page.locator('.mfg-browse-sidebar').isVisible(), name + '@' + width + ': Browse toggle did not open');
          await page.keyboard.press('Escape');
          check(!(await page.locator('.mfg-browse-sidebar').isVisible()), name + '@' + width + ': Escape did not close Browse');
        }
        report.cases.push({ page: name, width, articleCount, ...metrics });
        check(metrics.overflow <= 1, `${name}@${width}: ${metrics.overflow}px horizontal overflow: ${metrics.offenders.join(', ')}`);
        if (name !== 'detail' && !popular && !directory && !updatesPage) check(metrics.columns.split(' ').length === (width >= 2200 ? 5 : width >= 1600 ? 4 : width <= 704 ? 2 : 3), `${name}@${width}: unexpected column count`);
        if (popular) check(metrics.popularColumns.split(' ').length === (width >= 2200 ? 6 : width >= 1600 ? 5 : width <= 704 ? 2 : 4), `${name}@${width}: unexpected popular column count`);
        if (popular || directory) {
          const uniform = await page.locator(directory ? '.mfg-directory-card' : '#content.mfg-popular .widget-grid-view-image').evaluateAll(cards => {
            const rows = new Map();
            for (const card of cards) {
              const r = card.getBoundingClientRect(); const y = Math.round(r.top); const previous = rows.get(y);
              if (previous && Math.abs(previous - r.height) > 1) return false;
              rows.set(y, r.height);
            }
            return true;
          });
          check(uniform, `${name}@${width}: collection card heights are inconsistent`);
        }
        if (name !== 'detail' && !popular && !directory && !updatesPage) {
          const firstRow = await page.locator('#content > .mfg-card').evaluateAll((cards, columns) => cards.slice(0, columns).map(card => Math.round(card.getBoundingClientRect().top)), metrics.columns.split(' ').length);
          check(new Set(firstRow).size <= 1, `${name}@${width}: digest or empty wrapper leaves a hole in the first game row`);
          const symmetry = await page.locator('#content > .mfg-game').evaluateAll(cards => {
            const rows = new Map();
            for (const card of cards) {
              const top = Math.round(card.getBoundingClientRect().top);
              const values = [card, card.querySelector('.mfg-cover'), card.querySelector('.entry-header'), card.querySelector('.mfg-card-information'), card.querySelector('.mfg-repack-link')].map(node => { const r = node.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.height)]; });
              const previous = rows.get(top);
              if (previous && values.some((v, i) => v.some((n, j) => Math.abs(n - previous[i][j]) > 1))) return JSON.stringify({ title: card.querySelector('.entry-title').textContent.trim(), values, previous });
              rows.set(top, values);
            }
            return true;
          });
          check(symmetry === true, `${name}@${width}: card covers/content/actions do not align: ${symmetry}`);
        }
        if ([390, 960, 1280, 1600, 2560].includes(width)) await page.screenshot({ path: path.join(output, `${name}-${width}.png`) });
        if (width <= 640 && name !== 'detail' && !popular && !directory && !updatesPage) {
          await page.locator('.mfg-updates').evaluateAll(nodes => nodes.forEach(node => node.open = true));
          for (const selector of ['.mfg-announcement details', '.mfg-card details']) {
            const disclosure = page.locator(selector).first();
            if (await disclosure.count()) {
              await disclosure.evaluate(node => node.open = true);
              check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}@${width}: expanded article overflows`);
              await disclosure.evaluate(node => node.open = false);
            }
          }
          await page.locator('.mfg-updates').evaluateAll(nodes => nodes.forEach(node => node.open = false));
          await page.evaluate(() => window.changePreferences({ enabled: true, view: 'list', density: 'compact' }));
          check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}@${width}: compact list overflows`);
          await page.evaluate(() => window.changePreferences({ enabled: true, view: 'grid', density: 'comfortable' }));
        }
      }
      await page.setViewportSize({ width: 1280, height: 1100 });
      if (name !== 'detail' && !popular && !directory && !updatesPage) {
        await page.locator('.mfg-view-button[data-view="list"]').click();
        check(await page.evaluate(() => window.savedPreferences?.modernFitGirl.view === 'list'), `${name}: on-page layout switch did not save the preference`);
        check(await page.locator('.mfg-view-button[data-view="list"]').getAttribute('aria-pressed') === 'true', `${name}: layout control has incorrect selected state`);
        await page.screenshot({ path: path.join(output, `${name}-list.png`) });
        await page.locator('.mfg-view-button[data-view="grid"]').click();
      }
      if (name === 'home') {
        const preview = page.locator('.mfg-cover').first();
        if (await preview.count()) {
          const title = await preview.getAttribute('aria-label');
          const coverBox = await preview.boundingBox();
          if (await preview.locator('img').count()) await preview.locator('img').dispatchEvent('error');
          check(await preview.locator('.mfg-cover-placeholder').isVisible(), 'Failed cover has no placeholder');
          check(Math.abs((await preview.boundingBox()).height - coverBox.height) < 1, 'Failed cover changed card geometry');
          await preview.screenshot({ path: path.join(output, 'cover-placeholder.png') });
          check(await page.locator('.entry-title a').filter({ hasText: title }).count() === 1, 'missing cover removed the original post title');
          check(await page.locator('.mfg-cover').filter({ has: page.locator('img') }).count() > 0, 'missing cover affected unrelated cards');
        }
      }
      const disclosures = page.locator('details.mfg-post-content');
      if (await disclosures.count()) {
        await page.locator('.mfg-updates').evaluateAll(nodes => nodes.forEach(node => node.open = true));
        await disclosures.first().locator('summary').focus();
        await page.keyboard.press('Enter');
        check(await disclosures.first().getAttribute('open') !== null, `${name}: keyboard disclosure failed`);
        check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: opened announcement overflows`);
        await disclosures.first().evaluate(node => node.open = false);
        const game = page.locator('.mfg-card details.mfg-post-content').first();
        if (await game.count()) {
          await game.evaluate(node => node.open = true);
          check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: opened game overflows`);
          const links = await game.locator('a[href]').count();
          check(links > 0, `${name}: expanded content has no original links`);
          await game.evaluate(node => node.open = false);
        }
        await page.locator('.mfg-updates').evaluateAll(nodes => nodes.forEach(node => node.open = false));
      }
      if (popular) {
        const allCards = await page.locator('.mfg-popular .widget-grid-view-image').count();
        const input = page.locator('.mfg-popular-tools input');
        await input.fill('zzzz-no-game-matches');
        check(await page.locator('.mfg-popular .widget-grid-view-image:visible').count() === 0, `${name}: collection filter failed`);
        await input.fill('');
        check(await page.locator('.mfg-popular .widget-grid-view-image:visible').count() === allCards, `${name}: collection filter did not reset`);
      }
      await page.evaluate(() => window.changePreferences({ enabled: true, view: 'list', density: 'compact' }));
      check(await page.locator('html').getAttribute('data-mfg-view') === 'list', `${name}: list preference failed`);
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: list overflows`);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      check(await page.evaluate(() => [...document.querySelectorAll('.mfg-card')].every(node => getComputedStyle(node).transitionDuration === '0s')), `${name}: reduced motion failed`);
      await page.evaluate(() => window.changePreferences({ enabled: false }));
      const restored = await page.locator('#page').evaluate(node => node.outerHTML);
      // Playwright screenshot caret suppression leaves empty style attributes on inputs.
      const normalizeScreenshotSideEffects = html => html.replace(/ style=""/g, '');
      check(normalizeScreenshotSideEffects(restored) === normalizeScreenshotSideEffects(before.html), `${name}: disabling did not restore original #page DOM`);
      await page.evaluate(() => window.changePreferences({ enabled: true }));
      check(await page.locator('.mfg-toolbar').count() === (name === 'detail' || popular || directory || updatesPage ? 0 : 1), `${name}: re-enable duplicated listing controls`);
      check(errors.length === 0, `${name}: extension JS errors: ${errors.join('; ')}`);
      if (name === 'home') {
        await page.locator('#masthead input[name="s"]').fill('cyberpunk');
        await Promise.all([page.waitForURL(url => url.searchParams.get('s') === 'cyberpunk', { timeout: 10000 }), page.locator('#masthead .search-submit').click()]);
        check(new URL(page.url()).searchParams.get('s') === 'cyberpunk', 'native GET search did not submit');
      }
      await page.close();
    }

    // Verify 8-game layout (4 top, 4 bottom) and cover hierarchy ordering
    {
      const page8 = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
      const originalCat = fs.readFileSync(path.join(__dirname, 'sources', 'category.html'), 'utf8')
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '');
      await page8.route('**/*', route => {
        const req = route.request();
        if (req.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: originalCat });
        return route.abort();
      });
      await page8.goto('https://fitgirl-repacks.site/tag/open-world/page/14/');
      // Trim to exactly 8 repacks, and remove cover from articles 0 and 2 so they need hierarchy reordering
      await page8.evaluate(() => {
        const articles = [...document.querySelectorAll('#content > article')];
        articles.slice(8).forEach(a => a.remove());
        const img0 = articles[0].querySelector('img.alignleft');
        if (img0) img0.remove();
        const img2 = articles[2].querySelector('img.alignleft');
        if (img2) img2.remove();
      });
      const before8 = await page8.locator('#page').evaluate(node => node.outerHTML);
      await page8.addStyleTag({ content: css });
      await page8.evaluate(() => {
        const listeners = [];
        window.chrome = { runtime: { sendMessage: (msg, cb) => { if (typeof cb === 'function') cb({}); }, getURL: p => new URL(`/__mfg/${p}`, location.origin).href }, storage: { local: { get: (_, cb) => cb({}), set: (_, cb) => cb() }, onChanged: { addListener: l => listeners.push(l) } } };
        window.changePreferences = v => listeners.forEach(l => l({ modernFitGirl: { newValue: v } }, 'local'));
      });
      await page8.addScriptTag({ content: enhancement });

      // 1. Check 4 columns layout: 4 on top, 4 on bottom
      for (const w of [1280, 1600, 2560]) {
        await page8.setViewportSize({ width: w, height: 1100 });
        const cols = await page8.evaluate(() => getComputedStyle(document.querySelector('#content')).gridTemplateColumns.split(' ').length);
        check(cols === 4, `8-game page@${w}: expected 4 columns (4 top, 4 bottom), got ${cols}`);
        const rows = await page8.locator('#content > .mfg-card').evaluateAll(cards => {
          const tops = cards.map(c => Math.round(c.getBoundingClientRect().top));
          return { topRow: tops.slice(0, 4), bottomRow: tops.slice(4, 8) };
        });
        check(new Set(rows.topRow).size === 1, `8-game page@${w}: top 4 cards are not aligned in a single row`);
        check(new Set(rows.bottomRow).size === 1, `8-game page@${w}: bottom 4 cards are not aligned in a single row`);
        check(rows.topRow[0] < rows.bottomRow[0], `8-game page@${w}: top row is not above bottom row`);
      }

      // 2. Check cover hierarchy: games with cover appear first, games without cover are sent to bottom
      const hierarchy = await page8.locator('#content > .mfg-card').evaluateAll(cards => {
        return cards.map(c => c.dataset.mfgCover);
      });
      check(hierarchy.slice(0, 6).every(c => c === 'available'), 'Cover hierarchy: first 6 games should have covers');
      check(hierarchy.slice(6, 8).every(c => c === 'unavailable'), 'Cover hierarchy: last 2 games should be the ones with unavailable covers');

      // 3. Check clean DOM restoration when disabled
      await page8.evaluate(() => window.changePreferences({ enabled: false }));
      const restored8 = await page8.locator('#page').evaluate(node => node.outerHTML);
      const normalizeScreenshot = h => h.replace(/ style=""/g, '');
      check(normalizeScreenshot(restored8) === normalizeScreenshot(before8), '8-game hierarchy page: disabling did not restore original #page DOM');
      await page8.close();
    }
    // Popup controls against a storage stub; no broad extension permissions required.
    const popup = await browser.newPage();
    popup.on('pageerror', error => console.log('popup error', error.message));
    await popup.addInitScript(() => {
      window.chrome = { runtime: {}, storage: { local: { get: (_, cb) => cb({}), set: (value, cb) => { window.saved = value; cb(); } } } };
    });
    await popup.goto(`file:///${path.join(extension, 'popup.html').replaceAll('\\','/')}`);
    await popup.locator('#view').selectOption('list');
    check(await popup.evaluate(() => window.saved?.modernFitGirl.view === 'list'), 'popup did not persist list preference');
    await popup.locator('#enabled').uncheck();
    check(await popup.locator('#view').isDisabled(), 'popup did not disable presentation controls');
    await popup.close();
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`${report.cases.length} captured-DOM viewport cases; ${report.failures.length} failures.`);
  for (const failure of report.failures) console.error(failure);
  if (report.failures.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
