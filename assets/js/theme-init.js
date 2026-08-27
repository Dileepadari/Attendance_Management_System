/**
 * Applies the stored theme before the page paints.
 *
 * This is a classic script, not a module, and it is loaded from <head> without defer on
 * purpose. `<script type="module">` is deferred by definition, so it does not run until
 * after the document has parsed and painted. Applying the theme from a module means a
 * visitor who chose dark sees a white page flash on every navigation.
 *
 * It duplicates two things from theme.js: the storage key, and the guarded localStorage
 * read. That is the price of running before anything can be imported, and it is a few
 * lines rather than a layer. If you change THEME_KEY in theme.js, change it here too.
 */
(function applyStoredTheme() {
  try {
    // localStorage throws rather than returning null in Safari private mode and wherever
    // site data is blocked. A theme preference is never worth breaking a page over.
    var theme = window.localStorage.getItem('ams:theme');
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  } catch (error) {
    // No stored preference reachable: fall through to prefers-color-scheme, which is
    // exactly the default state.
  }
})();
