# Pretty FitGirl — 1.5.0

An unofficial Manifest V3 extension for `https://fitgirl-repacks.site/` providing a minimal, clean, distraction-free charcoal/sage theme, bundled Inter body text and Manrope headings, and high-performance cover cards. Zero external telemetry, no build step, no runtime framework.

## Install or update

1. Open `chrome://extensions` or `edge://extensions` and enable Developer mode.
2. Click **Load unpacked** and select the `pretty-fitgirl` directory (containing `manifest.json`). For an existing installation, click **Reload** on its extension card.
3. Refresh any open FitGirl tabs.
4. Click the extension toolbar icon to open the popup for theme toggling, grid/list view, and comfortable/compact spacing.

**Firefox (140+):** use the separate `pretty-fitgirl-firefox-vX.Y.Z.zip` build (`npm run pack`, output in `dist/`). Open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…** and select the zip. Temporary add-ons are removed on restart; permanent installs need a build signed via addons.mozilla.org.

The theme toggle immediately switches between Pretty FitGirl and the original website styling.

## Layout and features

- **Dual supporting sidebars**: Browse navigation on the left (A–Z index, monthly/yearly collections, game updates, FAQ, troubleshooting, monthly archives); site support & notices on the right.
- **Card grid layout**: Cover cards link directly to repack pages. Repack/original sizes, languages, and tags are cleanly formatted and aligned.
- **Balanced display**: 4-column balanced grid on desktop viewports.
- **Visual hierarchy**: Repacks with covers are prioritised; items without covers are neatly placed at the bottom.
- **Clean pagination**: Preserves native feed and A–Z pagination targets with enlarged, touch-friendly clickable buttons.
- **Announcement folding**: Update digests and site announcements fold neatly above the card grid.
- **Game detail view**: Retains structured game info, system requirements, author warnings, download mirrors, spoilers, galleries, and comments.
- **Zero bloat**: No background workers, no analytics, no external scripts.

## A–Z covers

The original A–Z index contains 50 text links per page without artwork. Pretty FitGirl converts these into visual cover cards while preserving the site's pagination:
- Existing covers already on the page are reused.
- Visible cards fetch cover artwork on-demand via same-origin requests using an IntersectionObserver (max 3 concurrent requests).
- Artwork URLs are cached locally in `chrome.storage.local` for 7 days.
- External artwork availability depends on the source host.

## Fonts and logo

- **Inter** and **Manrope** Latin variable WOFF2 fonts are bundled locally in `assets/fonts/` under the SIL Open Font License.
- No Google Fonts or third-party CDNs are contacted at runtime.
- High-resolution SVG/PNG icons bundled in `assets/`.

## Privacy and permissions

- **Single permission**: `storage` (`chrome.storage.local` used solely for theme preferences and cover cache).
- **Zero tracking**: No telemetry, analytics, remote scripts, cookies, or cloud services.
- **Reversible**: Scoped to `html.mfg-on`. Turning off the extension immediately restores the original page styles and DOM.
- **Target**: Desktop Chromium browsers (Chrome, Edge, Brave, Opera, Vivaldi) version 105+.

## License

MIT License. Bundled fonts are licensed under their included SIL OFL. This is an independent, community-driven project not affiliated with or endorsed by FitGirl.
