/**
 * Shared First Flight booking gate: discount code modal before Calendly.
 * Intercepts links to first-flight-session; expose LbFirstFlight.openModal().
 */
(function (global) {
  'use strict';

  var CALENDLY_URL = 'https://calendly.com/lilbirdlifecoaching/first-flight-session';
  var LIST_USD = 299;
  var SALE_USD = 149;
  var COUPON_CODE = 'IMREADY';
  var FF_PATH = '/lilbirdlifecoaching/first-flight-session';

  var stylesInjected = false;
  var modalBuilt = false;

  function isFirstFlightUrl(href) {
    if (!href) return false;
    try {
      var u = new URL(href, global.location.href);
      return u.protocol === 'https:' &&
        u.hostname === 'calendly.com' &&
        u.pathname === FF_PATH;
    } catch (e) {
      return String(href).indexOf('first-flight-session') !== -1;
    }
  }

  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    var css = document.createElement('style');
    css.id = 'lb-ff-modal-styles';
    css.textContent = [
      '#lb-ff-modal-overlay{position:fixed;inset:0;z-index:10050;',
      'background:rgba(10,11,15,0.82);display:none;align-items:center;justify-content:center;padding:1.5rem}',
      '#lb-ff-modal-overlay.open{display:flex}',
      '#lb-ff-modal-box{background:#2a2d38;border:1px solid rgba(245,200,66,0.3);',
      'border-radius:14px;padding:2.25rem 2rem;max-width:420px;width:100%;text-align:center;position:relative}',
      '#lb-ff-modal-close{position:absolute;top:1rem;right:1.1rem;background:none;border:none;',
      'color:#a09880;font-size:1.1rem;cursor:pointer;line-height:1;font-family:"DM Mono",monospace}',
      '#lb-ff-modal-close:hover{color:#f0ead8}',
      '.lb-ff-modal-tag{font-family:"DM Mono",monospace;font-size:0.58rem;letter-spacing:0.2em;',
      'text-transform:uppercase;color:#F5C842;background:rgba(245,200,66,0.08);',
      'border:1px solid rgba(245,200,66,0.2);padding:0.3rem 0.8rem;border-radius:100px;',
      'display:inline-block;margin-bottom:1.25rem}',
      '.lb-ff-modal-headline{font-family:"Playfair Display",serif;font-size:1.5rem;font-weight:400;',
      'line-height:1.3;margin-bottom:0.6rem;color:#f0ead8}',
      '.lb-ff-modal-headline em{font-style:italic;color:#F5C842}',
      '.lb-ff-modal-sub{font-size:0.87rem;color:#a09880;line-height:1.65;margin-bottom:1.75rem}',
      '.lb-ff-modal-code-wrap{background:#252830;border:1px dashed rgba(245,200,66,0.35);',
      'border-radius:8px;padding:0.85rem 1.25rem;margin-bottom:1.5rem;',
      'display:flex;align-items:center;justify-content:space-between;gap:1rem}',
      '.lb-ff-modal-code{font-family:"DM Mono",monospace;font-size:1.3rem;letter-spacing:0.15em;color:#F5C842}',
      '.lb-ff-modal-copy{font-family:"DM Mono",monospace;font-size:0.6rem;letter-spacing:0.1em;',
      'text-transform:uppercase;background:none;border:1px solid rgba(245,200,66,0.15);',
      'color:#a09880;padding:0.35rem 0.7rem;border-radius:4px;cursor:pointer;white-space:nowrap}',
      '.lb-ff-modal-copy:hover{border-color:#F5C842;color:#F5C842}',
      '.lb-ff-modal-copy.copied{border-color:#5cba7a;color:#5cba7a}',
      '.lb-ff-modal-saving{font-size:0.78rem;color:#a09880;margin-bottom:1.5rem}',
      '.lb-ff-modal-saving strong{color:#5cba7a}',
      '.lb-ff-modal-cta{display:block;width:100%;background:#F5C842;color:#1e2028;border:none;',
      'padding:0.9rem;border-radius:6px;font-family:"DM Mono",monospace;font-size:0.7rem;',
      'letter-spacing:0.15em;text-transform:uppercase;cursor:pointer;text-decoration:none;font-weight:500}',
      '.lb-ff-modal-cta:hover{background:#fff}',
      '.lb-ff-modal-skip{display:block;margin-top:1rem;font-family:"DM Mono",monospace;font-size:0.58rem;',
      'letter-spacing:0.08em;text-transform:uppercase;color:#a09880;cursor:pointer;background:none;border:none}',
      '.lb-ff-modal-skip:hover{color:#f0ead8}'
    ].join('');
    document.head.appendChild(css);
  }

  function buildModal() {
    if (modalBuilt) return;
    modalBuilt = true;
    injectStyles();
    var overlay = document.createElement('div');
    overlay.id = 'lb-ff-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'First Flight discount');
    overlay.innerHTML = [
      '<div id="lb-ff-modal-box">',
      '<button type="button" id="lb-ff-modal-close" aria-label="Close">✕</button>',
      '<div class="lb-ff-modal-tag" id="lb-ff-modal-tag">✦ first flight offer</div>',
      '<h2 class="lb-ff-modal-headline">Half off your<br/><em>First Flight</em></h2>',
      '<p class="lb-ff-modal-sub" id="lb-ff-modal-sub"></p>',
      '<div class="lb-ff-modal-code-wrap">',
      '<span class="lb-ff-modal-code" id="lb-ff-modal-code"></span>',
      '<button type="button" class="lb-ff-modal-copy" id="lb-ff-modal-copy">Copy code</button>',
      '</div>',
      '<p class="lb-ff-modal-saving" id="lb-ff-modal-saving"></p>',
      '<a href="' + CALENDLY_URL + '" target="_blank" rel="noopener noreferrer" class="lb-ff-modal-cta" id="lb-ff-modal-cta" data-lb-ff-bypass>Book now with code →</a>',
      '<button type="button" class="lb-ff-modal-skip" id="lb-ff-modal-skip">I\'ll book without the discount</button>',
      '</div>'
    ].join('');
    document.body.appendChild(overlay);

    document.getElementById('lb-ff-modal-close').addEventListener('click', closeModal);
    document.getElementById('lb-ff-modal-skip').addEventListener('click', closeModal);
    document.getElementById('lb-ff-modal-copy').addEventListener('click', copyCode);
    document.getElementById('lb-ff-modal-cta').addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });
  }

  function syncCopy() {
    var save = LIST_USD - SALE_USD;
    var sub = document.getElementById('lb-ff-modal-sub');
    var saving = document.getElementById('lb-ff-modal-saving');
    var codeEl = document.getElementById('lb-ff-modal-code');
    if (sub) {
      sub.innerHTML = 'Use <strong style="color:#f0ead8">' + COUPON_CODE + '</strong> at checkout on Calendly — <strong style="color:#f0ead8">$' + SALE_USD + '</strong> for the full 2-hour session (list price $' + LIST_USD + ').';
    }
    if (saving) {
      saving.innerHTML = 'You save <strong>$' + save + '</strong> with this offer.';
    }
    if (codeEl) codeEl.textContent = COUPON_CODE;
  }

  function openModal(opts) {
    opts = opts || {};
    buildModal();
    syncCopy();
    var tag = document.getElementById('lb-ff-modal-tag');
    if (tag) {
      tag.textContent = opts.context === 'quiz'
        ? '✦ quiz completion discount'
        : '✦ first flight offer';
    }
    var sub = document.getElementById('lb-ff-modal-sub');
    if (sub && opts.context === 'quiz') {
      sub.innerHTML = 'Because you showed up and did the work. Use <strong style="color:#f0ead8">' + COUPON_CODE + '</strong> at checkout on Calendly — <strong style="color:#f0ead8">$' + SALE_USD + '</strong> for the full 2-hour session (list price $' + LIST_USD + ').';
    }
    var copyBtn = document.getElementById('lb-ff-modal-copy');
    if (copyBtn) {
      copyBtn.textContent = 'Copy code';
      copyBtn.classList.remove('copied');
    }
    document.getElementById('lb-ff-modal-overlay').classList.add('open');
  }

  function closeModal() {
    var overlay = document.getElementById('lb-ff-modal-overlay');
    if (overlay) overlay.classList.remove('open');
  }

  function copyCode() {
    var code = COUPON_CODE;
    function done() {
      var btn = document.getElementById('lb-ff-modal-copy');
      if (btn) {
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(done).catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
    function fallbackCopy() {
      var ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) { /* ignore */ }
      document.body.removeChild(ta);
      done();
    }
  }

  function interceptClick(e) {
    var link = e.target.closest('a[href]');
    if (!link || link.hasAttribute('data-lb-ff-bypass')) return;
    var href = link.getAttribute('href');
    if (!isFirstFlightUrl(href)) return;
    e.preventDefault();
    openModal();
  }

  function init() {
    buildModal();
    syncCopy();
    document.addEventListener('click', interceptClick, true);
  }

  global.LbFirstFlight = {
    openModal: openModal,
    closeModal: closeModal,
    copyCode: copyCode,
    isFirstFlightUrl: isFirstFlightUrl,
    CALENDLY_URL: CALENDLY_URL,
    COUPON_CODE: COUPON_CODE,
    LIST_USD: LIST_USD,
    SALE_USD: SALE_USD
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : this);
