/* Bounded, user-controlled warming for likely same-origin navigation. */
(() => {
  "use strict";

  const MAX_PAGES = 4;
  const MAX_HTML_BYTES = 3_000_000;
  const ARTWORK_FIELDS = ["poster", "posterAlt", "gogPoster", "header", "headerAlt", "banner", "tiny"];
  const NAVIGATION_LINKS = [
    ".pagination a[href]",
    ".paging-navigation a[href]",
    ".lcp_paginator a[href]",
    ".post-navigation a[href]",
    ".mfg-browse-sidebar nav a[href]",
    ".mfg-footer-links a[href]",
    ".mfg-footer-chart-link[href]"
  ].join(",");
  const NEXT_LINKS = [
    ".pagination a.next[href]",
    ".pagination a.next.page-numbers[href]",
    ".paging-navigation a.next[href]",
    ".lcp_paginator a.lcp_nextlink[href]"
  ].join(",");

  const pageNumber = value => {
    let url;
    try { url = new URL(value, location.href); } catch { return 1; }
    const pathPage = url.pathname.match(/\/page\/(\d+)\/?$/i);
    if (pathPage) return Number(pathPage[1]) || 1;
    for (const key of ["paged", "page", "lcp_page0"]) {
      const number = Number(url.searchParams.get(key));
      if (number > 0) return number;
    }
    return 1;
  };

  function mount(changes, enabled = () => true) {
    const seen = new Map();
    const controllers = new Set();
    const warmImages = new Set();
    let active = true;
    let hoverTimer = 0;
    let idleTimer = 0;
    let loadListener = null;

    const connectionAllows = () => {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (navigator.onLine === false || connection?.saveData) return false;
      return !/(?:^|-)2g$/i.test(connection?.effectiveType || "");
    };

    const allowed = () => active && enabled() && connectionAllows() && document.visibilityState !== "hidden";

    const safeDocumentURL = value => {
      try {
        const url = new URL(value, location.href);
        if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return null;
        url.hash = "";
        return url.href === new URL(location.href).href.split("#")[0] ? null : url;
      } catch { return null; }
    };

    const imageURL = (value, base) => {
      if (!value) return null;
      try {
        const url = new URL(value, base);
        if (!/^https?:$/.test(url.protocol)) return null;
        if (location.protocol === "https:" && url.protocol === "http:") url.protocol = "https:";
        return url.href;
      } catch { return null; }
    };

    const warmImage = value => {
      const url = imageURL(value, location.href);
      if (!url || !allowed()) return;
      const image = new Image();
      image.decoding = "async";
      image.fetchPriority = "low";
      const release = () => warmImages.delete(image);
      image.addEventListener("load", release, { once: true });
      image.addEventListener("error", release, { once: true });
      warmImages.add(image);
      image.src = url;
    };

    const srcsetURLs = value => (value || "").split(",").map(candidate => candidate.trim().split(/\s+/)[0]).filter(Boolean);

    const warmDocumentImages = (documentCopy, base) => {
      if (!allowed()) return;
      const unique = new Set();
      const images = documentCopy.querySelectorAll("#content img, #content-sidebar img, #primary-sidebar img, main img");
      for (const image of images) {
        if (image.closest("article.tag-adult")) continue;
        const sources = [image.getAttribute("src"), image.getAttribute("data-lazy-src"), image.getAttribute("data-src")];
        sources.push(...srcsetURLs(image.getAttribute("srcset")), ...srcsetURLs(image.getAttribute("data-srcset")));
        for (const source of sources) {
          const url = imageURL(source, base);
          if (url) unique.add(url);
        }
      }
      for (const source of documentCopy.querySelectorAll("#content source[srcset], #content source[data-srcset], main source[srcset], main source[data-srcset]")) {
        for (const candidate of [...srcsetURLs(source.getAttribute("srcset")), ...srcsetURLs(source.getAttribute("data-srcset"))]) {
          const url = imageURL(candidate, base);
          if (url) unique.add(url);
        }
      }
      for (const url of unique) warmImage(url);
    };

    const destinationTitles = documentCopy => {
      const titles = [];
      const unique = new Set();
      const candidates = documentCopy.querySelectorAll([
        "article.category-lossless-repack .entry-title",
        ".lcp_catlist > li > a",
        ".widgets-grid-layout .widget-grid-view-image a[title]",
        ".widgets-grid-layout img[alt]",
        ".entry-content span"
      ].join(","));
      for (const node of candidates) {
        const raw = node.getAttribute("title") || node.getAttribute("alt") || node.textContent || "";
        if (node.matches(".entry-content span") && !/^[\s ]*[→↣⇢➔➜➤➡⮕➝➢]+/.test(raw)) continue;
        const cleaned = raw.replace(/^[\s ]*[→↣⇢➔➜➤➡⮕➝➢]+\s*/, "").replace(/\s+/g, " ").trim();
        const title = globalThis.MFGRepack?.searchName ? MFGRepack.searchName(cleaned) : cleaned.replace(/\s*[–—-]\s*(?:repack|fitgirl).*$/i, "").trim();
        if (!title || title.length < 2 || /^(?:download|updates?|faq|contacts?|popular|upcoming repacks)$/i.test(title) || unique.has(title.toLocaleLowerCase())) continue;
        unique.add(title.toLocaleLowerCase());
        titles.push(title);
      }
      return titles;
    };

    const warmResolvedGames = documentCopy => new Promise(resolve => {
      const titles = destinationTitles(documentCopy);
      if (!titles.length || !allowed() || !globalThis.chrome?.runtime?.sendMessage) return resolve();
      let finished = false;
      const finish = result => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        if (result && allowed()) {
          const unique = new Set();
          for (const game of Object.values(result)) {
            for (const field of ARTWORK_FIELDS) {
              const url = imageURL(game?.[field], location.href);
              if (url) unique.add(url);
            }
          }
          for (const url of unique) warmImage(url);
        }
        resolve();
      };
      const timeout = setTimeout(() => finish(null), 20_000);
      try {
        chrome.runtime.sendMessage({ type: "resolveGames", titles }, response => {
          if (chrome.runtime.lastError) return finish(null);
          finish(response);
        });
      } catch { finish(null); }
    });

    const warm = async value => {
      if (!allowed()) return false;
      const url = safeDocumentURL(value);
      if (!url) return false;
      if (seen.has(url.href)) return seen.get(url.href);
      if (seen.size >= MAX_PAGES) return false;

      const controller = new AbortController();
      controllers.add(controller);
      const task = (async () => {
        try {
          const response = await fetch(url.href, {
            cache: "force-cache",
            credentials: "same-origin",
            signal: controller.signal,
            priority: "low"
          });
          if (!response.ok || !/text\/html/i.test(response.headers.get("content-type") || "")) return false;
          const declaredSize = Number(response.headers.get("content-length"));
          if (declaredSize > MAX_HTML_BYTES) return false;
          const html = await response.text();
          if (html.length > MAX_HTML_BYTES || !allowed()) return false;
          const documentCopy = new DOMParser().parseFromString(html, "text/html");
          warmDocumentImages(documentCopy, url.href);
          await warmResolvedGames(documentCopy);
          return true;
        } catch (error) {
          if (error?.name !== "AbortError") seen.delete(url.href);
          return false;
        } finally {
          controllers.delete(controller);
        }
      })();
      seen.set(url.href, task);
      return task;
    };

    const navigationLink = target => target?.closest?.(NAVIGATION_LINKS);
    const scheduleHover = link => {
      clearTimeout(hoverTimer);
      if (!link || !safeDocumentURL(link.href)) return;
      hoverTimer = setTimeout(() => warm(link.href), 90);
    };
    const onPointerOver = event => scheduleHover(navigationLink(event.target));
    const onPointerOut = event => {
      const link = navigationLink(event.target);
      if (link && !link.contains(event.relatedTarget)) clearTimeout(hoverTimer);
    };
    const onFocusIn = event => {
      const link = navigationLink(event.target);
      if (link) warm(link.href);
    };
    const onTouchStart = event => {
      const link = navigationLink(event.target);
      if (link) warm(link.href);
    };

    document.addEventListener("pointerover", onPointerOver, { passive: true });
    document.addEventListener("pointerout", onPointerOut, { passive: true });
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("touchstart", onTouchStart, { passive: true });

    const scheduleAutomaticNextPage = () => {
      if (!allowed() || pageNumber(location.href) !== 1) return;
      const next = document.querySelector(NEXT_LINKS);
      if (!next || pageNumber(next.href) !== 2) return;
      const run = () => warm(next.href);
      if ("requestIdleCallback" in window) idleTimer = requestIdleCallback(run, { timeout: 2500 });
      else idleTimer = setTimeout(run, 700);
    };
    if (document.readyState === "complete") scheduleAutomaticNextPage();
    else {
      loadListener = scheduleAutomaticNextPage;
      window.addEventListener("load", loadListener, { once: true });
    }

    changes.push(() => {
      active = false;
      clearTimeout(hoverTimer);
      if ("cancelIdleCallback" in window) cancelIdleCallback(idleTimer);
      else clearTimeout(idleTimer);
      if (loadListener) window.removeEventListener("load", loadListener);
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("touchstart", onTouchStart);
      for (const controller of controllers) controller.abort();
      controllers.clear();
      warmImages.clear();
    });
  }

  globalThis.MFGPrefetch = { mount, pageNumber };
})();
