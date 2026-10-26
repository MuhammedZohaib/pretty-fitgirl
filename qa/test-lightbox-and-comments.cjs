const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const extension = path.join(root, 'pretty-fitgirl');
const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json'), 'utf8'));

(async () => {
  console.log('Testing unified lightbox for screenshots and Tolstoy comments...');

  const installedChrome = process.platform === 'win32' && fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

  const browser = await chromium.launch({ executablePath: installedChrome, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    const detailHtml = fs.readFileSync(path.join(__dirname, 'sources/detail.html'), 'utf8')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    const commentsHtml = fs.readFileSync(path.join(__dirname, 'sources/comments-frame.html'), 'utf8')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

    await page.route('**/*', route => {
      const req = route.request();
      const url = req.url();
      if (req.isNavigationRequest()) {
        if (url.includes('web.tolstoycomments.com')) {
          return route.fulfill({ contentType: 'text/html', body: commentsHtml });
        }
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

    // 1. Verify detail page lightbox elements exist
    const lightbox = page.locator('.mfg-lightbox');
    assert.equal(await lightbox.count(), 1, 'Unified lightbox was not mounted on document.body');
    assert.equal(await lightbox.getAttribute('role'), 'dialog');
    assert.equal(await lightbox.getAttribute('aria-modal'), 'true');
    assert(!((await lightbox.getAttribute('class')) || '').includes('mfg-lightbox-open'), 'Lightbox should initially be closed');

    // 2. Switch to Screenshots tab
    const scTab = page.locator('#mfg-tab-sc');
    if (await scTab.count() > 0) {
      await scTab.click();
      const scPanel = page.locator('#mfg-panel-sc');
      assert(await scPanel.isVisible(), 'Screenshots tab did not open');

      // Click the first screenshot thumbnail
      const scThumb = scPanel.locator('a:has(img)').first();
      assert(await scThumb.count() > 0, 'No screenshot link with img found');
      const thumbImgSrc = await scThumb.locator('img').getAttribute('src');

      await scThumb.click();

      // Verify lightbox opened
      assert(((await lightbox.getAttribute('class')) || '').includes('mfg-lightbox-open'), 'Lightbox did not open on screenshot click');
      const lbImg = lightbox.locator('.mfg-lightbox-img');
      const extLink = lightbox.locator('.mfg-lightbox-link');
      const originalLinkHref = await extLink.getAttribute('href');
      console.log('Opened extLink href:', originalLinkHref);
      const currentSrc = await lbImg.getAttribute('src');
      console.log('Opened screenshot full URL:', currentSrc);

      // Verify high-res resolution (stripped .240p.jpg and upgraded to https)
      if (thumbImgSrc && thumbImgSrc.includes('.240p.jpg')) {
        assert(!currentSrc.includes('.240p.jpg'), 'Did not strip .240p.jpg');
        assert(!currentSrc.endsWith('.jpg.jpg'), 'Erroneously produced .jpg.jpg');
      }
      assert(currentSrc.startsWith('https://'), 'Did not upgrade URL to HTTPS');
      assert.equal(await lbImg.getAttribute('referrerpolicy'), 'no-referrer', 'Missing referrerPolicy no-referrer for Cloudflare bypass');

      // Close via close button
      await lightbox.locator('.mfg-lightbox-close').click();
      assert(!((await lightbox.getAttribute('class')) || '').includes('mfg-lightbox-open'), 'Lightbox did not close on close button click');
    }

    // 3. Test Tolstoy comments iframe message -> open lightbox
    console.log('Testing Tolstoy comments postMessage integration...');
    await page.evaluate(() => {
      window.postMessage({
        type: 'mfg-open-lightbox',
        src: 'https://example.com/comment-full.jpg',
        thumb: 'https://example.com/comment-thumb.jpg'
      }, '*');
    });

    await page.waitForFunction(() => document.querySelector('.mfg-lightbox')?.classList.contains('mfg-lightbox-open'));
    const commentLbImgSrc = await lightbox.locator('.mfg-lightbox-img').getAttribute('src');
    assert.equal(commentLbImgSrc, 'https://example.com/comment-full.jpg', 'Comment image did not load into lightbox');
    console.log('Comment lightbox opened successfully with:', commentLbImgSrc);

    // Close via Escape key
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.mfg-lightbox')?.classList.contains('mfg-lightbox-open'));
    assert(!((await lightbox.getAttribute('class')) || '').includes('mfg-lightbox-open'), 'Escape did not close lightbox');

    assert.deepEqual(errors, [], 'Errors were logged during test: ' + errors.join('; '));
    console.log('PASS: Unified lightbox for game screenshots and Tolstoy comments fully verified!');
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
