// art.js — palettes, pixel font, sprites and the K41JU generator for PAC1F1C R1M.
// Plain script: sets globalThis.ART. Also loaded by tools/make-images.mjs to draw
// the icons and share image, so keep it free of DOM calls.

(() => {
  // Four shades per palette, lightest (0) to darkest (3).
  const PALETTES = [
    { name: 'GB GREEN', c: ['#9bbc0f', '#8bac0f', '#306230', '#0f380f'] },
    { name: 'POCKET', c: ['#f4f4ec', '#a8a8a0', '#585850', '#181818'] },
    { name: 'NEON BR34CH', c: ['#7df9ff', '#ff3fa4', '#4b1d6e', '#0d0221'] },
    { name: 'SH4TT3RD0ME', c: ['#f8e8c8', '#e89048', '#9c3020', '#201020'] },
  ];

  // 3x5 pixel font, one row per number (3 bits, left bit first).
  const FONT = {
    A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7],
    F: [7, 4, 6, 4, 4], G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2],
    K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7], M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2],
    P: [6, 5, 6, 4, 4], Q: [2, 5, 5, 6, 3], R: [6, 5, 6, 5, 5], S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2],
    U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5], Y: [5, 5, 2, 2, 2],
    Z: [7, 1, 2, 4, 7],
    0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [6, 1, 2, 4, 7], 3: [6, 1, 2, 1, 6], 4: [5, 5, 7, 1, 1],
    5: [7, 4, 6, 1, 6], 6: [3, 4, 6, 5, 2], 7: [7, 1, 2, 2, 2], 8: [2, 5, 2, 5, 2], 9: [2, 5, 3, 1, 6],
    ' ': [0, 0, 0, 0, 0], '.': [0, 0, 0, 0, 2], ',': [0, 0, 0, 2, 4], '!': [2, 2, 2, 0, 2], '?': [6, 1, 2, 0, 2],
    ':': [0, 2, 0, 2, 0], '-': [0, 0, 7, 0, 0], "'": [2, 2, 0, 0, 0], '/': [1, 1, 2, 4, 4], '%': [5, 1, 2, 4, 5],
    '+': [0, 2, 7, 2, 0], '(': [1, 2, 2, 2, 1], ')': [4, 2, 2, 2, 4], '>': [4, 6, 7, 6, 4], '<': [1, 3, 7, 3, 1],
    '#': [5, 7, 5, 7, 5], '*': [0, 5, 2, 5, 0], '=': [0, 7, 0, 7, 0], '"': [5, 5, 0, 0, 0], '&': [2, 5, 2, 5, 3],
    '^': [2, 7, 0, 0, 0], 'v': [0, 0, 0, 7, 2], '_': [0, 0, 0, 0, 7], '~': [0, 1, 7, 4, 0],
  };

  // 5-wide versions for big text, where the 3-wide M and W read as H.
  const WIDE = { M: [17, 27, 21, 17, 17], W: [17, 17, 21, 27, 17] };

  // ---- 16x16 sprites: '.' clear, 0-3 shade ----
  const mirror = (half) => half.map((r) => r + [...r].reverse().join(''));
  const join = (L, R) => L.map((r, i) => r + [...R[i]].reverse().join(''));
  const flip = (rows) => rows.map((r) => [...r].reverse().join(''));

  const mechFront = [
    '......33', '.....312', '.....300', '..333333', '.3211223', '32112322', '32213200', '32203200',
    '.3303222', '.3203322', '..3.3222', '....3223', '....322.', '....322.', '...3223.', '...3333.',
  ];
  const mechFrontStep = [...mechFront.slice(0, 12), '....322.', '...3223.', '...3333.', '........'];
  const mechBack = [
    '......33', '.....322', '.....322', '..333333', '.3211223', '32112223', '32213232', '32213232',
    ...mechFront.slice(8),
  ];
  const mechBackStep = [...mechBack.slice(0, 12), ...mechFrontStep.slice(12)];
  const mechSide = [
    '......333.......', '.....32223......', '....300223......', '.....33333......',
    '....3211223.....', '...32112223.....', '...32112223.....', '...3221223......',
    '....3333223.....', '....3223.3......', '.....3223.......', '.....32223......',
    '.....322223.....', '....322..322....', '....322..322....', '...3333..3333...',
  ];
  const mechSideStep = [...mechSide.slice(0, 13), '.....32223......', '.....32223......', '.....333333.....'];

  const allyHead = ['....3333', '....3222', '....3000'];
  const human = [
    '........', '.....333', '....3333', '....3300', '....3030', '.....300', '....3333', '...32222',
    '...32222', '..302222', '...32222', '....3222', '....32..', '....32..', '....33..', '........',
  ];
  const marshal = [...human]; marshal[1] = '....3333'; marshal[2] = '...33333';
  const mako = [...human]; mako[3] = '...33300'; mako[4] = '...33030'; mako[5] = '...33300';

  const SPR = {
    mech_down: [mirror(mechFront), join(mechFrontStep, mechFront), join(mechFront, mechFrontStep)],
    mech_up: [mirror(mechBack), join(mechBackStep, mechBack), join(mechBack, mechBackStep)],
    mech_left: [mechSide, mechSideStep, mechSide],
    mech_right: [flip(mechSide), flip(mechSideStep), flip(mechSide)],
    ally: mirror([...allyHead, ...mechFront.slice(3)]),
    marshal: mirror(marshal),
    mako: mirror(mako),
  };

  // ---- K41JU generator: 48x48, symmetric front view ----
  const KW = 48, KH = 48, CLEAR = 255;

  function genKaiju(s) {
    const a = new Uint8Array(KW * KH).fill(CLEAR);
    const set = (x, y, c) => {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= KW || y >= KH) return;
      a[y * KW + x] = c;
      a[y * KW + (KW - 1 - x)] = c; // mirror
    };
    const shade = (x, y, nx, ny, d) => {
      if (ny < -0.45 && d < 0.85) return 1;
      if (ny > 0.45 || d > 0.8) return (x + y) & 1 ? 3 : 2;
      return 2;
    };
    const ell = (cx, cy, rx, ry, flat) => {
      for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
        for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
          const nx = (x - cx) / rx, ny = (y - cy) / ry, d = nx * nx + ny * ny;
          if (d <= 1) set(x, y, flat ?? shade(x, y, nx, ny, d));
        }
      }
    };
    const tri = (x0, y0, x1, y1, x2, y2, c) => {
      const minX = Math.min(x0, x1, x2), maxX = Math.max(x0, x1, x2);
      const minY = Math.min(y0, y1, y2), maxY = Math.max(y0, y1, y2);
      const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
      for (let y = Math.floor(minY); y <= maxY; y++) {
        for (let x = Math.floor(minX); x <= maxX; x++) {
          const w0 = ((x1 - x) * (y2 - y) - (x2 - x) * (y1 - y)) / area;
          const w1 = ((x2 - x) * (y0 - y) - (x0 - x) * (y2 - y)) / area;
          const w2 = 1 - w0 - w1;
          if (w0 >= 0 && w1 >= 0 && w2 >= 0) set(x, y, typeof c === 'function' ? c(x, y) : c);
        }
      }
    };
    // A tapering limb along a quadratic curve: dark rim first, then a lit core.
    const chain = (pts, r0, r1) => {
      for (const pass of [0, 1]) {
        for (let i = 0; i <= 20; i++) {
          const t = i / 20, u = 1 - t;
          const x = u * u * pts[0][0] + 2 * u * t * pts[1][0] + t * t * pts[2][0];
          const y = u * u * pts[0][1] + 2 * u * t * pts[1][1] + t * t * pts[2][1];
          const r = r0 + (r1 - r0) * t;
          if (pass === 0) ell(x, y, r, r, 3);
          else if (r > 1.2) ell(x, y - 0.4, r - 1, r - 1, 2);
        }
      }
    };

    const B = s.body, Hd = s.head;
    const bx = 24 - 0.5; // centre between columns 23 and 24
    const dither = (x, y) => ((x + y) & 1 ? 3 : 2);

    // Behind the body: wings, tails, frill.
    if (s.wings) {
      tri(bx - 4, B.y - B.ry, 1, 3, 2, B.y + 6, dither);
      for (let i = 0; i < 3; i++) chain([[bx - 5, B.y - B.ry + 2], [8 - i * 2, 6 + i * 6], [2 + i, 6 + i * 9]], 1, 0.6);
    }
    for (let k = 0; k < (s.tails || 0); k++) {
      chain([[bx - B.rx * 0.6, B.y + B.ry * 0.6], [bx - B.rx - 7 - k * 2, B.y + 4 - k * 4], [4 + k * 3, B.y - 8 - k * 7]], 3.5, 1.5);
    }
    if (s.crest === 'frill') {
      for (let i = 0; i < 6; i++) {
        const ang = Math.PI * (0.55 + i * 0.09);
        tri(bx, Hd.y, bx + Math.cos(ang) * 18, Hd.y - Math.sin(ang) * 15, bx + Math.cos(ang + 0.08) * 17, Hd.y - Math.sin(ang + 0.08) * 14, i & 1 ? 2 : 1);
      }
    }

    // Legs, body, arms.
    ell(bx - B.rx * 0.5, B.y + B.ry, 4, 5);
    ell(bx, B.y, B.rx, B.ry);
    // Ridged belly plate.
    const br = B.rx * 0.5, bry = B.ry * 0.7;
    for (let y = Math.floor(B.y - bry + 3); y <= B.y + bry; y++) {
      for (let x = Math.floor(bx - br); x <= bx; x++) {
        const nx = (x - bx) / br, ny = (y - B.y - 2) / bry;
        if (nx * nx + ny * ny <= 1) set(x, y, (y - B.y) % 3 === 0 ? 3 : (x + y) & 1 ? 1 : 2);
      }
    }
    if (s.spikes) for (let i = 0; i < 3; i++) tri(bx - B.rx + 2 + i * 3, B.y - B.ry + 3 + i, bx - B.rx + 4 + i * 3, B.y - B.ry - 4 + i, bx - B.rx + 6 + i * 3, B.y - B.ry + 3 + i, 3);
    const sx = bx - B.rx + 1, sy = B.y - B.ry * 0.45;
    if (s.arms === 'long') {
      chain([[sx, sy], [sx - 8, B.y], [sx - 7, 41]], 3.5, 2.5);
      ell(sx - 7, 42, 4, 3.5);
    } else if (s.arms === 'claws') {
      chain([[sx, sy], [sx - 9, sy - 2], [sx - 10, sy + 9]], 3.5, 3);
      tri(sx - 14, sy + 8, sx - 11, sy + 17, sx - 9, sy + 9, 3);
      tri(sx - 10, sy + 8, sx - 6, sy + 16, sx - 6, sy + 8, 2);
    } else {
      chain([[sx, sy], [sx - 5, sy + 4], [sx - 3, sy + 11]], 3, 2.5);
      for (let i = 0; i < 3; i++) set(sx - 5 + i, sy + 14, 3);
    }

    // Head and crest.
    if (s.neck) ell(bx, (Hd.y + B.y) / 2, Hd.rx * 0.6, (B.y - Hd.y) / 2);
    ell(bx, Hd.y, Hd.rx, Hd.ry);
    if (s.crest === 'knife') {
      tri(bx - 4, Hd.y - Hd.ry + 3, bx, 0, bx + 4, Hd.y - Hd.ry + 3, (x, y) => (x < bx - 1 ? 1 : x > bx + 1 ? 2 : 0));
    } else if (s.crest === 'horns') {
      chain([[bx - Hd.rx * 0.6, Hd.y - Hd.ry * 0.6], [bx - Hd.rx - 6, Hd.y - 2], [bx - Hd.rx - 4, Hd.y - Hd.ry - 10]], 2.5, 1);
    } else if (s.crest === 'fins') {
      tri(bx - Hd.rx + 1, Hd.y - 2, bx - Hd.rx - 9, Hd.y - 7, bx - Hd.rx + 1, Hd.y + 3, dither);
    }

    // Face: mouth, teeth, eyes.
    const my = Math.round(Hd.y + Hd.ry * 0.35), mw = Math.round(Hd.rx * 0.65);
    for (let x = Math.round(bx - mw); x <= bx; x++) {
      for (let y = my; y < my + (s.mouth === 'jaw' ? 4 : 2); y++) set(x, y, 3);
      if ((x & 1) === 0) set(x, my, 0);
      if (s.mouth === 'jaw' && (x & 1) === 1) set(x, my + 3, 0);
    }
    const ey = Math.round(Hd.y - Hd.ry * 0.2);
    const eyes = [[bx - Hd.rx * 0.5, ey], [bx - Hd.rx * 0.8, ey - 3], [bx - 1.5, ey - 4]].slice(0, (s.eyes || 2) / 2);
    for (const [ex, ey2] of eyes) { set(ex - 1, ey2, 3); set(ex, ey2, 0); set(ex + 1, ey2, 0); set(ex + 2, ey2, 3); }

    // Dark outline around the silhouette.
    const out = a.slice();
    for (let y = 0; y < KH; y++) {
      for (let x = 0; x < KW; x++) {
        if (a[y * KW + x] !== CLEAR) continue;
        const n = (xx, yy) => xx >= 0 && yy >= 0 && xx < KW && yy < KH && a[yy * KW + xx] !== CLEAR;
        if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) out[y * KW + x] = 3;
      }
    }

    // Weak points, drawn live by the renderer so they can pulse.
    const weak = [];
    for (const g of s.glow || []) {
      if (g === 'core') weak.push({ x: 24, y: B.y - 1, r: 4 });
      if (g === 'throat') weak.push({ x: 24, y: Hd.y + Hd.ry + 2, r: 3 });
      if (g === 'sacs') { weak.push({ x: 24 - B.rx + 4, y: B.y - B.ry + 3, r: 3 }); weak.push({ x: 24 + B.rx - 4, y: B.y - B.ry + 3, r: 3 }); }
      if (g === 'brow') weak.push({ x: 24, y: Hd.y - Hd.ry + 2, r: 3 });
    }
    return { px: out, w: KW, h: KH, weak };
  }

  // ---- The roster ----
  // cat = category, hp/atk = base stats, h = height in world units, abil = extra moves.
  const KAIJU = [
    { id: 'scuttle', name: 'SCUTT13', cat: 1, hp: 30, atk: 6, bio: 'SHORE CRAWLER. TRAVELS IN SWARMS. SOFT GLOWING CORE.',
      look: { body: { y: 30, rx: 11, ry: 9 }, head: { y: 20, rx: 7, ry: 5 }, arms: 'claws', eyes: 4, mouth: 'fang', glow: ['core'] } },
    { id: 'grimlurk', name: 'GR1MLURK', cat: 1, hp: 36, atk: 7, bio: 'SKULKS UNDER DOCKS. SPITS BRINE. AIM FOR THE BROW.',
      look: { body: { y: 31, rx: 10, ry: 11 }, head: { y: 16, rx: 8, ry: 7 }, crest: 'fins', arms: 'short', eyes: 2, mouth: 'jaw', glow: ['brow'] } },
    { id: 'mawspawn', name: 'M4WSPAWN', cat: 2, hp: 48, atk: 9, abil: ['dive'], bio: 'ALL MOUTH. DIVES, THEN LUNGES. THROAT SAC IS SOFT.',
      look: { body: { y: 31, rx: 12, ry: 11 }, head: { y: 17, rx: 10, ry: 7 }, crest: 'horns', arms: 'short', eyes: 2, mouth: 'jaw', glow: ['throat'] } },
    { id: 'spineray', name: 'SP1N3RAY', cat: 2, hp: 44, atk: 10, abil: ['dive', 'volley'], bio: 'GLIDES ON SKIN WINGS. FIRES ACID IN THREES.',
      look: { body: { y: 30, rx: 9, ry: 10 }, head: { y: 18, rx: 6, ry: 5 }, wings: true, arms: 'short', eyes: 4, mouth: 'fang', glow: ['core'] } },
    { id: 'hammerjaw', name: 'H4MM3RJAW', cat: 3, hp: 64, atk: 12, abil: ['charge'], bio: 'FRILLED BRUISER. CHARGES FROM RANGE. HIT THE CORE.',
      look: { body: { y: 30, rx: 13, ry: 11 }, head: { y: 15, rx: 8, ry: 6 }, crest: 'frill', arms: 'long', eyes: 2, mouth: 'jaw', glow: ['core'] } },
    { id: 'voltusk', name: 'V0LTUSK', cat: 3, hp: 60, atk: 13, abil: ['dash', 'volley'], bio: 'STORES CHARGE IN SHOULDER SACS. FAST SIDE DASHES.',
      look: { body: { y: 30, rx: 12, ry: 10 }, head: { y: 17, rx: 7, ry: 6 }, crest: 'horns', spikes: true, arms: 'claws', eyes: 6, mouth: 'fang', glow: ['sacs'] } },
    { id: 'abyssor', name: 'AB1SSOR', cat: 4, hp: 80, atk: 15, abil: ['dive', 'volley', 'charge'], bio: 'DEEP TRENCH HUNTER. SIX EYES. RARELY SURFACES.',
      look: { body: { y: 30, rx: 12, ry: 12 }, head: { y: 15, rx: 8, ry: 6 }, wings: true, tails: 1, arms: 'long', eyes: 6, mouth: 'jaw', glow: ['throat', 'core'] } },
    // Bosses
    { id: 'knifehed', name: 'KN1FEHED', cat: 3, hp: 90, atk: 11, boss: 1, abil: ['charge'], bio: 'BLADE-SKULLED. RAMS SHIPS IN HALF. THE BROW CRACKS.',
      look: { body: { y: 31, rx: 13, ry: 11 }, head: { y: 18, rx: 8, ry: 6 }, crest: 'knife', arms: 'long', eyes: 2, mouth: 'jaw', glow: ['brow', 'core'], neck: true } },
    { id: 'otachi', name: '0TACH1', cat: 4, hp: 110, atk: 13, boss: 2, abil: ['volley', 'dive'], bio: 'WINGED. ACID SAC IN THE THROAT. DO NOT LET IT SPIT.',
      look: { body: { y: 30, rx: 11, ry: 11 }, head: { y: 15, rx: 7, ry: 6 }, crest: 'fins', wings: true, tails: 1, arms: 'claws', eyes: 4, mouth: 'fang', glow: ['throat'] } },
    { id: 'leatherbak', name: 'L3ATHERBAK', cat: 4, hp: 130, atk: 14, boss: 3, abil: ['emp', 'charge'], bio: 'KNUCKLE-WALKER. EMP ORGANS ON ITS BACK KILL POWER.',
      look: { body: { y: 29, rx: 15, ry: 12 }, head: { y: 16, rx: 7, ry: 5 }, spikes: true, arms: 'long', eyes: 2, mouth: 'jaw', glow: ['sacs'] } },
    { id: 'raiju', name: 'R41JU', cat: 4, hp: 120, atk: 15, boss: 4, abil: ['dash', 'dive', 'volley'], bio: 'FASTEST K41JU ON RECORD. SPLIT JAW. HUNTS IN PACKS.',
      look: { body: { y: 31, rx: 12, ry: 9 }, head: { y: 20, rx: 9, ry: 5 }, crest: 'frill', arms: 'claws', tails: 1, eyes: 6, mouth: 'jaw', glow: ['core'] } },
    { id: 'slattern', name: 'SL4TT3RN', cat: 5, hp: 160, atk: 18, boss: 5, abil: ['charge', 'volley', 'emp', 'dive'], bio: 'FIRST CATEGORY V. THREE TAILS. GUARDS TH3 BR34CH.',
      look: { body: { y: 30, rx: 14, ry: 12 }, head: { y: 14, rx: 9, ry: 6 }, crest: 'horns', spikes: true, tails: 3, arms: 'long', eyes: 6, mouth: 'jaw', glow: ['brow', 'core'], neck: true } },
  ];
  for (const k of KAIJU) k.sprite = genKaiju(k.look);

  globalThis.ART = { PALETTES, FONT, WIDE, SPR, KAIJU, genKaiju, CLEAR };
})();
