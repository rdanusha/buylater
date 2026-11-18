# BuyLater

**Want it now? Decide tomorrow.**

A second thought before checkout. Save something you want, choose a cooling-off period, and decide whether it still feels worth it.

- [Use BuyLater](https://rdanusha.github.io/buylater/)
- [Source code](https://github.com/rdanusha/buylater)

Built by rdanusha. MIT licensed.

## Features

- Save an item, price and optional HTTP/HTTPS product link.
- Choose a wait of 24 hours, 7 days or 30 days.
- Once ready, record Bought, Skipped or Still thinking (+24 hours).
- View wishlist totals, skipped spending, recorded purchases and a decision-count chart.
- Filter and sort your list, delete individual entries with confirmation, export JSON backups and import a replacement list.
- Open “How BuyLater works” near the top for a quick guide to adding items, waiting, deciding and keeping a backup.
- Start empty, or explore explicitly fictional examples that never change your saved list.
- One currency per list: USD, EUR, GBP, CAD, AUD or LKR. No currency conversion. Positive prices support up to two decimal places, a maximum of 1,000,000,000.00 per item and 1,000 items per list.

## Privacy and limits

Your list is saved in IndexedDB in this browser profile. It is not encrypted, automatically backed up or synced across devices. Anyone with access to the same profile can access it. Export a backup before clearing browser data. Local and hosted versions have separate storage; export/import transfers data.

We add no analytics, tracking scripts, accounts or wishlist-upload API. GitHub Pages hosts the website and may log ordinary page/asset requests. Other websites on the same github.io origin share an origin-level browser security boundary, even if their paths differ. Do not store secrets or sensitive personal information in product links or names.

Skipped spending is the price of items marked skipped, not verified bank savings. Product prices, shipping, tax and discounts are not automatically refreshed. The waiting period follows your device clock, is not tamper-resistant, and sends no background notifications. Countdown controls refresh within 15 seconds while open and when returning to the tab. Final decisions can be deleted, not edited. Deleting an item removes its contribution to totals.

Import replaces the list after confirmation. Invalid or unsupported data is preserved and writes are blocked, rather than silently reset. Concurrent writes use IndexedDB transactions and stale-revision checks. Browser cleanup or eviction can still remove data. Delete entries individually, or use your browser's site-data controls to remove the app's stored data. Clearing site data at the shared origin can affect other apps hosted there.

## Local development

Requires Node.js 22 or newer. No package install is required just to run the app:

```sh
npm start
```

Open http://127.0.0.1:4187/. Do not double-click index.html. Keep using the same URL and browser profile to access the same saved list.

For tests:

```sh
npm ci
npx playwright install chrome webkit
npm test
```

Locally the test configuration uses installed Google Chrome plus Playwright WebKit. In CI it uses Playwright Chromium and WebKit. Test profiles are isolated from normal saved app data. The test server uses port 4188.

The suite covers exact price parsing, validation, controlled-clock decisions, persistence, fictional demo isolation, backup export/import, interrupted reads, blocked/rejected storage, cross-tab conflicts, stale deletion, pending import mode changes and responsive geometry. WebKit tests are engine tests, not physical iPhone testing.

## Deployment

The GitHub Actions workflow tests first, then deploys only the explicit public asset allowlist on main. The hosted app is entirely static. The local Node server is a development convenience, not a required production backend.

The five runtime assets are index.html, style.css, app.js, core.js and storage.js. social-preview.png is the sharing image. License and test/development sources are in this repository but are not uploaded to the Pages artifact.

## License

[MIT](LICENSE), copyright 2026 rdanusha.
