# Verification — Pretty FitGirl

## Completed

- **108 captured-DOM viewport cases passed**: twelve page types (home, archive, search, detail, page 2, popular, monthly, yearly, A–Z, digest archive, digest, updates) at 360, 390, 640, 960, 1280, 1440, 1600, 1920, and 2560px.
- All game-card rows use the same artwork-and-title anatomy. Generated listing metadata, rank labels, status badges, and duplicate actions are absent; the optional Steam rating remains visible. Original artwork is unlabeled and Steam/GOG provenance appears only on hover/focus.
- Pagination controls have non-overlapping targets at least 32px across. Native feed and A–Z destinations are preserved.
- One focused Browse rail is created, with secondary site utilities behind a nested disclosure. A structured footer reuses the original live popularity links and images as ten consistent artwork-and-title cards. All original anchors/forms/inputs retain node identity and destinations. Disabling the theme restores the original page DOM.
- My Library, Save controls, and associated files are removed. The artwork background worker remains. Game detail tabs organize downloads, included content, screenshots, and updates; the structured information panel and author warnings remain.
- A–Z entries retain original links and server pagination, gain fixed cover frames, and load artwork near the viewport. Same-origin cover lookups use at most three concurrent requests; cache records expire after seven days and older records are pruned on directory loads.
- **Real MV3 integration passed** in a fresh isolated Edge profile: actual logo and both bundled fonts load, theme restoration and preference persistence work, feed Next navigates to page 3, A–Z Next preserves its page query, visible-card artwork loads, reload uses the artwork cache, removed controls remain absent, and narrow A–Z layout has no overflow.
- **Seven read-only live-page checks passed**: home, detail, page 2, popular, monthly, yearly, and A–Z. All had zero horizontal overflow and consistent navigation/footer structure. A–Z rendered 50 cards and loaded 11 artwork records near the viewport; unavailable external images retained placeholders. The original download spoiler on the detail page still opened. No website downloads were started.
- Visually reviewed desktop homepage, A–Z cards, detail layout, and the two sidebar columns.

## Artifacts

`qa/output/report.json`: 108 rendering cases and zero failures.
`qa/output/live-report.json`: seven live-page results.
Screenshots include `home-1600.png`, `home-390.png`, `az-1600.png`, `live-az.png`, `live-home.png`, `detail-1600.png`, and `live-detail.png`.

Only the `pretty-fitgirl` folder belongs in the distributable ZIP. QA sources, cached site artwork, screenshots, test scripts, and development dependencies are excluded. Bundled fonts include their SIL OFL texts.

## Boundaries

Captured rendering disables third-party scripts and uncached assets. The actual extension test uses captured markup in a temporary profile; live checks use the original website. Third-party comments, subscriptions, media players, every plugin control, every directory page, and Android installation are not exhaustively tested. Site markup and external artwork availability can change independently of the extension.

## Audit regression coverage

`npm test` runs worker and browser regressions, all captured-DOM viewport cases, lazy upcoming artwork checks, navigation-prefetch checks, and trusted/untrusted comments-message tests. The script-free fixture bundle in `qa/fixtures/` makes these checks independent of local captures and live services. CI installs Chromium and executes this suite on Node 22.

Navigation-prefetch regressions cover idle page-2 warming, complete destination-image and resolved artwork/rating warming, hover/focus deduplication, same-origin document requests, page-number detection, and Data Saver backoff. Upcoming-page coverage includes its dedicated header, live game count, and title filter.

Regression checks cover decimal metadata, provider errors versus confirmed misses, request deadlines, normalized request deduplication, cross-tab adult-refresh leases, resumable partial archives, disabled comment interception, iframe fallback, modal focus and tab keyboard navigation. Mocked services exercise deterministic failure cases; they do not certify current live provider behavior or Firefox runtime compatibility.

## Final release pass — 2026-10-27

- Seven live-site checks completed with zero page-script errors and no horizontal overflow; the native download spoiler still opens. No downloads or form submissions were performed.
- Additional regressions cover initial and changed fragment links into hidden detail tabs and stalled A–Z requests releasing the loading queue.
- Release publishing now runs the browser suite, checks that its tag matches the manifest version, and runs only for version tags or manual dispatch. Ordinary main-branch pushes no longer publish releases automatically.
- Package and lockfile versions agree. CI uses Node 20/22, matching the installed Playwright package's minimum Node requirement.
- Firefox package validation is run separately from Chromium runtime verification. Android's manifest minimum is 142 for the data-collection declaration; Android UI support is not claimed.
