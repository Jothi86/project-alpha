// cardread.js — read name cards from a photo with Gemini, and turn the
// result into vCards. Used by the page (vCards) and by the Cloudflare functions
// (reading). A copy lives in the chief-of-staff bot as cardread.mjs — keep in step.

// First is the stable pick; the rest are tried when it is overloaded.
const MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-flash-lite-latest'];
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);

const PROMPT = `You read business / name cards from a photo.
Return every distinct card in the photo as one entry in "cards". If the photo
shows the front and back of the SAME card, merge them into one entry.
Rules:
- Copy text exactly as printed. Never guess or invent a field you cannot see;
  leave it as an empty string or empty list instead.
- Cards may be in English, Malay, Chinese or Tamil. Keep names and titles in
  the language printed (prefer the Latin-script version when both are shown).
- NEVER transliterate or translate a name (no pinyin, no romanisation). If the
  name is printed only in Chinese/Tamil/Jawi, "name" is exactly those
  characters. Same for the organisation.
- Keep honorifics and titles (Dato', Datuk Seri, Ir., Dr., YB) in "honorific".
- Phone numbers: Malaysian numbers in +60 format with no spaces
  (e.g. 012-345 6789 -> +60123456789, 04-262 1234 -> +6042621234).
  Other countries: keep their country code.
- phone type is one of mobile, office, fax, other.
- category: Government (ministries, state government, JKR, MBPP, MBSP, TNB and
  other agencies or GLCs), Politician, Company, Media, NGO, or Other.
- "note" is one short line about anything unclear (blurred digits etc.), or empty.
- "side": "front" if this is the side with the person's name as the main
  item; "back" if it is the reverse of a card (company details, services, a
  map, a logo, or the same details in another language / script);
  "single" if the photo shows everything (a one-sided card, or both sides
  merged as above).
- "other_names": the person's name as printed in another script (Chinese,
  Tamil, Jawi), or empty. Keep "name" in Latin script whenever it is printed.
If there is no card in the photo, return an empty "cards" list.`;

const STR = { type: 'STRING' };

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    cards: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          honorific: STR,
          name: STR,
          title: STR,
          organisation: STR,
          department: STR,
          phones: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: { type: STR, number: STR },
              required: ['type', 'number'],
            },
          },
          emails: { type: 'ARRAY', items: STR },
          address: STR,
          website: STR,
          category: {
            type: 'STRING',
            enum: ['Government', 'Politician', 'Company', 'Media', 'NGO', 'Other'],
          },
          note: STR,
          side: { type: 'STRING', enum: ['front', 'back', 'single'] },
          other_names: STR,
        },
        required: ['name', 'organisation', 'phones', 'emails', 'category'],
      },
    },
  },
  required: ['cards'],
};

// base64: the image without a data: prefix. Returns an array of cards.
export async function readCard({ apiKey, base64, mimeType = 'image/jpeg' }) {
  const body = JSON.stringify({
    contents: [
      { role: 'user', parts: [{ inlineData: { mimeType, data: base64 } }, { text: PROMPT }] },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: SCHEMA,
    },
  });

  let res;
  let data;
  for (let i = 0; i < MODELS.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1500 * i));
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELS[i]}:generateContent`;
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body,
    });
    data = await res.json().catch(() => ({}));
    if (res.ok || !RETRY_STATUS.has(res.status)) break;
  }
  if (!res.ok) {
    throw new Error(`card reader failed: ${data.error?.message || res.status}`);
  }
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('card reader did not return readable JSON');
  }
  return (parsed.cards || []).map(clean).filter((c) => c.name || c.organisation);
}

function clean(c) {
  const s = (v) => (typeof v === 'string' ? v.trim() : '');
  return {
    honorific: s(c.honorific),
    name: s(c.name),
    title: s(c.title),
    organisation: s(c.organisation),
    department: s(c.department),
    phones: (c.phones || [])
      .map((p) => ({ type: s(p.type) || 'other', number: s(p.number).replace(/[^\d+]/g, '') }))
      .filter((p) => p.number),
    emails: (c.emails || []).map(s).filter(Boolean),
    address: s(c.address),
    website: s(c.website),
    category: s(c.category) || 'Other',
    note: s(c.note),
    side: s(c.side) || 'single',
    other_names: s(c.other_names),
  };
}

// --- front and back scanned as two photos ---

const latin = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const last9 = (n) => String(n).replace(/\D/g, '').slice(-9);
export const OTHER_SIDE_WINDOW_MS = 3 * 60 * 1000;

// Is `next` the other side of the card `prev`, scanned `ageMs` earlier?
export function isOtherSide(prev, next, ageMs) {
  if (!prev || !next || ageMs > OTHER_SIDE_WINDOW_MS) return false;

  // Two names in Latin script decide it on their own.
  const a = latin(prev.name);
  const b = latin(next.name);
  if (a && b) return a === b;

  // A personal number or email on both sides. Office and fax lines are
  // shared by colleagues, so on their own they do not count.
  const mobiles = (c) => c.phones.filter((p) => p.type === 'mobile').map((p) => last9(p.number));
  const emails = (c) => c.emails.map((e) => e.toLowerCase());
  if (mobiles(prev).some((m) => mobiles(next).includes(m))) return true;
  if (emails(prev).some((e) => emails(next).includes(e))) return true;

  // From here one side has no Latin-script name: typically the back, with the
  // name in Chinese/Tamil or no person at all. Link it by the company.
  const otherNumbers = (c) => c.phones.filter((p) => p.type !== 'mobile').map((p) => last9(p.number));
  const sameOrg = latin(prev.organisation) && latin(prev.organisation) === latin(next.organisation);
  const sharedDomain = domains(prev).some((d) => domains(next).includes(d));
  const sharedLine = otherNumbers(prev).some((n) => otherNumbers(next).includes(n));
  if (sameOrg || sharedDomain || sharedLine) return true;

  // A side with no person on it at all (no Latin name, mobile or email) is a back.
  const noPerson = (c) => !latin(c.name) && !mobiles(c).length && !c.emails.length;
  if (noPerson(prev) || noPerson(next)) return true;

  // The reader's own front/back call.
  const sides = [prev.side, next.side].sort().join('+');
  return sides === 'back+front';
}

// Company web domains on a card (email domains and website), minus free mail.
const FREE_MAIL = /^(gmail|googlemail|yahoo|ymail|hotmail|outlook|live|msn|icloud|me|aol|proton|protonmail)\./;
function domains(c) {
  const hosts = [
    ...c.emails.map((e) => e.split('@')[1] || ''),
    (c.website || '').replace(/^[a-z]+:\/\//i, '').split('/')[0],
  ];
  return hosts
    .map((h) => h.toLowerCase().replace(/^www\./, '').trim())
    .filter((h) => h.includes('.') && !FREE_MAIL.test(h));
}

// One card from its two sides. The side with the Latin-script name (or the
// front) leads; the other fills gaps and adds numbers, emails and names.
export function mergeCards(x, y) {
  const yLeads = (latin(y.name) && !latin(x.name)) || (y.side === 'front' && x.side === 'back');
  const [a, b] = yLeads ? [y, x] : [x, y];
  const pick = (k) => a[k] || b[k];
  const seenPhone = new Set();
  const seenEmail = new Set();
  const names = new Set([a.other_names, b.other_names].filter(Boolean));
  if (b.name && latin(b.name) !== latin(a.name)) names.add(b.name);
  return {
    honorific: pick('honorific'),
    name: a.name || b.name,
    title: pick('title'),
    organisation: pick('organisation'),
    department: pick('department'),
    phones: [...a.phones, ...b.phones].filter((p) => !seenPhone.has(last9(p.number)) && seenPhone.add(last9(p.number))),
    emails: [...a.emails, ...b.emails].filter((e) => !seenEmail.has(e.toLowerCase()) && seenEmail.add(e.toLowerCase())),
    address: pick('address'),
    website: pick('website'),
    category: a.category !== 'Other' ? a.category : b.category,
    note: [a.note, b.note].filter(Boolean).join(' '),
    side: 'both',
    other_names: [...names].join(' / '),
  };
}

// One line per card, for chat replies.
export function describe(card) {
  const who = [card.honorific, card.name].filter(Boolean).join(' ') || '(no name)';
  const role = [card.title, card.organisation].filter(Boolean).join(', ');
  const phone = card.phones[0]?.number;
  const email = card.emails[0];
  return [who, role, phone, email].filter(Boolean).join(' · ');
}

// --- vCard 3.0 ---

const esc = (v) => String(v).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

const TEL_TYPE = { mobile: 'CELL', office: 'WORK', fax: 'WORK,FAX', other: 'VOICE' };

export function toVcard(cards, extraNote = '') {
  return cards
    .map((c) => {
      // Malay ("bin"), Chinese (surname first) and Indian ("a/l") names do not
      // split into first/last, so the whole name goes in as written.
      const given = c.name;
      const family = '';
      const note = [
        c.other_names && `Also written: ${c.other_names}`,
        c.category && `Category: ${c.category}`,
        extraNote,
      ].filter(Boolean).join('\n');
      const lines = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `N:${esc(family)};${esc(given)};;${esc(c.honorific)};`,
        `FN:${esc([c.honorific, c.name].filter(Boolean).join(' ') || c.organisation)}`,
        c.organisation && `ORG:${esc(c.organisation)}${c.department ? ';' + esc(c.department) : ''}`,
        c.title && `TITLE:${esc(c.title)}`,
        ...c.phones.map((p) => `TEL;TYPE=${TEL_TYPE[p.type] || 'VOICE'}:${p.number}`),
        ...c.emails.map((e) => `EMAIL;TYPE=INTERNET:${e}`),
        c.address && `ADR;TYPE=WORK:;;${esc(c.address)};;;;`,
        c.website && `URL:${c.website}`,
        note && `NOTE:${esc(note)}`,
        'END:VCARD',
      ];
      return lines.filter(Boolean).join('\r\n');
    })
    .join('\r\n');
}
