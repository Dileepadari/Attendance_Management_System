import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ABSENT, PRESENT, buildSessionRow, classSummary, findSession, findStudent, parseRoster,
  parseSessions, percentage, readMark, studentColumns, studentStats, toCsv,
} from '../assets/js/sheet.js';
import { emptyRoster, rows, rowsWithoutPeriod } from './fixtures/rows.js';

describe('studentColumns', () => {
  it('returns the student columns in numeric order, excluding the label columns', () => {
    assert.deepEqual(studentColumns(rows), ['1', '2', '3', '4']);
  });

  it('does not lose the last student when the sheet has no period column', () => {
    // The original derived the count as keys.length - 2, which dropped a student on any
    // workbook laid out without a period column.
    assert.deepEqual(studentColumns(rowsWithoutPeriod), ['1', '2']);
  });

  it('survives empty input', () => {
    assert.deepEqual(studentColumns([]), []);
    assert.deepEqual(studentColumns(null), []);
  });
});

describe('parseRoster', () => {
  it('reads ids from row 0 and names from row 1', () => {
    const roster = parseRoster(rows);
    assert.equal(roster.length, 3);
    assert.deepEqual(roster[0], { column: '1', id: 'RS200301', name: 'Anitha Adari', serial: 1 });
  });

  it('drops columns that have neither an id nor a name', () => {
    assert.ok(!parseRoster(rows).some((s) => s.column === '4'));
  });

  it('numbers students consecutively after dropping blanks', () => {
    assert.deepEqual(parseRoster(rows).map((s) => s.serial), [1, 2, 3]);
  });

  it('returns an empty roster rather than throwing on a header-only sheet', () => {
    assert.deepEqual(parseRoster(emptyRoster), []);
    assert.deepEqual(parseRoster([]), []);
  });
});

describe('readMark', () => {
  it('reads the values a sheet actually contains', () => {
    assert.equal(readMark('1'), PRESENT);
    assert.equal(readMark(1), PRESENT);
    assert.equal(readMark('P'), PRESENT);
    assert.equal(readMark('present'), PRESENT);
    assert.equal(readMark('0'), ABSENT);
    assert.equal(readMark('A'), ABSENT);
  });

  it('treats blank and unreadable cells as unmarked, not as absent', () => {
    assert.equal(readMark(''), null);
    assert.equal(readMark('   '), null);
    assert.equal(readMark(undefined), null);
    assert.equal(readMark(null), null);
    assert.equal(readMark('n/a'), null);
  });
});

describe('parseSessions', () => {
  it('returns one entry per recorded session', () => {
    const sessions = parseSessions(rows);
    assert.equal(sessions.length, 4);
    assert.equal(sessions[0].date, '2023-03-06');
    assert.equal(sessions[0].period, 'period-1');
  });

  it('skips fully blank trailing rows', () => {
    // A blank row counted as a session would show as an absence for the whole class.
    assert.ok(!parseSessions(rows).some((s) => s.date === ''));
  });
});

describe('studentStats', () => {
  it('counts present and absent for one student', () => {
    const stats = studentStats(rows, '1');
    assert.equal(stats.present, 3);
    assert.equal(stats.absent, 1);
    assert.equal(stats.total, 4);
    assert.equal(stats.percentage, 75);
  });

  it('excludes blank cells from the total instead of counting them as absent', () => {
    // Chaitra has 3 marks over 4 sessions. Counting the blank as an absence would give
    // 75%; excluding it gives 100%, which is what a late enrolment should show.
    const stats = studentStats(rows, '3');
    assert.equal(stats.total, 3);
    assert.equal(stats.present, 3);
    assert.equal(stats.percentage, 100);
  });

  it('lists the date and period of every absence', () => {
    assert.deepEqual(studentStats(rows, '2').absentSessions, [
      { date: '2023-03-06', period: 'period-1' },
    ]);
  });

  it('reports 0 rather than NaN for a student with no sessions', () => {
    const stats = studentStats(emptyRoster, '1');
    assert.equal(stats.percentage, 0);
    assert.equal(stats.total, 0);
  });
});

describe('percentage', () => {
  it('rounds to one decimal', () => {
    assert.equal(percentage(2, 3), 66.7);
    assert.equal(percentage(1, 3), 33.3);
  });

  it('is 0, not NaN, when nothing has been recorded', () => {
    assert.equal(percentage(0, 0), 0);
  });
});

describe('findStudent', () => {
  it('matches ignoring case and surrounding whitespace', () => {
    assert.equal(findStudent(rows, '  rs200302 ').name, 'Bhargav Rao');
  });

  it('returns null for an unknown id instead of another student', () => {
    // The original left the previous index in place on a miss, so a typo reported
    // somebody else's attendance under the id that was typed.
    assert.equal(findStudent(rows, 'RS999999'), null);
    assert.equal(findStudent(rows, ''), null);
  });
});

describe('findSession', () => {
  it('finds a session already filed for a date and period', () => {
    assert.ok(findSession(rows, { date: '2023-03-06', period: 'period-4' }));
  });

  it('returns null when that slot is free', () => {
    assert.equal(findSession(rows, { date: '2023-03-06', period: 'period-8' }), null);
  });
});

describe('buildSessionRow', () => {
  it('writes the date under the label column and the period under its own', () => {
    const row = buildSessionRow(rows, {
      date: '2023-03-09', period: 'period-3', marks: { 1: PRESENT, 2: ABSENT, 3: PRESENT },
    });
    assert.equal(row['S. No'], '2023-03-09');
    assert.equal(row.period, 'period-3');
  });

  it('writes a mark for every roster student, defaulting a missing one to absent', () => {
    const row = buildSessionRow(rows, {
      date: '2023-03-09', period: 'period-3', marks: { 1: PRESENT },
    });
    assert.deepEqual(row, {
      'S. No': '2023-03-09', period: 'period-3', 1: PRESENT, 2: ABSENT, 3: ABSENT,
    });
  });

  it('does not write a column for the blank student', () => {
    const row = buildSessionRow(rows, { date: '2023-03-09', period: 'period-3', marks: {} });
    assert.ok(!('4' in row));
  });

  it('refuses to build a row with no date or no period', () => {
    assert.throws(() => buildSessionRow(rows, { period: 'period-1', marks: {} }), /date/i);
    assert.throws(() => buildSessionRow(rows, { date: '2023-03-09', marks: {} }), /period/i);
  });
});

describe('classSummary', () => {
  it('summarises every student and the class average', () => {
    const summary = classSummary(rows);
    assert.equal(summary.students.length, 3);
    assert.equal(summary.sessionCount, 4);
    // 9 present marks out of 11 recorded marks.
    assert.equal(summary.averagePercentage, 81.8);
  });
});

describe('toCsv', () => {
  it('quotes fields containing a comma, a quote, or a newline', () => {
    const csv = toCsv(['a', 'b'], [['plain', 'has,comma'], ['has"quote', 'line\nbreak']]);
    assert.equal(csv, 'a,b\nplain,"has,comma"\n"has""quote","line\nbreak"');
  });

  it('renders null and undefined as empty rather than as the word null', () => {
    assert.equal(toCsv(['a'], [[null], [undefined]]), 'a\n\n');
  });
});
