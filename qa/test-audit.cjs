const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('./fixture-fs.cjs');
const path = require('node:path');
const { webcrypto } = require('node:crypto');
const { chromium } = require('playwright');
const ext = path.join(__dirname, '../pretty-fitgirl');
const background = fs.readFileSync(path.join(ext, 'scripts/background.js'), 'utf8');
function worker(fetch) {
  const data = {}, listeners = [];
  const context = vm.createContext({ fetch, AbortController, crypto: webcrypto,
    setTimeout: (fn, delay) => setTimeout(fn, delay / 100), clearTimeout,
    chrome: { storage: { local: {
      get: async keys => keys === null ? { ...data } : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(k => [k, data[k]])),
      set: async values => Object.assign(data, values), remove: async keys => keys.forEach(k => delete data[k])
    } }, runtime: { onStartup: { addListener() {} }, onInstalled: { addListener() {} }, onMessage: { addListener(fn) { listeners.push(fn); } } } }
  });
  vm.runInContext(background, context);
  return { context, data, call: code => vm.runInContext(code, context),
    message(msg, tab = 1) { let response; listeners.forEach(fn => fn(msg, { tab: { id: tab }, url: 'https://fitgirl-repacks.site/' }, value => response = value)); return response; }
  };
}
const json = data => ({ ok: true, json: async () => data });
async function backgroundTests() {
  let gog = 0;
  const success = worker(async url => {
    if (url.includes('catalog.gog')) { gog++; throw new Error('should not be needed'); }
    if (url.includes('IUserReviews')) return json({});
    return json({ items: [{ id: 42, name: 'Example Game' }] });
  });
  const result = await success.call('resolveAll(["Example Game"])');
  assert.equal(result['Example Game'].appid, 42);
  assert.equal(gog, 0, 'Steam success must not wait for GOG');
  assert.equal(success.call('pickBestSteam([{id:1,name:"Unrelated Game"}],"Missing Title")'), null);
  assert.equal(success.call('pickBestSteam([{id:1,name:"Example Game"}],"Example Game 2")'), null);
  assert.equal(success.call('pickBestSteam([{id:1,name:"Example Game 2"}],"Example Game")'), null);
  assert.equal(success.call('pickBestSteam([{id:1,name:"Example Game Soundtrack"}],"Example Game")'), null);
  const transient = worker(async url => url.includes('catalog.gog') ? { ok: false, status: 503 } : json({ items: [] }));
  assert.equal((await transient.call('resolveAll(["Missing"])')).Missing, null);
  assert.equal(Object.keys(transient.data).length, 0, 'Transient failures must not be cached');
  const miss = worker(async url => json(url.includes('catalog.gog') ? { products: [] } : { items: [] }));
  await miss.call('resolveAll(["Missing"])');
  assert.equal(Object.keys(miss.data).length, 1, 'Confirmed misses should be cached');
  const stalled = worker((url, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')))));
  await stalled.call('resolveAll(["Missing"])');
  assert.equal(stalled.call('active'), 0, 'Timeout should release concurrency slots');
  assert.equal(Object.keys(stalled.data).length, 0);
  let calls = 0;
  const dedupe = worker(async url => { calls++; return json({ items: [{ id: 42, name: 'Example Game' }] }); });
  await Promise.all([dedupe.call('resolveAll(["Example Game"])'), dedupe.call('resolveAll([" example game "])')]);
  assert(calls <= 2, 'Normalized duplicates should share artwork and optional rating requests');
  const lease = success.message({ type: 'adultClaim' }, 1);
  assert(lease.token);
  assert(!success.message({ type: 'adultClaim' }, 2).token, 'Second tab must not crawl concurrently');
  assert(success.message({ type: 'adultRenew', token: lease.token }, 1).ok);
  assert(!success.message({ type: 'adultRelease', token: lease.token }, 2).ok);
  success.message({ type: 'adultRelease', token: lease.token }, 1);
  assert(success.message({ type: 'adultClaim' }, 2).token);
  console.log('PASS: artwork matching, transient cache, deadlines, deduplication, cross-tab refresh lease');
}
async function browserTests() {
  const browser = await chromium.launch(require('./browser-options.cjs'));
  try {
    const page = await browser.newPage();
    const detail = fs.readFileSync(path.join(__dirname, 'sources/detail.html'), 'utf8').replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '');
    await page.route('**/*', route => route.request().isNavigationRequest()
      ? route.fulfill({ contentType: 'text/html', body: detail }) : route.abort());
    await page.goto('https://fitgirl-repacks.site/cyberpunk-2077/');
    await page.evaluate(() => {
      const listeners = [];
      window.chrome = { runtime: { getURL: p => p, sendMessage: (m, cb) => cb({}) }, storage: {
        local: { get: (k, cb) => { cb?.({}); return Promise.resolve({}); } }, onChanged: { addListener: fn => listeners.push(fn) }
      } };
      window.setPrefs = prefs => listeners.forEach(fn => fn({ modernFitGirl: { newValue: prefs } }, 'local'));
    });
    const manifest = JSON.parse(fs.readFileSync(path.join(ext, 'manifest.json'), 'utf8'));
    for (const file of manifest.content_scripts[0].css) await page.addStyleTag({ content: fs.readFileSync(path.join(ext, file), 'utf8') });
    for (const file of manifest.content_scripts[0].js) await page.addScriptTag({ content: fs.readFileSync(path.join(ext, file), 'utf8') });
    const metadata = await page.evaluate(() => {
      const body = document.createElement('div');
      body.innerHTML = '<p>Original Size: 100 GB<br>Repack Size: 25 GB</p><ul><li>Based on release</li><li>HDD space after installation: 49.5 GB</li><li>Installation takes: 1.5 hours</li><li>At least 4 GB RAM</li></ul>';
      return MFGRepack.metadata(body).values;
    });
    assert.equal(metadata.disk, '49.5 GB'); assert.equal(metadata.installTime, '1.5 hours');
    await page.locator('#mfg-tab-dl').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('[role=tab][aria-selected=true]').getAttribute('id'), 'mfg-tab-ft');
    await page.keyboard.press('End');
    assert.equal(await page.locator('[role=tab][aria-selected=true]').getAttribute('id'), await page.locator('[role=tab]').last().getAttribute('id'));
    await page.evaluate(() => { location.hash = 'mfg-panel-sc'; });
    await page.waitForFunction(() => !document.querySelector('#mfg-panel-sc').hidden);
    assert.equal(await page.locator('[role=tab][aria-selected=true]').getAttribute('id'), 'mfg-tab-sc');
    await page.locator('#mfg-tab-dl').click();
    await page.evaluate(() => { location.hash = ''; history.replaceState(null, '', '#mfg-panel-sc'); window.setPrefs({ enabled: false }); window.setPrefs({ enabled: true }); });
    assert.equal(await page.locator('#mfg-panel-sc').getAttribute('hidden'), null, 'Initial hash must reveal its tab');
    await page.locator('#mfg-tab-sc').click();
    const trigger = page.locator('#mfg-panel-sc a:has(img)').first();
    await trigger.focus(); await trigger.click();
    assert.equal(await page.evaluate(() => document.activeElement.className), 'mfg-lightbox-close');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement.className), 'mfg-lightbox-link');
    await page.keyboard.press('Escape');
    assert(await trigger.evaluate(node => node === document.activeElement), 'Closing modal should restore focus');

    // An actual cross-origin widget without a detail-page receiver must use its local fallback.
    const host = await browser.newPage();
    await host.route('**/*', route => route.fulfill({ contentType: 'text/html', body: route.request().url().includes('tolstoy') ? '<a id="image" href="https://images.example/test.jpg"><img src="https://images.example/test.jpg"></a>' : '<iframe src="https://web.tolstoycomments.com/widget/index.html"></iframe>' }));
    await host.goto('https://fitgirl-repacks.site/');
    const frame = host.frames().find(frame => frame.url().includes('tolstoy'));
    await frame.evaluate(() => {
      const listeners = [];
      window.chrome = { runtime: { getURL: p => p }, storage: { local: { get: (k, cb) => cb({ modernFitGirl: { enabled: false } }) }, onChanged: { addListener: fn => listeners.push(fn) } } };
      window.toggleTheme = enabled => listeners.forEach(fn => fn({ modernFitGirl: { newValue: { enabled } } }, 'local'));
    });
    await frame.addScriptTag({ content: fs.readFileSync(path.join(ext, 'scripts/comments-frame.js'), 'utf8') });
    assert.equal(await frame.evaluate(() => {
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      // Avoid navigation while checking the extension's capture listener.
      const img = document.querySelector('img'); img.parentElement.removeAttribute('href');
      img.dispatchEvent(event); return event.defaultPrevented;
    }), false, 'Disabled theme must leave image clicks alone');
    await frame.evaluate(() => { window.toggleTheme(true); document.querySelector('img').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
    await frame.waitForSelector('.mfg-frame-lightbox-open', { state: 'attached' });
    assert.equal(await frame.evaluate(() => document.activeElement.className), 'mfg-frame-lightbox-close');
    await frame.evaluate(() => window.toggleTheme(false));
    assert.equal(await frame.locator('.mfg-frame-lightbox-open').count(), 0);
    console.log('PASS: decimal metadata, keyboard tabs, modal focus, disabled comments, iframe fallback');
    await adultTests(browser, manifest);
    await directoryTimeoutTest(browser);
  } finally { await browser.close(); }
}
async function adultTests(browser, manifest) {
  const page = await browser.newPage();
  let state = {}, requests = 0;
  await page.exposeFunction('readStore', key => ({ [key]: state[key] }));
  await page.exposeFunction('writeStore', value => Object.assign(state, value));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/tag/adult/')) {
      requests++;
      return route.fulfill({ status: url.pathname.includes('page/2') ? 503 : 200, contentType: 'text/html', body: '<article class="hentry"><h2 class="entry-title"><a href="/adult-game/">Adult</a></h2></article><nav class="paging-navigation"><a class="next" href="/tag/adult/page/2/">Next</a></nav>' });
    }
    if (route.request().isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: '<body class="page"><div id="page"><header id="masthead"></header><main id="main"><div id="primary"><div id="content"><article class="hentry"><h2 class="entry-title"><a href="/adult-game/">Adult</a></h2></article></div></div></main></div></body>' });
    return route.abort();
  });
  await page.goto('https://fitgirl-repacks.site/');
  await page.evaluate(() => {
    const listeners = [];
    window.chrome = { runtime: { getURL: p => p, sendMessage: (msg, cb) => cb(msg.type === 'adultClaim' ? { token: 'test' } : { ok: true }) }, storage: {
      local: { get: (key, callback) => {
        const p = key === 'modernFitGirl' ? Promise.resolve({ modernFitGirl: { hideAdult: true } }) : window.readStore(key);
        if (callback) p.then(callback); return p;
      }, set: value => window.writeStore(value) }, onChanged: { addListener: fn => listeners.push(fn) }
    } };
    window.toggleTheme = enabled => listeners.forEach(fn => fn({ modernFitGirl: { newValue: { enabled, hideAdult: true } } }, 'local'));
  });
  for (const file of manifest.content_scripts[0].js) await page.addScriptTag({ content: fs.readFileSync(path.join(ext, file), 'utf8') });
  for (let i = 0; i < 100 && !state['mfg.adult.v1']; i++) await page.waitForTimeout(50);
  assert(state['mfg.adult.v1'], 'Archive refresh did not persist progress');
  assert.equal(state['mfg.adult.v1'].complete, false);
  assert.equal(state['mfg.adult.v1'].time, 0);
  assert.equal(state['mfg.adult.v1'].nextPage, 2);
  assert(state['mfg.adult.v1'].paths.includes('/adult-game'));
  assert.equal(requests, 2, 'Failed archive must stop and back off');
  await page.evaluate(() => window.toggleTheme(false));
  assert.equal(await page.locator('[data-mfg-adult-hidden]').count(), 0);
  console.log('PASS: partial adult archive is resumable, never fresh, and filters restore on disable');
}
async function directoryTimeoutTest(browser) {
  const page = await browser.newPage();
  await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<main id="content"><div class="entry-content"><ul class="lcp_catlist">' + [1,2,3,4].map(n => `<li><a href="/game-${n}/">Game ${n}</a></li>`).join('') + '</ul></div></main>' }));
  await page.goto('https://fitgirl-repacks.site/all-my-repacks-a-z/');
  await page.evaluate(() => {
    window.chrome = { storage: { local: { get: async () => ({}), set: async () => {} } } };
    window.started = 0; window.fallbacks = 0;
    const timer = window.setTimeout.bind(window);
    window.setTimeout = (fn, delay) => timer(fn, delay === 8000 ? 20 : delay);
    window.fetch = (url, { signal }) => { window.started++; return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))); };
    window.MFGRepack = { cover: () => document.createElement('div'), showSpinner() {}, hideSpinner() {}, attachSteamRating() {}, loadSteamCover() { window.fallbacks++; } };
    window.IntersectionObserver = class { constructor(fn) { this.fn = fn; } observe(target) { timer(() => this.fn([{target, isIntersecting: true}]), 0); } unobserve() {} disconnect() {} };
  });
  await page.addScriptTag({ content: fs.readFileSync(path.join(ext, 'scripts/directory.js'), 'utf8') });
  await page.evaluate(() => { window.undo = []; MFGDirectory.mount(document.querySelector('#content'), window.undo); });
  await page.waitForFunction(() => window.fallbacks === 4);
  assert.equal(await page.evaluate(() => window.started), 4, 'Timed-out requests must release all directory slots');
  await page.evaluate(() => window.undo.reverse().forEach(fn => fn()));
  await page.close();
  console.log('PASS: directory request deadlines release queued cards');
}
(async () => { await backgroundTests(); await browserTests(); })().catch(error => { console.error(error); process.exitCode = 1; });
