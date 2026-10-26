/* Two separate supporting columns; moved widgets return to their original positions. */
(() => {
  "use strict";
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
    const promotion = document.createElement("aside"); promotion.className = "mfg-promo-sidebar"; promotion.setAttribute("aria-label", "Site content and support");
    main.prepend(browse); main.append(promotion);
    changes.push(() => { browse.remove(); promotion.remove(); });
    const title = document.createElement("h2"); title.textContent = "Browse"; browse.append(title);
    const navigation = document.createElement("nav"); navigation.setAttribute("aria-label", "Repack collections");
    for (const [label, path] of [["Latest repacks", "/"], ["All repacks A–Z", "/all-my-repacks-a-z/"], ["Popular this month", "/popular-repacks/"], ["Popular this year", "/popular-repacks-of-the-year/"], ["Game updates", "/updates-list/"], ["Update digests", "/category/updates-digest/"], ["FAQ", "/faq/"], ["Troubleshooting", "/repacks-troubleshooting/"], ["Contacts", "/contacts/"]]) {
      const link = document.createElement("a"); link.href = path; link.textContent = label;
      if (location.pathname === path || (path === "/popular-repacks/" && location.pathname === "/pop-repacks/")) link.setAttribute("aria-current", "page");
      navigation.append(link);
    }
    browse.append(navigation);
    const promoTitle = document.createElement("h2"); promoTitle.textContent = "From the site"; promotion.append(promoTitle);
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
      else move(widget, promotion, ({ "block-4": "Support the site", "block-2": "Popular this week", "block-9": "Site promotion" }[widget.id]) || label || "More from FitGirl", widget.id === "block-2" || widget.id === "block-4");
    }
    const description = document.querySelector("#secondary > .site-description");
    if (description) move(description, promotion, "About the site");
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
  globalThis.MFGNavigation = { mount };
})();
