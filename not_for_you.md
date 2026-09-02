# not_for_you.md

A personal working log. Not documentation, and nothing here is needed to use or contribute to this project. Everything a newcomer actually needs is in [README.md](./README.md) and [DEVDOC.md](./DEVDOC.md).

---

## What changed from the 2022 version

The original was four HTML pages with the logic inline. This is what was actually wrong with it, kept because the reasons are still the reasons the current shape is the current shape.

| Was | Now |
|---|---|
| A nine-branch `if/else` per page mapping class to sheet URL, repeated in four pages | One `CLASSES` array in `config.js`. Adding a section is one entry, not four edits |
| `if (passwd == "admin")` | SHA-256 of the password in config, so the plaintext is not in the repo |
| A localStorage flag that never expired | A session with a 12-hour TTL, refreshed on activity |
| The guard ran after paint, flashing the roster before redirecting | Runs before paint, so a protected page never shows its content |
| Login said which of username or password was wrong | One message for both, so the form is not an account oracle |
| `fetch(url)` with no timeout, no status check, no `catch` | 15s timeout, status handling, bounded retries, and every failure turned into a sentence a teacher can act on |
| A rate-limited response threw inside an unawaited async function; the page sat on a spinner forever | `ApiError` with a message, surfaced in the UI |
| `Object.keys(data[0]).length - 2` to count students | Keys read and the two label columns filtered out, so a workbook with no `period` column does not silently drop the last student |
| `Number(undefined)` on a blank cell produced `NaN` totals | Blank cells are excluded from numerator and denominator, so a mid-term joiner is not absent for sessions before they enrolled |
| Fully blank trailing rows counted as a session where everyone was absent | Rows with no date are filtered out |
| A duplicate date and period appended silently, halving every percentage | Asks before replacing the earlier row |
| `localStorage.getItem` at the top of an inline script | Everything goes through `storage.js`, which never throws and falls back to memory |
| `window.stop()` plus an alert for an unconfigured class | "No sheet is configured for this class" |
| The 404 page returned 200 | Returns 404 |
| No tests | 98, mostly against the pure functions in `sheet.js` |

---

## Local notes

### `assets/js/config.js`

- The file is plain ESM with no browser globals specifically so `node --test` can import it directly. Adding a `window` reference here breaks the whole test suite, which is why the header says so.
- The sheet ids are the dead 2022 ones. Left in deliberately: they document the shape of a real configuration, and they are identifiers rather than credentials. See DEVDOC security notes.
- `SUBJECTS` ids double as sheet tab names, so renaming one means renaming a tab in every workbook. That coupling is inherited from the original sheets and is not worth breaking.

### `assets/js/sheet.js`

- `studentColumns` sorts numerically when the keys look numeric and lexically otherwise. Real workbooks number columns `1, 2, 3`, but a hand-edited one sometimes has `1a`, and a plain string sort would put `10` before `2`.
- `readMark` accepts `1/0`, `p/a`, `present/absent` and `true/false`. Teachers editing by hand type all of them.
- `buildSessionRow` writes absent rather than blank for any roster column missing from `marks`. A half-submitted form producing blanks would later read as "not enrolled yet", which is worse than a wrong absence.
- `toCsv` quotes only when the value contains a comma, quote or newline. Excel is happier with that than with everything quoted.

### `assets/js/api.js`

- `activeProvider` reads `?provider=` first and remembers it for the session. That is how the real backend gets demoed without editing a file.
- The retry count applies to `GET` only, and the reason is in a comment because it is the kind of thing someone "fixes" later.
- `describeStatus` special-cases `invalid_grant` because that is the failure this deployment actually hit, and the generic "400 Bad Request" told nobody anything.

### `assets/js/storage.js`

- The probe writes and removes a key rather than checking for the object. Safari private mode has `localStorage` present and throws on access, so presence proves nothing.
- Writes go to the in-memory map first, so a quota failure still serves the current tab. A draft about to be submitted does not need to survive a reload.

### `assets/js/ui.js`

- The nav checkbox must precede `.main-nav` for the `:checked ~` selector that opens the mobile menu, and the theme toggle must follow it to land at the far right on desktop. That ordering is load-bearing and there is a comment saying so.
- The hamburger was a literal trigram glyph (U+2630). It is now an inline SVG in the same `ICONS` object as the sun and moon, so it inherits `currentColor` and sizes with the button instead of depending on the platform font.
- `ICONS` was declared below its first use. It worked, because the use is inside a function that runs after module evaluation, but it sat one refactor away from a temporal-dead-zone error. Moved above.

### Tests

- `npm test` uses `node --test test/*.test.js`, unquoted, so the shell expands the glob. A quoted pattern relies on Node's own glob support, which only landed in Node 21: it passes locally on 22 and fails on 20 with "Could not find". CI caught this; nothing local would have.
- The suite is heaviest on `sheet.js` because that is where a bug is silent: a wrong percentage looks like a number, not like an error.
- `theme.test.js` needs a fake `matchMedia`; there is no jsdom here, so it is hand-stubbed.

### Screenshots

- Captured by driving the browser against a local `http-server`, with the app rendered in an iframe at the exact target viewport and scrollbars hidden by injected CSS. One image per screen per viewport.
- Zoom regions for this window are in screenshot pixels rather than CSS pixels, a factor of about 0.8118. A 1440x900 viewport is captured as region `0,0,1169,731`. This differs between browser windows, so it is worth re-measuring rather than assuming.
- Unlike Radix components elsewhere, these are plain HTML buttons, so a synthetic `element.click()` from injected JavaScript is enough to drive **Load register** and **Build report**.
- The old `assets/img/screenshot-*.jpg` were superseded by `docs/screenshots/` and removed.

## Open threads

- `SUBJECTS` is hardcoded and shared by every class. A college that teaches different subjects per course needs it per class.
- Demo mode has no way to reset to a fresh roster except signing out.
- The published-sheet embed on the class report is an iframe to Google. In demo mode there is nothing to embed, so the panel is simply absent rather than explaining itself.
