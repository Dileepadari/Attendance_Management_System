/**
 * Reading and writing the transposed attendance grid.
 *
 * A subject tab is laid out with one COLUMN per student, not one row per student:
 *
 *   | S. No      | period   | 1        | 2        | 3        |
 *   | ID         |          | RS200301 | RS200302 | RS200303 |   <- row 0, college ids
 *   | NAME       |          | Anitha   | Bhargav  | Chaitra  |   <- row 1, names
 *   | 2023-03-06 | period-1 | 1        | 0        | 1        |   <- row 2+, one session
 *   | 2023-03-06 | period-4 | 1        | 1        | 1        |
 *
 * "S. No" doubles as the label column: on row 0 and 1 it names the row, on every later
 * row it holds the session date. That is why appending a session posts the date under
 * the key "S. No". The layout is inherited from the original workbooks and is kept so
 * existing sheets keep working.
 *
 * Everything here is pure: rows in, plain data out. No fetch, no DOM.
 */

export const ID_ROW = 0;
export const NAME_ROW = 1;
export const FIRST_SESSION_ROW = 2;

export const LABEL_COLUMN = 'S. No';
export const PERIOD_COLUMN = 'period';

export const PRESENT = 1;
export const ABSENT = 0;

/**
 * Student columns, in sheet order.
 *
 * The original code derived the count as `Object.keys(data[0]).length - 2` and indexed
 * with a while loop, which silently dropped the last student whenever a workbook had no
 * "period" column. Reading the keys and filtering out the two label columns cannot drift
 * that way, and it tolerates columns being reordered.
 *
 * @param {Array<Object>} rows Raw Stein rows.
 * @returns {string[]} Column keys such as ["1", "2", "3"].
 */
export function studentColumns(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  return Object.keys(rows[ID_ROW])
    .filter((key) => key !== LABEL_COLUMN && key !== PERIOD_COLUMN)
    .sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return String(a).localeCompare(String(b));
    });
}

/**
 * The class roster.
 *
 * Columns with neither an id nor a name are dropped: a trailing blank column is a normal
 * thing to find in a hand-edited sheet and must not become a nameless student.
 *
 * @returns {Array<{column: string, id: string, name: string, serial: number}>}
 */
export function parseRoster(rows) {
  if (!Array.isArray(rows) || rows.length <= NAME_ROW) return [];
  const idRow = rows[ID_ROW] ?? {};
  const nameRow = rows[NAME_ROW] ?? {};

  return studentColumns(rows)
    .map((column) => ({
      column,
      id: String(idRow[column] ?? '').trim(),
      name: String(nameRow[column] ?? '').trim(),
    }))
    .filter((student) => student.id !== '' || student.name !== '')
    .map((student, index) => ({ ...student, serial: index + 1 }));
}

/** Normalise a cell to 1, 0, or null when the cell is blank or unreadable. */
export function readMark(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim().toLowerCase();
  if (text === '') return null;
  if (text === '1' || text === 'p' || text === 'present' || text === 'true') return PRESENT;
  if (text === '0' || text === 'a' || text === 'absent' || text === 'false') return ABSENT;
  const numeric = Number(text);
  if (Number.isFinite(numeric)) return numeric > 0 ? PRESENT : ABSENT;
  return null;
}

/**
 * Recorded sessions, oldest first.
 *
 * @returns {Array<{date: string, period: string, marks: Record<string, 0|1|null>, rowIndex: number}>}
 */
export function parseSessions(rows) {
  if (!Array.isArray(rows)) return [];
  const columns = studentColumns(rows);

  return rows.slice(FIRST_SESSION_ROW).map((row, offset) => {
    const marks = {};
    for (const column of columns) marks[column] = readMark(row[column]);
    return {
      date: String(row[LABEL_COLUMN] ?? '').trim(),
      period: String(row[PERIOD_COLUMN] ?? '').trim(),
      marks,
      rowIndex: FIRST_SESSION_ROW + offset,
    };
  })
  // A sheet that has been scrolled past its data returns fully blank rows. They are not
  // sessions and would otherwise count as an absence for everyone.
  .filter((session) => session.date !== '');
}

/** True when this date and period has already been recorded. Drives the duplicate warning. */
export function findSession(rows, { date, period }) {
  return parseSessions(rows).find((s) => s.date === date && s.period === period) ?? null;
}

/**
 * Per-student totals for one subject.
 *
 * Blank cells are excluded from both numerator and denominator: a student who joined
 * mid-term should not show as absent for every session before they enrolled. The
 * original code coerced blanks to 0 through `Number(undefined)`, producing NaN totals.
 *
 * @returns {{present: number, absent: number, total: number, percentage: number, absentSessions: Array}}
 */
export function studentStats(rows, column) {
  const sessions = parseSessions(rows);
  let present = 0;
  let absent = 0;
  const absentSessions = [];

  for (const session of sessions) {
    const mark = session.marks[column];
    if (mark === PRESENT) present += 1;
    else if (mark === ABSENT) {
      absent += 1;
      absentSessions.push({ date: session.date, period: session.period });
    }
  }

  const total = present + absent;
  return { present, absent, total, percentage: percentage(present, total), absentSessions };
}

/** Attendance percentage, rounded to one decimal. A student with no sessions is 0, not NaN. */
export function percentage(present, total) {
  if (!total) return 0;
  return Math.round((present / total) * 1000) / 10;
}

/** Locate a student by college id. Case and whitespace insensitive; ids get typed by hand. */
export function findStudent(rows, collegeId) {
  const needle = String(collegeId ?? '').trim().toLowerCase();
  if (!needle) return null;
  return parseRoster(rows).find((s) => s.id.toLowerCase() === needle) ?? null;
}

/** Whole-class summary for one subject, used by the class report and its CSV export. */
export function classSummary(rows) {
  const roster = parseRoster(rows);
  const sessions = parseSessions(rows);
  const students = roster.map((student) => ({
    ...student,
    ...studentStats(rows, student.column),
  }));

  const totalPresent = students.reduce((sum, s) => sum + s.present, 0);
  const totalMarks = students.reduce((sum, s) => sum + s.total, 0);

  return {
    students,
    sessionCount: sessions.length,
    sessions,
    averagePercentage: percentage(totalPresent, totalMarks),
  };
}

/**
 * Build the row to append for one session.
 *
 * `marks` is keyed by student column. Any roster column missing from `marks` is written
 * as absent rather than left blank, so a half-submitted form cannot produce a row that
 * later reads as "this student was not enrolled yet".
 */
export function buildSessionRow(rows, { date, period, marks }) {
  if (!date) throw new Error('A date is required');
  if (!period) throw new Error('A period is required');

  const row = { [LABEL_COLUMN]: date, [PERIOD_COLUMN]: period };
  for (const student of parseRoster(rows)) {
    row[student.column] = marks[student.column] === PRESENT ? PRESENT : ABSENT;
  }
  return row;
}

/** Serialise rows to CSV. Used by the export buttons on both report pages. */
export function toCsv(headers, rows) {
  const escape = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n');
}
