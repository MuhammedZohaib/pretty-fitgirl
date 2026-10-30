/* Structured footer built from the original site's live popularity widget. */
(() => {
  "use strict";

  const link = (label, href) => {
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.textContent = label;
    return anchor;
  };

  function mount(changes) {
    const footer = document.getElementById("colophon");
    if (!footer || footer.querySelector(":scope > .mfg-footer-shell")) return;

    // Retain the original footer subtree off-DOM. Its live link/image nodes are
    // reused below and returned to their exact positions when the theme is off.
    const stash = document.createElement("div");
    stash.className = "mfg-footer-source";
    stash.hidden = true;
    const roots = [...footer.childNodes].map(node => {
      const marker = document.createComment("mfg-footer-root");
      node.before(marker);
      stash.append(node);
      return { marker, node };
    });

    const shell = document.createElement("div");
    shell.className = "mfg-footer-shell";

    const popular = document.createElement("section");
    popular.className = "mfg-footer-popular";
    popular.setAttribute("aria-labelledby", "mfg-footer-popular-title");

    const heading = document.createElement("header");
    heading.className = "mfg-footer-heading";
    const headingCopy = document.createElement("div");
    const eyebrow = document.createElement("p");
    eyebrow.className = "mfg-footer-eyebrow";
    eyebrow.textContent = "Popular today";
    const title = document.createElement("h2");
    title.id = "mfg-footer-popular-title";
    title.textContent = "Most popular repacks";
    const description = document.createElement("p");
    description.className = "mfg-footer-description";
    description.textContent = "The games readers are opening most on the original site.";
    headingCopy.append(eyebrow, title, description);
    const chartLink = link("View monthly chart", "/popular-repacks/");
    chartLink.className = "mfg-footer-chart-link";
    heading.append(headingCopy, chartLink);

    const grid = document.createElement("div");
    grid.className = "mfg-footer-grid";
    const cardRecords = [];
    const sourceCards = [...stash.querySelectorAll(".jetpack_top_posts_widget .widgets-grid-layout > .widget-grid-view-image")].slice(0, 10);

    sourceCards.forEach(card => {
      const cardLink = card.querySelector(":scope > a[href]");
      if (!cardLink) return;
      const marker = document.createComment("mfg-footer-card");
      card.before(marker);
      const image = cardLink.querySelector("img");
      const originalTitle = cardLink.getAttribute("title") || image?.alt || cardLink.textContent.trim();
      const displayTitle = globalThis.MFGRepack?.searchName(originalTitle) || originalTitle;

      card.classList.add("mfg-footer-card", "mfg-game-card");
      const copy = document.createElement("span");
      copy.className = "mfg-footer-card-copy";
      copy.setAttribute("aria-hidden", "true");
      const name = document.createElement("span");
      name.className = "mfg-footer-card-title";
      name.textContent = displayTitle;
      copy.append(name);
      cardLink.append(copy);
      MFGRepack.attachSteamRating(cardLink, originalTitle);
      grid.append(card);
      cardRecords.push({ card, marker, copy });
    });

    if (cardRecords.length) popular.append(heading, grid);

    const utility = document.createElement("div");
    utility.className = "mfg-footer-utility";
    const brand = document.createElement("div");
    brand.className = "mfg-footer-brand";
    try {
      const logo = document.createElement("img");
      logo.src = chrome.runtime.getURL("assets/logo.png");
      logo.alt = "";
      logo.width = 36;
      logo.height = 36;
      brand.append(logo);
    } catch { /* The text brand remains useful without extension URLs. */ }
    const brandCopy = document.createElement("div");
    const brandName = document.createElement("strong");
    brandName.textContent = "Pretty FitGirl";
    const brandNote = document.createElement("span");
    brandNote.textContent = "An unofficial, private-by-default browsing layer. No tracking.";
    brandCopy.append(brandName, brandNote);
    brand.append(brandCopy);

    const browseNav = document.createElement("nav");
    browseNav.className = "mfg-footer-links";
    browseNav.setAttribute("aria-label", "Explore repacks");
    const browseTitle = document.createElement("strong");
    browseTitle.textContent = "Explore";
    browseNav.append(browseTitle, link("Latest repacks", "/"), link("All repacks A–Z", "/all-my-repacks-a-z/"), link("Updates", "/updates-list/"));

    const helpNav = document.createElement("nav");
    helpNav.className = "mfg-footer-links";
    helpNav.setAttribute("aria-label", "Help and information");
    const helpTitle = document.createElement("strong");
    helpTitle.textContent = "Information";
    helpNav.append(helpTitle, link("FAQ", "/faq/"), link("Troubleshooting", "/repacks-troubleshooting/"), link("Contacts", "/contacts/"));
    utility.append(brand, browseNav, helpNav);

    if (cardRecords.length) shell.append(popular);
    shell.append(utility);
    footer.append(stash, shell);

    changes.push(() => {
      for (const { card, marker, copy } of cardRecords) {
        copy.remove();
        card.querySelector(":scope > a > .mfg-steam-rating")?.remove();
        card.classList.remove("mfg-footer-card", "mfg-game-card");
        marker.replaceWith(card);
      }
      shell.remove();
      stash.remove();
      for (const { marker, node } of roots) marker.replaceWith(node);
    });
  }

  globalThis.MFGFooter = { mount };
})();
