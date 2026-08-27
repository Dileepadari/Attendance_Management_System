/**
 * Sign-in and the page guard.
 *
 * What this is: a shared-device convenience gate, so a browser left open on a staffroom
 * machine does not sit on a class roster forever, and so a casual visitor to the URL
 * lands on a login screen.
 *
 * What this is not: security. The check runs in the browser against a hash shipped in
 * config.js, so anyone willing to open devtools is past it in seconds. That is inherent
 * to a static site with no server, and it is why the real protection is the Google
 * account permissions on the workbooks themselves. DEVDOC.md spells this out.
 *
 * Improvements over the original `if (passwd == "admin")`:
 *   - the plaintext password is not in the repo
 *   - sessions expire, instead of a localStorage flag that lived forever
 *   - the guard runs before paint, so a protected page never flashes its content
 */

import { SESSION_TTL_MS, USERS } from './config.js';
import { clearNamespace, getJson, removeItem, setJson } from './storage.js';

const SESSION_KEY = 'ams:session';
const NAMESPACE = 'ams:';

/** SHA-256 hex. WebCrypto in the browser, node:crypto under the test runner. */
export async function hashPassword(password) {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const bytes = new TextEncoder().encode(password);
    const digest = await subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(password).digest('hex');
}

/**
 * Constant-time-ish comparison. Both values are hex digests of fixed length, so this is
 * mostly hygiene, but a length-independent loop costs nothing.
 */
function digestsMatch(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verify credentials and, on success, start a session.
 *
 * @returns {Promise<{ok: true, user: Object} | {ok: false, message: string}>}
 */
export async function signIn(username, password) {
  const name = String(username ?? '').trim().toLowerCase();
  const secret = String(password ?? '');

  if (!name || !secret) {
    return { ok: false, message: 'Enter both a username and a password.' };
  }

  const user = USERS.find((u) => u.username.toLowerCase() === name);
  const digest = await hashPassword(secret);

  // One message for both a wrong username and a wrong password. The original told you
  // which half you got right, which turns a guess into a two-step search.
  if (!user || !digestsMatch(digest, user.passwordHash)) {
    return { ok: false, message: 'Those details were not recognised. Check and try again.' };
  }

  setJson(SESSION_KEY, {
    username: user.username,
    displayName: user.displayName ?? user.username,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });

  return { ok: true, user };
}

/** The live session, or null when absent or expired. Expired sessions are cleared. */
export function currentSession(now = Date.now()) {
  const session = getJson(SESSION_KEY, null);
  if (!session || typeof session !== 'object') return null;
  if (typeof session.expiresAt !== 'number' || session.expiresAt <= now) {
    removeItem(SESSION_KEY);
    return null;
  }
  return session;
}

export function isSignedIn(now = Date.now()) {
  return currentSession(now) !== null;
}

/** Push the expiry out on activity, so a teacher mid-roster is not logged out under them. */
export function touchSession(now = Date.now()) {
  const session = currentSession(now);
  if (!session) return;
  setJson(SESSION_KEY, { ...session, expiresAt: now + SESSION_TTL_MS });
}

/** Sign out and drop every app key, including any saved roster draft. */
export function signOut() {
  clearNamespace(NAMESPACE);
}

/**
 * Guard a protected page. Call at the top of a module script.
 *
 * Redirects to login.html with `next` set, so signing in returns you where you were
 * rather than dumping you on the home page.
 *
 * @returns {boolean} true when the page may render.
 */
export function requireSession() {
  if (isSignedIn()) {
    touchSession();
    return true;
  }
  const here = `${globalThis.location.pathname.split('/').pop() || 'index.html'}${globalThis.location.search}`;
  globalThis.location.replace(`login.html?next=${encodeURIComponent(here)}`);
  return false;
}

/** Where to land after signing in. Same-origin relative paths only. */
export function redirectTarget(search = globalThis.location?.search ?? '') {
  const next = new URLSearchParams(search).get('next');
  // Reject anything that could leave the site: an absolute URL, a protocol-relative one,
  // or a path escape. An open redirect on a login page is worth closing even here.
  if (!next || /^[a-z]+:/i.test(next) || next.startsWith('//') || next.includes('..')) {
    return 'index.html';
  }
  return next;
}
