# Pretty FitGirl

[![CI](https://github.com/MuhammedZohaib/pretty-fitgirl/actions/workflows/ci.yml/badge.svg)](https://github.com/MuhammedZohaib/pretty-fitgirl/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/MuhammedZohaib/pretty-fitgirl?include_prereleases&style=flat-square)](https://github.com/MuhammedZohaib/pretty-fitgirl/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-success.svg?style=flat-square)](pretty-fitgirl/manifest.json)

> **Pretty FitGirl** is an unofficial, minimal, distraction-free dark theme and user experience enhancement browser extension for [FitGirl Repacks](https://fitgirl-repacks.site/).

Crafted for speed, legibility, and privacy. Zero tracking, zero build steps, and 100% client-side.

---

## 📸 Preview

![Pretty FitGirl Preview](docs/images/preview.png)

<details>
<summary>🔍 <strong>More Screenshots (Game Details & A–Z Directory)</strong></summary>

### Game Detail View
![Game Details View](docs/images/detail-preview.png)

### A–Z Directory with Cover Cards
![A-Z Directory View](docs/images/az-preview.png)

</details>

---

## ✨ What Pretty FitGirl adds to the original website

Pretty FitGirl enhances the existing site in your browser: it adds browsing tools, reorganizes game information, and gives the original pages a consistent dark interface. Repack metadata and download destinations still come from the website.

### Browse and discover games

- **Dark theme and responsive layouts** — Charcoal and muted sage styling, locally bundled Inter and Manrope fonts, cover-grid and list views, and comfortable or compact spacing.
- **Game cover cards** — Aligned artwork, repack and original sizes, languages, tags, and a direct **View repack** link make listings easier to scan.
- **Visual A–Z directory** — Turns the site's text list into cover cards while retaining its original links and pagination. Artwork loads near the viewport and is cached locally.
- **Artwork fallback** — Looks up missing covers on Steam, with GOG as a fallback when needed. Source badges identify Original, Steam, or GOG artwork; unavailable covers retain a placeholder.
- **Steam review badges** — Shows available Steam review summaries and positive-review percentages on game cards, with links to the corresponding Steam pages. Badge visibility can be toggled in the popup.
- **Upcoming repack cards** — Converts upcoming-game lists into poster cards with version and delay badges when present, plus **Watch gameplay** links to YouTube search results. Offscreen and collapsed cards defer artwork loading.
- **Popular collection filters** — Adds a title filter, rank labels, result counts, and shortcuts between monthly and yearly collections.
- **Optional adult-game filtering** — Hides posts tagged Adult. A–Z and popular collections use a locally cached index of the site's Adult archive; coverage depends on that index being available and up to date.

### Read game pages and updates

- **Structured game details** — Groups artwork, version badges, sizes, languages, installation information, and author warnings into a clearer overview.
- **Game detail tabs** — Organizes available content into **Download**, **What's included**, **Screenshots**, and **Updates** sections. Download-source controls switch between direct links, torrents, or all sources while retaining the site's original destinations.
- **Image previews** — Opens supported screenshots and comment images in a lightbox with zoom controls. The main-page viewer also supports dragging enlarged images and opening the original image.
- **Collapsible, themed comments** — Folds comments into an expandable section and applies dark styling to the supported embedded comments widget. Comment-image previews can fall back to an in-frame viewer.
- **Searchable update digests** — Adds digest summaries, game-title filtering, result counts, and badges for entries marked new by the site.
- **Folded announcements** — Groups non-game announcements and site notices into expandable panels so game listings stay easier to browse.

### Navigate and personalize

- **Two supporting sidebars** — Keeps browsing shortcuts, archives, and collections on the left, with the site's support widgets and notices on the right.
- **Mobile navigation helpers** — Adds a collapsible **Browse** menu, a skip-to-content link, and a back-to-top button.
- **Keyboard controls** — Supports arrow-key navigation between detail tabs, focus handling in image previews, and Escape to close previews or the mobile Browse menu.
- **Instant theme toggle** — Restores the original page presentation when disabled. Preferences are saved locally and applied across open FitGirl tabs.

### Privacy and network use

No analytics or telemetry is added. Preferences, artwork records, and the adult-filter index stay in local browser storage. Fonts are bundled with the extension.

A background worker contacts Steam and GOG for artwork searches and Steam review summaries. These services receive search titles or app IDs and normal connection metadata; artwork loads from its source hosts. The optional adult filter requests the site's own archive and coordinates refreshes across tabs. Gameplay links open YouTube only when selected.

---

## 🚀 Installation

### Option 1: Pre-built Release (Recommended)

1. Download the latest `pretty-fitgirl-vX.Y.Z.zip` from [GitHub Releases](https://github.com/MuhammedZohaib/pretty-fitgirl/releases).
2. Extract the ZIP archive to a folder on your computer.
3. Open your Chromium-based browser (Chrome, Edge, Brave, Opera, Vivaldi):
   - In Chrome / Brave: navigate to `chrome://extensions`
   - In Edge: navigate to `edge://extensions`
4. Turn on **Developer mode** (toggle in the top-right or sidebar).
5. Click **Load unpacked** and select the extracted `pretty-fitgirl` folder (the directory containing `manifest.json`).
6. Navigate to [fitgirl-repacks.site](https://fitgirl-repacks.site/) and enjoy!

### Option 2: Firefox (140+)

Firefox needs its own build, because its manifest differs from the Chromium one.

1. Download `pretty-fitgirl-firefox-vX.Y.Z.zip` from [GitHub Releases](https://github.com/MuhammedZohaib/pretty-fitgirl/releases) (or run `npm run pack` and take it from `dist/`).
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** and select the zip file (or the `manifest.json` of the extracted archive).
4. Navigate to [fitgirl-repacks.site](https://fitgirl-repacks.site/). If the theme doesn't apply, open `about:addons`, select Pretty FitGirl, and allow access to the site under **Permissions**.

> Temporary add-ons are removed when Firefox restarts. For a permanent install, use a build signed through [addons.mozilla.org](https://addons.mozilla.org/developers/) (choose "On your own" for a private signed `.xpi`), or use Firefox Developer Edition / Nightly with `xpinstall.signatures.required` set to `false`.

### Option 3: From Source

```bash
git clone https://github.com/MuhammedZohaib/pretty-fitgirl.git
cd pretty-fitgirl
```

Load the `pretty-fitgirl` directory directly as an unpacked extension in Chromium browsers following the instructions above. For Firefox, run `npm run pack` and load the generated `dist/pretty-fitgirl-firefox-vX.Y.Z.zip`; the source folder's manifest is Chromium-only.

---

## ⚙️ Configuration

Click the **Pretty FitGirl** icon in your browser toolbar to customize your experience:

- **Theme Toggle** — Enable or disable the modern theme instantly without reloading.
- **Layout** — Switch between **Cover grid** and **List view**.
- **Density** — Choose between **Comfortable** and **Compact** card spacing.
- **Steam Ratings** — Show or hide available Steam review badges on game cards.
- **Hide Adult Games** — Hide posts tagged Adult, including matching A–Z and popular entries when the archive index is available.

Preferences are synced across tabs and saved locally in your browser.

---

## 🛠️ Development & Testing

Pretty FitGirl has **zero runtime dependencies** or compilation steps. The source code is pure vanilla JavaScript and modular CSS.

Developer dependencies are only used for QA and automated verification:

```bash
# Install testing tools (Playwright)
npm install

# Run quick manifest & syntax verification
npm run check

# Run full cross-viewport rendering suite (headless Chromium)
npm test

# Build distribution ZIP archives
npm run pack

# Capture fresh README preview screenshots
node scripts/capture-readme-images.cjs
```

---

## 🤝 Contributing

Contributions, bug reports, and suggestions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on code style, testing, and pull requests.

---

## 📜 Disclaimer

**Pretty FitGirl** is an independent, community-driven open-source project. It is **not** affiliated with, endorsed by, or associated with FitGirl or the FitGirl Repacks website. All trademarks, game titles, artwork, and website content belong to their respective owners.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).  
Bundled fonts (*Inter* and *Manrope*) are distributed under the [SIL Open Font License](pretty-fitgirl/assets/fonts/Inter-OFL.txt).

---

⭐ **Enjoying Pretty FitGirl? Give the repo a [star](https://github.com/MuhammedZohaib/pretty-fitgirl/stargazers) to show your support and help it glow for others too!** 💚
