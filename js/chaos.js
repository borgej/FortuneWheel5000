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
    this._skinApplied = false;
    this._originalWheelColors = null;
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

  _playScratch() {
    try {
      const ctx = this._ctx();
      const t = ctx.currentTime;
      const bufferSize = ctx.sampleRate * 0.25;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      const noise = ctx.createBufferSource(); noise.buffer = buffer;
      const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 1200;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      noise.connect(filter); filter.connect(g); g.connect(ctx.destination);
      noise.start(t);
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
  // Spotlight
  // ---------------------------------------------------------------------
  startSpotlight() {
    const overlay = document.getElementById('chaosSpotlight');
    const stage = document.querySelector('.wheel-stage');
    if (!overlay || !stage) return;
    const r = stage.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    overlay.style.setProperty('--cx', cx + 'px');
    overlay.style.setProperty('--cy', cy + 'px');
    overlay.style.setProperty('--r', Math.max(r.width, r.height) * 0.52 + 'px');
    overlay.style.setProperty('--r2', Math.max(r.width, r.height) * 0.9 + 'px');
    document.body.classList.add('chaos-spotlight-on');
    this._spotlightActive = true;
  }

  stopSpotlight() {
    if (!this._spotlightActive) return;
    document.body.classList.remove('chaos-spotlight-on');
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
  // Themed win-effect rain — reuses the existing confetti canvas & stop flag
  // ---------------------------------------------------------------------
  launchThemedRain(forceTheme) {
    const canvas = document.getElementById('confettiCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const theme = forceTheme || this._pickFrom(['confettiBurst', 'emoji', 'money', 'fire']);
    const totalSec = this.app.winnerTotalSeconds ?? Math.max(0, Math.floor((this.app.winnerTimerMinutes || 0) * 60));
    const endAt = totalSec > 0 ? (Date.now() + totalSec * 1000) : Number.POSITIVE_INFINITY;
    this.app.confettiStopRequested = false;

    let parts, draw;
    if (theme === 'emoji') {
      const glyphs = ['🎉', '✨', '🥳', '⭐', '🔥'];
      parts = Array.from({ length: 26 }, () => ({ x: Math.random() * canvas.width, y: -20 - Math.random() * canvas.height * 0.5, vy: 1.6 + Math.random() * 2.2, size: 22 + Math.random() * 20, spin: Math.random() * Math.PI, vr: -0.05 + Math.random() * 0.1, glyph: glyphs[Math.floor(Math.random() * glyphs.length)] }));
      draw = (c, p) => { c.save(); c.translate(p.x, p.y); c.rotate(p.spin); c.font = `${p.size}px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(p.glyph, 0, 0); c.restore(); };
    } else if (theme === 'money') {
      parts = Array.from({ length: 40 }, () => ({ x: Math.random() * canvas.width, y: -20 - Math.random() * canvas.height * 0.5, vy: 1.8 + Math.random() * 2.6, vx: -1 + Math.random() * 2, size: 20 + Math.random() * 14, spin: Math.random() * Math.PI, vr: -0.15 + Math.random() * 0.3 }));
      draw = (c, p) => { c.save(); c.translate(p.x, p.y); c.rotate(p.spin); c.font = `${p.size}px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('💵', 0, 0); c.restore(); };
    } else if (theme === 'fire') {
      const colors = ['#ff6b00', '#ff9500', '#ffd000', '#ff3d00'];
      parts = Array.from({ length: 70 }, () => ({ x: Math.random() * canvas.width, y: canvas.height + Math.random() * 40, vy: -(1.4 + Math.random() * 2.4), vx: -0.6 + Math.random() * 1.2, r: 3 + Math.random() * 5, c: colors[Math.floor(Math.random() * colors.length)], life: 0.6 + Math.random() * 0.4 }));
      draw = (c, p) => { c.save(); c.globalAlpha = Math.max(0, p.life); c.fillStyle = p.c; c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill(); c.restore(); };
    } else {
      const colors = ['#ff6b6b', '#feca57', '#54a0ff', '#5f27cd', '#1dd1a1', '#ff9ff3', '#f368e0'];
      parts = Array.from({ length: 150 }, () => ({ x: Math.random() * canvas.width, y: -20 - Math.random() * canvas.height * 0.6, r: 3 + Math.random() * 5, c: colors[Math.floor(Math.random() * colors.length)], vx: -2.5 + Math.random() * 5, vy: 2 + Math.random() * 3.5, spin: Math.random() * Math.PI, vr: -0.25 + Math.random() * 0.5 }));
      draw = (c, p) => { c.save(); c.translate(p.x, p.y); c.rotate(p.spin); c.fillStyle = p.c; c.fillRect(-p.r, -p.r, p.r * 2, p.r * 2); c.restore(); };
    }

    const step = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of parts) {
        if (theme === 'fire') {
          p.x += p.vx; p.y += p.vy; p.life -= 0.008;
          if (p.life <= 0 || p.y < -10) { p.y = canvas.height + Math.random() * 20; p.x = Math.random() * canvas.width; p.life = 0.6 + Math.random() * 0.4; }
        } else {
          p.x += (p.vx || 0); p.y += p.vy; p.spin = (p.spin || 0) + (p.vr || 0);
          if (p.y > canvas.height + 20) { p.y = -10; p.x = Math.random() * canvas.width; }
        }
        draw(ctx, p);
      }
      if (Date.now() < endAt && !this.app.confettiStopRequested) requestAnimationFrame(step); else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    requestAnimationFrame(step);
  }

  shouldVaryRain() { return this.isEnabled('rain'); }

  // ---------------------------------------------------------------------
  // Skin of the day — temporarily recolors the wheel for one spin
  // ---------------------------------------------------------------------
  applySpinSkin() {
    if (!this.isEnabled('skin') || !this.app.wheel || !Array.isArray(this.app.wheel.items) || !this.app.wheel.items.length) { this._skinApplied = false; return false; }
    const items = this.app.wheel.items;
    this._originalWheelColors = items.map((it) => ({ backgroundColor: it.backgroundColor, labelColor: it.labelColor }));
    this._originalMetallic = this.app.wheel.metallic;
    const alt = WHEEL_PALETTES.filter((_, i) => i !== this.app.wheelPaletteIndex);
    const paletteObj = this._pickFrom(alt.length ? alt : WHEEL_PALETTES);
    const palette = paletteObj.colors;
    const pickTextColor = (hex) => {
      const h = hex.replace('#', '');
      const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
      const luminance = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
      return luminance > 0.6 ? '#111827' : '#f9fafb';
    };
    const skinned = items.map((it, i) => ({ ...it, backgroundColor: palette[i % palette.length], labelColor: pickTextColor(palette[i % palette.length]) }));
    this.app.wheel.setItems(skinned);
    this.app.wheel.setMetallic(paletteObj.name === 'Majorpar v2');
    this.app._applyThemeClass(paletteObj.name);
    this._skinApplied = true;
    return true;
  }

  restoreSkin() {
    if (!this._skinApplied || !this.app.wheel || !this._originalWheelColors) { this._skinApplied = false; return; }
    const items = this.app.wheel.items;
    const restored = items.map((it, i) => ({ ...it, ...(this._originalWheelColors[i] || {}) }));
    this.app.wheel.setItems(restored);
    this.app.wheel.setMetallic(this._originalMetallic);
    const basePalette = WHEEL_PALETTES[this.app.wheelPaletteIndex] || WHEEL_PALETTES[0];
    this.app._applyThemeClass(basePalette.name);
    this._skinApplied = false;
    this._originalWheelColors = null;
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
  // Winner-card decorations: rarity/jackpot, trophy entrance, one-liner, curse
  // ---------------------------------------------------------------------
  _rollRarityTier() {
    const r = Math.random();
    if (r < 0.05) return 'legendary';
    if (r < 0.17) return 'epic';
    if (r < 0.45) return 'rare';
    return 'common';
  }

  _rarityMeta(tier) {
    return {
      common: { label: 'Common', emoji: '⚪' },
      rare: { label: 'Rare', emoji: '🔵' },
      epic: { label: 'Epic', emoji: '🟣' },
      legendary: { label: 'LEGENDARY', emoji: '🌟' },
    }[tier];
  }

  applyRarityBadge() {
    const badge = document.getElementById('winnerRarityBadge');
    const card = document.getElementById('winnerCard');
    if (!badge || !card) return null;
    const tier = this._rollRarityTier();
    const meta = this._rarityMeta(tier);
    badge.textContent = `${meta.emoji} ${meta.label}`;
    badge.className = `chaos-rarity-badge chaos-rarity-${tier}`;
    badge.style.display = '';
    card.classList.add(`chaos-rarity-glow-${tier}`);
    return tier;
  }

  triggerJackpot() {
    this.showBanner('JACKPOT!', { variant: 'gold', durationMs: 1700, sub: 'Legendary winner!' });
    if (this.app.enableConfetti) this.launchThemedRain('confettiBurst');
  }

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

  _curseLines() {
    return [
      'Claim your prize while doing your best robot dance.',
      'Must type the prize name IN ALL CAPS to claim.',
      'Claim window shortened by 10 seconds. Chop chop.',
      'Must say "thank you wheel" in chat to claim.',
      'Prize can only be claimed while typing with your elbows. (Kidding. Mostly.)',
      'Bonus points if you claim it in an accent.',
    ];
  }

  applyCurse() {
    const el = document.getElementById('winnerCurse');
    if (!el) return;
    el.textContent = '🎲 ' + this._pickFrom(this._curseLines());
    el.style.display = '';
  }

  _resetWinnerDecorations() {
    const badge = document.getElementById('winnerRarityBadge'); if (badge) badge.style.display = 'none';
    const oneLiner = document.getElementById('winnerOneLiner'); if (oneLiner) oneLiner.style.display = 'none';
    const curse = document.getElementById('winnerCurse'); if (curse) curse.style.display = 'none';
    const card = document.getElementById('winnerCard');
    if (card) card.classList.remove('chaos-rarity-glow-common', 'chaos-rarity-glow-rare', 'chaos-rarity-glow-epic', 'chaos-rarity-glow-legendary', 'chaos-trophy-in');
  }

  decorateWinnerCard(winner) {
    this._resetWinnerDecorations();
    if (this.isEnabled('rarity')) {
      const tier = this.applyRarityBadge();
      if (tier === 'legendary') this.triggerJackpot();
    }
    if (this.isEnabled('trophy')) this.applyTrophyEntrance();
    if (this.isEnabled('oneLiner')) this.applyOneLiner(winner);
    if (this.isEnabled('curse')) this.applyCurse();
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
    this.applySpinSkin();
    if (!this.enabled) { startCallback(spinOptions); return; }
    this.showChaosIndicator();
    const pool = [];
    if (this.isEnabled('falseStart')) pool.push({ key: 'falseStart', label: 'False Start' });
    if (this.isEnabled('turbo')) pool.push({ key: 'turbo', label: 'Turbo Spin' });
    if (this.isEnabled('spotlight')) pool.push({ key: 'spotlight', label: 'Spotlight Mode' });
    if (this.isEnabled('glitch')) pool.push({ key: 'glitch', label: 'System Glitch' });
    if (this.isEnabled('chatBubbles')) pool.push({ key: 'chatBubbles', label: 'Chat Reactions' });
    if (!pool.length || !this._rollFrequency()) { startCallback(spinOptions); return; }
    const gag = this._pickFrom(pool);
    this.showChaosIndicator(gag.label);
    if (gag.key === 'falseStart') {
      this.showBanner('Wait for it...', { variant: 'warn', durationMs: 700 });
      this._playScratch();
      setTimeout(() => startCallback(spinOptions), 750);
    } else if (gag.key === 'turbo') {
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
    this.restoreSkin();
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
  'tick', 'skin', 'rain', 'trophy', 'impact', 'stinger', 'oneLiner', 'rarity', 'curse',
  'falseStart', 'turbo', 'spotlight', 'glitch', 'chatBubbles', 'mysteryBox',
];
