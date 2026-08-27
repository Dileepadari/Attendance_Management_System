import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import {
  DARK, LIGHT, THEME_KEY, resolvedTheme, setTheme, storedTheme, systemTheme, toggleTheme,
  watchSystemTheme,
} from '../assets/js/theme.js';
import { removeItem } from '../assets/js/storage.js';

/** Minimal stand-ins for the two browser globals theme.js touches. */
function stubSystem(prefersDark) {
  const listeners = new Set();
  globalThis.matchMedia = (query) => ({
    matches: query.includes('dark') && prefersDark,
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
  });
  return { fire: () => listeners.forEach((fn) => fn()), size: () => listeners.size };
}

function stubDocument() {
  const attrs = new Map();
  globalThis.document = {
    documentElement: {
      setAttribute: (k, v) => attrs.set(k, v),
      removeAttribute: (k) => attrs.delete(k),
      getAttribute: (k) => attrs.get(k) ?? null,
    },
  };
  return attrs;
}

beforeEach(() => {
  removeItem(THEME_KEY);
  stubSystem(false);
  stubDocument();
});

afterEach(() => {
  delete globalThis.matchMedia;
  delete globalThis.document;
});

describe('storedTheme', () => {
  it('is null before the visitor has chosen', () => {
    assert.equal(storedTheme(), null);
  });

  it('returns the stored choice', () => {
    setTheme(DARK);
    assert.equal(storedTheme(), DARK);
  });

  it('ignores a junk value rather than applying it', () => {
    setTheme('chartreuse');
    assert.equal(storedTheme(), null);
  });
});

describe('systemTheme', () => {
  it('reads the operating system preference', () => {
    stubSystem(true);
    assert.equal(systemTheme(), DARK);
    stubSystem(false);
    assert.equal(systemTheme(), LIGHT);
  });

  it('falls back to light where matchMedia does not exist', () => {
    delete globalThis.matchMedia;
    assert.equal(systemTheme(), LIGHT);
  });
});

describe('resolvedTheme', () => {
  it('follows the system while no choice has been made', () => {
    stubSystem(true);
    assert.equal(resolvedTheme(), DARK);
  });

  it('lets an explicit choice override the system in both directions', () => {
    stubSystem(true);
    setTheme(LIGHT);
    assert.equal(resolvedTheme(), LIGHT);

    stubSystem(false);
    setTheme(DARK);
    assert.equal(resolvedTheme(), DARK);
  });
});

describe('setTheme', () => {
  it('stamps data-theme on the root element', () => {
    const attrs = stubDocument();
    setTheme(DARK);
    assert.equal(attrs.get('data-theme'), DARK);
  });

  it('clears the attribute and the choice when passed null', () => {
    const attrs = stubDocument();
    setTheme(DARK);
    setTheme(null);
    // No attribute at all is the "follow the system" state that app.css expects, so it
    // must be removed rather than set to some third value.
    assert.equal(attrs.has('data-theme'), false);
    assert.equal(storedTheme(), null);
  });
});

describe('toggleTheme', () => {
  it('flips an explicit choice', () => {
    setTheme(LIGHT);
    assert.equal(toggleTheme(), DARK);
    assert.equal(toggleTheme(), LIGHT);
  });

  it('flips against what is on screen, not against the empty stored value', () => {
    // A visitor following a dark system who clicks the toggle expects light. Flipping
    // against the stored value (null) would hand them dark again and look like a no-op.
    stubSystem(true);
    assert.equal(toggleTheme(), LIGHT);
  });
});

describe('watchSystemTheme', () => {
  it('reports a system change while the visitor has made no choice', () => {
    const seen = [];
    watchSystemTheme((theme) => seen.push(theme));
    const system = stubSystem(true);
    // Re-register against the new stub, then fire.
    watchSystemTheme((theme) => seen.push(theme));
    system.fire();
    assert.deepEqual(seen, [DARK]);
  });

  it('stays quiet once the visitor has chosen', () => {
    const system = stubSystem(true);
    const seen = [];
    watchSystemTheme((theme) => seen.push(theme));
    setTheme(LIGHT);
    system.fire();
    assert.deepEqual(seen, []);
  });

  it('unsubscribes cleanly', () => {
    const system = stubSystem(false);
    const stop = watchSystemTheme(() => {});
    assert.equal(system.size(), 1);
    stop();
    assert.equal(system.size(), 0);
  });

  it('is a no-op where matchMedia does not exist', () => {
    delete globalThis.matchMedia;
    assert.doesNotThrow(() => watchSystemTheme(() => {})());
  });
});

describe('theme-init.js', () => {
  it('uses the same storage key as theme.js', async () => {
    // theme-init.js runs before anything can be imported, so it hardcodes the key. This
    // is the only thing stopping the two drifting apart silently, which would look like
    // "my theme choice is forgotten on every navigation".
    const { readFile } = await import('node:fs/promises');
    const source = await readFile(
      new URL('../assets/js/theme-init.js', import.meta.url), 'utf8',
    );
    assert.ok(
      source.includes(`'${THEME_KEY}'`),
      `theme-init.js does not reference ${THEME_KEY}`,
    );
  });

  it('stays a classic script, since a module would defer past first paint', async () => {
    const { readFile } = await import('node:fs/promises');
    const source = await readFile(
      new URL('../assets/js/theme-init.js', import.meta.url), 'utf8',
    );
    assert.ok(!/^\s*(import|export)\s/m.test(source), 'theme-init.js must not use modules');
  });
});
