/* ===== Hand sprite v2: soft-shaded right hand, tripod grip on a white marker (or a felt eraser) ===== */
function makeHand(eraser) {
  const A = 0.62, CW = 1750, CH = 1400, OX = 80, OY = 80;
  const c = document.createElement('canvas'); c.width = CW; c.height = CH;
  const x = c.getContext('2d');
  const frame = ctx => { ctx.translate(OX, OY); ctx.rotate(A); };

  function shapes(ctx, flat) {
    const P = f => { ctx.beginPath(); f(); ctx.closePath(); };
    const OUT = 'rgba(120,66,42,.75)';
    const skin = (f, gx0, gy0, gx1, gy1, tone = 0) => {
      P(f);
      if (flat) { ctx.fillStyle = '#000'; ctx.fill(); return; }
      const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
      const T = [['#f8d9c2', '#eebf9e', '#d39a76'], ['#f1caa9', '#e3ab86', '#c4855f']][tone];
      g.addColorStop(0, T[0]); g.addColorStop(.5, T[1]); g.addColorStop(1, T[2]);
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.stroke();
    };
    const line = (d, a = .55, w = 2) => { if (flat) return; ctx.strokeStyle = `rgba(120,66,42,${a})`; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); d(); ctx.stroke(); };
    const nail = (cx, cy, rx, ry, r) => { if (flat) return; ctx.save(); ctx.translate(cx, cy); ctx.rotate(r); ctx.fillStyle = '#f9e1d4'; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(150,90,70,.55)'; ctx.lineWidth = 1.4; ctx.stroke(); ctx.restore(); };
    const barrel = (x0, x1) => {
      P(() => { ctx.moveTo(x0, -17); ctx.lineTo(x1, -18); if (x1 > 400) ctx.quadraticCurveTo(x1 + 18, 0, x1, 18); else ctx.lineTo(x1, 18); ctx.lineTo(x0, 17); });
      if (flat) { ctx.fillStyle = '#000'; ctx.fill(); return; }
      const g = ctx.createLinearGradient(0, -18, 0, 18); g.addColorStop(0, '#ffffff'); g.addColorStop(.3, '#f7f7f4'); g.addColorStop(.75, '#d6d6d1'); g.addColorStop(1, '#aaaaa4'); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1.4; ctx.stroke();
    };

    // forearm
    skin(() => { ctx.moveTo(300, -62); ctx.bezierCurveTo(560, -74, 1100, -92, 1900, -106); ctx.lineTo(1900, 150); ctx.bezierCurveTo(1100, 136, 560, 118, 320, 92); }, 0, -90, 0, 150);
    // sleeve
    P(() => { ctx.moveTo(700, -84); ctx.bezierCurveTo(740, -20, 744, 80, 712, 124); ctx.lineTo(1900, 210); ctx.lineTo(1900, -150); });
    if (flat) { ctx.fillStyle = '#000'; ctx.fill(); } else {
      const g = ctx.createLinearGradient(0, -150, 0, 210); g.addColorStop(0, '#41735c'); g.addColorStop(.5, '#2e5a46'); g.addColorStop(1, '#1d3e30'); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(10,30,22,.6)'; ctx.lineWidth = 2.2; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(714, -72); ctx.bezierCurveTo(748, -10, 750, 70, 722, 114); ctx.stroke();
      ctx.strokeStyle = 'rgba(10,30,22,.45)'; ctx.lineWidth = 3;
      [[800, -92, 780, 100], [930, -100, 950, 50], [1080, -104, 1050, 150]].forEach(([a, b, c2, d]) => { ctx.beginPath(); ctx.moveTo(a, b); ctx.quadraticCurveTo((a + c2) / 2 + 24, (b + d) / 2, c2, d); ctx.stroke(); });
    }
    // marker: rear end sticks out above the fist
    if (!eraser) barrel(280, 420);
    // fist: back of hand with knuckles
    skin(() => {
      ctx.moveTo(330, -66);
      ctx.bezierCurveTo(300, -92, 262, -84, 248, -70); ctx.bezierCurveTo(232, -92, 194, -92, 180, -72);
      ctx.bezierCurveTo(160, -90, 124, -84, 116, -60); ctx.bezierCurveTo(96, -48, 92, -20, 100, 4);
      ctx.bezierCurveTo(96, 40, 108, 76, 140, 92); ctx.bezierCurveTo(200, 116, 290, 114, 340, 96);
      ctx.bezierCurveTo(380, 70, 382, -30, 330, -66);
    }, 200, -90, 220, 110);
    line(() => { ctx.moveTo(180, -70); ctx.quadraticCurveTo(186, -50, 200, -40); }, .45);
    line(() => { ctx.moveTo(248, -70); ctx.quadraticCurveTo(252, -50, 266, -42); }, .45);
    // curled fingers on the front face (stacked below the barrel)
    skin(() => { ctx.moveTo(206, 20); ctx.bezierCurveTo(180, 12, 120, 12, 102, 22); ctx.bezierCurveTo(88, 32, 92, 54, 110, 56); ctx.bezierCurveTo(140, 58, 186, 52, 210, 48); }, 140, 14, 150, 58, 1);
    skin(() => { ctx.moveTo(214, 52); ctx.bezierCurveTo(186, 48, 136, 52, 120, 62); ctx.bezierCurveTo(108, 72, 114, 90, 132, 92); ctx.bezierCurveTo(160, 94, 196, 86, 218, 82); }, 150, 50, 160, 94, 1);
    // marker front (enters the fist under the index finger)
    if (!eraser) {
      P(() => { ctx.moveTo(0, 0); ctx.lineTo(24, -7); ctx.lineTo(24, 7); }); ctx.fillStyle = flat ? '#000' : '#141414'; ctx.fill();
      P(() => { ctx.moveTo(22, -10); ctx.lineTo(48, -16); ctx.lineTo(48, 16); ctx.lineTo(22, 10); }); ctx.fillStyle = flat ? '#000' : '#3b3b3b'; ctx.fill();
      barrel(48, 150);
    } else {
      P(() => ctx.roundRect(-40, -64, 190, 128, 12)); ctx.fillStyle = flat ? '#000' : '#3a3a37'; ctx.fill();
      P(() => ctx.roundRect(-30, -56, 175, 28, 6)); ctx.fillStyle = flat ? '#000' : '#c9a777'; ctx.fill();
    }
    // index finger wrapped over the barrel
    skin(() => { ctx.moveTo(214, -40); ctx.bezierCurveTo(180, -48, 120, -40, 92, -30); ctx.bezierCurveTo(70, -22, 66, 4, 84, 14); ctx.bezierCurveTo(110, 24, 170, 22, 212, 18); }, 140, -46, 150, 22);
    nail(84, -4, 12, 14, .1);
    line(() => { ctx.moveTo(150, -40); ctx.quadraticCurveTo(142, -12, 150, 18); }, .4);
    // thumb along the top of the barrel
    skin(() => { ctx.moveTo(320, -40); ctx.bezierCurveTo(270, -60, 190, -58, 150, -50); ctx.bezierCurveTo(126, -46, 120, -26, 138, -20); ctx.bezierCurveTo(190, -14, 270, -10, 316, -6); }, 220, -60, 225, -6);
    nail(140, -36, 13, 9, -.05);
    line(() => { ctx.moveTo(206, -54); ctx.quadraticCurveTo(200, -36, 208, -14); }, .38);
  }

  x.save(); frame(x); shapes(x, false); x.restore();
  const s = document.createElement('canvas'); s.width = CW; s.height = CH; const sx = s.getContext('2d');
  const tmp = document.createElement('canvas'); tmp.width = CW; tmp.height = CH; const tx = tmp.getContext('2d');
  tx.save(); frame(tx); shapes(tx, true); tx.restore();
  sx.filter = 'blur(12px)'; sx.drawImage(tmp, 0, 0); sx.filter = 'none';
  const ax = eraser ? OX + Math.cos(A) * 65 : OX, ay = eraser ? OY + Math.sin(A) * 65 : OY;
  return { c, shadow: s, ax, ay };
}
