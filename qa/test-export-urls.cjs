/**
 * Playwright test: the "Download .txt" buttons on a repack page export the expected hoster URL lists. Not shipped.
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const extension = path.join(root, 'pretty-fitgirl');
const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json'), 'utf8'));

(async () => {
  console.log('Testing direct download URLs export to .txt button...');

  const installedChrome = process.platform === 'win32' && fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

  const browser = await chromium.launch({ executablePath: installedChrome, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    const detailHtml = fs.readFileSync(path.join(__dirname, 'sources/detail.html'), 'utf8')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '');

    await page.route('**/*', route => {
      const req = route.request();
      if (req.isNavigationRequest()) {
        return route.fulfill({ contentType: 'text/html', body: detailHtml });
      }
      if (req.resourceType() === 'image') {
        const png1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
        return route.fulfill({ status: 200, contentType: 'image/png', body: png1x1 });
      }
      return route.abort();
    });

    await page.goto('https://fitgirl-repacks.site/cyberpunk-2077/');

    const css = manifest.content_scripts[0].css
      .map(file => fs.readFileSync(path.join(extension, file), 'utf8'))
      .join('\n');
    const js = manifest.content_scripts[0].js
      .map(file => fs.readFileSync(path.join(extension, file), 'utf8'))
      .join('\n');

    await page.addStyleTag({ content: css });
    await page.evaluate(code => {
      window.chrome = {
        runtime: {
          sendMessage: (msg, cb) => cb && cb({}),
          getURL: s => s
        },
        storage: {
          local: { get: (k, cb) => cb && cb({}), set: (o, cb) => cb && cb() },
          onChanged: { addListener: () => {} }
        }
      };
      eval(code);
    }, js);

    // 1. Verify Download tab exists and click it
    const dlTab = page.locator('#mfg-tab-dl');
    assert.equal(await dlTab.count(), 1, 'Download tab not found');
    await dlTab.click();

    // 2. Find direct download hoster items
    const hosterCards = page.locator('.mfg-direct-sources > ul > li');
    const count = await hosterCards.count();
    console.log(`Found ${count} direct download filehoster cards`);
    assert(count >= 3, 'Expected at least 3 direct filehosters in Cyberpunk 2077 fixture');

    // 3. Verify each filehoster has a .mfg-export-txt-btn
    const exportBtns = page.locator('.mfg-direct-sources .mfg-export-txt-btn');
    const btnCount = await exportBtns.count();
    console.log(`Found ${btnCount} export .txt buttons`);
    assert.equal(btnCount, count, 'Each filehoster card should have an export .txt button');

    // 4. Check first button text and attributes (DataNodes with 64 links)
    const firstBtn = exportBtns.first();
    const btnText = await firstBtn.innerText();
    console.log('First button text:', btnText);
    assert(btnText.includes('Download .txt'), 'Button should display Download .txt');
    assert(btnText.includes('63'), 'Button should display count of extracted URLs (63)');

    // 5. Intercept download event when clicking the button
    const downloadPromise = page.waitForEvent('download');
    await firstBtn.click();
    const download = await downloadPromise;

    const suggestedFilename = download.suggestedFilename();
    console.log('Suggested filename:', suggestedFilename);
    assert(suggestedFilename.includes('DataNodes'), 'Filename should contain the filehoster name');
    assert(suggestedFilename.endsWith('.txt'), 'Filename should end with .txt');

    // Read downloaded content
    const downloadPath = await download.path();
    const fileContent = fs.readFileSync(downloadPath, 'utf8');
    const lines = fileContent.trim().split(/\r?\n/).filter(Boolean);
    console.log(`Downloaded file has ${lines.length} lines`);
    assert.equal(lines.length, 63, 'Expected exactly 63 URLs in text file');
    assert(lines[0].startsWith('https://datanodes.to/'), 'First line should be a datanodes URL');
    assert(lines.every(line => /^https?:\/\//.test(line)), 'All lines must be valid URLs');

    // Verify button visual feedback
    const activeText = await firstBtn.innerText();
    console.log('Active button text after click:', activeText);
    assert(activeText.includes('Saved'), 'Button text should indicate success');

    // 6. Test narrow viewport (390px) to verify zero overflow
    await page.setViewportSize({ width: 390, height: 800 });
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    assert(!overflows, 'Page overflows narrow viewport with export buttons');

    assert.deepEqual(errors, [], 'Errors were logged during test: ' + errors.join('; '));
    console.log('PASS: Direct download URLs export to .txt button verified successfully!');
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
