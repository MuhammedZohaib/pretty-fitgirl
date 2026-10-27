# Offline page fixtures

`pages.json.gz` contains UTF-8 JSON mapping filenames to public FitGirl page markup and theme/widget styles captured for this project's existing QA suite. Script elements are removed. It contains no browser profile, cookies, credentials, downloaded games, or artwork cache. The website content remains the property of its respective owners; these snapshots are test inputs only and are excluded from extension packages.

`../fixture-fs.cjs` serves this bundle in memory so a clean checkout runs without `qa/sources/` or live network access. Refresh deliberately when the site's markup changes, inspect the diff in decompressed JSON, remove executable scripts, and rerun the full suite before replacing the bundle. Original captures remain ignored.
