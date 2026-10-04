// brandcheck.js — is this brand name still free? Checks domains and social
// handles for a brand and its industry branches (berjaya, berjaya food, ...).
// Used by functions/api/brand.js. A copy lives in the chief-of-staff bot as
// brandcheck.mjs — keep in step. Only whoisQuery differs: Cloudflare sockets
// here instead of node:net.
//
// Every answer is one of: available, taken, unknown (couldn't tell — open the
// link and look), invalid (the platform won't allow a name like that).
// Nothing is reported as available without a definite signal.

import { connect } from 'cloudflare:sockets';

const TIMEOUT_MS = 8000;
const CONCURRENCY = 6;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0 Safari/537.36';

export const DEFAULT_INDUSTRIES = ['food', 'beverages', 'properties', 'hotels', 'holdings'];

// --- Names --------------------------------------------------------------

// "Berjaya  Food!" -> "berjaya food"
export function cleanName(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// "/brand berjaya" or "/brand berjaya: food, hotels" -> { brand, industries|null }
export function parseBrandArgs(text) {
  const [brandPart, industryPart] = String(text ?? '').split(/[:|]/, 2);
  const brand = cleanName(brandPart);
  const industries = industryPart === undefined ? null : parseIndustryList(industryPart);
  return { brand, industries: industries && industries.length ? industries : null };
}

export function parseIndustryList(text) {
  return [...new Set(String(text).split(/[,;\n]/).map(cleanName).filter(Boolean))].slice(0, 8);
}

// Pull the first JSON array of strings out of whatever Claude replied.
export function parseIndustries(reply) {
  const match = String(reply ?? '').match(/\[[\s\S]*?\]/);
  if (!match) return null;
  try {
    const list = JSON.parse(match[0]);
    if (!Array.isArray(list)) return null;
    const clean = [...new Set(list.map(cleanName).filter(Boolean))].slice(0, 5);
    return clean.length ? clean : null;
  } catch {
    return null;
  }
}

export function suggestPrompt(brand) {
  return (
    `A business group is called "${brand}". List the 5 industries it is most ` +
    `likely to branch into, as short lowercase words a brand name would be ` +
    `followed by (e.g. "food", "properties", "hotels"). Reply with only a JSON ` +
    `array of 5 strings, nothing else.`
  );
}

// --- Platforms ----------------------------------------------------------

export const DOMAINS = ['com', 'my', 'com.my'];

// min/max length and allowed characters per platform, so "too long for X" is
// said up front instead of looking like "available".
const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', short: 'IG', min: 1, max: 30, underscore: true,
    url: (h) => `https://www.instagram.com/${h}/` },
  { id: 'tiktok', label: 'TikTok', short: 'TikTok', min: 2, max: 24, underscore: true,
    url: (h) => `https://www.tiktok.com/@${h}` },
  { id: 'facebook', label: 'Facebook', short: 'FB', min: 5, max: 50, underscore: false,
    url: (h) => `https://www.facebook.com/${h}` },
  { id: 'x', label: 'X (Twitter)', short: 'X', min: 4, max: 15, underscore: true,
    url: (h) => `https://x.com/${h}` },
  { id: 'youtube', label: 'YouTube', short: 'YT', min: 3, max: 30, underscore: true,
    url: (h) => `https://www.youtube.com/@${h}` },
  { id: 'linkedin', label: 'LinkedIn', short: 'LinkedIn', min: 2, max: 100, underscore: false,
    url: (h) => `https://www.linkedin.com/company/${h}` },
  { id: 'threads', label: 'Threads', short: 'Threads', min: 1, max: 30, underscore: true,
    url: (h) => `https://www.threads.net/@${h}` },
  { id: 'telegram', label: 'Telegram', short: 'TG', min: 5, max: 32, underscore: true,
    url: (h) => `https://t.me/${h}` },
];

export const COLUMNS = [
  ...DOMAINS.map((tld) => ({ id: tld, label: `.${tld}`, short: `.${tld}`, kind: 'domain' })),
  ...PLATFORMS.map(({ id, label, short }) => ({ id, label, short, kind: 'social' })),
];

// --- Low-level lookups --------------------------------------------------

async function get(fetchFn, url, headers = {}) {
  const res = await fetchFn(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en', ...headers },
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.text().catch(() => '');
  return { status: res.status, body, finalUrl: res.url || url };
}

// One WHOIS query over port 43. Returns the raw text.
export async function whoisQuery(server, query) {
  const socket = connect({ hostname: server, port: 43 });
  const timer = setTimeout(() => socket.close(), TIMEOUT_MS);
  try {
    const writer = socket.writable.getWriter();
    await writer.write(new TextEncoder().encode(`${query}\r\n`));
    const reader = socket.readable.pipeThrough(new TextDecoderStream()).getReader();
    let text = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      text += value;
    }
    if (!text) throw new Error('whois timed out');
    return text;
  } finally {
    clearTimeout(timer);
    socket.close().catch(() => {});
  }
}

const result = (status, url, note = '') => ({ status, url, ...(note ? { note } : {}) });
const unknown = (note) => ({ status: 'unknown', note });

// What a failed lookup actually hit: ECONNREFUSED, ENOTFOUND, timed out...
const errorNote = (err) =>
  err?.name === 'TimeoutError' ? 'timed out' : err?.cause?.code || err?.code || err?.message || 'lookup failed';

// First line of a WHOIS reply worth showing.
const firstLine = (text) =>
  String(text).split(/\r?\n/).map((l) => l.trim()).find((l) => l && !l.startsWith('%') && !l.startsWith('#')) || '';

// IANA lists which registries answer RDAP (WHOIS over HTTPS). If MYNIC is on
// it, use that: hosts like Render may not let WHOIS's port 43 out.
let bootstrap = null;
function rdapBase(io, tld) {
  bootstrap ??= get(io.fetch, 'https://data.iana.org/rdap/dns.json')
    .then(({ status, body }) => (status === 200 ? JSON.parse(body).services : Promise.reject(new Error(`HTTP ${status}`))))
    .catch((err) => {
      bootstrap = null; // try again next time
      throw err;
    });
  return bootstrap.then((services) => {
    const hit = services.find(([tlds]) => tlds.includes(tld));
    const base = hit?.[1]?.find((u) => u.startsWith('https://')) || hit?.[1]?.[0];
    return base ? base.replace(/\/?$/, '/') : null;
  });
}

async function checkDomain(io, compact, tld) {
  const domain = `${compact}.${tld}`;
  const url = `https://${domain}`;
  if (compact.length > 63) return result('invalid', url, 'too long');
  if (tld === 'my' && compact.length < 2) return result('invalid', url, 'too short');

  if (tld === 'com') {
    // Verisign's RDAP: 404 means no such registration.
    const { status } = await get(io.fetch, `https://rdap.verisign.com/com/v1/domain/${domain}`);
    if (status === 404) return result('available', url);
    if (status === 200) return result('taken', url);
    return result('unknown', url, `registry said ${status}`);
  }

  // .my and .com.my: MYNIC's RDAP if IANA lists one, else WHOIS.
  const base = await rdapBase(io, 'my').catch(() => null);
  if (base) {
    const { status } = await get(io.fetch, `${base}domain/${domain}`);
    if (status === 404) return result('available', url);
    if (status === 200) return result('taken', url);
    return result('unknown', url, `RDAP said ${status}`);
  }
  const text = await io.whois('whois.mynic.my', domain);
  if (/available for registration|no match|not found|no data found|no entries found|does not exist/i.test(text)) {
    return result('available', url);
  }
  if (/domain name\s*:|registrant|creation date|record created|expiry date/i.test(text)) {
    return result('taken', url);
  }
  return result('unknown', url, firstLine(text).slice(0, 60) || 'empty WHOIS reply');
}

// How each platform answers "does @handle exist?" without logging in.
// Facebook, X and LinkedIn show a login wall either way, so they stay unknown
// and the link is there to open and look.
const IG_HEADERS = {
  'x-ig-app-id': '936619743392459',
  'X-Requested-With': 'XMLHttpRequest',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Dest': 'empty',
  Referer: 'https://www.instagram.com/',
  Accept: '*/*',
};

const PROBES = {
  async instagram(io, h) {
    const { status, body } = await get(
      io.fetch,
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${h}`,
      IG_HEADERS,
    );
    if (status === 404) return 'available';
    if (status === 200 && /"username"\s*:/.test(body)) return 'taken';
    return unknown(status === 200 ? 'HTTP 200, no profile data' : `HTTP ${status}`);
  },
  async tiktok(io, h) {
    const { status, body } = await get(io.fetch, `https://www.tiktok.com/@${h}`);
    if (status === 404) return 'available';
    if (status !== 200) return unknown(`HTTP ${status}`);
    if (new RegExp(`"uniqueId"\\s*:\\s*"${h}"`, 'i').test(body)) return 'taken';
    if (/"statusCode"\s*:\s*10202\b/.test(body)) return 'available';
    const code = body.match(/"statusCode"\s*:\s*(\d+)/);
    return unknown(code ? `TikTok code ${code[1]}` : 'HTTP 200, no profile data');
  },
  async youtube(io, h) {
    const { status, finalUrl } = await get(io.fetch, `https://www.youtube.com/@${h}`);
    if (/consent\.|accounts\.google/.test(finalUrl)) return unknown('sent to consent page');
    if (status === 404) return 'available';
    if (status === 200) return 'taken';
    return unknown(`HTTP ${status}`);
  },
  async telegram(io, h) {
    const { status, body } = await get(io.fetch, `https://t.me/${h}`);
    if (status !== 200) return unknown(`HTTP ${status}`);
    // A real user, channel or group page has a title; a free name does not.
    return /class="tgme_page_title"/.test(body) ? 'taken' : 'available';
  },
  facebook: async () => unknown('needs login'),
  x: async () => unknown('needs login'),
  linkedin: async () => unknown('needs login'),
  // Threads names come from Instagram; filled in from the Instagram answer.
  threads: async () => 'unknown',
};

function handleProblem(platform, h) {
  if (h.length > platform.max) return `too long (max ${platform.max})`;
  if (h.length < platform.min) return `too short (min ${platform.min})`;
  return '';
}

async function checkHandle(io, platform, h) {
  const url = platform.url(h);
  const problem = handleProblem(platform, h);
  if (problem) return result('invalid', url, problem);
  const answer = await PROBES[platform.id](io, h);
  return typeof answer === 'string' ? result(answer, url) : result(answer.status, url, answer.note);
}

// --- Running it all -----------------------------------------------------

async function pool(tasks, limit) {
  const out = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      out[i] = await tasks[i]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return out;
}

const safely = (fn, url) => () => fn().catch((err) => result('unknown', url, errorNote(err)));

// brand "berjaya", industries ["food", ...] ->
// { brand, industries, columns, rows: [{ name, handle, cells: { com: {...}, instagram: {...} } }] }
// io lets tests swap the network out: { fetch, whois }.
export async function checkBrand(brand, industries, io = {}) {
  const net = { fetch: io.fetch || globalThis.fetch, whois: io.whois || whoisQuery };
  const base = cleanName(brand);
  if (!base) throw new Error('Give me a brand name to check.');
  const branches = (industries || []).map(cleanName).filter((i) => i && i !== base);
  const names = [base, ...branches.map((i) => `${base} ${i}`)];

  const rows = names.map((name) => ({
    name,
    handle: name.replace(/ /g, ''),
    underscored: name.includes(' ') ? name.replace(/ /g, '_') : '',
    cells: {},
  }));

  const tasks = [];
  for (const row of rows) {
    for (const tld of DOMAINS) {
      const fallback = `https://${row.handle}.${tld}`;
      tasks.push(async () => {
        row.cells[tld] = await safely(() => checkDomain(net, row.handle, tld), fallback)();
      });
    }
    for (const platform of PLATFORMS) {
      if (platform.id === 'threads') continue;
      tasks.push(async () => {
        const run = (h) => safely(() => checkHandle(net, platform, h), platform.url(h))();
        const cell = await run(row.handle);
        // berjayafood taken (or too long)? Offer berjaya_food if that's free.
        if (row.underscored && platform.underscore && (cell.status === 'taken' || cell.status === 'invalid')) {
          const alt = await run(row.underscored);
          if (alt.status === 'available') cell.alt = { handle: row.underscored, url: alt.url };
        }
        row.cells[platform.id] = cell;
      });
    }
  }
  await pool(tasks, CONCURRENCY);

  // A Threads profile is an Instagram account, so the same answer holds.
  const threads = PLATFORMS.find((p) => p.id === 'threads');
  for (const row of rows) {
    const ig = row.cells.instagram;
    row.cells.threads = { ...ig, url: threads.url(row.handle), ...(ig.alt ? { alt: { ...ig.alt, url: threads.url(ig.alt.handle) } } : {}) };
  }

  return { brand: base, industries: branches, columns: COLUMNS, rows };
}

// --- Diagnosis ----------------------------------------------------------

// What each source really answers from wherever this runs, as plain text:
// one known-taken name and one made-up name per source. Served at /diag.
export async function diagnose(io = {}) {
  const net = { fetch: io.fetch || globalThis.fetch, whois: io.whois || whoisQuery };
  const FAKE = 'zqxq7brandtest';
  const clip = (s) => String(s).replace(/\s+/g, ' ').trim().slice(0, 120);
  // extra(body) adds the markers a verdict hangs on, so a wrong one shows why.
  const http = (label, url, headers, extra) => async () => {
    const t = Date.now();
    try {
      const { status, body, finalUrl } = await get(net.fetch, url, headers);
      const moved = finalUrl && finalUrl !== url ? ` -> ${finalUrl}` : '';
      const more = extra ? `\n    ${extra(body)}` : '';
      return `${label}: HTTP ${status}, ${Date.now() - t}ms, ${body.length} bytes${moved}\n    ${clip(body)}${more}`;
    } catch (err) {
      return `${label}: FAILED ${errorNote(err)}, ${Date.now() - t}ms`;
    }
  };
  const whois = (label, domain) => async () => {
    const t = Date.now();
    try {
      const text = await net.whois('whois.mynic.my', domain);
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 3).join(' | ');
      return `${label}: ${text.length} chars, ${Date.now() - t}ms\n    ${clip(lines) || '(empty)'}`;
    } catch (err) {
      return `${label}: FAILED ${errorNote(err)}, ${Date.now() - t}ms`;
    }
  };
  const ig = IG_HEADERS;
  const tiktok = (h) => (body) => {
    const codes = [...new Set([...body.matchAll(/"statusCode"\s*:\s*(\d+)/g)].map((m) => m[1]))].slice(0, 5);
    const own = new RegExp(`"uniqueId"\\s*:\\s*"${h}"`, 'i').test(body);
    return `statusCodes: ${codes.join(',') || 'none'}; uniqueId "${h}": ${own ? 'yes' : 'no'}`;
  };
  const telegram = (body) => {
    const extra = body.match(/class="tgme_page_extra">([^<]*)/);
    return `tgme_page_title: ${/class="tgme_page_title"/.test(body) ? 'yes' : 'no'}; extra: ${clip(extra?.[1] || 'none')}`;
  };

  const myBase = await rdapBase(net, 'my').then(
    (b) => b || 'not listed',
    (err) => `bootstrap FAILED ${errorNote(err)}`,
  );
  const tasks = [
    http('.com RDAP taken', 'https://rdap.verisign.com/com/v1/domain/google.com'),
    http('.com RDAP fake', `https://rdap.verisign.com/com/v1/domain/${FAKE}.com`),
    whois('.my WHOIS taken', 'google.com.my'),
    whois('.my WHOIS fake', `${FAKE}.com.my`),
    ...(myBase.startsWith('http')
      ? [http('.my RDAP taken', `${myBase}domain/google.com.my`), http('.my RDAP fake', `${myBase}domain/${FAKE}.com.my`)]
      : []),
    http('Instagram taken', 'https://www.instagram.com/api/v1/users/web_profile_info/?username=google', ig),
    http('Instagram fake', `https://www.instagram.com/api/v1/users/web_profile_info/?username=${FAKE}`, ig),
    http('TikTok taken', 'https://www.tiktok.com/@google', {}, tiktok('google')),
    http('TikTok fake', `https://www.tiktok.com/@${FAKE}`, {}, tiktok(FAKE)),
    http('YouTube taken', 'https://www.youtube.com/@google'),
    http('YouTube fake', `https://www.youtube.com/@${FAKE}`),
    http('Telegram taken', 'https://t.me/telegram', {}, telegram),
    http('Telegram fake', `https://t.me/${FAKE}`, {}, telegram),
  ];
  const verdicts = async () => {
    const out = [];
    for (const id of ['instagram', 'tiktok', 'youtube', 'telegram']) {
      const platform = PLATFORMS.find((p) => p.id === id);
      for (const h of [id === 'telegram' ? 'telegram' : 'google', FAKE]) {
        const c = await checkHandle(net, platform, h).catch((err) => result('unknown', '', errorNote(err)));
        out.push(`${platform.label} @${h}: ${c.status}${c.note ? ` (${c.note})` : ''}`);
      }
    }
    for (const d of ['google', FAKE]) {
      const c = await checkDomain(net, d, 'com.my').catch((err) => result('unknown', '', errorNote(err)));
      out.push(`${d}.com.my: ${c.status}${c.note ? ` (${c.note})` : ''}`);
    }
    return `\nVerdicts (what the grid would show):\n${out.join('\n')}`;
  };
  tasks.push(verdicts);
  const lines = await pool(tasks, 4);
  return [`Brand checker diagnosis, ${new Date().toISOString()}`, `.my RDAP from IANA: ${myBase}`, '', ...lines].join('\n');
}

// --- Telegram text ------------------------------------------------------

const MARK = { available: '✅', taken: '❌', unknown: '❔', invalid: '🚫' };

export function formatText(report) {
  const lines = [`Brand check: ${report.brand}`];
  if (report.industries.length) lines.push(`Branches: ${report.industries.join(', ')}`);
  for (const row of report.rows) {
    const domains = DOMAINS.map((tld) => `.${tld} ${MARK[row.cells[tld].status]}`).join('  ');
    const socials = PLATFORMS.map((p) => {
      const cell = row.cells[p.id];
      const alt = cell.alt ? ` (${cell.alt.handle} ✅)` : '';
      return `${p.short} ${MARK[cell.status]}${alt}`;
    }).join('  ');
    lines.push('', `${row.name} — @${row.handle}`, domains, socials);
  }
  lines.push(
    '',
    '✅ free  ❌ taken  ❔ check yourself  🚫 not allowed (too long/short)',
    'FB, X and LinkedIn hide behind a login, so always ❔.',
  );
  return lines.join('\n');
}
