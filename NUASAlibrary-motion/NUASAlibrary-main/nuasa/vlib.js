/* NUASA Virtual Library: a walk-in 3D reading hall. Loaded by index.html, runs inside #vlp.
   Shelves are stocked from the real approved library files (S.res). Three.js loads on demand from the CDN. */
(function () {
'use strict';
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js';
const KEY_NAME = 'nuasa_vl_name', KEY_STATS = 'nuasa_vl_stats', KEY_SET = 'nuasa_vl_set';
const $ = (s, r) => (r || document).querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* optional */ } };
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const coarse = () => matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;

/* ---------- bridge to the site (all optional, guarded) ---------- */
const site = {
  res() { return (typeof S !== 'undefined' && S && S.res) || []; },
  course(id) { try { return cn(id) || []; } catch (e) { return []; } },
  sb() { try { return typeof sb !== 'undefined' ? sb : null; } catch (e) { return null; } },
  user() { try { return S && S.user; } catch (e) { return null; } },
  name() { try { const n = S.profile && S.profile.full_name; return n ? String(n).trim().split(/\s+/)[0] : ''; } catch (e) { return ''; } },
  toast(m) { try { toast(m); } catch (e) { /* */ } },
  preview(id) { try { pv(id); } catch (e) { site.toast('Preview is not available.'); } },
  get(id) { try { get(id); } catch (e) { site.toast('Download is not available.'); } },
  upload() { try { openUpload(); } catch (e) { site.toast('Upload is not available right now.'); } },
  type(t) { try { return (TY && TY[t]) || 'Resource'; } catch (e) { return 'Resource'; } },
};

/* ---------- loader ---------- */
let threeP = null;
function loadThree() {
  if (window.THREE) return Promise.resolve();
  if (threeP) return threeP;
  threeP = new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = THREE_URL; s.onload = ok;
    s.onerror = () => { threeP = null; no(new Error('three')); };
    document.head.appendChild(s);
  });
  return threeP;
}

/* ---------- books from the site ---------- */
const CAT = { past_question: 'A', lecture_note: 'B', textbook: 'C' };
const TYPE_COLOR = { A: 0x2f6f4f, B: 0x2d4f8a, C: 0x8a2d3b, D: 0xb8862b, G: 0x5b4a8a };
function makeBooks() {
  const R = site.res(), out = [];
  if (R.length) {
    R.forEach(r => {
      const c = site.course(r.course_id);
      const row = !r.course_id ? 'G' : (CAT[r.type] || 'D');
      out.push({ id: r.id, title: r.title || 'Untitled', type: site.type(r.type), course: c[0] || 'General', courseTitle: c[1] || 'General library', session: r.session || '', size: r.file_size || 0, downloads: r.downloads || 0, link: !!r.external_url, row, res: r });
    });
    return out;
  }
  const demo = {
    A: ['ACC 101 · Past Questions', 'ACC 201 · Past Questions', 'ACC 301 · Past Questions', 'BUS 101 · Past Questions', 'ECO 101 · Past Questions', 'MTH 101 · Past Questions', 'GST 101 · Past Questions', 'ACC 401 · Past Questions'],
    B: ['Financial Accounting Notes', 'Cost Accounting Notes', 'Business Law Notes', 'Taxation Notes', 'Auditing Notes', 'Management Accounting Notes'],
    C: ['Principles of Accounting', 'Intermediate Accounting', 'Business Mathematics', 'Corporate Reporting'],
    D: ['Course Outline Handout', 'Assignment Brief', 'Tutorial Sheet', 'Revision Guide'],
    G: ['Department Handbook', 'Student Guidelines', 'Project Format Guide'],
  };
  Object.keys(demo).forEach(k => demo[k].forEach((t, i) => out.push({ id: 'demo' + k + i, title: t, type: 'Sample', course: 'Sample', courseTitle: 'Sample shelf', session: '', size: 0, downloads: 0, link: false, row: k, demo: true })));
  return out;
}

/* ---------- audio (all synthesised) ---------- */
const AUD = {
  ac: null, master: null, on: true, vol: 0.8, amb: null,
  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    try {
      const A = window.AudioContext || window.webkitAudioContext; if (!A) return;
      this.ac = new A(); this.master = this.ac.createGain(); this.master.gain.value = this.on ? this.vol : 0; this.master.connect(this.ac.destination);
      const n = this.ac.sampleRate * 2, b = this.ac.createBuffer(1, n, this.ac.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      this.buf = b;
      const src = this.ac.createBufferSource(); src.buffer = b; src.loop = true;
      const lp = this.ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
      const g = this.ac.createGain(); g.gain.value = 0.05;
      src.connect(lp); lp.connect(g); g.connect(this.master); src.start(); this.amb = g;
    } catch (e) { this.ac = null; }
  },
  setOn(o) { this.on = o; if (this.master) this.master.gain.value = o ? this.vol : 0; },
  setVol(v) { this.vol = v; if (this.master && this.on) this.master.gain.value = v; },
  noise(dur, type, f0, f1, q, vol, att) {
    if (!this.ac || !this.on) return;
    const t = this.ac.currentTime, s = this.ac.createBufferSource(); s.buffer = this.buf; s.playbackRate.value = rnd(0.8, 1.2);
    const f = this.ac.createBiquadFilter(); f.type = type; f.Q.value = q || 1; f.frequency.setValueAtTime(f0, t); f.frequency.linearRampToValueAtTime(f1 || f0, t + dur);
    const g = this.ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (att || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  },
  tone(f0, f1, dur, vol, type) {
    if (!this.ac || !this.on) return;
    const t = this.ac.currentTime, o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  },
  step() { this.noise(0.07, 'bandpass', rnd(600, 900), 500, 1.2, 0.07); this.tone(95, 55, 0.07, 0.05); },
  page(v) { this.noise(0.22, 'bandpass', 3800, 1400, 0.8, v || 0.12, 0.04); },
  thud() { this.tone(130, 45, 0.16, 0.2); this.noise(0.12, 'lowpass', 500, 200, 1, 0.1); },
  chair() { this.noise(0.32, 'lowpass', 520, 260, 1, 0.12, 0.05); },
  shh(v) { this.noise(1.0, 'bandpass', 5200, 6200, 1.1, v || 0.26, 0.22); this.noise(1.0, 'highpass', 3200, 3200, 0.7, (v || 0.26) * 0.5, 0.22); },
  bell() { this.tone(1760, 1750, 0.9, 0.12); this.tone(2637, 2630, 0.5, 0.05); },
  tick(a) { this.tone(a ? 1900 : 1500, a ? 1700 : 1300, 0.018, 0.025, 'square'); },
  pop() { this.tone(520, 880, 0.09, 0.07, 'triangle'); },
  warn() { this.tone(330, 262, 0.35, 0.09, 'triangle'); },
};

/* ---------- speech (librarian only) ---------- */
let voicesOn = true, voicePick = null;
function speak(text, pitch) {
  if (!voicesOn || !AUD.on || typeof speechSynthesis === 'undefined') return;
  try {
    if (!voicePick) { const all = speechSynthesis.getVoices(); voicePick = all.find(v => /en-NG/i.test(v.lang)) || all.find(v => /en-GB/i.test(v.lang)) || all.find(v => /^en/i.test(v.lang)) || null; }
    const u = new SpeechSynthesisUtterance(text); if (voicePick) u.voice = voicePick;
    u.pitch = pitch || 1.15; u.rate = 0.95; u.volume = Math.min(1, AUD.vol + 0.15);
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch (e) { /* optional */ }
}

/* ---------- canvas helpers ---------- */
const hexStr = n => '#' + ('000000' + (n >>> 0).toString(16)).slice(-6);
const mkCv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function wrapText(x, text, maxW, font) {
  x.font = font; const words = String(text).split(/\s+/), lines = []; let cur = '';
  words.forEach(w => { const t = cur ? cur + ' ' + w : w; if (x.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
  if (cur) lines.push(cur); return lines;
}
function rrect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }

/* ================= WORLD ================= */
const HX = 13, HZ = 10, WH = 5;
let T = null;      // THREE
let W = null;      // current world
const matCache = {};
const lam = (c, o) => { const k = c + JSON.stringify(o || {}); return matCache[k] || (matCache[k] = new T.MeshLambertMaterial(Object.assign({ color: c }, o || {}))); };
const basic = (c, o) => new T.MeshBasicMaterial(Object.assign({ color: c }, o || {}));

/* Merges many coloured boxes into one mesh (vertex colours): keeps the draw-call count low. */
function Merger() { this.p = []; this.n = []; this.c = []; this.i = []; this.v = 0; }
Merger.prototype.add = function (g, color, x, y, z, ry) {
  const m = new T.Matrix4().makeRotationY(ry || 0); m.setPosition(x, y, z); g.applyMatrix4(m);
  const col = new T.Color(color), pa = g.attributes.position, na = g.attributes.normal, ia = g.index;
  for (let i = 0; i < pa.count; i++) { this.p.push(pa.getX(i), pa.getY(i), pa.getZ(i)); this.n.push(na.getX(i), na.getY(i), na.getZ(i)); this.c.push(col.r, col.g, col.b); }
  for (let i = 0; i < ia.count; i++) this.i.push(ia.getX(i) + this.v);
  this.v += pa.count; g.dispose(); return this;
};
Merger.prototype.box = function (w, h, d, x, y, z, color, ry) { return this.add(new T.BoxGeometry(w, h, d), color, x, y, z, ry); };
Merger.prototype.cyl = function (r1, r2, h, x, y, z, color, seg) { return this.add(new T.CylinderGeometry(r1, r2, h, seg || 12), color, x, y, z, 0); };
Merger.prototype.mesh = function () {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(this.n, 3)); g.setAttribute('color', new T.Float32BufferAttribute(this.c, 3));
  g.setIndex(this.i); g.computeBoundingSphere();
  return new T.Mesh(g, lam(0xffffff, { vertexColors: true }));
};

function woodTexture(base, planks, repX, repY) {
  const c = mkCv(256, 256), x = c.getContext('2d'), ph = 256 / planks;
  for (let i = 0; i < planks; i++) {
    const sh = (Math.random() * 28 - 14) | 0;
    x.fillStyle = `rgb(${base[0] + sh},${base[1] + sh},${base[2] + sh})`; x.fillRect(0, i * ph, 256, ph);
    for (let k = 0; k < 16; k++) { x.strokeStyle = `rgba(60,35,15,${0.05 + Math.random() * 0.1})`; x.beginPath(); const y = i * ph + Math.random() * ph; x.moveTo(0, y); x.bezierCurveTo(80, y + rnd(-3, 3), 170, y + rnd(-3, 3), 256, y + rnd(-2, 2)); x.stroke(); }
    x.fillStyle = 'rgba(30,18,8,.4)'; x.fillRect(0, i * ph + ph - 1.5, 256, 1.5);
    x.fillRect(Math.random() * 256, i * ph, 1.5, ph);
  }
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repX, repY); t.anisotropy = W.aniso; return t;
}
function plasterTexture() {
  const c = mkCv(128, 128), x = c.getContext('2d'); x.fillStyle = '#efe5d0'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '120,95,60' : '255,255,255'},${Math.random() * 0.05})`; x.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; return t;
}
function glowTexture(kind) {
  const c = mkCv(64, 256), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(255,238,190,.75)'); g.addColorStop(1, 'rgba(255,238,190,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 256); x.globalCompositeOperation = 'destination-in';
  const h = x.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, 'rgba(0,0,0,0)'); h.addColorStop(0.5, '#000'); h.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = h; x.fillRect(0, 0, 64, 256); return new T.CanvasTexture(c);
}
function aoTexture() {
  const c = mkCv(64, 64), x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 4, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c);
}
function signTexture(title, sub, color, w, h) {
  w = w || 512; h = h || 128; const c = mkCv(w, h), x = c.getContext('2d');
  x.fillStyle = '#2a1a0e'; rrect(x, 0, 0, w, h, 14); x.fill(); x.fillStyle = color || '#e2c26a'; rrect(x, 6, 6, w - 12, h - 12, 10); x.strokeStyle = color || '#e2c26a'; x.lineWidth = 3; x.stroke();
  x.fillStyle = '#f6ecd6'; x.textAlign = 'center'; x.textBaseline = 'middle';
  let fs = 44; x.font = `800 ${fs}px Georgia, serif`; while (x.measureText(title).width > w - 40 && fs > 18) { fs -= 2; x.font = `800 ${fs}px Georgia, serif`; }
  x.fillText(title, w / 2, sub ? h * 0.4 : h / 2);
  if (sub) { x.fillStyle = color || '#e2c26a'; x.font = '600 22px system-ui, sans-serif'; x.fillText(sub, w / 2, h * 0.76); }
  const t = new T.CanvasTexture(c); t.anisotropy = W.aniso; return t;
}
function spineTexture(b) {
  const c = mkCv(64, 300), x = c.getContext('2d'), col = hexStr(b.color);
  x.fillStyle = col; x.fillRect(0, 0, 64, 300); x.fillStyle = 'rgba(255,255,255,.14)'; x.fillRect(0, 0, 5, 300); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(59, 0, 5, 300);
  x.fillStyle = '#e2c26a'; x.fillRect(4, 22, 56, 2); x.fillRect(4, 276, 56, 2);
  x.save(); x.translate(32, 150); x.rotate(Math.PI / 2); x.fillStyle = '#fff7e0'; x.textAlign = 'center'; x.textBaseline = 'middle';
  let t = b.info.title; if (t.length > 34) t = t.slice(0, 33) + '…';
  let fs = 24; x.font = `700 ${fs}px Georgia, serif`; while (x.measureText(t).width > 232 && fs > 12) { fs -= 1; x.font = `700 ${fs}px Georgia, serif`; }
  x.fillText(t, 0, -8); x.fillStyle = '#e2c26a'; x.font = '600 14px system-ui, sans-serif'; x.fillText(b.info.course, 0, 14); x.restore();
  const tx = new T.CanvasTexture(c); tx.anisotropy = 4; return tx;
}

/* ---------- build ---------- */
function buildWorld(canvas) {
  const rd = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  rd.autoClear = false; rd.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  W = { rd, aniso: rd.capabilities.getMaxAnisotropy(), scene: new T.Scene(), view: new T.Scene(), aabbs: [], chairs: [], books: [], rows: {}, pickables: [], seatsTaken: {}, spriteList: [], clockHands: null, shafts: [], dust: null, doorPos: new T.Vector3(0, 0, 8.7), time: 0 };
  const sc = W.scene; sc.background = new T.Color(0xe8dcc3); sc.fog = new T.Fog(0xe8dcc3, 16, 40);
  W.cam = new T.PerspectiveCamera(72, 1, 0.04, 60); W.cam.rotation.order = 'YXZ';
  sc.add(new T.HemisphereLight(0xfff3dc, 0x7a5a3a, 1.05)); sc.add(new T.AmbientLight(0xffffff, 0.35));
  const sun = new T.DirectionalLight(0xfff0d0, 0.65); sun.position.set(3, 9, -12); sc.add(sun);
  W.view.add(new T.AmbientLight(0xffffff, 0.8)); const vd = new T.DirectionalLight(0xfff2dc, 0.7); vd.position.set(0.5, 1, 1); W.view.add(vd);
  W.viewRoot = new T.Group(); W.view.add(W.viewRoot);
  const ao = aoTexture(), aoMat = new T.MeshBasicMaterial({ map: ao, transparent: true, depthWrite: false });
  const blob = (x, z, w, d) => { const m = new T.Mesh(new T.PlaneGeometry(w, d), aoMat); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.012, z); sc.add(m); };
  const bbox = (x, z, hw, hd) => W.aabbs.push({ x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd });

  /* floor, ceiling, walls */
  const fl = new T.Mesh(new T.PlaneGeometry(HX * 2, HZ * 2), new T.MeshLambertMaterial({ map: woodTexture([150, 104, 64], 4, 22, 16.7) })); fl.rotation.x = -Math.PI / 2; sc.add(fl);
  const cl = new T.Mesh(new T.PlaneGeometry(HX * 2, HZ * 2), lam(0xf4ecdc)); cl.rotation.x = Math.PI / 2; cl.position.y = WH; sc.add(cl);
  const pl = plasterTexture(); pl.repeat.set(8, 2);
  const wallM = new T.MeshLambertMaterial({ map: pl });
  const wall = (w, h, x, y, z, ry) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), wallM); m.position.set(x, y, z); m.rotation.y = ry; sc.add(m); return m; };
  wall(HX * 2, WH, 0, WH / 2, -HZ, 0);
  wall(HX * 2, WH, 0, WH / 2, HZ, Math.PI);
  wall(HZ * 2, WH, -HX, WH / 2, 0, Math.PI / 2);
  wall(HZ * 2, WH, HX, WH / 2, 0, -Math.PI / 2);
  /* wainscot, skirting, beams (merged) */
  const trim = new Merger();
  [[0, -HZ + 0.04, HX * 2, 0.08, 0], [0, HZ - 0.04, HX * 2, 0.08, 0], [-HX + 0.04, 0, HZ * 2, 0.08, Math.PI / 2], [HX - 0.04, 0, HZ * 2, 0.08, Math.PI / 2]].forEach(a => trim.box(a[2], 1.0, a[3], a[0], 0.5, a[1], 0x5b3a22, a[4]));
  [[0, -HZ + 0.1, HX * 2, 0], [0, HZ - 0.1, HX * 2, 0], [-HX + 0.1, 0, HZ * 2, Math.PI / 2], [HX - 0.1, 0, HZ * 2, Math.PI / 2]].forEach(a => trim.box(a[2], 0.06, 0.07, a[0], 1.02, a[1], 0x3e2814, a[3]));
  for (let z = -8.75; z <= 8.8; z += 2.5) trim.box(HX * 2, 0.22, 0.28, 0, WH - 0.11, z, 0x4a2f1a);
  [-HX + 0.2, HX - 0.2].forEach(x => { trim.box(0.3, WH, 0.3, x, WH / 2, HZ - 0.2, 0xf0e6d0); trim.box(0.3, WH, 0.3, x, WH / 2, -HZ + 0.2, 0xf0e6d0); });
  sc.add(trim.mesh());

  /* windows + sun shafts */
  const winGlow = basic(0xe6f4ff), frameM = new Merger(), shaftTex = glowTexture();
  const win = (x, y, z, ry, w, h) => {
    const g = new T.Mesh(new T.PlaneGeometry(w, h), winGlow); g.position.set(x, y, z); g.rotation.y = ry; sc.add(g);
    const f = new Merger(); f.box(w + 0.16, 0.08, 0.1, 0, h / 2 + 0.04, 0, 0x4a2f1a); f.box(w + 0.16, 0.08, 0.1, 0, -h / 2 - 0.04, 0, 0x4a2f1a);
    f.box(0.08, h, 0.1, -w / 2 - 0.04, 0, 0, 0x4a2f1a); f.box(0.08, h, 0.1, w / 2 + 0.04, 0, 0, 0x4a2f1a); f.box(0.05, h, 0.06, 0, 0, 0, 0x4a2f1a); f.box(w, 0.05, 0.06, 0, 0, 0, 0x4a2f1a);
    const fm = f.mesh(); fm.position.set(x, y, z); fm.rotation.y = ry; sc.add(fm);
  };
  [-9, -3, 3, 9].forEach(x => {
    win(x, 3.1, -HZ + 0.03, 0, 2.2, 2.4);
    const s = new T.Mesh(new T.PlaneGeometry(2.0, 6.2), new T.MeshBasicMaterial({ map: shaftTex, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, opacity: 0.55 }));
    s.position.set(x + 0.4, 2.0, -7.5); s.rotation.x = -0.83; sc.add(s); W.shafts.push(s);
  });
  [-6, 0, 6].forEach(z => win(HX - 0.03, 3.5, z, -Math.PI / 2, 2.2, 1.6));
  [-7, 7].forEach(x => win(x, 3.0, HZ - 0.03, Math.PI, 2.2, 2.0));
  const dp = []; for (let i = 0; i < 150; i++) dp.push(rnd(-11, 11), rnd(0.4, 4), rnd(-9, 2));
  const dg = new T.BufferGeometry(); dg.setAttribute('position', new T.Float32BufferAttribute(dp, 3));
  W.dust = new T.Points(dg, new T.PointsMaterial({ size: 0.045, color: 0xfff2cc, transparent: true, opacity: 0.55, depthWrite: false })); sc.add(W.dust);

  /* front door */
  const door = new Merger(); door.box(0.12, 3.3, 0.18, -1.1, 1.65, 0, 0x4a2f1a); door.box(0.12, 3.3, 0.18, 1.1, 1.65, 0, 0x4a2f1a); door.box(2.34, 0.14, 0.18, 0, 3.35, 0, 0x4a2f1a);
  const dm = door.mesh(); dm.position.z = HZ - 0.08; sc.add(dm);
  const glass = new T.Mesh(new T.PlaneGeometry(2.08, 3.25), new T.MeshBasicMaterial({ color: 0xcfe9ff, transparent: true, opacity: 0.45, side: T.DoubleSide })); glass.position.set(0, 1.65, HZ - 0.06); sc.add(glass);
  const ex = new T.Mesh(new T.PlaneGeometry(0.7, 0.24), new T.MeshBasicMaterial({ map: signTexture('EXIT', '', '#22c55e', 256, 96) })); ex.position.set(0, 3.7, HZ - 0.05); ex.rotation.y = Math.PI; sc.add(ex);

  /* banner + logo + clock on the back wall */
  const logoMat = new T.MeshBasicMaterial({ color: 0xffffff }), logoPlane = new T.Mesh(new T.PlaneGeometry(1.5, 1.5), logoMat); logoPlane.position.set(0, 2.55, -HZ + 0.05); sc.add(logoPlane);
  new T.TextureLoader().load('/icons/icon-512.png', t => { t.anisotropy = W.aniso; logoMat.map = t; logoMat.needsUpdate = true; });
  const ban = new T.Mesh(new T.PlaneGeometry(4.6, 0.8), new T.MeshBasicMaterial({ map: signTexture('NUASA LIBRARY · UNIUYO', 'Silence is golden. Read, learn, grow.', '#e2c26a', 768, 128) })); ban.position.set(0, 1.35, -HZ + 0.05); sc.add(ban);
  const clock = new T.Group(); clock.position.set(-3.6, 3.9, -HZ + 0.06);
  const cf = new T.Mesh(new T.CircleGeometry(0.4, 32), basic(0xfaf3e0)); const rim = new T.Mesh(new T.RingGeometry(0.4, 0.46, 32), basic(0x3e2814)); clock.add(cf, rim);
  const hand = (len, w, col) => { const m = new T.Mesh(new T.PlaneGeometry(w, len), basic(col)); m.geometry.translate(0, len / 2, 0); m.position.z = 0.005; clock.add(m); return m; };
  W.clockHands = { h: hand(0.22, 0.03, 0x222222), m: hand(0.32, 0.02, 0x222222), s: hand(0.34, 0.008, 0xb91c1c) }; sc.add(clock);

  /* hanging lamps */
  const lampM = new Merger(); const lampGlow = new Merger();
  [[-8, -6], [0, -6], [8, -6], [-8, 1], [0, 1], [8, 1], [-8, 6], [0, 6], [8, 6]].forEach(p => { lampM.cyl(0.01, 0.01, 1.2, p[0], WH - 0.6, p[1], 0x222222, 4); lampM.cyl(0.18, 0.4, 0.28, p[0], WH - 1.3, p[1], 0x1f4d36, 16); lampGlow.cyl(0.36, 0.36, 0.02, p[0], WH - 1.46, p[1], 0xfff1c9, 16); });
  sc.add(lampM.mesh()); const lg = lampGlow.mesh(); lg.material = basic(0xfff1c9, { vertexColors: true }); sc.add(lg);

  /* shelves ------------------------------------------------ */
  const books = makeBooks(); W.bookData = books; W.catalog = books.length;
  const sh = new Merger(), decor = [], slotsByRow = { A: [], B: [], C: [], D: [], G: [] };
  const WOOD = 0x6b4528, PLANK = 0x82582f;
  function shelfUnit(row, cx, cz, r, w, double) {
    const D = double ? 0.8 : 0.45, H = 2.45, cs = Math.cos(r), sn = Math.sin(r);
    const wp = (lx, lz) => [cx + lx * cs + lz * sn, cz - lx * sn + lz * cs];
    const part = (bw, bh, bd, lx, y, lz, col) => { const p = wp(lx, lz); sh.box(bw, bh, bd, p[0], y, p[1], col, r); };
    part(0.04, H, D, -w / 2 + 0.02, H / 2, 0, WOOD); part(0.04, H, D, w / 2 - 0.02, H / 2, 0, WOOD);
    part(w, 0.05, D + 0.04, 0, H + 0.02, 0, 0x5b3a22); part(w - 0.04, 0.1, D - 0.02, 0, 0.05, 0, 0x3e2814);
    part(w - 0.04, H - 0.1, 0.02, 0, H / 2, double ? 0 : -D / 2 + 0.01, 0x4a2f1a);
    for (let l = 0; l < 5; l++) part(w - 0.04, 0.03, D - 0.02, 0, 0.12 + l * 0.44, 0, PLANK);
    const rot = r;
    (double ? [1, -1] : [1]).forEach(s => {
      for (let l = 0; l < 5; l++) {
        const top = 0.135 + l * 0.44; let lx = -w / 2 + 0.07;
        while (lx < w / 2 - 0.07) {
          const lean = Math.random() < 0.03, bt = rnd(0.036, 0.072), bh = rnd(0.22, 0.34), bd = rnd(0.2, 0.27);
          if (Math.random() < 0.05) { lx += rnd(0.08, 0.2); continue; }
          if (lx + bt > w / 2 - 0.07) break;
          const lz = s * ((double ? D / 2 : D / 2) - 0.035 - bd / 2), p = wp(lx + bt / 2, lz);
          slotsByRow[row].push({ x: p[0], y: top + bh / 2, z: p[1], rot: rot + (s < 0 ? Math.PI : 0), t: Math.max(bt, 0.05), h: Math.max(bh, 0.26), d: bd, lvl: l, nx: Math.sin(rot + (s < 0 ? Math.PI : 0)), nz: Math.cos(rot + (s < 0 ? Math.PI : 0)), lean, used: false, unit: [cx, cz] });
          lx += bt + 0.004;
        }
      }
    });
    const hw = r === 0 ? w / 2 : D / 2, hd = r === 0 ? D / 2 : w / 2; bbox(cx, cz, hw + 0.02, hd + 0.02);
    blob(cx, cz, (r === 0 ? w : D) + 0.5, (r === 0 ? D : w) + 0.5);
  }
  const rowDefs = [
    { k: 'A', name: 'Past Questions', xs: [-9.625, -7.875, -6.125, -4.375], z: -7.6 }, { k: 'B', name: 'Lecture Notes', xs: [-9.625, -7.875, -6.125, -4.375], z: -4.6 },
    { k: 'C', name: 'Textbooks', xs: [4.375, 6.125, 7.875, 9.625], z: -7.6 }, { k: 'D', name: 'Handouts & Assignments', xs: [4.375, 6.125, 7.875, 9.625], z: -4.6 },
  ];
  rowDefs.forEach(d => { d.xs.forEach(x => shelfUnit(d.k, x, d.z, 0, 1.75, true)); W.rows[d.k] = { name: d.name, x: (d.xs[0] + d.xs[3]) / 2, z: d.z, count: 0 }; });
  for (let k = 0; k < 8; k++) shelfUnit('G', -HX + 0.225 + 0.0, -8.525 + k * 1.75, Math.PI / 2, 1.75, false);
  W.rows.G = { name: 'General & Reference', x: -12.3, z: -2, count: 0 };

  /* put the real files on the best (eye-level) slots, then fill everything else with decorative books */
  const order = [2, 1, 3, 0, 4];
  const MAXI = 260; let placed = 0;
  ['A', 'B', 'C', 'D', 'G'].forEach(k => {
    const slots = slotsByRow[k].slice().sort((a, b) => order.indexOf(a.lvl) - order.indexOf(b.lvl) || (a.unit[0] - b.unit[0]) || (a.unit[1] - b.unit[1]) || (a.x - b.x) || (a.z - b.z));
    const mine = books.filter(b => b.row === k); let si = 0;
    mine.forEach(info => {
      if (placed >= MAXI) return; while (si < slots.length && slots[si].lean) si++; if (si >= slots.length) return;
      const s = slots[si++]; s.used = true; placed++; W.rows[k].count++;
      const color = new T.Color(TYPE_COLOR[k]).offsetHSL(rnd(-0.03, 0.03), 0, rnd(-0.05, 0.05)).getHex();
      const cover = lam(color), pages = lam(0xf1e6cc), spine = new T.MeshLambertMaterial({ color });
      const mesh = new T.Mesh(new T.BoxGeometry(s.t, s.h, s.d), [cover, cover, pages, pages, spine, pages]);
      mesh.position.set(s.x, s.y, s.z); mesh.rotation.y = s.rot; sc.add(mesh);
      const bk = { mesh, info, slot: s, color, spineMat: spine, tex: null, away: false, row: k }; mesh.userData.bk = bk; W.books.push(bk); W.pickables.push(mesh);
    });
    slots.forEach(s => { if (!s.used) decor.push(s); });
  });
  const palette = [0x7a2e2e, 0x2e4a7a, 0x2e6b4a, 0xa6772b, 0x5b3d7a, 0x8c5a3c, 0x3b3b3b, 0x9c2f4f, 0x2f6f7a, 0xc9b27a, 0x44663a];
  const im = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), lam(0xffffff), Math.max(1, decor.length)); const dm4 = new T.Object3D(), cc = new T.Color();
  decor.forEach((s, i) => { dm4.position.set(s.x, s.y, s.z); dm4.rotation.set(0, s.rot, s.lean ? rnd(-0.25, 0.25) : 0); dm4.scale.set(Math.min(s.t, 0.072), Math.min(s.h, 0.34), s.d); dm4.updateMatrix(); im.setMatrixAt(i, dm4.matrix); cc.setHex(pick(palette)); cc.offsetHSL(0, rnd(-0.1, 0.05), rnd(-0.06, 0.06)); im.setColorAt(i, cc); });
  im.count = decor.length; sc.add(im);
  W.slots = slotsByRow; const shMesh = sh.mesh(); sc.add(shMesh); W.occluders = [shMesh];

  /* row signs */
  const signAt = (txt, sub, x, y, z, ry) => { const m = new T.Mesh(new T.PlaneGeometry(2.6, 0.65), new T.MeshBasicMaterial({ map: signTexture(txt, sub, '#e2c26a', 512, 128) })); m.position.set(x, y, z); m.rotation.y = ry; sc.add(m); };
  rowDefs.forEach(d => { const R = W.rows[d.k], sub = R.count + (R.count === 1 ? ' file' : ' files'); [0.43, -0.43].forEach((o, i) => signAt(d.name, sub, R.x, 3.05, d.z + o, i ? Math.PI : 0)); });
  signAt('General & Reference', W.rows.G.count + ' files', -HX + 0.4, 3.05, -2, Math.PI / 2 * 1); 
  W.sigGen = true;

  /* tables + chairs */
  const tm = new Merger(), cm = new Merger();
  const tables = []; [-7.5, -2.5, 2.5, 7.5].forEach(x => { tables.push([x, 1.2]); tables.push([x, 4.6]); });
  const addChair = (x, z, fx, fz, kind) => {
    const ry = Math.atan2(fx, fz), c = (lx, lz) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)];
    const wood = kind === 'sofa' ? 0x6e2a3a : kind === 'arm' ? 0x1f5c58 : 0x8a5a30;
    const sw = kind === 'sofa' ? 1.3 : kind === 'arm' ? 0.8 : 0.46, sd = kind === 'chair' ? 0.44 : 0.7, sy = kind === 'chair' ? 0.46 : 0.42;
    const part = (w, h, d, lx, y, lz, col) => { const p = c(lx, lz); cm.box(w, h, d, p[0], y, p[1], col, ry); };
    part(sw, 0.06, sd, 0, sy, 0, wood);
    if (kind === 'chair') { part(0.44, 0.38, 0.04, 0, sy + 0.25, -0.21, wood); [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].forEach(l => part(0.04, sy, 0.04, l[0], sy / 2, l[1], 0x4a2f1a)); }
    else { part(sw, 0.5, 0.18, 0, sy + 0.3, -sd / 2 + 0.09, wood); part(0.14, 0.26, sd, -sw / 2 + 0.07, sy + 0.15, 0, wood); part(0.14, 0.26, sd, sw / 2 - 0.07, sy + 0.15, 0, wood); part(sw, 0.38, sd, 0, 0.19, 0, 0x3a2a20); }
    W.chairs.push({ id: W.chairs.length, x, z, fx, fz, kind, occ: null, ry, ox: x, oz: z });
  };
  const dm2 = new Merger();
  tables.forEach(([x, z], ti) => {
    tm.box(2.4, 0.07, 1.2, x, 0.76, z, 0x9a6b3c); tm.box(2.2, 0.05, 1.0, x, 0.70, z, 0x7b5230);
    [[-1.1, -0.5], [1.1, -0.5], [-1.1, 0.5], [1.1, 0.5]].forEach(l => tm.box(0.07, 0.74, 0.07, x + l[0], 0.37, z + l[1], 0x5b3a22));
    if (ti % 2 === 0) { tm.cyl(0.09, 0.09, 0.03, x + 0.7, 0.81, z, 0x2a3f2e, 10); tm.cyl(0.015, 0.015, 0.22, x + 0.7, 0.93, z, 0xb08d3a, 6); tm.cyl(0.1, 0.13, 0.12, x + 0.7, 1.08, z, 0x1f6b3f, 12); }
    tm.box(0.2, 0.025, 0.28, x - 0.5, 0.82, z + 0.15, pick(palette)); tm.box(0.2, 0.025, 0.28, x + 0.1, 0.82, z - 0.15, pick(palette));
    bbox(x, z, 1.25, 0.65); blob(x, z, 3.2, 2.0);
    [-0.6, 0.6].forEach(dx => { addChair(x + dx, z + 0.98, 0, -1, 'chair'); addChair(x + dx, z - 0.98, 0, 1, 'chair'); });
  });
  /* study carrels along the right wall */
  [-7.2, -5.6, -4.0, -2.4, -0.8, 0.8, 2.4].forEach(z => {
    tm.box(0.75, 0.05, 1.2, HX - 0.4, 0.76, z, 0x9a6b3c); tm.box(0.75, 0.7, 0.04, HX - 0.4, 0.38, z - 0.6, 0x7b5230); tm.box(0.75, 0.7, 0.04, HX - 0.4, 0.38, z + 0.6, 0x7b5230);
    tm.box(0.04, 0.55, 1.2, HX - 0.05, 1.05, z, 0x8a6a45); tm.box(0.75, 0.55, 0.04, HX - 0.4, 1.05, z - 0.6, 0x8a6a45); tm.box(0.75, 0.55, 0.04, HX - 0.4, 1.05, z + 0.6, 0x8a6a45);
    bbox(HX - 0.4, z, 0.4, 0.62); addChair(HX - 1.25, z, 1, 0, 'chair'); W.chairs[W.chairs.length - 1].carrel = true;
  });
  /* lounge */
  dm2.box(2.6, 0.02, 2.2, 10.9, 0.011, 7.7, 0x7a2e2e); dm2.box(2.5, 0.025, 2.1, 10.9, 0.012, 7.7, 0x9a4a3a);
  tm.box(0.9, 0.05, 0.6, 10.9, 0.42, 7.6, 0x6b4528); tm.box(0.06, 0.4, 0.06, 10.55, 0.2, 7.4, 0x3e2814); tm.box(0.06, 0.4, 0.06, 11.25, 0.2, 7.8, 0x3e2814);
  bbox(10.9, 7.6, 0.5, 0.35);
  addChair(10.3, 9.1, 0, -1, 'sofa'); addChair(11.6, 9.1, 0, -1, 'sofa'); bbox(10.95, 9.15, 1.5, 0.4);
  addChair(9.4, 7.6, 1, 0, 'arm'); addChair(12.3, 7.6, -1, 0, 'arm'); bbox(9.2, 7.6, 0.4, 0.45); bbox(12.45, 7.6, 0.4, 0.45);
  const tmesh = tm.mesh(); sc.add(tmesh); W.occluders.push(tmesh); sc.add(cm.mesh()); sc.add(dm2.mesh());
  W.chairs.forEach(c => { if (c.kind === 'chair') c.x += 0; });
  /* a raycast-able mesh for each chair: low invisible box (cheap) */
  W.chairs.forEach(c => { const m = new T.Mesh(new T.BoxGeometry(c.kind === 'sofa' ? 1.2 : 0.55, 0.9, 0.55), new T.MeshBasicMaterial({ visible: false })); m.position.set(c.x, 0.5, c.z); m.userData.chair = c; sc.add(m); c.hit = m; W.pickables.push(m); });

  /* librarian desk + donate box */
  const ds = new Merger(); const DX = -6.6, DZ = 7.9;
  ds.box(3.6, 1.05, 0.7, DX, 0.525, DZ, 0x5b3a22); ds.box(3.8, 0.07, 0.95, DX, 1.08, DZ, 0x9a6b3c); ds.box(0.7, 1.05, 1.5, DX + 1.75, 0.525, DZ + 0.4, 0x5b3a22); ds.box(0.9, 0.07, 1.7, DX + 1.75, 1.08, DZ + 0.4, 0x9a6b3c);
  ds.box(0.5, 0.32, 0.03, DX - 0.6, 1.36, DZ - 0.1, 0x1a1a1a); ds.box(0.08, 0.12, 0.08, DX - 0.6, 1.17, DZ - 0.1, 0x333333); ds.box(0.42, 0.015, 0.14, DX - 0.6, 1.12, DZ - 0.3, 0x2a2a2a);
  for (let i = 0; i < 5; i++) ds.box(0.22, 0.04, 0.3, DX + 0.8, 1.14 + i * 0.045, DZ - 0.05, pick(palette));
  ds.cyl(0.07, 0.07, 0.04, DX - 1.4, 1.14, DZ + 0.1, 0xc9a227, 12);
  sc.add(ds.mesh()); bbox(DX, DZ, 1.95, 0.5); bbox(DX + 1.75, DZ + 0.4, 0.5, 0.85); blob(DX, DZ, 5, 2.4);
  const deskSign = new T.Mesh(new T.PlaneGeometry(1.8, 0.45), new T.MeshBasicMaterial({ map: signTexture('INFORMATION', 'Ask the librarian', '#e2c26a', 512, 128) })); deskSign.position.set(DX, 3.0, DZ + 0.2); sc.add(deskSign);
  W.desk = { x: DX, z: DZ }; W.post = { x: DX - 0.4, z: DZ + 0.85 };
  const dbx = new Merger(); const BX = 5.2, BZ = 8.5;
  dbx.box(0.7, 0.9, 0.55, BX, 0.45, BZ, 0x1f5c3a); dbx.box(0.74, 0.06, 0.6, BX, 0.93, BZ, 0xe2c26a); dbx.box(0.4, 0.02, 0.04, BX, 0.97, BZ, 0x111111);
  const dbm = dbx.mesh(); sc.add(dbm); bbox(BX, BZ, 0.4, 0.32); blob(BX, BZ, 1.5, 1.3);
  const dsign = new T.Mesh(new T.PlaneGeometry(1.4, 0.4), new T.MeshBasicMaterial({ map: signTexture('DONATE A DOCUMENT', 'Upload · we approve it', '#22c55e', 512, 128) })); dsign.position.set(BX, 1.5, BZ + 0.0); dsign.rotation.y = Math.PI; sc.add(dsign);
  const dhit = new T.Mesh(new T.BoxGeometry(0.9, 1.1, 0.7), new T.MeshBasicMaterial({ visible: false })); dhit.position.set(BX, 0.6, BZ); dhit.userData.donate = true; sc.add(dhit); W.pickables.push(dhit); W.donate = { x: BX, z: BZ };
  /* the librarian as a raycast target is added with her avatar */

  /* decor: plants, globe, notice board, quiet posters */
  const plants = new Merger();
  [[-12.2, 8.9], [12.2, 5.3], [-2.0, -9.3], [2.0, -9.3], [12.2, 9.2], [-12.2, 5.6]].forEach(p => { plants.cyl(0.22, 0.17, 0.4, p[0], 0.2, p[1], 0x8a4b2a, 12); for (let i = 0; i < 5; i++) plants.cyl(0.0, 0.2, 0.7, p[0] + rnd(-0.12, 0.12), 0.75 + rnd(0, 0.3), p[1] + rnd(-0.12, 0.12), pick([0x2f7a3a, 0x3c8f48, 0x256b33]), 5); bbox(p[0], p[1], 0.25, 0.25); });
  sc.add(plants.mesh());
  const gl = new Merger(); gl.cyl(0.18, 0.2, 0.05, 0, 0.03, -8.9, 0x3e2814); gl.cyl(0.03, 0.03, 0.9, 0, 0.5, -8.9, 0x3e2814, 6); sc.add(gl.mesh());
  const globe = new T.Mesh(new T.SphereGeometry(0.3, 20, 14), lam(0x2f6f9a)); globe.position.set(0, 1.25, -8.9); sc.add(globe); W.globe = globe; bbox(0, -8.9, 0.3, 0.3);
  const nb = new Merger(); nb.box(2.4, 1.3, 0.05, -5.0, 2.0, HZ - 0.04, 0x5b3a22); nb.box(2.2, 1.1, 0.03, -5.0, 2.0, HZ - 0.07, 0xb98d57);
  for (let i = 0; i < 9; i++) nb.box(0.32, 0.4, 0.01, -5.9 + (i % 5) * 0.45 + rnd(-0.04, 0.04), 2.25 - Math.floor(i / 5) * 0.5, HZ - 0.09, pick([0xfff3b0, 0xbfe3ff, 0xffd0d0, 0xd8f5c8]));
  sc.add(nb.mesh());
  const nt = new T.Mesh(new T.PlaneGeometry(1.4, 0.3), new T.MeshBasicMaterial({ map: signTexture('NOTICES', '', '#e2c26a', 256, 64) })); nt.position.set(-5.0, 2.85, HZ - 0.06); nt.rotation.y = Math.PI; sc.add(nt);
  [[-12.95, 6.5, 'R'], [12.95, 7.0, 'L'], [5.0, -9.96, 'B'], [-5.0, -9.96, 'B']].forEach(p => {
    const m = new T.Mesh(new T.PlaneGeometry(0.8, 0.8), new T.MeshBasicMaterial({ map: quietPoster() })); m.position.set(p[0], 2.0, p[1]);
    m.rotation.y = p[2] === 'R' ? Math.PI / 2 : p[2] === 'L' ? -Math.PI / 2 : 0; sc.add(m);
  });
  /* rug runner down the middle */
  const rug = new Merger(); rug.box(2.0, 0.015, 15, 0, 0.008, 1.5, 0x6d2b2b); rug.box(1.8, 0.017, 14.8, 0, 0.009, 1.5, 0x8a3b34); sc.add(rug.mesh());

  /* walls as collision */
  W.bounds = { x0: -HX + 0.35, x1: HX - 0.35, z0: -HZ + 0.35, z1: HZ - 0.3 };
  buildNav(); return W;
}
function quietPoster() {
  const c = mkCv(128, 128), x = c.getContext('2d'); x.fillStyle = '#f6ecd6'; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#1f6b3f'; x.lineWidth = 6; x.strokeRect(5, 5, 118, 118);
  x.fillStyle = '#1f6b3f'; x.beginPath(); x.arc(64, 48, 22, 0, 7); x.fill(); x.fillStyle = '#f6ecd6'; x.fillRect(58, 54, 12, 5); x.fillStyle = '#1f6b3f'; x.fillRect(62, 28, 4, 26);
  x.font = '800 22px Georgia, serif'; x.textAlign = 'center'; x.fillText('SILENCE', 64, 96); x.font = '600 14px system-ui'; x.fillText('Reading in progress', 64, 114); return new T.CanvasTexture(c);
}

/* ---------- navigation grid (shared by the librarian and the other students) ---------- */
const CELL = 0.4, NX = Math.ceil(HX * 2 / CELL), NZ = Math.ceil(HZ * 2 / CELL);
function buildNav() {
  const blocked = new Uint8Array(NX * NZ), R = 0.3;
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const x = -HX + (i + 0.5) * CELL, z = -HZ + (j + 0.5) * CELL; let b = x < W.bounds.x0 || x > W.bounds.x1 || z < W.bounds.z0 || z > W.bounds.z1;
    if (!b) for (const a of W.aabbs) if (x > a.x0 - R && x < a.x1 + R && z > a.z0 - R && z < a.z1 + R) { b = true; break; }
    blocked[j * NX + i] = b ? 1 : 0;
  }
  W.nav = blocked;
}
const cellOf = (x, z) => [clamp(Math.floor((x + HX) / CELL), 0, NX - 1), clamp(Math.floor((z + HZ) / CELL), 0, NZ - 1)];
const cellPos = (i, j) => [-HX + (i + 0.5) * CELL, -HZ + (j + 0.5) * CELL];
function freeCell(i, j) {
  if (!W.nav[j * NX + i]) return [i, j];
  for (let r = 1; r < 8; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < NX && b < NZ && !W.nav[b * NX + a]) return [a, b]; }
  return [i, j];
}
function findPath(x0, z0, x1, z1) {
  let [si, sj] = freeCell(...cellOf(x0, z0)), [ti, tj] = freeCell(...cellOf(x1, z1));
  const N = NX * NZ, g = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N), open = [];
  const s = sj * NX + si, t = tj * NX + ti; g[s] = 0; open.push([0, s]); let it = 0;
  const h = (i, j) => Math.hypot(i - ti, j - tj);
  while (open.length && it++ < 5000) {
    let bi = 0; for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
    const cur = open.splice(bi, 1)[0][1]; if (closed[cur]) continue; closed[cur] = 1; if (cur === t) break;
    const ci = cur % NX, cj = (cur / NX) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue; const a = ci + di, b = cj + dj; if (a < 0 || b < 0 || a >= NX || b >= NZ) continue;
      const n = b * NX + a; if (W.nav[n] || closed[n]) continue;
      if (di && dj && (W.nav[cj * NX + a] || W.nav[b * NX + ci])) continue;
      const ng = g[cur] + (di && dj ? 1.414 : 1); if (ng < g[n]) { g[n] = ng; from[n] = cur; open.push([ng + h(a, b), n]); }
    }
  }
  if (!closed[t]) return [];
  const pts = []; let c = t; while (c !== -1 && c !== s) { const p = cellPos(c % NX, (c / NX) | 0); pts.push({ x: p[0], z: p[1] }); c = from[c]; }
  pts.reverse(); pts.push({ x: x1, z: z1 });
  /* drop points that lie on a straight line */
  const out = []; pts.forEach((p, i) => { if (i === 0 || i === pts.length - 1) { out.push(p); return; } const a = pts[i - 1], b = pts[i + 1]; if (Math.abs((p.x - a.x) * (b.z - p.z) - (p.z - a.z) * (b.x - p.x)) > 0.01) out.push(p); });
  return out;
}
function collide(x, z, r) {
  for (const a of W.aabbs) {
    const cx = clamp(x, a.x0, a.x1), cz = clamp(z, a.z0, a.z1); let dx = x - cx, dz = z - cz; const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-8) { const d = Math.sqrt(d2), p = r - d; x += dx / d * p; z += dz / d * p; }
      else { const l = x - a.x0, rr = a.x1 - x, t = z - a.z0, b = a.z1 - z, m = Math.min(l, rr, t, b); if (m === l) x = a.x0 - r; else if (m === rr) x = a.x1 + r; else if (m === t) z = a.z0 - r; else z = a.z1 + r; }
    }
  }
  return [clamp(x, W.bounds.x0, W.bounds.x1), clamp(z, W.bounds.z0, W.bounds.z1)];
}

/* ================= PEOPLE ================= */
const SKIN = [0x5a3825, 0x6b4430, 0x7a4e33, 0x8d5a3b, 0x4a2e1f, 0xa0694a];
const SHIRTS = [0x2f6f4f, 0xf1f1f1, 0x2d4f8a, 0xb8862b, 0x8a2d3b, 0x3b3b3b, 0x5b4a8a, 0xd97a2b, 0x2f7a8a];
const PANTS = [0x23272e, 0x3a3f4a, 0x4a3b2a, 0x1f2f4a, 0x555555];
const HAIR = ['low', 'fade', 'afro', 'braids', 'bun', 'hijab', 'cap'];
const geoC = {};
const G_ = (k, f) => geoC[k] || (geoC[k] = f());
function makeAvatar(look) {
  const root = new T.Group(), skin = lam(SKIN[look.sk % SKIN.length]), shirt = lam(look.shirt), pants = lam(look.pants), dark = lam(0x1a1a1a), shoe = lam(0x2b2118);
  const body = new T.Group(); body.position.y = 0.92; root.add(body);
  const cyl = (r1, r2, h, m, seg) => new T.Mesh(G_(`c${r1}${r2}${h}${seg || 10}`, () => new T.CylinderGeometry(r1, r2, h, seg || 10)), m);
  const sph = (r, m) => new T.Mesh(G_('s' + r, () => new T.SphereGeometry(r, 12, 10)), m);
  const bx = (w, h, d, m) => new T.Mesh(G_(`b${w}${h}${d}`, () => new T.BoxGeometry(w, h, d)), m);
  const fem = look.g === 'f';
  const torso = cyl(fem ? 0.15 : 0.17, fem ? 0.16 : 0.175, 0.56, shirt, 14); torso.position.y = 0.27; torso.scale.z = 0.72; body.add(torso);
  const pel = bx(0.33, 0.2, 0.21, pants); pel.position.y = -0.02; body.add(pel);
  const neckG = new T.Group(); neckG.position.y = 0.56; body.add(neckG);
  const neck = cyl(0.045, 0.05, 0.08, skin, 8); neck.position.y = 0.02; neckG.add(neck);
  const head = new T.Group(); head.position.y = 0.1; neckG.add(head);
  const hm = sph(0.115, skin); hm.position.y = 0.11; hm.scale.set(0.92, 1.06, 0.96); head.add(hm);
  [-0.04, 0.04].forEach(x => { const e = sph(0.014, dark); e.position.set(x, 0.135, 0.105); head.add(e); });
  const hairM = lam(look.hairCol || 0x141110);
  const hk = look.hair;
  if (hk === 'afro') { const h = sph(0.15, hairM); h.position.set(0, 0.17, -0.02); h.scale.set(1, 0.9, 1); head.add(h); }
  else if (hk === 'hijab') { const h = sph(0.128, lam(look.scarf || 0x2f6f4f)); h.position.set(0, 0.115, -0.008); h.scale.set(0.98, 1.06, 1.0); head.add(h); const n = cyl(0.11, 0.15, 0.2, lam(look.scarf || 0x2f6f4f), 12); n.position.set(0, -0.02, -0.01); head.add(n); const f = sph(0.095, skin); f.position.set(0, 0.115, 0.045); f.scale.set(0.95, 1.1, 0.8); head.add(f); }
  else if (hk === 'cap') { const h = sph(0.12, hairM); h.position.set(0, 0.16, -0.005); h.scale.set(1, 0.6, 1.02); head.add(h); const b = bx(0.15, 0.015, 0.1, lam(0x2f6f4f)); b.position.set(0, 0.175, 0.1); head.add(b); }
  else { const h = sph(0.118, hairM); h.position.set(0, hk === 'fade' ? 0.16 : 0.155, -0.012); h.scale.set(0.96, hk === 'fade' ? 0.55 : 0.7, 1.02); head.add(h);
    if (hk === 'bun') { const b = sph(0.05, hairM); b.position.set(0, 0.25, -0.08); head.add(b); }
    if (hk === 'braids') for (let k = 0; k < 7; k++) { const a = -1.3 + k * 0.43, b = cyl(0.012, 0.01, 0.26, hairM, 5); b.position.set(Math.sin(a) * 0.1, 0.05, -Math.cos(a) * 0.09 - 0.02); head.add(b); } }
  if (look.glasses) { const g = new T.Mesh(new T.TorusGeometry(0.03, 0.005, 6, 14), dark); g.position.set(-0.04, 0.135, 0.112); const g2 = g.clone(); g2.position.x = 0.04; head.add(g, g2); const br = bx(0.04, 0.005, 0.005, dark); br.position.set(0, 0.138, 0.114); head.add(br); }
  /* arms */
  const arm = (sx) => {
    const sh = new T.Group(); sh.position.set(sx * 0.215, 0.5, 0); body.add(sh);
    const up = cyl(0.04, 0.036, 0.3, look.long ? shirt : shirt, 8); up.position.y = -0.15; sh.add(up);
    const el = new T.Group(); el.position.y = -0.3; sh.add(el);
    const fo = cyl(0.036, 0.03, 0.27, look.long ? shirt : skin, 8); fo.position.y = -0.135; el.add(fo);
    const hd = sph(0.036, skin); hd.position.y = -0.29; el.add(hd);
    return { sh, el, hd };
  };
  const aL = arm(-1), aR = arm(1);
  const leg = (sx) => {
    const hip = new T.Group(); hip.position.set(sx * 0.09, -0.06, 0); body.add(hip);
    const th = cyl(0.068, 0.056, 0.44, pants, 8); th.position.y = -0.22; hip.add(th);
    const kn = new T.Group(); kn.position.y = -0.44; hip.add(kn);
    const sn = cyl(0.052, 0.042, 0.42, pants, 8); sn.position.y = -0.21; kn.add(sn);
    const ft = bx(0.09, 0.06, 0.24, shoe); ft.position.set(0, -0.44, 0.05); kn.add(ft);
    return { hip, kn };
  };
  const lL = leg(-1), lR = leg(1);
  /* prop held while reading */
  const prop = bx(0.2, 0.27, 0.03, lam(look.bookCol || 0x2d4f8a)); prop.visible = false; body.add(prop);
  const fin = cyl(0.007, 0.007, 0.05, skin, 5); fin.visible = false; aR.el.add(fin); fin.position.set(0, -0.33, 0.02);
  return { root, body, head, neckG, aL, aR, lL, lR, prop, fin };
}

/* sprites (name tags, speech bubbles) */
function textSprite(text, opts) {
  opts = opts || {}; const c = mkCv(512, 256), x = c.getContext('2d'); const fs = opts.fs || 30, font = `${opts.italic ? 'italic ' : ''}600 ${fs}px system-ui, sans-serif`;
  const lines = wrapText(x, text, opts.maxW || 400, font).slice(0, 5); const lh = fs * 1.25, h = lines.length * lh + 26; const wmax = Math.max.apply(null, lines.map(l => x.measureText(l).width)) + 36;
  const cw = Math.min(512, Math.ceil(wmax)), ch = Math.ceil(h + (opts.tail ? 16 : 0)); c.width = 512; c.height = 256; const xx = c.getContext('2d');
  xx.clearRect(0, 0, 512, 256); const ox = (512 - cw) / 2, oy = 256 - ch;
  xx.fillStyle = opts.bg || 'rgba(255,252,244,.96)'; rrect(xx, ox, oy, cw, h, 16); xx.fill();
  if (opts.border) { xx.strokeStyle = opts.border; xx.lineWidth = 3; xx.stroke(); }
  if (opts.tail) { xx.fillStyle = opts.bg || 'rgba(255,252,244,.96)'; xx.beginPath(); xx.moveTo(256 - 10, oy + h - 1); xx.lineTo(256, oy + h + 15); xx.lineTo(256 + 10, oy + h - 1); xx.fill(); }
  xx.font = font; xx.fillStyle = opts.color || '#1d2a22'; xx.textAlign = 'center'; xx.textBaseline = 'middle';
  lines.forEach((l, i) => xx.fillText(l, 256, oy + 13 + lh * (i + 0.5)));
  const t = new T.CanvasTexture(c); const sp = new T.Sprite(new T.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  sp.center.set(0.5, 0); const s = opts.scale || 1.5; sp.scale.set(s, s / 2, 1); sp.renderOrder = 5; return sp;
}

/* ---------- agents (students, the librarian, other online visitors) ---------- */
function Agent(name, look, o) {
  this.name = name; this.look = look; this.av = makeAvatar(look); this.x = 0; this.z = 0; this.yaw = 0; this.o = o || {};
  this.path = []; this.speed = 1.15; this.state = 'idle'; this.t = 0; this.phase = Math.random() * 6; this.moving = 0; this.chair = null; this.sit = 0; this.noise = 0; this.cool = 0;
  this.bubble = null; this.bubbleT = 0; this.shush = 0; this.reach = 0; this.readTitle = ''; this.target = null; this.hit = null;
  this.tag = textSprite(name, { fs: 34, maxW: 300, bg: 'rgba(14,16,19,.7)', color: '#fff', scale: 0.9 }); this.tag.position.y = 2.0; this.av.root.add(this.tag);
  W.scene.add(this.av.root);
  this.hit = new T.Mesh(new T.CylinderGeometry(0.35, 0.35, 1.8, 8), new T.MeshBasicMaterial({ visible: false })); this.hit.position.y = 0.9; this.hit.userData.agent = this; this.av.root.add(this.hit); W.pickables.push(this.hit);
}
Agent.prototype.place = function (x, z, yaw) { this.x = x; this.z = z; if (yaw != null) this.yaw = yaw; };
Agent.prototype.say = function (text, mode) {
  if (this.bubble) { this.av.root.remove(this.bubble); this.bubble.material.map.dispose(); this.bubble.material.dispose(); }
  const w = mode === 'whisper', l = mode === 'shout';
  this.bubble = textSprite(w ? '(whispers) ' + text : text, { fs: l ? 38 : w ? 26 : 30, italic: w, tail: true, scale: l ? 2.3 : w ? 1.3 : 1.7, bg: l ? 'rgba(255,225,215,.97)' : undefined, border: l ? '#c0392b' : undefined, color: l ? '#8a1a10' : w ? '#59645d' : undefined });
  this.bubble.position.y = 2.1; this.av.root.add(this.bubble); this.bubbleT = 2.4 + text.length * 0.06;
};
Agent.prototype.goTo = function (x, z) { this.path = findPath(this.x, this.z, x, z); this.fail = !this.path.length && Math.hypot(this.x - x, this.z - z) > 1.2; };
Agent.prototype.setSeat = function (ch) {
  if (this.chair) { this.chair.occ = null; }
  this.chair = ch; if (ch) ch.occ = this;
};
Agent.prototype.update = function (dt, camPos) {
  /* movement */
  let moving = this.forceMove || 0;
  if (this.state !== 'sitting' && this.state !== 'sitDown' && this.path.length) {
    const p = this.path[0], dx = p.x - this.x, dz = p.z - this.z, d = Math.hypot(dx, dz), sp = this.speed;
    if (d < 0.2) this.path.shift();
    else { this.x += dx / d * sp * dt; this.z += dz / d * sp * dt; const ty = Math.atan2(dx, dz); this.yaw += angDiff(this.yaw, ty) * Math.min(1, dt * 7); moving = sp; }
  }
  this.moving += (moving - this.moving) * Math.min(1, dt * 8);
  const a = this.av, s = this.sit;
  this.sit += ((this.state === 'sitting' || this.state === 'sitDown' ? 1 : 0) - s) * Math.min(1, dt * 6);
  if (this.faceYaw != null && !this.path.length) { this.yaw += angDiff(this.yaw, this.faceYaw) * Math.min(1, dt * 6); }
  a.root.position.set(this.x, 0, this.z); a.root.rotation.y = this.yaw;
  /* pose */
  this.phase += this.moving * dt * 3.6; const sw = Math.sin(this.phase) * Math.min(1, this.moving / 1.1), br = Math.sin(W.time * 1.6 + this.phase0 || 0);
  const k = this.sit;
  a.body.position.y = 0.92 + (0.52 - 0.92) * k + Math.abs(Math.cos(this.phase)) * 0.015 * (1 - k); a.body.position.z = -0.06 * k;
  const bend = Math.max(0, -Math.sin(this.phase)) * Math.min(1, this.moving / 1.1);
  a.lL.hip.rotation.x = sw * 0.6 * (1 - k) - k * 1.45; a.lR.hip.rotation.x = -sw * 0.6 * (1 - k) - k * 1.45;
  a.lL.kn.rotation.x = (Math.max(0, sw) * 0.7 * (1 - k)) + k * 1.45; a.lR.kn.rotation.x = (bend * 0.7 * (1 - k)) + k * 1.45;
  let aLx = -sw * 0.5 * (1 - k), aRx = sw * 0.5 * (1 - k), eLx = -0.1, eRx = -0.1;
  const reading = this.reading, tgt = reading ? 1 : 0; this.rd = (this.rd || 0) + (tgt - (this.rd || 0)) * Math.min(1, dt * 5);
  if (this.rd > 0.01) { aLx += (-0.75 - aLx) * this.rd; aRx += (-0.75 - aRx) * this.rd; eLx += (-1.35 - eLx) * this.rd; eRx += (-1.35 - eRx) * this.rd; }
  this.reach += ((this.reaching ? 1 : 0) - this.reach) * Math.min(1, dt * 6);
  if (this.reach > 0.01) { aRx += (-2.5 - aRx) * this.reach; eRx += (-0.2 - eRx) * this.reach; }
  this.shush += ((this.shushing ? 1 : 0) - this.shush) * Math.min(1, dt * 7);
  if (this.shush > 0.01) { aRx += (-1.15 - aRx) * this.shush; eRx += (-2.35 - eRx) * this.shush; }
  a.aL.sh.rotation.x = aLx; a.aR.sh.rotation.x = aRx; a.aL.el.rotation.x = eLx; a.aR.el.rotation.x = eRx;
  a.fin.visible = this.shush > 0.4; a.prop.visible = !!this.holding;
  a.prop.position.set(0, 0.36, 0.26); a.prop.rotation.x = -0.9 + (1 - (this.rd || 0)) * 0.9;
  a.neckG.rotation.x = (reading ? 0.38 : 0) * this.rd + Math.sin(W.time * 0.7 + this.phase) * 0.02;
  a.head.rotation.y = this.talkLook ? Math.sin(W.time * 0.8 + this.phase) * 0.35 : 0;
  a.body.rotation.x = br * 0.004;
  /* bubble */
  if (this.bubble) { this.bubbleT -= dt; if (this.bubbleT < 0.5) this.bubble.material.opacity = Math.max(0, this.bubbleT / 0.5); if (this.bubbleT <= 0) { this.av.root.remove(this.bubble); this.bubble.material.map.dispose(); this.bubble.material.dispose(); this.bubble = null; } }
  const d = camPos ? Math.hypot(camPos.x - this.x, camPos.z - this.z) : 0; this.tag.visible = d < 7 && !this.o.noTag;
  this.noise = Math.max(0, this.noise - dt * 9); this.cool = Math.max(0, this.cool - dt);
};
const FIRST = ['Ifeoma', 'Emeka', 'Utibe', 'Mfon', 'Ekemini', 'Aniekan', 'Blessing', 'Chidera', 'Ndifreke', 'Idara', 'Uduak', 'Nsikak', 'Imaobong', 'Etim', 'Grace'];
function randomLook(i) {
  const g = Math.random() < 0.5 ? 'f' : 'm'; const hair = g === 'f' ? pick(['braids', 'bun', 'hijab', 'afro', 'low']) : pick(['low', 'fade', 'afro', 'cap']);
  return { sk: Math.floor(Math.random() * SKIN.length), shirt: pick(SHIRTS), pants: pick(PANTS), hair, g, scarf: pick([0x2f6f4f, 0x5b4a8a, 0x8a2d3b, 0x2f7a8a]), glasses: Math.random() < 0.2, bookCol: pick([0x2d4f8a, 0x8a2d3b, 0x2f6f4f, 0xb8862b, 0x5b4a8a]), long: Math.random() < 0.15 };
}
function lookFromId(id) {
  let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const g = h % 2 ? 'f' : 'm', hs = g === 'f' ? ['braids', 'bun', 'hijab', 'afro', 'low'] : ['low', 'fade', 'afro', 'cap'];
  return { sk: h % 6, shirt: SHIRTS[(h >> 3) % SHIRTS.length], pants: PANTS[(h >> 5) % PANTS.length], hair: hs[(h >> 7) % hs.length], g, scarf: 0x2f6f4f, glasses: false, bookCol: 0x2d4f8a, long: false };
}

/* ---------- conversation lines ---------- */
const CHAT = [
  ['Did you finish the ACC assignment?', 'Almost. Past questions are saving me.'], ['Are you attending the CBT practice tonight?', 'Yes, I need the full question bank.'],
  ['Please pass me that textbook.', 'Here. Chapter four is the hard one.'], ['This tax question is confusing.', 'Check the lecture notes shelf, it is explained there.'],
  ['Have you started your project topic?', 'Not yet. I will use the topic generator.'], ['Exams are close o.', 'Tell me about it. I came to read seriously.'],
  ['This library is so calm.', 'That is why I love it here.'], ['What time is the next class?', 'After two. We have time to finish this chapter.'],
];
const REPLY = { whisper: ['Hey! Are you here for past questions too?', 'Nice to meet you. Try the lecture notes shelf.', 'Haha okay, let us study together later.', 'Thanks for whispering, the librarian is strict.'], talk: ['Eh, lower your voice. She is around.', 'Shh, the librarian will hear you!', 'Easy o, speak softly.'], shout: ['Ah ah! Are you mad? Shhh!', 'You want us all thrown out?', 'Oh no, she is coming!'] };
const LIB_LINES = {
  welcome: 'Welcome to the NUASA Library. Please keep your voice down and enjoy your reading.',
  s1: ['Shhh. Please keep your voice down, this is a reading hall.', 'Excuse me, quiet please. Others are studying.'],
  s2: ['This is your second warning. Please be quiet.', 'I have asked you once already. Keep it down, please.'],
  s3: 'That is enough. I am sorry, but you will have to leave the library now.',
  run: ['Please walk in the library, no running.', 'Slow down, please. Walking pace only.'],
  other: n => pick([`${n}, please keep it down.`, `Shhh. ${n}, this is a library.`, `${n}, quiet please. People are reading.`]),
};

/* ================= GAME ================= */
let G = null, UI = {}, raf = 0, listeners = [];
const SPEED = 2.5, RUN = 4.2, EYE = 1.62, SEAT_EYE = 1.22, REACH = 2.7, NOISE_LIMIT = 60;
const MODES = { whisper: { base: 7, per: 0.08, cap: 14 }, talk: { base: 26, per: 0.5, cap: 46 }, shout: { base: 66, per: 0.3, cap: 90 } };
const stats = () => Object.assign({ mins: 0, books: 0, visits: 0 }, lsGet(KEY_STATS, {}));

function say(who, text, ttl) {
  UI.subWho.textContent = who; UI.subTxt.textContent = text; UI.sub.hidden = false; UI.sub.classList.toggle('lib', who === 'Librarian');
  clearTimeout(say.t); say.t = setTimeout(() => { UI.sub.hidden = true; }, ttl || (2600 + text.length * 55));
}
function logChat(name, text, mode, me) {
  const d = document.createElement('div'); d.className = 'vl-l ' + (mode || '') + (me ? ' me' : '');
  const b = document.createElement('b'); b.textContent = name + ': '; const s = document.createElement('span'); s.textContent = text; d.append(b, s);
  UI.log.appendChild(d); while (UI.log.children.length > 40) UI.log.removeChild(UI.log.firstChild); UI.log.scrollTop = UI.log.scrollHeight;
  UI.chat.classList.add('fresh'); clearTimeout(logChat.t); logChat.t = setTimeout(() => UI.chat.classList.remove('fresh'), 6000);
}
function later(sec, fn) { W.pending.push({ t: sec, fn }); }

/* ---------- people ---------- */
function spawnPeople() {
  W.agents = []; W.pending = []; W.remotes = {};
  const names = FIRST.slice().sort(() => Math.random() - 0.5), seats = W.chairs.filter(c => c.kind === 'chair').sort(() => Math.random() - 0.5);
  for (let i = 0; i < 9; i++) {
    const ag = new Agent(names[i], randomLook(i)); W.agents.push(ag); ag.t = rnd(1, 6);
    if (i < 5) { const ch = seats.pop(); seatNow(ag, ch); ag.t = rnd(25, 80); }
    else { const p = randomSpot(); ag.place(p.x, p.z, rnd(0, 6)); ag.state = 'idle'; }
  }
  W.agents[2].chatty = true; W.chattyT = rnd(30, 50); W.chatT = rnd(6, 12);
  const L = new Agent('Librarian', { sk: 2, shirt: 0x7a2e4f, pants: 0x2a2a35, hair: 'bun', g: 'f', glasses: true, long: true, bookCol: 0x333333 }, {});
  L.speed = 1.5; L.isLib = true; L.place(W.post.x, W.post.z, Math.PI); L.faceYaw = Math.PI; L.state = 'post'; L.t = rnd(8, 14); L.holding = false; W.lib = L;
  L.tag.material.map.dispose(); L.av.root.remove(L.tag); L.tag = textSprite('Librarian', { fs: 34, maxW: 300, bg: 'rgba(122,46,79,.85)', color: '#fff', scale: 0.95 }); L.tag.position.y = 2.0; L.av.root.add(L.tag);
}
function randomSpot() { for (let k = 0; k < 40; k++) { const x = rnd(-11, 11), z = rnd(-9, 8.5), c = cellOf(x, z); if (!W.nav[c[1] * NX + c[0]]) return { x, z }; } return { x: 0, z: 6 }; }
function seatNow(ag, ch) { ag.setSeat(ch); ag.x = ch.x; ag.z = ch.z; ag.yaw = Math.atan2(ch.fx, ch.fz); ag.faceYaw = null; ag.state = 'sitting'; ag.sit = 1; ag.reading = true; ag.holding = true; ag.readTitle = randomTitle(); }
function randomTitle() { const b = W.bookData.length ? pick(W.bookData) : null; return b ? b.title : 'a textbook'; }
function freeChair() { const f = W.chairs.filter(c => c.kind === 'chair' && !c.occ); return f.length ? pick(f) : null; }

function npcAI(ag, dt) {
  ag.t -= dt;
  switch (ag.state) {
    case 'idle': {
      ag.reading = false; ag.reaching = false;
      if (ag.t > 0) break;
      if (Math.random() < 0.5 || !freeChair()) { // browse a shelf
        const rows = ['A', 'B', 'C', 'D', 'G'].filter(k => W.books.some(b => b.row === k)); const k = rows.length ? pick(rows) : 'A', list = W.books.filter(b => b.row === k), bk = list.length ? pick(list) : null;
        const s = bk ? bk.slot : null; if (!s) { ag.t = 3; break; }
        ag.target = s; ag.goTo(s.x + s.nx * 0.95, s.z + s.nz * 0.95); ag.state = 'toShelf';
      } else { const ch = freeChair(); ag.chair = ch; ch.occ = ag; const a = { x: ch.x - ch.fx * 0.75, z: ch.z - ch.fz * 0.75 }; ag.goTo(a.x, a.z); ag.state = 'toSeat'; }
      break;
    }
    case 'toShelf':
      if (ag.fail) { ag.state = 'idle'; ag.t = 2; ag.fail = false; break; }
      if (!ag.path.length) { const s = ag.target; ag.faceYaw = Math.atan2(-s.nx, -s.nz); ag.state = 'browse'; ag.t = 1.2; ag.reaching = true; ag.holding = false; }
      break;
    case 'browse':
      if (ag.t <= 0 && ag.reaching) { ag.reaching = false; ag.holding = true; ag.readTitle = randomTitle(); AUD.page(0.04); ag.t = rnd(3, 6); ag.reading = true; }
      else if (ag.t <= 0 && !ag.reaching) { ag.state = 'idle'; ag.t = rnd(0.5, 2); ag.faceYaw = null; if (Math.random() < 0.55 && freeChair()) ag.t = 0.1; else ag.holding = false; if (ag.holding && !freeChair()) ag.holding = false; }
      break;
    case 'toSeat':
      if (ag.fail) { if (ag.chair) ag.chair.occ = null; ag.chair = null; ag.state = 'idle'; ag.t = 2; ag.fail = false; break; }
      if (!ag.path.length) { const ch = ag.chair; ag.tw = { t: 0, dur: 0.7, fx: ag.x, fz: ag.z, tx: ch.x, tz: ch.z }; ag.state = 'sitDown'; ag.faceYaw = null; }
      break;
    case 'sitDown': {
      const w = ag.tw; w.t += dt / w.dur; const k = Math.min(1, w.t); ag.x = w.fx + (w.tx - w.fx) * k; ag.z = w.fz + (w.tz - w.fz) * k; ag.yaw += angDiff(ag.yaw, Math.atan2(ag.chair.fx, ag.chair.fz)) * Math.min(1, dt * 8);
      if (k >= 1) { ag.state = 'sitting'; ag.reading = true; ag.holding = true; if (!ag.readTitle) ag.readTitle = randomTitle(); ag.t = rnd(30, 80); if (distToCam(ag) < 12) AUD.chair(); }
      break;
    }
    case 'sitting':
      if (ag.t <= 0) { const ch = ag.chair, a = { x: ch.x - ch.fx * 0.75, z: ch.z - ch.fz * 0.75 }; ag.tw = { t: 0, dur: 0.6, fx: ag.x, fz: ag.z, tx: a.x, tz: a.z }; ag.state = 'standUp'; ag.reading = false; ag.holding = false; if (distToCam(ag) < 12) AUD.chair(); }
      break;
    case 'standUp': {
      const w = ag.tw; w.t += dt / w.dur; const k = Math.min(1, w.t); ag.x = w.fx + (w.tx - w.fx) * k; ag.z = w.fz + (w.tz - w.fz) * k;
      if (k >= 1) { ag.chair.occ = null; ag.chair = null; ag.state = 'idle'; ag.t = rnd(1, 4); }
      break;
    }
  }
}
const distToCam = a => Math.hypot(G.x - a.x, G.z - a.z);

/* ---------- speakers & noise ---------- */
function speakersList() {
  const L = [{ id: 'me', name: 'you', noise: G.noise, cool: G.pCool, x: G.x, z: G.z, me: true }];
  W.agents.forEach(a => L.push({ id: a.name, name: a.name, noise: a.noise, cool: a.cool, x: a.x, z: a.z, ag: a }));
  Object.values(W.remotes).forEach(r => L.push({ id: r.id, name: r.name, noise: r.noise, cool: r.cool || 0, x: r.x, z: r.z, rem: r }));
  return L;
}
function addNoise(amount, cause) { G.noise = clamp(G.noise + amount, 0, 100); if (cause) G.cause = cause; }

function libAI(dt) {
  const L = W.lib; G.pCool = Math.max(0, G.pCool - dt);
  const near = (x, z) => Math.hypot(x - L.x, z - L.z);
  L.shushing = L.state === 'scold' && L.t > 0.3 && L.t < 2.0;
  if (L.state === 'post' || L.state === 'patrol' || L.state === 'look') {
    L.det = (L.det || 0) - dt;
    if (L.det <= 0 && G.mode !== 'kicked' && G.mode !== 'intro') {
      L.det = 0.4; let best = null;
      speakersList().forEach(s => { const lim = s.me ? NOISE_LIMIT : NOISE_LIMIT; if (s.noise >= lim && !(s.cool > 0 && s.noise < 85)) if (!best || s.noise > best.noise) best = s; });
      if (best) { L.tgt = best; L.state = 'respond'; L.rt = 0; L.speed = best.me ? 2.1 : 1.8; L.faceYaw = null; L.holding = false; if (best.me) { UI.warn.textContent = 'The librarian heard you…'; UI.warn.hidden = false; AUD.warn(); } }
    }
  }
  switch (L.state) {
    case 'post':
      L.faceYaw = Math.PI; L.t -= dt; if (L.t <= 0) { L.state = 'patrol'; L.wps = patrolRoute(); L.wi = 0; L.goTo(L.wps[0].x, L.wps[0].z); L.speed = 1.3; }
      break;
    case 'patrol':
      if (!L.path.length) { L.state = 'look'; L.t = rnd(1.5, 3.2); L.faceYaw = L.yaw + rnd(-0.8, 0.8); L.holding = false; }
      break;
    case 'look':
      L.t -= dt; if (L.t <= 0) { L.wi++; L.faceYaw = null; if (L.wi >= L.wps.length) { L.goTo(W.post.x, W.post.z); L.state = 'returning'; } else { L.state = 'patrol'; L.goTo(L.wps[L.wi].x, L.wps[L.wi].z); } }
      break;
    case 'returning':
      if (!L.path.length) { L.state = 'post'; L.t = rnd(10, 20); }
      break;
    case 'respond': {
      const s = L.tgt, p = s.me ? { x: G.x, z: G.z } : s.rem ? { x: s.rem.x, z: s.rem.z } : { x: s.ag.x, z: s.ag.z };
      L.rt -= dt; if (L.rt <= 0) { L.rt = 0.5; const dx = L.x - p.x, dz = L.z - p.z, d = Math.hypot(dx, dz) || 1; L.goTo(p.x + dx / d * 1.25, p.z + dz / d * 1.25); }
      if (near(p.x, p.z) < 1.9) { L.state = 'scold'; L.t = 2.6; L.path = []; L.faceYaw = Math.atan2(p.x - L.x, p.z - L.z); L.said = false; }
      else if (L.state === 'respond' && !L.path.length && L.rt > 0.2) { L.rt = 0; }
      break;
    }
    case 'scold': {
      const s = L.tgt, p = s.me ? { x: G.x, z: G.z } : s.rem ? { x: s.rem.x, z: s.rem.z } : { x: s.ag.x, z: s.ag.z };
      L.faceYaw = Math.atan2(p.x - L.x, p.z - L.z); L.t -= dt;
      if (!L.said && L.t < 2.25) { L.said = true; scold(s); }
      if (L.t <= 0) { L.state = 'patrol'; L.wps = patrolRoute().slice(0, 2); L.wi = 0; L.goTo(L.wps[0].x, L.wps[0].z); L.speed = 1.3; UI.warn.hidden = true; L.faceYaw = null; }
      break;
    }
  }
}
function patrolRoute() {
  const pts = [{ x: 0, z: 4 }, { x: -5, z: 2.6 }, { x: 0, z: -2.4 }, { x: -11.6, z: -2 }, { x: 11.2, z: -2 }, { x: 0, z: -6.1 }, { x: -6.5, z: -6.1 }, { x: 6.5, z: -6.1 }, { x: 5, z: 3 }, { x: 11, z: 5 }];
  return pts.sort(() => Math.random() - 0.5).slice(0, 3 + Math.floor(Math.random() * 2));
}
function libSay(text) { const L = W.lib; L.say(text); say('Librarian', text); speak(text); }
function scold(s) {
  const L = W.lib; AUD.shh(0.28);
  if (s.me) {
    if (G.noise < 22) { if (G.strikes) libSay('Thank you. Please stay quiet.'); return; }
    if (G.cause === 'run') { libSay(pick(LIB_LINES.run)); G.noise = 5; G.pCool = 20; return; }
    G.strikes++; G.pCool = 22; G.quietT = 0; renderStrikes(); AUD.warn();
    if (G.strikes === 1) { libSay(pick(LIB_LINES.s1)); G.noise = 12; }
    else if (G.strikes === 2) { libSay(pick(LIB_LINES.s2)); G.noise = 10; }
    else { libSay(LIB_LINES.s3); later(3.4, kick); }
  } else if (s.ag) { if (s.ag.noise > 20) { libSay(LIB_LINES.other(s.ag.name)); s.ag.noise = 0; s.ag.cool = 25; setTimeout(() => s.ag && s.ag.say('Sorry, ma.', 'whisper'), 900); } }
  else if (s.rem) { libSay(LIB_LINES.other(s.rem.name)); s.rem.noise = 0; s.rem.cool = 25; }
}
function renderStrikes() { UI.st.innerHTML = [0, 1, 2].map(i => `<b class="${i < G.strikes ? 'on' : ''}"></b>`).join(''); UI.st.title = G.strikes + ' of 3 warnings'; }

function chatterAI(dt) {
  W.chatT -= dt; W.chattyT -= dt;
  if (W.chatT <= 0) {
    W.chatT = rnd(8, 16); const sit = W.agents.filter(a => a.state === 'sitting' && a.bubble == null);
    for (let i = 0; i < sit.length; i++) for (let j = i + 1; j < sit.length; j++) if (Math.hypot(sit[i].x - sit[j].x, sit[i].z - sit[j].z) < 2.3 && Math.random() < 0.5) {
      const c = pick(CHAT), a = sit[i], b = sit[j]; a.say(c[0], 'whisper'); a.talkLook = true; b.talkLook = true; later(2.6, () => { b.say(c[1], 'whisper'); }); later(6, () => { a.talkLook = false; b.talkLook = false; }); a.noise += 6;
      if (distToCam(a) < 9) logChat(a.name, c[0], 'whisper'); if (distToCam(b) < 9) later(2.6, () => logChat(b.name, c[1], 'whisper')); return;
    }
  }
  if (W.chattyT <= 0) {
    W.chattyT = rnd(60, 90); const c = W.agents.find(a => a.chatty); if (c && c.state === 'sitting') { c.say('HAHAHA! No way, that is hilarious!', 'talk'); c.noise = 72; if (distToCam(c) < 14) logChat(c.name, 'HAHAHA! No way, that is hilarious!', 'talk'); }
  }
}

/* ---------- chat (you, the students, other online visitors) ---------- */
let lastSend = 0;
function sendChat(text, mode) {
  text = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 140); if (!text || G.mode === 'kicked') return;
  const now = performance.now(); if (now - lastSend < 900) { say('Library', 'Slow down a little.', 1400); return; } lastSend = now;
  const M = MODES[mode] || MODES.talk; let n = Math.min(M.cap, M.base + text.length * M.per); if (Math.hypot(G.x - W.lib.x, G.z - W.lib.z) < 6) n *= 1.35;
  addNoise(n, 'talk'); if (mode === 'shout') G.noise = Math.max(G.noise, 70); logChat(G.name, text, mode, true); AUD.pop();
  netSend('c', { i: G.id, n: G.name, t: text, m: mode });
  /* nearby students answer */
  const range = mode === 'whisper' ? 4.5 : mode === 'talk' ? 8 : 14; let best = null, bd = 1e9;
  W.agents.forEach(a => { const d = distToCam(a); if (d < range && d < bd) { bd = d; best = a; } });
  if (best && Math.random() < 0.8) later(1.1, () => { const r = pick(REPLY[mode] || REPLY.talk); best.say(r, mode === 'shout' ? 'talk' : 'whisper'); logChat(best.name, r, 'whisper'); });
  if (/sorry|apolog|forgive/i.test(text) && G.strikes && Math.hypot(G.x - W.lib.x, G.z - W.lib.z) < 9) later(1.6, () => { libSay('Thank you. Let us keep it peaceful.'); G.noise = 0; });
}

/* ---------- book view (the book in your hands) ---------- */
function buildBookView() {
  const w = 0.21, h = 0.29, bg = new T.Group(); W.bv = { grp: bg, w, h, cover: null, cur: { p: [0.12, -0.7, -0.6], r: [-0.5, 0.3, 0], a: 0 }, open: false, mode: 'hold', t: 0 };
  const edge = lam(0xf1e6cc), cov = new T.MeshLambertMaterial({ color: 0x2f6f4f }), back = new T.MeshLambertMaterial({ color: 0x2f6f4f }), page = lam(0xf6efdc);
  W.bv.mats = { cov, back };
  const pages = new T.Mesh(new T.BoxGeometry(w - 0.012, h - 0.014, 0.028), [edge, edge, edge, edge, W.bv.rightMat = new T.MeshLambertMaterial({ color: 0xf6efdc }), page]); pages.position.set(w / 2, 0, 0); bg.add(pages);
  const bk2 = new T.Mesh(new T.BoxGeometry(w, h, 0.006), back); bk2.position.set(w / 2, 0, -0.017); bg.add(bk2);
  const sp = new T.Mesh(new T.BoxGeometry(0.008, h, 0.04), back); sp.position.set(0, 0, 0); bg.add(sp);
  const hinge = new T.Group(); bg.add(hinge); hinge.position.z = 0.017;
  W.bv.leftMat = new T.MeshLambertMaterial({ color: 0xf6efdc }); W.bv.frontMat = new T.MeshLambertMaterial({ color: 0x2f6f4f });
  const front = new T.Mesh(new T.BoxGeometry(w, h, 0.006), [cov, cov, cov, cov, W.bv.frontMat, W.bv.leftMat]); front.position.set(w / 2, 0, 0); hinge.add(front); W.bv.hinge = hinge;
  /* hands */
  const skin = lam(SKIN[3]), sleeve = lam(0x2f6f4f), hand = (x) => { const g = new T.Group(); const f = new T.Mesh(new T.CylinderGeometry(0.03, 0.036, 0.5, 8), skin); f.position.y = -0.25; g.add(f); const s = new T.Mesh(new T.CylinderGeometry(0.04, 0.046, 0.3, 8), sleeve); s.position.y = -0.55; g.add(s); const hd = new T.Mesh(new T.SphereGeometry(0.034, 10, 8), skin); g.add(hd); g.position.set(x, -h / 2 + 0.03, 0.03); g.rotation.x = -0.5; bg.add(g); return g; };
  W.bv.hL = hand(0.03); W.bv.hR = hand(w - 0.01); W.viewRoot.add(bg); bg.visible = false;
}
function coverTex(info, color) {
  const c = mkCv(300, 420), x = c.getContext('2d'), col = hexStr(color);
  const g = x.createLinearGradient(0, 0, 300, 420); g.addColorStop(0, col); g.addColorStop(1, '#101a14'); x.fillStyle = g; x.fillRect(0, 0, 300, 420);
  x.strokeStyle = '#e2c26a'; x.lineWidth = 4; x.strokeRect(14, 14, 272, 392); x.lineWidth = 1.5; x.strokeRect(22, 22, 256, 376);
  x.fillStyle = '#e2c26a'; x.textAlign = 'center'; x.font = '700 15px system-ui, sans-serif'; x.fillText('NUASA LIBRARY · UNIUYO', 150, 56);
  x.fillStyle = '#fff7e0'; const L = wrapText(x, info.title, 232, '800 30px Georgia, serif'); x.font = '800 30px Georgia, serif'; L.slice(0, 5).forEach((l, i) => x.fillText(l, 150, 140 + i * 38));
  x.fillStyle = '#e2c26a'; x.font = '600 20px system-ui, sans-serif'; x.fillText(info.course, 150, 350); x.font = '500 15px system-ui, sans-serif'; x.fillText(info.type + (info.session ? ' · ' + info.session : ''), 150, 378);
  const t = new T.CanvasTexture(c); t.anisotropy = 4; return t;
}
function pageTex(info, kind) {
  const c = mkCv(300, 420), x = c.getContext('2d'); x.fillStyle = '#f6efdc'; x.fillRect(0, 0, 300, 420);
  const gr = x.createLinearGradient(kind === 'left' ? 300 : 0, 0, kind === 'left' ? 240 : 60, 0); gr.addColorStop(0, 'rgba(90,70,40,.35)'); gr.addColorStop(1, 'rgba(90,70,40,0)'); x.fillStyle = gr; x.fillRect(0, 0, 300, 420);
  x.fillStyle = '#3b2a18'; x.textAlign = 'left';
  if (kind === 'left') {
    x.font = '700 15px Georgia, serif'; x.fillText('LIBRARY CARD', 40, 54); x.strokeStyle = 'rgba(60,40,20,.35)'; for (let i = 0; i < 12; i++) { x.beginPath(); x.moveTo(40, 100 + i * 24); x.lineTo(262, 100 + i * 24); x.stroke(); }
    x.font = 'italic 14px Georgia, serif'; x.fillText('Borrowed by ' + (G ? G.name : 'a student'), 40, 92); x.fillStyle = 'rgba(184,40,40,.7)'; x.save(); x.translate(180, 330); x.rotate(-0.2); x.strokeStyle = 'rgba(184,40,40,.7)'; x.lineWidth = 3; x.strokeRect(-70, -22, 140, 44); x.font = '800 18px Georgia'; x.textAlign = 'center'; x.fillText(new Date().toLocaleDateString(), 0, 6); x.restore();
  } else {
    x.font = '800 24px Georgia, serif'; wrapText(x, info.title, 230, '800 24px Georgia, serif').slice(0, 4).forEach((l, i) => x.fillText(l, 38, 62 + i * 30));
    x.font = '600 15px system-ui, sans-serif'; x.fillStyle = '#6b4a22'; let y = 200;
    [['Course', info.course], ['Type', info.type], info.session ? ['Session', info.session] : null, info.size ? ['Size', fsz(info.size)] : null, ['Downloads', String(info.downloads)]].filter(Boolean).forEach(r => { x.fillStyle = '#8a6b3a'; x.fillText(r[0], 38, y); x.fillStyle = '#2a1c0e'; x.fillText(String(r[1]).slice(0, 24), 130, y); y += 26; });
    x.fillStyle = '#2f6f4f'; x.font = '700 14px system-ui, sans-serif'; x.fillText(info.demo ? 'Sample shelf: real files appear here' : 'Press R to read this document', 38, 380);
  }
  const t = new T.CanvasTexture(c); t.anisotropy = 4; return t;
}
const fsz = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
function setBookTextures(bk) {
  const bv = W.bv, i = bk.info;
  [bv.frontMat, bv.leftMat, bv.rightMat].forEach(m => { if (m.map) m.map.dispose(); });
  bv.frontMat.map = coverTex(i, bk.color); bv.leftMat.map = pageTex(i, 'left'); bv.rightMat.map = pageTex(i, 'right');
  [bv.frontMat, bv.leftMat, bv.rightMat].forEach(m => { m.color.set(0xffffff); m.needsUpdate = true; });
  bv.mats.cov.color.setHex(bk.color).multiplyScalar(0.8); bv.mats.back.color.setHex(bk.color).multiplyScalar(0.8);
}
function bookPose() {
  const bv = W.bv, asp = W.cam.aspect, hfov = 2 * Math.atan(Math.tan(W.cam.fov * Math.PI / 360) * asp), fit = Math.max(0.46, 0.27 / Math.tan(hfov / 2));
  if (!G.held) return { p: [0.12, -0.75, -0.6], r: [-0.5, 0.3, 0], a: 0 };
  if (G.mode === 'sit' && G.held.open) return { p: [0, -0.3, -Math.max(0.55, fit + 0.06)], r: [-1.05, 0, 0], a: -2.95 };
  if (G.held.open) return { p: [0, -0.07, -fit], r: [-0.22, 0, 0], a: -2.95 };
  const hold = asp < 0.8 ? 0.02 : 0.12;
  return { p: [hold, -0.26, -0.52], r: [-0.45, 0.32, 0.04], a: 0 };
}
function pickBook(bk) {
  if (G.held) { say('Library', 'Put your current book back first (Q).', 2200); return; }
  bk.away = true; bk.mesh.visible = false; G.held = { bk, open: false }; setBookTextures(bk); W.bv.grp.visible = true; W.bv.cur.p = [0.1, -0.8, -0.5]; AUD.page(0.1);
  if (G.guide && G.guide.bk === bk) G.guide = null;
  G.opened.add(bk.info.id); UI.pick = bk; renderCard(); say('Library', 'Press O to open the book, Q to put it back.', 3200);
}
function setOpen(o) {
  if (!G.held) return; G.held.open = o; AUD.page(0.14); renderCard();
  if (o) { const st = stats(); st.books++; lsSet(KEY_STATS, st); }
}
function putBack() {
  if (!G.held) return; const bk = G.held.bk; G.held = null; renderCard(); AUD.thud();
  later(3.5, () => { bk.away = false; bk.mesh.visible = true; AUD.page(0.05); });
  say('Library', 'The librarian will re-shelve it.', 2200);
}
function renderCard() {
  const h = G.held; UI.card.hidden = !(h && h.open);
  if (!h) { UI.hold.hidden = true; return; } UI.hold.hidden = false;
  UI.hold.innerHTML = `<span>Holding <b>${esc(h.bk.info.title.slice(0, 32))}</b></span><button data-a="open">${h.open ? 'Close' : 'Open'} <kbd>O</kbd></button><button data-a="back">Put back <kbd>Q</kbd></button>`;
  if (!h.open) return; const i = h.bk.info;
  UI.card.innerHTML = `<div class="vl-ch"><b>${esc(i.title)}</b><button data-a="close" aria-label="Close book">✕</button></div>
   <div class="vl-cm"><span>${esc(i.course)}</span><span>${esc(i.type)}</span>${i.session ? `<span>${esc(i.session)}</span>` : ''}${i.size ? `<span>${fsz(i.size)}</span>` : ''}<span>${i.downloads.toLocaleString()} downloads</span></div>
   <p class="vl-cs">${esc(i.courseTitle)}</p>
   ${i.demo ? '<p class="vl-cs">This is a sample shelf. Upload a document and, once approved, it appears here as a real book.</p>' : ''}
   <div class="vl-ca">${i.demo ? '' : `<button class="vl-p" data-a="read">${i.link ? 'Open link' : 'Read document'} <kbd>R</kbd></button>${i.link ? '' : '<button data-a="dl">Download</button>'}`}<button data-a="back">Put back <kbd>Q</kbd></button></div>
   ${G.mode === 'sit' ? '<p class="vl-cs">Reading timer: <b id="vl-rt">0:00</b></p>' : '<p class="vl-cs">Find a chair and press E to sit and read comfortably.</p>'}`;
}
function readDoc() { const h = G.held; if (!h || h.bk.info.demo) return; unlock(); site.preview(h.bk.info.id); if (h.bk.info.link) site.get(h.bk.info.id); }

/* ---------- sitting ---------- */
function sitOn(ch) {
  if (ch.occ) { say('Library', 'Someone is sitting there.', 1800); return; }
  G.seat = ch; ch.occ = 'me'; G.stand = { x: G.x, z: G.z };
  G.tw = { t: 0, dur: 0.65, fx: G.x, fz: G.z, fy: G.eye, fyaw: G.yaw, tx: ch.x, tz: ch.z, ty: SEAT_EYE, tyaw: Math.atan2(-ch.fx, -ch.fz) };
  G.mode = 'sit'; G.seatYaw = G.tw.tyaw; AUD.chair(); if (G.held && !G.held.open) setOpen(true); else renderCard(); G.pitch = Math.max(G.pitch, -0.2);
}
function standUp() {
  const ch = G.seat; if (!ch) return; const back = ch.kind === 'chair' ? -0.75 : 0.9; let p = collide(ch.x + ch.fx * back, ch.z + ch.fz * back, 0.3);
  G.tw = { t: 0, dur: 0.5, fx: G.x, fz: G.z, fy: G.eye, fyaw: G.yaw, tx: p[0], tz: p[1], ty: EYE, tyaw: G.yaw, stand: true }; G.mode = 'walk'; ch.occ = null; G.seat = null; AUD.chair(); renderCard();
  if (G.readStart) { const st = stats(); st.mins += G.readAcc / 60; lsSet(KEY_STATS, st); G.readAcc = 0; }
}

/* ---------- targets & actions ---------- */
function scan(pt) {
  const rc = W.rc || (W.rc = new T.Raycaster()); const useCur = pt || (!G.locked && !G.touch && G.cursor); rc.setFromCamera(useCur ? useCur : { x: 0, y: 0 }, W.cam); rc.far = REACH + 0.6;
  const hits = rc.intersectObjects(W.pickables, false), occ = rc.intersectObjects(W.occluders, false), od = occ.length ? occ[0].distance : 1e9;
  for (const h of hits) {
    if (h.distance > od) break; const o = h.object, u = o.userData;
    if (u.bk) { if (u.bk.away || h.distance > REACH) continue; return { kind: 'book', bk: u.bk, d: h.distance }; }
    if (G.mode === 'sit' && !u.agent) continue;
    if (u.chair) { if (h.distance > REACH || G.mode === 'sit') continue; return { kind: 'chair', c: u.chair, d: h.distance }; }
    if (u.agent) { if (h.distance > REACH + 0.5) continue; return { kind: u.agent.isLib ? 'lib' : 'agent', ag: u.agent, d: h.distance }; }
    if (u.donate) { if (h.distance > REACH + 0.3) continue; return { kind: 'donate', d: h.distance }; }
  }
  return null;
}
function describe(t) {
  if (!t) return null;
  if (t.kind === 'book') return { act: G.held ? 'Put your book back first' : 'Pick up', name: t.bk.info.title, sub: t.bk.info.course + ' · ' + t.bk.info.type };
  if (t.kind === 'chair') return { act: t.c.occ ? 'Taken' : 'Sit down', name: t.c.kind === 'sofa' ? 'Sofa' : t.c.kind === 'arm' ? 'Armchair' : 'Reading chair', sub: '' };
  if (t.kind === 'lib') return { act: 'Talk to', name: 'the Librarian', sub: 'Ask for a book, rules, or how to donate' };
  if (t.kind === 'agent') return { act: 'Say hi to', name: t.ag.name, sub: t.ag.holding ? 'Reading “' + t.ag.readTitle.slice(0, 30) + '”' : 'Student' };
  if (t.kind === 'donate') return { act: 'Donate', name: 'a document', sub: 'Upload a file; NUASA approves it' };
}
function actOn(t) {
  if (!t) return; AUD.init();
  if (t.kind === 'book') pickBook(t.bk);
  else if (t.kind === 'chair') sitOn(t.c);
  else if (t.kind === 'lib') libMenu();
  else if (t.kind === 'agent') npcMenu(t.ag);
  else if (t.kind === 'donate') { AUD.pop(); say('Library', 'Thank you for donating. Opening the upload form…', 2000); G.mode === 'walk' && unlock(); setTimeout(() => site.upload(), 300); }
}
function act() {
  if (G.mode === 'kicked' || G.mode === 'intro' || G.panel) return;
  if (G.mode === 'sit' && !G.tw) { standUp(); return; }
  actOn(G.target);
}

/* ---------- dialogs ---------- */
function dialog(who, text, options) {
  G.panel = 'dialog'; unlock(); UI.dlg.hidden = false;
  UI.dlg.innerHTML = `<div class="vl-dw"><b>${esc(who)}</b><p>${esc(text)}</p><div class="vl-do">${options.map((o, i) => `<button data-i="${i}"><kbd>${i + 1}</kbd> ${esc(o.t)}</button>`).join('')}</div></div>`;
  G.dopts = options;
}
function closeDialog() { UI.dlg.hidden = true; G.panel = null; G.dopts = null; }
function chooseDialog(i) { const o = G.dopts && G.dopts[i]; if (!o) return; closeDialog(); AUD.pop(); o.fn && o.fn(); }
function libMenu() {
  const L = W.lib; AUD.bell(); L.faceYaw = Math.atan2(G.x - L.x, G.z - L.z);
  dialog('Librarian', 'Good day. How can I help you?', [
    { t: 'Where can I find past questions?', fn: () => { guideRow('A', 'Past Questions'); libSay('Past questions are on the green shelves, back left. I have marked the way.'); } },
    { t: 'Recommend me something', fn: () => { const b = W.books.length ? pick(W.books) : null; if (b) { guideBook(b); libSay(`Try “${b.info.title.slice(0, 40)}”. I have marked it for you.`); } else libSay('The shelves are being restocked. Please donate a document!'); } },
    { t: 'How do I donate a document?', fn: () => libSay('Use the green donation box near the door. Upload a file, and NUASA will approve it.') },
    { t: 'What are the rules?', fn: () => libSay('Speak softly, walk, and never shout. Three warnings and I will ask you to leave.') },
    { t: 'Never mind', fn: null },
  ]);
}
function npcMenu(ag) {
  ag.faceYaw = Math.atan2(G.x - ag.x, G.z - ag.z); if (ag.state === 'sitting') ag.talkLook = true;
  dialog(ag.name, 'Hi there.', [
    { t: 'Say hello (whisper)', fn: () => { addNoise(8, 'talk'); logChat(G.name, 'Hello!', 'whisper', true); later(0.8, () => { const r = pick(REPLY.whisper); ag.say(r, 'whisper'); logChat(ag.name, r, 'whisper'); }); } },
    { t: 'What are you reading?', fn: () => { later(0.5, () => { const r = ag.holding ? `I am reading “${ag.readTitle.slice(0, 40)}”.` : 'Nothing yet, I am just browsing.'; ag.say(r, 'whisper'); logChat(ag.name, r, 'whisper'); }); } },
    { t: 'Recommend me a book', fn: () => { const b = W.books.length ? pick(W.books) : null; later(0.5, () => { const r = b ? `Try “${b.info.title.slice(0, 36)}”. It is on the ${W.rows[b.row].name} shelf.` : 'Ask the librarian.'; ag.say(r, 'whisper'); logChat(ag.name, r, 'whisper'); if (b) guideBook(b); }); } },
    { t: 'Goodbye', fn: null },
  ]);
  setTimeout(() => { ag.talkLook = false; }, 6000);
}
function guideBook(b) { G.guide = { bk: b, x: b.slot.x, z: b.slot.z, label: b.info.title }; }
function guideRow(k, name) { const R = W.rows[k]; G.guide = { x: R.x, z: R.z, label: name + ' shelves' }; }

/* ---------- search / stats / help panels ---------- */
function openPanel(kind) {
  if (G.mode === 'intro' || G.mode === 'kicked') return; G.panel = kind; unlock(); UI.pan.hidden = false;
  if (kind === 'search') {
    UI.pan.innerHTML = `<div class="vl-pw"><div class="vl-ph"><b>Find a book</b><button data-a="pclose" aria-label="Close">✕</button></div><input id="vl-q" placeholder="Search title, course code or type" autocomplete="off"><div class="vl-res" id="vl-res"></div></div>`;
    const q = $('#vl-q', UI.pan), res = $('#vl-res', UI.pan), draw = () => {
      const t = q.value.trim().toLowerCase(), list = W.books.filter(b => !t || (b.info.title + ' ' + b.info.course + ' ' + b.info.type).toLowerCase().includes(t)).slice(0, 40);
      res.innerHTML = list.length ? list.map(b => `<button data-bi="${W.books.indexOf(b)}"><b>${esc(b.info.title)}</b><span>${esc(b.info.course)} · ${esc(b.info.type)} · ${esc(W.rows[b.row].name)}</span></button>`).join('') : '<p class="vl-cs">No books match. Try a course code like ACC 101.</p>';
    };
    q.oninput = draw; draw(); setTimeout(() => q.focus(), 50);
    if (W.catalog > W.books.length) res.insertAdjacentHTML('beforebegin', `<p class="vl-cs">${W.books.length} of ${W.catalog} files are on the shelves. Use Library on the main page for the rest.</p>`);
  } else if (kind === 'stats') {
    const st = stats(), mins = Math.round(st.mins + G.readAcc / 60), opened = Array.from(G.opened).map(id => W.books.find(b => b.info.id === id)).filter(Boolean);
    UI.pan.innerHTML = `<div class="vl-pw"><div class="vl-ph"><b>Your reading</b><button data-a="pclose" aria-label="Close">✕</button></div>
     <div class="vl-sg"><div><b>${mins}</b><span>minutes read, all time</span></div><div><b>${st.books}</b><span>books opened</span></div><div><b>${st.visits}</b><span>visits</span></div></div>
     <h4>This visit</h4><div class="vl-res">${opened.length ? opened.map(b => `<div class="vl-ro"><b>${esc(b.info.title)}</b><span>${esc(b.info.course)}</span></div>`).join('') : '<p class="vl-cs">You have not opened a book yet.</p>'}</div></div>`;
  } else if (kind === 'help') {
    UI.pan.innerHTML = `<div class="vl-pw"><div class="vl-ph"><b>How it works</b><button data-a="pclose" aria-label="Close">✕</button></div>${helpHtml()}
     <label class="vl-set">Look sensitivity <input type="range" id="vl-sens" min="0.4" max="2.2" step="0.1" value="${G.sens}"></label>
     <label class="vl-set">Volume <input type="range" id="vl-vol" min="0" max="1" step="0.05" value="${AUD.vol}"></label>
     <label class="vl-set"><input type="checkbox" id="vl-voice" ${voicesOn ? 'checked' : ''}> Librarian speaks out loud</label></div>`;
    $('#vl-sens', UI.pan).oninput = e => { G.sens = +e.target.value; saveSet(); }; $('#vl-vol', UI.pan).oninput = e => { AUD.setVol(+e.target.value); saveSet(); }; $('#vl-voice', UI.pan).onchange = e => { voicesOn = e.target.checked; saveSet(); };
  }
}
function closePanel() { UI.pan.hidden = true; G.panel = null; }
const saveSet = () => lsSet(KEY_SET, { sens: G.sens, vol: AUD.vol, voices: voicesOn, on: AUD.on });
function helpHtml() {
  return coarse()
    ? '<ul class="vl-hl"><li><b>Left thumb</b> walk</li><li><b>Drag right side</b> look around</li><li><b>Tap a book</b> pick it up, then tap <b>Open</b></li><li><b>Tap a chair</b> to sit and read</li><li><b>Chat</b> button to talk. Whisper keeps the librarian away.</li></ul>'
    : '<ul class="vl-hl"><li><kbd>W A S D</kbd> walk, <kbd>Shift</kbd> run (noisy)</li><li><b>Mouse</b> look, <b>click / E</b> interact</li><li><kbd>O</kbd> open book, <kbd>R</kbd> read document, <kbd>Q</kbd> put back</li><li><kbd>E</kbd> sit on a chair, any move key stands you up</li><li><kbd>T</kbd> chat, <kbd>F</kbd> find a book, <kbd>M</kbd> mute</li></ul>';
}

/* ---------- kicked out ---------- */
function kick() {
  if (G.mode === 'kicked') return; if (G.seat) { G.seat.occ = null; G.seat = null; } if (G.held) putBack(); closeDialog(); closePanel(); G.mode = 'kicked'; unlock(); UI.fade.classList.add('on'); UI.warn.hidden = true;
  setTimeout(() => { UI.kick.hidden = false; G.kickT = 20; UI.kickBtn.disabled = true; kickTick(); UI.fade.classList.remove('on'); }, 900);
}
function kickTick() { if (!G || G.mode !== 'kicked') return; UI.kickN.textContent = G.kickT > 0 ? `You can come back in ${Math.ceil(G.kickT)}s` : 'You may come back in'; UI.kickBtn.disabled = G.kickT > 0; if (G.kickT > 0) { G.kickT -= 1; setTimeout(kickTick, 1000); } }
function reenter() { UI.kick.hidden = true; G.strikes = 0; G.noise = 0; G.pCool = 0; renderStrikes(); placeAtDoor(); G.mode = 'walk'; W.lib.state = 'post'; W.lib.t = 6; W.lib.path = []; say('Librarian', 'Welcome back. Quietly, this time.', 3200); }
function placeAtDoor() { G.x = 0; G.z = 8.6; G.yaw = 0; G.pitch = 0; G.eye = EYE; G.vx = G.vz = 0; }

/* ---------- live visitors (Supabase Realtime broadcast + presence; optional) ---------- */
const NET = { ch: null, ok: false, count: 1, t: 0 };
function netStart() {
  const c = site.sb(); if (!c || !c.channel) return;
  try {
    NET.ch = c.channel('nuasa-vlib-v1', { config: { broadcast: { self: false }, presence: { key: G.id } } });
    NET.ch.on('broadcast', { event: 's' }, m => onRemoteState(m.payload)).on('broadcast', { event: 'c' }, m => onRemoteChat(m.payload))
      .on('presence', { event: 'sync' }, () => { try { NET.count = Object.keys(NET.ch.presenceState()).length || 1; } catch (e) { /* */ } })
      .subscribe(async st => { if (st === 'SUBSCRIBED') { NET.ok = true; try { await NET.ch.track({ n: G.name }); } catch (e) { /* */ } } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') NET.ok = false; });
  } catch (e) { NET.ch = null; NET.ok = false; }
}
function netSend(ev, payload) { if (!NET.ch || !NET.ok) return; try { NET.ch.send({ type: 'broadcast', event: ev, payload }); } catch (e) { /* */ } }
function netStop() { try { const c = site.sb(); if (NET.ch && c) c.removeChannel(NET.ch); } catch (e) { /* */ } NET.ch = null; NET.ok = false; NET.count = 1; }
const cleanName = n => String(n || 'Student').replace(/[^\w .'-]/g, '').trim().slice(0, 18) || 'Student';
function remoteFor(p) {
  const id = String(p.i).slice(0, 40); let r = W.remotes[id];
  if (!r) { r = new Agent(cleanName(p.n), lookFromId(id)); r.id = id; r.rem = true; r.state = 'remote'; r.place(+p.x || 0, +p.z || 0, 0); W.remotes[id] = r; W.agents.push; logChat('Library', r.name + ' walked in.', 'sys'); }
  return r;
}
function onRemoteState(p) {
  if (!p || !p.i || !G || p.i === G.id || !isFinite(+p.x) || !isFinite(+p.z)) return; const r = remoteFor(p);
  r.tx = clamp(+p.x, -12.5, 12.5); r.tz = clamp(+p.z, -9.5, 9.5); r.tyaw = (+p.y || 0) + Math.PI; r.seen = performance.now(); r.name = cleanName(p.n);
  const si = +p.s; if (si >= 0 && W.chairs[si]) { const ch = W.chairs[si]; if (r.chair !== ch) { if (r.chair) r.chair.occ = null; r.chair = ch; if (!ch.occ) ch.occ = r; } r.tx = ch.x; r.tz = ch.z; r.tyaw = Math.atan2(ch.fx, ch.fz); r.state = 'sitting'; r.reading = true; r.holding = true; }
  else { if (r.chair) { if (r.chair.occ === r) r.chair.occ = null; r.chair = null; } r.state = 'remote'; r.reading = false; r.holding = false; }
}
function onRemoteChat(p) {
  if (!p || !p.i || !G || p.i === G.id || !p.t) return; const r = W.remotes[String(p.i).slice(0, 40)]; if (!r) return;
  const mode = MODES[p.m] ? p.m : 'talk', text = String(p.t).slice(0, 140); r.say(text, mode); logChat(r.name, text, mode);
  const M = MODES[mode]; r.noise = clamp(r.noise + Math.min(M.cap, M.base + text.length * M.per), 0, 100); if (mode === 'shout') r.noise = Math.max(r.noise, 70);
}
function dropRemote(r) { if (r.chair && r.chair.occ === r) r.chair.occ = null; W.scene.remove(r.av.root); const i = W.pickables.indexOf(r.hit); if (i >= 0) W.pickables.splice(i, 1); delete W.remotes[r.id]; logChat('Library', r.name + ' left.', 'sys'); }

/* ---------- input ---------- */
const keys = {};
function lock() { if (G.touch || G.noLock || !W.rd) return; try { const r = W.rd.domElement.requestPointerLock(); if (r && r.catch) r.catch(() => { G.noLock = true; }); } catch (e) { G.noLock = true; } }
function unlock() { try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* */ } }
function look(dx, dy) {
  G.yaw -= dx * 0.0022 * G.sens; G.pitch = clamp(G.pitch - dy * 0.0022 * G.sens, -1.35, 1.35);
  if (G.mode === 'sit' && G.seatYaw != null) G.yaw = G.seatYaw + clamp(angDiff(G.seatYaw, G.yaw), -1.3, 1.3);
}
function bindInput() {
  const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); listeners.push([t, ev, fn, o]); };
  const cv = W.rd.domElement;
  on(window, 'keydown', e => keyEv(e, true)); on(window, 'keyup', e => keyEv(e, false)); on(window, 'blur', () => { for (const k in keys) keys[k] = false; });
  on(document, 'pointerlockchange', () => { G.locked = document.pointerLockElement === cv; UI.pause.hidden = !(!G.locked && !G.touch && (G.mode === 'walk' || G.mode === 'sit') && !G.panel && !G.noLock); });
  on(document, 'pointerlockerror', () => { G.noLock = true; });
  on(window, 'resize', resize);
  on(document, 'mousemove', e => { if (G.locked) look(e.movementX, e.movementY); else if (G.md) { const dx = e.clientX - G.md.x, dy = e.clientY - G.md.y; G.md.x = e.clientX; G.md.y = e.clientY; G.md.moved += Math.abs(dx) + Math.abs(dy); if (G.noLock) look(dx, dy); } if (!G.locked) { const r = cv.getBoundingClientRect(); G.cursor = { x: (e.clientX - r.left) / r.width * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 }; G.curPx = [e.clientX, e.clientY]; } });
  on(cv, 'pointerdown', e => {
    if (e.pointerType === 'touch') return touchDown(e);
    AUD.init(); if (G.mode === 'intro' || G.mode === 'kicked') return;
    if (!G.locked && !G.noLock) { if (!G.panel) lock(); return; }
    G.md = { x: e.clientX, y: e.clientY, moved: 0 };
  });
  on(window, 'pointerup', e => {
    if (e.pointerType === 'touch') return touchUp(e);
    if (G.md && G.md.moved < 6 && !G.panel) { if (G.locked) act(); else if (G.noLock) { G.cursor = { x: (e.clientX / innerWidth) * 2 - 1, y: -(e.clientY / innerHeight) * 2 + 1 }; G.target = scan(G.cursor); act(); } }
    G.md = null;
  });
  on(window, 'pointermove', e => { if (e.pointerType === 'touch') touchMove(e); });
  on(window, 'pointercancel', e => { if (e.pointerType === 'touch') touchUp(e); });
  on(cv, 'contextmenu', e => e.preventDefault());
}
function keyEv(e, down) {
  if (!G || $('#vlp').getAttribute('aria-hidden') === 'true') return;
  const el = e.target, typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
  if (typing) { if (down && e.code === 'Escape') { el.blur(); if (G.panel === 'search') closePanel(); } if (down && e.code === 'Enter' && el.id === 'vl-txt') { e.preventDefault(); submitChat(); } return; }
  if (G.mode === 'intro') { if (down && e.code === 'Enter') { e.preventDefault(); enter(); } return; }
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  keys[e.code] = down; if (!down) return;
  if (G.panel === 'dialog') { if (e.code === 'Escape') closeDialog(); else if (/^Digit[1-9]$/.test(e.code)) chooseDialog(+e.code.slice(5) - 1); return; }
  if (G.panel) { if (e.code === 'Escape') closePanel(); return; }
  if (G.mode === 'kicked') return;
  if (G.mode === 'sit' && !G.tw && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) { standUp(); return; }
  switch (e.code) {
    case 'KeyE': case 'Enter': e.preventDefault(); act(); break;
    case 'KeyQ': if (G.held) putBack(); break;
    case 'KeyO': if (G.held) setOpen(!G.held.open); break;
    case 'KeyR': readDoc(); break;
    case 'KeyT': e.preventDefault(); focusChat(); break;
    case 'KeyF': e.preventDefault(); openPanel('search'); break;
    case 'KeyH': openPanel('help'); break;
    case 'KeyM': toggleSound(); break;
  }
}
function focusChat() { UI.chat.classList.add('open'); unlock(); setTimeout(() => UI.txt.focus(), 30); }
function submitChat() { const t = UI.txt.value; UI.txt.value = ''; if (t.trim()) sendChat(t, G.chatMode); UI.txt.blur(); if (!G.touch) setTimeout(lock, 30); }
function toggleSound() { AUD.init(); AUD.setOn(!AUD.on); UI.snd.classList.toggle('off', !AUD.on); saveSet(); say('Library', AUD.on ? 'Sound on' : 'Sound off', 1200); }

/* touch: floating joystick on the left, drag-to-look on the right, tap an object to use it */
function touchDown(e) {
  AUD.init(); if (G.mode === 'intro' || G.mode === 'kicked' || G.panel) return; G.touch = true; document.body.classList.add('vl-touch');
  const left = e.clientX < innerWidth * 0.42 && !G.joyId;
  if (left) { G.joyId = e.pointerId; G.joyO = [e.clientX, e.clientY]; UI.joy.style.cssText = `left:${e.clientX - 55}px;top:${e.clientY - 55}px;display:block`; UI.joyK.style.transform = 'translate(0,0)'; }
  else if (!G.lookId) { G.lookId = e.pointerId; G.lookP = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() }; }
}
function touchMove(e) {
  if (e.pointerId === G.joyId) { const dx = e.clientX - G.joyO[0], dy = e.clientY - G.joyO[1], d = Math.min(1, Math.hypot(dx, dy) / 50), a = Math.atan2(dy, dx); G.joy.x = Math.cos(a) * d; G.joy.y = Math.sin(a) * d; UI.joyK.style.transform = `translate(${Math.cos(a) * d * 40}px,${Math.sin(a) * d * 40}px)`; }
  else if (e.pointerId === G.lookId) { look((e.clientX - G.lookP.x) * 1.5, (e.clientY - G.lookP.y) * 1.5); G.lookP.x = e.clientX; G.lookP.y = e.clientY; }
}
function touchUp(e) {
  if (e.pointerId === G.joyId) { G.joyId = null; G.joy.x = G.joy.y = 0; UI.joy.style.display = 'none'; }
  else if (e.pointerId === G.lookId) {
    const p = G.lookP; G.lookId = null; if (!p) return;
    if (performance.now() - p.t < 280 && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 12 && !G.panel) { const r = W.rd.domElement.getBoundingClientRect(); const pt = { x: (e.clientX - r.left) / r.width * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 }; const t = scan(pt); if (t) { G.target = t; act(); } else if (G.mode === 'sit') standUp(); }
  }
}

/* ---------- HUD ---------- */
function hudTemplate() {
  const ic = p => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  return `<canvas id="vl-cv" tabindex="0" aria-label="A 3D library you can walk around"></canvas>
<div class="vl-ui">
 <div class="vl-top">
  <button class="vl-b" id="vl-exit" aria-label="Leave the library">${ic('<path d="M15 18l-6-6 6-6"/>')}<span>Leave</span></button>
  <div class="vl-ttl"><b>NUASA Reading Hall</b><small id="vl-live">Quiet hall</small></div>
  <div class="vl-meter" title="How loud you are. Stay out of the red."><span>Noise</span><i><u id="vl-nb"></u><s></s></i><em id="vl-st"></em></div>
  <div class="vl-tools">
   <button class="vl-b ic" id="vl-bs" aria-label="Find a book">${ic('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>')}</button>
   <button class="vl-b ic" id="vl-bc" aria-label="Chat">${ic('<path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.6A8 8 0 1 1 21 12z"/>')}</button>
   <button class="vl-b ic" id="vl-br" aria-label="Your reading">${ic('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zM20 17v4H6.5A2.5 2.5 0 0 1 4 19.5"/>')}</button>
   <button class="vl-b ic" id="vl-bm" aria-label="Sound">${ic('<path d="M11 5L6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>')}</button>
   <button class="vl-b ic" id="vl-bh" aria-label="Help">${ic('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>')}</button>
  </div>
 </div>
 <div class="vl-ret" id="vl-ret"></div><div class="vl-tag" id="vl-tag" hidden></div>
 <div class="vl-guide" id="vl-guide" hidden></div><div class="vl-warn" id="vl-warn" hidden></div>
 <div class="vl-sub" id="vl-sub" hidden><b id="vl-sw"></b><span id="vl-stx"></span></div>
 <div class="vl-hold" id="vl-hold" hidden></div>
 <button class="vl-prompt" id="vl-prompt" hidden></button>
 <aside class="vl-chat" id="vl-chat"><div class="vl-log" id="vl-log"></div>
  <div class="vl-cin"><div class="vl-mode" id="vl-mode"><button data-m="whisper" class="on">Whisper</button><button data-m="talk">Talk</button><button data-m="shout">Shout</button></div>
  <div class="vl-row"><input id="vl-txt" maxlength="140" placeholder="Say something… (T)" autocomplete="off" enterkeyhint="send"><button id="vl-send" class="vl-p">Send</button></div></div></aside>
 <aside class="vl-card" id="vl-card" hidden></aside><div class="vl-dlg" id="vl-dlg" hidden></div><div class="vl-pan" id="vl-pan" hidden></div>
 <div class="vl-joy" id="vl-joy"><i id="vl-jk"></i></div>
 <div class="vl-pause" id="vl-pause" hidden>Click to look around</div>
 <div class="vl-fade" id="vl-fade"></div>
 <div class="vl-kick" id="vl-kick" hidden><div class="vl-kw"><h2>You were asked to leave</h2><p>The librarian gave you three warnings. The hall needs to stay quiet so everyone can study.</p><p id="vl-kn" class="vl-cs"></p><div class="vl-ca"><button class="vl-p" id="vl-kb" disabled>Come back in</button><button id="vl-ke">Back to the site</button></div></div></div>
 <div class="vl-intro" id="vl-intro"><div class="vl-iw"><img src="/icons/icon-192.png" alt="" width="64" height="64"><h1>NUASA Reading Hall</h1>
  <p>Walk the shelves, pick up real library documents, sit down and read. Other students are here too. Keep your voice down or the librarian will have a word.</p>
  <label class="vl-nm">Your name in the hall <input id="vl-name" maxlength="18" autocomplete="off"></label>
  <ul class="vl-hl">${coarse() ? '<li><b>Left thumb</b> walk</li><li><b>Drag right side</b> look</li><li><b>Tap</b> books, chairs and people</li><li><b>Chat</b> button to talk (whisper!)</li>' : '<li><kbd>W A S D</kbd> walk · <kbd>Shift</kbd> run</li><li><b>Click / E</b> pick up, sit, talk</li><li><kbd>O</kbd> open book · <kbd>R</kbd> read it</li><li><kbd>T</kbd> chat · <kbd>F</kbd> find a book</li>'}</ul>
  <button class="vl-p big" id="vl-go" disabled>Opening the doors…</button><p class="vl-cs">Sound and the librarian’s voice are generated in your browser.</p></div></div>
</div>`;
}
function bindUI() {
  const r = $('#vlp'), g = id => $(id, r);
  UI = { root: r, sub: g('#vl-sub'), subWho: g('#vl-sw'), subTxt: g('#vl-stx'), log: g('#vl-log'), chat: g('#vl-chat'), txt: g('#vl-txt'), card: g('#vl-card'), hold: g('#vl-hold'), dlg: g('#vl-dlg'), pan: g('#vl-pan'), prompt: g('#vl-prompt'), tag: g('#vl-tag'), ret: g('#vl-ret'), nb: g('#vl-nb'), st: g('#vl-st'), live: g('#vl-live'), warn: g('#vl-warn'), guide: g('#vl-guide'), pause: g('#vl-pause'), fade: g('#vl-fade'), kick: g('#vl-kick'), kickN: g('#vl-kn'), kickBtn: g('#vl-kb'), joy: g('#vl-joy'), joyK: g('#vl-jk'), snd: g('#vl-bm'), intro: g('#vl-intro'), go: g('#vl-go'), name: g('#vl-name') };
  r.addEventListener('click', onUiClick); listeners.push([r, 'click', onUiClick]);
  const tm = g('#vl-mode'); tm.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; G.chatMode = b.dataset.m; tm.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); UI.txt.focus(); });
  UI.txt.addEventListener('focus', () => { unlock(); UI.chat.classList.add('open'); }); UI.txt.addEventListener('blur', () => { if (!G.touch) UI.chat.classList.remove('open'); });
  UI.txt.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); submitChat(); } else if (e.key === 'Escape') UI.txt.blur(); });
  g('#vl-send').onclick = () => submitChat();
  g('#vl-exit').onclick = close; g('#vl-ke').onclick = close; UI.kickBtn.onclick = reenter; g('#vl-go').onclick = enter;
  g('#vl-bs').onclick = () => openPanel('search'); g('#vl-br').onclick = () => openPanel('stats'); g('#vl-bh').onclick = () => openPanel('help'); UI.snd.onclick = toggleSound;
  g('#vl-bc').onclick = () => { UI.chat.classList.toggle('open'); if (UI.chat.classList.contains('open')) { unlock(); setTimeout(() => UI.txt.focus(), 30); } };
  UI.prompt.onclick = e => { e.stopPropagation(); AUD.init(); if (G.mode === 'sit' && !G.target) standUp(); else act(); };
  UI.name.value = lsGet(KEY_NAME, '') || site.name() || '';
}
function onUiClick(e) {
  const b = e.target.closest('[data-a],[data-i],[data-bi]'); if (!b) return;
  const a = b.dataset.a;
  if (b.dataset.i != null && G.panel === 'dialog') return chooseDialog(+b.dataset.i);
  if (b.dataset.bi != null) { const bk = W.books[+b.dataset.bi]; closePanel(); if (bk) { guideBook(bk); libSay2(`Marked “${bk.info.title.slice(0, 36)}” on the ${W.rows[bk.row].name} shelves.`); } return; }
  if (a === 'open') setOpen(!G.held.open); else if (a === 'close') setOpen(false); else if (a === 'back') putBack(); else if (a === 'read') readDoc(); else if (a === 'dl') { if (G.held) site.get(G.held.bk.info.id); } else if (a === 'pclose') closePanel();
}
function libSay2(t) { say('Library', t, 3200); }
function resize() { if (!W || !W.rd) return; const c = W.rd.domElement, w = c.clientWidth || innerWidth, h = c.clientHeight || innerHeight; W.rd.setSize(w, h, false); W.cam.aspect = w / h; W.cam.fov = w / h < 0.8 ? 80 : 72; W.cam.updateProjectionMatrix(); }

/* ---------- frame ---------- */
function movePlayer(dt) {
  if (G.tw) {
    const w = G.tw; w.t += dt / w.dur; const k = Math.min(1, w.t), e = k * k * (3 - 2 * k);
    G.x = w.fx + (w.tx - w.fx) * e; G.z = w.fz + (w.tz - w.fz) * e; G.eye = w.fy + (w.ty - w.fy) * e; G.yaw = w.fyaw + angDiff(w.fyaw, w.tyaw) * e;
    if (k >= 1) { G.tw = null; if (G.mode === 'sit') { G.readStart = performance.now(); if (G.held) renderCard(); } }
    return;
  }
  const can = G.mode === 'walk' && !G.panel && document.activeElement !== UI.txt; let tvx = 0, tvz = 0, spd = 0;
  if (can) {
    if (keys.ArrowLeft) G.yaw += dt * 1.9; if (keys.ArrowRight) G.yaw -= dt * 1.9;
    let f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - G.joy.y, s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + G.joy.x; const l = Math.hypot(f, s); if (l > 1) { f /= l; s /= l; }
    const run = (keys.ShiftLeft || keys.ShiftRight) && f > 0.3, sp = run ? RUN : SPEED, fx = -Math.sin(G.yaw), fz = -Math.cos(G.yaw), rx = Math.cos(G.yaw), rz = -Math.sin(G.yaw);
    tvx = (fx * f + rx * s) * sp; tvz = (fz * f + rz * s) * sp; G.running = run && l > 0.1;
  }
  G.vx += (tvx - G.vx) * Math.min(1, dt * 10); G.vz += (tvz - G.vz) * Math.min(1, dt * 10);
  if (Math.abs(G.vx) + Math.abs(G.vz) > 0.01) {
    let p = collide(G.x + G.vx * dt, G.z + G.vz * dt, 0.3);
    W.agents.forEach(a => { const dx = p[0] - a.x, dz = p[1] - a.z, d = Math.hypot(dx, dz); if (d < 0.55 && d > 0.001) { p[0] += dx / d * (0.55 - d); p[1] += dz / d * (0.55 - d); } });
    G.x = p[0]; G.z = p[1];
  }
  spd = Math.hypot(G.vx, G.vz); G.bobP += spd * dt * 2.3; G.stride += spd * dt;
  if (G.stride > 1.8) { G.stride = 0; if (spd > 0.6) { AUD.step(); } }
  if (G.running && spd > 3) addNoise(7 * dt, 'run');
  G.eye += ((EYE - G.eye) * Math.min(1, dt * 8)) * (G.mode === 'walk' ? 1 : 0); G.spd = spd;
}
function updateWorld(dt) {
  W.time += dt;
  for (let i = W.pending.length - 1; i >= 0; i--) { const p = W.pending[i]; p.t -= dt; if (p.t <= 0) { W.pending.splice(i, 1); try { p.fn(); } catch (e) { /* */ } } }
  movePlayer(dt);
  G.noise = Math.max(0, G.noise - dt * 9); if (G.noise < 15 && G.strikes > 0) { G.quietT += dt; if (G.quietT > 90) { G.strikes--; G.quietT = 0; renderStrikes(); } } else if (G.noise >= 15) G.quietT = 0;
  W.agents.forEach(a => { if (a.rem) return; npcAI(a, dt); });
  if (G.mode !== 'intro') chatterAI(dt);
  libAI(dt);
  const cp = W.cam.position; W.agents.forEach(a => a.update(dt, cp)); W.lib.update(dt, cp);
  const now = performance.now();
  Object.values(W.remotes).forEach(r => {
    if (now - r.seen > 9000) return dropRemote(r);
    const dx = r.tx - r.x, dz = r.tz - r.z, d = Math.hypot(dx, dz), k = Math.min(1, dt * 8); r.x += dx * k; r.z += dz * k; r.yaw += angDiff(r.yaw, r.tyaw) * k; r.forceMove = r.state === 'sitting' ? 0 : Math.min(2.4, d * 6); r.update(dt, cp);
  });
  if (G.mode === 'sit' && !G.tw && G.held && G.held.open) { G.readAcc += dt; const el = $('#vl-rt'); if (el) { const s = Math.floor(G.readAcc); el.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); } }
  /* environment */
  W.shafts.forEach((s, i) => { s.material.opacity = 0.42 + Math.sin(W.time * 0.4 + i) * 0.1; });
  const dp = W.dust.geometry.attributes.position; for (let i = 0; i < dp.count; i++) { let y = dp.getY(i) + Math.sin(W.time * 0.3 + i) * 0.0015 - 0.0012; if (y < 0.3) y = 4; dp.setY(i, y); dp.setX(i, dp.getX(i) + Math.sin(W.time * 0.2 + i * 1.7) * 0.0012); } dp.needsUpdate = true;
  W.globe.rotation.y += dt * 0.4;
  const d = new Date(), s = d.getSeconds() + d.getMilliseconds() / 1000, m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60; W.clockHands.s.rotation.z = -s / 60 * Math.PI * 2; W.clockHands.m.rotation.z = -m / 60 * Math.PI * 2; W.clockHands.h.rotation.z = -h / 12 * Math.PI * 2;
  G.tickT -= dt; if (G.tickT <= 0) { G.tickT = 1; G.tickA = !G.tickA; if (Math.hypot(G.x + 3.6, G.z + 10) < 12) AUD.tick(G.tickA); }
  G.ambT -= dt; if (G.ambT <= 0) { G.ambT = rnd(7, 18); AUD.page(0.03); }
  /* camera + book in hand */
  const bob = G.mode === 'walk' ? Math.sin(G.bobP) * 0.028 * Math.min(1, G.spd / 2) : 0;
  if (G.mode === 'intro') { const t = W.time * 0.15; W.cam.position.set(Math.sin(t) * 2.2, 2.0, 9.2); W.cam.rotation.set(-0.06, Math.sin(t) * 0.15, 0); }
  else { W.cam.position.set(G.x, G.eye + bob, G.z); W.cam.rotation.set(G.pitch, G.yaw, 0); }
  W.viewRoot.position.copy(W.cam.position); W.viewRoot.quaternion.copy(W.cam.quaternion);
  const bv = W.bv, tp = bookPose(), k = Math.min(1, dt * 9), sway = Math.sin(G.bobP) * 0.004 * Math.min(1, G.spd / 2);
  for (let i = 0; i < 3; i++) { bv.cur.p[i] += (tp.p[i] - bv.cur.p[i]) * k; bv.cur.r[i] += (tp.r[i] - bv.cur.r[i]) * k; } bv.cur.a += (tp.a - bv.cur.a) * Math.min(1, dt * 7);
  bv.grp.position.set(bv.cur.p[0], bv.cur.p[1] + sway, bv.cur.p[2]); bv.grp.rotation.set(bv.cur.r[0], bv.cur.r[1], bv.cur.r[2]); bv.hinge.rotation.y = bv.cur.a;
  const op = Math.min(1, -bv.cur.a / 2.95); bv.hL.position.x = 0.03 - op * (bv.w - 0.02); bv.hR.position.x = bv.w - 0.01; bv.grp.visible = !!G.held || bv.cur.p[1] > -0.7;
}
function updateHud(dt) {
  G.hudT -= dt; if (G.hudT > 0) return; G.hudT = 0.1;
  const n = G.noise; UI.nb.style.width = Math.min(100, n) + '%'; UI.nb.parentNode.className = n >= NOISE_LIMIT ? 'hot' : n >= 35 ? 'warm' : '';
  if (G.mode === 'intro' || G.mode === 'kicked') { UI.prompt.hidden = true; UI.tag.hidden = true; return; }
  const free = !G.panel && !G.tw; G.target = free ? scan() : null; const d = G.target && describe(G.target);
  if (G.hoverBk && (!G.target || G.target.bk !== G.hoverBk)) { G.hoverBk.spineMat.emissive.setHex(G.guide && G.guide.bk === G.hoverBk ? 0x7a6a1a : 0); G.hoverBk = null; }
  if (G.target && G.target.bk && !G.held) { G.hoverBk = G.target.bk; G.hoverBk.spineMat.emissive.setHex(0x2d5a3a); }
  UI.ret.classList.toggle('on', !!d && !G.touch);
  if (d) { UI.tag.hidden = false; UI.tag.innerHTML = `<b>${esc(d.name)}</b>${d.sub ? `<span>${esc(d.sub)}</span>` : ''}`; const x = G.locked || G.touch || !G.curPx ? innerWidth / 2 : G.curPx[0], y = G.locked || G.touch || !G.curPx ? innerHeight / 2 : G.curPx[1]; UI.tag.style.transform = `translate(${Math.round(x)}px,${Math.round(y + 26)}px) translateX(-50%)`; } else UI.tag.hidden = true;
  let pt = ''; if (d) pt = `<kbd>E</kbd>${esc(d.act)} <b>${esc(d.name.length > 30 ? d.name.slice(0, 29) + '…' : d.name)}</b>`; else if (G.mode === 'sit' && !G.tw) pt = '<kbd>E</kbd>Stand up';
  UI.prompt.hidden = !pt || !!G.panel; if (pt && UI.prompt._h !== pt) { UI.prompt.innerHTML = pt; UI.prompt._h = pt; }
  UI.prompt.classList.toggle('dis', !!(d && d.act === 'Taken'));
  UI.live.textContent = NET.ok ? `● Live · ${NET.count} ${NET.count === 1 ? 'student' : 'students'} here` : 'Quiet hall · simulated'; UI.live.className = NET.ok ? 'on' : '';
  const g = G.guide;
  if (g) { const dd = Math.hypot(g.x - G.x, g.z - G.z); UI.guide.hidden = false; UI.guide.textContent = `${g.label.length > 38 ? g.label.slice(0, 37) + '…' : g.label} · ${Math.round(dd)} m`; if (dd < 1.7 && !G.held) { if (g.bk) { /* keep until picked up */ } else G.guide = null; } W.arrow.visible = true; W.arrow.position.set(g.x, 3.2 + Math.sin(W.time * 3) * 0.12, g.z); W.arrow.scale.setScalar(0.55 + Math.min(1.2, dd * 0.05)); if (g.bk && !g.bk.away) g.bk.spineMat.emissive.setHex(Math.sin(W.time * 5) > 0 ? 0x8a7420 : 0x3a300a); }
  else { UI.guide.hidden = true; W.arrow.visible = false; }
  if (UI.warn && !UI.warn.hidden && W.lib.state !== 'respond' && W.lib.state !== 'scold') UI.warn.hidden = true;
  W.since = (W.since || 0) + 0.1; if (W.since > 0.5) { W.since = 0; lazySpines(); }
}
function lazySpines() { let n = 0; for (const b of W.books) { if (b.tex || n > 6) continue; if (Math.hypot(b.slot.x - G.x, b.slot.z - G.z) < 8.5) { b.tex = spineTexture(b); b.spineMat.map = b.tex; b.spineMat.needsUpdate = true; n++; } } }
function render() { const rd = W.rd; rd.clear(); rd.render(W.scene, W.cam); if (W.bv.grp.visible) { rd.clearDepth(); rd.render(W.view, W.cam); } }

/* ---------- open / close ---------- */
function arrowSprite() {
  const c = mkCv(64, 64), x = c.getContext('2d'); x.fillStyle = '#e2c26a'; x.strokeStyle = '#3e2814'; x.lineWidth = 4; x.beginPath(); x.moveTo(32, 58); x.lineTo(8, 22); x.lineTo(24, 22); x.lineTo(24, 4); x.lineTo(40, 4); x.lineTo(40, 22); x.lineTo(56, 22); x.closePath(); x.fill(); x.stroke();
  const s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), depthTest: false, transparent: true })); s.renderOrder = 10; s.visible = false; s.center.set(0.5, 0); return s;
}
let isOpen = false, tick0 = 0;
function open() {
  if (isOpen) return; isOpen = true; const r = $('#vlp'); if (!r) { isOpen = false; return; }
  r.setAttribute('aria-hidden', 'false'); r.classList.add('show'); document.body.style.overflow = 'hidden';
  r.innerHTML = '<div class="vl-load"><i></i><p>Opening the library doors…</p></div>';
  loadThree().then(init).catch(() => { r.innerHTML = '<div class="vl-load"><p>Could not load the 3D engine. Check your connection and try again.</p><button class="vl-b" id="vl-x">Close</button></div>'; const x = $('#vl-x'); if (x) x.onclick = close; });
}
function init() {
  if (!isOpen) return; T = window.THREE; const r = $('#vlp'); r.innerHTML = hudTemplate(); let canvas = $('#vl-cv', r);
  try { buildWorld(canvas); } catch (e) { console.warn('NUASA library: 3D failed', e); r.innerHTML = '<div class="vl-load"><p>This browser could not start 3D graphics. Try a recent Chrome, Edge, Safari or Firefox.</p><button class="vl-b" id="vl-x">Close</button></div>'; const x = $('#vl-x'); if (x) x.onclick = close; W = null; return; }
  const set = lsGet(KEY_SET, {}); voicesOn = set.voices !== false; AUD.vol = set.vol != null ? set.vol : 0.8; AUD.on = set.on !== false;
  const touch = coarse();
  G = { mode: 'intro', panel: null, x: 0, z: 8.6, yaw: 0, pitch: 0, eye: EYE, vx: 0, vz: 0, spd: 0, bobP: 0, stride: 0, sens: set.sens || 1, locked: false, touch, noLock: false, joy: { x: 0, y: 0 }, held: null, seat: null, tw: null, noise: 0, strikes: 0, pCool: 0, quietT: 0, cause: 'talk', opened: new Set(), readAcc: 0, guide: null, chatMode: 'whisper', hudT: 0, tickT: 0, ambT: 8, id: (window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'u' + Math.random().toString(36).slice(2) + Date.now().toString(36)), name: 'Student', last: performance.now() };
  if (touch) document.body.classList.add('vl-touch');
  bindUI(); W.occluders = W.occluders || []; spawnPeople(); buildBookView(); W.arrow = arrowSprite(); W.scene.add(W.arrow);
  UI.snd.classList.toggle('off', !AUD.on); renderStrikes(); bindInput(); resize();
  UI.go.disabled = false; UI.go.textContent = 'Enter the library'; setTimeout(() => { try { UI.go.focus(); } catch (e) { /* */ } }, 50);
  const loop = now => { if (!isOpen || !G) return; raf = requestAnimationFrame(loop); const dt = Math.min(0.05, (now - G.last) / 1000 || 0.016); G.last = now; try { updateWorld(dt); updateHud(dt); render(); } catch (e) { console.warn('NUASA library frame', e); } fpsAdapt(dt); };
  raf = requestAnimationFrame(loop);
}
let fpsAcc = 0, fpsN = 0, pr = 0;
function fpsAdapt(dt) { fpsAcc += dt; fpsN++; if (fpsAcc > 3) { const f = fpsN / fpsAcc; pr = pr || W.rd.getPixelRatio(); if (f < 34 && pr > 0.8) { pr = Math.max(0.75, pr - 0.25); W.rd.setPixelRatio(pr); resize(); } fpsAcc = 0; fpsN = 0; } }
function enter() {
  if (!G || G.mode !== 'intro') return; AUD.init(); AUD.on = AUD.on; if (AUD.master) AUD.master.gain.value = AUD.on ? AUD.vol : 0;
  G.name = cleanName(UI.name.value || site.name() || 'Student'); lsSet(KEY_NAME, G.name); UI.intro.hidden = true; UI.intro.style.display = 'none';
  placeAtDoor(); G.mode = 'walk'; const st = stats(); st.visits++; lsSet(KEY_STATS, st); AUD.bell(); netStart();
  later(1.2, () => { libSay(LIB_LINES.welcome); W.lib.shushing = false; });
  if (!G.touch) lock(); setTimeout(() => say('Library', G.touch ? 'Drag to look · tap books to pick them up' : 'Click a book to pick it up · T to chat · F to find a book', 4200), 6500);
  logChat('Library', 'Welcome, ' + G.name + '. Whisper to chat quietly.', 'sys');
}
function close() {
  if (!isOpen) return; isOpen = false; cancelAnimationFrame(raf); netStop(); unlock(); try { speechSynthesis.cancel(); } catch (e) { /* */ }
  listeners.forEach(l => l[0].removeEventListener(l[1], l[2], l[3])); listeners = [];
  if (W) { try { W.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(x => { if (x.map) x.map.dispose(); x.dispose(); }); }); W.view.traverse(o => { if (o.geometry) o.geometry.dispose(); }); W.rd.dispose(); if (W.rd.forceContextLoss) W.rd.forceContextLoss(); } catch (e) { /* */ } }
  for (const k in matCache) delete matCache[k]; for (const k in geoC) delete geoC[k];
  if (G && G.seat) G.seat.occ = null; G = null; W = null; UI = {}; for (const k in keys) delete keys[k];
  try { if (AUD.ac && AUD.ac.state === 'running') AUD.ac.suspend(); } catch (e) { /* */ }
  const r = $('#vlp'); if (r) { r.classList.remove('show'); r.setAttribute('aria-hidden', 'true'); r.innerHTML = ''; }
  document.body.classList.remove('vl-touch'); const o = document.body; if (!document.querySelector('#erp.show,#pjp.show,#adm.show')) o.style.overflow = '';
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-vl]'); if (!b) return; e.preventDefault(); try { if (typeof od === 'function') od(false); } catch (x) { /* */ } open(); });
window.NuasaVL = { open, close };
if (location.hash === '#enter-library') addEventListener('load', () => setTimeout(open, 500));
})();
