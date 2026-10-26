/* Explicit developer command only. These requests never run inside the extension. */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const directory = path.join(__dirname, 'sources');
fs.mkdirSync(directory, { recursive: true });
const pages = {
  home: 'https://fitgirl-repacks.site/',
  category: 'https://fitgirl-repacks.site/tag/open-world/page/14/',
  search: 'https://fitgirl-repacks.site/?s=cyberpunk',
  detail: 'https://fitgirl-repacks.site/cyberpunk-2077/',
  page2: 'https://fitgirl-repacks.site/page/2/',
  popular: 'https://fitgirl-repacks.site/popular-repacks/',
  monthly: 'https://fitgirl-repacks.site/pop-repacks/',
  yearly: 'https://fitgirl-repacks.site/popular-repacks-of-the-year/',
  az: 'https://fitgirl-repacks.site/all-my-repacks-a-z/'
};
for (const [name, url] of Object.entries(pages)) {
  execFileSync('curl.exe', ['--fail', '-sSL', '--max-time', '60', '-o', path.join(directory, `${name}.html`), url]);
  console.log(`Captured ${name}: ${url}`);
}
for (const [name, url] of Object.entries({ 'az-blud': 'https://fitgirl-repacks.site/blud/', 'az-drive': 'https://fitgirl-repacks.site/drive-rally/' })) {
  execFileSync('curl.exe', ['--fail', '-sSL', '--max-time', '60', '-o', path.join(directory, `${name}.html`), url]);
}
execFileSync('curl.exe', ['--fail', '-sSL', '--max-time', '60', '-o', path.join(directory, 'theme.css'), 'https://fitgirl-repacks.site/wp-content/themes/twentyfourteen/style.css']);
fs.writeFileSync(path.join(directory, 'capture.json'), JSON.stringify({ captured: new Date().toISOString(), pages }, null, 2));
