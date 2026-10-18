// /api/scores — the world high-score board for M3TAL INV4D3RS.
//   GET                                  -> { board }   top 20
//   POST { action: 'start' }             -> { token, id }   signed run ticket
//   POST { action: 'submit', token, name, score, wave, time }
//                                        -> { rank, total, board }
// The board is one KV value (top 50). A run ticket is HMAC-signed with
// TOKEN_KEY and carries its start time, so a score can't claim more play time
// than really passed. Sending the same ticket again only renames the entry.
// KV writes are kept low on purpose: only scores that make the top 50 write.

import { json } from '../../server/shared.js';

const KEY = 'mi:board';
const KEEP = 50;
const SHOW = 20;
const BAD = ['fuck', 'shit', 'cunt', 'bitch', 'dick', 'cock', 'pussy', 'nigg', 'fag', 'slut', 'whore', 'rape', 'nazi',
  'puki', 'pukimak', 'kimak', 'pantat', 'babi', 'lancau', 'cibai', 'butoh', 'jubur', 'sial', 'kote', 'bangsat'];

const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function sign(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}

// Highest score a run could plausibly reach by a given wave (generous on purpose).
const maxScore = (wave) => 60000 + 30000 * wave + 4000 * wave * wave;

function cleanName(raw) {
  const name = String(raw || '').toUpperCase().replace(/[^A-Z0-9 ._-]/g, '').trim().slice(0, 12);
  if (name.length < 3) return 'SOLDIER';
  const plain = name.toLowerCase().replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a')
    .replace(/5/g, 's').replace(/7/g, 't').replace(/[^a-z]/g, '');
  return BAD.some((w) => plain.includes(w)) ? 'SOLDIER' : name;
}

async function readBoard(env) {
  return (await env.CARDS_KV.get(KEY, { type: 'json' })) || [];
}
const publicRow = ({ id, n, s, w }) => ({ id, n, s, w });

// Simple per-IP limit using the edge cache (no KV writes).
async function limited(request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const hour = Math.floor(Date.now() / 3600000);
  const key = new Request(`https://mi-rate/${encodeURIComponent(ip)}/${hour}`);
  const cache = caches.default;
  const hit = await cache.match(key);
  const n = hit ? parseInt(await hit.text(), 10) || 0 : 0;
  await cache.put(key, new Response(String(n + 1), { headers: { 'Cache-Control': 'max-age=3600' } }));
  return n >= 40;
}

export async function onRequestGet({ env }) {
  const board = await readBoard(env);
  return json({ board: board.slice(0, SHOW).map(publicRow) });
}

export async function onRequestPost({ request, env }) {
  const secret = env.TOKEN_KEY;
  if (!secret) return json({ error: 'Board not set up' }, 503);
  const body = await request.json().catch(() => ({}));

  if (body.action === 'start') {
    const id = crypto.randomUUID().slice(0, 12);
    const t0 = Date.now();
    const sig = await sign(secret, `${id}.${t0}`);
    return json({ id, token: `${id}.${t0}.${sig}` });
  }

  if (body.action !== 'submit') return json({ error: 'Unknown action' }, 400);
  if (await limited(request)) return json({ error: 'Too many scores, try later' }, 429);

  const [id, t0s, sig] = String(body.token || '').split('.');
  const t0 = Number(t0s);
  if (!id || !t0 || sig !== (await sign(secret, `${id}.${t0}`))) return json({ error: 'Bad ticket' }, 400);

  const score = Math.floor(Number(body.score));
  const wave = Math.floor(Number(body.wave));
  const time = Math.floor(Number(body.time));
  const elapsed = (Date.now() - t0) / 1000;
  if (!(score > 0) || !(wave >= 1) || wave > 999 || !(time >= 0)) return json({ error: 'Bad score' }, 400);
  if (elapsed > 6 * 3600) return json({ error: 'Ticket expired' }, 400);
  if (time > elapsed + 10) return json({ error: 'Clock mismatch' }, 400);
  if (time < (wave - 1) * 6) return json({ error: 'Too fast' }, 400);
  if (score > maxScore(wave)) return json({ error: 'Score too high for that wave' }, 400);

  const name = cleanName(body.name);
  const board = await readBoard(env);
  const prev = board.find((r) => r.id === id);
  let changed = false;
  if (prev) {
    // Same run sent again: allow a rename only.
    if (prev.n !== name) { prev.n = name; changed = true; }
  } else if (board.length < KEEP || score > board[board.length - 1].s) {
    board.push({ id, n: name, s: score, w: wave, t: time, d: new Date().toISOString().slice(0, 10) });
    board.sort((a, b) => b.s - a.s);
    board.length = Math.min(board.length, KEEP);
    changed = board.some((r) => r.id === id);
  }
  if (changed) await env.CARDS_KV.put(KEY, JSON.stringify(board));

  const idx = board.findIndex((r) => r.id === id);
  return json({ rank: idx >= 0 ? idx + 1 : null, total: board.length, board: board.slice(0, SHOW).map(publicRow) });
}
