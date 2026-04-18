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

<img width="2554" height="1321" alt="image" src="https://github.com/user-attachments/assets/531c678a-78da-4ab7-8320-62af160a24a8" />
<img width="1841" height="1188" alt="image1" src="https://github.com/user-attachments/assets/c34ca34a-7853-42b5-8a4a-ae53157e19a8" />
<img width="2043" height="1281" alt="image2" src="https://github.com/user-attachments/assets/3fee1732-702e-499b-b1b3-763c5ef7100c" />
<img width="2554" height="1286" alt="image3" src="https://github.com/user-attachments/assets/e8dd34e9-955b-425a-a175-3e28ba3c95d3" />
<img width="2552" height="1277" alt="image4" src="https://github.com/user-attachments/assets/3b0c9843-ba29-43a2-b852-c871dd02713f" />
<img width="2554" height="1281" alt="image5" src="https://github.com/user-attachments/assets/a4d3cbc0-086b-4bec-9c65-9f603d7b828c" />
<img width="1229" height="1257" alt="image6" src="https://github.com/user-attachments/assets/1c542ef9-bf90-48de-a581-780df6c5c039" />

### ⚓ World of Warships — Random Ship Selector
Pick a random ship from your own port to play next — great for challenge runs, stream variety, or just leaving it up to fate.

https://github.com/user-attachments/assets/9b7ef1f0-e725-4f92-a86e-4733673911ec

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


## Green screen / chromakey mode
- OBS chromakey possibilities
<img width="2515" height="1284" alt="image" src="https://github.com/user-attachments/assets/3586bf98-cd9f-42af-b3c1-843712796d70" />


## Running locally

```
node server.js
```
Then open [http://localhost:3000](http://localhost:3000).

Copy `local.config.example.js` → `local.config.js` and fill in your Twitch Client ID and WoWS Application ID for full functionality.

The WoWS API calls and Wargaming OAuth flow are proxied through `server.js` so your API key is never exposed to the browser.
