// game.js — PAC1F1C R1M: first-person J4GR vs K41JU, built for a phone held sideways.
// Canvas draws the world, the K41JU and the cockpit; the DOM draws menus and the HUD.

(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const irnd = (a, b) => Math.floor(rnd(a, b + 1));
  const TAU = Math.PI * 2;
  const roman = (n) => ['', 'I', 'II', 'III', 'IV', 'V'][n];
  const hex = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, t) => { const A = hex(a), C = hex(b); return '#' + A.map((v, i) => Math.round(v + (C[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const rgba = (c, a) => { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; };
  const weighted = (opts) => { let r = Math.random() * opts.reduce((s, o) => s + o[1], 0); for (const o of opts) if ((r -= o[1]) < 0) return o[0]; return opts[0][0]; };

  // ================= data =================
  const KAIJU = [
    { id: 'scuttle', name: 'SCUTT13', cat: 1, hp: 30, atk: 6, col: ['#2f8f8a', '#123b3a', '#8fd6c8', '#7ffcff'], bio: 'Shore crawler. Travels in swarms. Soft glowing core.',
      look: { body: { y: 30, rx: 11, ry: 9 }, head: { y: 20, rx: 7, ry: 5 }, arms: 'claws', eyes: 4, glow: ['core'] } },
    { id: 'grimlurk', name: 'GR1MLURK', cat: 1, hp: 36, atk: 7, col: ['#6b7a3a', '#262d12', '#c4c98a', '#e6ff6b'], bio: 'Skulks under docks and spits brine. Aim for the brow.',
      look: { body: { y: 31, rx: 10, ry: 11 }, head: { y: 16, rx: 8, ry: 7 }, crest: 'fins', arms: 'short', eyes: 2, glow: ['brow'] } },
    { id: 'mawspawn', name: 'M4WSPAWN', cat: 2, hp: 48, atk: 9, abil: ['dive'], col: ['#7a3f8f', '#2a1036', '#d9a3e0', '#ff5ad1'], bio: 'All mouth. Dives, then lunges from below. Throat sac is soft.',
      look: { body: { y: 31, rx: 12, ry: 11 }, head: { y: 17, rx: 10, ry: 7 }, crest: 'horns', arms: 'short', eyes: 2, glow: ['throat'] } },
    { id: 'spineray', name: 'SP1N3RAY', cat: 2, hp: 44, atk: 10, abil: ['dive', 'volley'], col: ['#2f5f9e', '#0f2142', '#9cc3f0', '#5cf2ff'], bio: 'Glides on skin wings. Fires acid in threes.',
      look: { body: { y: 30, rx: 9, ry: 10 }, head: { y: 18, rx: 6, ry: 5 }, wings: true, arms: 'short', eyes: 4, glow: ['core'] } },
    { id: 'hammerjaw', name: 'H4MM3RJAW', cat: 3, hp: 64, atk: 12, abil: ['charge'], col: ['#9a4a2c', '#36150a', '#e3a27e', '#ffb347'], bio: 'Frilled bruiser. Charges from range. Break the core plate.',
      look: { body: { y: 30, rx: 13, ry: 11 }, head: { y: 15, rx: 8, ry: 6 }, crest: 'frill', arms: 'long', eyes: 2, glow: ['core'] } },
    { id: 'voltusk', name: 'V0LTUSK', cat: 3, hp: 60, atk: 13, abil: ['dash', 'volley'], col: ['#6a6f2a', '#22230b', '#d8db8a', '#fff35c'], bio: 'Stores charge in shoulder sacs. Fast side dashes.',
      look: { body: { y: 30, rx: 12, ry: 10 }, head: { y: 17, rx: 7, ry: 6 }, crest: 'horns', spikes: true, arms: 'claws', eyes: 6, glow: ['sacs'] } },
    { id: 'abyssor', name: 'AB1SSOR', cat: 4, hp: 80, atk: 15, abil: ['dive', 'volley', 'charge'], col: ['#2a2d6b', '#0b0c28', '#8a8fe0', '#9d7bff'], bio: 'Deep trench hunter. Six eyes. Rarely surfaces.',
      look: { body: { y: 30, rx: 12, ry: 12 }, head: { y: 15, rx: 8, ry: 6 }, wings: true, tails: 1, arms: 'long', eyes: 6, glow: ['throat', 'core'] } },
    { id: 'knifehed', name: 'KN1FEHED', cat: 3, hp: 90, atk: 11, boss: 1, abil: ['charge'], col: ['#4a5866', '#161d25', '#a9b8c4', '#57e8ff'], bio: 'Blade-skulled. Rams ships in half. The brow plate cracks.',
      look: { body: { y: 31, rx: 13, ry: 11 }, head: { y: 18, rx: 8, ry: 6 }, crest: 'knife', arms: 'long', eyes: 2, glow: ['brow', 'core'], neck: true } },
    { id: 'otachi', name: '0TACH1', cat: 4, hp: 110, atk: 13, boss: 2, abil: ['volley', 'dive'], col: ['#3f6b3a', '#132415', '#a8d39a', '#c6ff3d'], bio: 'Winged. Acid sac in the throat. Do not let it spit.',
      look: { body: { y: 30, rx: 11, ry: 11 }, head: { y: 15, rx: 7, ry: 6 }, crest: 'fins', wings: true, tails: 1, arms: 'claws', eyes: 4, glow: ['throat'] } },
    { id: 'leatherbak', name: 'L3ATHERBAK', cat: 4, hp: 130, atk: 14, boss: 3, abil: ['emp', 'charge'], col: ['#5b4636', '#1e150f', '#b39a84', '#4fa3ff'], bio: 'Knuckle-walker. EMP organs on its back kill power.',
      look: { body: { y: 29, rx: 15, ry: 12 }, head: { y: 16, rx: 7, ry: 5 }, spikes: true, arms: 'long', eyes: 2, glow: ['sacs'] } },
    { id: 'raiju', name: 'R41JU', cat: 4, hp: 120, atk: 15, boss: 4, abil: ['dash', 'dive', 'volley'], col: ['#a8432c', '#3a1209', '#f0a080', '#ffd23f'], bio: 'Fastest K41JU on record. Split jaw. Hunts in packs.',
      look: { body: { y: 31, rx: 12, ry: 9 }, head: { y: 20, rx: 9, ry: 5 }, crest: 'frill', arms: 'claws', tails: 1, eyes: 6, glow: ['core'] } },
    { id: 'slattern', name: 'SL4TT3RN', cat: 5, hp: 160, atk: 18, boss: 5, abil: ['charge', 'volley', 'emp', 'dive'], col: ['#2b2735', '#0c0a12', '#7f7891', '#4ff0ff'], bio: 'First Category V. Three tails. Guards TH3 BR34CH.',
      look: { body: { y: 30, rx: 14, ry: 12 }, head: { y: 14, rx: 9, ry: 6 }, crest: 'horns', spikes: true, tails: 3, arms: 'long', eyes: 6, glow: ['brow', 'core'], neck: true } },
  ];
  const byId = (id) => KAIJU.find((k) => k.id === id);
  const BOSS = (s) => KAIJU.find((k) => k.boss === s);
  const BOSS_LVL = [0, 5, 8, 11, 14, 19];
  const REC = ['', '1-4', '4-7', '7-10', '10-14', '14-19'];
  const SECTOR = ['', 'SELAT STRAIT', 'NORTH CHANNEL', 'OPEN SEA', 'DEEP TRENCH', 'TH3 BR34CH'];
  const TABLES = {
    1: [['scuttle', 1, 3, 6], ['grimlurk', 2, 3, 4]],
    2: [['grimlurk', 4, 5, 3], ['mawspawn', 4, 6, 5], ['spineray', 5, 6, 2]],
    3: [['mawspawn', 7, 8, 3], ['spineray', 7, 9, 4], ['hammerjaw', 8, 9, 3]],
    4: [['hammerjaw', 10, 12, 4], ['voltusk', 10, 13, 4], ['abyssor', 12, 13, 2]],
    5: [['voltusk', 14, 16, 5], ['abyssor', 15, 17, 4]],
  };
  const THEMES = [null,
    { sky: ['#1a1838', '#6b3460', '#f0884a'], sea: ['#2c3552', '#0b1120'], wave: '#ffb27a', light: [0.72, '#ffd08a'], city: '#120f22', bridge: true },
    { sky: ['#050916', '#10203f', '#294a73'], sea: ['#12223a', '#040912'], wave: '#9fc4ff', light: [0.3, '#e8f1ff'], moon: true, stars: 1, city: '#060a14' },
    { sky: ['#252b31', '#454f57', '#6c787e'], sea: ['#2b383e', '#0d1519'], wave: '#c9d8de', rain: 70, clouds: '#1c2227', bolt: 9 },
    { sky: ['#03050a', '#0d1620', '#1b2a36'], sea: ['#0c1820', '#020509'], wave: '#7fb6d6', rain: 150, clouds: '#070b10', bolt: 4 },
    { sky: ['#10030d', '#46092b', '#bb1856'], sea: ['#290a23', '#060208'], wave: '#ff7ab8', light: [0.5, '#7ff6ff'], rift: true, stars: 1, embers: true },
  ];
  const MARSHAL = [
    'K41JU signatures in the Selat Strait, Ranger. Patrol to sharpen up, then take down KN1FEHED.',
    'KN1FEHED is down. The North Channel is open. 0TACH1 spits acid in threes. Shoot it out of the air.',
    '0TACH1 is gone. On the open sea, L3ATHERBAK carries an EMP. Hit its back sacs while it charges.',
    "L3ATHERBAK is down. R41JU hunts the Deep Trench. It's fast, so let it come to you.",
    'Only TH3 BR34CH remains. SL4TT3RN is Category V. Come home, Rangers.',
    'TH3 BR34CH is sealed. Penang owes you both. The sea still stirs, so patrol whenever you like.',
  ];
  const MAKO = {
    swipe: 'Its arm is up. Swipe to dodge!', spit: 'Acid! Shoot it down or move!', volley: 'Three globs. Find the gap!',
    charge: "It's charging. Hit the glowing spot to stop it!", dive: 'It went under. Watch the bubbles!',
    wave: 'Shockwave! Get to the green lane!', emp: 'EMP charging. Shoot the glow!', armor: 'Armour plate. Keep hitting it to crack it open!',
  };

  MAKO.guard = "It's going for the target! Hit it hard to stagger it, or shoot the acid down.";
  const PLACES = ['', 'PENANG BRIDGE', 'GEORGE TOWN', 'OIL RIG', 'TRENCH STATION', 'SEAL BEACON'];
  const MISSIONS = (s) => [
    ['patrol', 'PATROL', 'Three K41JU, one after another.'],
    ['defend', `DEFEND ${PLACES[s]}`, `Three K41JU go after ${PLACES[s]}. Stagger them, or shoot their acid down before it lands.`],
    ['escort', 'ESCORT THE FERRY', 'Keep the ferry afloat for 60 seconds. K41JU keep coming.'],
    ['twin', 'TWIN STRIKE', 'Two K41JU at once. The one in front fights; the one behind spits.'],
    ['boss', `BOSS: ${BOSS(s).name}`, `Category ${roman(BOSS(s).cat)}. ${s < 5 ? `Beat it to open ${SECTOR[s + 1]}.` : 'Seal TH3 BR34CH.'}`],
  ];
  // J4GRs: hp/dmg multipliers, charge time, gun mode, dodge window, colours, boss needed to unlock.
  const MECHS = [
    { id: 'gypsy', name: 'GYPSY R4NG3R', blurb: 'Balanced. Hold to charge one big plasma shot.', hp: 1, dmg: 1, charge: 0.75, mode: 'charge', dodge: 0.24, accent: '#4fe3ff', trim: '#d8582c', need: 0 },
    { id: 'stryka', name: 'STRYKA EUR3KA', blurb: 'Fastest. Quick charge; a full charge fires a 4-bolt salvo. Longest dodge window.', hp: 0.85, dmg: 0.95, charge: 0.45, mode: 'salvo', dodge: 0.34, accent: '#7dff9a', trim: '#e8eef2', need: 1 },
    { id: 'crimson', name: 'CR1MS0N TYPH00N', blurb: 'Three arms. Hold to fire non-stop. No charging.', hp: 0.95, dmg: 1, charge: 1, mode: 'auto', dodge: 0.24, accent: '#ff5a5a', trim: '#ffd23f', need: 2 },
    { id: 'cherno', name: 'CH3RNO ALF4', blurb: 'Heavy. +60% hull, huge shots, slow charge, short dodge window.', hp: 1.6, dmg: 1.65, charge: 1.15, mode: 'charge', dodge: 0.17, accent: '#ffb347', trim: '#8a5a2b', need: 3 },
  ];
  const mech = () => MECHS.find((m) => m.id === G.mech && G.boss >= m.need) || MECHS[0];

  // ================= save =================
  const SAVE = 'pac1f1c-r1m-v2';
  const fresh = () => ({ mech: 'gypsy', done: {}, best: 0, lvl: 1, xp: 0, salvage: 0, kits: 2, upg: { armor: 0, plasma: 0, fist: 0, blade: 0 }, boss: 0, dex: {}, sound: true, tut: 0 });
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE));
      if (s) { const g = Object.assign(fresh(), s); g.done = g.done || {}; return g; }
      const old = JSON.parse(localStorage.getItem('pac1f1c-r1m-save'));
      if (old) { const g = fresh(); for (const k of ['lvl', 'xp', 'salvage', 'kits', 'upg', 'boss', 'dex']) if (old[k] != null) g[k] = old[k]; return g; }
    } catch {}
    return null;
  }
  let G = load();
  const hadSave = !!G;
  if (!G) G = fresh();
  const save = () => { try { localStorage.setItem(SAVE, JSON.stringify(G)); } catch {} };
  const maxHp = () => Math.round((60 + 12 * G.lvl) * (1 + 0.12 * G.upg.armor) * mech().hp);
  const xpNeed = () => 10 + 12 * G.lvl;
  const atkMul = (w) => (1 + 0.12 * (G.lvl - 1)) * (1 + 0.15 * (G.upg[w] || 0));

  // ================= canvas =================
  const cv = $('#cv');
  let ctx = cv.getContext('2d');
  let W = 0, H = 0, DPR = 1, T = 0;
  function resize() {
    DPR = Math.min(2, devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  addEventListener('resize', resize); resize();

  // ================= K41JU renderer =================
  // Units: waterline at y=0, the head/crest top near y=-1, x centred. The look specs
  // use 48px-sprite coordinates, which convert as (px-24)/40 and (py-40)/40.
  const GEO = new Map();
  function geo(sp) {
    if (GEO.has(sp.id)) return GEO.get(sp.id);
    const L = sp.look, u = (v) => v / 40;
    const B = { y: u(L.body.y - 40), rx: u(L.body.rx), ry: u(L.body.ry) };
    const Hd = { y: u(L.head.y - 40), rx: u(L.head.rx), ry: u(L.head.ry) };
    const weak = [];
    for (const g of L.glow || []) {
      if (g === 'core') weak.push({ x: 0, y: B.y - 0.02, r: 0.085 });
      if (g === 'throat') weak.push({ x: 0, y: Hd.y + Hd.ry + 0.045, r: 0.065 });
      if (g === 'brow') weak.push({ x: 0, y: Hd.y - Hd.ry * 0.62, r: 0.06 });
      if (g === 'sacs') { weak.push({ x: -(B.rx - 0.1), y: B.y - B.ry + 0.1, r: 0.066 }); weak.push({ x: B.rx - 0.1, y: B.y - B.ry + 0.1, r: 0.066 }); }
    }
    const c = sp.col;
    const g = { B, Hd, weak, skin: c[0], dark: c[1], belly: c[2], glow: c[3], light: mix(c[0], '#ffffff', 0.28), deep: mix(c[1], '#000000', 0.35) };
    GEO.set(sp.id, g);
    return g;
  }
  const IDLE = { jaw: 0.1, armL: 0, armR: 0, strL: 0, strR: 0, flash: 0, mouth: 0, lean: 0, emp: 0 };

  function drawKaiju(c, K, ox, baseY, S, opts = {}) {
    const sp = K.sp, g = geo(sp), L = sp.look, a = K.anim || IDLE, t = opts.t ?? T;
    const sil = !!opts.sil, fl = a.flash > 0 && !sil;
    const F = (x) => (sil ? '#0d1626' : fl ? '#ffffff' : x);
    const LG = (y0, y1, c0, c1) => {
      if (sil || fl) return F(c0);
      const gr = c.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, c0); gr.addColorStop(1, c1); return gr;
    };
    const glowDot = (x, y, r, col, al) => {
      if (sil) return;
      const gr = c.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, rgba(col, clamp(al, 0, 1))); gr.addColorStop(1, rgba(col, 0));
      c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    };
    const sub = 1 - (K.rise ?? 1);
    const B = g.B, Hd = g.Hd, OL = 0.014;
    const shapes = [];
    const scr = (ux, uy) => ({ x: ox + ux * S, y: baseY + (uy + sub) * S });

    c.save();
    c.translate(ox, baseY); c.scale(S, S);
    c.beginPath(); c.rect(-3, -3, 6, 3.02); c.clip();
    c.translate(0, sub); c.rotate(a.lean || 0);
    c.lineJoin = 'round'; c.lineCap = 'round';
    const br = Math.sin(t * 2.1) * 0.006;

    // A tapering tube along a quadratic curve: dark rim first, then the fill.
    const tube = (p0, p1, p2, w0, w1, fill) => {
      const N = 16, P = [];
      for (let i = 0; i <= N; i++) {
        const q = i / N, u = 1 - q;
        P.push([u * u * p0[0] + 2 * u * q * p1[0] + q * q * p2[0], u * u * p0[1] + 2 * u * q * p1[1] + q * q * p2[1]]);
      }
      for (const pass of [0, 1]) {
        c.strokeStyle = pass ? fill : F(g.deep);
        for (let i = 0; i < N; i++) {
          c.lineWidth = lerp(w0, w1, (i + 0.5) / N) + (pass ? 0 : OL * 2);
          c.beginPath(); c.moveTo(P[i][0], P[i][1]); c.lineTo(P[i + 1][0], P[i + 1][1]); c.stroke();
        }
      }
    };
    // Draw a left-side part, then mirror it for the right side.
    const both = (fn) => { fn(-1); c.save(); c.scale(-1, 1); fn(1); c.restore(); };

    // --- behind the body ---
    for (let k = 0; k < (L.tails || 0); k++) {
      both((s) => {
        const sw = Math.sin(t * 1.3 + k * 1.7 + (s > 0 ? 1 : 0)) * 0.05;
        tube([-B.rx * 0.55, B.y + B.ry * 0.5], [-B.rx - 0.2 - k * 0.05, B.y + 0.1 - k * 0.1], [-0.5 + k * 0.08 + sw, B.y - 0.22 - k * 0.17], 0.12, 0.03, F(k % 2 ? g.dark : g.skin));
      });
    }
    if (L.wings) {
      both((s) => {
        const fw = Math.sin(t * 3 + (s > 0 ? 0.4 : 0)) * 0.05;
        c.beginPath();
        c.moveTo(-B.rx * 0.4, B.y - B.ry * 0.85);
        c.quadraticCurveTo(-0.45, -0.98 + fw, -0.66, -0.92 + fw);
        c.quadraticCurveTo(-0.62, -0.6 + fw * 0.6, -0.7, -0.36);
        c.quadraticCurveTo(-0.52, -0.3, -0.46, -0.12);
        c.quadraticCurveTo(-0.36, -0.2, -B.rx * 0.8, B.y);
        c.closePath();
        c.fillStyle = sil || fl ? F(g.dark) : rgba(g.dark, 0.92); c.fill();
        c.strokeStyle = F(g.deep); c.lineWidth = OL; c.stroke();
        c.strokeStyle = F(g.skin); c.lineWidth = 0.018;
        for (const [x, y] of [[-0.66, -0.92 + fw], [-0.7, -0.36], [-0.46, -0.12]]) { c.beginPath(); c.moveTo(-B.rx * 0.45, B.y - B.ry * 0.7); c.lineTo(x, y); c.stroke(); }
        if (!fl) glowDot(-0.55, -0.6, 0.06, g.glow, 0.25);
      });
    }
    if (L.crest === 'frill') {
      const fy = Hd.y + 0.02, R = 0.34;
      c.beginPath(); c.moveTo(0, fy);
      for (let i = 0; i <= 8; i++) {
        const an = -Math.PI + 0.25 + i * (Math.PI - 0.5) / 8;
        const rr = R * (i % 2 ? 0.86 : 1.05) * (1 + Math.sin(t * 2 + i) * 0.02);
        c.lineTo(Math.cos(an) * rr, fy + Math.sin(an) * rr * 0.9);
      }
      c.closePath();
      c.fillStyle = LG(fy - R, fy, mix(g.dark, g.glow, 0.35), g.dark); c.fill();
      c.strokeStyle = F(g.deep); c.lineWidth = OL; c.stroke();
      c.strokeStyle = F(g.skin); c.lineWidth = 0.014;
      for (let i = 0; i <= 8; i += 2) {
        const an = -Math.PI + 0.25 + i * (Math.PI - 0.5) / 8;
        c.beginPath(); c.moveTo(0, fy); c.lineTo(Math.cos(an) * R, fy + Math.sin(an) * R * 0.9); c.stroke();
        if (!fl) glowDot(Math.cos(an) * R * 0.75, fy + Math.sin(an) * R * 0.68, 0.03, g.glow, 0.7);
      }
    }

    // --- torso ---
    const by = B.y + br, rx = B.rx, ry = B.ry * (1 + br);
    c.beginPath();
    c.moveTo(0, by - ry);
    c.bezierCurveTo(rx * 0.75, by - ry * 1.06, rx * 1.18, by - ry * 0.62, rx * 1.06, by - ry * 0.05);
    c.bezierCurveTo(rx, by + ry * 0.6, rx * 0.62, by + ry * 1.05, 0, by + ry * 1.05);
    c.bezierCurveTo(-rx * 0.62, by + ry * 1.05, -rx, by + ry * 0.6, -rx * 1.06, by - ry * 0.05);
    c.bezierCurveTo(-rx * 1.18, by - ry * 0.62, -rx * 0.75, by - ry * 1.06, 0, by - ry);
    c.closePath();
    c.fillStyle = LG(by - ry, by + ry, g.light, g.dark); c.fill();
    c.strokeStyle = F(g.deep); c.lineWidth = OL; c.stroke();
    if (!sil && !fl) {
      c.strokeStyle = rgba(g.deep, 0.35); c.lineWidth = 0.008;
      for (let i = 0; i < 4; i++) for (let j = -2; j <= 2; j++) {
        if (Math.abs(j) < 1 && i > 0) continue;
        c.beginPath(); c.arc(j * rx * 0.36, by - ry * 0.75 + i * ry * 0.22, rx * 0.12, 0.3, Math.PI - 0.3); c.stroke();
      }
      for (let j = 0; j < 5; j++) {
        const y = by - ry * 0.18 + j * ry * 0.21, w = rx * 0.5 * (1 - j * 0.09);
        c.beginPath(); c.ellipse(0, y, w, ry * 0.085, 0, 0, TAU);
        c.fillStyle = rgba(g.belly, 0.55 - j * 0.06); c.fill();
        c.strokeStyle = rgba(g.deep, 0.5); c.lineWidth = 0.007; c.stroke();
      }
      c.save(); c.globalCompositeOperation = 'lighter';
      c.strokeStyle = rgba(g.glow, 0.12); c.lineWidth = 0.02;
      c.beginPath(); c.arc(0, by, rx * 1.02, -2.6, -0.54); c.stroke(); c.restore();
    }
    shapes.push({ t: 'body', ...scr(0, by), rx: rx * 1.05 * S, ry: ry * 1.05 * S });
    if (L.spikes) {
      both(() => {
        for (let i = 0; i < 4; i++) {
          const x = -rx * (0.95 - i * 0.18), y = by - ry * (0.62 + i * 0.12);
          c.beginPath(); c.moveTo(x - 0.035, y + 0.02); c.lineTo(x - 0.01, y - 0.1 - i * 0.012); c.lineTo(x + 0.035, y + 0.01); c.closePath();
          c.fillStyle = F(g.deep); c.fill();
        }
      });
    }

    // --- arms ---
    const type = L.arms || 'short';
    const ARM = { long: [0.3, 0.32, 0.1, 0.082, 'fist'], claws: [0.24, 0.24, 0.078, 0.066, 'pincer'], short: [0.15, 0.16, 0.06, 0.05, 'talon'] }[type];
    const DEF = { long: [2.05, 1.62], claws: [2.45, 1.15], short: [2.0, 1.0] }[type];
    both((s) => {
      const raise = s < 0 ? a.armL : a.armR, strike = s < 0 ? a.strL : a.strR;
      const sw = Math.sin(t * 1.5 + (s > 0 ? 1.3 : 0)) * 0.08;
      const a1 = lerp(lerp(DEF[0] + sw, 4.1, raise), 0.85, strike);
      const a2 = lerp(lerp(DEF[1] + sw * 1.3, 4.55, raise), 0.4, strike);
      const sx = -rx * 0.88, sy = by - ry * 0.42;
      const ex = sx + Math.cos(a1) * ARM[0], ey = sy + Math.sin(a1) * ARM[0];
      const hx = ex + Math.cos(a2) * ARM[1], hy = ey + Math.sin(a2) * ARM[1];
      tube([sx, sy], [(sx + ex) / 2, (sy + ey) / 2], [ex, ey], ARM[2], ARM[2] * 0.85, LG(sy - 0.1, ey + 0.1, g.skin, g.dark));
      tube([ex, ey], [(ex + hx) / 2, (ey + hy) / 2], [hx, hy], ARM[2] * 0.85, ARM[3], LG(ey - 0.1, hy + 0.1, g.skin, g.dark));
      if (ARM[4] === 'fist') {
        c.beginPath(); c.arc(hx, hy, 0.075, 0, TAU); c.fillStyle = F(g.deep); c.fill();
        c.beginPath(); c.arc(hx, hy, 0.062, 0, TAU); c.fillStyle = LG(hy - 0.06, hy + 0.06, g.skin, g.dark); c.fill();
        c.strokeStyle = F(g.deep); c.lineWidth = 0.012;
        for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(hx + i * 0.03, hy + 0.04); c.lineTo(hx + i * 0.035, hy + 0.09); c.stroke(); }
      } else if (ARM[4] === 'pincer') {
        for (const o of [-0.55, 0.55]) {
          const an = a2 + o;
          c.beginPath(); c.moveTo(hx, hy);
          c.quadraticCurveTo(hx + Math.cos(an) * 0.1, hy + Math.sin(an) * 0.1, hx + Math.cos(a2 + o * 0.2) * 0.15, hy + Math.sin(a2 + o * 0.2) * 0.15);
          c.lineWidth = 0.045; c.strokeStyle = F(g.deep); c.stroke(); c.lineWidth = 0.028; c.strokeStyle = F(g.light); c.stroke();
        }
      } else {
        c.strokeStyle = F(g.deep); c.lineWidth = 0.02;
        for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(hx, hy); c.quadraticCurveTo(hx + i * 0.04, hy + 0.05, hx + i * 0.05 + 0.02, hy + 0.08); c.stroke(); }
      }
      const hs = scr(s < 0 ? hx : -hx, hy);
      shapes.push({ t: 'arm', x: hs.x, y: hs.y, rx: 0.09 * S, ry: 0.09 * S });
    });

    // --- neck + head ---
    const hy0 = Hd.y + Math.sin(t * 1.7) * 0.008, hrx = Hd.rx, hry = Hd.ry;
    if (L.neck) {
      c.beginPath(); c.ellipse(0, (hy0 + by - ry) / 2 + 0.03, hrx * 0.62, (by - ry - hy0) / 2 + 0.06, 0, 0, TAU);
      c.fillStyle = LG(hy0, by - ry, g.skin, g.dark); c.fill(); c.strokeStyle = F(g.deep); c.lineWidth = OL; c.stroke();
    }
    const my = hy0 + hry * 0.25, mw = hrx * 0.78, drop = a.jaw * hry * 0.95;
    c.beginPath(); c.moveTo(-mw, my);
    c.quadraticCurveTo(-mw * 0.95, my + hry * 0.75 + drop, 0, my + hry * 0.85 + drop);
    c.quadraticCurveTo(mw * 0.95, my + hry * 0.75 + drop, mw, my); c.closePath();
    c.fillStyle = LG(my, my + hry + drop, g.skin, g.deep); c.fill(); c.strokeStyle = F(g.deep); c.lineWidth = OL; c.stroke();
    if (drop > 0.01) {
      c.beginPath(); c.ellipse(0, my + drop * 0.5, mw * 0.82, drop * 0.55 + 0.004, 0, 0, TAU);
      c.fillStyle = F('#1a0509'); c.fill();
      if (a.mouth > 0.05 && !fl) glowDot(0, my + drop * 0.5, mw * (0.7 + a.mouth * 0.5), g.glow, 0.35 + a.mouth * 0.6);
      c.fillStyle = F('#f2ead8');
      for (let i = -3; i <= 3; i++) {
        const x = i * mw * 0.24;
        c.beginPath(); c.moveTo(x - 0.016, my + drop + 0.004); c.lineTo(x, my + drop - 0.045); c.lineTo(x + 0.016, my + drop + 0.004); c.fill();
      }
    }
    c.beginPath(); c.moveTo(-mw, my);
    c.bezierCurveTo(-hrx * 1.12, my - hry * 0.45, -hrx * 0.92, hy0 - hry * 1.05, 0, hy0 - hry * 1.12);
    c.bezierCurveTo(hrx * 0.92, hy0 - hry * 1.05, hrx * 1.12, my - hry * 0.45, mw, my);
    c.quadraticCurveTo(0, my + hry * 0.14, -mw, my); c.closePath();
    c.fillStyle = LG(hy0 - hry, my, g.light, g.skin); c.fill(); c.strokeStyle = F(g.deep); c.lineWidth = OL; c.stroke();
    c.fillStyle = F('#f2ead8');
    for (let i = -3; i <= 3; i++) {
      const x = i * mw * 0.25, y = my + hry * 0.12 * (1 - Math.abs(i) / 4);
      c.beginPath(); c.moveTo(x - 0.017, y - 0.006); c.lineTo(x, y + 0.05); c.lineTo(x + 0.017, y - 0.006); c.fill();
    }
    shapes.push({ t: 'head', ...scr(0, hy0), rx: hrx * 1.05 * S, ry: hry * 1.25 * S });
    c.strokeStyle = F(g.deep); c.lineWidth = 0.02;
    both(() => { c.beginPath(); c.moveTo(-hrx * 0.85, hy0 - hry * 0.25); c.quadraticCurveTo(-hrx * 0.45, hy0 - hry * 0.62, -0.02, hy0 - hry * 0.4); c.stroke(); });

    if (L.crest === 'knife') {
      c.beginPath(); c.moveTo(-0.075, hy0 - hry * 0.7); c.quadraticCurveTo(-0.05, -0.78, 0, -1.0); c.quadraticCurveTo(0.06, -0.8, 0.075, hy0 - hry * 0.7); c.closePath();
      if (!sil && !fl) { const gr = c.createLinearGradient(-0.07, 0, 0.07, 0); gr.addColorStop(0, '#e7f1f8'); gr.addColorStop(0.5, g.light); gr.addColorStop(1, g.dark); c.fillStyle = gr; } else c.fillStyle = F('#fff');
      c.fill(); c.strokeStyle = F(g.deep); c.lineWidth = OL; c.stroke();
      if (!sil && !fl) { c.strokeStyle = rgba(g.glow, 0.6); c.lineWidth = 0.008; c.beginPath(); c.moveTo(-0.03, hy0 - hry * 0.8); c.quadraticCurveTo(-0.025, -0.8, 0, -0.97); c.stroke(); }
    } else if (L.crest === 'horns') {
      both(() => tube([-hrx * 0.55, hy0 - hry * 0.75], [-hrx - 0.16, hy0 - hry * 0.6], [-hrx - 0.08, hy0 - hry - 0.28], 0.07, 0.012, LG(hy0 - hry - 0.3, hy0, '#e9e2cf', g.dark)));
    } else if (L.crest === 'fins') {
      both(() => {
        c.beginPath(); c.moveTo(-hrx * 0.9, hy0 - hry * 0.4); c.quadraticCurveTo(-hrx - 0.18, hy0 - hry * 1.1, -hrx - 0.24, hy0 - hry * 0.9);
        c.quadraticCurveTo(-hrx - 0.12, hy0 + hry * 0.1, -hrx * 0.9, hy0 + hry * 0.25); c.closePath();
        c.fillStyle = sil || fl ? F(g.dark) : rgba(g.dark, 0.95); c.fill(); c.strokeStyle = F(g.deep); c.lineWidth = OL; c.stroke();
        c.strokeStyle = F(g.skin); c.lineWidth = 0.008;
        for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-hrx * 0.95, hy0 - hry * 0.2 + i * 0.03); c.lineTo(-hrx - 0.2 + i * 0.03, hy0 - hry * 0.8 + i * 0.06); c.stroke(); }
      });
    }

    const ey = hy0 - hry * 0.12;
    const eyes = [[hrx * 0.46, ey], [hrx * 0.74, ey - hry * 0.3], [hrx * 0.2, ey - hry * 0.48]].slice(0, (L.eyes || 2) / 2);
    both(() => {
      for (const [x, y] of eyes) {
        if (!fl) glowDot(-x, y, 0.06, g.glow, 0.5);
        c.save(); c.translate(-x, y); c.rotate(0.38);
        c.beginPath(); c.ellipse(0, 0, 0.034, 0.014, 0, 0, TAU); c.fillStyle = sil ? '#0d1626' : fl ? '#fff' : g.glow; c.fill();
        c.fillStyle = F('#08080c'); c.fillRect(-0.004, -0.012, 0.008, 0.024);
        c.restore();
      }
    });

    // weak points: glowing organs under hex armour plates that crack as they take hits
    (K.weak || g.weak).forEach((w, i) => {
      const pulse = 0.65 + 0.35 * Math.sin(t * 5 + i * 1.3);
      const broken = !!w.broken, ar = w.armorMax ? w.armor / w.armorMax : 1, eb = a.emp || 0;
      if (!sil) {
        if (!fl) glowDot(w.x, w.y, w.r * (broken ? 2.4 : 1.6) * (1 + eb * 0.6), g.glow, (broken ? 0.75 : 0.45) * pulse + eb * 0.3);
        c.beginPath(); c.arc(w.x, w.y, w.r * 0.62, 0, TAU);
        if (fl) c.fillStyle = '#fff';
        else { const gr = c.createRadialGradient(w.x, w.y, 0, w.x, w.y, w.r * 0.62); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, g.glow); c.fillStyle = gr; }
        c.fill();
      }
      if (!broken) {
        c.beginPath();
        for (let k = 0; k < 6; k++) { const an = k / 6 * TAU + Math.PI / 6; c.lineTo(w.x + Math.cos(an) * w.r * 1.08, w.y + Math.sin(an) * w.r * 1.08); }
        c.closePath();
        c.fillStyle = LG(w.y - w.r, w.y + w.r, mix(g.dark, '#8899aa', 0.35), g.deep); c.fill();
        c.strokeStyle = F(g.deep); c.lineWidth = 0.01; c.stroke();
        if (!sil && !fl) {
          c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 0.006;
          c.beginPath(); c.moveTo(w.x - w.r * 0.5, w.y - w.r * 0.6); c.lineTo(w.x + w.r * 0.4, w.y - w.r * 0.75); c.stroke();
          const cracks = Math.floor((1 - ar) * 5);
          c.strokeStyle = rgba(g.glow, 0.95); c.lineWidth = 0.008;
          for (let k = 0; k < cracks; k++) {
            const an = k * 2.4 + i;
            c.beginPath(); c.moveTo(w.x, w.y);
            c.lineTo(w.x + Math.cos(an) * w.r * 0.5, w.y + Math.sin(an) * w.r * 0.45);
            c.lineTo(w.x + Math.cos(an + 0.4) * w.r, w.y + Math.sin(an + 0.4) * w.r * 0.95); c.stroke();
          }
        }
      }
      const s = scr(w.x, w.y);
      shapes.unshift({ t: 'weak', i, x: s.x, y: s.y, r: w.r * 1.15 * S });
    });
    K.mouthAt = scr(0, my + drop * 0.5);
    c.restore();

    if (!sil && (K.rise ?? 1) > 0.02 && !opts.noFoam) {
      c.save();
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.6 + i / 3) % 1;
        c.strokeStyle = `rgba(230,245,255,${0.35 * (1 - k)})`; c.lineWidth = 1.5;
        c.beginPath(); c.ellipse(ox, baseY + 2, B.rx * S * (1.1 + k * 0.9), B.rx * S * (0.08 + k * 0.08), 0, 0, TAU); c.stroke();
      }
      c.fillStyle = 'rgba(235,248,255,.55)';
      c.beginPath(); c.ellipse(ox, baseY + 1, B.rx * S * 1.12, Math.max(2, 0.025 * S), 0, 0, TAU); c.fill();
      c.restore();
    }
    return shapes;
  }

  // ================= world rendering =================
  const SEEDED = (n, f) => Array.from({ length: n }, (_, i) => f(i, ((Math.sin(i * 91.7) * 43758.5453) % 1 + 1) % 1, ((Math.sin(i * 12.9 + 4) * 9631.21) % 1 + 1) % 1));
  const BUILDINGS = SEEDED(46, (i, r1, r2) => ({ x: i / 46 * 1.6 - 0.3 + r1 * 0.02, w: 0.012 + r2 * 0.03, h: 0.02 + r1 * r1 * 0.09, lit: SEEDED(6, (j, a) => [a, (a * 7.3) % 1, (r1 + a) % 1 > 0.45]) }));
  const STARS = SEEDED(90, (i, a, b) => [a, b * b, 0.4 + a * 0.6]);
  const CLOUDS = SEEDED(9, (i, a, b) => [a * 1.6 - 0.3, 0.05 + b * 0.5, 0.12 + a * 0.18]);
  const env = { rain: [], embers: [], bolt: 0, boltPts: null, flash: 0, nextBolt: 4 };

  function drawScene(sec, t, camX, hy, dt) {
    const th = THEMES[sec];
    let gr = ctx.createLinearGradient(0, 0, 0, hy);
    th.sky.forEach((col, i) => gr.addColorStop(i / (th.sky.length - 1), col));
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, hy + 2);
    const px = (k) => -camX * W * k;
    if (th.stars) for (const [x, y, s] of STARS) {
      ctx.fillStyle = `rgba(255,255,255,${s * (0.55 + 0.45 * Math.sin(t * 2 + x * 40))})`;
      ctx.fillRect(((x * W * 1.2 + px(0.01)) % (W * 1.2) + W * 1.2) % (W * 1.2) - W * 0.1, y * hy * 0.9, 1.5, 1.5);
    }
    if (th.light) {
      const lx = W * th.light[0] + px(0.02), ly = th.moon ? hy * 0.28 : hy * 0.92, R = th.moon ? hy * 0.09 : hy * 0.22;
      const g2 = ctx.createRadialGradient(lx, ly, 0, lx, ly, R * 4);
      g2.addColorStop(0, rgba(th.light[1], 0.55)); g2.addColorStop(1, rgba(th.light[1], 0));
      ctx.fillStyle = g2; ctx.fillRect(lx - R * 4, ly - R * 4, R * 8, R * 8);
      if (!th.rift) { ctx.fillStyle = rgba(th.light[1], 0.95); ctx.beginPath(); ctx.arc(lx, ly, R * (th.moon ? 1 : 0.55), 0, TAU); ctx.fill(); }
    }
    if (th.rift) {
      const rx = W * 0.5 + px(0.05);
      for (let i = 0; i < 3; i++) {
        const wob = Math.sin(t * 3 + i) * 6, w = (34 - i * 10) * (1 + Math.sin(t * 7 + i) * 0.08);
        const g3 = ctx.createLinearGradient(rx - w, 0, rx + w, 0);
        g3.addColorStop(0, 'rgba(127,246,255,0)'); g3.addColorStop(0.5, i === 2 ? 'rgba(255,255,255,.95)' : 'rgba(127,246,255,.45)'); g3.addColorStop(1, 'rgba(127,246,255,0)');
        ctx.fillStyle = g3;
        ctx.beginPath(); ctx.moveTo(rx - w * 0.2 + wob, 0); ctx.lineTo(rx + w * 0.2 + wob, 0); ctx.lineTo(rx + w, hy); ctx.lineTo(rx - w, hy); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255,120,200,.35)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath(); let x = rx, y = hy * 0.15 + i * hy * 0.12; ctx.moveTo(x, y);
        for (let k = 0; k < 5; k++) { x += (i % 2 ? 1 : -1) * (20 + k * 12); y += Math.sin(i * 3 + k) * 12; ctx.lineTo(x, y); }
        ctx.stroke();
      }
    }
    if (th.clouds) for (const [x, y, s] of CLOUDS) {
      const cx = ((x * W + t * 8 + px(0.03)) % (W * 1.6) + W * 1.6) % (W * 1.6) - W * 0.3, cy = y * hy, r = s * W;
      const g4 = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g4.addColorStop(0, rgba(th.clouds, 0.85)); g4.addColorStop(1, rgba(th.clouds, 0));
      ctx.fillStyle = g4; ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.35, 0, 0, TAU); ctx.fill();
    }
    if (th.bolt && dt) {
      env.nextBolt -= dt;
      if (env.nextBolt <= 0) {
        env.nextBolt = rnd(th.bolt * 0.5, th.bolt * 1.5); env.bolt = 0.22; env.flash = 0.5;
        let x = rnd(0.1, 0.9) * W, y = 0; env.boltPts = [[x, y]];
        while (y < hy) { x += rnd(-30, 30); y += rnd(14, 34); env.boltPts.push([x, y]); }
        sfx.thunder();
      }
    }
    if (env.bolt > 0 && env.boltPts) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const [w, a2] of [[8, 0.15], [3, 0.5], [1.2, 1]]) {
        ctx.strokeStyle = `rgba(210,230,255,${a2 * env.bolt / 0.22})`; ctx.lineWidth = w;
        ctx.beginPath(); env.boltPts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      }
      ctx.restore();
    }
    if (th.city) {
      for (const b of BUILDINGS) {
        const x = b.x * W + px(0.06), w = b.w * W, h = b.h * H;
        if (x + w < 0 || x > W) continue;
        ctx.fillStyle = th.city; ctx.fillRect(x, hy - h, w + 1, h + 1);
        ctx.fillStyle = 'rgba(255,214,140,.75)';
        for (const [lx, ly, on] of b.lit) if (on) ctx.fillRect(x + lx * w * 0.8, hy - h + ly * h * 0.85 + 1, 1.6, 1.6);
      }
    }
    if (th.bridge) {
      const ox = px(0.08), dy = hy - H * 0.022;
      ctx.strokeStyle = th.city; ctx.fillStyle = th.city;
      ctx.fillRect(ox - W * 0.3, dy, W * 1.8, 3);
      for (const tx of [0.32, 0.68]) {
        const x = ox + tx * W, top = dy - H * 0.07;
        ctx.fillStyle = th.city; ctx.fillRect(x - 2, top, 4, dy - top + 3);
        ctx.lineWidth = 1;
        for (let k = 1; k <= 6; k++) { ctx.beginPath(); ctx.moveTo(x, top + 2); ctx.lineTo(x - k * W * 0.022, dy); ctx.moveTo(x, top + 2); ctx.lineTo(x + k * W * 0.022, dy); ctx.stroke(); }
        ctx.fillStyle = Math.sin(t * 3 + tx * 9) > 0 ? '#ff4040' : '#601010'; ctx.fillRect(x - 1.5, top - 3, 3, 3);
      }
      ctx.fillStyle = 'rgba(255,230,170,.8)';
      for (let i = 0; i < 40; i++) ctx.fillRect(ox - W * 0.3 + i * W * 0.045, dy - 1, 1.5, 1.5);
    }
    gr = ctx.createLinearGradient(0, hy, 0, H);
    gr.addColorStop(0, th.sea[0]); gr.addColorStop(1, th.sea[1]);
    ctx.fillStyle = gr; ctx.fillRect(0, hy, W, H - hy);
    if (th.light) {
      const lx = W * th.light[0] + px(0.02);
      for (let i = 0; i < 26; i++) {
        const f = i / 26, y = hy + (H - hy) * f * f, w = (10 + f * 90) * (0.5 + 0.5 * Math.sin(t * 3 + i * 1.7));
        ctx.fillStyle = rgba(th.light[1], 0.35 * (1 - f));
        ctx.fillRect(lx - w / 2 + Math.sin(t + i) * 6 * f, y, w, 1 + f * 2);
      }
    }
    for (let i = 1; i <= 24; i++) {
      const f = i / 24, y = hy + (H - hy) * f * f, amp = 0.6 + f * 7, wl = 0.012 / (0.25 + f);
      ctx.strokeStyle = rgba(th.wave, 0.05 + f * 0.16); ctx.lineWidth = 0.6 + f * 1.8;
      ctx.beginPath();
      for (let x = -10; x <= W + 20; x += 18) {
        const yy = y + Math.sin((x + camX * W * 0.4 * f) * wl + t * (0.8 + f) + i * 1.3) * amp;
        x === -10 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    gr = ctx.createLinearGradient(0, hy - H * 0.05, 0, hy + H * 0.06);
    gr.addColorStop(0, rgba(th.sky[2], 0)); gr.addColorStop(0.5, rgba(th.sky[2], 0.45)); gr.addColorStop(1, rgba(th.sky[2], 0));
    ctx.fillStyle = gr; ctx.fillRect(0, hy - H * 0.05, W, H * 0.11);
  }
  function drawWeather(sec, dt) {
    const th = THEMES[sec];
    if (th.rain) {
      while (env.rain.length < th.rain) env.rain.push([Math.random() * W, Math.random() * H, rnd(0.6, 1)]);
      env.rain.length = th.rain;
      ctx.strokeStyle = 'rgba(200,220,240,.32)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (const d of env.rain) {
        d[1] += 900 * d[2] * dt; d[0] -= 160 * d[2] * dt;
        if (d[1] > H) { d[1] = -20; d[0] = Math.random() * W * 1.2; }
        ctx.moveTo(d[0], d[1]); ctx.lineTo(d[0] + 6 * d[2], d[1] - 22 * d[2]);
      }
      ctx.stroke();
    }
    if (th.embers) {
      while (env.embers.length < 50) env.embers.push([Math.random() * W, H + Math.random() * H, rnd(20, 60)]);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,140,90,.6)';
      for (const e of env.embers) {
        e[1] -= e[2] * dt; e[0] += Math.sin(T * 2 + e[2]) * 12 * dt;
        if (e[1] < -10) { e[1] = H + 10; e[0] = Math.random() * W; }
        ctx.fillRect(e[0], e[1], 2, 2);
      }
      ctx.restore();
    }
    env.bolt = Math.max(0, env.bolt - dt);
    if (env.flash > 0) { ctx.fillStyle = `rgba(220,235,255,${env.flash * 0.35})`; ctx.fillRect(0, 0, W, H); env.flash = Math.max(0, env.flash - dt * 2.5); }
  }

  // ================= audio =================
  const AU = { c: null, on: G.sound !== false, song: null, step: 0, next: 0, hum: null };
  const NOTE = (n) => { const m = /^([A-G])(#?)(\d)$/.exec(n); return 440 * 2 ** (({ C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1]] + (m[2] ? 1 : 0) + (+m[3] - 4) * 12) / 12); };
  function audioInit() {
    if (AU.c) { if (AU.c.state === 'suspended') AU.c.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    const c = AU.c = new C();
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
    AU.master = c.createGain(); AU.master.gain.value = AU.on ? 0.55 : 0;
    AU.master.connect(comp); comp.connect(c.destination);
    AU.mus = c.createGain(); AU.mus.gain.value = 0.5; AU.mus.connect(AU.master);
    const n = c.createBuffer(1, c.sampleRate, c.sampleRate), d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    AU.noise = n;
    setInterval(sched, 25);
  }
  function tone({ type = 'sine', f, t, dur, vol = 0.3, slide, attack = 0.004, filter, q = 1, out }) {
    const c = AU.c, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (filter) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = filter; fl.Q.value = q; o.connect(fl); fl.connect(g); } else o.connect(g);
    g.connect(out || AU.master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise({ t, dur, vol = 0.3, type = 'bandpass', f = 1000, q = 1, slide, out }) {
    const c = AU.c, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = AU.noise; fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (slide) fl.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(out || AU.master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  const kick = (t, v, out) => tone({ type: 'sine', f: 150, slide: 38, t, dur: 0.28, vol: v, out });
  const snare = (t, out) => { noise({ t, dur: 0.18, vol: 0.32, f: 1900, q: 0.7, out }); tone({ type: 'triangle', f: 190, t, dur: 0.1, vol: 0.18, out }); };
  const hat = (t, v, out) => noise({ t, dur: 0.035, vol: v, type: 'highpass', f: 7500, out });
  const SONGS = {
    menu: { bpm: 84, style: 'menu', chords: [['A1', 'm'], ['F1', 'M'], ['C2', 'M'], ['G1', 'M']] },
    battle: { bpm: 148, style: 'battle', chords: [['A1', 'm'], ['A1', 'm'], ['F1', 'M'], ['G1', 'M']],
      bass: [1, 0, 1, 2, 0, 1, 1, 0, 1, 0, 1, 2, 0, 1, 2, 1], kickP: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0], snareP: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      lead: [0, 0, 3, 0, 2, 0, 0, 1, 0, 0, 3, 0, 4, 0, 2, 0] },
    boss: { bpm: 164, style: 'boss', chords: [['D2', 'm'], ['A#1', 'M'], ['C2', 'M'], ['A1', 'M']],
      bass: [1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 2, 1, 2, 1, 2, 2], kickP: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0], snareP: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
      lead: [3, 0, 2, 0, 1, 0, 2, 0, 3, 0, 4, 0, 3, 2, 1, 0] },
  };
  function playStep(s, i, t, st) {
    const bar = Math.floor(i / 16) % s.chords.length, k = i % 16, [root, q] = s.chords[bar], f0 = NOTE(root);
    const iv = q === 'm' ? [0, 3, 7, 12, 15] : [0, 4, 7, 12, 16], out = AU.mus;
    if (s.style === 'menu') {
      if (k === 0) { [0, 1, 2].forEach((x) => tone({ type: 'triangle', f: f0 * 4 * 2 ** (iv[x] / 12), t, dur: st * 16, vol: 0.06, attack: 0.6, out })); tone({ type: 'sawtooth', f: f0 * 2, t, dur: st * 16, vol: 0.06, attack: 0.3, filter: 380, out }); }
      if (k % 2 === 0) tone({ type: 'square', f: f0 * 8 * 2 ** (iv[(k / 2) % 4] / 12), t, dur: st * 2, vol: 0.022, filter: 2000, out });
      if (k === 0 || k === 10) kick(t, 0.35, out);
      if (k === 4 || k === 12) hat(t, 0.04, out);
      return;
    }
    if (s.bass[k]) tone({ type: 'sawtooth', f: f0 * 2 * s.bass[k], t, dur: st * 0.95, vol: 0.15, filter: s.style === 'boss' ? 1100 : 800, q: 6, out });
    tone({ type: 'square', f: f0 * 8 * 2 ** (iv[(k + bar) % 4] / 12), t, dur: st * 0.7, vol: 0.022, filter: 3000, out });
    if (s.lead[k]) tone({ type: 'sawtooth', f: f0 * 8 * 2 ** (iv[s.lead[k]] / 12), t, dur: st * 1.8, vol: 0.05, filter: 2400, q: 3, out });
    if (s.kickP[k]) kick(t, 0.85, out);
    if (s.snareP[k]) snare(t, out);
    if (k % 2 === 1) hat(t, k % 4 === 3 ? 0.07 : 0.04, out);
  }
  function sched() {
    if (!AU.c || !AU.song || !AU.on) return;
    const s = SONGS[AU.song], st = 60 / s.bpm / 4;
    if (AU.next < AU.c.currentTime) AU.next = AU.c.currentTime + 0.03;
    while (AU.next < AU.c.currentTime + 0.12) { playStep(s, AU.step, AU.next, st); AU.next += st; AU.step++; }
  }
  function music(name) { if (AU.song === name) return; AU.song = name; AU.step = 0; if (AU.c) AU.next = AU.c.currentTime + 0.08; }
  function setSound(on) { AU.on = on; G.sound = on; save(); if (AU.master) AU.master.gain.value = on ? 0.55 : 0; }
  const play = (fn) => { if (AU.c && AU.on) fn(AU.c.currentTime); };
  const sfx = {
    ui: () => play((t) => tone({ type: 'square', f: 880, t, dur: 0.06, vol: 0.06, slide: 1320 })),
    shot: (c) => play((t) => { tone({ type: 'sawtooth', f: 900 + c * 300, slide: 120, t, dur: 0.16 + c * 0.25, vol: 0.12 + c * 0.1, filter: 3000 }); noise({ t, dur: 0.1 + c * 0.25, vol: 0.12 + c * 0.25, f: 2500, slide: 300 }); if (c >= 1) kick(t, 0.5); }),
    hit: () => play((t) => { noise({ t, dur: 0.12, vol: 0.3, f: 900 }); tone({ type: 'triangle', f: 160, slide: 70, t, dur: 0.12, vol: 0.2 }); }),
    crit: () => play((t) => { noise({ t, dur: 0.25, vol: 0.4, f: 1800 }); tone({ type: 'square', f: 1400, slide: 2600, t, dur: 0.12, vol: 0.08 }); kick(t, 0.6); }),
    clank: () => play((t) => { tone({ type: 'square', f: 1800, slide: 900, t, dur: 0.08, vol: 0.06 }); noise({ t, dur: 0.06, vol: 0.2, type: 'highpass', f: 4000 }); }),
    armor: () => play((t) => { noise({ t, dur: 0.5, vol: 0.5, f: 1200, slide: 200 }); tone({ type: 'sawtooth', f: 300, slide: 60, t, dur: 0.4, vol: 0.15 }); }),
    fist: () => play((t) => { noise({ t, dur: 0.45, vol: 0.35, f: 500, slide: 1500 }); tone({ type: 'sawtooth', f: 90, slide: 200, t, dur: 0.3, vol: 0.12 }); }),
    boom: () => play((t) => { kick(t, 1); noise({ t, dur: 0.7, vol: 0.5, f: 300, slide: 80 }); }),
    blade: () => play((t) => { noise({ t, dur: 0.25, vol: 0.45, type: 'highpass', f: 2500, slide: 8000 }); tone({ type: 'sawtooth', f: 600, slide: 1500, t, dur: 0.2, vol: 0.06 }); }),
    dodge: () => play((t) => noise({ t, dur: 0.22, vol: 0.25, f: 600, slide: 2400, q: 0.6 })),
    perfect: () => play((t) => [0, 4, 7, 12].forEach((x, i) => tone({ type: 'triangle', f: 660 * 2 ** (x / 12), t: t + i * 0.04, dur: 0.2, vol: 0.12 }))),
    hurt: () => play((t) => { kick(t, 1); noise({ t, dur: 0.5, vol: 0.55, f: 220, slide: 60 }); tone({ type: 'sawtooth', f: 110, slide: 40, t, dur: 0.4, vol: 0.15 }); }),
    roar: () => play((t) => { noise({ t, dur: 1.2, vol: 0.45, f: 260, q: 2, slide: 120 }); tone({ type: 'sawtooth', f: 85, slide: 48, t, dur: 1.2, vol: 0.2, filter: 600 }); tone({ type: 'sawtooth', f: 128, slide: 70, t, dur: 1.0, vol: 0.12, filter: 500 }); }),
    growl: () => play((t) => { noise({ t, dur: 0.5, vol: 0.25, f: 200, q: 3 }); tone({ type: 'sawtooth', f: 70, t, dur: 0.5, vol: 0.12, filter: 400 }); }),
    gurgle: () => play((t) => { for (let i = 0; i < 5; i++) tone({ type: 'sine', f: rnd(200, 500), slide: rnd(500, 900), t: t + i * 0.08, dur: 0.07, vol: 0.12 }); }),
    spit: () => play((t) => noise({ t, dur: 0.3, vol: 0.3, f: 1500, slide: 400, q: 2 })),
    splash: () => play((t) => noise({ t, dur: 0.6, vol: 0.35, f: 900, slide: 300, q: 0.5 })),
    slam: () => play((t) => { kick(t, 1); noise({ t, dur: 1.0, vol: 0.5, f: 400, slide: 100 }); }),
    emp: () => play((t) => tone({ type: 'sawtooth', f: 60, slide: 3000, t, dur: 0.8, vol: 0.18, filter: 4000 })),
    empCharge: () => play((t) => tone({ type: 'square', f: 200, slide: 1200, t, dur: 1.6, vol: 0.05, filter: 1500 })),
    denied: () => play((t) => tone({ type: 'square', f: 140, t, dur: 0.15, vol: 0.12 })),
    heal: () => play((t) => [0, 4, 7, 12].forEach((x, i) => tone({ type: 'sine', f: 520 * 2 ** (x / 12), t: t + i * 0.06, dur: 0.25, vol: 0.12 }))),
    level: () => play((t) => [0, 4, 7, 12, 16, 19, 24].forEach((x, i) => tone({ type: 'square', f: 440 * 2 ** (x / 12), t: t + i * 0.06, dur: 0.2, vol: 0.06, filter: 3000 }))),
    od: () => play((t) => { tone({ type: 'sawtooth', f: 110, slide: 880, t, dur: 0.6, vol: 0.15, filter: 3000 }); kick(t, 1); }),
    death: () => play((t) => { noise({ t, dur: 2.2, vol: 0.5, f: 300, slide: 60, q: 2 }); tone({ type: 'sawtooth', f: 120, slide: 30, t, dur: 2.0, vol: 0.2, filter: 700 }); }),
    win: () => play((t) => [0, 7, 12, 16, 19, 24].forEach((x, i) => tone({ type: 'square', f: 392 * 2 ** (x / 12), t: t + i * 0.1, dur: 0.35, vol: 0.07, filter: 3200 }))),
    lose: () => play((t) => [0, -1, -3, -5].forEach((x, i) => tone({ type: 'triangle', f: 330 * 2 ** (x / 12), t: t + i * 0.25, dur: 0.5, vol: 0.18 }))),
    thunder: () => play((t) => noise({ t: t + 0.15, dur: 1.6, vol: 0.4, f: 120, slide: 50, q: 0.5 })),
  };
  function humStart() {
    if (!AU.c || !AU.on) return;
    humStop();
    const c = AU.c, t = c.currentTime, o = c.createOscillator(), fl = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(90, t); o.frequency.linearRampToValueAtTime(420, t + 0.75);
    fl.type = 'lowpass'; fl.frequency.setValueAtTime(600, t); fl.frequency.linearRampToValueAtTime(2600, t + 0.75);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 0.1);
    o.connect(fl); fl.connect(g); g.connect(AU.master); o.start();
    AU.hum = { o, g };
  }
  function humStop() {
    if (!AU.hum) return;
    const { o, g } = AU.hum, t = AU.c.currentTime;
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.stop(t + 0.08); AU.hum = null;
  }
  const vib = (p) => { try { navigator.vibrate?.(p); } catch {} };

  // ================= DOM helpers =================
  const screens = ['title', 'map', 'missions', 'hangar', 'dex', 'result', 'pause'];
  let mode = 'title', prevMode = 'title';
  function show(id) {
    for (const s of screens) $('#' + s).classList.toggle('show', s === id);
    $('#hud').classList.toggle('show', id === 'battle' || id === 'pause');
  }
  let toastT = 0, subT = 0;
  function toast(s, dur = 1.1, warn = false) { const e = $('#toast'); e.textContent = s; e.classList.add('on'); e.classList.toggle('warn', warn); toastT = dur; }
  function sub(s, who = 'MAK0', dur = 2.6) { const e = $('#sub'); e.innerHTML = `<b>${who}</b>${s}`; e.classList.add('on'); subT = dur; }

  // ================= battle =================
  let B = null;
  const laneW = (p) => W * 0.3 * (0.5 + 0.5 * p);
  const laneX = (x, p) => W / 2 + (x - B.camX) * laneW(p);
  const horizon = () => H * 0.42;
  const baseYAt = (p) => { const hy = horizon(); return hy + (H * 0.9 - hy) * Math.pow(p, 1.3); };
  const sizeAt = (p) => H * (0.2 + 0.62 * p);

  const rowPick = (sec) => weighted(TABLES[sec].map((row) => [row, row[3]]));
  const one = (sec, bump = 0) => { const r = rowPick(sec); return { sp: byId(r[0]), lvl: irnd(r[1], r[2]) + bump }; };
  const maxSec = () => clamp(G.boss + 1, 1, 5);
  const endlessSec = (n) => 1 + (Math.floor((n - 1) / 5) % maxSec());
  function endlessWave(n) {
    const s = endlessSec(n), lvl = Math.max(1, Math.round(1 + n * 0.85));
    if (n % 5 === 0) return [{ sp: BOSS(irnd(1, maxSec())), lvl: lvl + 2 }];
    const w = [{ sp: byId(rowPick(s)[0]), lvl }];
    if (n % 3 === 0) { w[0].lvl = Math.max(1, lvl - 1); w.push({ sp: byId(rowPick(s)[0]), lvl: Math.max(1, lvl - 1) }); }
    return w;
  }
  let uidN = 0;
  const front = () => B.Ks.filter((k) => !k.done).sort((a, b) => (a.st === 'dying') - (b.st === 'dying') || b.p - a.p)[0] || null;

  function startMission(sec, type) {
    audioInit();
    let waves;
    if (type === 'boss') waves = [[{ sp: BOSS(sec), lvl: BOSS_LVL[sec] }]];
    else if (type === 'twin') waves = sec >= 2 ? [[one(sec), one(sec)], [one(sec), one(sec, 1)]] : [[one(sec), one(sec)]];
    else if (type === 'endless') { sec = endlessSec(1); waves = [endlessWave(1)]; }
    else if (type === 'escort') waves = [[one(sec)]];
    else waves = [0, 1, 2].map((i) => [one(sec, i === 2 ? 1 : 0)]);
    const M = mech();
    B = {
      sec, type, waves, wi: 0, xp: 0, sal: 0, kills: 0, hp: maxHp(), lane: 0, camX: 0, roll: 0, iframe: 0, lastDodge: -9, M,
      aim: { x: W * 0.5, y: H * 0.42 }, charging: false, charge: 0, cdShot: 0, cdFist: 0, cdBlade: 0, drift: 50, desync: 0, emp: 0,
      od: 0, odT: 0, proj: [], shock: [], parts: [], nums: [], beams: [], fists: [], gshots: [], slashT: 0, recoil: 0, fistOut: 0,
      sel: slotOpen(G.sel || 0) ? G.sel || 0 : 0, stepCd: 0, hitstop: 0, slow: 0, shake: 0, hurtT: 0, t: 0, phase: 'fight', phaseT: 0, K: null, Ks: [], said: {}, muzzle: { x: W * 0.8, y: H * 0.8 }, fistTip: { x: W * 0.2, y: H * 0.8 },
      endless: type === 'endless',
      guard: type === 'defend' ? { name: PLACES[sec], hp: 100, max: 100, flash: 0 } : type === 'escort' ? { name: 'FERRY', hp: 100, max: 100, flash: 0, ferry: true } : null,
      escort: type === 'escort' ? { t: 0, dur: 60 } : null,
    };
    mode = 'battle'; show('battle');
    music(type === 'boss' || type === 'endless' ? 'boss' : 'battle');
    spawnWave();
    $('#keys').classList.toggle('hide', !!G.keysHidden);
    $('#guard').style.display = B.guard ? '' : 'none';
    if (!G.tut) { $('#coach').classList.add('show'); B.coach = 8; }
    const bs = BOSS(sec);
    const lines = {
      boss: [`${bs.name}. Category ${roman(bs.cat)}. This is it, Ranger.`, 'MARSHAL ST4CK'],
      defend: [`Hold the line at ${PLACES[sec]}. Don't let them reach it.`, 'MARSHAL ST4CK'],
      escort: ['Ferry is crossing. Keep it afloat for 60 seconds.', 'MARSHAL ST4CK'],
      twin: ['Two signatures. The front one fights, the back one spits.', 'MAK0'],
      endless: ["Endless waves. Let's see how long we last.", 'MAK0'],
      patrol: [`Patrolling ${SECTOR[sec]}. Three contacts inbound.`, 'MAK0'],
    }[type];
    sub(lines[0], lines[1], 3);
  }
  function makeKaiju(sp, lvl) {
    const boss = !!sp.boss, hpMax = Math.round(sp.hp * (1 + 0.28 * (lvl - 1)) * (boss ? 1.6 : 1.25));
    return {
      uid: ++uidN, off: 0, sp, lvl, boss, hp: hpMax, hpMax, atk: sp.atk * (1 + 0.12 * (lvl - 1)), x: rnd(-0.5, 0.5), p: 0.4, st: 'emerge', t: 1.3, t0: 1.3, rise: 0,
      target: 0, side: -1, cd: 0.6, empCd: 5, empHit: 0, enraged: false, dmgWin: 0, dmgWinT: 0,
      anim: { ...IDLE }, weak: geo(sp).weak.map((w) => ({ ...w, armorMax: hpMax * 0.12, armor: hpMax * 0.12, broken: false })),
      shapes: [], hidden: false, mouthAt: { x: W / 2, y: H * 0.4 },
    };
  }
  function spawnWave() {
    const w = B.waves[B.wi];
    B.Ks = w.map((e, i) => {
      const K = makeKaiju(e.sp, e.lvl);
      if (w.length > 1) { K.off = i ? 0.9 : -0.9; K.x = K.off; K.p = i ? 0.34 : 0.44; }
      G.dex[e.sp.id] = Math.max(G.dex[e.sp.id] || 0, 1);
      return K;
    });
    B.K = front();
    sfx.roar(); sfx.splash(); B.shake = 0.4;
    for (const K of B.Ks) for (let i = 0; i < 30; i++) splashPart(laneX(K.x, K.p), baseYAt(K.p), sizeAt(K.p));
  }
  function waveLabel() {
    if (B.endless) return `WAVE ${B.wi + 1} · BEST ${G.best}`;
    if (B.escort) return `FERRY ${Math.max(0, Math.ceil(B.escort.dur - B.escort.t))}s`;
    if (B.type === 'boss') return 'BOSS';
    return `${B.type === 'defend' ? 'WAVE' : 'CONTACT'} ${B.wi + 1}/${B.waves.length}`;
  }
  // Where the defended landmark or the ferry sits on screen.
  function guardPos() {
    const hy = horizon();
    if (B.guard.ferry) return { x: lerp(W * 0.08, W * 0.92, B.escort.t / B.escort.dur) - B.camX * W * 0.05, y: hy + H * 0.03 };
    return { x: W * 0.2 - B.camX * W * 0.05, y: hy + H * 0.005 };
  }
  function gshotPos(g) {
    const k = clamp(g.t / g.dur, 0, 1), gp = guardPos();
    return { x: lerp(g.x0, gp.x, k), y: lerp(g.y0, gp.y, k) - Math.sin(k * Math.PI) * H * 0.18, r: 10 - k * 4, k };
  }

  // ---- particles ----
  function part(o) { if (B.parts.length < 400) B.parts.push(o); }
  function sparks(x, y, col, n) { for (let i = 0; i < n; i++) { const a = rnd(0, TAU), s = rnd(80, 420); part({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, g: 500, life: rnd(0.2, 0.5), max: 0.5, size: rnd(1.5, 3.5), col, add: true }); } }
  function shards(x, y, col, n) { for (let i = 0; i < n; i++) { const a = rnd(-Math.PI, 0), s = rnd(120, 380); part({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 900, life: rnd(0.5, 1), max: 1, size: rnd(3, 7), col, rot: rnd(0, 6), vr: rnd(-12, 12), shard: true }); } }
  function splashPart(x, y, s) { const a = rnd(-Math.PI * 0.95, -Math.PI * 0.05), v = rnd(100, 420) * (s / H + 0.3); part({ x: x + rnd(-s * 0.25, s * 0.25), y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 1.4, g: 700, life: rnd(0.5, 1.1), max: 1.1, size: rnd(2, 5), col: '#d8f0ff' }); }
  function boom(x, y, r, col = '#ffb347') { part({ x, y, vx: 0, vy: 0, g: 0, life: 0.35, max: 0.35, size: r, col, ring: true }); sparks(x, y, col, 16); }
  function num(x, y, v, crit, hurt) { B.nums.push({ x: x + rnd(-10, 10), y, txt: String(v), life: 0.9, crit, hurt }); }

  // ---- player actions ----
  const canAct = () => mode === 'battle' && B && B.phase === 'fight' && B.desync <= 0;
  function dodge(dir) {
    if (!canAct()) return;
    const nl = clamp(B.lane + dir, -1, 1);
    if (nl === B.lane) { B.shake = Math.max(B.shake, 0.08); return; }
    B.lane = nl; B.iframe = B.M.dodge; B.lastDodge = B.t; B.roll = dir; sfx.dodge(); vib(10);
    B.didDodge = true;
  }
  function startCharge() { if (!canAct()) return; B.charging = true; B.charge = 0; if (B.M.mode !== 'auto') humStart(); }
  function release() {
    if (!B || !B.charging) return;
    B.charging = false; humStop();
    if (!canAct()) return;
    if (B.emp > 0) { toast('WEAPONS OFFLINE', 0.8, true); sfx.denied(); return; }
    if (B.M.mode === 'auto') return;
    if (B.cdShot > 0) return;
    const dmg = (5 + 15 * Math.pow(B.charge, 1.2)) * atkMul('plasma') * B.M.dmg;
    if (B.M.mode === 'salvo' && B.charge >= 1) {
      for (let i = 0; i < 4; i++) setTimeout(() => { if (B && B.phase === 'fight') firePlasma(0.6, { x: B.aim.x + rnd(-14, 14), y: B.aim.y + rnd(-14, 14) }, dmg * 0.42); }, i * 70);
    } else firePlasma(B.charge, { ...B.aim }, dmg);
    B.didFire = true;
  }
  function firePlasma(c, at, dmg) {
    B.cdShot = 0.09; B.recoil = 0.5 + c * 0.7;
    const full = c >= 1;
    B.beams.push({ x0: B.muzzle.x, y0: B.muzzle.y, x1: at.x, y1: at.y, life: 0.13, max: 0.13, w: 2 + c * 7 });
    sfx.shot(c);
    for (const p of B.proj) {
      if (p.t < 0 || p.dead) continue;
      const s = projScreen(p);
      if (Math.hypot(s.x - at.x, s.y - at.y) < s.r + 14) {
        p.dead = true; boom(s.x, s.y, s.r * 1.5, '#c6ff3d'); toast('ACID SHOT DOWN', 0.6);
        B.drift = Math.min(100, B.drift + 5); return;
      }
    }
    for (const gs of B.gshots) {
      const s = gshotPos(gs);
      if (!gs.dead && Math.hypot(s.x - at.x, s.y - at.y) < s.r + 16) { gs.dead = true; boom(s.x, s.y, 30, '#c6ff3d'); toast('ACID SHOT DOWN', 0.6); B.drift = Math.min(100, B.drift + 5); return; }
    }
    const h = hitAt(at.x, at.y);
    if (h) hitKaiju(h, dmg, full ? 'pierce' : 'plasma', at);
    else if (B.K && at.y > baseYAt(B.K.p) - 4) for (let i = 0; i < 6; i++) splashPart(at.x, at.y, 40);
  }
  function hitAt(x, y) {
    const list = B.Ks.filter((K) => !K.hidden && K.st !== 'dying' && K.rise >= 0.5).sort((a, b) => b.p - a.p);
    for (const K of list) {
      for (const s of K.shapes) if (s.t === 'weak' && Math.hypot(x - s.x, y - s.y) <= s.r * 1.3 + 4) return { ...s, K };
      for (const s of K.shapes) if (s.t !== 'weak') { const dx = (x - s.x) / s.rx, dy = (y - s.y) / s.ry; if (dx * dx + dy * dy <= 1) return { ...s, K }; }
    }
    return null;
  }
  function hitKaiju(h, dmg, kind, at) {
    const K = h && h.K;
    if (!K || K.st === 'dying') return;
    let mult = 1, crit = false;
    if (h.t === 'weak') {
      const w = K.weak[h.i];
      if (!w.broken) {
        w.armor -= dmg * (kind === 'pierce' || kind === 'fist' || kind === 'blade' ? 2 : 1);
        mult = 0.6; sfx.clank(); shards(at.x, at.y, '#8899aa', 3);
        if (!B.said.armor) { B.said.armor = 1; sub(MAKO.armor); }
        if (w.armor <= 0) { w.broken = true; toast('ARMOUR BROKEN!'); sfx.armor(); shards(h.x, h.y, '#9aa8b8', 18); B.hitstop = 0.07; vib(25); }
      } else { mult = 2.5; crit = true; }
      if (K.st === 'windEmp') K.empHit += dmg * mult;
    } else if (h.t === 'head') mult = 1.15;
    const d = Math.max(1, Math.round(dmg * mult));
    K.hp -= d; K.anim.flash = 0.07; K.dmgWin += d; K.dmgWinT = 1.2;
    num(at.x, at.y - 10, d, crit);
    sparks(at.x, at.y, crit ? '#ffb347' : '#bfefff', crit ? 18 : 8);
    B.drift = Math.min(100, B.drift + (crit ? 8 : 3));
    if (crit) { sfx.crit(); B.hitstop = Math.max(B.hitstop, 0.04); } else sfx.hit();
    const heavy = kind === 'fist' || kind === 'blade' || K.dmgWin >= K.hpMax * (K.boss ? 0.2 : 0.15);
    if (heavy && K.hp > 0 && !['dying', 'emerge', 'dive', 'under', 'surface'].includes(K.st)) {
      stagger(K, kind === 'fist' ? 1.1 : 0.85); K.dmgWin = 0;
      if (kind === 'fist') K.p = Math.max(0.36, K.p - 0.2);
    }
    if (!K.enraged && K.hp > 0 && K.hp < K.hpMax * (K.boss ? 0.5 : 0.35)) {
      K.enraged = true;
      if (K.boss) { toast(`${K.sp.name} IS ENRAGED!`, 1.4, true); sfx.roar(); B.shake = 0.5; }
    }
    if (K.hp <= 0) killKaiju(K);
  }
  function stagger(K, t) { K.st = 'stagger'; K.t = K.boss ? t * 0.7 : t; K.anim.armL = K.anim.armR = K.anim.strL = K.anim.strR = 0; K.anim.mouth = 0; }
  function useFist() {
    if (G.lvl < 3) { toast('ROCKET FIST UNLOCKS AT LV 3', 1); return; }
    if (!canAct() || B.cdFist > 0) return;
    if (B.emp > 0) { toast('WEAPONS OFFLINE', 0.8, true); sfx.denied(); return; }
    B.cdFist = 4; B.fistOut = 1;
    B.fists.push({ x0: B.fistTip.x, y0: B.fistTip.y, x1: B.aim.x, y1: B.aim.y, t: 0, dur: 0.28 });
    sfx.fist(); vib(15);
  }
  const finisherReady = () => B && B.K && G.lvl >= 6 && B.K.st === 'stagger' && B.K.hp < B.K.hpMax * 0.18 && B.K.p >= 0.66;
  function useBlade() {
    if (G.lvl < 6) { toast('CHAIN BLADE UNLOCKS AT LV 6', 1); return; }
    if (!canAct() || B.cdBlade > 0) return;
    if (B.emp > 0) { toast('WEAPONS OFFLINE', 0.8, true); sfx.denied(); return; }
    const K = B.K;
    B.slashT = 0.32; B.cdBlade = 1.5; sfx.blade();
    if (!K || K.hidden || K.p < 0.66 || K.st === 'dying') { toast('TOO FAR. LET IT CLOSE IN', 0.9); return; }
    if (finisherReady()) {
      B.slow = 1.0; toast('FINISHER!', 1.4); B.sal += 5 + K.lvl; G.salvage += 5 + K.lvl;
      sparks(W / 2, H * 0.4, '#fff07a', 40); killKaiju(K); return;
    }
    const body = K.shapes.find((s) => s.t === 'body'), h = hitAt(B.aim.x, B.aim.y) || (body && { ...body, K });
    if (h) hitKaiju(h, 40 * atkMul('blade'), 'blade', h.t === 'weak' ? { ...B.aim } : { x: h.x, y: h.y });
  }
  function useOd() {
    if (!canAct() || B.drift < 100) return;
    B.od = 3; B.odT = 0; B.drift = 30; toast('OVERDRIVE!', 1.2); sfx.od(); vib(40);
  }
  function useKit() {
    if (!canAct() || G.kits <= 0 || B.hp >= maxHp()) return;
    G.kits--; B.hp = Math.min(maxHp(), B.hp + maxHp() * 0.4); sfx.heal(); toast('HULL REPAIRED', 0.8); save();
  }

  // ---- weapon slots (keyboard 1-4, Q = previous, ENTER fires the selected one) ----
  const SLOTS = [['PLASMA CANNON', 1], ['ROCKET FIST', 3], ['CHAIN BLADE', 6], ['OVERDRIVE', 1]];
  const slotOpen = (i) => G.lvl >= SLOTS[i][1];
  function selectSlot(i) {
    if (!B) return;
    if (!slotOpen(i)) { toast(`${SLOTS[i][0]} UNLOCKS AT LV ${SLOTS[i][1]}`, 1); sfx.denied(); return; }
    if (B.sel !== i) { B.sel = i; G.sel = i; sfx.ui(); }
  }
  function prevSlot() {
    if (!B) return;
    for (let k = 1; k <= 4; k++) { const i = (B.sel - k + 4) % 4; if (slotOpen(i)) return selectSlot(i); }
  }
  function fireDown() {
    if (!B) return;
    if (B.sel === 0) startCharge();
    else if (B.sel === 1) useFist();
    else if (B.sel === 2) useBlade();
    else if (B.drift >= 100) useOd();
    else { toast('DR1FT NOT FULL YET', 0.8); sfx.denied(); }
  }
  function fireUp() { if (B && B.sel === 0) release(); }
  // W/S: step toward or away from the K41JU.
  function step(dir) {
    const K = B && B.K;
    if (!canAct() || !K || K.hidden || B.stepCd > 0 || ['dying', 'charge', 'emerge', 'surface'].includes(K.st)) return;
    const np = clamp(K.p + dir * 0.14, 0.38, 0.92);
    if (np === K.p) return;
    K.p = np; B.stepCd = 0.35; B.shake = Math.max(B.shake, 0.12); sfx.dodge();
    toast(dir > 0 ? 'STEP IN' : 'STEP BACK', 0.4);
  }

  // ---- K41JU AI ----
  function kThink(K) {
    const sf = (1 + 0.07 * K.sp.cat) * (K.enraged ? 1.3 : 1), ab = K.sp.abil || [], close = K.p > 0.72, opts = [];
    const lead = K === B.K;
    if (!lead && B.Ks.some((o) => o !== K && o.st.startsWith('wind'))) { K.cd = 0.5; return; }
    if (lead) opts.push(close ? ['swipe', 5] : ['approach', 3]);
    else opts.push(K.p > 0.5 ? ['retreat', 2] : ['approach', 1]);
    opts.push(['spit', close ? 1.5 : 3]);
    if (B.guard) opts.push(['guard', lead ? 2.5 : 3]);
    if (ab.includes('volley')) opts.push(['volley', 2]);
    if (lead && ab.includes('charge') && K.p < 0.66) opts.push(['charge', 3]);
    if (ab.includes('dash')) opts.push(['dash', 2]);
    if (lead && ab.includes('dive')) opts.push(['dive', 1.3]);
    if (ab.includes('emp') && K.empCd <= 0) opts.push(['emp', 3]);
    if (K.boss && K.enraged) opts.push(['wave', 2.5]);
    if (lead && close) opts.push(['retreat', 1]);
    const st = weighted(opts), tw = (s) => s / sf;
    const say = (k) => { if (!B.said[k]) { B.said[k] = 1; sub(MAKO[k]); } };
    switch (st) {
      case 'swipe': K.st = 'windSwipe'; K.t = K.t0 = tw(0.78); K.target = B.lane; K.side = K.target < K.x - 0.15 ? -1 : K.target > K.x + 0.15 ? 1 : Math.random() < 0.5 ? -1 : 1; sfx.growl(); say('swipe'); break;
      case 'approach': K.st = 'approach'; K.t = rnd(0.6, 1.2); break;
      case 'retreat': K.st = 'retreat'; K.t = 0.8; break;
      case 'spit': K.st = 'windSpit'; K.t = K.t0 = tw(0.62); sfx.gurgle(); say('spit'); break;
      case 'volley': K.st = 'windVolley'; K.t = K.t0 = tw(0.85); sfx.gurgle(); say('volley'); break;
      case 'charge': K.st = 'windCharge'; K.t = K.t0 = tw(0.85); K.target = B.lane; sfx.roar(); say('charge'); break;
      case 'dash': K.st = 'dash'; K.t = 0.32; K.dashTo = clamp(K.x + (Math.random() < 0.5 ? -1 : 1) * rnd(0.8, 1.4), -1.2, 1.2); sfx.splash(); break;
      case 'dive': K.st = 'dive'; sfx.splash(); say('dive'); break;
      case 'emp': K.st = 'windEmp'; K.t = K.t0 = 1.8; K.empCd = 10; K.empHit = 0; sfx.empCharge(); toast('EMP CHARGING!', 1.2, true); say('emp'); break;
      case 'guard': K.st = 'windGuard'; K.t = K.t0 = tw(1.6); toast(`IT'S GOING FOR THE ${B.guard.name}!`, 1.3, true); sfx.gurgle(); say('guard'); break;
      case 'wave': K.st = 'windWave'; K.t = K.t0 = tw(0.95); K.safe = irnd(-1, 1); sfx.roar(); say('wave'); break;
    }
  }
  function kUpdate(K, d) {
    const a = K.anim, sf = (1 + 0.07 * K.sp.cat) * (K.enraged ? 1.3 : 1);
    K.t -= d; a.flash = Math.max(0, a.flash - d); K.empCd -= d; K.dmgWinT -= d;
    if (K.dmgWinT <= 0) K.dmgWin = 0;
    const relax = (k) => {
      k = Math.min(1, k);
      for (const n of ['armL', 'armR', 'strL', 'strR', 'mouth', 'lean', 'emp']) a[n] = lerp(a[n], 0, k);
      a.jaw = lerp(a.jaw, 0.1 + 0.06 * Math.sin(B.t * 2), k);
    };
    const lead = K === B.K;
    const track = (k) => { K.x += (clamp(B.lane * 0.85 + K.off * (lead ? 0.3 : 1), -1.3, 1.3) - K.x) * k * d; };
    const splashAt = () => splashPart(laneX(K.x, K.p), baseYAt(K.p), sizeAt(K.p));
    switch (K.st) {
      case 'emerge': K.rise = Math.min(1, K.rise + d / 1.1); a.jaw = lerp(a.jaw, 0.9, d * 4); if (K.t <= 0) { K.st = 'idle'; K.cd = 0.4; } break;
      case 'idle': relax(d * 6); track(1.1); K.x += Math.sin(B.t * 1.3) * 0.15 * d; K.cd -= d; if (K.cd <= 0) kThink(K); break;
      case 'approach': relax(d * 6); track(1.4); K.p = Math.min(lead ? 0.9 : 0.5, K.p + 0.4 * sf * d); if (K.t <= 0 || K.p >= (lead ? 0.9 : 0.5)) { K.st = 'idle'; K.cd = rnd(0.15, 0.45) / sf; } break;
      case 'retreat': relax(d * 6); K.p = Math.max(0.38, K.p - 0.45 * d); if (K.t <= 0) { K.st = 'idle'; K.cd = rnd(0.3, 0.6) / sf; } break;
      case 'windSwipe': {
        const k = 1 - K.t / K.t0;
        if (K.side < 0) a.armL = Math.max(a.armL, k); else a.armR = Math.max(a.armR, k);
        a.jaw = lerp(a.jaw, 0.6, d * 5); a.lean = -0.05 * k; K.x += (K.target * 0.75 - K.x) * 2 * d;
        if (K.t <= 0) { K.st = 'swipe'; K.t = K.t0 = 0.15; sfx.blade(); }
        break;
      }
      case 'swipe': {
        const k = 1 - K.t / K.t0;
        if (K.side < 0) { a.armL = 1; a.strL = k; } else { a.armR = 1; a.strR = k; }
        if (K.t <= 0) { resolve(K.target, K.atk * (K.chargeHit ? 2 : 1.6), 'CLAW'); K.chargeHit = false; K.st = 'recover'; K.t = 0.45; }
        break;
      }
      case 'recover': relax(d * 4); if (K.t <= 0) { K.st = K.p > 0.8 && Math.random() < 0.5 ? 'retreat' : 'idle'; K.t = 0.7; K.cd = rnd(0.25, 0.6) / sf; } break;
      case 'windSpit': a.jaw = lerp(a.jaw, 1, d * 5); a.mouth = Math.min(1, a.mouth + d / K.t0); if (K.t <= 0) { spit(K, [B.lane]); K.st = 'recover'; K.t = 0.35; } break;
      case 'windVolley': a.jaw = lerp(a.jaw, 1, d * 5); a.mouth = Math.min(1, a.mouth + d / K.t0); if (K.t <= 0) { const safe = irnd(-1, 1); spit(K, [-1, 0, 1].filter((l) => l !== safe)); K.st = 'recover'; K.t = 0.5; } break;
      case 'windCharge': a.jaw = lerp(a.jaw, 1, d * 4); a.lean = lerp(a.lean, -0.08, d * 4); a.armL = a.armR = lerp(a.armL, 0.5, d * 4); if (K.t <= 0) { K.st = 'charge'; K.t = 0.7; K.p0 = K.p; } break;
      case 'charge':
        K.x += (K.target - K.x) * 5 * d; K.p = Math.min(0.95, K.p + (0.95 - K.p0) / 0.7 * d); a.lean = 0.08;
        if (Math.random() < 0.6) splashAt();
        if (K.t <= 0) { K.st = 'windSwipe'; K.t = K.t0 = 0.26; K.side = Math.random() < 0.5 ? -1 : 1; K.chargeHit = true; }
        break;
      case 'dash': K.x += (K.dashTo - K.x) * 9 * d; if (Math.random() < 0.5) splashAt(); if (K.t <= 0) { K.st = 'windSpit'; K.t = K.t0 = 0.45 / sf; } break;
      case 'dive': K.rise = Math.max(0, K.rise - d / 0.35); if (K.rise <= 0) { K.hidden = true; K.st = 'under'; K.t = 1.0; K.target = B.lane; } break;
      case 'under':
        K.x += (B.lane - K.x) * 2.5 * d; K.p = lerp(K.p, 0.86, d * 2);
        if (Math.random() < 0.5) part({ x: laneX(K.x, K.p) + rnd(-30, 30), y: baseYAt(K.p), vx: 0, vy: -rnd(20, 60), g: 0, life: 0.6, max: 0.6, size: rnd(3, 7), col: '#d8f0ff', bubble: true });
        if (K.t <= 0) { K.hidden = false; K.p = 0.86; K.target = B.lane; K.st = 'surface'; K.t = 0.35; sfx.splash(); for (let i = 0; i < 40; i++) splashAt(); }
        break;
      case 'surface': K.rise = Math.min(1, K.rise + d / 0.3); a.jaw = lerp(a.jaw, 1, d * 6); if (K.t <= 0) { K.st = 'windSwipe'; K.t = K.t0 = 0.5 / sf; K.target = B.lane; K.side = Math.random() < 0.5 ? -1 : 1; } break;
      case 'windEmp':
        a.emp = Math.min(1, a.emp + d); a.lean = -0.04;
        if (K.empHit >= K.hpMax * 0.08) { toast('EMP CANCELLED!'); sfx.perfect(); stagger(K, 1.2); break; }
        if (K.t <= 0) { B.emp = 2.6; B.charging = false; humStop(); sfx.emp(); toast('EMP! WEAPONS OFFLINE', 1.3, true); vib(60); K.st = 'recover'; K.t = 0.5; }
        break;
      case 'windWave': {
        const k = 1 - K.t / K.t0; a.armL = a.armR = k; a.jaw = lerp(a.jaw, 1, d * 4);
        if (K.t <= 0) { a.strL = a.strR = 1; B.shock.push({ p0: K.p, t: 0, dur: 1.05, safe: K.safe, dmg: K.atk * 1.4 }); sfx.slam(); B.shake = 0.45; K.st = 'recover'; K.t = 0.7; }
        break;
      }
      case 'windGuard':
        a.jaw = lerp(a.jaw, 1, d * 4); a.mouth = Math.min(1, a.mouth + d / K.t0); a.lean = lerp(a.lean, -0.06, d * 3);
        if (K.t <= 0) { B.gshots.push({ x0: K.mouthAt.x, y0: K.mouthAt.y, t: 0, dur: 0.75, dmg: 9 + 3 * K.sp.cat, col: geo(K.sp).glow }); sfx.spit(); K.st = 'recover'; K.t = 0.4; }
        break;
      case 'stagger': a.lean = lerp(a.lean, 0.12, d * 6); a.jaw = lerp(a.jaw, 0.75, d * 5); if (K.t <= 0) { K.st = 'idle'; K.cd = 0.3; } break;
      case 'dying':
        K.rise = Math.max(0, K.rise - d / 1.8); a.jaw = lerp(a.jaw, 1, d * 3); a.lean = lerp(a.lean, 0.25, d);
        if (Math.random() < 0.35) { const s = K.shapes[Math.floor(Math.random() * K.shapes.length)]; if (s) boom(s.x + rnd(-20, 20), s.y + rnd(-20, 20), rnd(20, 50)); }
        if (K.rise <= 0 && !K.done) { K.done = true; onKaijuGone(K); }
        break;
    }
    K.x = clamp(K.x, -1.3, 1.3);
  }
  function spit(K, lanes) {
    lanes.forEach((L, i) => B.proj.push({ x0: K.x, p0: K.p, L, t: -i * 0.16, dur: 0.95 - 0.05 * K.sp.cat, y0: K.mouthAt.y, dmg: K.atk * (lanes.length > 1 ? 0.85 : 1), col: geo(K.sp).glow }));
    sfx.spit();
  }
  function projScreen(p) {
    const k = clamp(p.t / p.dur, 0, 1), pp = lerp(p.p0, 1.05, k);
    return { x: laneX(lerp(p.x0, p.L, k), pp), y: lerp(p.y0, H * 0.6, k) - Math.sin(k * Math.PI) * H * 0.1, r: 5 + 58 * k * k, k };
  }
  function resolve(lane, dmg, what) {
    if (B.lane === lane && B.iframe <= 0) hurt(dmg, what);
    else if (B.t - B.lastDodge < 0.4) { B.slow = 0.55; B.drift = Math.min(100, B.drift + 14); toast('PERFECT DODGE!', 0.9); sfx.perfect(); B.lastDodge = -9; }
  }
  function hurt(dmg) {
    if (B.phase !== 'fight') return;
    const d = Math.round(dmg);
    B.hp -= d; B.shake = 0.4; B.hurtT = 0.45; B.drift -= 12;
    num(W / 2, H * 0.55, '-' + d, false, true);
    sfx.hurt(); vib([60, 30, 40]);
    if (B.drift <= 0) { B.drift = 35; B.desync = 1.2; B.charging = false; humStop(); toast('DR1FT LOST. RESYNCING', 1.2, true); }
    if (B.hp <= 0) { B.hp = 0; endMission(false); }
  }
  function killKaiju(K) {
    if (K.st === 'dying') return;
    K.st = 'dying'; K.hp = 0; K.anim.flash = 0.2;
    B.proj = []; B.shock = [];
    sfx.death(); B.shake = 0.7; B.hitstop = 0.1; B.slow = Math.max(B.slow, 0.7);
    const xp = Math.round((6 + 5 * K.lvl) * (K.boss ? 3 : 1)), sal = (2 + 2 * K.lvl) * (K.boss ? 3 : 1);
    B.xp += xp; B.sal += sal; B.kills++; G.salvage += sal; G.dex[K.sp.id] = 2;
    toast(`${K.sp.name} DOWN`, 1.4);
    setTimeout(() => { if (mode === 'battle') sub(`+${xp} XP   +${sal} SALVAGE`, 'SH4TT3RD0ME', 2); }, 700);
    gainXp(xp);
    save();
  }
  function gainXp(xp) {
    G.xp += xp;
    while (G.xp >= xpNeed()) {
      const before = maxHp();
      G.xp -= xpNeed(); G.lvl++;
      if (B) B.hp = Math.min(maxHp(), B.hp + (maxHp() - before) + maxHp() * 0.25);
      const lv = G.lvl;
      setTimeout(() => { toast(`LEVEL UP! LV ${lv}`, 1.6); sfx.level(); }, 1500);
      if (lv === 3) setTimeout(() => sub('ROCKET FIST is online. Tap FIST to launch it at the crosshair.', 'MAK0', 3.5), 3200);
      if (lv === 6) setTimeout(() => sub('CHAIN BLADE is online. Use it up close, or to finish a staggered K41JU.', 'MAK0', 3.5), 3200);
    }
  }
  function onKaijuGone(K) {
    B.Ks = B.Ks.filter((k) => k !== K);
    B.K = front();
    if (B.Ks.length || B.phase !== 'fight') return;
    B.wi++;
    if (B.endless) {
      B.waves.push(endlessWave(B.wi + 1)); B.sec = endlessSec(B.wi + 1);
      B.hp = Math.min(maxHp(), B.hp + maxHp() * 0.2);
    }
    if (B.escort && B.wi >= B.waves.length) B.waves.push(Math.random() < 0.25 ? [one(B.sec), one(B.sec)] : [one(B.sec)]);
    if (B.wi < B.waves.length) {
      B.phase = 'between'; B.phaseT = B.escort ? 0.8 : 1.6;
      sub(B.endless ? `Wave ${B.wi + 1}${(B.wi + 1) % 5 === 0 ? '. Boss signature!' : '.'} Hull patched 20%.` : B.escort ? 'Another one surfacing. Keep the ferry covered!' : `Next contact. ${B.wi + 1} of ${B.waves.length}.`);
    } else endMission(true);
  }
  function endMission(win) {
    if (B.phase === 'over') return;
    B.phase = 'over'; B.charging = false; humStop();
    const s = B, M = s.M;
    let extra = '';
    if (win && s.type !== 'endless') {
      G.done[`${s.sec}:${s.type}`] = 1;
      if (['defend', 'escort', 'twin'].includes(s.type)) {
        const bonus = 10 + 5 * s.sec; s.sal += bonus; G.salvage += bonus;
        extra += `<p>Mission bonus: +${bonus} salvage.</p>`;
      }
    }
    if (win && s.type === 'boss' && G.boss < s.sec) {
      G.boss = s.sec; G.kits++;
      extra += s.sec < 5 ? `<p>The buoy line to <b>${SECTOR[s.sec + 1]}</b> is down. +1 repair kit.</p>` : '<p><b>TH3 BR34CH collapses in on itself. The K41JU war is over.</b><br>Thanks for playing PAC1F1C R1M.</p>';
      const nm = MECHS.find((m) => m.need === s.sec);
      if (nm) extra += `<p><b style="color:${nm.accent}">${nm.name}</b> joins the program. Pick it in the HANGAR.</p>`;
    }
    let title;
    if (s.endless) {
      const waves = s.wi, best = waves > G.best;
      G.best = Math.max(G.best, waves);
      title = `SURVIVED ${waves} WAVE${waves === 1 ? '' : 'S'}`;
      extra = `<p>${best ? 'New best!' : `Best: ${G.best} waves.`}</p>` + extra;
    } else if (win) {
      title = { boss: `${s.waves[0][0].sp.name} DEFEATED`, defend: `${PLACES[s.sec]} HOLDS`, escort: 'FERRY SAFE', twin: 'TWIN STRIKE CLEARED', patrol: 'SECTOR CLEAR' }[s.type];
    } else title = s.guard && s.guard.hp <= 0 ? `${s.guard.name} LOST` : `${M.name} DOWN`;
    save();
    music(null);
    (win ? sfx.win : sfx.lose)();
    setTimeout(() => {
      if (mode !== 'battle' || B !== s) return;
      $('#resTitle').textContent = title;
      $('#resTitle').className = win || s.endless ? 'win' : 'lose';
      $('#resBody').innerHTML = `<p>${s.kills} K41JU neutralized &middot; +${s.xp} XP &middot; +${s.sal} salvage</p><p>Pilot LV ${G.lvl}. ${win || s.endless ? '' : 'MAK0 pulled you out. You keep what you earned.'}</p>${extra}`;
      mode = 'result'; show('result');
    }, win ? 1300 : 1600);
  }

  function battleUpdate(rdt) {
    const b = B;
    b.recoil = Math.max(0, b.recoil - rdt * 4); b.fistOut = Math.max(0, b.fistOut - rdt * 0.6);
    for (const n of b.nums) { n.life -= rdt; n.y -= 40 * rdt; }
    b.nums = b.nums.filter((n) => n.life > 0);
    for (const bm of b.beams) bm.life -= rdt;
    b.beams = b.beams.filter((bm) => bm.life > 0);
    if (b.hitstop > 0) { b.hitstop -= rdt; return; }
    const ts = b.slow > 0 ? 0.35 : b.od > 0 ? 0.75 : 1;
    b.slow = Math.max(0, b.slow - rdt);
    const d = rdt * ts;
    b.t += d;
    for (const k of ['iframe', 'cdShot', 'cdFist', 'cdBlade', 'emp', 'desync', 'shake', 'hurtT', 'slashT', 'stepCd']) b[k] = Math.max(0, b[k] - d);
    b.camX = lerp(b.camX, b.lane, Math.min(1, d * 12));
    b.roll = lerp(b.roll, 0, Math.min(1, d * 6));
    if (b.coach !== undefined) {
      b.coach -= rdt;
      if (b.coach <= 0 || (b.didDodge && b.didFire)) { $('#coach').classList.remove('show'); delete b.coach; G.tut = 1; save(); }
    }
    if (b.charging && b.M.mode === 'auto') {
      if (b.cdShot <= 0 && b.emp <= 0 && canAct()) { firePlasma(0.25, { x: b.aim.x + rnd(-5, 5), y: b.aim.y + rnd(-5, 5) }, 4.2 * atkMul('plasma') * b.M.dmg); b.cdShot = 0.1; b.didFire = true; }
    } else if (b.charging) b.charge = Math.min(1, b.charge + d / b.M.charge);
    const ak = H * 1.1 * rdt;
    if (keysHeld.ArrowLeft) b.aim.x = clamp(b.aim.x - ak, 8, W - 8);
    if (keysHeld.ArrowRight) b.aim.x = clamp(b.aim.x + ak, 8, W - 8);
    if (keysHeld.ArrowUp) b.aim.y = clamp(b.aim.y - ak, 8, H - 8);
    if (keysHeld.ArrowDown) b.aim.y = clamp(b.aim.y + ak, 8, H - 8);
    if (b.od > 0) {
      b.od -= rdt; b.odT -= rdt;
      if (b.odT <= 0 && b.K && !b.K.hidden && b.K.st !== 'dying') {
        b.odT = 0.08;
        const ws = b.K.shapes.filter((s) => s.t === 'weak'), tg = ws.length && Math.random() < 0.7 ? ws[irnd(0, ws.length - 1)] : b.K.shapes.find((s) => s.t === 'body');
        if (tg) { const at = { x: tg.x + rnd(-6, 6), y: tg.y + rnd(-6, 6) }; b.aim.x = lerp(b.aim.x, at.x, 0.5); b.aim.y = lerp(b.aim.y, at.y, 0.5); firePlasma(0.5, at, 9 * atkMul('plasma')); }
      }
    }
    for (const f of b.fists) {
      f.t += d;
      if (f.t >= f.dur && !f.done) {
        f.done = true; boom(f.x1, f.y1, 60); sfx.boom(); b.shake = 0.3;
        hitKaiju(hitAt(f.x1, f.y1), 30 * atkMul('fist'), 'fist', { x: f.x1, y: f.y1 });
      }
    }
    b.fists = b.fists.filter((f) => f.t < f.dur + 0.1);
    for (const p of b.parts) { p.life -= d; p.vy += (p.g || 0) * d; p.x += p.vx * d; p.y += p.vy * d; if (p.rot !== undefined) p.rot += p.vr * d; }
    b.parts = b.parts.filter((p) => p.life > 0);

    if (b.escort && b.phase !== 'over') { b.escort.t += d; if (b.escort.t >= b.escort.dur) { toast('FERRY HAS LANDED', 1.4); endMission(true); } }
    if (b.guard) b.guard.flash = Math.max(0, b.guard.flash - d);
    if (b.phase === 'between') { b.phaseT -= d; if (b.phaseT <= 0) { b.phase = 'fight'; spawnWave(); } return; }
    b.K = front();
    for (const K of [...b.Ks]) kUpdate(K, d);
    if (b.phase !== 'fight') return;
    for (const g of b.gshots) {
      g.t += d;
      if (g.t >= g.dur && !g.dead) {
        g.dead = true; const gp = guardPos();
        b.guard.hp = Math.max(0, b.guard.hp - g.dmg); b.guard.flash = 0.35; boom(gp.x, gp.y, 40, g.col); sfx.boom();
        toast(`${b.guard.name} HIT! ${Math.round(b.guard.hp)}%`, 0.9, true);
        if (b.guard.hp <= 0) { endMission(false); return; }
      }
    }
    b.gshots = b.gshots.filter((g) => !g.dead);
    for (const p of b.proj) {
      p.t += d;
      if (p.t >= p.dur && !p.dead) {
        p.dead = true; const s = projScreen(p);
        resolve(p.L, p.dmg, 'ACID');
        if (b.lane !== p.L) for (let i = 0; i < 8; i++) part({ x: s.x, y: s.y, vx: rnd(-200, 200), vy: rnd(-200, 50), g: 600, life: 0.5, max: 0.5, size: rnd(2, 5), col: p.col });
      }
    }
    b.proj = b.proj.filter((p) => !p.dead);
    for (const w of b.shock) {
      w.t += d;
      if (w.t >= w.dur && !w.done) { w.done = true; resolve(b.lane === w.safe ? 99 : b.lane, w.dmg, 'SHOCKWAVE'); }
    }
    b.shock = b.shock.filter((w) => !w.done);
  }

  // ---- battle drawing ----
  function drawLaneMarks(K, all) {
    if (!K) return;
    const marks = [];
    if (['windSwipe', 'swipe', 'surface', 'windCharge', 'charge'].includes(K.st)) marks.push([K.target, '#ff4d5e', 0.5]);
    if (K.st === 'windWave') for (const l of [-1, 0, 1]) marks.push([l, l === K.safe ? '#5dffa8' : '#ff4d5e', 0.45]);
    if (all) for (const w of B.shock) for (const l of [-1, 0, 1]) marks.push([l, l === w.safe ? '#5dffa8' : '#ff4d5e', 0.35]);
    if (all) for (const p of B.proj) if (p.t > 0) marks.push([p.L, '#ffd23f', 0.22]);
    const pulse = 0.6 + 0.4 * Math.sin(B.t * 18);
    for (const [l, col, al] of marks) {
      const p0 = K.hidden ? 0.8 : K.p, y0 = baseYAt(p0), y1 = H;
      const x0 = laneX(l, p0), x1 = laneX(l, 1.25), w0 = laneW(p0) * 0.42, w1 = laneW(1.25) * 0.42;
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, rgba(col, 0)); g.addColorStop(1, rgba(col, al * pulse));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x0 - w0, y0); ctx.lineTo(x0 + w0, y0); ctx.lineTo(x1 + w1, y1); ctx.lineTo(x1 - w1, y1); ctx.fill();
    }
  }
  function drawGuard() {
    const g = B.guard, { x, y } = guardPos(), k = H / 420, fl = g.flash > 0 && Math.floor(B.t * 20) % 2;
    ctx.save(); ctx.translate(x, y);
    if (g.ferry) {
      ctx.strokeStyle = 'rgba(220,240,255,.5)'; ctx.lineWidth = 1.5;
      for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(-14 * k * i, 3 * k); ctx.lineTo(-14 * k * i - 16 * k, 3 * k + i * 2 * k); ctx.stroke(); }
      ctx.fillStyle = fl ? '#fff' : '#e9eef3'; ctx.beginPath(); ctx.moveTo(-26 * k, -4 * k); ctx.lineTo(28 * k, -4 * k); ctx.lineTo(20 * k, 5 * k); ctx.lineTo(-22 * k, 5 * k); ctx.fill();
      ctx.fillStyle = '#c0392b'; ctx.fillRect(-24 * k, 1 * k, 46 * k, 2 * k);
      ctx.fillStyle = fl ? '#fff' : '#dfe6ec'; ctx.fillRect(-12 * k, -12 * k, 22 * k, 8 * k);
      ctx.fillStyle = '#35506a'; for (let i = 0; i < 4; i++) ctx.fillRect(-10 * k + i * 5 * k, -10 * k, 3 * k, 3 * k);
    } else {
      ctx.fillStyle = fl ? '#ffffff' : '#141c28';
      ctx.fillRect(-22 * k, -8 * k, 44 * k, 8 * k); ctx.fillRect(-6 * k, -58 * k, 12 * k, 50 * k); ctx.fillRect(-16 * k, -40 * k, 32 * k, 5 * k);
      ctx.beginPath(); ctx.moveTo(-6 * k, -58 * k); ctx.lineTo(0, -74 * k); ctx.lineTo(6 * k, -58 * k); ctx.fill();
      ctx.fillStyle = Math.sin(B.t * 4) > 0 ? '#ff4d5e' : '#5a1018'; ctx.beginPath(); ctx.arc(0, -75 * k, 2.5 * k, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,214,140,.85)'; for (let i = 0; i < 5; i++) ctx.fillRect(-3 * k, -52 * k + i * 9 * k, 2 * k, 2 * k);
    }
    const bw = 44 * k, top = g.ferry ? -22 * k : -88 * k;
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(-bw / 2, top, bw, 4 * k);
    ctx.fillStyle = g.hp > 40 ? '#5dffa8' : '#ff4d5e'; ctx.fillRect(-bw / 2, top, bw * g.hp / g.max, 4 * k);
    ctx.restore();
  }
  function drawGShots() {
    for (const gs of B.gshots) {
      const s = gshotPos(gs);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 2.5);
      g.addColorStop(0, rgba(gs.col, 0.95)); g.addColorStop(1, rgba(gs.col, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 2.5, 0, TAU); ctx.fill(); ctx.restore();
      ctx.fillStyle = mix(gs.col, '#ffffff', 0.5); ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.7, 0, TAU); ctx.fill();
    }
  }
  function drawShock() {
    for (const w of B.shock) {
      const k = w.t / w.dur, p = lerp(w.p0, 1.1, k), y = baseYAt(p), h = 20 + k * 120;
      for (const l of [-1, 0, 1]) {
        if (l === w.safe) continue;
        const x = laneX(l, p), hw = laneW(p) * 0.5;
        const g = ctx.createLinearGradient(0, y - h, 0, y);
        g.addColorStop(0, 'rgba(220,245,255,0)'); g.addColorStop(1, 'rgba(220,245,255,.85)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(x - hw, y);
        for (let i = 0; i <= 8; i++) ctx.lineTo(x - hw + (i / 8) * hw * 2, y - h * (0.6 + 0.4 * Math.sin(i * 1.7 + B.t * 20)));
        ctx.lineTo(x + hw, y); ctx.fill();
      }
    }
  }
  function drawProj() {
    for (const p of B.proj) {
      if (p.t < 0) continue;
      const s = projScreen(p);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 2.2);
      g.addColorStop(0, rgba(p.col, 0.9)); g.addColorStop(1, rgba(p.col, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 2.2, 0, TAU); ctx.fill(); ctx.restore();
      ctx.fillStyle = mix(p.col, '#ffffff', 0.5); ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.75, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(s.x - s.r * 0.25, s.y - s.r * 0.25, s.r * 0.22, 0, TAU); ctx.fill();
    }
  }
  function drawParts() {
    for (const p of B.parts) {
      const a = clamp(p.life / p.max, 0, 1);
      if (p.ring) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const r = p.size * (1.4 - a * 0.6), g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, `rgba(255,255,230,${a})`); g.addColorStop(0.4, rgba(p.col, a * 0.8)); g.addColorStop(1, rgba(p.col, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill(); ctx.restore();
        continue;
      }
      if (p.bubble) { ctx.strokeStyle = `rgba(220,240,255,${a * 0.8})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.stroke(); continue; }
      if (p.add) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; }
      ctx.fillStyle = rgba(p.col, a);
      if (p.shard) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + a * 0.6), 0, TAU); ctx.fill(); }
      if (p.add) ctx.restore();
    }
  }
  function metal(x0, y0, x1, y1, dark) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, dark ? '#141b25' : '#2a3442'); g.addColorStop(0.45, dark ? '#3a4656' : '#6d7d92'); g.addColorStop(0.55, dark ? '#2a3442' : '#4d5b6d'); g.addColorStop(1, '#10151d');
    return g;
  }
  function drawFist(x, y, s) {
    ctx.fillStyle = metal(x - s, y - s, x + s, y + s);
    ctx.beginPath(); ctx.rect(x - s * 0.8, y - s * 0.7, s * 1.6, s * 1.4); ctx.fill();
    ctx.strokeStyle = '#0b1018'; ctx.lineWidth = Math.max(1, s * 0.08);
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - s * 0.8 + (i + 1) * s * 0.4, y - s * 0.7); ctx.lineTo(x - s * 0.8 + (i + 1) * s * 0.4, y - s * 0.2); ctx.stroke(); }
    ctx.fillStyle = B && B.M ? B.M.trim : '#d8582c'; ctx.fillRect(x - s * 0.8, y + s * 0.3, s * 1.6, s * 0.12);
  }
  function drawBeams() {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (const bm of B.beams) {
      const a = bm.life / bm.max;
      for (const [w, col] of [[bm.w * 3, `rgba(79,227,255,${0.25 * a})`], [bm.w, `rgba(160,240,255,${0.8 * a})`], [bm.w * 0.35, `rgba(255,255,255,${a})`]]) {
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(bm.x0, bm.y0); ctx.lineTo(bm.x1, bm.y1); ctx.stroke();
      }
      const g = ctx.createRadialGradient(bm.x1, bm.y1, 0, bm.x1, bm.y1, 14 + bm.w * 3);
      g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(79,227,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bm.x1, bm.y1, 14 + bm.w * 3, 0, TAU); ctx.fill();
    }
    ctx.restore();
    for (const f of B.fists) {
      const k = clamp(f.t / f.dur, 0, 1), x = lerp(f.x0, f.x1, k), y = lerp(f.y0, f.y1, k), s = lerp(H * 0.12, H * 0.035, k);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, y + s * 0.6, 0, x, y + s * 0.6, s * 1.6);
      g.addColorStop(0, 'rgba(255,180,90,.9)'); g.addColorStop(1, 'rgba(255,90,40,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y + s * 0.6, s * 1.6, 0, TAU); ctx.fill(); ctx.restore();
      drawFist(x, y, s);
    }
  }
  function drawArms() {
    const k = H / 420, b = B, bob = Math.sin(b.t * 2.2) * 3 * k, ch = b.charging ? b.charge : 0;
    {
      const px = W * 0.97, py = H * 1.12;
      const ang = clamp(Math.atan2(b.aim.y - py, b.aim.x - px) + Math.PI / 2, -1.1, -0.15);
      const ox = px + b.recoil * 14 * k, oy = py + bob + b.recoil * 18 * k;
      ctx.save();
      ctx.translate(ox, oy); ctx.rotate(ang); ctx.scale(k, k);
      ctx.fillStyle = metal(-70, 0, 70, 0);
      ctx.beginPath(); ctx.moveTo(-70, 40); ctx.lineTo(-52, -170); ctx.lineTo(52, -170); ctx.lineTo(74, 40); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 2;
      for (const y of [-60, -120]) { ctx.beginPath(); ctx.moveTo(-62, y); ctx.lineTo(62, y); ctx.stroke(); }
      ctx.fillStyle = b.M.trim; ctx.fillRect(-58, -40, 18, 60);
      ctx.fillStyle = rgba(b.M.accent, 0.35 + ch * 0.65); ctx.fillRect(30, -150, 6, 140);
      ctx.fillStyle = metal(-34, 0, 34, 0, true);
      ctx.fillRect(-32, -250, 64, 84);
      ctx.fillStyle = '#0d131b';
      for (let i = 0; i < 4; i++) ctx.fillRect(-34, -240 + i * 20, 68, 5);
      const g = ctx.createRadialGradient(0, -252, 0, 0, -252, 34 + ch * 40);
      g.addColorStop(0, `rgba(255,255,255,${0.5 + ch * 0.5})`); g.addColorStop(0.3, rgba(b.M.accent, 0.4 + ch * 0.6)); g.addColorStop(1, rgba(b.M.accent, 0));
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -252, 34 + ch * 40, 0, TAU); ctx.fill();
      ctx.restore();
      b.muzzle = { x: ox + Math.sin(ang) * 252 * k, y: oy - Math.cos(ang) * 252 * k };
      if (b.M.id === 'crimson') {
        ctx.save(); ctx.translate(W * 0.8 + b.recoil * 8 * k, H * 1.08 + bob); ctx.rotate(ang * 0.8 - 0.1); ctx.scale(k * 0.7, k * 0.7);
        ctx.fillStyle = metal(-40, 0, 40, 0, true); ctx.fillRect(-26, -230, 52, 230);
        ctx.fillStyle = b.M.trim; ctx.fillRect(-26, -120, 52, 10);
        ctx.restore();
      }
    }
    {
      const px = W * 0.03, py = H * 1.12, slash = b.slashT > 0 ? 1 - b.slashT / 0.32 : 0;
      const ang = b.slashT > 0 ? lerp(0.2, 1.3, slash) : 0.45 - Math.sin(b.t * 1.1) * 0.03;
      ctx.save(); ctx.translate(px, py - bob); ctx.rotate(ang); ctx.scale(k, k);
      ctx.fillStyle = metal(-70, 0, 70, 0);
      ctx.beginPath(); ctx.moveTo(-74, 40); ctx.lineTo(-52, -160); ctx.lineTo(52, -160); ctx.lineTo(70, 40); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 2;
      for (const y of [-55, -110]) { ctx.beginPath(); ctx.moveTo(-60, y); ctx.lineTo(60, y); ctx.stroke(); }
      ctx.fillStyle = b.M.trim; ctx.fillRect(40, -40, 18, 60);
      ctx.fillStyle = rgba(b.M.accent, 0.45); ctx.fillRect(-36, -140, 6, 120);
      if (b.slashT > 0 && G.lvl >= 6) {
        const L = 300;
        for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 2 ? '#c9d6e3' : '#7f8fa1'; ctx.beginPath(); ctx.moveTo(-14, -170 - i * L / 12); ctx.lineTo(14, -170 - i * L / 12); ctx.lineTo(10, -170 - (i + 1) * L / 12); ctx.lineTo(-10, -170 - (i + 1) * L / 12); ctx.fill(); }
      }
      if (b.fistOut > 0.35) {
        const g = ctx.createRadialGradient(0, -170, 0, 0, -170, 40);
        g.addColorStop(0, 'rgba(255,200,120,.9)'); g.addColorStop(1, 'rgba(255,90,40,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -170, 40, 0, TAU); ctx.fill();
        ctx.restore();
      } else {
        ctx.restore(); ctx.save(); ctx.translate(px, py - bob); ctx.rotate(ang);
        drawFist(0, -205 * k, 46 * k);
        ctx.restore();
      }
      b.fistTip = { x: px + Math.sin(ang) * 205 * k, y: py - bob - Math.cos(ang) * 205 * k };
    }
    if (b.slashT > 0) {
      const k2 = 1 - b.slashT / 0.32;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(200,240,255,${1 - k2})`; ctx.lineWidth = 10 * (1 - k2) + 2;
      ctx.beginPath(); ctx.arc(W * 0.1, H * 1.2, H * 1.05, -1.45 + k2 * 0.2, -0.35 + k2 * 0.2); ctx.stroke(); ctx.restore();
    }
  }
  function drawReticle() {
    const { x, y } = B.aim, h = hitAt(x, y), ch = B.charging ? B.charge : 0;
    const col = B.emp > 0 ? '#ff4d5e' : h ? (h.t === 'weak' ? '#ffb347' : '#ffffff') : 'rgba(170,230,255,.85)';
    const r = 18 - ch * 4;
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 4;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + (h ? B.t * 2 : 0); ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * (r + 4), y + Math.sin(a) * (r + 4)); ctx.lineTo(x + Math.cos(a) * (r + 11), y + Math.sin(a) * (r + 11)); ctx.stroke(); }
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 2, 0, TAU); ctx.fill();
    if (ch > 0) { ctx.strokeStyle = ch >= 1 ? '#fff07a' : '#4fe3ff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, r + 7, -Math.PI / 2, -Math.PI / 2 + ch * TAU); ctx.stroke(); }
    if (h && h.t === 'weak') { ctx.font = '700 11px "Chakra Petch"'; ctx.fillStyle = col; ctx.fillText(h.K.weak[h.i].broken ? 'WEAK POINT' : 'ARMOUR', x + r + 14, y - r); }
    ctx.restore();
  }
  function drawNums() {
    ctx.save(); ctx.textAlign = 'center';
    for (const n of B.nums) {
      const a = clamp(n.life / 0.5, 0, 1), s = n.crit ? 30 : n.hurt ? 26 : 20;
      ctx.font = `700 ${s}px "Chakra Petch"`;
      ctx.lineWidth = 4; ctx.strokeStyle = `rgba(0,0,0,${a * 0.7})`; ctx.strokeText(n.txt, n.x, n.y);
      ctx.fillStyle = n.hurt ? `rgba(255,90,100,${a})` : n.crit ? `rgba(255,190,80,${a})` : `rgba(255,255,255,${a})`;
      ctx.fillText(n.txt, n.x, n.y);
    }
    ctx.restore();
  }
  function drawOverlays() {
    if (B.hurtT > 0) {
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.9);
      g.addColorStop(0, 'rgba(255,0,30,0)'); g.addColorStop(1, `rgba(255,20,40,${B.hurtT})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (B.emp > 0 || B.desync > 0) {
      for (let i = 0; i < 18; i++) { ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '79,227,255'},${rnd(0.04, 0.16)})`; ctx.fillRect(0, Math.random() * H, W, rnd(1, 6)); }
    }
    if (B.slow > 0) { ctx.fillStyle = 'rgba(80,140,255,.08)'; ctx.fillRect(0, 0, W, H); }
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.05);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }
  function battleDraw(rdt) {
    const b = B, hy = horizon() + Math.sin(b.t * 2.2) * 2;
    ctx.save();
    if (b.shake > 0) ctx.translate(rnd(-1, 1) * b.shake * 18, rnd(-1, 1) * b.shake * 12);
    if (Math.abs(b.roll) > 0.01) { ctx.translate(W / 2, H / 2); ctx.rotate(-b.roll * 0.035); ctx.translate(-W / 2, -H / 2); }
    drawScene(b.sec, b.t, b.camX, hy, rdt);
    if (b.guard) drawGuard();
    for (const K of b.Ks) drawLaneMarks(K, K === b.K);
    for (const K of [...b.Ks].sort((x, y) => x.p - y.p)) {
      if (K.hidden) { K.shapes = []; continue; }
      const bob = K.st === 'approach' || K.st === 'charge' ? Math.abs(Math.sin(b.t * 6)) * sizeAt(K.p) * 0.01 : 0;
      K.shapes = drawKaiju(ctx, K, laneX(K.x, K.p), baseYAt(K.p) - bob, sizeAt(K.p), { t: b.t });
    }
    drawShock(); drawProj(); drawGShots(); drawParts(); drawBeams();
    drawWeather(b.sec, rdt);
    ctx.restore();
    drawArms(); drawReticle(); drawNums(); drawOverlays();
  }

  const hudEls = {};
  ['khp', 'php', 'phpT', 'pdr', 'pdrT', 'aPlasma', 'aFist', 'aBlade', 'aKit', 'aOd', 'kitN', 'wsel', 'kName', 'kCat', 'k2', 'wave', 'ghp', 'gName'].forEach((id) => (hudEls[id] = $('#' + id)));
  function hud() {
    const b = B, K = b.K, e = hudEls;
    e.khp.style.width = K ? `${Math.max(0, K.hp / K.hpMax) * 100}%` : '0%';
    if (K && e.kName.dataset.uid !== String(K.uid)) {
      e.kName.dataset.uid = K.uid; e.kName.textContent = `${K.sp.name}  LV ${K.lvl}`;
      e.kCat.textContent = `CAT ${roman(K.sp.cat)}${K.boss ? ' · BOSS' : ''}`;
    }
    const other = b.Ks.find((o) => o !== K && o.st !== 'dying');
    const k2 = other ? `+ ${other.sp.name} ${Math.round(other.hp / other.hpMax * 100)}%` : '';
    if (e.k2.textContent !== k2) e.k2.textContent = k2;
    const wl = waveLabel(); if (e.wave.textContent !== wl) e.wave.textContent = wl;
    if (b.guard) { e.ghp.style.width = `${b.guard.hp}%`; if (e.gName.textContent !== b.guard.name) e.gName.textContent = b.guard.name; }
    e.php.style.width = `${b.hp / maxHp() * 100}%`; e.phpT.textContent = `${Math.ceil(b.hp)}/${maxHp()}`;
    e.pdr.style.width = `${b.drift}%`; e.pdr.classList.toggle('full', b.drift >= 100); e.pdrT.textContent = `${Math.round(b.drift)}%`;
    const set = (el, unlocked, cd, max, ready, glow) => {
      el.classList.toggle('off', !unlocked); el.style.setProperty('--cd', unlocked && cd > 0 ? (cd / max).toFixed(3) : 0);
      el.classList.toggle('ready', !!ready); el.classList.toggle('glow', !!glow);
    };
    set(e.aFist, G.lvl >= 3, b.cdFist, 4, G.lvl >= 3 && b.cdFist <= 0);
    set(e.aBlade, G.lvl >= 6, b.cdBlade, 1.5, G.lvl >= 6 && b.cdBlade <= 0 && K && K.p >= 0.66, finisherReady());
    set(e.aKit, G.kits > 0, 0, 1, G.kits > 0 && b.hp < maxHp() * 0.6);
    set(e.aOd, b.drift >= 100, 0, 1, false, b.drift >= 100);
    e.kitN.textContent = G.kits;
    set(e.aPlasma, true, b.cdShot, 0.1, true);
    [e.aPlasma, e.aFist, e.aBlade, e.aOd].forEach((el, i) => el.classList.toggle('sel', b.sel === i));
    const label = `[${b.sel + 1}] ${SLOTS[b.sel][0]}`;
    if (e.wsel.textContent !== label) e.wsel.textContent = label;
  }

  // ================= menus =================
  function renderMap() {
    $('#mLv').textContent = `LV ${G.lvl}`;
    $('#mXp').style.width = `${G.xp / xpNeed() * 100}%`;
    $('#mSal').textContent = G.salvage; $('#mKits').textContent = G.kits;
    $('#brief').textContent = MARSHAL[Math.min(G.boss, 5)];
    $('#btnSound').style.opacity = AU.on ? 1 : 0.4;
    let html = '';
    for (let s = 1; s <= 5; s++) {
      const open = G.boss >= s - 1, beat = G.boss >= s, b = BOSS(s), th = THEMES[s];
      html += `<div class="sec ${open ? '' : 'locked'}" style="--sky:linear-gradient(180deg, ${th.sky.join(',')} 55%, ${th.sea[0]})">
        <div class="num">0${s}</div><h3>${SECTOR[s]}</h3><p>Rec. LV ${REC[s]}</p>
        <p class="bossn">${beat ? `<span class="done">&#10003; ${b.name} defeated</span>` : open ? `Boss: ${b.name}` : 'Boss: ???'}</p>
        <div class="grow"></div>
        ${open ? `<p class="muted">${['patrol', 'defend', 'escort', 'twin'].filter((t) => G.done[`${s}:${t}`]).length + (beat ? 1 : 0)}/5 missions done</p><button class="btn cy" data-sec="${s}">MISSIONS</button>`
          : `<p>Defeat ${BOSS(s - 1).name} to unlock</p>`}
      </div>`;
    }
    $('#sectors').innerHTML = html;
    $('#mName').textContent = mech().name;
    $('#btnEndless').textContent = `ENDLESS${G.best ? ` · BEST ${G.best}` : ''}`;
  }
  function openMissions(s) {
    mode = 'missions'; show('missions');
    $('#msTitle').textContent = `0${s} ${SECTOR[s]}`;
    $('#msList').innerHTML = MISSIONS(s).map(([t, name, desc]) => {
      const done = t === 'boss' ? G.boss >= s : G.done[`${s}:${t}`];
      return `<div class="mrow"><div><b>${name}</b> ${done ? '<span class="done">&#10003;</span>' : ''}<p class="muted">${desc}</p></div>
        <button class="btn ${t === 'boss' ? 'hot' : 'cy'}" data-go="${t}" data-s="${s}">PLAY</button></div>`;
    }).join('');
  }
  const UPG = [['armor', 'ARMOUR', 'More hull'], ['plasma', 'PLASMA', 'Cannon damage'], ['fist', 'ROCKET FIST', 'Fist damage'], ['blade', 'CHAIN BLADE', 'Blade damage']];
  const upgCost = (k) => 25 * (G.upg[k] + 1);
  function renderHangar() {
    $('#hSal').textContent = G.salvage;
    $('#mechs').innerHTML = MECHS.map((m) => {
      const open = G.boss >= m.need, on = mech().id === m.id;
      return `<div class="mech ${on ? 'on' : ''} ${open ? '' : 'locked'}" style="--ac:${m.accent}">
        <b>${m.name}</b><p class="muted">${open ? m.blurb : `Beat ${BOSS(m.need).name} to unlock.`}</p>
        <p class="muted">Hull ${Math.round(m.hp * 100)}% &middot; Damage ${Math.round(m.dmg * 100)}%</p>
        ${open ? `<button class="btn ${on ? '' : 'cy'}" data-mech="${m.id}" ${on ? 'disabled' : ''}>${on ? 'SELECTED' : 'SELECT'}</button>` : ''}</div>`;
    }).join('');
    let h = '';
    for (const [k, name, what] of UPG) {
      const lv = G.upg[k], max = lv >= 5;
      h += `<div><b>${name}</b> <span class="muted">${what}</span></div><div class="pips">${'&#9632;'.repeat(lv)}${'&#9633;'.repeat(5 - lv)}</div>
        <button class="btn ${max ? '' : 'cy'}" data-buy="${k}" ${max || G.salvage < upgCost(k) ? 'disabled' : ''}>${max ? 'MAX' : upgCost(k) + ' SALVAGE'}</button>`;
    }
    h += `<div><b>REPAIR KIT</b> <span class="muted">Heals 40% in battle. You have ${G.kits}.</span></div><div></div>
      <button class="btn cy" data-buy="kit" ${G.salvage < 20 || G.kits >= 6 ? 'disabled' : ''}>${G.kits >= 6 ? 'FULL' : '20 SALVAGE'}</button>`;
    $('#upgrades').innerHTML = h;
  }
  const ABIL = { charge: 'Charges', volley: 'Acid volleys', dive: 'Dives', dash: 'Side dashes', emp: 'EMP pulse' };
  function renderDex() {
    $('#dexCount').textContent = `${KAIJU.filter((k) => G.dex[k.id]).length}/${KAIJU.length}`;
    $('#dexGrid').innerHTML = KAIJU.map((k, i) => `<div class="dexc ${G.dex[k.id] === 2 ? 'beat' : ''}" data-dex="${i}"><canvas width="160" height="160"></canvas>${G.dex[k.id] ? k.name : '???'}</div>`).join('');
    document.querySelectorAll('#dexGrid canvas').forEach((c, i) => drawDexThumb(c, KAIJU[i]));
    $('#dexDetail').classList.remove('show');
  }
  function drawDexThumb(c, sp) {
    const x = c.getContext('2d'), s = c.width, st = G.dex[sp.id] || 0;
    x.clearRect(0, 0, s, s);
    const g = x.createRadialGradient(s / 2, s * 0.45, 0, s / 2, s * 0.45, s * 0.6);
    g.addColorStop(0, st ? rgba(geo(sp).glow, 0.25) : 'rgba(80,100,130,.15)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, s, s);
    drawKaiju(x, { sp, rise: 1, anim: IDLE }, s / 2, s * 0.98, s * 0.92, { sil: !st, noFoam: true, t: 1 });
  }
  function dexDetail(i) {
    const k = KAIJU[i], st = G.dex[k.id] || 0;
    $('#dexDetail').classList.add('show');
    drawDexThumb($('#dexBig'), k);
    $('#dexInfo').innerHTML = st
      ? `<h3 style="margin:0">${k.name}</h3><p class="muted">CATEGORY ${roman(k.cat)}${k.boss ? ' &middot; BOSS' : ''} &middot; ${st === 2 ? 'DEFEATED' : 'SIGHTED'}</p><p>${k.bio}</p><p class="muted">${(k.abil || []).map((a) => ABIL[a]).join(' &middot; ') || 'Claws and acid'}</p>`
      : '<h3 style="margin:0">???</h3><p class="muted">No data yet. Find it out there.</p>';
  }

  // ================= input =================
  let aimPtr = null, dodgePtr = null;
  cv.addEventListener('pointerdown', (e) => {
    audioInit();
    if (mode !== 'battle') return;
    e.preventDefault();
    const mouse = e.pointerType === 'mouse';
    if (mouse || e.clientX > W * 0.4) {
      if (mouse && e.button !== 0) return;
      aimPtr = { id: e.pointerId, x: e.clientX, y: e.clientY, mouse };
      if (mouse) { B.aim.x = e.clientX; B.aim.y = e.clientY; fireDown(); } else startCharge();
    } else dodgePtr = { id: e.pointerId, x: e.clientX, y: e.clientY };
    try { cv.setPointerCapture(e.pointerId); } catch {}
  });
  cv.addEventListener('pointermove', (e) => {
    if (mode !== 'battle' || !B) return;
    if (e.pointerType === 'mouse') { B.aim.x = e.clientX; B.aim.y = e.clientY; return; }
    if (aimPtr && aimPtr.id === e.pointerId) {
      B.aim.x = clamp(B.aim.x + (e.clientX - aimPtr.x) * 1.35, 8, W - 8);
      B.aim.y = clamp(B.aim.y + (e.clientY - aimPtr.y) * 1.35, 8, H - 8);
      aimPtr.x = e.clientX; aimPtr.y = e.clientY;
    } else if (dodgePtr && dodgePtr.id === e.pointerId) {
      const dx = e.clientX - dodgePtr.x, dy = e.clientY - dodgePtr.y;
      if (Math.abs(dx) > 26 && Math.abs(dx) >= Math.abs(dy)) { dodge(Math.sign(dx)); dodgePtr.x = e.clientX; dodgePtr.y = e.clientY; }
      else if (Math.abs(dy) > 34) { step(dy < 0 ? 1 : -1); dodgePtr.x = e.clientX; dodgePtr.y = e.clientY; }
    }
  });
  const endPtr = (e) => {
    if (aimPtr && aimPtr.id === e.pointerId) { const m = aimPtr.mouse; aimPtr = null; if (m) fireUp(); else release(); }
    if (dodgePtr && dodgePtr.id === e.pointerId) dodgePtr = null;
  };
  cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  const btnAct = (id, fn) => {
    const el = $(id);
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); audioInit(); el.classList.add('on'); fn(); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, () => el.classList.remove('on'));
  };
  btnAct('#aPlasma', () => selectSlot(0));
  btnAct('#aFist', () => { if (slotOpen(1)) B.sel = 1; useFist(); }); btnAct('#aBlade', () => { if (slotOpen(2)) B.sel = 2; useBlade(); });
  btnAct('#aOd', () => { B.sel = 3; useOd(); }); btnAct('#aKit', useKit);
  const keysHeld = {};
  addEventListener('keydown', (e) => {
    audioInit();
    const k = e.code;
    if (k.startsWith('Arrow') || k === 'Space') e.preventDefault();
    keysHeld[k] = true;
    if (mode === 'battle') {
      if (e.repeat) return;
      if (k === 'KeyA') dodge(-1);
      else if (k === 'KeyD') dodge(1);
      else if (k === 'KeyW') step(1);
      else if (k === 'KeyS') step(-1);
      else if (k === 'Enter' || k === 'NumpadEnter' || k === 'Space') fireDown();
      else if (k.startsWith('Digit') && +k[5] >= 1 && +k[5] <= 4) selectSlot(+k[5] - 1);
      else if (k === 'KeyQ') prevSlot();
      else if (k === 'KeyR') useKit();
      else if (k === 'KeyH') { G.keysHidden = !G.keysHidden; save(); $('#keys').classList.toggle('hide', !!G.keysHidden); }
      else if (k === 'Escape' || k === 'KeyP') pause();
    } else if (mode === 'pause' && (k === 'Escape' || k === 'KeyP')) resume();
  });
  addEventListener('keyup', (e) => {
    keysHeld[e.code] = false;
    if (mode === 'battle' && (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space')) fireUp();
  });
  addEventListener('blur', () => { for (const k in keysHeld) keysHeld[k] = false; });
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'battle') pause(); });
  function pause() { if (mode !== 'battle') return; release(); mode = 'pause'; show('pause'); }
  function resume() { mode = 'battle'; show('battle'); last = performance.now(); }

  const click = (sel, fn) => $(sel).addEventListener('click', (e) => { audioInit(); sfx.ui(); fn(e); });
  function goFullscreen() {
    const el = document.documentElement;
    if (document.fullscreenElement || !el.requestFullscreen || !matchMedia('(pointer: coarse)').matches) return;
    el.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
  }
  function toMap() { mode = 'map'; show('map'); renderMap(); music('menu'); }
  click('#btnPlay', () => { goFullscreen(); toMap(); });
  let wipeArmed = 0;
  click('#btnNew', () => {
    if (hadSave && G.lvl + G.boss > 1 && Date.now() - wipeArmed > 3000) { wipeArmed = Date.now(); $('#btnNew').textContent = 'TAP AGAIN TO WIPE SAVE'; return; }
    const snd = AU.on; G = fresh(); G.sound = snd; save(); $('#btnNew').textContent = 'NEW GAME'; goFullscreen(); toMap();
  });
  click('#btnDexT', () => { prevMode = 'title'; mode = 'dex'; show('dex'); renderDex(); });
  click('#btnDexM', () => { prevMode = 'map'; mode = 'dex'; show('dex'); renderDex(); });
  click('#mapBack', () => { mode = 'title'; show('title'); });
  click('#btnHangar', () => { mode = 'hangar'; show('hangar'); renderHangar(); });
  click('#btnSound', () => { setSound(!AU.on); renderMap(); });
  document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => { sfx.ui(); if (mode === 'dex' && prevMode === 'title') { mode = 'title'; show('title'); } else toMap(); }));
  $('#sectors').addEventListener('click', (e) => { const b = e.target.closest('[data-sec]'); if (!b) return; audioInit(); sfx.ui(); openMissions(+b.dataset.sec); });
  $('#msList').addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (!b) return; audioInit(); sfx.ui(); goFullscreen(); startMission(+b.dataset.s, b.dataset.go); });
  click('#btnEndless', () => { goFullscreen(); startMission(1, 'endless'); });
  $('#mechs').addEventListener('click', (e) => { const b = e.target.closest('[data-mech]'); if (!b || b.disabled) return; G.mech = b.dataset.mech; save(); sfx.level(); renderHangar(); });
  $('#upgrades').addEventListener('click', (e) => {
    const b = e.target.closest('[data-buy]'); if (!b || b.disabled) return;
    const k = b.dataset.buy;
    if (k === 'kit') { G.salvage -= 20; G.kits++; } else { G.salvage -= upgCost(k); G.upg[k]++; }
    sfx.level(); save(); renderHangar();
  });
  $('#dexGrid').addEventListener('click', (e) => { const c = e.target.closest('[data-dex]'); if (c) { sfx.ui(); dexDetail(+c.dataset.dex); } });
  click('#resMap', toMap);
  click('#resAgain', () => startMission(B.sec, B.type));
  click('#pauseBtn', pause);
  click('#pResume', resume);
  click('#pSound', () => setSound(!AU.on));
  click('#pQuit', () => { humStop(); toMap(); });

  // ================= main loop =================
  const attract = { sp: byId('slattern'), rise: 1, anim: { ...IDLE } };
  function drawAttract(dt) {
    const sec = mode === 'title' ? 5 : clamp(G.boss + 1, 1, 5);
    attract.sp = mode === 'title' ? byId('slattern') : BOSS(sec);
    attract.anim.jaw = 0.15 + Math.max(0, Math.sin(T * 0.7)) * 0.5;
    const cam = Math.sin(T * 0.15) * 0.5, hy = H * 0.5;
    drawScene(sec, T, cam, hy, dt);
    drawKaiju(ctx, attract, W * 0.76 - cam * W * 0.08, hy + H * 0.36, H * 0.72, { t: T });
    drawWeather(sec, dt);
    const v = ctx.createLinearGradient(0, 0, W, 0);
    v.addColorStop(0, 'rgba(4,7,14,.7)'); v.addColorStop(0.6, 'rgba(4,7,14,.15)'); v.addColorStop(1, 'rgba(4,7,14,.3)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; T += dt;
    toastT -= dt; if (toastT <= 0) $('#toast').classList.remove('on');
    subT -= dt; if (subT <= 0) $('#sub').classList.remove('on');
    if (mode === 'battle' && B) { battleUpdate(dt); battleDraw(dt); hud(); }
    else if ((mode === 'pause' || mode === 'result') && B) battleDraw(0);
    else drawAttract(dt);
    requestAnimationFrame(frame);
  }

  // ================= posters: icons + share image =================
  // Draws onto an offscreen canvas of the exact size and returns a PNG blob.
  async function posterBlob(kind, w, h) {
    await document.fonts.ready;
    const oc = document.createElement('canvas'); oc.width = w; oc.height = h;
    const keep = [ctx, W, H];
    ctx = oc.getContext('2d'); W = w; H = h;
    if (kind === 'og') {
      drawScene(1, 2.3, 0.1, H * 0.46, 0);
      const K = { sp: byId('knifehed'), rise: 1, anim: { ...IDLE, jaw: 0.75, armL: 0.6 } };
      drawKaiju(ctx, K, W * 0.7, H * 1.02, H * 0.98, { t: 2.3 });
      const g = ctx.createLinearGradient(0, 0, W * 0.7, 0);
      g.addColorStop(0, 'rgba(6,8,18,.88)'); g.addColorStop(1, 'rgba(6,8,18,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.font = `${H * 0.19}px "Russo One"`; ctx.fillStyle = '#eaf6ff'; ctx.shadowColor = 'rgba(79,227,255,.6)'; ctx.shadowBlur = 30;
      ctx.fillText('PAC1F1C', W * 0.05, H * 0.38); ctx.fillText('R1M', W * 0.05, H * 0.58);
      ctx.shadowBlur = 0; ctx.font = `600 ${H * 0.05}px "Chakra Petch"`; ctx.fillStyle = '#ff8a3d';
      ctx.fillText('J4GR vs K41JU  ·  FIRST PERSON  ·  FREE', W * 0.05, H * 0.7);
      const cx = W * 0.7, cy = H * 1.02 + (geo(K.sp).Hd.y - geo(K.sp).Hd.ry * 0.62) * H * 0.98;
      ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, 34, 0, TAU); ctx.stroke();
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 42, cy + Math.sin(a) * 42); ctx.lineTo(cx + Math.cos(a) * 60, cy + Math.sin(a) * 60); ctx.stroke(); }
    } else {
      const pad = kind === 'maskable' ? 0.22 : 0;
      drawScene(5, 1.2, 0, H * 0.62, 0);
      const K = { sp: byId('knifehed'), rise: 1, anim: { ...IDLE, jaw: 0.8 } };
      const S = H * (1.3 - pad * 1.6);
      drawKaiju(ctx, K, W / 2, H * 0.5 + 0.6 * S, S, { t: 1.2, noFoam: true });
    }
    [ctx, W, H] = keep;
    return new Promise((r) => oc.toBlob(r, 'image/png'));
  }

  requestAnimationFrame(frame);
  window.__pr = { get G() { return G; }, get B() { return B; }, get mode() { return mode; }, startMission, posterBlob };
})();
