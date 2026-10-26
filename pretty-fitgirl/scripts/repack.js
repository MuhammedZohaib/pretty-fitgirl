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

  function cover(image, url, title, className = "mfg-cover") {
    const box = document.createElement(url ? "a" : "div");
    box.className = className;
    if (url) { box.href = url; box.setAttribute("aria-label", title); }
    box.append(placeholder());
    if (image?.getAttribute("src")) {
      const preview = document.createElement("img");
      for (const attribute of ["src", "srcset", "sizes"]) {
        if (image.hasAttribute(attribute)) preview.setAttribute(attribute, image.getAttribute(attribute));
      }
      preview.alt = "";
      preview.loading = "lazy";
      preview.decoding = "async";
      preview.addEventListener("error", () => preview.remove(), { once: true });
      box.append(preview);
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
    const art = cover(originalImage, null, "", "mfg-detail-art");
    header.classList.add("mfg-detail-hero"); header.prepend(art);
    changes.push(() => { art.remove(); header.classList.remove("mfg-detail-hero"); });
    if (data.paragraph) {
      const panel = document.createElement("section"); panel.className = "mfg-game-info";
      const heading = document.createElement("h2"); heading.textContent = "Repack information";
      const facts = document.createElement("dl"); facts.className = "mfg-info-grid";
      for (const row of data.rows) {
        if (row.key && row.value) {
          const item = document.createElement("div"); item.className = "mfg-info-item"; item.dataset.field = row.key;
          const label = document.createElement("dt"); label.textContent = row.label;
          const value = document.createElement("dd"); value.append(richValue(row));
          item.append(label, value); facts.append(item);
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
      data.paragraph.before(panel);
      const originalClass = data.paragraph.getAttribute("class");
      data.paragraph.classList.add("mfg-metadata-source");
      changes.push(() => { panel.remove(); originalClass === null ? data.paragraph.removeAttribute("class") : data.paragraph.setAttribute("class", originalClass); });
    }
  }

  globalThis.MFGRepack = { metadata, placeholder, cover, summary, enhanceDetail };
})();
