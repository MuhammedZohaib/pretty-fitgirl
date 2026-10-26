// Cache resources referenced by the five captured pages, only for offline visual QA.
// This is never included in the browser extension or run by a content script.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const root = path.join(__dirname, 'sources');
const directory = path.join(root, 'assets');
fs.mkdirSync(directory, { recursive: true });
const decode = value => value.replaceAll('&#038;', '&').replaceAll('&amp;', '&');
const urls = new Set();
for (const file of ['home.html', 'detail.html', 'search.html', 'category.html', 'page2.html']) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    if (!/rel=['"]stylesheet['"]/.test(match[0])) continue;
    const url = match[0].match(/href=['"]([^'"]+)/)?.[1];
    if (url) urls.add(decode(url));
  }
}
const html = fs.readFileSync(path.join(root, 'home.html'), 'utf8');
// The sidebar artwork and original support banner are part of this single page.
for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
  const url = match[0].match(/src=['"]([^'"]+)/)?.[1];
  if (url && (url.includes('i0.wp.com') || url.includes('support2.jpg'))) urls.add(decode(url));
}
let cursor = 0;
const list = [...urls];
const outcomes = [];
async function worker() {
  while (cursor < list.length) {
    const url = list[cursor++];
    const file = path.join(directory, crypto.createHash('sha256').update(url).digest('hex'));
    if (fs.existsSync(file)) continue;
    await new Promise(resolve => execFile('curl.exe', ['-fsSL', '--max-time', '30', '-o', file, url], error => {
      outcomes.push({ url, cached: !error });
      if (error && fs.existsSync(file)) fs.unlinkSync(file);
      resolve();
    }));
  }
}
Promise.all(Array.from({ length: 6 }, worker)).then(() => {
  fs.writeFileSync(path.join(root, 'asset-cache.json'), JSON.stringify(outcomes, null, 2));
  console.log(`Resource cache: ${outcomes.filter(item => item.cached).length}/${outcomes.length} new resources available.`);
});
