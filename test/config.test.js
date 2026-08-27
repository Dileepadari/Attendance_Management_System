import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CLASSES, PERIODS, SECTIONS, SUBJECTS, availableSections, classKey, classLabel,
  editSheetUrl, findClass, publishedSheetUrl, steinUrl, subjectLabel,
} from '../assets/js/config.js';

describe('CLASSES', () => {
  it('gives every class all three sheet ids', () => {
    // A class missing one of these produces a dead link or a blank iframe at runtime
    // rather than an error, so it is worth catching here.
    for (const klass of CLASSES) {
      assert.ok(klass.storageId, `${classKey(klass)} has no storageId`);
      assert.ok(klass.publishedId, `${classKey(klass)} has no publishedId`);
      assert.ok(klass.documentId, `${classKey(klass)} has no documentId`);
    }
  });

  it('has no duplicate class keys', () => {
    const keys = CLASSES.map(classKey);
    assert.equal(new Set(keys).size, keys.length);
  });

  it('has no duplicate storage ids', () => {
    // Two classes pointing at one workbook means one class overwrites the other's
    // attendance. This exact copy-paste slip is easy to make in the CLASSES table.
    const ids = CLASSES.map((c) => c.storageId);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('only uses sections that exist in SECTIONS', () => {
    for (const klass of CLASSES) {
      assert.ok(SECTIONS.includes(klass.section), `unknown section ${klass.section}`);
    }
  });
});

describe('findClass', () => {
  it('finds a configured class', () => {
    const klass = findClass({ course: 'puc-2', semester: 'sem-2', section: 'B3' });
    assert.equal(klass.storageId, '62f0e5a6bca21f053ea776ec');
  });

  it('returns undefined for a class with no workbook', () => {
    // The original alerted "can't find the sheet" and called window.stop(). The pages
    // need a value they can turn into a message instead.
    assert.equal(findClass({ course: 'puc-1', semester: 'sem-1', section: 'B1' }), undefined);
  });
});

describe('availableSections', () => {
  it('lists only sections that have a workbook', () => {
    const sections = availableSections({ course: 'puc-2', semester: 'sem-2' });
    assert.deepEqual(sections, ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9']);
  });

  it('is empty for a course and semester with nothing configured', () => {
    assert.deepEqual(availableSections({ course: 'puc-1', semester: 'sem-1' }), []);
  });
});

describe('labels', () => {
  it('renders a readable class label', () => {
    assert.equal(
      classLabel({ course: 'puc-2', semester: 'sem-2', section: 'B1' }),
      'PUC-2 Sem-2 B1',
    );
  });

  it('falls back to the raw id for an unknown value', () => {
    assert.equal(subjectLabel('astronomy'), 'astronomy');
  });
});

describe('url builders', () => {
  it('percent-encodes a subject containing a space', () => {
    // "information technology" is a real subject id, and an unencoded space produces a
    // URL that some proxies reject outright.
    assert.equal(
      steinUrl('abc123', 'information technology'),
      'https://api.steinhq.com/v1/storages/abc123/information%20technology',
    );
  });

  it('builds the published and editable sheet urls', () => {
    assert.match(publishedSheetUrl('2PACX-x'), /^https:\/\/docs\.google\.com\/spreadsheets\/d\/e\/2PACX-x\/pubhtml/);
    assert.equal(editSheetUrl('doc1'), 'https://docs.google.com/spreadsheets/d/doc1/edit');
  });
});

describe('lists', () => {
  it('defines eight periods', () => {
    assert.equal(PERIODS.length, 8);
    assert.equal(PERIODS[0].id, 'period-1');
  });

  it('has unique subject ids', () => {
    const ids = SUBJECTS.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});
