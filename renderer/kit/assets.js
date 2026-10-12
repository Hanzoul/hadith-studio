/* ===== Doodle asset library: every asset returns SVG path strings around its own origin ===== */
const f1 = n => +n.toFixed(1);
function loop(cx, cy, rx, ry, a0 = -Math.PI / 2, sweep = Math.PI * 2 + 0.3, n = 40) {
  let d = '';
  for (let i = 0; i <= n; i++) { const a = a0 + sweep * i / n; const k = 1 + 0.03 * Math.sin(i * 1.7); d += (i ? ' L ' : 'M ') + f1(cx + Math.cos(a) * rx * k) + ' ' + f1(cy + Math.sin(a) * ry * k); }
  return d;
}
const circ = (cx, cy, r, ov = .25) => loop(cx, cy, r, r, -Math.PI / 2 - .2, Math.PI * 2 + ov, Math.max(16, Math.round(r / 2)));
const dot = (cx, cy, r = 4) => loop(cx, cy, r, r, 0, Math.PI * 4, 14);
const ln = (a, b, c, d) => `M ${a} ${b} L ${c} ${d}`;
const qd = (a, b, c, d, e, f) => `M ${a} ${b} Q ${c} ${d} ${e} ${f}`;
const poly = (pts, close) => 'M ' + pts.map(p => p.join(' ')).join(' L ') + (close ? ' Z' : '');
const rrect = (x, y, w, h, r = 14) => `M ${x + r} ${y} L ${x + w - r} ${y} Q ${x + w} ${y} ${x + w} ${y + r} L ${x + w} ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} L ${x + r} ${y + h} Q ${x} ${y + h} ${x} ${y + h - r} L ${x} ${y + r} Q ${x} ${y} ${x + r + 2} ${y - 1}`;
const arcP = (cx, cy, r, a0, a1, n = 24) => { let d = ''; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; d += (i ? ' L ' : 'M ') + f1(cx + Math.cos(a) * r) + ' ' + f1(cy + Math.sin(a) * r); } return d; };

const A = {
  /* --- marks --- */
  arrow(x1, y1, x2, y2, bend = 0.25) {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1;
    const cx = mx - dy * bend, cy = my + dx * bend;
    const ang = Math.atan2(y2 - cy, x2 - cx), h = 26;
    return [`M ${x1} ${y1} Q ${f1(cx)} ${f1(cy)} ${x2} ${y2}`, `M ${f1(x2 - Math.cos(ang - .45) * h)} ${f1(y2 - Math.sin(ang - .45) * h)} L ${x2} ${y2} L ${f1(x2 - Math.cos(ang + .45) * h)} ${f1(y2 - Math.sin(ang + .45) * h)}`];
  },
  ring: (cx, cy, rx, ry) => [loop(cx, cy, rx, ry, -2.6, Math.PI * 2 + .6, 50)],
  underline: (x1, x2, y) => [`M ${x1} ${y} Q ${(x1 * 3 + x2) / 4} ${y + 10} ${(x1 + x2) / 2} ${y + 2} T ${x2} ${y - 4}`],
  check: (x, y, s = 1) => [`M ${x - 30 * s} ${y} L ${x - 8 * s} ${y + 24 * s} L ${x + 36 * s} ${y - 30 * s}`],
  cross: (x, y, s = 1) => [ln(x - 28 * s, y - 28 * s, x + 28 * s, y + 28 * s), ln(x + 28 * s, y - 28 * s, x - 28 * s, y + 28 * s)],
  qmark: (x, y, s = 1) => [`M ${x - 22 * s} ${y - 30 * s} Q ${x - 20 * s} ${y - 62 * s} ${x + 4 * s} ${y - 60 * s} Q ${x + 30 * s} ${y - 56 * s} ${x + 24 * s} ${y - 30 * s} Q ${x + 18 * s} ${y - 12 * s} ${x} ${y - 4 * s} L ${x} ${y + 12 * s}`, dot(x, y + 34 * s, 5)],
  excl: (x, y, s = 1) => [ln(x, y - 60 * s, x + 2, y + 10 * s), dot(x + 2, y + 34 * s, 5)],
  sparkle: (x, y, r = 22) => [ln(x, y - r, x, y + r), ln(x - r, y, x + r, y), ln(x - r * .55, y - r * .55, x + r * .55, y + r * .55)],
  motion: (x, y, n = 3, len = 50, gap = 22) => Array.from({ length: n }, (_, i) => ln(x, y + i * gap, x + len - i * 10, y + i * gap)),
  sweat: (x, y) => [`M ${x} ${y} Q ${x - 10} ${y + 18} ${x} ${y + 24} Q ${x + 10} ${y + 18} ${x} ${y}`],
  heart: (s = 1) => [`M 0 ${30 * s} C ${-60 * s} ${-5 * s} ${-45 * s} ${-55 * s} 0 ${-25 * s} C ${45 * s} ${-55 * s} ${60 * s} ${-5 * s} 0 ${30 * s}`],
  heartD: (s = 1) => `M 0 ${30 * s} C ${-60 * s} ${-5 * s} ${-45 * s} ${-55 * s} 0 ${-25 * s} C ${45 * s} ${-55 * s} ${60 * s} ${-5 * s} 0 ${30 * s} Z`,
  brokenHeart: (s = 1) => [...A.heart(s), `M 0 ${-25 * s} L ${-8 * s} ${-8 * s} L ${8 * s} ${4 * s} L ${-4 * s} ${30 * s}`],
  star(r = 30, cx = 0, cy = 0) { const p = []; for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; p.push([f1(cx + Math.cos(a) * rr), f1(cy + Math.sin(a) * rr)]); } return [poly(p)]; },
  starD(r = 30) { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; p.push([f1(Math.cos(a) * rr), f1(Math.sin(a) * rr)]); } return poly(p, true); },
  sun: (r = 60) => [circ(0, 0, r), ...Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return ln(f1(Math.cos(a) * (r + 16)), f1(Math.sin(a) * (r + 16)), f1(Math.cos(a) * (r + 42)), f1(Math.sin(a) * (r + 42))); })],
  moon: (r = 60) => [`M ${f1(r * .3)} ${-r} A ${r} ${r} 0 1 0 ${f1(r * .3)} ${r} A ${r * .75} ${r * .75} 0 1 1 ${f1(r * .3)} ${-r}`],
  moonD: (r = 60) => `M ${f1(r * .3)} ${-r} A ${r} ${r} 0 1 0 ${f1(r * .3)} ${r} A ${r * .75} ${r * .75} 0 1 1 ${f1(r * .3)} ${-r} Z`,

  /* --- containers --- */
  bubble(w, h, tail = 'bl') { // speech bubble, origin = center
    const x = -w / 2, y = -h / 2, r = Math.min(40, h / 3);
    const tx = tail === 'br' ? w * .22 : -w * .22, dir = tail === 'br' ? 1 : -1;
    return [`M ${tx + dir * 10} ${h / 2} L ${tx - dir * 18} ${h / 2 + 48} L ${tx - dir * 30} ${h / 2}`.replace(/^/, ''), `M ${tx - dir * 30} ${h / 2} L ${x + r} ${h / 2} Q ${x} ${h / 2} ${x} ${h / 2 - r} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} L ${-x - r} ${y} Q ${-x} ${y} ${-x} ${y + r} L ${-x} ${h / 2 - r} Q ${-x} ${h / 2} ${-x - r} ${h / 2} L ${tx + dir * 10} ${h / 2}`];
  },
  bubbleD(w, h) { const x = -w / 2, y = -h / 2, r = Math.min(40, h / 3); return `M ${x + r} ${y} L ${-x - r} ${y} Q ${-x} ${y} ${-x} ${y + r} L ${-x} ${-y - r} Q ${-x} ${-y} ${-x - r} ${-y} L ${x + r} ${-y} Q ${x} ${-y} ${x} ${-y - r} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} Z`; },
  thought(w, h, tx = -1) { // cloud, origin center; tail circles go down-left (tx=-1) or down-right (1)
    const n = Math.max(6, Math.round((w + h) / 70)); let d = '';
    for (let i = 0; i < n; i++) {
      const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
      const p0 = [Math.cos(a0) * w / 2, Math.sin(a0) * h / 2], p1 = [Math.cos(a1) * w / 2, Math.sin(a1) * h / 2];
      const am = (a0 + a1) / 2, c = [Math.cos(am) * w / 2 * 1.22, Math.sin(am) * h / 2 * 1.3];
      d += (i ? ' ' : `M ${f1(p0[0])} ${f1(p0[1])} `) + `Q ${f1(c[0])} ${f1(c[1])} ${f1(p1[0])} ${f1(p1[1])}`;
    }
    return [d, circ(tx * w * .32, h / 2 + 40, 16), circ(tx * w * .42, h / 2 + 80, 9)];
  },
  thoughtD(w, h) { return `M ${-w / 2} 0 A ${w / 2} ${h / 2} 0 1 0 ${w / 2} 0 A ${w / 2} ${h / 2} 0 1 0 ${-w / 2} 0 Z`; },
  scroll(w, h) { // origin center
    const x = -w / 2, y = -h / 2;
    return [`M ${x + 30} ${y} L ${-x - 10} ${y}`, `M ${x + 30} ${-y} L ${-x - 10} ${-y}`, `M ${x + 30} ${y} Q ${x} ${y} ${x} ${y + 30} L ${x} ${-y - 30} Q ${x} ${-y} ${x + 30} ${-y} Q ${x + 52} ${-y} ${x + 52} ${-y - 26} Q ${x + 52} ${-y - 46} ${x + 30} ${-y - 40}`,
      `M ${-x - 10} ${y} Q ${-x + 22} ${y} ${-x + 22} ${y + 30} L ${-x + 22} ${-y - 30} Q ${-x + 22} ${-y} ${-x - 10} ${-y} Q ${-x - 32} ${-y} ${-x - 32} ${-y - 24}  L ${-x - 32} ${y + 24} Q ${-x - 32} ${y} ${-x - 10} ${y}`];
  },
  card: (w, h) => [rrect(-w / 2, -h / 2, w, h, 18)],

  /* --- objects --- */
  eye: (s = 1) => [`M ${-70 * s} 0 Q 0 ${-62 * s} ${70 * s} 0 Q 0 ${62 * s} ${-70 * s} 0`, circ(0, 0, 24 * s), dot(0, 0, 9 * s)],
  shield: () => [`M 0 -80 Q 40 -60 70 -66 Q 74 30 0 86 Q -74 30 -70 -66 Q -40 -60 0 -80`, `M -26 0 L -6 22 L 30 -22`],
  bulb: () => [`M -30 40 Q -62 10 -58 -24 Q -52 -78 0 -80 Q 52 -78 58 -24 Q 62 10 30 40 L 28 64 L -28 64 L -30 40`, ln(-26, 78, 26, 78), ln(-20, 92, 20, 92), `M -14 30 L -8 -10 L 0 6 L 8 -10 L 14 30`, ...[[-100, -40, -78, -32], [100, -40, 78, -32], [0, -130, 0, -104], [-74, -104, -58, -84], [74, -104, 58, -84]].map(a => ln(...a))],
  bulbD: () => `M -30 40 Q -62 10 -58 -24 Q -52 -78 0 -80 Q 52 -78 58 -24 Q 62 10 30 40 L 28 64 L -28 64 Z`,
  megaphone: () => [`M -60 -18 L 50 -70 L 50 70 L -60 18 Z`, rrect(-84, -22, 26, 44, 6), `M 10 30 L 18 74 L -8 76 L -20 36`, ...[[78, -50, 112, -70], [80, 0, 122, 0], [78, 50, 112, 70]].map(a => ln(...a))],
  paper: (w = 150, h = 190) => [`M ${-w / 2} ${-h / 2} L ${w / 2 - 34} ${-h / 2} L ${w / 2} ${-h / 2 + 34} L ${w / 2} ${h / 2} L ${-w / 2} ${h / 2} Z`, `M ${w / 2 - 34} ${-h / 2} L ${w / 2 - 34} ${-h / 2 + 34} L ${w / 2} ${-h / 2 + 34}`, ...[0, 1, 2, 3].map(i => ln(-w / 2 + 22, -h / 2 + 60 + i * 30, w / 2 - 22 - (i % 2) * 30, -h / 2 + 60 + i * 30))],
  paperD: (w = 150, h = 190) => `M ${-w / 2} ${-h / 2} L ${w / 2 - 34} ${-h / 2} L ${w / 2} ${-h / 2 + 34} L ${w / 2} ${h / 2} L ${-w / 2} ${h / 2} Z`,
  hourglass: () => [ln(-60, -100, 60, -100), ln(-60, 100, 60, 100), `M -48 -100 Q -48 -30 -6 0 Q -48 30 -48 100`, `M 48 -100 Q 48 -30 6 0 Q 48 30 48 100`, `M -30 -50 Q 0 -40 30 -50 Q 10 -20 0 -4`, `M -32 92 Q 0 50 32 92`, ln(0, 4, 0, 60)],
  calendar: () => [rrect(-80, -70, 160, 150, 10), ln(-80, -30, 80, -30), ln(-40, -88, -40, -56), ln(40, -88, 40, -56), ...[-50, -10, 30].flatMap(x => [0, 40].map(y => rrect(x, y - 8, 24, 20, 4)))],
  iceberg: () => [`M -420 0 L -150 0 L -90 -120 L -40 -90 L 10 -190 L 70 -80 L 110 -110 L 170 0 L 420 0`, `M -150 0 Q -260 80 -230 200 Q -200 320 -60 360 Q 60 390 160 320 Q 270 230 240 110 Q 220 40 170 0`, ...[[-380, 30, -300, 30], [260, 40, 360, 40], [-340, 70, -280, 70], [300, 80, 380, 80]].map(a => ln(...a))],
  icebergWaterD: () => `M -150 0 Q -260 80 -230 200 Q -200 320 -60 360 Q 60 390 160 320 Q 270 230 240 110 Q 220 40 170 0 Z`,
  scale: () => [ln(0, -160, 0, 150), `M -70 150 L 70 150`, ln(-210, -120, 210, -120), circ(0, -170, 12), ln(-210, -120, -270, 10), ln(-210, -120, -150, 10), `M -290 10 Q -210 70 -130 10 Z`, ln(210, -120, 150, 10), ln(210, -120, 270, 10), `M 130 10 Q 210 70 290 10 Z`],
  brick: (x, y, w = 110, h = 50) => rrect(x, y, w, h, 6),
  mountain: () => [`M -520 260 L -180 -200 L -60 -60 L 60 -260 L 520 260`, `M 60 -260 L 60 -380 L 150 -350 L 60 -320`, `M -40 230 Q 60 150 -10 80 Q -70 20 30 -60 Q 90 -120 50 -200`],
  mountainD: () => `M -520 260 L -180 -200 L -60 -60 L 60 -260 L 520 260 Z`,
  stairs: (n = 4, w = 170, h = 110) => { const p = [[0, 0]]; for (let i = 0; i < n; i++) { p.push([i * w, -(i + 1) * h]); p.push([(i + 1) * w, -(i + 1) * h]); } p.push([n * w, 0]); return [poly(p, true)]; },
  trophy: () => [`M -60 -90 L 60 -90 Q 64 10 0 34 Q -64 10 -60 -90`, `M -60 -70 Q -110 -66 -96 -20 Q -86 6 -48 4`, `M 60 -70 Q 110 -66 96 -20 Q 86 6 48 4`, ln(0, 34, 0, 64), rrect(-44, 64, 88, 30, 6), ...A.star(18, 0, -42)],
  trophyD: () => `M -60 -90 L 60 -90 Q 64 10 0 34 Q -64 10 -60 -90 Z`,
  crown: () => [`M -90 40 L -100 -50 L -50 -6 L 0 -70 L 50 -6 L 100 -50 L 90 40 Z`, ln(-90, 60, 90, 60), dot(0, -86, 8), dot(-100, -64, 7), dot(100, -64, 7)],
  crownD: () => `M -90 40 L -100 -50 L -50 -6 L 0 -70 L 50 -6 L 100 -50 L 90 40 Z`,
  well: () => [`M -150 0 Q 0 40 150 0 L 150 160 Q 0 200 -150 160 Z`, `M -150 0 Q 0 -40 150 0`, ...[50, 105].map(y => `M -150 ${y} Q 0 ${y + 40} 150 ${y}`), ...[-90, -20, 50, 110].map((x, i) => ln(x, 20 + (i % 2) * 55, x, 55 + (i % 2) * 55)), ln(-170, 0, -170, -260), ln(170, 0, 170, -260), `M -200 -250 L 0 -330 L 200 -250`, ln(-170, -200, 170, -200), ln(20, -200, 20, -40), rrect(-8, -40, 56, 46, 6)],
  wellD: () => `M -150 0 Q 0 40 150 0 L 150 160 Q 0 200 -150 160 Z`,
  bars: () => [rrect(-130, -130, 260, 260, 10), ...[-78, -26, 26, 78].map(x => ln(x, -130, x, 130)), ln(-130, 0, 130, 0)],
  chain: () => [loop(-60, 0, 34, 20, 0, Math.PI * 2.1), loop(0, 0, 34, 20, 0, Math.PI * 2.1), loop(60, 0, 34, 20, 0, Math.PI * 2.1)],
  book: () => [`M 0 -110 Q -90 -140 -200 -110 L -200 110 Q -90 80 0 110 Q 90 80 200 110 L 200 -110 Q 90 -140 0 -110`, ln(0, -110, 0, 110), ...[-60, -20, 20].map(y => `M -170 ${y} Q -90 ${y - 18} -30 ${y}`), ...[-60, -20, 20].map(y => `M 30 ${y} Q 90 ${y - 18} 170 ${y}`)],
  bookD: () => `M 0 -110 Q -90 -140 -200 -110 L -200 110 Q -90 80 0 110 Q 90 80 200 110 L 200 -110 Q 90 -140 0 -110 Z`,
  honey: () => [`M -70 -60 Q -100 -20 -96 40 Q -90 110 0 112 Q 90 110 96 40 Q 100 -20 70 -60 Z`, rrect(-80, -96, 160, 36, 10), `M -60 -60 Q -40 -20 -10 -50 Q 10 -10 40 -52`, ln(110, -150, 60, -40), loop(118, -170, 22, 26, 0, Math.PI * 2.2)],
  honeyD: () => `M -70 -60 Q -100 -20 -96 40 Q -90 110 0 112 Q 90 110 96 40 Q 100 -20 70 -60 Z`,
  door: (open) => open ? [rrect(-90, -180, 180, 360, 6), `M -90 -180 L -10 -150 L -10 200 L -90 180`, dot(-26, 20, 6), ...[[110, -130, 170, -170], [120, -40, 190, -50], [110, 60, 180, 90]].map(a => ln(...a))] : [rrect(-90, -180, 180, 360, 6), rrect(-60, -150, 120, 120, 8), rrect(-60, 0, 120, 140, 8), dot(60, 10, 6)],
  lock: () => [rrect(-50, -10, 100, 80, 10), `M -32 -10 L -32 -40 Q -32 -76 0 -76 Q 32 -76 32 -40 L 32 -10`, dot(0, 22, 7), ln(0, 26, 0, 46)],
  lockD: () => `M -40 -10 L 40 -10 Q 50 -10 50 0 L 50 60 Q 50 70 40 70 L -40 70 Q -50 70 -50 60 L -50 0 Q -50 -10 -40 -10 Z`,
  seedSoil: (w = 500) => [`M ${-w / 2} 0 Q ${-w / 4} -14 0 -4 Q ${w / 4} 8 ${w / 2} -6`, ...[[-160, 40], [-60, 70], [80, 40], [170, 80], [-200, 100], [10, 110]].map(([x, y]) => dot(x, y, 3))],
  seed: () => [loop(0, 60, 22, 14, 0, Math.PI * 2.1)],
  sprout: (h = 120) => [`M 0 60 Q -6 ${60 - h / 2} 0 ${60 - h}`, `M 0 ${60 - h * .6} Q -60 ${60 - h * .9} -70 ${60 - h * .6} Q -40 ${60 - h * .45} 0 ${60 - h * .6}`, `M 0 ${60 - h * .85} Q 60 ${60 - h * 1.15} 74 ${60 - h * .85} Q 40 ${60 - h * .7} 0 ${60 - h * .85}`],
  roots: () => [`M 0 60 Q -20 100 -50 120`, `M 0 60 Q 6 110 -6 150`, `M 0 60 Q 30 96 60 110`],
  gear: (r = 60) => { const p = []; for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2; const rr = (i % 4 < 2) ? r : r * .8; p.push([f1(Math.cos(a) * rr), f1(Math.sin(a) * rr)]); } return [poly(p, true), circ(0, 0, r * .32)]; },
  clock: (r = 80) => [circ(0, 0, r), ln(0, 0, 0, -r * .6), ln(0, 0, r * .45, r * .1), ...Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return ln(f1(Math.cos(a) * r * .82), f1(Math.sin(a) * r * .82), f1(Math.cos(a) * r * .92), f1(Math.sin(a) * r * .92)); })],
  cup: () => [`M -60 -60 L 60 -60 L 46 80 L -46 80 Z`, ...[-20, 10, 40].map(y => ln(-50, y, -30, y))],
  globe: (r = 110) => [circ(0, 0, r), `M 0 ${-r} Q ${-r * .6} 0 0 ${r}`, `M 0 ${-r} Q ${r * .6} 0 0 ${r}`, ln(-r, 0, r, 0), `M ${-r * .9} ${-r * .45} Q 0 ${-r * .3} ${r * .9} ${-r * .45}`, `M ${-r * .9} ${r * .45} Q 0 ${r * .3} ${r * .9} ${r * .45}`],
  mask: () => [`M -70 -60 Q 0 -90 70 -60 Q 80 30 0 90 Q -80 30 -70 -60`, `M -40 -16 Q -26 -30 -12 -16`, `M 12 -16 Q 26 -30 40 -16`, `M -30 30 Q 0 56 30 30`, ln(70, -10, 120, 30)],
  magnifier: () => [circ(0, 0, 70), circ(0, 0, 54, .1), `M 50 50 L 130 130`, `M 64 44 L 144 124 L 124 144 L 44 64`],
  lantern: () => [`M -40 -70 L 40 -70 L 54 70 L -54 70 Z`, ln(-60, 70, 60, 70), `M -30 -70 Q 0 -120 30 -70`, ln(0, -110, 0, -96), loop(0, 10, 14, 26, 0, Math.PI * 2.1), ...[[-110, 0, -80, 0], [110, 0, 80, 0], [-90, -70, -66, -54], [90, -70, 66, -54], [-90, 70, -66, 56], [90, 70, 66, 56]].map(a => ln(...a))],
  lanternD: () => `M -40 -70 L 40 -70 L 54 70 L -54 70 Z`,
  box: () => [`M -80 -40 L 80 -40 L 80 70 L -80 70 Z`, `M -80 -40 L -50 -80 L 110 -80 L 80 -40`, `M 80 70 L 110 30 L 110 -80`],
  cart: () => [`M -120 -50 L 120 -50 L 100 40 L -100 40 Z`, circ(-60, 66, 22), circ(60, 66, 22), `M 120 -50 L 150 -100 L 190 -100`],
  battery: () => [rrect(-90, -45, 170, 90, 12), rrect(80, -18, 20, 36, 4)],
  phoneBubbles: () => [rrect(-55, -100, 110, 200, 16), ln(-20, 80, 20, 80)],
  coins: () => [loop(0, 0, 50, 16, 0, Math.PI * 2.1), `M -50 0 L -50 30 Q 0 52 50 30 L 50 0`],
  hands: () => { // two open palms raised in supplication (no face)
    const one = sx => [
      `M ${sx * 34} 170 Q ${sx * 30} 90 ${sx * 22} 40 Q ${sx * 14} -40 ${sx * 20} -96 Q ${sx * 24} -122 ${sx * 44} -122 Q ${sx * 60} -126 ${sx * 70} -112 Q ${sx * 86} -126 ${sx * 102} -110 Q ${sx * 120} -112 ${sx * 126} -92 Q ${sx * 146} -92 ${sx * 146} -66 Q ${sx * 146} -10 ${sx * 132} 40 Q ${sx * 122} 100 ${sx * 112} 170`,
      `M ${sx * 46} -120 Q ${sx * 50} -80 ${sx * 50} -50`, `M ${sx * 72} -112 Q ${sx * 76} -76 ${sx * 76} -46`, `M ${sx * 102} -108 Q ${sx * 104} -74 ${sx * 102} -44`,
      `M ${sx * 22} 40 Q ${sx * 0} 6 ${sx * 4} -24 Q ${sx * 8} -40 ${sx * 20} -30`, `M ${sx * 40} 60 Q ${sx * 80} 86 ${sx * 120} 56`];
    return [...one(-1), ...one(1)];
  },
  house: () => [`M -120 0 L -120 160 L 120 160 L 120 0`, `M -150 10 L 0 -110 L 150 10`, rrect(-30, 70, 60, 90, 4), rrect(50, 40, 44, 44, 4), rrect(-94, 40, 44, 44, 4)],
  wallRows: (rows = 4) => { const out = []; for (let r = 0; r < rows; r++) for (let c = 0; c < 4; c++) out.push(rrect(-230 + c * 116 + (r % 2) * 56 - 28, -r * 56, 110, 50, 6)); return out; },
  castle: () => [`M -120 60 L -120 -60 L -90 -60 L -90 -40 L -60 -40 L -60 -60 L -30 -60 L -30 -40 L 0 -40 L 0 -60 L 30 -60 L 30 -40 L 60 -40 L 60 -60 L 90 -60 L 90 -40 L 120 -40 L 120 60`, rrect(-24, 0, 48, 60, 20), ln(-30, -60, -30, -130), `M -30 -130 L 20 -114 L -30 -100`],
  signpost: () => [ln(0, 160, 0, -140), `M 0 -120 L 140 -120 L 170 -96 L 140 -72 L 0 -72`, `M 0 -40 L -140 -40 L -170 -16 L -140 8 L 0 8`],
  crowd(n = 5, sp = 90) { // small heads + shoulders row, origin center bottom
    const out = []; for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * sp, y = (i % 2) * 18; out.push(circ(x, y - 90, 30)); out.push(`M ${x - 46} ${y} Q ${x - 44} ${y - 54} ${x} ${y - 56} Q ${x + 44} ${y - 54} ${x + 46} ${y}`); } return out;
  },
  crowdEyes(n = 5, sp = 90, look = 0) { const out = []; for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * sp, y = (i % 2) * 18; out.push(dot(x - 10 + look, y - 94, 3.5), dot(x + 10 + look, y - 94, 3.5)); } return out; },
  ear: () => [`M 20 -60 Q -40 -64 -40 0 Q -40 40 -10 54 Q 10 64 10 40 Q 10 20 24 10 Q 44 -6 40 -34 Q 36 -58 20 -60`, `M 14 -30 Q -14 -34 -12 0`],
  lips: () => [`M -60 0 Q -30 -30 0 -14 Q 30 -30 60 0 Q 30 34 0 30 Q -30 34 -60 0`, ln(-60, 0, 60, 0), ln(0, -60, 0, 60)],
  zip: () => [`M -70 0 Q 0 -30 70 0 Q 0 30 -70 0`, ...[-50, -30, -10, 10, 30, 50].map(x => ln(x, -8, x, 8)), rrect(70, -12, 30, 24, 6)],
  footprints: () => [loop(-20, 0, 12, 20), loop(20, -50, 12, 20), loop(-20, -100, 12, 20)],
  flagGoal: () => [ln(0, 0, 0, -200), `M 0 -200 L 110 -170 L 0 -140`],
  ladderChart: () => [ln(-200, 120, 220, 120), ln(-200, 120, -200, -160), `M -180 80 L -100 40 L -40 60 L 40 -20 L 100 0 L 190 -120`, `M 160 -120 L 190 -120 L 186 -92`],
  rope: (n = 4) => Array.from({ length: n }, (_, i) => `M 0 0 Q ${60 + i * 20} ${-40 + i * 30} ${150 + i * 30} ${-120 + i * 80}`),
  cloudDark: () => [`M -100 20 Q -130 -30 -80 -40 Q -70 -90 -10 -80 Q 30 -120 70 -70 Q 130 -70 120 -10 Q 140 30 90 40 L -80 40 Q -110 40 -100 20`, ...[-60, -10, 40, 90].map(x => ln(x, 60, x - 16, 100))],
  cloudDarkD: () => `M -100 20 Q -130 -30 -80 -40 Q -70 -90 -10 -80 Q 30 -120 70 -70 Q 130 -70 120 -10 Q 140 30 90 40 L -80 40 Q -110 40 -100 20 Z`,
  vine: () => [`M 0 0 Q 40 -40 20 -80 Q 0 -120 50 -150 Q 90 -170 70 -210`, ...[[20, -40], [26, -96], [60, -160]].map(([x, y]) => `M ${x} ${y} L ${x + 22} ${y - 10} M ${x} ${y} L ${x - 20} ${y - 12}`)],
  zigzag: (w = 120) => [`M ${-w / 2} 0 L ${-w / 4} -20 L 0 0 L ${w / 4} -20 L ${w / 2} 0`],
};

/* ===== Person (front view doodle). origin = between the feet. height ≈ 330 ===== */
const P_REG = {};
const ARM = { u: 74, f: 68 };
/* poses = hand target for the RIGHT arm (relative to body origin); left arm mirrors */
const POSES = {
  down: [62, -98], wave: [118, -372], point: [186, -238], hips: [66, -150], up: [74, -378], chin: [14, -258], dua: [36, -262],
  hold: [24, -168], out: [160, -176], cross: [-34, -190], head: [44, -350], shrug: [120, -248],
};
function armPath(side, pose) { // side: -1 left (viewer), +1 right
  const tg = POSES[pose] || pose; const sx = side * 46, sy = -236;
  let tx = side * tg[0], ty = tg[1];
  let dx = tx - sx, dy = ty - sy, d = Math.hypot(dx, dy);
  const L = ARM.u + ARM.f - 1; if (d > L) { tx = sx + dx / d * L; ty = sy + dy / d * L; dx = tx - sx; dy = ty - sy; d = L; }
  d = Math.max(d, 20);
  const a = Math.atan2(dy, dx), th = Math.acos(clamp((ARM.u * ARM.u + d * d - ARM.f * ARM.f) / (2 * ARM.u * d), -1, 1));
  const c1 = [sx + Math.cos(a + th) * ARM.u, sy + Math.sin(a + th) * ARM.u], c2 = [sx + Math.cos(a - th) * ARM.u, sy + Math.sin(a - th) * ARM.u];
  const [ex, ey] = (side * c1[0] + c1[1] * .15 > side * c2[0] + c2[1] * .15) ? c1 : c2;
  return [`M ${sx} ${sy} Q ${f1((sx + ex) / 2 + side * 3)} ${f1((sy + ey) / 2)} ${f1(ex)} ${f1(ey)} L ${f1(tx)} ${f1(ty)}`, circ(f1(tx), f1(ty), 11)];
}
const FACES = {
  happy: ['M -18 -284 Q 0 -266 18 -284', 'M -26 -322 Q -16 -328 -6 -322', 'M 6 -322 Q 16 -328 26 -322'],
  smile: ['M -14 -282 Q 0 -272 14 -282', 'M -26 -322 Q -16 -326 -6 -322', 'M 6 -322 Q 16 -326 26 -322'],
  sad: ['M -16 -272 Q 0 -288 16 -272', 'M -26 -318 L -6 -326', 'M 26 -318 L 6 -326'],
  angry: ['M -14 -274 Q 0 -282 14 -274', 'M -28 -328 L -6 -316', 'M 28 -328 L 6 -316'],
  calm: ['M -12 -280 Q 0 -272 12 -280', 'M -24 -322 Q -16 -324 -8 -322', 'M 8 -322 Q 16 -324 24 -322'],
  surprised: [circ(0, -276, 9), 'M -26 -330 Q -16 -338 -6 -330', 'M 6 -330 Q 16 -338 26 -330'],
  worried: ['M -16 -276 Q -8 -282 0 -276 Q 8 -270 16 -276', 'M -26 -320 L -8 -328', 'M 26 -320 L 8 -328'],
  envy: ['M -14 -278 Q 4 -276 16 -284', 'M -28 -322 L -6 -318', 'M 28 -322 L 6 -318'],
  think: ['M -6 -278 L 14 -280', 'M -26 -326 Q -16 -332 -6 -326', 'M 6 -322 L 26 -322'],
};
const EYES = {
  normal: [dot(-16, -302, 4.5), dot(16, -302, 4.5)],
  closed: ['M -24 -302 Q -16 -296 -8 -302', 'M 8 -302 Q 16 -296 24 -302'],
  side: [dot(-10, -302, 4.5), dot(22, -302, 4.5)],
  up: [dot(-14, -308, 4.5), dot(18, -308, 4.5)],
  wide: [circ(-16, -302, 8, .1), circ(16, -302, 8, .1), dot(-16, -302, 3), dot(16, -302, 3)],
};
function faceStrokes(expr, eyes) {
  const e = eyes || (expr === 'calm' ? 'closed' : expr === 'envy' ? 'side' : expr === 'think' ? 'up' : expr === 'surprised' ? 'wide' : 'normal');
  return [...EYES[e], ...FACES[expr]].map(d => ({ d, w: 4 }));
}
/* person(id, x, y, s, opts, t, dur) – opts: {expr, eyes, armL, armR, hair:'m'|'h'|'k', shirt:color, legs:'stand'|'walk'|'sit', fx} */
function person(id, x, y, s, o, t, dur) {
  o = o || {};
  const tf = { x, y, s, fx: o.fx };
  const fem = o.hair === 'h';
  const k = dur / 5;
  const parts = [];
  // body fill
  const bodyD = fem ? 'M -12 -252 Q -58 -246 -60 -196 L -80 -24 L 80 -24 L 60 -196 Q 58 -246 12 -252 Z' : 'M -12 -252 Q -58 -246 -58 -196 L -48 -118 L 48 -118 L 58 -196 Q 58 -246 12 -252 Z';
  const shirt = o.shirt === undefined ? (fem ? BEIGE : GREEN_L) : o.shirt;
  // head
  const head = [{ d: circ(0, -300, 48) }];
  if (o.hair === 'm' || !o.hair) head.push({ d: 'M -46 -312 Q -40 -356 0 -350 Q 30 -352 46 -320 Q 30 -336 10 -334 Q -14 -344 -30 -326 Q -40 -320 -46 -312', w: 4 });
  if (o.hair === 'k') head.push({ d: 'M -44 -318 Q -40 -356 0 -354 Q 40 -356 44 -318 Z', w: 4 }, { d: 'M -40 -276 Q -30 -236 0 -238 Q 30 -236 40 -276', w: 4 });
  if (fem) head.unshift({ d: 'M 0 -362 Q -64 -360 -66 -296 Q -66 -250 -64 -236 Q -40 -250 -38 -250 M 0 -362 Q 64 -360 66 -296 Q 66 -250 64 -236 Q 40 -250 38 -250', w: 5 });
  if (fem) head.push({ d: 'M -54 -324 Q -40 -354 0 -354 Q 40 -354 54 -324', w: 4 });
  const hd = ink(head, t, k * 1.1, { tf, g: id + ' ' + id + '.hd' });
  parts.push(hd);
  const fc = ink(faceStrokes(o.expr || 'smile', o.eyes), t + k * 1.1, k * .9, { tf, g: id + ' ' + id + '.hd ' + id + '.face' });
  if (shirt) parts.push(fill(bodyD, t + k * 2.7, k * .8, shirt, { tf, g: id, alpha: .9 }));
  const bd = ink([bodyD.replace(' Z', '')], t + k * 2, k * .7, { tf, g: id }); parts.push(bd);
  const aL = ink(armPath(-1, o.armL || 'down'), t + k * 3.5, k * .45, { tf, g: id + ' ' + id + '.aL' });
  const aR = ink(armPath(1, o.armR || 'down'), t + k * 3.95, k * .45, { tf, g: id + ' ' + id + '.aR' });
  let legs;
  if (o.legs === 'walk') legs = ['M -18 -118 L -44 -14 Q -64 -10 -66 0 L -36 0', 'M 18 -118 L 40 -14 Q 60 -10 62 0 L 34 0'];
  else if (o.legs === 'sit') legs = ['M -24 -118 L -24 -80 L -70 -78 L -70 -10 L -96 -6', 'M 24 -118 L 24 -80 L 70 -78 L 70 -10 L 96 -6'];
  else legs = fem ? ['M -24 -24 L -26 -6 Q -48 -4 -50 4 L -20 4', 'M 24 -24 L 26 -6 Q 48 -4 50 4 L 20 4'] : ['M -20 -118 L -24 -12 Q -46 -8 -48 2 L -20 2', 'M 20 -118 L 24 -12 Q 46 -8 48 2 L 20 2'];
  ink(legs, t + k * 4.4, k * .58, { tf, g: id });
  P_REG[id] = { tf, face: fc, s, x, y, fx: o.fx, armL: aL, armR: aR };
  return { tf, face: fc, aL, aR };
}
/* change expression: rub out the face with the eraser, then redraw */
function setFace(id, expr, t, eyes) {
  const P = P_REG[id];
  const prev = P.face;
  const cx = P.x, cy = P.y - 290 * P.s;
  erase([cx - 40 * P.s, cy - 45 * P.s, 80 * P.s, 80 * P.s], t, .45);
  prev.hideAt = t + .45;
  P.face = ink(faceStrokes(expr, eyes), t + .5, .6, { tf: P.tf, g: id + ' ' + id + '.hd ' + id + '.face' });
}
/* swap an arm pose (arm is re-drawn instantly with motion) */
function setArm(id, side, pose, t, from) {
  const P = P_REG[id];
  const old = P['arm' + side];
  if (old) old.hideAt = t;
  P['arm' + side] = ink(armPath(side === 'L' ? -1 : 1, pose), t, .35, { tf: P.tf, g: id + ' ' + id + '.a' + side });
}
/* convenience: animate */
const wave = (id, side, t, dur) => anim(id + '.a' + side, t, dur, { r: side === 'R' ? .35 : -.35, pv: [(side === 'R' ? 46 : -46) * P_REG[id].s + P_REG[id].x, -236 * P_REG[id].s + P_REG[id].y], loop: 1, hz: 1.6 });
const nod = (id, t, dur, hz = 1.2) => anim(id + '.hd', t, dur, { dy: 5 * P_REG[id].s, loop: 1, hz });
const bob = (id, t, dur, amp = 8, hz = 1) => anim(id, t, dur, { dy: -amp, loop: 1, hz });
const move = (id, t, dur, dx, dy = 0) => anim(id, t, dur, { dx, dy });
