/* Style only Tolstoy's embedded widget when it belongs to the supported site. */
(() => {
  "use strict";
  if (window.top === window) return;
  // Only the official site may be styled; this guards against other sites embedding the same widget.
  const supported = "https://fitgirl-repacks.site";
  try {
    const pParam = new URL(location.href).searchParams.get("p");
    const pOrigin = pParam ? new URL(pParam).origin : null;
    const ancestor = (window.location.ancestorOrigins && [...window.location.ancestorOrigins].includes(supported)) || (document.referrer ? new URL(document.referrer).origin === supported : false);
    if (pOrigin !== supported && !ancestor) return;
  } catch { return; }
  const root = document.documentElement;
  // Toggle the dark comments skin from the saved "enabled" preference.
  const apply = value => root.classList.toggle("mfg-comments-on", value?.enabled !== false);
  apply();
  const fonts = document.createElement("style");
  fonts.textContent = `@font-face{font-family:"MFG Inter";font-style:normal;font-weight:400 700;font-display:swap;src:url("${chrome.runtime.getURL("assets/fonts/inter-latin.woff2")}") format("woff2");}`;
  root.append(fonts);
  chrome.storage.local.get("modernFitGirl", stored => { if (!chrome.runtime.lastError) apply(stored.modernFitGirl); });
  chrome.storage.onChanged.addListener((changes, area) => { if (area === "local" && changes.modernFitGirl) apply(changes.modernFitGirl.newValue); });

  // In-frame lightbox fallback
  // Fallback lightbox rendered inside the iframe when the parent page cannot show one.
  let frameLb = null;
  function getFrameLb() {
    if (frameLb) return frameLb;
    frameLb = document.createElement("div");
    frameLb.className = "mfg-frame-lightbox";
    frameLb.setAttribute("role", "dialog");
    frameLb.setAttribute("aria-modal", "true");
    frameLb.setAttribute("aria-label", "Image preview");

    const close = document.createElement("button");
    close.type = "button";
    close.className = "mfg-frame-lightbox-close";
    close.setAttribute("aria-label", "Close preview");
    close.textContent = "✕";

    const img = document.createElement("img");
    img.className = "mfg-frame-lightbox-img";
    img.alt = "Preview";
    img.referrerPolicy = "no-referrer";

    frameLb.append(close, img);
    document.body.append(frameLb);

    let zoom = 1;
    const applyZoom = z => {
      zoom = Math.min(4, Math.max(0.5, Math.round(z * 100) / 100));
      img.style.transition = "transform 140ms ease-out";
      img.style.transform = `scale(${zoom})`;
      img.style.cursor = zoom > 1 ? "zoom-out" : "zoom-in";
    };
    img.addEventListener("click", e => { e.stopPropagation(); applyZoom(zoom === 1 ? 2 : 1); });
    frameLb.addEventListener("wheel", e => {
      if (!frameLb.classList.contains("mfg-frame-lightbox-open")) return;
      e.preventDefault();
      applyZoom(zoom + (e.deltaY < 0 ? 0.25 : -0.25));
    }, { passive: false });
    window.addEventListener("keydown", e => {
      if (!frameLb.classList.contains("mfg-frame-lightbox-open")) return;
      if (e.key === "+" || e.key === "=") applyZoom(zoom + 0.25);
      else if (e.key === "-" || e.key === "_") applyZoom(zoom - 0.25);
      else if (e.key === "0") applyZoom(1);
    });

    const closeLb = () => {
      frameLb.classList.remove("mfg-frame-lightbox-open");
      img.src = "";
      applyZoom(1);
    };
    close.addEventListener("click", closeLb);
    frameLb.addEventListener("click", e => { if (e.target === frameLb) closeLb(); });
    window.addEventListener("keydown", e => { if (e.key === "Escape") closeLb(); });
    return frameLb;
  }

  // Prefer the parent page lightbox (via postMessage, handled in repack.js); fall back to the in-frame one.
  function openImage(src, thumb = "") {
    const cleanSrc = src.replace(/^http:\/\//i, "https://");
    const cleanThumb = thumb ? thumb.replace(/^http:\/\//i, "https://") : "";

    // Notify parent window to open full-screen lightbox on fitgirl-repacks.site
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "mfg-open-lightbox", src: cleanSrc, thumb: cleanThumb }, "*");
        return;
      }
    } catch {}

    // Fallback: open inside comments frame
    const lb = getFrameLb();
    const img = lb.querySelector(".mfg-frame-lightbox-img");
    img.src = cleanSrc;
    lb.classList.add("mfg-frame-lightbox-open");
  }

  // Intercept clicks on any image or image link in comments
  // Capture clicks on comment images / image links and open them in the lightbox instead of navigating away.
  document.addEventListener("click", e => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const target = e.target;
    if (target.closest(".avatar, .app-avatar, .user-avatar, svg, button, .button, .buttons, .app-header")) return;

    const img = target.closest("img");
    const link = target.closest("a");

    let src = null;
    let thumb = "";
    if (img) {
      const s = img.currentSrc || img.getAttribute("src") || img.src;
      if (s && !/avatar|icon|emoji|loader|blank\.gif/i.test(s)) {
        src = s;
        thumb = s;
        if (link && /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(link.href)) {
          src = link.href;
        }
      }
    } else if (link && /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(link.href)) {
      src = link.href;
    }

    if (src) {
      e.preventDefault();
      e.stopPropagation();
      openImage(src, thumb);
    }
  }, true);
})();
