# Changelog

All notable changes to Pretty FitGirl are documented here.

## [1.6.0] - 2026-10-30

### Added

- A bundled “Cover Unavailable” fallback used consistently whenever original, Steam, and GOG artwork cannot be found.
- Steam review summaries and stricter Steam/GOG title matching with cached, deduplicated artwork resolution.
- Complete next-page prefetching for destination HTML, content images, posters, headers, banners, and Steam rating data.
- A structured popularity footer with ten compact cards in one row.
- A dedicated Upcoming Repacks sidebar destination, release-watchlist header, live count, and title filter.
- Automated regressions for artwork matching, full prefetch behavior, Upcoming Repacks, navigation, and responsive card structure.

### Changed

- Standardized listing, search, A–Z, popular, Upcoming, and footer entries around compact artwork-and-title cards.
- Removed list view and reduced oversized title areas throughout the card grid.
- Reorganized the Browse sidebar and renamed the secondary site section to “Site resources”.
- Made Upcoming Repacks part of the normal document flow with no nested scrolling panel.
- Refined game-detail navigation, download tabs, comments presentation, keyboard behavior, popup controls, and responsive spacing.
- Made “All sources” the default download view and changed the screenshot gallery to a responsive two-column layout.
- Refreshed all README screenshots for the graphite-and-brass interface.

### Privacy and performance

- Prefetching remains optional, same-origin for documents, capped at four destinations per tab, and disabled on Data Saver or 2G connections.
- No analytics, telemetry, or remotely executed scripts were added.

## [1.5.0] - 2026-10-26

- Added Steam review support, adult-game filtering, Firefox packaging, and the initial public release workflow.
