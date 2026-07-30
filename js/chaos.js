// Chaos Mode — optional, fully automatic bonus effects layered on top of a spin.
// Every effect is individually toggleable and defaults to off until the master
// "Chaos mode" switch is enabled. Nothing here ever waits on a click — every
// sequence resolves itself on a timer and calls back into the normal flow.
class ChaosEffects {
  constructor(app) {
    this.app = app;
    this.audioCtx = null;
    this._chatBuffer = [];
    this._pendingChatTimers = [];
    this._spotlightActive = false;
    this._tickStyle = 'classic';
    this._tickCounter = 0;
    this._loadSettings();
    this._bindUI();
  }

  // ---------------------------------------------------------------------
  // Settings + persistence
  // ---------------------------------------------------------------------
  _defaultSettings() {
    const s = {};
    ChaosEffects.SETTINGS_KEYS.forEach((k) => { s[k] = true; });
    return s;
  }

  _loadSettings() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('mw.chaos') || 'null'); } catch {}
    this.enabled = !!(saved && saved.enabled);
    this.frequency = (saved && ['low', 'medium', 'high'].includes(saved.frequency)) ? saved.frequency : 'medium';
    this.settings = Object.assign(this._defaultSettings(), (saved && saved.settings) || {});
  }

  _saveSettings() {
    try {
      localStorage.setItem('mw.chaos', JSON.stringify({
        enabled: this.enabled,
        frequency: this.frequency,
        settings: this.settings,
      }));
    } catch {}
  }

  _bindUI() {
    const masterEl = document.getElementById('chaosModeToggle');
    const freqEl = document.getElementById('chaosFrequencySelect');
    if (masterEl) {
      masterEl.checked = this.enabled;
      masterEl.addEventListener('change', () => {
        this.enabled = !!masterEl.checked;
        this._saveSettings();
        this._refreshUiEnabledState();
      });
    }
    if (freqEl) {
      freqEl.value = this.frequency;
      freqEl.addEventListener('change', () => {
        this.frequency = freqEl.value;
        this._saveSettings();
      });
    }
    ChaosEffects.SETTINGS_KEYS.forEach((key) => {
      const id = 'chaos' + key[0].toUpperCase() + key.slice(1) + 'Toggle';
      const el = document.getElementById(id);
      if (!el) return;
      el.checked = !!this.settings[key];
      el.addEventListener('change', () => {
        this.settings[key] = !!el.checked;
        this._saveSettings();
      });
    });
    this._refreshUiEnabledState();
  }

  _refreshUiEnabledState() {
    const panel = document.querySelector('.chaos-details');
    if (panel) panel.classList.toggle('chaos-panel-disabled', !this.enabled);
  }

  isEnabled(key) { return this.enabled && !!this.settings[key]; }

  _rollFrequency() {
    const p = { low: 0.12, medium: 0.28, high: 0.48 }[this.frequency] ?? 0.28;
    return Math.random() < p;
  }

  _pickFrom(list) { return list[Math.floor(Math.random() * list.length)]; }

  // ---------------------------------------------------------------------
  // Audio primitives — everything synthesized, no asset files
  // ---------------------------------------------------------------------
  _ctx() {
    if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return this.audioCtx;
  }

  _pickTickStyleForSpin() {
    this._tickCounter = 0;
    this._tickStyle = this.isEnabled('tick') ? this._pickFrom(['classic', 'laser', 'boing', 'cowbell', 'crescendo']) : 'classic';
  }

  playTick() {
    if (!this.isEnabled('tick')) { this.app._playTick(); return; }
    try {
      this._tickCounter++;
      const ctx = this._ctx();
      const t = ctx.currentTime;
      const style = this._tickStyle || 'classic';
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, t);
      if (style === 'laser') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1800, t);
        osc.frequency.exponentialRampToValueAtTime(400, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.05, t + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
        osc.start(t); osc.stop(t + 0.07);
      } else if (style === 'boing') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.exponentialRampToValueAtTime(660, t + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.07, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
        osc.start(t); osc.stop(t + 0.1);
      } else if (style === 'cowbell') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, t);
        gain.gain.exponentialRampToValueAtTime(0.05, t + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        osc.start(t); osc.stop(t + 0.05);
        const osc2 = ctx.createOscillator(); const g2 = ctx.createGain();
        osc2.type = 'square'; osc2.frequency.setValueAtTime(540, t);
        g2.gain.setValueAtTime(0.0001, t);
        g2.gain.exponentialRampToValueAtTime(0.04, t + 0.004);
        g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        osc2.connect(g2); g2.connect(ctx.destination);
        osc2.start(t); osc2.stop(t + 0.05);
      } else if (style === 'crescendo') {
        const pitch = Math.min(2400, 700 + this._tickCounter * 40);
        osc.type = 'square';
        osc.frequency.setValueAtTime(pitch, t);
        gain.gain.exponentialRampToValueAtTime(Math.min(0.12, 0.04 + this._tickCounter * 0.002), t + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
        osc.start(t); osc.stop(t + 0.05);
      } else {
        osc.type = 'square';
        osc.frequency.setValueAtTime(1200, t);
        gain.gain.exponentialRampToValueAtTime(0.06, t + 0.001);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
        osc.start(t); osc.stop(t + 0.05);
      }
    } catch {}
  }

  playStinger() {
    try {
      const ctx = this._ctx();
      const t = ctx.currentTime;
      const kind = this._pickFrom(['fanfare', 'airhorn', 'cymbal', 'laserSweep']);
      if (kind === 'fanfare') {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
          const osc = ctx.createOscillator(); const g = ctx.createGain();
          osc.type = 'triangle'; osc.frequency.setValueAtTime(f, t + i * 0.09);
          g.gain.setValueAtTime(0.0001, t + i * 0.09);
          g.gain.exponentialRampToValueAtTime(0.12, t + i * 0.09 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.22);
          osc.connect(g); g.connect(ctx.destination);
          osc.start(t + i * 0.09); osc.stop(t + i * 0.09 + 0.24);
        });
      } else if (kind === 'airhorn') {
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(230, t);
        osc.frequency.linearRampToValueAtTime(250, t + 0.5);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.1, t + 0.05);
        g.gain.setValueAtTime(0.1, t + 0.4);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.65);
      } else if (kind === 'cymbal') {
        const bufferSize = ctx.sampleRate * 0.6;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
        const noise = ctx.createBufferSource(); noise.buffer = buffer;
        const filter = ctx.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = 4000;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.15, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
        noise.connect(filter); filter.connect(g); g.connect(ctx.destination);
        noise.start(t);
      } else {
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(2200, t);
        osc.frequency.exponentialRampToValueAtTime(140, t + 0.4);
        g.gain.setValueAtTime(0.08, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.45);
      }
    } catch {}
  }

  _suspenseBlip() {
    try {
      const ctx = this._ctx();
      const t = ctx.currentTime;
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(500, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.04, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.1);
    } catch {}
  }

  // ---------------------------------------------------------------------
  // Persistent "chaos mode is on" pill — shown for the whole spin so
  // viewers know weird stuff might happen, not just when a gag fires
  // ---------------------------------------------------------------------
  showChaosIndicator(label) {
    const el = document.getElementById('chaosIndicator');
    if (!el) return;
    el.textContent = label ? `🎲 Chaos Mode: ${label}` : '🎲 Chaos Mode';
    el.classList.add('chaos-indicator--show');
  }

  hideChaosIndicator() {
    const el = document.getElementById('chaosIndicator');
    if (el) el.classList.remove('chaos-indicator--show');
  }

  // ---------------------------------------------------------------------
  // Banners
  // ---------------------------------------------------------------------
  showBanner(text, { variant = 'default', durationMs = 1000, sub = '' } = {}) {
    const layer = document.getElementById('chaosOverlay');
    if (!layer) return null;
    const el = document.createElement('div');
    el.className = `chaos-banner chaos-banner--${variant}`;
    el.innerHTML = `<div class="chaos-banner-text">${text}</div>${sub ? `<div class="chaos-banner-sub">${sub}</div>` : ''}`;
    layer.appendChild(el);
    requestAnimationFrame(() => el.classList.add('chaos-banner--in'));
    setTimeout(() => {
      el.classList.remove('chaos-banner--in');
      el.classList.add('chaos-banner--out');
      setTimeout(() => el.remove(), 300);
    }, durationMs);
    return el;
  }

  // ---------------------------------------------------------------------
  // Shake / punch
  // ---------------------------------------------------------------------
  shakeStage() {
    const stage = document.querySelector('.wheel-stage');
    if (!stage) return;
    stage.classList.remove('chaos-shake'); void stage.offsetWidth;
    stage.classList.add('chaos-shake');
    setTimeout(() => stage.classList.remove('chaos-shake'), 450);
  }

  zoomPunch() {
    const stage = document.querySelector('.wheel-stage');
    if (!stage) return;
    stage.classList.remove('chaos-zoom-punch'); void stage.offsetWidth;
    stage.classList.add('chaos-zoom-punch');
    setTimeout(() => stage.classList.remove('chaos-zoom-punch'), 420);
  }

  // ---------------------------------------------------------------------
  // Spotlight — a small glowing name-tag anchored right at the pointer,
  // updated on every tick with whichever name it's currently pointing at.
  // ---------------------------------------------------------------------
  startSpotlight() {
    const el = document.getElementById('chaosSpotlightTag');
    if (!el) return;
    el.textContent = '';
    el.classList.add('chaos-spotlight-tag--show');
    this._spotlightActive = true;
  }

  updateSpotlightLabel(name) {
    const el = document.getElementById('chaosSpotlightTag');
    if (!el) return;
    el.textContent = name;
    el.classList.remove('chaos-spotlight-tag--pulse'); void el.offsetWidth;
    el.classList.add('chaos-spotlight-tag--pulse');
  }

  isSpotlightActive() { return this._spotlightActive; }

  stopSpotlight() {
    if (!this._spotlightActive) return;
    const el = document.getElementById('chaosSpotlightTag');
    if (el) el.classList.remove('chaos-spotlight-tag--show');
    this._spotlightActive = false;
  }

  // ---------------------------------------------------------------------
  // Glitch
  // ---------------------------------------------------------------------
  runGlitch(done) {
    const overlay = document.getElementById('chaosOverlay');
    if (!overlay) { if (done) done(); return; }
    const flick = document.createElement('div');
    flick.className = 'chaos-glitch-flicker';
    overlay.appendChild(flick);
    let err = null;
    const t1 = setTimeout(() => {
      err = document.createElement('div');
      err.className = 'chaos-glitch-dialog';
      err.innerHTML = '<div class="chaos-glitch-title">⚠ WHEEL.EXE</div><div class="chaos-glitch-body">Not responding...</div>';
      overlay.appendChild(err);
    }, 120);
    setTimeout(() => {
      clearTimeout(t1);
      flick.remove();
      if (err) err.remove();
      if (done) done();
    }, 700);
  }

  // ---------------------------------------------------------------------
  // Chat buffer + reaction bubbles
  // ---------------------------------------------------------------------
  noteChatMessage(name, text) {
    const clean = (text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return;
    this._chatBuffer.push({ name: name || 'chat', text: clean.slice(0, 60) });
    if (this._chatBuffer.length > 25) this._chatBuffer.shift();
  }

  _fallbackChatLines() {
    return ['PogChamp', "LET'S GOOO", "who's gonna win??", 'hype', 'GG', '🔥🔥🔥', 'pick me pick me', 'spin it!!'];
  }

  startChatBubbles(durationMs) {
    const layer = document.getElementById('chaosChatLayer');
    if (!layer) return;
    const count = 6;
    const useBuffer = this._chatBuffer.length >= 3;
    for (let i = 0; i < count; i++) {
      const delay = (i / count) * Math.min(durationMs * 0.7, 3500);
      const id = setTimeout(() => {
        const src = useBuffer ? this._pickFrom(this._chatBuffer) : { name: 'chat', text: this._pickFrom(this._fallbackChatLines()) };
        const bubble = document.createElement('div');
        bubble.className = 'chaos-chat-bubble';
        bubble.style.left = (8 + Math.random() * 84) + '%';
        bubble.textContent = `${src.name}: ${src.text}`;
        layer.appendChild(bubble);
        requestAnimationFrame(() => bubble.classList.add('chaos-chat-bubble--go'));
        setTimeout(() => bubble.remove(), 2600);
      }, delay);
      this._pendingChatTimers.push(id);
    }
  }

  _clearChatBubbles() {
    this._pendingChatTimers.forEach((id) => clearTimeout(id));
    this._pendingChatTimers = [];
  }

  // ---------------------------------------------------------------------
  // Winner-card decorations: trophy entrance, one-liner
  // ---------------------------------------------------------------------
  applyTrophyEntrance() {
    const card = document.getElementById('winnerCard');
    if (!card) return;
    card.classList.remove('chaos-trophy-in'); void card.offsetWidth;
    card.classList.add('chaos-trophy-in');
  }

  _oneLiners(name) {
    return [
      'The wheel gods have spoken.',
      'Certified lucky legend.',
      `RNGesus smiles upon ${name}.`,
      'Statistically improbable. Emotionally satisfying.',
      `${name} rolled a natural 20.`,
      'This was not rigged. Probably.',
      'Somewhere, a math teacher is proud.',
      'Chosen by the algorithm of destiny.',
    ];
  }

  applyOneLiner(winner) {
    const el = document.getElementById('winnerOneLiner');
    if (!el) return;
    const displayName = this.app.participants.get(winner)?.displayName || winner;
    el.textContent = this._pickFrom(this._oneLiners(displayName));
    el.style.display = '';
  }

  _resetWinnerDecorations() {
    const oneLiner = document.getElementById('winnerOneLiner'); if (oneLiner) oneLiner.style.display = 'none';
    const card = document.getElementById('winnerCard');
    if (card) card.classList.remove('chaos-trophy-in');
  }

  decorateWinnerCard(winner) {
    this._resetWinnerDecorations();
    if (this.isEnabled('trophy')) this.applyTrophyEntrance();
    if (this.isEnabled('oneLiner')) this.applyOneLiner(winner);
  }

  // ---------------------------------------------------------------------
  // Mystery box reveal
  // ---------------------------------------------------------------------
  runMysteryBox(done) {
    const overlay = document.getElementById('chaosOverlay');
    if (!overlay) { done(); return; }
    const box = document.createElement('div');
    box.className = 'chaos-mystery-box';
    box.innerHTML = '<div class="chaos-mystery-mark">?</div><div class="chaos-mystery-label">Who could it be...</div>';
    overlay.appendChild(box);
    let blips = 0;
    const blipTimer = setInterval(() => { this._suspenseBlip(); blips++; if (blips >= 5) clearInterval(blipTimer); }, 220);
    setTimeout(() => {
      clearInterval(blipTimer);
      box.classList.add('chaos-mystery-box--out');
      setTimeout(() => { box.remove(); done(); }, 260);
    }, 1300);
  }

  // ---------------------------------------------------------------------
  // Pre-spin sequence — runs at most one gag, then always calls startCallback
  // ---------------------------------------------------------------------
  runPreSpinSequence(spinOptions, startCallback) {
    this._pickTickStyleForSpin();
    if (!this.enabled) { startCallback(spinOptions); return; }
    this.showChaosIndicator();
    const pool = [];
    if (this.isEnabled('turbo')) pool.push({ key: 'turbo', label: 'Turbo Spin' });
    if (this.isEnabled('spotlight')) pool.push({ key: 'spotlight', label: 'Spotlight Mode' });
    if (this.isEnabled('glitch')) pool.push({ key: 'glitch', label: 'System Glitch' });
    if (this.isEnabled('chatBubbles')) pool.push({ key: 'chatBubbles', label: 'Chat Reactions' });
    if (!pool.length || !this._rollFrequency()) { startCallback(spinOptions); return; }
    const gag = this._pickFrom(pool);
    this.showChaosIndicator(gag.label);
    if (gag.key === 'turbo') {
      spinOptions.ms = Math.max(1200, Math.round(spinOptions.ms * 0.45));
      spinOptions.revolutions = (spinOptions.revolutions || 5) + 4;
      this.showBanner('NITRO SPIN!', { variant: 'gold', durationMs: 900 });
      const stage = document.querySelector('.wheel-stage');
      if (stage) { stage.classList.add('chaos-turbo-blur'); setTimeout(() => stage.classList.remove('chaos-turbo-blur'), spinOptions.ms + 300); }
      startCallback(spinOptions);
    } else if (gag.key === 'spotlight') {
      this.startSpotlight();
      startCallback(spinOptions);
    } else if (gag.key === 'glitch') {
      this.runGlitch(() => startCallback(spinOptions));
    } else if (gag.key === 'chatBubbles') {
      this.startChatBubbles(spinOptions.ms);
      startCallback(spinOptions);
    } else {
      startCallback(spinOptions);
    }
  }

  // ---------------------------------------------------------------------
  // Reveal sequence — always ends by calling cb(winner)
  // ---------------------------------------------------------------------
  revealWinner(winner, cb) {
    this.hideChaosIndicator();
    this.stopSpotlight();
    this._clearChatBubbles();
    if (this.isEnabled('impact')) { this.zoomPunch(); this.shakeStage(); }
    const finish = () => {
      cb(winner);
      this.decorateWinnerCard(winner);
      if (this.isEnabled('stinger')) this.playStinger();
    };
    if (this.enabled && this.isEnabled('mysteryBox') && this._rollFrequency()) {
      this.runMysteryBox(finish);
    } else {
      setTimeout(finish, this.enabled ? 160 : 0);
    }
  }
}

ChaosEffects.SETTINGS_KEYS = [
  'tick', 'trophy', 'impact', 'stinger', 'oneLiner',
  'turbo', 'spotlight', 'glitch', 'chatBubbles', 'mysteryBox',
];
