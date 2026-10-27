const fs = require('node:fs');
const { chromium } = require('playwright');
const candidates = [process.env.MFG_BROWSER,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', chromium.executablePath()];
module.exports = { headless: true, executablePath: candidates.find(file => file && fs.existsSync(file)) };
