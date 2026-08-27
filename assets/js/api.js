/**
 * Data access. Two providers behind one interface.
 *
 * 'stein' talks to Stein.HQ, which fronts a Google Sheets workbook with a REST API.
 * 'demo'  serves a generated roster out of localStorage so a fresh clone runs with no
 *         credentials and the test suite has something deterministic to work against.
 *
 * The original pages called `fetch(url)` with no timeout, no retry, no status check and
 * no catch, then did `Object.keys(data[0])` on the result. A rate-limited Stein response
 * is a JSON object, not an array, so that threw inside an async function nobody awaited
 * and the page sat on a spinner forever. Every failure here becomes an ApiError with a
 * message a teacher can act on.
 */

import { NETWORK, PROVIDER, STEIN_BASE, steinUrl } from './config.js';
import * as demo from './demo.js';
import { getItem, setItem } from './storage.js';

const PROVIDER_KEY = 'ams:provider';

export class ApiError extends Error {
  constructor(message, { cause, status, retryable = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.cause = cause;
    this.status = status;
    this.retryable = retryable;
  }
}

/**
 * Active provider. `?provider=stein` in the URL overrides the config default and sticks
 * for the session, which is how you demo the real backend without editing a file.
 */
export function activeProvider() {
  try {
    const fromUrl = new URL(globalThis.location?.href ?? '').searchParams.get('provider');
    if (fromUrl === 'stein' || fromUrl === 'demo') {
      setItem(PROVIDER_KEY, fromUrl);
      return fromUrl;
    }
  } catch {
    // No location (Node) or an unparseable href. Fall through to the stored value.
  }
  const stored = getItem(PROVIDER_KEY);
  if (stored === 'stein' || stored === 'demo') return stored;
  return PROVIDER;
}

export function isDemo() {
  return activeProvider() === 'demo';
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * fetch with a timeout, status checking, and bounded retries.
 *
 * Only GETs and network-level failures are retried. A failed POST is never retried
 * automatically: Stein appends, so a retry after a response that was actually delivered
 * would write the attendance twice.
 */
async function request(url, { method = 'GET', body, retries = NETWORK.retries } = {}) {
  if (globalThis.navigator && globalThis.navigator.onLine === false) {
    throw new ApiError('You appear to be offline. Reconnect and try again.', { retryable: true });
  }

  let lastError = null;
  const attempts = method === 'GET' ? retries + 1 : 1;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NETWORK.timeoutMs);
    try {
      const response = await fetch(url, {
        method,
        signal: controller.signal,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const detail = await readErrorDetail(response);
        // 4xx is a configuration or permission problem. Retrying cannot fix it.
        const retryable = response.status >= 500 || response.status === 429;
        throw new ApiError(describeStatus(response.status, detail), {
          status: response.status,
          retryable,
        });
      }

      return await response.json();
    } catch (error) {
      lastError = normaliseError(error);
      if (!lastError.retryable || attempt === attempts - 1) throw lastError;
      await sleep(NETWORK.retryBackoffMs * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new ApiError('Request failed');
}

async function readErrorDetail(response) {
  try {
    const text = await response.text();
    try {
      const parsed = JSON.parse(text);
      return parsed.error || parsed.message || text;
    } catch {
      return text;
    }
  } catch {
    return '';
  }
}

function describeStatus(status, detail) {
  if (status === 400 && String(detail).includes('invalid_grant')) {
    return 'The sheet rejected the request (invalid_grant). The Stein storage has lost access to the Google account that owns the workbook. Reconnect it at steinhq.com.';
  }
  if (status === 404) return 'That subject tab does not exist in the workbook. Check the tab name matches the subject exactly.';
  if (status === 401 || status === 403) return 'Access to this sheet was denied. Check the Stein storage is still authorised.';
  if (status === 429) return 'Too many requests to the sheet. Wait a moment and try again.';
  if (status >= 500) return 'The sheet service is having trouble. Try again in a moment.';
  return `The sheet returned an error (${status})${detail ? `: ${detail}` : ''}`;
}

function normaliseError(error) {
  if (error instanceof ApiError) return error;
  if (error?.name === 'AbortError') {
    return new ApiError(
      `The sheet did not respond within ${Math.round(NETWORK.timeoutMs / 1000)} seconds.`,
      { cause: error, retryable: true },
    );
  }
  if (error instanceof SyntaxError) {
    return new ApiError('The sheet returned something that was not valid data.', { cause: error });
  }
  return new ApiError('Could not reach the sheet. Check your connection.', {
    cause: error,
    retryable: true,
  });
}

/**
 * Read one subject tab for one class.
 *
 * @param {{storageId: string}} klass Entry from CLASSES.
 * @param {string} subject Subject id, which is also the tab name.
 * @returns {Promise<Array<Object>>} Raw rows, ready for sheet.js.
 */
export async function fetchSubject(klass, subject) {
  if (isDemo()) return demo.fetchSubject(klass, subject);

  const rows = await request(steinUrl(klass.storageId, subject));
  if (!Array.isArray(rows)) {
    throw new ApiError('The sheet returned an unexpected shape. Expected a list of rows.');
  }
  if (rows.length < 2) {
    throw new ApiError(
      'That subject tab has no roster. Row 1 must hold college IDs and row 2 the student names.',
    );
  }
  return rows;
}

/**
 * Append one attendance session.
 *
 * @param {{storageId: string}} klass
 * @param {string} subject
 * @param {Object} row Built by sheet.buildSessionRow.
 */
export async function appendSession(klass, subject, row) {
  if (isDemo()) return demo.appendSession(klass, subject, row);

  // Stein takes an array of row objects and appends them all.
  await request(steinUrl(klass.storageId, subject), { method: 'POST', body: [row] });
  return { appended: 1 };
}

/**
 * Overwrite an existing session in place, used when a teacher confirms a correction to a
 * date and period that was already recorded. Stein's PUT takes a condition plus a set.
 */
export async function updateSession(klass, subject, { date, period }, row) {
  if (isDemo()) return demo.updateSession(klass, subject, { date, period }, row);

  await request(steinUrl(klass.storageId, subject), {
    method: 'PUT',
    body: { condition: { 'S. No': date, period }, set: row },
  });
  return { updated: 1 };
}

/** Exposed for the connection check on the about page. */
export { STEIN_BASE };
