/**
 * Attendance for one student across every subject.
 *
 * Three bugs from the original are worth naming, because the fixes shape this file:
 *
 * 1. Totals were accumulated inside a `forEach` over async calls, with the running total
 *    written to the DOM from each callback. Whichever subject responded last decided the
 *    total, so the figure was wrong more often than right. Everything is fetched with
 *    Promise.allSettled here and totalled once, after all of it has landed.
 * 2. The student column index was found with a loop that left the previous value in place
 *    when the ID did not match, so a typo silently reported another student's record
 *    under the ID you typed. The student is now picked from a list, and a lookup miss is
 *    an explicit error.
 * 3. One failing subject took down the whole report. A subject that fails now shows as
 *    unavailable in its own row while the rest of the report still renders.
 */

import { ApiError, fetchSubject } from '../api.js';
import { requireSession } from '../auth.js';
import {
  ATTENDANCE_THRESHOLD, SUBJECTS, classLabel, findClass, periodLabel, subjectLabel,
} from '../config.js';
import { parseRoster, percentage, studentStats, toCsv } from '../sheet.js';
import {
  $, bindClassPickers, downloadCsv, el, fillSelect, initChrome, percentageClass, status,
} from '../ui.js';

if (requireSession()) {
  initChrome('search.html');
  start();
}

function start() {
  const feedback = status();
  const pickers = { course: $('#course'), semester: $('#semester'), section: $('#section') };
  const studentSelect = $('#student');
  let report = null;

  bindClassPickers(pickers, loadRoster);

  /**
   * Populate the student dropdown for the chosen class.
   *
   * The original asked the teacher to type a college ID from memory into a free-text box
   * and gave no feedback when it did not match. Listing them removes the whole failure.
   */
  async function loadRoster() {
    const klass = findClass({
      course: pickers.course.value,
      semester: pickers.semester.value,
      section: pickers.section.value,
    });

    if (!klass) {
      fillSelect(studentSelect, [{ id: '', label: 'No sheet for this class' }]);
      studentSelect.disabled = true;
      $('#student-hint').textContent = 'Add this class to config.js to report on it';
      return;
    }

    studentSelect.disabled = true;
    fillSelect(studentSelect, [{ id: '', label: 'Loading students…' }]);
    $('#student-hint').textContent = '';

    try {
      // Any subject tab carries the same roster, so the first one is enough.
      const rows = await fetchSubject(klass, SUBJECTS[0].id);
      const roster = parseRoster(rows);
      if (roster.length === 0) throw new ApiError('That class has no students on its roster.');

      fillSelect(studentSelect, roster.map((s) => ({ id: s.id, label: `${s.id} - ${s.name}` })));
      studentSelect.disabled = false;
      $('#student-hint').textContent = `${roster.length} students`;
    } catch (error) {
      fillSelect(studentSelect, [{ id: '', label: 'Could not load students' }]);
      $('#student-hint').textContent = describe(error);
    }
  }

  $('#picker-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    await build();
  });

  async function build() {
    const selection = {
      course: pickers.course.value,
      semester: pickers.semester.value,
      section: pickers.section.value,
    };
    const klass = findClass(selection);
    const collegeId = studentSelect.value;

    if (!klass) {
      feedback.error(`No sheet is configured for ${classLabel(selection)}.`);
      return;
    }
    if (!collegeId) {
      feedback.error('Choose a student.');
      return;
    }

    $('#run').disabled = true;
    $('#result').hidden = true;
    feedback.loading(`Reading ${SUBJECTS.length} subject sheets…`);

    // allSettled, not all: one dead subject tab must not blank the whole report.
    const settled = await Promise.allSettled(
      SUBJECTS.map(async (subject) => {
        const rows = await fetchSubject(klass, subject.id);
        const student = parseRoster(rows).find(
          (s) => s.id.toLowerCase() === collegeId.toLowerCase(),
        );
        if (!student) {
          throw new ApiError(`${collegeId} is not on the ${subject.label} roster.`);
        }
        return { subject, student, stats: studentStats(rows, student.column) };
      }),
    );

    const results = SUBJECTS.map((subject, index) => {
      const outcome = settled[index];
      return outcome.status === 'fulfilled'
        ? { subject, ...outcome.value, error: null }
        : { subject, student: null, stats: null, error: describe(outcome.reason) };
    });

    const ok = results.filter((r) => r.stats);
    if (ok.length === 0) {
      feedback.error('None of the subject sheets could be read for this student.', build);
      $('#run').disabled = false;
      return;
    }

    const name = ok[0].student.name;
    report = { klass, selection, collegeId, name, results };

    feedback.clear();
    render();
    $('#result').hidden = false;
    $('#run').disabled = false;
  }

  function render() {
    const { selection, collegeId, name, results } = report;
    const ok = results.filter((r) => r.stats);

    const present = ok.reduce((sum, r) => sum + r.stats.present, 0);
    const absent = ok.reduce((sum, r) => sum + r.stats.absent, 0);
    const total = present + absent;
    const overall = percentage(present, total);

    $('#result-title').textContent = `${name} (${collegeId}) - ${classLabel(selection)}`;

    $('#totals').replaceChildren(
      stat('Overall', `${overall}%`, percentageClass(overall, ATTENDANCE_THRESHOLD)),
      stat('Present', String(present)),
      stat('Absent', String(absent)),
      stat('Sessions', String(total)),
    );

    $('#subject-rows').replaceChildren(...results.map((result) => {
      if (!result.stats) {
        return el('tr', {},
          el('th', { scope: 'row', text: result.subject.label }),
          el('td', { colspan: '5', class: 'wrap' },
            el('span', { class: 'pill pct-warn', text: 'Unavailable' }), ' ', result.error),
        );
      }
      const { present: p, absent: a, total: t, percentage: pct, absentSessions } = result.stats;
      return el('tr', {},
        el('th', { scope: 'row', text: result.subject.label }),
        el('td', { class: 'num', text: String(p) }),
        el('td', { class: 'num', text: String(a) }),
        el('td', { class: 'num', text: String(t) }),
        el('td', {}, el('span', {
          class: `pill ${percentageClass(pct, ATTENDANCE_THRESHOLD)}`, text: `${pct}%`,
        })),
        el('td', { class: 'wrap', text: formatAbsences(absentSessions) }),
      );
    }));

    $('#subject-total').replaceChildren(
      el('tr', {},
        el('th', { scope: 'row', text: 'Total' }),
        el('td', { class: 'num', text: String(present) }),
        el('td', { class: 'num', text: String(absent) }),
        el('td', { class: 'num', text: String(total) }),
        el('td', {}, el('span', {
          class: `pill ${percentageClass(overall, ATTENDANCE_THRESHOLD)}`, text: `${overall}%`,
        })),
        el('td', {
          text: overall < ATTENDANCE_THRESHOLD ? `Below the ${ATTENDANCE_THRESHOLD}% requirement` : '',
        }),
      ),
    );
  }

  function stat(label, value, className = '') {
    return el('div', { class: 'stat' },
      el('dt', { text: label }),
      el('dd', { class: className, text: value }));
  }

  function formatAbsences(sessions) {
    if (sessions.length === 0) return 'None';
    // Group by date so three missed periods on one day read as one entry.
    const byDate = new Map();
    for (const s of sessions) {
      if (!byDate.has(s.date)) byDate.set(s.date, []);
      byDate.get(s.date).push(periodLabel(s.period).replace('Period ', 'P'));
    }
    return [...byDate.entries()]
      .map(([date, periods]) => `${date} (${periods.join(', ')})`)
      .join('; ');
  }

  $('#export').addEventListener('click', () => {
    if (!report) return;
    const rows = report.results.map((r) => [
      r.subject.label,
      r.stats?.present ?? '',
      r.stats?.absent ?? '',
      r.stats?.total ?? '',
      r.stats ? `${r.stats.percentage}%` : 'unavailable',
      r.stats ? formatAbsences(r.stats.absentSessions) : r.error,
    ]);
    const csv = toCsv(
      ['Subject', 'Present', 'Absent', 'Sessions', 'Attendance', 'Dates missed'],
      rows,
    );
    downloadCsv(`${report.collegeId}-attendance.csv`, csv);
  });

  loadRoster();
}

function describe(error) {
  if (error instanceof ApiError) return error.message;
  console.error(error);
  return 'Could not read this sheet.';
}
