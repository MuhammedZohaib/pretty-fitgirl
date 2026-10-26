# Verification — Pretty FitGirl

## Completed

- **72 captured-DOM viewport cases passed**: nine page types (home, archive, search, detail, page 2, popular, monthly, yearly, A–Z) at 390, 640, 960, 1280, 1440, 1600, 1920, and 2560px.
- All game-card rows align at their covers, title regions, information regions, and actions. Long category labels and malformed empty anchors cannot widen or add tracks. Popular and A–Z card heights are also checked.
- Pagination controls have non-overlapping targets at least 32px across. Native feed and A–Z destinations are preserved.
- Exactly two extension supporting sidebars are created: browsing/archives on the left and original site promotion/support widgets on the right. All original anchors/forms/inputs retain node identity and destinations. Disabling the theme restores the original page DOM.
- My Library, Save controls, associated files, and the background worker are removed. Game detail section-navigation tabs are removed; the structured information panel and author warnings remain.
- A–Z entries retain original links and server pagination, gain fixed cover frames, and load artwork near the viewport. Same-origin cover lookups use at most three concurrent requests; cache records expire after seven days and older records are pruned on directory loads.
- **Real MV3 integration passed** in a fresh isolated Edge profile: actual logo and both bundled fonts load, theme restoration and preference persistence work, feed Next navigates to page 3, A–Z Next preserves its page query, visible-card artwork loads, reload uses the artwork cache, removed controls remain absent, and narrow A–Z layout has no overflow.
- **Seven read-only live-page checks passed**: home, detail, page 2, popular, monthly, yearly, and A–Z. All had zero horizontal overflow and two sidebars. A–Z rendered 50 cards and loaded 11 artwork records near the viewport; unavailable external images retained placeholders. The original download spoiler on the detail page still opened. No website downloads were started.
- Visually reviewed desktop homepage, A–Z cards, detail layout, and the two sidebar columns.

## Artifacts

`qa/output/report.json`: 72 rendering cases and zero failures.
`qa/output/live-report.json`: seven live-page results.
Screenshots include `home-1600.png`, `home-390.png`, `az-1600.png`, `live-az.png`, `live-home.png`, `detail-1600.png`, and `live-detail.png`.

Only the `pretty-fitgirl` folder belongs in the distributable ZIP. QA sources, cached site artwork, screenshots, test scripts, and development dependencies are excluded. Bundled fonts include their SIL OFL texts.

## Boundaries

Captured rendering disables third-party scripts and uncached assets. The actual extension test uses captured markup in a temporary profile; live checks use the original website. Third-party comments, subscriptions, media players, every plugin control, every directory page, and Android installation are not exhaustively tested. Site markup and external artwork availability can change independently of the extension.
