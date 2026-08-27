import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  currentSession, hashPassword, isSignedIn, redirectTarget, signIn, signOut, touchSession,
} from '../assets/js/auth.js';
import { SESSION_TTL_MS } from '../assets/js/config.js';

beforeEach(() => signOut());

describe('hashPassword', () => {
  it('produces the documented sha256 of the demo password', () => {
    // This is the value sitting in USERS. If the hashing changes, the shipped
    // credentials stop working, and this catches it.
    return hashPassword('admin').then((digest) => {
      assert.equal(digest, '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918');
    });
  });
});

describe('signIn', () => {
  it('accepts the configured credentials and opens a session', async () => {
    const result = await signIn('admin', 'admin');
    assert.equal(result.ok, true);
    assert.equal(isSignedIn(), true);
    assert.equal(currentSession().displayName, 'Teacher');
  });

  it('is case insensitive on the username', async () => {
    assert.equal((await signIn('ADMIN', 'admin')).ok, true);
  });

  it('rejects a wrong password', async () => {
    const result = await signIn('admin', 'wrong');
    assert.equal(result.ok, false);
    assert.equal(isSignedIn(), false);
  });

  it('gives the same message for a bad username and a bad password', async () => {
    // The original said "check your password" only once the username was right, which
    // confirms a valid username to anyone guessing.
    const badUser = await signIn('nobody', 'admin');
    const badPass = await signIn('admin', 'nope');
    assert.equal(badUser.message, badPass.message);
  });

  it('rejects empty input without opening a session', async () => {
    assert.equal((await signIn('', '')).ok, false);
    assert.equal((await signIn('admin', '')).ok, false);
    assert.equal(isSignedIn(), false);
  });
});

describe('session expiry', () => {
  it('reports a session as valid inside its window', async () => {
    await signIn('admin', 'admin');
    assert.equal(isSignedIn(Date.now() + SESSION_TTL_MS - 1000), true);
  });

  it('expires a session past its window', async () => {
    await signIn('admin', 'admin');
    // The original stored a flag that never expired, so a shared staffroom machine
    // stayed signed in indefinitely.
    assert.equal(isSignedIn(Date.now() + SESSION_TTL_MS + 1000), false);
  });

  it('clears the expired session rather than leaving it readable', async () => {
    await signIn('admin', 'admin');
    isSignedIn(Date.now() + SESSION_TTL_MS + 1000);
    assert.equal(currentSession(), null);
  });

  it('extends the window on activity', async () => {
    await signIn('admin', 'admin');
    const later = Date.now() + SESSION_TTL_MS - 1000;
    touchSession(later);
    assert.equal(isSignedIn(later + SESSION_TTL_MS - 1000), true);
  });
});

describe('signOut', () => {
  it('ends the session', async () => {
    await signIn('admin', 'admin');
    signOut();
    assert.equal(isSignedIn(), false);
  });
});

describe('redirectTarget', () => {
  it('returns the requested page', () => {
    assert.equal(redirectTarget('?next=report.html'), 'report.html');
  });

  it('keeps a query string on the target', () => {
    assert.equal(
      redirectTarget('?next=' + encodeURIComponent('index.html?section=B3')),
      'index.html?section=B3',
    );
  });

  it('defaults to the home page when next is missing', () => {
    assert.equal(redirectTarget(''), 'index.html');
  });

  it('refuses to redirect off-site', () => {
    // An open redirect on a login page is worth closing even on a static site.
    assert.equal(redirectTarget('?next=https://evil.example/x'), 'index.html');
    assert.equal(redirectTarget('?next=//evil.example/x'), 'index.html');
    assert.equal(redirectTarget('?next=javascript:alert(1)'), 'index.html');
    assert.equal(redirectTarget('?next=../../etc/passwd'), 'index.html');
  });
});
