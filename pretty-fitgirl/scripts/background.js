/**
 * Background service worker.
 *
 * Resolves a game title to a Steam store image using Steam's public store
 * search endpoint (no API key required). Results are cached in
 * chrome.storage.local so the page load stays fast and we stay polite to Steam.
 */

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CACHE_PREFIX = 'steam:';
const STEAM_SEARCH =
  'https://store.steampowered.com/api/storesearch/?cc=US&l=english&term=';
const CONCURRENCY = 4;

function cacheKey(title) {
  return CACHE_PREFIX + title.toLowerCase().replace(/\s+/g, ' ').trim();
}

function headerUrl(appid) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;
}

async function cacheGet(key) {
  try {
    const o = await chrome.storage.local.get(key);
    const v = o ? o[key] : undefined;
    if (v && Date.now() - v.ts < CACHE_TTL_MS) return v.data; // may be null (miss)
  } catch {
    // ignore storage read error
  }
  return undefined;
}

async function cacheSet(key, data) {
  try {
    await chrome.storage.local.set({ [key]: { ts: Date.now(), data } });
  } catch {
    // ignore storage write error
  }
}

/** Choose the best store-search item for a title. */
function pickBest(items, title) {
  const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const want = norm(title);
  let startsMatch = null;
  for (const it of items) {
    if (!it || !it.id) continue;
    const n = norm(it.name);
    if (n === want) return it; // exact name match wins
    if (!startsMatch && (n.startsWith(want) || want.startsWith(n))) startsMatch = it;
  }
  if (startsMatch) return startsMatch;
  return items.find((it) => it && it.id) || null; // else Steam's top relevance hit
}

async function steamLookup(title) {
  const res = await fetch(STEAM_SEARCH + encodeURIComponent(title), {
    credentials: 'omit',
  });
  if (!res.ok) throw new Error('steam ' + res.status);
  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];
  let best = pickBest(items, title);

  if (!best || !best.id) {
    // If Edition or subtitle caused a 0 hit, try base game name before edition/subtitle
    const base = title.replace(/[:–—-]\s*(?:Ultimate|Deluxe|Definitive|Collector|Special|Enhanced|Remastered|Digital|Standard)?\s*Edition.*$/i, '').trim();
    if (base && base !== title) {
      try {
        const baseRes = await fetch(STEAM_SEARCH + encodeURIComponent(base), { credentials: 'omit' });
        if (baseRes.ok) {
          const baseData = await baseRes.json();
          const baseItems = Array.isArray(baseData.items) ? baseData.items : [];
          best = pickBest(baseItems, base);
        }
      } catch {
        // ignore fallback network error
      }
    }
  }

  if (!best || !best.id) return null;
  return {
    appid: best.id,
    name: best.name || title,
    header: headerUrl(best.id),
    tiny: best.tiny_image || null,
  };
}

async function resolveOne(title) {
  const key = cacheKey(title);
  const cached = await cacheGet(key);
  if (cached !== undefined) return cached; // cached hit OR cached known-miss
  let data = null;
  try {
    data = await steamLookup(title);
  } catch {
    return null; // transient failure: don't cache, retry next time
  }
  await cacheSet(key, data); // cache real results and confirmed misses (null)
  return data;
}

async function resolveAll(titles) {
  const unique = [...new Set(titles)];
  const resolved = {};
  let i = 0;
  async function worker() {
    while (i < unique.length) {
      const t = unique[i++];
      resolved[t] = await resolveOne(t);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, unique.length) }, worker)
  );

  const out = {};
  for (const t of titles) out[t] = resolved[t] ?? null;
  return out;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'resolveGames' && Array.isArray(msg.titles)) {
    resolveAll(msg.titles)
      .then(sendResponse)
      .catch(() => sendResponse({}));
    return true; // keep the message channel open for the async response
  }
  return false;
});
