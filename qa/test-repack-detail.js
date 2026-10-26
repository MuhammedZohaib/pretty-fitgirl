/**
 * Ad-hoc Playwright script: renders a repack detail page with the extension styles for manual inspection. Not shipped.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  
  const manifest = JSON.parse(fs.readFileSync('pretty-fitgirl/manifest.json', 'utf8'));
  const css = manifest.content_scripts[0].css.map(file => fs.readFileSync(path.join('pretty-fitgirl', file), 'utf8')).join('\n');
  const js = manifest.content_scripts[0].js.map(file => fs.readFileSync(path.join('pretty-fitgirl', file), 'utf8')).join('\n');
  const html = fs.readFileSync('qa/sources/detail.html', 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

  await page.route('**/*', route => {
    if (route.request().isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: html });
    if (route.request().url().includes('theme.css') || route.request().url().includes('style.css')) {
      return route.fulfill({ contentType: 'text/css', body: fs.readFileSync('qa/sources/theme.css', 'utf8') });
    }
    return route.abort();
  });

  await page.goto('https://fitgirl-repacks.site/cyberpunk-2077/');
  await page.addStyleTag({ content: css });
  await page.evaluate(() => {
    window.chrome = {
      runtime: { sendMessage: () => {}, getURL: p => p },
      storage: {
        local: { get: (k, cb) => cb({}), set: (v, cb) => cb(), remove: (k, cb) => cb() },
        onChanged: { addListener: () => {} }
      }
    };
  });
  await page.addScriptTag({ content: js });
  await page.waitForTimeout(500);

  // Take a full screenshot
  await page.screenshot({ path: 'qa/output/detail-test-current.png', fullPage: true });
  console.log('Saved qa/output/detail-test-current.png');

  await browser.close();
})();
