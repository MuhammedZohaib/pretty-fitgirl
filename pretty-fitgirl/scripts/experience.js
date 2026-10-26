/* Reversible interface helpers. Source comments, update links, and handlers remain intact. */
(() => {
  "use strict";
  function mount(content, changes) {
    const header = document.getElementById("masthead");
    const browse = document.querySelector(".mfg-browse-sidebar");
    if (header && browse) {
      browse.id = "mfg-browse-panel";
      const toggle = document.createElement("button"); toggle.type = "button"; toggle.className = "mfg-browse-toggle";
      toggle.textContent = "Browse"; toggle.setAttribute("aria-controls", browse.id); toggle.setAttribute("aria-expanded", "false");
      const setOpen = open => { document.documentElement.classList.toggle("mfg-browse-open", open); toggle.setAttribute("aria-expanded", String(open)); };
      toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
      const escape = event => { if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") { setOpen(false); toggle.focus(); } };
      document.addEventListener("keydown", escape); header.append(toggle);
      const skip = document.createElement("a"); skip.className = "mfg-skip-link"; skip.href = "#content"; skip.textContent = "Skip to content"; header.prepend(skip);
      changes.push(() => { document.removeEventListener("keydown", escape); document.documentElement.classList.remove("mfg-browse-open"); toggle.remove(); skip.remove(); });
    }
    const top = document.createElement("button"); top.type = "button"; top.className = "mfg-back-top"; top.textContent = "↑ Top"; top.hidden = true;
    top.setAttribute("aria-label", "Back to top");
    top.addEventListener("click", () => window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
    const onScroll = () => { top.hidden = window.scrollY < 600; };
    window.addEventListener("scroll", onScroll, { passive: true }); document.getElementById("page").append(top); onScroll();
    changes.push(() => { window.removeEventListener("scroll", onScroll); top.remove(); });
    comments(content, changes);
  }

  function comments(content, changes) {
    if (!document.body.matches(".single, .page")) return;
    const feeds = [...document.querySelectorAll(".tolstoycomments-feed")];
    const native = [...content.querySelectorAll("#disqus_thread, .comments-area")].filter(node => !node.closest('[data-source-theme="tolstoycomments"]'));
    if (!content.querySelector(".tolstoycomments-feed") && !native.length) return;
    const targets = [...feeds, ...native].filter((node, i, nodes) => !nodes.some((other, j) => i !== j && other.contains(node)));
    if (!targets.length) return;
    const details = document.createElement("details"); details.className = "mfg-comments"; details.id = "mfg-comments";
    const summary = document.createElement("summary");
    const title = document.createElement("span"); title.className = "mfg-comments-label"; title.textContent = "Comments";
    const action = document.createElement("span"); action.className = "mfg-comments-action"; action.textContent = "Open comments";
    summary.append(title, action);
    const body = document.createElement("div"); body.className = "mfg-comments-body";
    details.append(summary, body); content.append(details);
    changes.push(() => details.remove());
    for (const node of targets) {
      const marker = document.createComment("mfg-comments-position"); node.before(marker); body.append(node);
      changes.push(() => marker.replaceWith(node));
    }
    const enableScrolling = () => {
      for (const iframe of details.querySelectorAll("iframe")) {
        if (iframe.getAttribute("scrolling") === "no") {
          iframe.setAttribute("scrolling", "auto");
        }
      }
    };
    details.addEventListener("toggle", () => {
      action.textContent = details.open ? "Close comments" : "Open comments";
      if (details.open) {
        enableScrolling();
        requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
      }
    });
    const observer = new MutationObserver(enableScrolling);
    observer.observe(body, { childList: true, subtree: true });
    changes.push(() => observer.disconnect());
    const reveal = () => {
      if (/^#(?:comments|comment-|respond|reply-title|disqus_thread|mfg-comments)/.test(location.hash)) {
        details.open = true; requestAnimationFrame(() => details.scrollIntoView({ block: "start" }));
      }
    };
    window.addEventListener("hashchange", reveal); reveal();
    changes.push(() => window.removeEventListener("hashchange", reveal));
  }

  function digest(content, changes) {
    const archive = document.body.matches(".archive.category-updates-digest");
    const articles = [...content.querySelectorAll("article.category-updates-digest")];
    const updates = location.pathname === "/updates-list/";
    if (!archive && !updates && !document.body.matches(".single")) return false;
    if (!articles.length && !updates) return false;
    const className = archive ? "mfg-digest-archive" : "mfg-digest-page";
    content.classList.add(className); changes.push(() => content.classList.remove(className));
    if (archive) {
      const heading = document.createElement("header"); heading.className = "mfg-digest-heading";
      const title = document.createElement("h1"); title.textContent = "Update digests";
      const count = document.createElement("p"); count.textContent = `${articles.length} digests on this page`;
      heading.append(title, count); content.prepend(heading); changes.push(() => heading.remove());
      const extras = [...content.children].filter(node => !node.matches("article, header, nav, style, script, .mfg-grid-passthrough, .mfg-comments") && getComputedStyle(node).display !== "none");
      if (extras.length) {
        const panel = document.createElement("details"); panel.className = "mfg-side-panel mfg-page-notices";
        const summary = document.createElement("summary"); summary.textContent = "Page notices";
        const body = document.createElement("div"); body.className = "mfg-side-content"; panel.append(summary, body);
        document.querySelector(".mfg-promo-sidebar").append(panel); changes.push(() => panel.remove());
        for (const node of extras) {
          const marker = document.createComment("mfg-page-notice-position"); node.before(marker); body.append(node);
          changes.push(() => marker.replaceWith(node));
        }
      }
      for (const article of articles) {
        const original = article.querySelector(":scope > .entry-content");
        const title = article.querySelector(".entry-title a");
        if (!original || !title) continue;
        article.classList.add("mfg-digest-card"); changes.push(() => article.classList.remove("mfg-digest-card"));
        const preview = document.createElement("div"); preview.className = "mfg-digest-preview";
        const games = [...original.querySelectorAll(".su-spoiler")].filter(node => !node.parentElement.closest(".su-spoiler"));
        const meta = document.createElement("p"); meta.className = "mfg-digest-count"; meta.textContent = `${games.length} games with updates`;
        const tags = document.createElement("div"); tags.className = "mfg-digest-games";
        for (const game of games.slice(0, 5)) {
          const source = [...game.querySelectorAll(".su-spoiler-content a[href]")].find(link => link.origin === location.origin);
          const name = game.querySelector(".su-spoiler-title")?.textContent.trim();
          if (!source || !name) continue;
          const link = document.createElement("a"); link.href = source.href; link.textContent = name; tags.append(link);
        }
        const open = document.createElement("a"); open.href = title.href; open.className = "mfg-open-digest"; open.textContent = "Read digest ↗";
        preview.append(meta, tags, open); article.append(preview); changes.push(() => preview.remove());
      }
    } else {
      const body = content.querySelector("article > .entry-content"); if (!body) return true;
      const spoilers = [...body.querySelectorAll(".su-spoiler")].filter(node => !node.parentElement.closest(".su-spoiler"));
      const controls = document.createElement("section"); controls.className = "mfg-update-filter"; controls.setAttribute("aria-label", "Find a game update");
      const label = document.createElement("label"); label.textContent = "Find a game";
      const field = document.createElement("input"); field.type = "search"; field.placeholder = "Filter games in these updates…"; label.append(field);
      const count = document.createElement("p"); count.setAttribute("role", "status"); controls.append(label, count); body.prepend(controls);
      changes.push(() => controls.remove());
      const names = spoilers.map(node => node.querySelector(".su-spoiler-title")?.textContent.trim() || "");
      const oldHidden = spoilers.map(node => node.getAttribute("hidden"));
      for (const [index, node] of spoilers.entries()) {
        const fresh = [...node.querySelectorAll('.su-spoiler-content [style*="red"]')].some(element => /\bnew\b/i.test(element.textContent));
        if (fresh) {
          const badge = document.createElement("span"); badge.className = "mfg-new-update"; badge.textContent = "New";
          node.querySelector(".su-spoiler-title")?.append(badge); changes.push(() => badge.remove());
        }
        changes.push(() => oldHidden[index] === null ? node.removeAttribute("hidden") : node.setAttribute("hidden", oldHidden[index]));
      }
      const headings = [...body.querySelectorAll(":scope > h3")];
      const hiddenHeadings = headings.map(node => node.getAttribute("hidden"));
      const filter = () => {
        const query = field.value.trim().toLocaleLowerCase(); let visible = 0;
        spoilers.forEach((node, index) => { node.hidden = !names[index].toLocaleLowerCase().includes(query); if (!node.hidden) visible++; });
        headings.forEach((node, index) => { if (query) node.hidden = true; else if (hiddenHeadings[index] === null) node.removeAttribute("hidden"); else node.setAttribute("hidden", hiddenHeadings[index]); });
        count.textContent = query ? `${visible} of ${spoilers.length} games` : `${spoilers.length} games · original update links`;
      };
      headings.forEach((node, index) => changes.push(() => hiddenHeadings[index] === null ? node.removeAttribute("hidden") : node.setAttribute("hidden", hiddenHeadings[index])));
      field.addEventListener("input", filter); filter();
    }
    return true;
  }
  globalThis.MFGExperience = { mount, digest };
})();
