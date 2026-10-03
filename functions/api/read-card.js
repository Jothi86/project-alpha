// POST /api/read-card  { image: <base64, no data: prefix>, mimeType }
// -> { cards: [...] }. Nothing is stored; the image only passes through.

import { readCard } from '../../public/play/name-card-scanner/cardread.js';
import { json, underLimit, DAILY_LIMIT } from '../../server/shared.js';

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
  if (!(await underLimit(env.CARDS_KV, `ip:${ip}`))) {
    return json({ error: `Daily limit reached (${DAILY_LIMIT} cards a day). Try again tomorrow.` }, 429);
  }

  try {
    const cards = await readCard({ apiKey: env.GEMINI_API_KEY, base64: image, mimeType });
    return json({ cards });
  } catch (err) {
    return json({ error: `Could not read the card: ${err.message}` }, 502);
  }
}
