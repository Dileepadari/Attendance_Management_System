/**
 * The demo provider is the default, so its output is what most people will ever see.
 * It has to produce rows sheet.js can read, and it has to be stable across reloads or
 * every report would show different numbers each time it was opened.
 */

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { appendSession, fetchSubject, reset, updateSession } from '../assets/js/demo.js';
import { LABEL_COLUMN, PERIOD_COLUMN, classSummary, findSession, parseRoster, parseSessions } from '../assets/js/sheet.js';

const klass = { course: 'puc-2', semester: 'sem-2', section: 'B1' };
const other = { course: 'puc-2', semester: 'sem-2', section: 'B2' };

beforeEach(() => reset());

describe('fetchSubject', () => {
  it('returns rows sheet.js can parse into a roster', async () => {
    const roster = parseRoster(await fetchSubject(klass, 'english'));
    assert.equal(roster.length, 24);
    assert.match(roster[0].id, /^RS\d{6}$/);
    assert.ok(roster[0].name.includes(' '));
  });

  it('gives the same roster on every call', async () => {
    const a = parseRoster(await fetchSubject(klass, 'english'));
    const b = parseRoster(await fetchSubject(klass, 'english'));
    assert.deepEqual(a, b);
  });

  it('gives the same roster across subjects, since one class shares its students', async () => {
    const english = parseRoster(await fetchSubject(klass, 'english'));
    const physics = parseRoster(await fetchSubject(klass, 'physics'));
    assert.deepEqual(english, physics);
  });

  it('gives different classes different students', async () => {
    const a = parseRoster(await fetchSubject(klass, 'english'));
    const b = parseRoster(await fetchSubject(other, 'english'));
    assert.notDeepEqual(a.map((s) => s.id), b.map((s) => s.id));
  });

  it('backfills sessions so reports have something to show on a first run', async () => {
    const sessions = parseSessions(await fetchSubject(klass, 'english'));
    assert.ok(sessions.length > 5, `expected a backfill, got ${sessions.length} sessions`);
    for (const session of sessions) {
      assert.match(session.date, /^\d{4}-\d{2}-\d{2}$/);
      assert.match(session.period, /^period-[1-8]$/);
    }
  });

  it('produces a spread of attendance rather than everyone at 100%', async () => {
    const summary = classSummary(await fetchSubject(klass, 'english'));
    const percentages = new Set(summary.students.map((s) => s.percentage));
    assert.ok(percentages.size > 3, 'expected varied attendance across the class');
    assert.ok(summary.averagePercentage > 50 && summary.averagePercentage < 100);
  });
});

describe('appendSession', () => {
  it('makes a written session readable on the next fetch', async () => {
    const row = { [LABEL_COLUMN]: '2099-01-01', [PERIOD_COLUMN]: 'period-1', 1: 0 };
    await appendSession(klass, 'english', row);

    const found = findSession(await fetchSubject(klass, 'english'), {
      date: '2099-01-01', period: 'period-1',
    });
    assert.ok(found);
    assert.equal(found.marks['1'], 0);
  });

  it('keeps subjects separate', async () => {
    await appendSession(klass, 'english', { [LABEL_COLUMN]: '2099-01-01', [PERIOD_COLUMN]: 'period-1', 1: 0 });
    const physics = await fetchSubject(klass, 'physics');
    assert.equal(findSession(physics, { date: '2099-01-01', period: 'period-1' }), null);
  });
});

describe('updateSession', () => {
  it('replaces a session in place rather than appending a second one', async () => {
    const slot = { date: '2099-01-01', period: 'period-1' };
    await appendSession(klass, 'english', { [LABEL_COLUMN]: slot.date, [PERIOD_COLUMN]: slot.period, 1: 0 });
    await updateSession(klass, 'english', slot, { [LABEL_COLUMN]: slot.date, [PERIOD_COLUMN]: slot.period, 1: 1 });

    const sessions = parseSessions(await fetchSubject(klass, 'english'))
      .filter((s) => s.date === slot.date && s.period === slot.period);

    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].marks['1'], 1);
  });
});

describe('reset', () => {
  it('drops written sessions but keeps the backfill', async () => {
    await appendSession(klass, 'english', { [LABEL_COLUMN]: '2099-01-01', [PERIOD_COLUMN]: 'period-1', 1: 0 });
    reset();

    const rows = await fetchSubject(klass, 'english');
    assert.equal(findSession(rows, { date: '2099-01-01', period: 'period-1' }), null);
    assert.ok(parseSessions(rows).length > 5);
  });
});

describe('roster names', () => {
  it('gives every student in a class a distinct name', async () => {
    // Two students showing the same name reads as a bug in the roster rather than as
    // sample data, and makes the reports impossible to sanity check by eye.
    const roster = parseRoster(await fetchSubject(klass, 'english'));
    const names = roster.map((s) => s.name);
    assert.equal(new Set(names).size, names.length);
  });

  it('gives every student a distinct id', async () => {
    const roster = parseRoster(await fetchSubject(klass, 'english'));
    const ids = roster.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});
