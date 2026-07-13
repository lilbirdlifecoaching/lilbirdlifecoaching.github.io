/**
 * First Flight booking helper — routes old Calendly links / openModal() to
 * the Stripe pay → Cal.com book flow at /first-flight/book.html.
 */
(function (global) {
  'use strict';

  var BOOK_URL = '/first-flight/book.html';
  var LIST_USD = 299;
  var SALE_USD = 149;
  var COUPON_CODE = 'IMREADY';
  var FF_PATH = '/lilbirdlifecoaching/first-flight-session';
  var CALENDLY_URL = 'https://calendly.com' + FF_PATH;

  function isFirstFlightUrl(href) {
    if (!href) return false;
    try {
      var u = new URL(href, global.location.href);
      if (u.hostname === 'calendly.com' && u.pathname === FF_PATH) return true;
      if (u.pathname.indexOf('/first-flight/book') === 0) return true;
      return String(href).indexOf('first-flight-session') !== -1 ||
        String(href).indexOf('/first-flight/book') !== -1;
    } catch (e) {
      return String(href).indexOf('first-flight-session') !== -1 ||
        String(href).indexOf('/first-flight/book') !== -1;
    }
  }

  function bookHref(opts) {
    opts = opts || {};
    var url = BOOK_URL;
    var code = opts.code || COUPON_CODE;
    if (code) url += (url.indexOf('?') === -1 ? '?' : '&') + 'code=' + encodeURIComponent(code);
    return url;
  }

  function goToBook(opts) {
    global.location.href = bookHref(opts);
  }

  /** Back-compat: modal used to show IMREADY; now go straight to pay page with code. */
  function openModal(opts) {
    goToBook({ code: (opts && opts.code) || COUPON_CODE });
  }

  function closeModal() { /* no-op — modal retired */ }
  function copyCode() { /* no-op */ }

  function interceptClick(e) {
    var link = e.target.closest('a[href]');
    if (!link || link.hasAttribute('data-lb-ff-bypass')) return;
    var href = link.getAttribute('href');
    if (!isFirstFlightUrl(href)) return;
    // Already on the new book page path — let it through
    try {
      var u = new URL(href, global.location.href);
      if (u.pathname.indexOf('/first-flight/book') === 0) return;
    } catch (err) { /* fall through */ }
    e.preventDefault();
    goToBook();
  }

  function init() {
    document.addEventListener('click', interceptClick, true);
  }

  global.LbFirstFlight = {
    openModal: openModal,
    closeModal: closeModal,
    copyCode: copyCode,
    goToBook: goToBook,
    bookHref: bookHref,
    isFirstFlightUrl: isFirstFlightUrl,
    BOOK_URL: BOOK_URL,
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
