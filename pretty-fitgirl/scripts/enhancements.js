/* No requests, navigation interception, or site-script replacement. */
(() => {
  "use strict";
  if (location.hostname !== "fitgirl-repacks.site" || window.top !== window) return;
  const root = document.documentElement;
  const defaults = { enabled: true, density: "comfortable", view: "grid" };
  let preferences = { ...defaults };
  let ready = false;
  let enhanced = false;
  const changes = [];
  function siteLogo() {
    const brand = document.querySelector("#masthead .site-title a");
    if (!brand) return;
    try {
      const logo = document.createElement("img");
      logo.src = chrome.runtime.getURL("assets/logo.png");
      logo.className = "mfg-site-logo";
      logo.alt = "";
      logo.width = 32;
      logo.height = 32;
      brand.prepend(logo);
      changes.push(() => logo.remove());
    } catch { /* The original linked site title remains available. */ }
  }

  function popularPage(content) {
    if (!/^\/(popular-repacks|pop-repacks|popular-repacks-of-the-year)\/?$/.test(location.pathname)) return false;
    const body = content.querySelector("article > .entry-content");
    const grids = [...(body?.querySelectorAll(".widgets-grid-layout") || [])];
    if (!grids.length) return false;
    content.classList.add("mfg-popular");
    changes.push(() => content.classList.remove("mfg-popular"));
    const controls = document.createElement("div");
    controls.className = "mfg-popular-tools";
    const tabs = document.createElement("nav");
    tabs.setAttribute("aria-label", "Popular collections");
    for (const [label, path] of [["This month", "/popular-repacks/"], ["This year", "/popular-repacks-of-the-year/"]]) {
      const link = document.createElement("a");
      link.href = path;
      link.textContent = label;
      if (path === location.pathname || (label === "This month" && location.pathname === "/pop-repacks/")) link.setAttribute("aria-current", "page");
      tabs.append(link);
    }
    const field = document.createElement("input");
    field.type = "search";
    field.placeholder = "Filter this collection…";
    field.setAttribute("aria-label", "Filter games in this collection");
    const count = document.createElement("p");
    count.setAttribute("role", "status");
    controls.append(tabs, field, count);
    body.prepend(controls);
    changes.push(() => controls.remove());
    const cards = [];
    for (const grid of grids) {
      const items = [...grid.querySelectorAll(":scope > .widget-grid-view-image")];
      items.forEach((card, index) => {
        const link = card.querySelector("a[href]");
        const image = link?.querySelector("img");
        if (!link) return;
        const title = link.getAttribute("title") || image?.alt || link.textContent.trim();
        if (image) {
          const artwork = document.createElement("span"); artwork.className = "mfg-popular-art";
          artwork.append(MFGRepack.placeholder()); image.before(artwork); artwork.append(image);
          const onError = () => artwork.classList.add("mfg-image-missing");
          image.addEventListener("error", onError);
          if (image.complete && !image.naturalWidth) onError();
          changes.push(() => { image.removeEventListener("error", onError); artwork.before(image); artwork.remove(); });
        } else {
          const artwork = document.createElement("span"); artwork.className = "mfg-popular-art"; artwork.append(MFGRepack.placeholder()); link.prepend(artwork);
          changes.push(() => artwork.remove());
        }
        const caption = document.createElement("span");
        caption.className = "mfg-popular-caption";
        const rank = document.createElement("span");
        rank.className = "mfg-rank";
        rank.textContent = String(index + 1).padStart(2, "0");
        const text = document.createElement("span");
        text.textContent = title;
        caption.append(rank, text);
        link.append(caption);
        cards.push({ card, title });
        changes.push(() => { caption.remove(); card.hidden = false; card.removeAttribute("hidden"); });
      });
    }
    const filter = () => {
      const query = field.value.trim().toLocaleLowerCase();
      let visible = 0;
      for (const { card, title } of cards) {
        card.hidden = !title.toLocaleLowerCase().includes(query);
        if (!card.hidden) visible++;
      }
      count.textContent = query ? `${visible} of ${cards.length} games · original ranking` : `${cards.length} games · original ranking`;
    };
    field.addEventListener("input", filter);
    filter();
    return true;
  }

  function syncControls() {
    for (const button of document.querySelectorAll(".mfg-view-button")) {
      button.setAttribute("aria-pressed", String(button.dataset.view === preferences.view));
    }
  }

  function changeView(view) {
    preferences = normalize({ ...preferences, view });
    apply();
    try { chrome.storage.local.set({ modernFitGirl: preferences }); } catch { /* Retain the local view if storage is unavailable. */ }
  }

  function restore() {
    for (const undo of changes.splice(0).reverse()) undo();
    enhanced = false;
  }

  function enhance() {
    if (enhanced) return;
    // Only the homepage has #main-content; archives/search/detail place #primary in #main.
    const content = document.querySelector("#main #primary #content");
    if (!content) return; // Fail safely if the theme changes.
    enhanced = true;
    // Malformed digest markup leaves anchors around only hidden styles/donation blocks.
    // Keep those nodes, but do not let their empty wrappers reserve game-grid cells.
    for (const anchor of content.querySelectorAll(":scope > a")) {
      const meaningfulText = [...anchor.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      const invisibleChildren = [...anchor.children].every(child => getComputedStyle(child).display === "none");
      if (!meaningfulText && invisibleChildren) {
        const originalClass = anchor.getAttribute("class");
        anchor.classList.add("mfg-grid-passthrough");
        changes.push(() => originalClass === null ? anchor.removeAttribute("class") : anchor.setAttribute("class", originalClass));
      }
    }
    MFGNavigation.mount(changes);
    siteLogo();
    MFGExperience.mount(content, changes);

    if (MFGExperience.digest(content, changes)) return;
    if (MFGDirectory.mount(content, changes)) return;
    if (popularPage(content)) return;

    if (document.body.matches(".single")) {
      const article = content.querySelector("article.category-lossless-repack");
      if (article) MFGRepack.enhanceDetail(article, changes);
      return;
    }
    if (!document.body.matches(".home, .archive, .search")) return;

    const posts = [...content.querySelectorAll(":scope > article.hentry")];
    const gamePosts = posts.filter(article => article.classList.contains("category-lossless-repack"));
    const pageHeader = content.querySelector(":scope > .page-header, :scope > .archive-header");
    const toolbar = document.createElement("section");
    toolbar.className = "mfg-toolbar";
    toolbar.id = "mfg-listing-toolbar";
    toolbar.setAttribute("aria-label", "Listing appearance");
    const context = document.createElement("div");
    const heading = document.createElement("h2");
    heading.textContent = document.body.matches(".search") ? "Search results" : document.body.matches(".archive") ? "Repacks" : "Latest repacks";
    const count = document.createElement("p");
    count.textContent = document.body.matches(".search")
      ? `${posts.length} result${posts.length === 1 ? "" : "s"} on this page`
      : `${gamePosts.length} repack${gamePosts.length === 1 ? "" : "s"} on this page`;
    if (!pageHeader) context.append(heading);
    context.append(count);
    const controls = document.createElement("div");
    controls.className = "mfg-view-controls";
    controls.setAttribute("role", "group");
    controls.setAttribute("aria-label", "Listing layout");
    for (const view of ["grid", "list"]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mfg-view-button";
      button.dataset.view = view;
      const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      icon.setAttribute("viewBox", "0 0 20 20");
      icon.setAttribute("aria-hidden", "true");
      const shape = document.createElementNS("http://www.w3.org/2000/svg", "path");
      shape.setAttribute("d", view === "grid" ? "M3 3h5v5H3zM12 3h5v5h-5zM3 12h5v5H3zM12 12h5v5h-5z" : "M3 4h3v3H3zM9 5.5h8M3 12h3v3H3zM9 13.5h8");
      icon.append(shape);
      button.append(icon, document.createTextNode(view === "grid" ? "Grid" : "List"));
      button.addEventListener("click", () => changeView(view));
      controls.append(button);
    }
    toolbar.append(context, controls);
    if (pageHeader) pageHeader.after(toolbar);
    else content.prepend(toolbar);
    changes.push(() => toolbar.remove());

    // Group non-game posts away from the grid, preserving their nodes and original order.
    const notices = document.body.matches(".search") ? [] : posts.filter(post => !gamePosts.includes(post));
    const extras = [...content.children].filter(node => !node.matches("article, header, nav, style, script, .mfg-toolbar, .mfg-grid-passthrough") && getComputedStyle(node).display !== "none");
    const supportingPosts = [...content.children].filter(node => notices.includes(node) || extras.includes(node));
    if (supportingPosts.length && gamePosts.length) {
      const updates = document.createElement("details");
      updates.className = "mfg-updates";
      const summary = document.createElement("summary");
      summary.textContent = notices.length ? `Updates & announcements (${notices.length})` : "Site notices";
      const items = document.createElement("div");
      items.className = "mfg-update-items";
      updates.append(summary, items);
      toolbar.after(updates);
      changes.push(() => updates.remove());
      for (const post of supportingPosts) {
        const position = document.createComment("mfg-original-position");
        post.before(position);
        items.append(post);
        changes.push(() => { position.replaceWith(post); });
      }
    }

    for (const article of posts) {
      const titleLink = article.querySelector(".entry-header .entry-title a");
      const body = article.querySelector(":scope > .entry-content, :scope > .entry-summary");
      if (!titleLink || !body) continue;
      const game = article.classList.contains("category-lossless-repack");
      const className = game || document.body.matches(".search") ? "mfg-card" : "mfg-announcement";
      article.classList.add(className);
      changes.push(() => article.classList.remove(className));

      // The observed cover is the small alignleft image inside the metadata paragraph.
      // Search results have text excerpts only: never fetch another page to fill a card.
      const image = body.querySelector("img.alignleft");
      if (game || document.body.matches(".search")) {
        const hasCover = Boolean(image?.getAttribute("src"));
        article.classList.add(hasCover ? "mfg-has-cover" : "mfg-no-cover");
        article.dataset.mfgCover = hasCover ? "available" : "unavailable";
        changes.push(() => {
          article.classList.remove("mfg-has-cover", "mfg-no-cover");
          delete article.dataset.mfgCover;
        });
        const originalTitle = titleLink.getAttribute("title"); titleLink.title = titleLink.textContent.trim();
        changes.push(() => originalTitle === null ? titleLink.removeAttribute("title") : titleLink.setAttribute("title", originalTitle));
        const data = MFGRepack.metadata(body);
        article.classList.add("mfg-game");
        changes.push(() => article.classList.remove("mfg-game"));
        const summary = MFGRepack.summary(article, data, titleLink.href);
        article.append(summary);
        changes.push(() => summary.remove());
        const cover = MFGRepack.cover(image, titleLink.href, titleLink.textContent.trim());
        article.prepend(cover);
        changes.push(() => cover.remove());
      }

      // Only announcements expand inline. Game content is reached through View repack.
      if (!game && body.classList.contains("entry-content")) {
        const disclosure = document.createElement("details");
        disclosure.className = "mfg-post-content";
        const summary = document.createElement("summary");
        summary.textContent = "Read update";
        body.before(disclosure);
        disclosure.append(summary, body);
        changes.push(() => { disclosure.before(body); disclosure.remove(); });
      }
    }

    const gameCards = posts.filter(article => article.classList.contains("mfg-card"));
    if (gameCards.length === 8) {
      content.classList.add("mfg-eight-games");
      content.dataset.mfgGameCount = "8";
      changes.push(() => {
        content.classList.remove("mfg-eight-games");
        delete content.dataset.mfgGameCount;
      });
    }

    // Hierarchy: games with covers appear first, games without cover sent to bottom
    const withCover = gameCards.filter(card => card.dataset.mfgCover === "available");
    const withoutCover = gameCards.filter(card => card.dataset.mfgCover !== "available");
    const firstWithoutCoverIndex = gameCards.findIndex(card => card.dataset.mfgCover !== "available");
    const lastWithCoverIndex = gameCards.length - 1 - [...gameCards].reverse().findIndex(card => card.dataset.mfgCover === "available");
    const needsReorder = firstWithoutCoverIndex !== -1 && lastWithCoverIndex !== -1 && firstWithoutCoverIndex < lastWithCoverIndex;

    if (needsReorder) {
      const cardPositions = gameCards.map(card => {
        const marker = document.createComment("mfg-card-position");
        card.before(marker);
        return { card, marker };
      });
      changes.push(() => {
        for (const { card, marker } of cardPositions) {
          marker.replaceWith(card);
        }
      });
      const anchor = cardPositions[0].marker;
      for (const card of [...withCover, ...withoutCover]) {
        anchor.before(card);
      }
    }
    syncControls();
    revealHash();
  }

  function revealHash() {
    if (!location.hash || !preferences.enabled) return;
    let target;
    try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch { return; }
    if (!target) return;
    let ancestor = target;
    let opened = false;
    while (ancestor) {
      if (ancestor.matches("details")) { ancestor.open = true; opened = true; }
      ancestor = ancestor.parentElement;
    }
    if (opened) target.scrollIntoView({ block: "start" });
  }

  function apply() {
    root.classList.toggle("mfg-on", preferences.enabled);
    root.classList.toggle("mfg-off", !preferences.enabled);
    if (preferences.enabled) {
      root.dataset.mfgDensity = preferences.density;
      root.dataset.mfgView = preferences.view;
      if (ready) enhance();
      syncControls();
    } else {
      delete root.dataset.mfgDensity;
      delete root.dataset.mfgView;
      restore();
    }
  }

  function normalize(value) {
    return {
      enabled: typeof value?.enabled === "boolean" ? value.enabled : defaults.enabled,
      density: value?.density === "compact" ? "compact" : defaults.density,
      view: value?.view === "list" ? "list" : defaults.view
    };
  }

  apply(); // document_start: style the root before first content paint.
  try {
    chrome.storage.local.get("modernFitGirl", (stored) => {
      if (chrome.runtime.lastError) return;
      preferences = normalize(stored.modernFitGirl);
      apply();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes.modernFitGirl) return;
      preferences = normalize(changes.modernFitGirl.newValue);
      apply();
    });
  } catch { /* CSS and default presentation still work without storage. */ }

  const start = () => { ready = true; if (preferences.enabled) enhance(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
  window.addEventListener("hashchange", revealHash);
})();
