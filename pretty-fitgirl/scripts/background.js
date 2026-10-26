/**
 * Background service worker.
 *
 * Resolves a game title to a vertical poster or banner using Steam's public store
 * search endpoint with fallback to GOG's catalog API (no API keys required).
 * Results are cached in chrome.storage.local for 7 days so page loads stay fast
 * and we remain polite to Steam and GOG.
 */

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CACHE_PREFIX = 'steam:';
const STEAM_SEARCH =
  'https://store.steampowered.com/api/storesearch/?cc=US&l=english&term=';
const GOG_SEARCH =
  'https://catalog.gog.com/v1/catalog?limit=10&locale=en-US&query=';
const CONCURRENCY = 4;

function cacheKey(title) {
  return CACHE_PREFIX + title.toLowerCase().replace(/\s+/g, ' ').trim();
}

function steamPosterUrl(appid) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`;
}

function steamPosterAltUrl(appid) {
  return `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/library_600x900.jpg`;
}

function steamHeaderUrl(appid) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;
}

function steamHeaderAltUrl(appid) {
  return `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`;
}

function steamHeroUrl(appid) {
  return `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/library_hero.jpg`;
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

function norm(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Choose the best store-search item for a title on Steam. */
function pickBestSteam(items, title) {
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

/** Choose the best matching product on GOG. */
function pickBestGog(products, title) {
  const want = norm(title);
  let match = products.find((p) => norm(p.title) === want);
  if (!match) {
    match = products.find(
      (p) => norm(p.title).startsWith(want) || want.startsWith(norm(p.title))
    );
  }
  return match || null;
}

async function steamLookup(title) {
  try {
    const res = await fetch(STEAM_SEARCH + encodeURIComponent(title), {
      credentials: 'omit',
    });
    if (!res.ok) return null;
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];
    let best = pickBestSteam(items, title);

    if (!best || !best.id) {
      // If Edition or subtitle caused a 0 hit, try base game name before edition/subtitle
      const base = title
        .replace(
          /[:–—-]\s*(?:Ultimate|Deluxe|Definitive|Collector|Special|Enhanced|Remastered|Digital|Standard)?\s*Edition.*$/i,
          ''
        )
        .trim();
      if (base && base !== title) {
        try {
          const baseRes = await fetch(STEAM_SEARCH + encodeURIComponent(base), {
            credentials: 'omit',
          });
          if (baseRes.ok) {
            const baseData = await baseRes.json();
            const baseItems = Array.isArray(baseData.items) ? baseData.items : [];
            best = pickBestSteam(baseItems, base);
          }
        } catch {
          // ignore fallback network error
        }
      }
    }

    if (!best || !best.id) return null;
    return {
      source: 'steam',
      appid: best.id,
      name: best.name || title,
      poster: steamPosterUrl(best.id),
      posterAlt: steamPosterAltUrl(best.id),
      header: steamHeaderUrl(best.id),
      headerAlt: steamHeaderAltUrl(best.id),
      banner: steamHeroUrl(best.id),
      tiny: best.tiny_image || null,
    };
  } catch {
    return null;
  }
}

async function gogLookup(title) {
  try {
    const q = encodeURIComponent('like:' + title);
    const res = await fetch(GOG_SEARCH + q, { credentials: 'omit' });
    if (!res.ok) return null;
    const data = await res.json();
    const products = Array.isArray(data.products) ? data.products : [];
    const best = pickBestGog(products, title);
    if (!best) return null;

    return {
      source: 'gog',
      name: best.title || title,
      poster: best.coverVertical || null,
      banner: best.coverHorizontal || null,
      header: best.coverHorizontal || null,
      tiny: null,
    };
  } catch {
    return null;
  }
}

async function resolveArtwork(title) {
  // 1. Steam first (best primary source, 600x900 vertical poster + header)
  const steam = await steamLookup(title);
  if (steam) {
    try {
      const gog = await gogLookup(title);
      if (gog?.poster) steam.gogPoster = gog.poster;
    } catch {
      // ignore gog lookup error
    }
    return steam;
  }

  // 2. GOG fallback for missing posters/games
  const gog = await gogLookup(title);
  if (gog) return gog;

  return null;
}

async function resolveOne(title) {
  const key = cacheKey(title);
  const cached = await cacheGet(key);
  if (cached !== undefined) return cached; // cached hit OR cached known-miss
  let data = null;
  try {
    data = await resolveArtwork(title);
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
