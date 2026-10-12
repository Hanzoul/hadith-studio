/* ===== Whiteboard engine: SVG paths -> progressive canvas strokes with a drawing hand ===== */
const W = 1920, H = 1080;
const INK = '#1f1d1a', BEIGE = '#d8bf8f', GREEN = '#2e5a46', GREEN_L = '#a9c2a8', PAPER = '#f3ead6';
const REG_W = 2200, REG_H = 1300;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, u) => a + (b - a) * u;
const ease = u => (u = clamp(u, 0, 1), u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
const easeOut = u => (u = clamp(u, 0, 1), 1 - Math.pow(1 - u, 3));

/* ---------- path sampling via hidden SVG ---------- */
const _svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
_svg.setAttribute('width', '0'); _svg.setAttribute('height', '0');
_svg.style.position = 'absolute'; _svg.style.left = '-9999px';
document.documentElement.appendChild(_svg);
const _p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); _svg.appendChild(_p);
let _seed = 1;
function sampleD(d, wobble = 1) {
  const subs = d.trim().split(/(?=M)/).filter(s => s.trim());
  const out = [];
  for (const s of subs) {
    _p.setAttribute('d', s);
    const L = _p.getTotalLength();
    if (!(L > 0.5)) continue;
    const n = Math.max(2, Math.ceil(L / 3));
    const pts = new Float32Array(n * 2 + 2);
    const sd = (_seed = (_seed * 9301 + 49297) % 233280) / 233280 * 100;
    for (let i = 0; i <= n; i++) {
      const q = _p.getPointAtLength(L * i / n);
      const k = i / n * L;
      const wx = wobble * (Math.sin(k * .021 + sd) * .9 + Math.sin(k * .067 + sd * 2) * .4);
      const wy = wobble * (Math.cos(k * .019 + sd * 1.3) * .9 + Math.sin(k * .059 + sd) * .4);
      pts[i * 2] = q.x + wx; pts[i * 2 + 1] = q.y + wy;
    }
    out.push({ pts, n: n + 1, L });
  }
  return out;
}

/* ---------- matrices ---------- */
const M = {
  I: () => [1, 0, 0, 1, 0, 0],
  mul: (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]],
  T: (x, y) => [1, 0, 0, 1, x, y],
  S: (sx, sy = sx) => [sx, 0, 0, sy, 0, 0],
  R: r => [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0],
  ap: (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]],
};

/* ---------- film model ---------- */
const FILM = { scenes: [], items: [], erases: [], anims: {}, tasks: [] };
let CUR_SCENE = null;

function scene(id, t0, t1, opt, build) {
  const prev = FILM.scenes[FILM.scenes.length - 1];
  let rx = 0, ry = 0;
  if (prev) {
    if (opt.trans === 'erase' || opt.same) { rx = prev.rx; ry = prev.ry; }
    else { const d = opt.dir || 'r'; rx = prev.rx + (d === 'r' ? 1 : d === 'l' ? -1 : 0); ry = prev.ry + (d === 'd' ? 1 : d === 'u' ? -1 : 0); }
  }
  const sc = { id, t0, t1, title: opt.title || id, desc: opt.desc || '', hand: opt.hand || '', rx, ry, ox: rx * REG_W, oy: ry * REG_H, trans: opt.trans || 'pan', cam0: opt.cam0 || [960, 540, 1], cam1: opt.cam1 || opt.cam0 || [960, 540, 1] };
  sc.cam1 = sc.cam1.slice();
  FILM.scenes.push(sc); CUR_SCENE = sc;
  if (prev && sc.trans === 'erase') eraseAll(t0 - 0.05, 1.3, prev);
  build && build();
  return sc;
}

let _uid = 0;
function addItem(it) {
  it.id = it.id || ('i' + (_uid++));
  it.sc = CUR_SCENE; it.ox = CUR_SCENE.ox; it.oy = CUR_SCENE.oy;
  FILM.items.push(it); return it;
}
/* tf: {x,y,s,r,fx}. local coords -> scene coords */
function tfMat(tf) {
  tf = tf || {};
  let m = M.T(tf.x || 0, tf.y || 0);
  if (tf.r) m = M.mul(m, M.R(tf.r));
  m = M.mul(m, M.S((tf.s || 1) * (tf.fx ? -1 : 1), tf.s || 1));
  return m;
}
/* ink: strokes = array of d strings or {d,w,c}; t start, dur */
function ink(strokes, t, dur, o = {}) {
  if (typeof strokes === 'string') strokes = [strokes];
  const st = [];
  for (const s of strokes) {
    const S = typeof s === 'string' ? { d: s } : s;
    for (const sub of sampleD(S.d, S.wob ?? o.wob ?? 1)) st.push({ ...sub, w: S.w || o.w || 5, c: S.c || o.c || INK });
  }
  return addItem({ k: 'ink', st, t, dur, tf: o.tf, g: o.g, hideAt: o.hideAt, pivot: o.pivot, alpha: o.alpha });
}
function fill(d, t, dur, c, o = {}) {
  const sub = sampleD(d, 0.5);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  sub.forEach(s => { for (let i = 0; i < s.n; i++) { x0 = Math.min(x0, s.pts[i * 2]); x1 = Math.max(x1, s.pts[i * 2]); y0 = Math.min(y0, s.pts[i * 2 + 1]); y1 = Math.max(y1, s.pts[i * 2 + 1]); } });
  return addItem({ k: 'fill', d, p2d: new Path2D(d), t, dur, c, bb: [x0, y0, x1, y1], tf: o.tf, g: o.g, hideAt: o.hideAt, alpha: o.alpha ?? .85 });
}
let TEXTCTX;
var TEXT_DIR = (typeof TEXT_DIR !== 'undefined' && TEXT_DIR) || 'rtl';
function text(s, x, y, t, dur, o = {}) {
  const size = o.size || 64, rtl = (o.dir || TEXT_DIR) !== 'ltr', font = o.font || (rtl ? 'ruqaa' : 'hand');
  const fam = font === 'amiri' ? `"Amiri", "Times New Roman", serif` : font === 'kufi' ? `"Reem Kufi", "Amiri", sans-serif` : font === 'hand' ? `"Kalam", "Comic Sans MS", cursive` : `"Aref Ruqaa", "Amiri", serif`;
  const f = `${o.weight || 700} ${size}px ${fam}`;
  const lines = s.split('\n');
  return addItem({ k: 'text', lines, x, y, t, dur, size, f, c: o.c || INK, lh: o.lh || 1.45, tf: o.tf, g: o.g, hideAt: o.hideAt, align: o.align || 'center', rtl });
}
function anim(g, t, dur, p) { (FILM.anims[g] = FILM.anims[g] || []).push({ t, dur, ...p }); }
/* erase: rect in scene coords [x,y,w,h], or full */
function erase(rect, t, dur) {
  const sc = CUR_SCENE;
  const bw = clamp(Math.min(rect[2], rect[3]) * 0.45, 24, 110);
  FILM.erases.push({ sc, ox: sc.ox, oy: sc.oy, rect, t, dur, full: false, bw });
}
function eraseAll(t, dur, sc) {
  FILM.erases.push({ sc, ox: sc.ox, oy: sc.oy, rect: [40, 40, 1840, 1000], t, dur, full: true, bw: 300 });
}

/* ---------- group animation matrix ---------- */
function animMat(g, t) {
  let m = M.I();
  if (!g) return m;
  const parts = g.split(' ');
  for (const gg of parts) {
    const L = FILM.anims[gg]; if (!L) continue;
    for (const a of L) {
      if (t < a.t) continue;
      let u = a.dur ? (t - a.t) / a.dur : 1;
      let k;
      if (a.loop) { // oscillation while active
        if (t > a.t + a.dur) { k = 0; } else { const f = Math.sin((t - a.t) * Math.PI * 2 * (a.hz || 1)); k = f * Math.min(1, (t - a.t) / .3, (a.t + a.dur - t) / .3); }
      } else if (a.yoyo) { k = Math.sin(clamp(u, 0, 1) * Math.PI); }
      else k = ease(u);
      const pv = a.pv || [0, 0];
      let mm = M.T(pv[0] + (a.dx || 0) * k, pv[1] + (a.dy || 0) * k);
      if (a.r) mm = M.mul(mm, M.R(a.r * k));
      if (a.s) mm = M.mul(mm, M.S(1 + a.s * k));
      mm = M.mul(mm, M.T(-pv[0], -pv[1]));
      m = M.mul(m, mm);
    }
  }
  return m;
}
function itemMat(it, t) {
  // scene offset * group anim (in scene coords) * tf
  return M.mul(M.T(it.ox, it.oy), M.mul(animMat(it.g, t), tfMat(it.tf)));
}

/* ---------- per-item drawing schedule ---------- */
function prep() {
  for (const it of FILM.items) {
    if (it.k === 'ink') {
      const n = it.st.length; const tot = it.st.reduce((a, s) => a + s.L, 0) || 1;
      const travel = n > 1 ? Math.min(it.dur * 0.18, (n - 1) * 0.12) : 0;
      const gap = n > 1 ? travel / (n - 1) : 0;
      let tt = it.t; it.sch = [];
      for (const s of it.st) { const d = (it.dur - travel) * s.L / tot; it.sch.push([tt, tt + d]); tt += d + gap; }
    }
  }
  // text measuring (needed for auto-clear)
  const c = document.createElement('canvas').getContext('2d');
  for (const it of FILM.items) if (it.k === 'text') { c.font = it.f; it.ws = it.lines.map(l => c.measureText(l).width); }
  autoClear();
  // hand tasks
  const T = [];
  for (const it of FILM.items) if (it.dur > 0.05) T.push({ t0: it.t, t1: it.t + it.dur, it, kind: 'pen' });
  for (const e of FILM.erases) T.push({ t0: e.t, t1: e.t + e.dur, e, kind: 'eraser' });
  T.sort((a, b) => a.t0 - b.t0);
  FILM.tasks = T;
}
/* ---------- auto-clear: never write text over still-visible text ----------
   Finds text items whose box overlaps an earlier, still-visible text in the same scene.
   FILM.collisions = list (for checks). Fix: erase the old text right before (if the hand is free),
   otherwise the old text disappears at that moment (hideAt). Disable with window.AUTO_CLEAR=false. */
function textBox(it) {
  if (!it.ws) return null;
  const n = it.lines.length; let x0 = 1e9, x1 = -1e9;
  it.lines.forEach((l, li) => { const w = it.ws[li]; const xr = it.align === 'right' ? it.x : it.align === 'left' ? it.x + w : it.x + w / 2; x0 = Math.min(x0, xr - w); x1 = Math.max(x1, xr); });
  let b = [x0, it.y - it.size * .8, x1, it.y + (n - 1) * it.size * it.lh + it.size * .3];
  if (it.tf) { const m = tfMat(it.tf); const P = [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]].map(p => M.ap(m, p[0], p[1])); b = [Math.min(...P.map(p => p[0])), Math.min(...P.map(p => p[1])), Math.max(...P.map(p => p[0])), Math.max(...P.map(p => p[1]))]; }
  return b;
}
function _inter(a, b) { const w = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), h = Math.min(a[3], b[3]) - Math.max(a[1], b[1]); return w > 0 && h > 0 ? [w, h] : null; }
function _goneAt(it, t) { // is item already removed (hideAt / erase / full erase) at time t?
  if (it.hideAt != null && it.hideAt <= t) return true;
  for (const e of FILM.erases) {
    if (e.sc !== it.sc || e.t < it.t || e.t + e.dur > t + .01) continue;
    if (e.full) return true;
    const r = [e.rect[0], e.rect[1], e.rect[0] + e.rect[2], e.rect[1] + e.rect[3]], bb = it._bb; if (!bb) continue;
    const I = _inter(r, bb); if (I && I[0] * I[1] >= .6 * (bb[2] - bb[0]) * (bb[3] - bb[1])) return true;
  }
  return false;
}
function _handFree(t0, t1, skip) {
  for (const it of FILM.items) if (it !== skip && it.dur > .05 && it.t < t1 - .01 && it.t + it.dur > t0 + .01) return false;
  for (const e of FILM.erases) if (e.t < t1 - .01 && e.t + e.dur > t0 + .01) return false;
  return true;
}
function autoClear() {
  const TX = FILM.items.filter(it => it.k === 'text' && it.ws);
  TX.forEach(it => it._bb = textBox(it));
  FILM.collisions = []; FILM.autoFixes = [];
  const byT = TX.slice().sort((a, b) => a.t - b.t);
  for (let j = 0; j < byT.length; j++) {
    const B = byT[j];
    for (let i = 0; i < j; i++) {
      const A = byT[i]; if (A.sc !== B.sc || A === B) continue;
      const I = _inter(A._bb, B._bb); if (!I) continue;
      const hA = A._bb[3] - A._bb[1], hB = B._bb[3] - B._bb[1];
      const aA = (A._bb[2] - A._bb[0]) * hA, aB = (B._bb[2] - B._bb[0]) * hB;
      if (I[1] < .3 * Math.min(hA, hB) || I[0] * I[1] < .08 * Math.min(aA, aB)) continue;
      if (_goneAt(A, B.t)) continue;
      FILM.collisions.push({ sc: B.sc.id, t: +B.t.toFixed(2), text: B.lines.join(' '), over: A.lines.join(' '), overT: +A.t.toFixed(2) });
      if (typeof window !== 'undefined' && window.AUTO_CLEAR === false) continue;
      const pad = 14, r = [A._bb[0] - pad, A._bb[1] - pad, A._bb[2] - A._bb[0] + 2 * pad, A._bb[3] - A._bb[1] + 2 * pad];
      const ed = clamp(.25 + (r[2] * r[3]) / 400000, .35, .8);
      if (_handFree(B.t - ed - .03, B.t - .01)) {
        const bw = clamp(Math.min(r[2], r[3]) * 0.45, 24, 110);
        FILM.erases.push({ sc: A.sc, ox: A.sc.ox, oy: A.sc.oy, rect: r, t: B.t - ed - .02, dur: ed, full: false, bw, auto: true });
        FILM.erases.sort((a, b) => a.t - b.t);
        A.hideAt = B.t - .01; FILM.autoFixes.push('erase ' + A.lines.join(' ').slice(0, 30) + ' @' + (B.t - ed).toFixed(2));
      } else if (B.dur >= .8 && _handFree(B.t, B.t + Math.min(ed, B.dur * .35) + .02, B)) {
        // no free time before: use the beginning of B's writing time to erase first
        const e2 = Math.min(ed, B.dur * .35), bw = clamp(Math.min(r[2], r[3]) * 0.45, 24, 110);
        FILM.erases.push({ sc: A.sc, ox: A.sc.ox, oy: A.sc.oy, rect: r, t: B.t, dur: e2, full: false, bw, auto: true });
        FILM.erases.sort((a, b) => a.t - b.t);
        A.hideAt = B.t + e2; B.t += e2 + .02; B.dur -= e2 + .02;
        FILM.autoFixes.push('erase(in) ' + A.lines.join(' ').slice(0, 30) + ' @' + (B.t - e2).toFixed(2));
      } else {
        A.hideAt = B.t; FILM.autoFixes.push('hide ' + A.lines.join(' ').slice(0, 30) + ' @' + B.t.toFixed(2));
      }
    }
  }
}


/* position of the pen while working on a task at time t (scene-world coords) */
function taskPos(task, t) {
  if (task.kind === 'eraser') {
    const e = task.e; let [x, y, w, h] = e.rect; const u = clamp((t - e.t) / e.dur, 0, 1);
    if (!e.full) { const i = e.bw / 2; x += i; y += i; w = Math.max(1, w - 2 * i); h = Math.max(1, h - 2 * i); }
    const rows = Math.max(2, Math.ceil(h / (e.full ? 230 : e.bw * .7)) + 1);
    const v = u * rows; const r = Math.floor(Math.min(v, rows - .001)); const f = v - r;
    const px = (r % 2 ? x + w - f * w : x + f * w); const py = y + (r + f) / rows * h;
    return [e.ox + px, e.oy + py];
  }
  const it = task.it, m = itemMat(it, t);
  if (it.k === 'ink') {
    let si = it.sch.length - 1;
    for (let i = 0; i < it.sch.length; i++) { if (t < it.sch[i][1]) { si = i; break; } }
    const [a, b] = it.sch[si];
    if (t < a && si > 0) { // traveling between strokes
      const p = it.st[si - 1], q = it.st[si];
      const pa = [p.pts[(p.n - 1) * 2], p.pts[(p.n - 1) * 2 + 1]], qa = [q.pts[0], q.pts[1]];
      const pb = it.sch[si - 1][1]; const u = ease((t - pb) / Math.max(.001, a - pb));
      return M.ap(m, lerp(pa[0], qa[0], u), lerp(pa[1], qa[1], u));
    }
    const s = it.st[si]; const u = clamp((t - a) / Math.max(.001, b - a), 0, 1);
    const k = Math.min(s.n - 1, Math.floor(u * (s.n - 1)));
    return M.ap(m, s.pts[k * 2], s.pts[k * 2 + 1]);
  }
  if (it.k === 'text') {
    const u = clamp((t - it.t) / it.dur, 0, 1);
    const tot = it.ws.reduce((a, b) => a + b, 0);
    let acc = u * tot, li = 0;
    while (li < it.ws.length - 1 && acc > it.ws[li]) { acc -= it.ws[li]; li++; }
    const w = it.ws[li]; const xr = it.align === 'right' ? it.x : it.align === 'left' ? it.x + w : it.x + w / 2;
    const y = it.y + li * it.size * it.lh;
    const px = it.rtl === false ? xr - w + acc : xr - acc; const py = y - it.size * .28 + Math.sin(acc * .09) * it.size * .22;
    return M.ap(m, px, py);
  }
  if (it.k === 'fill') {
    const u = clamp((t - it.t) / it.dur, 0, 1); const [x0, y0, x1, y1] = it.bb;
    const px = lerp(x0, x1, u); const py = lerp(y0, y1, .5 + .5 * Math.sin(u * Math.PI * 2 * Math.max(3, (x1 - x0) / 40)));
    return M.ap(m, px, py);
  }
}

/* ---------- camera ---------- */
function camAt(t) {
  const S = FILM.scenes; let i = 0;
  while (i < S.length - 1 && t >= S[i + 1].t0) i++;
  const sc = S[i];
  const u = ease((t - sc.t0) / Math.max(1, sc.t1 - sc.t0));
  let c = [sc.ox + lerp(sc.cam0[0], sc.cam1[0], u), sc.oy + lerp(sc.cam0[1], sc.cam1[1], u), lerp(sc.cam0[2], sc.cam1[2], u)];
  const TR = 1.5;
  if (i > 0 && t < sc.t0 + TR && sc.trans !== 'erase') {
    const p = S[i - 1];
    const pc = [p.ox + p.cam1[0], p.oy + p.cam1[1], p.cam1[2]];
    const v = ease((t - sc.t0) / TR);
    const dip = sc.trans === 'zoom' ? 0.35 : 0.12;
    c = [lerp(pc[0], c[0], v), lerp(pc[1], c[1], v), lerp(pc[2], c[2], v) * (1 - dip * Math.sin(v * Math.PI))];
  }
  return { x: c[0], y: c[1], z: c[2], sc, i };
}
const worldToScreen = (cam, x, y) => [(x - cam.x) * cam.z + W / 2, (y - cam.y) * cam.z + H / 2];
const screenToWorld = (cam, x, y) => [(x - W / 2) / cam.z + cam.x, (y - H / 2) / cam.z + cam.y];

/* ---------- hand state ---------- */
function handAt(t, cam) {
  const T = FILM.tasks;
  let lo = 0, hi = T.length - 1, cur = null, prev = null, next = null;
  // linear scan near (tasks ~ few hundred) – binary search on t0
  while (lo <= hi) { const m = (lo + hi) >> 1; if (T[m].t0 <= t) lo = m + 1; else hi = m - 1; }
  // candidates: tasks with t0<=t; find one active
  for (let j = hi; j >= Math.max(0, hi - 6); j--) { if (T[j].t1 >= t) { cur = T[j]; break; } }
  if (cur) { const p = taskPos(cur, t); return { pos: p, active: true, kind: cur.kind, lift: 0 }; }
  // previous finished task = the one with max t1 < t
  for (let j = hi; j >= Math.max(0, hi - 8); j--) { if (!prev || T[j].t1 > prev.t1) prev = T[j]; }
  next = T[hi + 1];
  const rest = screenToWorld(cam, W + 260, H + 320);
  const kindN = next ? next.kind : 'pen';
  const pp = prev ? taskPos(prev, prev.t1) : rest;
  const np = next ? taskPos(next, next.t0) : rest;
  const a = prev ? prev.t1 : -10, b = next ? next.t0 : 1e9, gap = b - a;
  if (gap < 2.4) {
    const u = (t - a) / gap; const v = ease(clamp((u - .1) / .8, 0, 1));
    return { pos: [lerp(pp[0], np[0], v), lerp(pp[1], np[1], v) - Math.sin(v * Math.PI) * 30], active: false, kind: u > .5 ? kindN : (prev ? prev.kind : kindN), lift: Math.sin(v * Math.PI) };
  }
  const out = .8, inn = .8;
  if (t < a + out) { const v = ease((t - a) / out); return { pos: [lerp(pp[0], rest[0], v), lerp(pp[1], rest[1], v)], active: false, kind: prev ? prev.kind : 'pen', lift: 1 }; }
  if (t > b - inn) { const v = ease((t - (b - inn)) / inn); return { pos: [lerp(rest[0], np[0], v), lerp(rest[1], np[1], v)], active: false, kind: kindN, lift: 1 - v }; }
  return { pos: rest, active: false, kind: 'pen', lift: 1, off: true };
}

/* ---------- renderer ---------- */
const HAND_SCALE = 0.62;
let CV, CX, LAYER, LX, PAPER_TILE, HAND_PEN, HAND_ERASER;
function initRenderer(canvas) {
  CV = canvas; CX = canvas.getContext('2d');
  LAYER = document.createElement('canvas'); LAYER.width = W; LAYER.height = H; LX = LAYER.getContext('2d');
  PAPER_TILE = makePaper();
  HAND_PEN = makeHand(false); HAND_ERASER = makeHand(true);
  prep();
}
function makePaper() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
  x.fillStyle = PAPER; x.fillRect(0, 0, 512, 512);
  const id = x.getImageData(0, 0, 512, 512); let s = 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < id.data.length; i += 4) { const n = (rnd() - .5) * 10; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n * .8; }
  x.putImageData(id, 0, 0);
  x.globalAlpha = .05; x.strokeStyle = '#8a7350';
  for (let i = 0; i < 90; i++) { x.lineWidth = rnd() * 1.2; x.beginPath(); const a = rnd() * 512, b = rnd() * 512; x.moveTo(a, b); x.bezierCurveTo(a + rnd() * 60, b + rnd() * 20, a + rnd() * 90, b - rnd() * 20, a + rnd() * 140, b + rnd() * 10); x.stroke(); }
  return c;
}

function drawItem(ctx, it, t, cam) {
  if (t < it.t) return;
  if (it.hideAt != null && t >= it.hideAt) return;
  const m = itemMat(it, t);
  ctx.save();
  ctx.setTransform(cam.z * m[0], cam.z * m[1], cam.z * m[2], cam.z * m[3], (m[4] - cam.x) * cam.z + W / 2, (m[5] - cam.y) * cam.z + H / 2);
  const sc = Math.hypot(m[0], m[1]);
  if (it.alpha != null) ctx.globalAlpha = it.alpha;
  if (it.k === 'ink') {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < it.st.length; i++) {
      const s = it.st[i], [a, b] = it.sch[i];
      if (t < a) break;
      const u = clamp((t - a) / Math.max(.001, b - a), 0, 1);
      const k = u >= 1 ? s.n - 1 : Math.floor(u * (s.n - 1));
      ctx.strokeStyle = s.c; ctx.lineWidth = s.w / sc;
      ctx.beginPath(); ctx.moveTo(s.pts[0], s.pts[1]);
      for (let j = 1; j <= k; j++) ctx.lineTo(s.pts[j * 2], s.pts[j * 2 + 1]);
      if (k === 0) ctx.lineTo(s.pts[0] + .01, s.pts[1]);
      ctx.stroke();
    }
  } else if (it.k === 'fill') {
    const u = clamp((t - it.t) / it.dur, 0, 1); const [x0, y0, x1, y1] = it.bb;
    ctx.beginPath(); ctx.rect(x0 - 5, y0 - 5, (x1 - x0 + 10) * u, y1 - y0 + 10); ctx.clip();
    ctx.fillStyle = it.c; ctx.fill(it.p2d);
  } else if (it.k === 'text') {
    const u = clamp((t - it.t) / it.dur, 0, 1);
    const tot = it.ws.reduce((a, b) => a + b, 0); let acc = u * tot;
    const ltr = it.rtl === false;
    ctx.font = it.f; ctx.fillStyle = it.c; ctx.textBaseline = 'alphabetic'; ctx.direction = ltr ? 'ltr' : 'rtl';
    it.lines.forEach((l, li) => {
      const w = it.ws[li]; const xr = it.align === 'right' ? it.x : it.align === 'left' ? it.x + w : it.x + w / 2;
      const y = it.y + li * it.size * it.lh; const show = clamp(acc, 0, w); acc -= w;
      if (show <= 0) return;
      ctx.save(); ctx.beginPath();
      if (ltr) ctx.rect(xr - w - 8, y - it.size * 1.6, show + 12, it.size * 2.4); else ctx.rect(xr - show - 4, y - it.size * 1.6, show + 12, it.size * 2.4);
      ctx.clip();
      if (ltr) { ctx.textAlign = 'left'; ctx.fillText(l, xr - w, y); } else { ctx.textAlign = 'right'; ctx.fillText(l, xr, y); }
      ctx.restore();
    });
  }
  ctx.restore();
}

function eraserPath(e, t) { // returns screen-space polyline of the swept zigzag
  const n = 60, out = []; const u1 = clamp((t - e.t) / e.dur, 0, 1);
  for (let i = 0; i <= n; i++) { const u = u1 * i / n; out.push(taskPos({ kind: 'eraser', e }, e.t + u * e.dur)); }
  return out;
}

function render(ctx, t) {
  const cam = camAt(t);
  // paper (moves with camera)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const pat = ctx.createPattern(PAPER_TILE, 'repeat');
  const off = [(-cam.x * cam.z) % 512, (-cam.y * cam.z) % 512];
  ctx.save(); ctx.translate(off[0], off[1]); ctx.fillStyle = pat; ctx.fillRect(-off[0], -off[1], W, H); ctx.restore();

  // content into layer
  LX.setTransform(1, 0, 0, 1, 0, 0); LX.clearRect(0, 0, W, H);
  const vx0 = cam.x - W / 2 / cam.z - 200, vx1 = cam.x + W / 2 / cam.z + 200, vy0 = cam.y - H / 2 / cam.z - 200, vy1 = cam.y + H / 2 / cam.z + 200;
  const visible = sc => !(sc.ox + 1920 < vx0 || sc.ox > vx1 || sc.oy + 1080 < vy0 || sc.oy > vy1);
  // events in time order: draw items, apply erases
  const ers = FILM.erases.filter(e => e.t <= t && visible(e.sc));
  let ei = 0;
  const fullDone = FILM.erases.filter(e => e.full && t >= e.t + e.dur);
  for (const it of FILM.items) {
    if (it.t > t || !visible(it.sc)) continue;
    while (ei < ers.length && ers[ei].t <= it.t) { applyErase(ers[ei], t, cam); ei++; }
    if (fullDone.some(e => e.sc === it.sc && it.t < e.t)) continue;
    drawItem(LX, it, t, cam);
  }
  while (ei < ers.length) { applyErase(ers[ei], t, cam); ei++; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(LAYER, 0, 0);

  // hand
  const h = handAt(t, cam);
  if (!h.off) {
    const [sx, sy] = worldToScreen(cam, h.pos[0], h.pos[1]);
    const img = h.kind === 'eraser' ? HAND_ERASER : HAND_PEN;
    const rot = -0.05 + (sx - 960) / 1920 * 0.22 + (h.active ? Math.sin(t * 9) * .012 : 0);
    const s = HAND_SCALE * (1.0 + h.lift * 0.035);
    // shadow
    ctx.save(); ctx.translate(sx + 16 + h.lift * 16, sy + 20 + h.lift * 18); ctx.rotate(rot); ctx.scale(s, s);
    ctx.globalAlpha = .2; ctx.drawImage(img.shadow, -img.ax, -img.ay); ctx.restore();
    ctx.save(); ctx.translate(sx, sy - h.lift * 6); ctx.rotate(rot); ctx.scale(s, s);
    ctx.drawImage(img.c, -img.ax, -img.ay); ctx.restore();
  }
  // soft vignette
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, H * 1.05);
  g.addColorStop(0, 'rgba(90,70,40,0)'); g.addColorStop(1, 'rgba(90,70,40,.16)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  return cam;
}
function applyErase(e, t, cam) {
  const pts = eraserPath(e, t);
  LX.save(); LX.setTransform(1, 0, 0, 1, 0, 0); LX.globalCompositeOperation = 'destination-out';
  LX.lineCap = 'round'; LX.lineJoin = 'round'; LX.lineWidth = e.bw * cam.z; LX.strokeStyle = '#000';
  LX.beginPath();
  pts.forEach((p, i) => { const [x, y] = worldToScreen(cam, p[0], p[1]); i ? LX.lineTo(x, y) : LX.moveTo(x, y); });
  if (pts.length === 1) { const [x, y] = worldToScreen(cam, pts[0][0], pts[0][1]); LX.lineTo(x + .1, y); }
  LX.stroke(); LX.restore();
}
