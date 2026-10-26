"use strict";
const enabled = document.getElementById("enabled");
const view = document.getElementById("view");
const density = document.getElementById("density");
const presentation = document.getElementById("presentation");
const status = document.getElementById("status");
chrome.storage.local.get("modernFitGirl", (stored) => {
  if (chrome.runtime.lastError) { status.textContent = "Preferences could not be loaded. Reopen this panel to retry."; return; }
  const preferences = stored.modernFitGirl || {};
  enabled.checked = preferences.enabled !== false;
  view.value = preferences.view === "list" ? "list" : "grid";
  density.value = preferences.density === "compact" ? "compact" : "comfortable";
  presentation.disabled = !enabled.checked;
});
for (const control of [enabled, view, density]) {
  control.addEventListener("change", () => {
    presentation.disabled = !enabled.checked;
    chrome.storage.local.set({ modernFitGirl: { enabled: enabled.checked, view: view.value, density: density.value } }, () => {
      status.textContent = chrome.runtime.lastError ? "Could not save. Reopen this panel to retry." : "Saved. Open FitGirl tabs updated.";
    });
  });
}
