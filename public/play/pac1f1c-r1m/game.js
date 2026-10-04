// game.js — PAC1F1C R1M: a Pokémon-style overworld with first-person J4GR battles.
// Everything draws into a 160x144 four-shade framebuffer, like a Game Boy.

(() => {
  'use strict';
  const { PALETTES, FONT, WIDE, SPR, KAIJU, CLEAR } = ART;
  const W = 160, H = 144;
  const cv = document.getElementById('screen');
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(W, H);
  const fb = new Uint8Array(W * H);
  const SAVE_KEY = 'pac1f1c-r1m-save';

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const irnd = (a, b) => Math.floor(rnd(a, b + 1));
  const roman = (n) => ['', 'I', 'II', 'III', 'IV', 'V'][n];
  const byId = (id) => KAIJU.find((k) => k.id === id);

  // ================= drawing =================
  let rgb = [];
  function setPalette(i) {
    const p = PALETTES[i];
    rgb = p.c.map((h) => [1, 3, 5].map((o) => parseInt(h.slice(o, o + 2), 16)));
    p.c.forEach((h, k) => document.documentElement.style.setProperty('--p' + k, h));
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', p.c[3]);
  }
  function px(x, y, c) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < W && y < H) fb[y * W + x] = c; }
  function rect(x, y, w, h, c) {
    const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(W, Math.floor(x + w)), y1 = Math.min(H, Math.floor(y + h));
    if (x1 <= x0) return;
    for (let j = y0; j < y1; j++) fb.fill(c, j * W + x0, j * W + x1);
  }
  function dith(x, y, w, h, a, b) {
    for (let j = Math.max(0, y | 0); j < Math.min(H, (y + h) | 0); j++)
      for (let i = Math.max(0, x | 0); i < Math.min(W, (x + w) | 0); i++) fb[j * W + i] = (i + j) & 1 ? a : b;
  }
  function line(x0, y0, x1, y1, c) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 400; n++) {
      px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function disc(cx, cy, r, c) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px(x, y, c);
  }
  function ring(cx, cy, r, c) {
    for (let a = 0; a < 40; a++) px(cx + Math.cos(a / 40 * 6.283) * r, cy + Math.sin(a / 40 * 6.283) * r, c);
  }
  function text(s, x, y, c = 3) {
    let cx = x;
    for (const ch of String(s).toUpperCase()) {
      if (ch === '\n') { cx = x; y += 8; continue; }
      const g = FONT[ch] || FONT['?'];
      for (let r = 0; r < 5; r++) for (let b = 0; b < 3; b++) if (g[r] & (4 >> b)) px(cx + b, y + r, c);
      cx += 4;
    }
  }
  const textW = (s) => String(s).length * 4 - 1;
  const textC = (s, y, c = 3, cx = 80) => text(s, Math.round(cx - textW(s) / 2), y, c);
  function big(s, x, y, c, k) {
    let cx = x;
    for (const ch of String(s).toUpperCase()) {
      const wd = WIDE[ch] ? 5 : 3, g = WIDE[ch] || FONT[ch] || FONT['?'];
      for (let r = 0; r < 5; r++) for (let b = 0; b < wd; b++) if (g[r] & (1 << (wd - 1 - b))) rect(cx + b * k, y + r * k, k, k, c);
      cx += (wd + 1) * k;
    }
  }
  function box(x, y, w, h) {
    rect(x, y, w, h, 0);
    rect(x, y, w, 1, 3); rect(x, y + h - 1, w, 1, 3); rect(x, y, 1, h, 3); rect(x + w - 1, y, 1, h, 3);
    rect(x + 2, y + 2, w - 4, 1, 2); rect(x + 2, y + h - 3, w - 4, 1, 2); rect(x + 2, y + 2, 1, h - 4, 2); rect(x + w - 3, y + 2, 1, h - 4, 2);
  }
  function bar(x, y, w, h, f, c) {
    rect(x, y, w, h, 2); rect(x + 1, y + 1, w - 2, h - 2, 3);
    rect(x + 1, y + 1, Math.round((w - 2) * clamp(f, 0, 1)), h - 2, c);
  }
  function sprite(rows, x, y, maxRows = 16) {
    for (let j = 0; j < Math.min(rows.length, maxRows); j++) {
      const r = rows[j];
      for (let i = 0; i < r.length; i++) if (r[i] !== '.') px(x + i, y + j, +r[i]);
    }
  }
  function present(shx = 0, shy = 0, inv = false) {
    const d = img.data;
    for (let i = 0; i < W * H; i++) {
      const c = rgb[inv ? 3 - fb[i] : fb[i]], o = i * 4;
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
    if (shx || shy) { ctx.fillStyle = PALETTES[G.pal].c[3]; ctx.fillRect(0, 0, W, H); }
    ctx.putImageData(img, Math.round(shx), Math.round(shy));
  }

  // ================= audio =================
  const AU = { ctx: null, on: true, song: null, step: 0, next: 0 };
  const NOTE_IDX = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  const freq = (n) => 440 * 2 ** ((NOTE_IDX[n[0]] + (n[1] === '#' ? 1 : 0) + (+n[n.length - 1] - 4) * 12) / 12);
  function parseTrack(s) {
    const t = s.trim().split(/\s+/), out = [];
    for (let i = 0; i < t.length; i++) {
      if (t[i] === '-' || t[i] === '.') { out.push(null); continue; }
      let len = 1;
      while (t[i + len] === '-') len++;
      out.push({ f: freq(t[i]), len });
    }
    return out;
  }
  const SONGS = {
    title: { bpm: 110, lead: 'E5 - - G5 A5 - - - G5 - E5 - D5 - - - C5 - - D5 E5 - G5 - A5 - G5 - E5 - - -', bass: 'A2 - E3 - A2 - E3 - F2 - C3 - F2 - C3 - C3 - G3 - C3 - G3 - G2 - D3 - G2 - B2 -' },
    world: { bpm: 132, lead: 'E5 - G5 - A5 - G5 E5 D5 - E5 - C5 - D5 - E5 - G5 - A5 C6 B5 A5 G5 - E5 - D5 - - -', bass: 'C3 - G3 - C3 - G3 - A2 - E3 - A2 - E3 - F2 - C3 - F2 - C3 - G2 - D3 - G2 - B2 -', drum: 4 },
    battle: { bpm: 168, lead: 'A4 A4 C5 A4 D5 A4 E5 D5 C5 A4 G4 A4 - A4 C5 E5 F5 E5 D5 C5 D5 E5 - - A5 G5 F5 E5 D5 E5 - -', bass: 'A2 A3 A2 A3 A2 A3 A2 A3 F2 F3 F2 F3 G2 G3 G2 G3', drum: 2 },
    boss: { bpm: 184, lead: 'D5 D5 F5 D5 G#5 - G5 F5 D5 D5 F5 D5 A5 - G5 F5 E5 E5 G5 E5 A#5 - A5 G5 F5 E5 D5 C#5 D5 - - -', bass: 'D2 D3 D2 D3 D2 D3 D2 D3 A#1 A#2 A#1 A#2 C2 C3 A1 A2', drum: 2 },
  };
  for (const s of Object.values(SONGS)) { s.L = parseTrack(s.lead); s.B = parseTrack(s.bass); }

  function audioInit() {
    if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    AU.ctx = new C();
    AU.master = AU.ctx.createGain();
    AU.master.gain.value = AU.on ? 0.16 : 0;
    AU.master.connect(AU.ctx.destination);
    const len = AU.ctx.sampleRate * 0.6;
    AU.noise = AU.ctx.createBuffer(1, len, AU.ctx.sampleRate);
    const d = AU.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    AU.next = AU.ctx.currentTime + 0.05;
    setInterval(schedule, 30);
  }
  function tone(f, t, dur, type = 'square', vol = 0.25, slide) {
    const o = AU.ctx.createOscillator(), g = AU.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(AU.master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(t, dur, vol = 0.3, f = 1000) {
    const s = AU.ctx.createBufferSource(), fl = AU.ctx.createBiquadFilter(), g = AU.ctx.createGain();
    s.buffer = AU.noise; fl.type = 'bandpass'; fl.frequency.value = f;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(AU.master);
    s.start(t); s.stop(t + dur);
  }
  function schedule() {
    if (!AU.ctx || !AU.song || !AU.on) return;
    const s = SONGS[AU.song], step = 60 / s.bpm / 2;
    if (AU.next < AU.ctx.currentTime) AU.next = AU.ctx.currentTime + 0.02;
    while (AU.next < AU.ctx.currentTime + 0.15) {
      const n = s.L[AU.step % s.L.length], b = s.B[AU.step % s.B.length];
      if (n) tone(n.f, AU.next, step * n.len * 0.9, 'square', 0.1);
      if (b) tone(b.f, AU.next, step * b.len * 0.95, 'triangle', 0.3);
      if (s.drum && AU.step % s.drum === 0) noise(AU.next, 0.04, AU.step % 8 === 0 ? 0.25 : 0.1, AU.step % 8 === 0 ? 200 : 6000);
      AU.next += step; AU.step++;
    }
  }
  function music(name) { AU.song = name; AU.step = 0; if (AU.ctx) AU.next = AU.ctx.currentTime + 0.05; }
  function toggleSound() {
    AU.on = !AU.on; G.sound = AU.on;
    if (AU.master) AU.master.gain.value = AU.on ? 0.16 : 0;
  }
  const play = (fn) => { if (AU.ctx && AU.on) fn(AU.ctx.currentTime); };
  const sfx = {
    blip: () => play((t) => tone(1400, t, 0.02, 'square', 0.05)),
    select: () => play((t) => { tone(660, t, 0.05, 'square', 0.12); tone(990, t + 0.05, 0.07, 'square', 0.12); }),
    bump: () => play((t) => tone(110, t, 0.08, 'square', 0.15)),
    shoot: (c) => play((t) => tone(1300 - c * 600, t, 0.15 + c * 0.25, 'sawtooth', 0.14, 110)),
    fist: () => play((t) => { noise(t, 0.35, 0.35, 400); tone(220, t, 0.3, 'square', 0.15, 60); }),
    blade: () => play((t) => noise(t, 0.18, 0.35, 4500)),
    hit: () => play((t) => noise(t, 0.12, 0.35, 900)),
    crit: () => play((t) => { noise(t, 0.2, 0.4, 1600); tone(1500, t, 0.12, 'square', 0.12, 3000); }),
    hurt: () => play((t) => { noise(t, 0.4, 0.5, 220); tone(90, t, 0.3, 'sawtooth', 0.2, 40); }),
    warn: () => play((t) => { tone(1000, t, 0.07, 'square', 0.12); tone(1000, t + 0.12, 0.07, 'square', 0.12); }),
    encounter: () => play((t) => { for (let i = 0; i < 8; i++) tone(i % 2 ? 600 : 900, t + i * 0.07, 0.06, 'square', 0.15); }),
    level: () => play((t) => ['C5', 'E5', 'G5', 'C6', 'G5', 'C6'].forEach((n, i) => tone(freq(n), t + i * 0.09, 0.12, 'square', 0.15))),
    win: () => play((t) => ['G4', 'C5', 'E5', 'G5', 'E5', 'G5'].forEach((n, i) => tone(freq(n), t + i * 0.11, 0.16, 'square', 0.15))),
    lose: () => play((t) => ['E4', 'D#4', 'D4', 'C#4'].forEach((n, i) => tone(freq(n), t + i * 0.25, 0.3, 'triangle', 0.3))),
    heal: () => play((t) => [0, 1, 2, 3].forEach((i) => tone(500 + i * 200, t + i * 0.06, 0.08, 'square', 0.1))),
    roar: () => play((t) => { noise(t, 0.9, 0.45, 160); tone(80, t, 0.9, 'sawtooth', 0.22, 38); }),
    splash: () => play((t) => noise(t, 0.45, 0.25, 700)),
    emp: () => play((t) => tone(60, t, 1.0, 'sawtooth', 0.25, 2000)),
  };

  // ================= input =================
  const BTN = ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select'];
  const held = {}, was = {}, tapped = {};
  let pressed = {};
  const KEYMAP = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    KeyZ: 'a', KeyJ: 'a', Space: 'a', KeyX: 'b', KeyK: 'b', Escape: 'b', Enter: 'start', KeyP: 'start', ShiftLeft: 'select', ShiftRight: 'select',
  };
  addEventListener('keydown', (e) => {
    audioInit();
    if (e.code === 'KeyM') { toggleSound(); return; }
    const b = KEYMAP[e.code];
    if (!b) return;
    e.preventDefault();
    if (!held[b]) tapped[b] = true;
    held[b] = true;
  });
  addEventListener('keyup', (e) => { const b = KEYMAP[e.code]; if (b) held[b] = false; });
  addEventListener('blur', () => BTN.forEach((b) => (held[b] = false)));
  function pollInput() {
    pressed = {};
    for (const b of BTN) { pressed[b] = tapped[b] || (held[b] && !was[b]); was[b] = held[b]; tapped[b] = false; }
  }

  // On-screen pad: one handler for the whole pad so a thumb can slide between buttons.
  const pad = document.getElementById('pad');
  const fingers = new Map();
  function padAt(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    return el && el.closest && el.closest('[data-btn]') ? el.closest('[data-btn]').dataset.btn : null;
  }
  function padSet(id, b) {
    const prev = fingers.get(id);
    if (prev === b) return;
    if (prev) { held[prev] = false; pad.querySelector(`[data-btn="${prev}"]`)?.classList.remove('on'); }
    if (b) {
      held[b] = true; tapped[b] = true;
      pad.querySelector(`[data-btn="${b}"]`)?.classList.add('on');
      navigator.vibrate?.(8);
    }
    fingers.set(id, b);
  }
  pad.addEventListener('pointerdown', (e) => {
    audioInit(); e.preventDefault();
    pad.releasePointerCapture?.(e.pointerId);
    padSet(e.pointerId, padAt(e));
  });
  pad.addEventListener('pointermove', (e) => { if (fingers.has(e.pointerId)) padSet(e.pointerId, padAt(e)); });
  for (const ev of ['pointerup', 'pointercancel']) {
    addEventListener(ev, (e) => { if (fingers.has(e.pointerId)) { padSet(e.pointerId, null); fingers.delete(e.pointerId); } });
  }
  pad.addEventListener('contextmenu', (e) => e.preventDefault());

  // Dragging on the screen aims and strafes in battle; a tap counts as A.
  let drag = null;
  cv.addEventListener('pointerdown', (e) => {
    audioInit(); e.preventDefault();
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const k = W / cv.getBoundingClientRect().width;
    const dx = (e.clientX - drag.x) * k, dy = (e.clientY - drag.y) * k;
    drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
    if (mode === 'battle' && B && !B.over && B.stun <= 0) {
      B.px = clamp(B.px + dx * 0.06, -7, 7);
      B.pitch = clamp(B.pitch - dy * 1.2, -30, 170);
    }
  });
  cv.addEventListener('pointerup', (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    if (drag.moved < 6 && performance.now() - drag.t < 350) tapped.a = true;
    drag = null;
  });

  // ================= the map =================
  // ~ sea  = K41JU water (encounters)  r rock  . sand  , grass  : road  T tree  R roof  # wall
  // H house door  D dome  d dome door  B bridge  S sign  V boss swirl  2-5 buoy line to that sector
  const RAW = [
    'r',
    '=====~~~~=====V=====~~~~=====',
    '==r===~~=============~~===r==',
    '=====~~~====rrr====~~~=======',
    '~~====~~~=========~~~====~~~~',
    '==~~=====r======r=====~~=====',
    '=====~~=================~~===',
    '5',
    '~~~====~~~~~~~====~~~~===~~~~',
    '~~=V===~~~rr~~~=====~~~===~~~',
    '~=====~~~~rr~~~~=====~~~~=~~~',
    '~~===~~~~~~~~~=====~~~~~~~~~~',
    '~~~~~~~===~~~~~===~~~rr~~~~~~',
    '~~rr~~=====~~~~~~~~~~~~~=====',
    '~~~~~~~===~~~~~~~~~~~~~~=====',
    '4',
    '~~~~~~~~~~~~~~~~~~~~~~~~~V==~',
    '~~===~~~~rr~~~~~====~~~~====~',
    '~=====~~~rr~~~~======~~~===~~',
    '~~===~~~~~~~~~~~====~~~~~~~~~',
    '~~~~~~~====~~~~~~~~~~~rr~~~~~',
    '~rr~~~=====~~~~~~===~~~~~~~~~',
    '~~~~~~~===~~~~~~=====~~~~~~~~',
    '3',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~====~~~~~~~=V=~~~~~~~====~~~',
    '~=====~~~~~=======~~~~~=====~~',
    '~~===~~~~~~~=====~~~~~~~===~~~',
    '~~~~~~~rr~~~~~~~~~~~~rr~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '2',
    '..........~~~~~~~~~~..........',
    '.RR.RR.RR.~~~~~~~~~~..,,,,,,..',
    '.##.#H.##.~~====~~~~.,,DDDD,,.',
    '::::::::::~======~~~.,,DDDD,,.',
    '.RR.S..RR.~~=====~~~.,,DDdD,,.',
    '.##....##.~~~====~~~.,,,,:,,,.',
    ',,,,::,,,,~~~~==~~~~::::::::::',
    ',T,,::,,T,~~====~~~~,,S,:,,,T,',
    ',,,,::,,,,~=====~~~~,T,,:,,,,,',
    'TT,,::,,TT~~===~~~~~,,,,:,,TT,',
    ',,,,::::::BBBBBBBBBB::::::,,,,',
    ',T,,,,,,T,~~====~~~~,,,,,,,T,,',
    ',,,,,,,,,,~======~~~,T,,,,,,,,',
    'TT,,,,TT,,~~==V==~~~,,,,TT,,,,',
    'TTTTTTTTTT~~~~~~~~~~TTTTTTTTTT',
    'r',
  ];
  const MW = 32;
  const MAP = RAW.map((r, y) => {
    if (r === 'r') return 'r'.repeat(MW);
    const edge = y >= 31 ? 'T' : 'r';
    let inner = r;
    while (inner.length < 30) inner += inner[inner.length - 1];
    return edge + inner.slice(0, 30) + edge;
  });
  const MH = MAP.length;
  const tile = (x, y) => (y < 0 || y >= MH || x < 0 || x >= MW ? 'r' : MAP[y][x]);
  const sectorAt = (y) => (y >= 31 ? 1 : y >= 24 ? 2 : y >= 16 ? 3 : y >= 8 ? 4 : 5);
  const SECTOR = ['', 'SELAT STRAIT', 'NORTH CHANNEL', 'OPEN SEA', 'DEEP TRENCH', 'TH3 BR34CH'];
  const BOSS = (s) => KAIJU.find((k) => k.boss === s);
  const BOSS_LVL = [0, 5, 8, 11, 14, 19];
  const TABLES = {
    1: [['scuttle', 1, 3, 6], ['grimlurk', 2, 3, 4]],
    2: [['grimlurk', 4, 5, 4], ['mawspawn', 4, 6, 5], ['spineray', 5, 6, 1]],
    3: [['mawspawn', 7, 8, 3], ['spineray', 7, 9, 4], ['hammerjaw', 8, 9, 2]],
    4: [['hammerjaw', 10, 12, 4], ['voltusk', 10, 13, 4], ['abyssor', 12, 13, 1]],
    5: [['voltusk', 14, 16, 5], ['abyssor', 15, 17, 4]],
  };
  const isGate = (ch) => ch >= '2' && ch <= '5';
  const gateOpen = (ch) => G.boss >= +ch - 1;
  const bossAlive = (s) => G.boss < s;
  const watery = (ch) => ch === '~' || ch === '=' || ch === 'V' || isGate(ch);

  const MARSHAL = [
    ['RAL3Y. K41JU SIGNATURES IN THE SELAT STRAIT.', 'PATROL THE DARK WATER. THE SWIRL SOUTH OF THE BRIDGE IS KN1FEHED.', 'IN THE COCKPIT: LEFT/RIGHT STRAFES, UP/DOWN AIMS. HIT THE GLOWING SPOTS.', 'TODAY, WE HOLD THE LINE.'],
    ['KN1FEHED IS DOWN. THE NORTH BUOYS ARE LOWERED.', '0TACH1 NESTS IN THE NORTH CHANNEL. WATCH FOR ACID IN THREES.'],
    ['0TACH1 IS GONE. THE OPEN SEA IS YOURS.', 'L3ATHERBAK CARRIES AN EMP. HIT THE SACS ON ITS BACK WHILE IT CHARGES.'],
    ['L3ATHERBAK IS DOWN. NEXT: THE DEEP TRENCH.', "R41JU IS FAST. DON'T CHASE IT - LET IT COME TO YOU."],
    ['ONLY TH3 BR34CH REMAINS.', 'SL4TT3RN GUARDS IT. CATEGORY V. COME HOME, RANGERS.'],
    ['TH3 BR34CH IS SEALED. PENANG OWES YOU BOTH.', 'THE OCEAN STILL STIRS. KEEP PATROLLING IF YOU LIKE.'],
  ];
  const MAKO_TIPS = [
    'MAK0: EVERY HIT RAISES OUR DR1FT. AT 100%, PRESS B TO PICK OVERDRIVE.',
    'MAK0: IF THE DR1FT HITS ZERO WE LOSE CONTROL FOR A MOMENT. DODGE!',
    'MAK0: HOLD A TO CHARGE THE PLASMA CANNON. RELEASE TO FIRE.',
    'MAK0: THE DOME DOOR REPAIRS GYPSY AND SAVES OUR PROGRESS.',
    'MAK0: SALVAGE BUYS UPGRADES INSIDE THE SH4TT3RD0ME.',
    'MAK0: A RED "!" MEANS IT IS WINDING UP. STRAFE OUT OF ITS PATH.',
  ];
  const NPCS = [
    { x: 24, y: 36, spr: 'marshal', talk: () => MARSHAL[Math.min(G.boss, 5)].map((l) => 'MARSHAL ST4CK: ' + l) },
    { x: 28, y: 36, spr: 'mako', talk: () => [MAKO_TIPS[G.tip++ % MAKO_TIPS.length]] },
    { x: 15, y: 31, spr: 'ally', gift: 'stryka', talk: () => G.gifts.stryka
      ? ['STRYKA EUR3KA: FASTEST J4GR IN THE FLEET. KEEP UP, ROOKIE.']
      : (G.kits += 2, G.gifts.stryka = 1, sfx.heal(), ['STRYKA EUR3KA: YOU LOOK BATTERED. TAKE THESE.', 'GOT 2 REPAIR KITS!']) },
    { x: 4, y: 39, spr: 'ally', talk: () => G.gifts.crimson
      ? ['CR1MS0N TYPH00N: THREE ARMS, ONE TEAM. GO GET THEM.']
      : (G.salvage += 40, G.gifts.crimson = 1, sfx.heal(), ['CR1MS0N TYPH00N: WE PULLED THIS FROM A WRECK. USE IT.', 'GOT 40 SALVAGE!']) },
    { x: 27, y: 39, spr: 'ally', talk: () => G.gifts.cherno
      ? ['CH3RNO ALF4: OLD, BUT STILL STANDING.']
      : (G.upg.armor = Math.min(5, G.upg.armor + 1), G.gifts.cherno = 1, G.hp = maxHp(), sfx.heal(), ['CH3RNO ALF4: ARMOR IS EVERYTHING. LET ME BOLT SOME ON.', 'ARMOR UPGRADED!']) },
  ];
  const npcAt = (x, y) => NPCS.find((n) => n.x === x && n.y === y);
  const SIGNS = {
    '5,35': ['GEORGE TOWN. K41JU SHELTERS ARE OPEN.', 'LOOK LEFT, LOOK RIGHT, LOOK FOR TAILS.'],
    '23,38': ['SH4TT3RD0ME BUTTERWORTH. J4GR PROGRAM.', 'THE DOME DOOR IS JUST NORTH.'],
  };

  // ================= game state =================
  const maxHp = () => Math.round((60 + 12 * G.lvl) * (1 + 0.12 * G.upg.armor));
  const xpNeed = () => 10 + 12 * G.lvl;
  const atkMul = (w) => (1 + 0.12 * (G.lvl - 1)) * (1 + 0.15 * (G.upg[w] || 0));
  function newGame() {
    return { x: 26, y: 36, dir: 'up', lvl: 1, xp: 0, hp: 72, salvage: 0, kits: 1, upg: { armor: 0, plasma: 0, fist: 0, blade: 0 },
      boss: 0, dex: {}, gifts: {}, pal: G ? G.pal : 0, sound: true, tip: 0, grace: 0 };
  }
  let G = null;
  G = newGame();
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch {} }
  function loadSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; } }
  const saved = loadSave();
  if (saved) G.pal = saved.pal || 0;
  setPalette(G.pal);

  let mode = 'title', time = 0;

  // ================= dialog + menus =================
  const dlg = { pages: [], shown: 0, cb: null };
  function wrap(s, n = 36) {
    const out = [];
    for (const para of s.split('\n')) {
      let cur = '';
      for (const w of para.split(' ')) {
        if (cur && (cur + ' ' + w).length > n) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
      }
      out.push(cur);
    }
    return out;
  }
  function say(msgs, cb) {
    for (const m of [].concat(msgs)) {
      const ls = wrap(m);
      for (let i = 0; i < ls.length; i += 3) dlg.pages.push(ls.slice(i, i + 3).join('\n'));
    }
    if (cb) dlg.pages.push(cb);
    dlg.shown = 0;
  }
  function dialogUpdate(dt) {
    while (typeof dlg.pages[0] === 'function') dlg.pages.shift()();
    if (!dlg.pages.length) return false;
    const p = dlg.pages[0];
    if (dlg.shown < p.length) {
      const before = Math.floor(dlg.shown);
      dlg.shown += dt * (held.a || held.b ? 160 : 55);
      if (Math.floor(dlg.shown) > before && before % 3 === 0) sfx.blip();
      if (pressed.a || pressed.b) dlg.shown = p.length;
    } else if (pressed.a || pressed.b) {
      sfx.blip(); dlg.pages.shift(); dlg.shown = 0;
      while (typeof dlg.pages[0] === 'function') dlg.pages.shift()();
    }
    return true;
  }
  function dialogDraw() {
    const p = dlg.pages[0];
    if (typeof p !== 'string') return;
    box(0, 104, 160, 40);
    text(p.slice(0, Math.floor(dlg.shown)), 8, 112, 3);
    if (dlg.shown >= p.length && Math.floor(time * 3) % 2) text('v', 148, 134, 3);
  }

  const menus = [];
  function openMenu(m) { m.i = 0; menus.push(m); sfx.select(); }
  function menuUpdate() {
    const m = menus[menus.length - 1];
    const n = m.items.length;
    if (pressed.up) { m.i = (m.i + n - 1) % n; sfx.blip(); }
    if (pressed.down) { m.i = (m.i + 1) % n; sfx.blip(); }
    if (pressed.b || (pressed.start && m.pause)) { menus.pop(); sfx.blip(); return; }
    if (pressed.a) {
      const it = m.items[m.i];
      sfx.select();
      if (!it.keep) menus.pop();
      it.act?.();
    }
  }
  function menuDraw(m) {
    const labels = m.items.map((it) => (typeof it.label === 'function' ? it.label() : it.label));
    const title = typeof m.title === 'function' ? m.title() : m.title;
    const w = m.w || Math.max(...labels.map((l) => l.length), (title || '').length) * 4 + 20;
    const h = labels.length * 9 + (title ? 18 : 10);
    const x = m.x ?? W - w - 4, y = m.y ?? 4;
    box(x, y, w, h);
    let yy = y + 7;
    if (title) { text(title, x + 8, yy, 2); yy += 9; }
    labels.forEach((l, i) => {
      text(l, x + 12, yy, 3);
      if (i === m.i) text('>', x + 6, yy, 3);
      yy += 9;
    });
  }

  // ================= overworld =================
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const ow = { moving: false, t: 0, dx: 0, dy: 0, frame: 0, banner: null, sector: 1 };

  function walkable(x, y) {
    const ch = tile(x, y);
    if (npcAt(x, y)) return false;
    if (isGate(ch)) return gateOpen(ch);
    return '~=.,:BV'.includes(ch);
  }
  function worldUpdate(dt) {
    if (ow.banner) { ow.banner.t -= dt; if (ow.banner.t <= 0) ow.banner = null; }
    if (ow.moving) {
      ow.t += dt / 0.16;
      if (ow.t >= 1) { ow.moving = false; G.x += ow.dx; G.y += ow.dy; ow.t = 0; ow.frame ^= 1; arrive(); }
      return;
    }
    if (pressed.start) return openPause();
    if (pressed.a) return interact();
    const dir = ['up', 'down', 'left', 'right'].find((d) => held[d]);
    if (!dir) return;
    G.dir = dir;
    const [dx, dy] = DIRS[dir], nx = G.x + dx, ny = G.y + dy;
    if (walkable(nx, ny)) { ow.moving = true; ow.dx = dx; ow.dy = dy; ow.t = 0; return; }
    if (!pressed[dir]) return;
    const ch = tile(nx, ny);
    if (ch === 'd') domeMenu();
    else if (isGate(ch)) say(`A BUOY LINE BLOCKS THE WAY. DEFEAT ${BOSS(+ch - 1).name} TO LOWER IT.`);
    else sfx.bump();
  }
  function arrive() {
    const ch = tile(G.x, G.y), s = sectorAt(G.y);
    if (s !== ow.sector) { ow.sector = s; ow.banner = { text: `SECTOR ${s}: ${SECTOR[s]}`, t: 2.2 }; }
    if (ch === 'V' && bossAlive(s)) {
      const b = BOSS(s);
      sfx.roar();
      say(['THE WATER IS BOILING...', `MAK0: IT'S ${b.name}! CATEGORY ${roman(b.cat)}!`], () => encounter(b, BOSS_LVL[s]));
      return;
    }
    if (ch === '=') {
      if (G.grace > 0) { G.grace--; return; }
      if (Math.random() < 1 / 9) {
        const tbl = TABLES[s], tot = tbl.reduce((a, r) => a + r[3], 0);
        let r = Math.random() * tot, pick = tbl[0];
        for (const row of tbl) { if ((r -= row[3]) < 0) { pick = row; break; } }
        encounter(byId(pick[0]), irnd(pick[1], pick[2]));
      }
    }
  }
  function interact() {
    const [dx, dy] = DIRS[G.dir], fx = G.x + dx, fy = G.y + dy, ch = tile(fx, fy);
    const n = npcAt(fx, fy);
    if (n) return say(n.talk(), save);
    if (ch === 'S') return say(SIGNS[`${fx},${fy}`] || ['A WEATHERED SIGN.']);
    if (ch === 'H') return say(['A RESIDENT: THE J4GRS KEEP GEORGE TOWN SAFE. TERIMA KASIH!']);
    if (ch === 'd') return domeMenu();
  }
  function openPause() {
    openMenu({
      pause: true, title: 'MENU',
      items: [
        { label: 'K41JU-DEX', act: openDex },
        { label: 'STATUS', act: showStatus },
        { label: () => 'PALETTE', keep: true, act: () => { G.pal = (G.pal + 1) % PALETTES.length; setPalette(G.pal); } },
        { label: () => 'SOUND ' + (AU.on ? 'ON' : 'OFF'), keep: true, act: toggleSound },
        { label: 'SAVE', act: () => { save(); say('PROGRESS SAVED.'); } },
        { label: 'CLOSE' },
      ],
    });
  }
  function showStatus() {
    const u = G.upg, st = (n) => '*'.repeat(n) + '-'.repeat(5 - n);
    say([
      `GYPSY R4NG3R  LV ${G.lvl}\nHP ${Math.ceil(G.hp)}/${maxHp()}   XP ${G.xp}/${xpNeed()}\nSALVAGE ${G.salvage}   KITS ${G.kits}`,
      `ARMOR  ${st(u.armor)}   PLASMA ${st(u.plasma)}\nFIST   ${st(u.fist)}   BLADE  ${st(u.blade)}\nPILOTS RAL3Y & MAK0   BOSSES ${G.boss}/5`,
    ]);
  }
  function domeMenu() {
    openMenu({
      title: 'SH4TT3RD0ME', x: 4, y: 4,
      items: [
        { label: 'REPAIR + SAVE', act: () => { G.hp = maxHp(); save(); sfx.heal(); say('GYPSY R4NG3R IS FULLY REPAIRED. PROGRESS SAVED.'); } },
        { label: 'UPGRADES', act: upgradeMenu },
        { label: 'K41JU-DEX', act: openDex },
        { label: 'LEAVE' },
      ],
    });
  }
  const UPG = [['armor', 'ARMOR'], ['plasma', 'PLASMA'], ['fist', 'FIST'], ['blade', 'BLADE']];
  const upgCost = (k) => 25 * (G.upg[k] + 1);
  function upgradeMenu() {
    openMenu({
      title: () => `SALVAGE ${G.salvage}`, x: 4, y: 4, w: 120,
      items: [
        ...UPG.map(([k, name]) => ({
          keep: true,
          label: () => `${name.padEnd(7)}${'*'.repeat(G.upg[k]).padEnd(5, '-')} ${G.upg[k] >= 5 ? 'MAX' : upgCost(k)}`,
          act: () => {
            if (G.upg[k] >= 5) return;
            if (G.salvage < upgCost(k)) { sfx.bump(); return; }
            G.salvage -= upgCost(k); G.upg[k]++;
            if (k === 'armor') G.hp = maxHp();
            sfx.level(); save();
          },
        })),
        { label: 'BACK' },
      ],
    });
  }

  // ---- overworld drawing ----
  function drawTile(ch, sx, sy, wx, wy) {
    const t = Math.floor(time * 2);
    const water = (base, mark, glint) => {
      rect(sx, sy, 16, 16, base);
      for (const ry of [3, 11]) {
        const off = ((wx * 5 + wy * 3 + ry + t * (ry === 3 ? 1 : -1)) % 8 + 8) % 8;
        for (let i = 0; i < 16; i++) {
          const k = (i + off) % 8;
          if (k === 0 || k === 2) px(sx + i, sy + ry, mark);
          if (k === 1) px(sx + i, sy + ry - 1, mark);
        }
      }
      if (glint !== undefined && (wx * 7 + wy * 13 + t) % 11 === 0) px(sx + 8, sy + 7, glint);
    };
    switch (ch) {
      case '~': water(1, 2); break;
      case '=': water(2, 3, 0); for (let i = 2; i < 16; i += 5) px(sx + i, sy + 7 + ((i + t) % 3), 1); break;
      case 'r': water(1, 2); disc(sx + 8, sy + 9, 6, 3); disc(sx + 7, sy + 8, 4, 2); px(sx + 5, sy + 6, 1); px(sx + 6, sy + 6, 1); break;
      case '.': rect(sx, sy, 16, 16, 0); for (let i = 0; i < 4; i++) px(sx + ((wx * 7 + i * 5) % 16), sy + ((wy * 3 + i * 7) % 16), 1); break;
      case ',': rect(sx, sy, 16, 16, 0); for (const [a, b] of [[3, 4], [10, 2], [6, 11], [13, 12]]) { px(sx + a, sy + b, 2); px(sx + a + 1, sy + b - 1, 2); px(sx + a + 2, sy + b, 2); } break;
      case ':': rect(sx, sy, 16, 16, 1); for (let i = 0; i < 16; i += 4) px(sx + i + (wy & 1) * 2, sy + 8, 0); break;
      case 'T': rect(sx, sy, 16, 16, 0); rect(sx + 7, sy + 11, 2, 5, 3); disc(sx + 8, sy + 7, 6.5, 3); disc(sx + 8, sy + 7, 5.5, 2); disc(sx + 6, sy + 5, 2, 1); break;
      case 'R': rect(sx, sy, 16, 16, 2); for (let y = 3; y < 16; y += 4) rect(sx, sy + y, 16, 1, 3); rect(sx, sy + 15, 16, 1, 3); break;
      case '#': case 'H':
        rect(sx, sy, 16, 16, 0); rect(sx, sy, 16, 1, 3); rect(sx, sy + 15, 16, 1, 3);
        if (ch === 'H') { rect(sx + 5, sy + 6, 6, 10, 3); px(sx + 9, sy + 11, 0); }
        else { rect(sx + 2, sy + 4, 4, 4, 3); rect(sx + 10, sy + 4, 4, 4, 3); px(sx + 3, sy + 5, 1); px(sx + 11, sy + 5, 1); }
        break;
      case 'D': case 'd': {
        rect(sx, sy, 16, 16, 1);
        rect(sx, sy, 16, 1, 2); rect(sx, sy + 8, 16, 1, 2); rect(sx, sy, 1, 16, 2);
        px(sx + 3, sy + 3, 3); px(sx + 12, sy + 3, 3); px(sx + 3, sy + 12, 3); px(sx + 12, sy + 12, 3);
        if (tile(wx, wy - 1) !== 'D') { rect(sx, sy, 16, 3, 3); for (let i = 0; i < 16; i += 4) rect(sx + i, sy + 1, 2, 1, 0); }
        if (ch === 'd') { rect(sx + 3, sy + 4, 10, 12, 3); for (let i = 0; i < 10; i += 3) px(sx + 3 + i, sy + 4, 0); rect(sx + 7, sy + 6, 2, 10, 2); }
        break;
      }
      case 'B': water(1, 2); rect(sx, sy + 4, 16, 8, 0); rect(sx, sy + 3, 16, 1, 3); rect(sx, sy + 12, 16, 1, 3); for (let i = 1; i < 16; i += 5) rect(sx + i, sy + 12, 1, 3, 3); break;
      case 'S': rect(sx, sy, 16, 16, 0); rect(sx + 7, sy + 9, 2, 6, 3); rect(sx + 2, sy + 2, 12, 8, 3); rect(sx + 3, sy + 3, 10, 6, 0); rect(sx + 4, sy + 5, 8, 1, 2); rect(sx + 4, sy + 7, 6, 1, 2); break;
      case 'V':
        if (!bossAlive(sectorAt(wy))) { drawTile('=', sx, sy, wx, wy); break; }
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
          const dx = x - 7.5, dy = y - 7.5, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
          const v = Math.floor(a * 2 / Math.PI + r * 0.5 - time * 3);
          px(sx + x, sy + y, r > 8 ? 2 : [3, 2, 1, 2][((v % 4) + 4) % 4]);
        }
        break;
      default:
        if (isGate(ch)) {
          water(1, 2);
          if (!gateOpen(ch)) {
            const bob = Math.floor(time * 2 + wx) % 2;
            disc(sx + 8, sy + 9 + bob, 4.5, 3); disc(sx + 8, sy + 9 + bob, 3.5, 0);
            rect(sx + 5, sy + 9 + bob, 7, 2, 3); rect(sx + 7, sy + 2 + bob, 2, 4, 3); px(sx + 7, sy + 1 + bob, Math.floor(time * 4) % 2 ? 0 : 3);
          }
        } else rect(sx, sy, 16, 16, 3);
    }
  }
  function drawWading(rows, x, y, wet) {
    sprite(rows, x, y, wet ? 12 : 16);
    if (wet) for (let i = 0; i < 16; i++) if ((i + Math.floor(time * 6)) % 4 < 2) px(x + i, y + 12, 0);
  }
  function worldDraw() {
    const ox = ow.moving ? ow.dx * ow.t * 16 : 0, oy = ow.moving ? ow.dy * ow.t * 16 : 0;
    const camX = G.x * 16 + ox - 72, camY = G.y * 16 + oy - 64;
    const tx0 = Math.floor(camX / 16), ty0 = Math.floor(camY / 16);
    for (let ty = ty0; ty <= ty0 + 10; ty++)
      for (let tx = tx0; tx <= tx0 + 10; tx++) drawTile(tile(tx, ty), Math.round(tx * 16 - camX), Math.round(ty * 16 - camY), tx, ty);
    for (const n of NPCS) {
      const sx = Math.round(n.x * 16 - camX), sy = Math.round(n.y * 16 - camY);
      if (sx > -16 && sx < W && sy > -16 && sy < H) drawWading(SPR[n.spr], sx, sy, watery(tile(n.x, n.y)));
    }
    const frames = SPR['mech_' + G.dir];
    const fr = ow.moving ? (ow.t < 0.5 ? 1 + ow.frame : 0) : 0;
    const wet = watery(tile(G.x, G.y)) && (!ow.moving || watery(tile(G.x + ow.dx, G.y + ow.dy)));
    drawWading(frames[fr], 72, 64 - (fr ? 1 : 0), wet);
    if (ow.banner) { box(20, 4, 120, 13); textC(ow.banner.text, 8, 3); }
  }

  // ================= K41JU-DEX =================
  const dex = { i: 0, top: 0, back: 'world' };
  function openDex() { dex.back = mode; mode = 'dex'; }
  function dexUpdate() {
    if (pressed.up) { dex.i = (dex.i + KAIJU.length - 1) % KAIJU.length; sfx.blip(); }
    if (pressed.down) { dex.i = (dex.i + 1) % KAIJU.length; sfx.blip(); }
    dex.top = clamp(dex.top, dex.i - 9, dex.i);
    if (pressed.b || pressed.start) { mode = dex.back; sfx.blip(); }
    if (pressed.a) {
      const k = KAIJU[dex.i], st = G.dex[k.id] || 0;
      say(st ? [`${k.name}  CAT ${roman(k.cat)}${k.boss ? '  BOSS' : ''}`, k.bio] : ['NO DATA. FIND IT OUT THERE.']);
    }
  }
  function dexDraw() {
    rect(0, 0, W, H, 0);
    box(0, 0, 160, 15); text('K41JU-DEX', 6, 5, 3);
    const seen = KAIJU.filter((k) => G.dex[k.id]).length, won = KAIJU.filter((k) => G.dex[k.id] === 2).length;
    text(`SEEN ${seen} BEAT ${won}`, 96, 5, 2);
    for (let r = 0; r < 10; r++) {
      const i = dex.top + r, k = KAIJU[i];
      if (!k) break;
      const st = G.dex[k.id] || 0, y = 20 + r * 9;
      if (i === dex.i) text('>', 3, y, 3);
      text(String(i + 1).padStart(2, '0'), 8, y, 2);
      text(st ? k.name : '----------', 20, y, 3);
      if (st === 2) text('*', 64, y, 3);
    }
    const k = KAIJU[dex.i], st = G.dex[k.id] || 0, s = k.sprite;
    rect(84, 20, 72, 92, 1); rect(84, 20, 72, 1, 3); rect(84, 111, 72, 1, 3);
    for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
      const v = s.px[y * 48 + x];
      if (v !== CLEAR) px(96 + x, 26 + y, st ? v : 3);
    }
    textC(st ? k.name : '???', 80, 3, 120);
    textC(st ? `CAT ${roman(k.cat)}${k.boss ? ' BOSS' : ''}` : '', 90, 2, 120);
    textC(st === 2 ? 'DEFEATED' : st ? 'SIGHTED' : 'UNKNOWN', 100, 3, 120);
    text('A:READ  B:BACK', 4, 134, 2);
  }

  // ================= battle =================
  const F = 80, CAMH = 1, CX = 80, CY = 52;
  let B = null;

  function encounter(sp, lvl) {
    sfx.encounter(); AU.song = null;
    mode = 'trans';
    trans = { t: 0, sp, lvl };
  }
  let trans = null;
  function transUpdate(dt) { trans.t += dt; if (trans.t > 1.15) startBattle(trans.sp, trans.lvl); }
  function transDraw() {
    worldDraw();
    if (trans.t > 0.6) {
      const k = (trans.t - 0.6) / 0.5;
      rect(0, 0, W, Math.ceil(72 * k), 3); rect(0, H - Math.ceil(72 * k), W, 72, 3);
    }
  }

  function startBattle(sp, lvl) {
    const hpMax = Math.round(sp.hp * (1 + 0.28 * (lvl - 1)));
    B = {
      sp, lvl, boss: !!sp.boss, hp: hpMax, hpMax, atk: sp.atk * (1 + 0.12 * (lvl - 1)),
      h: 2.4 + sp.cat * 0.8, zMin: 2.6 + sp.cat * 0.3, kx: rnd(-2, 2), kz: 13, st: 'idle', t: 1.5,
      spd: (0.9 + 0.2 * sp.cat) * (sp.boss ? 1.2 : 1), flash: 0, hidden: false, empCd: 3, interrupted: false,
      px: 0, pitch: 12, wid: 'plasma', charge: 0, charging: false, cd: 0, drift: 50, stun: 0, emp: 0, odShots: 0, odT: 0,
      proj: [], shots: [], nums: [], msgs: [], bubbles: [], time: 0, shake: 0, hurt: 0, over: null, endT: 0, sink: 0,
      sector: sectorAt(G.y),
    };
    B.H0 = 52 + B.pitch;
    G.dex[sp.id] = Math.max(G.dex[sp.id] || 0, 1);
    mode = 'battle';
    music(B.boss ? 'boss' : 'battle');
    say([
      B.boss ? `${sp.name} RISES FROM THE DEEP! CATEGORY ${roman(sp.cat)}!` : `A WILD CAT-${roman(sp.cat)} K41JU SURFACED! IT'S ${sp.name}!`,
      'RAL3Y & MAK0: DR1FT ENGAGED!',
    ]);
  }

  function weapons() {
    const w = [{ id: 'plasma', name: 'PLASMA CANNON' }];
    if (G.lvl >= 3) w.push({ id: 'fist', name: 'ROCKET FIST' });
    if (G.lvl >= 6) w.push({ id: 'blade', name: 'CHAIN BLADE' });
    if (G.kits > 0) w.push({ id: 'kit', name: `REPAIR KIT x${G.kits}` });
    if (B.drift >= 100) w.push({ id: 'od', name: 'OVERDRIVE!' });
    if (!B.boss) w.push({ id: 'run', name: 'RETREAT' });
    return w;
  }
  const curWeapon = () => weapons().find((w) => w.id === B.wid) || (B.wid = 'plasma', weapons()[0]);

  function geom() {
    const H0 = 52 + B.pitch, z = B.kz;
    const water = H0 + F * CAMH / z, scale = (B.h * F / z) / 40;
    const cx = CX + (B.kx - B.px) * F / z;
    return { H0, water, scale, cx, left: cx - 24 * scale, top: water - 40 * scale + B.sink };
  }
  function hitTest() {
    if (B.hidden || B.over) return null;
    const g = geom(), s = B.sp.sprite;
    if (CY > g.water) return null;
    const lx = (CX - g.left) / g.scale, ly = (CY - g.top) / g.scale;
    let crit = false;
    for (const w of s.weak) if (Math.hypot(lx - w.x, ly - w.y) <= w.r + 1.5) crit = true;
    if (crit) return { crit: true };
    for (const [ox, oy] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
      const sx = Math.floor((CX + ox - g.left) / g.scale), sy = Math.floor((CY + oy - g.top) / g.scale);
      if (sx >= 0 && sy >= 0 && sx < 48 && sy < 48 && s.px[sy * 48 + sx] !== CLEAR) return { crit: false };
    }
    return null;
  }
  const flashMsg = (txt, t = 0.9) => B.msgs.push({ txt, t });

  function damageKaiju(base, crit, kind) {
    const d = Math.max(1, Math.round(base * (crit ? 2.5 : 1)));
    B.hp -= d; B.flash = 0.12;
    B.nums.push({ x: CX + rnd(-6, 6), y: CY - 6, txt: String(d), t: 0.8 });
    B.drift = Math.min(100, B.drift + (crit ? 12 : 6));
    crit ? sfx.crit() : sfx.hit();
    if (crit) flashMsg('CRITICAL!');
    if (B.st === 'wind_emp' && crit) { B.interrupted = true; flashMsg('EMP INTERRUPTED!'); }
    const heavy = kind === 'fist' || kind === 'blade' || d >= B.hpMax * (B.boss ? 0.2 : 0.15);
    if (heavy && B.hp > 0 && !B.hidden) {
      B.st = 'stagger'; B.t = B.boss ? 0.6 : 1.0;
      B.kz = Math.min(14, B.kz + (kind === 'fist' ? 2.5 : 1));
    }
    if (B.hp <= 0) winBattle();
  }
  function hurtPlayer(dmg, what) {
    if (B.over) return;
    const d = Math.max(1, Math.round(dmg));
    G.hp -= d; B.shake = 0.35; B.hurt = 0.12;
    B.nums.push({ x: CX, y: 80, txt: '-' + d, t: 0.9, me: true });
    flashMsg(what);
    sfx.hurt();
    B.drift -= 12;
    if (B.drift <= 0) { B.drift = 35; B.stun = 1.4; B.charging = false; B.charge = 0; flashMsg('DR1FT LOST! RE-SYNCING', 1.4); }
    if (G.hp <= 0) loseBattle();
  }

  function fire() {
    const w = curWeapon();
    if (B.emp > 0 && w.id !== 'kit' && w.id !== 'run') { sfx.bump(); flashMsg('WEAPONS OFFLINE!'); return; }
    if (w.id === 'kit') {
      G.kits--; G.hp = Math.min(maxHp(), G.hp + maxHp() * 0.45); sfx.heal(); flashMsg('REPAIRED!'); B.cd = 0.8;
      if (!G.kits) B.wid = 'plasma';
      return;
    }
    if (w.id === 'run') {
      if (Math.random() < 0.65) { B.over = 'run'; B.endT = 0.4; sfx.select(); }
      else { flashMsg("CAN'T ESCAPE!"); B.cd = 1; sfx.bump(); }
      return;
    }
    if (w.id === 'od') { B.drift = 30; B.odShots = 8; B.odT = 0; B.wid = 'plasma'; flashMsg('OVERDRIVE!', 1.2); return; }
    if (w.id === 'fist') {
      const h = hitTest();
      B.shots.push({ kind: 'fist', t: 0, dur: 0.35, h });
      B.cd = 2.6; sfx.fist();
      return;
    }
    if (w.id === 'blade') {
      B.cd = 1.4; sfx.blade();
      B.shots.push({ kind: 'slash', t: 0, dur: 0.2 });
      if (B.kz > B.zMin + 1.4) { flashMsg('TOO FAR!'); return; }
      const g = geom();
      const near = !B.hidden && Math.abs(g.cx - CX) < 30 * g.scale && CY < g.water;
      if (near) damageKaiju(34 * atkMul('blade'), !!hitTest()?.crit, 'blade');
      return;
    }
  }
  function firePlasma(charge, dmgOverride) {
    sfx.shoot(charge);
    B.shots.push({ kind: 'beam', t: 0, dur: 0.12, w: 1 + Math.round(charge * 2) });
    B.cd = 0.22;
    for (const p of B.proj) {
      const sx = CX + (p.x - B.px) * F / p.z, sy = B.H0 + F * (CAMH - p.y) / p.z;
      if (Math.hypot(sx - CX, sy - CY) < Math.max(4, 0.4 * F / p.z)) { p.dead = true; flashMsg('ACID SHOT DOWN!', 0.6); return; }
    }
    const h = hitTest();
    if (h) damageKaiju(dmgOverride ?? (5 + 13 * charge) * atkMul('plasma'), h.crit, 'plasma');
  }

  function kaijuThink() {
    const ab = B.sp.abil || [];
    if (B.kz <= B.zMin + 0.3) { B.st = 'wind_swipe'; B.t = Math.max(0.5, 1.05 - 0.08 * B.sp.cat); sfx.warn(); return; }
    const opts = [['approach', 4]];
    if (B.kz < 11) opts.push(['spit', 2]);
    if (ab.includes('volley') && B.kz < 11) opts.push(['volley', 1.5]);
    if (ab.includes('charge') && B.kz > 6) opts.push(['wind_charge', 1.3]);
    if (ab.includes('dash')) opts.push(['dash', 1.2]);
    if (ab.includes('dive') && B.kz > 4) opts.push(['dive', 1]);
    if (ab.includes('emp') && B.empCd <= 0) opts.push(['wind_emp', 2]);
    let r = Math.random() * opts.reduce((a, o) => a + o[1], 0), st = 'approach';
    for (const o of opts) if ((r -= o[1]) < 0) { st = o[0]; break; }
    B.st = st;
    if (st === 'approach') B.t = rnd(1, 2.4);
    if (st === 'spit') B.t = 0.7;
    if (st === 'volley') { B.t = 0.9; sfx.warn(); }
    if (st === 'wind_charge') { B.t = 0.8; sfx.roar(); }
    if (st === 'dash') { B.t = 0.45; B.dashTo = clamp(B.px + (Math.random() < 0.5 ? -1 : 1) * rnd(3, 5), -7, 7); }
    if (st === 'dive') { B.t = 1.6; B.hidden = true; sfx.splash(); B.diveTo = clamp(B.px + rnd(-1.5, 1.5), -7, 7); }
    if (st === 'wind_emp') { B.t = 1.8; B.empCd = 9; B.interrupted = false; sfx.emp(); flashMsg('EMP CHARGING! HIT THE GLOW!', 1.6); }
  }
  function spit(tx) {
    B.proj.push({ x: B.kx, z: B.kz - 0.2, y: B.h * 0.7, x0: B.kx, z0: B.kz - 0.2, y0: B.h * 0.7, tx, t: 0, dur: 1.15 });
  }
  function kaijuUpdate(dt) {
    B.empCd -= dt;
    const track = (k) => { B.kx += (B.px - B.kx) * k * dt; };
    switch (B.st) {
      case 'idle':
        B.kx += Math.sin(B.time * 1.3) * 0.7 * dt; track(0.25);
        if ((B.t -= dt) <= 0) kaijuThink();
        break;
      case 'approach':
        B.kz = Math.max(B.zMin, B.kz - B.spd * dt);
        B.kx += Math.sin(B.time * 2) * 0.8 * dt; track(0.4);
        if ((B.t -= dt) <= 0 || B.kz <= B.zMin) { B.st = 'idle'; B.t = rnd(0.2, 0.6); }
        break;
      case 'wind_swipe':
        if ((B.t -= dt) <= 0) {
          if (Math.abs(B.kx - B.px) < 1.5 + 0.1 * B.sp.cat) hurtPlayer(B.atk * (B.chargeHit ? 1.8 : 1.4), 'SWIPE!');
          else flashMsg('DODGED!');
          B.chargeHit = false; B.st = 'retreat'; B.t = 1;
        }
        break;
      case 'retreat':
        B.kz = Math.min(12, B.kz + 2.4 * dt);
        if ((B.t -= dt) <= 0) { B.st = 'idle'; B.t = rnd(0.3, 0.8); }
        break;
      case 'spit':
        if ((B.t -= dt) <= 0) { spit(B.px); B.st = 'idle'; B.t = rnd(0.6, 1.4); }
        break;
      case 'volley':
        if ((B.t -= dt) <= 0) { for (const o of [-2.2, 0, 2.2]) spit(B.px + o); B.st = 'idle'; B.t = rnd(0.9, 1.6); }
        break;
      case 'wind_charge':
        if ((B.t -= dt) <= 0) B.st = 'charge';
        break;
      case 'charge':
        B.kz -= 7 * dt; track(1.6);
        if (B.kz <= B.zMin) { B.kz = B.zMin; B.st = 'wind_swipe'; B.t = 0.4; B.chargeHit = true; sfx.warn(); }
        break;
      case 'dash':
        B.kx += clamp(B.dashTo - B.kx, -9 * dt, 9 * dt);
        if ((B.t -= dt) <= 0) { B.st = 'idle'; B.t = 0.3; }
        break;
      case 'dive':
        B.kx += clamp(B.diveTo - B.kx, -2 * dt, 2 * dt);
        if (Math.random() < 0.3) B.bubbles.push({ x: B.kx + rnd(-0.6, 0.6), z: B.kz, t: 0.6 });
        if ((B.t -= dt) <= 0) {
          B.hidden = false; B.kz = Math.max(B.zMin + 0.4, B.kz - 3); sfx.splash();
          B.st = 'idle'; B.t = 0.25;
        }
        break;
      case 'wind_emp':
        if (B.interrupted) { B.st = 'stagger'; B.t = 1.2; break; }
        if ((B.t -= dt) <= 0) { B.emp = 3; B.charging = false; B.charge = 0; flashMsg('EMP HIT! WEAPONS OFFLINE!', 1.5); B.st = 'idle'; B.t = 0.5; }
        break;
      case 'stagger':
        if ((B.t -= dt) <= 0) { B.st = 'idle'; B.t = 0.4; }
        break;
    }
    B.kx = clamp(B.kx, -7.5, 7.5);
  }

  function battleUpdate(dt) {
    B.time += dt;
    for (const k of ['flash', 'shake', 'hurt']) B[k] = Math.max(0, B[k] - dt);
    for (const a of [B.nums, B.msgs, B.bubbles]) for (const n of a) n.t -= dt;
    B.nums = B.nums.filter((n) => n.t > 0); B.bubbles = B.bubbles.filter((n) => n.t > 0);
    if (B.msgs.length && B.msgs[0].t <= 0) B.msgs.shift();
    for (const s of B.shots) s.t += dt;
    B.shots = B.shots.filter((s) => {
      if (s.kind === 'fist' && s.t >= s.dur && !s.done) { s.done = true; if (s.h && !B.over) damageKaiju(26 * atkMul('fist'), s.h.crit, 'fist'); }
      return s.t < s.dur + 0.05;
    });

    if (B.over) {
      if (B.over === 'win') B.sink += dt * 40;
      if ((B.endT -= dt) <= 0 && !B.ended) { B.ended = true; finishBattle(); }
      return;
    }

    // Player
    B.stun = Math.max(0, B.stun - dt); B.emp = Math.max(0, B.emp - dt); B.cd -= dt;
    if (B.stun <= 0) {
      if (held.left) B.px -= 3.3 * dt;
      if (held.right) B.px += 3.3 * dt;
      if (held.up) B.pitch += 85 * dt;
      if (held.down) B.pitch -= 85 * dt;
      B.px = clamp(B.px, -7, 7); B.pitch = clamp(B.pitch, -30, 170);
      if (pressed.b) {
        const ws = weapons(), i = ws.findIndex((w) => w.id === B.wid);
        B.wid = ws[(i + 1) % ws.length].id; sfx.blip(); B.charging = false; B.charge = 0;
      }
      const w = curWeapon();
      if (w.id === 'plasma') {
        const ok = B.cd <= 0 && B.emp <= 0;
        if (held.a && ok) { B.charging = true; B.charge = Math.min(1, B.charge + dt * 1.1); }
        if (B.charging && !held.a) { firePlasma(B.charge); B.charging = false; B.charge = 0; }
        else if (pressed.a && !held.a && ok) firePlasma(0.15);
        else if (pressed.a && B.emp > 0) flashMsg('WEAPONS OFFLINE!');
      } else if (pressed.a && B.cd <= 0) fire();
    }
    if (B.odShots > 0 && (B.odT -= dt) <= 0) { B.odShots--; B.odT = 0.13; firePlasma(1, 14 * atkMul('plasma')); }

    // K41JU and its acid
    if (B.hp > 0) kaijuUpdate(dt);
    B.H0 = 52 + B.pitch;
    for (const p of B.proj) {
      p.t += dt;
      const k = Math.min(1, p.t / p.dur);
      p.x = p.x0 + (p.tx - p.x0) * k; p.z = p.z0 + (0.35 - p.z0) * k; p.y = p.y0 + (CAMH - p.y0) * k + Math.sin(k * Math.PI) * 0.6;
      if (k >= 1 && !p.dead) {
        p.dead = true;
        if (Math.abs(p.x - B.px) < 0.85) hurtPlayer(B.atk * 0.9, 'ACID HIT!');
      }
    }
    B.proj = B.proj.filter((p) => !p.dead);
  }

  function winBattle() {
    B.over = 'win'; B.hp = 0; B.endT = 1.6; B.proj = [];
    sfx.roar(); AU.song = null;
  }
  function loseBattle() {
    B.over = 'lose'; G.hp = 0; B.endT = 1.4;
    sfx.lose(); AU.song = null;
  }
  function finishBattle() {
    const sp = B.sp;
    if (B.over === 'run') { say('GOT AWAY SAFELY!', endBattle); return; }
    if (B.over === 'lose') {
      say(['GYPSY R4NG3R IS DOWN...', 'MAK0 HAULED YOU BACK TO THE SH4TT3RD0ME. HALF THE SALVAGE WAS LOST.'], () => {
        G.salvage = Math.floor(G.salvage / 2); G.hp = maxHp(); G.x = 26; G.y = 36; G.dir = 'up'; ow.sector = 1;
        endBattle();
      });
      return;
    }
    sfx.win();
    const xp = Math.round((6 + 5 * B.lvl) * (B.boss ? 3 : 1)), sal = (2 + 2 * B.lvl) * (B.boss ? 3 : 1);
    G.xp += xp; G.salvage += sal;
    const first = G.dex[sp.id] !== 2;
    G.dex[sp.id] = 2;
    const msgs = [`${sp.name} NEUTRALIZED!`, `+${xp} XP   +${sal} SALVAGE`];
    if (first) msgs.push(`${sp.name} LOGGED IN THE K41JU-DEX.`);
    while (G.xp >= xpNeed()) {
      const before = maxHp();
      G.xp -= xpNeed(); G.lvl++;
      G.hp += maxHp() - before;
      msgs.push(() => sfx.level(), `GYPSY R4NG3R GREW TO LV ${G.lvl}!`);
      if (G.lvl === 3) msgs.push('NEW WEAPON: ROCKET FIST! PRESS B IN BATTLE TO SWITCH.');
      if (G.lvl === 6) msgs.push('NEW WEAPON: CHAIN BLADE! GET IN CLOSE TO USE IT.');
    }
    if (B.boss && G.boss < sp.boss) {
      G.boss = sp.boss;
      if (sp.boss < 5) msgs.push(`THE BUOY LINE TO SECTOR ${sp.boss + 1} HAS BEEN LOWERED!`);
      else msgs.push('TH3 BR34CH COLLAPSES IN ON ITSELF...', 'IT IS SEALED. THE K41JU WAR IS OVER.', 'THANKS FOR PLAYING PAC1F1C R1M!');
    }
    G.hp = Math.min(G.hp, maxHp());
    let queue = [];
    for (const m of msgs) {
      if (typeof m === 'function') { if (queue.length) { say(queue); queue = []; } dlg.pages.push(m); } else queue.push(m);
    }
    say(queue, endBattle);
  }
  function endBattle() {
    B = null; mode = 'world'; G.grace = 3; music('world'); save();
  }

  // ---- battle drawing ----
  const CLOUDS = [[20, -38, 14], [90, -44, 10], [150, -30, 16], [220, -40, 12]];
  const TOWERS = Array.from({ length: 24 }, (_, i) => ({ x: i * 14 + ((i * 37) % 9), w: 6 + ((i * 13) % 7), h: 4 + ((i * 29) % 13) }));
  function drawBattleWorld() {
    const g = geom(), H0 = g.H0, sec = B.sector, t = B.time;
    const dark = sec === 5;
    rect(0, 0, W, Math.max(0, Math.min(104, H0)), dark ? 3 : 0);
    if (dark) {
      for (let i = 0; i < 40; i++) px(((i * 53 - B.px * 3) % 160 + 160) % 160, H0 - 10 - ((i * 31) % 90), (i + Math.floor(t * 2)) % 7 ? 2 : 1);
      const rx = 80 - B.px * 6;
      for (let y = 0; y < 40; y++) {
        const wob = Math.sin(y * 0.7 + t * 6) * 2, wd = 6 * (1 - y / 44);
        rect(rx + wob - wd - 2, H0 - y, wd * 2 + 4, 1, 1); rect(rx + wob - wd, H0 - y, wd * 2, 1, 0);
      }
    } else {
      for (const [x, y, r] of CLOUDS) {
        const cx = ((x - B.px * 5) % 240 + 240) % 240 - 40;
        for (let j = -r / 3; j < r / 3; j++) for (let i = -r; i < r; i++)
          if ((i * i) / (r * r) + (j * j * 9) / (r * r) < 1 && (i + j) & 1) px(cx + i, H0 + y + j, 1);
      }
      if (sec <= 2) {
        for (const b of TOWERS) {
          const x = ((b.x - B.px * 9) % 340 + 340) % 340 - 10;
          rect(x, H0 - b.h, b.w, b.h, 2);
          for (let j = 2; j < b.h - 1; j += 3) px(x + 2, H0 - b.h + j, 1);
        }
      }
      if (sec === 1) {
        const bx = -B.px * 12;
        rect(0, H0 - 5, W, 1, 3);
        for (const tx of [40, 120]) { rect(bx + tx, H0 - 18, 2, 18, 3); line(bx + tx, H0 - 18, bx + tx - 40, H0 - 5, 2); line(bx + tx + 1, H0 - 18, bx + tx + 41, H0 - 5, 2); }
      }
    }
    // Mode-7 ocean
    for (let y = Math.max(0, Math.floor(H0) + 1); y < 104; y++) {
      const z = F * CAMH / (y - H0);
      const row = y * W, band = Math.floor(z * 0.8 + t * 1.5);
      for (let x = 0; x < W; x++) {
        const xw = B.px + (x - 80) * z / F;
        let c;
        if (z > 16) c = (x + y) & 1 ? (dark ? 2 : 1) : 2;
        else c = (Math.floor(xw * 0.9) + band) & 1 ? (dark ? 3 : 2) : (dark ? 2 : 1);
        if (z < 10 && ((Math.floor(xw * 2.5 + Math.sin(z * 3 + t * 2) * 1.5) + Math.floor(z * 3)) % 9 === 0)) c = 0;
        fb[row + x] = c;
      }
    }
    if (H0 >= 0 && H0 < 104) rect(0, H0, W, 1, dark ? 1 : 2);
    if (B.sector === 4) for (let i = 0; i < 30; i++) { const x = Math.random() * W, y = Math.random() * 100; line(x, y, x - 2, y + 5, 1); }
    return g;
  }
  function drawKaiju(g) {
    const s = B.sp.sprite, sc = g.scale, top = g.top, left = g.left;
    const yA = Math.max(0, Math.ceil(top)), yB = Math.min(Math.floor(g.water), 103);
    const xA = Math.max(0, Math.ceil(left)), xB = Math.min(W - 1, Math.floor(left + 48 * sc));
    const fl = B.flash > 0;
    for (let y = yA; y <= yB; y++) {
      const sy = Math.floor((y - top) / sc);
      if (sy < 0 || sy >= 48) continue;
      for (let x = xA; x <= xB; x++) {
        const sx = Math.floor((x - left) / sc);
        if (sx < 0 || sx >= 48) continue;
        const v = s.px[sy * 48 + sx];
        if (v !== CLEAR) fb[y * W + x] = fl ? (v === 3 ? 3 : 0) : v;
      }
    }
    if (B.over !== 'win') {
      const on = Math.floor(B.time * 5) % 2;
      for (const w of s.weak) {
        const wx = left + w.x * sc, wy = top + w.y * sc;
        if (wy > g.water || wy > 103) continue;
        const r = Math.max(1, w.r * sc * 0.7);
        disc(wx, wy, r + 1, 3); disc(wx, wy, r, on ? 0 : 1);
        if (B.st === 'wind_emp') ring(wx, wy, r + 3 + (Math.floor(B.time * 8) % 3), 0);
      }
    }
    if (g.water >= 0 && g.water < 104) for (let x = Math.floor(left + 8 * sc); x < left + 40 * sc; x++) if ((x + Math.floor(B.time * 8)) % 3) px(x, g.water, 0);
    if (B.st.startsWith('wind') && Math.floor(B.time * 8) % 2) {
      const y = clamp(top - 18, 8, 80), x = clamp(g.cx, 20, 140);
      big('!', x - 4, y, 3, 3); big('!', x - 5, y - 1, 0, 3);
    }
  }
  function drawProj(g) {
    for (const p of B.proj) {
      const sx = CX + (p.x - B.px) * F / p.z, sy = g.H0 + F * (CAMH - p.y) / p.z, r = Math.min(36, 0.35 * F / p.z);
      disc(sx, sy, r + 1, 3); disc(sx, sy, r, 1); disc(sx - r / 3, sy - r / 3, r / 3, 0);
    }
    for (const b of B.bubbles) {
      const z = b.z, sx = CX + (b.x - B.px) * F / z, sy = g.H0 + F * CAMH / z - (0.6 - b.t) * 20;
      if (sy < 104) ring(sx, sy, 1 + (0.6 - b.t) * 4, 0);
    }
  }
  function drawShots() {
    for (const s of B.shots) {
      const k = s.t / s.dur;
      if (s.kind === 'beam' && k < 1) {
        for (let o = 0; o < s.w; o++) { line(18 + o, 103, CX, CY, 0); line(142 - o, 103, CX, CY, 0); }
        disc(CX, CY, 3 + s.w, k < 0.5 ? 0 : 1);
      }
      if (s.kind === 'fist' && k < 1) {
        const x = CX, y = 104 + (CY - 104) * k, sz = 14 * (1 - k) + 3;
        rect(x - sz / 2, y - sz / 2, sz, sz, 3); rect(x - sz / 2 + 1, y - sz / 2 + 1, sz - 2, sz / 3, 1);
        line(x, y + sz / 2, x, y + sz / 2 + 8 * (1 - k), 0);
      }
      if (s.kind === 'slash' && k < 1) {
        for (let o = -2; o <= 2; o++) line(20, 20 + o + k * 20, 140, 90 + o - k * 20, o === 0 ? 0 : 1);
      }
    }
  }
  function drawCockpit() {
    for (let y = 0; y < 104; y++) {
      const wd = Math.round(13 - y * 0.06);
      rect(0, y, wd, 1, 3); rect(W - wd, y, wd, 1, 3);
      px(wd, y, 2); px(W - wd - 1, y, 2);
    }
    rect(0, 0, W, 2, 3);
    // Crosshair, inverted against whatever is behind it.
    const inv = (x, y) => px(x, y, fb[(y | 0) * W + (x | 0)] < 2 ? 3 : 0);
    for (let i = 3; i <= 7; i++) { inv(CX - i, CY); inv(CX + i, CY); inv(CX, CY - i); inv(CX, CY + i); }
    inv(CX, CY);
    if (B.charging) ring(CX, CY, 11 - B.charge * 6, B.charge >= 1 && Math.floor(B.time * 12) % 2 ? 3 : 0);
    // Where is it?
    if (!B.hidden && !B.over) {
      const g = geom(), blink = Math.floor(B.time * 4) % 2;
      if (blink) {
        if (g.cx < 12) big('<', 16, CY - 7, 0, 3);
        else if (g.cx > 148) big('>', 132, CY - 7, 0, 3);
        else if (g.top > 100) big('v', CX - 5, 82, 0, 3);
        else if (g.water < 4) big('^', CX - 5, 8, 0, 3);
      }
    }
  }
  function drawHud() {
    // Target box
    box(18, 3, 124, 16);
    text(`${B.sp.name} :L${B.lvl}`, 24, 7, 3);
    text(`CAT ${roman(B.sp.cat)}`, 136 - textW(`CAT ${roman(B.sp.cat)}`), 7, 2);
    bar(24, 13, 112, 3, B.hp / B.hpMax, 1);
    // Console
    rect(0, 104, W, 40, 3); rect(0, 105, W, 1, 2);
    text(`GYPSY R4NG3R LV${G.lvl}`, 4, 108, 0);
    text(`KITS ${G.kits}`, 156 - textW(`KITS ${G.kits}`), 108, 1);
    text('HP', 4, 116, 1); bar(16, 115, 92, 6, G.hp / maxHp(), G.hp / maxHp() < 0.3 && Math.floor(B.time * 4) % 2 ? 1 : 0);
    text(`${Math.max(0, Math.ceil(G.hp))}/${maxHp()}`, 112, 116, 0);
    text('DR1FT', 4, 124, 1); bar(26, 123, 82, 6, B.drift / 100, B.drift >= 100 && Math.floor(B.time * 6) % 2 ? 1 : 0);
    text(`${Math.round(B.drift)}%`, 112, 124, B.drift >= 100 ? 0 : 1);
    const w = curWeapon();
    text('A>' + w.name, 4, 134, 0);
    const ready = w.id === 'plasma' ? B.charge : B.cd > 0 ? 1 - B.cd / 2.6 : 1;
    if (w.id === 'plasma' || w.id === 'fist' || w.id === 'blade') bar(84, 133, 30, 6, B.emp > 0 ? 0 : ready, 0);
    text('B:SWAP', 132, 134, 1);
    if (B.stun > 0 || B.emp > 0) for (let i = 0; i < 14; i++) rect(0, Math.random() * 104, W, 1, Math.random() < 0.5 ? 0 : 3);
    for (const n of B.nums) text(n.txt, n.x - textW(n.txt) / 2, n.y - (0.9 - n.t) * 16, n.me ? 3 : 0);
    if (B.msgs.length) {
      const m = B.msgs[0];
      rect(80 - textW(m.txt) / 2 - 3, 70, textW(m.txt) + 6, 9, 3);
      textC(m.txt, 72, 0);
    }
  }
  function battleDraw() {
    const g = drawBattleWorld();
    if (!B.hidden) drawKaiju(g);
    drawProj(g);
    drawShots();
    drawCockpit();
    drawHud();
  }

  // ================= title =================
  const title = { i: 0 };
  function titleUpdate() {
    const items = saved ? 2 : 1;
    if (pressed.up || pressed.down) { title.i = (title.i + 1) % items; sfx.blip(); }
    if (pressed.select) { G.pal = (G.pal + 1) % PALETTES.length; setPalette(G.pal); }
    if (pressed.a || pressed.start) {
      sfx.select();
      if (saved && title.i === 1) {
        G = Object.assign(newGame(), saved);
        AU.on = G.sound !== false;
        if (AU.master) AU.master.gain.value = AU.on ? 0.16 : 0;
        ow.sector = sectorAt(G.y);
        mode = 'world'; music('world');
        say(`WELCOME BACK, RAL3Y. GYPSY R4NG3R LV ${G.lvl}.`);
      } else {
        const pal = G.pal;
        G = newGame(); G.pal = pal;
        mode = 'world'; music('world');
        say(MARSHAL[0].map((l) => 'MARSHAL ST4CK: ' + l).concat(['MAK0: I WILL BE IN YOUR HEAD THE WHOLE TIME. LET\'S GO.']), save);
      }
    }
  }
  function titleDraw() {
    rect(0, 0, W, H, 0);
    const k = KAIJU[11].sprite;
    for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
      const v = k.px[y * 48 + x];
      if (v !== CLEAR) rect(56 + x * 2, 36 + y * 2 + Math.sin(time) * 2, 2, 2, v === 3 ? 3 : 2);
    }
    for (let y = 92; y < H; y++) for (let x = 0; x < W; x++) {
      const v = Math.floor(x / 6 + Math.sin(y * 0.5 + time * 2) * 2 + y) % 5;
      fb[y * W + x] = y < 96 ? 2 : v === 0 ? 1 : (x + y) & 1 ? 2 : 3;
    }
    const m = SPR.mech_up[0];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (m[y][x] !== '.') rect(8 + x * 3, 74 + y * 3, 3, 3, +m[y][x]);
    big('PAC1F1C', 5, 6, 3, 3); big('R1M', 92, 6, 3, 3);
    rect(5, 24, 150, 1, 3);
    textC('8-BIT K41JU DEFENSE', 28, 2);
    box(84, 100, 72, saved ? 26 : 17);
    text('NEW GAME', 96, 107, 3);
    if (saved) text('CONTINUE', 96, 116, 3);
    text('>', 90, 107 + title.i * 9, 3);
    rect(0, 130, W, 14, 3);
    if (Math.floor(time * 2) % 2) text('PRESS A', 6, 135, 0);
    text('FAN TRIBUTE - NOT AFFILIATED', 46, 135, 1);
  }

  // ================= loop =================
  let last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min(0.1, (now - last) / 1000); last = now;
    while (acc >= 1 / 60) {
      acc -= 1 / 60;
      step(1 / 60);
    }
    render();
    requestAnimationFrame(frame);
  }
  function step(dt) {
    time += dt;
    pollInput();
    if (dialogUpdate(dt)) return;
    if (menus.length) return menuUpdate();
    if (mode === 'title') titleUpdate();
    else if (mode === 'world') worldUpdate(dt);
    else if (mode === 'trans') transUpdate(dt);
    else if (mode === 'battle') battleUpdate(dt);
    else if (mode === 'dex') dexUpdate();
  }
  function render() {
    let shx = 0, shy = 0, inv = false;
    if (mode === 'title') titleDraw();
    else if (mode === 'world') worldDraw();
    else if (mode === 'trans') { transDraw(); inv = trans.t < 0.6 && Math.floor(trans.t * 10) % 2 === 0; }
    else if (mode === 'battle' && B) {
      battleDraw();
      if (B.shake > 0) { shx = rnd(-3, 3); shy = rnd(-2, 2); }
      inv = B.hurt > 0;
    } else if (mode === 'dex') dexDraw();
    for (const m of menus) menuDraw(m);
    dialogDraw();
    present(shx, shy, inv);
  }
  music('title');
  requestAnimationFrame(frame);

  // Exposed for testing in the console.
  window.__pr = { get G() { return G; }, get B() { return B; }, get mode() { return mode; }, encounter: (id, l) => encounter(byId(id), l) };
})();
