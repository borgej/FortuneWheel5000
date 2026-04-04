// Load tmi.js with fallbacks (unpkg)
(function loadTmi(urls){
  function tryNext(i){
    if(i>=urls.length){ console.error('Failed to load tmi.js'); return; }
    var s=document.createElement('script');
    s.src=urls[i];
    s.async=true;
    s.onload=function(){ console.log('tmi.js loaded from', urls[i]); };
    s.onerror=function(){ console.warn('tmi.js failed from', urls[i]); tryNext(i+1); };
    document.head.appendChild(s);
  }
  tryNext(0);
})([
  './tmi.min.js',
  './tmi.js',
  'https://unpkg.com/tmi.js@1.8.5/dist/tmi.min.js'
]);

// ---------------------------------------------------------------------------
// Cookie helpers — used for settings and consent (localStorage kept for large
// gameplay data: participants, history, excluded winners)
// ---------------------------------------------------------------------------
function mwSetCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = name + '=' + encodeURIComponent(typeof value === 'string' ? value : JSON.stringify(value)) + '; expires=' + expires + '; path=/; SameSite=Lax';
}
function mwGetCookie(name) {
  const match = document.cookie.split('; ').find(function(r){ return r.startsWith(name + '='); });
  if (!match) return null;
  const raw = decodeURIComponent(match.slice(name.length + 1));
  // Guard: if a previous bug stored "[object Object]", clear and return null
  if (raw === '[object Object]' || raw === 'undefined') { mwRemoveCookie(name); return null; }
  try { return JSON.parse(raw); } catch { return raw; }
}
function mwRemoveCookie(name) {
  document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax';
}

// App configuration
const APP_CONFIG = {
  // Requires Twitch Client ID + OAuth (moderator:read:followers scope)
  enableFollowerInfo: true,
  clientId: 'b84sr9z49lc7sz62bo23voxvj2x0bw',
  version: 'v1.1',
  // Explicit redirect URI — must match exactly what is registered in dev.twitch.tv.
  // Set to null to use window.location.origin + pathname automatically (local dev).
  redirectUri: 'https://www.bjsolutions.no/FortuneWheel5000',
  donate: {
    enabled: true,
    url: 'https://paypal.me/borgej',
    label: 'Donate'
  },
  // Set to false when you dont want to test anymore
  ui: {
    showAddTestParticipants: true
  },
  features: {
    confetti: true,
    sad: true,
    tick: false
  },
  defaults: {
    // Optional: set a default channel to prefill the input
    channelName: 'Your-Channel-Here',
    keywordPrefix: '!',
    keywordText: 'wheel',
    winnerTimerMinutes: 2,
    entryTimerMinutes: 0,
    // New: wheel behavior defaults
    spinDurationSeconds: 15,
    spinSmoothEasing: true
  }
};

// ---------------------------------------------------------------------------
// Wheel colour palettes — all chromakey-safe (no greens/teals).
// Sourced from colorkit.co/palettes/
// ---------------------------------------------------------------------------
const WHEEL_PALETTES = [
  // Reds
  { name: 'Blood Moon',     colors: ['#0d0000','#3d0000','#6b0000','#8b0000','#b22222','#cc2200','#e03000','#ff4500'] },
  { name: 'Volcano',        colors: ['#6a040f','#9d0208','#d00000','#dc2f02','#e85d04','#f48c06','#faa307','#ffba08'] },
  { name: 'Dark Carnival',  colors: ['#1a0533','#6b0f1a','#b91c1c','#d97706','#92400e','#7c3aed','#be185d','#dc2626'] },
  // Warm oranges / earth tones
  { name: 'Hot Summer',     colors: ['#ff4e00','#fe6d00','#ff9500','#ffb700','#ff0054','#ff5400','#ea3546','#ffd500'] },
  { name: 'Autumn Harvest', colors: ['#582f0e','#7f4f24','#936639','#d4a373','#e9c46a','#f4a261','#e76f51','#c1440e'] },
  { name: 'Candlelight',    colors: ['#1a0a00','#3d1c02','#7b3a0a','#b5621e','#d4872c','#f0a830','#f5c050','#fad878'] },
  { name: 'Vintage Sepia',  colors: ['#2c1503','#6b3f0a','#a0522d','#c68642','#d4a574','#e8c99a','#f0dfc0','#f5e6d3'] },
  { name: 'Gold Rush',      colors: ['#7b4400','#a05c00','#c97d00','#e8a400','#f5c400','#ffd700','#ffe766','#fff0a0'] },
  // Pinks / rose
  { name: 'Rose Gold',      colors: ['#590d22','#a4133c','#ff4d6d','#ff85a1','#ffc8dd','#ff8c00','#e65c00','#ffb347'] },
  { name: 'Bubblegum',      colors: ['#ff6b9d','#ff8fab','#ffb3c1','#ff4d6d','#c9184a','#f72585','#ff85a1','#ffccd5'] },
  { name: 'Cotton Candy',   colors: ['#ffb3c6','#ff85a1','#ffc8dd','#ffafcc','#d4a5ff','#bde0fe','#ffcfd2','#f4acb7'] },
  { name: 'Pastel Candy',   colors: ['#ffadad','#ffd6a5','#fdffb6','#fbe0e0','#bdb2ff','#ffc8dd','#ffafcc','#e5d4ef'] },
  // Vivid mixed / hot pink
  { name: 'Retro 80s',      colors: ['#ff0080','#ff4d9d','#ffd700','#ff6600','#cc0066','#9900cc','#6600ff','#ff99c8'] },
  { name: 'Lava Lamp',      colors: ['#ff595e','#ff924c','#ffca3a','#c77dff','#9b5de5','#f15bb5','#fee440','#fb5607'] },
  { name: 'Neon Arcade',    colors: ['#ff006e','#fb5607','#ffbe0b','#8338ec','#3a86ff','#ff4d6d','#c77dff','#ffd166'] },
  { name: 'Miami Vice',     colors: ['#ff6ec7','#ff42a1','#d4007a','#0084c8','#00b4d8','#48cae4','#ff87c3','#90e0ef'] },
  // Magentas / purples
  { name: 'Jewel Tones',    colors: ['#e40066','#9b1d6a','#6a1277','#3d1199','#1a237e','#b5179e','#c77dff','#f72585'] },
  { name: 'Infrared',       colors: ['#2d0037','#4a0050','#800080','#b300b3','#cc0000','#e60000','#ff3300','#ff6600'] },
  { name: 'Cyberpunk',      colors: ['#120458','#4c0070','#8b00ff','#b200ff','#ff00ff','#ff2975','#f6019d','#fdff00'] },
  { name: 'Royal Court',    colors: ['#1a0050','#2d006e','#4a007e','#6b0094','#ffd700','#ffbf00','#e6a800','#c49000'] },
  { name: 'Deep Space',     colors: ['#10002b','#240046','#3c096c','#5a189a','#7b2fbe','#9d4edd','#c77dff','#e0aaff'] },
  // Blues
  { name: 'Moody Sunset',   colors: ['#00202e','#2c4875','#8a508f','#bc5090','#ff6361','#ff8531','#ffa600','#ffd380'] },
  { name: 'Midnight Jazz',  colors: ['#1b1b2f','#162447','#1f4068','#1b262c','#e43f5a','#f5a623','#c94b4b','#4b1248'] },
  { name: 'Nordic Blue',    colors: ['#03045e','#023e8a','#0077b6','#1a56db','#4361ee','#4895ef','#90c2ff','#c8deff'] },
  { name: 'Arctic Frost',   colors: ['#e8f4ff','#c8e0f5','#a8cce9','#87aced','#6690d9','#4470c4','#2255a4','#0a3880'] },
  { name: 'Copper & Navy',  colors: ['#0b3954','#1a4f72','#2e86ab','#a23b72','#f18f01','#c73e1d','#3b1f2b','#e76f51'] },
  // Complementary / mixed
  { name: 'Ice & Fire',     colors: ['#c1121f','#e63946','#f4a261','#ffb703','#8ecae6','#219ebc','#a8dadc','#90e0ef'] },
  { name: 'Candy Stripe',   colors: ['#e63946','#f1a1a8','#457b9d','#a8dadc','#e76f51','#ffd166','#ef476f','#06d6a0'] },
  // Rainbow / greyscale
  { name: 'Twitch Glow',    colors: ['#ef4444','#f97316','#f59e0b','#fb923c','#fca5a5','#f472b6','#ec4899','#d946ef','#a855f7','#8b5cf6','#6366f1','#3b82f6','#60a5fa','#93c5fd'] },
  { name: 'Monochrome',     colors: ['#111111','#2d2d2d','#4a4a4a','#6b6b6b','#929292','#b8b8b8','#d4d4d4','#f0f0f0'] },
];

class SimpleCanvasWheel {
  constructor(container, { items = [], onSpin, onCurrentIndexChange, onRest } = {}) {
    this.container = container;
    this.items = items;
    this.onSpin = onSpin;
    this.onCurrentIndexChange = onCurrentIndexChange;
    this.onRest = onRest;
    this.rotation = 0; // radians; 0 means slice 0 starts at pointer (3 o'clock)
    this.anim = null;
    this._idleAnim = null;
    this._idleRunning = false;
    this._lastIndex = null;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.container.appendChild(this.canvas);
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(this.container);
    this.resize();
  }

  setItems(items) { this.items = items || []; this.draw(); }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(10, this.container.clientWidth);
    const h = Math.max(10, this.container.clientHeight);
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  get sliceAngle() { return this.items.length > 0 ? (Math.PI * 2) / this.items.length : Math.PI * 2; }

  currentIndex() {
    if (!this.items.length) return 0;
    const a = (2*Math.PI - (this.rotation % (2*Math.PI))) % (2*Math.PI);
    return Math.floor(a / this.sliceAngle) % this.items.length;
  }

  draw() {
    const { width, height } = this.canvas;
    const w = width / (window.devicePixelRatio || 1);
    const h = height / (window.devicePixelRatio || 1);
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);
    if (!this.items.length) return;
    const cx = w / 2, cy = h / 2;
    const r = Math.min(w, h) * 0.48;
    const slice = this.sliceAngle;
    const isGreen = document.body.classList.contains('greenscreen');

    // -- Rotated section: slices, labels, pins, rim --
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.rotation);

    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      const start = i * slice;
      const end = start + slice;
      const base = it.backgroundColor || '#999';

      // Radial gradient fill — bright centre, richer toward rim
      const grad = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
      grad.addColorStop(0, this._lightenColor(base, 55));
      grad.addColorStop(0.65, base);
      grad.addColorStop(1, this._darkenColor(base, 25));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, start, end, false);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Slice border
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label with soft shadow — font scales with slice arc width
      const mid = start + slice / 2;
      ctx.save();
      ctx.rotate(mid);
      // Available tangential space at the label radius
      const arcHeight = r * 0.85 * slice;
      const fontSize = Math.floor(Math.min(22, arcHeight * 0.6, r * 0.08));
      if (fontSize >= 7) {
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${fontSize}px Segoe UI, sans-serif`;
        ctx.fillStyle = it.labelColor || '#111827';
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 4;
        const outer = r * 0.94;
        const inner = r * 0.25;
        const pathLen = outer - inner;
        ctx.translate(outer, 0);
        const text = (it.label || '').toString();
        let clipped = text;
        while (clipped.length > 1 && ctx.measureText(clipped).width > pathLen) {
          clipped = clipped.slice(0, -1);
        }
        ctx.fillText(clipped, 0, 0);
      }
      ctx.restore();
    }

    // Rim pins at each slice boundary
    for (let i = 0; i < this.items.length; i++) {
      const angle = i * slice;
      const px = Math.cos(angle) * (r - 5);
      const py = Math.sin(angle) * (r - 5);
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(80,80,80,0.35)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // Outer border ring
    ctx.beginPath();
    ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
    ctx.strokeStyle = isGreen ? '#9ca3af' : 'rgba(56,189,248,0.6)';
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.restore(); // end rotation

    // -- Centre hub: simple semi-transparent circle --
    ctx.save();
    ctx.translate(cx, cy);
    const hubR = Math.max(16, r * 0.088);
    ctx.beginPath();
    ctx.arc(0, 0, hubR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    ctx.restore();
  }

  spinToIndex(targetIndex, durationMs = 5000, revolutions = 5, options = {}) {
    if (!this.items.length) return;
    this.stopIdle();
    if (typeof this.onSpin === 'function') { try { this.onSpin(); } catch {} }
    const slice = this.sliceAngle;
    const rand = Math.random();
    const offsetFactor = (options.randomOffsetFactor ?? 0.6);
    const maxOffset = (slice * 0.5) * Math.max(0, Math.min(1, offsetFactor));
    const signedOffset = (rand * 2 - 1) * maxOffset;
    const desired = (2*Math.PI - (targetIndex + 0.5) * slice - signedOffset) % (2*Math.PI);
    const startRot = this.rotation % (2*Math.PI);

    // Kickback: wind back slightly before launching for a snappier feel
    const kickAngle = Math.PI * 0.12;
    const kickMs = Math.min(320, durationMs * 0.08);
    const mainMs = durationMs - kickMs;
    const afterKickRot = startRot - kickAngle;
    let delta = (desired - afterKickRot);
    delta = (delta % (2*Math.PI) + 2*Math.PI) % (2*Math.PI);
    const endRot = afterKickRot + (Math.PI * 2) * revolutions + delta;

    const easeInOut = (t) => t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2;
    // easeOutCubic: spends ~3 seconds in the clearly-visible slow zone before
    // stopping — wheel passes individual slices one by one at the end.
    const easeSuspense = (t) => 1 - Math.pow(1 - t, 3);

    const t0 = performance.now();
    const step = (now) => {
      const elapsed = now - t0;

      if (elapsed < kickMs) {
        // Kickback phase
        const t = elapsed / kickMs;
        this.rotation = startRot - kickAngle * easeInOut(t);
        this.draw();
        this.anim = requestAnimationFrame(step);
        return;
      }

      // Main spin phase
      const dt = Math.min(1, (elapsed - kickMs) / mainMs);
      const eased = easeSuspense(dt);
      this.rotation = afterKickRot + (endRot - afterKickRot) * eased;
      this.draw();
      const idx = this.currentIndex();
      if (idx !== this._lastIndex) {
        this._lastIndex = idx;
        if (typeof this.onCurrentIndexChange === 'function') { try { this.onCurrentIndexChange({ currentIndex: idx }); } catch {} }
      }
      if (dt < 1) {
        this.anim = requestAnimationFrame(step);
      } else {
        this.rotation = this.rotation % (2*Math.PI);
        this.draw();
        const ci = this.currentIndex();
        if (typeof this.onRest === 'function') { try { this.onRest({ currentIndex: ci }); } catch {} }
      }
    };
    if (this.anim) cancelAnimationFrame(this.anim);
    this.anim = requestAnimationFrame(step);
  }

  destroy() {
    try { if (this.anim) cancelAnimationFrame(this.anim); } catch {}
    try { this.stopIdle(); } catch {}
    try { if (this._ro) this._ro.disconnect(); } catch {}
    try { this.canvas.remove(); } catch {}
  }

  _lightenColor(hex, amount) {
    const h = hex.replace('#', '');
    const r = Math.min(255, Math.max(0, parseInt(h.substring(0,2), 16) + amount));
    const g = Math.min(255, Math.max(0, parseInt(h.substring(2,4), 16) + amount));
    const b = Math.min(255, Math.max(0, parseInt(h.substring(4,6), 16) + amount));
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  }

  _darkenColor(hex, amount) { return this._lightenColor(hex, -amount); }

  startIdle() {
    if (this._idleRunning || !this.items.length) return;
    this._idleRunning = true;
    let last = null;
    const loop = (ts) => {
      if (!this._idleRunning) return;
      if (last !== null) {
        const dt = Math.min(0.1, (ts - last) / 1000);
        this.rotation = (this.rotation + 0.28 * dt) % (Math.PI * 2);
        this.draw();
      }
      last = ts;
      this._idleAnim = requestAnimationFrame(loop);
    };
    this._idleAnim = requestAnimationFrame(loop);
  }

  stopIdle() {
    this._idleRunning = false;
    if (this._idleAnim) { cancelAnimationFrame(this._idleAnim); this._idleAnim = null; }
  }
}

// Minimal Twitch IRC over WebSocket client as a fallback when tmi.js is unavailable
class TwitchWSChat {
  constructor(channel, { onMessage, onConnected, onDisconnected }) {
    this.channel = channel.startsWith('#') ? channel : `#${channel}`;
    this.onMessage = onMessage;
    this.onConnected = onConnected;
    this.onDisconnected = onDisconnected;
    this.ws = null;
    this.nick = `justinfan${Math.floor(Math.random()*1e8)}`; // anonymous
    this.heartbeat = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
        this.ws.addEventListener('open', () => {
          this._send('CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership');
          this._send('PASS SCHMOOPIIE'); // placeholder for anonymous
          this._send(`NICK ${this.nick}`);
          this._send(`JOIN ${this.channel}`);
          if (this.onConnected) this.onConnected();
          resolve();
          this._startHeartbeat();
        });
        this.ws.addEventListener('message', (ev) => this._handleRaw(ev.data));
        this.ws.addEventListener('close', () => { this._stopHeartbeat(); if (this.onDisconnected) this.onDisconnected(); });
        this.ws.addEventListener('error', (e) => { console.error('WS error', e); });
      } catch (e) {
        reject(e);
      }
    });
  }

  disconnect() { try { this._stopHeartbeat(); this.ws && this.ws.close(); } catch {} }
  _send(line) { try { this.ws && this.ws.send(`${line}\r\n`); } catch {} }

  _startHeartbeat() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = setInterval(() => { try { this._send('PING :tmi.twitch.tv'); } catch {} }, 4 * 60 * 1000);
  }
  _stopHeartbeat() { if (this.heartbeat) { clearInterval(this.heartbeat); this.heartbeat = null; } }

  _handleRaw(data) {
    const lines = data.split('\r\n').filter(Boolean);
    for (const line of lines) {
      if (line.startsWith('PING')) { this._send(line.replace('PING', 'PONG')); continue; }
      let rest = line;
      let tags = {};
      if (rest[0] === '@') {
        const space = rest.indexOf(' ');
        const rawTags = rest.slice(1, space).split(';');
        rawTags.forEach(kv => { const [k,v] = kv.split('='); tags[k] = v; });
        rest = rest.slice(space + 1);
      }
      let prefix = '';
      if (rest[0] === ':') {
        const space = rest.indexOf(' ');
        prefix = rest.slice(1, space);
        rest = rest.slice(space + 1);
      }
      const cmdEnd = rest.indexOf(' ');
      const command = cmdEnd === -1 ? rest : rest.slice(0, cmdEnd);
      rest = cmdEnd === -1 ? '' : rest.slice(cmdEnd + 1);
      if (command === 'PRIVMSG') {
        const idx = rest.indexOf(' :');
        const message = idx === -1 ? '' : rest.slice(idx + 2);
        let username = tags['display-name'] || '';
        if (!username && prefix) {
          const excl = prefix.indexOf('!');
          if (excl > 0) username = prefix.slice(0, excl);
        }
        if (this.onMessage) this.onMessage({ username: (username||'').toLowerCase(), 'display-name': username }, message);
      }
    }
  }
}

class TwitchGiveawayApp {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.participants = new Map();
    this.history = [];
    this.keyword = '!giveaway';
    this.keywordPrefix = '!';
    this.keywordText = 'giveaway';
    this.channelName = '';
    this.channelId = null;
    this.clientId = null;
    this.accessToken = null;
    this.keywordActive = false;
    this.giveawayActive = false;
    this.isSpinning = false;
    this.currentWinner = null;
    this.winnerTimerInterval = null;
    this.winnerStartTime = 0;
    this.winnerAcknowledged = false;
    this.winnerTimerMinutes = 2;
    this.entryTimerMinutes = 0;
    this.entryTimerInterval = null;
    this.enableConfetti = true;
    this.enableSad = true;
    this.enableTick = true;
    this.sadStopRequested = true;
    this.entryStartTime = 0;
    this.entryTotalSeconds = 0;
    this.excludedWinners = new Set();
    this.followersOnly = false;
    this.subscribersOnly = false;
    this.showKeyword = true;
  // Spin behavior
  this.spinDurationSeconds = APP_CONFIG?.defaults?.spinDurationSeconds ?? 5;
  this.spinSmoothEasing = APP_CONFIG?.defaults?.spinSmoothEasing ?? true;
    this.audioCtx = null;
    this._lastTickStep = null;
    this._debugTimeouts = [];
    this._confirmResolve = null;
    this.giveawaySessionId = null;
    this.currentHistoryIndex = null;
  // Randomize slice orientation per session
  this._layoutSessionMarker = null;
  this.layoutSliceOffset = 0;
  // Track if history was actually loaded to avoid overwriting with empty on first save
  this._historyLoaded = false;

    this.elements = {
      connectionPanel: document.getElementById('connectionPanel'),
      clientIdInput: null,
      channelInput: document.getElementById('channelName'),
      keywordPrefixInput: document.getElementById('keywordPrefix'),
      keywordInput: document.getElementById('keyword'),
      winnerTimerMinutesInput: document.getElementById('winnerTimerMinutes'),
      revokeAuthBtn: document.getElementById('revokeAuthBtn'),
      authBtn: document.getElementById('authBtn'),
      connectBtn: document.getElementById('connectBtn'),
      disconnectBtn: document.getElementById('disconnectBtn'),
      lockBtn: null,
      clearGiveawayBtn: document.getElementById('clearGiveawayBtn'),
      paletteBtn: document.getElementById('paletteBtn'),
      paletteModal: document.getElementById('paletteModal'),
      debugToggleBtn: document.getElementById('debugToggleBtn'),
      debugPanel: document.getElementById('debugPanel'),
      debugAddBtn: document.getElementById('debugAddBtn'),
      connectionStatus: document.getElementById('connectionStatus'),
      wheelElement: document.getElementById('wheelElement'),
      spinBtn: document.getElementById('spinBtn'),
  clearBtn: document.getElementById('clearBtn'),
  removeNonFollowersBtn: document.getElementById('removeNonFollowersBtn'),
      removeNonSubscribersBtn: document.getElementById('removeNonSubscribersBtn'),
  greenScreenBtn: document.getElementById('greenScreenBtn'),
      wheelSizeBtn: document.getElementById('wheelSizeBtn'),
      participantsList: document.getElementById('participantsList'),
      participantCount: document.getElementById('participantCount'),
      historyList: document.getElementById('historyList'),
      winnerModal: document.getElementById('winnerModal'),
      winnerAvatar: document.getElementById('winnerAvatar'),
      winnerName: document.getElementById('winnerName'),
      winnerMeta: document.getElementById('winnerMeta'),
      winnerTimer: document.getElementById('winnerTimer'),
      winnerChat: document.getElementById('winnerChat'),
      closeWinnerBtn: document.getElementById('closeWinnerBtn'),
      reSpinBtn: document.getElementById('reSpinBtn'),
      winnerProgress: document.getElementById('winnerProgress'),
      confettiToggle: document.getElementById('confettiToggle'),
      sadToggle: document.getElementById('sadToggle'),
      tickToggle: document.getElementById('tickToggle'),
      followersOnlyToggle: document.getElementById('followersOnlyToggle'),
      subscribersOnlyToggle: document.getElementById('subscribersOnlyToggle'),
      showKeywordToggle: document.getElementById('showKeywordToggle'),
      startGiveawayBtn: document.getElementById('startGiveawayBtn'),
      entryTimerMinutesInput: document.getElementById('entryTimerMinutes'),
  // spin controls removed from UI; config via APP_CONFIG
      entryInfo: document.getElementById('entryInfo'),
      entryOverlay: document.getElementById('entryOverlay'),
      hideSensitive: null,
      toastContainer: document.getElementById('toastContainer'),
      confirmModal: document.getElementById('confirmModal'),
      confirmTitle: document.getElementById('confirmTitle'),
      confirmMessage: document.getElementById('confirmMessage'),
      confirmYes: document.getElementById('confirmYes'),
      confirmNo: document.getElementById('confirmNo'),
  // spin controls removed from UI; config via APP_CONFIG
    };

    this.bindEvents();
    this.restoreFromStorage();
    this.applyUrlParams();
    this.checkForToken();
    this.updateConnectionPanelForAuth();
    const vEl = document.getElementById('appVersion');
    if (vEl && APP_CONFIG.version) vEl.textContent = APP_CONFIG.version;

    if (!APP_CONFIG.enableFollowerInfo && this.elements && this.elements.authBtn) {
      this.elements.authBtn.style.display = 'none';
      this.setStatus('Connect to chat (follower info disabled)', false);
    }

    try {
      const row = document.getElementById('donateRow');
      const link = document.getElementById('donateLink');
      const label = document.getElementById('donateLabel');
      if (row && link && label) {
        if (!APP_CONFIG.donate || APP_CONFIG.donate.enabled === false) {
          row.style.display = 'none';
        } else {
          if (APP_CONFIG.donate.url) link.href = APP_CONFIG.donate.url;
          if (APP_CONFIG.donate.label) label.textContent = APP_CONFIG.donate.label;
          // Allow user to hide the donate box manually and remember preference
          const closeBtn = document.getElementById('donateClose');
          const hiddenPref = mwGetCookie('mw.donateHidden') === '1' || localStorage.getItem('mw.donateHidden') === '1';
          if (hiddenPref) { row.style.display = 'none'; }
          if (closeBtn) {
            closeBtn.addEventListener('click', () => {
              row.style.display = 'none';
              mwSetCookie('mw.donateHidden', '1', 365);
              try { localStorage.removeItem('mw.donateHidden'); } catch {}
            });
          }
        }
      }
      const addBtn = document.getElementById('debugAddBtn');
    } catch {}
    const ch = document.getElementById('clearHistoryBtn');
    if (ch) ch.addEventListener('click', async () => {
      const ok = await this.showConfirm('Clear all giveaway history?', 'Please confirm');
      if (!ok) return;
      this.history = [];
      this.currentHistoryIndex = null;
      this.giveawaySessionId = null;
      this.saveToStorage();
      this.renderHistory();
    });

    this.render();
  }

  bindEvents() {
    // Sidebar tab switching
    document.querySelectorAll('.sidebar-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.sidebar-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.sidebar-panel').forEach(p => p.style.display = 'none');
        btn.classList.add('active');
        const panel = document.getElementById('tab' + btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1));
        if (panel) panel.style.display = '';
      });
    });
    // Keep channel synced with state + storage
    if (this.elements.channelInput) {
      this.elements.channelInput.addEventListener('input', (e) => {
        this.channelName = (e.target.value || '').trim().toLowerCase();
        this.saveToStorage();
      });
    }
    this.elements.authBtn.addEventListener('click', () => this.authorizeWithTwitch());
    if (this.elements.revokeAuthBtn) this.elements.revokeAuthBtn.addEventListener('click', () => this.revokeAuth());
    this.elements.connectBtn.addEventListener('click', () => this.connectToChat());
    this.elements.disconnectBtn.addEventListener('click', () => this.disconnectFromChat());
    this.elements.connectionStatus.classList.add('clickable');
    this.elements.connectionStatus.addEventListener('click', () => { this.toggleConnectionPanel(); });
    if (this.elements.debugToggleBtn) {
      this.elements.debugToggleBtn.addEventListener('click', () => {
        const panel = this.elements.debugPanel;
        const open = !panel.hidden;
        panel.hidden = open;
        this.elements.debugToggleBtn.textContent = open ? 'Debug ▾' : 'Debug ▴';
      });
    }
    this.elements.debugAddBtn.addEventListener('click', () => this.addDebugParticipants());
    this.elements.spinBtn.addEventListener('click', () => this.spinWheel());
  if (this.elements.clearBtn) this.elements.clearBtn.addEventListener('click', () => this.clearParticipants());
  if (this.elements.clearGiveawayBtn) this.elements.clearGiveawayBtn.addEventListener('click', () => this.clearParticipants());
  if (this.elements.paletteBtn) this.elements.paletteBtn.addEventListener('click', () => this.openPaletteModal());
  if (this.elements.paletteModal) this.elements.paletteModal.addEventListener('click', (e) => { if (e.target === this.elements.paletteModal) this.closePaletteModal(); });
  const closePaletteBtn = document.getElementById('closePaletteBtn');
  if (closePaletteBtn) closePaletteBtn.addEventListener('click', () => this.closePaletteModal());
  if (this.elements.removeNonFollowersBtn) this.elements.removeNonFollowersBtn.addEventListener('click', () => this.removeNonFollowers());
  if (this.elements.removeNonSubscribersBtn) this.elements.removeNonSubscribersBtn.addEventListener('click', () => this.removeNonSubscribers());
  if (this.elements.greenScreenBtn) this.elements.greenScreenBtn.addEventListener('click', () => this.toggleGreenScreen());
    if (this.elements.wheelSizeBtn) this.elements.wheelSizeBtn.addEventListener('click', () => this.toggleWheelSize());
    this.elements.closeWinnerBtn.addEventListener('click', () => this.closeWinnerModal());
    this.elements.reSpinBtn.addEventListener('click', () => this.reSpinExcludeCurrentWinner());
    this.elements.winnerModal.addEventListener('click', (e) => { /* backdrop click disabled — use buttons to close */ });
    if (this.elements.confirmYes) this.elements.confirmYes.addEventListener('click', ()=> this._resolveConfirm(true));
    if (this.elements.confirmNo) this.elements.confirmNo.addEventListener('click', ()=> this._resolveConfirm(false));
    if (this.elements.confirmModal) this.elements.confirmModal.addEventListener('click', (e)=>{ if (e.target === this.elements.confirmModal) this._resolveConfirm(false); });
    this.elements.startGiveawayBtn.addEventListener('click', () => this.toggleGiveaway());
    this.elements.confettiToggle.addEventListener('change', () => {
      this.enableConfetti = !!this.elements.confettiToggle.checked;
      this.saveToStorage();
    });
    this.elements.sadToggle.addEventListener('change', () => {
      this.enableSad = !!this.elements.sadToggle.checked;
      this.saveToStorage();
    });
    this.elements.tickToggle.addEventListener('change', () => {
      this.enableTick = !!this.elements.tickToggle.checked;
      this.saveToStorage();
    });
    if (this.elements.followersOnlyToggle) {
      this.elements.followersOnlyToggle.addEventListener('change', () => {
        this.followersOnly = !!this.elements.followersOnlyToggle.checked;
        if (this.followersOnly && !this.accessToken) {
          this.showToast('Authorize with Twitch first — without authorization nobody can be verified as a follower and entries will be blocked.', 'warn');
        }
        this.saveToStorage();
      });
    }
    if (this.elements.subscribersOnlyToggle) {
      this.elements.subscribersOnlyToggle.addEventListener('change', () => {
        this.subscribersOnly = !!this.elements.subscribersOnlyToggle.checked;
        if (this.subscribersOnly && !this.accessToken) {
          this.showToast('Authorize with Twitch first — without authorization nobody can be verified as a subscriber and entries will be blocked.', 'warn');
        }
        this.saveToStorage();
      });
    }
    if (this.elements.showKeywordToggle) {
      this.elements.showKeywordToggle.addEventListener('change', () => {
        this.showKeyword = !!this.elements.showKeywordToggle.checked;
        this.saveToStorage();
        this.updateEntryInfo();
      });
    }

    this.elements.keywordPrefixInput.addEventListener('input', (e) => {
      this.keywordPrefix = (e.target.value || '').trim();
      this.updateCombinedKeyword();
    });
    this.elements.keywordInput.addEventListener('input', (e) => {
      this.keywordText = (e.target.value || '').trim();
      this.updateCombinedKeyword();
    });
    this.elements.winnerTimerMinutesInput.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      if (!isNaN(v) && v >= 0) {
        this.winnerTimerMinutes = v;
        this.saveToStorage();
      }
    });
    this.elements.entryTimerMinutesInput.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      if (!isNaN(v) && v >= 0) {
        this.entryTimerMinutes = v;
        this.saveToStorage();
      }
    });
  // spin controls are not exposed in UI
  }

  restoreFromStorage() {
    try {
      // Settings
      const rawOrObj = mwGetCookie('mw.settings') || localStorage.getItem('mw.settings');
      // Migrate from localStorage if present, then clean up
      if (localStorage.getItem('mw.settings')) { try { localStorage.removeItem('mw.settings'); } catch {} }
      if (rawOrObj) {
        const s = typeof rawOrObj === 'string' ? JSON.parse(rawOrObj) : rawOrObj;
        if (s && typeof s === 'object') {
          // clientId is baked into APP_CONFIG — always use that
          this.clientId = APP_CONFIG.clientId || '';
          if (this.elements.channelInput && typeof s.channelName === 'string') {
            this.elements.channelInput.value = s.channelName;
            this.channelName = (s.channelName || '').trim().toLowerCase();
          } else if (this.elements.channelInput && APP_CONFIG?.defaults?.channelName) {
            // Seed default channel if none stored; URL params can override later
            this.elements.channelInput.value = APP_CONFIG.defaults.channelName;
            this.channelName = (APP_CONFIG.defaults.channelName || '').trim().toLowerCase();
          }
          if (this.elements.keywordPrefixInput && typeof s.keywordPrefix === 'string') this.elements.keywordPrefixInput.value = s.keywordPrefix;
          if (this.elements.keywordInput && typeof s.keywordText === 'string') this.elements.keywordInput.value = s.keywordText;
          if (typeof s.keywordPrefix === 'string' || typeof s.keywordText === 'string') {
            this.keywordPrefix = (this.elements.keywordPrefixInput?.value || '').trim();
            this.keywordText = (this.elements.keywordInput?.value || '').trim();
            this.keyword = ((this.keywordPrefix || '') + (this.keywordText || '')).trim();
          }
          if (typeof s.winnerTimerMinutes === 'number') {
            this.winnerTimerMinutes = Math.max(0, s.winnerTimerMinutes|0);
            if (this.elements.winnerTimerMinutesInput) this.elements.winnerTimerMinutesInput.value = String(this.winnerTimerMinutes);
          }
          if (typeof s.entryTimerMinutes === 'number') {
            this.entryTimerMinutes = Math.max(0, s.entryTimerMinutes|0);
            if (this.elements.entryTimerMinutesInput) this.elements.entryTimerMinutesInput.value = String(this.entryTimerMinutes);
          }
          if (typeof s.spinDurationSeconds === 'number' && s.spinDurationSeconds > 0) this.spinDurationSeconds = s.spinDurationSeconds;
          if (typeof s.spinSmoothEasing === 'boolean') this.spinSmoothEasing = s.spinSmoothEasing;
          if (typeof s.enableConfetti === 'boolean') { this.enableConfetti = s.enableConfetti; if (this.elements.confettiToggle) this.elements.confettiToggle.checked = s.enableConfetti; }
          if (typeof s.enableSad === 'boolean') { this.enableSad = s.enableSad; if (this.elements.sadToggle) this.elements.sadToggle.checked = s.enableSad; }
          if (typeof s.enableTick === 'boolean') { this.enableTick = s.enableTick; if (this.elements.tickToggle) this.elements.tickToggle.checked = s.enableTick; }
          if (typeof s.followersOnly === 'boolean') { this.followersOnly = s.followersOnly; if (this.elements.followersOnlyToggle) this.elements.followersOnlyToggle.checked = s.followersOnly; }
          if (typeof s.subscribersOnly === 'boolean') { this.subscribersOnly = s.subscribersOnly; if (this.elements.subscribersOnlyToggle) this.elements.subscribersOnlyToggle.checked = s.subscribersOnly; }
          if (typeof s.showKeyword === 'boolean') { this.showKeyword = s.showKeyword; if (this.elements.showKeywordToggle) this.elements.showKeywordToggle.checked = s.showKeyword; }
          if (typeof s.wheelPaletteIndex === 'number' && s.wheelPaletteIndex >= 0 && s.wheelPaletteIndex < WHEEL_PALETTES.length) { this.wheelPaletteIndex = s.wheelPaletteIndex; }
          if (typeof s.greenScreen === 'boolean') {
            document.body.classList.toggle('greenscreen', !!s.greenScreen);
          }
        }
      } else {
        // No stored settings — seed keyword defaults if provided
        if (APP_CONFIG?.defaults) {
          const d = APP_CONFIG.defaults;
          if (this.elements.keywordPrefixInput && d.keywordPrefix) this.elements.keywordPrefixInput.value = d.keywordPrefix;
          if (this.elements.keywordInput && d.keywordText) this.elements.keywordInput.value = d.keywordText;
          this.keywordPrefix = (this.elements.keywordPrefixInput?.value || '').trim();
          this.keywordText = (this.elements.keywordInput?.value || '').trim();
          this.keyword = ((this.keywordPrefix || '') + (this.keywordText || '')).trim();
          this.clientId = APP_CONFIG.clientId || '';
          if (this.elements.channelInput && d.channelName) {
            this.elements.channelInput.value = d.channelName;
            this.channelName = (d.channelName || '').trim().toLowerCase();
          }
          if (typeof d.spinDurationSeconds === 'number' && d.spinDurationSeconds > 0) this.spinDurationSeconds = d.spinDurationSeconds;
          if (typeof d.spinSmoothEasing === 'boolean') this.spinSmoothEasing = d.spinSmoothEasing;
        }
      }

      // Participants
      const pRaw = localStorage.getItem('mw.participants');
      if (pRaw) {
        const arr = JSON.parse(pRaw);
        if (Array.isArray(arr)) {
          this.participants = new Map(arr.map(([name, val]) => [name, val]));
        }
      }

      // Excluded winners
      const ewRaw = localStorage.getItem('mw.excluded');
      if (ewRaw) {
        const arr = JSON.parse(ewRaw);
        if (Array.isArray(arr)) this.excludedWinners = new Set(arr);
      }

      // History
      const hRaw = localStorage.getItem('mw.history');
      if (hRaw != null) {
        try {
          const arr = JSON.parse(hRaw);
          if (Array.isArray(arr)) { this.history = arr; this._historyLoaded = true; }
        } catch {}
      }
    } catch (e) {
      console.warn('restoreFromStorage failed', e);
    }
  }

  saveToStorage() {
    try {
      const settings = {
        clientId: APP_CONFIG.clientId || '',
        channelName: (this.elements.channelInput?.value || '').trim().toLowerCase(),
        keywordPrefix: (this.elements.keywordPrefixInput?.value || '').trim(),
        keywordText: (this.elements.keywordInput?.value || '').trim(),
        winnerTimerMinutes: this.winnerTimerMinutes|0,
        entryTimerMinutes: this.entryTimerMinutes|0,
  spinDurationSeconds: this.spinDurationSeconds,
  spinSmoothEasing: !!this.spinSmoothEasing,
        enableConfetti: !!this.enableConfetti,
        enableSad: !!this.enableSad,
        enableTick: !!this.enableTick,
        greenScreen: document.body.classList.contains('greenscreen'),
        followersOnly: !!this.followersOnly,
        subscribersOnly: !!this.subscribersOnly,
        showKeyword: !!this.showKeyword,
        wheelPaletteIndex: this.wheelPaletteIndex || 0,
      };
      mwSetCookie('mw.settings', settings, 365);

      // Participants as entries [name, {followData, ts}]
      try { localStorage.setItem('mw.participants', JSON.stringify(Array.from(this.participants.entries()))); } catch {}
      // Excluded winners set
      try { localStorage.setItem('mw.excluded', JSON.stringify(Array.from(this.excludedWinners || []))); } catch {}
      // History: only write if we loaded it successfully or we have non-empty in-memory history
      try {
        if (this._historyLoaded || (Array.isArray(this.history) && this.history.length > 0)) {
          localStorage.setItem('mw.history', JSON.stringify(this.history || []));
        }
      } catch {}
    } catch (e) {
      console.warn('saveToStorage failed', e);
    }
  }

  toggleGreenScreen() {
    const isOn = document.body.classList.toggle('greenscreen');
    this.saveToStorage();
    // Resize wheel canvas to fit new layout
    try { if (this.wheel && this.wheel.resize) this.wheel.resize(); } catch {}
  }

  toggleWheelSize() {
    const isLarge = document.body.classList.toggle('wheel-large');
    if (this.elements.wheelSizeBtn) {
      this.elements.wheelSizeBtn.title = isLarge ? 'Smaller wheel' : 'Bigger wheel';
      this.elements.wheelSizeBtn.textContent = isLarge ? '⤡' : '⤢';
    }
    localStorage.setItem('mw.wheelLarge', isLarge ? '1' : '0');
    mwSetCookie('mw.wheelLarge', isLarge ? '1' : '0', 365);
    // Give browser a frame to apply CSS before resizing canvas
    requestAnimationFrame(() => {
      try { if (this.wheel && this.wheel.resize) this.wheel.resize(); } catch {}
    });
  }

  updateConnectionPanelForAuth() {
    const authed = !!this.accessToken;
    // Hide channel input + Auth button when already authorized
    const channelGroup = document.getElementById('channelInputGroup');
    if (channelGroup) channelGroup.style.display = authed ? 'none' : '';
    if (this.elements.authBtn) this.elements.authBtn.style.display = authed ? 'none' : '';
    if (this.elements.revokeAuthBtn) this.elements.revokeAuthBtn.style.display = authed ? '' : 'none';
    // Disable follower/subscriber toggles and dim them when not authorized
    const followerToggleEl = this.elements.followersOnlyToggle;
    const subscriberToggleEl = this.elements.subscribersOnlyToggle;
    const removeNonFollowersBtn = this.elements.removeNonFollowersBtn;
    const removeNonSubscribersBtn = this.elements.removeNonSubscribersBtn;
    if (followerToggleEl) { followerToggleEl.disabled = !authed; followerToggleEl.closest('label').style.opacity = authed ? '' : '0.35'; followerToggleEl.closest('label').title = authed ? '' : 'Requires Twitch authorization'; }
    if (subscriberToggleEl) { subscriberToggleEl.disabled = !authed; subscriberToggleEl.closest('label').style.opacity = authed ? '' : '0.35'; subscriberToggleEl.closest('label').title = authed ? '' : 'Requires Twitch authorization'; }
    if (removeNonFollowersBtn) removeNonFollowersBtn.style.display = authed ? '' : 'none';
    if (removeNonSubscribersBtn) removeNonSubscribersBtn.style.display = authed ? '' : 'none';
  }

  revokeAuth() {
    this.accessToken = null;
    sessionStorage.removeItem('mw.accessToken');
    this.disconnectFromChat();
    const channelGroup = document.getElementById('channelInputGroup');
    if (channelGroup) channelGroup.style.display = '';
    if (this.elements.authBtn) this.elements.authBtn.style.display = '';
    if (this.elements.revokeAuthBtn) this.elements.revokeAuthBtn.style.display = 'none';
    this.setStatus('Signed out. Authorize again to reconnect.', false);
    this.expandConnectionPanel();
    this.updateConnectionPanelForAuth();
  }

  async fetchAuthorizedUser() {
    if (!this.accessToken || !this.clientId) return;
    try {
      const resp = await fetch('https://api.twitch.tv/helix/users', {
        headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Client-Id': this.clientId }
      });
      const data = await resp.json();
      const user = data?.data?.[0];
      if (!user) return;
      // Only auto-fill if the channel field is still empty or has the config default
      const currentVal = (this.elements.channelInput?.value || '').trim().toLowerCase();
      const configDefault = (APP_CONFIG?.defaults?.channelName || '').toLowerCase();
      if (!currentVal || currentVal === configDefault) {
        const login = (user.login || '').toLowerCase();
        if (this.elements.channelInput) this.elements.channelInput.value = login;
        this.channelName = login;
        this.saveToStorage();
        this.setStatus(`Authorized as ${user.display_name || login} — connecting...`, true);
      }
      // Auto-connect to chat after authorization
      if (!this.isConnected) {
        setTimeout(() => this.connectToChat(), 100);
      }
    } catch (e) {
      console.warn('fetchAuthorizedUser failed', e);
    }
  }

  checkForToken() {
    if (!APP_CONFIG.enableFollowerInfo) {
      this.setStatus('Follower info disabled. You can still connect to chat.', false);
      return;
    }
    try {
      // Check for OAuth error returned as query param (e.g. redirect_mismatch)
      const qp = new URLSearchParams(window.location.search);
      const oauthError = qp.get('error');
      const oauthDesc = qp.get('error_description');
      if (oauthError) {
        history.replaceState(null, document.title, window.location.pathname);
        const msg = oauthDesc ? oauthDesc.replace(/\+/g, ' ') : oauthError;
        this.setStatus(`Twitch auth error: ${msg}`, false);
        this.showToast(`Twitch auth error: ${msg}`, 'error');
        return;
      }
      const hash = (window.location.hash || '').replace(/^#/, '');
      if (hash) {
        const params = new URLSearchParams(hash);
        const tok = params.get('access_token');
        if (tok) {
          this.accessToken = tok;
          sessionStorage.setItem('mw.accessToken', tok);
          history.replaceState(null, document.title, window.location.pathname + window.location.search);
          this.setStatus('Authorized with Twitch • follower info enabled', true);
          this.updateConnectionPanelForAuth();
          this.fetchAuthorizedUser();
          return;
        }
      }
      const saved = sessionStorage.getItem('mw.accessToken');
      if (saved) {
        this.accessToken = saved;
        this.setStatus('Authorized with Twitch • follower info enabled', true);
        this.updateConnectionPanelForAuth();
        this.fetchAuthorizedUser();
        return;
      }
    } catch {}
    this.setStatus('Optional: Authorize to enable follower info. You can still connect to chat.', false);
  }

  authorizeWithTwitch() {
    if (!APP_CONFIG.enableFollowerInfo) { this.showToast('Follower authorization is disabled in config.', 'warn'); return; }
    const clientId = APP_CONFIG.clientId || '';
    if (!clientId) { this.showToast('No Twitch Client ID configured in APP_CONFIG.', 'warn'); return; }
    const redirectUri = APP_CONFIG.redirectUri || (window.location.origin + window.location.pathname).replace(/\/index\.html$/i, '');
    const scopes = ['moderator:read:followers', 'channel:read:subscriptions'];
    const state = Math.random().toString(36).slice(2);
    const authUrl = new URL('https://id.twitch.tv/oauth2/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'token');
    authUrl.searchParams.set('scope', scopes.join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('force_verify', 'true');
    window.location.href = authUrl.toString();
  }

  applyUrlParams() {
    const params = new URLSearchParams(window.location.search);
    if (!params) return;
    const pChannel = params.get('channel');
    const pKeyword = params.get('keyword');
    const pAuto = params.get('autoconnect');
    if (pChannel) {
      this.elements.channelInput.value = pChannel;
      this.channelName = (pChannel || '').trim().toLowerCase();
    } else if (APP_CONFIG?.defaults?.channelName) {
      // Apply configured default channel when no URL override is provided
      this.elements.channelInput.value = APP_CONFIG.defaults.channelName;
      this.channelName = (APP_CONFIG.defaults.channelName || '').trim().toLowerCase();
    }
    if (pKeyword) {
      if (pKeyword.startsWith('!')) {
        this.elements.keywordPrefixInput.value = '!';
        this.elements.keywordInput.value = pKeyword.slice(1);
      } else {
        this.elements.keywordPrefixInput.value = '!';
        this.elements.keywordInput.value = pKeyword;
      }
      this.keywordPrefix = this.elements.keywordPrefixInput.value.trim();
      this.keywordText = this.elements.keywordInput.value.trim();
      this.updateCombinedKeyword();
    } else if (APP_CONFIG.defaults) {
      this.elements.keywordPrefixInput.value = APP_CONFIG.defaults.keywordPrefix ?? this.elements.keywordPrefixInput.value;
      this.elements.keywordInput.value = APP_CONFIG.defaults.keywordText ?? this.elements.keywordInput.value;
      this.keywordPrefix = (this.elements.keywordPrefixInput.value || '').trim();
      this.keywordText = (this.elements.keywordInput.value || '').trim();
      this.updateCombinedKeyword();
    }
    this.saveToStorage();
    if (pAuto && (/^1|true$/i).test(pAuto)) {
      setTimeout(() => this.connectToChat(), 0);
    }
    if (APP_CONFIG.enableFollowerInfo) {
      this.setStatus('Optional: Authorize to enable follower info. You can still connect to chat.', false);
    } else {
      this.setStatus('Follower info disabled. You can still connect to chat.', false);
    }
  }

  recordWinner(winner, eligibleNames) {
    try {
      const w = (winner || '').toLowerCase();
      if (!w) return;
      const now = Date.now();
      const keyword = ((this.keywordPrefix || '') + (this.keywordText || '')).trim();
      // If there is an active history entry, append; else create
      if (this.currentHistoryIndex != null && this.history[this.currentHistoryIndex]) {
        const entry = this.history[this.currentHistoryIndex];
        if (!Array.isArray(entry.winners)) entry.winners = [];
        if (!entry.winners.includes(winner)) entry.winners.push(winner);
        entry.updatedAt = now;
        if (!entry.keyword) entry.keyword = keyword;
      } else {
        const entry = {
          id: this.giveawaySessionId || ('g-' + now),
          keyword,
          winners: [winner],
          startedAt: this.entryStartTime || now,
          updatedAt: now,
          // Optionally capture eligible names snapshot
          eligibleCount: Array.isArray(eligibleNames) ? eligibleNames.length : this.participants.size,
        };
        this.history.push(entry);
        this.currentHistoryIndex = this.history.length - 1;
      }
      this.saveToStorage();
      this.renderHistory();
      // Switch to History tab so the new entry is visible
      this._activateSidebarTab('history');
    } catch (e) {
      console.warn('recordWinner failed', e);
    }
  }

  _activateSidebarTab(tabName) {
    try {
      document.querySelectorAll('.sidebar-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.sidebar-panel').forEach(p => p.style.display = 'none');
      const btn = document.querySelector(`.sidebar-tab[data-tab="${tabName}"]`);
      const panel = document.getElementById('tab' + tabName.charAt(0).toUpperCase() + tabName.slice(1));
      if (btn) btn.classList.add('active');
      if (panel) panel.style.display = '';
    } catch {}
  }

  async connectToChat() {
    this.channelName = this.elements.channelInput.value.trim().toLowerCase();
    if (!this.channelName) { this.showToast('Please enter a channel name'); return; }
    this.collapseConnectionPanel();

    try {
      await this.fetchChannelId();

      if (typeof window.tmi !== 'undefined') {
        this.client = new window.tmi.Client({ connection: { reconnect: true }, channels: [this.channelName] });
        this.client.on('message', (_ch, tags, message) => this.handleChatMessage(tags, message));
        this.client.on('connected', () => {
          this.isConnected = true;
          this.updateConnectionButtons();
          this.setStatus(`Connected to #${this.channelName}`, true);
          this.renderWheel();
          this.autoCollapseConnectionPanel();
        });
        this.client.on('disconnected', () => { this.isConnected = false; this.updateConnectionButtons(); this.setStatus('Disconnected from chat', false); });
        await this.client.connect();
      } else {
        this.client = new TwitchWSChat(this.channelName, {
          onMessage: (tags, message) => this.handleChatMessage(tags, message),
          onConnected: () => {
            this.isConnected = true;
            this.updateConnectionButtons();
            this.setStatus(`Connected to #${this.channelName}`, true);
            this.renderWheel();
            this.autoCollapseConnectionPanel();
          },
          onDisconnected: () => { this.isConnected = false; this.updateConnectionButtons(); this.setStatus('Disconnected from chat', false); },
        });
        await this.client.connect();
      }
    } catch (err) {
      console.error(err);
      this.showToast('Failed to connect. Check channel name.', 'error');
      this.expandConnectionPanel();
    }
  }

  async fetchChannelId() {
    // Ensure clientId is in sync from input if not set yet
    if (!this.clientId && this.elements.clientIdInput) {
      this.clientId = (this.elements.clientIdInput.value || '').trim();
    }
    if (!APP_CONFIG.enableFollowerInfo || !this.accessToken || !this.clientId) { this.channelId = null; return; }
    try {
      const resp = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(this.channelName)}`, {
        headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Client-Id': this.clientId }
      });
      const data = await resp.json();
      this.channelId = data?.data?.[0]?.id || null;
    } catch (e) {
      console.warn('Failed to get channelId; follower info may be limited');
      this.channelId = null;
    }
  }

  disconnectFromChat() {
    if (this.client) { try { this.client.disconnect(); } catch (e) {} this.client = null; }
    this.isConnected = false;
    this.updateConnectionButtons();
    this.setStatus('Disconnected from chat', false);
    this.expandConnectionPanel();
  }

  updateConnectionButtons() {
    this.elements.connectBtn.style.display = this.isConnected ? 'none' : 'inline-block';
    this.elements.disconnectBtn.style.display = this.isConnected ? 'inline-block' : 'none';
  }
  collapseConnectionPanel() {
    if (!this.elements.connectionPanel) return;
    this.elements.connectionPanel.style.display = 'none';
    localStorage.setItem('mw.connCollapsed', '1');
    mwSetCookie('mw.connCollapsed', '1', 365);
    requestAnimationFrame(() => this.updateHistoryListHeight());
  }

  expandConnectionPanel() {
    if (!this.elements.connectionPanel) return;
    this.elements.connectionPanel.style.display = '';
    localStorage.setItem('mw.connCollapsed', '0');
    mwSetCookie('mw.connCollapsed', '0', 365);
    requestAnimationFrame(() => this.updateHistoryListHeight());
  }

  toggleConnectionPanel() {
    if (!this.elements.connectionPanel) return;
    const isHidden = this.elements.connectionPanel.style.display === 'none';
    if (isHidden) this.expandConnectionPanel(); else this.collapseConnectionPanel();
    requestAnimationFrame(() => this.updateHistoryListHeight());
  }

  autoCollapseConnectionPanel() {
    const pref = mwGetCookie('mw.connCollapsed') ?? localStorage.getItem('mw.connCollapsed');
    if (pref === '0') return;
    this.collapseConnectionPanel();
    requestAnimationFrame(() => this.updateHistoryListHeight());
  }

  setStatus(text, connected) {
    this.elements.connectionStatus.textContent = text;
    this.elements.connectionStatus.className = `status clickable ${connected ? 'connected' : 'disconnected'}`;
  }

  toggleEntries() { this.keywordActive = !this.keywordActive; this.updateEntryInfo(); }
  async toggleGiveaway() {
    if (this.giveawayActive) { this.stopEntries(); return; }
    if (this.participants.size > 0) {
      const clear = await this.showConfirm('Clear the current participants list before starting?', 'Start new giveaway');
      if (clear) { this.participants = new Map(); this.saveToStorage(); this.renderParticipants(); }
    }
    this.startGiveaway();
  }

  startGiveaway() {
    this.giveawayActive = true;
    this.excludedWinners = new Set();
    this.keywordActive = true;
    this.entryStartTime = Date.now();
    this.entryTotalSeconds = Math.max(0, Math.floor((this.entryTimerMinutes||0) * 60));
    this.updateEntryInfo();
    if (this.entryTimerInterval) clearInterval(this.entryTimerInterval);
    if (this.entryTotalSeconds > 0) { this.entryTimerInterval = setInterval(()=>this.updateEntryInfo(), 1000); }
  this.giveawaySessionId = 'g-' + Date.now();
  // reset layout offset for new session; will be randomized on first render
  this._layoutSessionMarker = null; this.layoutSliceOffset = 0;
    this.currentHistoryIndex = null;
    this.elements.startGiveawayBtn.textContent = 'Stop Giveaway';
    this.elements.startGiveawayBtn.classList.remove('btn-primary');
    this.elements.startGiveawayBtn.classList.add('btn-danger');
    this.renderWheel();
    this._activateSidebarTab('participants');
  }

  stopEntries() {
    this.giveawayActive = false;
    this.keywordActive = false;
    if (this.entryTimerInterval) clearInterval(this.entryTimerInterval);
    this.entryTimerInterval = null;
    this.updateEntryInfo(true);
    this.renderWheel();
    if (this.currentHistoryIndex != null && this.history[this.currentHistoryIndex]) {
      this.history[this.currentHistoryIndex].endedAt = Date.now();
      this.saveToStorage();
      this.renderHistory();
    }
    this.elements.startGiveawayBtn.textContent = 'Start Giveaway';
    this.elements.startGiveawayBtn.classList.remove('btn-danger');
    this.elements.startGiveawayBtn.classList.add('btn-primary');
    if (this._debugTimeouts && this._debugTimeouts.length) { for (const id of this._debugTimeouts) { try { clearTimeout(id); } catch {} } this._debugTimeouts = []; }
  }

  addDebugParticipants() {
    if (!this.keywordActive) { this.showToast('Entries are closed. Start the giveaway first.'); return; }
    const count = 10 + Math.floor(Math.random()*91);
    let remainMs = 0;
    if (this.entryTotalSeconds && this.entryTotalSeconds > 0) {
      const elapsed = Math.max(0, Math.floor((Date.now()-this.entryStartTime)/1000));
      const remaining = Math.max(0, (this.entryTotalSeconds - elapsed));
      remainMs = Math.max(500, remaining * 1000);
    } else {
      remainMs = 5000;
    }
    const immediate = Math.min(3, count);
    for (let j=0; j<immediate; j++) this._addOneTestParticipant();
    for (let i=immediate; i<count; i++) {
      const delay = Math.random() * remainMs;
      const id = setTimeout(()=>{
        if (!this.keywordActive) return;
        this._addOneTestParticipant();
      }, delay);
      this._debugTimeouts.push(id);
    }
    this.showToast(`Adding ${count} test participant(s)`, 'info');
  }

  _randomTwitchName() {
    const adj = ['dark','frost','shadow','neon','swift','iron','wild','night','storm','blazing','silent','royal','hyper','void','lucky','epic','crispy','golden','mighty','tiny'];
    const noun = ['wolf','fox','hawk','bear','panda','ninja','dragon','knight','sniper','wizard','goblin','raven','cobra','tiger','monk','ghost','reaper','viking','sloth','duck'];
    const suffix = () => {
      const r = Math.random();
      if (r < 0.3) return '';
      if (r < 0.55) return Math.floor(Math.random() * 999 + 1).toString();
      if (r < 0.7) return '_' + Math.floor(Math.random() * 99 + 1);
      if (r < 0.82) return 'tv';
      if (r < 0.90) return 'gg';
      if (r < 0.95) return '_plays';
      return '_' + noun[Math.floor(Math.random() * noun.length)];
    };
    const styles = [
      () => adj[~~(Math.random()*adj.length)] + '_' + noun[~~(Math.random()*noun.length)] + suffix(),
      () => noun[~~(Math.random()*noun.length)] + suffix(),
      () => adj[~~(Math.random()*adj.length)] + suffix(),
      () => 'the' + noun[~~(Math.random()*noun.length)] + suffix(),
      () => 'xx' + adj[~~(Math.random()*adj.length)] + noun[~~(Math.random()*noun.length)] + 'xx',
      () => noun[~~(Math.random()*noun.length)] + '_' + adj[~~(Math.random()*adj.length)] + suffix(),
      () => 'real_' + noun[~~(Math.random()*noun.length)] + suffix(),
    ];
    return styles[~~(Math.random() * styles.length)]().toLowerCase();
  }

  _addOneTestParticipant() {
    let name;
    do { name = this._randomTwitchName(); } while (this.participants.has(name));
    const follow = Math.random() < 0.6;
    const followData = { isFollower: follow, followDurationDays: 0, followDurationText: follow ? 'Unknown' : 'Not following' };
    this.participants.set(name, { followData, ts: Date.now() });
    if (!this._newlyAdded) this._newlyAdded = new Set();
    this._newlyAdded.add(name);
    this.saveToStorage();
    this.renderParticipants();
    this.renderWheel();
  }

  updateEntryInfo(forceStop=false) {
    const infoEl = this.elements.entryInfo;
    const overlayEl = this.elements.entryOverlay;
    const emptyCountdown = document.getElementById('emptyWheelCountdown');
    if (!infoEl) return;
    if (!this.keywordActive) { infoEl.textContent = 'Entries are closed'; if (overlayEl) overlayEl.style.display = 'none'; if (emptyCountdown) emptyCountdown.style.display = 'none'; return; }
    if (forceStop || !this.entryTotalSeconds || this.entryTotalSeconds <= 0) {
      infoEl.textContent = `Entries are open${(this.entryTimerMinutes ?? 0) === 0 ? ' (no timer)' : ''}`;
      const hasSlicesNow = !!(this.wheel);
      if (overlayEl) {
        if (this.showKeyword && hasSlicesNow && this.keyword) {
          overlayEl.textContent = this.keyword;
          overlayEl.style.display = 'flex';
        } else {
          overlayEl.style.display = 'none';
        }
      }
      if (emptyCountdown) emptyCountdown.style.display = 'none';
      return;
    }
    const elapsed = Math.max(0, Math.floor((Date.now()-this.entryStartTime)/1000));
    const remaining = Math.max(0, this.entryTotalSeconds - elapsed);
    const mm = String(Math.floor(remaining/60)).padStart(2,'0');
    const ss = String(remaining%60).padStart(2,'0');
    infoEl.textContent = `Entries close in ${mm}:${ss}`;
    const hasSlices = !!(this.wheel);
    if (overlayEl) {
      if (remaining > 0 && hasSlices) {
        if (this.showKeyword && this.keyword) {
          overlayEl.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;line-height:1.2"><span style="font-size:0.48em;opacity:0.8;letter-spacing:1px">${this.escapeHtml(this.keyword)}</span><span>${mm}:${ss}</span></div>`;
        } else {
          overlayEl.textContent = `${mm}:${ss}`;
        }
        overlayEl.style.display = 'flex';
      } else {
        overlayEl.style.display = 'none';
      }
    }
    if (emptyCountdown) { emptyCountdown.textContent = `${mm}:${ss}`; emptyCountdown.style.display = (remaining > 0 && !hasSlices) ? 'block' : 'none'; }
    if (remaining <= 0) { this.stopEntries(); }
  }

  applyHideSensitive() { /* removed — Client ID is no longer user-facing */ }

  async handleChatMessage(tags, message) {
    const rawMsg = (message || '').trim();
    let username = '';
    let displayName = '';
    if (tags) {
      displayName = (tags['display-name'] || tags.username || tags.login || '').toString();
      username = displayName.toLowerCase();
    }
    if (this.currentWinner && username === this.currentWinner && rawMsg) {
      this.appendWinnerMessage(username, rawMsg);
      if (!this.winnerAcknowledged) {
        this.winnerAcknowledged = true;
        this.stopWinnerTimer();
        this.elements.winnerTimer.textContent = 'Winner is not pooping!';
      }
    }
    if (!this.keywordActive) return;
    const msg = rawMsg.toLowerCase();
    const wantsJoin = /^!me(?=\s|$|[.,!?;:])/i.test(rawMsg);
    let containsKeyword = false;
    if (!wantsJoin) {
      const kw = ((this.keywordPrefix || '') + (this.keywordText || '')).trim().toLowerCase();
      if (kw) {
        const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`(^|\\s)${escaped}(?=\\s|$|[.,!?;:])`);
        containsKeyword = re.test(msg);
      }
    }
    if (!wantsJoin && !containsKeyword) return;
    if (!username || this.participants.has(username)) return;

    const followData = await this.getFollowerInfo(username);
    if (this.followersOnly && !followData.isFollower) return;
    const isSubscriber = await this.getSubscriberInfo(username);
    if (this.subscribersOnly && !isSubscriber) return;
    this.participants.set(username, { displayName: displayName || username, followData, isSubscriber, ts: Date.now() });
    if (!this._newlyAdded) this._newlyAdded = new Set();
    this._newlyAdded.add(username);
    this.saveToStorage();
    this.renderParticipants();
    this.renderWheel();
  }

  async getSubscriberInfo(username) {
    if (!APP_CONFIG.enableFollowerInfo || !this.accessToken || !this.clientId || !this.channelId) return false;
    try {
      const { id: userId } = await this.resolveUserId(username);
      if (!userId) return false;
      const resp = await fetch(`https://api.twitch.tv/helix/subscriptions/user?broadcaster_id=${this.channelId}&user_id=${encodeURIComponent(userId)}`, {
        headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Client-Id': this.clientId }
      });
      const data = await resp.json();
      return !!(data?.data && data.data.length > 0);
    } catch (e) { console.warn('Subscriber lookup failed', e); return false; }
  }

  async getFollowerInfo(username) {
    if (!APP_CONFIG.enableFollowerInfo) {
      return { isFollower: false, followDurationDays: 0, followDurationText: '' };
    }
    if (this.accessToken && this.clientId && this.channelId) {
      try {
        const { id: userId, profileImageUrl } = await this.resolveUserId(username);
        const url = `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${this.channelId}&user_id=${encodeURIComponent(userId)}`;
        const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Client-Id': this.clientId } });
        const data = await resp.json();
        if (data?.data && data.data.length > 0) {
          const followedAt = new Date(data.data[0].followed_at);
          return { isFollower: true, followDurationDays: this.daysSince(followedAt), followDurationText: this.formatDuration(this.daysSince(followedAt)), profileImageUrl };
        } else {
          return { isFollower: false, followDurationDays: 0, followDurationText: 'Not following', profileImageUrl };
        }
      } catch (e) { console.warn('Follower lookup failed; falling back'); }
    }
    return { isFollower: false, followDurationDays: 0, followDurationText: 'Unknown', profileImageUrl: '' };
  }

  async resolveUserId(username) {
    if (!APP_CONFIG.enableFollowerInfo) return { id: '', profileImageUrl: '' };
    const resp = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(username)}`, {
      headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Client-Id': this.clientId }
    });
    const data = await resp.json();
    const user = data?.data?.[0];
    return { id: user?.id || '', profileImageUrl: user?.profile_image_url || '' };
  }

  daysSince(date) { return Math.max(0, Math.floor((Date.now() - date.getTime()) / (1000*60*60*24))); }
  formatDuration(days) { if (days < 30) return `${days} days`; if (days < 365) return `${Math.floor(days/30)} months`; return `${Math.floor(days/365)} years`; }

  removeParticipant(username) {
    this.participants.delete(username);
    if (this.excludedWinners) this.excludedWinners.delete(username.toLowerCase());
    this.saveToStorage();
    this.renderParticipants();
    this.renderWheel();
  }

  removeNonSubscribers() {
    if (!this.accessToken) {
      this.showToast('Authorize with Twitch first to verify subscriber status.', 'warn');
      return;
    }
    let removed = 0;
    for (const [username, data] of this.participants.entries()) {
      if (!data.isSubscriber) {
        this.participants.delete(username);
        if (this.excludedWinners) this.excludedWinners.delete(username.toLowerCase());
        removed++;
      }
    }
    if (removed === 0) {
      this.showToast('No confirmed non-subscribers found to remove.', 'info');
      return;
    }
    this.saveToStorage();
    this.renderParticipants();
    this.renderWheel();
    this.showToast(`Removed ${removed} non-subscriber${removed === 1 ? '' : 's'}.`, 'info');
  }

  removeNonFollowers() {
    if (!this.accessToken) {
      this.showToast('Authorize with Twitch first to verify follower status.', 'warn');
      return;
    }
    let removed = 0;
    for (const [username, data] of this.participants.entries()) {
      if (data.followData?.isFollower === false && data.followData?.followDurationText === 'Not following') {
        this.participants.delete(username);
        if (this.excludedWinners) this.excludedWinners.delete(username.toLowerCase());
        removed++;
      }
    }
    if (removed === 0) {
      this.showToast('No confirmed non-followers found to remove.', 'info');
      return;
    }
    this.saveToStorage();
    this.renderParticipants();
    this.renderWheel();
    this.showToast(`Removed ${removed} non-follower${removed === 1 ? '' : 's'}.`, 'info');
  }

  updateCombinedKeyword() { this.keyword = ((this.keywordPrefix || '') + (this.keywordText || '')).trim(); this.saveToStorage(); this.renderWheel(); }

  render() { this.renderParticipants(); this.renderWheel(); this.renderHistory(); this.updateEntryInfo(); }

  renderParticipants() {
    this.elements.participantCount.textContent = this.participants.size.toString();
    this.elements.participantsList.innerHTML = '';
    const sorted = Array.from(this.participants.entries()).sort((a,b) => b[1].ts - a[1].ts);
    for (const [username, data] of sorted) {
      const item = document.createElement('div');
      const animate = this._newlyAdded && this._newlyAdded.has(username);
      item.className = 'participant-item' + (animate ? ' animate-in' : '');
      if (this.sliceColorMap && this.sliceColorMap.has(username)) {
        const c = this.sliceColorMap.get(username);
        item.style.borderLeftColor = c;
      }
      const badges = APP_CONFIG.enableFollowerInfo ? `
        <div class="participant-badges">
          <span class="follower-status ${data.followData?.isFollower ? 'yes' : 'no'}">${data.followData?.isFollower ? 'Follower' : 'Not Following'}</span>
          ${data.isSubscriber ? '<span class="follower-status subscriber">Subscriber</span>' : ''}
        </div>
        ${data.followData?.isFollower && data.followData?.followDurationText && data.followData.followDurationText !== 'Unknown' ? `<div class="participant-duration">${data.followData.followDurationText}</div>` : ''}` : '';
      item.innerHTML = `
        <div class="participant-main">
          <div class="participant-name">${data.displayName || username}</div>
          ${badges}
        </div>`;
      const removeBtn = document.createElement('button');
      removeBtn.className = 'participant-remove';
      removeBtn.textContent = '×';
      removeBtn.title = 'Remove from wheel';
      removeBtn.addEventListener('click', () => this.removeParticipant(username));
      item.appendChild(removeBtn);
      this.elements.participantsList.appendChild(item);
    }
    if (this._newlyAddedClearTimer) { try { clearTimeout(this._newlyAddedClearTimer); } catch {} }
    this._newlyAddedClearTimer = setTimeout(() => { if (this._newlyAdded) this._newlyAdded.clear(); }, 750);
  }

  renderWheel() {
    const el = this.elements.wheelElement;
    const info = document.getElementById('wheelInfo');
    const allNames = Array.from(this.participants.keys());
    let names = allNames;
    if (this.tempExclusions && this.tempExclusions.size) names = names.filter(n => !this.tempExclusions.has(n));
    if (this.excludedWinners && this.excludedWinners.size) names = names.filter(n => !this.excludedWinners.has(n));
    if (names.length === 0) {
      el.className = 'empty-wheel';
      el.style.transform = 'rotate(0deg)';
      el.style.background = '';
      let msg;
      const displayKeyword = ((this.keywordPrefix || '') + (this.keywordText || '')).trim();
      if (this.giveawayActive) {
        msg = this.isConnected ? `Waiting for participants...<br/>Type "${displayKeyword}" in chat to join!` : 'Connect and set a keyword to start collecting participants.';
      } else {
        msg = this.isConnected ? 'Start a giveaway to collect participants.' : 'Connect, set a keyword, then start a giveaway to collect participants.';
      }
      el.innerHTML = `<div id="emptyWheelContent" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:16px;">
        <div id="emptyWheelCountdown" style="display:none;margin-bottom:6px;font-weight:800;"></div>
        <div>${msg}</div>
      </div>`;
      this.elements.spinBtn.disabled = true;
      if (info) info.textContent = this.participants.size === 0 ? 'No participants yet' : 'No eligible participants';
      if (this.wheel && this.wheel.destroy) { try { this.wheel.destroy(); } catch {} }
      this.sliceColorMap = null;
      this.wheel = null;
      return;
    }
    this.elements.spinBtn.disabled = false;
    el.className = 'wheel';
    el.style.position = 'relative';
    // Skip full rebuild while spinning to preserve the ongoing animation state
    if (this.isSpinning) {
      const excluded = this.participants.size - names.length;
      const exNote = excluded > 0 ? ` (${excluded} excluded)` : '';
      if (info) info.textContent = `${names.length} participant${names.length===1?'':'s'} on the wheel${exNote}`;
      return;
    }
    this._renderSpinWheel(names);
    const excluded = this.participants.size - names.length;
    const exNote = excluded > 0 ? ` (${excluded} excluded)` : '';
    if (info) info.textContent = `${names.length} participant${names.length===1?'':'s'} on the wheel${exNote}`;
  }

  _renderSpinWheel(names) {
    // Randomize the base slice orientation once per giveaway session so that
    // identical participant counts don't always map to the same absolute angles.
    if (this.giveawaySessionId && this._layoutSessionMarker !== this.giveawaySessionId) {
      this._layoutSessionMarker = this.giveawaySessionId;
      const n = Math.max(1, names.length);
      this.layoutSliceOffset = Math.floor(Math.random() * n);
    }
    let rotated = names.slice();
    if (this.layoutSliceOffset && rotated.length > 1) {
      const o = ((this.layoutSliceOffset % rotated.length) + rotated.length) % rotated.length;
      rotated = rotated.slice(o).concat(rotated.slice(0, o));
    }
    this.luckyNames = rotated.slice();

    const colors = (WHEEL_PALETTES[this.wheelPaletteIndex] || WHEEL_PALETTES[0]).colors;
    const pickTextColor = (hex) => {
      const h = hex.replace('#','');
      const r = parseInt(h.substring(0,2),16);
      const g = parseInt(h.substring(2,4),16);
      const b = parseInt(h.substring(4,6),16);
      const luminance = 0.2126*(r/255) + 0.7152*(g/255) + 0.0722*(b/255);
      return luminance > 0.6 ? '#111827' : '#f9fafb';
    };
    const items = rotated.map((name, i) => ({ label: this.participants.get(name)?.displayName || name, backgroundColor: colors[i % colors.length], labelColor: pickTextColor(colors[i % colors.length]) }));
    this.sliceColorMap = new Map(items.map(it => [it.label, it.backgroundColor]));

    // Fast path: wheel already exists — just update the items in-place
    if (this.wheel) {
      this.wheel.setItems(items);
      this.renderParticipants();
      return;
    }

    // Creation path: first time or after wheel was destroyed
    const el = this.elements.wheelElement;
    el.innerHTML = '';
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) { setTimeout(() => { try { this._renderSpinWheel(names); } catch {} }, 100); return; }
    const host = document.createElement('div');
    host.style.position = 'absolute'; host.style.left = '0'; host.style.top = '0'; host.style.width = '100%'; host.style.height = '100%';
    host.style.background = 'radial-gradient(300px 300px at 50% 50%, rgba(0,0,0,0.1), rgba(0,0,0,0) 70%)';
    el.appendChild(host);
    this.wheel = new SimpleCanvasWheel(host, {
      items,
      onSpin: () => { this._lastTickStep = null; },
      onCurrentIndexChange: (e) => { if (!this.enableTick) return; if (this._lastTickStep !== e.currentIndex) { this._lastTickStep = e.currentIndex; this._playTick(); } },
      onRest: (e) => {
        document.body.classList.remove('is-spinning');
        try {
          let idx = (typeof this._pendingWinnerIndex === 'number') ? this._pendingWinnerIndex : e.currentIndex;
          if (typeof idx !== 'number' || isNaN(idx)) idx = 0;
          let winner = undefined;
          if (Array.isArray(this.luckyNames) && this.luckyNames.length) {
            const safeIdx = Math.max(0, Math.min(idx|0, this.luckyNames.length-1));
            winner = this.luckyNames[safeIdx];
          }
          if (!winner) return;
          this.showWinner(winner);
          this.isSpinning = false;
          this.elements.spinBtn.disabled = false;
          this.elements.spinBtn.textContent = 'Spin Again';
          if (this.tempExclusions) this.tempExclusions.clear();
          this.recordWinner(winner, (this.luckyNames || names));
        } catch (err) {
          console.warn('Wheel onRest handler error', err);
          this.isSpinning = false;
          this.elements.spinBtn.disabled = false;
          this.elements.spinBtn.textContent = 'Spin Again';
        }
      }
    });
    this.renderParticipants();
  }

  spinWheel() {
    if (this.isSpinning || this.participants.size === 0) return;
    this.isSpinning = true;
    if (!this.giveawaySessionId) {
      this.giveawaySessionId = 'g-' + Date.now();
      if (!this.entryStartTime) this.entryStartTime = Date.now();
    }
    this.keywordActive = false;
    this.elements.spinBtn.disabled = true;
    this.elements.spinBtn.textContent = 'Spinning...';
    const allNames = Array.from(this.participants.keys());
    let names = this.luckyNames && Array.isArray(this.luckyNames) && this.luckyNames.length ? this.luckyNames.slice() : allNames;
    if (this.tempExclusions && this.tempExclusions.size) names = names.filter(n => !this.tempExclusions.has(n));
    if (this.excludedWinners && this.excludedWinners.size) names = names.filter(n => !this.excludedWinners.has(n));
    if (names.length === 0) { this.isSpinning = false; this.elements.spinBtn.disabled = false; this.elements.spinBtn.textContent = 'Spin the Wheel'; return; }
    if (this.elements.entryOverlay) this.elements.entryOverlay.style.display = 'none';
    document.body.classList.add('is-spinning');
    // Winner index is random each spin; no bias
    const winnerIndex = Math.floor(Math.random() * names.length);
    if (this.wheel && this.wheel.spinToIndex) {
      this._pendingWinnerIndex = winnerIndex;
  // Use configured duration; no UI control
  let secs = this.spinDurationSeconds || 5;
      // Clamp to sensible bounds
      secs = Math.max(0.5, Math.min(60, secs));
      const ms = Math.max(250, Math.floor(secs * 1000));
      this.wheel.spinToIndex(winnerIndex, ms, 5, { smooth: !!this.spinSmoothEasing, randomOffsetFactor: 0.6 });
      return;
    }
    this.showToast('Wheel is not ready', 'warn');
    this.isSpinning = false;
    this.elements.spinBtn.disabled = false;
    this.elements.spinBtn.textContent = 'Spin the Wheel';
  }

  reSpinExcludeCurrentWinner() {
    if (!this.currentWinner) return;
    if (!this.tempExclusions) this.tempExclusions = new Set();
    this.tempExclusions.add(this.currentWinner);
    if (!this.excludedWinners) this.excludedWinners = new Set();
    this.excludedWinners.add(this.currentWinner.toLowerCase());
    this.closeWinnerModal();
    this.renderWheel();
    const eligible = Array.from(this.participants.keys()).filter(n => !this.tempExclusions.has(n));
    if (eligible.length === 0) { this.showToast('No eligible participants left to re-spin.', 'warn'); this.tempExclusions.clear(); return; }
    this.spinWheel();
  }

  showWinner(winner) {
    const fd = this.participants.get(winner)?.followData;
    this.currentWinner = (winner || '').toLowerCase();
    this.winnerAcknowledged = false;
    this.sadStopRequested = true;
    try { const c = document.getElementById('confettiCanvas'); if (c) { const x = c.getContext('2d'); x.clearRect(0,0,c.width,c.height); } } catch {}
    const avatarUrl = fd?.profileImageUrl || '';
    if (this.elements.winnerAvatar) {
      this.elements.winnerAvatar.src = avatarUrl;
      this.elements.winnerAvatar.style.display = avatarUrl ? 'block' : 'none';
    }
    this.elements.winnerName.textContent = this.participants.get(winner)?.displayName || winner;
    this.elements.winnerMeta.textContent = (APP_CONFIG.enableFollowerInfo && fd) ? (fd.isFollower ? `Follower${fd.followDurationText && fd.followDurationText !== 'Unknown' ? ' • ' + fd.followDurationText : ''}` : 'Not Following') : '';
    this.elements.winnerChat.innerHTML = '';
    this.elements.winnerChat.style.display = 'none';
    if (this.winnerTimerMinutes === 0) {
      this.elements.winnerTimer.textContent = '';
      if (this.elements.winnerProgress && this.elements.winnerProgress.parentElement) this.elements.winnerProgress.parentElement.style.display = 'none';
    } else {
      this.elements.winnerTimer.textContent = '00:00';
      if (this.elements.winnerProgress) { this.elements.winnerProgress.style.width = '100%'; this.elements.winnerProgress.classList.remove('low'); }
      if (this.elements.winnerProgress && this.elements.winnerProgress.parentElement) this.elements.winnerProgress.parentElement.style.display = '';
    }
    this.elements.winnerModal.style.display = 'flex';
    this.startWinnerTimer();
    if (this.enableConfetti) this.launchConfetti();
  }

  closeWinnerModal() {
    this.elements.winnerModal.style.display = 'none';
    this.stopWinnerTimer();
    this.sadStopRequested = true;
    try { const c = document.getElementById('confettiCanvas'); if (c) { const x = c.getContext('2d'); x.clearRect(0,0,c.width,c.height); } } catch {}
    if (this.currentWinner) { if (!this.excludedWinners) this.excludedWinners = new Set(); this.excludedWinners.add(this.currentWinner.toLowerCase()); this.renderWheel(); }
    this.currentWinner = null;
    this.winnerAcknowledged = false;
    this.autoReSpinTriggered = false;
  }

  openPaletteModal() {
    const grid = document.getElementById('paletteGrid');
    if (!grid) return;
    grid.innerHTML = '';
    WHEEL_PALETTES.forEach((p, i) => {
      const card = document.createElement('div');
      card.className = 'palette-card' + (i === this.wheelPaletteIndex ? ' active' : '');
      const swatches = p.colors.slice(0, 8).map(c => `<span class="palette-swatch" style="background:${c}"></span>`).join('');
      card.innerHTML = `<div class="palette-swatches">${swatches}</div><div class="palette-name">${p.name}</div>`;
      card.addEventListener('click', () => {
        this.wheelPaletteIndex = i;
        this.saveToStorage();
        this.renderWheel();
        this.closePaletteModal();
      });
      grid.appendChild(card);
    });
    if (this.elements.paletteModal) this.elements.paletteModal.style.display = 'flex';
  }

  closePaletteModal() {
    if (this.elements.paletteModal) this.elements.paletteModal.style.display = 'none';
  }

  startWinnerTimer() {
    this.winnerStartTime = Date.now();
    this.autoReSpinTriggered = false;
    if (this.winnerTimerInterval) clearInterval(this.winnerTimerInterval);
    this.winnerTotalSeconds = Math.max(0, Math.floor(this.winnerTimerMinutes * 60));
  if (this.winnerTimerMinutes === 0) {
      if (this.elements.winnerProgress && this.elements.winnerProgress.parentElement) this.elements.winnerProgress.parentElement.style.display = 'none';
      this.elements.winnerTimer.textContent = '';
      this.winnerTimerInterval = null;
      return;
    }
    if (this.elements.winnerProgress && this.elements.winnerProgress.parentElement) this.elements.winnerProgress.parentElement.style.display = '';
    this.updateWinnerTimer();
    this.winnerTimerInterval = setInterval(()=>this.updateWinnerTimer(), 1000);
  }

  stopWinnerTimer() { if (this.winnerTimerInterval) clearInterval(this.winnerTimerInterval); this.winnerTimerInterval = null; this.confettiStopRequested = true; }

  updateWinnerTimer() {
    if (this.winnerTimerMinutes === 0) {
      this.elements.winnerTimer.textContent = '';
      if (this.elements.winnerProgress && this.elements.winnerProgress.parentElement) this.elements.winnerProgress.parentElement.style.display = 'none';
      return;
    }
    const elapsed = Math.max(0, Math.floor((Date.now()-this.winnerStartTime)/1000));
    const totalSeconds = this.winnerTotalSeconds ?? Math.max(0, Math.floor(this.winnerTimerMinutes*60));
    const remaining = Math.max(0, totalSeconds - elapsed);
    const mm = String(Math.floor(remaining/60)).padStart(2,'0');
    const ss = String(remaining%60).padStart(2,'0');
    this.elements.winnerTimer.textContent = `${mm}:${ss}`;
    if (this.elements.winnerProgress) {
      const pct = totalSeconds > 0 ? Math.max(0, Math.min(1, remaining / totalSeconds)) : 0;
      this.elements.winnerProgress.style.width = `${Math.round(pct*100)}%`;
      if (pct <= 0.25) this.elements.winnerProgress.classList.add('low'); else this.elements.winnerProgress.classList.remove('low');
    }
    if (remaining <= 0) {
      this.stopWinnerTimer();
      if (!this.winnerAcknowledged && !this.autoReSpinTriggered) {
        this.autoReSpinTriggered = true;
        if (this.enableSad) this.launchSadFaces();
        this.elements.winnerTimer.textContent = 'Time is up';
      }
    }
  }

  appendWinnerMessage(username, text) {
    const div = document.createElement('div');
    div.style.marginBottom = '6px';
    div.innerHTML = `<strong>${username}</strong>: ${this.escapeHtml(text)}`;
    if (this.elements.winnerChat.style.display === 'none') { this.elements.winnerChat.style.display = 'block'; }
    this.elements.winnerChat.appendChild(div);
    this.elements.winnerChat.scrollTop = this.elements.winnerChat.scrollHeight;
  }

  escapeHtml(s){ return (s||'').replace(/[&<>"]|' /g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

  _playTick() {
    try {
      if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.001);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.04);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.05);
    } catch {}
  }

  launchConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const colors = ['#ff6b6b','#feca57','#54a0ff','#5f27cd','#1dd1a1'];
    const N = 100;
    const parts = Array.from({length:N},()=>({ x: Math.random()*canvas.width, y: -20 - Math.random()*canvas.height*0.5, r: 4+Math.random()*6, c: colors[Math.floor(Math.random()*colors.length)], vx: -2+Math.random()*4, vy: 2+Math.random()*3, spin: Math.random()*Math.PI, vr: -0.2 + Math.random()*0.4 }));
    const totalSec = this.winnerTotalSeconds ?? Math.max(0, Math.floor(this.winnerTimerMinutes*60));
    const endAt = totalSec > 0 ? (Date.now() + (totalSec * 1000)) : Number.POSITIVE_INFINITY;
    this.confettiStopRequested = false;
    const step = () => {
      ctx.clearRect(0,0,canvas.width,canvas.height);
      for (const p of parts){
        p.x += p.vx; p.y += p.vy; p.spin += p.vr;
        if (p.y > canvas.height+20) { p.y = -10; p.x = Math.random()*canvas.width; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.spin); ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r, p.r*2, p.r*2); ctx.restore();
      }
      if (Date.now() < endAt && !this.confettiStopRequested) { requestAnimationFrame(step); } else { ctx.clearRect(0,0,canvas.width,canvas.height); }
    };
    requestAnimationFrame(step);
  }

  launchSadFaces(durationMs) {
    const canvas = document.getElementById('confettiCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const faces = Array.from({length: 20}, ()=>({ x: Math.random()*canvas.width, y: -20 - Math.random()*canvas.height*0.5, vy: 2+Math.random()*2.5, size: 24+Math.random()*18, spin: Math.random()*Math.PI, vr: -0.05 + Math.random()*0.1, alpha: 0.85 }));
    const sad = '😢';
    const hasDuration = typeof durationMs === 'number' && durationMs > 0;
    const endAt = hasDuration ? (Date.now() + durationMs) : Number.POSITIVE_INFINITY;
    this.sadStopRequested = false;
    const step = () => {
      ctx.clearRect(0,0,canvas.width,canvas.height);
      for (const f of faces){
        f.y += f.vy; f.spin += f.vr;
        if (f.y > canvas.height+40) { f.y = -10; f.x = Math.random()*canvas.width; }
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.spin); ctx.globalAlpha = f.alpha; ctx.font = `${f.size}px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(sad, 0, 0); ctx.restore();
      }
      if (!this.sadStopRequested && Date.now() < endAt) { requestAnimationFrame(step); } else { ctx.clearRect(0,0,canvas.width,canvas.height); }
    };
    requestAnimationFrame(step);
  }

  async clearParticipants() {
    const ok = await this.showConfirm('Clear all participants?', 'This will remove everyone from the current list.');
    if (!ok) return;
    this.participants.clear();
    this.excludedWinners = new Set();
    this.keywordActive = true;
    this.elements.wheelElement.style.transform = 'rotate(0deg)';
    this.elements.spinBtn.textContent = 'Spin the Wheel';
    this.saveToStorage();
    this.render();
  }

  showToast(msg, type='info') {
    const wrap = document.createElement('div');
    wrap.style.padding = '10px 12px'; wrap.style.borderRadius = '10px'; wrap.style.fontWeight = '800'; wrap.style.backdropFilter = 'blur(8px)'; wrap.style.boxShadow = '0 10px 30px rgba(0,0,0,0.35), 0 0 0 1px rgba(148,163,184,0.2) inset'; wrap.style.color = '#e8ecf1'; wrap.style.maxWidth = '320px'; wrap.style.transition = 'transform .2s ease, opacity .2s ease'; wrap.style.transform = 'translateY(10px)'; wrap.style.opacity = '0'; wrap.style.background = type==='error' ? 'rgba(239,68,68,0.18)' : (type==='warn' ? 'rgba(245,158,11,0.18)' : 'rgba(8,12,22,0.7)');
    wrap.textContent = msg;
    this.elements.toastContainer.appendChild(wrap);
    requestAnimationFrame(()=>{ wrap.style.transform='translateY(0)'; wrap.style.opacity='1'; });
    setTimeout(()=>{ wrap.style.transform='translateY(10px)'; wrap.style.opacity='0'; setTimeout(()=>{ wrap.remove(); }, 200); }, 3000);
  }

  showConfirm(message, title='Please confirm') { return new Promise((resolve)=>{ this._confirmResolve = resolve; this.elements.confirmTitle.textContent = title; this.elements.confirmMessage.textContent = message; this.elements.confirmModal.style.display = 'flex'; }); }
  _resolveConfirm(val){ if (this._confirmResolve) this._confirmResolve(!!val); this._confirmResolve = null; this.elements.confirmModal.style.display = 'none'; }

  renderHistory() {
    const el = this.elements.historyList;
    el.innerHTML = '';
    if (this.history.length === 0) { el.innerHTML = '<div style="opacity:.9">No giveaways yet.</div>'; this.updateHistoryListHeight(); return; }
  const recent = this.history.slice().reverse(); // newest first
    for (const h of recent) {
      const d = new Date(h.updatedAt || h.endedAt || h.startedAt || h.at || Date.now());
      const ts = d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      const div = document.createElement('div');
      div.className = 'participant-item';
      const winners = Array.isArray(h.winners) ? h.winners : (h.winner ? [h.winner] : []);
      const winnersText = winners.length ? winners.join(', ') : '—';
      div.innerHTML = `<div><div style=\"font-weight:800\">${h.keyword}</div><div style=\"font-size:12px;opacity:.9\">${ts}</div></div><div style=\"text-align:right\"><div style=\"font-size:12px;opacity:.9\">Winner${winners.length>1?'s':''}</div><div style=\"font-weight:800; max-width:260px;\">${winnersText}</div></div>`;
      el.appendChild(div);
    }
    this.updateHistoryListHeight();
  }

  updateHistoryListHeight() { /* no-op: sidebar panel handles own overflow */ }
}

const app = new TwitchGiveawayApp();

// Keep sidebar height in sync with the left column so both tiles appear equal height
(function syncColumnHeights() {
  const leftbar = document.querySelector('.leftbar');
  const sidebar = document.querySelector('.sidebar');
  if (!leftbar || !sidebar) return;
  const sync = () => { sidebar.style.height = leftbar.offsetHeight + 'px'; };
  new ResizeObserver(sync).observe(leftbar);
  sync();
})();

// ---------------------------------------------------------------------------
// Cookie consent management
// ---------------------------------------------------------------------------
(function initConsent() {
  function applyConsent(consent) {
    mwSetCookie('mw.consent', consent, 365);
    if (typeof gtag === 'function') {
      gtag('consent', 'update', { analytics_storage: consent.analytics ? 'granted' : 'denied' });
    }
  }

  const banner = document.getElementById('consentBanner');
  const analyticsCheckbox = document.getElementById('consentAnalytics');
  if (!banner) return;

  const stored = mwGetCookie('mw.consent');
  if (!stored || !stored.decided) {
    // First visit — show banner with analytics unchecked (opt-in, GDPR compliant)
    if (analyticsCheckbox) analyticsCheckbox.checked = false;
    banner.style.display = 'flex';
  } else {
    // Restore checkbox state for when settings are re-opened
    if (analyticsCheckbox) analyticsCheckbox.checked = !!stored.analytics;
  }

  document.getElementById('consentAcceptAll')?.addEventListener('click', () => {
    if (analyticsCheckbox) analyticsCheckbox.checked = true;
    applyConsent({ analytics: true, decided: true });
    banner.style.display = 'none';
  });
  document.getElementById('consentSaveChoices')?.addEventListener('click', () => {
    applyConsent({ analytics: !!analyticsCheckbox?.checked, decided: true });
    banner.style.display = 'none';
  });
  document.getElementById('consentRejectAll')?.addEventListener('click', () => {
    if (analyticsCheckbox) analyticsCheckbox.checked = false;
    applyConsent({ analytics: false, decided: true });
    banner.style.display = 'none';
  });

  // "Cookie settings" link reopens the banner
  document.getElementById('cookieSettingsLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (analyticsCheckbox && stored) analyticsCheckbox.checked = !!stored.analytics;
    banner.style.display = 'flex';
  });
  // Close banner on backdrop click
  banner.addEventListener('click', (e) => { if (e.target === banner) banner.style.display = 'none'; });
})();

