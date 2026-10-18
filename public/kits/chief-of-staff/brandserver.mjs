// brandserver.mjs — the brand checker as a page on this PC.
// The bot starts it (see chief-of-staff.mjs); it can also run on its own:
//   node brandserver.mjs        then open http://localhost:8787
// On its own there is no claude, so branches fall back to DEFAULT_INDUSTRIES.
// Listens on 127.0.0.1 only — a tool for this PC, not the internet — except
// on a host like Render, which sets PORT and needs 0.0.0.0 (see render.yaml).

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkBrand, diagnose, cleanName, parseIndustryList, DEFAULT_INDUSTRIES } from './brandcheck.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_PORT = 8787;

// Each check is ~60 lookups; on a public link, don't let a crowd pile them up.
const MAX_RUNNING = 2;
let running = 0;

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

// suggest(brand) -> Promise<string[] | null>; checkIo is for tests.
export function startBrandServer({ port = DEFAULT_PORT, host = '127.0.0.1', suggest, checkIo } = {}) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'GET only' });

      if (url.pathname === '/' || url.pathname === '/index.html') {
        const html = await readFile(join(HERE, 'brand.html'));
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(html);
      }

      if (url.pathname === '/diag') {
        if (running >= MAX_RUNNING) return sendJson(res, 429, { error: 'Busy — try again in a minute.' });
        running++;
        try {
          const text = await diagnose(checkIo);
          res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
          return res.end(text);
        } finally {
          running--;
        }
      }

      const brand = cleanName(url.searchParams.get('name'));
      if (url.pathname === '/api/suggest') {
        if (!brand) return sendJson(res, 400, { error: 'Give me a brand name.' });
        const picked = suggest && (await suggest(brand).catch(() => null));
        return sendJson(res, 200, { brand, industries: picked || DEFAULT_INDUSTRIES, by: picked ? 'claude' : 'default' });
      }

      if (url.pathname === '/api/brand') {
        if (!brand) return sendJson(res, 400, { error: 'Give me a brand name.' });
        const industries = parseIndustryList(url.searchParams.get('industries') || '');
        if (running >= MAX_RUNNING) {
          return sendJson(res, 429, { error: 'Busy with another check — try again in a minute.' });
        }
        console.log(`[${new Date().toISOString()}] brand page: ${brand} (${industries.join(', ') || 'no branches'})`);
        running++;
        try {
          return sendJson(res, 200, await checkBrand(brand, industries, checkIo));
        } finally {
          running--;
        }
      }

      return sendJson(res, 404, { error: 'Not found' });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  });

  server.on('error', (err) => console.error(`Brand page could not start on port ${port}: ${err.message}`));
  server.listen(port, host);
  return server;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const hosted = Boolean(process.env.PORT);
  const port = Number(process.env.PORT || process.env.COS_BRAND_PORT) || DEFAULT_PORT;
  const host = hosted ? '0.0.0.0' : '127.0.0.1';
  startBrandServer({ port, host }).on('listening', () =>
    console.log(`Brand checker on http://${host}:${port} — Ctrl+C to stop.`),
  );
}
