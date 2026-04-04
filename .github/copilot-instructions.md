# FortuneWheel5000

A browser-only Twitch chat giveaway "wheel of fortune" app. No build step, no framework, no server — open `index.html` directly. See [README.md](../README.md) for feature overview.

## Architecture

Three classes in a single global scope across three files:

| File | Purpose |
|---|---|
| `index.html` | HTML shell; loads `styles.css` then `app.js`; all layout via CSS Grid |
| `styles.css` | Dark navy/cyan/purple design system; CSS custom props (`--wheel-size`, `--center-col`); `body.greenscreen` OBS mode |
| `app.js` | All logic — three classes + `APP_CONFIG` constant |

**Classes in `app.js`:**
- `SimpleCanvasWheel` — Canvas renderer/animator; takes `items[]`, spins to a pre-computed index via `spinToIndex()`
- `TwitchWSChat` — Fallback raw IRC-over-WebSocket client (used when `window.tmi` is not available)  
- `TwitchGiveawayApp` — Main controller; instantiated once as `const app = new TwitchGiveawayApp()`

**Chat backend selection:** At connection time, the app checks `window.tmi`. If present (loaded from `tmi.min.js`), it uses tmi.js; otherwise `TwitchWSChat` takes over. Both implement the same callback interface.

**Winner flow:** `spinWheel()` pre-computes `_pendingWinnerIndex` → `wheel.spinToIndex()` animates → `onRest` callback resolves winner from stored index (never re-computed from rotation angle).

## Code Style

- Vanilla ES6+ class-based OOP — no modules, no bundler, everything in global scope
- DOM references cached in `this.elements` object in the constructor
- `localStorage` keys: `mw.settings`, `mw.participants`, `mw.excluded`, `mw.history`, `mw.donateHidden`, `mw.connCollapsed`, `mw.wheelLarge`
- Inline styles used for dynamic visibility alongside CSS class toggles
- Errors silently swallowed via `try/catch` → `console.warn` — this is intentional for streaming resilience

## Configuration

Primary config is at the top of `app.js` in `APP_CONFIG`. Key fields:

```js
APP_CONFIG.defaults.channelName     // pre-filled channel input
APP_CONFIG.ui.showAddTestParticipants  // set false before shipping
APP_CONFIG.enableFollowerInfo       // true = Twitch Client ID + OAuth required (moderator:read:followers)
```

The wheel's 14-color palette is **chromakey-safe** (no greens/teals) — preserve this when adding colors.

## Pitfalls

- **`enableFollowerInfo: true`** — Requires Twitch Client ID + OAuth token (`authorizeWithTwitch`, `fetchChannelId`, `resolveUserId`). The implicit OAuth flow redirects to `https://id.twitch.tv/oauth2/authorize` with `moderator:read:followers` scope. Setting this to `false` hides auth UI and short-circuits all follower lookups.
- **No `<script type="module">`** — all classes are globals. Do not add ES module syntax (`import`/`export`) without a corresponding build step.
- **`escapeHtml` regex bug** — the single-quote pattern is `' ` (apostrophe + space) instead of `'`. Twitch usernames are alphanumeric, so this is low impact, but fix before using the function on arbitrary text.
- **Spin controls have no UI** — `spinDurationSeconds` and `spinSmoothEasing` only exist in `APP_CONFIG` and `localStorage`; there are no form fields for them.
- **`?autoconnect=1` URL param** — useful for OBS browser sources; supported alongside `?channel=`, `?keyword=`, `?clientId=`.
