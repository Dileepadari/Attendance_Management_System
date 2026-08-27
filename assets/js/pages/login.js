import { isSignedIn, redirectTarget, signIn } from '../auth.js';
import { isDemo } from '../api.js';
import { $, status, themeToggle } from '../ui.js';

// Already signed in: go straight through rather than showing a form that will just
// bounce. replace() keeps the login page out of the back-button history.
if (isSignedIn()) {
  globalThis.location.replace(redirectTarget());
}

// The login page has no site header, so the toggle gets its own mount in the card.
$('#theme-mount').replaceWith(themeToggle());

const feedback = status();
const form = $('#login-form');
const submit = $('#submit');

if (isDemo()) $('#demo-hint').hidden = false;

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  feedback.clear();

  const username = $('#username').value;
  const password = $('#password').value;

  submit.disabled = true;
  submit.textContent = 'Signing in…';

  try {
    const result = await signIn(username, password);
    if (!result.ok) {
      feedback.error(result.message);
      $('#password').value = '';
      $('#password').focus();
      return;
    }
    globalThis.location.replace(redirectTarget());
  } catch (error) {
    // hashPassword needs WebCrypto, which browsers only expose on a secure context.
    // Opening the folder over plain http:// from another machine is the way to hit this.
    feedback.error(
      'Could not sign in. Serve the site over http://localhost or https - the browser only allows password hashing on a secure origin.',
    );
    console.error(error);
  } finally {
    submit.disabled = false;
    submit.textContent = 'Sign in';
  }
});

$('#username').focus();
