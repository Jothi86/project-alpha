// art.js — every sprite in M3TAL INV4D3RS, drawn as text maps.
// No DOM access here: build() takes a canvas factory, so the same art can make
// the in-game sprites and the icons / og-image.

(function (root) {
  'use strict';

  const PAL = {
    k: '#1a1410', w: '#fff4e0', s: '#f2b98a', S: '#c7835a',
    b: '#3f6fd8', B: '#2a4596', r: '#e03a2e', R: '#9c1f1a',
    y: '#ffd23a', Y: '#d99a1a', g: '#7a9a3e', G: '#4f6a28',
    h: '#6b3a1e', n: '#c9a66b', N: '#8f7244',
    m: '#a7b0ba', M: '#5d6670', d: '#39404a',
    p: '#9a5ad8', P: '#5e2f94', c: '#6fe6ff', C: '#1f8fb8',
    o: '#ff8a2a', O: '#b8521a', l: '#ece2c6', L: '#b5a888',
    e: '#ff3b3b', v: '#9be04a', V: '#5a9a24',
  };

  // Each sprite: list of frames, each frame a list of rows. '.' is see-through.
  const MAPS = {
    // The player: a commando aiming straight up.
    hero: [
      [
        '........kk...', '........km...', '........km...', '...kkkk.km...',
        '..krrrrkkm...', '..khhhhkkm...', '..khssskkmk..', '..kssksskmk..',
        '...kssskkmk..', '..kbbbbsskk..', '.kbbnbbbssk..', '.kbbnbbbkk...',
        '.kBbbbbBk....', '..kNNkNNk....', '..kNk.kNk....', '..kNk.kNk....',
        '.kkkk.kkkk...',
      ],
      [
        '........kk...', '........km...', '........km...', '...kkkk.km...',
        '..krrrrkkm...', '..khhhhkkm...', '..khssskkmk..', '..kssksskmk..',
        '...kssskkmk..', '..kbbbbsskk..', '.kbbnbbbssk..', '.kbbnbbbkk...',
        '.kBbbbbBk....', '..kNNkNNk....', '.kNk..kNk....', '.kNk...kNk...',
        'kkk....kkkk..',
      ],
      [
        '........kk...', '........km...', '........km...', '...kkkk.km...',
        '..krrrrkkm...', '..khhhhkkm...', '..khssskkmk..', '..kssksskmk..',
        '...kssskkmk..', '..kbbbbsskk..', '.kbbnbbbssk..', '.kbbnbbbkk...',
        '.kBbbbbBk....', '..kNNkNNk....', '...kNkNk.....', '...kNkNk.....',
        '..kkkkkkk....',
      ],
    ],
    // The tank the player can climb into.
    tank: [
      [
        '..........kk..........', '..........km..........', '..........km..........',
        '..........km..........', '.........kmmk.........', '......kkkkmmkkkk......',
        '.....kbbbbbbbbbbk.....', '....kbbwbbbbbbbbbk....', '....kbbbbbbbbbbbBk....',
        '...kkkkkkkkkkkkkkkk...', '..kmmmmmmmmmmmmmmmmk..', '.kmdkdkdkdkdkdkdkdkdmk',
        '.kMddddddddddddddddMk.', '.kMmkmmkmmkmmkmmkmmMk.', '..kMMMMMMMMMMMMMMMMk..',
        '...kkkkkkkkkkkkkkkk...',
      ],
      [
        '..........kk..........', '..........km..........', '..........km..........',
        '..........km..........', '.........kmmk.........', '......kkkkmmkkkk......',
        '.....kbbbbbbbbbbk.....', '....kbbwbbbbbbbbbk....', '....kbbbbbbbbbbbBk....',
        '...kkkkkkkkkkkkkkkk...', '..kmmmmmmmmmmmmmmmmk..', '.kmkdkdkdkdkdkdkdkdkmk',
        '.kMddddddddddddddddMk.', '.kMmmkmmkmmkmmkmmkmMk.', '..kMMMMMMMMMMMMMMMMk..',
        '...kkkkkkkkkkkkkkkk...',
      ],
    ],
    grunt: [
      [
        '....kkkk....', '...kggggk...', '..kggggggk..', '..kkkkkkkk..', '...kswswk...',
        'k..kssssk..k', 'sk.kgggGk.ks', '.kkggggggkk.', '...kGkkGk...', '...kk..kk...',
      ],
      [
        '....kkkk....', '...kggggk...', '..kggggggk..', '..kkkkkkkk..', '...kswswk...',
        '...kssssk...', '..kkgggGkk..', '.ksggggggsk.', '...kGkkGk...', '..kk....kk..',
      ],
    ],
    ufo: [
      [
        '.....kkkk.....', '....kcccck....', '...kcwccCCk...', '.kkkkkkkkkkkk.',
        'kmmmmmmmmmmmmk', 'kMyMMyMMyMMyMk', '.kkMMMMMMMMkk.', '...kkkkkkkk...',
      ],
      [
        '.....kkkk.....', '....kcccck....', '...kcwccCCk...', '.kkkkkkkkkkkk.',
        'kmmmmmmmmmmmmk', 'kMMyMMyMMyMMMk', '.kkMMMMMMMMkk.', '...kkkkkkkk...',
      ],
    ],
    crab: [
      [
        'kk..........kk', 'kok........kok', '.kok.kkkk.kok.', '..kkkookookk..',
        '..koookwokwok.', '.kooooooooook.', '.kOoooooooOok.', '..kkOOOOOOkk..',
        '.kk.k.kk.k.kk.', 'k...k....k...k',
      ],
      [
        '..............', 'kk..........kk', 'kok.kkkkkk.kok', '.kokooookookk.',
        '..koookwokwok.', '.kooooooooook.', '.kOoooooooOok.', '..kkOOOOOOkk..',
        '..kk.k..k.kk..', '.k...k..k...k.',
      ],
    ],
    mummy: [
      [
        '..kkkkk...', '.klllllk..', '.kLekelk..', '.klllllk..', 'kkLlllLkkk',
        'klllLllllk', 'kLkllllkkk', '..kLlllk..', '..klllLk..', '..kLlllk..',
        '..kllkLk..', '..klk.kk..', '..kk......',
      ],
      [
        '..kkkkk...', '.klllllk..', '.kLekelk..', '.klllllk..', 'kkLlllLkkk',
        'klllLllllk', 'kLkllllkkk', '..kLlllk..', '..klllLk..', '..kLlllk..',
        '..kLkklk..', '..kk.klk..', '......kk..',
      ],
    ],
    shield: [
      [
        '....kkkk....', '...kggggk...', '..kkkkkkkk..', '.kmmmmmmmmk.', '.kmMmmmmMmk.',
        '.kmmmwwmmmk.', '.kmmmmmmmmk.', '.kMmmmmmmMk.', '.kmMMMMMMmk.', '..kkkkkkkk..',
        '...kk..kk...',
      ],
      [
        '....kkkk....', '...kggggk...', '..kkkkkkkk..', '.kmmmmmmmmk.', '.kmMmmmmMmk.',
        '.kmmmwwmmmk.', '.kmmmmmmmmk.', '.kMmmmmmmMk.', '.kmMMMMMMmk.', '..kkkkkkkk..',
        '..kk....kk..',
      ],
    ],
    jet: [
      [
        '....kkkk....', '...kppppk...', '..kpcccCpk..', '..kpccccpk..', '...kppppk...',
        '.kmkppppkmk.', '.kmkPppPkmk.', '.kmkpppPkmk.', '..k.kPPk.k..', '.kyk.kk.kyk.',
        '.koy....yok.', '..o......o..',
      ],
      [
        '....kkkk....', '...kppppk...', '..kpcccCpk..', '..kpccccpk..', '...kppppk...',
        '.kmkppppkmk.', '.kmkPppPkmk.', '.kmkpppPkmk.', '..k.kPPk.k..', '.kyk.kk.kyk.',
        '.kyy....yyk.', '..yo....oy..',
      ],
    ],
    split: [
      [
        '...kkkkkk...', '..kvvvvvvk..', '.kvvwvvwvvk.', '.kvvkvvkvvk.', 'kvvvvvvvvvvk',
        'kvVvvvvvvVvk', 'kvvVVVVVVvvk', '.kvvvvvvvvk.', '..kVkVVkVk..', '...k.kk.k...',
      ],
      [
        '............', '...kkkkkk...', '.kkvvvvvvkk.', 'kvvvwvvwvvvk', 'kvvvkvvkvvvk',
        'kvVvvvvvvVvk', 'kvvVVVVVVvvk', '.kvvvvvvvvk.', '..kVkVVkVk..', '..k..kk..k..',
      ],
    ],
    mini: [
      ['.kkkkk.', 'kvwvwvk', 'kvvvvvk', 'kVvvvVk', '.kVVVk.', '..k.k..'],
      ['.kkkkk.', 'kvwvwvk', 'kvvvvvk', 'kVvvvVk', '.kVVVk.', '.k...k.'],
    ],
    // A bearded prisoner, tied up / running / saluting.
    pow: [
      [
        '..kkkk....', '.khhhhk...', '.kswswk...', '.kssssk...', '.khhhhk...',
        '..khhk....', '.knnnnk...', 'knnnnnnk..', 'kNkkkkNk..', '.knnnnk...',
        '.knnnnk...', '.kNk.kNk..', '.kNk.kNk..', '.kk..kk...',
      ],
      [
        '..kkkk....', '.khhhhk...', '.kswswk...', '.kssssk...', '.khhhhk...',
        '..khhk....', '.knnnnkk..', 'knnnnnnsk.', 'ksknnnk...', '.knnnnk...',
        '.knnnnk...', 'kNk..kNk..', 'kNk...kNk.', 'kk.....kk.',
      ],
      [
        '..kkkk.ks.', '.khhhhkks.', '.kswswksk.', '.kssssk.k.', '.khhhhkk..',
        '..khhkk...', '.knnnnk...', 'knnnnnk...', 'ksknnnk...', '.knnnnk...',
        '.knnnnk...', '.kNk.kNk..', '.kNk.kNk..', '.kk..kk...',
      ],
    ],
    balloon: [
      [
        '..kkkkkk..', '.krrrrrrk.', 'krrwwrrrRk', 'krrwrrrrRk', 'krrrrrrrRk',
        'krrrrrrRRk', '.krrrrRRk.', '..krrRRk..', '...kRRk...', '....kk....',
        '....k.....', '.....k....', '....k.....',
      ],
    ],
    chute: [
      [
        '...kkkkkk...', '.kkwwrrwwkk.', 'kwwrrwwrrwwk', 'kkkkkkkkkkkk', '.k...kk...k.',
        '..k..kk..k..', '...k.kk.k...', '....kkkk....',
      ],
    ],
    heart: [['.kk.kk.', 'krrkrrk', 'krwrrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...']],
    bombIcon: [['...ky.', '..kyk.', '.kkkk.', 'kddddk', 'kdwddk', 'kddddk', '.kkkk.']],
  };

  function frame(rows, make, pal, white) {
    const w = Math.max(...rows.map((r) => r.length));
    const h = rows.length;
    const c = make(w, h);
    const x = c.getContext('2d');
    for (let j = 0; j < h; j++) {
      const row = rows[j];
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.' || ch === ' ') continue;
        x.fillStyle = white ? '#ffffff' : (pal[ch] || '#ff00ff');
        x.fillRect(i, j, 1, 1);
      }
    }
    return c;
  }

  // make(w, h) must return a canvas-like object with getContext('2d').
  function build(make, pal = PAL) {
    const out = {};
    for (const [name, frames] of Object.entries(MAPS)) {
      const f = frames.map((rows) => frame(rows, make, pal, false));
      const white = frames.map((rows) => frame(rows, make, pal, true));
      out[name] = { f, white, w: f[0].width, h: f[0].height };
    }
    return out;
  }

  // Sandbag bunker shape, as a bitmap of 2px cells (1 = sandbag).
  function bunkerMask(cw, ch) {
    const m = new Uint8Array(cw * ch);
    for (let j = 0; j < ch; j++) {
      for (let i = 0; i < cw; i++) {
        const inset = Math.max(0, 3 - j); // rounded top corners
        const notch = j >= ch - 2 && i > cw * 0.35 && i < cw * 0.65; // gap at the bottom
        m[j * cw + i] = i >= inset && i < cw - inset && !notch ? 1 : 0;
      }
    }
    return m;
  }

  root.ART = { PAL, MAPS, build, bunkerMask };
})(typeof self !== 'undefined' ? self : globalThis);
