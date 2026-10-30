# Pretty FitGirl — 1.6.0

An unofficial Manifest V3 extension for `https://fitgirl-repacks.site/` providing a minimal, clean, distraction-free graphite/brass theme, bundled Inter body text and Manrope headings, and high-performance cover cards. Zero external telemetry, no build step, no runtime framework.

## Install or update

1. Open `chrome://extensions` or `edge://extensions` and enable Developer mode.
2. Click **Load unpacked** and select the `pretty-fitgirl` directory (containing `manifest.json`). For an existing installation, click **Reload** on its extension card.
3. Refresh any open FitGirl tabs.
4. Click the extension toolbar icon to open the popup for theme toggling and comfortable/compact grid spacing.

**Firefox (140+):** use the separate `pretty-fitgirl-firefox-vX.Y.Z.zip` build (`npm run pack`, output in `dist/`). Open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…** and select the zip. Temporary add-ons are removed on restart; permanent installs need a build signed via addons.mozilla.org.

The theme toggle immediately switches between Pretty FitGirl and the original website styling.

## Layout and features

- **Focused navigation and structured footer**: Browse navigation and secondary site utilities share one collapsible rail; the original live popularity widget becomes a ranked footer gallery with consistent navigation and support links.
- **Consistent game cards**: Every listing, search, A–Z, popular, upcoming, and footer game card uses the same artwork-and-title structure. Full metadata remains on the repack detail page.
- **Quiet artwork provenance**: Original artwork has no label. Steam/GOG fallback labels appear only while the artwork is hovered or focused; available Steam ratings remain visible and can be disabled in the popup.
- **Balanced display**: 4-column balanced grid on desktop viewports.
- **Visual hierarchy**: Repacks with covers are prioritised; items without covers are neatly placed at the bottom.
- **Clean pagination**: Preserves native feed and A–Z pagination targets with enlarged, touch-friendly clickable buttons.
- **Complete next-page prefetch**: Warms page 2 after a first listing finishes loading, including its content images plus resolved Steam/GOG artwork and Steam rating data. The same applies to same-origin navigation destinations on hover, focus, or touch. Work is deduplicated, capped per tab, and disabled by Data Saver or 2G connections.
- **Announcement folding**: Update digests and site announcements fold neatly above the card grid.
- **Game detail view**: Retains structured game info, system requirements, author warnings, download mirrors, spoilers, galleries, and comments.
- **Zero bloat**: A small background worker coordinates artwork requests and adult-filter refreshes. No analytics or remotely executed scripts.

## A–Z covers

The original A–Z index contains 50 text links per page without artwork. Pretty FitGirl converts these into visual cover cards while preserving the site's pagination:
- Existing covers already on the page are reused.
- Visible cards fetch cover artwork on-demand via same-origin requests using an IntersectionObserver (max 3 concurrent requests).
- Artwork URLs are cached locally in `chrome.storage.local` for 7 days.
- External artwork availability depends on the source host.

## Fonts and logo

- **Inter** and **Manrope** Latin variable WOFF2 fonts are bundled locally in `assets/fonts/` under the SIL Open Font License.
- Fonts are served from the extension; no Google Fonts or external font CDN is contacted. Artwork can load from external image hosts.
- High-resolution SVG/PNG icons bundled in `assets/`.

## Privacy and permissions

- **Permissions**: `storage` for preferences, artwork, and adult-filter cache; host access to Steam store/API and GOG for artwork and review summaries.
- **Zero tracking**: No telemetry, analytics, or remotely executed scripts. Steam/GOG receive artwork queries and app IDs plus normal connection metadata; artwork hosts receive image requests. Optional navigation prefetching requests same-origin HTML, its content images, and game artwork/rating lookups before navigation, and can be disabled in the popup. Store requests omit credentials. The optional adult filter requests the site’s own archive.
- **Reversible**: Scoped to `html.mfg-on`. Turning off the extension immediately restores the original page styles and DOM.
- **Target**: Desktop Chromium browsers (Chrome, Edge, Brave, Opera, Vivaldi) version 105+.

## License

MIT License. Bundled fonts are licensed under their included SIL OFL. This is an independent, community-driven project not affiliated with or endorsed by FitGirl.
