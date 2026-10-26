/* Style only Tolstoy's embedded widget when it belongs to the supported site. */
(() => {
  "use strict";
  if (window.top === window) return;
  const supported = "https://fitgirl-repacks.site";
  try {
    const pParam = new URL(location.href).searchParams.get("p");
    const pOrigin = pParam ? new URL(pParam).origin : null;
    const ancestor = (window.location.ancestorOrigins && [...window.location.ancestorOrigins].includes(supported)) || (document.referrer ? new URL(document.referrer).origin === supported : false);
    if (pOrigin !== supported && !ancestor) return;
  } catch { return; }
  const root = document.documentElement;
  const apply = value => root.classList.toggle("mfg-comments-on", value?.enabled !== false);
  apply();
  const fonts = document.createElement("style");
  fonts.textContent = `@font-face{font-family:"MFG Inter";font-style:normal;font-weight:400 700;font-display:swap;src:url("${chrome.runtime.getURL("assets/fonts/inter-latin.woff2")}") format("woff2");}`;
  root.append(fonts);
  chrome.storage.local.get("modernFitGirl", stored => { if (!chrome.runtime.lastError) apply(stored.modernFitGirl); });
  chrome.storage.onChanged.addListener((changes, area) => { if (area === "local" && changes.modernFitGirl) apply(changes.modernFitGirl.newValue); });

  // In-frame lightbox fallback
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

    const closeLb = () => {
      frameLb.classList.remove("mfg-frame-lightbox-open");
      img.src = "";
    };
    close.addEventListener("click", closeLb);
    frameLb.addEventListener("click", e => { if (e.target === frameLb) closeLb(); });
    window.addEventListener("keydown", e => { if (e.key === "Escape") closeLb(); });
    return frameLb;
  }

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
