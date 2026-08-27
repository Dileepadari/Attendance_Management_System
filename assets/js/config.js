/**
 * Single source of truth for the app.
 *
 * The original build repeated the same nine-branch if/else chain in four pages,
 * once per kind of link (Stein API, published sheet, editable sheet). Everything
 * now lives in CLASSES below, so adding a section is one entry, not four edits.
 *
 * This module is plain ESM with no browser globals, so `node --test` imports it
 * directly. Keep it that way.
 */

/** Subjects that carry attendance. Each is one tab (sheet) inside a class workbook. */
export const SUBJECTS = [
  { id: 'telugu', label: 'Telugu' },
  { id: 'english', label: 'English' },
  { id: 'mathematics', label: 'Mathematics' },
  { id: 'physics', label: 'Physics' },
  { id: 'chemistry', label: 'Chemistry' },
  { id: 'information technology', label: 'Information Technology' },
  { id: 'biology', label: 'Biology' },
];

/** Teaching periods in a day. */
export const PERIODS = Array.from({ length: 8 }, (_, i) => ({
  id: `period-${i + 1}`,
  label: `Period ${i + 1}`,
}));

export const COURSES = [
  { id: 'puc-1', label: 'PUC-1' },
  { id: 'puc-2', label: 'PUC-2' },
];

export const SEMESTERS = [
  { id: 'sem-1', label: 'Sem-1' },
  { id: 'sem-2', label: 'Sem-2' },
];

export const SECTIONS = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9'];

/**
 * Every class that has a workbook behind it.
 *
 * storageId   Stein.HQ storage id. `https://api.steinhq.com/v1/storages/<id>/<subject>`
 *             is the REST endpoint for one subject tab.
 * publishedId The `2PACX-...` id from File > Share > Publish to web. Read-only HTML,
 *             embedded in the class report page.
 * documentId  The workbook id from the normal edit URL. Used for the "open in Sheets"
 *             link on the modify page. Requires the viewer to have edit access.
 *
 * The ids below are the ones from the 2022 RGUKT deployment. They no longer resolve
 * (Stein returns invalid_grant), which is why DEMO mode exists. Replace them with your
 * own before pointing PROVIDER at 'stein'. See DEVDOC.md, "Wiring up your own sheets".
 */
export const CLASSES = [
  {
    course: 'puc-2', semester: 'sem-2', section: 'B1',
    storageId: '62f0e81ebca21f053ea77753',
    publishedId: '2PACX-1vQaVAc84V28qcrUCAXgtVqliNGhKRvz40Qpbh8oW6bLKLt4tSWxant3MPY9vijRNO63nmRbsWq7McbM',
    documentId: '150ovWDMQ3g8W540jc6bRaUDYulQ489je8Sj31t37wEQ',
  },
  {
    course: 'puc-2', semester: 'sem-2', section: 'B2',
    storageId: '62f0e8bcbca21f053ea7776e',
    publishedId: '2PACX-1vTBlRakwMymleQyb9ej58HHABIDYknJWMezWAEo4TS-ZS10WeHJEaM7sWarw9ftJ4kcyRKpCYyGG8iV',
    documentId: '1m2wWHENFQw6rS0gj0d-NX0llcKwLTshSH0oCq-7h2mo',
  },
  {
    course: 'puc-2', semester: 'sem-2', section: 'B3',
    storageId: '62f0e5a6bca21f053ea776ec',
    publishedId: '2PACX-1vR_FhgMBPH8KBXMazPxGEqoPVzregO89L32ZbyaKJRzUEtFNqrY9RZwmbEqiPMZofUrDGmWyTYlOBOU',
    documentId: '1-hCRFfJ_x0xmg1Yt61zFuJiyG9YsRdvRRdAaX08EHww',
  },
  {
    course: 'puc-2', semester: 'sem-2', section: 'B4',
    storageId: '62f0e92b4906bb0537576a64',
    publishedId: '2PACX-1vRHIcXFZnSsu-jUGdOslA7WRl3lL-kGnzww7FdDf5WdjtCx0QxQ3ZN0Z3ElZYgIa_5TF97dYerr1EIX',
    documentId: '1NNPp2wT4bVvmgPyneBDycOpumSiDa6RwxeurWgccA-c',
  },
  {
    course: 'puc-2', semester: 'sem-2', section: 'B5',
    storageId: '62f0e9a34906bb0537576a6f',
    publishedId: '2PACX-1vSR5eauxsIhpIbHz9_VZpqUN5eV2xO-eIxViMa6AuPXzj-ppkLmTQLu7ov2P0SC5A4Vwo4WkiaFpBQ2',
    documentId: '18JbYfsldrrQ9HeB3dyotY73mJGh--0zmHXJ4qcy3KxE',
  },
  {
    course: 'puc-2', semester: 'sem-2', section: 'B6',
    storageId: '62f332e6bca21f053ea7b88d',
    publishedId: '2PACX-1vQbYo9pUzPrsIWVw-rZR0_4UIAUvzrJ6EGV4s-r_q31IOTE4tqlHzqd-8dNy2pjvKAS7Vzsl21k2hL_',
    documentId: '1BbiKPyGZ625s7u4A5XxvfveeN0-4lBvSc6SVKhtzw4M',
  },
  {
    course: 'puc-2', semester: 'sem-2', section: 'B7',
    storageId: '62f333824906bb053757ab26',
    publishedId: '2PACX-1vQZyjV04EvOEkLIwvAUDlEbJ5h1ViSMx4EB3VTejhShD6QbR6ne9G8Bv-6P5_lrC9VudsGjtm9MxSJB',
    documentId: '1Fql39ZjrZzjCMGEJm1FLY-sdQOxBJc2FQepFtrXuxBo',
  },
  {
    course: 'puc-2', semester: 'sem-2', section: 'B8',
    storageId: '62f334434906bb053757ab2c',
    publishedId: '2PACX-1vSwXGjtzVql56Vp0_aXAtIXRNzZ9Ez4QYWhATyrctCU1_gVnGPYDsP_SWAAoESBF5BC_96Px2Y2sbAH',
    documentId: '1W_eyZ36KTTqcD-Dyaj7R9Ibl9vvq5dSAFX28bXt3A8A',
  },
  {
    course: 'puc-2', semester: 'sem-2', section: 'B9',
    storageId: '62f3348fbca21f053ea7b8b8',
    publishedId: '2PACX-1vQiqOOW5eVn9zq8qWaZ2u2HyPY64j3qlNb4w3YHPofgah1KXw8tFSYVsKzyMWZaynKkiM2FIzNrK0XN',
    documentId: '17yrSMfyoZfZme4-3l-WVo8NwW8jb5tkgi3eSZ23FfD8',
  },
];

/**
 * Which backend the pages talk to.
 *
 * 'demo'  Fixture roster held in localStorage. No network, no credentials. Every class
 *         in CLASSES resolves. This is the default so a fresh clone runs.
 * 'stein' The real Stein.HQ REST API over your Google Sheets.
 *
 * Override at runtime with ?provider=stein, which is remembered for the session.
 */
export const PROVIDER = 'demo';

export const STEIN_BASE = 'https://api.steinhq.com/v1/storages';

/** Network behaviour for the Stein provider. */
export const NETWORK = {
  timeoutMs: 15000,
  retries: 2,
  retryBackoffMs: 600,
};

/**
 * Sign-in. The hash is SHA-256 of the password, so the plaintext is not sitting in the
 * repo the way `if (passwd == "admin")` was.
 *
 * This is a gate, not security: the check runs in the browser, so anyone who can read
 * this file can bypass it. A static site cannot do better. Anything genuinely
 * confidential belongs behind the Google account on the sheet itself, not behind this.
 * DEVDOC.md, "Auth model" spells out the threat model.
 *
 * Regenerate a hash with:  node scripts/hash-password.mjs 'new-password'
 */
export const USERS = [
  {
    username: 'admin',
    // sha256('admin')
    passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
    displayName: 'Teacher',
  },
];

/** How long a sign-in lasts before the user has to log in again. */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** Below this attendance percentage a student is flagged in reports. */
export const ATTENDANCE_THRESHOLD = 75;

/** Stable key for one class, used in URLs and localStorage. */
export function classKey({ course, semester, section }) {
  return `${course}/${semester}/${section}`;
}

/** Human label for one class. */
export function classLabel({ course, semester, section }) {
  const courseLabel = COURSES.find((c) => c.id === course)?.label ?? course;
  const semesterLabel = SEMESTERS.find((s) => s.id === semester)?.label ?? semester;
  return `${courseLabel} ${semesterLabel} ${section}`;
}

/**
 * Look up a configured class. Returns undefined when the combination has no workbook,
 * which is what the pages turn into "no sheet is configured for this class" instead of
 * the original `window.stop()` plus alert.
 */
export function findClass({ course, semester, section }) {
  return CLASSES.find(
    (c) => c.course === course && c.semester === semester && c.section === section,
  );
}

/** Sections that actually have a workbook for the given course and semester. */
export function availableSections({ course, semester }) {
  return CLASSES.filter((c) => c.course === course && c.semester === semester).map(
    (c) => c.section,
  );
}

export function subjectLabel(id) {
  return SUBJECTS.find((s) => s.id === id)?.label ?? id;
}

export function periodLabel(id) {
  return PERIODS.find((p) => p.id === id)?.label ?? id;
}

export function steinUrl(storageId, subject) {
  return `${STEIN_BASE}/${storageId}/${encodeURIComponent(subject)}`;
}

export function publishedSheetUrl(publishedId) {
  return `https://docs.google.com/spreadsheets/d/e/${publishedId}/pubhtml?widget=true&headers=false`;
}

export function editSheetUrl(documentId) {
  return `https://docs.google.com/spreadsheets/d/${documentId}/edit`;
}
