// POST /api/read-card  { image: <base64, no data: prefix>, mimeType }
// -> { cards: [...] }. Nothing is stored; the image only passes through.

import { readCard } from '../../public/play/name-card-scanner/cardread.js';
import { json, underLimit, countUse, isOwner, geminiSend, NEED_KEY } from '../../server/shared.js';

const NEED_KEY_MSG = 'Free scans for today are used up. Add your own free Gemini key to keep scanning with no daily limit.';

const MAX_BYTES = 4 * 1024 * 1024;
const TYPES = /^image\/(jpeg|png|webp|heic|heif)$/;

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Send the photo as JSON.' }, 400);
  }

  const { image, mimeType = 'image/jpeg' } = body || {};
  if (typeof image !== 'string' || !image || !TYPES.test(mimeType)) {
    return json({ error: 'That is not a photo I can read.' }, 400);
  }
  if (image.length * 0.75 > MAX_BYTES) {
    return json({ error: 'That photo is too large (4 MB max).' }, 413);
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const owner = await isOwner(request.headers.get('X-Owner-Key'));
  if (!owner && !(await underLimit(env.CARDS_KV, `ip:${ip}`))) {
    return json({ error: NEED_KEY_MSG, code: NEED_KEY }, 429);
  }

  try {
    const cards = await readCard({ apiKey: env.GEMINI_API_KEY, baseUrl: env.GEMINI_BASE_URL || undefined, send: geminiSend(env), base64: image, mimeType });
    if (!owner) await countUse(env.CARDS_KV, `ip:${ip}`);
    return json({ cards });
  } catch (err) {
    // The site's free key is used up for today.
    if (err.code === 'quota') return json({ error: NEED_KEY_MSG, code: NEED_KEY }, 429);
    return json({ error: `Could not read the card: ${err.message}` }, 502);
  }
}
