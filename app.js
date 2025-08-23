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

// App configuration
const APP_CONFIG = {
  // Not finished yet, do not turn on 
  enableFollowerInfo: false,
  donate: {
    enabled: true,
    url: 'https://paypal.me/borgej',
    label: 'Donate'
  },
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
    channelName: 'BeeJeey',
    keywordPrefix: '!',
    keywordText: 'giveaway',
    winnerTimerMinutes: 2,
  entryTimerMinutes: 0,
  // New: wheel behavior defaults
  spinDurationSeconds: 5,
  spinSmoothEasing: true
  }
};

class SimpleCanvasWheel {
  constructor(container, { items = [], onSpin, onCurrentIndexChange, onRest } = {}) {
    this.container = container;
    this.items = items;
    this.onSpin = onSpin;
    this.onCurrentIndexChange = onCurrentIndexChange;
    this.onRest = onRest;
    this.rotation = 0; // radians; 0 means slice 0 starts at pointer (3 o'clock)
    this.anim = null;
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
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.rotation);
    const slice = this.sliceAngle;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      const start = i * slice;
      const end = start + slice;
      // slice fill
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, start, end, false);
      ctx.closePath();
      ctx.fillStyle = it.backgroundColor || '#999';
      ctx.fill();
      // slice border
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // label
      const mid = start + slice / 2;
      ctx.save();
      // Rotate to slice mid-angle
      ctx.rotate(mid);
      // Place text near the outer rim, upright, and make it read from rim toward center
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const maxFont = Math.max(12, Math.min(24, r * 0.08));
      ctx.font = `${Math.floor(maxFont)}px Segoe UI, sans-serif`;
      ctx.fillStyle = it.labelColor || '#111827';
      const outer = r * 0.94; // just inside rim
      const inner = r * 0.25; // min inner radius for labels
      const pathLen = outer - inner;
      // Move to the rim along the slice axis
      ctx.translate(outer, 0);
      const text = (it.label || '').toString();
      let clipped = text;
      while (clipped.length > 1 && ctx.measureText(clipped).width > pathLen) {
        clipped = clipped.slice(0, -1);
      }
      ctx.fillText(clipped, 0, 0);
      ctx.restore();
    }
  // outer border (avoid green hues for chroma key)
  ctx.beginPath();
  ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
  const isGreen = document.body.classList.contains('greenscreen');
  ctx.strokeStyle = isGreen ? '#9ca3af' : 'rgba(56,189,248,0.35)'; // gray in greenscreen
  ctx.lineWidth = 6;
  ctx.stroke();
    ctx.restore();
  }

  spinToIndex(targetIndex, durationMs = 5000, revolutions = 3, options = {}) {
    if (!this.items.length) return;
    if (typeof this.onSpin === 'function') { try { this.onSpin(); } catch {} }
    const slice = this.sliceAngle;
    // Allow a slight random landing offset inside the target slice so it doesn't always center
    const rand = Math.random();
    const offsetFactor = (options.randomOffsetFactor ?? 0.6); // 0..1 fraction of half-slice
    const maxOffset = (slice * 0.5) * Math.max(0, Math.min(1, offsetFactor));
    const signedOffset = (rand * 2 - 1) * maxOffset; // [-maxOffset, +maxOffset]
    const desired = (2*Math.PI - (targetIndex + 0.5) * slice - signedOffset) % (2*Math.PI);
    const start = this.rotation % (2*Math.PI);
    let delta = (desired - start);
    delta = (delta % (2*Math.PI) + 2*Math.PI) % (2*Math.PI);
    const end = start + (Math.PI * 2) * revolutions + delta;
    const t0 = performance.now();
    // Easing options: default cubic; optional quintic for a longer drain-out feel
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
    const easing = options.smooth ? easeOutQuint : easeOutCubic;
    const step = (now) => {
      const dt = Math.min(1, (now - t0) / durationMs);
      const eased = easing(dt);
      this.rotation = start + (end - start) * eased;
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
    try { if (this._ro) this._ro.disconnect(); } catch {}
    try { this.canvas.remove(); } catch {}
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
        if (this.onMessage) this.onMessage({ username: (username||'').toLowerCase() }, message);
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
      clientIdInput: document.getElementById('clientId'),
      channelInput: document.getElementById('channelName'),
      keywordPrefixInput: document.getElementById('keywordPrefix'),
      keywordInput: document.getElementById('keyword'),
      winnerTimerMinutesInput: document.getElementById('winnerTimerMinutes'),
      authBtn: document.getElementById('authBtn'),
      connectBtn: document.getElementById('connectBtn'),
      disconnectBtn: document.getElementById('disconnectBtn'),
      lockBtn: document.getElementById('lockBtn'),
      debugAddBtn: document.getElementById('debugAddBtn'),
      connectionStatus: document.getElementById('connectionStatus'),
      wheelElement: document.getElementById('wheelElement'),
      spinBtn: document.getElementById('spinBtn'),
  clearBtn: document.getElementById('clearBtn'),
  greenScreenBtn: document.getElementById('greenScreenBtn'),
      participantsList: document.getElementById('participantsList'),
      participantCount: document.getElementById('participantCount'),
      historyList: document.getElementById('historyList'),
      winnerModal: document.getElementById('winnerModal'),
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
      startGiveawayBtn: document.getElementById('startGiveawayBtn'),
      entryTimerMinutesInput: document.getElementById('entryTimerMinutes'),
  // spin controls removed from UI; config via APP_CONFIG
      entryInfo: document.getElementById('entryInfo'),
      entryOverlay: document.getElementById('entryOverlay'),
      hideSensitive: document.getElementById('hideSensitive'),
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

    if (!APP_CONFIG.enableFollowerInfo && this.elements && this.elements.authBtn) {
      this.elements.authBtn.style.display = 'none';
      this.setStatus('Connect to chat (follower info disabled)', false);
      if (this.elements.clientIdInput) {
        const cidGroup = this.elements.clientIdInput.closest('.input-group');
        if (cidGroup) cidGroup.style.display = 'none';
      }
      if (this.elements.hideSensitive) {
        const hsLabel = this.elements.hideSensitive.closest('label');
        if (hsLabel) hsLabel.style.display = 'none';
      }
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
          const hiddenPref = localStorage.getItem('mw.donateHidden') === '1';
          if (hiddenPref) { row.style.display = 'none'; }
          if (closeBtn) {
            closeBtn.addEventListener('click', () => {
              row.style.display = 'none';
              localStorage.setItem('mw.donateHidden', '1');
            });
          }
        }
      }
      const addBtn = document.getElementById('debugAddBtn');
      if (addBtn && APP_CONFIG.ui && APP_CONFIG.ui.showAddTestParticipants === false) {
        addBtn.style.display = 'none';
      }
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
    // Keep history list sized correctly on window resizes
    window.addEventListener('resize', () => this.updateHistoryListHeight());
  }

  bindEvents() {
    // Keep clientId and channel synced with state + storage
    if (this.elements.clientIdInput) {
      this.elements.clientIdInput.addEventListener('input', (e) => {
        this.clientId = (e.target.value || '').trim();
        this.saveToStorage();
      });
    }
    if (this.elements.channelInput) {
      this.elements.channelInput.addEventListener('input', (e) => {
        this.channelName = (e.target.value || '').trim().toLowerCase();
        this.saveToStorage();
      });
    }
    this.elements.authBtn.addEventListener('click', () => this.authorizeWithTwitch());
    this.elements.connectBtn.addEventListener('click', () => this.connectToChat());
    this.elements.disconnectBtn.addEventListener('click', () => this.disconnectFromChat());
    this.elements.connectionStatus.classList.add('clickable');
    this.elements.connectionStatus.addEventListener('click', () => { this.toggleConnectionPanel(); });
    this.elements.lockBtn.addEventListener('click', () => this.toggleEntries());
    this.elements.debugAddBtn.addEventListener('click', () => this.addDebugParticipants());
    this.elements.spinBtn.addEventListener('click', () => this.spinWheel());
  if (this.elements.clearBtn) this.elements.clearBtn.addEventListener('click', () => this.clearParticipants());
  if (this.elements.greenScreenBtn) this.elements.greenScreenBtn.addEventListener('click', () => this.toggleGreenScreen());
    this.elements.closeWinnerBtn.addEventListener('click', () => this.closeWinnerModal());
    this.elements.reSpinBtn.addEventListener('click', () => this.reSpinExcludeCurrentWinner());
    this.elements.winnerModal.addEventListener('click', (e) => { if (e.target === this.elements.winnerModal) this.closeWinnerModal(); });
    if (this.elements.confirmYes) this.elements.confirmYes.addEventListener('click', ()=> this._resolveConfirm(true));
    if (this.elements.confirmNo) this.elements.confirmNo.addEventListener('click', ()=> this._resolveConfirm(false));
    if (this.elements.confirmModal) this.elements.confirmModal.addEventListener('click', (e)=>{ if (e.target === this.elements.confirmModal) this._resolveConfirm(false); });
    this.elements.startGiveawayBtn.addEventListener('click', () => this.toggleGiveaway());
    this.elements.hideSensitive.addEventListener('change', () => this.applyHideSensitive());
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
      const raw = localStorage.getItem('mw.settings');
      if (raw) {
        const s = JSON.parse(raw);
        if (s && typeof s === 'object') {
          if (this.elements.clientIdInput && typeof s.clientId === 'string') {
            this.elements.clientIdInput.value = s.clientId;
            this.clientId = (s.clientId || '').trim();
          }
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
          if (typeof s.hideSensitive === 'boolean' && this.elements.hideSensitive) {
            this.elements.hideSensitive.checked = s.hideSensitive;
            this.applyHideSensitive();
          }
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
        clientId: (this.elements.clientIdInput?.value || '').trim(),
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
        hideSensitive: !!this.elements.hideSensitive?.checked,
  greenScreen: document.body.classList.contains('greenscreen'),
      };
      localStorage.setItem('mw.settings', JSON.stringify(settings));
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

  checkForToken() {
    if (!APP_CONFIG.enableFollowerInfo) {
      this.setStatus('Follower info disabled. You can still connect to chat.', false);
      return;
    }
    try {
      const hash = (window.location.hash || '').replace(/^#/, '');
      if (hash) {
        const params = new URLSearchParams(hash);
        const tok = params.get('access_token');
        if (tok) {
          this.accessToken = tok;
          sessionStorage.setItem('mw.accessToken', tok);
          history.replaceState(null, document.title, window.location.pathname + window.location.search);
          this.setStatus('Authorized with Twitch • follower info enabled', true);
          return;
        }
      }
      const saved = sessionStorage.getItem('mw.accessToken');
      if (saved) {
        this.accessToken = saved;
        this.setStatus('Authorized with Twitch • follower info enabled', true);
        return;
      }
    } catch {}
    this.setStatus('Optional: Authorize to enable follower info. You can still connect to chat.', false);
  }

  authorizeWithTwitch() {
    if (!APP_CONFIG.enableFollowerInfo) { this.showToast('Follower authorization is disabled in config.', 'warn'); return; }
    const clientId = (this.elements.clientIdInput.value || '').trim();
    if (!clientId) { this.showToast('Enter your Twitch Client ID first', 'warn'); return; }
    const redirectUri = window.location.origin + window.location.pathname;
    const scopes = ['moderator:read:followers'];
    const state = Math.random().toString(36).slice(2);
    const authUrl = new URL('https://id.twitch.tv/oauth2/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'token');
    authUrl.searchParams.set('scope', scopes.join(' '));
    authUrl.searchParams.set('state', state);
    window.location.href = authUrl.toString();
  }

  applyUrlParams() {
    const params = new URLSearchParams(window.location.search);
    if (!params) return;
    const pClient = params.get('clientId');
    const pChannel = params.get('channel');
    const pKeyword = params.get('keyword');
    const pAuto = params.get('autoconnect');
    if (pClient) this.elements.clientIdInput.value = pClient;
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
    } catch (e) {
      console.warn('recordWinner failed', e);
    }
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
    requestAnimationFrame(() => this.updateHistoryListHeight());
  }

  expandConnectionPanel() {
    if (!this.elements.connectionPanel) return;
    this.elements.connectionPanel.style.display = '';
    localStorage.setItem('mw.connCollapsed', '0');
    requestAnimationFrame(() => this.updateHistoryListHeight());
  }

  toggleConnectionPanel() {
    if (!this.elements.connectionPanel) return;
    const isHidden = this.elements.connectionPanel.style.display === 'none';
    if (isHidden) this.expandConnectionPanel(); else this.collapseConnectionPanel();
    requestAnimationFrame(() => this.updateHistoryListHeight());
  }

  autoCollapseConnectionPanel() {
    const pref = localStorage.getItem('mw.connCollapsed');
    if (pref === '0') return;
    this.collapseConnectionPanel();
    requestAnimationFrame(() => this.updateHistoryListHeight());
  }

  setStatus(text, connected) {
    this.elements.connectionStatus.textContent = text;
    this.elements.connectionStatus.className = `status ${connected ? 'connected' : 'disconnected'}`;
  }

  toggleEntries() { this.keywordActive = !this.keywordActive; this.elements.lockBtn.textContent = this.keywordActive ? 'Lock Entries' : 'Unlock Entries'; }
  toggleGiveaway() { if (this.giveawayActive) { this.stopEntries(); } else { this.startGiveaway(); } }

  startGiveaway() {
    this.giveawayActive = true;
    this.excludedWinners = new Set();
    this.keywordActive = true;
    this.elements.lockBtn.textContent = 'Lock Entries';
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
  }

  stopEntries() {
    this.giveawayActive = false;
    this.keywordActive = false;
    this.elements.lockBtn.textContent = 'Unlock Entries';
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

  _addOneTestParticipant() {
    let name;
    do { name = ('tester' + Math.floor(Math.random()*1e6)).toLowerCase(); } while (this.participants.has(name));
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
      if (overlayEl) overlayEl.style.display = 'none';
      if (emptyCountdown) emptyCountdown.style.display = 'none';
      return;
    }
    const elapsed = Math.max(0, Math.floor((Date.now()-this.entryStartTime)/1000));
    const remaining = Math.max(0, this.entryTotalSeconds - elapsed);
    const mm = String(Math.floor(remaining/60)).padStart(2,'0');
    const ss = String(remaining%60).padStart(2,'0');
    infoEl.textContent = `Entries close in ${mm}:${ss}`;
    const hasSlices = !!(this.wheel);
    if (overlayEl) { overlayEl.textContent = `${mm}:${ss}`; overlayEl.style.display = (remaining > 0 && hasSlices) ? 'flex' : 'none'; }
    if (emptyCountdown) { emptyCountdown.textContent = `${mm}:${ss}`; emptyCountdown.style.display = (remaining > 0 && !hasSlices) ? 'block' : 'none'; }
    if (remaining <= 0) { this.stopEntries(); }
  }

  applyHideSensitive() { const hide = !!this.elements.hideSensitive.checked; this.elements.clientIdInput.type = hide ? 'password' : 'text'; this.saveToStorage(); }

  async handleChatMessage(tags, message) {
    const rawMsg = (message || '').trim();
    let username = '';
    if (tags) { username = (tags.username || tags['display-name'] || tags.login || '').toString().toLowerCase(); }
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
    this.participants.set(username, { followData, ts: Date.now() });
    if (!this._newlyAdded) this._newlyAdded = new Set();
    this._newlyAdded.add(username);
    this.saveToStorage();
    this.renderParticipants();
    this.renderWheel();
  }

  async getFollowerInfo(username) {
    if (!APP_CONFIG.enableFollowerInfo) {
      return { isFollower: false, followDurationDays: 0, followDurationText: '' };
    }
    if (this.accessToken && this.clientId && this.channelId) {
      try {
        const url = `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${this.channelId}&user_id=${encodeURIComponent(await this.resolveUserId(username))}`;
        const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Client-Id': this.clientId } });
        const data = await resp.json();
        if (data?.data && data.data.length > 0) {
          const followedAt = new Date(data.data[0].followed_at);
          return { isFollower: true, followDurationDays: this.daysSince(followedAt), followDurationText: this.formatDuration(this.daysSince(followedAt)) };
        } else {
          return { isFollower: false, followDurationDays: 0, followDurationText: 'Not following' };
        }
      } catch (e) { console.warn('Follower lookup failed; falling back'); }
    }
    return { isFollower: false, followDurationDays: 0, followDurationText: 'Unknown' };
  }

  async resolveUserId(username) {
    if (!APP_CONFIG.enableFollowerInfo) return '';
    const resp = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(username)}`, {
      headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Client-Id': this.clientId }
    });
    const data = await resp.json();
    return data?.data?.[0]?.id || '';
  }

  daysSince(date) { return Math.max(0, Math.floor((Date.now() - date.getTime()) / (1000*60*60*24))); }
  formatDuration(days) { if (days < 30) return `${days} days`; if (days < 365) return `${Math.floor(days/30)} months`; return `${Math.floor(days/365)} years`; }

  updateCombinedKeyword() { this.keyword = ((this.keywordPrefix || '') + (this.keywordText || '')).trim(); this.saveToStorage(); this.renderWheel(); }

  render() { if (this.elements && this.elements.lockBtn) { this.elements.lockBtn.textContent = this.keywordActive ? 'Lock Entries' : 'Unlock Entries'; } this.renderParticipants(); this.renderWheel(); this.renderHistory(); this.updateEntryInfo(); }

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
      const followHtml = APP_CONFIG.enableFollowerInfo ? `
        <div class="participant-info">
          <div class="follower-status ${data.followData.isFollower ? 'yes' : 'no'}">${data.followData.isFollower ? 'Follower' : 'Not Following'}</div>
          <div>${data.followData.followDurationText}</div>
        </div>` : '';
      item.innerHTML = `
        <div class="participant-name">${username}</div>
        ${followHtml}`;
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
    el.innerHTML = '';
    this._renderSpinWheel(names);
    if (info) info.textContent = `${names.length} participant${names.length===1?'':'s'} on the wheel`;
  }

  _renderSpinWheel(names) {
    const el = this.elements.wheelElement;
    el.innerHTML = '';
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
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) { setTimeout(() => { try { this._renderSpinWheel(names); } catch {} } , 100); return; }
    const host = document.createElement('div');
    host.style.position = 'absolute'; host.style.left = '0'; host.style.top = '0'; host.style.width = '100%'; host.style.height = '100%';
    host.style.background = 'radial-gradient(300px 300px at 50% 50%, rgba(0,0,0,0.1), rgba(0,0,0,0) 70%)';
    el.appendChild(host);
    const colors = ['#0ea5a3','#06b6d4','#22d3ee','#38bdf8','#3b82f6','#6366f1','#7c3aed','#8b5cf6','#a78bfa','#c084fc','#d946ef','#ec4899','#f472b6','#10b981'];
    const pickTextColor = (hex) => {
      const h = hex.replace('#','');
      const r = parseInt(h.substring(0,2),16);
      const g = parseInt(h.substring(2,4),16);
      const b = parseInt(h.substring(4,6),16);
      const luminance = 0.2126*(r/255) + 0.7152*(g/255) + 0.0722*(b/255);
      return luminance > 0.6 ? '#111827' : '#f9fafb';
    };
    const items = names.map((name, i) => ({ label: name, backgroundColor: colors[i % colors.length], labelColor: pickTextColor(colors[i % colors.length]) }));
    this.sliceColorMap = new Map();
    for (const it of items) this.sliceColorMap.set(it.label, it.backgroundColor);
    this.wheel = new SimpleCanvasWheel(host, {
      items,
      onSpin: () => { this._lastTickStep = null; },
      onCurrentIndexChange: (e) => { if (!this.enableTick) return; if (this._lastTickStep !== e.currentIndex) { this._lastTickStep = e.currentIndex; this._playTick(); } },
      onRest: (e) => {
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
    this.elements.lockBtn.textContent = 'Unlock Entries';
    this.elements.spinBtn.disabled = true;
    this.elements.spinBtn.textContent = 'Spinning...';
    const allNames = Array.from(this.participants.keys());
    let names = this.luckyNames && Array.isArray(this.luckyNames) && this.luckyNames.length ? this.luckyNames.slice() : allNames;
    if (this.tempExclusions && this.tempExclusions.size) names = names.filter(n => !this.tempExclusions.has(n));
    if (this.excludedWinners && this.excludedWinners.size) names = names.filter(n => !this.excludedWinners.has(n));
    if (names.length === 0) { this.isSpinning = false; this.elements.spinBtn.disabled = false; this.elements.spinBtn.textContent = 'Spin the Wheel'; return; }
    if (this.elements.entryOverlay) this.elements.entryOverlay.style.display = 'none';
    // Winner index is random each spin; no bias
    const winnerIndex = Math.floor(Math.random() * names.length);
    if (this.wheel && this.wheel.spinToIndex) {
      this._pendingWinnerIndex = winnerIndex;
      // Read the latest value from the input to reflect user changes even if not yet persisted
  // Use configured duration; no UI control
  let secs = this.spinDurationSeconds || 5;
      // Clamp to sensible bounds
      secs = Math.max(0.5, Math.min(60, secs));
      const ms = Math.max(250, Math.floor(secs * 1000));
      this.wheel.spinToIndex(winnerIndex, ms, 3, { smooth: !!this.spinSmoothEasing, randomOffsetFactor: 0.6 });
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
    this.elements.winnerName.textContent = winner;
    this.elements.winnerMeta.textContent = (APP_CONFIG.enableFollowerInfo && fd) ? `${fd.isFollower ? 'Follower' : 'Not Following'} • ${fd.followDurationText}` : '';
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
    this.elements.lockBtn.textContent = 'Lock Entries';
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

  updateHistoryListHeight() {
    try {
      const card = document.getElementById('historyCard');
      const list = document.getElementById('historyList');
      if (!card || !list) return;
      const header = card.querySelector(':scope > div');
      const headerH = header ? header.offsetHeight : 0;
      const styles = getComputedStyle(card);
      const padTop = parseFloat(styles.paddingTop) || 0;
      const padBottom = parseFloat(styles.paddingBottom) || 0;
      const target = card.clientHeight - headerH - padTop - padBottom;
      if (target > 0) {
        list.style.height = target + 'px';
        list.style.maxHeight = target + 'px';
      } else {
        list.style.height = '';
        list.style.maxHeight = '';
      }
    } catch {}
  }
}

const app = new TwitchGiveawayApp();
