/**
 * Shared page chrome and DOM helpers.
 *
 * The header, nav and footer were copy-pasted into six pages, which is why the modify
 * link was missing from two of them and the logout link was a broken `href=""` that
 * reloaded the page before its onclick had committed. They are built here once.
 */

import { COURSES, PERIODS, SECTIONS, SEMESTERS, SUBJECTS, availableSections } from './config.js';
import { currentSession, signOut } from './auth.js';
import { isDemo } from './api.js';
import { DARK, resolvedTheme, toggleTheme, watchSystemTheme } from './theme.js';

const NAV = [
  { href: 'index.html', label: 'Mark attendance' },
  { href: 'search.html', label: 'Student report' },
  { href: 'report.html', label: 'Class report' },
  { href: 'modify.html', label: 'Edit sheets' },
  { href: 'about.html', label: 'About' },
];

/** Escape text before it goes anywhere near innerHTML. */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

/** Terse element builder. Children may be nodes or strings; strings become text nodes. */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/** Render the site header into `#site-header`, marking the current page. */
export function renderHeader(currentPage) {
  const mount = $('#site-header');
  if (!mount) return;

  const session = currentSession();

  const links = NAV.map((item) =>
    el('li', {}, el('a', {
      href: item.href,
      class: item.href === currentPage ? 'is-current' : '',
      'aria-current': item.href === currentPage ? 'page' : null,
      text: item.label,
    })),
  );

  const toggle = el('input', { type: 'checkbox', id: 'nav-toggle', class: 'nav-toggle' });

  mount.replaceChildren(
    el('div', { class: 'header-inner' },
      el('a', { class: 'brand', href: 'index.html' },
        el('span', { class: 'brand-badge' },
          el('img', { src: 'assets/img/logo-mark.png', alt: '', class: 'logo-mono' })),
        el('span', { class: 'brand-text' },
          el('strong', { text: 'RGUKT Attendance' }),
          el('small', { text: 'Srikakulam Campus' })),
      ),
      // Order matters. The checkbox must precede .main-nav for the `:checked ~` selector
      // that opens the mobile menu, and the theme toggle must follow .main-nav so it lands
      // at the far right on desktop and beside the burger on mobile, where .main-nav is
      // taken out of flow.
      toggle,
      el('nav', { class: 'main-nav', 'aria-label': 'Main' },
        el('ul', {}, ...links,
          el('li', { class: 'nav-session' },
            session
              ? el('button', {
                  type: 'button', class: 'link-button', onClick: () => {
                    signOut();
                    globalThis.location.href = 'login.html';
                  },
                }, `Sign out (${session.displayName})`)
              : el('a', { href: 'login.html', text: 'Sign in' })),
        ),
      ),
      themeToggle(),
      el('label', {
        for: 'nav-toggle', class: 'nav-burger', 'aria-label': 'Toggle navigation', role: 'button', tabindex: '0',
      }, '☰'),
    ),
  );

  // Close the mobile menu after a tap, otherwise it stays open over the next page.
  for (const link of $$('.main-nav a', mount)) {
    link.addEventListener('click', () => { toggle.checked = false; });
  }

  if (isDemo()) renderDemoBanner(mount);
}

function renderDemoBanner(mount) {
  mount.after(
    el('div', { class: 'demo-banner', role: 'status' },
      el('strong', { text: 'Demo data. ' }),
      'Rosters are generated locally and nothing is written to a real sheet. ',
      el('a', { href: 'about.html#connect', text: 'Connect your own sheets' }),
    ),
  );
}

/**
 * Sun and moon glyphs, as inline SVG so they inherit `currentColor` and need no font or
 * network request. `stroke="currentColor"` is what makes one file work in both themes.
 */
const ICONS = {
  sun: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
};

/**
 * Build the theme toggle.
 *
 * The button shows what a click will *do*, not what is currently on: a moon while the page
 * is light, a sun while it is dark. That is the convention almost every site uses, and the
 * aria-label spells it out either way so it does not rest on the icon alone.
 */
export function themeToggle() {
  const button = el('button', {
    type: 'button',
    class: 'theme-toggle',
    title: '',
  });

  const paint = () => {
    const dark = resolvedTheme() === DARK;
    button.innerHTML = dark ? ICONS.sun : ICONS.moon;
    const label = dark ? 'Switch to light theme' : 'Switch to dark theme';
    button.setAttribute('aria-label', label);
    button.title = label;
  };

  button.addEventListener('click', () => {
    toggleTheme();
    paint();
  });

  // Keep the icon honest if the visitor flips their OS theme with the page open. Only
  // fires while they have made no explicit choice of their own.
  watchSystemTheme(paint);

  paint();
  return button;
}

export function renderFooter() {
  const mount = $('#site-footer');
  if (!mount) return;
  mount.replaceChildren(
    el('p', {},
      `© ${new Date().getFullYear()} RGUKT-AP, Srikakulam Campus. Built by `,
      el('a', { href: 'https://github.com/Dileepadari', target: '_blank', rel: 'noopener noreferrer', text: 'Dileepkumar Adari' }),
      '.',
    ),
  );
}

/** Header, footer, and the year, in one call. */
export function initChrome(currentPage) {
  renderHeader(currentPage);
  renderFooter();
}

/** Fill a <select> from a list of {id,label} or plain strings. */
export function fillSelect(select, items, selected) {
  if (!select) return;
  select.replaceChildren(
    ...items.map((item) => {
      const id = typeof item === 'string' ? item : item.id;
      const label = typeof item === 'string' ? item : item.label;
      return el('option', { value: id, selected: id === selected }, label);
    }),
  );
  if (selected !== undefined) select.value = selected;
}

/**
 * Wire the course / semester / section trio so section only ever offers combinations
 * that actually have a workbook. The original let you pick PUC-1, then told you the
 * sheet could not be found after you had submitted.
 */
export function bindClassPickers({ course, semester, section }, onChange = () => {}) {
  fillSelect(course, COURSES, 'puc-2');
  fillSelect(semester, SEMESTERS, 'sem-2');

  const refresh = () => {
    const available = availableSections({ course: course.value, semester: semester.value });
    const previous = section.value;
    if (available.length === 0) {
      fillSelect(section, [{ id: '', label: 'No sheets configured' }], '');
      section.disabled = true;
    } else {
      section.disabled = false;
      fillSelect(section, SECTIONS.map((id) => ({
        id, label: available.includes(id) ? id : `${id} (no sheet)`,
      })), available.includes(previous) ? previous : available[0]);
      for (const option of section.options) {
        option.disabled = !available.includes(option.value);
      }
    }
    onChange();
  };

  course.addEventListener('change', refresh);
  semester.addEventListener('change', refresh);
  refresh();
}

export function fillSubjects(select, selected) {
  fillSelect(select, SUBJECTS, selected);
}

export function fillPeriods(select, selected) {
  fillSelect(select, PERIODS, selected);
}

/**
 * Status region. One place for spinners, errors and success messages, wired to
 * aria-live so a screen reader announces them. The original used window.alert, which
 * blocks the page and cannot be styled or dismissed.
 */
export function status(mountSelector = '#status') {
  const mount = $(mountSelector);
  return {
    clear() { if (mount) mount.replaceChildren(); },
    loading(message = 'Loading…') {
      if (!mount) return;
      mount.replaceChildren(
        el('div', { class: 'status status-loading' }, el('span', { class: 'spinner' }), message),
      );
    },
    error(message, onRetry) {
      if (!mount) return;
      mount.replaceChildren(
        el('div', { class: 'status status-error', role: 'alert' },
          el('span', { text: message }),
          onRetry ? el('button', { type: 'button', class: 'btn btn-quiet', onClick: onRetry }, 'Try again') : null,
        ),
      );
    },
    success(message) {
      if (!mount) return;
      mount.replaceChildren(el('div', { class: 'status status-success' }, message));
    },
    info(message) {
      if (!mount) return;
      mount.replaceChildren(el('div', { class: 'status status-info' }, message));
    },
  };
}

/** Transient toast, bottom right. Auto-dismisses. */
export function toast(message, kind = 'info') {
  let host = $('#toasts');
  if (!host) {
    host = el('div', { id: 'toasts', class: 'toasts', 'aria-live': 'polite' });
    document.body.append(host);
  }
  const node = el('div', { class: `toast toast-${kind}` }, message);
  host.append(node);
  setTimeout(() => {
    node.classList.add('is-leaving');
    setTimeout(() => node.remove(), 300);
  }, 4000);
}

/**
 * Modal confirm, returning a promise.
 *
 * Replaces window.confirm, which the browser-automation guidance rules out and which
 * blocks the event loop. Focus is trapped to the dialog and Escape cancels.
 */
export function confirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel' }) {
  return new Promise((resolve) => {
    const dialog = el('div', { class: 'modal-backdrop', role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
    const close = (result) => {
      document.removeEventListener('keydown', onKey);
      dialog.remove();
      resolve(result);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') close(false);
    };

    const confirmButton = el('button', { type: 'button', class: 'btn btn-primary', onClick: () => close(true) }, confirmLabel);

    dialog.append(
      el('div', { class: 'modal' },
        el('h2', { text: title }),
        el('p', { text: message }),
        el('div', { class: 'modal-actions' },
          el('button', { type: 'button', class: 'btn btn-quiet', onClick: () => close(false) }, cancelLabel),
          confirmButton,
        ),
      ),
    );

    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) close(false);
    });
    document.addEventListener('keydown', onKey);
    document.body.append(dialog);
    confirmButton.focus();
  });
}

/**
 * Hand the user a CSV.
 *
 * Uses a blob URL and a synthetic click. Nothing here reaches the network, so it works
 * from file:// as well as from a server.
 */
export function downloadCsv(filename, csv) {
  // The BOM makes Excel open UTF-8 names correctly instead of mojibake.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = el('a', { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Today in the local timezone as YYYY-MM-DD, which is what <input type="date"> wants. */
export function todayIso() {
  const now = new Date();
  // toISOString() converts to UTC first, so anywhere east of Greenwich after 18:30 it
  // returns tomorrow. That is how the original could file attendance under the wrong day.
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

/** Colour class for an attendance percentage. */
export function percentageClass(value, threshold) {
  if (value >= threshold) return 'pct-good';
  if (value >= threshold - 10) return 'pct-warn';
  return 'pct-bad';
}
