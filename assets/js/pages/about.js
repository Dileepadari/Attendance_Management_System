import { activeProvider, isDemo } from '../api.js';
import { requireSession } from '../auth.js';
import { CLASSES } from '../config.js';
import { reset } from '../demo.js';
import { $, confirmDialog, initChrome, toast } from '../ui.js';

if (requireSession()) {
  initChrome('about.html');
  start();
}

function start() {
  $('#provider-note').textContent = isDemo()
    ? `Demo mode. Rosters are generated in your browser and anything you mark is kept in this browser's local storage only. ${CLASSES.length} classes are configured but none of them are being contacted.`
    : `Live mode. Reads and writes go to the Stein API over the ${CLASSES.length} configured Google Sheets workbooks.`;

  $('#demo-actions').hidden = !isDemo();

  $('#reset-demo')?.addEventListener('click', async () => {
    const confirmed = await confirmDialog({
      title: 'Clear demo attendance?',
      message: 'Everything you marked in demo mode is removed. The generated backfill stays.',
      confirmLabel: 'Clear',
    });
    if (!confirmed) return;
    reset();
    toast('Demo attendance cleared.', 'success');
  });

  console.info(`[attendance] provider: ${activeProvider()}`);
}
