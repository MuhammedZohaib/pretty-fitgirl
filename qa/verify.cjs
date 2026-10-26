const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const extDir = path.join(root, 'pretty-fitgirl');

console.log('Validating Pretty FitGirl extension...\n');

let errors = 0;
function assert(condition, message) {
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    errors++;
  } else {
    console.log(`  PASS: ${message}`);
  }
}

// 1. Manifest verification
const manifestPath = path.join(extDir, 'manifest.json');
assert(fs.existsSync(manifestPath), 'manifest.json exists');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert(manifest.manifest_version === 3, 'Manifest version is 3');
assert(manifest.name === 'Pretty FitGirl', `Extension name is "Pretty FitGirl" (found: "${manifest.name}")`);
assert(typeof manifest.version === 'string' && /^\d+\.\d+\.\d+$/.test(manifest.version), `Semantic version (found: ${manifest.version})`);
assert(manifest.description && manifest.description.length > 10, 'Manifest description is present');
assert(Array.isArray(manifest.permissions) && manifest.permissions.includes('storage'), 'Manifest includes storage permission');

// 2. Icon files
for (const [size, iconPath] of Object.entries(manifest.icons || {})) {
  const full = path.join(extDir, iconPath);
  assert(fs.existsSync(full) && fs.statSync(full).size > 0, `Icon ${size}x${size} exists (${iconPath})`);
}

// 3. Popup files
if (manifest.action?.default_popup) {
  const popupHtml = path.join(extDir, manifest.action.default_popup);
  assert(fs.existsSync(popupHtml), `Popup HTML exists (${manifest.action.default_popup})`);
}

// 4. Content scripts and styles
if (manifest.background?.service_worker) {
  const full = path.join(extDir, manifest.background.service_worker);
  assert(fs.existsSync(full), `Background service worker exists: ${manifest.background.service_worker}`);
  try {
    const code = fs.readFileSync(full, 'utf8');
    new vm.Script(code, { filename: manifest.background.service_worker });
    console.log(`  PASS: Syntax valid: ${manifest.background.service_worker}`);
  } catch (err) {
    assert(false, `Syntax error in ${manifest.background.service_worker}: ${err.message}`);
  }
}
for (const cs of manifest.content_scripts || []) {
  for (const style of cs.css || []) {
    const full = path.join(extDir, style);
    assert(fs.existsSync(full) && fs.statSync(full).size > 0, `CSS file exists: ${style}`);
  }
  for (const script of cs.js || []) {
    const full = path.join(extDir, script);
    assert(fs.existsSync(full), `JS file exists: ${script}`);
    // Syntax check
    try {
      const code = fs.readFileSync(full, 'utf8');
      new vm.Script(code, { filename: script });
      console.log(`  PASS: Syntax valid: ${script}`);
    } catch (err) {
      assert(false, `Syntax error in ${script}: ${err.message}`);
    }
  }
}

// 5. Web accessible resources
for (const entry of manifest.web_accessible_resources || []) {
  for (const res of entry.resources || []) {
    if (res.includes('*')) {
      const dir = path.join(extDir, path.dirname(res));
      assert(fs.existsSync(dir), `Resource directory exists: ${path.dirname(res)}`);
    } else {
      const full = path.join(extDir, res);
      assert(fs.existsSync(full), `Resource exists: ${res}`);
    }
  }
}

// 6. License check
assert(fs.existsSync(path.join(extDir, 'LICENSE')), 'pretty-fitgirl/LICENSE exists');
assert(fs.existsSync(path.join(root, 'LICENSE')), 'Root LICENSE exists');

if (errors > 0) {
  console.error(`\nValidation completed with ${errors} error(s).`);
  process.exit(1);
} else {
  console.log('\nAll checks passed successfully!');
}
