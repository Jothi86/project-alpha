// game.js — M3TAL INV4D3RS. Classic invaders with a run-and-gun soul.
// One endless stage: every wave is faster and meaner, a boss every 5th wave,
// and a shared high-score board at /api/scores.

(() => {
  'use strict';

  // ---------- setup ----------
  const $ = (id) => document.getElementById(id);
  const cv = $('cv');
  const ctx = cv.getContext('2d');
  const buf = document.createElement('canvas');
  const b = buf.getContext('2d');
  const SPR = ART.build((w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; });

  const H = 270;
  const GROUND = 252;
  let W = 480, S = 1, OX = 0, OY = 0, DPR = 1;
  const IS_TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  const KEY = 'm3tal-inv4d3rs';
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  };
  const opts = Object.assign({ sound: true, voice: true, autofire: IS_TOUCH }, LS.get(KEY + '-opts', {}));
  let best = LS.get(KEY + '-best', 0);
  let callsign = LS.get(KEY + '-name', null);
  if (!callsign) {
    const names = ['MARC0', 'F10', '3R1', 'T4RMA', 'N4D1A', 'TR3VOR', 'R4LF', 'CL4RK', 'L30NA'];
    callsign = names[Math.floor(Math.random() * names.length)] + '-' + (10 + Math.floor(Math.random() * 90));
    LS.set(KEY + '-name', callsign);
  }

  const rnd = (a, b2) => a + Math.random() * (b2 - a);
  const clamp = (v, a, b2) => (v < a ? a : v > b2 ? b2 : v);
  const fmt = (n) => Math.floor(n).toLocaleString('en-US');

  // ---------- sound ----------
  const sfx = (() => {
    let ac = null, master = null, noiseBuf = null, hmgFlip = 0;
    function init() {
      if (ac) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.45;
      master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const on = () => opts.sound && ac && ac.state === 'running';
    function noise(dur, freq, vol, sweep = 0.3, type = 'lowpass') {
      if (!on()) return;
      const t = ac.currentTime;
      const src = ac.createBufferSource();
      src.buffer = noiseBuf;
      src.playbackRate.value = rnd(0.8, 1.2);
      const f = ac.createBiquadFilter();
      f.type = type;
      f.frequency.setValueAtTime(freq, t);
      f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
      const g = ac.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f).connect(g).connect(master);
      src.start(t, rnd(0, 0.5));
      src.stop(t + dur + 0.02);
    }
    function tone(freq, dur, type = 'square', vol = 0.15, slide = 0, delay = 0) {
      if (!on()) return;
      const t = ac.currentTime + delay;
      const o = ac.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
      const g = ac.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + dur + 0.02);
    }
    return {
      unlock() { init(); if (ac && ac.state === 'suspended') ac.resume(); },
      shot(k) {
        if (k === 'H') { if ((hmgFlip ^= 1)) noise(0.06, 3000, 0.22, 0.4, 'bandpass'); return; }
        if (k === 'R' || k === 'shell') { noise(0.25, 900, 0.3, 0.2); tone(180, 0.15, 'sawtooth', 0.08, 60); return; }
        if (k === 'F') { noise(0.3, 1400, 0.2, 0.3, 'bandpass'); return; }
        if (k === 'S') { noise(0.22, 2200, 0.35, 0.15); return; }
        if (k === 'L') { tone(rnd(900, 1100), 0.05, 'sawtooth', 0.04, 500); return; }
        noise(0.08, 2600, 0.22, 0.3, 'bandpass');
        tone(700, 0.05, 'square', 0.04, 300);
      },
      boom(size = 1) {
        noise(0.35 + size * 0.25, 600 + size * 300, 0.35 + size * 0.15, 0.08);
        tone(90, 0.3 + size * 0.2, 'sine', 0.25, 30);
      },
      hit() { tone(rnd(300, 360), 0.04, 'square', 0.05, 150); },
      clang() { tone(1400, 0.06, 'square', 0.05, 900); },
      pickup() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.09, 'square', 0.09, 0, i * 0.06)); },
      hurt() { tone(400, 0.4, 'sawtooth', 0.15, 60); noise(0.3, 1200, 0.25, 0.1); },
      march(i) { const notes = [98, 87, 78, 73]; tone(notes[i % 4], 0.12, 'triangle', 0.22, notes[i % 4] * 0.9); noise(0.03, 5000, 0.04, 0.5, 'highpass'); },
      bossMarch(i) { const notes = [65, 65, 78, 58]; tone(notes[i % 4], 0.14, 'sawtooth', 0.12, notes[i % 4] * 0.8); noise(0.05, 300, 0.2, 0.3); },
      warn() { tone(880, 0.12, 'square', 0.08, 0); tone(660, 0.12, 'square', 0.08, 0, 0.14); },
      voice(text) {
        if (!opts.sound || !opts.voice || !('speechSynthesis' in window)) return;
        try {
          speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(text);
          u.pitch = 0.4; u.rate = 1.05; u.volume = 1;
          speechSynthesis.speak(u);
        } catch { /* no voices */ }
      },
    };
  })();

  // ---------- data ----------
  const WEAP = {
    P: { name: 'PISTOL', cd: 0.17 },
    H: { name: 'HEAVY MACHINE GUN', cd: 0.065, ammo: 160, say: 'Heavy machine gun!' },
    R: { name: 'ROCKET LAUNCHER', cd: 0.32, ammo: 24, say: 'Rocket launcher!' },
    F: { name: 'FLAME SHOT', cd: 0.28, ammo: 30, say: 'Flame shot!' },
    S: { name: 'SHOTGUN', cd: 0.45, ammo: 20, say: 'Shotgun!' },
    L: { name: 'LASER GUN', cd: 0.05, ammo: 110, say: 'Laser gun!' },
  };
  const KIND = {
    grunt: { hp: 1, pts: 10, shot: 'grenade' },
    ufo: { hp: 1, pts: 40, shot: 'laser' },
    crab: { hp: 2, pts: 20, shot: 'bubble' },
    mummy: { hp: 2, pts: 30, shot: 'breath' },
    shield: { hp: 4, pts: 60, shot: 'grenade' },
    jet: { hp: 2, pts: 50, shot: 'laser', diver: true },
    split: { hp: 2, pts: 40, shot: 'bubble', split: true },
    mini: { hp: 1, pts: 20, shot: 'laser' },
  };
  const UNLOCK = [['grunt', 1], ['ufo', 1], ['crab', 2], ['mummy', 3], ['shield', 4], ['jet', 6], ['split', 7]];
  const BOSSES = ['H41RBUST3R R1B3RTS', 'RUGN4M3', 'B1G SH13E'];
  const THEMES = [
    { sky: ['#f6c27a', '#f9e2a8'], far: '#d79a5c', mid: '#b5743f', ground: '#e0b874', dark: '#a8783f' }, // desert noon
    { sky: ['#c4506a', '#f59a5c'], far: '#8a3e4e', mid: '#5e2c3c', ground: '#c98a5a', dark: '#8a5434' }, // dusk
    { sky: ['#0d1430', '#2a3a6a'], far: '#1c2648', mid: '#121a34', ground: '#4a4a5a', dark: '#2a2a36' }, // night city
    { sky: ['#9fc8e8', '#e6f2f8'], far: '#b8c8d8', mid: '#8898a8', ground: '#e8eef2', dark: '#a8b4c0' }, // snow
  ];

  // ---------- state ----------
  const G = { mode: 'title', t: 0, score: 0, lives: 3, wave: 0, waveT: 0, phase: 'intro', phaseT: 0, nextLife: 20000,
    combo: 0, comboT: 0, mult: 1, freeze: 0, shake: 0, runT: 0, kills: 0, step: 0, stepT: 0, powT: 12, diveT: 6,
    fireAcc: 0, token: null, runId: null, god: false, theme: 0, submitted: null };
  let P = null;
  let enemies = [], pb = [], eb = [], fx = [], floats = [], drops = [], bunkers = [], pows = [], nades = [], caps = [];
  let boss = null;
  const form = { x: 0, y: 0, ty: 0, dir: 1, speed: 10, cw: 26, ch: 19, cols: 0, rows: 0, drop: 6, total: 1 };
  let bgCache = null, bgKey = '';
  const clouds = Array.from({ length: 6 }, () => ({ x: rnd(0, 600), y: rnd(8, 90), s: rnd(4, 12), w: rnd(30, 70) }));

  function newPlayer() {
    return { x: W / 2, tx: null, cd: 0, bcd: 0, weapon: 'P', ammo: Infinity, bombs: 10, tank: 0, inv: 2, dead: 0,
      mummy: 0, moving: false, anim: 0, laser: 0, flash: 0, face: 1 };
  }

  // ---------- layout ----------
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    const iw = window.innerWidth, ih = window.innerHeight;
    W = IS_TOUCH ? 432 : clamp(Math.round((H * iw) / ih), 400, 560);
    S = Math.min(iw / W, ih / H);
    OX = (iw - W * S) / 2;
    OY = (ih - H * S) / 2;
    cv.width = Math.round(iw * DPR);
    cv.height = Math.round(ih * DPR);
    buf.width = W;
    buf.height = H;
    bgCache = null;
    placeBunkers();
    if (P) P.x = clamp(P.x, 8, W - 8);
    const rot = IS_TOUCH && ih > iw;
    $('rotate').classList.toggle('show', rot);
    if (rot && G.mode === 'play') pause();
  }

  // ---------- bunkers ----------
  const BCW = 16, BCH = 7, BC = 2;
  function makeBunkers() {
    const n = W >= 470 ? 5 : 4;
    bunkers = Array.from({ length: n }, () => ({ m: ART.bunkerMask(BCW, BCH), c: null, dirty: true, x: 0, y: 0 }));
    placeBunkers();
  }
  function placeBunkers() {
    const n = bunkers.length;
    bunkers.forEach((bk, i) => { bk.x = Math.round(((i + 1) * W) / (n + 1) - (BCW * BC) / 2); bk.y = GROUND - 46; });
  }
  // Erodes the bunker under (x, y). Returns true if a sandbag was there.
  function bunkerHit(x, y, rad = 1) {
    for (const bk of bunkers) {
      if (x < bk.x || x >= bk.x + BCW * BC || y < bk.y || y >= bk.y + BCH * BC) continue;
      const ci = Math.floor((x - bk.x) / BC), cj = Math.floor((y - bk.y) / BC);
      if (!bk.m[cj * BCW + ci]) continue;
      for (let dj = -rad; dj <= rad; dj++) {
        for (let di = -rad; di <= rad; di++) {
          const i = ci + di, j = cj + dj;
          if (i < 0 || j < 0 || i >= BCW || j >= BCH) continue;
          if (di * di + dj * dj <= rad * rad + 1 && Math.random() < 0.75) bk.m[j * BCW + i] = 0;
        }
      }
      bk.m[cj * BCW + ci] = 0;
      bk.dirty = true;
      for (let k = 0; k < 3; k++) fx.push({ t: 'debris', x, y, vx: rnd(-40, 40), vy: rnd(-60, -10), life: 0.5, max: 0.5, col: '#c9a66b' });
      return true;
    }
    return false;
  }
  function bunkerClearRect(x0, y0, x1, y1) {
    for (const bk of bunkers) {
      if (x1 < bk.x || x0 > bk.x + BCW * BC || y1 < bk.y || y0 > bk.y + BCH * BC) continue;
      for (let j = 0; j < BCH; j++) {
        for (let i = 0; i < BCW; i++) {
          const cx = bk.x + i * BC, cy = bk.y + j * BC;
          if (cx + BC > x0 && cx < x1 && cy + BC > y0 && cy < y1 && bk.m[j * BCW + i]) { bk.m[j * BCW + i] = 0; bk.dirty = true; }
        }
      }
    }
  }
  function drawBunker(bk) {
    if (bk.dirty || !bk.c) {
      if (!bk.c) { bk.c = document.createElement('canvas'); bk.c.width = BCW * BC; bk.c.height = BCH * BC; }
      const x = bk.c.getContext('2d');
      x.clearRect(0, 0, bk.c.width, bk.c.height);
      for (let j = 0; j < BCH; j++) {
        for (let i = 0; i < BCW; i++) {
          if (!bk.m[j * BCW + i]) continue;
          const seam = (i + (j % 2) * 2) % 4 === 0;
          x.fillStyle = seam ? '#8f7244' : j % 2 ? '#c9a66b' : '#d8b77c';
          x.fillRect(i * BC, j * BC, BC, BC);
          if (j === 0 || !bk.m[(j - 1) * BCW + i]) { x.fillStyle = '#efd49a'; x.fillRect(i * BC, j * BC, BC, 1); }
        }
      }
      bk.dirty = false;
    }
    b.drawImage(bk.c, bk.x, bk.y);
  }

  // ---------- waves ----------
  function diff(n) {
    return {
      fireRate: Math.min(4.2, 0.55 + (n - 1) * 0.17),
      bulletSp: Math.min(2.3, 1 + (n - 1) * 0.06),
      speed: Math.min(62, 10 + n * 1.7),
      diveEvery: Math.max(1.1, 7 - n * 0.32),
      hpBonus: Math.floor((n - 1) / 6),
      aim: Math.min(0.7, 0.2 + n * 0.03),
    };
  }
  function startWave(n) {
    G.wave = n;
    G.waveT = 0;
    G.phase = 'intro';
    G.phaseT = 1.6;
    eb = [];
    enemies = [];
    boss = null;
    const newTheme = Math.floor((n - 1) / 5) % THEMES.length;
    if (newTheme !== G.theme) { G.theme = newTheme; bgCache = null; }
    if (n % 5 === 0) {
      spawnBoss(n);
      caption('WARNING!', 2, '#ff3b3b', 18);
      caption(bossName(n), 2, '#ffd23a', 9, 150);
      sfx.warn();
      sfx.voice('Warning!');
    } else {
      buildFormation(n);
      caption(n === 1 ? 'MISSION START!' : 'WAVE ' + n, 1.6, '#ffd23a', 16);
      if (n === 1) sfx.voice('Mission start!');
    }
  }
  const bossName = (n) => BOSSES[(Math.floor(n / 5) - 1) % BOSSES.length];
  function buildFormation(n) {
    const cols = Math.min(11, 6 + Math.floor((n + 1) / 2));
    const rows = Math.min(6, 3 + Math.floor(n / 3));
    const d = diff(n);
    const pool = UNLOCK.filter(([, w]) => n >= w).map(([k]) => k);
    const rowKinds = [];
    for (let r = 0; r < rows; r++) {
      if (r === 0) rowKinds.push(pool.includes('jet') && Math.random() < 0.4 ? 'jet' : 'ufo');
      else if (r === rows - 1 && n < 4) rowKinds.push('grunt');
      else {
        const rest = pool.filter((k) => k !== 'ufo');
        rowKinds.push(rest[Math.floor(Math.random() * rest.length)]);
      }
    }
    Object.assign(form, { cols, rows, dir: Math.random() < 0.5 ? 1 : -1, speed: d.speed, drop: 6 + Math.min(6, n * 0.3) });
    form.x = W / 2 - ((cols - 1) * form.cw) / 2;
    form.ty = 30 + Math.min(42, (n - 1) * 3);
    form.y = form.ty - 120;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const kind = rowKinds[r];
        const k = KIND[kind];
        enemies.push({ kind, col: c, row: r, hp: k.hp + d.hpBonus, max: k.hp + d.hpBonus, state: 'form',
          x: 0, y: 0, w: SPR[kind].w, h: SPR[kind].h, flash: 0, t: rnd(0, 6) });
      }
    }
    form.total = enemies.length;
    G.diveT = d.diveEvery + 2;
  }

  // ---------- boss ----------
  function spawnBoss(n) {
    const cycle = Math.floor(n / 5) - 1;
    const kind = cycle % 3;
    const mul = 1 + 0.6 * cycle;
    const rate = 1 + 0.15 * cycle;
    const part = (dx, dy, w, h, hp) => ({ dx, dy, w, h, hp: hp * mul, max: hp * mul, alive: true, flash: 0, cd: rnd(0.5, 1.5) });
    boss = { kind, cycle, mul, rate, t: 0, x: W / 2, y: -50, ty: 50, hp: 0, max: 0, flash: 0, dying: 0, atk: 4, beam: null, bombing: 0, bombCd: 0, spawnCd: 8 };
    if (kind === 0) {
      boss.core = { dx: 0, dy: -4, w: 40, h: 16 };
      boss.hp = boss.max = 90 * mul;
      boss.parts = [part(-46, 4, 16, 12, 30), part(46, 4, 16, 12, 30)];
    } else if (kind === 1) {
      boss.core = { dx: 0, dy: -10, w: 30, h: 14 };
      boss.hp = boss.max = 100 * mul;
      boss.parts = [part(-48, 14, 14, 10, 26), part(0, 16, 14, 10, 26), part(48, 14, 14, 10, 26)];
    } else {
      boss.core = { dx: 0, dy: -14, w: 22, h: 16 };
      boss.ty = 46;
      boss.hp = boss.max = 110 * mul;
      boss.parts = [part(-62, 2, 14, 12, 28), part(0, 6, 14, 12, 28), part(62, 2, 14, 12, 28)];
    }
  }
  const rectOf = (o) => ({ x0: boss.x + o.dx - o.w / 2, y0: boss.y + o.dy - o.h / 2, x1: boss.x + o.dx + o.w / 2, y1: boss.y + o.dy + o.h / 2 });
  const inRect = (x, y, r, pad = 0) => x >= r.x0 - pad && x <= r.x1 + pad && y >= r.y0 - pad && y <= r.y1 + pad;

  function aimShot(x, y, speed, kind = 'aimed') {
    const a = Math.atan2(GROUND - 10 - y, P.x - x);
    eb.push({ kind, x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 2.5, t: 0 });
  }

  function updateBoss(dt) {
    const bs = boss;
    bs.t += dt;
    if (bs.flash > 0) bs.flash -= dt;
    bs.parts.forEach((p) => { if (p.flash > 0) p.flash -= dt; });
    if (bs.dying > 0) {
      bs.dying -= dt;
      bs.y += dt * 12;
      if (Math.random() < dt * 22) boom(bs.x + rnd(-70, 70), bs.y + rnd(-18, 18), rnd(0.6, 1.4), false);
      G.shake = Math.max(G.shake, 3);
      if (bs.dying <= 0) {
        boom(bs.x, bs.y, 3);
        for (let i = 0; i < 12; i++) boom(bs.x + rnd(-80, 80), bs.y + rnd(-20, 20), rnd(1, 2), false);
        G.freeze = 0.15;
        addScore(5000 * (bs.cycle + 1), bs.x, bs.y, true);
        boss = null;
        caption('MISSION COMPLETE!', 2.4, '#ffd23a', 14);
        sfx.voice('Mission complete!');
        makeBunkers();
      }
      return;
    }
    // Enter, then drift.
    if (!bs.entered) { bs.y = Math.min(bs.ty, bs.y + dt * 40); if (bs.y >= bs.ty) bs.entered = true; return; }
    const amp = W / 2 - 90;
    if (bs.kind === 0) { bs.x = W / 2 + Math.sin(bs.t * 0.5) * amp; bs.y = bs.ty + Math.sin(bs.t * 1.3) * 4; }
    else if (bs.kind === 1) { bs.x = W / 2 + Math.sin(bs.t * 0.35) * (amp + 10); bs.y = bs.ty + Math.sin(bs.t * 0.9) * 6; }
    else { bs.x = W / 2 + Math.sin(bs.t * 0.25) * Math.max(10, amp - 30); }
    if (G.phase !== 'play' || !P || P.dead) return;

    const sp = diff(G.wave).bulletSp;
    // Parts shoot.
    bs.parts.forEach((p, i) => {
      if (!p.alive) return;
      p.cd -= dt * bs.rate;
      if (p.cd > 0) return;
      const x = bs.x + p.dx, y = bs.y + p.dy + p.h / 2;
      if (bs.kind === 0) { aimShot(x, y, 85 * sp); p.cd = 1.7; }
      else if (bs.kind === 1) {
        for (let k = -1; k <= 1; k++) eb.push({ kind: 'bubble', x, y, vx: k * 30, vy: 55 * sp, r: 3, t: rnd(0, 6) });
        p.cd = 2.3 + i * 0.2;
      } else { aimShot(x, y, 95 * sp, 'shell'); p.cd = 1.5; }
    });
    // Special attack.
    bs.atk -= dt * bs.rate;
    if (bs.kind === 0) {
      if (bs.atk <= 0 && !bs.bombing) { bs.bombing = 2.2; bs.atk = 6.5; sfx.warn(); }
      if (bs.bombing > 0) {
        bs.bombing -= dt;
        if (bs.bombing < 1.4) {
          bs.bombCd -= dt;
          if (bs.bombCd <= 0) { eb.push({ kind: 'bomb', x: bs.x + rnd(-6, 6), y: bs.y + 10, vx: 0, vy: 40, r: 3, t: 0 }); bs.bombCd = 0.13; }
        }
        if (bs.bombing <= 0) bs.bombing = 0;
      }
    } else if (bs.kind === 1) {
      if (bs.atk <= 0 && !bs.beam) { bs.beam = { x: P.x, t: 0 }; bs.atk = 7; sfx.warn(); }
      if (bs.beam) {
        bs.beam.t += dt;
        if (bs.beam.t > 1.0 && bs.beam.t < 1.9) {
          if (Math.abs(P.x - bs.beam.x) < 9) hurtPlayer();
          bunkerClearRect(bs.beam.x - 8, 0, bs.beam.x + 8, H);
          if (Math.random() < 0.5) fx.push({ t: 'spark', x: bs.beam.x + rnd(-8, 8), y: GROUND, vx: rnd(-60, 60), vy: rnd(-90, -30), life: 0.3, max: 0.3, col: '#c9f6ff' });
        }
        if (bs.beam.t > 1.9) bs.beam = null;
      }
      bs.spawnCd -= dt;
      if (bs.spawnCd <= 0) {
        bs.spawnCd = Math.max(4, 9 - bs.cycle);
        for (let k = 0; k < 2; k++) {
          enemies.push({ kind: 'ufo', col: 0, row: 0, hp: 1 + bs.cycle, max: 1, state: 'dive', x: bs.x + (k ? 20 : -20), y: bs.y + 10,
            w: SPR.ufo.w, h: SPR.ufo.h, flash: 0, t: 0, vx: k ? 40 : -40, vy: 70, free: true });
        }
      }
    } else if (bs.atk <= 0) {
      bs.atk = 6;
      sfx.warn();
      for (let k = 0; k < 4; k++) {
        eb.push({ kind: 'missile', x: bs.x + (k - 1.5) * 24, y: bs.y - 10, vx: (k - 1.5) * 20, vy: -70, r: 3, t: 0, hp: 1 });
      }
    }
  }

  function damageBoss(x, y, dmg, rad = 1) {
    if (!boss || boss.dying || !boss.entered) return false;
    for (const p of boss.parts) {
      if (p.alive && inRect(x, y, rectOf(p), rad)) {
        p.hp -= dmg;
        p.flash = 0.06;
        sfx.clang();
        if (p.hp <= 0) {
          p.alive = false;
          boom(boss.x + p.dx, boss.y + p.dy, 1.5);
          G.freeze = 0.08;
          addScore(1000, boss.x + p.dx, boss.y + p.dy, true);
        }
        return true;
      }
    }
    if (inRect(x, y, rectOf(boss.core), rad) || inRect(x, y, { x0: boss.x - 60, y0: boss.y - 14, x1: boss.x + 60, y1: boss.y + 12 }, rad)) {
      boss.hp -= dmg;
      boss.flash = 0.05;
      sfx.hit();
      if (boss.hp <= 0) { boss.dying = 2.4; eb = []; sfx.voice('Great!'); }
      return true;
    }
    return false;
  }

  function drawBoss() {
    const bs = boss;
    const cx = Math.round(bs.x), cy = Math.round(bs.y);
    const px = (x, y, w, h, c) => { b.fillStyle = c; b.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    const ol = (x, y, w, h, c) => { px(x - 1, y - 1, w + 2, h + 2, '#1a1410'); px(x, y, w, h, c); };
    const hit = bs.flash > 0;
    if (bs.kind === 0) {
      // Bomber: wings, fuselage, glass cockpit.
      ol(cx - 78, cy - 2, 156, 7, hit ? '#fff' : '#5d6670');
      px(cx - 78, cy - 2, 156, 2, '#8a939c');
      ol(cx - 56, cy - 10, 112, 20, hit ? '#fff' : '#7a9a3e');
      px(cx - 56, cy - 10, 112, 4, '#9aba5e');
      px(cx - 56, cy + 6, 112, 4, '#4f6a28');
      for (let i = -48; i < 48; i += 12) px(cx + i, cy - 1, 6, 2, '#4f6a28');
      ol(cx - 20, cy - 12, 40, 8, '#6fe6ff');
      px(cx - 18, cy - 12, 10, 3, '#e8fbff');
      ol(cx - 12, cy + 8, 24, 4, bs.bombing > 0 ? (Math.floor(bs.t * 12) % 2 ? '#ff3b3b' : '#1a1410') : '#4f6a28');
      ol(cx - 70, cy - 16, 8, 12, '#7a9a3e');
      ol(cx + 62, cy - 16, 8, 12, '#7a9a3e');
      px(cx - 4, cy - 26, 8, 2, '#e03a2e');
    } else if (bs.kind === 1) {
      // Mothership: a pixel disc with a glowing dome.
      for (let j = -14; j <= 14; j++) {
        const w = Math.round(Math.sqrt(1 - (j / 15) ** 2) * 78);
        px(cx - w - 1, cy + j * 0.8, w * 2 + 2, 1, '#1a1410');
      }
      for (let j = -13; j <= 13; j++) {
        const w = Math.round(Math.sqrt(1 - (j / 15) ** 2) * 76);
        px(cx - w, cy + j * 0.8, w * 2, 1, hit ? '#fff' : j < -4 ? '#b8c2cc' : j < 4 ? '#8a939c' : '#5d6670');
      }
      for (let i = -66; i <= 66; i += 12) px(cx + i - 1, cy - 1, 3, 3, Math.floor(bs.t * 6 + i) % 3 ? '#ffd23a' : '#ff8a2a');
      ol(cx - 15, cy - 20, 30, 12, '#6fe6ff');
      px(cx - 12, cy - 18, 8, 4, '#e8fbff');
      px(cx - 4, cy - 15, 8, 6, Math.floor(bs.t * 4) % 2 ? '#ff3b3b' : '#9c1f1a');
    } else {
      // Land battleship: stepped hull, bridge tower, smoke stacks.
      ol(cx - 96, cy - 4, 192, 16, hit ? '#fff' : '#5d6670');
      ol(cx - 86, cy - 12, 172, 9, hit ? '#fff' : '#7a838c');
      px(cx - 96, cy + 8, 192, 4, '#39404a');
      for (let i = -90; i < 90; i += 10) px(cx + i, cy + 2, 5, 3, '#39404a');
      ol(cx - 30, cy - 22, 10, 10, '#4a4f56');
      ol(cx + 20, cy - 22, 10, 10, '#4a4f56');
      ol(cx - 11, cy - 22, 22, 16, hit ? '#fff' : '#9a5a3a');
      px(cx - 8, cy - 18, 16, 3, Math.floor(bs.t * 3) % 2 ? '#ffd23a' : '#ff8a2a');
      if (Math.random() < 0.3) fx.push({ t: 'smoke', x: cx + (Math.random() < 0.5 ? -25 : 25), y: cy - 24, vx: rnd(-5, 5), vy: -18, life: 1.2, max: 1.2, r: 3 });
    }
    // Parts.
    bs.parts.forEach((p) => {
      const r = rectOf(p);
      if (!p.alive) { px(r.x0, r.y0 + 2, p.w, p.h - 2, '#2a2a2a'); return; }
      const c = p.flash > 0 ? '#fff' : bs.kind === 1 ? '#9a5ad8' : '#a7b0ba';
      ol(r.x0, r.y0, p.w, p.h, c);
      if (bs.kind === 0) { // propeller blur
        px(r.x0 - 4, r.y1, p.w + 8, 1, Math.floor(bs.t * 30) % 2 ? '#e8e8e8' : '#8a8a8a');
      } else if (bs.kind === 2) { // barrel pointing at the player
        const a = Math.atan2(GROUND - (bs.y + p.dy), (P ? P.x : W / 2) - (bs.x + p.dx));
        for (let s = 4; s < 13; s++) px(bs.x + p.dx + Math.cos(a) * s - 1, bs.y + p.dy + Math.sin(a) * s - 1, 3, 3, '#39404a');
      } else {
        px(r.x0 + 3, r.y1 - 3, p.w - 6, 2, Math.floor(bs.t * 8) % 2 ? '#ff3b3b' : '#ffd23a');
      }
      if (p.hp < p.max * 0.4 && Math.random() < 0.2) fx.push({ t: 'smoke', x: (r.x0 + r.x1) / 2, y: r.y0, vx: rnd(-5, 5), vy: -15, life: 0.8, max: 0.8, r: 2 });
    });
    // Beam (mothership).
    if (bs.beam) {
      const bx = Math.round(bs.beam.x);
      if (bs.beam.t < 1.0) {
        if (Math.floor(bs.beam.t * 16) % 2) px(bx, cy + 12, 1, GROUND - cy - 12, '#ff3b3b');
        px(bx - 8, GROUND - 2, 16, 2, '#ff3b3b');
      } else {
        const w = 14 + Math.sin(bs.t * 50) * 2;
        b.globalAlpha = 0.5; px(bx - w / 2 - 3, cy + 10, w + 6, GROUND - cy - 10, '#6fe6ff'); b.globalAlpha = 1;
        px(bx - w / 2, cy + 10, w, GROUND - cy - 10, '#c9f6ff');
        px(bx - 2, cy + 10, 4, GROUND - cy - 10, '#ffffff');
      }
    }
  }

  // ---------- effects ----------
  function boom(x, y, size = 1, sound = true) {
    fx.push({ t: 'flash', x, y, life: 0.08, max: 0.08, r: 8 * size });
    const n = Math.round(8 * size);
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2), s = rnd(10, 50) * size;
      fx.push({ t: 'fire', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 15, life: rnd(0.3, 0.6), max: 0.6, r: rnd(2, 5) * size });
    }
    for (let i = 0; i < n / 2; i++) fx.push({ t: 'debris', x, y, vx: rnd(-80, 80) * size, vy: rnd(-120, -20), life: rnd(0.5, 0.9), max: 0.9, col: '#2a221c' });
    fx.push({ t: 'smoke', x, y, vx: 0, vy: -12, life: 1, max: 1, r: 4 * size });
    G.shake = Math.max(G.shake, 1.5 * size);
    if (sound) sfx.boom(size);
  }
  function caption(text, dur, col, size, y = 110) {
    caps = caps.filter((c) => c.y !== y);
    caps.push({ text, t: 0, dur, col, size, y });
  }
  function floatText(text, x, y, col = '#fff') { floats.push({ text, x, y, t: 0, col }); }

  function addScore(base, x, y, flat = false) {
    const v = Math.round(flat ? base : base * (1 + (G.wave - 1) * 0.1) * G.mult);
    G.score += v;
    if (x != null) floatText(fmt(v), x, y, flat ? '#ffd23a' : '#fff');
    while (G.score >= G.nextLife) {
      G.lives++;
      G.nextLife += 20000;
      caption('1UP!', 1.4, '#5dffa8', 14, 140);
      sfx.pickup();
    }
  }

  // ---------- player ----------
  function hurtPlayer(breath = false) {
    if (!P || P.dead || P.inv > 0 || G.god) return;
    if (P.tank) {
      P.tank--;
      P.inv = 1.2;
      sfx.hurt();
      boom(P.x, GROUND - 8, 0.8, false);
      if (!P.tank) { boom(P.x, GROUND - 8, 2); P.inv = 2; caption('EJECT!', 1.2, '#ff8a2a', 12, 140); }
      return;
    }
    if (breath && !P.mummy) { P.mummy = 5; P.inv = 0.6; sfx.hurt(); caption('MUMMIFIED!', 1.2, '#ece2c6', 12, 140); return; }
    killPlayer();
  }
  function killPlayer() {
    if (!P || P.dead || G.god) return;
    P.dead = 1.6;
    P.tank = 0;
    P.mummy = 0;
    P.weapon = 'P';
    P.ammo = Infinity;
    G.combo = 0;
    G.mult = 1;
    G.lives--;
    boom(P.x, GROUND - 8, 1.2);
    sfx.hurt();
    for (let i = 0; i < 6; i++) fx.push({ t: 'debris', x: P.x, y: GROUND - 10, vx: rnd(-60, 60), vy: rnd(-140, -60), life: 1, max: 1, col: i % 2 ? '#3f6fd8' : '#e03a2e' });
  }

  function fire() {
    const gx = P.x + (P.tank ? 0 : 2), gy = GROUND - 18;
    if (P.tank) {
      pb.push({ kind: 'shell', x: P.x, y: GROUND - 18, vx: 0, vy: -300, dmg: 4, r: 3, splash: 20 });
      P.cd = 0.24;
      sfx.shot('shell');
      return;
    }
    const w = P.weapon;
    const slow = P.mummy > 0 ? 1.8 : 1;
    if (w === 'P') pb.push({ kind: 'P', x: gx, y: gy, vx: 0, vy: -360, dmg: 1, r: 1.5 });
    else if (w === 'H') pb.push({ kind: 'H', x: gx + rnd(-1.5, 1.5), y: gy, vx: rnd(-18, 18), vy: -380, dmg: 1, r: 1.5 });
    else if (w === 'R') pb.push({ kind: 'R', x: gx, y: gy, vx: 0, vy: -120, dmg: 3, r: 2.5, splash: 16, t: 0 });
    else if (w === 'F') pb.push({ kind: 'F', x: gx, y: gy, vx: 0, vy: -210, dmg: 2, r: 3, pierce: true, hits: new Set(), t: 0 });
    else if (w === 'S') {
      for (let k = -2; k <= 2; k++) {
        const a = -Math.PI / 2 + k * 0.17;
        pb.push({ kind: 'S', x: gx, y: gy, vx: Math.cos(a) * 340, vy: Math.sin(a) * 340, dmg: 2, r: 2, life: 0.4 });
      }
      fx.push({ t: 'flash', x: gx, y: gy, life: 0.06, max: 0.06, r: 8 });
    } else if (w === 'L') {
      P.laser = 0.09;
      const hitE = enemies.filter((e) => !e.dead && Math.abs(e.x - gx) < e.w / 2 + 3 && e.y < gy);
      hitE.forEach((e) => damageEnemy(e, 1));
      if (boss) for (let y = gy; y > 0; y -= 6) { if (damageBoss(gx, y, 1, 2)) break; }
      pows.forEach((p) => { if (p.state === 'float' && Math.abs(p.x - gx) < 6) freePow(p); });
      eb.forEach((m) => { if (m.kind === 'missile' && Math.abs(m.x - gx) < 5) m.dead = true; });
    }
    P.cd = WEAP[w].cd * slow;
    sfx.shot(w);
    if (w !== 'P') {
      P.ammo--;
      if (P.ammo <= 0) { P.weapon = 'P'; P.ammo = Infinity; }
    }
  }
  function throwBomb() {
    if (!P || P.dead || P.bombs <= 0 || P.bcd > 0 || G.mode !== 'play') return;
    P.bombs--;
    P.bcd = 0.4;
    nades.push({ x: P.x, y: GROUND - 16, vy: -255, t: 0 });
    sfx.shot('P');
  }
  function explode(x, y, r, dmg) {
    boom(x, y, r / 18);
    enemies.forEach((e) => { if (!e.dead && Math.hypot(e.x - x, e.y - y) < r + e.w / 2) damageEnemy(e, dmg); });
    if (boss) {
      for (const p of boss.parts) if (p.alive && Math.hypot(boss.x + p.dx - x, boss.y + p.dy - y) < r + p.w / 2) damageBoss(boss.x + p.dx, boss.y + p.dy, dmg);
      if (Math.abs(boss.x - x) < 60 + r && Math.abs(boss.y - y) < 14 + r) damageBoss(boss.x, boss.y, dmg * 0.6, 100);
    }
    eb.forEach((m) => { if (m.kind === 'missile' && Math.hypot(m.x - x, m.y - y) < r) m.dead = true; });
  }

  // ---------- enemies ----------
  function damageEnemy(e, dmg) {
    if (e.dead) return;
    e.hp -= dmg;
    e.flash = 0.06;
    if (e.hp > 0) { (e.kind === 'shield' ? sfx.clang : sfx.hit)(); return; }
    e.dead = true;
    G.kills++;
    G.combo++;
    G.comboT = 2.2;
    G.mult = 1 + Math.min(4, Math.floor(G.combo / 8) * 0.5);
    addScore(KIND[e.kind].pts, e.x, e.y - 6);
    boom(e.x, e.y, e.kind === 'mini' ? 0.5 : 0.8);
    if (KIND[e.kind].split) {
      for (const s of [-1, 1]) {
        enemies.push({ kind: 'mini', col: 0, row: 0, hp: 1, max: 1, state: 'dive', x: e.x + s * 4, y: e.y, w: SPR.mini.w, h: SPR.mini.h,
          flash: 0, t: 0, vx: s * 70, vy: 60, free: true });
      }
    }
  }
  function enemyShoot(e) {
    const sp = diff(G.wave).bulletSp;
    const shot = KIND[e.kind].shot;
    const y = e.y + e.h / 2;
    if (shot === 'grenade') eb.push({ kind: 'grenade', x: e.x, y, vx: rnd(-12, 12), vy: 60 * sp, r: 2, t: 0 });
    else if (shot === 'laser') eb.push({ kind: 'laser', x: e.x, y, vx: 0, vy: 140 * sp, r: 1.5, t: 0 });
    else if (shot === 'bubble') eb.push({ kind: 'bubble', x: e.x, y, vx: 0, vy: 50 * sp, r: 3, t: rnd(0, 6) });
    else if (shot === 'breath') eb.push({ kind: 'breath', x: e.x, y, vx: 0, vy: 55 * sp, r: 4, t: 0 });
  }

  function updateEnemies(dt) {
    const d = diff(G.wave);
    let minX = Infinity, maxX = -Infinity, alive = 0, lowY = -Infinity;
    const bottoms = new Map();
    for (const e of enemies) {
      if (e.dead) continue;
      e.t += dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.state === 'form') {
        alive++;
        minX = Math.min(minX, form.x + e.col * form.cw - e.w / 2);
        maxX = Math.max(maxX, form.x + e.col * form.cw + e.w / 2);
        const cur = bottoms.get(e.col);
        if (!cur || e.row > cur.row) bottoms.set(e.col, e);
      }
    }
    // Move the block side to side, faster as it thins out.
    const thin = form.total ? 1 - alive / form.total : 0;
    const sf = 1 + 1.8 * thin * thin + (alive <= 3 ? 1 : 0);
    if (G.phase === 'intro') form.y = Math.min(form.ty, form.y + dt * 110);
    else if (alive) {
      form.x += form.dir * form.speed * sf * dt;
      if (form.dir > 0 && maxX > W - 6) { form.dir = -1; form.y += form.drop; form.x -= maxX - (W - 6); }
      else if (form.dir < 0 && minX < 6) { form.dir = 1; form.y += form.drop; form.x += 6 - minX; }
    }
    // March beat.
    G.stepT -= dt;
    if (G.stepT <= 0) {
      G.step++;
      G.stepT = boss ? 0.42 : clamp(0.8 / sf / (1 + G.wave * 0.03), 0.11, 0.8);
      if (boss) sfx.bossMarch(G.step); else if (alive) sfx.march(G.step);
    }
    for (const e of enemies) {
      if (e.dead) continue;
      if (e.state === 'form') {
        e.x = form.x + e.col * form.cw;
        e.y = form.y + e.row * form.ch + (e.kind === 'ufo' || e.kind === 'jet' ? Math.sin(e.t * 3) * 1.5 : 0);
        lowY = Math.max(lowY, e.y + e.h / 2);
        if (e.y + e.h / 2 > bunkers[0]?.y) bunkerClearRect(e.x - e.w / 2, e.y - e.h / 2, e.x + e.w / 2, e.y + e.h / 2);
      } else if (e.state === 'dive') {
        e.vx += ((P && !P.dead ? P.x : W / 2) - e.x) * dt * 1.1;
        e.vx = clamp(e.vx, -110, 110);
        e.x += (e.vx + Math.sin(e.t * 5) * 30) * dt;
        e.y += e.vy * d.bulletSp * dt;
        if (!e.shot && e.y > 110) { e.shot = true; enemyShoot(e); }
        if (e.y > H + 16) {
          if (e.free) e.dead = true;
          else { e.state = 'return'; e.y = -16; e.shot = false; }
        }
      } else if (e.state === 'return') {
        const tx = form.x + e.col * form.cw, ty = form.y + e.row * form.ch;
        e.x += (tx - e.x) * Math.min(1, dt * 3);
        e.y += (ty - e.y) * Math.min(1, dt * 3);
        if (Math.abs(tx - e.x) < 1 && Math.abs(ty - e.y) < 1) e.state = 'form';
      }
      // Touching the player.
      if (P && !P.dead && e.state !== 'form' && Math.abs(e.x - P.x) < e.w / 2 + 4 && Math.abs(e.y - (GROUND - 9)) < e.h / 2 + 7) {
        hurtPlayer();
        damageEnemy(e, 99);
      }
    }
    enemies = enemies.filter((e) => !e.dead);
    if (G.phase !== 'play' || !P) return;

    // Reaching the ground = invasion.
    if (lowY > GROUND - 22 && !P.dead) {
      caption('INVADED!', 1.4, '#ff3b3b', 14, 140);
      killPlayer();
      G.freeze = 0.1;
      form.y = Math.max(24, form.y - 70);
    }
    if (P.dead) return;
    // Fire from the bottom of a column; later waves aim for the player.
    G.fireAcc += dt * d.fireRate * (alive ? 1 : 0);
    while (G.fireAcc >= 1) {
      G.fireAcc -= rnd(0.6, 1.2);
      const cols = [...bottoms.values()];
      if (!cols.length) break;
      let e = cols[Math.floor(Math.random() * cols.length)];
      if (Math.random() < d.aim) e = cols.reduce((a, c) => (Math.abs(c.x - P.x) < Math.abs(a.x - P.x) ? c : a));
      enemyShoot(e);
    }
    // Divers.
    if (G.wave >= 3 && alive > 2) {
      G.diveT -= dt;
      if (G.diveT <= 0) {
        G.diveT = d.diveEvery;
        const form1 = enemies.filter((e) => e.state === 'form');
        const jets = form1.filter((e) => KIND[e.kind].diver);
        const pick = (jets.length && Math.random() < 0.7 ? jets : G.wave >= 6 ? form1 : jets);
        if (pick.length) {
          const e = pick[Math.floor(Math.random() * pick.length)];
          e.state = 'dive'; e.vx = rnd(-40, 40); e.vy = 70 + G.wave * 2; e.t = 0;
        }
      }
    }
  }

  // ---------- POWs & pickups ----------
  function spawnPow() {
    const dir = Math.random() < 0.5 ? 1 : -1;
    pows.push({ state: 'float', x: dir > 0 ? -12 : W + 12, y: 22, vx: dir * 24, vy: 0, t: 0 });
  }
  function freePow(p) {
    if (p.state !== 'float') return;
    p.state = 'fall';
    p.vy = 45;
    fx.push({ t: 'flash', x: p.x, y: p.y - 14, life: 0.08, max: 0.08, r: 6 });
    for (let i = 0; i < 6; i++) fx.push({ t: 'debris', x: p.x, y: p.y - 14, vx: rnd(-50, 50), vy: rnd(-50, 20), life: 0.6, max: 0.6, col: '#e03a2e' });
    sfx.hit();
  }
  function rollDrop() {
    const table = [['H', 24], ['R', 15], ['F', 14], ['S', 15], ['L', 10], ['G', 16], ['T', G.wave >= 3 && !P.tank ? 7 : 0]];
    let r = Math.random() * table.reduce((a, [, w]) => a + w, 0);
    for (const [k, w] of table) { if ((r -= w) < 0) return k; }
    return 'H';
  }
  function updatePows(dt) {
    for (const p of pows) {
      p.t += dt;
      if (p.state === 'float') {
        p.x += p.vx * dt;
        p.y = 22 + Math.sin(p.t * 2) * 3;
        if (p.x < -20 || p.x > W + 20) p.dead = true;
      } else if (p.state === 'fall') {
        p.y += p.vy * dt;
        if (p.y >= GROUND - 7) { p.y = GROUND - 7; p.state = 'thank'; p.t = 0; addScore(500, p.x, p.y - 16, true); }
      } else if (p.state === 'thank') {
        if (p.t > 0.9) {
          p.state = 'run';
          p.vx = p.x < W / 2 ? -70 : 70;
          drops.push({ kind: rollDrop(), x: p.x, y: GROUND - 14, vy: -80, t: 0 });
        }
      } else if (p.state === 'run') {
        p.x += p.vx * dt;
        if (p.x < -20 || p.x > W + 20) p.dead = true;
      }
    }
    pows = pows.filter((p) => !p.dead);
    for (const d of drops) {
      d.t += dt;
      d.vy += 300 * dt;
      d.y = Math.min(GROUND - 6, d.y + d.vy * dt);
      if (d.t > 9) d.dead = true;
      if (P && !P.dead && Math.abs(d.x - P.x) < 12 && d.y > GROUND - 20) { pickup(d.kind); d.dead = true; }
    }
    drops = drops.filter((d) => !d.dead);
  }
  function pickup(kind) {
    sfx.pickup();
    if (kind === 'G') { P.bombs = Math.min(30, P.bombs + 5); caption('BOMB +5', 1.2, '#ffd23a', 12, 140); return; }
    if (kind === 'T') { P.tank = 3; P.inv = 0.5; caption('M3TAL SLUG!', 1.4, '#6fe6ff', 14, 140); sfx.voice('Metal Slug!'); return; }
    const w = WEAP[kind];
    if (P.weapon === kind) P.ammo += w.ammo;
    else { P.weapon = kind; P.ammo = w.ammo; }
    caption(w.name + '!', 1.4, '#ffd23a', 11, 140);
    sfx.voice(w.say);
  }

  // ---------- bullets ----------
  function updateBullets(dt) {
    const homing = (bl) => {
      let tgt = null, bd = 1e9;
      for (const e of enemies) { const dd = Math.hypot(e.x - bl.x, e.y - bl.y); if (dd < bd && e.y < bl.y) { bd = dd; tgt = e; } }
      if (!tgt && boss && !boss.dying) tgt = { x: boss.x, y: boss.y };
      return tgt;
    };
    for (const bl of pb) {
      if (bl.kind === 'R') {
        bl.t += dt;
        bl.vy = Math.max(-340, bl.vy - 500 * dt);
        const tg = homing(bl);
        if (tg) bl.vx += clamp(tg.x - bl.x, -1, 1) * 600 * dt;
        bl.vx *= 0.92;
        if (Math.random() < 0.6) fx.push({ t: 'smoke', x: bl.x, y: bl.y + 4, vx: 0, vy: 10, life: 0.4, max: 0.4, r: 1.5 });
      }
      if (bl.kind === 'F') { bl.t += dt; bl.r = 3 + bl.t * 14; }
      bl.x += bl.vx * dt;
      bl.y += bl.vy * dt;
      if (bl.life != null && (bl.life -= dt) <= 0) bl.dead = true;
      if (bl.y < -12 || bl.x < -12 || bl.x > W + 12) bl.dead = true;
      if (bl.dead) continue;
      // Your own shots pass over your sandbags; only enemy fire wears them down.
      // POW balloons.
      for (const p of pows) {
        if (p.state === 'float' && Math.abs(bl.x - p.x) < 7 && bl.y > p.y - 24 && bl.y < p.y + 8) { freePow(p); if (!bl.pierce) bl.dead = true; }
      }
      if (bl.dead) continue;
      // Boss missiles can be shot down.
      for (const m of eb) {
        if (m.kind === 'missile' && !m.dead && Math.hypot(m.x - bl.x, m.y - bl.y) < 5 + bl.r) { m.dead = true; boom(m.x, m.y, 0.6); addScore(50, m.x, m.y); if (!bl.pierce) bl.dead = true; }
      }
      if (bl.dead) continue;
      for (const e of enemies) {
        if (e.dead || (bl.hits && bl.hits.has(e))) continue;
        if (Math.abs(e.x - bl.x) < e.w / 2 + bl.r && Math.abs(e.y - bl.y) < e.h / 2 + bl.r) {
          if (bl.splash) { explode(bl.x, bl.y, bl.splash, 1); damageEnemy(e, bl.dmg); bl.dead = true; break; }
          damageEnemy(e, bl.dmg);
          if (bl.pierce) bl.hits.add(e);
          else { bl.dead = true; break; }
        }
      }
      if (bl.dead) continue;
      if (boss && damageBoss(bl.x, bl.y, bl.pierce ? bl.dmg * dt * 8 : bl.dmg, bl.r)) {
        if (bl.splash) explode(bl.x, bl.y, bl.splash, 1);
        if (!bl.pierce) bl.dead = true;
        fx.push({ t: 'spark', x: bl.x, y: bl.y, vx: rnd(-40, 40), vy: rnd(-20, 40), life: 0.2, max: 0.2, col: '#fff6c0' });
      }
    }
    pb = pb.filter((bl) => !bl.dead);

    for (const e of eb) {
      e.t += dt;
      if (e.kind === 'bubble') e.x += Math.sin(e.t * 6) * 20 * dt;
      if (e.kind === 'bomb') e.vy += 200 * dt;
      if (e.kind === 'missile') {
        if (e.t > 0.6 && P) {
          const a = Math.atan2(GROUND - 8 - e.y, P.x - e.x);
          const cur = Math.atan2(e.vy, e.vx);
          let da = a - cur;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          const na = cur + clamp(da, -2.4 * dt, 2.4 * dt);
          const sp = Math.min(120 * diff(G.wave).bulletSp, Math.hypot(e.vx, e.vy) + 120 * dt);
          e.vx = Math.cos(na) * sp; e.vy = Math.sin(na) * sp;
        }
        if (Math.random() < 0.5) fx.push({ t: 'smoke', x: e.x, y: e.y, vx: 0, vy: 0, life: 0.4, max: 0.4, r: 1.5 });
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.y > GROUND - 1) {
        e.dead = true;
        if (e.kind === 'bomb' || e.kind === 'grenade' || e.kind === 'missile' || e.kind === 'shell') {
          const r = e.kind === 'bomb' ? 16 : 9;
          boom(e.x, GROUND - 3, r / 14, e.kind !== 'grenade');
          if (P && !P.dead && Math.abs(P.x - e.x) < r) hurtPlayer();
        }
        continue;
      }
      if (e.y < -30 || e.x < -20 || e.x > W + 20) { e.dead = true; continue; }
      if (bunkerHit(e.x, e.y, e.kind === 'bomb' || e.kind === 'grenade' || e.kind === 'shell' ? 2 : 1)) {
        e.dead = true;
        if (e.kind === 'bomb' || e.kind === 'missile') boom(e.x, e.y, 0.7);
        continue;
      }
      if (P && !P.dead) {
        const hw = P.tank ? 10 : 4, top = P.tank ? GROUND - 14 : GROUND - 15;
        if (Math.abs(e.x - P.x) < hw + e.r && e.y > top - e.r && e.y < GROUND) {
          e.dead = true;
          hurtPlayer(e.kind === 'breath');
        }
      }
    }
    eb = eb.filter((e) => !e.dead);

    for (const n of nades) {
      n.t += dt;
      n.vy += 240 * dt;
      n.y += n.vy * dt;
      let hit = n.vy >= 0;
      for (const e of enemies) if (!e.dead && Math.abs(e.x - n.x) < e.w / 2 + 2 && Math.abs(e.y - n.y) < e.h / 2 + 2) hit = true;
      if (boss && damageBoss(n.x, n.y, 0, 2)) hit = true;
      if (hit) { explode(n.x, n.y, 30, 6); n.dead = true; G.freeze = 0.04; }
    }
    nades = nades.filter((n) => !n.dead);
  }

  // ---------- main update ----------
  function updatePlay(dt) {
    G.runT += dt;
    G.waveT += dt;
    if (G.phaseT > 0) {
      G.phaseT -= dt;
      if (G.phaseT <= 0) {
        if (G.phase === 'intro') G.phase = 'play';
        else if (G.phase === 'clear') startWave(G.wave + 1);
      }
    }
    if (G.comboT > 0 && (G.comboT -= dt) <= 0) { G.combo = 0; G.mult = 1; }

    // Player.
    if (P.dead > 0) {
      P.dead -= dt;
      if (P.dead <= 0) {
        if (G.lives <= 0) { gameOver(); return; }
        const keep = P.bombs;
        P = newPlayer();
        P.bombs = Math.max(keep, 5);
      }
    } else {
      if (P.inv > 0) P.inv -= dt;
      if (P.mummy > 0) P.mummy -= dt;
      if (P.cd > 0) P.cd -= dt;
      if (P.bcd > 0) P.bcd -= dt;
      if (P.laser > 0) P.laser -= dt;
      const spd = (P.tank ? 95 : 125) * (P.mummy > 0 ? 0.5 : 1);
      let vx = 0;
      if (keys.left) vx -= 1;
      if (keys.right) vx += 1;
      if (vx) { P.x += vx * spd * dt; P.tx = null; P.face = vx; }
      else if (P.tx != null) {
        const dx = P.tx - P.x;
        const step = Math.min(Math.abs(dx), spd * 2 * dt);
        P.x += Math.sign(dx) * step;
        vx = Math.abs(dx) > 1 ? Math.sign(dx) : 0;
      }
      P.x = clamp(P.x, 8, W - 8);
      P.moving = vx !== 0;
      P.anim += dt;
      const firing = keys.fire || touchFire || (opts.autofire && IS_TOUCH);
      if (firing && P.cd <= 0 && G.phase !== 'intro') fire();
    }

    updateEnemies(dt);
    if (boss) updateBoss(dt);
    updateBullets(dt);
    updatePows(dt);

    // POW timer.
    G.powT -= dt;
    if (G.powT <= 0 && G.phase === 'play') { spawnPow(); G.powT = boss ? rnd(14, 20) : rnd(11, 18); }

    // Wave cleared?
    if (G.phase === 'play' && !enemies.length && !boss) {
      G.phase = 'clear';
      G.phaseT = 2.4;
      const par = 25 + G.wave * 3;
      const bonus = Math.max(0, Math.round((par - G.waveT) * 2) * 10 * G.wave);
      if (G.wave % 5 !== 0) {
        caption('GREAT!', 1.6, '#5dffa8', 18);
        if (Math.random() < 0.4) sfx.voice('Great!');
      }
      if (bonus > 0) { caption('SPEED BONUS ' + fmt(bonus), 2, '#ffd23a', 9, 140); addScore(bonus, null, null, true); }
      eb = [];
    }
  }

  function updateFx(dt) {
    for (const f of fx) {
      f.life -= dt;
      if (f.vx != null) { f.x += f.vx * dt; f.y += f.vy * dt; }
      if (f.t === 'debris') { f.vy += 300 * dt; if (f.y > GROUND) { f.y = GROUND; f.vy *= -0.3; f.vx *= 0.6; } }
      if (f.t === 'fire') { f.vx *= 0.92; f.vy *= 0.92; f.vy -= 20 * dt; }
      if (f.t === 'smoke') f.r += dt * 6;
    }
    fx = fx.filter((f) => f.life > 0);
    if (fx.length > 600) fx.splice(0, fx.length - 600);
    for (const f of floats) { f.t += dt; f.y -= dt * 20; }
    floats = floats.filter((f) => f.t < 0.9);
    for (const c of caps) c.t += dt;
    caps = caps.filter((c) => c.t < c.dur);
    for (const c of clouds) { c.x -= c.s * dt; if (c.x < -c.w) { c.x = W + rnd(0, 60); c.y = rnd(8, 90); } }
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 10);
  }

  // Title screen: a formation marches behind the menu.
  function updateAttract(dt) {
    if (!enemies.length) { G.wave = 7; buildFormation(7); form.y = form.ty; G.phase = 'play'; }
    G.phase = 'intro';
    updateEnemies(dt);
    form.x += form.dir * 14 * dt;
    const xs = enemies.map((e) => e.x);
    if (Math.max(...xs) > W - 14) form.dir = -1;
    if (Math.min(...xs) < 14) form.dir = 1;
  }

  // ---------- drawing ----------
  function drawBg() {
    const key = W + ':' + G.theme;
    if (!bgCache || bgKey !== key) {
      bgKey = key;
      bgCache = document.createElement('canvas');
      bgCache.width = W; bgCache.height = H;
      const x = bgCache.getContext('2d');
      const th = THEMES[G.theme];
      const gr = x.createLinearGradient(0, 0, 0, GROUND);
      gr.addColorStop(0, th.sky[0]); gr.addColorStop(1, th.sky[1]);
      x.fillStyle = gr; x.fillRect(0, 0, W, H);
      if (G.theme === 2) { x.fillStyle = '#fff'; for (let i = 0; i < 60; i++) x.fillRect(Math.floor(rnd(0, W)), Math.floor(rnd(0, 150)), 1, 1); }
      // Far mountains.
      x.fillStyle = th.far;
      let hgt = 60;
      for (let i = 0; i < W; i += 2) { hgt += rnd(-3, 3); hgt = clamp(hgt, 30, 85); x.fillRect(i, GROUND - 40 - hgt, 2, hgt + 40); }
      // Ruined buildings.
      x.fillStyle = th.mid;
      for (let i = -10; i < W; i += rnd(28, 50)) {
        const bw = rnd(18, 34), bh = rnd(30, 70);
        x.fillRect(Math.floor(i), GROUND - bh, Math.floor(bw), bh);
        for (let k = 0; k < 4; k++) x.clearRect(Math.floor(i + rnd(0, bw - 4)), GROUND - bh, 4, Math.floor(rnd(2, 8)));
        x.fillStyle = 'rgba(0,0,0,.25)';
        for (let wy = GROUND - bh + 6; wy < GROUND - 8; wy += 8) for (let wx = i + 3; wx < i + bw - 4; wx += 6) x.fillRect(Math.floor(wx), wy, 3, 4);
        x.fillStyle = th.mid;
      }
      // Ground.
      x.fillStyle = th.ground; x.fillRect(0, GROUND, W, H - GROUND);
      x.fillStyle = th.dark; x.fillRect(0, GROUND, W, 2);
      for (let i = 0; i < 120; i++) x.fillRect(Math.floor(rnd(0, W)), Math.floor(rnd(GROUND + 3, H)), Math.floor(rnd(1, 4)), 1);
    }
    b.drawImage(bgCache, 0, 0);
    b.fillStyle = G.theme === 2 ? 'rgba(80,90,130,.5)' : 'rgba(255,255,255,.55)';
    for (const c of clouds) { b.fillRect(Math.round(c.x), Math.round(c.y), Math.round(c.w), 4); b.fillRect(Math.round(c.x + 6), Math.round(c.y - 3), Math.round(c.w * 0.5), 3); }
  }

  function spr(name, f, x, y, white = false, alpha = 1) {
    const s = SPR[name];
    const img = (white ? s.white : s.f)[f % s.f.length];
    if (alpha < 1) b.globalAlpha = alpha;
    b.drawImage(img, Math.round(x - s.w / 2), Math.round(y - s.h / 2));
    if (alpha < 1) b.globalAlpha = 1;
  }

  function drawWorld() {
    drawBg();
    bunkers.forEach(drawBunker);
    // Drops.
    for (const d of drops) {
      if (d.t > 6 && Math.floor(d.t * 10) % 2) continue;
      const x = Math.round(d.x - 6), y = Math.round(d.y - 6);
      b.fillStyle = '#1a1410'; b.fillRect(x - 1, y - 1, 14, 14);
      b.fillStyle = d.kind === 'T' ? '#3f6fd8' : d.kind === 'G' ? '#7a9a3e' : '#c9a66b'; b.fillRect(x, y, 12, 12);
      b.fillStyle = '#8f7244'; b.fillRect(x, y + 5, 12, 1);
      b.fillStyle = '#fff'; b.font = '8px "Press Start 2P", monospace'; b.textAlign = 'center'; b.textBaseline = 'middle';
      b.fillText(d.kind, x + 6.5, y + 7);
    }
    // POWs.
    for (const p of pows) {
      if (p.state === 'float') { spr('balloon', 0, p.x, p.y - 15); spr('pow', 0, p.x, p.y); }
      else if (p.state === 'fall') { spr('chute', 0, p.x, p.y - 13); spr('pow', 0, p.x, p.y); }
      else if (p.state === 'thank') spr('pow', 2, p.x, p.y);
      else spr('pow', Math.floor(p.t * 10) % 2 ? 1 : 0, p.x, p.y);
    }
    if (boss) drawBoss();
    for (const e of enemies) {
      if (e.dead) continue;
      const f = e.state === 'form' ? G.step % 2 : Math.floor(e.t * 8) % 2;
      spr(e.kind, f, e.x, e.y, e.flash > 0);
      if (e.kind === 'shield' && e.hp < e.max && e.flash <= 0) { b.fillStyle = '#1a1410'; b.fillRect(Math.round(e.x - 2), Math.round(e.y), 1, 3); b.fillRect(Math.round(e.x + 1), Math.round(e.y - 2), 1, 3); }
    }
    // Player.
    if (P && P.dead <= 0 && !(P.inv > 0 && Math.floor(G.t * 20) % 2)) {
      if (P.tank) spr('tank', P.moving ? Math.floor(P.anim * 12) % 2 : 0, P.x, GROUND - 8);
      else if (P.mummy > 0) spr('mummy', P.moving ? Math.floor(P.anim * 6) % 2 : 0, P.x, GROUND - 7);
      else spr('hero', P.moving ? 1 + (Math.floor(P.anim * 10) % 2) : 0, P.x, GROUND - 9);
      if (P.cd > WEAP[P.weapon].cd * 0.6 && !P.tank && P.weapon !== 'L') {
        b.fillStyle = '#fff6c0'; b.fillRect(Math.round(P.x + 1), GROUND - 21, 3, 3);
      }
    }
    // Laser beam.
    if (P && P.laser > 0 && !P.dead) {
      const x = Math.round(P.x + 2);
      b.fillStyle = 'rgba(255,80,200,.45)'; b.fillRect(x - 3, 0, 7, GROUND - 18);
      b.fillStyle = '#ffd6f4'; b.fillRect(x - 1, 0, 3, GROUND - 18);
    }
    // Player bullets.
    for (const bl of pb) {
      const x = Math.round(bl.x), y = Math.round(bl.y);
      if (bl.kind === 'P') { b.fillStyle = '#fff6c0'; b.fillRect(x - 1, y - 3, 2, 5); }
      else if (bl.kind === 'H') { b.fillStyle = '#ffd23a'; b.fillRect(x - 1, y - 4, 2, 6); b.fillStyle = '#fff'; b.fillRect(x - 1, y - 4, 2, 2); }
      else if (bl.kind === 'S') { b.fillStyle = '#fff'; b.fillRect(x - 1, y - 1, 3, 3); }
      else if (bl.kind === 'R' || bl.kind === 'shell') {
        b.fillStyle = '#1a1410'; b.fillRect(x - 2, y - 5, 5, 9);
        b.fillStyle = bl.kind === 'R' ? '#e03a2e' : '#a7b0ba'; b.fillRect(x - 1, y - 4, 3, 7);
        b.fillStyle = '#ffd23a'; b.fillRect(x - 1, y + 3, 3, 2 + Math.floor(Math.random() * 3));
      } else if (bl.kind === 'F') {
        b.fillStyle = '#ff8a2a'; b.beginPath(); b.arc(x, y, bl.r, 0, Math.PI * 2); b.fill();
        b.fillStyle = '#ffd23a'; b.beginPath(); b.arc(x, y + 1, bl.r * 0.6, 0, Math.PI * 2); b.fill();
        b.fillStyle = '#fff6c0'; b.fillRect(x - 1, y - 1, 3, 3);
      }
    }
    for (const n of nades) {
      b.fillStyle = '#1a1410'; b.fillRect(Math.round(n.x - 2), Math.round(n.y - 2), 5, 5);
      b.fillStyle = '#4f6a28'; b.fillRect(Math.round(n.x - 1), Math.round(n.y - 1), 3, 3);
    }
    // Enemy bullets.
    for (const e of eb) {
      const x = Math.round(e.x), y = Math.round(e.y);
      if (e.kind === 'laser') { b.fillStyle = '#6fe6ff'; b.fillRect(x - 1, y - 4, 2, 7); b.fillStyle = '#fff'; b.fillRect(x, y - 3, 1, 5); }
      else if (e.kind === 'bubble') { b.strokeStyle = '#c9f6ff'; b.lineWidth = 1; b.beginPath(); b.arc(x, y, 3, 0, Math.PI * 2); b.stroke(); b.fillStyle = '#fff'; b.fillRect(x - 1, y - 2, 1, 1); }
      else if (e.kind === 'breath') { b.fillStyle = 'rgba(154,90,216,.75)'; b.beginPath(); b.arc(x, y, 4 + Math.sin(e.t * 10), 0, Math.PI * 2); b.fill(); b.fillStyle = '#d8b4ff'; b.fillRect(x - 1, y - 1, 2, 2); }
      else if (e.kind === 'grenade') { b.fillStyle = '#1a1410'; b.fillRect(x - 2, y - 2, 4, 4); b.fillStyle = Math.floor(e.t * 12) % 2 ? '#ff3b3b' : '#ffd23a'; b.fillRect(x, y - 3, 1, 1); }
      else if (e.kind === 'bomb') { b.fillStyle = '#1a1410'; b.fillRect(x - 2, y - 4, 5, 8); b.fillStyle = '#5d6670'; b.fillRect(x - 1, y - 3, 3, 6); }
      else if (e.kind === 'missile') {
        b.fillStyle = '#1a1410'; b.fillRect(x - 2, y - 2, 5, 5);
        b.fillStyle = '#e03a2e'; b.fillRect(x - 1, y - 1, 3, 3);
      } else { b.fillStyle = '#ff8a2a'; b.fillRect(x - 2, y - 2, 4, 4); b.fillStyle = '#fff6c0'; b.fillRect(x - 1, y - 1, 2, 2); }
    }
    // Effects.
    for (const f of fx) {
      const k = f.life / f.max;
      if (f.t === 'fire') {
        b.fillStyle = k > 0.7 ? '#fff6c0' : k > 0.45 ? '#ffd23a' : k > 0.25 ? '#ff8a2a' : '#c23a1a';
        b.beginPath(); b.arc(Math.round(f.x), Math.round(f.y), Math.max(0.5, f.r * (0.5 + k * 0.6)), 0, Math.PI * 2); b.fill();
      } else if (f.t === 'smoke') {
        b.fillStyle = `rgba(60,55,50,${(k * 0.5).toFixed(2)})`;
        b.beginPath(); b.arc(Math.round(f.x), Math.round(f.y), f.r, 0, Math.PI * 2); b.fill();
      } else if (f.t === 'flash') {
        b.fillStyle = `rgba(255,255,240,${k.toFixed(2)})`;
        b.beginPath(); b.arc(f.x, f.y, f.r, 0, Math.PI * 2); b.fill();
      } else { b.fillStyle = f.col; b.fillRect(Math.round(f.x), Math.round(f.y), 2, 2); }
    }
  }

  function text(str, x, y, size, col, align = 'left') {
    ctx.font = `${size}px "Press Start 2P", monospace`;
    ctx.textAlign = align;
    ctx.lineWidth = Math.max(1.5, size / 3.5);
    ctx.strokeStyle = '#1a1410';
    ctx.lineJoin = 'round';
    ctx.strokeText(str, x, y);
    ctx.fillStyle = col;
    ctx.fillText(str, x, y);
  }
  function drawHud() {
    ctx.textBaseline = 'top';
    if (G.mode === 'play' || G.mode === 'paused') {
      // ARMS / BOMB box, Slug style.
      ctx.fillStyle = 'rgba(26,20,16,.65)'; ctx.fillRect(4, 4, 70, 22);
      ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 1; ctx.strokeRect(4.5, 4.5, 69, 21);
      text('ARMS', 8, 7, 5, '#ffd23a'); text('BOMB', 46, 7, 5, '#ffd23a');
      text(P.tank ? 'TANK' : P.weapon === 'P' ? '∞' : P.weapon + String(P.ammo), 8, 15, 7, '#fff');
      text(String(P.bombs), 46, 15, 7, '#fff');
      text(fmt(G.score), 80, 6, 10, '#fff');
      if (G.combo >= 4) text(`COMBO ${G.combo}  x${G.mult.toFixed(1)}`, 80, 18, 5, G.mult > 1 ? '#ff8a2a' : '#c9a66b');
      text('WAVE ' + G.wave, W - 6, 6, 7, '#6fe6ff', 'right');
      const lives = G.lives;
      ctx.imageSmoothingEnabled = false;
      for (let i = 0; i < Math.min(lives, 6); i++) ctx.drawImage(SPR.heart.f[0], W - 13 - i * 9, 16);
      if (lives > 6) text('+' + (lives - 6), W - 66, 17, 5, '#fff', 'right');
      if (P.mummy > 0) text('MUMMY ' + Math.ceil(P.mummy), W / 2, GROUND + 6, 6, '#ece2c6', 'center');
      if (P.tank) for (let i = 0; i < 3; i++) { ctx.fillStyle = i < P.tank ? '#5dffa8' : '#39404a'; ctx.fillRect(P.x - 9 + i * 7, GROUND - 22, 5, 2); }
      if (boss && !boss.dying && boss.entered) {
        const bw = Math.min(200, W - 180), bx = W / 2 - bw / 2;
        ctx.fillStyle = '#1a1410'; ctx.fillRect(bx - 1, 25, bw + 2, 6);
        ctx.fillStyle = '#ff3b3b'; ctx.fillRect(bx, 26, Math.max(0, bw * boss.hp / boss.max), 4);
        text(bossName(G.wave), W / 2, 16, 5, '#ffd23a', 'center');
      }
    }
    for (const f of floats) text(f.text, f.x, f.y, 5, f.col, 'center');
    for (const c of caps) {
      const pop = Math.min(1, c.t * 8);
      const sc = 1 + (1 - pop) * 0.8;
      const a = c.t > c.dur - 0.25 ? (c.dur - c.t) / 0.25 : 1;
      ctx.globalAlpha = a;
      text(c.text, W / 2, c.y - (c.size * sc) / 2, Math.round(c.size * sc), c.col, 'center');
      ctx.globalAlpha = 1;
    }
  }

  function render() {
    b.imageSmoothingEnabled = false;
    drawWorld();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0c0907';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingEnabled = false;
    const sx = G.shake ? rnd(-G.shake, G.shake) * S * DPR : 0, sy = G.shake ? rnd(-G.shake, G.shake) * S * DPR : 0;
    ctx.drawImage(buf, OX * DPR + sx, OY * DPR + sy, W * S * DPR, H * S * DPR);
    ctx.setTransform(S * DPR, 0, 0, S * DPR, OX * DPR, OY * DPR);
    drawHud();
  }

  // ---------- loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    G.t += dt;
    if (G.freeze > 0) G.freeze -= dt;
    else if (G.mode === 'play') { updatePlay(dt); updateFx(dt); }
    else if (G.mode === 'title' || G.mode === 'over') { updateAttract(dt); updateFx(dt); }
    render();
    requestAnimationFrame(frame);
  }

  // ---------- flow ----------
  function show(id) {
    ['title', 'pause', 'over'].forEach((s) => $(s).classList.toggle('show', s === id));
    document.body.classList.toggle('playing', id === null);
  }
  function startGame() {
    sfx.unlock();
    Object.assign(G, { mode: 'play', score: 0, lives: 3, nextLife: 20000, combo: 0, comboT: 0, mult: 1, runT: 0, kills: 0,
      powT: 10, fireAcc: 0, theme: 0, submitted: null, token: null, runId: null });
    bgCache = null;
    P = newPlayer();
    pb = []; eb = []; fx = []; floats = []; drops = []; pows = []; nades = []; caps = []; enemies = [];
    makeBunkers();
    startWave(1);
    show(null);
    setShare(null);
    api({ action: 'start' }).then((r) => { G.token = r.token; G.runId = r.id; }).catch(() => {});
  }
  function pause() {
    if (G.mode !== 'play') return;
    G.mode = 'paused';
    show('pause');
    syncOpts();
  }
  function resume() {
    if (G.mode !== 'paused') return;
    sfx.unlock();
    G.mode = 'play';
    show(null);
    last = performance.now();
  }
  function quit() {
    G.mode = 'title';
    enemies = []; boss = null; eb = []; pb = []; pows = []; drops = []; caps = [];
    P = null;
    show('title');
    loadBoard();
  }
  function gameOver() {
    G.mode = 'over';
    P = null;
    caps = [];
    enemies = []; boss = null; eb = []; pb = []; pows = []; drops = [];
    const newBest = G.score > best;
    if (newBest) { best = G.score; LS.set(KEY + '-best', best); }
    $('ovScore').textContent = fmt(G.score);
    $('ovWave').textContent = G.wave;
    $('ovBest').textContent = newBest && G.score > 0 ? 'NEW PERSONAL BEST!' : 'Your best: ' + fmt(best);
    $('ovName').textContent = callsign;
    $('ovRank').textContent = 'Sending to the board…';
    $('ovBoard').innerHTML = '';
    show('over');
    setShare(`I reached wave ${G.wave} with ${fmt(G.score)} points on M3TAL INV4D3RS. Beat me:`);
    sfx.voice('Game over');
    submitScore();
  }

  // ---------- high scores ----------
  async function api(body) {
    const res = await fetch('/api/scores', body
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Board offline');
    return data;
  }
  function renderBoard(el, board, mine) {
    if (!board || !board.length) { el.innerHTML = '<li class="empty">No scores yet — be the first.</li>'; return; }
    el.innerHTML = board.slice(0, 10).map((r, i) =>
      `<li class="${r.id && r.id === mine ? 'me' : ''}"><b>${i + 1}</b><span>${esc(r.n)}</span><em>W${r.w}</em><i>${fmt(r.s)}</i></li>`).join('');
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  async function loadBoard() {
    $('myBest').textContent = best ? 'Your best: ' + fmt(best) : 'Callsign: ' + callsign;
    try { const r = await api(); renderBoard($('boardList'), r.board); }
    catch { $('boardList').innerHTML = '<li class="empty">Board offline. Your best is kept on this device.</li>'; }
  }
  async function submitScore() {
    if (!G.token || G.score <= 0) {
      $('ovRank').textContent = G.score <= 0 ? '' : 'Board offline. Your best is saved on this device.';
      api().then((r) => renderBoard($('ovBoard'), r.board)).catch(() => {});
      return;
    }
    try {
      const r = await api({ action: 'submit', token: G.token, name: callsign, score: Math.floor(G.score), wave: G.wave, time: Math.floor(G.runT) });
      G.submitted = true;
      $('ovRank').textContent = r.rank ? `World rank #${r.rank} of ${r.total}` : 'Not in the top ' + r.total + ' yet — go again!';
      renderBoard($('ovBoard'), r.board, G.runId);
    } catch (e) {
      $('ovRank').textContent = 'Couldn\'t reach the board (' + e.message + '). Your best is saved here.';
      api().then((r) => renderBoard($('ovBoard'), r.board)).catch(() => {});
    }
  }
  function setShare(text) {
    const kit = document.querySelector('script[src*="share-install"]');
    if (kit) kit.dataset.text = text || kit.dataset.default || kit.dataset.text;
  }

  // ---------- input ----------
  const keys = { left: false, right: false, fire: false };
  let touchFire = false;
  const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'fire', KeyJ: 'fire', KeyZ: 'fire', ArrowUp: 'fire', KeyW: 'fire' };
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    sfx.unlock();
    const k = KEYMAP[e.code];
    if (k) { keys[k] = true; e.preventDefault(); }
    if (e.code === 'KeyK' || e.code === 'KeyX' || e.code === 'KeyB') throwBomb();
    if (e.code === 'KeyP' || e.code === 'Escape') { if (G.mode === 'play') pause(); else if (G.mode === 'paused') resume(); }
    if ((e.code === 'Enter' || e.code === 'Space') && (G.mode === 'title' || (G.mode === 'over' && !overLock()))) { e.preventDefault(); startGame(); }
  });
  addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
  addEventListener('blur', () => { keys.left = keys.right = keys.fire = false; touchFire = false; pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  let overAt = 0;
  const overLock = () => performance.now() - overAt < 1200;
  new MutationObserver(() => { if ($('over').classList.contains('show')) overAt = performance.now(); }).observe($('over'), { attributes: true });

  // Touch: drag anywhere on the left part of the screen to move; buttons on the right.
  let moveId = null, startX = 0, startPX = 0;
  cv.addEventListener('pointerdown', (e) => {
    sfx.unlock();
    if (G.mode !== 'play' || !P) return;
    if (e.pointerType === 'mouse') return;
    if (e.clientX > innerWidth * 0.62) return;
    moveId = e.pointerId; startX = e.clientX; startPX = P.x;
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', (e) => {
    if (e.pointerId !== moveId || !P) return;
    P.tx = clamp(startPX + ((e.clientX - startX) / S) * 1.4, 8, W - 8);
  });
  const endMove = (e) => { if (e.pointerId === moveId) { moveId = null; if (P) P.tx = null; } };
  cv.addEventListener('pointerup', endMove);
  cv.addEventListener('pointercancel', endMove);
  const hold = (el, down, up) => {
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); sfx.unlock(); el.classList.add('on'); down(); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => el.addEventListener(t, () => { el.classList.remove('on'); if (up) up(); }));
  };
  hold($('fireBtn'), () => { touchFire = true; }, () => { touchFire = false; });
  hold($('bombBtn'), throwBomb);
  $('pauseBtn').addEventListener('click', pause);

  // ---------- menus ----------
  function syncOpts() {
    $('soundBtn').textContent = 'SOUND: ' + (opts.sound ? 'ON' : 'OFF');
    $('pSound').textContent = 'SOUND: ' + (opts.sound ? 'ON' : 'OFF');
    $('pVoice').textContent = 'VOICE: ' + (opts.voice ? 'ON' : 'OFF');
    $('pAuto').textContent = 'AUTO-FIRE: ' + (opts.autofire ? 'ON' : 'OFF');
    $('pAuto').hidden = !IS_TOUCH;
    $('fireBtn').classList.toggle('auto', opts.autofire);
    LS.set(KEY + '-opts', opts);
  }
  const toggle = (k) => () => { opts[k] = !opts[k]; sfx.unlock(); syncOpts(); };
  $('soundBtn').addEventListener('click', toggle('sound'));
  $('pSound').addEventListener('click', toggle('sound'));
  $('pVoice').addEventListener('click', toggle('voice'));
  $('pAuto').addEventListener('click', toggle('autofire'));
  $('playBtn').addEventListener('click', startGame);
  $('againBtn').addEventListener('click', startGame);
  $('resumeBtn').addEventListener('click', resume);
  $('quitBtn').addEventListener('click', quit);
  $('menuBtn').addEventListener('click', quit);
  $('renameBtn').addEventListener('click', () => {
    $('nameForm').hidden = false;
    $('nameInput').value = callsign;
    $('nameInput').focus();
    $('nameInput').select();
  });
  $('nameForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('nameInput').value.toUpperCase().replace(/[^A-Z0-9 ._-]/g, '').trim().slice(0, 12);
    if (v.length >= 3) { callsign = v; LS.set(KEY + '-name', v); $('ovName').textContent = v; }
    $('nameForm').hidden = true;
    if (G.submitted) submitScore();
  });
  $('help').textContent = IS_TOUCH
    ? 'Turn sideways. Drag the left side to move. Right side: FIRE and BOMB.'
    : 'ARROWS or A D move · SPACE fire · K bomb · P pause';
  const kit = document.querySelector('script[src*="share-install"]');
  if (kit) kit.dataset.default = kit.dataset.text;

  // Debug hook.
  window.__mi = {
    G, get P() { return P; }, get enemies() { return enemies; }, get boss() { return boss; },
    wave(n) { if (G.mode !== 'play') startGame(); startWave(n); }, god(on = true) { G.god = on; },
    give(k) { if (P) pickup(k); },
    // Fast-forward the game (for testing): runs `sec` seconds of play at 60fps.
    sim(sec, each) { for (let i = 0; i < sec * 60 && G.mode === 'play'; i++) { if (each) each(i); G.t += 1 / 60; if (G.freeze > 0) G.freeze -= 1 / 60; else { updatePlay(1 / 60); updateFx(1 / 60); } } render(); },
    keys, clear() { enemies.forEach((e) => damageEnemy(e, 99)); if (boss) boss.hp = 1; },
  };

  addEventListener('resize', resize);
  resize();
  makeBunkers();
  syncOpts();
  loadBoard();
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { bgCache = null; });
  requestAnimationFrame(frame);
})();
