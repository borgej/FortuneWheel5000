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
