/**
 * lil' bird day/night theme engine
 * Persists choice; animates CMYK wipe; updates logos + meta.
 */
(function (global) {
  var STORAGE_KEY = 'lilbird-theme';
  var root = document.documentElement;

  function systemPrefersDark() {
    return global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function getStored() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      if (v === 'light' || v === 'dark') return v;
    } catch (_) {}
    return null;
  }

  function resolveTheme() {
    var stored = getStored();
    if (stored) return stored;
    return systemPrefersDark() ? 'dark' : 'light';
  }

  function applyTheme(theme, opts) {
    opts = opts || {};
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f5f2eb' : '#1e2028');

    document.querySelectorAll('[data-logo-dark]').forEach(function (img) {
      var dark = img.getAttribute('data-logo-dark');
      var light = img.getAttribute('data-logo-light');
      if (dark && light) img.src = theme === 'light' ? light : dark;
    });

    var toggles = document.querySelectorAll('.theme-toggle');
    toggles.forEach(function (toggle) {
      var label = toggle.querySelector('.theme-toggle-label');
      if (label) label.textContent = theme === 'light' ? 'Day' : 'Night';
      toggle.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
      toggle.setAttribute(
        'aria-label',
        theme === 'light' ? 'Switch to night mode' : 'Switch to day mode'
      );
    });

    if (opts.animate && !global.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      var wipe = document.getElementById('theme-wipe');
      if (wipe) {
        wipe.classList.remove('is-active');
        void wipe.offsetWidth;
        wipe.classList.add('is-active');
        setTimeout(function () { wipe.classList.remove('is-active'); }, 600);
      }
    }

    if (global.LilbirdSite && typeof global.LilbirdSite.refreshParticles === 'function') {
      global.LilbirdSite.refreshParticles(theme);
    }

    try {
      global.dispatchEvent(new CustomEvent('lilbird-theme-change', { detail: { theme: theme } }));
    } catch (_) {}
  }

  function setTheme(theme, opts) {
    if (theme !== 'light' && theme !== 'dark') return;
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (_) {}
    applyTheme(theme, opts);
  }

  function toggleTheme() {
    var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    setTheme(next, { animate: true });
  }

  function boot() {
    applyTheme(resolveTheme(), { animate: false });
    document.querySelectorAll('.theme-toggle').forEach(function (btn) {
      if (btn.getAttribute('data-theme-wired') === '1') return;
      btn.setAttribute('data-theme-wired', '1');
      btn.addEventListener('click', toggleTheme);
    });
  }

  global.LilbirdTheme = {
    boot: boot,
    setTheme: setTheme,
    toggleTheme: toggleTheme,
    getTheme: function () { return root.getAttribute('data-theme') || 'dark'; },
    resolveTheme: resolveTheme,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
