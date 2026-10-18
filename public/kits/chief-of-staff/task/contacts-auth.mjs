// contacts-auth.mjs — one-time Google sign-in so the bot can save name cards
// into Google Contacts. Reads GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET from
// ../.env, opens the browser, and writes GOOGLE_REFRESH_TOKEN back into .env.
// Run with: node task\contacts-auth.mjs [you@gmail.com]

import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ENV_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
const SCOPE = 'https://www.googleapis.com/auth/contacts';
const ACCOUNT = process.argv[2] || ''; // optional: which Google account to suggest

const raw = readFileSync(ENV_FILE, 'utf8');
const get = (key) => (raw.match(new RegExp(`^${key}=(.*)$`, 'm')) || [])[1]?.trim().replace(/^["']|["']$/g, '');
const clientId = get('GOOGLE_CLIENT_ID');
const clientSecret = get('GOOGLE_CLIENT_SECRET');
if (!clientId || !clientSecret) {
  console.error('Put GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first.');
  process.exit(1);
}

const verifier = randomBytes(32).toString('base64url');
const challenge = createHash('sha256').update(verifier).digest('base64url');
const state = randomBytes(16).toString('hex');

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname !== '/') return res.end();
  const code = url.searchParams.get('code');
  if (!code || url.searchParams.get('state') !== state) {
    res.end('Sign-in did not complete. Close this tab and run the script again.');
    return finish(1, `Google said: ${url.searchParams.get('error') || 'no code returned'}`);
  }
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: verifier,
      }),
    });
    const data = await tokenRes.json();
    if (!data.refresh_token) throw new Error(data.error_description || data.error || 'no refresh token');

    const line = `GOOGLE_REFRESH_TOKEN=${data.refresh_token}`;
    const current = readFileSync(ENV_FILE, 'utf8');
    const next = /^GOOGLE_REFRESH_TOKEN=.*$/m.test(current)
      ? current.replace(/^GOOGLE_REFRESH_TOKEN=.*$/m, line)
      : current.replace(/\s*$/, `\n${line}\n`);
    writeFileSync(ENV_FILE, next);

    res.end('Done. The bot can now save contacts. You can close this tab.');
    finish(0, 'Saved GOOGLE_REFRESH_TOKEN to .env.');
  } catch (err) {
    res.end('Something went wrong. Check the terminal.');
    finish(1, `Token exchange failed: ${err.message}`);
  }
});

let redirectUri;

function finish(code, message) {
  (code ? console.error : console.log)(message);
  server.close();
  setTimeout(() => process.exit(code), 200);
}

server.listen(0, '127.0.0.1', () => {
  redirectUri = `http://127.0.0.1:${server.address().port}`;
  const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  auth.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    ...(ACCOUNT ? { login_hint: ACCOUNT } : {}),
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();
  console.log(`Opening the browser to sign in${ACCOUNT ? ` as ${ACCOUNT}` : ""}...`);
  console.log(`If it does not open, paste this into the browser:\n${auth}`);
  spawn('cmd', ['/c', 'start', '""', `"${auth}"`], { windowsVerbatimArguments: true, detached: true });
});
