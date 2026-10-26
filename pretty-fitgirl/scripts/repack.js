/* Presentation from the current article only. No metadata requests or inferred sizes. */
(() => {
  "use strict";
  const fields = {
    "genres/tags": ["genres", "Genres"], genres: ["genres", "Genres"], tags: ["genres", "Genres"],
    company: ["company", "Company"], companies: ["company", "Companies"],
    language: ["languages", "Languages"], languages: ["languages", "Languages"],
    "original size": ["original", "Original size"], "repack size": ["repack", "Repack size"]
  };

  function metadata(body) {
    const paragraph = [...body.querySelectorAll(":scope > p")].find(node => /Repack Size\s*:/i.test(node.textContent) && /Original Size\s*:|Languages?\s*:/i.test(node.textContent));
    const result = { paragraph, rows: [], values: {} };
    if (!paragraph) return result;
    const lines = [[]];
    for (const node of paragraph.childNodes) {
      if (node.nodeName === "BR") lines.push([]);
      else lines[lines.length - 1].push(node);
    }
    for (const nodes of lines) {
      const raw = nodes.map(node => node.textContent).join("");
      const text = raw.replace(/\s+/g, " ").trim();
      if (!text) continue;
      const match = raw.match(/^\s*([^:]+?)\s*:\s*/);
      const field = match && fields[match[1].trim().toLowerCase()];
      const row = { nodes, text, key: field?.[0], label: field?.[1], prefix: field ? match[0].length : 0 };
      if (field) {
        row.value = raw.slice(row.prefix).replace(/\s+/g, " ").trim();
        if (row.value) result.values[row.key] = row.value;
      }
      result.rows.push(row);
    }

    const featureList = [...body.querySelectorAll("ul")].find(ul => /based on|lossless|installed/i.test(ul.textContent));
    if (featureList) {
      const fText = featureList.textContent;
      const diskMatch = fText.match(/(?:HDD space after installation|Disk space needed|HDD space)\s*:\s*([^.\n;]+)/i);
      if (diskMatch) result.values.disk = diskMatch[1].trim();
      const ramMatch = fText.match(/(?:At least\s*)?([0-9]+\s*GB)[^.\n;]*RAM/i);
      if (ramMatch) result.values.ram = ramMatch[1].trim();
      const timeMatch = fText.match(/Installation takes[^:]*:\s*([^.\n;]+)/i);
      if (timeMatch) result.values.installTime = timeMatch[1].trim().replace(/\s*\([^)]*\)/g, "");
    }

    return result;
  }

  function placeholder() {
    const fallback = document.createElement("span");
    fallback.className = "mfg-cover-placeholder";
    fallback.setAttribute("aria-hidden", "true");
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 64 48");
    const path = document.createElementNS(icon.namespaceURI, "path");
    path.setAttribute("d", "M23 12h18c8 0 12 6 14 14l3 12c1 5-5 8-8 4L39 32H25L14 42c-3 4-9 1-8-4l3-12c2-8 6-14 14-14ZM19 19v12m-6-6h12m17-3h.1m6 6h.1M27 12l3-6h10");
    icon.append(path);
    const text = document.createElement("span");
    text.textContent = "Cover unavailable";
    fallback.append(icon, text);
    return fallback;
  }

  const ARROW_RE = /^[\s ]*[→↣⇢➔➜➤➡⮕➝➢]+\s*/;

  function decodeEntities(str) {
    return (str || '')
      .replace(/&#8211;/g, '–')
      .replace(/&#8217;/g, '’')
      .replace(/&#8220;/g, '“')
      .replace(/&#8221;/g, '”')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }

  function gameName(raw) {
    return decodeEntities(raw).replace(/\s+/g, ' ').trim().replace(ARROW_RE, '').trim();
  }

  function searchName(name) {
    let t = decodeEntities(name).replace(ARROW_RE, '').trim();
    t = t.replace(/#\d+\s*(?:Updated)?/gi, ' ');
    t = t.replace(/\[[^\]]*\]/g, ' '); // [HV], [Selective Download]
    t = t.replace(/\([^)]*(?:denuvo|dlc|repack|crack|build|v\d)[^)]*\)/gi, ' ');
    t = t.replace(/[–—-]\s*Delayed.*$/i, ' '); // "- Delayed, bad crack"
    t = t.replace(/[–—-]\s*v\d.*$/i, ' '); // "- v1.5.0"
    t = t.replace(/,\s*v\d.*$/i, ' '); // ", v1.5.0"
    t = t.replace(/\s+v\d[\w.]*.*$/i, ' ');
    t = t.replace(/\b(?:build|b)\s*\d+.*$/i, ' '); // "Build 12345"
    t = t.replace(/\+\s*(?:all|\d+)?\s*dlcs?.*$/i, ' '); // "+ All DLCs"
    t = t.replace(/\+\s*bonus.*$/i, ' '); // "+ Bonus OST"
    t = t.replace(/[™®©]/g, '');
    return t.replace(/\s+/g, ' ').trim();
  }

  function headerToPoster(headerUrl) {
    const appId = headerUrl?.match(/\/apps\/(\d+)\//)?.[1];
    if (!appId) return null;
    return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`;
  }

  function resolveImages(queries) {
    return new Promise((resolve) => {
      try {
        if (!chrome?.runtime?.sendMessage) return resolve({});
        let settled = false;
        const timeout = setTimeout(() => {
          if (!settled) {
            settled = true;
            resolve({});
          }
        }, 1200);
        chrome.runtime.sendMessage({ type: 'resolveGames', titles: queries }, (resp) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          if (chrome?.runtime?.lastError || !resp) resolve({});
          else resolve(resp);
        });
      } catch {
        resolve({});
      }
    });
  }

  let pendingBatch = [];
  let batchPromise = null;

  function resolveOneGame(query) {
    return new Promise((resolve) => {
      pendingBatch.push({ query, resolve });
      if (!batchPromise) {
        batchPromise = Promise.resolve().then(() => {
          const batch = pendingBatch;
          pendingBatch = [];
          batchPromise = null;
          const uniqueQueries = [...new Set(batch.map((b) => b.query).filter(Boolean))];
          if (!uniqueQueries.length) {
            for (const item of batch) item.resolve(null);
            return;
          }
          return resolveImages(uniqueQueries).then((results) => {
            for (const item of batch) {
              item.resolve(results ? results[item.query] : null);
            }
          }).catch(() => {
            for (const item of batch) item.resolve(null);
          });
        });
      }
    });
  }

  function showSpinner(box) {
    if (!box || box.querySelector(".mfg-cover-spinner")) return;
    const spinner = document.createElement("div");
    spinner.className = "mfg-cover-spinner";
    spinner.setAttribute("aria-hidden", "true");
    const ring = document.createElement("div");
    ring.className = "mfg-spinner-ring";
    spinner.append(ring);
    box.append(spinner);
  }

  function hideSpinner(box) {
    if (!box) return;
    box.querySelectorAll(".mfg-cover-spinner").forEach((s) => s.remove());
  }

  function setSourceBadge(box, source) {
    if (!box || !source) return;
    box.querySelector(".mfg-cover-badge")?.remove();
    const badge = document.createElement("span");
    const s = String(source).toLowerCase();
    badge.className = `mfg-cover-badge mfg-cover-source-${s}`;
    badge.textContent = s === "original" ? "Original" : (s === "gog" ? "GOG" : "Steam");
    badge.title = s === "original" ? "Original cover art" : `Cover from ${badge.textContent}`;
    box.append(badge);
  }

  function loadSteamCover(box, title) {
    const rawTitle = title || '';
    const query = searchName(rawTitle);
    if (!query) {
      hideSpinner(box);
      return;
    }

    showSpinner(box);

    resolveOneGame(query).then((image) => {
      if (!image) {
        hideSpinner(box);
        return;
      }
      const candidates = [
        image.poster,
        image.posterAlt,
        image.gogPoster,
        image.header,
        image.headerAlt,
        image.banner,
        image.tiny
      ].filter(Boolean);

      if (!candidates.length) {
        hideSpinner(box);
        return;
      }
      if (!box.isConnected) return;
      if (box.querySelector("img:not(.mfg-steam-fallback)")) {
        hideSpinner(box);
        return;
      }

      let steamImg = box.querySelector("img.mfg-steam-fallback");
      if (!steamImg) {
        steamImg = document.createElement("img");
        steamImg.className = "mfg-steam-fallback";
        steamImg.alt = query;
        steamImg.loading = "lazy";
        steamImg.decoding = "async";

        let candidateIdx = 0;
        const tryNext = () => {
          if (candidateIdx < candidates.length) {
            steamImg.src = candidates[candidateIdx++];
          } else {
            steamImg.remove();
            hideSpinner(box);
          }
        };

        const onFallbackLoad = () => {
          hideSpinner(box);
          setSourceBadge(box, image.source || "steam");
        };

        steamImg.addEventListener("load", onFallbackLoad, { once: true });
        steamImg.addEventListener("error", tryNext);
        tryNext();

        box.append(steamImg);
      }
    }).catch(() => {
      hideSpinner(box);
    });
  }

  function cover(image, url, title, className = "mfg-cover", allowSteamFallback = true) {
    const box = document.createElement(url ? "a" : "div");
    box.className = className;
    if (url) { box.href = url; box.setAttribute("aria-label", title); }
    box.append(placeholder());

    const originalSrc = image?.getAttribute("src");
    const hasOriginal = Boolean(originalSrc);
    const directPoster = headerToPoster(originalSrc);

    if (hasOriginal) {
      showSpinner(box);
      const preview = document.createElement("img");
      for (const attribute of ["src", "srcset", "sizes"]) {
        if (image.hasAttribute(attribute)) preview.setAttribute(attribute, image.getAttribute(attribute));
      }
      preview.alt = "";
      preview.loading = "lazy";
      preview.decoding = "async";

      if (directPoster) {
        preview.src = directPoster;
      }

      const onOrigLoad = () => {
        hideSpinner(box);
        setSourceBadge(box, directPoster ? "steam" : "original");
      };

      if (preview.complete && preview.naturalWidth > 0) {
        onOrigLoad();
      } else {
        preview.addEventListener("load", onOrigLoad, { once: true });
      }

      preview.addEventListener("error", () => {
        preview.remove();
        if (allowSteamFallback) {
          loadSteamCover(box, title);
        } else {
          hideSpinner(box);
        }
      }, { once: true });
      box.append(preview);
    } else if (allowSteamFallback) {
      loadSteamCover(box, title);
    }
    return box;
  }

  function summary(article, data, url) {
    const section = document.createElement("div");
    section.className = "mfg-card-information";
    const facts = document.createElement("dl");
    facts.className = "mfg-card-facts";
    for (const [key, label] of [["repack", "Repack size"], ["original", "Original size"]]) {
      const item = document.createElement("div");
      const term = document.createElement("dt"); term.textContent = label;
      const value = document.createElement("dd"); value.textContent = (data.values[key] || "Not listed").replace(/\s*\[[^\]]*\]/g, "").trim(); value.title = data.values[key] || "Not listed";
      item.append(term, value); facts.append(item);
    }
    section.append(facts);
    {
      const languages = document.createElement("p"); languages.className = "mfg-card-languages";
      const label = document.createElement("span"); label.textContent = "Languages";
      const value = document.createElement("span"); value.textContent = data.values.languages || "Not listed";
      languages.append(label, value); section.append(languages);
    }
    const tags = document.createElement("div");
    tags.className = "mfg-card-tags";
    const originals = [...article.querySelectorAll("footer.entry-meta .tag-links a")];
    for (const tag of originals.slice(0, 3)) { const preview = tag.cloneNode(true); preview.title = tag.textContent.trim(); tags.append(preview); }
    if (originals.length > 3) {
      const more = document.createElement("a"); more.href = url; more.textContent = `+${originals.length - 3}`;
      more.setAttribute("aria-label", `View ${originals.length - 3} more tags on the repack page`); tags.append(more);
    }
    section.append(tags);
    const link = document.createElement("a");
    link.className = "mfg-repack-link"; link.href = url; link.textContent = "View repack";
    const arrow = document.createElement("span"); arrow.textContent = "↗"; arrow.setAttribute("aria-hidden", "true");
    link.append(arrow); section.append(link);
    return section;
  }

  function richValue(row) {
    const fragment = document.createDocumentFragment();
    for (const node of row.nodes) fragment.append(node.cloneNode(true));
    let remaining = row.prefix;
    const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT);
    let text;
    while (remaining && (text = walker.nextNode())) {
      const count = Math.min(remaining, text.textContent.length);
      text.textContent = text.textContent.slice(count);
      remaining -= count;
    }
    if (row.key === "genres") {
      for (const node of [...fragment.childNodes]) {
        if (node.nodeType === Node.TEXT_NODE && /^[,\s]*$/.test(node.textContent)) node.remove();
      }
    }
    return fragment;
  }

  function enhanceDetail(article, changes) {
    const body = article.querySelector(":scope > .entry-content");
    const header = article.querySelector(":scope > .entry-header");
    if (!body || !header) return;
    article.classList.add("mfg-game-detail");
    changes.push(() => article.classList.remove("mfg-game-detail"));
    const data = metadata(body);
    const originalImage = body.querySelector("img.alignleft");
    const initialTitle = header.querySelector(".entry-title");
    const gameTitle = initialTitle ? initialTitle.textContent.trim() : "";
    const art = cover(originalImage, null, gameTitle, "mfg-detail-art");
    header.classList.add("mfg-detail-hero");

    const heroMain = document.createElement("div");
    heroMain.className = "mfg-hero-main";
    const heroContent = document.createElement("div");
    heroContent.className = "mfg-hero-content";

    // Original nodes inside header (meta, title, meta)
    const originalHeaderNodes = [...header.childNodes];
    heroContent.append(...originalHeaderNodes);
    heroMain.append(art, heroContent);
    header.prepend(heroMain);

    changes.push(() => {
      art.remove();
      while (heroContent.firstChild) heroMain.before(heroContent.firstChild);
      heroMain.remove();
      header.classList.remove("mfg-detail-hero");
    });

    // Hero Badges
    const titleNode = heroContent.querySelector(".entry-title");
    const titleText = titleNode ? titleNode.textContent.trim() : "";
    const firstH3 = body.querySelector("h3:first-child");
    const firstH3Text = firstH3 ? firstH3.textContent.trim() : "";
    const fullHeading = titleText + " " + firstH3Text;

    const badges = document.createElement("div");
    badges.className = "mfg-detail-badges";

    const repackMatch = fullHeading.match(/#\d+(?:\s+Updated)?/i);
    if (repackMatch) {
      const b = document.createElement("span");
      b.className = "mfg-badge mfg-badge-repack";
      b.textContent = repackMatch[0].trim();
      badges.append(b);
    }

    const versionMatch = titleText.match(/\b(v[0-9.]+|Build\s+[0-9]+)\b/i) || firstH3Text.match(/\b(v[0-9.]+|Build\s+[0-9]+)\b/i);
    if (versionMatch) {
      const b = document.createElement("span");
      b.className = "mfg-badge mfg-badge-version";
      b.textContent = versionMatch[0];
      badges.append(b);
    }

    for (const feat of ["All DLCs", "Bonus Content", "REDmod", "Selective Download"]) {
      if (new RegExp("\\b" + feat + "\\b", "i").test(fullHeading)) {
        const b = document.createElement("span");
        b.className = "mfg-badge";
        b.textContent = feat;
        badges.append(b);
      }
    }

    if (badges.children.length > 0) {
      heroContent.append(badges);
      changes.push(() => badges.remove());
    }

    // Hero Alert Banner
    const warningRow = data.rows.find(r => !r.key && (/REQUIRES|Win10|Win11|Windows|WARNING|NOTE/i.test(r.text) || r.nodes.some(n => n.nodeType === 1 && (/color:\s*red/i.test(n.getAttribute("style") || "")))));
    if (warningRow) {
      const alert = document.createElement("div");
      alert.className = "mfg-detail-alert";
      alert.setAttribute("role", "note");
      const icon = document.createElement("span");
      icon.className = "mfg-alert-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "⚠";
      const text = document.createElement("div");
      text.className = "mfg-alert-text";
      text.append(richValue(warningRow));
      alert.append(icon, text);
      heroContent.append(alert);
      changes.push(() => alert.remove());
    }

    // Structured Overview (mfg-game-info) placed on right side of header
    if (data.paragraph) {
      const panel = document.createElement("section"); panel.className = "mfg-game-info";
      const heading = document.createElement("h2"); heading.textContent = "Repack information";
      const facts = document.createElement("dl"); facts.className = "mfg-info-grid";
      let insertedExtra = false;
      for (const row of data.rows) {
        if (row.key && row.value) {
          const item = document.createElement("div"); item.className = "mfg-info-item"; item.dataset.field = row.key;
          const label = document.createElement("dt"); label.textContent = row.label;
          const value = document.createElement("dd"); value.append(richValue(row));
          item.append(label, value); facts.append(item);

          if ((row.key === "repack" || row.key === "original") && !insertedExtra) {
            insertedExtra = true;
            if (data.values.disk) {
              const dItem = document.createElement("div"); dItem.className = "mfg-info-item"; dItem.dataset.field = "disk";
              const dLabel = document.createElement("dt"); dLabel.textContent = "Disk space needed";
              const dVal = document.createElement("dd"); dVal.textContent = data.values.disk;
              dItem.append(dLabel, dVal); facts.append(dItem);
            }
            if (data.values.ram) {
              const rItem = document.createElement("div"); rItem.className = "mfg-info-item"; rItem.dataset.field = "ram";
              const rLabel = document.createElement("dt"); rLabel.textContent = "Free RAM to install";
              const rVal = document.createElement("dd"); rVal.textContent = data.values.ram;
              rItem.append(rLabel, rVal); facts.append(rItem);
            }
            if (data.values.installTime) {
              const tItem = document.createElement("div"); tItem.className = "mfg-info-item"; tItem.dataset.field = "installTime";
              const tLabel = document.createElement("dt"); tLabel.textContent = "Install time";
              const tVal = document.createElement("dd"); tVal.textContent = data.values.installTime;
              tItem.append(tLabel, tVal); facts.append(tItem);
            }
          }
        } else {
          const note = document.createElement("div"); note.className = "mfg-info-note";
          const term = document.createElement("dt"); term.className = "screen-reader-text"; term.textContent = "Repack note";
          const value = document.createElement("dd"); value.append(richValue(row)); note.append(term, value); facts.append(note);
        }
      }
      panel.append(heading, facts);
      const artworkLink = originalImage?.closest("a[href]");
      if (artworkLink) {
        const source = document.createElement("a"); source.href = artworkLink.href; source.textContent = "Original artwork ↗";
        source.className = "mfg-artwork-source"; source.target = artworkLink.target; source.rel = "noopener"; panel.append(source);
      }
      header.append(panel);
      const originalClass = data.paragraph.getAttribute("class");
      data.paragraph.classList.add("mfg-metadata-source");
      changes.push(() => { panel.remove(); originalClass === null ? data.paragraph.removeAttribute("class") : data.paragraph.setAttribute("class", originalClass); });
    }

    // Section Partitioning into Inspired Tabs
    const children = [...body.children];
    let directH3 = null;
    let torrentH3 = null;
    let screenshotsH3 = null;
    let featuresH3 = null;
    let discussionNode = null;

    for (const el of children) {
      if (/^H[1-6]$/.test(el.tagName)) {
        const txt = el.textContent.toLowerCase();
        if (/download mirrors.*direct/i.test(txt)) directH3 = el;
        else if (/download mirrors.*torrent/i.test(txt)) torrentH3 = el;
        else if (/screenshots/i.test(txt)) screenshotsH3 = el;
        else if (/repack features/i.test(txt)) featuresH3 = el;
      } else if (el.tagName === "P" && /cs\.rin\.ru|discussion/i.test(el.textContent)) {
        discussionNode = el;
      }
    }

    const dlNodes = [];
    const scNodes = [];
    const ftNodes = [];
    const upNodes = [];

    let currentSection = null;
    for (const el of children) {
      if (el.classList.contains("mfg-game-info") || el.classList.contains("mfg-metadata-source") || el === firstH3 || el === data.paragraph) {
        continue;
      }
      if (el.matches("table:has(.donatebutton), .post-navigation, .mfg-comments, .comments-area")) {
        currentSection = null;
        continue;
      }

      if (el === directH3 || el === torrentH3) {
        currentSection = "dl";
      } else if (el === screenshotsH3) {
        currentSection = "sc";
      } else if (el === featuresH3) {
        currentSection = "ft";
      } else if (el === discussionNode) {
        upNodes.push(el);
        continue;
      }

      if (currentSection === "dl") {
        dlNodes.push(el);
      } else if (currentSection === "sc") {
        scNodes.push(el);
      } else if (currentSection === "ft") {
        ftNodes.push(el);
      }
    }

    const moved = [];
    function moveInto(target, child) {
      moved.push({ node: child, parent: child.parentNode, next: child.nextSibling });
      target.append(child);
    }

    // Setup Unified Lightbox for Screenshots and Comments
    const lightbox = document.createElement("div");
    lightbox.className = "mfg-lightbox";
    lightbox.setAttribute("role", "dialog");
    lightbox.setAttribute("aria-modal", "true");
    lightbox.setAttribute("aria-label", "Image preview");

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "mfg-lightbox-close";
    closeBtn.setAttribute("aria-label", "Close image preview");
    closeBtn.textContent = "✕";

    const lbImg = document.createElement("img");
    lbImg.className = "mfg-lightbox-img";
    lbImg.alt = "Preview";
    lbImg.referrerPolicy = "no-referrer"; // Bypasses Cloudflare hotlink 403 blocks

    const actions = document.createElement("div");
    actions.className = "mfg-lightbox-actions";
    const extLink = document.createElement("a");
    extLink.className = "mfg-lightbox-link";
    extLink.target = "_blank";
    extLink.rel = "noopener noreferrer";
    extLink.textContent = "Open original ↗";
    actions.append(extLink);

    lightbox.append(closeBtn, lbImg, actions);
    document.body.append(lightbox);
    changes.push(() => lightbox.remove());

    let currentThumb = "";
    const openLb = (fullSrc, thumbSrc = "") => {
      currentThumb = thumbSrc;
      extLink.href = fullSrc;
      lbImg.src = fullSrc;
      lightbox.classList.add("mfg-lightbox-open");
    };

    lbImg.onerror = () => {
      // If full image fails (404 / CDN error), gracefully fall back to thumbnail
      if (currentThumb && lbImg.src !== currentThumb) {
        lbImg.src = currentThumb;
        extLink.href = currentThumb;
      }
    };

    const closeLb = () => {
      lightbox.classList.remove("mfg-lightbox-open");
      lbImg.src = "";
      currentThumb = "";
    };

    closeBtn.addEventListener("click", closeLb);
    lightbox.addEventListener("click", e => { if (e.target === lightbox) closeLb(); });
    const onEsc = e => { if (e.key === "Escape" && lightbox.classList.contains("mfg-lightbox-open")) closeLb(); };
    document.addEventListener("keydown", onEsc);
    changes.push(() => document.removeEventListener("keydown", onEsc));

    // Listen for image popup requests from comments iframe
    const onCommentsImage = e => {
      if (e.data?.type === "mfg-open-lightbox" && typeof e.data.src === "string") {
        openLb(e.data.src, e.data.thumb || "");
      }
    };
    window.addEventListener("message", onCommentsImage);
    changes.push(() => window.removeEventListener("message", onCommentsImage));

    const resolveScreenshotUrl = (img, a) => {
      const src = img.currentSrc || img.getAttribute("src") || img.src || "";
      const href = a?.getAttribute("href") || a?.href || "";
      // RiotPixels: thumbnail is http://s01.riotpixels.net/data/.../uuid.jpg.240p.jpg
      // High-res is https://s01.riotpixels.net/data/.../uuid.jpg (strip .240p.jpg, NOT append .jpg)
      if (/riotpixels\.net/i.test(src)) {
        return src.replace(/\.240p\.jpg$/i, "").replace(/^http:\/\//i, "https://");
      }
      if (/\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(href)) {
        return href.replace(/^http:\/\//i, "https://");
      }
      return src.replace(/^http:\/\//i, "https://");
    };

    // Global click listener across article to intercept screenshot clicks and prevent Cloudflare redirect
    const handleScreenshotClick = e => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = e.target.closest("a:has(img)");
      if (!a) return;
      const img = a.querySelector("img");
      if (!img) return;
      if (a.closest(".mfg-direct-sources, .mfg-torrent-sources, table:has(.donatebutton)")) return;

      const isScreenshot = a.closest("#mfg-panel-sc") ||
        /riotpixels|imageban|fastpic|imgbox|screenshots/i.test(a.href + " " + (img.currentSrc || img.src)) ||
        /\.(png|jpe?g|webp)(\?.*)?$/i.test(a.href);

      if (isScreenshot) {
        e.preventDefault();
        e.stopPropagation();
        const full = resolveScreenshotUrl(img, a);
        openLb(full, img.currentSrc || img.src);
      }
    };
    article.addEventListener("click", handleScreenshotClick);
    changes.push(() => article.removeEventListener("click", handleScreenshotClick));

    const tabsNav = document.createElement("nav");
    tabsNav.className = "mfg-tabs";
    tabsNav.setAttribute("role", "tablist");
    tabsNav.setAttribute("aria-label", "Game detail sections");

    const tabPanels = [];

    // 1. Download Tab
    if (dlNodes.length > 0) {
      const panelDl = document.createElement("section");
      panelDl.className = "mfg-tab-panel";
      panelDl.id = "mfg-panel-dl";
      panelDl.setAttribute("role", "tabpanel");
      panelDl.setAttribute("aria-labelledby", "mfg-tab-dl");

      const fullText = (data.values.repack || "") + " " + body.textContent;
      const isSelective = /selective download/i.test(fullText) || /from [\d.]+\s*GB/i.test(data.values.repack || "");

      if (isSelective) {
        const picker = document.createElement("div");
        picker.className = "mfg-picker";

        const pickerHead = document.createElement("div");
        pickerHead.className = "mfg-picker-header";
        const pTitle = document.createElement("h3");
        pTitle.className = "mfg-section-title";
        pTitle.textContent = "Choose what to download";
        const pLead = document.createElement("p");
        pLead.className = "mfg-section-lead";
        pLead.textContent = "Skip voice packs and bonus content you don’t need. Total size updates dynamically.";
        pickerHead.append(pTitle, pLead);
        picker.append(pickerHead);

        const optionsWrap = document.createElement("div");
        optionsWrap.className = "mfg-picker-options";

        const baseMatch = (data.values.repack || "").match(/from\s*([\d.]+)\s*GB/i);
        const baseSize = baseMatch ? parseFloat(baseMatch[1]) : 49.5;
        const fullMatch = fullText.match(/to\s*(?:[\d.]+\s*~)?\s*([\d.]+)\s*GB/i);
        const fullSize = fullMatch ? parseFloat(fullMatch[1]) : 112.2;

        const voiceMatch = fullText.match(/localizations\s*\(([\d.]+)\s*GB\)/i);
        const voiceSize = voiceMatch ? parseFloat(voiceMatch[1]) : 58.0;

        const bonusMatch = fullText.match(/bonus content\s*\(([\d.]+)\s*GB\)/i);
        const bonusSize = bonusMatch ? parseFloat(bonusMatch[1]) : 3.7;

        const opts = [
          { name: "Core game & required files", desc: "Required. Includes main game files and core expansions.", sz: baseSize, checked: true, disabled: true },
          { name: "Voice-over language packs", desc: "Additional spoken dialogue languages. Text subtitles remain available.", sz: voiceSize, checked: false, disabled: false },
          { name: "Bonus content", desc: "Soundtrack, digital artbook, and extras.", sz: bonusSize, checked: true, disabled: false },
          { name: "Credits video", desc: "Needed for a 100% identical MD5 integrity check.", sz: 1.0, checked: false, disabled: false }
        ];

        const checkboxes = [];
        for (const opt of opts) {
          const lbl = document.createElement("label");
          lbl.className = "mfg-picker-opt";
          const inp = document.createElement("input");
          inp.type = "checkbox";
          inp.checked = opt.checked;
          inp.disabled = opt.disabled;
          inp.dataset.gb = String(opt.sz);
          checkboxes.push(inp);

          const info = document.createElement("div");
          info.className = "mfg-picker-info";
          const b = document.createElement("span");
          b.className = "mfg-picker-name";
          b.textContent = opt.name;
          const em = document.createElement("span");
          em.className = "mfg-picker-desc";
          em.textContent = opt.desc;
          info.append(b, em);

          const sz = document.createElement("span");
          sz.className = "mfg-picker-sz";
          sz.textContent = opt.sz.toFixed(1) + " GB";

          lbl.append(inp, info, sz);
          optionsWrap.append(lbl);
        }
        picker.append(optionsWrap);

        const totalBar = document.createElement("div");
        totalBar.className = "mfg-picker-total";
        totalBar.setAttribute("role", "status");
        totalBar.setAttribute("aria-live", "polite");

        const details = document.createElement("div");
        details.className = "mfg-total-details";
        const strong = document.createElement("strong");
        strong.className = "mfg-total-number";
        strong.textContent = baseSize.toFixed(1) + " GB";
        const caption = document.createElement("span");
        caption.className = "mfg-total-caption";
        caption.textContent = `Your selection · full set is ~${fullSize.toFixed(1)} GB`;
        const track = document.createElement("div");
        track.className = "mfg-progress-track";
        const fill = document.createElement("div");
        fill.className = "mfg-progress-fill";
        track.append(fill);
        details.append(strong, caption, track);

        const jump = document.createElement("a");
        jump.className = "mfg-jump-sources";
        jump.href = "#mfg-sources";
        jump.textContent = "Jump to sources ↓";

        totalBar.append(details, jump);
        picker.append(totalBar);

        const calc = () => {
          let s = 0;
          checkboxes.forEach(cb => { if (cb.checked) s += parseFloat(cb.dataset.gb); });
          strong.textContent = s.toFixed(1) + " GB";
          const pct = Math.min(100, Math.round((s / fullSize) * 100));
          fill.style.width = pct + "%";
        };
        checkboxes.forEach(cb => cb.addEventListener("change", calc));
        calc();

        panelDl.append(picker);
      }

      // Source Switcher
      const sourceHeader = document.createElement("div");
      sourceHeader.className = "mfg-source-header";
      sourceHeader.id = "mfg-sources";
      const sTitle = document.createElement("h3");
      sTitle.className = "mfg-section-title";
      sTitle.textContent = "Download sources";

      const seg = document.createElement("div");
      seg.className = "mfg-source-seg";
      seg.setAttribute("role", "group");
      seg.setAttribute("aria-label", "Filter mirrors by source");

      const btnAll = document.createElement("button");
      btnAll.type = "button";
      btnAll.className = "mfg-seg-btn";
      btnAll.setAttribute("aria-pressed", "false");
      btnAll.dataset.src = "all";
      btnAll.textContent = "All sources";

      const btnDirect = document.createElement("button");
      btnDirect.type = "button";
      btnDirect.className = "mfg-seg-btn";
      btnDirect.setAttribute("aria-pressed", "true");
      btnDirect.dataset.src = "direct";
      btnDirect.textContent = "Direct links";

      const btnTorrent = document.createElement("button");
      btnTorrent.type = "button";
      btnTorrent.className = "mfg-seg-btn";
      btnTorrent.setAttribute("aria-pressed", "false");
      btnTorrent.dataset.src = "torrent";
      btnTorrent.textContent = "Torrent";

      seg.append(btnAll, btnDirect, btnTorrent);
      sourceHeader.append(sTitle, seg);
      panelDl.append(sourceHeader);

      const directWrap = document.createElement("div");
      directWrap.className = "mfg-direct-sources";
      const torrentWrap = document.createElement("div");
      torrentWrap.className = "mfg-torrent-sources";
      torrentWrap.hidden = true;

      let inTorrent = false;
      for (const node of dlNodes) {
        if (node === torrentH3) inTorrent = true;
        if (inTorrent) {
          moveInto(torrentWrap, node);
        } else {
          moveInto(directWrap, node);
        }
      }
      panelDl.append(directWrap, torrentWrap);

      const filterSources = src => {
        btnAll.setAttribute("aria-pressed", String(src === "all"));
        btnDirect.setAttribute("aria-pressed", String(src === "direct"));
        btnTorrent.setAttribute("aria-pressed", String(src === "torrent"));
        directWrap.hidden = src === "torrent";
        torrentWrap.hidden = src === "direct";
      };
      btnAll.addEventListener("click", () => filterSources("all"));
      btnDirect.addEventListener("click", () => filterSources("direct"));
      btnTorrent.addEventListener("click", () => filterSources("torrent"));

      tabPanels.push({ id: "mfg-tab-dl", label: "Download", panel: panelDl });
    }

    // 2. What’s included Tab
    if (ftNodes.length > 0) {
      const panelFt = document.createElement("section");
      panelFt.className = "mfg-tab-panel";
      panelFt.id = "mfg-panel-ft";
      panelFt.setAttribute("role", "tabpanel");
      panelFt.setAttribute("aria-labelledby", "mfg-tab-ft");
      panelFt.hidden = true;

      const ftHeader = document.createElement("div");
      ftHeader.className = "mfg-tab-header";
      const ftTitle = document.createElement("h3");
      ftTitle.className = "mfg-section-title";
      ftTitle.textContent = "What’s included in this repack";
      const ftLead = document.createElement("p");
      ftLead.className = "mfg-section-lead";
      ftLead.textContent = "Lossless compression, MD5 verified files, and selective components.";
      ftHeader.append(ftTitle, ftLead);
      panelFt.append(ftHeader);

      for (const node of ftNodes) {
        moveInto(panelFt, node);
      }
      tabPanels.push({ id: "mfg-tab-ft", label: "What’s included", panel: panelFt });
    }

    // 3. Screenshots Tab
    if (scNodes.length > 0) {
      const panelSc = document.createElement("section");
      panelSc.className = "mfg-tab-panel";
      panelSc.id = "mfg-panel-sc";
      panelSc.setAttribute("role", "tabpanel");
      panelSc.setAttribute("aria-labelledby", "mfg-tab-sc");
      panelSc.hidden = true;

      const scHeader = document.createElement("div");
      scHeader.className = "mfg-tab-header";
      const scTitle = document.createElement("h3");
      scTitle.className = "mfg-section-title";
      scTitle.textContent = "Screenshots & Media";
      const scLead = document.createElement("p");
      scLead.className = "mfg-section-lead";
      scLead.textContent = "Select any screenshot to view full resolution in the preview lightbox.";
      scHeader.append(scTitle, scLead);
      panelSc.append(scHeader);

      for (const node of scNodes) {
        moveInto(panelSc, node);
      }

      tabPanels.push({ id: "mfg-tab-sc", label: "Screenshots", panel: panelSc });
    }

    // 4. Updates Tab
    if (upNodes.length > 0) {
      const panelUp = document.createElement("section");
      panelUp.className = "mfg-tab-panel";
      panelUp.id = "mfg-panel-up";
      panelUp.setAttribute("role", "tabpanel");
      panelUp.setAttribute("aria-labelledby", "mfg-tab-up");
      panelUp.hidden = true;

      const upHeader = document.createElement("div");
      upHeader.className = "mfg-tab-header";
      const upTitle = document.createElement("h3");
      upTitle.className = "mfg-section-title";
      upTitle.textContent = "Updates & Community Discussion";
      const upLead = document.createElement("p");
      upLead.className = "mfg-section-lead";
      upLead.textContent = "Official patches, discussion thread, and community support.";
      upHeader.append(upTitle, upLead);
      panelUp.append(upHeader);

      for (const node of upNodes) {
        const link = node.querySelector("a[href]");
        if (link && /cs\.rin\.ru|discussion/i.test(link.textContent)) {
          const card = document.createElement("div");
          card.className = "mfg-update-card";
          const cardInfo = document.createElement("div");
          cardInfo.className = "mfg-update-info";
          const cHeading = document.createElement("h4");
          cHeading.textContent = "Official CS.RIN.RU Discussion Thread";
          const cDesc = document.createElement("p");
          cDesc.textContent = "Visit the official community thread to find game updates, fixes, discussion, and troubleshooting.";
          cardInfo.append(cHeading, cDesc);

          card.append(cardInfo);
          panelUp.append(card);
          moveInto(card, node);
        } else {
          moveInto(panelUp, node);
        }
      }
      tabPanels.push({ id: "mfg-tab-up", label: "Updates", panel: panelUp });
    }

    // Mount Tab Navigation
    if (tabPanels.length > 0) {
      const tabButtons = [];
      tabPanels.forEach((p, idx) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "mfg-tab";
        btn.id = p.id;
        btn.setAttribute("role", "tab");
        btn.setAttribute("aria-controls", p.panel.id);
        btn.setAttribute("aria-selected", String(idx === 0));
        btn.textContent = p.label;
        p.panel.hidden = idx !== 0;

        btn.addEventListener("click", () => {
          tabButtons.forEach(b => b.setAttribute("aria-selected", "false"));
          tabPanels.forEach(pan => pan.panel.hidden = true);
          btn.setAttribute("aria-selected", "true");
          p.panel.hidden = false;
        });
        tabButtons.push(btn);
        tabsNav.append(btn);
      });

      if (data.paragraph) {
        data.paragraph.after(tabsNav, ...tabPanels.map(p => p.panel));
      } else {
        body.prepend(tabsNav, ...tabPanels.map(p => p.panel));
      }

      changes.push(() => {
        for (let i = moved.length - 1; i >= 0; i--) {
          const { node, parent, next } = moved[i];
          if (next && next.parentNode === parent) {
            parent.insertBefore(node, next);
          } else {
            parent.append(node);
          }
        }
        tabsNav.remove();
        tabPanels.forEach(p => p.panel.remove());
      });
    }
  }

  globalThis.MFGRepack = { metadata, placeholder, cover, summary, enhanceDetail, searchName, gameName, resolveImages, showSpinner, hideSpinner, setSourceBadge };
})();
