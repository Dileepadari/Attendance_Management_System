/**
 * The Stein transport, driven against a stubbed global fetch.
 *
 * These cover the failures the original had no answer for: a non-array response, a 4xx
 * body, a hang, and a POST that must never be retried.
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { ApiError, appendSession, fetchSubject } from '../assets/js/api.js';
import { NETWORK } from '../assets/js/config.js';
import { rows } from './fixtures/rows.js';

const klass = { course: 'puc-2', semester: 'sem-2', section: 'B1', storageId: 'abc' };
const realFetch = globalThis.fetch;

/** Force the Stein provider for this file, whatever config.js defaults to. */
beforeEach(() => {
  globalThis.localStorage = undefined;
  globalThis.location = { href: 'https://example.test/index.html?provider=stein', search: '?provider=stein' };
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete globalThis.location;
});

function stubFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return handler(calls.length, url, options);
  };
  return calls;
}

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

describe('fetchSubject', () => {
  it('reads rows from the subject endpoint', async () => {
    const calls = stubFetch(() => jsonResponse(rows));
    const result = await fetchSubject(klass, 'english');

    assert.deepEqual(result, rows);
    assert.equal(calls[0].url, 'https://api.steinhq.com/v1/storages/abc/english');
    assert.equal(calls[0].options.method, 'GET');
  });

  it('rejects a response that is not a list of rows', async () => {
    // Stein returns {"error": "..."} with a 200 in some states. The original then ran
    // Object.keys(data[0]) and threw inside an unawaited async function, leaving the
    // page on a spinner with nothing in the UI.
    stubFetch(() => jsonResponse({ error: 'nope' }));
    await assert.rejects(() => fetchSubject(klass, 'english'), /unexpected shape/i);
  });

  it('rejects a sheet with no roster rows', async () => {
    stubFetch(() => jsonResponse([{ 'S. No': 'ID' }]));
    await assert.rejects(() => fetchSubject(klass, 'english'), /no roster/i);
  });

  it('explains the invalid_grant failure in words a teacher can act on', async () => {
    stubFetch(() => jsonResponse({ error: 'invalid_grant' }, 400));
    await assert.rejects(() => fetchSubject(klass, 'english'), (error) => {
      assert.ok(error instanceof ApiError);
      assert.match(error.message, /lost access to the Google account/i);
      assert.equal(error.retryable, false);
      return true;
    });
  });

  it('names a missing tab rather than reporting a generic failure', async () => {
    stubFetch(() => jsonResponse({ error: 'not found' }, 404));
    await assert.rejects(() => fetchSubject(klass, 'astronomy'), /subject tab does not exist/i);
  });

  it('retries a 500 and succeeds when the sheet recovers', async () => {
    const calls = stubFetch((n) => (n === 1 ? jsonResponse({}, 500) : jsonResponse(rows)));
    const result = await fetchSubject(klass, 'english');
    assert.deepEqual(result, rows);
    assert.equal(calls.length, 2);
  });

  it('gives up after the configured number of retries', async () => {
    const calls = stubFetch(() => jsonResponse({}, 503));
    await assert.rejects(() => fetchSubject(klass, 'english'), /having trouble/i);
    assert.equal(calls.length, NETWORK.retries + 1);
  });

  it('does not retry a 4xx, which retrying cannot fix', async () => {
    const calls = stubFetch(() => jsonResponse({ error: 'denied' }, 403));
    await assert.rejects(() => fetchSubject(klass, 'english'));
    assert.equal(calls.length, 1);
  });

  it('turns an aborted request into a timeout message', async () => {
    stubFetch(() => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    });
    await assert.rejects(() => fetchSubject(klass, 'english'), /did not respond within/i);
  });

  it('reports being offline without touching the network', async () => {
    // globalThis.navigator is a getter-only property in Node, so it has to be redefined
    // rather than assigned.
    const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: false }, configurable: true, writable: true,
    });
    try {
      const calls = stubFetch(() => jsonResponse(rows));
      await assert.rejects(() => fetchSubject(klass, 'english'), /offline/i);
      assert.equal(calls.length, 0);
    } finally {
      if (original) Object.defineProperty(globalThis, 'navigator', original);
      else delete globalThis.navigator;
    }
  });
});

describe('appendSession', () => {
  it('posts the row as a single-element array', async () => {
    const calls = stubFetch(() => jsonResponse({ updatedRange: 'english!A5' }));
    const row = { 'S. No': '2023-03-09', period: 'period-1', 1: 1 };

    await appendSession(klass, 'english', row);

    assert.equal(calls[0].options.method, 'POST');
    assert.equal(calls[0].options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(calls[0].options.body), [row]);
  });

  it('never retries a failed post', async () => {
    // Stein appends. Retrying a POST whose response was lost in transit would file the
    // same class twice and double every student's total.
    const calls = stubFetch(() => jsonResponse({}, 500));
    await assert.rejects(() => appendSession(klass, 'english', {}));
    assert.equal(calls.length, 1);
  });
});
