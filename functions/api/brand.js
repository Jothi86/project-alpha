// GET /api/brand?name=berjaya%20food -> one row of the brand checker grid.
// The page asks once per name (brand, then each branch) so every call stays
// well under the Workers subrequest limit and the grid fills in as rows land.
// Answers are cached for 10 minutes so repeat lookups don't hit the sites again.

import { checkBrand, cleanName } from '../../server/brandcheck.js';
import { json } from '../../server/shared.js';

const TTL = 600;

export async function onRequestGet({ request, waitUntil }) {
  const name = cleanName(new URL(request.url).searchParams.get('name')).slice(0, 60);
  if (!name) return json({ error: 'Give me a brand name.' }, 400);

  const key = new Request(`https://brand-cache/${encodeURIComponent(name)}`);
  const cache = caches.default;
  const hit = await cache.match(key);
  if (hit) return new Response(hit.body, hit);

  const report = await checkBrand(name, []).catch((err) => ({ error: err.message }));
  if (report.error) return json(report, 500);

  const res = json(report);
  const stored = new Response(JSON.stringify(report), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${TTL}` },
  });
  waitUntil(cache.put(key, stored));
  return res;
}
