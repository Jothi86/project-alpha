// GET /api/trademark?name=berjaya%20food -> trademarks already on record for a name.
// Source: TMview (EUIPO), which carries Malaysia's MyIPO register plus ~80 other
// offices. Two searches: Malaysia, marks that contain the name; worldwide, marks
// identical to it. "Live" = Registered or Filed; Ended/Expired marks are listed
// as history only. Cached for a day — registers change slowly.

import { cleanName } from '../../server/brandcheck.js';
import { json } from '../../server/shared.js';

const TMVIEW = 'https://www.tmdn.org/tmview/api/search/results';
const TTL = 86400;
const LIVE = new Set(['Registered', 'Filed']);
const HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  Origin: 'https://www.tmdn.org',
  Referer: 'https://www.tmdn.org/tmview/',
};

const squash = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

async function search(name, criteria, offices) {
  const res = await fetch(TMVIEW, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ page: '1', pageSize: '100', criteria, basicSearch: name, ...(offices ? { fOffices: offices } : {}) }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`TMview said ${res.status}`);
  const data = await res.json();
  return { total: data.totalResults || 0, marks: data.tradeMarks || [] };
}

// Only what the page shows, live marks first, exact matches first within those.
function summarise({ total, marks }, name) {
  const target = squash(name);
  const rows = marks.map((t) => ({
    name: t.tmName || '(logo only)',
    office: t.tmOffice,
    status: t.tradeMarkStatus,
    live: LIVE.has(t.tradeMarkStatus),
    exact: squash(t.tmName) === target,
    classes: t.niceClass || [],
    owner: (t.applicantName || [])[0] || '',
    filed: (t.applicationDate || '').slice(0, 10),
    url: `https://www.tmdn.org/tmview/#/tmview/detail/${encodeURIComponent(t.ST13)}`,
  }));
  rows.sort((a, b) => b.live - a.live || b.exact - a.exact);
  const live = rows.filter((r) => r.live);
  return {
    total, // everything on record, including ended and expired
    seen: rows.length, // how many of those we fetched (the first 100)
    live: live.length,
    liveExact: live.filter((r) => r.exact).length,
    offices: [...new Set(live.map((r) => r.office))],
    marks: rows.slice(0, 12),
  };
}

export async function onRequestGet({ request, waitUntil }) {
  const name = cleanName(new URL(request.url).searchParams.get('name')).slice(0, 60);
  if (!name) return json({ error: 'Give me a brand name.' }, 400);

  const key = new Request(`https://trademark-cache/${encodeURIComponent(name)}`);
  const hit = await caches.default.match(key);
  if (hit) return new Response(hit.body, hit);

  try {
    const [my, world] = await Promise.all([search(name, 'C', ['MY']), search(name, 'I')]);
    const q = encodeURIComponent(name);
    const report = {
      name,
      malaysia: summarise(my, name),
      world: summarise(world, name),
      links: {
        malaysia: `https://www.tmdn.org/tmview/#/tmview/results?page=1&pageSize=30&criteria=C&basicSearch=${q}&fOffices=MY`,
        world: `https://www.tmdn.org/tmview/#/tmview/results?page=1&pageSize=30&criteria=I&basicSearch=${q}`,
      },
    };
    const body = JSON.stringify(report);
    waitUntil(caches.default.put(key, new Response(body, {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${TTL}` },
    })));
    return json(report);
  } catch (err) {
    return json({ error: err.name === 'TimeoutError' ? 'The trademark register took too long — try again.' : err.message }, 502);
  }
}
