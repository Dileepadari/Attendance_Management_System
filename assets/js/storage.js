/**
 * localStorage that never throws.
 *
 * Safari in private mode, Chrome with site data blocked, and any iframe with a null
 * origin all make `localStorage` throw on access rather than return null. The original
 * pages read `localStorage.getItem(...)` at the top of an inline script, so in those
 * browsers the throw killed the whole script and the page rendered as a blank shell with
 * no error the user could act on. Every access goes through here instead.
 *
 * Falls back to an in-memory map, which also lets `node --test` import this module.
 */

const memory = new Map();

let backing = null;

function store() {
  if (backing !== null) return backing;
  try {
    const candidate = globalThis.localStorage;
    // Probe: merely having the object is not enough, access is what throws.
    const probe = '__ams_probe__';
    candidate.setItem(probe, '1');
    candidate.removeItem(probe);
    backing = candidate;
  } catch {
    backing = null;
  }
  return backing;
}

export function getItem(key) {
  const target = store();
  if (!target) return memory.has(key) ? memory.get(key) : null;
  try {
    return target.getItem(key);
  } catch {
    return null;
  }
}

export function setItem(key, value) {
  memory.set(key, String(value));
  const target = store();
  if (!target) return;
  try {
    target.setItem(key, String(value));
  } catch {
    // Quota exceeded, or storage disabled mid-session. The in-memory copy still serves
    // this tab, which is enough for a draft that is about to be submitted anyway.
  }
}

export function removeItem(key) {
  memory.delete(key);
  const target = store();
  if (!target) return;
  try {
    target.removeItem(key);
  } catch {
    /* nothing useful to do */
  }
}

/** Read and parse JSON, returning `fallback` for missing or corrupt values. */
export function getJson(key, fallback = null) {
  const raw = getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    // A half-written value from a previous version is not worth crashing over.
    removeItem(key);
    return fallback;
  }
}

export function setJson(key, value) {
  setItem(key, JSON.stringify(value));
}

/** Drop every key under our prefix. Used on sign-out. */
export function clearNamespace(prefix) {
  for (const key of [...memory.keys()]) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
  const target = store();
  if (!target) return;
  try {
    const keys = [];
    for (let i = 0; i < target.length; i += 1) {
      const key = target.key(i);
      if (key && key.startsWith(prefix)) keys.push(key);
    }
    for (const key of keys) target.removeItem(key);
  } catch {
    /* nothing useful to do */
  }
}
