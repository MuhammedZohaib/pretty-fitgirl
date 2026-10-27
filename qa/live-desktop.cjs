// Optional read-only live-site QA in a fresh profile. Does not start downloads or post forms.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const extension = path.resolve(__dirname, '../pretty-fitgirl');
const output = path.join(__dirname, 'output');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const context = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'mfg-live-')), {
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
    viewport: { width: 1600, height: 1100 },
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
  });
  const report = { pages: [], errors: [] };
  try {
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    for (const [name, url] of [['home', 'https://fitgirl-repacks.site/'], ['detail', 'https://fitgirl-repacks.site/cyberpunk-2077/'], ['page2', 'https://fitgirl-repacks.site/page/2/'], ['popular', 'https://fitgirl-repacks.site/popular-repacks/'], ['monthly', 'https://fitgirl-repacks.site/pop-repacks/'], ['yearly', 'https://fitgirl-repacks.site/popular-repacks-of-the-year/'], ['az', 'https://fitgirl-repacks.site/all-my-repacks-a-z/']]) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.locator('html.mfg-on #content').waitFor({ timeout: 15000 });
        if (name === 'az') await page.waitForFunction(() => document.querySelectorAll('.mfg-directory-card[data-artwork="loaded"]').length >= 8, null, { timeout: 30000 }).catch(() => {});
        await page.evaluate(() => document.fonts.ready);
        await page.waitForFunction(() => [...document.querySelectorAll('.mfg-cover img, .mfg-popular .widget-grid-view-image img')].filter(image => { const rect = image.getBoundingClientRect(); return rect.top < innerHeight && rect.bottom > 0; }).every(image => image.complete), null, { timeout: 15000 }).catch(() => {});
        await page.screenshot({ path: path.join(output, `live-${name}.png`), timeout: 15000 });
        const metrics = await page.evaluate(() => ({
          title: document.title,
          articles: document.querySelectorAll('#content > article').length,
          overflow: document.documentElement.scrollWidth - innerWidth,
          toolbar: Boolean(document.querySelector('.mfg-toolbar')),
          detailHero: Boolean(document.querySelector('.mfg-detail-hero')),
          popularGames: document.querySelectorAll('#content.mfg-popular .widget-grid-view-image').length,
          sidebars: document.querySelectorAll('.mfg-browse-sidebar, .mfg-promo-sidebar').length,
          ungroupedAnnouncements: document.querySelectorAll('#content > .mfg-announcement').length,
          inlineGameDisclosures: document.querySelectorAll('.mfg-game details').length,
          gameCards: document.querySelectorAll('.mfg-game').length,
          coverFrames: document.querySelectorAll('.mfg-game > .mfg-cover').length,
          cardFacts: document.querySelectorAll('.mfg-card-facts').length,
          structuredOverview: Boolean(document.querySelector('.mfg-game-info')),
          directoryCards: document.querySelectorAll('.mfg-directory-card').length,
          directoryArtwork: document.querySelectorAll('.mfg-directory-card[data-artwork="loaded"]').length,
          removedControls: document.querySelectorAll('.mfg-library-nav, .mfg-save, .mfg-detail-nav').length
        }));
        if (name === 'detail') {
          const spoiler = page.locator('#content .su-spoiler').first();
          if (await spoiler.count()) {
            const wasClosed = await spoiler.evaluate(node => node.classList.contains('su-spoiler-closed'));
            await spoiler.locator('.su-spoiler-title').click({ timeout: 10000 });
            metrics.nativeSpoilerChanged = await spoiler.evaluate(node => node.classList.contains('su-spoiler-closed')) !== wasClosed;
          }
        }
        if (metrics.overflow > 1) throw new Error('Live page has horizontal overflow');
        report.pages.push({ name, url, ...metrics });
        console.log(name, JSON.stringify(metrics));
      } catch (error) { report.pages.push({ name, url, error: error.message }); console.log(`${name}: ${error.message.split('\n')[0]}`); }
    }
    fs.writeFileSync(path.join(output, 'live-report.json'), JSON.stringify(report, null, 2));
    if (report.errors.length || report.pages.some(page => page.error || page.sidebars !== 2 || (page.name === 'detail' && !page.detailHero))) process.exitCode = 1;
  } finally { await context.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
