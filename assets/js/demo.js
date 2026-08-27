/**
 * Offline provider.
 *
 * Produces the same row shape Stein returns, so every page above it is unaware which
 * provider it is talking to. A roster is generated deterministically from the class and
 * subject, and sessions written through the app are kept in localStorage, so marking
 * attendance and then opening a report actually shows the marks you just entered.
 *
 * The 2022 Stein storages this project shipped with no longer resolve, so without this
 * a fresh clone would have nothing to render and nothing to test against.
 */

import { LABEL_COLUMN, PERIOD_COLUMN } from './sheet.js';
import { getJson, setJson } from './storage.js';

const STORE_KEY = 'ams:demo:sessions';
const ROSTER_SIZE = 24;

const FIRST_NAMES = [
  'Anitha', 'Bhargav', 'Chaitra', 'Dinesh', 'Eswari', 'Farhan', 'Gayatri', 'Harish',
  'Indu', 'Jagadish', 'Kavya', 'Lokesh', 'Manasa', 'Naveen', 'Oviya', 'Pranay',
  'Rekha', 'Sandeep', 'Tejaswi', 'Uday', 'Vaishnavi', 'Yashwanth', 'Zoya', 'Akhil',
];

const SURNAMES = [
  'Adari', 'Bandaru', 'Chintala', 'Devarapalli', 'Erra', 'Gollapalli', 'Kandula',
  'Mandapati', 'Nallamilli', 'Peddineni', 'Rayudu', 'Sanaka', 'Tadepalli', 'Vemula',
];

/** Small deterministic hash so the same class always yields the same roster. */
function seedFrom(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function classId(klass) {
  return `${klass.course}/${klass.semester}/${klass.section}`;
}

/** Roster is per class, not per subject: the same students sit in every subject. */
function roster(klass) {
  const random = mulberry32(seedFrom(classId(klass)));
  // Mirrors the real RGUKT format: RS + two-digit year + two-digit section + two-digit
  // serial, so anything that assumes the shape of a college ID behaves as it would live.
  const yearDigits = klass.course === 'puc-1' ? '21' : '20';
  const sectionDigits = (klass.section.replace(/\D/g, '') || '1').padStart(2, '0');

  // Draw first names without replacement so no two students in a class share a name.
  // Duplicates look like a bug in the roster rather than like sample data.
  const pool = [...FIRST_NAMES];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return Array.from({ length: ROSTER_SIZE }, (_, i) => {
    const first = pool[i % pool.length];
    const last = SURNAMES[Math.floor(random() * SURNAMES.length)];
    const serial = String(i + 1).padStart(2, '0');
    return {
      column: String(i + 1),
      id: `RS${yearDigits}${sectionDigits}${serial}`,
      name: `${first} ${last}`,
    };
  });
}

function storeKey(klass, subject) {
  return `${classId(klass)}::${subject}`;
}

function readStore() {
  const store = getJson(STORE_KEY, {});
  return store && typeof store === 'object' ? store : {};
}

/**
 * Backfill so reports have something to show on a first run.
 *
 * Generated sessions are seeded per class and subject, so the numbers are stable across
 * reloads rather than reshuffling every time a report is opened.
 */
function seededSessions(klass, subject, students) {
  const random = mulberry32(seedFrom(`${storeKey(klass, subject)}::sessions`));
  const sessions = [];
  const start = new Date();
  start.setDate(start.getDate() - 40);

  for (let day = 0; day < 40; day += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + day);
    // No classes at the weekend.
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    if (random() < 0.35) continue;

    const period = `period-${1 + Math.floor(random() * 8)}`;
    const row = {
      [LABEL_COLUMN]: date.toISOString().slice(0, 10),
      [PERIOD_COLUMN]: period,
    };
    for (const student of students) {
      // Each student gets their own steady attendance habit, so reports show a spread
      // rather than uniform noise, and the below-threshold flag has something to catch.
      const habit = 0.72 + (seedFrom(student.id) % 26) / 100;
      row[student.column] = random() < habit ? 1 : 0;
    }
    sessions.push(row);
  }
  return sessions;
}

/** Same shape Stein returns: row 0 ids, row 1 names, row 2+ sessions. */
export async function fetchSubject(klass, subject) {
  const students = roster(klass);

  const idRow = { [LABEL_COLUMN]: 'ID', [PERIOD_COLUMN]: '' };
  const nameRow = { [LABEL_COLUMN]: 'NAME', [PERIOD_COLUMN]: '' };
  for (const student of students) {
    idRow[student.column] = student.id;
    nameRow[student.column] = student.name;
  }

  const store = readStore();
  const written = store[storeKey(klass, subject)] ?? [];
  const seeded = seededSessions(klass, subject, students);

  // Anything written through the app wins over the seeded backfill for the same slot.
  const writtenSlots = new Set(written.map((r) => `${r[LABEL_COLUMN]}|${r[PERIOD_COLUMN]}`));
  const merged = [
    ...seeded.filter((r) => !writtenSlots.has(`${r[LABEL_COLUMN]}|${r[PERIOD_COLUMN]}`)),
    ...written,
  ].sort((a, b) =>
    `${a[LABEL_COLUMN]}${a[PERIOD_COLUMN]}`.localeCompare(`${b[LABEL_COLUMN]}${b[PERIOD_COLUMN]}`),
  );

  return [idRow, nameRow, ...merged];
}

export async function appendSession(klass, subject, row) {
  const store = readStore();
  const key = storeKey(klass, subject);
  store[key] = [...(store[key] ?? []), row];
  setJson(STORE_KEY, store);
  return { appended: 1 };
}

export async function updateSession(klass, subject, { date, period }, row) {
  const store = readStore();
  const key = storeKey(klass, subject);
  const existing = store[key] ?? [];
  const index = existing.findIndex(
    (r) => r[LABEL_COLUMN] === date && r[PERIOD_COLUMN] === period,
  );
  if (index >= 0) existing[index] = row;
  else existing.push(row);
  store[key] = existing;
  setJson(STORE_KEY, store);
  return { updated: 1 };
}

/** Wipe locally written demo attendance. Offered on the about page. */
export function reset() {
  setJson(STORE_KEY, {});
}
