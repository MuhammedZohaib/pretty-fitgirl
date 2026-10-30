/**
 * Regenerates the README screenshots in docs/images using Playwright against locally rendered pages. Developer-only.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const extDir = path.join(root, 'pretty-fitgirl');
const manifest = JSON.parse(fs.readFileSync(path.join(extDir, 'manifest.json'), 'utf8'));
const outDir = path.join(root, 'docs/images');
fs.mkdirSync(outDir, { recursive: true });

const css = manifest.content_scripts[0].css.map(file => fs.readFileSync(path.join(extDir, file), 'utf8')).join('\n');
const js = manifest.content_scripts[0].js.map(file => fs.readFileSync(path.join(extDir, file), 'utf8')).join('\n');

(async () => {
  const executablePath = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : (fs.existsSync('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe') ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' : undefined);

  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {})
  });

  async function capturePage(name, pathname, outName, viewport = { width: 1440, height: 960 }) {
    const original = fs.readFileSync(path.join(root, 'qa/sources', `${name}.html`), 'utf8');
    const html = original.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '');
    const page = await browser.newPage({ viewport });

    await page.route('**/*', route => {
      const request = route.request();
      const bundled = new URL(request.url()).pathname.match(/^\/__mfg\/(assets\/(?:logo\.png|cover-unavailable\.png|fonts\/[a-z-]+\.woff2))$/);
      if (bundled) {
        return route.fulfill({
          contentType: bundled[1].endsWith('.woff2') ? 'font/woff2' : 'image/png',
          body: fs.readFileSync(path.join(extDir, bundled[1]))
        });
      }
      if (request.resourceType() === 'fetch') {
        const fixture = ({ '/blud/': 'az-blud', '/drive-rally/': 'az-drive' })[new URL(request.url()).pathname];
        if (fixture) {
          return route.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.join(root, 'qa/sources', fixture + '.html')) });
        }
      }
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
        return route.fulfill({ contentType: 'text/html', body: html });
      }
      const asset = path.join(root, 'qa/sources/assets', crypto.createHash('sha256').update(request.url()).digest('hex'));
      if (fs.existsSync(asset)) {
        return route.fulfill({ contentType: request.resourceType() === 'stylesheet' ? 'text/css' : 'image/jpeg', body: fs.readFileSync(asset) });
      }
      if (request.url().includes('/themes/twentyfourteen/style.css')) {
        return route.fulfill({ contentType: 'text/css', body: fs.readFileSync(path.join(root, 'qa/sources/theme.css'), 'utf8') });
      }
      const cached = path.join(root, 'qa/sources/images', Buffer.from(request.url()).toString('base64url'));
      if (fs.existsSync(cached)) {
        return route.fulfill({ contentType: 'image/jpeg', body: fs.readFileSync(cached) });
      }
      if (request.resourceType() === 'stylesheet') return route.fulfill({ contentType: 'text/css', body: '' });
      return route.abort();
    });

    await page.goto(`https://fitgirl-repacks.site${pathname}`, { waitUntil: 'load' });
    await page.addStyleTag({ content: css });
    await page.evaluate(() => {
      const data = {};
      window.chrome = {
        runtime: { sendMessage: () => {}, getURL: p => new URL(`/__mfg/${p}`, location.origin).href },
        storage: {
          local: {
            get: (key, cb) => { const res = key === null ? { ...data } : { [key]: data[key] }; cb?.(res); return Promise.resolve(res); },
            set: (val, cb) => { Object.assign(data, val); cb?.(); return Promise.resolve(); },
            remove: (key, cb) => { delete data[key]; cb?.(); return Promise.resolve(); }
          },
          onChanged: { addListener: () => {} }
        }
      };
    });
    await page.addScriptTag({ content: js });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);

    const dest = path.join(outDir, outName);
    await page.screenshot({ path: dest });
    console.log(`Captured ${outName} (${(fs.statSync(dest).size / 1024).toFixed(1)} KB)`);
    await page.close();
  }

  console.log('Generating README preview screenshots...');
  await capturePage('home', '/', 'preview.png', { width: 1440, height: 960 });
  await capturePage('az', '/all-my-repacks-a-z/', 'az-preview.png', { width: 1440, height: 960 });
  await capturePage('detail', '/cyberpunk-2077/', 'detail-preview.png', { width: 1440, height: 960 });

  await browser.close();
  console.log('Done! Screenshots saved to docs/images/');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
