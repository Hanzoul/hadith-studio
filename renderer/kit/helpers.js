const TX = (s, x, y, t, d, o) => text(s, x, y, t, d, o);
const at = (x, y, s = 1, extra = {}) => ({ tf: { x, y, s }, ...extra });
const bubbleAt = (x, y, w, h, t, d, tail, o = {}) => ink(A.bubble(w, h, tail), t, d, { tf: { x, y, s: 1 }, ...o });
const MOSQUE = ['M -90 80 L -90 -10 L 90 -10 L 90 80 Z', 'M -70 -10 Q -70 -110 0 -120 Q 70 -110 70 -10', 'M 0 -120 L 0 -150', 'M 110 80 L 110 -130 L 140 -130 L 140 80', 'M 105 -130 L 125 -170 L 145 -130', 'M -20 80 L -20 30 Q 0 10 20 30 L 20 80'];
const LAUGH = [circ(-60, 0, 44), circ(60, 0, 44), 'M -82 10 Q -60 34 -38 10 Z', 'M 38 10 Q 60 34 82 10 Z', 'M -78 -14 Q -72 -20 -66 -14', 'M -54 -14 Q -48 -20 -42 -14', 'M 42 -14 Q 48 -20 54 -14', 'M 66 -14 Q 72 -20 78 -14'];
const footLine = (x1, x2, y) => Array.from({ length: Math.floor((x2 - x1) / 70) }, (_, i) => `M ${x1 + i * 70} ${y + (i % 2) * 14} L ${x1 + i * 70 + 26} ${y + (i % 2) * 14}`);
