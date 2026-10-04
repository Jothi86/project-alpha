// share-install.js — drop-in Share button + Add to home screen for any page.
// The same as Name Card Scanner's and Brand Checker's, packed into one file
// that styles itself (shadow DOM), so it can't clash with the host page.
//
//   <script src="share-install.js" defer
//     data-title="Ember Drift"                 name in share text / email subject
//     data-text="A neon drift racer, free:"    line shared before the link
//     data-url="https://…/play/ember-drift/"   link to share (default: this page)
//     data-mount=".top"                        put the buttons at the end of this
//                                              element (default: floating, top right)
//     data-accent="#17c9a8"                    button colour
//     data-sw="sw.js"></script>                service worker to register, if any
//
// The page still needs its own manifest.webmanifest + icons for installing.
// Copies live in stockscreen and Tapis — keep in step with project-alpha/public/kit/.

(() => {
  const me = document.currentScript;
  const cfg = me.dataset;
  const title = cfg.title || document.title;
  const accent = cfg.accent || '#17c9a8';
  // Dark text on a light accent, white on a dark one.
  const [r, g, b] = (accent.replace('#', '').match(/../g) || ['17', 'c9', 'a8']).map((h) => parseInt(h, 16));
  const accentInk = 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#06201b' : '#ffffff';
  const baseUrl = cfg.url || location.href.split('#')[0];
  const enc = encodeURIComponent;
  const iconHref = document.querySelector('link[rel="apple-touch-icon"]')?.href || '';

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let installPrompt = null;

  if (cfg.sw && 'serviceWorker' in navigator) navigator.serviceWorker.register(cfg.sw).catch(() => {});

  const ICONS = {
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>',
    install: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m0 0-4-4m4 4 4-4"/><path d="M5 20h14"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" fill="#25D366"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.7 11.7 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>',
    telegram: '<svg viewBox="0 0 24 24" fill="#29A9EB"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.6 6.8-1.6 7.7c-.1.5-.4.7-.9.4l-2.5-1.8-1.2 1.2c-.1.1-.3.2-.5.2l.2-2.6 4.7-4.3c.2-.2 0-.3-.3-.1l-5.8 3.7-2.5-.8c-.5-.2-.5-.5.1-.8l9.8-3.8c.5-.2.9.1.7.8Z"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12a12 12 0 1 0-13.9 11.9v-8.4h-3V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12Z"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L1.9 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.4 2H3.6A1.6 1.6 0 0 0 2 3.6v16.8A1.6 1.6 0 0 0 3.6 22h16.8a1.6 1.6 0 0 0 1.6-1.6V3.6A1.6 1.6 0 0 0 20.4 2ZM8 19H5V9.5h3V19ZM6.5 8.2a1.7 1.7 0 1 1 0-3.5 1.7 1.7 0 0 1 0 3.5ZM19 19h-3v-4.6c0-1.1 0-2.5-1.5-2.5S12.8 13 12.8 14.3V19h-3V9.5h2.9v1.3a3.2 3.2 0 0 1 2.8-1.6c3 0 3.6 2 3.6 4.6V19Z"/></svg>',
    email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
    iosShare: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:17px;height:17px;vertical-align:-3px"><path d="M12 15V3m0 0-4 4m4-4 4 4"/><path d="M6 10H5v11h14V10h-1"/></svg>',
  };

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .bar { display: inline-flex; gap: 8px; align-items: center; }
    .bar.floating { position: fixed; top: 12px; right: 12px; z-index: 2147483000; }
    .pill { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 13px; border-radius: 999px;
            border: 1px solid rgba(255,255,255,.14); background: rgba(24,24,29,.92); color: #f5f5f7;
            font-size: 13px; font-weight: 700; cursor: pointer; backdrop-filter: blur(6px); }
    .pill svg { width: 15px; height: 15px; }
    .pill.primary { background: ${accent}; border-color: ${accent}; color: ${accentInk}; }
    .bar.mounted { margin-top: 12px; }
    .pill:hover { filter: brightness(1.1); }
    [hidden] { display: none !important; }
    .scrim { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 2147483001;
             display: flex; align-items: flex-end; justify-content: center; padding: 12px; }
    @media (min-width: 600px) { .scrim { align-items: center; } }
    .sheet { width: min(460px, 100%); background: #18181d; color: #f5f5f7; border: 1px solid #2a2a32;
             border-radius: 18px; padding: 16px; box-shadow: 0 20px 60px rgba(0,0,0,.5); }
    .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 15px; }
    .link { background: none; border: 0; color: #9a9ba6; text-decoration: underline; font-size: 13px; cursor: pointer; padding: 0; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .grid a, .grid button { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 4px;
             border-radius: 12px; background: #1c1c22; border: 1px solid #2a2a32; color: #f5f5f7;
             font-size: 12px; font-weight: 700; text-decoration: none; cursor: pointer; }
    .grid svg { width: 26px; height: 26px; }
    .ios { display: flex; gap: 12px; align-items: flex-start; font-size: 14px; }
    .ios img { width: 48px; height: 48px; border-radius: 12px; flex: none; }
    .ios ol { margin: 6px 0 10px; padding-left: 20px; color: #9a9ba6; }
    .ios li { margin: 4px 0; }
    @media (max-width: 480px) { .pill .label { display: none; } .pill { padding: 0 10px; } }
  `;

  const host = document.createElement('span');
  const root = host.attachShadow({ mode: 'open' });
  const mount = cfg.mount && document.querySelector(cfg.mount);
  root.innerHTML = `<style>${CSS}</style>
    <div class="bar ${mount ? 'mounted' : 'floating'}">
      <button class="pill primary" id="install" hidden>${ICONS.install}<span class="label">Add to home screen</span></button>
      <button class="pill" id="share" title="Share">${ICONS.share}<span class="label">Share</span></button>
    </div>
    <div class="scrim" id="share-sheet" hidden><div class="sheet" role="dialog" aria-label="Share">
      <div class="head"><strong>Share ${escapeHtml(title)}</strong><button class="link" data-close>Close</button></div>
      <div class="grid">
        ${['whatsapp', 'telegram', 'facebook', 'x', 'linkedin', 'email'].map((n) =>
          `<a data-net="${n}" target="_blank" rel="noopener">${ICONS[n]}${{ whatsapp: 'WhatsApp', telegram: 'Telegram', facebook: 'Facebook', x: 'X', linkedin: 'LinkedIn', email: 'Email' }[n]}</a>`).join('')}
        <button id="copy">${ICONS.copy}<span id="copy-label">Copy link</span></button>
        <button id="more" hidden>${ICONS.more}More apps</button>
      </div>
    </div></div>
    <div class="scrim" id="ios-sheet" hidden><div class="sheet ios" role="dialog" aria-label="Add to home screen">
      ${iconHref ? `<img src="${iconHref}" alt="">` : ''}
      <div><strong>Add it to your home screen</strong>
        <ol><li>Tap ${ICONS.iosShare} <strong>Share</strong> at the bottom of Safari.</li>
            <li>Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li></ol>
        <button class="link" data-close>Got it</button></div>
    </div></div>`;
  (mount || document.body).appendChild(host);

  const $ = (id) => root.getElementById(id);
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // --- share ---
  const text = cfg.text || `${title}:`;
  const data = () => ({ title, text, url: baseUrl });
  function fill() {
    const { url } = data();
    const links = {
      whatsapp: `https://wa.me/?text=${enc(`${text} ${url}`)}`,
      telegram: `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
      x: `https://x.com/intent/post?text=${enc(text)}&url=${enc(url)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
      email: `mailto:?subject=${enc(title)}&body=${enc(`${text}\n${url}`)}`,
    };
    root.querySelectorAll('[data-net]').forEach((a) => { a.href = links[a.dataset.net]; });
    $('more').hidden = !(navigator.canShare && navigator.canShare(data()));
  }
  $('share').addEventListener('click', () => {
    // On phones, go straight to the phone's own share menu; the sheet is the fallback.
    if (navigator.share && matchMedia('(pointer: coarse)').matches && navigator.canShare?.(data())) {
      navigator.share(data()).catch(() => {});
      return;
    }
    fill();
    $('share-sheet').hidden = false;
  });
  $('more').addEventListener('click', () => navigator.share(data()).catch(() => {}));
  $('copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(baseUrl);
      $('copy-label').textContent = 'Copied!';
    } catch {
      prompt('Copy this link:', baseUrl);
    }
    setTimeout(() => { $('copy-label').textContent = 'Copy link'; }, 2000);
  });

  // --- add to home screen ---
  if (!standalone && isIOS && document.querySelector('link[rel="manifest"]')) $('install').hidden = false;
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    $('install').hidden = false;
  });
  addEventListener('appinstalled', () => { installPrompt = null; $('install').hidden = true; });
  $('install').addEventListener('click', async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') $('install').hidden = true;
      installPrompt = null;
    } else if (isIOS) {
      $('ios-sheet').hidden = false;
    }
  });

  // Close a sheet with its button, a tap outside it, or Escape.
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]') || e.target.classList.contains('scrim')) {
      $('share-sheet').hidden = true;
      $('ios-sheet').hidden = true;
    }
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { $('share-sheet').hidden = true; $('ios-sheet').hidden = true; }
  });
})();
