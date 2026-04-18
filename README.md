# FortuneWheel5000

Twitch giveaway wheel + World of Warships random ship selector — free to use directly in your browser.

## 🌐 Live version — no installation needed

**[https://www.bjsolutions.no/FortuneWheel5000](https://www.bjsolutions.no/FortuneWheel5000)**

Open it in your browser and start spinning. Nothing to install, nothing to sign up for.

---

## Features

### 🎡 Twitch Giveaway Wheel
- Connects to Twitch chat via [tmi.js](https://tmijs.com/) (bundled), with a raw WebSocket IRC fallback — no server or API key required
- Participants join by typing a keyword in chat
- Multiple winners per session
- Animated participant list with per-user slice colour
- Timed giveaway with countdown overlay (optional)
- Timed claim window for winner (optional)
- Live chat feed from winner in the winner popup
- Re-spin with automatic winner exclusion
- Wheel size toggle (normal / large)
- Green screen / chromakey mode for OBS compositing
- Chromakey-safe colour palette (no greens or teals)
- Confetti on win, sad-face rain on claim timeout (both toggleable)
- Tick sound effects during spin (toggleable)
- OBS browser source friendly: `?autoconnect=1&channel=name&keyword=!wheel` URL params
- `!me` chat command as an alternative join trigger

### ⚓ World of Warships — Random Ship Selector
Pick a random ship from your own port to play next — great for challenge runs, stream variety, or just leaving it up to fate.

https://github.com/user-attachments/assets/e5a36355-c930-4235-a01c-2fcc8f1c65ff

- **Log in with Wargaming** (OAuth) to see only ships currently in your port, or enter your account ID / username to search from all ships ever played
- Supports all regions: EU, NA, Asia, RU
- **Multi-step spin sequence**: the wheel spins for Tier, Ship Type, Nation, then Ship — in that order, or in a random order if you enable the shuffle toggle
- **Filter controls**: set a tier range, lock nation, or tick/untick ship types (Battleship, Cruiser, Destroyer, etc.) — only checked types enter the draw
- Steps with only one valid option are skipped automatically (no pointless spin)
- **Win-rate stats** shown in the result card (Random and Ranked battles)
- Tick sounds and confetti (both optional)
- **Green screen / chromakey mode** — transparent background for OBS overlay use, with a floating Spin button so you never need to leave the stream view
- Spin history sidebar for the current session
- Colour palette picker for the wheel

<img width="2221" height="1322" alt="image" src="https://github.com/user-attachments/assets/2d49492b-bd6d-4e37-9f0a-e4224e8584a9" />
<img width="2226" height="1317" alt="image" src="https://github.com/user-attachments/assets/caafd0f5-72bd-4c14-9def-06ff09494ed8" />
<img width="2230" height="1317" alt="image" src="https://github.com/user-attachments/assets/942fe939-43fc-4649-9670-ce8cc4c9e652" />
<img width="2231" height="1321" alt="image" src="https://github.com/user-attachments/assets/67995ac0-039c-4d1a-a002-bd8a7786321f" />
<img width="2237" height="1318" alt="image" src="https://github.com/user-attachments/assets/a0d809d6-b1b2-4b44-bb40-08ac0c9d4f03" />
<img width="2233" height="1324" alt="image" src="https://github.com/user-attachments/assets/a718906d-ed97-4aa9-b298-44f15d3c4ec7" />
<img width="2232" height="1325" alt="image" src="https://github.com/user-attachments/assets/ceb406ac-9738-4463-a0dd-b1bb8d218c5e" />
<img width="2229" height="1325" alt="image" src="https://github.com/user-attachments/assets/b6d12505-24d6-4f68-ae40-8e406428dc45" />

## Green screen / chromakey mode
<img width="2231" height="1323" alt="image" src="https://github.com/user-attachments/assets/e402b649-38f9-42b1-af01-e7da938c8601" />
<img width="2229" height="1321" alt="image" src="https://github.com/user-attachments/assets/b4fb9575-bf5e-4efa-a6dd-c8bbc748afba" />

## Running locally

```
node server.js
```
Then open [http://localhost:3000](http://localhost:3000).

Copy `local.config.example.js` → `local.config.js` and fill in your Twitch Client ID and WoWS Application ID for full functionality.

The WoWS API calls and Wargaming OAuth flow are proxied through `server.js` so your API key is never exposed to the browser.
