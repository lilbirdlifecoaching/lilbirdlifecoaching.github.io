/**
 * Reveal Nest back links on product pages (does not log the user out — /nest/ keeps session).
 * Markup: <a href="/nest/" id="nav-back-nest" class="lilbird-nav-nest" hidden>← back to your Nest</a>
 * Also supports id="topbar-back-nest" (First Flight workbook).
 */
(function () {
  var IDS = ['nav-back-nest', 'topbar-back-nest'];

  function showNestBackLinks() {
    IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.removeAttribute('hidden');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showNestBackLinks);
  } else {
    showNestBackLinks();
  }
})();
