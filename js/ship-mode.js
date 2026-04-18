// Ship mode: random ship picker for World of Warships.
// Depends on: wheel.js (SimpleCanvasWheel), wows.js (WoWS), config.js (WHEEL_PALETTES)

class ShipWheelMode {
  constructor() {
    this.ships        = [];  // loaded player ships with details
    this.accountId    = '';
    this.region       = 'eu';
    this.isLoaded     = false;
    this.isSpinning   = false;
    this._wheels      = [];  // active SimpleCanvasWheel instances
    this._paletteIdx  = 0;
    this._history     = []; // ship history for this session
    // Wargaming OAuth state
    this._wgToken     = null;
    this._wgNickname  = null;
    this._wgAccountId = null;
    this._wgRegion    = null;
    // Sound & effects
    this._tickEnabled        = false;
    this._confettiEnabled    = true;
    this._randomOrderEnabled = false;
    this._audioCtx           = null;
    this._lastTickStep       = null;
  }

  // ── Element shortcuts ─────────────────────────────────────────────────────

  _el(id) { return document.getElementById(id); }

  // ── Init ──────────────────────────────────────────────────────────────────

  init() {
    this._el('wowsLoadBtn')?.addEventListener('click', () => this.loadShips());
    this._el('wowsSpinBtn')?.addEventListener('click', () => this.spin());
    const closeResult = () => {
      const m = this._el('shipResultModal');
      if (m) m.style.display = 'none';
      this.isSpinning = false;
      const btn = this._el('wowsSpinBtn');
      if (btn) { btn.disabled = false; btn.textContent = '⚓ Spin for Ship'; }
      this._updateGsSpinBtn();
    };
    this._el('closeShipResultBtn')?.addEventListener('click', closeResult);
    this._el('spinAgainBtn')?.addEventListener('click', () => { closeResult(); this.spin(); });
    this._el('clearShipHistoryBtn')?.addEventListener('click', () => {
      this._history = [];
      this._renderHistory();
      try { localStorage.removeItem('ship_history'); } catch {}
    });

    // Palette button in ship mode panel
    this._el('wowsPaletteBtn')?.addEventListener('click', () => this.openPaletteModal());

    // Green screen toggle
    this._el('wowsGreenScreenBtn')?.addEventListener('click', () => {
      document.body.classList.toggle('greenscreen');
      if (this._singleWheel?.resize) try { this._singleWheel.resize(); } catch {}
      this._updateGsSpinBtn();
    });

    // Tick toggle
    const tickToggle = this._el('wowsTickToggle');
    if (tickToggle) {
      try { const s = localStorage.getItem('ship_tick'); if (s !== null) { this._tickEnabled = s === 'true'; tickToggle.checked = this._tickEnabled; } } catch {}
      tickToggle.addEventListener('change', () => { this._tickEnabled = tickToggle.checked; try { localStorage.setItem('ship_tick', String(this._tickEnabled)); } catch {} });
    }

    // Confetti toggle
    const confettiToggle = this._el('wowsConfettiToggle');
    if (confettiToggle) {
      try { const s = localStorage.getItem('ship_confetti'); if (s !== null) { this._confettiEnabled = s === 'true'; confettiToggle.checked = this._confettiEnabled; } } catch {}
      confettiToggle.addEventListener('change', () => { this._confettiEnabled = confettiToggle.checked; try { localStorage.setItem('ship_confetti', String(this._confettiEnabled)); } catch {} });
    }

    // Random spin order toggle
    const randomOrderToggle = this._el('wowsRandomOrderToggle');
    if (randomOrderToggle) {
      try { const s = localStorage.getItem('ship_random_order'); if (s !== null) { this._randomOrderEnabled = s === 'true'; randomOrderToggle.checked = this._randomOrderEnabled; } } catch {}
      randomOrderToggle.addEventListener('change', () => { this._randomOrderEnabled = randomOrderToggle.checked; try { localStorage.setItem('ship_random_order', String(this._randomOrderEnabled)); } catch {} });
    }

    // Stats toggle — persist preference
    const statsToggle = this._el('wowsShowStatsToggle');
    if (statsToggle) {
      try {
        const saved = localStorage.getItem('ship_show_stats');
        if (saved !== null) statsToggle.checked = saved !== 'false';
      } catch {}
      statsToggle.addEventListener('change', () => {
        try { localStorage.setItem('ship_show_stats', String(statsToggle.checked)); } catch {}
      });
    }

    // Cascade filter dropdowns when any one changes
    ['wowsTierMin', 'wowsTierMax', 'wowsNationFilter'].forEach(id => {
      this._el(id)?.addEventListener('change', () => this._updateFilterOptions());
    });

    // Type checkbox "all / none" toggle
    this._el('wowsTypeSelectAll')?.addEventListener('click', () => {
      const cbs = [...(this._el('wowsTypeCheckboxes')?.querySelectorAll('input') || [])];
      const allOn = cbs.every(c => c.checked);
      cbs.forEach(c => { c.checked = !allOn; });
      this._saveTypeCheckboxes();
      this._updateFilterOptions();
    });

    // Greenscreen spin button
    this._el('shipGsSpinBtn')?.addEventListener('click', () => this.spin());

    // Restore saved setup
    try {
      const saved = JSON.parse(localStorage.getItem('wows_setup') || 'null');
      if (saved?.username)  this._el('wowsAccountId').value = saved.username;
      else if (saved?.accountId) this._el('wowsAccountId').value = saved.accountId;
      if (saved?.region)    this._el('wowsRegion').value    = saved.region;
    } catch {}

    // Restore palette
    try {
      const p = localStorage.getItem('ship_palette');
      if (p !== null) this._paletteIdx = parseInt(p) || 0;
    } catch {}

    // Restore history
    try {
      const h = JSON.parse(localStorage.getItem('ship_history') || '[]');
      if (Array.isArray(h)) { this._history = h; this._renderHistory(); }
    } catch {}

    // ── Wargaming OAuth ───────────────────────────────────────────────────
    // Handle redirect back from Wargaming auth (URL contains ?status=ok&access_token=...)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('status') === 'ok' && urlParams.get('access_token')) {
      const auth = {
        token:     urlParams.get('access_token'),
        expiresAt: Number(urlParams.get('expires_at')),
        nickname:  urlParams.get('nickname'),
        accountId: urlParams.get('account_id'),
        region:    localStorage.getItem('wg_auth_region') || 'eu',
      };
      try { localStorage.setItem('wg_auth', JSON.stringify(auth)); } catch {}
      window.history.replaceState({}, '', window.location.pathname);
      // Switch to ship mode after login
      switchAppMode('ship');
    }

    // Restore stored auth token (if not expired)
    try {
      const auth = JSON.parse(localStorage.getItem('wg_auth') || 'null');
      if (auth?.token && auth.expiresAt > Date.now() / 1000) {
        this._wgToken     = auth.token;
        this._wgNickname  = auth.nickname;
        this._wgAccountId = auth.accountId;
        this._wgRegion    = auth.region;
        // Pre-fill form with logged-in user
        const inp = this._el('wowsAccountId');
        if (inp && !inp.value) inp.value = auth.nickname;
        const reg = this._el('wowsRegion');
        if (reg && auth.region) reg.value = auth.region;
      } else if (auth) {
        localStorage.removeItem('wg_auth'); // expired
      }
    } catch {}

    this._updateAuthUI();
    this._el('wowsLoginBtn')?.addEventListener('click',  () => this._startWgLogin());
    this._el('wowsLogoutBtn')?.addEventListener('click', () => this._wgLogout());
  }

  async _startWgLogin() {
    const region = this._el('wowsRegion')?.value || 'eu';
    try { localStorage.setItem('wg_auth_region', region); } catch {}
    try {
      const r = await fetch(`api/wg-auth/login?region=${encodeURIComponent(region)}`);
      const { url } = await r.json();
      window.location.href = url;
    } catch {
      this._setStatus('Kunne ikke starte innlogging. Prøv igjen.', 'error');
    }
  }

  _wgLogout() {
    this._wgToken = null; this._wgNickname = null;
    this._wgAccountId = null; this._wgRegion = null;
    try { localStorage.removeItem('wg_auth'); } catch {}
    this._updateAuthUI();
  }

  _updateAuthUI() {
    const loginBtn  = this._el('wowsLoginBtn');
    const logoutBtn = this._el('wowsLogoutBtn');
    const statusEl  = this._el('wowsAuthStatus');
    if (this._wgToken) {
      if (loginBtn)  loginBtn.style.display  = 'none';
      if (logoutBtn) logoutBtn.style.display = '';
      if (statusEl) {
        statusEl.className   = 'wows-auth-status wows-auth-ok';
        statusEl.textContent = `✓ ${this._wgNickname} — in-port filter active`;
      }
    } else {
      if (loginBtn)  loginBtn.style.display  = '';
      if (logoutBtn) logoutBtn.style.display = 'none';
      if (statusEl) {
        statusEl.className   = 'wows-auth-status wows-auth-hint';
        statusEl.textContent = 'Login to show only ships currently in your dockyard';
      }
    }
  }

  // ── Load player's ships ───────────────────────────────────────────────────

  async loadShips() {
    let accountId = (this._el('wowsAccountId')?.value || '').trim();
    const region  = this._el('wowsRegion')?.value || 'eu';
    if (!accountId) { this._setStatus('Enter your account ID first.', 'error'); return; }

    this.accountId = accountId;
    this.region    = region;

    const btn = this._el('wowsLoadBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }
    this._setStatus('Fetching ships in port…', 'info');

    try {
      try { localStorage.setItem('wows_setup', JSON.stringify({ username: accountId, region })); } catch {}

      if (!/^\d+$/.test(accountId)) {
        this._setStatus(`Looking up player "${accountId}"…`, 'info');
        const player = await WoWS.lookupPlayer(accountId, region);
        this.accountId = String(player.account_id);
        accountId = this.accountId;
        this._setStatus(`Found: ${player.nickname} (${player.account_id})`, 'info');
      }

      const ids = await WoWS.fetchPlayerShipIds(accountId, region, this._wgToken || null);
      if (ids === null) {
        this._setStatus('Statistics are hidden. In WoWS game client: Settings → Profile → uncheck "Hide my statistics".', 'error');
        return;
      }
      if (!ids.length) {
        this._setStatus('No ships found. Have you played any battles?', 'error');
        return;
      }

      this._setStatus(`Found ${ids.length} ships, loading details…`, 'info');
      const details = await WoWS.fetchShipDetails(ids, region);

      this.ships = details.filter(s => s?.ship_id && s.name && s.tier && s.type && s.nation);
      if (!this.ships.length) {
        this._setStatus('Could not load ship details. Try again.', 'error');
        return;
      }

      this.isLoaded = true;
      const filterNote = this._wgToken ? ' (in-port only)' : ' (all ships ever played)';
      this._setStatus(`✓ ${this.ships.length} ships loaded${filterNote}`, 'ok');
      this._populateFilters();
      this._updateGsSpinBtn();

      const f = this._el('wowsFilters');
      if (f) f.style.display = '';

    } catch (err) {
      console.error('WoWS load error:', err);
      this._setStatus(`Error: ${err.message}`, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Reload Ships'; }
    }
  }

  _setStatus(msg, type) {
    const el = this._el('wowsStatus');
    if (!el) return;
    el.style.display = '';
    el.textContent   = msg;
    el.style.color   = type === 'error' ? '#ef4444' : type === 'ok' ? '#10b981' : '#94a3b8';
  }

  // ── Filters ───────────────────────────────────────────────────────────────

  _getFilters() {
    return {
      tierMin:      parseInt(this._el('wowsTierMin')?.value  || '') || 0,
      tierMax:      parseInt(this._el('wowsTierMax')?.value  || '') || 0,
      type:         '',
      nation:       this._el('wowsNationFilter')?.value || '',
      allowedTypes: this._getAllowedTypes(),
    };
  }

  // Ships matching exact filters + tier range (tierMin/Max 0 = no constraint).
  _matchingShips(filters, tierRange) {
    const rMin = (tierRange?.min) || 0;
    const rMax = (tierRange?.max) || 0;
    return this.ships.filter(s => {
      if (rMin && s.tier < rMin) return false;
      if (rMax && s.tier > rMax) return false;
      if (filters.tier         && String(s.tier) !== String(filters.tier)) return false;
      if (filters.type         && s.type         !== filters.type)          return false;
      if (filters.nation       && s.nation       !== filters.nation)        return false;
      if (filters.allowedTypes && !filters.allowedTypes.has(s.type))        return false;
      return true;
    });
  }

  // Unique sorted values for one category, considering other exact filters and tier range.
  _uniqueValues(category, otherFilters, tierRange) {
    const rMin = (tierRange?.min) || 0;
    const rMax = (tierRange?.max) || 0;
    const pool = this.ships.filter(s => {
      if (rMin && s.tier < rMin) return false;
      if (rMax && s.tier > rMax) return false;
      for (const [k, v] of Object.entries(otherFilters)) {
        if (!v) continue;
        if (k === 'tier'         && String(s.tier) !== String(v))          return false;
        if (k === 'type'         && s.type         !== v)                   return false;
        if (k === 'nation'       && s.nation       !== v)                   return false;
        if (k === 'allowedTypes' && v instanceof Set && v.size > 0 && !v.has(s.type)) return false;
      }
      return true;
    });
    const vals = [...new Set(pool.map(s => s[category]))];
    if (category === 'tier') return vals.sort((a, b) => Number(a) - Number(b));
    return vals.sort();
  }

  _populateFilters() {
    this._populateTypeCheckboxes();
    this._updateFilterOptions();
  }

  _updateFilterOptions() {
    const f = this._getFilters();

    // All tiers available given locked nation + allowed types (independent of tier range)
    const allTiers = this._uniqueValues('tier', { nation: f.nation, allowedTypes: f.allowedTypes });

    // Min list: tiers up to current max; max list: tiers from current min
    const minTiers = f.tierMax ? allTiers.filter(t => t <= f.tierMax) : allTiers;
    const maxTiers = f.tierMin ? allTiers.filter(t => t >= f.tierMin) : allTiers;

    this._rebuildTierSelect('wowsTierMin', minTiers, f.tierMin);
    this._rebuildTierSelect('wowsTierMax', maxTiers, f.tierMax);

    // Nations filtered by tier range + allowed types
    const tierRange = { min: f.tierMin, max: f.tierMax };
    const nations = this._uniqueValues('nation', { allowedTypes: f.allowedTypes }, tierRange);

    this._rebuildSelect('wowsNationFilter', nations, f.nation, v => WoWS.NATION_LABELS[v] || v);
  }

  _getAllowedTypes() {
    const container = this._el('wowsTypeCheckboxes');
    if (!container) return null;
    const boxes = container.querySelectorAll('input[type=checkbox]');
    if (!boxes.length) return null;
    const checked = [...boxes].filter(b => b.checked).map(b => b.value);
    if (checked.length === boxes.length) return null; // all = no filter
    return checked.length ? new Set(checked) : new Set();
  }

  _populateTypeCheckboxes() {
    const container = this._el('wowsTypeCheckboxes');
    if (!container) return;
    const types = [...new Set(this.ships.map(s => s.type))].sort();
    const saved = this._loadTypeCheckboxes();
    container.innerHTML = '';
    types.forEach(type => {
      const label = document.createElement('label');
      label.className = 'ship-type-cb-label';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = type;
      cb.checked = saved ? saved.has(type) : true;
      cb.addEventListener('change', () => { this._saveTypeCheckboxes(); this._updateFilterOptions(); });
      label.appendChild(cb);
      label.appendChild(document.createTextNode(WoWS.SHIP_TYPE_LABELS[type] || type));
      container.appendChild(label);
    });
  }

  _loadTypeCheckboxes() {
    try {
      const raw = localStorage.getItem('wows_allowed_types');
      if (!raw) return null;
      return new Set(JSON.parse(raw));
    } catch { return null; }
  }

  _saveTypeCheckboxes() {
    const container = this._el('wowsTypeCheckboxes');
    if (!container) return;
    const boxes = container.querySelectorAll('input[type=checkbox]');
    const checked = [...boxes].filter(b => b.checked).map(b => b.value);
    try { localStorage.setItem('wows_allowed_types', JSON.stringify(checked)); } catch {}
  }

  _updateGsSpinBtn() {
    const btn = this._el('shipGsSpinBtn');
    if (!btn) return;
    const inGs     = document.body.classList.contains('greenscreen');
    const shipPane = this._el('shipModePanel');
    const inShip   = shipPane && shipPane.style.display !== 'none';
    btn.style.display = (inGs && inShip && this.isLoaded && !this.isSpinning) ? 'block' : 'none';
  }

  _rebuildTierSelect(id, values, currentVal) {
    const el = this._el(id);
    if (!el) return;
    const isMin = id === 'wowsTierMin';
    el.innerHTML = `<option value="">${isMin ? 'From: Any' : 'To: Any'}</option>`;
    values.forEach(v => {
      const opt = document.createElement('option');
      opt.value       = v;
      opt.textContent = `Tier ${this._roman(v)}`;
      el.appendChild(opt);
    });
    const match = values.find(v => Number(v) === Number(currentVal));
    el.value = match !== undefined ? String(currentVal) : '';
  }

  _rebuildSelect(id, values, currentVal, labelFn) {
    const el = this._el(id);
    if (!el) return;
    el.innerHTML = '<option value="">🎰 Spin</option>';
    values.forEach(v => {
      const opt = document.createElement('option');
      opt.value       = v;
      opt.textContent = labelFn(v);
      el.appendChild(opt);
    });
    const match = values.find(v => String(v) === String(currentVal));
    el.value = match !== undefined ? currentVal : '';
  }

  _roman(n) {
    const pairs = [[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
    let v = Number(n), r = '';
    for (const [num, sym] of pairs) while (v >= num) { r += sym; v -= num; }
    return r || String(n);
  }

  // ── Palette modal ─────────────────────────────────────────────────────────

  openPaletteModal() {
    const grid  = document.getElementById('paletteGrid');
    const modal = document.getElementById('paletteModal');
    if (!grid || !modal) return;
    grid.innerHTML = '';
    WHEEL_PALETTES.forEach((p, i) => {
      const card = document.createElement('div');
      card.className = 'palette-card' + (i === this._paletteIdx ? ' active' : '');
      const swatches = p.colors.slice(0, 8).map(c => `<span class="palette-swatch" style="background:${c}"></span>`).join('');
      card.innerHTML = `<div class="palette-swatches">${swatches}</div><div class="palette-name">${p.name}</div>`;
      card.addEventListener('click', () => {
        this._paletteIdx = i;
        try { localStorage.setItem('ship_palette', String(i)); } catch {}
        modal.style.display = 'none';
      });
      grid.appendChild(card);
    });
    modal.style.display = 'flex';
  }

  // ── Spin ──────────────────────────────────────────────────────────────────

  // Sequential spin order: Tier → Nation → Type → Ship
  async spin() {
    if (!this.isLoaded || this.isSpinning) return;

    const f = this._getFilters();
    const tierRange   = { min: f.tierMin, max: f.tierMax };
    const tierLocked  = f.tierMin && f.tierMax && f.tierMin === f.tierMax;

    const SPIN_ORDER  = ['tier', 'type', 'nation'];
    let spinCats      = SPIN_ORDER.filter(c => {
      if (c === 'tier') return !tierLocked;
      return !f[c];
    });
    if (this._randomOrderEnabled && spinCats.length > 1) {
      for (let i = spinCats.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [spinCats[i], spinCats[j]] = [spinCats[j], spinCats[i]];
      }
    }

    // Seed accumulated with locked values
    const accumulated = {
      tier:         tierLocked ? String(f.tierMin) : '',
      type:         f.type,
      nation:       f.nation,
      allowedTypes: f.allowedTypes,
    };

    if (!this._matchingShips(accumulated, tierRange).length) { this._showNoMatch(); return; }

    this.isSpinning = true;
    this._updateGsSpinBtn();
    const spinBtn = this._el('wowsSpinBtn');
    if (spinBtn) { spinBtn.disabled = true; spinBtn.textContent = 'Spinning…'; }

    this._buildSingleWheelUI();

    try {
      for (const cat of spinCats) {
        const options = this._uniqueValues(cat, accumulated, tierRange);
        const targetIdx = Math.floor(Math.random() * options.length);

        const result = await this._doSpin(cat, options, targetIdx);
        accumulated[cat] = result;

        // Brief dramatic reveal of each step result
        await this._showStepReveal(cat, result);
        this._updateResultsBar(accumulated);
        await new Promise(r => setTimeout(r, 300));
      }

      const pool = this._matchingShips(accumulated, tierRange);
      if (!pool.length) { this._showNoMatch(); return; }

      const winnerShip = pool[Math.floor(Math.random() * pool.length)];

      // Fetch stats in parallel with the final spin — no extra wait time
      const showStats = this._el('wowsShowStatsToggle')?.checked !== false;
      const statsPromise = showStats
        ? WoWS.fetchShipStats(this.accountId, winnerShip.ship_id, this.region).catch(() => null)
        : Promise.resolve(null);

      await this._doFinalShipSpin(pool, winnerShip);
      await new Promise(r => setTimeout(r, 500));

      const stats = await statsPromise;
      this._addToHistory(winnerShip);
      if (this._confettiEnabled) this._launchConfetti();
      this._showResult(winnerShip, stats);

    } catch (err) {
      console.error('Ship spin error:', err);
      this.isSpinning = false;
      if (spinBtn) { spinBtn.disabled = false; spinBtn.textContent = '⚓ Spin for Ship'; }
      this._updateGsSpinBtn();
    }
  }

  // ── Wheel UI ──────────────────────────────────────────────────────────────

  _buildSingleWheelUI() {
    if (this._singleWheel) { try { this._singleWheel.destroy(); } catch {} this._singleWheel = null; }
    this._wheels.forEach(w => { try { w.destroy(); } catch {} });
    this._wheels = [];

    const stage = this._el('shipWheelStage');
    if (!stage) return;
    stage.innerHTML = '';
    stage.style.flexDirection = 'column';
    stage.style.alignItems    = 'center';

    const lbl = document.createElement('div');
    lbl.id        = 'shipSpinLabel';
    lbl.className = 'ship-spin-label';
    lbl.textContent = 'Preparing…';
    stage.appendChild(lbl);

    const size = Math.min(520, (stage.clientWidth || 700) - 60);
    const slot = document.createElement('div');
    slot.style.cssText = `position:relative; width:${size}px; height:${size}px; flex-shrink:0`;

    const host = document.createElement('div');
    host.style.cssText = 'width:100%; height:100%';
    slot.appendChild(host);

    const ptr = document.createElement('div');
    ptr.className = 'wheel-pointer';
    slot.appendChild(ptr);

    stage.appendChild(slot);

    const bar = document.createElement('div');
    bar.id        = 'shipSpinResults';
    bar.className = 'ship-spin-results';
    stage.appendChild(bar);

    this._singleWheel = new SimpleCanvasWheel(host, { items: [] });
    this._singleWheel.onCurrentIndexChange = (e) => {
      if (!this._tickEnabled) return;
      if (this._lastTickStep !== e.currentIndex) { this._lastTickStep = e.currentIndex; this._playTick(); }
    };
  }

  async _doSpin(cat, options, targetIdx) {
    const CAT_LABELS = { tier: 'Tier', nation: 'Nation', type: 'Ship Type' };
    const lbl = this._el('shipSpinLabel');

    if (options.length === 1) {
      if (lbl) lbl.textContent = `${CAT_LABELS[cat]}: only one option`;
      return options[0];
    }

    if (lbl) lbl.textContent = `Spinning for ${CAT_LABELS[cat]}…`;

    const palette = WHEEL_PALETTES?.[this._paletteIdx] || WHEEL_PALETTES?.[0]
                    || { colors: ['#4f46e5','#7c3aed','#b91c1c','#d97706','#0891b2','#059669'] };

    const items = options.map((v, i) => {
      const bg = palette.colors[i % palette.colors.length];
      let label = String(v);
      if (cat === 'tier')        label = 'Tier ' + this._roman(v);
      else if (cat === 'type')   label = WoWS.SHIP_TYPE_LABELS[v] || v;
      else if (cat === 'nation') label = WoWS.NATION_LABELS[v]    || v;
      return { label, backgroundColor: bg, labelColor: this._pickText(bg) };
    });

    this._singleWheel.setItems(items);
    this._singleWheel.startIdle();
    await new Promise(r => setTimeout(r, 2500));
    return new Promise(resolve => {
      this._singleWheel.onRest = () => resolve(options[targetIdx]);
      this._singleWheel.spinToIndex(targetIdx, 6000, 6, { randomOffsetFactor: 0.6 });
    });
  }

  async _doFinalShipSpin(pool, winnerShip) {
    const lbl = this._el('shipSpinLabel');

    if (pool.length === 1) {
      if (lbl) lbl.textContent = 'Ship: only one option';
      return winnerShip;
    }

    if (lbl) lbl.textContent = 'Spinning for Ship…';

    let sample;
    if (pool.length <= 30) {
      sample = pool.slice();
    } else {
      const rest = pool.filter(s => s.ship_id !== winnerShip.ship_id);
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      sample = [winnerShip, ...rest.slice(0, 29)];
      for (let i = sample.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [sample[i], sample[j]] = [sample[j], sample[i]];
      }
    }

    const winnerIdx = sample.findIndex(s => s.ship_id === winnerShip.ship_id);
    const palette   = WHEEL_PALETTES?.[this._paletteIdx] || WHEEL_PALETTES?.[0]
                      || { colors: ['#4f46e5','#7c3aed','#b91c1c','#d97706','#0891b2','#059669'] };

    const items = sample.map((s, i) => {
      const bg = palette.colors[i % palette.colors.length];
      return { label: s.name, backgroundColor: bg, labelColor: this._pickText(bg) };
    });

    this._singleWheel.setItems(items);
    this._singleWheel.startIdle();
    await new Promise(r => setTimeout(r, 3000));
    return new Promise(resolve => {
      this._singleWheel.onRest = () => resolve(winnerShip);
      this._singleWheel.spinToIndex(winnerIdx, 8000, 6, { randomOffsetFactor: 0.6 });
    });
  }

  _updateResultsBar(accumulated) {
    const el = this._el('shipSpinResults');
    if (!el) return;
    el.innerHTML = '';
    const fmt = {
      tier:   v => `Tier ${this._roman(v)}`,
      type:   v => WoWS.SHIP_TYPE_LABELS[v] || v,
      nation: v => WoWS.NATION_LABELS[v]    || v,
    };
    for (const [cat, val] of Object.entries(accumulated)) {
      if (!val || !fmt[cat]) continue;
      const chip = document.createElement('span');
      chip.className   = 'ship-result-chip';
      chip.textContent = fmt[cat](val);
      el.appendChild(chip);
    }
  }

  // ── Step reveal overlay ───────────────────────────────────────────────────

  _showStepReveal(cat, value) {
    return new Promise(resolve => {
      const stage = this._el('shipWheelStage');
      if (!stage) { setTimeout(resolve, 1300); return; }

      const CAT_LABELS = { tier: 'Tier', nation: 'Nation', type: 'Ship Type' };
      const fmt = {
        tier:   v => `Tier ${this._roman(v)}`,
        type:   v => WoWS.SHIP_TYPE_LABELS[v] || v,
        nation: v => WoWS.NATION_LABELS[v]    || v,
      };

      const overlay = document.createElement('div');
      overlay.className = 'ship-step-reveal';
      overlay.innerHTML = `
        <div class="ship-step-reveal-inner">
          <div class="ship-step-reveal-cat">${CAT_LABELS[cat] || cat}</div>
          <div class="ship-step-reveal-val">${fmt[cat]?.(value) ?? value}</div>
        </div>`;
      stage.appendChild(overlay);

      setTimeout(() => {
        overlay.classList.add('ship-step-reveal-out');
        setTimeout(() => { overlay.remove(); resolve(); }, 400);
      }, 1200);
    });
  }

  _pickText(hex) {
    const h = hex.replace('#', '');
    const lum = 0.2126*(parseInt(h.slice(0,2),16)/255)
              + 0.7152*(parseInt(h.slice(2,4),16)/255)
              + 0.0722*(parseInt(h.slice(4,6),16)/255);
    return lum > 0.55 ? '#111827' : '#f9fafb';
  }

  // ── Result modal ──────────────────────────────────────────────────────────

  _showResult(ship, stats) {
    const modal = this._el('shipResultModal');
    if (!modal) return;
    const imgEl = this._el('shipResultImage');
    if (imgEl) {
      const url = ship.images?.medium || ship.images?.small || ship.images?.preview || '';
      imgEl.src = url;
      imgEl.style.display = url ? '' : 'none';
    }
    this._el('shipResultTier').textContent  = `Tier ${this._roman(ship.tier)}`;
    this._el('shipResultName').textContent  = ship.name;
    this._el('shipResultMeta').textContent  =
      `${WoWS.SHIP_TYPE_LABELS[ship.type] || ship.type}  ·  ${WoWS.NATION_LABELS[ship.nation] || ship.nation}`;

    const statsEl = this._el('shipResultStats');
    if (statsEl) {
      const rows = [];
      const fmt = (cat, label) => {
        const s = stats?.[cat];
        if (!s?.battles) return;
        const wr  = (s.wins / s.battles * 100).toFixed(1);
        const cls = wr >= 60 ? 'wr-great' : wr >= 50 ? 'wr-good' : 'wr-bad';
        rows.push(`<div class="ship-stat-row">
          <span class="ship-stat-label">${label}</span>
          <span class="ship-stat-val ${cls}">${wr}%</span>
          <span class="ship-stat-battles">${s.battles.toLocaleString()} battles</span>
        </div>`);
      };
      fmt('pvp',       'Random');
      fmt('rank_solo', 'Ranked');
      statsEl.innerHTML = rows.join('');
      statsEl.style.display = rows.length ? '' : 'none';
    }

    modal.style.display = 'flex';
  }

  _showNoMatch() {
    const modal = this._el('shipResultModal');
    if (!modal) return;
    this._el('shipResultTier').textContent = '';
    this._el('shipResultName').textContent = 'No match';
    this._el('shipResultMeta').textContent = 'No ships match these filters. Try different settings.';
    modal.style.display = 'flex';
    this.isSpinning = false;
    const btn = this._el('wowsSpinBtn');
    if (btn) { btn.disabled = false; btn.textContent = '⚓ Spin for Ship'; }
    this._updateGsSpinBtn();
  }

  // ── Ship history ──────────────────────────────────────────────────────────

  _addToHistory(ship) {
    this._history.unshift({
      ship_id: ship.ship_id,
      name:    ship.name,
      tier:    ship.tier,
      type:    ship.type,
      nation:  ship.nation,
      ts:      Date.now(),
    });
    // Keep max 50 entries
    if (this._history.length > 50) this._history.length = 50;
    try { localStorage.setItem('ship_history', JSON.stringify(this._history)); } catch {}
    this._renderHistory();
  }

  _renderHistory() {
    const list = this._el('shipHistoryList');
    if (!list) return;
    if (!this._history.length) {
      list.innerHTML = '<div style="color:#475569;font-size:12px;padding:8px 0">No ships selected yet.</div>';
      return;
    }
    list.innerHTML = '';
    this._history.forEach(s => {
      const item = document.createElement('div');
      item.className = 'ship-history-item';
      item.innerHTML = `
        <span class="ship-history-tier">T${this._roman(s.tier)}</span>
        <span class="ship-history-name">${s.name}</span>
        <span class="ship-history-meta">${WoWS.SHIP_TYPE_LABELS[s.type] || s.type} · ${WoWS.NATION_LABELS[s.nation] || s.nation}</span>`;
      list.appendChild(item);
    });
  }

  _playTick() {
    try {
      if (!this._audioCtx) this._audioCtx = new (window.AudioContext || (/** @type {any} */(window)).webkitAudioContext)();
      const ctx = this._audioCtx;
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

  _launchConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const colors = ['#ff6b6b','#feca57','#54a0ff','#5f27cd','#1dd1a1'];
    const parts = Array.from({length: 120}, () => ({
      x: Math.random()*canvas.width, y: -20 - Math.random()*canvas.height*0.5,
      r: 4+Math.random()*6, c: colors[Math.floor(Math.random()*colors.length)],
      vx: -2+Math.random()*4, vy: 2+Math.random()*3,
      spin: Math.random()*Math.PI, vr: -0.2+Math.random()*0.4,
    }));
    const endAt = Date.now() + 5000;
    const step = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.spin += p.vr;
        if (p.y > canvas.height + 20) { p.y = -10; p.x = Math.random()*canvas.width; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.spin);
        ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r, p.r*2, p.r*2); ctx.restore();
      }
      if (Date.now() < endAt) requestAnimationFrame(step);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    requestAnimationFrame(step);
  }

  // Allow app.js to sync the palette choice
  setPaletteIndex(idx) { this._paletteIdx = idx; }
}

// ── Mode switching ────────────────────────────────────────────────────────────

function switchAppMode(mode) {
  document.querySelectorAll('.mode-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.mode === mode)
  );

  const show = (id, visible) => {
    const el = document.getElementById(id);
    if (el) el.style.display = visible ? '' : 'none';
  };
  const showQ = (sel, visible) => {
    document.querySelectorAll(sel).forEach(el => { el.style.display = visible ? '' : 'none'; });
  };

  const isShip = mode === 'ship';

  show('giveawayPanel',        !isShip);
  show('shipModePanel',         isShip);
  show('shipWheelStage',        isShip);
  show('giveawaySidebar',      !isShip);
  show('shipHistorySidebar',    isShip);
  showQ('.wheel-stage',        !isShip);
  showQ('.giveaway-controls',  !isShip);
  show('wheelInfo',            !isShip);
  show('entryInfo',            !isShip);

  if (isShip && window.shipMode) window.shipMode._renderHistory();

  try { localStorage.setItem('app_mode', mode); } catch {}
}

document.addEventListener('DOMContentLoaded', () => {
  window.shipMode = new ShipWheelMode();
  window.shipMode.init();

  const gsBtn = document.getElementById('exitGreenScreenBtn');
  if (gsBtn) {
    const updateGsBtn = () => {
      gsBtn.textContent = document.body.classList.contains('greenscreen') ? '✕ Exit Green Screen' : '⬛ Green Screen';
    };
    gsBtn.addEventListener('click', () => {
      if (window._toggleGreenScreen) {
        window._toggleGreenScreen();
      } else {
        document.body.classList.toggle('greenscreen');
      }
      if (window.shipMode?._singleWheel?.resize) try { window.shipMode._singleWheel.resize(); } catch {}
      updateGsBtn();
      window.shipMode?._updateGsSpinBtn();
    });
    updateGsBtn();
  }

  document.querySelectorAll('.mode-tab').forEach(tab => {
    tab.addEventListener('click', () => switchAppMode(tab.dataset.mode));
  });

  // Restore last mode
  try {
    const saved = localStorage.getItem('app_mode');
    if (saved === 'ship') switchAppMode('ship');
  } catch {}
});
