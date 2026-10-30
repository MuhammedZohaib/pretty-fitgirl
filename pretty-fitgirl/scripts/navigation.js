/* Primary navigation with secondary site widgets behind one disclosure. */
(() => {
  "use strict";
  const UPCOMING_LINK_RE = /upcoming\s+repacks/i;
  // Build the Browse rail and relocate original WordPress widgets into a compact, nested disclosure.
  function mount(changes) {
    const main = document.getElementById("main");
    if (!main) return;
    try {
      const fonts = document.createElement("style");
      fonts.textContent = [
        ["MFG Inter", "inter-latin.woff2"], ["MFG Manrope", "manrope-latin.woff2"]
      ].map(([name, file]) => `@font-face{font-family:"${name}";font-style:normal;font-weight:400 700;font-display:swap;src:url("${chrome.runtime.getURL(`assets/fonts/${file}`)}") format("woff2");}`).join("\n");
      document.head.append(fonts); changes.push(() => fonts.remove());
    } catch {}
    const browse = document.createElement("aside"); browse.className = "mfg-browse-sidebar"; browse.setAttribute("aria-label", "Browse repacks");
    const promotion = document.createElement("details"); promotion.className = "mfg-promo-sidebar";
    const promotionSummary = document.createElement("summary");
    const promotionCopy = document.createElement("span"); promotionCopy.className = "mfg-promo-summary-copy";
    const promotionTitle = document.createElement("strong"); promotionTitle.textContent = "Site resources";
    const promotionHint = document.createElement("small"); promotionHint.textContent = "Support, news & information";
    promotionCopy.append(promotionTitle, promotionHint); promotionSummary.append(promotionCopy);
    const promotionBody = document.createElement("div"); promotionBody.className = "mfg-promo-body";
    promotion.append(promotionSummary, promotionBody);
    main.prepend(browse);
    changes.push(() => { browse.remove(); promotion.remove(); });
    const heading = document.createElement("div"); heading.className = "mfg-browse-heading";
    const title = document.createElement("h2"); title.textContent = "Browse";
    const subtitle = document.createElement("p"); subtitle.textContent = "Explore the repack catalog";
    heading.append(title, subtitle); browse.append(heading);
    const navigation = document.createElement("nav"); navigation.className = "mfg-primary-links"; navigation.setAttribute("aria-label", "Repack collections");
    const upcomingPattern = /^\/upcoming-repacks(?:-\d+)?\/?$/i;
    const liveUpcoming = [...document.querySelectorAll('a[href]')].find(link =>
      link.origin === location.origin && UPCOMING_LINK_RE.test(link.textContent || "") && upcomingPattern.test(link.pathname)
    );
    const upcomingPath = upcomingPattern.test(location.pathname) ? location.pathname : (liveUpcoming?.pathname || "/upcoming-repacks-10/");
    const links = [["Latest repacks", "/"], ["All repacks A–Z", "/all-my-repacks-a-z/"], ["Upcoming repacks", upcomingPath], ["Popular this month", "/popular-repacks/"], ["Popular this year", "/popular-repacks-of-the-year/"], ["Game updates", "/updates-list/"], ["Update digests", "/category/updates-digest/"], ["FAQ", "/faq/"], ["Troubleshooting", "/repacks-troubleshooting/"], ["Contacts", "/contacts/"]];
    let upcomingLink = null;
    for (const [label, path] of links) {
      const group = path === "/" ? "Discover" : path === "/updates-list/" ? "Keep up to date" : path === "/faq/" ? "Help & support" : null;
      if (group) { const heading = document.createElement("h3"); heading.className = "mfg-nav-group"; heading.textContent = group; navigation.append(heading); }
      const link = document.createElement("a"); link.className = "mfg-nav-link"; link.href = path; link.textContent = label;
      if (location.pathname === path || (label === "Upcoming repacks" && upcomingPattern.test(location.pathname)) || (path === "/" && /^\/page\/\d+\/?$/.test(location.pathname)) || (path === "/popular-repacks/" && location.pathname === "/pop-repacks/")) link.setAttribute("aria-current", "page");
      if (label === "Upcoming repacks") upcomingLink = link;
      navigation.append(link);
    }
    if (liveUpcoming) chrome.storage.local.set({ "mfg.upcoming.path": liveUpcoming.pathname });
    else if (!upcomingPattern.test(location.pathname)) {
      chrome.storage.local.get("mfg.upcoming.path", value => {
        const cached = value?.["mfg.upcoming.path"];
        if (upcomingLink && upcomingPattern.test(cached || "")) upcomingLink.href = cached;
      });
    }
    browse.append(navigation);
    browse.append(promotion);
    // Wrap a widget in a <details> panel; a comment marker records where it came from so it can be put back.
    function move(node, destination, label, open = false) {
      const marker = document.createComment("mfg-sidebar-position"); node.before(marker);
      const details = document.createElement("details"); details.className = "mfg-side-panel"; details.open = open;
      const summary = document.createElement("summary"); summary.textContent = label;
      const body = document.createElement("div"); body.className = "mfg-side-content"; body.append(node);
      details.append(summary, body); destination.append(details);
      changes.push(() => { marker.replaceWith(node); details.remove(); });
    }
    const widgets = [...document.querySelectorAll("#content-sidebar > .widget, #primary-sidebar > .widget")];
    for (const widget of widgets) {
      const label = widget.querySelector(".widget-title, .widgettitle")?.textContent.trim();
      if (widget.matches(".widget_archive")) move(widget, browse, "Monthly archives");
      else if (widget.id === "block-7") move(widget, browse, "More collections");
      else if (widget.id === "block-2") continue; // The full live popularity list is promoted in the custom footer.
      else move(widget, promotionBody, ({ "block-4": "Support the site", "block-2": "Popular this week", "block-9": "Site promotion" }[widget.id]) || label || "More from FitGirl");
    }
    const description = document.querySelector("#secondary > .site-description");
    if (description) move(description, promotionBody, "About the site");
    // Merge menu + widget links into an "Additional collections" list, skipping anything already shown.
    const collections = browse.querySelector("#block-7");
    if (collections) {
      const key = link => link.pathname === "/pop-repacks/" ? "/popular-repacks/" : link.pathname;
      const seen = new Set([...navigation.querySelectorAll("a"), ...promotion.querySelectorAll("a")].filter(link => link.hostname === location.hostname).map(key));
      const extra = document.createElement("nav"); extra.className = "mfg-more-links"; extra.setAttribute("aria-label", "Additional collections");
      for (const link of [...document.querySelectorAll("#primary-menu a[href]"), ...collections.querySelectorAll("a[href]")]) {
        const name = link.textContent.replace(/\s+/g, " ").trim();
        if (!name || link.hostname !== location.hostname || seen.has(key(link))) continue;
        seen.add(key(link)); const copy = document.createElement("a"); copy.href = link.href; copy.textContent = name; extra.append(copy);
      }
      const originalClass = collections.getAttribute("class"); collections.classList.add("mfg-nav-source"); collections.after(extra);
      changes.push(() => { extra.remove(); originalClass === null ? collections.removeAttribute("class") : collections.setAttribute("class", originalClass); });
    }
  }
  // Exposed to enhancements.js.
  globalThis.MFGNavigation = { mount };
})();
