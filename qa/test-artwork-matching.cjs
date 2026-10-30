// Offline regression benchmark: title normalization + selection, not live catalog coverage.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '../pretty-fitgirl/scripts');
const context = vm.createContext({ chrome: { runtime: { onStartup: { addListener() {} }, onInstalled: { addListener() {} }, onMessage: { addListener() {} } } } });
vm.runInContext(fs.readFileSync(path.join(root, 'repack.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'background.js'), 'utf8'), context);
const cases = [
  ['Cyberpunk 2077: Ultimate Edition – v2.5 + All DLCs + REDmod', 'Cyberpunk 2077'],
  ['ELDEN RING – v1.16 + Shadow of the Erdtree DLC', 'ELDEN RING'],
  ['Baldur’s Gate 3: Digital Deluxe Edition – v4.1.1', "Baldur's Gate 3"],
  ['Hogwarts Legacy: Deluxe Edition – Build 12345', 'Hogwarts Legacy'],
  ['Forza Horizon 5: Premium Edition – v1.2 + 44 DLCs', 'Forza Horizon 5'],
  ['Horizon Zero Dawn Complete Edition – v1.11', 'Horizon Zero Dawn Complete Edition'],
  ['Red Dead Redemption 2 – Build 1491.50', 'Red Dead Redemption 2'],
  ['God of War – v1.0.12', 'God of War'],
  ['God of War Ragnarök – v1.0', 'God of War Ragnarok'],
  ['Grand Theft Auto V – v1.0 + Bonus Content', 'Grand Theft Auto V'],
  ['Grand Theft Auto IV: Complete Edition – v1.2', 'Grand Theft Auto IV: The Complete Edition'],
  ['Resident Evil 4: Gold Edition – v1.0', 'Resident Evil 4'],
  ['DOOM Eternal: Deluxe Edition – v6.66', 'DOOM Eternal'],
  ['Death Stranding Director’s Cut – v1.0', "DEATH STRANDING DIRECTOR'S CUT"],
  ['The Witcher 3: Wild Hunt – v4.04 + All DLCs', 'The Witcher 3: Wild Hunt'],
  ['Dying Light 2: Stay Human – v1.18', 'Dying Light 2 Stay Human: Reloaded Edition'],
  ['FINAL FANTASY VII REMAKE INTERGRADE – v1.0', 'FINAL FANTASY VII REMAKE INTERGRADE'],
  ['FINAL FANTASY XV: Windows Edition – v1.30', 'FINAL FANTASY XV WINDOWS EDITION'],
  ['Age of Empires II: Definitive Edition – Build 12345', 'Age of Empires 2 Definitive Edition'],
  ['The Elder Scrolls V: Skyrim Special Edition – v1.6', 'The Elder Scrolls V: Skyrim Special Edition'],
  ['Mass Effect Legendary Edition – v1.0', 'Mass Effect Legendary Edition'],
  ['Dark Souls III: Deluxe Edition – v1.15', 'DARK SOULS III'],
  ['DARK SOULS REMASTERED – v1.03', 'DARK SOULS REMASTERED'],
  ['#1234 Updated – Control: Ultimate Edition – v1.0', 'Control Ultimate Edition'],
  ['→ Knights of Honor II: Sovereign – v1.7', 'Knights of Honor 2 Sovereign'],
  ['Ratchet &amp; Clank: Rift Apart – v1.0', 'Ratchet & Clank Rift Apart'],
  ['S.T.A.L.K.E.R. 2: Heart of Chornobyl – v1.0', 'S.T.A.L.K.E.R. 2 Heart of Chornobyl'],
  ['N++ – v1.0', 'N++'],
  ['#BLUD – v1.0 [Selective Download]', '#BLUD'],
  ['Clair Obscur: Expedition 33 – v1.2', 'Clair Obscur Expedition 33'],
  ['Assassin’s Creed Mirage – v1.0', "Assassin's Creed Mirage"],
  ['DOOM™ + Bonus Content', 'DOOM™'],
];
let accepted = 0;
for (const [raw, expected] of cases) {
  context.raw = raw;
  context.items = [{ id: 2, name: expected + ' Soundtrack' }, { id: 3, name: expected + ' 2' }, { id: 1, name: expected }];
  const result = vm.runInContext('pickBestSteam(items, MFGRepack.searchName(raw))', context);
  if (result?.id === 1) accepted++;
  else console.error('Unresolved:', raw, '=>', vm.runInContext('MFGRepack.searchName(raw)', context));
}
const reject = [
  ['God of War', 'God of War Ragnarök'], ['DARK SOULS', 'DARK SOULS REMASTERED'],
  ['Resident Evil 4', 'Resident Evil 7'], ['Age of Empires II: Definitive Edition', 'Age of Empires II'],
  ['DOOM', 'DOOM Eternal'], ['Portal', 'Portal 2'], ['Half-Life', 'Half-Life Alyx'],
  ['Cyberpunk 2077', 'Cyberpunk 2077 Phantom Liberty'], ['N++', 'N'],
  ['The Elder Scrolls V: Skyrim', 'The Elder Scrolls V: Skyrim Special Edition'],
  ['Game', 'Game Soundtrack'], ['Game', 'Game Demo'], ['Game', 'Game Season Pass'],
];
for (const [query, wrong] of reject) {
  context.query = query; context.items = [{ id: 2, name: wrong }];
  assert.equal(vm.runInContext('pickBestSteam(items, query)', context), null, `${query} must reject ${wrong}`);
  context.products = [{ title: wrong }];
  assert.equal(vm.runInContext('pickBestGog(products, query)', context), null);
}
assert(accepted / cases.length >= .9, 'Representative decorated-title matching must reach 90%');
console.log(`PASS: ${accepted}/${cases.length} decorated titles matched; ${reject.length} wrong-game candidates rejected on both providers. Offline fixtures only.`);
