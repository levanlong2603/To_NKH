/* ============================================================
   20/10 — Cây hoa anh đào
   Trình tự: bông hoa (bấm vào) → rơi xuống đồi cỏ → cây mọc
             → hoa, nụ và lá nở dọc theo cành → cây dời sang
             → lá thư hiện ra và tự gõ chữ, cánh hoa bay khắp màn hình.
   ============================================================ */
(() => {
  'use strict';

  /* ---------- Cấu hình ---------- */
  const YOUTUBE_ID = 'peVAwC504ek'; // nhạc nền (YouTube). Nếu không phát được sẽ dùng music/nhac.mp3
  // dáng cây: đổi số này (hoặc mở trang với ?cay=123) để có một cây khác
  const TREE_SEED = Number(new URLSearchParams(location.search).get('cay')) || 2010;

  /* ---------- Tiện ích ---------- */
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const randIdx = (n) => (Math.random() * n) | 0;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeInQuad = (t) => t * t;
  const easeOutBack = (t) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);

  // random có hạt giống → cây giữ nguyên dáng mỗi lần mở
  function mulberry32(a) {
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const srng = mulberry32(TREE_SEED);
  const R = (a, b) => a + srng() * (b - a);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const portraitQuery = window.matchMedia('(max-aspect-ratio: 11/10), (max-width: 599px)');

  /* ---------- DOM ---------- */
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  const fx = document.getElementById('fx');
  const fxCtx = fx.getContext('2d');
  const letter = document.getElementById('letter');
  const audio = document.getElementById('bgm');
  const musicBtn = document.getElementById('music-toggle');

  /* ---------- Màu ---------- */
  const TONES = [
    { edge: '#fff7fa', mid: '#ffd6e4', core: '#f58fb2' },
    { edge: '#ffe6ef', mid: '#ffbcd3', core: '#ec6d9b' },
    { edge: '#ffd5e4', mid: '#ffa3c2', core: '#de4f86' },
    { edge: '#ffffff', mid: '#fdeaf1', core: '#f4a3bf' },
    { edge: '#fff1f6', mid: '#ffc8dc', core: '#f07aa5' },
  ];
  const LEAF_TONES = [
    { base: '#3f8a45', tip: '#86cc72' }, // xanh lá
    { base: '#6ea83a', tip: '#c3e57c' }, // xanh non
    { base: '#7d3f31', tip: '#d08a66' }, // lá non màu đồng (đặc trưng của anh đào)
    { base: '#2f6e3d', tip: '#5fa865' }, // xanh đậm
  ];
  const BARK_DARK = '#3b2427';
  const BARK_MID = '#5a3639';
  const BARK_LIGHT = 'rgba(176, 124, 118, .45)';

  /* ============================================================
     Sprite (vẽ sẵn 1 lần cho mượt)
     ============================================================ */
  function sprite(S, draw, k) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    draw(cv.getContext('2d'), S);
    return { img: cv, k };
  }

  // cánh hoa anh đào có khía ở đầu, gốc tại (0,0), đầu hướng lên
  function petalPath(c, R) {
    c.beginPath();
    c.moveTo(0, 0);
    c.bezierCurveTo(-0.62 * R, -0.22 * R, -0.66 * R, -0.84 * R, -0.22 * R, -R);
    c.quadraticCurveTo(-0.07 * R, -0.95 * R, 0, -0.82 * R);
    c.quadraticCurveTo(0.07 * R, -0.95 * R, 0.22 * R, -R);
    c.bezierCurveTo(0.66 * R, -0.84 * R, 0.62 * R, -0.22 * R, 0, 0);
    c.closePath();
  }

  function makeFlower(tone, S) {
    const Rr = S * 0.45;
    return sprite(S, (c) => {
      c.translate(S / 2, S / 2);
      const grad = c.createRadialGradient(0, 0, 0, 0, 0, Rr);
      grad.addColorStop(0, tone.core);
      grad.addColorStop(0.42, tone.mid);
      grad.addColorStop(1, tone.edge);
      for (let i = 0; i < 5; i++) {
        c.save();
        c.rotate((i * TAU) / 5 + Math.random() * 0.12);
        petalPath(c, Rr * (0.92 + Math.random() * 0.08));
        c.fillStyle = grad;
        c.fill();
        c.lineWidth = S / 110;
        c.strokeStyle = 'rgba(214, 92, 140, .28)';
        c.stroke();
        c.beginPath();
        c.moveTo(0, -Rr * 0.18);
        c.quadraticCurveTo(Rr * 0.04, -Rr * 0.5, 0, -Rr * 0.74);
        c.strokeStyle = 'rgba(255, 255, 255, .6)';
        c.lineWidth = S / 90;
        c.stroke();
        c.restore();
      }
      const blush = c.createRadialGradient(0, 0, 0, 0, 0, Rr * 0.32);
      blush.addColorStop(0, 'rgba(210, 40, 100, .75)');
      blush.addColorStop(1, 'rgba(210, 40, 100, 0)');
      c.fillStyle = blush;
      c.beginPath();
      c.arc(0, 0, Rr * 0.32, 0, TAU);
      c.fill();
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU + Math.random() * 0.2;
        const L = Rr * (0.24 + Math.random() * 0.14);
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(Math.cos(a) * L, Math.sin(a) * L);
        c.strokeStyle = 'rgba(196, 44, 100, .6)';
        c.lineWidth = S / 170;
        c.stroke();
        c.beginPath();
        c.arc(Math.cos(a) * L, Math.sin(a) * L, S / 85, 0, TAU);
        c.fillStyle = i % 2 ? '#ffd57a' : '#ff8fb4';
        c.fill();
      }
    }, S / 2 / Rr);
  }

  function makePetal(tone) {
    const S = 64, Rr = 54;
    return sprite(S, (c) => {
      c.translate(S / 2, S / 2 + Rr / 2);
      const grad = c.createRadialGradient(0, 0, 0, 0, 0, Rr);
      grad.addColorStop(0, tone.core);
      grad.addColorStop(0.35, tone.mid);
      grad.addColorStop(1, tone.edge);
      petalPath(c, Rr);
      c.fillStyle = grad;
      c.fill();
      c.lineWidth = 1;
      c.strokeStyle = 'rgba(214, 92, 140, .3)';
      c.stroke();
    }, S / 2 / (Rr / 2));
  }

  // chiếc lá: gốc ở dưới, đầu nhọn hướng lên, có gân và răng cưa nhẹ
  function makeLeaf(tone) {
    const S = 72, L = 64, Wd = L * 0.4;
    return sprite(S, (c) => {
      c.translate(S / 2, S / 2 + L / 2);
      c.beginPath();
      c.moveTo(0, 0);
      const steps = 14;
      const side = (sgn) => {
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const w = Math.sin(Math.PI * Math.pow(t, 0.8)) * Wd * 0.5 * (1 - t * 0.15);
          const tooth = i % 2 ? 0.9 : 1.04; // răng cưa
          c.lineTo(sgn * w * tooth, -t * L);
        }
      };
      side(-1);
      c.lineTo(0, -L);
      for (let i = steps; i >= 1; i--) {
        const t = i / steps;
        const w = Math.sin(Math.PI * Math.pow(t, 0.8)) * Wd * 0.5 * (1 - t * 0.15);
        const tooth = i % 2 ? 0.9 : 1.04;
        c.lineTo(w * tooth, -t * L);
      }
      c.closePath();
      const g = c.createLinearGradient(-Wd / 2, 0, Wd / 2, -L);
      g.addColorStop(0, tone.base);
      g.addColorStop(1, tone.tip);
      c.fillStyle = g;
      c.fill();
      // gân lá
      c.strokeStyle = 'rgba(255, 255, 240, .45)';
      c.lineWidth = 1.3;
      c.beginPath();
      c.moveTo(0, 4);
      c.lineTo(0, -L * 0.94);
      c.stroke();
      c.lineWidth = 0.8;
      for (let i = 1; i <= 5; i++) {
        const y = -L * (i / 6.2);
        const w = Wd * 0.34 * Math.sin(Math.PI * (i / 6.2));
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(-w, y - L * 0.08);
        c.moveTo(0, y);
        c.lineTo(w, y - L * 0.08);
        c.stroke();
      }
      // cuống
      c.strokeStyle = tone.base;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(0, 6);
      c.stroke();
    }, S / 2 / (L / 2));
  }

  // nụ hoa: hình giọt màu hồng đậm với đài xanh
  function makeBud(tone) {
    const S = 40;
    return sprite(S, (c) => {
      c.translate(S / 2, S / 2 + 6);
      const g = c.createLinearGradient(0, 4, 0, -16);
      g.addColorStop(0, tone.core);
      g.addColorStop(1, tone.mid);
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0, 4);
      c.bezierCurveTo(-9, -2, -7, -14, 0, -17);
      c.bezierCurveTo(7, -14, 9, -2, 0, 4);
      c.fill();
      c.strokeStyle = 'rgba(190, 50, 100, .35)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(0, 2);
      c.quadraticCurveTo(-2, -8, 0, -15);
      c.stroke();
      c.fillStyle = '#5f8f3e';
      for (const s of [-1, 1]) {
        c.beginPath();
        c.moveTo(0, 6);
        c.quadraticCurveTo(s * 7, 2, s * 5, -4);
        c.quadraticCurveTo(s * 2, 0, 0, 6);
        c.fill();
      }
      c.strokeStyle = '#5f8f3e';
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(0, 6);
      c.lineTo(0, 13);
      c.stroke();
    }, S / 2 / 10);
  }

  const flowerSprites = TONES.map((t) => makeFlower(t, 128));
  const petalSprites = TONES.map(makePetal);
  const leafSprites = LEAF_TONES.map(makeLeaf);
  const budSprites = TONES.map(makeBud);
  const seedSprite = makeFlower(TONES[1], 256);

  function drawSprite(c, spr, x, y, r, rot, alpha) {
    const d = r * spr.k * 2;
    c.save();
    c.globalAlpha = alpha;
    c.translate(x, y);
    c.rotate(rot);
    c.drawImage(spr.img, -d / 2, -d / 2, d, d);
    c.restore();
  }

  /* ============================================================
     Tạo dáng cây (toạ độ thiết kế: gốc tại (0,0), trục y hướng xuống)
     ============================================================ */
  const GROW_SPEED = 240; // đơn vị / giây
  const MAX_DEPTH = 4;
  const UP = -Math.PI / 2;
  const branches = [];

  function makeBranch(x, y, ang, len, w0, depth, t0) {
    const N = Math.max(4, Math.ceil(len / 7));
    const step = len / N;
    const bend = (R(-0.55, 0.55) / N) * (depth === 0 ? 0.35 : 1);
    const w1 = Math.max(0.9, w0 * (depth === 0 ? 0.62 : 0.5));
    const pts = [];
    let a = ang, px = x, py = y;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      pts.push({ x: px, y: py, w: lerp(w0, w1, Math.pow(t, 0.85)), a });
      a += bend + R(-0.07, 0.07);
      // vươn lên trời và toả rộng ra hai bên như tán anh đào
      const target = depth === 0 ? UP : UP + clamp(px / 240, -1, 1) * 0.8;
      a += (target - a) * (depth <= 1 ? 0.035 : 0.012);
      const lo = depth >= 3 ? -Math.PI - 0.3 : -Math.PI + 0.12;
      const hi = depth >= 3 ? 0.3 : -0.12;
      a = clamp(a, lo, hi);
      px += Math.cos(a) * step;
      py += Math.sin(a) * step;
    }
    const b = { pts, depth, t0, dur: len / GROW_SPEED, w0, lenticels: [] };
    if (w0 > 5) {
      for (let i = 2; i < N; i += 2 + (srng() * 3 | 0)) b.lenticels.push({ i, f: R(0.35, 0.75), o: R(-0.25, 0.15) });
    }
    branches.push(b);

    if (depth >= MAX_DEPTH || len < 18) return;
    const end = pts[N];
    // tách nhánh ở ngọn
    const forks = depth === 0 ? 3 : srng() < 0.7 ? 2 : 3;
    const spread = depth === 0 ? 0.7 : R(0.38, 0.62);
    for (let k = 0; k < forks; k++) {
      const off = lerp(-spread, spread, k / (forks - 1)) + R(-0.12, 0.12) * (depth === 0 ? 0.4 : 1);
      makeBranch(end.x, end.y, end.a + off, len * R(0.68, 0.82), end.w * R(0.78, 0.92), depth + 1, t0 + b.dur);
    }
    // nhánh bên
    const lat = depth === 0 ? 2 : depth < 3 ? 1 + (srng() < 0.5 ? 1 : 0) : srng() < 0.5 ? 1 : 0;
    for (let k = 0; k < lat; k++) {
      const t = R(0.38, 0.82);
      const p = pts[Math.round(t * N)];
      const side = k % 2 ? -1 : 1;
      makeBranch(p.x, p.y, p.a + side * R(0.6, 1.0), len * R(0.45, 0.62), p.w * R(0.5, 0.65), depth + 1, t0 + b.dur * t);
    }
  }
  makeBranch(0, 0, UP + 0.04, 200, 34, 0, 0);
  const GROW_TOTAL = Math.max(...branches.map((b) => b.t0 + b.dur));

  // Hoa, nụ, lá mọc thành chùm dọc các cành nhỏ
  const items = [];
  function addCluster(x, y, tg, k) {
    const n = Math.round(R(2, 5) * k);
    for (let j = 0; j < n; j++) {
      const a = R(0, TAU), d = R(0, 15) * k;
      items.push({ type: 'flower', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, size: R(6.5, 10.5), rot: R(0, TAU), tone: srng() * TONES.length | 0, alpha: R(0.75, 1), tg, front: srng() < 0.62 });
    }
    if (srng() < 0.45) {
      const a = R(0, TAU), d = R(10, 20) * k;
      items.push({ type: 'bud', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, size: R(4.5, 6.5), rot: a + Math.PI / 2 + R(-0.4, 0.4), tone: srng() * TONES.length | 0, alpha: 1, tg, front: srng() < 0.6 });
    }
    const leaves = srng() < 0.6 ? 1 + (srng() * 2.2 | 0) : 0;
    for (let j = 0; j < leaves; j++) {
      const a = R(0, TAU), d = R(9, 20) * k;
      const r = srng();
      const tone = r < 0.38 ? 0 : r < 0.6 ? 1 : r < 0.88 ? 2 : 3;
      items.push({ type: 'leaf', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, size: R(8, 12.5), rot: a + Math.PI / 2 + R(-0.35, 0.35), tone, alpha: R(0.85, 1), tg, front: srng() < 0.45 });
    }
  }
  for (const b of branches) {
    if (b.depth < 2) continue;
    const N = b.pts.length - 1;
    const from = Math.floor(N * (b.depth === 2 ? 0.5 : 0.15));
    for (let i = from; i <= N; i += 3) {
      if (i !== N && srng() < 0.3) continue;
      const p = b.pts[i];
      addCluster(p.x, p.y, b.t0 + (b.dur * i) / N, i === N ? 1.35 : 1);
    }
  }
  // thứ tự nở: theo đường cây mọc, có chút ngẫu nhiên
  const BLOOM_DUR = reduceMotion ? 1.5 : 3.4;
  const ITEM_GROW = 0.4;
  for (const it of items) {
    it.key = (it.tg / GROW_TOTAL) * BLOOM_DUR * 0.7 + R(0, BLOOM_DUR * 0.3);
    it.g = 0;
    it.state = 0;
    it.spr = it.type === 'flower' ? flowerSprites[it.tone] : it.type === 'bud' ? budSprites[it.tone] : leafSprites[it.tone];
  }
  items.sort((a, b) => a.key - b.key);
  const bloomedFlowers = [];

  // Khung bao của cây
  const BOX = (() => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = 4;
    for (const b of branches) for (const p of b.pts) {
      x0 = Math.min(x0, p.x - p.w); x1 = Math.max(x1, p.x + p.w);
      y0 = Math.min(y0, p.y - p.w); y1 = Math.max(y1, p.y + p.w);
    }
    for (const it of items) {
      const r = it.size * 1.6;
      x0 = Math.min(x0, it.x - r); x1 = Math.max(x1, it.x + r);
      y0 = Math.min(y0, it.y - r);
    }
    x0 -= 8; x1 += 8; y0 -= 8;
    y1 = Math.min(y1, 6);
    return { x0, y0, w: x1 - x0, h: y1 - y0 };
  })();

  /* ---------- Vẽ cành ---------- */
  function sideSign(b) {
    const p = b.pts[0];
    return -Math.sin(p.a) > 0 ? 1 : -1; // chọn phía có ánh sáng (bên trái)
  }
  function ribbon(c, b, upto, wf, of) {
    const pts = b.pts;
    const n = Math.min(pts.length - 1, upto);
    if (n < 1) return;
    const s = sideSign(b);
    const L = [], Rt = [];
    for (let i = 0; i <= n; i++) {
      const p = pts[i];
      const nx = -Math.sin(p.a), ny = Math.cos(p.a);
      const cx = p.x + nx * p.w * of * s, cy = p.y + ny * p.w * of * s;
      const hw = (p.w * wf) / 2;
      L.push(cx + nx * hw, cy + ny * hw);
      Rt.push(cx - nx * hw, cy - ny * hw);
    }
    c.moveTo(L[0], L[1]);
    for (let i = 2; i < L.length; i += 2) c.lineTo(L[i], L[i + 1]);
    const tip = pts[n];
    const tw = (tip.w * wf) / 2;
    c.arc(Rt[Rt.length - 2] + (L[L.length - 2] - Rt[Rt.length - 2]) / 2, Rt[Rt.length - 1] + (L[L.length - 1] - Rt[Rt.length - 1]) / 2, tw, tip.a + Math.PI / 2, tip.a - Math.PI / 2, true);
    for (let i = Rt.length - 2; i >= 0; i -= 2) c.lineTo(Rt[i], Rt[i + 1]);
    c.closePath();
  }

  function drawBranches(c, growT) {
    const prog = branches.map((b) => {
      const p = clamp((growT - b.t0) / b.dur, 0, 1);
      return p <= 0 ? -1 : Math.max(1, Math.floor(p * (b.pts.length - 1)));
    });
    c.save();
    c.beginPath();
    c.rect(BOX.x0 - 50, BOX.y0 - 50, BOX.w + 100, -BOX.y0 + 53); // cắt phần gốc dưới mặt đất
    c.clip();
    const pass = (color, wf, of, minW) => {
      c.fillStyle = color;
      c.beginPath();
      branches.forEach((b, i) => { if (prog[i] > 0 && b.w0 >= minW) ribbon(c, b, prog[i], wf, of); });
      c.fill();
    };
    pass(BARK_DARK, 1, 0, 0);
    pass(BARK_MID, 0.7, 0.13, 2);
    pass(BARK_LIGHT, 0.22, 0.26, 4);
    // vằn ngang trên vỏ anh đào
    c.strokeStyle = 'rgba(205, 170, 160, .26)';
    c.lineWidth = 1.1;
    c.lineCap = 'round';
    c.beginPath();
    branches.forEach((b, bi) => {
      for (const l of b.lenticels) {
        if (l.i > prog[bi]) continue;
        const p = b.pts[l.i];
        const nx = -Math.sin(p.a), ny = Math.cos(p.a);
        const hw = (p.w * l.f) / 2, o = p.w * l.o;
        c.moveTo(p.x + nx * (o - hw), p.y + ny * (o - hw));
        c.lineTo(p.x + nx * (o + hw), p.y + ny * (o + hw));
      }
    });
    c.stroke();
    c.restore();
  }

  /* ---------- Đồi cỏ ---------- */
  const HILL = { rx: 1700, ry: 90, cy: 86 };
  const hillTop = (x) => HILL.cy - HILL.ry * Math.sqrt(Math.max(0, 1 - (x / HILL.rx) * (x / HILL.rx)));
  const GRASS_COLORS = ['#5fa850', '#79bb5f', '#94cc72'];
  const blades = [];
  for (let i = 0; i < 320; i++) {
    const x = (srng() < 0.6 ? R(-1, 1) * R(0, 1) : R(-1, 1)) * 760;
    blades.push({ x, y: hillTop(x) + R(1, 5), h: R(5, 14), lean: R(-4, 4), w: R(1.1, 1.9), c: srng() * 3 | 0, ph: R(0, TAU) });
  }
  const daisies = [];
  for (let i = 0; i < 26; i++) {
    const x = R(-620, 620);
    if (Math.abs(x) < 40) continue;
    daisies.push({ x, y: hillTop(x) + R(4, 18), r: R(2, 3.2), c: ['#ffffff', '#ffd6e6', '#fff3b0'][srng() * 3 | 0] });
  }

  function drawHill(c) {
    c.beginPath();
    c.ellipse(0, HILL.cy, HILL.rx, HILL.ry, 0, Math.PI, TAU);
    c.lineTo(HILL.rx, 900);
    c.lineTo(-HILL.rx, 900);
    c.closePath();
    const g = c.createLinearGradient(0, -4, 0, 160);
    g.addColorStop(0, '#d2efb6');
    g.addColorStop(0.3, '#a8da8c');
    g.addColorStop(1, '#7cbf68');
    c.fillStyle = g;
    c.fill();

    c.beginPath();
    c.ellipse(0, HILL.cy, HILL.rx, HILL.ry, 0, Math.PI, TAU);
    c.strokeStyle = 'rgba(255, 255, 255, .55)';
    c.lineWidth = 2;
    c.stroke();

    // bóng dưới gốc cây
    c.save();
    c.scale(1, 0.1);
    const sh = c.createRadialGradient(10, 40, 0, 10, 40, 210);
    sh.addColorStop(0, 'rgba(40, 90, 50, .38)');
    sh.addColorStop(1, 'rgba(40, 90, 50, 0)');
    c.fillStyle = sh;
    c.fillRect(-240, -200, 500, 480);
    c.restore();

    // cỏ lay nhẹ theo gió
    c.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      c.strokeStyle = GRASS_COLORS[k];
      c.beginPath();
      for (const b of blades) {
        if (b.c !== k) continue;
        const sway = reduceMotion ? 0 : Math.sin(time * 1.6 + b.ph + b.x * 0.01) * 2.2;
        c.moveTo(b.x, b.y);
        c.quadraticCurveTo(b.x + b.lean * 0.4, b.y - b.h * 0.6, b.x + b.lean + sway, b.y - b.h);
      }
      c.lineWidth = 1.5;
      c.stroke();
    }
    for (const d of daisies) {
      c.fillStyle = d.c;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        c.beginPath();
        c.arc(d.x + Math.cos(a) * d.r, d.y + Math.sin(a) * d.r, d.r * 0.75, 0, TAU);
        c.fill();
      }
      c.fillStyle = '#f2b632';
      c.beginPath();
      c.arc(d.x, d.y, d.r * 0.6, 0, TAU);
      c.fill();
    }
  }

  /* ---------- Các lớp vẽ sẵn: hoa phía sau / cành / hoa phía trước ---------- */
  const mkLayer = () => { const cv = document.createElement('canvas'); return { cv, c: cv.getContext('2d') }; };
  const backL = mkLayer(), branchL = mkLayer(), frontL = mkLayer();
  let layerScale = 1;

  function setupLayers(scale) {
    layerScale = scale;
    for (const L of [backL, branchL, frontL]) {
      L.cv.width = Math.ceil(BOX.w * scale);
      L.cv.height = Math.ceil(BOX.h * scale);
      L.c.setTransform(scale, 0, 0, scale, -BOX.x0 * scale, -BOX.y0 * scale);
    }
    drawBranches(branchL.c, growT);
    for (const it of items) if (it.state === 2) paintItem(it);
  }
  function redrawBranchLayer() {
    const c = branchL.c;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, branchL.cv.width, branchL.cv.height);
    c.restore();
    drawBranches(c, growT);
  }
  function paintItem(it) {
    drawSprite(it.front ? frontL.c : backL.c, it.spr, it.x, it.y, it.size, it.rot, it.alpha * (it.front ? 1 : 0.9));
  }

  /* ============================================================
     Bố cục
     ============================================================ */
  let W = 0, H = 0, DPR = 1, petalScale = 1;
  let start = { s: 1, x: 0, y: 0 };
  let end = { s: 1, x: 0, y: 0 };

  function fitTree(x, y, w, h) {
    const s = Math.max(0.15, Math.min(w / BOX.w, h / BOX.h));
    return { s, x: x + w / 2 - (BOX.x0 + BOX.w / 2) * s, y: y + h / 2 - (BOX.y0 + BOX.h / 2) * s };
  }

  function computeLayout() {
    W = window.innerWidth;
    H = window.innerHeight;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    for (const cv of [canvas, fx]) {
      cv.width = Math.round(W * DPR);
      cv.height = Math.round(H * DPR);
    }
    start = fitTree(W * 0.04, H * 0.05, W * 0.92, H * 0.86);
    if (portraitQuery.matches) {
      end = fitTree(W * 0.04, 12, W * 0.92, Math.max(140, letter.offsetTop - 34));
    } else {
      const right = letter.offsetLeft + letter.offsetWidth;
      const gap = W * 0.025;
      end = fitTree(right + gap, H * 0.05, W - right - gap * 2, H * 0.86);
    }
    petalScale = clamp(Math.min(W, H) / 760, 0.7, 1.25);
  }

  /* ============================================================
     Trạng thái hoạt cảnh
     ============================================================ */
  let phase = 'seed'; // seed → shrink → fall → grow → bloom → move → done
  let phaseT = 0;
  let time = 0;
  let growT = 0;
  let bloomT = 0;
  let itemIdx = 0;
  const blooming = [];
  const SEED_Y = BOX.y0 + BOX.h * 0.45;
  const seed = { y: SEED_Y, fromY: SEED_Y, scale: 1, visible: true };
  const MOVE_DUR = 1.6;
  let letterShown = false;

  const ORDER = ['seed', 'shrink', 'fall', 'grow', 'bloom', 'move', 'done'];
  const isAfter = (p) => ORDER.indexOf(phase) >= ORDER.indexOf(p);
  function go(p) { phase = p; phaseT = 0; }

  function currentTf() {
    if (phase === 'move') {
      const t = easeInOut(clamp(phaseT / MOVE_DUR, 0, 1));
      return { s: lerp(start.s, end.s, t), x: lerp(start.x, end.x, t), y: lerp(start.y, end.y, t) };
    }
    return phase === 'done' ? end : start;
  }

  function update(dt) {
    phaseT += dt;
    switch (phase) {
      case 'seed':
        seed.y = SEED_Y + Math.sin(time * 2.2) * 8;
        break;
      case 'shrink': {
        const t = clamp(phaseT / 0.7, 0, 1);
        seed.scale = lerp(1, 0.25, easeInOut(t));
        if (t >= 1) { seed.fromY = seed.y; go('fall'); }
        break;
      }
      case 'fall': {
        const t = clamp(phaseT / 1.1, 0, 1);
        seed.y = lerp(seed.fromY, -2, easeInQuad(t));
        if (t >= 1) {
          seed.visible = false;
          const tf = currentTf();
          burst(tf.x, tf.y - 4, 10, 140);
          go('grow');
        }
        break;
      }
      case 'grow':
        growT = Math.min(GROW_TOTAL, growT + dt * (reduceMotion ? 3 : 1));
        redrawBranchLayer();
        if (growT >= GROW_TOTAL) go('bloom');
        break;
      case 'bloom':
        bloomT += dt;
        while (itemIdx < items.length && items[itemIdx].key <= bloomT) {
          const it = items[itemIdx++];
          it.state = 1;
          blooming.push(it);
        }
        for (let i = blooming.length - 1; i >= 0; i--) {
          const it = blooming[i];
          it.g += dt / ITEM_GROW;
          if (it.g >= 1) {
            it.state = 2;
            paintItem(it);
            if (it.type === 'flower') bloomedFlowers.push(it);
            blooming.splice(i, 1);
          }
        }
        if (itemIdx >= items.length && !blooming.length) go('move');
        break;
      case 'move':
        if (!letterShown && phaseT > MOVE_DUR * 0.55) showLetter();
        if (phaseT >= MOVE_DUR) {
          go('done');
          setupLayers(end.s * DPR); // vẽ lại cho nét ở kích thước cuối
        }
        break;
    }
    updatePetals(dt);
  }

  /* ============================================================
     Cánh hoa (và lá) bay
     ============================================================ */
  const petals = [];
  const pointer = { x: 0, y: 0, active: false };
  let ambientAcc = 0;
  let canopyAcc = 0;

  function addPetal(x, y, o = {}) {
    if (petals.length >= (o.force ? 220 : 150)) return;
    const depth = Math.random();
    const r = Math.random();
    const kind = r < (o.flowerChance ?? 0.1) ? 'flower' : r < (o.flowerChance ?? 0.1) + 0.07 ? 'leaf' : 'petal';
    petals.push({
      x, y,
      vx: o.vx || 0,
      vy: o.vy || 0,
      depth,
      size: (kind === 'flower' ? rand(8, 12) : kind === 'leaf' ? rand(8, 11) : rand(6, 10)) * (0.65 + depth * 0.7) * petalScale,
      spr: kind === 'flower' ? flowerSprites[randIdx(TONES.length)] : kind === 'leaf' ? leafSprites[randIdx(LEAF_TONES.length)] : petalSprites[randIdx(TONES.length)],
      rot: rand(0, TAU),
      vr: rand(-1.8, 1.8),
      flip: rand(0, TAU),
      vf: rand(1.4, 3.4),
      sway: rand(0, TAU),
      swayF: rand(0.5, 1.3),
      swayA: rand(8, 26),
      fall: rand(28, 52) * (kind === 'leaf' ? 1.25 : 1),
      alpha: rand(0.75, 1),
      landed: false,
      life: 0,
    });
  }

  function burst(x, y, n, speed = 240) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const sp = rand(speed * 0.35, speed);
      addPetal(x, y, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, flowerChance: 0.3, force: true });
    }
  }

  function updatePetals(dt) {
    const rateK = reduceMotion ? 0.4 : 1;
    ambientAcc += dt * (phase === 'done' ? 1.4 : 0.6) * rateK;
    while (ambientAcc >= 1) {
      ambientAcc--;
      addPetal(rand(-W * 0.3, W * 0.95), -20);
    }
    if (bloomedFlowers.length > 30) {
      canopyAcc += dt * (phase === 'done' ? 3 : 1.6) * rateK;
      const tf = currentTf();
      while (canopyAcc >= 1) {
        canopyAcc--;
        const f = bloomedFlowers[randIdx(bloomedFlowers.length)];
        addPetal(tf.x + f.x * tf.s, tf.y + f.y * tf.s);
      }
    }

    const wind = 16 + Math.sin(time * 0.27) * 14 + Math.sin(time * 0.9) * 4;
    const damp = Math.exp(-2.2 * dt);
    const tf = currentTf();

    for (let i = petals.length - 1; i >= 0; i--) {
      const p = petals[i];
      if (p.landed) {
        p.life += dt;
        if (p.life > 8) petals.splice(i, 1);
        continue;
      }
      const d = 0.55 + p.depth * 0.8;
      p.vx *= damp;
      p.vy *= damp;
      if (pointer.active) {
        const dx = p.x - pointer.x, dy = p.y - pointer.y, d2 = dx * dx + dy * dy;
        if (d2 < 12100 && d2 > 1) {
          const dd = Math.sqrt(d2), f = (110 - dd) / 110;
          p.vx += (dx / dd) * f * 300 * dt;
          p.vy += (dy / dd) * f * 300 * dt;
        }
      }
      p.x += (p.vx + wind * d + Math.sin(time * p.swayF + p.sway) * p.swayA) * dt;
      p.y += (p.vy + p.fall * d) * dt;
      p.rot += p.vr * dt;
      p.flip += p.vf * dt;

      // một số cánh hoa đáp xuống đồi cỏ
      if (phase === 'done' && p.depth > 0.35) {
        const xl = (p.x - tf.x) / tf.s;
        if (Math.abs(xl) < 650) {
          const gy = tf.y + (hillTop(xl) + 4) * tf.s;
          if (p.y >= gy && p.y < gy + 12) {
            p.landed = true;
            p.y = gy;
            p.life = 0;
            continue;
          }
        }
      }
      if (p.y > H + 40 || p.x > W + 60 || p.x < -W * 0.4 || p.y < -260) petals.splice(i, 1);
    }
  }

  function drawPetal(c, p) {
    const fy = p.landed ? 0.35 : Math.cos(p.flip);
    let a = p.alpha * (p.depth < 0.45 ? 0.75 : 1);
    if (p.landed) a *= clamp((8 - p.life) / 2, 0, 1);
    const cs = Math.cos(p.rot) * DPR, sn = Math.sin(p.rot) * DPR;
    const d = p.size * p.spr.k * 2;
    c.globalAlpha = a;
    c.setTransform(cs, sn, -sn * fy, cs * fy, p.x * DPR, p.y * DPR);
    c.drawImage(p.spr.img, -d / 2, -d / 2, d, d);
  }

  /* ============================================================
     Vẽ
     ============================================================ */
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    fxCtx.setTransform(1, 0, 0, 1, 0, 0);
    fxCtx.clearRect(0, 0, fx.width, fx.height);

    for (const p of petals) if (p.depth < 0.45 && !p.landed) drawPetal(ctx, p);
    ctx.globalAlpha = 1;

    const tf = currentTf();
    ctx.setTransform(tf.s * DPR, 0, 0, tf.s * DPR, tf.x * DPR, tf.y * DPR);
    drawHill(ctx);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const p of petals) if (p.landed) drawPetal(ctx, p);
    ctx.globalAlpha = 1;
    ctx.setTransform(tf.s * DPR, 0, 0, tf.s * DPR, tf.x * DPR, tf.y * DPR);

    // cây (đung đưa nhẹ khi đã xong)
    ctx.save();
    if (phase === 'done' && !reduceMotion) ctx.rotate(Math.sin(time * 0.7) * 0.005);
    ctx.imageSmoothingQuality = 'high';
    const lw = backL.cv.width / layerScale, lh = backL.cv.height / layerScale;
    ctx.drawImage(backL.cv, BOX.x0, BOX.y0, lw, lh);
    ctx.drawImage(branchL.cv, BOX.x0, BOX.y0, lw, lh);
    ctx.drawImage(frontL.cv, BOX.x0, BOX.y0, lw, lh);
    for (const it of blooming) {
      const k = easeOutBack(clamp(it.g, 0, 1));
      drawSprite(ctx, it.spr, it.x, it.y, it.size * k, it.rot + (1 - it.g) * 0.8, it.alpha);
    }
    ctx.restore();

    // bông hoa "hạt giống"
    if (seed.visible) {
      const y = seed.y;
      if (phase === 'seed') {
        for (let i = 0; i < 3; i++) {
          const ph = (time * 0.55 + i / 3) % 1;
          ctx.beginPath();
          ctx.arc(0, y, 34 + ph * 70, 0, TAU);
          ctx.strokeStyle = `rgba(46, 159, 224, ${(1 - ph) * 0.55})`;
          ctx.lineWidth = 2 / tf.s;
          ctx.stroke();
        }
      }
      const glow = ctx.createRadialGradient(0, y, 0, 0, y, 70 * seed.scale);
      glow.addColorStop(0, 'rgba(255, 255, 255, .9)');
      glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, y, 70 * seed.scale, 0, TAU);
      ctx.fill();
      drawSprite(ctx, seedSprite, 0, y, 34 * seed.scale, time * 0.5, 1);

      if (phase === 'seed') {
        const fs = clamp(28 * tf.s, 18, 30);
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.font = `600 ${fs}px "Dancing Script", cursive`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.globalAlpha = 0.65 + Math.sin(time * 2.4) * 0.35;
        ctx.shadowColor = 'rgba(255, 255, 255, .9)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#196698';
        ctx.fillText('Chạm vào bông hoa nhé', tf.x, tf.y + (y + 110) * tf.s);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
    }

    for (const p of petals) if (p.depth >= 0.45 && !p.landed) drawPetal(fxCtx, p);
    fxCtx.globalAlpha = 1;
  }

  /* ============================================================
     Lá thư — hiệu ứng gõ chữ
     ============================================================ */
  const splitGraphemes = (() => {
    if (window.Intl && Intl.Segmenter) {
      const seg = new Intl.Segmenter('vi', { granularity: 'grapheme' });
      return (s) => Array.from(seg.segment(s), (x) => x.segment);
    }
    return (s) => Array.from(s);
  })();

  const typingItems = [];
  letter.querySelectorAll('[data-type]').forEach((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const text = node.nodeValue.replace(/\s+/g, ' ');
      node.nodeValue = '';
      if (text.trim()) typingItems.push({ el, node, chars: splitGraphemes(text.trim()) });
    });
  });

  function typeLetter(onDone) {
    const body = letter.querySelector('.paper-body');
    const caret = document.createElement('span');
    caret.className = 'caret';
    if (reduceMotion) {
      typingItems.forEach((it) => { it.node.nodeValue = it.chars.join(''); });
      onDone();
      return;
    }
    let i = 0, j = 0;
    const tick = () => {
      if (i >= typingItems.length) {
        setTimeout(() => caret.remove(), 2500);
        onDone();
        return;
      }
      const it = typingItems[i];
      if (j === 0) it.node.parentNode.insertBefore(caret, it.node.nextSibling);
      const ch = it.chars[j++];
      const stick = body.scrollHeight - body.scrollTop - body.clientHeight < 48;
      it.node.nodeValue += ch;
      if (stick) body.scrollTop = body.scrollHeight;
      let delay = 34 + Math.random() * 26;
      if (/[,;:]/.test(ch)) delay += 170;
      else if (/[.!?…]/.test(ch)) delay += 340;
      else if (ch === '—') delay += 180;
      if (j >= it.chars.length) {
        i++;
        j = 0;
        if (typingItems[i] && typingItems[i].el !== it.el) delay += 550;
      }
      setTimeout(tick, delay);
    };
    setTimeout(tick, 700);
  }

  function showLetter() {
    letterShown = true;
    letter.classList.add('show');
    typeLetter(() => letter.classList.add('done'));
  }

  /* ============================================================
     Nhạc: YouTube (ẩn), dự phòng bằng file mp3
     ============================================================ */
  const music = (() => {
    let yt = null, ytReady = false, useYT = !!YOUTUBE_ID, want = false, playing = false, fallbackTimer = 0;

    const setPlaying = (v) => { playing = v; musicBtn.classList.toggle('playing', v); };
    audio.addEventListener('play', () => { if (!useYT) setPlaying(true); });
    audio.addEventListener('pause', () => { if (!useYT) setPlaying(false); });

    function useMp3() {
      if (!useYT) return;
      useYT = false;
      try { if (yt && yt.stopVideo) yt.stopVideo(); } catch (e) { /* bỏ qua */ }
      setPlaying(false);
      if (want) { const p = audio.play(); if (p && p.catch) p.catch(() => {}); }
    }

    if (useYT) {
      window.onYouTubeIframeAPIReady = () => {
        yt = new YT.Player('yt-player', {
          width: 200,
          height: 200,
          videoId: YOUTUBE_ID,
          playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, rel: 0, playsinline: 1, loop: 1, playlist: YOUTUBE_ID, iv_load_policy: 3 },
          events: {
            onReady() {
              ytReady = true;
              yt.setVolume(80);
              if (want) yt.playVideo();
            },
            onStateChange(e) {
              if (!useYT) return;
              if (e.data === YT.PlayerState.PLAYING) setPlaying(true);
              else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) setPlaying(false);
            },
            onError: useMp3,
          },
        });
      };
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.onerror = useMp3; // không có mạng
      document.head.appendChild(tag);
    }

    return {
      play() {
        want = true;
        if (useYT) {
          if (ytReady) yt.playVideo();
          // YouTube không phát được sau vài giây → chuyển sang mp3
          clearTimeout(fallbackTimer);
          fallbackTimer = setTimeout(() => { if (useYT && want && !playing) useMp3(); }, 7000);
        } else {
          const p = audio.play();
          if (p && p.catch) p.catch(() => {});
        }
      },
      pause() {
        want = false;
        clearTimeout(fallbackTimer);
        if (useYT && ytReady) yt.pauseVideo();
        audio.pause();
        setPlaying(false);
      },
      get playing() { return playing; },
      get wanted() { return want; },
      // mở khoá thẻ audio trong lúc người dùng chạm (cần cho iPhone nếu phải dùng mp3)
      unlock() {
        if (!useYT) return;
        audio.muted = true;
        const p = audio.play();
        const done = () => { audio.pause(); audio.currentTime = 0; audio.muted = false; };
        if (p && p.then) p.then(done, done); else done();
      },
    };
  })();

  let userPaused = false;
  musicBtn.addEventListener('click', () => {
    if (music.wanted) { userPaused = true; music.pause(); }
    else { userPaused = false; music.play(); }
  });
  document.addEventListener('pointerdown', function first(e) {
    if (e.target.closest('#music-toggle')) return;
    document.removeEventListener('pointerdown', first);
    music.unlock();
    if (!userPaused) music.play();
  });

  /* ============================================================
     Tương tác
     ============================================================ */
  canvas.addEventListener('pointerdown', (e) => {
    if (phase === 'seed') {
      go('shrink');
      canvas.style.cursor = 'default';
    } else if (isAfter('bloom')) {
      burst(e.clientX, e.clientY, 14);
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.active = e.pointerType === 'mouse';
  });
  canvas.addEventListener('pointerleave', () => { pointer.active = false; });

  let resizeQueued = false;
  window.addEventListener('resize', () => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      resizeQueued = false;
      computeLayout();
      for (let i = petals.length - 1; i >= 0; i--) if (petals[i].landed) petals.splice(i, 1);
      setupLayers((isAfter('move') ? end.s : start.s) * DPR);
    });
  });

  /* ============================================================
     Khởi động
     ============================================================ */
  computeLayout();
  setupLayers(start.s * DPR);
  if (document.fonts && document.fonts.load) document.fonts.load('600 26px "Dancing Script"');

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

})();
