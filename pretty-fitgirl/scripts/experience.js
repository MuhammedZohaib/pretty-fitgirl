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

  const MAX_UPCOMING_GAMES = 60;
  const UPCOMING_HEADING_RE = /upcoming\s+repacks/i;
  const ARROW_RE = /^[\s ]*[→↣⇢➔➜➤➡⮕➝➢]+\s*/;

  function findUpcomingArticle(root) {
    const titles = root.querySelectorAll('.entry-title, h1, h2, h3');
    for (const t of titles) {
      if (UPCOMING_HEADING_RE.test((t.textContent || '').trim())) {
        const art = t.closest('article');
        if (art) return art;
      }
    }
    for (const art of root.querySelectorAll('article')) {
      if (ARROW_RE.test((art.textContent || '').trim())) return art;
    }
    return null;
  }

  function gameSpans(article) {
    const root = article.querySelector('.entry-content') || article;
    const spans = [...root.querySelectorAll('span')];
    let games = spans.filter((s) => ARROW_RE.test(s.textContent || ''));
    if (!games.length) {
      games = spans.filter(
        (s) =>
          /color/i.test(s.getAttribute('style') || '') &&
          (s.textContent || '').trim().length > 1
      );
    }
    return games.slice(0, MAX_UPCOMING_GAMES);
  }

  function youtubeUrl(query) {
    return (
      'https://www.youtube.com/results?search_query=' +
      encodeURIComponent(query) +
      '&sp=CAMSAhAB'
    );
  }

  function decorateUpcomingCard(span, display, image) {
    if (span.dataset.fgyt) return null;
    span.dataset.fgyt = '1';

    const query = MFGRepack.searchName(display);
    const ytUrl = youtubeUrl(query + ' game');

    const versionMatch = display.match(/\b(v[0-9.]+|Build\s+[0-9]+)\b/i);
    const version = versionMatch ? versionMatch[0] : null;
    const isDelayed = /delayed/i.test(display);

    const card = document.createElement('article');
    card.className = 'mfg-upcoming-card-item';

    // Vertical Poster Frame (aspect ratio 2/3)
    const posterLink = document.createElement('a');
    posterLink.className = 'mfg-upcoming-poster-link';
    posterLink.href = ytUrl;
    posterLink.target = '_blank';
    posterLink.rel = 'noopener noreferrer';
    posterLink.setAttribute('aria-label', `Watch gameplay for ${query} on YouTube`);

    const posterBox = document.createElement('div');
    posterBox.className = 'mfg-upcoming-poster-box';
    posterBox.append(MFGRepack.placeholder());
    MFGRepack.showSpinner(posterBox);

    const posterSrc = image && (image.poster || image.header || image.tiny);
    if (posterSrc) {
      const img = document.createElement('img');
      img.className = 'mfg-upcoming-poster-img';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.alt = query;
      img.src = posterSrc;
      const onPosterLoad = () => {
        MFGRepack.hideSpinner(posterBox);
        MFGRepack.setSourceBadge(posterBox, image.source || 'steam');
      };
      if (img.complete && img.naturalWidth > 0) {
        onPosterLoad();
      } else {
        img.addEventListener('load', onPosterLoad, { once: true });
      }
      img.addEventListener('error', () => {
        if (image.header && img.src !== image.header) {
          img.src = image.header;
        } else if (image.tiny && img.src !== image.tiny) {
          img.src = image.tiny;
        } else {
          img.remove();
          MFGRepack.hideSpinner(posterBox);
        }
      }, { once: true });
      posterBox.prepend(img);
    }

    const playBadge = document.createElement('div');
    playBadge.className = 'mfg-upcoming-play-badge';
    playBadge.setAttribute('aria-hidden', 'true');
    const playIcon = document.createElement('span');
    playIcon.className = 'mfg-play-icon';
    playIcon.textContent = '▶';
    const playText = document.createElement('span');
    playText.className = 'mfg-play-label';
    playText.textContent = 'Gameplay';
    playBadge.append(playIcon, playText);
    posterBox.append(playBadge);
    posterLink.append(posterBox);

    // Card Details & Info
    const info = document.createElement('div');
    info.className = 'mfg-upcoming-info';

    const titleEl = document.createElement('h3');
    titleEl.className = 'mfg-upcoming-title';
    titleEl.title = display;
    titleEl.append(span);
    info.append(titleEl);

    const badges = document.createElement('div');
    badges.className = 'mfg-upcoming-badges';

    const upcomingBadge = document.createElement('span');
    upcomingBadge.className = 'mfg-badge mfg-badge-upcoming';
    upcomingBadge.textContent = 'Upcoming';
    badges.append(upcomingBadge);

    if (version) {
      const verBadge = document.createElement('span');
      verBadge.className = 'mfg-badge mfg-badge-version';
      verBadge.textContent = version;
      badges.append(verBadge);
    }

    if (isDelayed) {
      const delayBadge = document.createElement('span');
      delayBadge.className = 'mfg-badge mfg-badge-delayed';
      delayBadge.textContent = 'Delayed';
      badges.append(delayBadge);
    }
    info.append(badges);

    const actionBtn = document.createElement('a');
    actionBtn.className = 'mfg-upcoming-action-btn';
    actionBtn.href = ytUrl;
    actionBtn.target = '_blank';
    actionBtn.rel = 'noopener noreferrer';
    const btnText = document.createElement('span');
    btnText.textContent = 'Watch gameplay';
    const btnArrow = document.createElement('span');
    btnArrow.className = 'mfg-arrow';
    btnArrow.setAttribute('aria-hidden', 'true');
    btnArrow.textContent = '↗';
    actionBtn.append(btnText, btnArrow);
    info.append(actionBtn);

    card.append(posterLink, info);
    return card;
  }

  function upcoming(content, changes) {
    const article = findUpcomingArticle(content);
    if (!article) return false;
    const spans = gameSpans(article);
    if (!spans.length) return false;

    const origArtClass = article.getAttribute('class');
    article.classList.add('mfg-upcoming-card');
    changes.push(() => origArtClass === null ? article.removeAttribute('class') : article.setAttribute('class', origArtClass));

    const container = spans[0].parentElement;
    if (container) {
      const origContClass = container.getAttribute('class');
      container.classList.add('mfg-upcoming-container');
      changes.push(() => origContClass === null ? container.removeAttribute('class') : container.setAttribute('class', origContClass));
    }

    const grid = document.createElement('div');
    grid.className = 'mfg-upcoming-grid';

    const firstSpan = spans[0];
    firstSpan.parentNode.insertBefore(grid, firstSpan);
    changes.push(() => grid.remove());

    const brList = [];
    for (const span of spans) {
      let n = span.nextSibling;
      while (n && n.nodeType === Node.TEXT_NODE && !n.textContent.trim()) n = n.nextSibling;
      if (n && n.nodeName === 'BR') {
        brList.push({ span, br: n });
        n.hidden = true;
      } else {
        brList.push({ span, br: null });
      }
    }

    const items = spans.map((span) => {
      const display = MFGRepack.gameName(span.textContent);
      return { span, display, query: MFGRepack.searchName(display) };
    });
    const queries = [...new Set(items.map((i) => i.query).filter(Boolean))];

    const cards = [];
    for (const it of items) {
      const card = decorateUpcomingCard(it.span, it.display, null);
      if (card) {
        grid.append(card);
        cards.push({ item: it, card });
      }
    }

    changes.push(() => {
      for (const { span, br } of brList) {
        if (br) {
          br.before(span);
          br.removeAttribute('hidden');
        } else {
          grid.before(span);
        }
        delete span.dataset.fgyt;
      }
    });

    MFGRepack.resolveImages(queries).then((images) => {
      if (!document.documentElement.classList.contains('mfg-on')) return;
      for (const { item, card } of cards) {
        const posterBox = card.querySelector('.mfg-upcoming-poster-box');
        if (!posterBox) continue;

        const imgInfo = images ? images[item.query] : null;
        const posterSrc = imgInfo && (imgInfo.poster || imgInfo.header || imgInfo.tiny);
        if (!posterSrc) {
          MFGRepack.hideSpinner(posterBox);
          continue;
        }

        let img = posterBox.querySelector('img.mfg-upcoming-poster-img');
        const onPosterLoad = () => {
          MFGRepack.hideSpinner(posterBox);
          MFGRepack.setSourceBadge(posterBox, imgInfo.source || 'steam');
        };

        if (!img) {
          img = document.createElement('img');
          img.className = 'mfg-upcoming-poster-img';
          img.decoding = 'async';
          img.alt = item.query;
          img.addEventListener('load', onPosterLoad, { once: true });
          img.addEventListener('error', () => {
            if (imgInfo.header && img.src !== imgInfo.header) {
              img.src = imgInfo.header;
            } else if (imgInfo.tiny && img.src !== imgInfo.tiny) {
              img.src = imgInfo.tiny;
            } else {
              img.remove();
              MFGRepack.hideSpinner(posterBox);
            }
          }, { once: true });
          img.src = posterSrc;
          if (img.complete && img.naturalWidth > 0) {
            onPosterLoad();
          }
          posterBox.prepend(img);
        } else {
          img.src = posterSrc;
        }
      }
    }).catch(() => {
      cards.forEach(({ card }) => MFGRepack.hideSpinner(card.querySelector('.mfg-upcoming-poster-box')));
    });

    return true;
  }

  globalThis.MFGExperience = { mount, digest, upcoming };
})();
