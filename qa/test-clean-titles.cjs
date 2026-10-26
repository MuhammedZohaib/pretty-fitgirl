const titles = [
  'Knights of Honor II: Sovereign',
  'Mortal Shell II: Rotten Autumn',
  'Tunguska: The Visitation – Final Cut',
  'Dinkum',
  'Deep Rock Galactic',
  'Dying Light 2: Stay Human – Reloaded Edition',
  'Bendy and the Dark Revival',
  'Tape to Tape',
  'Cyberpunk 2077: Ultimate Edition'
];

const STEAM_SEARCH = 'https://store.steampowered.com/api/storesearch/?cc=US&l=english&term=';

function norm(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function pickBest(items, title) {
  const want = norm(title);
  let startsMatch = null;
  for (const it of items) {
    if (!it || !it.id) continue;
    const n = norm(it.name);
    if (n === want) return it;
    if (!startsMatch && (n.startsWith(want) || want.startsWith(n))) startsMatch = it;
  }
  if (startsMatch) return startsMatch;
  return items.find((it) => it && it.id) || null;
}

async function search(title) {
  let res = await fetch(STEAM_SEARCH + encodeURIComponent(title));
  let data = await res.json();
  let best = pickBest(data.items || [], title);

  if (!best) {
    // Try base game name stripping edition/subtitles
    const base = title
      .replace(/[:–—-]\s*(?:Ultimate|Deluxe|Definitive|Collector|Special|Enhanced|Remastered|Digital|Standard|Reloaded|Final Cut|Spooktacular Bundle)?\s*(?:Edition|Cut|Bundle)?.*$/i, '')
      .trim();
    if (base && base !== title) {
      const bRes = await fetch(STEAM_SEARCH + encodeURIComponent(base));
      const bData = await bRes.json();
      best = pickBest(bData.items || [], base);
    }
  }

  return best;
}

(async () => {
  for (const t of titles) {
    const b = await search(t);
    console.log(t, '=>', b ? `AppID: ${b.id} (${b.name})` : 'null');
  }
})();
