/**
 * Theme preference.
 *
 * Three states, matching what app.css already supports:
 *
 *   null      follow the operating system (no data-theme attribute on <html>)
 *   'light'   forced light  (data-theme="light")
 *   'dark'    forced dark   (data-theme="dark")
 *
 * A fresh visitor is in the null state, so the site follows their system setting without
 * anyone having to choose. The first click on the toggle moves them to an explicit choice,
 * which then wins over the system in both directions.
 *
 * The attribute is applied before first paint by theme-init.js, not from here. This module
 * only runs once the page's deferred module has loaded, which is too late to prevent a
 * flash of the wrong theme. See the note in theme-init.js.
 */

import { getItem, removeItem, setItem } from './storage.js';

/** Kept in sync by hand with the copy in theme-init.js, which cannot import. */
export const THEME_KEY = 'ams:theme';

export const LIGHT = 'light';
export const DARK = 'dark';

/** The stored choice, or null when the visitor has not chosen and follows the system. */
export function storedTheme() {
  const value = getItem(THEME_KEY);
  return value === LIGHT || value === DARK ? value : null;
}

/** What the operating system is asking for. Falls back to light where unknowable. */
export function systemTheme() {
  try {
    return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? DARK : LIGHT;
  } catch {
    // matchMedia is absent under the test runner and in very old browsers.
    return LIGHT;
  }
}

/** The theme actually on screen right now, whether chosen or inherited. */
export function resolvedTheme() {
  return storedTheme() ?? systemTheme();
}

/**
 * Store a choice and apply it.
 *
 * Passing null clears the choice and hands control back to the system, which is what the
 * "Match system" option does.
 */
export function setTheme(theme) {
  const root = globalThis.document?.documentElement;

  if (theme === LIGHT || theme === DARK) {
    setItem(THEME_KEY, theme);
    root?.setAttribute('data-theme', theme);
  } else {
    removeItem(THEME_KEY);
    root?.removeAttribute('data-theme');
  }
  return resolvedTheme();
}

/**
 * Flip to the opposite of what is currently on screen.
 *
 * Deliberately flips against the *resolved* theme rather than the stored one: a visitor
 * following a dark system who clicks the toggle expects light, not "now explicitly dark".
 */
export function toggleTheme() {
  return setTheme(resolvedTheme() === DARK ? LIGHT : DARK);
}

/**
 * Call `onChange` when the system preference moves, but only while the visitor has no
 * explicit choice. Lets the icon stay truthful if someone switches their OS to dark with
 * the page already open.
 *
 * @returns {() => void} unsubscribe
 */
export function watchSystemTheme(onChange) {
  let query;
  try {
    query = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
  } catch {
    return () => {};
  }
  if (!query?.addEventListener) return () => {};

  const handler = () => {
    if (storedTheme() === null) onChange(resolvedTheme());
  };
  query.addEventListener('change', handler);
  return () => query.removeEventListener('change', handler);
}
