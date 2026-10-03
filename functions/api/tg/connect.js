// POST /api/tg/connect     { token }        -> { botName, ownerLink, id, key }
// POST /api/tg/connect     { id, key, disconnect: true } -> { ok }
//
// Connecting points the visitor's own bot at our webhook. The token is kept
// encrypted in KV under a random id; `key` (kept in their browser) is the only
// way to disconnect from the page. The bot only answers the chat that opens
// `ownerLink` first, so strangers who find the bot cannot use it.

import { json, tg, encrypt, decrypt, randomId, sha256 } from '../../../server/shared.js';

const TOKEN_SHAPE = /^\d{5,15}:[A-Za-z0-9_-]{30,50}$/;

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const kv = env.CARDS_KV;

  if (body.disconnect) {
    const bot = body.id && JSON.parse((await kv.get(`bot:${body.id}`)) || 'null');
    if (!bot || bot.keyHash !== (await sha256(String(body.key || '')))) {
      return json({ error: 'Nothing to disconnect.' }, 404);
    }
    await disconnect(env, body.id, bot);
    return json({ ok: true });
  }

  const token = String(body.token || '').trim();
  if (!TOKEN_SHAPE.test(token)) {
    return json({ error: 'That does not look like a bot token. Copy it from @BotFather.' }, 400);
  }

  let me;
  try {
    me = await tg(token, 'getMe');
  } catch {
    return json({ error: 'Telegram did not accept that token.' }, 400);
  }

  // One connection per bot: connecting again replaces the old one.
  const tokenHash = await sha256(token);
  const oldId = await kv.get(`tok:${tokenHash}`);
  if (oldId) await kv.delete(`bot:${oldId}`);

  const id = randomId();
  const key = randomId();
  const startCode = randomId(8);
  const secret = randomId();

  await kv.put(`bot:${id}`, JSON.stringify({
    token: await encrypt(env, token),
    tokenHash,
    secret,
    keyHash: await sha256(key),
    startCode,
    owner: null,
    username: me.username,
  }));
  await kv.put(`tok:${tokenHash}`, id);

  const origin = new URL(request.url).origin;
  try {
    await tg(token, 'setWebhook', {
      url: `${origin}/api/tg/${id}`,
      secret_token: secret,
      allowed_updates: ['message'],
      drop_pending_updates: true,
    });
  } catch (err) {
    await kv.delete(`bot:${id}`);
    await kv.delete(`tok:${tokenHash}`);
    return json({ error: `Could not connect the bot: ${err.message}` }, 502);
  }

  return json({
    id,
    key,
    botName: me.first_name,
    username: me.username,
    ownerLink: `https://t.me/${me.username}?start=${startCode}`,
  });
}

export async function disconnect(env, id, bot) {
  try {
    await tg(await decrypt(env, bot.token), 'deleteWebhook', { drop_pending_updates: true });
  } catch {
    // Token revoked or bot deleted — nothing left to unhook.
  }
  await env.CARDS_KV.delete(`bot:${id}`);
  await env.CARDS_KV.delete(`tok:${bot.tokenHash}`);
}
