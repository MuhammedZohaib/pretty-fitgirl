/* Enrich only visible A–Z entries, using their original same-origin repack pages. */
(() => {
  "use strict";
  // Turn the A-Z list into a cover grid. Covers load lazily (only near the viewport) with limited concurrency, and are cached for 7 days.
  function mount(content, changes) {
    if (!/^\/all-my-repacks-a-z\/?$/.test(location.pathname)) return false;
    const list = content.querySelector(".entry-content > .lcp_catlist");
    if (!list) return false;
    content.classList.add("mfg-directory");
    changes.push(() => content.classList.remove("mfg-directory"));
    // `active` flips to false on undo so in-flight work stops touching the page; the controller aborts pending fetches.
    let active = true;
    const controller = new AbortController();
    const pending = [];
    let running = 0;
    // Covers already visible on the page (e.g. sidebar) - reuse them instead of fetching.
    const observedArt = new Map();
    for (const image of document.querySelectorAll("a[href] img[src]")) {
      const link = image.closest("a[href]");
      if (link.origin === location.origin) observedArt.set(link.href, image.src);
    }
    // Only accept https image URLs (blocks javascript:/data: or mixed content).
    const allowed = value => { try { const url = new URL(value); return url.protocol === "https:" ? url.href : ""; } catch { return ""; } };
    // Per-page storage key (path only, so http/https/host variants share an entry).
    const cacheKey = url => `mfg.cover.v1.${new URL(url).pathname}`;
    // Find a cover URL for a repack page: page art -> storage cache -> fetch the page and read its first alignleft image.
    const imageFor = async url => {
      if (observedArt.has(url)) return observedArt.get(url);
      try {
        const cached = await chrome.storage.local.get(cacheKey(url));
        const record = cached[cacheKey(url)];
        if (record && Date.now() - record.time < 7 * 86400000 && allowed(record.src)) return record.src;
      } catch {}
      if (!active) return "";
      const target = new URL(url);
      if (target.origin !== location.origin) return "";
      const request = new AbortController();
      const cancel = () => request.abort();
      controller.signal.addEventListener('abort', cancel, { once: true });
      const timeout = setTimeout(cancel, 8000);
      let html;
      try {
        const response = await fetch(target.href, { signal: request.signal, credentials: "same-origin", cache: "force-cache" });
        if (!response.ok || !response.url.startsWith(location.origin + "/")) return "";
        html = await response.text();
      } finally {
        clearTimeout(timeout);
        controller.signal.removeEventListener('abort', cancel);
      }
      const tag = (html.match(/<img\b[^>]*>/gi) || []).find(value => /\bclass\s*=\s*["'][^"']*\balignleft\b/i.test(value));
      if (!tag) return "";
      // Parse only the image tag, without importing scripts or the fetched document.
      const image = new DOMParser().parseFromString(tag, "text/html").querySelector("img");
      const src = allowed(new URL(image?.getAttribute("src") || "", target).href);
      if (!src || !image?.getAttribute("src")) return "";
      if (active) {
        try { await chrome.storage.local.set({ [cacheKey(url)]: { src, time: Date.now() } }); } catch {}
      }
      return src;
    };
    // Worker loop: keep at most 3 cover loads running so we do not hammer the site.
    async function pump() {
      while (active && running < 3 && pending.length) {
        const { card, url, frame, title } = pending.shift(); running++;
        (async () => {
          try {
            MFGRepack.showSpinner(frame);
            MFGRepack.attachSteamRating(frame, title);
            let src = "";
            try { src = await imageFor(url); } catch { src = ""; }
            if (!active) return;
            if (!src) { MFGRepack.loadSteamCover(frame, title); return; }
            const image = document.createElement("img"); image.src = src; image.alt = ""; image.loading = "lazy"; image.decoding = "async";
            const onOrigLoad = () => {
              MFGRepack.hideSpinner(frame);
              MFGRepack.setSourceBadge(frame, "original");
            };
            if (image.complete && image.naturalWidth > 0) {
              onOrigLoad();
            } else {
              image.addEventListener("load", onOrigLoad, { once: true });
            }
            image.addEventListener("error", () => { image.remove(); if (active) MFGRepack.loadSteamCover(frame, title); }, { once: true });
            frame.append(image); card.dataset.artwork = "loaded";
          } catch { /* Leave the consistent placeholder when the source is unavailable. */ }
          finally { running--; pump(); }
        })();
      }
    }
    // Queue a card for loading only when it is about to scroll into view (250px margin).
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        observer.unobserve(entry.target);
        pending.push(entry.target.mfgArtwork); pump();
      }
    }, { rootMargin: "250px" });
    for (const item of list.querySelectorAll(":scope > li")) {
      const link = item.querySelector(":scope > a[href]"); if (!link) continue;
      const originalClass = item.getAttribute("class");
      item.classList.add("mfg-directory-card");
      const frame = MFGRepack.cover(null, link.href, link.textContent.trim(), "mfg-cover", false, false);
      const heading = document.createElement("h2"); heading.className = "mfg-directory-title";
      link.before(heading); heading.append(link); item.prepend(frame);
      const originalTitle = link.getAttribute("title"); link.title = link.textContent.trim();
      item.mfgArtwork = { card: item, url: link.href, frame, title: link.textContent.trim() }; observer.observe(item);
      changes.push(() => {
        heading.before(link); heading.remove(); frame.remove(); delete item.dataset.artwork; delete item.mfgArtwork;
        originalClass === null ? item.removeAttribute("class") : item.setAttribute("class", originalClass);
        originalTitle === null ? link.removeAttribute("title") : link.setAttribute("title", originalTitle);
      });
    }
    changes.push(() => { active = false; observer.disconnect(); controller.abort(); pending.length = 0; });
    // Prune older artwork-cache entries without touching user preferences.
    // PERF: get(null) loads the ENTIRE storage area, so run it at most once a day
    // (tracked by a tiny timestamp key) and defer it until the browser is idle.
    const prune = () => {
      try {
        chrome.storage.local.get("mfg.cover.pruned").then(meta => {
          if (Date.now() - (meta["mfg.cover.pruned"] || 0) < 86400000) return;
          return chrome.storage.local.get(null).then(values => {
            const keys = Object.entries(values).filter(([key]) => key.startsWith("mfg.cover.v1.")).sort((a, b) => (b[1]?.time || 0) - (a[1]?.time || 0)).slice(300).map(([key]) => key);
            if (active && keys.length) chrome.storage.local.remove(keys);
            chrome.storage.local.set({ "mfg.cover.pruned": Date.now() });
          });
        }).catch(() => {});
      } catch {}
    };
    if (typeof requestIdleCallback === "function") requestIdleCallback(prune, { timeout: 5000 });
    else setTimeout(prune, 2000);
    return true;
  }
  // Exposed to enhancements.js.
  globalThis.MFGDirectory = { mount };
})();
