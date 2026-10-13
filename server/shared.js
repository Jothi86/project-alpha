// shared.js — helpers for the name card scanner's Cloudflare functions.
// Bindings (set in wrangler.toml / Pages secrets):
//   CARDS_KV        KV namespace: daily counters and connected Telegram bots
//   GEMINI_API_KEY  secret: reads the cards
//   TOKEN_KEY       secret: base64 32-byte AES key that encrypts bot tokens

export const DAILY_LIMIT = 50;

// The site owner scans without a limit. The page sends the owner key (kept in
// the owner's browser) as X-Owner-Key; only its SHA-256 lives here.
const OWNER_KEY_HASH = 'ac93e531cd7c6a1b67dbdbea2bbe50cf8845f5c780fd0a09ac24573292b7826a';

export async function isOwner(key) {
  if (!key) return false;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex === OWNER_KEY_HASH;
}

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const today = () => new Date().toISOString().slice(0, 10);

// True while `who` has scans left today. Only successful reads are counted
// (countUse), so a failed read never uses up the allowance.
export async function underLimit(kv, who) {
  const used = Number((await kv.get(`rl:${who}:${today()}`)) || 0);
  return used < DAILY_LIMIT;
}

export async function countUse(kv, who) {
  const key = `rl:${who}:${today()}`;
  const used = Number((await kv.get(key)) || 0);
  await kv.put(key, String(used + 1), { expirationTtl: 60 * 60 * 48 });
}

export function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(out);
}

const fromBase64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function randomId(bytes = 16) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function sha256(text) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// --- bot tokens are stored encrypted ---

async function aesKey(env) {
  return crypto.subtle.importKey('raw', fromBase64(env.TOKEN_KEY), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encrypt(env, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(env), new TextEncoder().encode(text));
  return `${toBase64(iv)}.${toBase64(data)}`;
}

export async function decrypt(env, sealed) {
  const [iv, data] = sealed.split('.').map(fromBase64);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await aesKey(env), data);
  return new TextDecoder().decode(plain);
}

// --- Telegram ---

export async function tg(token, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new Error(data.description || `Telegram ${method} failed`);
  return data.result;
}

export async function tgSendFile(token, chatId, filename, text, type) {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('document', new Blob([text], { type }), filename);
  const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new Error(data.description || 'Telegram sendDocument failed');
}
