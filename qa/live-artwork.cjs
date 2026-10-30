// Explicit developer-only network benchmark. Never runs inside the extension or CI.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const data = {}, event = { addListener() {} };
const chrome = { runtime: { onStartup: event, onInstalled: event, onMessage: event }, storage: { local: {
  get: async keys => Object.fromEntries(keys.map(key => [key, data[key]])),
  set: async values => Object.assign(data, values), remove: async () => {}
} } };
const context = vm.createContext({ fetch, AbortController, setTimeout, clearTimeout, chrome });
for (const script of ['repack.js', 'background.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../pretty-fitgirl/scripts', script), 'utf8'), context);
context.samples = [
  ['Cyberpunk 2077: Ultimate Edition – v2.5 + All DLCs', 1091500],
  ['ELDEN RING – v1.16 + All DLCs', 1245620],
  ['Baldur’s Gate 3: Digital Deluxe Edition – v4.1.1', 1086940],
  ['Hogwarts Legacy: Deluxe Edition – Build 12345', 990080],
  ['Red Dead Redemption 2 – Build 1491.50', 1174180],
  ['God of War – v1.0.12', 1593500],
  ['The Witcher 3: Wild Hunt – v4.04 + All DLCs', 292030],
  ['DOOM Eternal: Deluxe Edition – v6.66', 782330],
  ['Portal 2 – Build 12345', 620],
  ['Dying Light 2: Stay Human – v1.18', 534380]
];
vm.runInContext(`(async () => {
  const queries = samples.map(([title]) => MFGRepack.searchName(title));
  const results = await resolveAll(queries);
  return samples.map(([title, expected], i) => ({ title, query: queries[i], expected,
    actual: results[queries[i]]?.appid || null, storeName: results[queries[i]]?.name || null,
    match: results[queries[i]]?.appid === expected }));
})()`, context).then(cases => {
  const matched = cases.filter(row => row.match).length;
  const wrong = cases.filter(row => row.actual && !row.match).length;
  const report = { checkedAt: new Date().toISOString(), scope: 'Ten selected Steam titles; not a representative estimate of full-catalog accuracy.', matched, wrong, total: cases.length, cases };
  fs.mkdirSync(path.join(__dirname, 'output'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'output/artwork-live.json'), JSON.stringify(report, null, 2));
  console.log(`${matched}/${cases.length} expected Steam IDs matched; ${wrong} wrong IDs; ${cases.length - matched - wrong} unresolved.`);
  for (const row of cases.filter(row => !row.match)) console.log('Unresolved or mismatched:', row.query);
  if (matched / cases.length < .9 || wrong) process.exitCode = 1;
}).catch(error => { console.error(error); process.exitCode = 1; });
