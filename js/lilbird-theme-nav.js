/**
 * Injects sun/moon toggle + theme chrome on marketing / booking pages.
 * Homepage uses built-in toggle markup.
 */
(function (global) {
  var TOGGLE_HTML =
    '<button type="button" class="theme-toggle" id="theme-toggle" aria-pressed="false" aria-label="Switch appearance">' +
    '<span class="theme-toggle-track" aria-hidden="true">' +
    '<span class="theme-toggle-thumb">' +
    '<svg class="icon-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5"/>' +
    '<g stroke="currentColor" stroke-width="2" fill="none">' +
    '<line x1="12" y1="1" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="23"/>' +
    '<line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/>' +
    '<line x1="1" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="23" y2="12"/>' +
    '<line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/>' +
    '</g></svg>' +
    '<svg class="icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5z"/></svg>' +
    '</span></span>' +
    '<span class="theme-toggle-label">Night</span></button>';

  function findChromeAnchor() {
    return (
      document.querySelector('nav.site-nav') ||
      document.querySelector('nav') ||
      document.querySelector('header.top-bar') ||
      document.querySelector('.top-bar')
    );
  }

  function ensureChrome() {
    if (!document.getElementById('theme-wipe')) {
      var wipe = document.createElement('div');
      wipe.className = 'theme-wipe';
      wipe.id = 'theme-wipe';
      wipe.setAttribute('aria-hidden', 'true');
      document.body.insertBefore(wipe, document.body.firstChild);
    }
    if (!document.querySelector('.cmyk-stripe')) {
      var stripe = document.createElement('div');
      stripe.className = 'cmyk-stripe';
      stripe.setAttribute('aria-hidden', 'true');
      stripe.innerHTML =
        '<span class="cs-c"></span><span class="cs-m"></span><span class="cs-y"></span><span class="cs-k"></span>';
      var anchor = findChromeAnchor();
      if (anchor && anchor.parentNode) {
        anchor.parentNode.insertBefore(stripe, anchor);
      } else {
        document.body.insertBefore(stripe, document.body.firstChild);
      }
    }
  }

  function wireLogos() {
    document.querySelectorAll('.nav-bird, .nav-logo img, .final-bird').forEach(function (img) {
      if (!img.getAttribute('data-logo-dark')) {
        img.setAttribute('data-logo-dark', '/bird-logo.png');
        img.setAttribute('data-logo-light', '/bird-logo-teal.png');
        if (!img.getAttribute('src') || img.getAttribute('src').indexOf('data:') === 0) {
          img.setAttribute('src', '/bird-logo.png');
        }
      }
    });
  }

  function injectToggle() {
    if (document.querySelector('.theme-toggle')) return;
    var nav = document.querySelector('nav');
    var topBar = document.querySelector('header.top-bar') || document.querySelector('.top-bar');
    var host = null;
    if (nav) {
      host =
        nav.querySelector('.nav-user') ||
        nav.querySelector('.nav-right') ||
        nav.querySelector('.nav-actions') ||
        nav.querySelector('.site-nav-actions') ||
        nav.querySelector('div[style*="display:flex"]') ||
        nav;
    } else if (topBar) {
      host = topBar.querySelector('.top-bar-actions') || topBar;
    }
    if (!host) return;
    var wrap = document.createElement('div');
    wrap.className = 'lilbird-theme-toggle-wrap';
    wrap.style.cssText = 'display:inline-flex;align-items:center;';
    wrap.innerHTML = TOGGLE_HTML;
    if (host.classList && (host.classList.contains('top-bar-actions') || host.classList.contains('nav-user') || host.classList.contains('nav-right'))) {
      host.insertBefore(wrap, host.firstChild);
    } else if (host === nav || (host.classList && host.classList.contains('top-bar'))) {
      host.appendChild(wrap);
    } else {
      host.insertBefore(wrap, host.firstChild);
    }
  }

  function boot() {
    ensureChrome();
    wireLogos();
    injectToggle();
    if (global.LilbirdTheme) {
      if (typeof global.LilbirdTheme.boot === 'function') global.LilbirdTheme.boot();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
