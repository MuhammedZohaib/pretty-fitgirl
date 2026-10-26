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
})();
