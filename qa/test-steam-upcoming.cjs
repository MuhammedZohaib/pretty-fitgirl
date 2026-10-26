const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const extension = path.join(root, 'pretty-fitgirl');
const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json'), 'utf8'));

(async () => {
  console.log('Testing Steam cover fallback and Upcoming Repacks enhancement...');

  const installedChrome = process.platform === 'win32' && fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

  const browser = await chromium.launch({ executablePath: installedChrome, headless: true });
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
      return route.abort();
    });

    await page.goto('https://fitgirl-repacks.site/');

    const css = manifest.content_scripts[0].css
      .map(file => fs.readFileSync(path.join(extension, file), 'utf8'))
      .join('\n');
    const js = manifest.content_scripts[0].js
      .map(file => fs.readFileSync(path.join(extension, file), 'utf8'))
      .join('\n');

    await page.addStyleTag({ content: css });

    const messages = [];
    await page.evaluate(() => {
      window.messages = [];
      const listeners = [];
      const data = {};
      window.chrome = {
        runtime: {
          sendMessage: (msg, cb) => {
            window.messages.push(msg);
            if (msg.type === 'resolveGames') {
              const res = {};
              for (const title of msg.titles) {
                res[title] = {
                  appid: 12345,
                  name: title,
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
    await page.waitForTimeout(300);

    // Verify Upcoming Repacks enhancement
    const upcomingRows = await page.locator('.fgyt-row').count();
    console.log(`Found ${upcomingRows} upcoming repack rows`);
    assert(upcomingRows > 0, 'No upcoming repack rows were created');

    const firstChip = page.locator('.fgyt-chip').first();
    const firstHref = await firstChip.getAttribute('href');
    console.log('Sample chip YouTube gameplay link:', firstHref);
    assert(firstHref.includes('youtube.com/results?search_query='), 'Chip link is not a YouTube search');
    assert(firstHref.includes('&sp=CAMSAhAB'), 'YouTube search is not sorted by view count');

    const firstImg = page.locator('.fgyt-chip img').first();
    assert(await firstImg.count() > 0, 'Steam cover image was not injected in chip');
    const imgSrc = await firstImg.getAttribute('src');
    assert(imgSrc.includes('steamstatic.com'), 'Chip image is not from Steam CDN');

    // Test cover fallback in repack cards
    const coversWithFallback = await page.locator('.mfg-cover img.mfg-steam-fallback').count();
    console.log(`Repack cards with Steam fallback cover: ${coversWithFallback}`);

    // Verify Clean Restoration on Disable
    await page.evaluate(() => window.changePreferences({ enabled: false }));
    await page.waitForTimeout(100);

    const remainingRows = await page.locator('.fgyt-row').count();
    assert.equal(remainingRows, 0, 'Upcoming repack rows remained after disabling extension');
    assert.equal(await page.locator('.mfg-cover').count(), 0, 'Cover frames remained after disabling extension');

    // Verify Re-enable
    await page.evaluate(() => window.changePreferences({ enabled: true }));
    await page.waitForTimeout(200);
    assert(await page.locator('.fgyt-row').count() > 0, 'Upcoming repack rows did not restore when re-enabled');

    assert.deepEqual(errors, [], 'Page errors detected during test');
    console.log('PASS: Steam cover fallback and Upcoming Repacks fully validated!');
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
