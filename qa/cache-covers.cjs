/**
 * Developer-only QA helper: downloads the cover images referenced by the captured sources/home.html into qa/sources/images so visual tests run offline. Not shipped in the extension.
 */
const fs = require('node:fs');
const { execFile } = require('node:child_process');
const path = require('node:path');
const directory = path.join(__dirname, 'sources/images');
fs.mkdirSync(directory, { recursive: true });
const html = fs.readFileSync(path.join(__dirname, 'sources/home.html'), 'utf8');
const urls = [...new Set([...html.matchAll(/<img[^>]*class="alignleft"[^>]*>/g)].map(match => match[0].match(/src="([^"]+)"/)?.[1]).filter(Boolean))];
Promise.all(urls.map(url => new Promise(resolve => execFile('curl.exe', ['-fsSL', '--max-time', '35', '-o', path.join(directory, Buffer.from(url).toString('base64url')), url], error => { console.log(error ? 'Unavailable' : 'Cached', url); resolve(); }))));
