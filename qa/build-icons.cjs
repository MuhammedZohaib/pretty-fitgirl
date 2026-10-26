// Optional asset regeneration; checked-in PNGs need no build step.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const directory = path.resolve(__dirname, '../pretty-fitgirl/assets');
const logo = fs.readFileSync(path.join(directory, 'logo.png'));
Promise.all([16, 32, 48, 128].map(size => sharp(logo).resize(size, size).png().toFile(path.join(directory, `icon-${size}.png`)))).catch(error => { console.error(error); process.exitCode = 1; });
