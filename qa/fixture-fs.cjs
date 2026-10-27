// Offline fixtures are preferred over machine-local captures for reproducible CI.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const fixtures = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'fixtures/pages.json.gz'))));
module.exports = { ...fs, existsSync(file) {
  const resolved = path.resolve(String(file));
  if (resolved.startsWith(path.join(__dirname, 'sources') + path.sep)) return Object.hasOwn(fixtures, path.relative(path.join(__dirname, 'sources'), resolved));
  return fs.existsSync(file);
}, readFileSync(file, options) {
  const resolved = path.resolve(String(file));
  if (path.dirname(resolved) === path.join(__dirname, 'sources') && Object.hasOwn(fixtures, path.basename(resolved))) {
    const data = Buffer.from(fixtures[path.basename(resolved)]);
    const encoding = typeof options === 'string' ? options : options?.encoding;
    return encoding ? data.toString(encoding) : data;
  }
  return fs.readFileSync(file, options);
}};
