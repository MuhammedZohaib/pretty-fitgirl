"use strict";
// Popup controls. Preferences live in chrome.storage.local under "modernFitGirl" and are picked up live by open tabs via storage.onChanged.
const enabled = document.getElementById("enabled");
const density = document.getElementById("density");
const steamRatings = document.getElementById("steamRatings");
const hideAdult = document.getElementById("hideAdult");
const prefetchPages = document.getElementById("prefetchPages");
const presentation = document.getElementById("presentation");
const status = document.getElementById("status");
// Load saved preferences into the form (defaults: enabled and comfortable).
chrome.storage.local.get("modernFitGirl", (stored) => {
  if (chrome.runtime.lastError) { status.textContent = "Preferences could not be loaded. Reopen this panel to retry."; return; }
  const preferences = stored.modernFitGirl || {};
  enabled.checked = preferences.enabled !== false;
  density.value = preferences.density === "compact" ? "compact" : "comfortable";
  steamRatings.checked = preferences.steamRatings !== false;
  hideAdult.checked = preferences.hideAdult === true;
  prefetchPages.checked = preferences.prefetchPages !== false;
  presentation.disabled = !enabled.checked;
});
// Save on every change; no Save button needed.
for (const control of [enabled, steamRatings, hideAdult, prefetchPages, density]) {
  control.addEventListener("change", () => {
    presentation.disabled = !enabled.checked;
    chrome.storage.local.set({ modernFitGirl: { enabled: enabled.checked, density: density.value, steamRatings: steamRatings.checked, hideAdult: hideAdult.checked, prefetchPages: prefetchPages.checked } }, () => {
      status.textContent = chrome.runtime.lastError ? "Could not save. Reopen this panel to retry." : "Saved. Open FitGirl tabs updated.";
    });
  });
}
