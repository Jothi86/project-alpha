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

const latin = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const last9 = (n) => String(n).replace(/\D/g, '').slice(-9);

function clean(c) {
  const s = (v) => (typeof v === 'string' ? v.trim() : '');
  const honorific = s(c.honorific);
  const organisation = s(c.organisation);
  let name = s(c.name);

  // The reader sometimes repeats the honorific inside the name
  // ("DATO' SERI" + "DATO' SERI LEE TONG LI"); keep it in one place.
  const h = latin(honorific);
  if (h) {
    const words = name.split(/\s+/);
    for (let i = 1; i <= words.length; i++) {
      if (latin(words.slice(0, i).join('')) === h) { name = words.slice(i).join(' '); break; }
    }
  }
  // ...and sometimes puts the company in the name field of a company-only side.
  if (latin(name) && latin(name) === latin(organisation)) name = '';

  return {
    honorific,
    name,
    title: s(c.title),
    organisation,
    department: s(c.department),
    phones: (c.phones || [])
      .map((p) => {
        let number = s(p.number).replace(/[^\d+]/g, '');
        // "+60 6016..." -> "+6016...": the country code added twice.
        if (/^\+6060\d{8,10}$/.test(number)) number = `+60${number.slice(5)}`;
        let type = s(p.type) || 'other';
        // Malaysian 01x numbers are mobiles, whatever the label said.
        if (/^\+601\d{7,9}$/.test(number)) type = 'mobile';
        return { type, number };
      })
      .filter((p) => p.number),
    emails: (c.emails || []).map(s).filter(Boolean).sort((p, q) => isRoleEmail(p) - isRoleEmail(q)),
    address: s(c.address),
    website: s(c.website),
    category: s(c.category) || 'Other',
    note: s(c.note),
    side: s(c.side) || 'single',
    other_names: s(c.other_names),
    roles: [], // other jobs on the card's other side: [{ title, organisation }]
  };
}

// --- telling people apart -------------------------------------------------

// Titles and particles that are not part of who someone is.
const HONORIFICS = new Set(('ir dr ar ts sr dato datuk datin dato\' seri sri haji hj hajah hjh en encik pn puan cik ' +
  'prof professor mr mrs ms mdm madam bin binti bte bt al ap pjk pjm djn pkt kmn amn ams bkt jp yb yab ybhg tuan')
  .split(' '));
// First names too common to identify anyone on their own.
const COMMON = new Set('muhammad mohamad mohammad mohamed muhamad mohd abdul ahmad nurul siti nur'.split(' '));

// The words of a person's name, minus titles: "Dato' Ir. Chan Soo How" -> chan, soo, how.
export function nameTokens(name) {
  return String(name || '').toLowerCase().split(/[^a-z]+/).filter((t) => t.length > 1 && !HONORIFICS.has(t));
}

// Shared mailboxes say nothing about who someone is.
const ROLE_MAILBOX = /^(info|admin|sales|enquiry|enquiries|inquiry|inquiries|contact|contactus|hello|office|general|hr|marketing|support|secretariat|secretary|finance|account|accounts|customerservice|cs|reception|mail|noreply|service|services|team|corporate|pr|media|careers|jobs|billing|penang|kl|hq|admin\d*)$/;
export const isRoleEmail = (e) => ROLE_MAILBOX.test(String(e).toLowerCase().split('@')[0].replace(/[^a-z0-9]/g, ''));

// Does this email's mailbox name belong to this person? lai.kok.soon,
// jessenang, soohow.chan, fongcf (surname + initials), drnajmilfaiz.
export function emailMatchesName(email, name) {
  const local = String(email).toLowerCase().split('@')[0].replace(/[^a-z]/g, '');
  const t = nameTokens(name);
  if (!local || !t.length || isRoleEmail(email)) return false;
  const joined = t.join('');
  if (local === joined) return true;
  if (t.length > 1 && t.every((x) => local.includes(x)) && local.length <= joined.length + 2) return true;
  for (const x of t) {
    if (x.length < 3) continue;
    const others = t.filter((y) => y !== x).map((y) => y[0]);
    const initialsOnly = (rest) => rest.length >= 1 && rest.length <= 3 && [...rest].every((ch) => others.includes(ch));
    if (local.startsWith(x) && initialsOnly(local.slice(x.length))) return true;
    if (local.endsWith(x) && initialsOnly(local.slice(0, -x.length))) return true;
    if (x.length >= 5 && !COMMON.has(x) && local.includes(x)) return true;
  }
  return false;
}

// Same company? Tolerates one name being the short form ("BMT" / "BMT Services
// Sdn Bhd", "moon work 皓创…" / "moonwork DESIGN & BUILD").
const ORG_NOISE = /(sdnbhd|sdn|bhd|berhad|pteltd|pte|ltd|plc|inc|group|holdings|malaysia)$/g;
const orgKey = (x) => latin(String(x || '').replace(/\(\s*\d+[-\s]?[a-z]?\s*\)/gi, '')).replace(ORG_NOISE, '');
export function orgsMatch(x, y) {
  const a = orgKey(x);
  const b = orgKey(y);
  if (!a || !b) return false;
  if (a === b) return true;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  if (s.length >= 3 && l.startsWith(s)) return true;      // BMT / BMT Services
  if (s.length >= 6 && l.includes(s)) return true;         // NF Prestige / INF Prestige (misread)
  let common = 0;                                           // Manufacturing / Manufacturers
  while (common < s.length && s[common] === l[common]) common++;
  return common >= 8 && common >= s.length * 0.85;
}

const mobileNumbers = (c) => c.phones.filter((p) => p.type === 'mobile').map((p) => last9(p.number));
const personalEmails = (c) => c.emails.filter((e) => !isRoleEmail(e)).map((e) => e.toLowerCase());
const hasPersonalContact = (c) => mobileNumbers(c).length > 0 || personalEmails(c).length > 0;

// --- front and back scanned as two photos ---

export const OTHER_SIDE_WINDOW_MS = 3 * 60 * 1000;

// Is `next` the other side of the card `prev`, scanned `ageMs` earlier?
export function isOtherSide(prev, next, ageMs) {
  if (!prev || !next || ageMs > OTHER_SIDE_WINDOW_MS) return false;

  // Two readable names decide it on their own: different people never merge.
  const a = nameTokens(prev.name).sort().join(' ');
  const b = nameTokens(next.name).sort().join(' ');
  if (a && b) return a === b;
  if (!a && !b && prev.name && next.name) return prev.name === next.name; // e.g. both only in Chinese

  // The same personal mobile or mailbox on both sides. Office lines and shared
  // mailboxes (info@, secretariat@) belong to whole organisations, so they don't count.
  if (mobileNumbers(prev).some((m) => mobileNumbers(next).includes(m))) return true;
  if (personalEmails(prev).some((e) => personalEmails(next).includes(e))) return true;

  // From here one side has no readable name: typically the back, with the name
  // only in Chinese/Tamil, or the side with a second job and the person's own
  // email. Tie it to the named side by the mailbox name, then by the company.
  const [named, nameless] = a ? [prev, next] : [next, prev];
  if (a || b) {
    if (nameless.emails.some((e) => emailMatchesName(e, named.name))) return true;
  }
  const otherNumbers = (c) => c.phones.filter((p) => p.type !== 'mobile').map((p) => last9(p.number));
  if (orgsMatch(prev.organisation, next.organisation)) return true;
  if (domains(prev).some((d) => domains(next).includes(d))) return true;
  if (otherNumbers(prev).some((n) => otherNumbers(next).includes(n))) return true;

  // A side with no person on it at all (no name, mobile or own email) is a back.
  const noPerson = (c) => !c.name && !hasPersonalContact(c);
  if (noPerson(prev) || noPerson(next)) return true;

  // The reader's own front/back call.
  return [prev.side, next.side].sort().join('+') === 'back+front';
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

// One card from its two sides.
// - Who: from the side with the readable name (or the front).
// - Job: from the side with the person's own mobile/email, which is usually
//   their main job. If the other side is a different organisation (REHDA on
//   one side, Mah Sing on the other) that job is kept as a second role.
export function mergeCards(x, y) {
  const yNamed = (nameTokens(y.name).length && !nameTokens(x.name).length) || (y.side === 'front' && x.side === 'back');
  const [who, other] = yNamed ? [y, x] : [x, y];
  const [job, side] = hasPersonalContact(other) && !hasPersonalContact(who) ? [other, who] : [who, other];
  const sameOrg = !side.organisation || !job.organisation || orgsMatch(job.organisation, side.organisation);
  const seenPhone = new Set();
  const seenEmail = new Set();
  const sameWords = (p, q) => nameTokens(p).sort().join(' ') === nameTokens(q).sort().join(' ');
  const names = new Set([who.other_names, other.other_names].filter(Boolean));
  if (other.name && !sameWords(other.name, who.name)) names.add(other.name);
  const roles = [...(job.roles || []), ...(side.roles || [])];
  if (!sameOrg) roles.push({ title: side.title, organisation: side.organisation });
  return {
    honorific: who.honorific || other.honorific,
    name: who.name || other.name,
    title: job.title || (sameOrg ? side.title : ''),
    organisation: job.organisation || side.organisation,
    department: job.department || (sameOrg ? side.department : ''),
    phones: [...job.phones, ...side.phones].filter((p) => !seenPhone.has(last9(p.number)) && seenPhone.add(last9(p.number))),
    emails: [...job.emails, ...side.emails]
      .filter((e) => !seenEmail.has(e.toLowerCase()) && seenEmail.add(e.toLowerCase()))
      .sort((p, q) => isRoleEmail(p) - isRoleEmail(q)), // own mailbox first, info@ last
    address: job.address || side.address,
    website: job.website || side.website,
    category: job.category !== 'Other' ? job.category : side.category,
    note: [x.note, y.note].filter(Boolean).join(' '),
    side: 'both',
    other_names: [...names].join(' / '),
    roles,
  };
}

// "Chairman 2026-2028, REAL ESTATE & HOUSING DEVELOPERS' ASSOCIATION MALAYSIA"
export const roleLines = (card) =>
  (card.roles || []).map((r) => [r.title, r.organisation].filter(Boolean).join(', ')).filter(Boolean);

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
        ...roleLines(c).map((r) => `Also: ${r}`),
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
