/**
 * Whole-class attendance for one subject.
 *
 * The original page was an iframe of a published Google Sheet and nothing else, so
 * answering "who is below 75%?" meant reading a grid of ones and zeroes by eye. The
 * numbers are computed here and the embed is kept underneath, because seeing the
 * underlying sheet is the point of the concept.
 */

import { ApiError, fetchSubject, isDemo } from '../api.js';
import { requireSession } from '../auth.js';
import {
  ATTENDANCE_THRESHOLD, classLabel, editSheetUrl, findClass, publishedSheetUrl, subjectLabel,
} from '../config.js';
import { classSummary, toCsv } from '../sheet.js';
import {
  $, $$, bindClassPickers, downloadCsv, el, fillSubjects, initChrome, percentageClass, status,
} from '../ui.js';

if (requireSession()) {
  initChrome('report.html');
  start();
}

function start() {
  const feedback = status();
  const pickers = { course: $('#course'), semester: $('#semester'), section: $('#section') };
  const subject = $('#subject');

  let report = null;
  let sort = { key: 'percentage', direction: 'asc' };

  fillSubjects(subject);
  bindClassPickers(pickers);

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

    if (!klass) {
      $('#result').hidden = true;
      $('#sheet-card').hidden = true;
      feedback.error(`No sheet is configured for ${classLabel(selection)}.`);
      return;
    }

    $('#run').disabled = true;
    feedback.loading(`Reading the ${subjectLabel(subject.value)} sheet…`);

    try {
      const rows = await fetchSubject(klass, subject.value);
      const summary = classSummary(rows);

      if (summary.students.length === 0) {
        $('#result').hidden = true;
        feedback.error('That subject tab has no students on its roster.');
        return;
      }

      report = { klass, selection, subject: subject.value, summary };
      feedback.clear();
      render();
      $('#result').hidden = false;
      renderEmbed(klass);
    } catch (error) {
      $('#result').hidden = true;
      feedback.error(error instanceof ApiError ? error.message : 'Could not read the sheet.', build);
      if (!(error instanceof ApiError)) console.error(error);
    } finally {
      $('#run').disabled = false;
    }
  }

  function render() {
    const { selection, subject: subjectId, summary } = report;
    const short = summary.students.filter((s) => s.percentage < ATTENDANCE_THRESHOLD);

    $('#result-title').textContent =
      `${classLabel(selection)} - ${subjectLabel(subjectId)}`;

    $('#totals').replaceChildren(
      stat('Class average', `${summary.averagePercentage}%`,
        percentageClass(summary.averagePercentage, ATTENDANCE_THRESHOLD)),
      stat('Students', String(summary.students.length)),
      stat('Sessions held', String(summary.sessionCount)),
      stat(`Below ${ATTENDANCE_THRESHOLD}%`, String(short.length),
        short.length ? 'pct-bad' : 'pct-good'),
    );

    renderRows();
  }

  function renderRows() {
    const onlyShort = $('#only-short').checked;
    const { key, direction } = sort;

    const students = [...report.summary.students]
      .filter((s) => !onlyShort || s.percentage < ATTENDANCE_THRESHOLD)
      .sort((a, b) => (direction === 'asc' ? a[key] - b[key] : b[key] - a[key]));

    if (students.length === 0) {
      $('#student-rows').replaceChildren(
        el('tr', {}, el('td', { colspan: '6', class: 'empty' },
          `Every student is at or above ${ATTENDANCE_THRESHOLD}%.`)),
      );
      return;
    }

    $('#student-rows').replaceChildren(...students.map((student) => el('tr', {},
      el('td', { class: 'num', text: String(student.serial) }),
      el('td', { class: 'roster-id', text: student.id }),
      el('td', { class: 'wrap', text: student.name }),
      el('td', { class: 'num', text: String(student.present) }),
      el('td', { class: 'num', text: String(student.absent) }),
      el('td', {}, el('span', {
        class: `pill ${percentageClass(student.percentage, ATTENDANCE_THRESHOLD)}`,
        text: `${student.percentage}%`,
      })),
    )));
  }

  function stat(label, value, className = '') {
    return el('div', { class: 'stat' },
      el('dt', { text: label }),
      el('dd', { class: className, text: value }));
  }

  function renderEmbed(klass) {
    // The published-sheet embed only exists for the real workbooks. In demo mode there is
    // nothing behind it, so showing an empty frame would just look broken.
    if (isDemo() || !klass.publishedId) {
      $('#sheet-card').hidden = true;
      return;
    }
    $('#sheet-frame').src = publishedSheetUrl(klass.publishedId);
    $('#sheet-open').href = editSheetUrl(klass.documentId);
    $('#sheet-card').hidden = false;
  }

  for (const button of $$('[data-sort]')) {
    button.addEventListener('click', () => {
      const key = button.dataset.sort;
      sort = key === sort.key
        ? { key, direction: sort.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'desc' };
      renderRows();
    });
  }

  $('#only-short').addEventListener('change', renderRows);
  $('#print').addEventListener('click', () => globalThis.print());

  $('#export').addEventListener('click', () => {
    if (!report) return;
    const csv = toCsv(
      ['Serial', 'ID', 'Name', 'Present', 'Absent', 'Sessions', 'Attendance %'],
      report.summary.students.map((s) => [
        s.serial, s.id, s.name, s.present, s.absent, s.total, s.percentage,
      ]),
    );
    const { course, semester, section } = report.selection;
    downloadCsv(`${course}-${semester}-${section}-${report.subject}.csv`, csv);
  });
}
