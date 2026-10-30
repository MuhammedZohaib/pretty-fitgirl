/**
 * Background service worker.
 *
 * Resolves a game title to a vertical poster or banner using Steam's public store
 * search endpoint with fallback to GOG's catalog API (no API keys required).
 * Results are cached in chrome.storage.local for 7 days so page loads stay fast
 * and we remain polite to Steam and GOG.
 */

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CACHE_PREFIX = 'artwork.v3:';
const STEAM_SEARCH =
  'https://store.steampowered.com/api/storesearch/?cc=US&l=english&term=';
const GOG_SEARCH =
  'https://catalog.gog.com/v1/catalog?limit=10&locale=en-US&query=';
const CONCURRENCY = 6;

// Bound both connection and response-body reads; never pin a worker slot indefinitely.
async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(url, { credentials: 'omit', signal: controller.signal });
    if (!response.ok) throw new Error('provider ' + response.status);
    return await response.json();
  } finally { clearTimeout(timer); }
}

/** Fetch Steam user reviews summary from the official Web API. */
async function fetchSteamRating(appid) {
  try {
    const data = await fetchJson(
      'https://api.steampowered.com/IUserReviewsService/GetAppReviews/v1/?appid=' + appid + '&json=1'
    );
    const qs = data?.response?.query_summary;
    if (!qs || !qs.review_score_desc) return null;
    const total = (qs.total_positive || 0) + (qs.total_negative || 0);
    if (total === 0) return null;
    const percent = Math.round(((qs.total_positive || 0) / total) * 100);
    return {
      desc: qs.review_score_desc,
      percent,
      positive: qs.total_positive || 0,
      negative: qs.total_negative || 0,
      total: qs.total_reviews || total,
      score: qs.review_score || 0
    };
  } catch {
    return null;
  }
}


/** Normalised storage key: case/whitespace-insensitive so "Foo  Bar" and "foo bar" share one entry. */
function cacheKey(title) {
  return CACHE_PREFIX + editionBase(norm(title));
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
      (k) => (k.startsWith(CACHE_PREFIX) && !fresh(all[k])) || k.startsWith('steam:') || k.startsWith('artwork.v2:')
    );
    const metadata = Object.keys(all).filter(k => k.startsWith('mfg.metadata.v1.')).sort((a, b) => (all[b]?.time || 0) - (all[a]?.time || 0));
    stale.push(...metadata.filter((k, index) => index >= 150 || Date.now() - (all[k]?.time || 0) >= 86400000));
    if (stale.length) await chrome.storage.local.remove(stale);
  } catch {
    // best-effort housekeeping only
  }
}
// Run housekeeping when the browser starts / extension updates, never on page load.
chrome.runtime.onStartup.addListener(pruneExpired);
chrome.runtime.onInstalled.addListener(pruneExpired);

/** Normalize spelling without discarding sequel or remaster identity. */
function norm(s) {
  const roman = { ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8', ix: '9', x: '10', xi: '11', xii: '12', xiii: '13', xiv: '14', xv: '15', xvi: '16' };
  return (s || '').replace(/[™®©]/g, '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[’']/g, '')
    .replace(/[^\p{L}\p{N}+]+/gu, ' ').trim()
    .split(' ').map(word => roman[word] || word).join(' ');
}
function editionBase(title) {
  return title.replace(/ (?:(?:digital|super) )?(?:ultimate|deluxe|gold|premium|complete|reloaded|collectors|standard|supporter|game of the year|goty) edition$/, '').trim();
}
function pickBestSteam(items, query) {
  const want = editionBase(norm(query));
  if (!want || !Array.isArray(items)) return null;
  const numbers = text => (text.match(/\b\d+\b/g) || []).sort().join(',');
  const identity = text => (text.match(/\b(?:remastered|remaster|remake|definitive|enhanced|anniversary|special|vr)\b/g) || []).sort().join(',');
  const junk = /\b(?:soundtrack|ost|dlc|demo|dedicated server|artbook|season pass|expansion pack|upgrade|playtest)\b/g;
  const words = text => new Set(text.split(' ').filter(w => w && !['the', 'a', 'an', 'and'].includes(w)));
  const candidates = [];
  for (const item of items) {
    if (!item?.id || !item.name) continue;
    const name = editionBase(norm(item.name));
    if (numbers(name) !== numbers(want) || identity(name) !== identity(want)) continue;
    if ((name.match(junk) || []).some(term => !(' ' + want + ' ').includes(' ' + term + ' '))) continue;
    if (name === want) candidates.push({ item, score: 1 });
    else {
      const a = words(want), b = words(name);
      const matched = [...a].filter(w => b.has(w)).length;
      const score = matched / Math.max(a.size, b.size, 1);
      if (score >= .9) candidates.push({ item, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  if (!candidates.length) return null;
  // Near-equal non-exact candidates are ambiguous; do not borrow another game's artwork.
  if (candidates[0].score < 1 && candidates[1] && candidates[0].score - candidates[1].score < .08) return null;
  return candidates[0].item;
}
function pickBestGog(products, title) {
  const candidates = (products || []).map((product, index) => ({ id: index + 1, name: product.title, product }));
  return pickBestSteam(candidates, title)?.product || null;
}

async function steamLookup(title) {
  try {
    const data = await fetchJson(STEAM_SEARCH + encodeURIComponent(title));
    const items = Array.isArray(data.items) ? data.items : [];
    let best = pickBestSteam(items, title);

    if (!best || !best.id) {
      // Retry normalized spelling/package names; retain meaningful subtitles and remaster identity.
      const base = editionBase(norm(title));
      if (base && base !== title.toLowerCase().replace(/\s+/g, ' ').trim()) {
        const baseData = await fetchJson(STEAM_SEARCH + encodeURIComponent(base));
        const baseItems = Array.isArray(baseData.items) ? baseData.items : [];
        best = pickBestSteam(baseItems, base);
      }
    }

    if (!best || !best.id) return null;
    const rating = await fetchSteamRating(best.id);
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
      rating: rating || null,
    };
  } catch (err) {
    if (err && /^steam \d+/.test(err.message)) throw err;
    throw err; // network failure: let caller skip caching and allow retry
  }
}

/** Search GOG public catalog; throw on transient failures. */
async function gogLookup(title) {
  try {
    const q = encodeURIComponent('like:' + title);
    const data = await fetchJson(GOG_SEARCH + q);
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
  } catch (error) {
    throw error; // Provider failures are not confirmed misses.
  }
}

/** Steam is primary; query GOG only when needed. Never cache a provider failure. */
async function resolveArtwork(title) {
  let failed = false;
  try {
    const steam = await steamLookup(title);
    if (steam) return steam;
  } catch { failed = true; }
  try {
    const gog = await gogLookup(title);
    if (gog) return gog;
  } catch { failed = true; }
  if (failed) throw new Error('artwork provider unavailable');
  return null;
}

let active = 0;
const waiting = [];
function limited(fn) {
  return new Promise((resolve) => {
    const job = { run: null, timer: null };
    job.run = async () => {
      clearTimeout(job.timer);
      active++;
      try { resolve(await fn()); }
      catch { resolve({ ok: false, data: null }); }
      finally {
        active--;
        if (waiting.length) waiting.shift().run();
      }
    };
    if (active < CONCURRENCY) job.run();
    else {
      waiting.push(job);
      job.timer = setTimeout(() => {
        const index = waiting.indexOf(job);
        if (index >= 0) waiting.splice(index, 1);
        resolve({ ok: false, data: null });
      }, 5000);
    }
  });
}

function resolveFromNetwork(key, title) {
  if (inflight.has(key)) return inflight.get(key);
  const promise = limited(async () => {
    // Another queued request may already have populated this key.
    if (fresh(memory.get(key))) return { ok: true, data: memory.get(key).data };
    const data = await resolveArtwork(title);
    await cacheSetMany([[key, data]]);
    return { ok: true, data };
  }).finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

async function resolveAll(titles) {
  const unique = [...new Set(titles.filter(t => typeof t === 'string' && t.trim() && t.length <= 300))];
  const hits = await cacheGetMany(unique.map(cacheKey));
  const out = Object.create(null);
  await Promise.all(unique.map(async title => {
    const key = cacheKey(title);
    out[title] = hits.has(key) ? hits.get(key) : (await resolveFromNetwork(key, title)).data;
  }));
  return out;
}

// A short renewable lease prevents every tab from crawling the adult archive.
let adultLease = null;
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (!msg || !['adultClaim', 'adultRenew', 'adultRelease'].includes(msg.type)) return false;
  if (!sender.tab || sender.url?.startsWith('https://fitgirl-repacks.site/') !== true) return false;
  const owner = sender.tab.id;
  const now = Date.now();
  if (msg.type === 'adultClaim') {
    if (!adultLease || adultLease.expires <= now) adultLease = { owner, token: crypto.randomUUID(), expires: now + 30000 };
    respond(adultLease.owner === owner ? { token: adultLease.token } : {});
  } else if (adultLease?.owner === owner && adultLease.token === msg.token) {
    if (msg.type === 'adultRelease') adultLease = null;
    else adultLease.expires = now + 30000;
    respond({ ok: true });
  } else respond({});
  return false;
});

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
