const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const script = fs.readFileSync(path.join(__dirname, '../pretty-fitgirl/scripts/prefetch.js'), 'utf8');
const waitFor = async (page, predicate, message) => {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (predicate()) return;
    await page.waitForTimeout(50);
  }
  assert.fail(message);
};

(async () => {
  const browser = await chromium.launch(require('./browser-options.cjs'));
  try {
    const documentRequests = [];
    const imageRequests = [];
    const page = await browser.newPage();
    await page.route('**/*', route => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.isNavigationRequest()) {
        return route.fulfill({ contentType: 'text/html', body: `
          <aside class="mfg-browse-sidebar"><nav>
            <a id="popular" href="/popular-repacks/">Popular</a>
            <a id="external" href="https://example.com/outside">Outside</a>
          </nav></aside>
          <nav class="paging-navigation"><a class="next" href="/page/2/">Next</a></nav>` });
      }
      if (request.resourceType() === 'fetch') {
        documentRequests.push(url.href);
        const images = Array.from({ length: 20 }, (_, index) => `<img src="/assets/page-${url.pathname.replace(/\D/g, '') || 'x'}-${index}.jpg">`).join('');
        return route.fulfill({ contentType: 'text/html', body: `<main id="content">
          <article class="category-lossless-repack"><h2 class="entry-title">Prefetched Adventure – FitGirl Repack</h2></article>
          <article class="category-lossless-repack"><h2 class="entry-title">Warm Strategy Collection</h2></article>
          ${images}
        </main>` });
      }
      if (request.resourceType() === 'image') {
        imageRequests.push(url.href);
        return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') });
      }
      return route.abort();
    });
    await page.goto('https://fitgirl-repacks.site/');
    await page.evaluate(() => {
      window.prefetchMessages = [];
      window.MFGRepack = { searchName: title => title.replace(/\s*[–—-]\s*FitGirl Repack$/i, '').trim() };
      window.chrome = { runtime: {
        lastError: null,
        sendMessage: (message, callback) => {
          window.prefetchMessages.push(message);
          const resolved = {};
          for (const [index, title] of message.titles.entries()) resolved[title] = {
            rating: { percent: 91, desc: 'Very Positive', total: 1200 },
            poster: `https://cdn.example.test/game-${index}-poster.jpg`,
            header: `https://cdn.example.test/game-${index}-header.jpg`,
            banner: `https://cdn.example.test/game-${index}-banner.jpg`
          };
          setTimeout(() => callback(resolved), 10);
        }
      } };
    });
    await page.addScriptTag({ content: script });
    await page.evaluate(() => { window.prefetchCleanup = []; MFGPrefetch.mount(window.prefetchCleanup, () => true); });

    await waitFor(page, () => documentRequests.some(url => new URL(url).pathname === '/page/2/'), 'First listing page did not automatically prefetch page 2');
    await waitFor(page, () => imageRequests.filter(url => /\/assets\/page-2-/.test(new URL(url).pathname)).length === 20, 'Prefetched document did not warm all destination images');
    await waitFor(page, () => imageRequests.some(url => /game-0-banner\.jpg$/.test(url)), 'Prefetch did not warm resolved banner artwork');
    const resolution = await page.evaluate(() => window.prefetchMessages.find(message => message.type === 'resolveGames'));
    assert.deepEqual(resolution.titles, ['Prefetched Adventure', 'Warm Strategy Collection'], 'Prefetch did not resolve every destination game');
    assert(imageRequests.some(url => /game-0-poster\.jpg$/.test(url)), 'Prefetch did not warm resolved poster artwork');
    assert(imageRequests.some(url => /game-0-header\.jpg$/.test(url)), 'Prefetch did not warm resolved header artwork');

    await page.locator('#popular').hover();
    await waitFor(page, () => documentRequests.some(url => new URL(url).pathname === '/popular-repacks/'), 'Hovering navigation did not prefetch its destination');
    await page.locator('body').hover({ position: { x: 1, y: 1 } });
    await page.locator('#popular').focus();
    await page.waitForTimeout(150);
    assert.equal(documentRequests.filter(url => new URL(url).pathname === '/popular-repacks/').length, 1, 'Hover/focus prefetch was not deduplicated');
    assert(!documentRequests.some(url => new URL(url).hostname === 'example.com'), 'Cross-origin navigation was prefetched');
    assert.equal(await page.evaluate(() => MFGPrefetch.pageNumber('/page/8/')), 8);
    assert.equal(await page.evaluate(() => MFGPrefetch.pageNumber('/all-my-repacks-a-z/?lcp_page0=3')), 3);
    await page.evaluate(() => window.prefetchCleanup.splice(0).reverse().forEach(undo => undo()));

    const saverRequests = [];
    const saver = await browser.newPage();
    await saver.route('**/*', route => {
      const request = route.request();
      if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: '<nav class="paging-navigation"><a class="next" href="/page/2/">Next</a></nav>' });
      if (request.resourceType() === 'fetch') saverRequests.push(request.url());
      return route.abort();
    });
    await saver.goto('https://fitgirl-repacks.site/');
    await saver.evaluate(() => Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true, effectiveType: '4g' } }));
    await saver.addScriptTag({ content: script });
    await saver.evaluate(() => { window.prefetchCleanup = []; MFGPrefetch.mount(window.prefetchCleanup, () => true); });
    await saver.waitForTimeout(800);
    assert.equal(saverRequests.length, 0, 'Data Saver should disable automatic prefetch');
    await saver.close();

    console.log('PASS: page-2 idle prefetch, complete destination artwork/rating resolution, hover/focus deduplication, same-origin policy, and Data Saver backoff');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
