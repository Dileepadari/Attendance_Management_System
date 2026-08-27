/**
 * Mark attendance.
 *
 * Merges what used to be index.html (pick a class) and main.html (mark the roster).
 * main.html rebuilt the whole page with document.write from a localStorage value, which
 * meant a reload lost the roster and a stale value left the page permanently blank.
 * The selection now lives in the query string, so a reload and a bookmark both work.
 */

import { appendSession, ApiError, fetchSubject, updateSession } from '../api.js';
import { requireSession } from '../auth.js';
import { ATTENDANCE_THRESHOLD, classLabel, findClass, periodLabel, subjectLabel } from '../config.js';
import {
  ABSENT, PRESENT, buildSessionRow, findSession, parseRoster,
} from '../sheet.js';
import { getJson, removeItem, setJson } from '../storage.js';
import {
  $, $$, bindClassPickers, confirmDialog, el, fillPeriods, fillSubjects, initChrome,
  status, toast, todayIso,
} from '../ui.js';

if (requireSession()) {
  initChrome('index.html');
  start();
}

function start() {
  const feedback = status();
  const pickers = {
    course: $('#course'),
    semester: $('#semester'),
    section: $('#section'),
  };
  const subject = $('#subject');
  const params = new URLSearchParams(globalThis.location.search);

  /** Everything about the register currently on screen. */
  let loaded = null;

  fillSubjects(subject, params.get('subject') ?? undefined);
  bindClassPickers(pickers);

  // Restore a selection from the URL so a reload keeps you on the same register.
  for (const [key, select] of Object.entries(pickers)) {
    const value = params.get(key);
    if (value && [...select.options].some((o) => o.value === value && !o.disabled)) {
      select.value = value;
    }
  }
  // Section options depend on course and semester, so it has to be set after the change
  // handler has repopulated them.
  pickers.course.dispatchEvent(new Event('change'));
  if (params.get('section')) pickers.section.value = params.get('section');

  fillPeriods($('#period'), currentPeriodGuess());
  $('#date').value = todayIso();
  $('#date').max = todayIso();

  $('#picker-form').addEventListener('submit', (event) => {
    event.preventDefault();
    loadRegister();
  });

  if (params.get('section') && params.get('subject')) loadRegister();

  async function loadRegister() {
    const selection = {
      course: pickers.course.value,
      semester: pickers.semester.value,
      section: pickers.section.value,
    };
    const klass = findClass(selection);

    if (!klass) {
      $('#register').hidden = true;
      feedback.error(
        `No sheet is configured for ${classLabel(selection)}. Add it to CLASSES in assets/js/config.js.`,
      );
      return;
    }

    const url = new URL(globalThis.location.href);
    url.search = new URLSearchParams({ ...selection, subject: subject.value }).toString();
    globalThis.history.replaceState(null, '', url);

    feedback.loading(`Loading ${subjectLabel(subject.value)} register for ${classLabel(selection)}…`);
    $('#load').disabled = true;

    try {
      const rows = await fetchSubject(klass, subject.value);
      const roster = parseRoster(rows);

      if (roster.length === 0) {
        $('#register').hidden = true;
        feedback.error('That subject tab has no students. Check row 1 holds IDs and row 2 holds names.');
        return;
      }

      loaded = { klass, subject: subject.value, selection, rows, roster };
      feedback.clear();
      renderRoster();
      $('#register').hidden = false;
    } catch (error) {
      $('#register').hidden = true;
      feedback.error(describe(error), loadRegister);
    } finally {
      $('#load').disabled = false;
    }
  }

  function draftKey() {
    return `ams:draft:${loaded.selection.course}/${loaded.selection.semester}/${loaded.selection.section}/${loaded.subject}`;
  }

  function renderRoster() {
    const { roster, selection, subject: subjectId } = loaded;

    $('#register-title').textContent = `${classLabel(selection)} - ${subjectLabel(subjectId)}`;
    $('#roster-count').textContent = `${roster.length} students`;

    // A saved draft survives a reload, a dropped connection, or a mis-tap on a nav link
    // halfway through a roster of 60.
    const draft = getJson(draftKey(), null);
    if (draft?.marks) {
      $('#date').value = draft.date ?? todayIso();
      $('#period').value = draft.period ?? $('#period').value;
      toast('Restored your unsaved draft for this register.');
    }

    $('#roster').replaceChildren(
      ...roster.map((student) => {
        const saved = draft?.marks?.[student.column];
        const mark = saved === PRESENT || saved === ABSENT ? saved : PRESENT;
        return renderStudent(student, mark);
      }),
    );

    updateTally();
  }

  function renderStudent(student, mark) {
    const name = `mark-${student.column}`;
    const presentId = `${name}-p`;
    const absentId = `${name}-a`;

    // Each radio gets a unique id, so its <label for> actually targets it. The original
    // gave every radio on the page id="link-input-rad", so clicking any label toggled
    // the first student in the list.
    const row = el('li', {
      class: `roster-row${mark === ABSENT ? ' is-absent' : ''}`,
      'data-search': `${student.id} ${student.name}`.toLowerCase(),
      'data-column': student.column,
    },
      el('span', { class: 'roster-serial num', text: String(student.serial) }),
      el('span', { class: 'roster-id', text: student.id }),
      el('span', { class: 'roster-name', text: student.name }),
      el('span', { class: 'mark-toggle' },
        el('input', {
          type: 'radio', name, id: presentId, value: String(PRESENT), checked: mark === PRESENT,
        }),
        el('label', { for: presentId, text: 'Present' }),
        el('input', {
          type: 'radio', name, id: absentId, value: String(ABSENT), checked: mark === ABSENT,
        }),
        el('label', { for: absentId, text: 'Absent' }),
      ),
    );

    row.addEventListener('change', () => {
      row.classList.toggle('is-absent', readMarkOf(row) === ABSENT);
      updateTally();
      saveDraft();
    });

    return row;
  }

  function readMarkOf(row) {
    const checked = row.querySelector('input:checked');
    return checked ? Number(checked.value) : PRESENT;
  }

  function collectMarks() {
    const marks = {};
    for (const row of $$('#roster .roster-row')) {
      marks[row.dataset.column] = readMarkOf(row);
    }
    return marks;
  }

  function setAll(mark) {
    // Only rows the filter is currently showing, so "all absent" after searching for one
    // student does not silently mark the other 59.
    for (const row of $$('#roster .roster-row')) {
      if (row.hidden) continue;
      row.querySelector(`input[value="${mark}"]`).checked = true;
      row.classList.toggle('is-absent', mark === ABSENT);
    }
    updateTally();
    saveDraft();
  }

  function updateTally() {
    const marks = Object.values(collectMarks());
    const present = marks.filter((m) => m === PRESENT).length;
    const absent = marks.length - present;
    const pct = marks.length ? Math.round((present / marks.length) * 100) : 0;
    $('#tally').replaceChildren(
      el('strong', { text: String(present) }), ' present, ',
      el('strong', { text: String(absent) }), ' absent (', `${pct}%`, ')',
    );
  }

  function saveDraft() {
    if (!loaded) return;
    setJson(draftKey(), {
      date: $('#date').value,
      period: $('#period').value,
      marks: collectMarks(),
      savedAt: Date.now(),
    });
  }

  $('#all-present').addEventListener('click', () => setAll(PRESENT));
  $('#all-absent').addEventListener('click', () => setAll(ABSENT));
  $('#date').addEventListener('change', saveDraft);
  $('#period').addEventListener('change', saveDraft);

  $('#filter').addEventListener('input', (event) => {
    const needle = event.target.value.trim().toLowerCase();
    let shown = 0;
    for (const row of $$('#roster .roster-row')) {
      const match = !needle || row.dataset.search.includes(needle);
      row.hidden = !match;
      if (match) shown += 1;
    }
    $('#roster-count').textContent = needle
      ? `${shown} of ${loaded.roster.length} students`
      : `${loaded.roster.length} students`;
  });

  $('#discard').addEventListener('click', async () => {
    const confirmed = await confirmDialog({
      title: 'Discard this draft?',
      message: 'Every student goes back to present and your saved draft is cleared.',
      confirmLabel: 'Discard',
    });
    if (!confirmed) return;
    removeItem(draftKey());
    setAll(PRESENT);
    $('#filter').value = '';
    for (const row of $$('#roster .roster-row')) row.hidden = false;
    toast('Draft discarded.');
  });

  $('#attendance-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    await save();
  });

  async function save() {
    const date = $('#date').value;
    const period = $('#period').value;
    const button = $('#save');

    if (!date) {
      feedback.error('Choose the date this class was held.');
      return;
    }
    if (date > todayIso()) {
      feedback.error('That date is in the future. Attendance can only be filed for a class that has happened.');
      return;
    }

    const marks = collectMarks();
    const row = buildSessionRow(loaded.rows, { date, period, marks });

    // Filing the same date and period twice is the single most common mistake, and Stein
    // appends, so the original silently produced two rows and doubled the totals.
    const existing = findSession(loaded.rows, { date, period });
    if (existing) {
      const confirmed = await confirmDialog({
        title: 'Already recorded',
        message: `${periodLabel(period)} on ${date} is already filed for this subject. Replace it with what is on screen?`,
        confirmLabel: 'Replace',
      });
      if (!confirmed) return;
    }

    button.disabled = true;
    button.textContent = 'Saving…';
    feedback.loading('Filing attendance to the sheet…');

    try {
      if (existing) await updateSession(loaded.klass, loaded.subject, { date, period }, row);
      else await appendSession(loaded.klass, loaded.subject, row);

      removeItem(draftKey());

      const present = Object.values(marks).filter((m) => m === PRESENT).length;
      const pct = Math.round((present / Object.keys(marks).length) * 100);
      feedback.success(
        `Saved. ${present} of ${Object.keys(marks).length} present (${pct}%)${
          pct < ATTENDANCE_THRESHOLD ? ' - low turnout for this class.' : '.'}`,
      );
      toast('Attendance saved.', 'success');

      // Reload so the duplicate check sees the row we just wrote.
      loaded.rows = await fetchSubject(loaded.klass, loaded.subject);
    } catch (error) {
      // Never clear the draft on failure: the marks on screen are the only copy.
      feedback.error(`${describe(error)} Your marks are still on screen and saved as a draft.`);
      toast('Could not save attendance.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Save register';
    }
  }
}

/** Best guess at the current period, so the common case needs no change. */
function currentPeriodGuess() {
  const hour = new Date().getHours();
  // Classes run 09:00 to 17:00, one period an hour.
  const index = Math.min(8, Math.max(1, hour - 8));
  return `period-${index}`;
}

function describe(error) {
  if (error instanceof ApiError) return error.message;
  console.error(error);
  return 'Something went wrong. Check the browser console for details.';
}
