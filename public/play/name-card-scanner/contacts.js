// contacts.js — save name cards into Google Contacts through the People API,
// straight from the browser with the visitor's own access token. A copy lives in
// the chief-of-staff bot as contacts.mjs — keep the two in step.

import { nameTokens, isRoleEmail } from './cardread.js';

const PEOPLE = 'https://people.googleapis.com/v1';
const FIELDS = 'names,emailAddresses,phoneNumbers,organizations,addresses,urls,biographies,memberships';
const UPDATABLE = 'names,emailAddresses,phoneNumbers,organizations,addresses,urls,biographies';

export const MAIN_GROUP = 'Name Cards';

async function api(token, method, path, body) {
  const res = await fetch(`${PEOPLE}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Google Contacts ${method} ${path.split('?')[0]} failed: ${data.error?.message || res.status}`);
  }
  return data;
}

// Bot side only: swap the long-lived refresh token for a one-hour access token.
let cached = { token: '', until: 0 };
export async function accessTokenFromRefresh({ clientId, clientSecret, refreshToken }) {
  if (cached.token && Date.now() < cached.until) return cached.token;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google sign-in failed: ${data.error_description || data.error || res.status}`);
  cached = { token: data.access_token, until: Date.now() + (data.expires_in - 120) * 1000 };
  return cached.token;
}

// --- groups ---

const groupIds = new Map();

async function ensureGroup(token, name) {
  if (groupIds.has(name)) return groupIds.get(name);
  const list = await api(token, 'GET', 'contactGroups?pageSize=1000&groupFields=name,groupType');
  for (const g of list.contactGroups || []) {
    if (g.groupType === 'USER_CONTACT_GROUP') groupIds.set(g.name, g.resourceName);
  }
  if (!groupIds.has(name)) {
    const made = await api(token, 'POST', 'contactGroups', { contactGroup: { name } });
    groupIds.set(name, made.resourceName);
  }
  return groupIds.get(name);
}

async function addToGroups(token, resourceName, names) {
  for (const name of names) {
    const group = await ensureGroup(token, name);
    await api(token, 'POST', `${group}/members:modify`, { resourceNamesToAdd: [resourceName] });
  }
}

// --- duplicates ---

const digits = (n) => String(n).replace(/\D/g, '').slice(-9); // last 9 digits match 012.. and +6012..

let warmed = false;
async function search(token, query) {
  // Google asks for one empty search first to load the search cache.
  if (!warmed) {
    await api(token, 'GET', 'people:searchContacts?query=&readMask=names').catch(() => {});
    warmed = true;
  }
  const data = await api(
    token,
    'GET',
    `people:searchContacts?query=${encodeURIComponent(query)}&readMask=${FIELDS}&pageSize=10`,
  );
  return (data.results || []).map((r) => r.person);
}

// The existing contact for this same person, or null. Only things that belong
// to one person count: their mobile and their own email. Office lines, fax and
// shared mailboxes (info@, secretariat@) are shared by colleagues; matching on
// them merged different FMM and REHDA people into one contact (3 Oct 2026).
// And if both have a readable name, the names must share a word.
export async function findExisting(token, card) {
  const emails = card.emails.filter((e) => !isRoleEmail(e)).map((e) => e.toLowerCase());
  const mobiles = card.phones.filter((p) => p.type === 'mobile');
  const phones = mobiles.map((p) => digits(p.number));
  const queries = [...emails, ...mobiles.map((p) => p.number)];
  const cardWords = nameTokens(card.name);
  const sameName = (person) => {
    if (!cardWords.length) return true;
    const theirs = (person.names || []).flatMap((n) => nameTokens(n.displayName));
    return !theirs.length || theirs.some((w) => w.length >= 3 && cardWords.includes(w));
  };
  const matches = (person) =>
    ((person.emailAddresses || []).some((e) => emails.includes(e.value.toLowerCase())) ||
      (person.phoneNumbers || []).some((p) => phones.includes(digits(p.value)))) &&
    sameName(person);

  for (const q of queries) {
    const hit = (await search(token, q)).find(matches);
    if (hit) return hit;
  }

  // Search lags a few minutes behind new contacts, so a card scanned twice in
  // quick succession would be missed. Walk the newest contacts as a backstop.
  if (!queries.length) return null;
  let pageToken = '';
  for (let page = 0; page < 5; page++) {
    const data = await api(
      token,
      'GET',
      `people/me/connections?personFields=${FIELDS}&pageSize=1000&sortOrder=LAST_MODIFIED_DESCENDING` +
        (pageToken ? `&pageToken=${pageToken}` : ''),
    );
    const hit = (data.connections || []).find(matches);
    if (hit) return hit;
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return null;
}

// --- card -> person ---

const PHONE_TYPE = { mobile: 'mobile', office: 'work', fax: 'workFax', other: 'other' };

function toPerson(card, note) {
  return {
    names: [{ givenName: card.name || card.organisation, honorificPrefix: card.honorific || undefined }],
    // Main job first, then any second job from the card's other side.
    organizations: [
      { name: card.organisation, title: card.title, department: card.department || undefined },
      ...(card.roles || []).map((r) => ({ name: r.organisation, title: r.title })),
    ].filter((o) => o.name || o.title),
    phoneNumbers: card.phones.map((p) => ({ value: p.number, type: PHONE_TYPE[p.type] || 'other' })),
    emailAddresses: card.emails.map((e) => ({ value: e, type: 'work' })),
    addresses: card.address ? [{ formattedValue: card.address, type: 'work' }] : [],
    urls: card.website ? [{ value: card.website, type: 'work' }] : [],
    biographies: note ? [{ value: note, contentType: 'TEXT_PLAIN' }] : [],
  };
}

// Keep everything already on the contact; add what the card has that is new.
function merge(existing, fresh) {
  const union = (a = [], b = [], key) => {
    const seen = new Set(a.map(key));
    return [...a, ...b.filter((x) => !seen.has(key(x)))];
  };
  const oldNote = existing.biographies?.[0]?.value || '';
  const newNote = fresh.biographies[0]?.value || '';
  return {
    etag: existing.etag,
    names: existing.names?.length ? existing.names : fresh.names,
    // The card's jobs lead (they're the newest), but jobs already on the
    // contact stay; overwriting them lost a title on 3 Oct 2026.
    organizations: union(fresh.organizations, existing.organizations, (o) => (o.name || o.title || '').toLowerCase().replace(/[^a-z0-9]/g, '')),
    phoneNumbers: union(existing.phoneNumbers, fresh.phoneNumbers, (p) => digits(p.value)),
    emailAddresses: union(existing.emailAddresses, fresh.emailAddresses, (e) => e.value.toLowerCase()),
    addresses: union(existing.addresses, fresh.addresses, (a) => (a.formattedValue || '').toLowerCase()),
    urls: union(existing.urls, fresh.urls, (u) => u.value.toLowerCase()),
    // Line by line, so a second save adds new lines without repeating old ones.
    biographies: newNote
      ? [{ value: [...new Set([...oldNote.split('\n'), ...newNote.split('\n')].filter(Boolean))].join('\n'), contentType: 'TEXT_PLAIN' }]
      : existing.biographies || [],
  };
}

// Save one card. Returns { resourceName, updated, name }. Pass
// { resourceName } to update a contact already made from this card (its
// other side was scanned first).
export async function saveCard(token, card, note = '', { resourceName } = {}) {
  const fresh = toPerson(card, [
    card.other_names && `Also written: ${card.other_names}`,
    `Category: ${card.category}`,
    note,
  ].filter(Boolean).join('\n'));
  const existing = resourceName
    ? await api(token, 'GET', `${resourceName}?personFields=${FIELDS}`)
    : await findExisting(token, card);

  let person;
  if (existing) {
    person = await api(
      token,
      'PATCH',
      `${existing.resourceName}:updateContact?updatePersonFields=${UPDATABLE}&personFields=names`,
      merge(existing, fresh),
    );
  } else {
    person = await api(token, 'POST', `people:createContact?personFields=names`, fresh);
  }

  await addToGroups(token, person.resourceName, [MAIN_GROUP, `${MAIN_GROUP} - ${card.category}`]);

  return {
    resourceName: person.resourceName,
    updated: Boolean(existing),
    name: person.names?.[0]?.displayName || card.name,
  };
}

// Every contact, flattened for searching: one object per person. Read-only.
export async function listAll(token) {
  const groups = new Map();
  const list = await api(token, 'GET', 'contactGroups?pageSize=1000&groupFields=name,groupType');
  for (const g of list.contactGroups || []) {
    if (g.groupType === 'USER_CONTACT_GROUP') groups.set(g.resourceName, g.name);
  }

  const people = [];
  let pageToken = '';
  do {
    const data = await api(
      token,
      'GET',
      `people/me/connections?personFields=${FIELDS}&pageSize=1000&sortOrder=LAST_MODIFIED_DESCENDING` +
        (pageToken ? `&pageToken=${pageToken}` : ''),
    );
    for (const p of data.connections || []) {
      const org = p.organizations?.[0] || {};
      people.push({
        name: p.names?.[0]?.displayName || '',
        title: org.title || '',
        organisation: org.name || '',
        department: org.department || '',
        phones: (p.phoneNumbers || []).map((x) => x.value).join(' / '),
        emails: (p.emailAddresses || []).map((x) => x.value).join(' / '),
        address: p.addresses?.[0]?.formattedValue || '',
        labels: (p.memberships || [])
          .map((m) => groups.get(m.contactGroupMembership?.contactGroupResourceName))
          .filter(Boolean)
          .join(' / '),
        notes: (p.biographies?.[0]?.value || '').replace(/\s+/g, ' ').trim(),
      });
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return people;
}

export function deleteContact(token, resourceName) {
  return api(token, 'DELETE', `${resourceName}:deleteContact`);
}
