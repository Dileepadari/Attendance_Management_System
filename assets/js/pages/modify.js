/**
 * Links straight into the underlying workbooks.
 *
 * The original needed a "GET LINK" button press and then revealed a bare anchor. The
 * links update as soon as the class changes, which is one interaction instead of three.
 */

import { requireSession } from '../auth.js';
import { classLabel, editSheetUrl, findClass, publishedSheetUrl } from '../config.js';
import { isDemo } from '../api.js';
import { $, bindClassPickers, initChrome, status } from '../ui.js';

if (requireSession()) {
  initChrome('modify.html');
  start();
}

function start() {
  const feedback = status();
  const pickers = { course: $('#course'), semester: $('#semester'), section: $('#section') };

  bindClassPickers(pickers, update);

  function update() {
    const selection = {
      course: pickers.course.value,
      semester: pickers.semester.value,
      section: pickers.section.value,
    };
    const klass = findClass(selection);

    if (!klass) {
      $('#links').hidden = true;
      feedback.info(`No workbook is configured for ${classLabel(selection)}.`);
      return;
    }

    if (isDemo()) {
      $('#links').hidden = true;
      feedback.info(
        'Demo mode uses generated data with no workbook behind it. Point PROVIDER at "stein" in assets/js/config.js to link to your real sheets.',
      );
      return;
    }

    feedback.clear();
    $('#links-title').textContent = classLabel(selection);
    $('#edit-link').href = editSheetUrl(klass.documentId);
    $('#view-link').href = publishedSheetUrl(klass.publishedId);
    $('#links').hidden = false;
  }
}
