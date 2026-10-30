/**
 * Playwright test: the upcoming-repacks poster grid and its Steam/GOG artwork resolution. Not shipped.
 */
const fs = require('./fixture-fs.cjs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const extension = path.join(root, 'pretty-fitgirl');
const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json'), 'utf8'));

(async () => {
  console.log('Testing Steam cover fallback and Upcoming Repacks enhancement...');

  const browser = await chromium.launch(require('./browser-options.cjs'));

  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    const homeHtml = fs.readFileSync(path.join(__dirname, 'sources/home.html'), 'utf8')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '');

    await page.route('**/*', route => {
      const req = route.request();
      if (req.isNavigationRequest() && req.frame() === page.mainFrame()) {
        return route.fulfill({ contentType: 'text/html', body: homeHtml });
      }
      if (req.resourceType() === 'image') {
        return route.fulfill({
          contentType: 'image/png',
          body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
        });
      }
      return route.abort();
    });

    await page.goto('https://fitgirl-repacks.site/upcoming-repacks-10/');

    // The live page can exceed the old 60-card boundary. Add eleven fixtures so
    // the regression proves every announced title is converted.
    await page.evaluate(() => {
      const existing = [...document.querySelectorAll('article .entry-content span')].filter(span => /^[\s\u00a0]*[→↣⇢➔➜➤➡⮕➝➢]+/.test(span.textContent || ''));
      const container = existing[0]?.parentElement;
      if (!container) return;
      for (let index = 1; index <= 11; index++) {
        const span = document.createElement('span');
        span.textContent = `⇢ Overflow Test Game ${index}`;
        container.append(span, document.createElement('br'));
      }
    });

    const css = manifest.content_scripts[0].css
      .map(file => fs.readFileSync(path.join(extension, file), 'utf8'))
      .join('\n');
    const js = manifest.content_scripts[0].js
      .map(file => fs.readFileSync(path.join(extension, file), 'utf8'))
      .join('\n');

    await page.addStyleTag({ content: css });

    await page.evaluate(() => {
      const listeners = [];
      const data = {};
      window.chrome = {
        runtime: {
          sendMessage: (msg, cb) => {
            if (msg.type === 'resolveGames') {
              const res = {};
              for (const title of msg.titles) {
                res[title] = {
                  source: 'steam',
                  appid: 12345,
                  name: title,
                  rating: { percent: 87, desc: 'Very Positive', total: 24000 },
                  poster: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/12345/library_600x900.jpg`,
                  header: `https://cdn.cloudflare.steamstatic.com/steam/apps/12345/header.jpg`,
                  tiny: `https://cdn.cloudflare.steamstatic.com/steam/apps/12345/capsule_sm_120.jpg`
                };
              }
              if (typeof cb === 'function') setTimeout(() => cb(res), 10);
            } else if (typeof cb === 'function') {
              cb({});
            }
          },
          getURL: path => new URL(`/__mfg/${path}`, location.origin).href
        },
        storage: {
          local: {
            get: (key, cb) => {
              const res = key === null ? { ...data } : { [key]: data[key] };
              cb?.(res);
              return Promise.resolve(res);
            },
            set: (val, cb) => {
              Object.assign(data, val);
              cb?.();
              listeners.forEach(l => l(Object.fromEntries(Object.entries(val).map(([k, v]) => [k, { newValue: v }])), 'local'));
            }
          },
          onChanged: { addListener: l => listeners.push(l) }
        }
      };
      window.changePreferences = v => listeners.forEach(l => l({ modernFitGirl: { newValue: v } }, 'local'));
    });

    await page.addScriptTag({ content: js });
    await page.waitForTimeout(500);

    // Verify Upcoming Repacks uses the same artwork-and-title card contract.
    const upcomingCards = await page.locator('.mfg-upcoming-card-item').count();
    console.log(`Found ${upcomingCards} upcoming repack cards`);
    assert.equal(upcomingCards, 71, 'Not every upcoming repack was converted into a card');
    const upcomingNav = page.locator('.mfg-browse-sidebar .mfg-nav-link', { hasText: 'Upcoming repacks' });
    assert.equal(await upcomingNav.count(), 1, 'Upcoming repacks was not added to the Browse sidebar');
    assert.equal(await upcomingNav.getAttribute('aria-current'), 'page', 'Upcoming sidebar link was not marked current');
    assert.equal(await upcomingNav.getAttribute('href'), '/upcoming-repacks-10/');
    assert(await page.locator('.mfg-upcoming-card > .entry-header').evaluate(header => header.hidden), 'Original Upcoming heading was not hidden');
    assert.equal(await page.locator('.mfg-upcoming-page-header').count(), 1, 'Dedicated upcoming-page header was not created');
    assert.equal(await page.locator('.mfg-upcoming-filter').count(), 1, 'Upcoming-page filter was not created');
    const upcomingFlow = await page.locator('.mfg-upcoming-container').evaluate(container => {
      const style = getComputedStyle(container);
      return { maxHeight: style.maxHeight, overflowY: style.overflowY };
    });
    assert.deepEqual(upcomingFlow, { maxHeight: 'none', overflowY: 'visible' }, 'Upcoming cards are still trapped in an internal scrolling container');
    assert.match(await page.locator('.mfg-upcoming-page-status').textContent(), new RegExp(`^${upcomingCards} games currently listed$`));
    const unconverted = await page.locator('.mfg-upcoming-card .entry-content span').evaluateAll(spans => spans.filter(span => /^[\s\u00a0]*[→↣⇢➔➜➤➡⮕➝➢]+/.test(span.textContent || '') && !span.closest('.mfg-upcoming-card-item')).length);
    assert.equal(unconverted, 0, 'Upcoming game text remained outside the card grid');
    await page.locator('.mfg-upcoming-filter').evaluate(field => { field.value = 'definitely-no-such-game'; field.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal(await page.locator('.mfg-upcoming-card-item').evaluateAll(cards => cards.filter(card => !card.hidden).length), 0, 'Upcoming-page filter did not hide non-matches');
    assert.equal(await page.locator('.mfg-upcoming-page-status').textContent(), `0 of ${upcomingCards} games`);
    await page.locator('.mfg-upcoming-filter').evaluate(field => { field.value = ''; field.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal(await page.locator('.mfg-upcoming-card-item').evaluateAll(cards => cards.filter(card => !card.hidden).length), upcomingCards, 'Clearing the upcoming-page filter did not restore cards');

    const firstCard = page.locator('.mfg-upcoming-card-item').first();
    assert(await firstCard.evaluate(card => card.classList.contains('mfg-game-card')), 'Upcoming card is missing the shared game-card class');
    const posterLink = firstCard.locator('.mfg-upcoming-poster-link');
    const firstHref = await posterLink.getAttribute('href');
    console.log('Sample card YouTube gameplay link:', firstHref);
    assert(firstHref.includes('youtube.com/results?search_query='), 'Poster link is not a YouTube search');
    assert(firstHref.includes('&sp=CAMSAhAB'), 'YouTube search is not sorted by view count');

    assert.equal(await firstCard.locator('img').count(), 0, 'Collapsed announcements should not fetch posters');
    await firstCard.evaluate(card => { for (let node = card.parentElement; node; node = node.parentElement) if (node.matches('details')) node.open = true; });
    await firstCard.scrollIntoViewIfNeeded();
    const firstImg = firstCard.locator('.mfg-upcoming-poster-img');
    await firstImg.waitFor();
    assert(await page.locator('.mfg-upcoming-poster-img').count() < upcomingCards, 'Offscreen posters loaded eagerly');
    assert.equal(await firstImg.getAttribute('loading'), 'lazy');
    assert(await firstImg.count() > 0, 'Vertical poster image was not injected in card');
    const imgSrc = await firstImg.getAttribute('src');
    assert(imgSrc.includes('library_600x900.jpg') || imgSrc.includes('steamstatic.com'), 'Card image is not a vertical poster');

    assert.equal(await firstCard.locator('.mfg-upcoming-play-badge, .mfg-upcoming-badges, .mfg-upcoming-action-btn').count(), 0, 'Upcoming card contains secondary metadata or a duplicate action');
    assert((await firstCard.locator('.mfg-upcoming-title').innerText()).trim(), 'Upcoming card title is missing');

    // Check posterBox HTML
    const posterHtml = await firstCard.locator('.mfg-upcoming-poster-box').innerHTML();
    console.log('Sample poster box HTML:\n', posterHtml);

    const rating = firstCard.locator('.mfg-steam-rating');
    await rating.waitFor();
    assert.equal(await rating.locator('.mfg-rating-percent').innerText(), '87%', 'Steam rating percentage is not visible');
    assert.notEqual(await rating.evaluate(node => getComputedStyle(node).display), 'none', 'Steam rating is hidden');

    // Original artwork is unlabeled; fetched artwork discloses its provider on hover.
    const originalBadges = await page.locator('.mfg-cover-source-original').count();
    console.log(`Original cover badges: ${originalBadges}`);
    assert.equal(originalBadges, 0, 'Original artwork should not have a provider badge');

    const steamBadges = await page.locator('.mfg-cover-source-steam').count();
    console.log(`Steam source badges: ${steamBadges}`);
    assert(steamBadges > 0, 'No Steam source badges found');
    const steamBadge = firstCard.locator('.mfg-cover-source-steam');
    assert.equal(await steamBadge.innerText(), 'Fetched from Steam');
    assert.equal(await steamBadge.evaluate(node => getComputedStyle(node).opacity), '0', 'Fetched artwork label should rest hidden');
    await firstCard.locator('.mfg-upcoming-poster-box').hover();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.mfg-upcoming-card-item .mfg-cover-source-steam')).opacity === '1');
    const sourcePolicy = await page.evaluate(() => {
      const probe = document.createElement('div');
      MFGRepack.setSourceBadge(probe, 'gog');
      const gog = probe.querySelector('.mfg-cover-source-gog')?.textContent;
      MFGRepack.setSourceBadge(probe, 'original');
      return { gog, originalLabels: probe.querySelectorAll('.mfg-cover-badge').length };
    });
    assert.deepEqual(sourcePolicy, { gog: 'Fetched from GOG', originalLabels: 0 });

    // Verify Clean Restoration on Disable
    await page.evaluate(() => window.changePreferences({ enabled: false }));
    await page.waitForTimeout(100);

    const remainingCards = await page.locator('.mfg-upcoming-card-item').count();
    assert.equal(remainingCards, 0, 'Upcoming repack cards remained after disabling extension');
    assert.equal(await page.locator('.mfg-cover').count(), 0, 'Cover frames remained after disabling extension');

    // Verify Re-enable
    await page.evaluate(() => window.changePreferences({ enabled: true }));
    await page.waitForTimeout(200);
    assert(await page.locator('.mfg-upcoming-card-item').count() > 0, 'Upcoming repack cards did not restore when re-enabled');

    assert.deepEqual(errors, [], 'Page errors detected during test');
    console.log('PASS: Steam artwork fallback and shared artwork/title cards fully validated!');
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
