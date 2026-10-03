// POST /api/tg/<id> — Telegram webhook for a visitor's own bot.
// Photo of a name card in -> short summary + contact file (.vcf) back.
// Photos are never stored; they pass straight through to the card reader.

import { readCard, describe, toVcard } from '../../../public/play/name-card-scanner/cardread.js';
import { tg, tgSendFile, decrypt, toBase64, underLimit, DAILY_LIMIT } from '../../../server/shared.js';
import { disconnect } from './connect.js';

const HELP =
  'Send me a photo of a name card (or several cards in one photo) and I will ' +
  'send back a contact file. Tap it to save the contact to your phone. ' +
  'Add a caption to note where you met. /disconnect to unlink this bot.';

export async function onRequestPost({ request, env, params, waitUntil }) {
  const raw = await env.CARDS_KV.get(`bot:${params.id}`);
  if (!raw) return new Response('gone', { status: 404 });
  const bot = JSON.parse(raw);

  if (request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== bot.secret) {
    return new Response('forbidden', { status: 403 });
  }

  const update = await request.json().catch(() => ({}));
  const message = update.message;
  if (!message) return new Response('ok');

  // Answer Telegram at once; the card is read in the background so a slow
  // read never makes Telegram retry the update.
  waitUntil(handle(env, params.id, bot, message).catch((err) => console.error(err.message)));
  return new Response('ok');
}

async function handle(env, id, bot, message) {
  const token = await decrypt(env, bot.token);
  const chatId = message.chat.id;
  const text = (message.text || '').trim();
  const say = (t) => tg(token, 'sendMessage', { chat_id: chatId, text: t });

  // The first chat to open the link from the page becomes the owner.
  if (!bot.owner) {
    if (text === `/start ${bot.startCode}`) {
      bot.owner = chatId;
      await env.CARDS_KV.put(`bot:${id}`, JSON.stringify(bot));
      return say(`Connected. ${HELP}`);
    }
    return say('This bot is not set up yet. Open the link from the Name Card Scanner page.');
  }
  if (chatId !== bot.owner) return say('This bot is private.');

  if (text === '/disconnect') {
    await say('Disconnected. This bot will stop reading cards.');
    return disconnect(env, id, bot);
  }

  const image = imageOf(message);
  if (!image) return say(HELP);

  if (!(await underLimit(env.CARDS_KV, `bot:${id}`))) {
    return say(`Daily limit reached (${DAILY_LIMIT} cards a day). Try again tomorrow.`);
  }

  await tg(token, 'sendChatAction', { chat_id: chatId, action: 'upload_document' }).catch(() => {});

  try {
    const file = await tg(token, 'getFile', { file_id: image.fileId });
    const res = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
    if (!res.ok) throw new Error('could not download the photo');
    const cards = await readCard({
      apiKey: env.GEMINI_API_KEY,
      base64: toBase64(await res.arrayBuffer()),
      mimeType: image.mimeType,
    });
    if (!cards.length) {
      return say('I could not find a name card in that photo. Try again with the card filling the frame.');
    }

    const date = new Date().toISOString().slice(0, 10);
    const where = (message.caption || '').trim();
    const note = [`Scanned ${date}`, where && `Met: ${where}`].filter(Boolean).join('\n');
    await say(cards.map((c) => describe(c) + (c.note ? `\n  (${c.note})` : '')).join('\n') +
      '\n\nTap the file below to save.');

    const name = (cards[0].name || cards[0].organisation || 'contact').replace(/[\\/:*?"<>|]+/g, '').slice(0, 60);
    await tgSendFile(token, chatId, `${name}.vcf`, toVcard(cards, note), 'text/vcard');
  } catch (err) {
    await say(`Something went wrong with that card: ${err.message}`);
  }
}

function imageOf(message) {
  if (message.photo?.length) return { fileId: message.photo.at(-1).file_id, mimeType: 'image/jpeg' };
  const doc = message.document;
  if (doc && /^image\/(jpeg|png|webp|heic|heif)$/.test(doc.mime_type || '')) {
    return { fileId: doc.file_id, mimeType: doc.mime_type };
  }
  return null;
}
