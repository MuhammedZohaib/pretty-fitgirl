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
const CONCURRENCY = 6;

/** Normalised storage key: case/whitespace-insensitive so "Foo  Bar" and "foo bar" share one entry. */
function cacheKey(title) {
  return CACHE_PREFIX + title.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Steam artwork URL builders. *Alt variants use a second CDN as a fallback if the first is blocked/slow. */
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

// ---------------------------------------------------------------------------
// Two-level cache
//   L1: `memory` Map  - lives as long as the service worker (instant, no IPC).
//   L2: chrome.storage.local - survives worker restarts (MV3 workers are
//       killed after ~30s idle, so L1 alone is not enough).
// Both levels honour CACHE_TTL_MS. A cached `null` means "confirmed no artwork".
// ---------------------------------------------------------------------------
const memory = new Map(); // key -> { ts, data }
const inflight = new Map(); // key -> Promise; dedupes concurrent lookups of one title

/** True when a stored record exists and has not expired. */
function fresh(v) {
  return Boolean(v) && typeof v.ts === 'number' && Date.now() - v.ts < CACHE_TTL_MS;
}

/**
 * Read many keys with ONE storage round-trip (instead of one per title) and
 * fill L1 from the result. Returns Map<key, data> for fresh hits only.
 */
async function cacheGetMany(keys) {
  const hits = new Map();
  const missing = [];
  for (const key of keys) {
    const m = memory.get(key);
    if (fresh(m)) hits.set(key, m.data);
    else missing.push(key);
  }
  if (!missing.length) return hits;
  try {
    const stored = await chrome.storage.local.get(missing);
    for (const key of missing) {
      const v = stored ? stored[key] : undefined;
      if (fresh(v)) {
        memory.set(key, v);
        hits.set(key, v.data); // may be null (known miss)
      }
    }
  } catch {
    // ignore storage read error: we simply re-resolve from the network
  }
  return hits;
}

/** Write many entries with ONE storage call and update L1 immediately. */
async function cacheSetMany(entries) {
  const batch = {};
  const ts = Date.now();
  for (const [key, data] of entries) {
    const record = { ts, data };
    memory.set(key, record);
    batch[key] = record;
  }
  if (!Object.keys(batch).length) return;
  try {
    await chrome.storage.local.set(batch);
  } catch {
    // ignore storage write error (quota etc.); L1 still serves this session
  }
}

/** Remove expired artwork records so storage does not grow forever. */
async function pruneExpired() {
  try {
    const all = await chrome.storage.local.get(null);
    const stale = Object.keys(all).filter(
      (k) => k.startsWith(CACHE_PREFIX) && !fresh(all[k])
    );
    if (stale.length) await chrome.storage.local.remove(stale);
  } catch {
    // best-effort housekeeping only
  }
}
// Run housekeeping when the browser starts / extension updates, never on page load.
chrome.runtime.onStartup.addListener(pruneExpired);
chrome.runtime.onInstalled.addListener(pruneExpired);

/** Lowercase and strip punctuation so titles compare loosely. */
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

/**
 * Search Steam for a title. Returns artwork URLs, null if no match, and THROWS on
 * network / HTTP errors so callers can avoid caching a transient failure as a miss.
 */
async function steamLookup(title) {
  try {
    const res = await fetch(STEAM_SEARCH + encodeURIComponent(title), {
      credentials: 'omit',
    });
    if (!res.ok) throw new Error('steam ' + res.status); // transient: never cache as a miss
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
  } catch (err) {
    if (err && /^steam \d+/.test(err.message)) throw err;
    throw err; // network failure: let caller skip caching and allow retry
  }
}

/** Search GOG public catalog; returns cover URLs or null (errors are treated as a miss). */
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

/**
 * Resolve artwork for one title. Steam and GOG are queried IN PARALLEL (the
 * old code ran GOG only after Steam finished, adding a full round-trip).
 * Steam wins when it has a match; GOG supplies a fallback poster / full fallback.
 * Throws when Steam failed transiently and nothing else matched, so the caller
 * does not cache a false "no artwork" result.
 */
async function resolveArtwork(title) {
  const [steamResult, gog] = await Promise.all([
    steamLookup(title).then(
      (value) => ({ value, failed: false }),
      () => ({ value: null, failed: true })
    ),
    gogLookup(title).catch(() => null),
  ]);

  const steam = steamResult.value;
  if (steam) {
    if (gog?.poster) steam.gogPoster = gog.poster;
    return steam;
  }
  if (gog) return gog; // GOG fallback for missing posters/games
  if (steamResult.failed) throw new Error('steam unavailable'); // don't cache a false miss
  return null;
}

/** Network resolve + dedupe of identical in-flight lookups. */
function resolveFromNetwork(key, title) {
  if (inflight.has(key)) return inflight.get(key);
  const p = resolveArtwork(title)
    .then((data) => ({ ok: true, data }))
    .catch(() => ({ ok: false, data: null })) // transient failure: don't cache
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

// Global limiter so many parallel messages never flood Steam/GOG.
let active = 0;
const waiting = [];
function limited(fn) {
  return new Promise((resolve) => {
    const run = async () => {
      active++;
      try {
        resolve(await fn());
      } finally {
        active--;
        if (waiting.length) waiting.shift()();
      }
    };
    if (active < CONCURRENCY) run();
    else waiting.push(run);
  });
}

/**
 * Resolve a list of titles. Cache hits are answered from ONE batched storage
 * read; only genuine misses hit the network (rate-limited), and all new results
 * are persisted with ONE batched write.
 */
async function resolveAll(titles) {
  const unique = [...new Set(titles)];
  const keyOf = new Map(unique.map((t) => [t, cacheKey(t)]));
  const hits = await cacheGetMany([...keyOf.values()]);

  const resolved = {};
  const fresh_entries = [];
  await Promise.all(
    unique.map((t) => {
      const key = keyOf.get(t);
      if (hits.has(key)) {
        resolved[t] = hits.get(key); // cached hit OR cached known-miss
        return null;
      }
      return limited(async () => {
        const { ok, data } = await resolveFromNetwork(key, t);
        resolved[t] = data;
        if (ok) fresh_entries.push([key, data]); // cache real results and confirmed misses (null)
      });
    })
  );
  if (fresh_entries.length) await cacheSetMany(fresh_entries);

  const out = {};
  for (const t of titles) out[t] = resolved[t] ?? null;
  return out;
}

// Content scripts send { type: 'resolveGames', titles: [...] }; we reply with { title: artwork|null }.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'resolveGames' && Array.isArray(msg.titles)) {
    resolveAll(msg.titles)
      .then(sendResponse)
      .catch(() => sendResponse({}));
    return true; // keep the message channel open for the async response
  }
  return false;
});
