/**
 * Developer-only QA script: launches Playwright and exercises the navigation/sidebar UI for visual review. Not shipped in the extension.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  
  const manifest = JSON.parse(fs.readFileSync('pretty-fitgirl/manifest.json', 'utf8'));
  let css = manifest.content_scripts[0].css.map(file => fs.readFileSync(path.join('pretty-fitgirl', file), 'utf8')).join('\n');
  const js = manifest.content_scripts[0].js.map(file => fs.readFileSync(path.join('pretty-fitgirl', file), 'utf8')).join('\n');
  
  const customCss = `
  html.mfg-on #content .post-navigation {
    grid-column: 1 / -1 !important;
    margin: 2rem 0 2rem !important;
    padding: 0 !important;
    border: none !important;
    background: transparent !important;
  }
  html.mfg-on #content .post-navigation .screen-reader-text {
    position: absolute !important;
    width: 1px !important;
    height: 1px !important;
    padding: 0 !important;
    margin: -1px !important;
    overflow: hidden !important;
    clip: rect(0, 0, 0, 0) !important;
    white-space: nowrap !important;
    border: 0 !important;
  }
  html.mfg-on #content .post-navigation .nav-links {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 1.25rem !important;
    width: 100% !important;
    box-sizing: border-box !important;
  }
  html.mfg-on #content .post-navigation a[rel="next"]:only-child {
    grid-column: 2 !important;
  }
  html.mfg-on #content .post-navigation .nav-links a {
    display: flex !important;
    flex-direction: column !important;
    justify-content: center !important;
    padding: 1.25rem 1.5rem !important;
    min-height: 5.5rem !important;
    background: var(--geist-canvas-elevated) !important;
    border: 1px solid var(--geist-hairline-strong) !important;
    border-radius: var(--geist-radius-lg) !important;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35) !important;
    text-decoration: none !important;
    color: var(--geist-ink) !important;
    font-family: var(--mfg-font) !important;
    font-size: 0.9375rem !important;
    font-weight: 600 !important;
    line-height: 1.45 !important;
    box-sizing: border-box !important;
    transition: all var(--mfg-speed) cubic-bezier(0.4, 0, 0.2, 1) !important;
    position: relative !important;
    overflow: hidden !important;
  }
  html.mfg-on #content .post-navigation .nav-links a[rel="prev"] {
    text-align: left !important;
    align-items: flex-start !important;
  }
  html.mfg-on #content .post-navigation .nav-links a[rel="next"] {
    text-align: right !important;
    align-items: flex-end !important;
  }
  html.mfg-on #content .post-navigation .nav-links a:hover {
    border-color: rgba(255, 255, 255, 0.25) !important;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(0, 112, 243, 0.06) 100%), var(--geist-canvas-elevated) !important;
    transform: translateY(-2px) !important;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5), 0 0 16px rgba(0, 112, 243, 0.12) !important;
    color: #ffffff !important;
  }
  html.mfg-on #content .post-navigation .meta-nav {
    display: inline-flex !important;
    align-items: center !important;
    gap: 0.375rem !important;
    font-family: var(--mfg-mono) !important;
    font-size: 0.6875rem !important;
    font-weight: 600 !important;
    letter-spacing: 0.08em !important;
    text-transform: uppercase !important;
    color: var(--geist-link-soft) !important;
    margin-bottom: 0.5rem !important;
    padding: 0.1875rem 0.5625rem !important;
    background: rgba(0, 112, 243, 0.08) !important;
    border: 1px solid rgba(0, 112, 243, 0.25) !important;
    border-radius: var(--geist-radius-pill) !important;
    transition: all var(--mfg-speed) ease !important;
  }
  html.mfg-on #content .post-navigation a:hover .meta-nav {
    background: rgba(0, 112, 243, 0.16) !important;
    border-color: rgba(0, 112, 243, 0.45) !important;
    color: #ffffff !important;
  }
  html.mfg-on #content .post-navigation a[rel="prev"] .meta-nav::before {
    content: "←";
    font-size: 0.75rem;
    transition: transform var(--mfg-speed) ease;
  }
  html.mfg-on #content .post-navigation a[rel="prev"]:hover .meta-nav::before {
    transform: translateX(-3px);
  }
  html.mfg-on #content .post-navigation a[rel="next"] .meta-nav::after {
    content: "→";
    font-size: 0.75rem;
    transition: transform var(--mfg-speed) ease;
  }
  html.mfg-on #content .post-navigation a[rel="next"]:hover .meta-nav::after {
    transform: translateX(3px);
  }
  @media (max-width: 44em) {
    html.mfg-on #content .post-navigation .nav-links {
      grid-template-columns: 1fr !important;
      gap: 0.875rem !important;
    }
    html.mfg-on #content .post-navigation a[rel="next"]:only-child {
      grid-column: 1 !important;
    }
    html.mfg-on #content .post-navigation .nav-links a[rel="next"] {
      text-align: left !important;
      align-items: flex-start !important;
    }
  }
  `;
  
  let html = fs.readFileSync('qa/sources/detail.html', 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  await page.setContent(html);
  await page.addStyleTag({ content: css + '\n' + customCss });
  await page.evaluate(js);
  await page.evaluate(() => document.documentElement.classList.add('mfg-on'));
  
  const nav = page.locator('.post-navigation');
  await nav.scrollIntoViewIfNeeded();
  await nav.screenshot({ path: 'qa/output/post-nav-preview.png' });
  console.log('Saved post-nav-preview.png');
  
  await page.screenshot({ path: 'qa/output/detail-bottom-flow.png' });
  console.log('Saved detail-bottom-flow.png');
  
  await page.setViewportSize({ width: 390, height: 800 });
  await nav.scrollIntoViewIfNeeded();
  await nav.screenshot({ path: 'qa/output/post-nav-preview-mobile.png' });
  console.log('Saved post-nav-preview-mobile.png');
  
  await browser.close();
})();
