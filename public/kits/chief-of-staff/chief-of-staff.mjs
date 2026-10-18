// chief-of-staff.mjs — Telegram bot, plain Node, no dependencies.
// Long-polls getUpdates; every non-command message is answered by Claude Code
// running as a subprocess. Run with: node chief-of-staff.mjs

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCard, describe, toVcard, isOtherSide, mergeCards } from './cardread.mjs';
import { accessTokenFromRefresh, saveCard, deleteContact, listAll } from './contacts.mjs';
import { checkBrand, formatText, parseBrandArgs, parseIndustries, suggestPrompt, DEFAULT_INDUSTRIES } from './brandcheck.mjs';
import { startBrandServer, DEFAULT_PORT } from './brandserver.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV_FILE = join(HERE, '.env');
const POLL_TIMEOUT = 30; // seconds — Telegram holds the request open this long
const TYPING_EVERY_MS = 4000; // Telegram shows "typing" for ~5s per action
const CLAUDE_TIMEOUT_MS = 180000; // give up on a wedged claude after 3 minutes

// --- .env ---------------------------------------------------------------

function loadEnv() {
  let raw;
  try {
    raw = readFileSync(ENV_FILE, 'utf8').replace(/^﻿/, '');
  } catch {
    die('No .env file found next to chief-of-staff.mjs. Run install.ps1 again.');
  }
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function die(message) {
  console.error(message);
  process.exit(1);
}

const ENV = loadEnv();

const TOKEN = ENV.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  die('TELEGRAM_BOT_TOKEN is empty. Paste your token after the "=" in .env and try again.');
}

// Only this chat gets real answers; everyone else is turned away.
// Empty on a fresh install: the first chat to send "/start <COS_PAIR_CODE>"
// (the link the installer opens) becomes the owner, and is written to .env.
let ALLOWED_CHAT = ENV.COS_ALLOWED_CHAT;
const PAIR_CODE = ENV.COS_PAIR_CODE;
if (!ALLOWED_CHAT && !PAIR_CODE) {
  die('COS_ALLOWED_CHAT is empty. Run install.ps1 again, or put your chat id after the "=" in .env.');
}

// Remember the owner: set COS_ALLOWED_CHAT and drop the one-time pairing code.
function saveOwner(chatId) {
  ALLOWED_CHAT = String(chatId);
  const lines = readFileSync(ENV_FILE, 'utf8').replace(/^﻿/, '').split(/\r?\n/)
    .filter((l) => !/^\s*(COS_ALLOWED_CHAT|COS_PAIR_CODE)\s*=/.test(l));
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  writeFileSync(ENV_FILE, [...lines, `COS_ALLOWED_CHAT=${ALLOWED_CHAT}`, ''].join('\r\n'));
}

// Where claude runs, and therefore what it can read. Change it in .env.
const WORK_DIR = ENV.COS_WORK_DIR || join(homedir(), 'Documents');
if (!existsSync(WORK_DIR)) {
  die(`COS_WORK_DIR (${WORK_DIR}) does not exist. Put the folder claude should work in after the "=" in .env.`);
}

const API = `https://api.telegram.org/bot${TOKEN}`;

// --- Name cards ---------------------------------------------------------

// Photos of name cards are read by Gemini, not claude. A free key from
// https://aistudio.google.com/apikey is enough.
const GEMINI_KEY = ENV.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const CARDS_DIR = ENV.COS_CARDS_DIR || join(WORK_DIR, 'Name Cards');
const REGISTER = join(CARDS_DIR, 'name-cards.csv');
const REGISTER_HEADER =
  'date,name,title,organisation,phone,email,category,where_met,image,google_contact,status';

// Saving into Google Contacts is optional: without these the bot still reads
// the card, files it and sends back a contact file.
const GOOGLE = {
  clientId: ENV.GOOGLE_CLIENT_ID,
  clientSecret: ENV.GOOGLE_CLIENT_SECRET,
  refreshToken: ENV.GOOGLE_REFRESH_TOKEN,
};
const GOOGLE_READY = Boolean(GOOGLE.clientId && GOOGLE.clientSecret && GOOGLE.refreshToken);

// A read-only copy of every Google contact, so claude can find people by job,
// organisation or where we met (it has no Google Contacts access of its own).
const CONTACTS_INDEX = join(CARDS_DIR, 'all-contacts.csv');
const INDEX_EVERY_MS = 6 * 60 * 60 * 1000;

// --- Brand checker ------------------------------------------------------

// /brand in the chat, and the same check as a page on this PC.
const BRAND_PORT = Number(ENV.COS_BRAND_PORT) || DEFAULT_PORT;

// --- Claude Code --------------------------------------------------------

// The only two tools /send ever hands over, and only for that one run.
const SENDING_TOOLS = ['mcp__claude_ai_Gmail__send_message', 'mcp__claude_ai_Gmail__reply'];

// Everything not listed here stays available to claude.
const NEVER = [
  // never send mail in my name
  ...SENDING_TOOLS,
  'mcp__claude_ai_Gmail__forward',
  // never throw mail away
  'mcp__claude_ai_Gmail__trash_message',
  'mcp__claude_ai_Gmail__trash_thread',
  // never run shell commands
  'Bash',
  'PowerShell',
  // never change files on disk
  'Edit',
  'Write',
  'NotebookEdit',
];

const DISALLOWED_TOOLS = NEVER.join(',');
const DISALLOWED_WHEN_SENDING = NEVER.filter((t) => !SENDING_TOOLS.includes(t)).join(',');

const SEND_INSTRUCTION =
  'Send the draft you just prepared, exactly as written. Do not change the ' +
  'wording or the recipient. Then tell me in one line who it went to.';

// Spawning without a shell means Windows does not apply PATHEXT for us, so
// bare "claude" would not resolve. Find the real executable once, at startup.
function findClaude() {
  if (ENV.COS_CLAUDE_BIN) return ENV.COS_CLAUDE_BIN;
  const extensions = process.platform === 'win32' ? ['.exe', ''] : [''];
  for (const dir of (process.env.PATH || '').split(delimiter)) {
    if (!dir) continue;
    for (const ext of extensions) {
      const candidate = join(dir, `claude${ext}`);
      if (existsSync(candidate)) return candidate;
    }
  }
  die('Could not find claude on PATH. Set COS_CLAUDE_BIN in .env to its full path.');
}

const CLAUDE_BIN = findClaude();

const TELEGRAM_SYSTEM_PROMPT =
  'You are answering over Telegram, on a phone. Keep replies to a few short ' +
  'sentences, no headings, no tables, no formatting. Answer only from what you ' +
  'can actually read. If you cannot find something, say so. Never invent a ' +
  'fact, a date, a number or a name. ' +
  'When asked to find a person or contact — by name, job, title, organisation, ' +
  'agency, area or where we met — search these two CSV files with Grep (try ' +
  'several keywords: synonyms, abbreviations and other languages the card may use): ' +
  `"${join(CARDS_DIR, 'name-cards.csv')}" (name cards scanned via this bot: ` +
  'date, title, organisation, category, where_met) and ' +
  `"${join(CARDS_DIR, 'all-contacts.csv')}" (every Google contact: name, title, ` +
  'organisation, department, phones, emails, address, labels, notes). ' +
  'Give name, role, organisation and phone for each match.';

// chat id -> session_id, so each chat keeps its own thread of conversation.
const sessions = new Map();

// chat id -> true when my own last reply offered a draft. Nothing else opens
// the door to /send.
const draftReady = new Map();

function runClaude(prompt, sessionId, allowSending = false) {
  const args = [
    '-p', prompt,
    '--output-format', 'json',
    '--model', 'sonnet',
    '--disallowedTools', allowSending ? DISALLOWED_WHEN_SENDING : DISALLOWED_TOOLS,
  ];

  // Off the never list is not enough on its own: headless claude auto-refuses
  // a tool that is merely undenied, so name the two explicitly.
  if (allowSending) {
    args.push('--allowedTools', SENDING_TOOLS.join(','));
  }

  if (sessionId) {
    args.push('--resume', sessionId);
  } else {
    // Only needed once — a resumed session already carries it.
    args.push('--append-system-prompt', TELEGRAM_SYSTEM_PROMPT);
  }

  return new Promise((resolve, reject) => {
    // No shell: the message goes in as one argv entry, so nothing inside it
    // can be read as a command.
    const child = spawn(CLAUDE_BIN, args, { cwd: WORK_DIR, windowsHide: true });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      settled = true;
      child.kill();
      reject(new Error('claude took too long and was stopped'));
    }, CLAUDE_TIMEOUT_MS);

    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));

    child.on('error', (err) => {
      clearTimeout(timer);
      if (!settled) reject(new Error(`could not start claude: ${err.message}`));
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (settled) return;
      if (code !== 0) {
        const last = stderr.trim().split('\n').pop();
        return reject(new Error(last || `claude exited with code ${code}`));
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error('claude did not return readable JSON'));
      }
    });
  });
}

// --- Telegram API -------------------------------------------------------

async function call(method, body, timeoutMs) {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`${method} failed: ${data.description || res.status}`);
  }
  return data.result;
}

function send(chatId, text) {
  return call('sendMessage', { chat_id: chatId, text }, 20000);
}

// For sending files: same as call(), but as a multipart form.
async function callMultipart(method, fields, timeoutMs) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value && value.blob) form.append(key, value.blob, value.filename);
    else form.append(key, String(value));
  }
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`${method} failed: ${data.description || res.status}`);
  }
  return data.result;
}

async function downloadFile(fileId) {
  const file = await call('getFile', { file_id: fileId }, 20000);
  const res = await fetch(`https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`, {
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`could not download the photo (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

// Telegram rejects anything over 4096 characters.
async function sendLong(chatId, text) {
  const body = text && text.trim() ? text : '(claude came back with nothing)';
  const LIMIT = 4000;
  for (let i = 0; i < body.length; i += LIMIT) {
    await send(chatId, body.slice(i, i + LIMIT));
  }
}

function startTyping(chatId) {
  const ping = () =>
    call('sendChatAction', { chat_id: chatId, action: 'typing' }, 10000).catch(() => {});
  ping();
  const handle = setInterval(ping, TYPING_EVERY_MS);
  return () => clearInterval(handle);
}

// --- Message handling ---------------------------------------------------

const HELP =
  'I am your chief of staff. Just ask me something. Send a photo of a name ' +
  'card and I will save the contact (add a caption to note where you met). ' +
  '/brand berjaya to see which websites and social handles are free for a brand ' +
  'and 5 branches (or pick them: /brand berjaya: food, hotels). ' +
  '/send to send a draft I just prepared, /undo to remove the last card saved, ' +
  '/reset to start a fresh conversation, /id for your chat id.';

const NOTHING_TO_SEND = 'Nothing to send. Ask me to draft something first.';

// "draft", "drafted", "draf" — English and Malay.
const MENTIONS_DRAFT = /\bdraf(t(s|ed|ing)?)?\b/i;
// ...but not when the reply is saying there isn't one.
const DENIES_DRAFT = /\b(no|not|never|cannot find a|could not find a|couldn't find a|without a)\s+draf/i;

function offersDraft(text) {
  return Boolean(text) && MENTIONS_DRAFT.test(text) && !DENIES_DRAFT.test(text);
}

// One place for the slow path: typing indicator, session bookkeeping, errors.
async function askClaude(chatId, prompt, allowSending = false) {
  const stopTyping = startTyping(chatId);
  try {
    const result = await runClaude(prompt, sessions.get(chatId), allowSending);

    if (result.session_id) {
      sessions.set(chatId, result.session_id);
    }

    console.log(
      `  -> answered in ${result.duration_ms ?? '?'}ms, session ${result.session_id ?? '?'}` +
        (allowSending ? ' (sending allowed)' : ''),
    );

    let reply = result.result ?? '';

    if (allowSending) {
      // The draft is gone now; a second bare /send must not resend it.
      draftReady.delete(chatId);
    } else if (offersDraft(reply)) {
      draftReady.set(chatId, true);
      reply += '\n\nSend it with /send.';
    } else {
      draftReady.delete(chatId);
    }

    await sendLong(chatId, reply);
  } catch (err) {
    console.error(`  -> ${err.message}`);
    // A dead session id would keep failing forever; drop it so the next
    // message starts clean.
    sessions.delete(chatId);
    draftReady.delete(chatId);
    await send(chatId, `Something went wrong: ${err.message}`);
  } finally {
    stopTyping();
  }
}

// --- Name card photos ---------------------------------------------------

// chat id -> what the last card photo saved, so /undo can take it back.
const lastCards = new Map();

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const safeName = (s) => s.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);

// The image the message carries, or null. Photos come in several sizes; the
// last is the largest. Images sent "as file" arrive as documents.
function imageOf(message) {
  if (message.photo?.length) {
    return { fileId: message.photo.at(-1).file_id, mimeType: 'image/jpeg', ext: 'jpg' };
  }
  const doc = message.document;
  if (doc && /^image\/(jpeg|png|webp|heic|heif)$/.test(doc.mime_type || '')) {
    const ext = doc.mime_type.split('/')[1].replace('jpeg', 'jpg');
    return { fileId: doc.file_id, mimeType: doc.mime_type, ext };
  }
  return null;
}

function fileCard(bytes, ext, cards, date) {
  mkdirSync(CARDS_DIR, { recursive: true });
  const first = cards[0];
  const label = safeName([first?.name, first?.organisation].filter(Boolean).join('_')) || 'card';
  let name = `${date}_${label}.${ext}`;
  for (let n = 2; existsSync(join(CARDS_DIR, name)); n++) name = `${date}_${label}-${n}.${ext}`;
  writeFileSync(join(CARDS_DIR, name), bytes);
  return name;
}

const rowText = (row) => row.map(csvCell).join(',');

function addToRegister(rows) {
  if (!existsSync(REGISTER)) {
    // BOM so Excel opens it as UTF-8.
    writeFileSync(REGISTER, `﻿${REGISTER_HEADER}\r\n`);
  }
  appendFileSync(REGISTER, rows.map(rowText).join('\r\n') + '\r\n');
}

// Swap one register row for another (the card's other side came in).
function replaceInRegister(oldText, newText) {
  if (!existsSync(REGISTER)) return addToRegister([]);
  const text = readFileSync(REGISTER, 'utf8');
  if (text.includes(oldText)) writeFileSync(REGISTER, text.replace(oldText, newText));
  else appendFileSync(REGISTER, newText + '\r\n');
}

const registerRow = (date, card, whereMet, imageFile, resourceName, status) => [
  date, [card.honorific, card.name].filter(Boolean).join(' '), card.title, card.organisation,
  card.phones.map((p) => p.number).join(' / '), card.emails.join(' / '), card.category,
  whereMet, imageFile, resourceName || '', status,
];

// chat id -> the single card scanned last, so its other side can join it.
const lastScan = new Map();

const joinNotes = (...notes) =>
  [...new Set(notes.flatMap((n) => (n || '').split('\n')).filter(Boolean))].join('\n');

async function sendVcard(chatId, cards, note) {
  const vcfName = `${safeName(cards[0].name || cards[0].organisation || 'contact')}.vcf`;
  await callMultipart('sendDocument', {
    chat_id: chatId,
    document: { blob: new Blob([toVcard(cards, note)], { type: 'text/vcard' }), filename: vcfName },
  }, 30000);
}

// The photo is the other side of the card just scanned: fold it into that
// contact instead of making a second one.
async function mergeOtherSide(chatId, last, back, bytes, image, date, whereMet) {
  const card = mergeCards(last.card, back);
  const note = joinNotes(last.note, whereMet && `Met: ${whereMet}`);
  const imageFile = fileCard(bytes, image.ext, [card], date);
  const images = `${last.imageFile} + ${imageFile}`;

  let saved = null;
  let googleError = '';
  if (GOOGLE_READY) {
    try {
      const token = await accessTokenFromRefresh(GOOGLE);
      saved = await saveCard(token, card, note, { resourceName: last.resourceName || undefined });
    } catch (err) {
      googleError = err.message;
      console.error(`  -> ${err.message}`);
    }
  }

  const status = saved ? 'saved (both sides)' : 'file only';
  replaceInRegister(last.rowText, rowText(registerRow(date, card, whereMet || last.whereMet, images, saved?.resourceName, status)));
  lastScan.delete(chatId); // a card has two sides; don't merge a third photo in
  if (saved) refreshContactsIndex();
  console.log('  -> merged with the other side of the last card');

  let reply = `Added the other side to: ${describe(card)}` + (card.note ? `\n  (${card.note})` : '');
  if (googleError) reply += `\n\nCould not update Google Contacts: ${googleError}. Tap the file below to save.`;
  else if (saved) reply += '\n\nSame contact, now with both sides.';
  await send(chatId, reply);
  await sendVcard(chatId, [card], note);
}

function markRemoved(resourceNames) {
  if (!existsSync(REGISTER)) return;
  const lines = readFileSync(REGISTER, 'utf8').split('\r\n');
  const updated = lines.map((line) =>
    resourceNames.some((r) => line.includes(`,${r},`)) ? line.replace(/,(saved|updated|saved \(both sides\))$/, ',removed') : line,
  );
  writeFileSync(REGISTER, updated.join('\r\n'));
}

let indexing = null;
function refreshContactsIndex() {
  if (!GOOGLE_READY || indexing) return indexing;
  indexing = (async () => {
    try {
      const people = await listAll(await accessTokenFromRefresh(GOOGLE));
      const cols = ['name', 'title', 'organisation', 'department', 'phones', 'emails', 'address', 'labels', 'notes'];
      mkdirSync(CARDS_DIR, { recursive: true });
      writeFileSync(
        CONTACTS_INDEX,
        '﻿' + [cols.join(','), ...people.map((p) => cols.map((c) => csvCell(p[c])).join(','))].join('\r\n') + '\r\n',
      );
      console.log(`  -> contacts index refreshed: ${people.length} contacts`);
    } catch (err) {
      console.error(`  -> contacts index failed: ${err.message}`);
    } finally {
      indexing = null;
    }
  })();
  return indexing;
}

async function handleCard(chatId, message, image) {
  const stopTyping = startTyping(chatId);
  try {
    if (!GEMINI_KEY) {
      throw new Error('name card reading is off. Get a free key at https://aistudio.google.com/apikey, ' +
        'put it after GEMINI_API_KEY= in the .env file, and restart the bot');
    }

    const bytes = await downloadFile(image.fileId);
    const cards = await readCard({ apiKey: GEMINI_KEY, base64: bytes.toString('base64'), mimeType: image.mimeType });
    console.log(`  -> read ${cards.length} card(s)`);

    if (!cards.length) {
      await send(chatId, 'I could not find a name card in that photo. Try again with the card filling the frame.');
      return;
    }

    const date = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, this PC's time zone
    const whereMet = (message.caption || '').trim();

    const last = lastScan.get(chatId);
    if (cards.length === 1 && last && isOtherSide(last.card, cards[0], Date.now() - last.at)) {
      await mergeOtherSide(chatId, last, cards[0], bytes, image, date, whereMet);
      return;
    }

    const note = [`Scanned ${date}`, whereMet && `Met: ${whereMet}`].filter(Boolean).join('\n');
    const imageFile = fileCard(bytes, image.ext, cards, date);

    const lines = [];
    const rows = [];
    const created = [];
    let googleError = '';

    for (const card of cards) {
      let saved = null;
      if (GOOGLE_READY && !googleError) {
        try {
          const token = await accessTokenFromRefresh(GOOGLE);
          saved = await saveCard(token, card, note);
          if (!saved.updated) created.push(saved.resourceName);
        } catch (err) {
          googleError = err.message;
          console.error(`  -> ${err.message}`);
        }
      }
      const status = saved ? (saved.updated ? 'updated' : 'saved') : 'file only';
      lines.push(`${saved?.updated ? 'Updated' : saved ? 'Saved' : 'Read'}: ${describe(card)}` +
        (card.note ? `\n  (${card.note})` : ''));
      rows.push(registerRow(date, card, whereMet, imageFile, saved?.resourceName, status));
      if (cards.length === 1) {
        lastScan.set(chatId, {
          card, at: Date.now(), note, whereMet, imageFile,
          resourceName: saved?.resourceName || '', rowText: rowText(rows[0]),
        });
      } else {
        lastScan.delete(chatId);
      }
    }

    addToRegister(rows);
    lastCards.set(chatId, { created });
    if (GOOGLE_READY && !googleError) refreshContactsIndex();

    let reply = lines.join('\n');
    if (!GOOGLE_READY) reply += '\n\nGoogle Contacts is not linked yet. Tap the file below to save.';
    else if (googleError) reply += `\n\nCould not save to Google Contacts: ${googleError}. Tap the file below to save.`;
    else reply += '\n\nIt will appear on your phone shortly.' + (created.length ? ' /undo to take it back.' : '');
    if (cards.length === 1 && cards[0].side === 'front') reply += '\nScanning the back too? Send it next.';
    await send(chatId, reply);
    await sendVcard(chatId, cards, note);
  } catch (err) {
    console.error(`  -> ${err.message}`);
    await send(chatId, `Something went wrong with that card: ${err.message}`);
  } finally {
    stopTyping();
  }
}

async function undoCards(chatId) {
  const last = lastCards.get(chatId);
  if (!last || !last.created.length) {
    return send(chatId, 'Nothing to undo. (Updates to contacts you already had are not undone.)');
  }
  try {
    const token = await accessTokenFromRefresh(GOOGLE);
    for (const r of last.created) await deleteContact(token, r);
    markRemoved(last.created);
    lastCards.delete(chatId);
    return send(chatId, `Removed ${last.created.length} contact(s) from Google Contacts.`);
  } catch (err) {
    return send(chatId, `Could not undo: ${err.message}`);
  }
}

// Claude picks the branches; a one-off run, not part of the chat's session.
async function suggestIndustries(brand) {
  try {
    const result = await runClaude(suggestPrompt(brand));
    return parseIndustries(result.result);
  } catch (err) {
    console.error(`  -> could not get branch ideas: ${err.message}`);
    return null;
  }
}

async function brandCheck(chatId, args) {
  const { brand, industries } = parseBrandArgs(args);
  if (!brand) {
    return send(chatId, 'Which brand? e.g. /brand berjaya, or /brand berjaya: food, hotels, land');
  }
  const stopTyping = startTyping(chatId);
  try {
    const branches = industries || (await suggestIndustries(brand)) || DEFAULT_INDUSTRIES;
    const report = await checkBrand(brand, branches);
    console.log(`  -> brand check for ${brand}: ${report.rows.length} names`);
    await sendLong(chatId, formatText(report) + `\n\nFull grid with links: http://localhost:${BRAND_PORT}`);
  } catch (err) {
    console.error(`  -> ${err.message}`);
    await send(chatId, `Brand check failed: ${err.message}`);
  } finally {
    stopTyping();
  }
}

// Slash messages are for the bot, never for claude — claude has its own slash
// commands and would answer "Unknown command".
async function handleCommand(chatId, command, args) {
  if (command === '/start') {
    return send(chatId, HELP);
  }
  if (command === '/id') {
    return send(chatId, `Your chat id is: ${chatId}`);
  }
  if (command === '/reset') {
    const had = sessions.delete(chatId);
    draftReady.delete(chatId);
    return send(chatId, had ? 'Forgotten. Starting fresh.' : 'Nothing to forget — already fresh.');
  }
  if (command === '/send') {
    // A bare /send never hands over send permission — there has to be a draft
    // my own last reply offered, in a session we can still resume.
    if (!draftReady.get(chatId) || !sessions.get(chatId)) {
      console.log('  -> /send refused: no draft on offer');
      return send(chatId, NOTHING_TO_SEND);
    }
    return askClaude(chatId, SEND_INSTRUCTION, true);
  }
  if (command === '/undo') {
    return undoCards(chatId);
  }
  if (command === '/brand') {
    return brandCheck(chatId, args);
  }
  return send(chatId, 'Unknown command. I know /start, /brand, /send, /undo, /id and /reset.');
}

async function handle(message) {
  const chatId = message.chat.id;
  const text = message.text ?? '';
  const from = message.from?.username || message.from?.first_name || 'unknown';

  console.log(`[${new Date().toISOString()}] ${from} (chat ${chatId}): ${text || '(no text)'}`);

  // First run: the installer's link sends "/start <code>". That chat becomes the owner.
  if (!ALLOWED_CHAT) {
    if (PAIR_CODE && text.trim() === `/start ${PAIR_CODE}`) {
      saveOwner(chatId);
      console.log(`  -> paired with chat ${chatId}`);
      await send(chatId, `Connected. This chat is now the only one I answer.\n\n${HELP}`);
    } else {
      await send(chatId, 'This bot is not set up yet. Open the link the installer showed you.');
    }
    return;
  }

  if (String(chatId) !== String(ALLOWED_CHAT)) {
    console.log(`  -> refused: chat ${chatId} is not on the allowlist`);
    await send(chatId, 'This bot is private.');
    return;
  }

  const image = imageOf(message);
  if (image) {
    await handleCard(chatId, message, image);
    return;
  }

  if (text.startsWith('/')) {
    const [word, ...rest] = text.trim().split(/\s+/);
    const command = word.split('@')[0].toLowerCase();
    await handleCommand(chatId, command, rest.join(' '));
    return;
  }

  if (!text.trim()) {
    await send(chatId, 'Send me some text and I will look into it.');
    return;
  }

  await askClaude(chatId, text);
}

// --- Main loop ----------------------------------------------------------

async function main() {
  const me = await call('getMe', {}, 20000);
  console.log(`Connected as @${me.username}. Claude runs in ${WORK_DIR}.`);
  if (!ALLOWED_CHAT) console.log(`Waiting to be paired: https://t.me/${me.username}?start=${PAIR_CODE}`);
  console.log(
    `Name cards: reader ${GEMINI_KEY ? 'ready' : 'OFF (no GEMINI_API_KEY)'}, ` +
      `Google Contacts ${GOOGLE_READY ? 'linked' : 'not linked'}, filing to ${CARDS_DIR}.`,
  );
  refreshContactsIndex();
  setInterval(refreshContactsIndex, INDEX_EVERY_MS);
  startBrandServer({ port: BRAND_PORT, suggest: suggestIndustries }).on('listening', () =>
    console.log(`Brand checker page on http://localhost:${BRAND_PORT}.`),
  );
  console.log('Polling for messages — Ctrl+C to stop.');

  let offset = 0;

  for (;;) {
    let updates;
    try {
      updates = await call(
        'getUpdates',
        { offset, timeout: POLL_TIMEOUT, allowed_updates: ['message'] },
        (POLL_TIMEOUT + 15) * 1000,
      );
    } catch (err) {
      // Network blip or Telegram hiccup — wait a moment and keep going.
      console.error(`Poll failed: ${err.message}. Retrying in 5s.`);
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }

    for (const update of updates) {
      offset = update.update_id + 1; // acknowledge, so we never see it twice
      if (!update.message) continue;
      try {
        await handle(update.message);
      } catch (err) {
        console.error(`Failed to reply: ${err.message}`);
      }
    }
  }
}

main().catch((err) => die(`Fatal: ${err.message}`));
