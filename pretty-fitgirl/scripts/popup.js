"use strict";
// Popup controls. Preferences live in chrome.storage.local under "modernFitGirl" and are picked up live by open tabs via storage.onChanged.
const enabled = document.getElementById("enabled");
const view = document.getElementById("view");
const density = document.getElementById("density");
const hideAdult = document.getElementById("hideAdult");
const presentation = document.getElementById("presentation");
const status = document.getElementById("status");
// Load saved preferences into the form (defaults: enabled, grid, comfortable).
chrome.storage.local.get("modernFitGirl", (stored) => {
  if (chrome.runtime.lastError) { status.textContent = "Preferences could not be loaded. Reopen this panel to retry."; return; }
  const preferences = stored.modernFitGirl || {};
  enabled.checked = preferences.enabled !== false;
  view.value = preferences.view === "list" ? "list" : "grid";
  density.value = preferences.density === "compact" ? "compact" : "comfortable";
  hideAdult.checked = preferences.hideAdult === true;
  presentation.disabled = !enabled.checked;
});
// Save on every change; no Save button needed.
for (const control of [enabled, view, density, hideAdult]) {
  control.addEventListener("change", () => {
    presentation.disabled = !enabled.checked;
    chrome.storage.local.set({ modernFitGirl: { enabled: enabled.checked, view: view.value, density: density.value, hideAdult: hideAdult.checked } }, () => {
      status.textContent = chrome.runtime.lastError ? "Could not save. Reopen this panel to retry." : "Saved. Open FitGirl tabs updated.";
    });
  });
}
