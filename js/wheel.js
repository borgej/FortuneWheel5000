class SimpleCanvasWheel {
  constructor(container, { items = [], onSpin, onCurrentIndexChange, onRest, viewMode = 'full', metallic = false } = {}) {
    this.container = container;
    this.items = items;
    this.onSpin = onSpin;
    this.onCurrentIndexChange = onCurrentIndexChange;
    this.onRest = onRest;
    // Riveted brass/steel rendering used by the Majorpar theme — same geometry,
    // just heavier gradients and bolt-style trim instead of the flat look.
    this.metallic = !!metallic;
    // 'full' = whole wheel, pointer at 3 o'clock.
    // 'zoom' = wheel blown up and pushed off-stage to the right so only the arc
    //          next to the pointer (now at 9 o'clock) is visible.
    this.viewMode = viewMode === 'zoom' ? 'zoom' : 'full';
    this.pointerAngle = this.viewMode === 'zoom' ? Math.PI : 0;
    // Randomize the starting orientation so the same join order doesn't always
    // draw the same participant at the pointer — purely cosmetic, computed
    // once per wheel and never touches which slice index maps to which name.
    this.rotation = this._norm(this.pointerAngle + Math.random() * Math.PI * 2);
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

  setMetallic(v) {
    const next = !!v;
    if (next === this.metallic) return;
    this.metallic = next;
    this.draw();
  }

  setViewMode(mode) {
    const next = mode === 'zoom' ? 'zoom' : 'full';
    if (next === this.viewMode) return;
    const prevPointer = this.pointerAngle;
    this.viewMode = next;
    this.pointerAngle = next === 'zoom' ? Math.PI : 0;
    // Move the wheel by the same amount the pointer moved, so whatever slice
    // was under the pointer stays under it across the switch.
    this.rotation = this._norm(this.rotation + (this.pointerAngle - prevPointer));
    this.draw();
  }

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

  _norm(a) { const t = Math.PI * 2; return ((a % t) + t) % t; }

  _geometry() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;
    if (this.viewMode === 'zoom') {
      // Rim at the pointer on the left, hub at the right edge: the cutout spans
      // the wheel's whole radius, so labels get the full width to run in.
      const cx = w * SimpleCanvasWheel.ZOOM_HUB_RATIO;
      return { w, h, r: cx - w * SimpleCanvasWheel.ZOOM_RIM_RATIO, cx, cy: h / 2 };
    }
    return { w, h, r: Math.min(w, h) * 0.48, cx: w / 2, cy: h / 2 };
  }

  currentIndex() {
    if (!this.items.length) return 0;
    const a = this._norm(this.pointerAngle - this.rotation);
    return Math.floor(a / this.sliceAngle) % this.items.length;
  }

  draw() {
    const ctx = this.ctx;
    const { w, h, r, cx, cy } = this._geometry();
    ctx.clearRect(0, 0, w, h);
    if (!this.items.length) return;
    const slice = this.sliceAngle;
    const isGreen = document.body.classList.contains('greenscreen');
    const zoom = this.viewMode === 'zoom';
    const maxFont = zoom ? 44 : 22;
    const maxLabelLen = w * (1 - SimpleCanvasWheel.ZOOM_RIM_RATIO) * 0.9;

    // -- Rotated section: slices, labels, pins, rim --
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.rotation);

    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      const start = i * slice;
      const end = start + slice;
      const midScreen = this._norm(start + slice / 2 + this.rotation);
      const base = it.backgroundColor || '#999';

      // Radial gradient fill — bright centre, richer toward rim. Metallic mode
      // adds a hot specular band and a darker edge to read as brushed metal.
      const grad = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
      if (this.metallic) {
        grad.addColorStop(0, this._lightenColor(base, 70));
        grad.addColorStop(0.35, this._lightenColor(base, 25));
        grad.addColorStop(0.55, base);
        grad.addColorStop(0.8, this._darkenColor(base, 30));
        grad.addColorStop(1, this._darkenColor(base, 55));
      } else {
        grad.addColorStop(0, this._lightenColor(base, 55));
        grad.addColorStop(0.65, base);
        grad.addColorStop(1, this._darkenColor(base, 25));
      }
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, start, end, false);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Slice border — metallic mode fakes a grooved panel seam (wide dark
      // groove with a thin bright highlight riding down the middle)
      if (this.metallic) {
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,220,150,0.45)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.28)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Label with soft shadow — font scales with slice arc width
      const mid = start + slice / 2;
      ctx.save();
      ctx.rotate(mid);
      // Available tangential space at the label radius
      const arcHeight = r * 0.85 * slice;
      const fontSize = Math.floor(Math.min(maxFont, arcHeight * 0.6, r * 0.08));
      if (fontSize >= 7) {
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${fontSize}px Segoe UI, sans-serif`;
        ctx.fillStyle = it.labelColor || '#111827';
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 4;
        const outer = r * 0.94;
        const inner = r * 0.25;
        let pathLen = outer - inner;
        if (zoom) pathLen = Math.min(pathLen, maxLabelLen);
        // Names on the left half read upside down; in zoom view that is exactly
        // where the pointer is, so flip them and write outward-in from the rim.
        if (zoom && Math.cos(midScreen) < 0) {
          ctx.rotate(Math.PI);
          ctx.textAlign = 'left';
          ctx.translate(-outer, 0);
        } else {
          ctx.textAlign = 'right';
          ctx.translate(outer, 0);
        }
        const text = (it.label || '').toString();
        let clipped = text;
        while (clipped.length > 1 && ctx.measureText(clipped).width > pathLen) {
          clipped = clipped.slice(0, -1);
        }
        ctx.fillText(clipped, 0, 0);
      }
      ctx.restore();
    }

    // Rim pins at each slice boundary — brass rivets in metallic mode
    for (let i = 0; i < this.items.length; i++) {
      const angle = i * slice;
      const pinR = this.metallic ? 6 : 4;
      const px = Math.cos(angle) * (r - pinR - 1);
      const py = Math.sin(angle) * (r - pinR - 1);
      ctx.beginPath();
      ctx.arc(px, py, pinR, 0, Math.PI * 2);
      if (this.metallic) {
        const pinGrad = ctx.createRadialGradient(px - pinR * 0.3, py - pinR * 0.3, 0.5, px, py, pinR);
        pinGrad.addColorStop(0, '#fff3d0');
        pinGrad.addColorStop(0.4, '#f0b429');
        pinGrad.addColorStop(1, '#5c3a1e');
        ctx.fillStyle = pinGrad;
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
      }
      ctx.fill();
      ctx.strokeStyle = this.metallic ? 'rgba(20,10,0,0.6)' : 'rgba(80,80,80,0.35)';
      ctx.lineWidth = this.metallic ? 1.2 : 0.8;
      ctx.stroke();
    }

    // Outer border ring — a layered steel-and-brass bevel in metallic mode
    if (this.metallic) {
      ctx.beginPath(); ctx.arc(0, 0, r + 9, 0, Math.PI * 2);
      ctx.strokeStyle = '#1a1008'; ctx.lineWidth = 8; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,230,180,0.5)'; ctx.lineWidth = 1; ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
      ctx.strokeStyle = isGreen ? '#9ca3af' : 'rgba(56,189,248,0.6)';
      ctx.lineWidth = 5;
      ctx.stroke();
    }

    ctx.restore(); // end rotation

    // -- Centre hub: plain disc, or a riveted brass plate in metallic mode --
    ctx.save();
    ctx.translate(cx, cy);
    const hubR = Math.max(16, r * 0.088);
    ctx.beginPath();
    ctx.arc(0, 0, hubR, 0, Math.PI * 2);
    if (this.metallic) {
      const hubGrad = ctx.createRadialGradient(-hubR * 0.3, -hubR * 0.3, hubR * 0.1, 0, 0, hubR);
      hubGrad.addColorStop(0, '#fff3d0');
      hubGrad.addColorStop(0.45, '#c9a227');
      hubGrad.addColorStop(1, '#3d2b1f');
      ctx.fillStyle = hubGrad;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(20,10,0,0.6)';
      ctx.stroke();
      const rivetCount = 6;
      const rivetR = Math.max(1.5, hubR * 0.08);
      for (let k = 0; k < rivetCount; k++) {
        const a = (k / rivetCount) * Math.PI * 2;
        const rx = Math.cos(a) * hubR * 0.72, ry = Math.sin(a) * hubR * 0.72;
        ctx.beginPath();
        ctx.arc(rx, ry, rivetR, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(20,10,0,0.55)';
        ctx.fill();
      }
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fill();
    }
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
    const desired = this._norm(this.pointerAngle - (targetIndex + 0.5) * slice - signedOffset);
    const startRot = this._norm(this.rotation);

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
        this.rotation = this._norm(this.rotation);
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

// Zoom view geometry, as fractions of the stage width: the rim sits at the
// pointer and the hub at the right edge, so the cutout spans the full radius.
// ZOOM_RIM_RATIO must stay in sync with the `body.wheel-zoom .wheel-pointer`
// offset in styles.css.
SimpleCanvasWheel.ZOOM_RIM_RATIO = 0.10;
SimpleCanvasWheel.ZOOM_HUB_RATIO = 0.97;
