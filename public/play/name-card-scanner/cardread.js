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
- Keep honorifics and titles (Dato', Datuk Seri, Ir., Dr., YB) in "honorific".
- Phone numbers: Malaysian numbers in +60 format with no spaces
  (e.g. 012-345 6789 -> +60123456789, 04-262 1234 -> +6042621234).
  Other countries: keep their country code.
- phone type is one of mobile, office, fax, other.
- category: Government (ministries, state government, JKR, MBPP, MBSP, TNB and
  other agencies or GLCs), Politician, Company, Media, NGO, or Other.
- "note" is one short line about anything unclear (blurred digits etc.), or empty.
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
      const note = [c.category && `Category: ${c.category}`, extraNote].filter(Boolean).join('\n');
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
